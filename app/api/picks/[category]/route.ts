import { NextRequest, NextResponse } from "next/server";
import { getLatestPicks } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: { category: string } }) {
  const allowed = ["nrfi", "moneyline", "hit", "strikeout"];
  if (!allowed.includes(params.category)) {
    return NextResponse.json({ error: "bad category" }, { status: 400 });
  }
  try {
    const rows = await getLatestPicks(params.category);
    return NextResponse.json({ picks: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
