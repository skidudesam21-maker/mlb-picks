import React from "react";

type Factor = { name: string; value: string; weight: number };

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

function categoryLabel(cat: string): string {
  switch (cat) {
    case "nrfi":
      return "NRFI";
    case "moneyline":
      return "ML";
    case "hit":
      return "HIT";
    case "strikeout":
      return "K";
    default:
      return cat.toUpperCase();
  }
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

export default function PickCard({
  rank,
  label,
  subtitle,
  grade,
  confidence,
  writeup,
  factors,
  odds,
  book,
  line,
  category,
  featured,
}: {
  rank: number;
  label: string;
  subtitle?: string;
  grade: string;
  confidence: number;
  writeup: string | null;
  factors: Factor[];
  odds: number | null;
  book: string | null;
  line: number | null;
  category: string;
  featured?: boolean;
}) {
  const sortedFactors = [...(factors ?? [])].sort(
    (a, b) => Math.abs(b.weight) - Math.abs(a.weight)
  );

  return (
    <article className={`card card-hover ${featured ? "card-featured" : ""} p-5 md:p-6`}>
      <div className="flex items-start gap-4">
        <ConfidenceRing value={confidence} />

        <div className="flex-1 min-w-0">
          {/* Top row: chips + odds on far right */}
          <div className="flex items-center flex-wrap gap-2 mb-2">
            <span className={`chip ${grade?.startsWith("A") ? "chip-red" : "chip-muted"}`}>
              {grade}
            </span>
            <span className="chip chip-muted">{categoryLabel(category)}</span>
            {featured ? (
              <span className="chip chip-red">★ Play of the Day</span>
            ) : (
              <span className="text-bg-500 font-mono text-[11px] tracking-[0.2em]">
                #{rank}
              </span>
            )}
            <div className="flex-1" />
            {odds != null && (
              <span className="chip chip-muted font-mono">
                Line: {fmtOdds(odds)}
              </span>
            )}
            {book && (
              <span className="chip chip-muted">{book}</span>
            )}
          </div>

          {/* Label */}
          <h3 className="font-sans text-lg md:text-xl font-semibold text-paper-100 leading-tight">
            {label}
          </h3>
          {subtitle ? (
            <p className="text-sm text-bg-400 mt-1 font-mono">{subtitle}</p>
          ) : null}

          {line != null && (
            <div className="mt-2 font-mono text-xs text-bg-400">
              Line: <span className="text-paper-200">{line}</span>
            </div>
          )}

          {/* Writeup */}
          {writeup ? (
            <div className="mt-4 pt-4 border-t border-bg-700/50">
              <p className="text-[15px] leading-relaxed text-paper-200">
                {writeup}
              </p>
            </div>
          ) : null}

          {/* Factor breakdown */}
          {sortedFactors.length > 0 ? (
            <details className="mt-4 group">
              <summary className="cursor-pointer inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.22em] uppercase text-red-400 hover:text-red-300 transition">
                <span>Factor breakdown</span>
                <span className="inline-block transition group-open:rotate-90">›</span>
              </summary>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                {sortedFactors.map((f, i) => (
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
            </details>
          ) : null}
        </div>
      </div>
    </article>
  );
}
