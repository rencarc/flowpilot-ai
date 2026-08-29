"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SidebarNav({ links }: { links: Array<[string, string]> }) {
  const pathname = usePathname();

  return (
    <nav className="nav">
      {links.map(([href, label]) => {
        const active = href === "/cases" ? pathname.startsWith("/cases") : pathname === href;
        return <Link className={active ? "active" : ""} key={href} href={href}><span className="nav-dot" />{label}</Link>;
      })}
    </nav>
  );
}
