import PageHeader from "@/components/PageHeader";
import PickCard from "@/components/PickCard";
import { safeLatest, formatPickDate } from "@/lib/pageHelpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MoneylinePage() {
  const picks = await safeLatest("moneyline");
  const date = picks[0]?.date ? formatPickDate(picks[0].date) : "";

  return (
    <>
      <PageHeader
        eyebrow={date ? `Slate · ${date}` : "Daily Moneyline"}
        title="Straight up."
        description="Team strength composite — starting pitcher, lineup OPS, bullpen quality, recent form, park factor, and home field — scored against the market's implied probability. We only lean when our edge beats the juice."
      />

      {picks.length === 0 ? (
        <div className="stitched rounded-xl p-12 text-center">
          <div className="font-mono text-[11px] tracking-[0.4em] text-ink-600 uppercase">Awaiting Slate</div>
          <p className="font-serif text-xl text-white/60 mt-4 max-w-lg mx-auto">
            No moneyline picks loaded yet. The daily cron populates this page each morning.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {picks.map((p) => (
            <PickCard
              key={p.id}
              rank={p.rank}
              label={p.pick_label}
              subtitle="Moneyline"
              grade={p.grade}
              confidence={p.confidence}
              writeup={p.writeup}
              factors={p.factors ?? []}
              odds={p.odds}
              book={p.book}
              line={p.line}
              category="Moneyline"
            />
          ))}
        </div>
      )}
    </>
  );
}
