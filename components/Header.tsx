export default function Header() {
  return (
    <header className="border-b border-bg-700/60">
      <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col items-center text-center">
        <h1 className="font-mono text-3xl md:text-4xl font-bold tracking-[0.08em] text-paper-100">
          SKOGSPICKS
        </h1>
        <p className="mt-2 font-sans text-sm text-bg-400">
          MLB Analytics · NRFI, Moneyline, and Player Props
        </p>
        <div className="mt-3 font-mono text-[11px] tracking-[0.3em] uppercase text-bg-500">
          Cross-validated · Real odds · Fully tracked
        </div>
      </div>
    </header>
  );
}
