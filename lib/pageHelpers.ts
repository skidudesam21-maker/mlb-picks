import { getLatestPicks, PickRow } from "@/lib/db";

export async function safeLatest(category: string): Promise<PickRow[]> {
  try {
    return await getLatestPicks(category);
  } catch (e) {
    console.error("DB read failed:", e);
    return [];
  }
}

export function formatPickDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
