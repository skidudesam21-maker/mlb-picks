// Daily pick generation pipeline.
// Called by /api/cron/generate once per day.

import { getScheduleForDate, getGameFeedLive } from "./mlb";
import {
  getMLBGameOdds,
  getFirstInningOdds,
  getPlayerPropsForEvent,
  extractNRFIPrice,
  extractMoneyline,
  pickBestBook,
  unitsWon,
} from "./odds";
import { analyzeNRFI } from "./models/nrfi";
import { analyzeMoneyline, isAcceptableMLOdds } from "./models/moneyline";
import { analyzeHitProps, analyzeStrikeoutProps } from "./models/props";
import { generateWriteup, confidenceToGrade } from "./ai";
import {
  clearPicksForDate,
  insertPick,
  getUngradedPicks,
  updatePickResult,
} from "./db";

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function currentSeason(): number {
  return new Date().getFullYear();
}

// Match an Odds API event to an MLB gamePk by team names + date proximity.
function findOddsEvent(oddsEvents: any[], game: any) {
  const awayName = game.away.name?.toLowerCase() ?? "";
  const homeName = game.home.name?.toLowerCase() ?? "";
  return oddsEvents.find((ev) => {
    const a = (ev.away_team ?? "").toLowerCase();
    const h = (ev.home_team ?? "").toLowerCase();
    return (
      (a.includes(awayName) || awayName.includes(a)) &&
      (h.includes(homeName) || homeName.includes(h))
    );
  });
}

export async function generateAllPicks(): Promise<{
  nrfiCount: number;
  mlCount: number;
  hitCount: number;
  kCount: number;
}> {
  const date = todayISO();
  const season = currentSeason();

  const schedule = await getScheduleForDate(date);
  const now = Date.now();
  const playable = schedule.filter((g: any) => {
    if (!g.home?.probablePitcher || !g.away?.probablePitcher) return false;
    if (g.status === "Final" || g.status === "Live" || g.status === "In Progress") return false;
    if (g.detailedState === "Postponed" || g.detailedState === "Suspended" || g.detailedState === "Cancelled") return false;
    // Exclude any game whose first pitch has already happened (or is within 5 minutes).
    if (g.gameDate) {
      const gameTs = new Date(g.gameDate).getTime();
      if (gameTs - now < 5 * 60 * 1000) return false;
    }
    return true;
  });

  // Pull odds
  const [gameOdds, firstInningOdds] = await Promise.all([
    getMLBGameOdds().catch(() => []),
    getFirstInningOdds().catch(() => []),
  ]);

  // ----- NRFI -----
  const nrfiResults = [];
  for (const g of playable) {
    try {
      const a = await analyzeNRFI(g, season);
      if (a) {
        const ev = findOddsEvent(firstInningOdds, g);
        const priced = ev ? extractNRFIPrice(ev) : null;
        nrfiResults.push({ analysis: a, odds: priced?.price ?? null, book: priced?.book ?? null });
      }
    } catch (e) {
      console.error("NRFI analysis failed for", g.gamePk, e);
    }
  }
  nrfiResults.sort((x, y) => y.analysis.confidence - x.analysis.confidence);
  const topNRFI = nrfiResults.slice(0, 3);

  // ----- Moneyline -----
  const mlResults = [];
  for (const g of playable) {
    try {
      const ev = findOddsEvent(gameOdds, g);
      const homeML = ev ? extractMoneyline(ev, g.home.name)?.price ?? null : null;
      const awayML = ev ? extractMoneyline(ev, g.away.name)?.price ?? null : null;
      const book = ev ? pickBestBook(ev.bookmakers ?? [])?.key ?? null : null;
      const a = await analyzeMoneyline(g, season, homeML, awayML);
      if (!a) continue;
      if (a.skipReason) continue; // e.g. missing team stats
      // Enforce odds range -250 to +180
      if (!isAcceptableMLOdds(a.odds)) continue;
      mlResults.push({ analysis: { ...a, book }, odds: a.odds });
    } catch (e) {
      console.error("ML analysis failed for", g.gamePk, e);
    }
  }
  mlResults.sort((x, y) => y.analysis.confidence - x.analysis.confidence);
  const topML = mlResults.slice(0, 3);

  // ----- Props -----
  const [hitPicks, kPicks] = await Promise.all([
    analyzeHitProps(playable, season).catch((e) => {
      console.error("hit props failed", e);
      return [];
    }),
    analyzeStrikeoutProps(playable, season).catch((e) => {
      console.error("k props failed", e);
      return [];
    }),
  ]);

  // Attach odds for top candidates only (save API calls).
  const topHitCandidates = hitPicks.slice(0, 8);
  const topKCandidates = kPicks.slice(0, 8);

  for (const g of playable) {
    const relevantEvent = findOddsEvent(gameOdds, g);
    if (!relevantEvent) continue;
    const hasHit = topHitCandidates.some((p) => p.gamePk === g.gamePk);
    const hasK = topKCandidates.some((p) => p.gamePk === g.gamePk);
    if (!hasHit && !hasK) continue;

    const propData = await getPlayerPropsForEvent(relevantEvent.id).catch(() => null);
    if (!propData) continue;

    const book = pickBestBook(propData.bookmakers ?? []);
    if (!book) continue;

    // Match hit picks
    const hitMarket = book.markets?.find((m: any) => m.key === "batter_hits");
    if (hitMarket) {
      for (const pick of topHitCandidates.filter((p) => p.gamePk === g.gamePk)) {
        const over = hitMarket.outcomes?.find(
          (o: any) =>
            o.name === "Over" &&
            o.description?.toLowerCase() === pick.playerName.toLowerCase() &&
            safeNum(o.point, 0.5) === 0.5
        );
        if (over) {
          pick.odds = over.price;
          pick.book = book.key;
        }
      }
    }

    // Match strikeout alt picks
    const kMarket =
      book.markets?.find((m: any) => m.key === "pitcher_strikeouts_alternate") ??
      book.markets?.find((m: any) => m.key === "pitcher_strikeouts");
    if (kMarket) {
      for (const pick of topKCandidates.filter((p) => p.gamePk === g.gamePk)) {
        const over = kMarket.outcomes?.find(
          (o: any) =>
            o.name === "Over" &&
            o.description?.toLowerCase() === pick.pitcherName.toLowerCase() &&
            Math.abs(safeNum(o.point, 0) - pick.line) < 0.01
        );
        if (over) {
          pick.odds = over.price;
          pick.book = book.key;
        }
      }
    }
  }

  const topHit = topHitCandidates.slice(0, 3);
  const topK = topKCandidates.slice(0, 3);

  // Clear existing same-day picks then insert.
  await clearPicksForDate(date, "nrfi");
  await clearPicksForDate(date, "moneyline");
  await clearPicksForDate(date, "hit");
  await clearPicksForDate(date, "strikeout");

  // NRFI insert
  let rank = 1;
  for (const r of topNRFI) {
    const grade = confidenceToGrade(r.analysis.confidence);
    const writeup = await generateWriteup(
      "nrfi",
      `${r.analysis.matchup} — NRFI (Under 0.5 runs, 1st inning)`,
      r.analysis.factors,
      r.analysis.confidence,
      grade,
      `Park: ${r.analysis.park.name} (run factor ${r.analysis.park.runFactor}). Weather: ${JSON.stringify(r.analysis.weather ?? {})}.`
    );
    await insertPick({
      date,
      category: "nrfi",
      rank,
      game_pk: r.analysis.gamePk,
      pick_label: `${r.analysis.matchup} — NRFI`,
      side: "Under 0.5 1st Inning",
      line: 0.5,
      odds: r.odds ?? null,
      book: r.book ?? null,
      grade,
      confidence: r.analysis.confidence,
      writeup,
      factors: r.analysis.factors,
      result: null,
      units: null,
      final_value: null,
    });
    rank++;
  }

  // ML insert
  rank = 1;
  for (const r of topML) {
    const a = r.analysis;
    const grade = confidenceToGrade(a.confidence);
    const writeup = await generateWriteup(
      "moneyline",
      `${a.pickTeam} ML vs ${a.matchup.replace(a.pickTeam, "").replace(/^@\s*/, "").replace(/\s*@\s*$/, "").trim()}`,
      a.factors,
      a.confidence,
      grade,
      `Edge vs market: ${(a.edge * 100).toFixed(1)}%.`
    );
    await insertPick({
      date,
      category: "moneyline",
      rank,
      game_pk: a.gamePk,
      pick_label: `${a.pickTeam} ML`,
      side: a.pickSide,
      line: null,
      odds: a.odds,
      book: (a as any).book ?? null,
      grade,
      confidence: a.confidence,
      writeup,
      factors: a.factors,
      result: null,
      units: null,
      final_value: null,
    });
    rank++;
  }

  // Hit insert
  rank = 1;
  for (const p of topHit) {
    const grade = confidenceToGrade(p.confidence);
    const writeup = await generateWriteup(
      "hit",
      `${p.playerName} (${p.team}) to record a hit vs ${p.opposingPitcher}`,
      p.factors,
      p.confidence,
      grade,
      `Model probability: ${(p.modelProb * 100).toFixed(1)}%.`
    );
    await insertPick({
      date,
      category: "hit",
      rank,
      game_pk: p.gamePk,
      pick_label: `${p.playerName} Over 0.5 Hits`,
      side: "Over",
      line: 0.5,
      odds: p.odds,
      book: p.book,
      grade,
      confidence: p.confidence,
      writeup,
      factors: p.factors,
      result: null,
      units: null,
      final_value: null,
    });
    rank++;
  }

  // K insert
  rank = 1;
  for (const p of topK) {
    const grade = confidenceToGrade(p.confidence);
    const writeup = await generateWriteup(
      "strikeout",
      `${p.pitcherName} Over ${p.line} Ks vs ${p.opposingTeam}`,
      p.factors,
      p.confidence,
      grade,
      `Model projects ${p.modelProjectedKs.toFixed(1)} Ks.`
    );
    await insertPick({
      date,
      category: "strikeout",
      rank,
      game_pk: p.gamePk,
      pick_label: `${p.pitcherName} Over ${p.line} Ks`,
      side: "Over",
      line: p.line,
      odds: p.odds,
      book: p.book,
      grade,
      confidence: p.confidence,
      writeup,
      factors: p.factors,
      result: null,
      units: null,
      final_value: null,
    });
    rank++;
  }

  return {
    nrfiCount: topNRFI.length,
    mlCount: topML.length,
    hitCount: topHit.length,
    kCount: topK.length,
  };
}

// ----------- GRADING ----------------

export async function gradeAllPicks(): Promise<{ graded: number }> {
  const ungraded = await getUngradedPicks();
  let count = 0;
  for (const pick of ungraded) {
    if (!pick.game_pk) continue;
    try {
      const feed = await getGameFeedLive(pick.game_pk);
      const state = feed?.gameData?.status?.abstractGameState;
      if (state !== "Final") continue;

      const result = await gradePick(pick, feed);
      if (result === null) continue;

      const units = pick.odds != null ? unitsWon(pick.odds, result) : 0;
      await updatePickResult(pick.id, result, units);
      count++;
    } catch (e) {
      console.error("grade failed", pick.id, e);
    }
  }
  return { graded: count };
}

async function gradePick(pick: any, feed: any): Promise<"W" | "L" | "P" | null> {
  const cat = pick.category;
  const linescore = feed?.liveData?.linescore;
  const allPlays = feed?.liveData?.plays?.allPlays ?? [];

  if (cat === "nrfi") {
    const inn1 = linescore?.innings?.find((i: any) => i.num === 1);
    if (!inn1) return null;
    const runs = (inn1.home?.runs ?? 0) + (inn1.away?.runs ?? 0);
    return runs === 0 ? "W" : "L";
  }

  if (cat === "moneyline") {
    const homeRuns = linescore?.teams?.home?.runs ?? 0;
    const awayRuns = linescore?.teams?.away?.runs ?? 0;
    if (homeRuns === awayRuns) return "P";
    const homeWon = homeRuns > awayRuns;
    if (pick.side === "home") return homeWon ? "W" : "L";
    if (pick.side === "away") return homeWon ? "L" : "W";
  }

  if (cat === "hit") {
    // Find player in boxscore
    const playerNameLower = pick.pick_label.split(" Over")[0].toLowerCase().trim();
    const boxscore = feed?.liveData?.boxscore;
    const teams = ["home", "away"];
    for (const t of teams) {
      const players = boxscore?.teams?.[t]?.players ?? {};
      for (const key of Object.keys(players)) {
        const p = players[key];
        const name = p?.person?.fullName?.toLowerCase() ?? "";
        if (name === playerNameLower) {
          const h = p?.stats?.batting?.hits ?? 0;
          return h >= 1 ? "W" : "L";
        }
      }
    }
    return null;
  }

  if (cat === "strikeout") {
    const pitcherName = pick.pick_label.split(" Over")[0].toLowerCase().trim();
    const boxscore = feed?.liveData?.boxscore;
    for (const t of ["home", "away"]) {
      const players = boxscore?.teams?.[t]?.players ?? {};
      for (const key of Object.keys(players)) {
        const p = players[key];
        const name = p?.person?.fullName?.toLowerCase() ?? "";
        if (name === pitcherName) {
          const k = p?.stats?.pitching?.strikeOuts ?? 0;
          return k > (pick.line ?? 0) ? "W" : "L";
        }
      }
    }
    return null;
  }

  return null;
}

function safeNum(v: any, fb = 0): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isFinite(n) ? n : fb;
}
