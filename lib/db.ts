// Postgres client using Vercel Postgres.
// Schema is defined inline; `ensureSchema` is idempotent and called on first use.

import { sql } from "@vercel/postgres";

let schemaReady = false;

export async function ensureSchema() {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS picks (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      category TEXT NOT NULL,
      rank INT NOT NULL,
      game_pk BIGINT,
      pick_label TEXT NOT NULL,
      side TEXT NOT NULL,
      line NUMERIC,
      odds INT,
      book TEXT,
      grade TEXT NOT NULL,
      confidence INT NOT NULL,
      writeup TEXT,
      factors JSONB,
      result TEXT,
      units NUMERIC,
      final_value NUMERIC,
      graded_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_picks_date_cat ON picks(date, category, rank);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_picks_result ON picks(result);`;

  // NRFI team stats — one row per team per season.
  await sql`
    CREATE TABLE IF NOT EXISTS nrfi_team_stats (
      team_id INT NOT NULL,
      season INT NOT NULL,
      team_name TEXT NOT NULL,
      team_abbrev TEXT,
      games INT NOT NULL DEFAULT 0,
      nrfi_wins INT NOT NULL DEFAULT 0,
      nrfi_losses INT NOT NULL DEFAULT 0,
      home_wins INT NOT NULL DEFAULT 0,
      home_losses INT NOT NULL DEFAULT 0,
      away_wins INT NOT NULL DEFAULT 0,
      away_losses INT NOT NULL DEFAULT 0,
      total_first_inn_runs INT NOT NULL DEFAULT 0,
      current_streak_type TEXT,
      current_streak_count INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (team_id, season)
    );
  `;

  // NRFI pitcher stats — one row per pitcher per season.
  await sql`
    CREATE TABLE IF NOT EXISTS nrfi_pitcher_stats (
      pitcher_id INT NOT NULL,
      season INT NOT NULL,
      pitcher_name TEXT NOT NULL,
      team_id INT,
      team_abbrev TEXT,
      games_started INT NOT NULL DEFAULT 0,
      nrfi_wins INT NOT NULL DEFAULT 0,
      nrfi_losses INT NOT NULL DEFAULT 0,
      home_wins INT NOT NULL DEFAULT 0,
      home_losses INT NOT NULL DEFAULT 0,
      away_wins INT NOT NULL DEFAULT 0,
      away_losses INT NOT NULL DEFAULT 0,
      first_inn_er INT NOT NULL DEFAULT 0,
      first_inn_ip NUMERIC NOT NULL DEFAULT 0,
      current_streak_type TEXT,
      current_streak_count INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (pitcher_id, season)
    );
  `;

  // Which pitchers are playing today. Updated by the daily cron.
  await sql`
    CREATE TABLE IF NOT EXISTS today_pitchers (
      date DATE NOT NULL,
      pitcher_id INT NOT NULL,
      PRIMARY KEY (date, pitcher_id)
    );
  `;

  // Today's matchup cache — batter vs pitcher lifetime stats for games today.
  await sql`
    CREATE TABLE IF NOT EXISTS today_matchups (
      date DATE NOT NULL,
      game_pk BIGINT NOT NULL,
      pitcher_id INT NOT NULL,
      pitcher_name TEXT NOT NULL,
      pitcher_team TEXT,
      batter_id INT NOT NULL,
      batter_name TEXT NOT NULL,
      batter_team TEXT,
      pa INT,
      ab INT,
      h INT,
      hr INT,
      rbi INT,
      bb INT,
      so INT,
      avg NUMERIC,
      obp NUMERIC,
      slg NUMERIC,
      ops NUMERIC,
      PRIMARY KEY (date, pitcher_id, batter_id)
    );
  `;

  schemaReady = true;
}

export type PickRow = {
  id: number;
  date: string;
  category: "nrfi" | "moneyline" | "hit" | "strikeout";
  rank: number;
  game_pk: number | null;
  pick_label: string;
  side: string;
  line: number | null;
  odds: number | null;
  book: string | null;
  grade: string;
  confidence: number;
  writeup: string | null;
  factors: any;
  result: "W" | "L" | "P" | null;
  units: number | null;
  final_value: number | null;
};

export async function insertPick(p: Omit<PickRow, "id">) {
  await ensureSchema();
  await sql`
    INSERT INTO picks
      (date, category, rank, game_pk, pick_label, side, line, odds, book,
       grade, confidence, writeup, factors, result, units, final_value)
    VALUES
      (${p.date}, ${p.category}, ${p.rank}, ${p.game_pk}, ${p.pick_label}, ${p.side},
       ${p.line}, ${p.odds}, ${p.book}, ${p.grade}, ${p.confidence}, ${p.writeup},
       ${JSON.stringify(p.factors)}, ${p.result}, ${p.units}, ${p.final_value})
  `;
}

export async function clearPicksForDate(date: string, category: string) {
  await ensureSchema();
  await sql`DELETE FROM picks WHERE date = ${date} AND category = ${category}`;
}

export async function getTodayPicks(date: string, category: string): Promise<PickRow[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT * FROM picks
    WHERE date = ${date} AND category = ${category}
    ORDER BY rank ASC
  `;
  return rows as PickRow[];
}

export async function getLatestPicks(category: string): Promise<PickRow[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT * FROM picks
    WHERE category = ${category}
      AND date = (SELECT MAX(date) FROM picks WHERE category = ${category})
    ORDER BY rank ASC
  `;
  return rows as PickRow[];
}

export async function getHistoryByRank(
  category: string,
  rank: number
): Promise<PickRow[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT * FROM picks
    WHERE category = ${category} AND rank = ${rank}
    ORDER BY date DESC
    LIMIT 200
  `;
  return rows as PickRow[];
}

export async function getUngradedPicks(): Promise<PickRow[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT * FROM picks
    WHERE result IS NULL AND date < CURRENT_DATE
    ORDER BY date ASC
    LIMIT 100
  `;
  return rows as PickRow[];
}

export async function updatePickResult(
  id: number,
  result: "W" | "L" | "P",
  units: number
) {
  await ensureSchema();
  await sql`
    UPDATE picks
    SET result = ${result}, units = ${units}, graded_at = NOW()
    WHERE id = ${id}
  `;
}

// ---------- NRFI stats helpers ----------

export type NRFITeamRow = {
  team_id: number;
  season: number;
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
  current_streak_type: string | null;
  current_streak_count: number;
};

export type NRFIPitcherRow = {
  pitcher_id: number;
  season: number;
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
  current_streak_type: string | null;
  current_streak_count: number;
  playing_today?: boolean;
};

export async function upsertNRFITeam(row: NRFITeamRow) {
  await ensureSchema();
  await sql`
    INSERT INTO nrfi_team_stats
      (team_id, season, team_name, team_abbrev, games,
       nrfi_wins, nrfi_losses, home_wins, home_losses,
       away_wins, away_losses, total_first_inn_runs,
       current_streak_type, current_streak_count, updated_at)
    VALUES
      (${row.team_id}, ${row.season}, ${row.team_name}, ${row.team_abbrev}, ${row.games},
       ${row.nrfi_wins}, ${row.nrfi_losses}, ${row.home_wins}, ${row.home_losses},
       ${row.away_wins}, ${row.away_losses}, ${row.total_first_inn_runs},
       ${row.current_streak_type}, ${row.current_streak_count}, NOW())
    ON CONFLICT (team_id, season) DO UPDATE SET
      team_name = EXCLUDED.team_name,
      team_abbrev = EXCLUDED.team_abbrev,
      games = EXCLUDED.games,
      nrfi_wins = EXCLUDED.nrfi_wins,
      nrfi_losses = EXCLUDED.nrfi_losses,
      home_wins = EXCLUDED.home_wins,
      home_losses = EXCLUDED.home_losses,
      away_wins = EXCLUDED.away_wins,
      away_losses = EXCLUDED.away_losses,
      total_first_inn_runs = EXCLUDED.total_first_inn_runs,
      current_streak_type = EXCLUDED.current_streak_type,
      current_streak_count = EXCLUDED.current_streak_count,
      updated_at = NOW()
  `;
}

export async function upsertNRFIPitcher(row: NRFIPitcherRow) {
  await ensureSchema();
  await sql`
    INSERT INTO nrfi_pitcher_stats
      (pitcher_id, season, pitcher_name, team_id, team_abbrev, games_started,
       nrfi_wins, nrfi_losses, home_wins, home_losses, away_wins, away_losses,
       first_inn_er, first_inn_ip, current_streak_type, current_streak_count, updated_at)
    VALUES
      (${row.pitcher_id}, ${row.season}, ${row.pitcher_name}, ${row.team_id}, ${row.team_abbrev}, ${row.games_started},
       ${row.nrfi_wins}, ${row.nrfi_losses}, ${row.home_wins}, ${row.home_losses}, ${row.away_wins}, ${row.away_losses},
       ${row.first_inn_er}, ${row.first_inn_ip}, ${row.current_streak_type}, ${row.current_streak_count}, NOW())
    ON CONFLICT (pitcher_id, season) DO UPDATE SET
      pitcher_name = EXCLUDED.pitcher_name,
      team_id = EXCLUDED.team_id,
      team_abbrev = EXCLUDED.team_abbrev,
      games_started = EXCLUDED.games_started,
      nrfi_wins = EXCLUDED.nrfi_wins,
      nrfi_losses = EXCLUDED.nrfi_losses,
      home_wins = EXCLUDED.home_wins,
      home_losses = EXCLUDED.home_losses,
      away_wins = EXCLUDED.away_wins,
      away_losses = EXCLUDED.away_losses,
      first_inn_er = EXCLUDED.first_inn_er,
      first_inn_ip = EXCLUDED.first_inn_ip,
      current_streak_type = EXCLUDED.current_streak_type,
      current_streak_count = EXCLUDED.current_streak_count,
      updated_at = NOW()
  `;
}

export async function getNRFITeams(season: number): Promise<NRFITeamRow[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT * FROM nrfi_team_stats WHERE season = ${season}
  `;
  return rows as NRFITeamRow[];
}

export async function getNRFIPitchers(season: number): Promise<NRFIPitcherRow[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT p.*, 
      (EXISTS(SELECT 1 FROM today_pitchers t WHERE t.pitcher_id = p.pitcher_id AND t.date = CURRENT_DATE)) as playing_today
    FROM nrfi_pitcher_stats p
    WHERE season = ${season}
    ORDER BY pitcher_name ASC
  `;
  return rows as NRFIPitcherRow[];
}

export async function setTodayPitchers(date: string, pitcherIds: number[]) {
  await ensureSchema();
  await sql`DELETE FROM today_pitchers WHERE date = ${date}`;
  for (const id of pitcherIds) {
    await sql`INSERT INTO today_pitchers (date, pitcher_id) VALUES (${date}, ${id}) ON CONFLICT DO NOTHING`;
  }
}

// ---------- Matchup helpers ----------

export type MatchupRow = {
  date: string;
  game_pk: number;
  pitcher_id: number;
  pitcher_name: string;
  pitcher_team: string;
  batter_id: number;
  batter_name: string;
  batter_team: string;
  pa: number;
  ab: number;
  h: number;
  hr: number;
  rbi: number;
  bb: number;
  so: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
};

export async function upsertMatchup(row: MatchupRow) {
  await ensureSchema();
  await sql`
    INSERT INTO today_matchups
      (date, game_pk, pitcher_id, pitcher_name, pitcher_team, batter_id, batter_name, batter_team,
       pa, ab, h, hr, rbi, bb, so, avg, obp, slg, ops)
    VALUES
      (${row.date}, ${row.game_pk}, ${row.pitcher_id}, ${row.pitcher_name}, ${row.pitcher_team},
       ${row.batter_id}, ${row.batter_name}, ${row.batter_team},
       ${row.pa}, ${row.ab}, ${row.h}, ${row.hr}, ${row.rbi}, ${row.bb}, ${row.so},
       ${row.avg}, ${row.obp}, ${row.slg}, ${row.ops})
    ON CONFLICT (date, pitcher_id, batter_id) DO UPDATE SET
      pitcher_name = EXCLUDED.pitcher_name,
      pitcher_team = EXCLUDED.pitcher_team,
      batter_name = EXCLUDED.batter_name,
      batter_team = EXCLUDED.batter_team,
      pa = EXCLUDED.pa, ab = EXCLUDED.ab, h = EXCLUDED.h, hr = EXCLUDED.hr,
      rbi = EXCLUDED.rbi, bb = EXCLUDED.bb, so = EXCLUDED.so,
      avg = EXCLUDED.avg, obp = EXCLUDED.obp, slg = EXCLUDED.slg, ops = EXCLUDED.ops
  `;
}

export async function clearMatchupsForDate(date: string) {
  await ensureSchema();
  await sql`DELETE FROM today_matchups WHERE date = ${date}`;
}

export async function getMatchupsForLatest(): Promise<MatchupRow[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT * FROM today_matchups
    WHERE date = (SELECT MAX(date) FROM today_matchups)
    ORDER BY pa DESC NULLS LAST
  `;
  return rows as MatchupRow[];
}

// Returns today's games — one row per game with both teams and both pitchers.
// Built by deduplicating rows in today_matchups (which stores batter-vs-pitcher pairings).
export type TodayGame = {
  game_pk: number;
  date: string;
  home_team: string;
  home_pitcher: string;
  away_team: string;
  away_pitcher: string;
};

export async function getTodayGames(): Promise<TodayGame[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT DISTINCT date, game_pk, pitcher_name, pitcher_team, batter_team
    FROM today_matchups
    WHERE date = (SELECT MAX(date) FROM today_matchups)
  `;
  // Rows contain: one pitcher + his team + the opposing (batter) team.
  // To build a single per-game row with both sides, group by game_pk and pair up the two pitchers.
  const byGame: Record<string, any> = {};
  for (const r of rows as any[]) {
    const key = String(r.game_pk);
    if (!byGame[key]) {
      byGame[key] = { game_pk: r.game_pk, date: r.date, pitchers: [] };
    }
    const exists = byGame[key].pitchers.find((p: any) => p.name === r.pitcher_name);
    if (!exists) {
      byGame[key].pitchers.push({
        name: r.pitcher_name,
        team: r.pitcher_team, // this pitcher's team
        opposing: r.batter_team, // the team he faces (i.e., the OTHER team in the game)
      });
    }
  }

  const out: TodayGame[] = [];
  for (const g of Object.values(byGame) as any[]) {
    if (g.pitchers.length < 1) continue;
    // Figure out which pitcher is home, which is away.
    // Without an explicit flag, use the convention: if only one pitcher, skip.
    // If two, the "home_team" is the team whose pitcher's OWN team equals the other pitcher's OPPOSING team.
    const p1 = g.pitchers[0];
    const p2 = g.pitchers[1] ?? null;
    if (!p2) continue;
    // p1.team is p1's team. p2.opposing is what p2 faces (should equal p1.team).
    // We can't cleanly distinguish home/away from this data alone. Use alphabetical tie-break
    // so display is stable; the UI just labels "@" between them.
    out.push({
      game_pk: g.game_pk,
      date: g.date,
      away_team: p1.team,
      away_pitcher: p1.name,
      home_team: p2.team,
      home_pitcher: p2.name,
    });
  }
  // Stable sort by home team name
  out.sort((a, b) => a.home_team.localeCompare(b.home_team));
  return out;
}
