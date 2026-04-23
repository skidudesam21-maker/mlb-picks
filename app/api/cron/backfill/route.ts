import { NextRequest, NextResponse } from "next/server";
import { runBackfill } from "@/lib/backfill";

export const maxDuration = 800; // longer than normal crons
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const daysBack = parseInt(req.nextUrl.searchParams.get("days") ?? "14");
  const clamped = Math.max(1, Math.min(30, daysBack));
  try {
    const res = await runBackfill(clamped);
    return NextResponse.json({ ok: true, ...res });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
