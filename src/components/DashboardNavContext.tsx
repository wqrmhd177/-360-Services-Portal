"use client";

import { Menu, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type DashboardNavContextValue = {
  mobileNavOpen: boolean;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  toggleMobileNav: () => void;
};

const DashboardNavContext = createContext<DashboardNavContextValue | null>(null);

export function DashboardNavProvider({
  children,
  mobileNavOpen,
  setMobileNavOpen,
}: {
  children: ReactNode;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
}) {
  const openMobileNav = useCallback(() => setMobileNavOpen(true), [setMobileNavOpen]);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), [setMobileNavOpen]);
  const toggleMobileNav = useCallback(
    () => setMobileNavOpen((v) => !v),
    [setMobileNavOpen],
  );

  const value = useMemo(
    () => ({
      mobileNavOpen,
      openMobileNav,
      closeMobileNav,
      toggleMobileNav,
    }),
    [mobileNavOpen, openMobileNav, closeMobileNav, toggleMobileNav],
  );

  return (
    <DashboardNavContext.Provider value={value}>{children}</DashboardNavContext.Provider>
  );
}

export function useDashboardNav(): DashboardNavContextValue {
  const ctx = useContext(DashboardNavContext);
  if (!ctx) {
    throw new Error("useDashboardNav must be used within DashboardNavProvider");
  }
  return ctx;
}

/** Opens the sidebar drawer on viewports below `lg`. Hidden on laptop/desktop. */
export function MobileNavMenuButton({ className }: { className?: string }) {
  const { toggleMobileNav, mobileNavOpen } = useDashboardNav();

  return (
    <button
      type="button"
      onClick={toggleMobileNav}
      className={cn(
        "rounded-xl border border-gray-300 bg-white p-2 text-gray-700 transition-colors hover:bg-gray-50 lg:hidden",
        className,
      )}
      aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
      aria-expanded={mobileNavOpen}
    >
      {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </button>
  );
}
