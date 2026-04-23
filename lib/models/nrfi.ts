// NRFI (No Run First Inning) analytical model.
// Scores each game 0-100 on NRFI likelihood. Higher = more confident NRFI.
//
// Signals considered:
//  - Starting pitcher quality (ERA, WHIP, K/9, xFIP proxy via FIP)
//  - Pitcher 1st inning history (we approximate via season ERA + K%)
//  - Opposing lineup top-3 batters vs that pitcher's handedness
//  - Park factor (runs)
//  - Weather: temperature, wind speed + direction relative to outfield
//  - Bullpen is not relevant for NRFI (only starters)
//
// Outputs a 0-100 confidence score for the NRFI side (Under 0.5 runs in 1st).

import { getParkFactor } from "../parks";
import { getPitcherStats, getPitcherGameLog, getTeamRoster, getPlayerHittingStats } from "../mlb";

type Game = any;

export type NRFIFactor = {
  name: string;
  value: string;
  weight: number; // positive = supports NRFI, negative = hurts it
};

export type NRFIAnalysis = {
  gamePk: number;
  matchup: string;
  confidence: number; // 0-100
  factors: NRFIFactor[];
  narrative: string;
  homePitcher: any;
  awayPitcher: any;
  park: { name: string; runFactor: number };
  weather: any;
};

function safeNum(v: any, fallback = 0): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isFinite(n) ? n : fallback;
}

function pitcherFirstInningScore(p: any): number {
  // Higher = better for NRFI. 0-40 scale.
  if (!p?.season) return 15;
  const era = safeNum(p.season.era, 4.5);
  const whip = safeNum(p.season.whip, 1.3);
  const k9 = safeNum(p.season.strikeoutsPer9Inn, 8);
  const bb9 = safeNum(p.season.walksPer9Inn, 3);
  const hr9 = safeNum(p.season.homeRunsPer9, 1.2);

  // Baseline 20, scale by performance.
  let score = 20;
  score += Math.max(-10, Math.min(12, (3.8 - era) * 3.5)); // ERA
  score += Math.max(-6, Math.min(8, (1.25 - whip) * 12)); // WHIP
  score += Math.max(-4, Math.min(6, (k9 - 8) * 0.8)); // K/9
  score += Math.max(-4, Math.min(3, (3 - bb9) * 1.2)); // BB/9
  score += Math.max(-4, Math.min(3, (1.2 - hr9) * 3)); // HR/9
  return Math.max(0, Math.min(40, score));
}

function recentFormScore(log: any[]): number {
  // Scale -5..+5. Good recent outings = more NRFI support.
  if (!log?.length) return 0;
  let totalER = 0;
  let totalIP = 0;
  for (const g of log) {
    totalER += g.er;
    totalIP += g.ip;
  }
  if (totalIP === 0) return 0;
  const recentERA = (totalER * 9) / totalIP;
  return Math.max(-5, Math.min(5, (4.0 - recentERA) * 1.5));
}

function lineupThreatScore(hitters: any[], pitcherThrows: string): number {
  // Higher = more dangerous lineup top = BAD for NRFI. Returns -12..0.
  if (!hitters?.length) return -3;
  let ops = 0;
  let count = 0;
  const splitKey = pitcherThrows === "L" ? "vl" : "vr"; // vs LHP or vs RHP
  for (const h of hitters.slice(0, 4)) {
    const split = h?.[splitKey] ?? h?.season;
    if (!split) continue;
    ops += safeNum(split.ops, 0.7);
    count++;
  }
  if (!count) return -3;
  const avgOPS = ops / count;
  // .800 OPS lineup top = heavy threat. .650 = weak.
  return Math.max(-12, Math.min(0, (0.72 - avgOPS) * 30));
}

function parkAdjustment(runFactor: number): number {
  // Coors (114) hurts NRFI; Tropicana (92) helps.
  return Math.max(-8, Math.min(6, (100 - runFactor) * 0.5));
}

function weatherAdjustment(weather: any, venueName: string): number {
  if (!weather) return 0;
  let adj = 0;
  const tempF = parseInt(weather.temp ?? "70");
  if (isFinite(tempF)) {
    // Hot air = ball carries = more runs. Cold = suppresses.
    if (tempF >= 85) adj -= 2;
    else if (tempF >= 75) adj -= 1;
    else if (tempF <= 55) adj += 2;
    else if (tempF <= 65) adj += 1;
  }
  const wind = weather.wind ?? "";
  if (typeof wind === "string") {
    const mphMatch = wind.match(/(\d+)\s*mph/i);
    const mph = mphMatch ? parseInt(mphMatch[1]) : 0;
    if (/out/i.test(wind) && mph >= 10) adj -= Math.min(3, mph / 5);
    if (/in/i.test(wind) && mph >= 10) adj += Math.min(3, mph / 5);
  }
  return Math.max(-4, Math.min(4, adj));
}

export async function analyzeNRFI(game: Game, season: number): Promise<NRFIAnalysis | null> {
  const homeP = game.home.probablePitcher;
  const awayP = game.away.probablePitcher;
  if (!homeP || !awayP) return null;

  const [homeStats, awayStats, homeLog, awayLog, homeRoster, awayRoster] = await Promise.all([
    getPitcherStats(homeP.id, season),
    getPitcherStats(awayP.id, season),
    getPitcherGameLog(homeP.id, season),
    getPitcherGameLog(awayP.id, season),
    getTeamRoster(game.home.id),
    getTeamRoster(game.away.id),
  ]);

  // Hitters that face each pitcher = top of the OTHER lineup.
  const homeHittersIds = homeRoster.filter((r: any) => r.position !== "P").slice(0, 6).map((r: any) => r.id);
  const awayHittersIds = awayRoster.filter((r: any) => r.position !== "P").slice(0, 6).map((r: any) => r.id);

  const [homeHitters, awayHitters] = await Promise.all([
    Promise.all(homeHittersIds.map((id: number) => getPlayerHittingStats(id, season))),
    Promise.all(awayHittersIds.map((id: number) => getPlayerHittingStats(id, season))),
  ]);

  const park = getParkFactor(game.venue?.id);

  const homePScore = pitcherFirstInningScore(homeStats);
  const awayPScore = pitcherFirstInningScore(awayStats);
  const homeForm = recentFormScore(homeLog);
  const awayForm = recentFormScore(awayLog);
  const awayLineupThreat = lineupThreatScore(awayHitters, homeStats?.throws ?? "R");
  const homeLineupThreat = lineupThreatScore(homeHitters, awayStats?.throws ?? "R");
  const parkAdj = parkAdjustment(park.runs);
  const weatherAdj = weatherAdjustment(game.weather, game.venue?.name ?? "");

  const raw =
    homePScore + awayPScore + homeForm + awayForm +
    awayLineupThreat + homeLineupThreat + parkAdj + weatherAdj;

  // Map roughly 10..85 raw range to 30..97 confidence.
  const confidence = Math.max(30, Math.min(97, Math.round(raw * 1.15 + 15)));

  const factors: NRFIFactor[] = [
    {
      name: `${awayP.fullName} (Away SP)`,
      value: `${safeNum(awayStats?.season?.era, 0).toFixed(2)} ERA · ${safeNum(awayStats?.season?.whip, 0).toFixed(2)} WHIP · ${safeNum(awayStats?.season?.strikeoutsPer9Inn, 0).toFixed(1)} K/9`,
      weight: awayPScore - 20,
    },
    {
      name: `${homeP.fullName} (Home SP)`,
      value: `${safeNum(homeStats?.season?.era, 0).toFixed(2)} ERA · ${safeNum(homeStats?.season?.whip, 0).toFixed(2)} WHIP · ${safeNum(homeStats?.season?.strikeoutsPer9Inn, 0).toFixed(1)} K/9`,
      weight: homePScore - 20,
    },
    {
      name: "Away SP recent form (L5)",
      value: formatRecent(awayLog),
      weight: awayForm,
    },
    {
      name: "Home SP recent form (L5)",
      value: formatRecent(homeLog),
      weight: homeForm,
    },
    {
      name: `${game.home.name} top-4 vs ${awayStats?.throws === "L" ? "LHP" : "RHP"}`,
      value: `Avg OPS ${avgOps(homeHitters, awayStats?.throws ?? "R").toFixed(3)}`,
      weight: homeLineupThreat,
    },
    {
      name: `${game.away.name} top-4 vs ${homeStats?.throws === "L" ? "LHP" : "RHP"}`,
      value: `Avg OPS ${avgOps(awayHitters, homeStats?.throws ?? "R").toFixed(3)}`,
      weight: awayLineupThreat,
    },
    {
      name: `Park: ${park.name}`,
      value: `Run factor ${park.runs} (${park.runs > 100 ? "hitter-friendly" : park.runs < 100 ? "pitcher-friendly" : "neutral"})`,
      weight: parkAdj,
    },
    {
      name: "Weather",
      value: formatWeather(game.weather),
      weight: weatherAdj,
    },
  ];

  return {
    gamePk: game.gamePk,
    matchup: `${game.away.name} @ ${game.home.name}`,
    confidence,
    factors,
    narrative: "",
    homePitcher: homeStats,
    awayPitcher: awayStats,
    park: { name: park.name, runFactor: park.runs },
    weather: game.weather,
  };
}

function avgOps(hitters: any[], throws: string): number {
  const key = throws === "L" ? "vl" : "vr";
  let total = 0;
  let n = 0;
  for (const h of hitters.slice(0, 4)) {
    const s = h?.[key] ?? h?.season;
    if (!s) continue;
    total += safeNum(s.ops, 0.7);
    n++;
  }
  return n ? total / n : 0.7;
}

function formatRecent(log: any[]): string {
  if (!log?.length) return "no data";
  const er = log.reduce((a, g) => a + g.er, 0);
  const ip = log.reduce((a, g) => a + g.ip, 0);
  const era = ip ? ((er * 9) / ip).toFixed(2) : "—";
  return `${era} ERA over last ${log.length} starts`;
}

function formatWeather(w: any): string {
  if (!w) return "Indoors / unavailable";
  const parts = [];
  if (w.temp) parts.push(`${w.temp}°F`);
  if (w.condition) parts.push(w.condition);
  if (w.wind) parts.push(`wind ${w.wind}`);
  return parts.join(" · ") || "Unavailable";
}
