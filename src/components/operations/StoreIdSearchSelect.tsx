"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type StoreOption = {
  id: number;
  label: string;
};

export function StoreIdSearchSelect({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: StoreOption[];
  disabled?: boolean;
  onChange: (storeId: string) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        String(opt.id).includes(q) || opt.label.toLowerCase().includes(q),
    );
  }, [options, query]);

  const selected = options.find((opt) => String(opt.id) === value);

  const displayLabel = value
    ? (selected?.label ?? `Store ${value}`)
    : "All stores";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const selectStore = (storeId: string) => {
    onChange(storeId);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className="relative block min-w-0">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        Store ID
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "flex h-10 w-full min-w-0 items-center gap-2 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-left text-sm text-[var(--foreground)] shadow-sm",
          "transition-colors hover:border-[var(--muted)] focus:border-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--card-border)]",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{displayLabel}</span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear store filter"
            onClick={(event) => {
              event.stopPropagation();
              selectStore("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                selectStore("");
              }
            }}
            className="shrink-0 rounded p-0.5 text-[var(--muted)] hover:bg-[var(--table-header)] hover:text-[var(--foreground)]"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--muted)] transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="listbox"
          id={listId}
          className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card)] shadow-lg"
        >
          <div className="border-b border-[var(--card-border)] p-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search store ID or URL…"
              autoFocus
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!value}
                onClick={() => selectStore("")}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-[var(--table-header)]",
                  !value && "bg-[var(--table-header)] font-medium",
                )}
              >
                All stores
              </button>
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-[var(--muted)]">
                No stores match your search.
              </li>
            ) : (
              filtered.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === String(opt.id)}
                    onClick={() => selectStore(String(opt.id))}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm hover:bg-[var(--table-header)]",
                      value === String(opt.id) &&
                        "bg-[var(--table-header)] font-medium",
                    )}
                  >
                    {opt.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
