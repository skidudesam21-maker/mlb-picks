import StatTiles from "@/components/StatTiles";
import TabStrip from "@/components/TabStrip";
import { getHistoryByRank, getLatestPicks, PickRow } from "@/lib/db";
import { formatPickDateShort } from "@/lib/pageHelpers";
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

async function safeLatestFor(cat: string): Promise<PickRow[]> {
  try {
    return await getLatestPicks(cat);
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

const CATS = [
  { id: "nrfi", label: "NRFI" },
  { id: "moneyline", label: "Moneyline" },
  { id: "hit", label: "Hit Rate" },
  { id: "strikeout", label: "Strikeout Rate" },
];

const RANK_LABELS: Record<number, string> = {
  1: "Top Pick",
  2: "2nd Pick",
  3: "3rd Pick",
};

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: { cat?: string; rank?: string };
}) {
  const category = CATS.find((c) => c.id === searchParams.cat)?.id ?? "nrfi";
  const rank = [1, 2, 3].includes(parseInt(searchParams.rank ?? "1"))
    ? parseInt(searchParams.rank!)
    : 1;

  const rows = await safeHistory(category, rank);
  const stats = summary(rows);

  // Grab latest picks across all categories for stat tiles
  const [nrfi, ml, hit, k] = await Promise.all([
    safeLatestFor("nrfi"),
    safeLatestFor("moneyline"),
    safeLatestFor("hit"),
    safeLatestFor("strikeout"),
  ]);
  const todayAll = [...nrfi, ...ml, ...hit, ...k];
  const gameCount = new Set(todayAll.filter((p) => p.game_pk).map((p) => p.game_pk)).size;
  const latestDate = todayAll.length ? todayAll[0].date : null;

  return (
    <div className="space-y-6">
      <StatTiles date={latestDate} gameCount={gameCount} picks={todayAll} />
      <TabStrip />

      {/* Context header */}
      <div className="card p-5">
        <div className="section-label">Tracking Ledger</div>
        <p className="text-paper-300 text-sm">
          Every pick auto-graded against final box scores from the MLB API. Unit size: <span className="text-paper-100 font-mono">${UNIT_USD}</span>.
        </p>
      </div>

      {/* Category sub-tabs */}
      <div className="flex flex-wrap gap-2">
        {CATS.map((c) => (
          <Link
            key={c.id}
            href={`/tracking?cat=${c.id}&rank=1`}
            className={`chip ${category === c.id ? "chip-red" : "chip-muted"}`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {/* Rank sub-tabs */}
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3].map((r) => (
          <Link
            key={r}
            href={`/tracking?cat=${category}&rank=${r}`}
            className={`chip ${rank === r ? "chip-red" : "chip-muted"}`}
          >
            {RANK_LABELS[r]}
          </Link>
        ))}
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Record" value={`${stats.w}–${stats.l}`} sub={`${stats.total} graded`} />
        <SummaryCard
          label="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          sub={RANK_LABELS[rank]}
          accent={stats.winRate >= 55 ? "pos" : stats.winRate < 45 && stats.total > 0 ? "neg" : "neutral"}
        />
        <SummaryCard
          label="Units"
          value={`${stats.u >= 0 ? "+" : ""}${stats.u.toFixed(2)}u`}
          sub={`${stats.u >= 0 ? "+" : "-"}$${Math.abs(stats.u * UNIT_USD).toFixed(0)}`}
          accent={stats.u > 0 ? "pos" : stats.u < 0 ? "neg" : "neutral"}
        />
        <SummaryCard
          label="ROI"
          value={`${stats.roi >= 0 ? "+" : ""}${stats.roi.toFixed(1)}%`}
          sub="per pick"
          accent={stats.roi > 0 ? "pos" : stats.roi < 0 ? "neg" : "neutral"}
        />
      </div>

      {/* History table */}
      {rows.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="font-mono text-[11px] tracking-[0.3em] text-bg-500 uppercase">
            No History Yet
          </div>
          <p className="mt-4 text-paper-300">
            Once picks start getting graded, they'll show up here.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Pick</th>
                <th>Line</th>
                <th>Odds</th>
                <th>Grade</th>
                <th>Conf</th>
                <th>Result</th>
                <th className="text-right">Units</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs text-bg-400">
                    {formatPickDateShort(r.date)}
                  </td>
                  <td className="text-paper-100">{r.pick_label}</td>
                  <td className="font-mono text-xs text-bg-400">{r.line ?? "—"}</td>
                  <td className="font-mono text-xs text-paper-200">{fmtOdds(r.odds)}</td>
                  <td>
                    <span className={`grade ${r.grade?.startsWith("A") ? "grade-a" : r.grade?.startsWith("B") ? "grade-b" : "grade-c"}`}>
                      {r.grade}
                    </span>
                  </td>
                  <td className="font-mono text-xs text-paper-200">{r.confidence}</td>
                  <td>
                    {r.result === "W" ? (
                      <span className="chip chip-good">✓ WIN</span>
                    ) : r.result === "L" ? (
                      <span className="chip chip-red">✕ LOSS</span>
                    ) : r.result === "P" ? (
                      <span className="chip chip-muted">PUSH</span>
                    ) : (
                      <span className="chip chip-muted">Pending</span>
                    )}
                  </td>
                  <td
                    className={`text-right font-mono text-xs ${
                      (r.units ?? 0) > 0
                        ? "text-good-400"
                        : (r.units ?? 0) < 0
                        ? "text-red-400"
                        : "text-bg-500"
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
    </div>
  );
}

function SummaryCard({
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
  const color = accent === "pos" ? "text-good-400" : accent === "neg" ? "text-red-400" : "text-paper-100";
  return (
    <div className="card p-5">
      <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-bg-500">{label}</div>
      <div className={`font-mono text-3xl mt-2 leading-none font-semibold ${color}`}>{value}</div>
      {sub && <div className="font-mono text-xs text-bg-400 mt-2">{sub}</div>}
    </div>
  );
}
