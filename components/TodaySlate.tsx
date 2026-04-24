import { getTodayGames } from "@/lib/db";

export default async function TodaySlate() {
  let games: any[] = [];
  try {
    games = await getTodayGames();
  } catch (e) {
    console.error("getTodayGames failed", e);
  }

  return (
    <aside className="card p-5 sticky top-6">
      <div className="section-label">Today's Slate</div>
      {games.length === 0 ? (
        <p className="text-sm text-bg-400 mt-2">
          No games loaded yet. Run the cron to populate.
        </p>
      ) : (
        <>
          <div className="font-mono text-[11px] text-bg-500 tracking-[0.2em] uppercase mb-3">
            {games.length} games
          </div>
          <ul className="space-y-0">
            {games.map((g, i) => (
              <li
                key={g.game_pk}
                className={`py-3 ${i < games.length - 1 ? "border-b border-bg-700/40" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm text-paper-100">
                    {g.away_team}{" "}
                    <span className="text-bg-500">@</span>{" "}
                    {g.home_team}
                  </span>
                </div>
                {(g.away_pitcher || g.home_pitcher) && (
                  <div className="mt-1.5 space-y-0.5">
                    {g.away_pitcher && (
                      <div className="font-mono text-[11px] text-bg-400 truncate">
                        <span className="text-bg-500">{g.away_team}</span> · {g.away_pitcher}
                      </div>
                    )}
                    {g.home_pitcher && (
                      <div className="font-mono text-[11px] text-bg-400 truncate">
                        <span className="text-bg-500">{g.home_team}</span> · {g.home_pitcher}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
