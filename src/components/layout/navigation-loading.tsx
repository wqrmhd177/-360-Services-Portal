"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

type NavigationLoadingContextValue = {
  isNavigating: boolean;
  push: (href: string) => void;
  replace: (href: string) => void;
};

const NavigationLoadingContext =
  createContext<NavigationLoadingContextValue | null>(null);

export function NavigationLoadingProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const push = useCallback(
    (href: string) => {
      startTransition(() => {
        router.push(href);
      });
    },
    [router],
  );

  const replace = useCallback(
    (href: string) => {
      startTransition(() => {
        router.replace(href);
      });
    },
    [router],
  );

  const value = useMemo(
    () => ({ isNavigating: isPending, push, replace }),
    [isPending, push, replace],
  );

  return (
    <NavigationLoadingContext.Provider value={value}>
      {children}
    </NavigationLoadingContext.Provider>
  );
}

export function usePortalNavigation() {
  const ctx = useContext(NavigationLoadingContext);
  const router = useRouter();

  return useMemo(() => {
    if (ctx) return ctx;
    return {
      isNavigating: false,
      push: (href: string) => router.push(href),
      replace: (href: string) => router.replace(href),
    };
  }, [ctx, router]);
}
