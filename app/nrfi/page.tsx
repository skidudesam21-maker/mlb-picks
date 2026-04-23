import PageHeader from "@/components/PageHeader";
import PickCard from "@/components/PickCard";
import { safeLatest, formatPickDate } from "@/lib/pageHelpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NRFIPage() {
  const picks = await safeLatest("nrfi");
  const date = picks[0]?.date ? formatPickDate(picks[0].date) : "";

  return (
    <>
      <PageHeader
        eyebrow={date ? `Slate · ${date}` : "Daily NRFI"}
        title="No Run First."
        description="The three games our model likes most to start 0-0. Starting pitcher quality, 1-4 hitter splits vs that pitcher's hand, park run factor, and weather — scored and ranked."
      />

      {picks.length === 0 ? (
        <EmptyState category="NRFI" />
      ) : (
        <div className="space-y-5">
          {picks.map((p) => (
            <PickCard
              key={p.id}
              rank={p.rank}
              label={p.pick_label}
              subtitle={`Under 0.5 runs · 1st inning`}
              grade={p.grade}
              confidence={p.confidence}
              writeup={p.writeup}
              factors={p.factors ?? []}
              odds={p.odds}
              book={p.book}
              line={p.line}
              category="NRFI · Under 0.5 · 1st"
            />
          ))}
        </div>
      )}
    </>
  );
}

function EmptyState({ category }: { category: string }) {
  return (
    <div className="stitched rounded-xl p-12 text-center">
      <div className="font-mono text-[11px] tracking-[0.4em] text-ink-600 uppercase">Awaiting Slate</div>
      <p className="font-serif text-xl text-white/60 mt-4 max-w-lg mx-auto">
        No {category} picks loaded yet. Picks are generated daily at 10:00 AM ET. If this is a new deployment, the first cron run will populate this page.
      </p>
    </div>
  );
}
