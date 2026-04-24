// Compute today's starting-pitcher vs. opposing-hitter lifetime career stats.
// Called by the daily cron and stored in the today_matchups table.
//
// Data source: MLB Stats API /people/{batterId}/stats?stats=vsPlayer&opposingPlayerId={pitcherId}
// This returns the batter's CAREER stats against that pitcher (all seasons).

import { getScheduleForDate, getTeamRoster, getBatterVsPitcher } from "./mlb";
import { clearMatchupsForDate, upsertMatchup } from "./db";

export async function refreshTodayMatchups(dateISO: string): Promise<{
  games: number;
  pairings: number;
  withHistory: number;
}> {
  const schedule = await getScheduleForDate(dateISO);
  const playable = schedule.filter(
    (g: any) => g.home?.probablePitcher && g.away?.probablePitcher
  );

  // Wipe today's matchups so we rebuild fresh.
  await clearMatchupsForDate(dateISO);

  let totalPairings = 0;
  let withHistory = 0;

  for (const g of playable) {
    try {
      const homePitcher = g.home.probablePitcher;
      const awayPitcher = g.away.probablePitcher;

      // Rosters for each team — for each pitcher we need the OPPOSING team's hitters.
      const [homeRoster, awayRoster] = await Promise.all([
        getTeamRoster(g.home.id),
        getTeamRoster(g.away.id),
      ]);

      const homeHitters = homeRoster.filter((r: any) => r.position !== "P");
      const awayHitters = awayRoster.filter((r: any) => r.position !== "P");

      // Home pitcher vs. away hitters
      for (const batter of awayHitters) {
        if (!batter?.id) continue;
        const stats = await getBatterVsPitcher(batter.id, homePitcher.id);
        const hasAnyPA = stats && stats.pa > 0;
        await upsertMatchup({
          date: dateISO,
          game_pk: g.gamePk,
          pitcher_id: homePitcher.id,
          pitcher_name: homePitcher.fullName,
          pitcher_team: g.home.abbrev,
          batter_id: batter.id,
          batter_name: batter.name,
          batter_team: g.away.abbrev,
          pa: stats?.pa ?? 0,
          ab: stats?.ab ?? 0,
          h: stats?.h ?? 0,
          hr: stats?.hr ?? 0,
          rbi: stats?.rbi ?? 0,
          bb: stats?.bb ?? 0,
          so: stats?.so ?? 0,
          avg: stats?.avg ?? 0,
          obp: stats?.obp ?? 0,
          slg: stats?.slg ?? 0,
          ops: stats?.ops ?? 0,
        });
        totalPairings++;
        if (hasAnyPA) withHistory++;
      }

      // Away pitcher vs. home hitters
      for (const batter of homeHitters) {
        if (!batter?.id) continue;
        const stats = await getBatterVsPitcher(batter.id, awayPitcher.id);
        const hasAnyPA = stats && stats.pa > 0;
        await upsertMatchup({
          date: dateISO,
          game_pk: g.gamePk,
          pitcher_id: awayPitcher.id,
          pitcher_name: awayPitcher.fullName,
          pitcher_team: g.away.abbrev,
          batter_id: batter.id,
          batter_name: batter.name,
          batter_team: g.home.abbrev,
          pa: stats?.pa ?? 0,
          ab: stats?.ab ?? 0,
          h: stats?.h ?? 0,
          hr: stats?.hr ?? 0,
          rbi: stats?.rbi ?? 0,
          bb: stats?.bb ?? 0,
          so: stats?.so ?? 0,
          avg: stats?.avg ?? 0,
          obp: stats?.obp ?? 0,
          slg: stats?.slg ?? 0,
          ops: stats?.ops ?? 0,
        });
        totalPairings++;
        if (hasAnyPA) withHistory++;
      }
    } catch (e) {
      console.error("[matchups] game failed", g.gamePk, e);
    }
  }

  return {
    games: playable.length,
    pairings: totalPairings,
    withHistory,
  };
}
