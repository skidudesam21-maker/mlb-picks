import { formatPickDate } from "@/lib/pageHelpers";
import { PickRow } from "@/lib/db";

function playOfTheDay(picks: PickRow[]): PickRow | null {
  if (!picks?.length) return null;
  // Highest confidence pick across today's slate
  return [...picks].sort((a, b) => b.confidence - a.confidence)[0];
}

export default function StatTiles({
  date,
  gameCount,
  picks,
}: {
  date: any;
  gameCount: number;
  picks: PickRow[];
}) {
  const potd = playOfTheDay(picks);
  const totalPicks = picks.length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="stat-tile">
        <div className="stat-tile-label">Today</div>
        <div className="stat-tile-value text-red-400">
          {formatPickDate(date) || "—"}
        </div>
      </div>

      <div className="stat-tile">
        <div className="stat-tile-label">Games</div>
        <div className="stat-tile-value">{gameCount || "—"}</div>
      </div>

      <div className="stat-tile">
        <div className="stat-tile-label">Plays</div>
        <div className="stat-tile-value text-red-400">{totalPicks}</div>
        <div className="stat-tile-sub">
          {totalPicks ? `Best: ${potd?.grade ?? "—"} ${potd?.category?.toUpperCase() ?? ""}` : "No picks yet"}
        </div>
      </div>

      <div className="stat-tile">
        <div className="stat-tile-label">Play of the Day</div>
        <div className="stat-tile-value text-red-400 text-base">
          {potd ? truncateLabel(potd.pick_label) : "—"}
        </div>
        <div className="stat-tile-sub">
          {potd ? `${potd.category?.toUpperCase()} · conf ${potd.confidence}` : " "}
        </div>
      </div>
    </div>
  );
}

function truncateLabel(s: string): string {
  if (!s) return "—";
  if (s.length < 28) return s;
  return s.slice(0, 26) + "…";
}
