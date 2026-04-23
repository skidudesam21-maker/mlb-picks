import Link from "next/link";

export default function Home() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative pt-8 pb-20">
        <div className="font-mono text-[11px] tracking-[0.45em] text-gold-500 uppercase mb-4">
          Est. 2026 · Ballpark Intel
        </div>
        <h1 className="font-display text-[5.5rem] md:text-[7.5rem] leading-[0.9] tracking-[0.02em] text-white">
          WHERE THE
          <br />
          <span className="text-gold-400 italic font-serif not-italic font-[600]">numbers</span>
          <span className="ml-4">DECIDE.</span>
        </h1>
        <p className="font-serif text-xl text-white/60 max-w-2xl mt-10 leading-relaxed">
          Every morning, Diamond Edge grinds through pitching matchups, lineup splits, bullpen fatigue, park factors,
          and weather across every MLB game, then hands you the three picks our model trusts most — graded like a
          report card, with the math on record.
        </p>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            href="/nrfi"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-gold-500 text-ink-950 font-mono text-sm tracking-[0.25em] uppercase hover:bg-gold-400 transition"
          >
            Today's NRFI
            <span>→</span>
          </Link>
          <Link
            href="/moneyline"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-ink-600 text-white font-mono text-sm tracking-[0.25em] uppercase hover:border-gold-500 hover:text-gold-400 transition"
          >
            Moneyline
          </Link>
          <Link
            href="/props"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-ink-600 text-white font-mono text-sm tracking-[0.25em] uppercase hover:border-gold-500 hover:text-gold-400 transition"
          >
            Player Props
          </Link>
        </div>
      </section>

      <div className="hero-rule" />

      {/* Category callouts */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-0 border-b border-ink-700">
        {[
          {
            key: "01",
            title: "NRFI",
            body: "No Run First Inning. Starter quality + top-of-order strength + park + weather.",
          },
          {
            key: "02",
            title: "Moneyline",
            body: "Team strength vs market price. Our projected win probability must beat implied odds.",
          },
          {
            key: "03",
            title: "Hits & Ks",
            body: "Batter splits, hot streaks, opposing pitcher K%, park-adjusted hit rates and alt K lines.",
          },
        ].map((c, i) => (
          <div
            key={c.key}
            className={`p-8 md:p-12 border-ink-700 ${i < 2 ? "md:border-r" : ""} border-b md:border-b-0`}
          >
            <div className="font-mono text-[11px] tracking-[0.4em] text-gold-500 uppercase mb-4">
              · {c.key}
            </div>
            <h3 className="font-display text-4xl text-white mb-3 tracking-[0.03em]">{c.title}</h3>
            <p className="font-serif text-white/60 leading-relaxed">{c.body}</p>
          </div>
        ))}
      </section>

      {/* Tracking teaser */}
      <section className="pt-24">
        <div className="flex flex-wrap items-end justify-between gap-6 mb-6">
          <div>
            <div className="font-mono text-[11px] tracking-[0.4em] text-gold-500 uppercase mb-3">
              Receipts · not promises
            </div>
            <h2 className="font-display text-5xl text-white tracking-[0.03em]">The ledger is public.</h2>
          </div>
          <Link
            href="/tracking"
            className="font-mono text-sm tracking-[0.25em] uppercase text-gold-400 hover:text-gold-500 transition"
          >
            View tracking →
          </Link>
        </div>
        <p className="font-serif text-white/60 max-w-2xl leading-relaxed">
          Every pick is logged with its grade, confidence, odds at the time, and final result. Units up, units down,
          record by rank — you see everything the model has done, win or lose.
        </p>
      </section>
    </div>
  );
}
