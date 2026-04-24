import StatTiles from "@/components/StatTiles";
import TabStrip from "@/components/TabStrip";
import TodaySlate from "@/components/TodaySlate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SEASON = new Date().getFullYear();

export default function SystemPage() {
  return (
    <div className="space-y-6">
      <StatTiles
        tiles={[
          { label: "Season", value: SEASON, accent: "red" },
          { label: "Tabs", value: 5 },
          { label: "Daily Crons", value: 2, accent: "red" },
          { label: "Unit Size", value: `$${process.env.UNIT_SIZE_USD ?? "100"}` },
        ]}
      />
      <TabStrip />

      <div className="card p-6">
        <div className="section-label">What Skogspicks tracks</div>
        <p className="text-paper-200 leading-relaxed">
          Skogspicks has three tools: an <span className="text-red-400">NRFI dashboard</span> showing each team's and starting pitcher's 1st-inning scoring records for the current season, a daily <span className="text-red-400">moneyline picks</span> list (top 3), and a <span className="text-red-400">hitter-vs-pitcher matchup table</span> showing lifetime career stats for every batter in today's lineups against today's starters.
        </p>
      </div>

      <div className="card p-6">
        <div className="section-label">NRFI Dashboard</div>
        <p className="text-paper-200 leading-relaxed mb-4">
          Pulled from every regular-season game's first-inning linescore. A team's NRFI record means games that specific team did not score in the 1st inning.
        </p>
        <ul className="space-y-1.5 text-sm text-paper-200">
          <li>· <span className="text-red-400 font-mono">Team Batting tab</span> — ranks all 30 teams by NRFI %, with home/away splits and current streak</li>
          <li>· <span className="text-red-400 font-mono">Starting Pitchers tab</span> — every pitcher who started a game this season, sortable and searchable</li>
          <li>· <span className="text-red-400 font-mono">Playing Today filter</span> — filter the pitcher table to only those starting today</li>
          <li>· <span className="text-red-400 font-mono">Streak indicator</span> — consecutive NRFI outings (green) or consecutive runs allowed (red)</li>
        </ul>
      </div>

      <div className="card p-6">
        <div className="section-label">Moneyline Picks</div>
        <p className="text-paper-200 leading-relaxed mb-4">
          Three picks daily. The model scores every game on a team-strength composite (starter quality, offense, bullpen, recent form, home field) and compares to market-implied probability when available.
        </p>
        <ul className="space-y-1.5 text-sm text-paper-200">
          <li>· Only picks teams the model projects favorably at a reasonable price</li>
          <li>· Click any card to expand the full factor-by-factor writeup</li>
          <li>· Letter grade reflects confidence: A (80+), B (65–79), C (50–64), D (&lt;50)</li>
        </ul>
      </div>

      <div className="card p-6">
        <div className="section-label">Hitter vs Pitcher Matchups</div>
        <p className="text-paper-200 leading-relaxed mb-4">
          For every game today, we pull each opposing hitter's <span className="text-red-400">lifetime career stats</span> against that day's starting pitcher — all seasons, not just {SEASON}.
        </p>
        <ul className="space-y-1.5 text-sm text-paper-200">
          <li>· Sort any column — PA, AB, H, HR, AVG, OPS, or by name</li>
          <li>· Filter minimum AB vs that pitcher (5, 10, 15, 25, 40)</li>
          <li>· Filter minimum BA (.250, .300, .350, .400)</li>
          <li>· Search any player or team</li>
        </ul>
      </div>

      <div className="card p-6">
        <div className="section-label">Data & Refresh</div>
        <ul className="space-y-1.5 text-sm text-paper-200">
          <li>· <span className="text-red-400 font-mono">MLB Stats API</span> — schedule, pitchers, linescores, box scores, rosters, career stats</li>
          <li>· <span className="text-red-400 font-mono">Llama 3.3 via Groq</span> — writes the pick analysis from model factors</li>
          <li>· Daily <span className="font-mono">generate</span> cron refreshes: moneyline picks + NRFI team/pitcher stats + today's matchups</li>
          <li>· Daily <span className="font-mono">grade</span> cron marks past picks as W/L/Push against final box scores</li>
        </ul>
      </div>

      <div className="card p-6">
        <div className="section-label">Honest caveats</div>
        <ul className="space-y-2 text-sm text-paper-200 leading-relaxed">
          <li>· Early-season stats are small samples — a 5-game NRFI % is not meaningful. Treat low-games numbers with skepticism.</li>
          <li>· No model reliably beats the books over long windows. Track, evaluate, don't bet more than you can lose.</li>
          <li>· Top 3 moneyline picks are shown every day — if the slate is weak, the #3 might only grade a C.</li>
          <li>· Career vs-pitcher stats include small samples; the min-AB filter helps weed out noise.</li>
        </ul>
      </div>
    </div>
  );
}
