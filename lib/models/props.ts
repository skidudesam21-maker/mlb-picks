// Player props model: batter to record a hit, pitcher to go over alt K line.
//
// Hit model signals:
//  - Season BA / OPS (overall + split vs opposing pitcher's handedness)
//  - Hot streak (last 15 games BA)
//  - Opposing pitcher quality (higher ERA/WHIP = more hit opportunities)
//  - Opposing pitcher K% (high K rate = harder to put ball in play)
//  - Park factor (hits subcomponent)
//  - Projected PAs (4 for lineup top, 3 for bottom — rough)
//
// Strikeout model:
//  - Pitcher K/9, K%
//  - Recent K trend (L5 starts)
//  - Opposing team K% as a lineup
//  - Park factor (some parks suppress or inflate Ks)
//  - Projected IP (based on recent pitch count, role)
//  - Alt line distance from expected Ks

import {
  getPitcherStats,
  getPitcherGameLog,
  getTeamStats,
  getTeamRoster,
  getPlayerHittingStats,
  getHitterGameLog,
} from "./../mlb";
import { getParkFactor } from "./../parks";

type Game = any;

export type HitPick = {
  gamePk: number;
  playerId: number;
  playerName: string;
  team: string;
  opposingPitcher: string;
  line: number; // typically 0.5
  confidence: number;
  modelProb: number;
  factors: { name: string; value: string; weight: number }[];
  odds: number | null;
  book: string | null;
};

export type StrikeoutPick = {
  gamePk: number;
  pitcherId: number;
  pitcherName: string;
  team: string;
  opposingTeam: string;
  line: number; // alt line, e.g. 5.5 or 6.5
  confidence: number;
  modelProjectedKs: number;
  factors: { name: string; value: string; weight: number }[];
  odds: number | null;
  book: string | null;
};

function safeNum(v: any, fb = 0): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isFinite(n) ? n : fb;
}

// --------- HITS ---------

function hitProbability(args: {
  ba: number; // hitter BA
  opsSplit: number; // OPS vs opposing hand
  recentBA: number; // last 15
  oppERA: number;
  oppKpct: number; // 0..1
  parkHits: number;
  projPA: number;
}): number {
  const { ba, opsSplit, recentBA, oppERA, oppKpct, parkHits, projPA } = args;

  // Base per-PA hit probability ~= BA adjusted for split and context.
  let perPA = ba;
  // Blend in split OPS and recent form.
  perPA = perPA * 0.55 + (recentBA * 0.25) + (opsSplit * 0.12) + (ba * 0.08);
  // Adjust for pitcher quality.
  perPA *= 0.92 + Math.max(-0.15, Math.min(0.25, (oppERA - 4.0) * 0.05));
  // Adjust for pitcher K tendency (higher K = fewer BIP = fewer hits).
  perPA *= 1 - Math.max(0, (oppKpct - 0.22) * 0.8);
  // Park adjustment.
  perPA *= parkHits / 100;
  perPA = Math.max(0.08, Math.min(0.45, perPA));

  // Prob of at least 1 hit in N PAs.
  return 1 - Math.pow(1 - perPA, projPA);
}

function projPAs(batterOrder: number): number {
  if (batterOrder <= 3) return 4.4;
  if (batterOrder <= 6) return 4.0;
  return 3.6;
}

function estimateKpct(p: any): number {
  if (!p?.season) return 0.22;
  const so = safeNum(p.season.strikeOuts, 0);
  const bf = safeNum(p.season.battersFaced, 0);
  if (bf < 50) return 0.22;
  return so / bf;
}

function recentBA(log: any[]): number {
  if (!log?.length) return 0.24;
  const ab = log.reduce((a, g) => a + g.ab, 0);
  const h = log.reduce((a, g) => a + g.h, 0);
  if (ab < 10) return 0.24;
  return h / ab;
}

export async function analyzeHitProps(
  games: Game[],
  season: number
): Promise<HitPick[]> {
  const candidates: HitPick[] = [];

  for (const game of games) {
    const hP = game.home.probablePitcher;
    const aP = game.away.probablePitcher;
    if (!hP || !aP) continue;

    const [hStats, aStats, homeRoster, awayRoster] = await Promise.all([
      getPitcherStats(hP.id, season),
      getPitcherStats(aP.id, season),
      getTeamRoster(game.home.id),
      getTeamRoster(game.away.id),
    ]);

    const park = getParkFactor(game.venue?.id);

    // Evaluate each team's top 5 non-pitcher hitters.
    const homeH = homeRoster.filter((r: any) => r.position !== "P").slice(0, 6);
    const awayH = awayRoster.filter((r: any) => r.position !== "P").slice(0, 6);

    for (let i = 0; i < homeH.length; i++) {
      const h = homeH[i];
      const pick = await evalHitter(h, i + 1, game.home.name, aStats, aP.fullName, game, park, season);
      if (pick) candidates.push(pick);
    }
    for (let i = 0; i < awayH.length; i++) {
      const h = awayH[i];
      const pick = await evalHitter(h, i + 1, game.away.name, hStats, hP.fullName, game, park, season);
      if (pick) candidates.push(pick);
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates;
}

async function evalHitter(
  hitter: any,
  batOrder: number,
  teamName: string,
  oppPitcher: any,
  oppPitcherName: string,
  game: any,
  park: { hits: number; name: string; runs: number },
  season: number
): Promise<HitPick | null> {
  if (!hitter?.id) return null;
  const [stats, log] = await Promise.all([
    getPlayerHittingStats(hitter.id, season),
    getHitterGameLog(hitter.id, season),
  ]);
  if (!stats?.season) return null;

  const throws = oppPitcher?.throws ?? "R";
  const splitKey = throws === "L" ? "vl" : "vr";
  const split = stats[splitKey] ?? stats.season;

  const ba = safeNum(stats.season.avg, 0.24);
  const opsSplit = safeNum(split?.ops, 0.7);
  const rBA = recentBA(log);
  const oppERA = safeNum(oppPitcher?.season?.era, 4.3);
  const kpct = estimateKpct(oppPitcher);
  const pa = projPAs(batOrder);

  const prob = hitProbability({
    ba,
    opsSplit,
    recentBA: rBA,
    oppERA,
    oppKpct: kpct,
    parkHits: park.hits,
    projPA: pa,
  });

  // Small-sample guard — require 50+ AB
  if (safeNum(stats.season.atBats, 0) < 50) return null;
  // Guard against bad split data
  if (opsSplit <= 0 || opsSplit > 1.5) return null;

  const confidence = Math.max(30, Math.min(90, Math.round(prob * 100)));

  return {
    gamePk: game.gamePk,
    playerId: hitter.id,
    playerName: hitter.name,
    team: teamName,
    opposingPitcher: oppPitcherName,
    line: 0.5,
    confidence,
    modelProb: prob,
    factors: [
      { name: "Season BA", value: ba.toFixed(3), weight: (ba - 0.245) * 100 },
      { name: `OPS vs ${throws}HP`, value: opsSplit.toFixed(3), weight: (opsSplit - 0.7) * 30 },
      { name: "BA last 15", value: rBA.toFixed(3), weight: (rBA - 0.245) * 60 },
      {
        name: `Opposing SP: ${oppPitcherName}`,
        value: `${oppERA.toFixed(2)} ERA · ${(kpct * 100).toFixed(1)}% K`,
        weight: (oppERA - 4.0) * 2 - (kpct - 0.22) * 40,
      },
      { name: `Park: ${park.name}`, value: `Hits factor ${park.hits}`, weight: park.hits - 100 },
      { name: "Projected PAs", value: pa.toFixed(1), weight: (pa - 4) * 3 },
    ],
    odds: null,
    book: null,
  };
}

// --------- STRIKEOUTS ---------

export async function analyzeStrikeoutProps(
  games: Game[],
  season: number
): Promise<StrikeoutPick[]> {
  const candidates: StrikeoutPick[] = [];

  for (const game of games) {
    const hP = game.home.probablePitcher;
    const aP = game.away.probablePitcher;
    if (!hP || !aP) continue;

    const [hStats, aStats, hLog, aLog, hTeam, aTeam] = await Promise.all([
      getPitcherStats(hP.id, season),
      getPitcherStats(aP.id, season),
      getPitcherGameLog(hP.id, season),
      getPitcherGameLog(aP.id, season),
      getTeamStats(game.home.id, season),
      getTeamStats(game.away.id, season),
    ]);

    const park = getParkFactor(game.venue?.id);

    const homeKPick = buildKPick(hStats, hP.fullName, hLog, game.home.name, aTeam, game.away.name, park, game.gamePk);
    const awayKPick = buildKPick(aStats, aP.fullName, aLog, game.away.name, hTeam, game.home.name, park, game.gamePk);

    if (homeKPick) candidates.push(homeKPick);
    if (awayKPick) candidates.push(awayKPick);
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates;
}

function buildKPick(
  p: any,
  pName: string,
  log: any[],
  team: string,
  oppTeam: any,
  oppTeamName: string,
  park: any,
  gamePk: number
): StrikeoutPick | null {
  if (!p?.season) return null;

  const ip = safeNum(p.season.inningsPitched, 0);
  if (ip < 30) return null; // need a real sample

  const k9 = safeNum(p.season.strikeoutsPer9Inn, 8);
  if (k9 < 6) return null; // don't pick low-K guys
  const so = safeNum(p.season.strikeOuts, 0);
  const bf = safeNum(p.season.battersFaced, 1);
  const kpct = so / Math.max(1, bf);

  // Recent IP to estimate workload.
  const avgIP = log.length ? log.reduce((a, g) => a + g.ip, 0) / log.length : 5.2;
  const recentK = log.length ? log.reduce((a, g) => a + g.so, 0) / log.length : k9 * avgIP / 9;

  // Opposing team K rate.
  const oppK = safeNum(oppTeam?.hitting?.strikeOuts, 0);
  const oppPA = safeNum(oppTeam?.hitting?.plateAppearances, 1);
  const oppKpct = oppPA ? oppK / oppPA : 0.22;

  // Projected Ks this game.
  const projPA = Math.max(18, Math.min(28, avgIP * 4.25));
  const perBatterK = (kpct + oppKpct) / 2;
  const projK = projPA * perBatterK * (park.runs < 100 ? 1.03 : 0.98);

  // Choose alt line that our model comfortably clears:
  // Aim for ~68-85% implied confidence — pick largest integer-ish line with projK - line >= 1.0.
  const lineCandidates = [3.5, 4.5, 5.5, 6.5, 7.5, 8.5];
  let chosenLine = 4.5;
  for (const l of lineCandidates) {
    if (projK - l >= 1.0) chosenLine = l;
  }

  // Confidence: distance from line in Ks, scaled.
  const diff = projK - chosenLine;
  const confidence = Math.max(30, Math.min(88, Math.round(50 + diff * 16)));

  return {
    gamePk,
    pitcherId: p.id,
    pitcherName: pName,
    team,
    opposingTeam: oppTeamName,
    line: chosenLine,
    confidence,
    modelProjectedKs: projK,
    factors: [
      { name: "K/9", value: k9.toFixed(1), weight: (k9 - 9) * 2 },
      { name: "K%", value: `${(kpct * 100).toFixed(1)}%`, weight: (kpct - 0.22) * 50 },
      { name: "Avg IP (L5)", value: avgIP.toFixed(1), weight: (avgIP - 5.2) * 4 },
      { name: "Avg Ks (L5)", value: recentK.toFixed(1), weight: (recentK - k9 * avgIP / 9) * 5 },
      { name: `${oppTeamName} K%`, value: `${(oppKpct * 100).toFixed(1)}%`, weight: (oppKpct - 0.22) * 50 },
      { name: `Park: ${park.name}`, value: `Run factor ${park.runs}`, weight: 0 },
      { name: "Model projected Ks", value: projK.toFixed(1), weight: diff * 10 },
    ],
    odds: null,
    book: null,
  };
}
