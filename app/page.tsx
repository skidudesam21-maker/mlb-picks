import StatTiles from "@/components/StatTiles";
import TabStrip from "@/components/TabStrip";
import NRFIDashboard from "@/components/NRFIDashboard";
import { getNRFITeams, getNRFIPitchers } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SEASON = new Date().getFullYear();

export default async function Home() {
  let teams: any[] = [];
  let pitchers: any[] = [];
  try {
    teams = await getNRFITeams(SEASON);
  } catch (e) {
    console.error("getNRFITeams failed", e);
  }
  try {
    pitchers = await getNRFIPitchers(SEASON);
  } catch (e) {
    console.error("getNRFIPitchers failed", e);
  }

  const totalGames = teams.reduce((a, t) => a + t.games, 0) / 2; // each game counted twice (home + away)
  const nrfiRate =
    teams.length === 0
      ? 0
      : (teams.reduce((a, t) => a + t.nrfi_wins, 0) /
          Math.max(1, teams.reduce((a, t) => a + t.games, 0))) *
        100;
  const todayCount = pitchers.filter((p) => p.playing_today).length;

  return (
    <div className="space-y-6">
      <StatTiles
        tiles={[
          { label: "Season", value: SEASON, accent: "red" },
          { label: "Games Tracked", value: Math.round(totalGames).toString() },
          {
            label: "League NRFI %",
            value: `${nrfiRate.toFixed(1)}%`,
            accent: "red",
          },
          {
            label: "Pitchers Today",
            value: todayCount,
            accent: todayCount > 0 ? "good" : "default",
          },
        ]}
      />
      <TabStrip />

      <NRFIDashboard teams={teams} pitchers={pitchers} />
    </div>
  );
}
