import "./globals.css";
import type { Metadata } from "next";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Skogspicks — MLB Analytics",
  description: "Daily MLB analytical picks: NRFI, moneyline, and player props, with full factor breakdowns and pick tracking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-1 max-w-6xl w-full mx-auto px-5 pt-8 pb-24">
            {children}
          </main>
          <footer className="border-t border-bg-700/60 mt-auto">
            <div className="max-w-6xl mx-auto px-5 py-8 font-mono text-[11px] tracking-[0.2em] uppercase text-bg-500 flex flex-wrap items-center justify-between gap-4">
              <span>© Skogspicks · picks auto-generated daily</span>
              <span>entertainment only · 1-800-GAMBLER</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
