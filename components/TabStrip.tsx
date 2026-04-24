"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "NRFI" },
  { href: "/moneyline", label: "Moneyline" },
  { href: "/matchups", label: "Matchups" },
  { href: "/system", label: "System" },
];

export default function TabStrip() {
  const pathname = usePathname();
  return (
    <div className="tabstrip">
      {TABS.map((t) => {
        const active = pathname === t.href || (t.href !== "/" && pathname.startsWith(t.href));
        return (
          <Link
            key={t.href}
            href={t.href}
            className="tab"
            data-active={active}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
