"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const routes: Record<string, string> = {
  Projects: "/projects",
  Editor: "/editor",
  History: "/projects?view=history",
  Explore: "/explore",
};

export default function NavigationBridge() {
  const router = useRouter();

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button) return;
      const label = button.textContent?.trim() || "";
      const href = routes[label];
      if (!href) return;
      event.preventDefault();
      event.stopPropagation();
      router.push(href);
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [router]);

  return null;
}
