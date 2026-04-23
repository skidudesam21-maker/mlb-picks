// Backfill pipeline.
// Runs the model on past game dates using honest date-bounded stats:
//  - Pitcher "game logs up to date X" — only games before X count
//  - Team stats as of date X (the API's standard season endpoint returns stats AS OF a
//    point; for a true backtest we need the "sportId/season/byDateRange" pattern.
//    The MLB Stats API's gameLog-before-date is our main lever for honesty.)
//
// Limitations (disclosed to user):
//  - Season stats used are the CURRENT season totals, so recent-weeks backtest has some
//    data leakage. The primary signal we care about — pitcher last-5-before-date — is
//    handled honestly via game logs filtered by date.
//  - No real odds available (free Odds API doesn't provide history). Synthetic -110 odds
//    are used uniformly for unit math.
//  - No AI writeups generated for backfill picks (saves Groq calls + time).
//  - Typical backfill of 14 days ~= 10 minutes of API calls.

import { getScheduleForDate, getPitcherStats, getPitcherGameLog, getTeamStats, getTeamRoster, getPlayerHittingStats, getHitterGameLog, getGameFeedLive } from "./mlb";
import { getParkFactor } from "./parks";
import { analyzeNRFI } from "./models/nrfi";
import { analyzeMoneyline, isAcceptableMLOdds } from "./models/moneyline";
import { analyzeHitProps, analyzeStrikeoutProps } from "./models/props";
import { confidenceToGrade } from "./ai";
import { ensureSchema, clearPicksForDate, insertPick, updatePickResult } from "./db";
import { unitsWon } from "./odds";

const SYNTHETIC_ODDS = -110; // uniform for backfill

function dateISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Return an array of ISO date strings for the past N days, oldest-first.
function pastDates(daysBack: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = daysBack; i >= 1; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(dateISO(d));
  }
  return out;
}

export async function runBackfillRange(
  fromDate: string,
  toDate: string
): Promise<{ days: number; picksInserted: number; picksGraded: number; range: string }> {
  await ensureSchema();
  const dates: string[] = [];
  const start = new Date(fromDate + "T12:00:00Z");
  const end = new Date(toDate + "T12:00:00Z");
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  const season = new Date().getFullYear();
  let totalInserted = 0;
  let totalGraded = 0;

  for (const date of dates) {
    try {
      const result = await backfillOneDay(date, season);
      totalInserted += result.inserted;
      totalGraded += result.graded;
      console.log(`[backfill ${date}] inserted=${result.inserted} graded=${result.graded}`);
    } catch (e: any) {
      console.error(`[backfill ${date}] failed:`, e?.message ?? e);
    }
  }
  return {
    days: dates.length,
    picksInserted: totalInserted,
    picksGraded: totalGraded,
    range: `${fromDate} to ${toDate}`,
  };
}

export async function runBackfill(daysBack: number = 14): Promise<{
  days: number;
  picksInserted: number;
  picksGraded: number;
}> {
  const today = new Date();
  const toDate = new Date(today);
  toDate.setUTCDate(toDate.getUTCDate() - 1);
  const fromDate = new Date(today);
  fromDate.setUTCDate(fromDate.getUTCDate() - daysBack);
  const r = await runBackfillRange(
    fromDate.toISOString().slice(0, 10),
    toDate.toISOString().slice(0, 10)
  );
  return { days: r.days, picksInserted: r.picksInserted, picksGraded: r.picksGraded };
}

async function backfillOneDay(
  date: string,
  season: number
): Promise<{ inserted: number; graded: number }> {
  const schedule = await getScheduleForDate(date);
  const playable = schedule.filter(
    (g: any) =>
      g.home?.probablePitcher &&
      g.away?.probablePitcher &&
      g.status === "Final" // only grade finished games
  );

  if (!playable.length) return { inserted: 0, graded: 0 };

  // Clear prior backfill entries for this date (idempotent reruns).
  await clearPicksForDate(date, "nrfi");
  await clearPicksForDate(date, "moneyline");
  await clearPicksForDate(date, "hit");
  await clearPicksForDate(date, "strikeout");

  // ----- NRFI -----
  const nrfiResults = [];
  for (const g of playable) {
    try {
      const a = await analyzeNRFI(g, season);
      if (a) nrfiResults.push(a);
    } catch {}
  }
  nrfiResults.sort((x, y) => y.confidence - x.confidence);
  const topNRFI = nrfiResults.slice(0, 3);

  // ----- Moneyline -----
  const mlResults = [];
  for (const g of playable) {
    try {
      const a = await analyzeMoneyline(g, season, null, null);
      if (a && !a.skipReason) mlResults.push(a);
    } catch {}
  }
  mlResults.sort((x, y) => y.confidence - x.confidence);
  const topML = mlResults.slice(0, 3);

  // ----- Props -----
  const hitPicks = await analyzeHitProps(playable, season).catch(() => []);
  const kPicks = await analyzeStrikeoutProps(playable, season).catch(() => []);
  const topHit = hitPicks.slice(0, 3);
  const topK = kPicks.slice(0, 3);

  // Insert all picks
  let inserted = 0;
  let graded = 0;

  for (let rank = 0; rank < topNRFI.length; rank++) {
    const r = topNRFI[rank];
    await insertPick({
      date,
      category: "nrfi",
      rank: rank + 1,
      game_pk: r.gamePk,
      pick_label: `${r.matchup} — NRFI [backtest]`,
      side: "Under 0.5 1st Inning",
      line: 0.5,
      odds: SYNTHETIC_ODDS,
      book: "backtest",
      grade: confidenceToGrade(r.confidence),
      confidence: r.confidence,
      writeup: null,
      factors: r.factors,
      result: null,
      units: null,
      final_value: null,
    });
    inserted++;
  }

  for (let rank = 0; rank < topML.length; rank++) {
    const a = topML[rank];
    await insertPick({
      date,
      category: "moneyline",
      rank: rank + 1,
      game_pk: a.gamePk,
      pick_label: `${a.pickTeam} ML [backtest]`,
      side: a.pickSide,
      line: null,
      odds: SYNTHETIC_ODDS,
      book: "backtest",
      grade: confidenceToGrade(a.confidence),
      confidence: a.confidence,
      writeup: null,
      factors: a.factors,
      result: null,
      units: null,
      final_value: null,
    });
    inserted++;
  }

  for (let rank = 0; rank < topHit.length; rank++) {
    const p = topHit[rank];
    await insertPick({
      date,
      category: "hit",
      rank: rank + 1,
      game_pk: p.gamePk,
      pick_label: `${p.playerName} Over 0.5 Hits [backtest]`,
      side: "Over",
      line: 0.5,
      odds: SYNTHETIC_ODDS,
      book: "backtest",
      grade: confidenceToGrade(p.confidence),
      confidence: p.confidence,
      writeup: null,
      factors: p.factors,
      result: null,
      units: null,
      final_value: null,
    });
    inserted++;
  }

  for (let rank = 0; rank < topK.length; rank++) {
    const p = topK[rank];
    await insertPick({
      date,
      category: "strikeout",
      rank: rank + 1,
      game_pk: p.gamePk,
      pick_label: `${p.pitcherName} Over ${p.line} Ks [backtest]`,
      side: "Over",
      line: p.line,
      odds: SYNTHETIC_ODDS,
      book: "backtest",
      grade: confidenceToGrade(p.confidence),
      confidence: p.confidence,
      writeup: null,
      factors: p.factors,
      result: null,
      units: null,
      final_value: null,
    });
    inserted++;
  }

  // ----- Grade everything -----
  // Since these games are Final, grade immediately.
  // We query the DB-inserted picks by looking at what we just inserted.
  // Simpler: use the game feeds we already have.
  const feeds = new Map<number, any>();
  for (const g of playable) {
    try {
      const f = await getGameFeedLive(g.gamePk);
      feeds.set(g.gamePk, f);
    } catch {}
  }

  // Re-read today's picks and grade them
  // (we just inserted, so we need their IDs — easier to query via db)
  const { getTodayPicks } = await import("./db");
  const todaysCategories = ["nrfi", "moneyline", "hit", "strikeout"];
  for (const cat of todaysCategories) {
    const rows = await getTodayPicks(date, cat);
    for (const row of rows) {
      if (!row.game_pk) continue;
      const feed = feeds.get(row.game_pk);
      if (!feed) continue;
      const result = gradeRow(row, feed);
      if (!result) continue;
      const units = unitsWon(row.odds ?? SYNTHETIC_ODDS, result);
      await updatePickResult(row.id, result, units);
      graded++;
    }
  }

  return { inserted, graded };
}

function gradeRow(pick: any, feed: any): "W" | "L" | "P" | null {
  const cat = pick.category;
  const linescore = feed?.liveData?.linescore;

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

  if (cat === "hit" || cat === "strikeout") {
    const name = pick.pick_label.split(" Over")[0].toLowerCase().trim();
    const boxscore = feed?.liveData?.boxscore;
    for (const t of ["home", "away"]) {
      const players = boxscore?.teams?.[t]?.players ?? {};
      for (const key of Object.keys(players)) {
        const p = players[key];
        const pname = p?.person?.fullName?.toLowerCase() ?? "";
        if (pname === name) {
          if (cat === "hit") {
            const h = p?.stats?.batting?.hits ?? 0;
            return h >= 1 ? "W" : "L";
          } else {
            const k = p?.stats?.pitching?.strikeOuts ?? 0;
            return k > (pick.line ?? 0) ? "W" : "L";
          }
        }
      }
    }
    return null;
  }

  return null;
}
