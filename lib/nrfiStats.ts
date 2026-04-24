// Compute NRFI stats for all teams and all starting pitchers in a season.
// A "NRFI" for a TEAM = that team did not score in the 1st inning (lenient definition).
// A "NRFI" for a PITCHER = the pitcher did not allow a run in the 1st inning they started.

import { getAllGamesForSeason, getGameFeedLive } from "./mlb";
import {
  upsertNRFITeam,
  upsertNRFIPitcher,
  NRFITeamRow,
  NRFIPitcherRow,
  ensureSchema,
} from "./db";

type TeamAgg = {
  team_id: number;
  team_name: string;
  team_abbrev: string;
  games: number;
  nrfi_wins: number;
  nrfi_losses: number;
  home_wins: number;
  home_losses: number;
  away_wins: number;
  away_losses: number;
  total_first_inn_runs: number;
  // Chronological result history so we can compute current streak.
  history: { date: string; nrfi: boolean }[];
};

type PitcherAgg = {
  pitcher_id: number;
  pitcher_name: string;
  team_id: number | null;
  team_abbrev: string | null;
  games_started: number;
  nrfi_wins: number;
  nrfi_losses: number;
  home_wins: number;
  home_losses: number;
  away_wins: number;
  away_losses: number;
  first_inn_er: number;
  first_inn_ip: number;
  history: { date: string; nrfi: boolean }[];
};

// Extract first-inning runs from a linescore. Returns { homeRuns, awayRuns }.
// Returns null if 1st inning isn't available yet.
function firstInningRuns(linescore: any): { home: number; away: number } | null {
  const inn1 = linescore?.innings?.find((i: any) => i.num === 1);
  if (!inn1) return null;
  const home = inn1.home?.runs;
  const away = inn1.away?.runs;
  if (typeof home !== "number" || typeof away !== "number") return null;
  return { home, away };
}

// Compute current streak from a chronological history (oldest → newest).
function computeStreak(history: { date: string; nrfi: boolean }[]) {
  if (!history.length) return { type: null as string | null, count: 0 };
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1];
  let count = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].nrfi === last.nrfi) count++;
    else break;
  }
  return {
    type: last.nrfi ? "scoreless" : "scored",
    count,
  };
}

export async function recomputeNRFI(season: number): Promise<{
  games: number;
  teams: number;
  pitchers: number;
}> {
  await ensureSchema();
  const allGames = await getAllGamesForSeason(season);

  const teams: Record<number, TeamAgg> = {};
  const pitchers: Record<number, PitcherAgg> = {};

  let processedGames = 0;

  for (const g of allGames) {
    // Only count completed regular-season games.
    if (g.status?.abstractGameState !== "Final") continue;
    if (g.gameType && g.gameType !== "R") continue;

    const ls = g.linescore;
    const first = firstInningRuns(ls);
    if (!first) continue;

    const home = g.teams?.home;
    const away = g.teams?.away;
    if (!home?.team?.id || !away?.team?.id) continue;

    const gameDate = g.officialDate ?? g.gameDate?.slice(0, 10) ?? "";

    // ---- Team aggregation ----
    const homeTeam = ensureTeam(teams, home.team.id, home.team.name, home.team.abbreviation ?? "");
    const awayTeam = ensureTeam(teams, away.team.id, away.team.name, away.team.abbreviation ?? "");

    // Home team: "NRFI" = home didn't score in 1st.
    const homeNrfi = first.home === 0;
    homeTeam.games++;
    homeTeam.total_first_inn_runs += first.home;
    if (homeNrfi) {
      homeTeam.nrfi_wins++;
      homeTeam.home_wins++;
    } else {
      homeTeam.nrfi_losses++;
      homeTeam.home_losses++;
    }
    homeTeam.history.push({ date: gameDate, nrfi: homeNrfi });

    const awayNrfi = first.away === 0;
    awayTeam.games++;
    awayTeam.total_first_inn_runs += first.away;
    if (awayNrfi) {
      awayTeam.nrfi_wins++;
      awayTeam.away_wins++;
    } else {
      awayTeam.nrfi_losses++;
      awayTeam.away_losses++;
    }
    awayTeam.history.push({ date: gameDate, nrfi: awayNrfi });

    // ---- Pitcher aggregation ----
    // Pitcher NRFI = pitcher allowed 0 runs in the 1st (i.e., opposing team scored 0 in 1st).
    // The home pitcher faces the away team, so home pitcher NRFI = (first.away === 0).
    // Probable pitchers in schedule are our starting pitchers.
    const homeP = home.probablePitcher;
    const awayP = away.probablePitcher;

    if (homeP?.id) {
      const p = ensurePitcher(pitchers, homeP.id, homeP.fullName, home.team.id, home.team.abbreviation ?? "");
      const nrfi = first.away === 0;
      p.games_started++;
      p.first_inn_er += first.away;
      p.first_inn_ip += 1; // at least 1 inning counted; approximation
      if (nrfi) {
        p.nrfi_wins++;
        p.home_wins++;
      } else {
        p.nrfi_losses++;
        p.home_losses++;
      }
      p.history.push({ date: gameDate, nrfi });
    }

    if (awayP?.id) {
      const p = ensurePitcher(pitchers, awayP.id, awayP.fullName, away.team.id, away.team.abbreviation ?? "");
      const nrfi = first.home === 0;
      p.games_started++;
      p.first_inn_er += first.home;
      p.first_inn_ip += 1;
      if (nrfi) {
        p.nrfi_wins++;
        p.away_wins++;
      } else {
        p.nrfi_losses++;
        p.away_losses++;
      }
      p.history.push({ date: gameDate, nrfi });
    }

    processedGames++;
  }

  // Persist
  for (const t of Object.values(teams)) {
    const s = computeStreak(t.history);
    await upsertNRFITeam({
      team_id: t.team_id,
      season,
      team_name: t.team_name,
      team_abbrev: t.team_abbrev,
      games: t.games,
      nrfi_wins: t.nrfi_wins,
      nrfi_losses: t.nrfi_losses,
      home_wins: t.home_wins,
      home_losses: t.home_losses,
      away_wins: t.away_wins,
      away_losses: t.away_losses,
      total_first_inn_runs: t.total_first_inn_runs,
      current_streak_type: s.type,
      current_streak_count: s.count,
    });
  }

  for (const p of Object.values(pitchers)) {
    const s = computeStreak(p.history);
    await upsertNRFIPitcher({
      pitcher_id: p.pitcher_id,
      season,
      pitcher_name: p.pitcher_name,
      team_id: p.team_id,
      team_abbrev: p.team_abbrev,
      games_started: p.games_started,
      nrfi_wins: p.nrfi_wins,
      nrfi_losses: p.nrfi_losses,
      home_wins: p.home_wins,
      home_losses: p.home_losses,
      away_wins: p.away_wins,
      away_losses: p.away_losses,
      first_inn_er: p.first_inn_er,
      first_inn_ip: p.first_inn_ip,
      current_streak_type: s.type,
      current_streak_count: s.count,
    });
  }

  return {
    games: processedGames,
    teams: Object.keys(teams).length,
    pitchers: Object.keys(pitchers).length,
  };
}

function ensureTeam(map: Record<number, TeamAgg>, id: number, name: string, abbrev: string): TeamAgg {
  if (!map[id]) {
    map[id] = {
      team_id: id,
      team_name: name,
      team_abbrev: abbrev,
      games: 0,
      nrfi_wins: 0,
      nrfi_losses: 0,
      home_wins: 0,
      home_losses: 0,
      away_wins: 0,
      away_losses: 0,
      total_first_inn_runs: 0,
      history: [],
    };
  }
  return map[id];
}

function ensurePitcher(
  map: Record<number, PitcherAgg>,
  id: number,
  name: string,
  teamId: number | null,
  teamAbbrev: string | null
): PitcherAgg {
  if (!map[id]) {
    map[id] = {
      pitcher_id: id,
      pitcher_name: name,
      team_id: teamId,
      team_abbrev: teamAbbrev,
      games_started: 0,
      nrfi_wins: 0,
      nrfi_losses: 0,
      home_wins: 0,
      home_losses: 0,
      away_wins: 0,
      away_losses: 0,
      first_inn_er: 0,
      first_inn_ip: 0,
      history: [],
    };
  }
  return map[id];
}
