import StatTiles from "@/components/StatTiles";
import TabStrip from "@/components/TabStrip";
import PickCard from "@/components/PickCard";
import { safeLatest } from "@/lib/pageHelpers";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUBTABS = [
  { id: "all", label: "All" },
  { id: "nrfi", label: "NRFI" },
  { id: "moneyline", label: "Moneyline" },
  { id: "hit", label: "Hits" },
  { id: "strikeout", label: "Strikeouts" },
];

export default async function TodayPage({
  searchParams,
}: {
  searchParams: { cat?: string };
}) {
  const [nrfi, ml, hits, ks] = await Promise.all([
    safeLatest("nrfi"),
    safeLatest("moneyline"),
    safeLatest("hit"),
    safeLatest("strikeout"),
  ]);

  const all = [...nrfi, ...ml, ...hits, ...ks];
  const gameCount = new Set(all.filter((p) => p.game_pk).map((p) => p.game_pk)).size;
  const latestDate = all.length ? all[0].date : null;

  const cat = searchParams.cat ?? "all";
  let visible = all;
  if (cat === "nrfi") visible = nrfi;
  else if (cat === "moneyline") visible = ml;
  else if (cat === "hit") visible = hits;
  else if (cat === "strikeout") visible = ks;

  // Sort visible picks by confidence desc (for "all"), otherwise keep rank order.
  if (cat === "all") {
    visible = [...visible].sort((a, b) => b.confidence - a.confidence);
  } else {
    visible = [...visible].sort((a, b) => a.rank - b.rank);
  }

  const potdId = all.length ? [...all].sort((a, b) => b.confidence - a.confidence)[0].id : null;

  return (
    <div className="space-y-6">
      <StatTiles date={latestDate} gameCount={gameCount} picks={all} />
      <TabStrip />

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2 pt-2">
        {SUBTABS.map((s) => (
          <Link
            key={s.id}
            href={s.id === "all" ? "/" : `/?cat=${s.id}`}
            className={`chip ${cat === s.id ? "chip-red" : "chip-muted"} hover:brightness-125 transition`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {/* Pick list */}
      {visible.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="font-mono text-[11px] tracking-[0.3em] text-bg-500 uppercase">
            Awaiting Slate
          </div>
          <p className="mt-4 text-paper-300 max-w-md mx-auto">
            No picks loaded yet for this category. Picks generate daily at 10:00 AM ET. If you just deployed, run the generate cron manually in Vercel.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((p) => (
            <PickCard
              key={p.id}
              rank={p.rank}
              label={p.pick_label}
              subtitle={subtitleFor(p)}
              grade={p.grade}
              confidence={p.confidence}
              writeup={p.writeup}
              factors={(p.factors as any) ?? []}
              odds={p.odds}
              book={p.book}
              line={p.line}
              category={p.category}
              featured={p.id === potdId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function subtitleFor(p: any): string {
  switch (p.category) {
    case "nrfi":
      return "Under 0.5 runs · 1st inning";
    case "moneyline":
      return `Moneyline · ${p.side}`;
    case "hit":
      return "Over 0.5 Hits";
    case "strikeout":
      return `Over ${p.line} Strikeouts`;
    default:
      return "";
  }
}
