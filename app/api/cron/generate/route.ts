import { NextRequest, NextResponse } from "next/server";
import { generateMoneylinePicks } from "@/lib/pipeline";
import { recomputeNRFI } from "@/lib/nrfiStats";
import { refreshTodayMatchups } from "@/lib/matchups";
import { todayET, currentSeasonET } from "@/lib/dateUtil";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results: any = { date: todayET() };

  // 1) Moneyline picks (fast — runs first so essentials are saved even if later steps time out)
  try {
    results.moneyline = await generateMoneylinePicks();
  } catch (e: any) {
    console.error("[cron] moneyline failed", e);
    results.moneyline = { error: e.message };
  }

  // 2) Matchups refresh (medium — pulls career BvP for every pairing)
  try {
    const d = todayET();
    results.matchups = await refreshTodayMatchups(d);
    results.matchups.date = d;
  } catch (e: any) {
    console.error("[cron] matchups failed", e);
    results.matchups = { error: e.message };
  }

  // 3) NRFI full-season recompute (slow — seasonal aggregation)
  try {
    const season = currentSeasonET();
    results.nrfi = await recomputeNRFI(season);
    results.nrfi.season = season;
  } catch (e: any) {
    console.error("[cron] nrfi failed", e);
    results.nrfi = { error: e.message };
  }

  return NextResponse.json({ ok: true, ...results });
}
