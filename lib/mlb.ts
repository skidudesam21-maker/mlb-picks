// MLB Stats API wrapper. Free, no key required.
// Docs: https://statsapi.mlb.com/docs/

const BASE = "https://statsapi.mlb.com/api/v1";
const BASE2 = "https://statsapi.mlb.com/api/v1.1";

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`MLB API ${res.status}: ${url}`);
  return res.json();
}

// Return today's schedule with probable pitchers, venue, game time, weather.
export async function getScheduleForDate(dateISO: string) {
  const url = `${BASE}/schedule?sportId=1&date=${dateISO}&hydrate=probablePitcher(note),venue(location,timezone),weather,lineups,team,linescore`;
  const data = await fetchJson(url);
  const games = (data.dates?.[0]?.games ?? []) as any[];
  return games.map((g) => ({
    gamePk: g.gamePk,
    status: g.status?.abstractGameState,
    detailedState: g.status?.detailedState,
    gameDate: g.gameDate,
    venue: {
      id: g.venue?.id,
      name: g.venue?.name,
      city: g.venue?.location?.city,
      state: g.venue?.location?.stateAbbrev,
    },
    weather: g.weather ?? null,
    home: {
      id: g.teams?.home?.team?.id,
      name: g.teams?.home?.team?.name,
      abbrev: g.teams?.home?.team?.abbreviation ?? "",
      probablePitcher: g.teams?.home?.probablePitcher
        ? {
            id: g.teams.home.probablePitcher.id,
            fullName: g.teams.home.probablePitcher.fullName,
          }
        : null,
      wins: g.teams?.home?.leagueRecord?.wins,
      losses: g.teams?.home?.leagueRecord?.losses,
    },
    away: {
      id: g.teams?.away?.team?.id,
      name: g.teams?.away?.team?.name,
      abbrev: g.teams?.away?.team?.abbreviation ?? "",
      probablePitcher: g.teams?.away?.probablePitcher
        ? {
            id: g.teams.away.probablePitcher.id,
            fullName: g.teams.away.probablePitcher.fullName,
          }
        : null,
      wins: g.teams?.away?.leagueRecord?.wins,
      losses: g.teams?.away?.leagueRecord?.losses,
    },
  }));
}

// Pitcher season stats + splits (vs L / vs R).
export async function getPitcherStats(pitcherId: number, season: number) {
  const url = `${BASE}/people/${pitcherId}?hydrate=stats(group=[pitching],type=[season,statSplits],sitCodes=[vl,vr,h,a],season=${season})`;
  const data = await fetchJson(url);
  const person = data.people?.[0];
  if (!person) return null;

  const statsByType: Record<string, any> = {};
  for (const s of person.stats ?? []) {
    if (s.type?.displayName === "season") {
      statsByType.season = s.splits?.[0]?.stat ?? null;
    }
    if (s.type?.displayName === "statSplits") {
      for (const split of s.splits ?? []) {
        const code = split.split?.code;
        if (code) statsByType[code] = split.stat;
      }
    }
  }
  return {
    id: pitcherId,
    name: person.fullName,
    throws: person.pitchHand?.code,
    season: statsByType.season,
    vsLeft: statsByType.vl,
    vsRight: statsByType.vr,
    home: statsByType.h,
    away: statsByType.a,
  };
}

// Recent game logs for a pitcher (last N starts) for form analysis.
export async function getPitcherGameLog(pitcherId: number, season: number) {
  const url = `${BASE}/people/${pitcherId}/stats?stats=gameLog&group=pitching&season=${season}`;
  const data = await fetchJson(url);
  const splits = data.stats?.[0]?.splits ?? [];
  return splits.slice(-5).map((s: any) => ({
    date: s.date,
    opponent: s.opponent?.name,
    ip: parseFloat(s.stat?.inningsPitched ?? "0"),
    er: s.stat?.earnedRuns ?? 0,
    so: s.stat?.strikeOuts ?? 0,
    bb: s.stat?.baseOnBalls ?? 0,
    h: s.stat?.hits ?? 0,
    firstInningER: null, // not provided by API, would need play-by-play
  }));
}

// Team stats (offensive, bullpen).
export async function getTeamStats(teamId: number, season: number) {
  const url = `${BASE}/teams/${teamId}?hydrate=stats(splits=[season],group=[hitting,pitching],season=${season})`;
  const data = await fetchJson(url);
  const team = data.teams?.[0];
  if (!team) return null;
  const out: any = { id: teamId, name: team.name };
  for (const s of team.stats ?? []) {
    const group = s.group?.displayName;
    const stat = s.splits?.[0]?.stat;
    if (group === "hitting") out.hitting = stat;
    if (group === "pitching") out.pitching = stat;
  }
  return out;
}

// Live linescore (for grading picks — get 1st inning runs + final score).
export async function getGameFeedLive(gamePk: number) {
  const url = `${BASE2}/game/${gamePk}/feed/live`;
  const data = await fetchJson(url);
  return data;
}

// Player season stats — for batter prop modeling.
export async function getPlayerHittingStats(playerId: number, season: number) {
  const url = `${BASE}/people/${playerId}?hydrate=stats(group=[hitting],type=[season,statSplits],sitCodes=[vl,vr,h,a],season=${season})`;
  const data = await fetchJson(url);
  const person = data.people?.[0];
  if (!person) return null;
  const out: any = { id: playerId, name: person.fullName, bats: person.batSide?.code };
  for (const s of person.stats ?? []) {
    if (s.type?.displayName === "season") out.season = s.splits?.[0]?.stat;
    if (s.type?.displayName === "statSplits") {
      for (const split of s.splits ?? []) {
        const code = split.split?.code;
        if (code) out[code] = split.stat;
      }
    }
  }
  return out;
}

// Last 15 game log for a hitter (hot/cold streak).
export async function getHitterGameLog(playerId: number, season: number) {
  const url = `${BASE}/people/${playerId}/stats?stats=gameLog&group=hitting&season=${season}`;
  const data = await fetchJson(url);
  const splits = data.stats?.[0]?.splits ?? [];
  return splits.slice(-15).map((s: any) => ({
    date: s.date,
    ab: s.stat?.atBats ?? 0,
    h: s.stat?.hits ?? 0,
    hr: s.stat?.homeRuns ?? 0,
    rbi: s.stat?.rbi ?? 0,
  }));
}

// Roster for a team so we can grab the active hitters.
export async function getTeamRoster(teamId: number) {
  const url = `${BASE}/teams/${teamId}/roster?rosterType=active`;
  const data = await fetchJson(url);
  return (data.roster ?? []).map((r: any) => ({
    id: r.person?.id,
    name: r.person?.fullName,
    position: r.position?.abbreviation,
  }));
}

// Get every MLB team (all 30) with their IDs, names, abbreviations, league.
export async function getAllMLBTeams() {
  const url = `${BASE}/teams?sportId=1&activeStatus=ACTIVE`;
  const data = await fetchJson(url);
  return (data.teams ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    abbrev: t.abbreviation,
    league: t.league?.name,
    division: t.division?.name,
  }));
}

// Schedule for a team in a season — returns all games with final scores and linescore.
// Used to compute NRFI records.
export async function getTeamSchedule(teamId: number, season: number) {
  const url = `${BASE}/schedule?sportId=1&teamId=${teamId}&season=${season}&gameType=R&hydrate=linescore,probablePitcher,team`;
  const data = await fetchJson(url);
  const games: any[] = [];
  for (const day of data.dates ?? []) {
    for (const g of day.games ?? []) {
      games.push(g);
    }
  }
  return games;
}

// Get all regular-season games for a season (used for pitcher NRFI aggregation).
// We go team-by-team and dedupe, which is faster than pulling one giant query.
export async function getAllGamesForSeason(season: number) {
  const url = `${BASE}/schedule?sportId=1&season=${season}&gameType=R&hydrate=linescore,probablePitcher,team`;
  const data = await fetchJson(url);
  const games: any[] = [];
  for (const day of data.dates ?? []) {
    for (const g of day.games ?? []) {
      games.push(g);
    }
  }
  return games;
}

// Career batter vs. pitcher stats (lifetime, all seasons).
// Uses stats?stats=vsPlayer on a batter with opposingPlayerId.
export async function getBatterVsPitcher(batterId: number, pitcherId: number) {
  const url = `${BASE}/people/${batterId}/stats?stats=vsPlayer&group=hitting&opposingPlayerId=${pitcherId}`;
  try {
    const data = await fetchJson(url);
    // Returned structure contains a vsPlayerTotal split = lifetime totals
    for (const statGroup of data.stats ?? []) {
      for (const split of statGroup.splits ?? []) {
        if (split.split?.description === "vsPlayerTotal" || split.batter?.id === batterId) {
          const s = split.stat ?? {};
          return {
            pa: toNum(s.plateAppearances),
            ab: toNum(s.atBats),
            h: toNum(s.hits),
            hr: toNum(s.homeRuns),
            rbi: toNum(s.rbi),
            bb: toNum(s.baseOnBalls),
            so: toNum(s.strikeOuts),
            avg: parseFloat(s.avg ?? "0") || 0,
            obp: parseFloat(s.obp ?? "0") || 0,
            slg: parseFloat(s.slg ?? "0") || 0,
            ops: parseFloat(s.ops ?? "0") || 0,
          };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

function toNum(v: any): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseInt(v) : v;
  return isFinite(n) ? n : 0;
}
