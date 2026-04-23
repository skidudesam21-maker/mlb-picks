import React from "react";

type Factor = { name: string; value: string; weight: number };

function gradeClass(grade: string): string {
  if (grade.startsWith("A")) return "grade-a";
  if (grade.startsWith("B")) return "grade-b";
  if (grade.startsWith("C")) return "grade-c";
  return "grade-d";
}

function fmtOdds(o: number | null | undefined): string {
  if (o == null) return "—";
  return o > 0 ? `+${o}` : `${o}`;
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
}) {
  const sortedFactors = [...(factors ?? [])].sort(
    (a, b) => Math.abs(b.weight) - Math.abs(a.weight)
  );

  return (
    <article className="stitched rounded-xl overflow-hidden relative">
      <div className="flex items-stretch">
        {/* Rank rail */}
        <div className="w-16 flex flex-col items-center justify-center gap-1 bg-gradient-to-b from-ink-800 to-ink-900 border-r border-ink-700 py-6">
          <span className="font-mono text-[10px] tracking-[0.3em] text-ink-600 uppercase">Rank</span>
          <span className="font-display text-4xl text-gold-400 leading-none">{rank}</span>
        </div>

        {/* Main */}
        <div className="flex-1 p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex-1 min-w-[240px]">
              <div className="font-mono text-[10px] tracking-[0.3em] text-ink-600 uppercase mb-1">
                {category}
              </div>
              <h3 className="font-serif text-2xl md:text-3xl text-white leading-tight">{label}</h3>
              {subtitle ? <p className="text-sm text-ink-600 mt-2 font-mono">{subtitle}</p> : null}

              <div className="flex flex-wrap gap-2 mt-4">
                {odds != null ? (
                  <span className="chip bg-turf-700/15 text-turf-400 border-turf-700/30">
                    {fmtOdds(odds)}
                  </span>
                ) : (
                  <span className="chip bg-ink-800 text-ink-600">odds pending</span>
                )}
                {line != null ? (
                  <span className="chip bg-ink-800 text-ink-600">line {line}</span>
                ) : null}
                {book ? (
                  <span className="chip bg-ink-800 text-ink-600">{book}</span>
                ) : null}
              </div>
            </div>

            {/* Grade + confidence */}
            <div className="flex items-center gap-5">
              <div className={`grade-badge ${gradeClass(grade)}`}>{grade}</div>
              <div className="flex flex-col items-end">
                <span className="font-mono text-[10px] tracking-[0.3em] text-ink-600 uppercase">
                  Confidence
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="font-display text-4xl text-white leading-none">
                    {confidence}
                  </span>
                  <span className="font-mono text-xs text-ink-600">/100</span>
                </div>
                <div className="meter w-28 mt-2">
                  <div className="meter-fill" style={{ width: `${confidence}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Writeup */}
          {writeup ? (
            <div className="mt-6 pt-6 border-t border-ink-700">
              <p className="font-serif text-[1.05rem] leading-relaxed text-ink-100 text-white/90">
                {writeup}
              </p>
            </div>
          ) : null}

          {/* Factor breakdown */}
          {sortedFactors.length > 0 ? (
            <details className="mt-6 group">
              <summary className="cursor-pointer inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.3em] uppercase text-gold-500 hover:text-gold-400 transition">
                <span>Factor breakdown</span>
                <span className="inline-block transition group-open:rotate-90">›</span>
              </summary>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                {sortedFactors.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-3 p-3 rounded-md bg-ink-900/60 border border-ink-700"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-white truncate">{f.name}</div>
                      <div className="text-[11px] text-ink-600 font-mono mt-0.5">{f.value}</div>
                    </div>
                    <span
                      className={`font-mono text-[11px] shrink-0 ${
                        f.weight > 0.5
                          ? "text-turf-400"
                          : f.weight < -0.5
                          ? "text-blood-500"
                          : "text-ink-600"
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
