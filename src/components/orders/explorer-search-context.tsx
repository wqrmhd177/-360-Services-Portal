"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ExplorerSearchContextValue = {
  search: string;
  setSearch: (value: string) => void;
};

const ExplorerSearchContext = createContext<ExplorerSearchContextValue | null>(
  null,
);

export function ExplorerSearchProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState("");

  const value = useMemo(
    () => ({ search, setSearch }),
    [search],
  );

  return (
    <ExplorerSearchContext.Provider value={value}>
      {children}
    </ExplorerSearchContext.Provider>
  );
}

export function useExplorerSearch() {
  const ctx = useContext(ExplorerSearchContext);
  if (!ctx) {
    return { search: "", setSearch: () => {} };
  }
  return ctx;
}
