import { NextRequest, NextResponse } from "next/server";
import { runBackfillRange } from "@/lib/backfill";

// Hobby plan max is 300s. Backfill processes ~1 day per 20-40 seconds.
// Calling repeatedly with ?from=X&to=Y lets users process in chunks without timing out.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Two modes:
  // Mode A: ?days=N → backfill the last N days (from today backward). Default 7.
  // Mode B: ?from=YYYY-MM-DD&to=YYYY-MM-DD → backfill a specific range (inclusive).
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "7");

  try {
    let result;
    if (from && to) {
      result = await runBackfillRange(from, to);
    } else {
      const clamped = Math.max(1, Math.min(7, days)); // cap at 7 days per call to fit in 300s
      const today = new Date();
      const toDate = new Date(today);
      toDate.setUTCDate(toDate.getUTCDate() - 1);
      const fromDate = new Date(today);
      fromDate.setUTCDate(fromDate.getUTCDate() - clamped);
      const fromStr = fromDate.toISOString().slice(0, 10);
      const toStr = toDate.toISOString().slice(0, 10);
      result = await runBackfillRange(fromStr, toStr);
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
