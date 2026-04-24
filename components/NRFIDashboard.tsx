"use client";
import { useMemo, useState } from "react";
import type { NRFITeamRow, NRFIPitcherRow } from "@/lib/db";

type SubTab = "teams" | "pitchers";

export default function NRFIDashboard({
  teams,
  pitchers,
}: {
  teams: NRFITeamRow[];
  pitchers: (NRFIPitcherRow & { playing_today?: boolean })[];
}) {
  const [tab, setTab] = useState<SubTab>("teams");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setTab("teams")}
          className={`chip ${tab === "teams" ? "chip-red" : "chip-muted"}`}
        >
          Team Batting
        </button>
        <button
          onClick={() => setTab("pitchers")}
          className={`chip ${tab === "pitchers" ? "chip-red" : "chip-muted"}`}
        >
          Starting Pitchers
        </button>
      </div>

      {tab === "teams" ? <TeamsTable teams={teams} /> : <PitchersTable pitchers={pitchers} />}
    </div>
  );
}

// --------------- TEAMS TABLE ---------------

function TeamsTable({ teams }: { teams: NRFITeamRow[] }) {
  const rows = useMemo(() => {
    const withPct = teams.map((t) => ({
      ...t,
      pct: t.games === 0 ? 0 : (t.nrfi_wins / t.games) * 100,
      avgRuns: t.games === 0 ? 0 : t.total_first_inn_runs / t.games,
    }));
    withPct.sort((a, b) => b.pct - a.pct);
    return withPct;
  }, [teams]);

  if (!rows.length) {
    return (
      <div className="card p-10 text-center">
        <div className="font-mono text-[11px] tracking-[0.3em] text-bg-500 uppercase">
          No team data
        </div>
        <p className="mt-3 text-paper-300 text-sm">
          Run the daily cron to populate NRFI stats.
        </p>
      </div>
    );
  }

  const sliceSize = Math.ceil(rows.length / 3);
  const rowClass = (i: number) => {
    if (i < sliceSize) return "border-l-2 border-l-good-500";
    if (i >= rows.length - sliceSize) return "border-l-2 border-l-red-500";
    return "border-l-2 border-l-transparent";
  };

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-700/60 flex flex-wrap items-center gap-3">
        <span className="chip chip-good">Top third · NRFI-friendly</span>
        <span className="chip chip-red">Bottom third · YRFI candidates</span>
        <div className="flex-1" />
        <span className="font-mono text-[11px] text-bg-500 tracking-[0.2em] uppercase">
          {rows.length} teams
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>G</th>
              <th>NRFI Record</th>
              <th>NRFI %</th>
              <th>Home Rec</th>
              <th>Home %</th>
              <th>Away Rec</th>
              <th>Away %</th>
              <th>Avg 1st R</th>
              <th>Streak</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.team_id} className={rowClass(i)}>
                <td className="font-mono text-bg-400">{i + 1}</td>
                <td className="text-paper-100 font-semibold">{r.team_name}</td>
                <td className="font-mono text-xs text-paper-200">{r.games}</td>
                <td className="font-mono text-xs text-paper-200">
                  {r.nrfi_wins}-{r.nrfi_losses}
                </td>
                <td className="font-mono text-sm text-red-400">{r.pct.toFixed(1)}%</td>
                <td className="font-mono text-xs text-paper-200">
                  {r.home_wins}-{r.home_losses}
                </td>
                <td className="font-mono text-xs text-paper-200">{pctFmt(r.home_wins, r.home_wins + r.home_losses)}</td>
                <td className="font-mono text-xs text-paper-200">
                  {r.away_wins}-{r.away_losses}
                </td>
                <td className="font-mono text-xs text-paper-200">{pctFmt(r.away_wins, r.away_wins + r.away_losses)}</td>
                <td className="font-mono text-xs text-paper-200">{r.avgRuns.toFixed(2)}</td>
                <td>
                  <StreakCell type={r.current_streak_type} count={r.current_streak_count} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --------------- PITCHERS TABLE ---------------

type SortKey = "nrfi_pct" | "gs" | "fi_era" | "name";
type SortDir = "asc" | "desc";

function PitchersTable({ pitchers }: { pitchers: (NRFIPitcherRow & { playing_today?: boolean })[] }) {
  const [search, setSearch] = useState("");
  const [onlyToday, setOnlyToday] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("nrfi_pct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = pitchers.filter((p) => p.games_started > 0);
    if (q) {
      out = out.filter(
        (p) =>
          p.pitcher_name.toLowerCase().includes(q) ||
          (p.team_abbrev ?? "").toLowerCase().includes(q)
      );
    }
    if (onlyToday) {
      out = out.filter((p) => p.playing_today);
    }
    const enriched = out.map((p) => ({
      ...p,
      nrfi_pct: p.games_started === 0 ? 0 : (p.nrfi_wins / p.games_started) * 100,
      fi_era: p.first_inn_ip > 0 ? (p.first_inn_er * 9) / p.first_inn_ip : 0,
    }));
    enriched.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "nrfi_pct") cmp = a.nrfi_pct - b.nrfi_pct;
      else if (sortKey === "gs") cmp = a.games_started - b.games_started;
      else if (sortKey === "fi_era") cmp = a.fi_era - b.fi_era;
      else cmp = a.pitcher_name.localeCompare(b.pitcher_name);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return enriched;
  }, [pitchers, search, onlyToday, sortKey, sortDir]);

  const topThird = Math.ceil(filtered.length / 3);

  const rowClass = (i: number) => {
    if (i < topThird) return "border-l-2 border-l-good-500";
    if (i >= filtered.length - topThird) return "border-l-2 border-l-red-500";
    return "border-l-2 border-l-transparent";
  };

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const sortIcon = (k: SortKey) =>
    k === sortKey ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-700/60 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pitcher name or team..."
          className="font-mono text-sm bg-bg-800 border border-bg-700 rounded-lg px-3 py-2 text-paper-100 placeholder:text-bg-500 flex-1 min-w-[220px] focus:outline-none focus:border-red-400/50"
        />
        <button
          onClick={() => setOnlyToday(!onlyToday)}
          className={`chip ${onlyToday ? "chip-red" : "chip-muted"} cursor-pointer`}
        >
          {onlyToday ? "✓ Playing Today" : "Playing Today"}
        </button>
        <span className="font-mono text-[11px] text-bg-500 tracking-[0.2em] uppercase">
          {filtered.length} pitchers
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>#</th>
              <th className="cursor-pointer" onClick={() => toggleSort("name")}>
                Pitcher{sortIcon("name")}
              </th>
              <th>Team</th>
              <th className="cursor-pointer" onClick={() => toggleSort("gs")}>
                GS{sortIcon("gs")}
              </th>
              <th>NRFI Rec</th>
              <th className="cursor-pointer" onClick={() => toggleSort("nrfi_pct")}>
                NRFI %{sortIcon("nrfi_pct")}
              </th>
              <th>Home Rec</th>
              <th>Home %</th>
              <th>Away Rec</th>
              <th>Away %</th>
              <th className="cursor-pointer" onClick={() => toggleSort("fi_era")}>
                FI ERA{sortIcon("fi_era")}
              </th>
              <th>Streak</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={12} className="text-center text-bg-400 py-8">
                  No pitchers match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((p, i) => (
                <tr key={p.pitcher_id} className={rowClass(i)}>
                  <td className="font-mono text-bg-400">{i + 1}</td>
                  <td className="text-paper-100">
                    {p.pitcher_name}
                    {p.playing_today && (
                      <span className="ml-2 chip chip-good text-[9px] px-1.5 py-0">TDY</span>
                    )}
                  </td>
                  <td className="font-mono text-xs text-bg-400">{p.team_abbrev ?? "—"}</td>
                  <td className="font-mono text-xs text-paper-200">{p.games_started}</td>
                  <td className="font-mono text-xs text-paper-200">
                    {p.nrfi_wins}-{p.nrfi_losses}
                  </td>
                  <td className="font-mono text-sm text-red-400">{p.nrfi_pct.toFixed(1)}%</td>
                  <td className="font-mono text-xs text-paper-200">
                    {p.home_wins}-{p.home_losses}
                  </td>
                  <td className="font-mono text-xs text-paper-200">
                    {pctFmt(p.home_wins, p.home_wins + p.home_losses)}
                  </td>
                  <td className="font-mono text-xs text-paper-200">
                    {p.away_wins}-{p.away_losses}
                  </td>
                  <td className="font-mono text-xs text-paper-200">
                    {pctFmt(p.away_wins, p.away_wins + p.away_losses)}
                  </td>
                  <td className="font-mono text-xs text-paper-200">{p.fi_era.toFixed(2)}</td>
                  <td>
                    <StreakCell type={p.current_streak_type} count={p.current_streak_count} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StreakCell({ type, count }: { type: string | null; count: number }) {
  if (!type || !count)
    return <span className="font-mono text-xs text-bg-500">—</span>;
  const scoreless = type === "scoreless";
  return (
    <span
      className={`font-mono text-xs ${scoreless ? "text-good-400" : "text-red-400"}`}
    >
      <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: scoreless ? "#7ab87a" : "#ff6b6b" }} />
      {count} {scoreless ? "clean" : "scored"}
    </span>
  );
}

function pctFmt(n: number, d: number): string {
  if (!d) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}
