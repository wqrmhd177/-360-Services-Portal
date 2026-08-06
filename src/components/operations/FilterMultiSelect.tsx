"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function FilterMultiSelect({
  label,
  options,
  selected,
  onChange,
  disabled,
  allLabel = "All",
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const summary = useMemo(() => {
    if (selected.length === 0) return allLabel;
    if (selected.length === 1) return selected[0];
    return `${selected.length} selected`;
  }, [allLabel, selected]);

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
      return;
    }
    onChange([...selected, value]);
  }

  return (
    <div ref={rootRef} className="relative block min-w-0">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--foreground)] shadow-sm",
          "transition-colors hover:border-[var(--muted)] focus:border-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--card-border)]",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        <span className="truncate text-left">{summary}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted)]" />
      </button>

      {open ? (
        <div className="absolute left-0 z-50 mt-1 max-h-56 w-full min-w-[12rem] overflow-auto rounded-xl border border-[var(--card-border)] bg-[var(--card)] py-1 shadow-lg">
          <button
            type="button"
            onClick={() => onChange([])}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--table-header)]"
          >
            <span className="font-medium">{allLabel}</span>
          </button>
          {options.map((option) => {
            const checked = selected.includes(option);
            return (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--table-header)]"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(option)}
                  className="h-4 w-4 rounded border-[var(--input-border)]"
                />
                <span className="truncate">{option}</span>
              </label>
            );
          })}
        </div>
      ) : null}

      {selected.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {selected.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-0.5 rounded-full bg-[var(--table-header)] px-2 py-0.5 text-[10px] text-[var(--foreground)]"
            >
              {value}
              <button
                type="button"
                aria-label={`Remove ${value}`}
                onClick={() => toggle(value)}
                className="rounded p-0.5 hover:bg-[var(--card-border)]"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
