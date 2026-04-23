// The Odds API wrapper.
// Docs: https://the-odds-api.com/liveapi/guides/v4/
// Free tier: 500 requests/month. We make ~3 calls/day = 90/month. Safe.

const BASE = "https://api.the-odds-api.com/v4";

async function fetchOdds(path: string, params: Record<string, string> = {}) {
  const key = process.env.ODDS_API_KEY;
  if (!key) throw new Error("ODDS_API_KEY not set");
  const qp = new URLSearchParams({ apiKey: key, ...params });
  const url = `${BASE}${path}?${qp.toString()}`;
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`Odds API ${res.status}: ${await res.text()}`);
  return res.json();
}

// thescore sportsbook key for filtering bookmakers (they appear as "thescore" in Odds API).
const PREFERRED_BOOK = "thescore";
const FALLBACK_BOOKS = ["draftkings", "fanduel", "betmgm"];

// Get moneyline + totals odds for all MLB games today.
export async function getMLBGameOdds() {
  const data = await fetchOdds("/sports/baseball_mlb/odds", {
    regions: "us,us2",
    markets: "h2h,totals",
    oddsFormat: "american",
  });
  return data as any[];
}

// Get 1st inning YRFI/NRFI odds (market key is "totals_1st_1_innings").
export async function getFirstInningOdds() {
  try {
    const data = await fetchOdds("/sports/baseball_mlb/odds", {
      regions: "us,us2",
      markets: "totals_1st_1_innings",
      oddsFormat: "american",
    });
    return data as any[];
  } catch {
    return [];
  }
}

// Get batter hit props + pitcher strikeout props.
export async function getPlayerPropsForEvent(eventId: string) {
  try {
    const data = await fetchOdds(`/sports/baseball_mlb/events/${eventId}/odds`, {
      regions: "us,us2",
      markets: "batter_hits,pitcher_strikeouts,pitcher_strikeouts_alternate",
      oddsFormat: "american",
    });
    return data;
  } catch {
    return null;
  }
}

// Prefer thescore odds, fall back to major books if thescore isn't offering this line.
export function pickBestBook(bookmakers: any[]) {
  if (!bookmakers?.length) return null;
  const ts = bookmakers.find((b) => b.key === PREFERRED_BOOK);
  if (ts) return ts;
  for (const fb of FALLBACK_BOOKS) {
    const book = bookmakers.find((b) => b.key === fb);
    if (book) return book;
  }
  return bookmakers[0];
}

// Extract NRFI (Under 0.5 1st inning) odds from an event's bookmakers list.
export function extractNRFIPrice(event: any): { price: number; book: string } | null {
  const book = pickBestBook(event?.bookmakers ?? []);
  if (!book) return null;
  const market = book.markets?.find((m: any) => m.key === "totals_1st_1_innings");
  if (!market) return null;
  const under = market.outcomes?.find((o: any) => o.name === "Under");
  if (!under) return null;
  return { price: under.price, book: book.key };
}

// Extract moneyline odds for a specific team name.
export function extractMoneyline(event: any, teamName: string): { price: number; book: string } | null {
  const book = pickBestBook(event?.bookmakers ?? []);
  if (!book) return null;
  const market = book.markets?.find((m: any) => m.key === "h2h");
  if (!market) return null;
  const outcome = market.outcomes?.find((o: any) =>
    o.name?.toLowerCase().includes(teamName.toLowerCase()) ||
    teamName.toLowerCase().includes(o.name?.toLowerCase() ?? "")
  );
  if (!outcome) return null;
  return { price: outcome.price, book: book.key };
}

// Convert American odds to implied probability.
export function americanToImpliedProb(odds: number): number {
  if (odds > 0) return 100 / (odds + 100);
  return -odds / (-odds + 100);
}

// Convert American odds to decimal payout multiplier.
export function americanToDecimal(odds: number): number {
  if (odds > 0) return odds / 100 + 1;
  return 100 / -odds + 1;
}

// Calculate profit on a 1-unit bet.
export function unitsWon(odds: number, result: "W" | "L" | "P"): number {
  if (result === "P") return 0;
  if (result === "L") return -1;
  return americanToDecimal(odds) - 1;
}
