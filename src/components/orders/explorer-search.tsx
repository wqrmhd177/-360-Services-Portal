"use client";

import { usePathname } from "next/navigation";
import { useExplorerSearch } from "@/components/orders/explorer-search-context";
import { cn } from "@/lib/utils";

const EXPLORER_PATH = "/orders/explorer";

export function ExplorerSearch({ className }: { className?: string }) {
  const pathname = usePathname();
  const { search, setSearch } = useExplorerSearch();

  if (pathname !== EXPLORER_PATH) return null;

  return (
    <input
      type="search"
      placeholder="Search order #, SKU, name…"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      aria-label="Search orders"
      className={cn(
        "h-8 w-[11rem] shrink-0 rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-2.5 text-sm sm:w-[13rem]",
        className,
      )}
    />
  );
}
