"use client";

import { usePathname, useRouter } from "next/navigation";

const items = [
  ["Studio", "/"],
  ["Create", "/"],
  ["Director", "/#director"],
  ["Projects", "/projects"],
  ["Editor", "/editor"],
  ["History", "/projects?view=history"],
  ["Explore", "/explore"],
  ["Profile", "/creator"],
  ["Settings", "/#settings"],
] as const;

export default function WorkspaceNav() {
  const router = useRouter();
  const pathname = usePathname();
  const go = (label: string, href: string) => {
    if (href === "/#director" || href === "/#settings") {
      router.push(href);
      return;
    }
    router.push(href);
  };

  return (
    <nav aria-label="KIRAVO workspace navigation">
      {items.map(([label, href]) => {
        const active = label === "Studio" || label === "Create" ? pathname === "/" : pathname.startsWith(href.split("?")[0]);
        return <button key={label} type="button" aria-current={active ? "page" : undefined} onClick={() => go(label, href)}>{label}</button>;
      })}
    </nav>
  );
}
