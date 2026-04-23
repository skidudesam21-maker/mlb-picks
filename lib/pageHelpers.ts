import { getLatestPicks, PickRow } from "@/lib/db";

export async function safeLatest(category: string): Promise<PickRow[]> {
  try {
    return await getLatestPicks(category);
  } catch (e) {
    console.error("DB read failed:", e);
    return [];
  }
}

function coerceDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "string") {
    const iso = v.length === 10 ? `${v}T12:00:00Z` : v;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatPickDate(dateValue: any): string {
  const d = coerceDate(dateValue);
  if (!d) return "";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatPickDateShort(dateValue: any): string {
  const d = coerceDate(dateValue);
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
}
