// Park factors: 100 = neutral, >100 = hitter-friendly, <100 = pitcher-friendly.
// Based on multi-year averages from Baseball Savant / FanGraphs.
// Keyed by MLB venue ID. Run factor is the primary metric; HR factor is secondary.

type ParkFactor = { runs: number; hr: number; hits: number; name: string };

export const PARK_FACTORS: Record<number, ParkFactor> = {
  15: { runs: 114, hr: 117, hits: 106, name: "Coors Field" },
  22: { runs: 105, hr: 108, hits: 102, name: "Fenway Park" },
  1: { runs: 104, hr: 112, hits: 101, name: "Angel Stadium" },
  17: { runs: 103, hr: 108, hits: 101, name: "Wrigley Field" },
  2392: { runs: 102, hr: 109, hits: 100, name: "Yankee Stadium" },
  5: { runs: 102, hr: 104, hits: 102, name: "Chase Field" },
  32: { runs: 101, hr: 100, hits: 103, name: "Kauffman Stadium" },
  4: { runs: 101, hr: 103, hits: 101, name: "Truist Park" },
  3289: { runs: 100, hr: 96, hits: 101, name: "Target Field" },
  31: { runs: 100, hr: 102, hits: 99, name: "Rogers Centre" },
  12: { runs: 100, hr: 98, hits: 101, name: "Progressive Field" },
  19: { runs: 100, hr: 98, hits: 101, name: "Dodger Stadium" },
  7: { runs: 99, hr: 97, hits: 100, name: "Camden Yards" },
  680: { runs: 99, hr: 100, hits: 99, name: "Globe Life Field" },
  13: { runs: 99, hr: 96, hits: 101, name: "Comerica Park" },
  14: { runs: 98, hr: 95, hits: 100, name: "American Family Field" },
  3309: { runs: 98, hr: 97, hits: 99, name: "loanDepot park" },
  3312: { runs: 97, hr: 94, hits: 100, name: "Sutter Health Park" },
  10: { runs: 97, hr: 92, hits: 101, name: "Minute Maid Park" },
  2: { runs: 97, hr: 93, hits: 100, name: "Oriole Park" },
  2889: { runs: 96, hr: 98, hits: 96, name: "Citi Field" },
  2680: { runs: 96, hr: 99, hits: 96, name: "Petco Park" },
  2395: { runs: 96, hr: 94, hits: 98, name: "Nationals Park" },
  2681: { runs: 95, hr: 96, hits: 96, name: "Busch Stadium" },
  2602: { runs: 95, hr: 96, hits: 96, name: "Citizens Bank Park" },
  3313: { runs: 94, hr: 93, hits: 97, name: "Oracle Park" },
  2394: { runs: 94, hr: 92, hits: 96, name: "PNC Park" },
  2530: { runs: 93, hr: 91, hits: 97, name: "Guaranteed Rate Field" },
  2535: { runs: 92, hr: 89, hits: 96, name: "Tropicana Field" },
};

export function getParkFactor(venueId: number | undefined): ParkFactor {
  if (!venueId) return { runs: 100, hr: 100, hits: 100, name: "Unknown" };
  return PARK_FACTORS[venueId] ?? { runs: 100, hr: 100, hits: 100, name: "Unknown" };
}
