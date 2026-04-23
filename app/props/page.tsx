import PageHeader from "@/components/PageHeader";
import PickCard from "@/components/PickCard";
import { safeLatest, formatPickDate } from "@/lib/pageHelpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PropsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab = searchParams.tab === "strikeout" ? "strikeout" : "hit";
  const picks = await safeLatest(tab);
  const date = picks[0]?.date ? formatPickDate(picks[0].date) : "";

  return (
    <>
      <PageHeader
        eyebrow={date ? `Slate · ${date}` : "Daily Props"}
        title="The Players."
        description="Three batters the model loves to record a hit, and three pitchers we project to sail over their alt K line. Splits, streaks, pitcher K%, park, projected PAs — all priced in."
      />

      {/* Tabs */}
      <div className="flex gap-0 border-b border-ink-700 mb-10">
        <TabLink href="/props?tab=hit" active={tab === "hit"}>
          Hits
        </TabLink>
        <TabLink href="/props?tab=strikeout" active={tab === "strikeout"}>
          Strikeouts
        </TabLink>
      </div>

      {picks.length === 0 ? (
        <div className="stitched rounded-xl p-12 text-center">
          <div className="font-mono text-[11px] tracking-[0.4em] text-ink-600 uppercase">Awaiting Slate</div>
          <p className="font-serif text-xl text-white/60 mt-4 max-w-lg mx-auto">
            No {tab === "hit" ? "hit" : "strikeout"} picks yet. Check back after today's cron generates.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {picks.map((p) => (
            <PickCard
              key={p.id}
              rank={p.rank}
              label={p.pick_label}
              subtitle={tab === "hit" ? "Over 0.5 Hits" : `Over ${p.line} Strikeouts`}
              grade={p.grade}
              confidence={p.confidence}
              writeup={p.writeup}
              factors={p.factors ?? []}
              odds={p.odds}
              book={p.book}
              line={p.line}
              category={tab === "hit" ? "Batter Hit Prop" : "Pitcher K Prop"}
            />
          ))}
        </div>
      )}
    </>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={`px-6 py-3 font-display text-xl tracking-[0.18em] uppercase transition border-b-2 -mb-px ${
        active
          ? "text-gold-400 border-gold-500"
          : "text-ink-600 border-transparent hover:text-white"
      }`}
    >
      {children}
    </a>
  );
}
