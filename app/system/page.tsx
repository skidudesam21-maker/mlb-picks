import StatTiles from "@/components/StatTiles";
import TabStrip from "@/components/TabStrip";
import { getLatestPicks, PickRow } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function safeLatestFor(cat: string): Promise<PickRow[]> {
  try {
    return await getLatestPicks(cat);
  } catch {
    return [];
  }
}

export default async function SystemPage() {
  const [nrfi, ml, hit, k] = await Promise.all([
    safeLatestFor("nrfi"),
    safeLatestFor("moneyline"),
    safeLatestFor("hit"),
    safeLatestFor("strikeout"),
  ]);
  const all = [...nrfi, ...ml, ...hit, ...k];
  const gameCount = new Set(all.filter((p) => p.game_pk).map((p) => p.game_pk)).size;
  const latestDate = all.length ? all[0].date : null;

  return (
    <div className="space-y-6">
      <StatTiles date={latestDate} gameCount={gameCount} picks={all} />
      <TabStrip />

      <div className="card p-6">
        <div className="section-label">What is Skogspicks?</div>
        <p className="text-paper-200 leading-relaxed">
          Skogspicks analyzes every MLB game each morning and produces the <span className="text-red-400 font-mono">top 3 picks</span> in four categories: NRFI, moneyline, batter hit props, and pitcher strikeout props. Each pick gets a letter grade (A+ through F), a confidence score out of 100, and a full factor breakdown showing exactly why the model landed where it did.
        </p>
      </div>

      <div className="card p-6">
        <div className="section-label">How the Score Works</div>
        <p className="text-paper-200 leading-relaxed mb-6">
          Every pick starts from a baseline score and gains or loses points based on the factors below. Lower confidence on weak slates is honest — picks aren't inflated to look better than they are.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="card p-5 text-center">
            <div className="font-mono text-2xl text-red-400 font-bold">≥ 80</div>
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-bg-500 mt-1">
              A grade
            </div>
            <div className="text-xs text-paper-300 mt-2">Strong lean</div>
          </div>
          <div className="card p-5 text-center">
            <div className="font-mono text-2xl text-paper-100 font-bold">65–79</div>
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-bg-500 mt-1">
              B grade
            </div>
            <div className="text-xs text-paper-300 mt-2">Moderate lean</div>
          </div>
          <div className="card p-5 text-center">
            <div className="font-mono text-2xl text-bg-400 font-bold">&lt; 65</div>
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-bg-500 mt-1">
              C or worse
            </div>
            <div className="text-xs text-paper-300 mt-2">Thin edge</div>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="section-label">Factors by Category</div>

        <FactorBlock
          title="NRFI (No Run First Inning)"
          rows={[
            ["Starting pitcher quality", "ERA, WHIP, K/9, BB/9, HR/9 (blended with league avg on small samples)"],
            ["Recent form", "Last 5 starts ERA"],
            ["Lineup threat", "Top-4 hitters OPS vs starter's handedness"],
            ["Park factor", "First-inning run environment adjustment"],
            ["Weather", "Temperature, wind speed and direction"],
          ]}
        />

        <FactorBlock
          title="Moneyline"
          rows={[
            ["Starting pitcher quality", "Full-game projection with small-sample smoothing"],
            ["Team offense", "OPS + runs/game vs league average"],
            ["Team pitching", "ERA + WHIP"],
            ["Recent SP form", "Last 5 starts"],
            ["Home field advantage", "~3% edge baked in"],
            ["Market respect", "Base confidence starts at market-implied probability"],
            ["Odds range", "Only picks at -250 to +180 American (no huge dogs/favorites)"],
          ]}
        />

        <FactorBlock
          title="Batter Hits (Over 0.5 Hits)"
          rows={[
            ["Season BA", "Actual and blended"],
            ["OPS vs opposing hand", "Split-specific performance"],
            ["Recent form (L15)", "Hot/cold streak"],
            ["Opposing pitcher", "ERA + strikeout rate"],
            ["Park factor", "Hit-rate adjustment"],
            ["Projected PAs", "Based on batting order slot"],
          ]}
        />

        <FactorBlock
          title="Pitcher Strikeouts (Over alt line)"
          rows={[
            ["Season K/9, K%", "Requires 6+ K/9 and 30+ IP"],
            ["Recent workload", "Last 5 starts avg IP and Ks"],
            ["Opposing team K%", "Season strikeout rate"],
            ["Park factor", "Run/K environment"],
            ["Line selection", "Largest line model clears by ≥ 1 K"],
          ]}
        />
      </div>

      <div className="card p-6">
        <div className="section-label">Data Sources</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 bg-bg-800/60 rounded-lg border border-bg-700/60">
            <div className="font-mono text-xs text-red-400 mb-1">MLB STATS API</div>
            <div className="text-sm text-paper-200">Schedule, pitcher splits, game logs, boxscores, rosters, weather</div>
          </div>
          <div className="p-4 bg-bg-800/60 rounded-lg border border-bg-700/60">
            <div className="font-mono text-xs text-red-400 mb-1">THE ODDS API</div>
            <div className="text-sm text-paper-200">Moneyline, NRFI, player prop odds across US sportsbooks</div>
          </div>
          <div className="p-4 bg-bg-800/60 rounded-lg border border-bg-700/60">
            <div className="font-mono text-xs text-red-400 mb-1">LLAMA 3.3 (Groq)</div>
            <div className="text-sm text-paper-200">Generates writeups from model factors; never invents stats</div>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="section-label">Honest Caveats</div>
        <ul className="space-y-2 text-sm text-paper-200 leading-relaxed">
          <li>• No model reliably beats sportsbooks. A+ picks lose too.</li>
          <li>• Confidence reflects the model's lean, not a guarantee.</li>
          <li>• Early-season stats are small samples; the model blends with league averages to avoid overreaction.</li>
          <li>• Top 3 are shown every day regardless of confidence — a weak slate might mean the #3 pick is only a C+.</li>
          <li>• Odds are pulled at pick-generation time; closing lines can be different.</li>
        </ul>
      </div>
    </div>
  );
}

function FactorBlock({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="mt-6 first:mt-0">
      <div className="font-mono text-sm text-paper-100 font-semibold mb-3">{title}</div>
      <div className="space-y-0">
        {rows.map(([name, desc], i) => (
          <div
            key={i}
            className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 py-3 border-b border-bg-700/40 last:border-0"
          >
            <div className="font-mono text-xs text-red-400 md:w-48 shrink-0">{name}</div>
            <div className="text-sm text-paper-200">{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
