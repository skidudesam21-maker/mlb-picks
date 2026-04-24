// Simplified pipeline. Only produces moneyline picks.
// Rules:
//  - Top 3 picks per day
//  - Only teams priced at or shorter than +150 are eligible (favorites always welcome)
//  - Odds displayed ONLY when we have them; picks without odds still show
//  - Full AI writeup for each pick (collapsible on the UI)

import { getScheduleForDate, getGameFeedLive } from "./mlb";
import {
  getMLBGameOdds,
  extractMoneyline,
  pickBestBook,
  unitsWon,
} from "./odds";
import { analyzeMoneyline } from "./models/moneyline";
import { generateWriteup, confidenceToGrade } from "./ai";
import {
  clearPicksForDate,
  insertPick,
  getUngradedPicks,
  updatePickResult,
  setTodayPitchers,
} from "./db";

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function currentSeason(): number {
  return new Date().getFullYear();
}

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

// Only accept picks where the pick's odds are shorter than or equal to +150.
// Favorites (negative numbers) are always OK regardless of size.
function oddsEligible(odds: number | null): boolean {
  if (odds == null) return true; // allow picks without odds data
  if (odds < 0) return true; // any favorite is fine
  return odds <= 150; // underdogs only up to +150
}

export async function generateMoneylinePicks(): Promise<{
  playable: number;
  considered: number;
  kept: number;
  topCount: number;
}> {
  const date = todayISO();
  const season = currentSeason();

  const schedule = await getScheduleForDate(date);
  const playable = schedule.filter((g: any) => {
    if (!g.home?.probablePitcher || !g.away?.probablePitcher) return false;
    if (g.detailedState === "Postponed" || g.detailedState === "Cancelled" || g.detailedState === "Suspended") return false;
    return true;
  });

  // Remember today's pitchers for the "playing today" filter on the dashboard.
  const pitcherIds: number[] = [];
  for (const g of playable) {
    if (g.home?.probablePitcher?.id) pitcherIds.push(g.home.probablePitcher.id);
    if (g.away?.probablePitcher?.id) pitcherIds.push(g.away.probablePitcher.id);
  }
  await setTodayPitchers(date, pitcherIds);

  const gameOdds = await getMLBGameOdds().catch(() => [] as any[]);

  const results: any[] = [];
  let considered = 0;
  for (const g of playable) {
    try {
      const ev = findOddsEvent(gameOdds, g);
      const homeML = ev ? extractMoneyline(ev, g.home.name)?.price ?? null : null;
      const awayML = ev ? extractMoneyline(ev, g.away.name)?.price ?? null : null;
      const book = ev ? pickBestBook(ev.bookmakers ?? [])?.key ?? null : null;
      const a = await analyzeMoneyline(g, season, homeML, awayML);
      if (!a || a.skipReason) continue;
      considered++;
      if (!oddsEligible(a.odds)) continue;
      results.push({ analysis: { ...a, book }, odds: a.odds });
    } catch (e) {
      console.error("[moneyline] game failed", g.gamePk, e);
    }
  }
  console.log(`[moneyline] playable=${playable.length} considered=${considered} kept=${results.length}`);
  if (results.length > 0) {
    console.log(`[moneyline] top candidates:`, results.slice(0, 5).map((r) => ({
      team: r.analysis.pickTeam,
      conf: r.analysis.confidence,
      odds: r.analysis.odds,
    })));
  }

  results.sort((x, y) => y.analysis.confidence - x.analysis.confidence);
  const top = results.slice(0, 3);

  await clearPicksForDate(date, "moneyline");

  let rank = 1;
  for (const r of top) {
    const a = r.analysis;
    const grade = confidenceToGrade(a.confidence);
    let writeup = `${a.pickTeam} ML — grade ${grade}, confidence ${a.confidence}.`;
    try {
      const generated = await generateWriteup(
        "moneyline",
        `${a.pickTeam} ML`,
        a.factors,
        a.confidence,
        grade,
        `Matchup: ${a.matchup}. Model win prob ${(a.modelProb * 100).toFixed(0)}% vs implied ${(a.impliedProb * 100).toFixed(0)}%.`
      );
      if (generated && generated.length > 0) writeup = generated;
    } catch (e) {
      console.error("[moneyline] writeup failed for", a.pickTeam, e);
    }
    try {
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
      console.log(`[moneyline] inserted rank=${rank} ${a.pickTeam}`);
    } catch (e) {
      console.error("[moneyline] insert failed for", a.pickTeam, e);
    }
    rank++;
  }

  return {
    playable: playable.length,
    considered,
    kept: results.length,
    topCount: top.length,
  };
}

// ---------- Grading ----------
// Grades only moneyline picks. Once-per-day cron via vercel.json.

export async function gradeAllPicks(): Promise<{ graded: number }> {
  const ungraded = await getUngradedPicks();
  let count = 0;
  for (const pick of ungraded) {
    if (!pick.game_pk) continue;
    if (pick.category !== "moneyline") continue; // only ML right now
    try {
      const feed = await getGameFeedLive(pick.game_pk);
      const state = feed?.gameData?.status?.abstractGameState;
      if (state !== "Final") continue;
      const result = gradeMoneyline(pick, feed);
      if (result === null) continue;
      const units = pick.odds != null ? unitsWon(pick.odds, result) : (result === "W" ? 0.91 : result === "L" ? -1 : 0);
      await updatePickResult(pick.id, result, units);
      count++;
    } catch (e) {
      console.error("[grade] failed", pick.id, e);
    }
  }
  return { graded: count };
}

function gradeMoneyline(pick: any, feed: any): "W" | "L" | "P" | null {
  const linescore = feed?.liveData?.linescore;
  const homeRuns = linescore?.teams?.home?.runs ?? 0;
  const awayRuns = linescore?.teams?.away?.runs ?? 0;
  if (homeRuns === awayRuns) return "P";
  const homeWon = homeRuns > awayRuns;
  if (pick.side === "home") return homeWon ? "W" : "L";
  if (pick.side === "away") return homeWon ? "L" : "W";
  return null;
}
