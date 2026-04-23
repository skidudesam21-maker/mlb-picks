import PageHeader from "@/components/PageHeader";
import { getHistoryByRank, PickRow } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UNIT_USD = parseInt(process.env.UNIT_SIZE_USD ?? "100");

async function safeHistory(category: string, rank: number): Promise<PickRow[]> {
  try {
    return await getHistoryByRank(category, rank);
  } catch {
    return [];
  }
}

function summary(rows: PickRow[]) {
  const graded = rows.filter((r) => r.result && r.result !== "P");
  const w = graded.filter((r) => r.result === "W").length;
  const l = graded.filter((r) => r.result === "L").length;
  const u = graded.reduce((a, r) => a + (r.units ?? 0), 0);
  const winRate = graded.length ? (w / graded.length) * 100 : 0;
  const roi = graded.length ? (u / graded.length) * 100 : 0;
  return { w, l, u, winRate, roi, total: graded.length };
}

function fmtOdds(o: number | null): string {
  if (o == null) return "—";
  return o > 0 ? `+${o}` : `${o}`;
}

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: { cat?: string; rank?: string };
}) {
  const category =
    ["nrfi", "moneyline", "hit", "strikeout"].find((c) => c === searchParams.cat) ?? "nrfi";
  const rank = [1, 2, 3].includes(parseInt(searchParams.rank ?? "1"))
    ? parseInt(searchParams.rank!)
    : 1;

  const rows = await safeHistory(category, rank);
  const stats = summary(rows);

  return (
    <>
      <PageHeader
        eyebrow="The ledger"
        title="Every pick. Graded."
        description={`Unit size: $${UNIT_USD}. Results are auto-graded the morning after each game using final box scores from the MLB API.`}
      />

      {/* Category tabs */}
      <div className="flex flex-wrap gap-0 border-b border-ink-700 mb-4">
        {[
          { id: "nrfi", label: "NRFI" },
          { id: "moneyline", label: "Moneyline" },
          { id: "hit", label: "Hit Rate" },
          { id: "strikeout", label: "Strikeout Rate" },
        ].map((c) => (
          <a
            key={c.id}
            href={`/tracking?cat=${c.id}&rank=1`}
            className={`px-6 py-3 font-display text-lg tracking-[0.18em] uppercase transition border-b-2 -mb-px ${
              category === c.id
                ? "text-gold-400 border-gold-500"
                : "text-ink-600 border-transparent hover:text-white"
            }`}
          >
            {c.label}
          </a>
        ))}
      </div>

      {/* Rank tabs */}
      <div className="flex gap-0 border-b border-ink-700 mb-10">
        {[1, 2, 3].map((r) => (
          <a
            key={r}
            href={`/tracking?cat=${category}&rank=${r}`}
            className={`px-5 py-2 font-mono text-xs tracking-[0.25em] uppercase transition border-b-2 -mb-px ${
              rank === r
                ? "text-gold-400 border-gold-500"
                : "text-ink-600 border-transparent hover:text-white"
            }`}
          >
            {r === 1 ? "Top Pick" : r === 2 ? "2nd Pick" : "3rd Pick"}
          </a>
        ))}
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-ink-700 rounded-xl overflow-hidden mb-12">
        <Tile label="Record" value={`${stats.w}–${stats.l}`} sub={`${stats.total} graded`} />
        <Tile
          label="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          sub={`rank ${rank}`}
          accent={stats.winRate >= 55 ? "pos" : stats.winRate < 45 ? "neg" : "neutral"}
        />
        <Tile
          label="Units"
          value={`${stats.u >= 0 ? "+" : ""}${stats.u.toFixed(2)}u`}
          sub={`${stats.u >= 0 ? "+" : "-"}$${Math.abs(stats.u * UNIT_USD).toFixed(2)}`}
          accent={stats.u > 0 ? "pos" : stats.u < 0 ? "neg" : "neutral"}
        />
        <Tile
          label="ROI"
          value={`${stats.roi >= 0 ? "+" : ""}${stats.roi.toFixed(1)}%`}
          sub="per pick"
          accent={stats.roi > 0 ? "pos" : stats.roi < 0 ? "neg" : "neutral"}
        />
      </div>

      {/* History table */}
      {rows.length === 0 ? (
        <div className="stitched rounded-xl p-12 text-center">
          <div className="font-mono text-[11px] tracking-[0.4em] text-ink-600 uppercase">No History Yet</div>
          <p className="font-serif text-xl text-white/60 mt-4 max-w-lg mx-auto">
            Once picks start getting graded, they'll show up here.
          </p>
        </div>
      ) : (
        <div className="stitched rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="font-mono text-[10px] tracking-[0.3em] uppercase text-ink-600 border-b border-ink-700">
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Pick</th>
                <th className="text-left px-4 py-3">Line</th>
                <th className="text-left px-4 py-3">Odds</th>
                <th className="text-left px-4 py-3">Grade</th>
                <th className="text-left px-4 py-3">Conf</th>
                <th className="text-left px-4 py-3">Result</th>
                <th className="text-right px-4 py-3">Units</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.id}
                  className={`border-b border-ink-700 ${
                    i % 2 === 1 ? "bg-ink-900/40" : ""
                  } hover:bg-ink-800/50 transition`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-ink-600">{r.date?.slice(5)}</td>
                  <td className="px-4 py-3 text-white">{r.pick_label}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-600">{r.line ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-white/70">{fmtOdds(r.odds)}</td>
                  <td className="px-4 py-3 font-display text-lg text-gold-400">{r.grade}</td>
                  <td className="px-4 py-3 font-mono text-xs text-white/70">{r.confidence}</td>
                  <td className="px-4 py-3">
                    {r.result === "W" ? (
                      <span className="chip bg-turf-700/15 text-turf-400 border-turf-700/30">W</span>
                    ) : r.result === "L" ? (
                      <span className="chip bg-blood-600/15 text-blood-500 border-blood-600/30">L</span>
                    ) : r.result === "P" ? (
                      <span className="chip bg-ink-800 text-ink-600">Push</span>
                    ) : (
                      <span className="chip bg-ink-800 text-ink-600">Pending</span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono text-xs ${
                      (r.units ?? 0) > 0
                        ? "text-turf-400"
                        : (r.units ?? 0) < 0
                        ? "text-blood-500"
                        : "text-ink-600"
                    }`}
                  >
                    {r.units != null ? `${r.units > 0 ? "+" : ""}${r.units.toFixed(2)}u` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Tile({
  label,
  value,
  sub,
  accent = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "pos" | "neg" | "neutral";
}) {
  const color =
    accent === "pos" ? "text-turf-400" : accent === "neg" ? "text-blood-500" : "text-white";
  return (
    <div className="p-6 border-r border-b md:border-b-0 border-ink-700 last:border-r-0">
      <div className="font-mono text-[10px] tracking-[0.3em] text-ink-600 uppercase">{label}</div>
      <div className={`font-display text-4xl mt-2 leading-none ${color}`}>{value}</div>
      {sub ? <div className="font-mono text-xs text-ink-600 mt-2">{sub}</div> : null}
    </div>
  );
}
