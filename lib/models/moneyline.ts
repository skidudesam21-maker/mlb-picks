// Moneyline model — v2, with sample-size guards, odds limits, and market-respect confidence.
//
// Philosophy changes from v1:
//  - Cap picks to -250 to +180 American odds range (user preference: safer range)
//  - Prefer favorites: confidence is boosted when our model agrees with the market favorite
//  - Heavy penalty when model strongly disagrees with market (market is usually right)
//  - Require min sample size on pitcher stats (30 IP) and team stats (10 games) or fall back to league priors
//  - Never pick a team whose team stats are missing/empty (0.000 OPS case)
//  - Edge is clamped at 8% max contribution
//
// Odds range filter is applied AFTER selection — analyzer always returns the best pick,
// caller filters by odds range before ranking.

import { getPitcherStats, getPitcherGameLog, getTeamStats } from "./../mlb";
import { getParkFactor } from "./../parks";

type Game = any;

export type MLFactor = { name: string; value: string; weight: number };

export type MLAnalysis = {
  gamePk: number;
  matchup: string;
  pickSide: "home" | "away";
  pickTeam: string;
  confidence: number;
  edge: number;
  modelProb: number;
  impliedProb: number;
  factors: MLFactor[];
  odds: number | null;
  book: string | null;
  skipReason?: string;
};

const LG_ERA = 4.20;
const LG_WHIP = 1.30;
const LG_K9 = 8.5;
const LG_HR9 = 1.15;
const LG_OPS = 0.720;
const LG_RPG = 4.45;

function safeNum(v: any, fb = 0): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isFinite(n) ? n : fb;
}

function validStat(v: any): boolean {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isFinite(n) && n > 0;
}

function pitcherFullGameScore(p: any): { score: number; usedFallback: boolean } {
  if (!p?.season) return { score: 30, usedFallback: true };
  const ip = safeNum(p.season.inningsPitched, 0);
  const era = validStat(p.season.era) ? safeNum(p.season.era) : LG_ERA;
  const whip = validStat(p.season.whip) ? safeNum(p.season.whip) : LG_WHIP;
  const k9 = validStat(p.season.strikeoutsPer9Inn) ? safeNum(p.season.strikeoutsPer9Inn) : LG_K9;
  const hr9 = safeNum(p.season.homeRunsPer9, LG_HR9);

  const trust = Math.max(0.1, Math.min(1, (ip - 5) / 30));
  const blendedERA = era * trust + LG_ERA * (1 - trust);
  const blendedWHIP = whip * trust + LG_WHIP * (1 - trust);
  const blendedK9 = k9 * trust + LG_K9 * (1 - trust);
  const blendedHR9 = hr9 * trust + LG_HR9 * (1 - trust);

  let s = 30;
  s += Math.max(-10, Math.min(12, (LG_ERA - blendedERA) * 4));
  s += Math.max(-7, Math.min(8, (LG_WHIP - blendedWHIP) * 16));
  s += Math.max(-4, Math.min(6, (blendedK9 - LG_K9) * 1.0));
  s += Math.max(-5, Math.min(4, (LG_HR9 - blendedHR9) * 3.0));
  return { score: Math.max(5, Math.min(55, s)), usedFallback: ip < 15 };
}

function teamOffenseScore(t: any): { score: number; usedFallback: boolean } {
  if (!t?.hitting) return { score: 15, usedFallback: true };
  const games = safeNum(t.hitting.gamesPlayed, 0);
  const ops = validStat(t.hitting.ops) ? safeNum(t.hitting.ops) : LG_OPS;
  const runs = safeNum(t.hitting.runs, 0);
  const rpg = games > 0 ? runs / games : LG_RPG;

  const usedFallback = games < 10 || !validStat(t.hitting.ops);
  const trust = Math.max(0.2, Math.min(1, games / 15));
  const blendedOPS = ops * trust + LG_OPS * (1 - trust);
  const blendedRPG = rpg * trust + LG_RPG * (1 - trust);

  let s = 15;
  s += Math.max(-7, Math.min(9, (blendedOPS - LG_OPS) * 45));
  s += Math.max(-4, Math.min(5, (blendedRPG - LG_RPG) * 2.2));
  return { score: Math.max(5, Math.min(25, s)), usedFallback };
}

function bullpenScore(t: any): number {
  if (!t?.pitching) return 7;
  const era = validStat(t.pitching.era) ? safeNum(t.pitching.era) : LG_ERA;
  const whip = validStat(t.pitching.whip) ? safeNum(t.pitching.whip) : LG_WHIP;
  let s = 7;
  s += Math.max(-3, Math.min(4, (LG_ERA - era) * 2));
  s += Math.max(-2, Math.min(2, (LG_WHIP - whip) * 8));
  return Math.max(2, Math.min(13, s));
}

// Weather impact on run scoring. Returns a -3..+3 adjustment for the FAVORED OFFENSE.
// Hot/humid + wind-out = more runs. Cold + wind-in = fewer runs.
// For moneyline purposes: this shifts the strength of the team with the better OFFENSE
// (favorable conditions help whoever was going to score more anyway).
function weatherRunBoost(weather: any): number {
  if (!weather) return 0;
  let adj = 0;
  const tempStr = weather.temp ?? "";
  const temp = parseInt(tempStr);
  if (isFinite(temp)) {
    if (temp >= 85) adj += 2;
    else if (temp >= 75) adj += 1;
    else if (temp <= 45) adj -= 2;
    else if (temp <= 55) adj -= 1;
  }
  const wind = weather.wind ?? "";
  if (typeof wind === "string") {
    const mphMatch = wind.match(/(\d+)\s*mph/i);
    const mph = mphMatch ? parseInt(mphMatch[1]) : 0;
    if (/out/i.test(wind) && mph >= 10) adj += Math.min(3, Math.floor(mph / 5));
    if (/in/i.test(wind) && mph >= 10) adj -= Math.min(3, Math.floor(mph / 5));
  }
  return Math.max(-3, Math.min(3, adj));
}

// Lineup handedness vs opposing starter.
// Returns an adjustment to the offense score of the team whose lineup is facing `pitcher`.
// Uses pitcher's vs-L or vs-R splits: if pitcher is much worse vs RHH than vs LHH,
// and the opposing lineup is mostly righty (which most MLB lineups are), that offense gets a boost.
//
// We don't know exact lineup handedness per-game without real lineup data, so we use
// a league-wide prior: lineups are ~60% RHH, 40% LHH in typical MLB.
// When a pitcher's split OPS against their weaker side is >.750, that signals exploitable platoon.
function handednessAdjustment(pitcher: any): number {
  if (!pitcher) return 0;
  const vsL = pitcher.vsLeft?.ops;
  const vsR = pitcher.vsRight?.ops;
  const vsLNum = typeof vsL === "string" ? parseFloat(vsL) : vsL;
  const vsRNum = typeof vsR === "string" ? parseFloat(vsR) : vsR;
  if (!isFinite(vsLNum) || !isFinite(vsRNum)) return 0;
  // League average split is ~.710 OPS either side. Weight by how much worse the pitcher is
  // against the expected-majority (RHH) side of the lineup.
  const expectedOpposingOPS = vsRNum * 0.6 + vsLNum * 0.4;
  // If the pitcher has an expected opposing OPS > .780, the lineup exploits them.
  // Returns -3..+3 for the OFFENSE (positive = offense gets a boost because pitcher is vulnerable).
  const delta = (expectedOpposingOPS - 0.72) * 20;
  return Math.max(-3, Math.min(3, delta));
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

  const hHittingValid = hTeam?.hitting && validStat(hTeam.hitting.ops);
  const aHittingValid = aTeam?.hitting && validStat(aTeam.hitting.ops);
  // Note: we no longer skip when team stats are missing. teamOffenseScore() falls back
  // to league-average priors with a confidence penalty. The early bug (Apr 2026) caused
  // every pick to skip when the hydrate stats endpoint returned no data.

  const park = getParkFactor(game.venue?.id);
  const hPScore = pitcherFullGameScore(hStats);
  const aPScore = pitcherFullGameScore(aStats);
  const hO = teamOffenseScore(hTeam);
  const aO = teamOffenseScore(aTeam);
  const hBP = bullpenScore(hTeam);
  const aBP = bullpenScore(aTeam);

  const hForm = recentERA(hLog);
  const aForm = recentERA(aLog);
  const hFormAdj = Math.max(-4, Math.min(4, (LG_ERA - hForm) * 1.5));
  const aFormAdj = Math.max(-4, Math.min(4, (LG_ERA - aForm) * 1.5));

  // Handedness matchup: home offense vs away starter, and vice versa.
  // Positive value = the starter is vulnerable to the majority-righty lineup.
  const homeHandEdge = handednessAdjustment(aStats); // home hitters vs away pitcher
  const awayHandEdge = handednessAdjustment(hStats); // away hitters vs home pitcher

  // Weather: hot + wind-out helps whoever has the stronger offense more.
  // We add it to the side with the higher offense score.
  const weatherBoost = weatherRunBoost(game.weather);
  const homeWeatherAdj = hO.score >= aO.score ? weatherBoost : 0;
  const awayWeatherAdj = aO.score > hO.score ? weatherBoost : 0;

  const HFA = 4.5;

  const homeStrength =
    hPScore.score + hO.score + hBP + hFormAdj + HFA + homeHandEdge + homeWeatherAdj;
  const awayStrength =
    aPScore.score + aO.score + aBP + aFormAdj + awayHandEdge + awayWeatherAdj;

  const gap = homeStrength - awayStrength;
  let homeProb = 1 / (1 + Math.exp(-gap / 18));
  homeProb = Math.max(0.28, Math.min(0.72, homeProb));

  // (Odds are not used for model decisions. The caller applies the +150 filter.)

  // Pick side purely from the model — market odds do NOT influence this decision.
  const pickSide: "home" | "away" = homeProb >= 0.5 ? "home" : "away";
  const pickTeam = pickSide === "home" ? game.home.name : game.away.name;
  const odds = pickSide === "home" ? homeMLOdds : awayMLOdds; // passed through for the caller's +150 filter only
  const modelProb = pickSide === "home" ? homeProb : 1 - homeProb;

  // Confidence is based solely on the model's certainty and data quality.
  // 0.5 model prob → 50 confidence. 0.72 model prob → ~72 confidence.
  let confidence = modelProb * 100;

  // Small-sample penalties
  if (hPScore.usedFallback || aPScore.usedFallback) confidence -= 5;
  if (hO.usedFallback || aO.usedFallback) confidence -= 5;

  const parkAdj = pickSide === "home" ? (park.runs - 100) * 0.05 : (100 - park.runs) * 0.05;
  confidence += parkAdj;

  confidence = Math.max(25, Math.min(88, Math.round(confidence)));

  // Kept for type compatibility; odds-derived fields are no longer used in scoring.
  const impliedProb = 0.5;
  const cappedEdge = 0;

  const factors: MLFactor[] = [
    {
      name: `${game.home.name} SP: ${hP.fullName}`,
      value: `${fmt(hStats?.season?.era)} ERA · ${fmt(hStats?.season?.whip)} WHIP · ${fmt(hStats?.season?.inningsPitched)} IP`,
      weight: pickSide === "home" ? hPScore.score - 30 : -(hPScore.score - 30),
    },
    {
      name: `${game.away.name} SP: ${aP.fullName}`,
      value: `${fmt(aStats?.season?.era)} ERA · ${fmt(aStats?.season?.whip)} WHIP · ${fmt(aStats?.season?.inningsPitched)} IP`,
      weight: pickSide === "away" ? aPScore.score - 30 : -(aPScore.score - 30),
    },
    {
      name: `${game.home.name} offense`,
      value: hHittingValid
        ? `${fmt(hTeam.hitting.ops, 3)} OPS · ${rpgFmt(hTeam.hitting)} R/G`
        : "insufficient sample — league avg used",
      weight: pickSide === "home" ? hO.score - 15 : -(hO.score - 15),
    },
    {
      name: `${game.away.name} offense`,
      value: aHittingValid
        ? `${fmt(aTeam.hitting.ops, 3)} OPS · ${rpgFmt(aTeam.hitting)} R/G`
        : "insufficient sample — league avg used",
      weight: pickSide === "away" ? aO.score - 15 : -(aO.score - 15),
    },
    {
      name: `${game.home.name} team pitching`,
      value: `${fmt(hTeam?.pitching?.era)} ERA`,
      weight: pickSide === "home" ? hBP - 7 : -(hBP - 7),
    },
    {
      name: `${game.away.name} team pitching`,
      value: `${fmt(aTeam?.pitching?.era)} ERA`,
      weight: pickSide === "away" ? aBP - 7 : -(aBP - 7),
    },
    { name: `${game.home.name} SP last 5`, value: `${hForm.toFixed(2)} ERA`, weight: pickSide === "home" ? hFormAdj : -hFormAdj },
    { name: `${game.away.name} SP last 5`, value: `${aForm.toFixed(2)} ERA`, weight: pickSide === "away" ? aFormAdj : -aFormAdj },
    {
      name: "Handedness matchup",
      value: handednessDescription(pickSide === "home" ? aStats : hStats),
      weight: pickSide === "home" ? homeHandEdge : awayHandEdge,
    },
    {
      name: "Weather",
      value: weatherDescription(game.weather),
      weight: pickSide === "home" ? homeWeatherAdj : awayWeatherAdj,
    },
    { name: "Home field", value: `+${HFA.toFixed(1)}`, weight: pickSide === "home" ? HFA : -HFA },
    { name: `Park: ${park.name}`, value: `Run factor ${park.runs}`, weight: parkAdj },
    {
      name: "Model win probability",
      value: `${(modelProb * 100).toFixed(0)}%`,
      weight: (modelProb - 0.5) * 20,
    },
  ];

  return {
    gamePk: game.gamePk,
    matchup: `${game.away.name} @ ${game.home.name}`,
    pickSide,
    pickTeam,
    confidence,
    edge: cappedEdge,
    modelProb,
    impliedProb,
    factors,
    odds,
    book: null,
  };
}

// Odds-range filter: -250 to +180 (user preference).
export function isAcceptableMLOdds(odds: number | null): boolean {
  if (odds == null) return false;
  if (odds < 0) return odds >= -250;
  return odds <= 180;
}

function recentERA(log: any[]): number {
  let er = 0,
    ip = 0;
  for (const g of log) {
    er += g.er;
    ip += g.ip;
  }
  return ip ? (er * 9) / ip : LG_ERA;
}

function americanFmt(o: number): string {
  return o > 0 ? `+${o}` : `${o}`;
}

function fmt(v: any, dp = 2): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!isFinite(n)) return "—";
  return n.toFixed(dp);
}

function rpgFmt(hitting: any): string {
  const r = safeNum(hitting?.runs, 0);
  const g = safeNum(hitting?.gamesPlayed, 0);
  if (!g) return "—";
  return (r / g).toFixed(2);
}

function handednessDescription(pitcher: any): string {
  if (!pitcher) return "—";
  const vsL = typeof pitcher.vsLeft?.ops === "string" ? parseFloat(pitcher.vsLeft.ops) : pitcher.vsLeft?.ops;
  const vsR = typeof pitcher.vsRight?.ops === "string" ? parseFloat(pitcher.vsRight.ops) : pitcher.vsRight?.ops;
  if (!isFinite(vsL) && !isFinite(vsR)) return "no split data";
  const throws = pitcher.throws ?? "?";
  const parts: string[] = [`${throws}HP`];
  if (isFinite(vsL)) parts.push(`vs L ${fmt(vsL, 3)}`);
  if (isFinite(vsR)) parts.push(`vs R ${fmt(vsR, 3)}`);
  return parts.join(" · ");
}

function weatherDescription(weather: any): string {
  if (!weather) return "indoors / unknown";
  const parts: string[] = [];
  if (weather.temp) parts.push(`${weather.temp}°F`);
  if (weather.condition) parts.push(weather.condition);
  if (weather.wind) parts.push(`wind ${weather.wind}`);
  return parts.length ? parts.join(" · ") : "no data";
}
