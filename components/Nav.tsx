"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/nrfi", label: "NRFI" },
  { href: "/moneyline", label: "Moneyline" },
  { href: "/props", label: "Props" },
  { href: "/tracking", label: "Tracking" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="relative border-b border-ink-700">
      <div className="max-w-6xl mx-auto px-5 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <span className="relative w-8 h-8 rounded-sm border border-gold-500 flex items-center justify-center font-display text-gold-400 text-xl">
            ◆
            <span className="absolute -inset-0.5 rounded-sm border border-gold-500/20 group-hover:border-gold-500/60 transition"></span>
          </span>
          <div className="flex flex-col leading-none">
            <span className="font-display text-xl text-gold-400 tracking-[0.22em]">DIAMOND EDGE</span>
            <span className="font-mono text-[10px] text-ink-600 tracking-[0.35em] uppercase mt-0.5">MLB · Analytics</span>
          </div>
        </Link>
        <nav className="flex items-center gap-7">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="nav-link"
              data-active={pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href))}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="hero-rule" />
    </header>
  );
}
