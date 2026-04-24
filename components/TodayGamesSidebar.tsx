import { getTodayGames, TodayGame } from "@/lib/db";
import { formatPickDate } from "@/lib/pageHelpers";

export default async function TodayGamesSidebar() {
  let games: TodayGame[] = [];
  try {
    games = await getTodayGames();
  } catch (e) {
    console.error("[sidebar] getTodayGames failed", e);
  }

  const date = games[0]?.date;

  return (
    <aside className="card overflow-hidden sticky top-6">
      <div className="px-5 py-4 border-b border-bg-700/60">
        <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-red-400">
          Today's Games
        </div>
        {date && (
          <div className="font-mono text-xs text-bg-400 mt-1">
            {formatPickDate(date)}
          </div>
        )}
      </div>

      {games.length === 0 ? (
        <div className="p-5 text-sm text-bg-400">
          No games loaded yet.
        </div>
      ) : (
        <ul className="divide-y divide-bg-700/40">
          {games.map((g) => (
            <li key={g.game_pk} className="px-5 py-3.5 hover:bg-bg-800/40 transition">
              <div className="flex items-center justify-between gap-2">
                <span className="font-sans text-sm text-paper-100 font-semibold">
                  {g.away_team}
                </span>
                <span className="font-mono text-[11px] text-bg-500">@</span>
                <span className="font-sans text-sm text-paper-100 font-semibold">
                  {g.home_team}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-1.5">
                <span className="font-mono text-[11px] text-bg-400 truncate max-w-[45%]">
                  {g.away_pitcher || "TBD"}
                </span>
                <span className="font-mono text-[10px] text-bg-600">vs</span>
                <span className="font-mono text-[11px] text-bg-400 truncate max-w-[45%] text-right">
                  {g.home_pitcher || "TBD"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="px-5 py-3 border-t border-bg-700/60 font-mono text-[10px] tracking-[0.2em] uppercase text-bg-500">
        {games.length} {games.length === 1 ? "game" : "games"}
      </div>
    </aside>
  );
}
