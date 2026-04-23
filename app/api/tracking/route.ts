import { NextRequest, NextResponse } from "next/server";
import { getHistoryByRank } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") ?? "";
  const rank = parseInt(req.nextUrl.searchParams.get("rank") ?? "0");
  const allowed = ["nrfi", "moneyline", "hit", "strikeout"];
  if (!allowed.includes(category)) {
    return NextResponse.json({ error: "bad category" }, { status: 400 });
  }
  if (![1, 2, 3].includes(rank)) {
    return NextResponse.json({ error: "bad rank" }, { status: 400 });
  }
  try {
    const rows = await getHistoryByRank(category, rank);
    return NextResponse.json({ picks: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
