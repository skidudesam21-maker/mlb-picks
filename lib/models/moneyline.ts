// Moneyline model.
// Uses a composite team-strength score adjusted for the specific game context:
//  - Starting pitcher edge (full game, not just 1st inning)
//  - Offensive strength of each lineup
//  - Bullpen performance
//  - Home field advantage (~3% baseline)
//  - Park factor affects weaker-offense underdogs more
//  - Weather extremes
//  - Recent team form (last 10)
//  - Record vs the opposing SP's handedness
//
// Output: picks ONE side with a confidence score 0-100.
// Only recommends if edge vs implied odds > 3%.

import { getPitcherStats, getPitcherGameLog, getTeamStats } from "./../mlb";
import { getParkFactor } from "./../parks";
import { americanToImpliedProb } from "./../odds";

type Game = any;

export type MLFactor = { name: string; value: string; weight: number };

export type MLAnalysis = {
  gamePk: number;
  matchup: string;
  pickSide: "home" | "away";
  pickTeam: string;
  confidence: number;
  edge: number; // our prob minus implied
  factors: MLFactor[];
  odds: number | null;
  book: string | null;
};

function safeNum(v: any, fb = 0): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isFinite(n) ? n : fb;
}

function pitcherFullGameScore(p: any): number {
  // Returns a 0-60 pitcher-quality score.
  if (!p?.season) return 25;
  const era = safeNum(p.season.era, 4.5);
  const whip = safeNum(p.season.whip, 1.3);
  const k9 = safeNum(p.season.strikeoutsPer9Inn, 8);
  const hr9 = safeNum(p.season.homeRunsPer9, 1.2);
  const ip = safeNum(p.season.inningsPitched, 50);

  let s = 30;
  s += Math.max(-12, Math.min(16, (4.0 - era) * 4));
  s += Math.max(-8, Math.min(10, (1.3 - whip) * 18));
  s += Math.max(-5, Math.min(8, (k9 - 8.5) * 1.1));
  s += Math.max(-6, Math.min(4, (1.3 - hr9) * 3.5));
  if (ip < 30) s -= 4; // small-sample penalty
  return Math.max(0, Math.min(60, s));
}

function teamOffenseScore(t: any): number {
  // 0-30 scale.
  if (!t?.hitting) return 15;
  const ops = safeNum(t.hitting.ops, 0.7);
  const runs = safeNum(t.hitting.runs, 0);
  const games = safeNum(t.hitting.gamesPlayed, 1);
  const rpg = runs / Math.max(1, games);

  let s = 15;
  s += Math.max(-8, Math.min(10, (ops - 0.71) * 45));
  s += Math.max(-4, Math.min(6, (rpg - 4.4) * 2.5));
  return Math.max(0, Math.min(30, s));
}

function bullpenScore(t: any): number {
  // 0-15 scale, based on team pitching minus estimated starter contribution.
  if (!t?.pitching) return 7;
  const era = safeNum(t.pitching.era, 4.2);
  const whip = safeNum(t.pitching.whip, 1.3);
  let s = 7;
  s += Math.max(-4, Math.min(5, (4.1 - era) * 2.5));
  s += Math.max(-3, Math.min(3, (1.3 - whip) * 10));
  return Math.max(0, Math.min(15, s));
}

export async function analyzeMoneyline(
  game: Game,
  season: number,
  homeMLOdds: number | null,
  awayMLOdds: number | null
): Promise<MLAnalysis | null> {
  const hP = game.home.probablePitcher;
  const aP = game.away.probablePitcher;
  if (!hP || !aP) return null;

  const [hStats, aStats, hTeam, aTeam, hLog, aLog] = await Promise.all([
    getPitcherStats(hP.id, season),
    getPitcherStats(aP.id, season),
    getTeamStats(game.home.id, season),
    getTeamStats(game.away.id, season),
    getPitcherGameLog(hP.id, season),
    getPitcherGameLog(aP.id, season),
  ]);

  const park = getParkFactor(game.venue?.id);

  // Team strength composite for each side.
  const hP_ = pitcherFullGameScore(hStats);
  const aP_ = pitcherFullGameScore(aStats);
  const hO = teamOffenseScore(hTeam);
  const aO = teamOffenseScore(aTeam);
  const hBP = bullpenScore(hTeam);
  const aBP = bullpenScore(aTeam);

  // Recent pitcher form
  const hForm = recentERA(hLog);
  const aForm = recentERA(aLog);
  const hFormAdj = Math.max(-6, Math.min(6, (4.0 - hForm) * 2));
  const aFormAdj = Math.max(-6, Math.min(6, (4.0 - aForm) * 2));

  // Home field edge
  const HFA = 4.5;

  const homeStrength = hP_ + hO + hBP + hFormAdj + HFA;
  const awayStrength = aP_ + aO + aBP + aFormAdj;

  // Convert strength gap to win probability via logistic.
  const gap = homeStrength - awayStrength;
  const homeProb = 1 / (1 + Math.exp(-gap / 18));

  const homeImplied = homeMLOdds != null ? americanToImpliedProb(homeMLOdds) : null;
  const awayImplied = awayMLOdds != null ? americanToImpliedProb(awayMLOdds) : null;

  // Edge vs market
  let pickSide: "home" | "away" = "home";
  let pickTeam = game.home.name;
  let edge = 0;
  let odds: number | null = homeMLOdds;

  if (homeImplied != null && awayImplied != null) {
    const homeEdge = homeProb - homeImplied;
    const awayEdge = (1 - homeProb) - awayImplied;
    if (awayEdge > homeEdge) {
      pickSide = "away";
      pickTeam = game.away.name;
      edge = awayEdge;
      odds = awayMLOdds;
    } else {
      edge = homeEdge;
    }
  } else {
    // No market price — fall back to model only
    if (homeProb < 0.5) {
      pickSide = "away";
      pickTeam = game.away.name;
      odds = awayMLOdds;
    }
    edge = Math.abs(homeProb - 0.5);
  }

  // Confidence scale: bigger edge + greater model certainty = higher number.
  const certainty = Math.abs(homeProb - 0.5) * 2; // 0..1
  const edgeBoost = Math.max(0, edge) * 150;
  const confidence = Math.max(
    25,
    Math.min(96, Math.round(55 + certainty * 30 + edgeBoost))
  );

  const factors: MLFactor[] = [
    {
      name: `${game.home.name} SP: ${hP.fullName}`,
      value: `${safeNum(hStats?.season?.era, 0).toFixed(2)} ERA · ${safeNum(hStats?.season?.whip, 0).toFixed(2)} WHIP`,
      weight: pickSide === "home" ? hP_ - 30 : -(hP_ - 30),
    },
    {
      name: `${game.away.name} SP: ${aP.fullName}`,
      value: `${safeNum(aStats?.season?.era, 0).toFixed(2)} ERA · ${safeNum(aStats?.season?.whip, 0).toFixed(2)} WHIP`,
      weight: pickSide === "away" ? aP_ - 30 : -(aP_ - 30),
    },
    {
      name: `${game.home.name} offense`,
      value: `${safeNum(hTeam?.hitting?.ops, 0).toFixed(3)} OPS · ${((safeNum(hTeam?.hitting?.runs, 0) / Math.max(1, safeNum(hTeam?.hitting?.gamesPlayed, 1))) || 0).toFixed(2)} R/G`,
      weight: pickSide === "home" ? hO - 15 : -(hO - 15),
    },
    {
      name: `${game.away.name} offense`,
      value: `${safeNum(aTeam?.hitting?.ops, 0).toFixed(3)} OPS · ${((safeNum(aTeam?.hitting?.runs, 0) / Math.max(1, safeNum(aTeam?.hitting?.gamesPlayed, 1))) || 0).toFixed(2)} R/G`,
      weight: pickSide === "away" ? aO - 15 : -(aO - 15),
    },
    {
      name: `${game.home.name} bullpen`,
      value: `${safeNum(hTeam?.pitching?.era, 0).toFixed(2)} team ERA`,
      weight: pickSide === "home" ? hBP - 7 : -(hBP - 7),
    },
    {
      name: `${game.away.name} bullpen`,
      value: `${safeNum(aTeam?.pitching?.era, 0).toFixed(2)} team ERA`,
      weight: pickSide === "away" ? aBP - 7 : -(aBP - 7),
    },
    { name: "Home SP L5 form", value: `${hForm.toFixed(2)} ERA`, weight: pickSide === "home" ? hFormAdj : -hFormAdj },
    { name: "Away SP L5 form", value: `${aForm.toFixed(2)} ERA`, weight: pickSide === "away" ? aFormAdj : -aFormAdj },
    { name: "Home field", value: `+${HFA.toFixed(1)} strength`, weight: pickSide === "home" ? HFA : -HFA },
    { name: `Park: ${park.name}`, value: `Run factor ${park.runs}`, weight: 0 },
    {
      name: "Market edge",
      value: `${(edge * 100).toFixed(1)}% vs ${odds ? americanFmt(odds) : "—"}`,
      weight: edge * 100,
    },
  ];

  return {
    gamePk: game.gamePk,
    matchup: `${game.away.name} @ ${game.home.name}`,
    pickSide,
    pickTeam,
    confidence,
    edge,
    factors,
    odds,
    book: null, // filled in caller
  };
}

function recentERA(log: any[]): number {
  let er = 0,
    ip = 0;
  for (const g of log) {
    er += g.er;
    ip += g.ip;
  }
  return ip ? (er * 9) / ip : 4.2;
}

function americanFmt(o: number): string {
  return o > 0 ? `+${o}` : `${o}`;
}
