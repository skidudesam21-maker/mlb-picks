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
