import { NextRequest, NextResponse } from "next/server";
import { generateMoneylinePicks } from "@/lib/pipeline";
import { recomputeNRFI } from "@/lib/nrfiStats";
import { refreshTodayMatchups } from "@/lib/matchups";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Daily orchestration: runs moneyline picks, recomputes NRFI stats, refreshes today's matchups.
// All three are attempted; a failure in one does not block the others.
// Hobby plan = 300s max, so each task is time-budgeted.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results: any = {};

  try {
    results.moneyline = await generateMoneylinePicks();
  } catch (e: any) {
    console.error("[cron] moneyline failed", e);
    results.moneyline = { error: e.message };
  }

  try {
    const season = new Date().getFullYear();
    results.nrfi = await recomputeNRFI(season);
    results.nrfi.season = season;
  } catch (e: any) {
    console.error("[cron] nrfi failed", e);
    results.nrfi = { error: e.message };
  }

  try {
    const d = new Date().toISOString().slice(0, 10);
    results.matchups = await refreshTodayMatchups(d);
    results.matchups.date = d;
  } catch (e: any) {
    console.error("[cron] matchups failed", e);
    results.matchups = { error: e.message };
  }

  return NextResponse.json({ ok: true, ...results });
}
