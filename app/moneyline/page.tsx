import StatTiles from "@/components/StatTiles";
import TabStrip from "@/components/TabStrip";
import MoneylinePickCard from "@/components/MoneylinePickCard";
import TodaySlate from "@/components/TodaySlate";
import { getLatestPicks } from "@/lib/db";
import { formatPickDate } from "@/lib/pageHelpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MoneylinePage() {
  let picks: any[] = [];
  try {
    picks = await getLatestPicks("moneyline");
  } catch (e) {
    console.error("getLatestPicks failed", e);
  }

  const date = picks[0]?.date;
  const pickCount = picks.length;

  return (
    <div className="space-y-6">
      <StatTiles
        tiles={[
          { label: "Slate", value: formatPickDate(date) || "—", accent: "red" },
          { label: "Picks Today", value: pickCount, accent: pickCount > 0 ? "good" : "default" },
          {
            label: "Top Pick",
            value: picks[0]?.grade ?? "—",
            sub: picks[0] ? `Conf ${picks[0].confidence}` : undefined,
            accent: "red",
          },
          {
            label: "System",
            value: "Model",
            sub: "confidence-ranked",
          },
        ]}
      />
      <TabStrip />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div>
          {picks.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="font-mono text-[11px] tracking-[0.3em] text-bg-500 uppercase">
                No Picks Yet
              </div>
              <p className="mt-3 text-paper-300 text-sm max-w-md mx-auto">
                Moneyline picks generate once daily. If this is a new deploy, run the generate cron from Vercel.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {picks.map((p) => (
                <MoneylinePickCard key={p.id} pick={p} />
              ))}
            </div>
          )}
        </div>
        <TodaySlate />
      </div>
    </div>
  );
}
