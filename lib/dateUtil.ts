// MLB schedules are based on Eastern Time. Using UTC causes bugs where the date rolls
// over at 8 PM ET / midnight UTC and we start pulling tomorrow's schedule while today's
// games are still in progress.
//
// This module exports date utilities that are all ET-aware.

const ET_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
};

// Return today's date in Eastern Time as YYYY-MM-DD.
export function todayET(): string {
  const parts = new Intl.DateTimeFormat("en-US", ET_OPTIONS).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

// Return yesterday's date in Eastern Time as YYYY-MM-DD.
export function yesterdayET(): string {
  const today = new Date();
  // Shift 24 hours back
  const back = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-US", ET_OPTIONS).formatToParts(back);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

// Return the current year based on Eastern Time.
export function currentSeasonET(): number {
  const parts = new Intl.DateTimeFormat("en-US", ET_OPTIONS).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  return parseInt(y ?? "2026");
}

// Given an ET date YYYY-MM-DD, return a shifted date (e.g., shiftDateET("2026-04-23", -1) = "2026-04-22").
export function shiftDateET(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map((s) => parseInt(s));
  // Treat as noon UTC to avoid DST edge cases when shifting
  const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + days);
  const yy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(base.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
