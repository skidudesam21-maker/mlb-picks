import StatTiles from "@/components/StatTiles";
import TabStrip from "@/components/TabStrip";
import { getHistoryByRank, PickRow } from "@/lib/db";
import { formatPickDateShort } from "@/lib/pageHelpers";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UNIT_USD = parseInt(process.env.UNIT_SIZE_USD ?? "100");

async function safeHistory(rank: number): Promise<PickRow[]> {
  try {
    return await getHistoryByRank("moneyline", rank);
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

const RANK_LABELS: Record<number, string> = {
  1: "Top Pick",
  2: "2nd Pick",
  3: "3rd Pick",
};

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: { rank?: string };
}) {
  const rank = [1, 2, 3].includes(parseInt(searchParams.rank ?? "1"))
    ? parseInt(searchParams.rank!)
    : 1;

  const rows = await safeHistory(rank);
  const stats = summary(rows);

  return (
    <div className="space-y-6">
      <StatTiles
        tiles={[
          { label: "Unit Size", value: `$${UNIT_USD}`, accent: "red" },
          { label: "Record", value: `${stats.w}–${stats.l}`, sub: `${stats.total} graded` },
          {
            label: "Units",
            value: `${stats.u >= 0 ? "+" : ""}${stats.u.toFixed(2)}u`,
            sub: `${stats.u >= 0 ? "+" : "-"}$${Math.abs(stats.u * UNIT_USD).toFixed(0)}`,
            accent: stats.u > 0 ? "good" : stats.u < 0 ? "red" : "default",
          },
          {
            label: "ROI",
            value: `${stats.roi >= 0 ? "+" : ""}${stats.roi.toFixed(1)}%`,
            sub: "per pick",
            accent: stats.roi > 0 ? "good" : stats.roi < 0 ? "red" : "default",
          },
        ]}
      />
      <TabStrip />

      <div className="card p-5">
        <div className="section-label">Moneyline Ledger</div>
        <p className="text-paper-300 text-sm">
          Tracks all moneyline picks auto-graded against final box scores. Unit size:{" "}
          <span className="text-paper-100 font-mono">${UNIT_USD}</span>.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[1, 2, 3].map((r) => (
          <Link
            key={r}
            href={`/tracking?rank=${r}`}
            className={`chip ${rank === r ? "chip-red" : "chip-muted"}`}
          >
            {RANK_LABELS[r]}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="font-mono text-[11px] tracking-[0.3em] text-bg-500 uppercase">
            No History Yet
          </div>
          <p className="mt-3 text-paper-300">
            Once picks get graded, they'll show up here.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Pick</th>
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
                    <td>
                      <span
                        className={`grade ${
                          r.grade?.startsWith("A")
                            ? "grade-a"
                            : r.grade?.startsWith("B")
                            ? "grade-b"
                            : "grade-c"
                        }`}
                      >
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
                      {r.units != null
                        ? `${r.units > 0 ? "+" : ""}${r.units.toFixed(2)}u`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
