type Tile = {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "red" | "good" | "default";
};

export default function StatTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {tiles.map((t, i) => (
        <div key={i} className="stat-tile">
          <div className="stat-tile-label">{t.label}</div>
          <div
            className={`stat-tile-value ${
              t.accent === "red" ? "text-red-400" : t.accent === "good" ? "text-good-400" : ""
            }`}
          >
            {t.value}
          </div>
          {t.sub && <div className="stat-tile-sub">{t.sub}</div>}
        </div>
      ))}
    </div>
  );
}
