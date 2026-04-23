import "./globals.css";
import type { Metadata } from "next";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Diamond Edge — MLB Analytical Picks",
  description: "Daily AI-driven MLB picks: NRFI, moneyline, and player props with full factor writeups.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="relative max-w-6xl mx-auto px-5 pt-10 pb-24">{children}</main>
        <footer className="max-w-6xl mx-auto px-5 py-10 text-xs text-ink-600 font-mono tracking-widest uppercase border-t border-ink-700">
          <div className="flex justify-between items-center gap-4">
            <span>© Diamond Edge · Picks auto-generated daily · Entertainment purposes only</span>
            <span className="hidden md:inline">Gamble responsibly · 1-800-GAMBLER</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
