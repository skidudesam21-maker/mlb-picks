import StatTiles from "@/components/StatTiles";
import TabStrip from "@/components/TabStrip";
import MatchupsTable from "@/components/MatchupsTable";
import TodaySlate from "@/components/TodaySlate";
import { getMatchupsForLatest } from "@/lib/db";
import { formatPickDate } from "@/lib/pageHelpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MatchupsPage() {
  let rows: any[] = [];
  try {
    rows = await getMatchupsForLatest();
  } catch (e) {
    console.error("getMatchupsForLatest failed", e);
  }

  const date = rows[0]?.date;
  const pitcherCount = new Set(rows.map((r) => r.pitcher_id)).size;
  const withHistory = rows.filter((r) => (r.pa ?? 0) > 0).length;

  return (
    <div className="space-y-6">
      <StatTiles
        tiles={[
          { label: "Slate", value: formatPickDate(date) || "—", accent: "red" },
          { label: "Pitchers", value: pitcherCount },
          { label: "Matchups", value: rows.length, accent: "red" },
          {
            label: "With History",
            value: withHistory,
            sub: `${rows.length ? Math.round((withHistory / rows.length) * 100) : 0}% of matchups`,
            accent: "good",
          },
        ]}
      />
      <TabStrip />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div className="space-y-6 min-w-0">
          <div className="card p-5">
            <div className="section-label">Today's starting pitchers vs opposing hitters</div>
            <p className="text-paper-300 text-sm">
              Lifetime career stats (all seasons) between today's starting pitchers and each opposing hitter. Filter by minimum AB vs that pitcher, minimum BA, or sort any column.
            </p>
          </div>

          {rows.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="font-mono text-[11px] tracking-[0.3em] text-bg-500 uppercase">
                No Matchups Yet
              </div>
              <p className="mt-3 text-paper-300 text-sm max-w-md mx-auto">
                Matchups populate during the daily cron. Run the generate cron from Vercel if picks haven't been made today yet.
              </p>
            </div>
          ) : (
            <MatchupsTable rows={rows} />
          )}
        </div>
        <TodaySlate />
      </div>
    </div>
  );
}
