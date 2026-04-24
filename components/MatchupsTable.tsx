"use client";
import { useMemo, useState } from "react";
import type { MatchupRow } from "@/lib/db";

type SortKey = "pa" | "ab" | "h" | "hr" | "avg" | "ops" | "batter" | "pitcher";

export default function MatchupsTable({ rows }: { rows: MatchupRow[] }) {
  const [search, setSearch] = useState("");
  const [minAB, setMinAB] = useState(0);
  const [minAVG, setMinAVG] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("pa");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (minAB > 0 && (r.ab ?? 0) < minAB) return false;
      if (minAVG > 0 && (r.avg ?? 0) < minAVG) return false;
      if (q) {
        const text = `${r.batter_name} ${r.pitcher_name} ${r.batter_team ?? ""} ${r.pitcher_team ?? ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "pa":
          cmp = (a.pa ?? 0) - (b.pa ?? 0);
          break;
        case "ab":
          cmp = (a.ab ?? 0) - (b.ab ?? 0);
          break;
        case "h":
          cmp = (a.h ?? 0) - (b.h ?? 0);
          break;
        case "hr":
          cmp = (a.hr ?? 0) - (b.hr ?? 0);
          break;
        case "avg":
          cmp = (a.avg ?? 0) - (b.avg ?? 0);
          break;
        case "ops":
          cmp = (a.ops ?? 0) - (b.ops ?? 0);
          break;
        case "batter":
          cmp = a.batter_name.localeCompare(b.batter_name);
          break;
        case "pitcher":
          cmp = a.pitcher_name.localeCompare(b.pitcher_name);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [rows, search, minAB, minAVG, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir(k === "batter" || k === "pitcher" ? "asc" : "desc");
    }
  }

  const sortIcon = (k: SortKey) => (k === sortKey ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-700/60 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search player or team..."
          className="font-mono text-sm bg-bg-800 border border-bg-700 rounded-lg px-3 py-2 text-paper-100 placeholder:text-bg-500 flex-1 min-w-[220px] focus:outline-none focus:border-red-400/50"
        />
        <div className="flex items-center gap-2">
          <label className="font-mono text-[11px] text-bg-400 tracking-[0.15em] uppercase">
            Min AB
          </label>
          <select
            value={minAB}
            onChange={(e) => setMinAB(parseInt(e.target.value))}
            className="font-mono text-sm bg-bg-800 border border-bg-700 rounded-lg px-2 py-2 text-paper-100"
          >
            <option value={0}>any</option>
            <option value={5}>5+</option>
            <option value={10}>10+</option>
            <option value={15}>15+</option>
            <option value={25}>25+</option>
            <option value={40}>40+</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="font-mono text-[11px] text-bg-400 tracking-[0.15em] uppercase">
            Min BA
          </label>
          <select
            value={minAVG}
            onChange={(e) => setMinAVG(parseFloat(e.target.value))}
            className="font-mono text-sm bg-bg-800 border border-bg-700 rounded-lg px-2 py-2 text-paper-100"
          >
            <option value={0}>any</option>
            <option value={0.25}>.250+</option>
            <option value={0.3}>.300+</option>
            <option value={0.35}>.350+</option>
            <option value={0.4}>.400+</option>
          </select>
        </div>
        <span className="font-mono text-[11px] text-bg-500 tracking-[0.2em] uppercase">
          {filtered.length} rows
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th className="cursor-pointer" onClick={() => toggleSort("pitcher")}>
                Pitcher{sortIcon("pitcher")}
              </th>
              <th className="cursor-pointer" onClick={() => toggleSort("batter")}>
                Batter{sortIcon("batter")}
              </th>
              <th>Matchup</th>
              <th className="cursor-pointer" onClick={() => toggleSort("pa")}>
                PA{sortIcon("pa")}
              </th>
              <th className="cursor-pointer" onClick={() => toggleSort("ab")}>
                AB{sortIcon("ab")}
              </th>
              <th className="cursor-pointer" onClick={() => toggleSort("h")}>
                H{sortIcon("h")}
              </th>
              <th className="cursor-pointer" onClick={() => toggleSort("hr")}>
                HR{sortIcon("hr")}
              </th>
              <th>RBI</th>
              <th>BB</th>
              <th>SO</th>
              <th className="cursor-pointer" onClick={() => toggleSort("avg")}>
                AVG{sortIcon("avg")}
              </th>
              <th>OBP</th>
              <th>SLG</th>
              <th className="cursor-pointer" onClick={() => toggleSort("ops")}>
                OPS{sortIcon("ops")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={14} className="text-center text-bg-400 py-8">
                  No matchups match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((r, i) => (
                <tr key={`${r.pitcher_id}-${r.batter_id}-${i}`}>
                  <td className="text-paper-100">{r.pitcher_name}</td>
                  <td className="text-paper-100">{r.batter_name}</td>
                  <td className="font-mono text-xs text-bg-400">
                    {r.pitcher_team ?? "—"} vs {r.batter_team ?? "—"}
                  </td>
                  <td className="font-mono text-xs text-paper-200">{r.pa ?? 0}</td>
                  <td className="font-mono text-xs text-paper-200">{r.ab ?? 0}</td>
                  <td className="font-mono text-xs text-paper-200">{r.h ?? 0}</td>
                  <td className="font-mono text-xs text-paper-200">{r.hr ?? 0}</td>
                  <td className="font-mono text-xs text-paper-200">{r.rbi ?? 0}</td>
                  <td className="font-mono text-xs text-paper-200">{r.bb ?? 0}</td>
                  <td className="font-mono text-xs text-paper-200">{r.so ?? 0}</td>
                  <td className="font-mono text-sm text-red-400">{baFmt(r.avg)}</td>
                  <td className="font-mono text-xs text-paper-200">{baFmt(r.obp)}</td>
                  <td className="font-mono text-xs text-paper-200">{baFmt(r.slg)}</td>
                  <td className="font-mono text-xs text-paper-200">{baFmt(r.ops)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function baFmt(v: number | null | undefined): string {
  if (v == null || !isFinite(v) || v === 0) return "—";
  return v.toFixed(3).replace(/^0\./, ".");
}
