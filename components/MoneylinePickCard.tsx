"use client";
import { useState } from "react";

function gradeClass(grade: string): string {
  if (grade?.startsWith("A")) return "grade-a";
  if (grade?.startsWith("B")) return "grade-b";
  if (grade?.startsWith("C")) return "grade-c";
  return "grade-d";
}

function fmtOdds(o: number | null | undefined): string {
  if (o == null) return "—";
  return o > 0 ? `+${o}` : `${o}`;
}

function ConfidenceRing({ value }: { value: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="conf-ring">
      <svg viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={radius} strokeWidth="5" fill="none" className="bg" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          className="fg"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="label">{value}</div>
    </div>
  );
}

export default function MoneylinePickCard({ pick }: { pick: any }) {
  const [open, setOpen] = useState(false);
  const factors: any[] = (pick.factors as any) ?? [];
  const sortedFactors = [...factors].sort(
    (a, b) => Math.abs(b.weight) - Math.abs(a.weight)
  );
  const featured = pick.rank === 1;

  return (
    <article
      className={`card card-hover ${featured ? "card-featured" : ""} p-5 md:p-6 cursor-pointer`}
      onClick={() => setOpen(!open)}
    >
      <div className="flex items-center gap-4">
        <ConfidenceRing value={pick.confidence} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className={`chip ${pick.grade?.startsWith("A") ? "chip-red" : "chip-muted"}`}>
              {pick.grade}
            </span>
            <span className="chip chip-muted">ML</span>
            {featured ? (
              <span className="chip chip-red">★ Top Pick</span>
            ) : (
              <span className="text-bg-500 font-mono text-[11px] tracking-[0.2em]">#{pick.rank}</span>
            )}
            <div className="flex-1" />
            {pick.odds != null && (
              <span className="chip chip-muted font-mono">Line: {fmtOdds(pick.odds)}</span>
            )}
            {pick.book && <span className="chip chip-muted">{pick.book}</span>}
          </div>

          <h3 className="font-sans text-lg md:text-xl font-semibold text-paper-100 leading-tight">
            {pick.pick_label}
          </h3>
          <p className="text-sm text-bg-400 mt-1 font-mono">Moneyline</p>
        </div>

        <span
          className={`font-mono text-xs text-bg-500 transition-transform ${open ? "rotate-90" : ""}`}
        >
          ▸
        </span>
      </div>

      {open && (
        <div
          className="mt-5 pt-5 border-t border-bg-700/50 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          {pick.writeup && (
            <div>
              <div className="section-label">Analysis</div>
              <p className="text-[15px] leading-relaxed text-paper-200">{pick.writeup}</p>
            </div>
          )}

          {sortedFactors.length > 0 && (
            <div>
              <div className="section-label">Factor breakdown</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sortedFactors.map((f: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-3 p-3 rounded-lg bg-bg-800/60 border border-bg-700/60"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-paper-200 truncate">{f.name}</div>
                      <div className="text-[11px] text-bg-400 font-mono mt-0.5">{f.value}</div>
                    </div>
                    <span
                      className={`font-mono text-[11px] shrink-0 ${
                        f.weight > 0.5
                          ? "text-good-400"
                          : f.weight < -0.5
                          ? "text-red-400"
                          : "text-bg-500"
                      }`}
                    >
                      {f.weight > 0 ? "+" : ""}
                      {f.weight.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
