"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { Calendar, ChevronDown, X } from "lucide-react";
import { endOfDay, format, parseISO, startOfDay } from "date-fns";
import {
  QUICK_SELECT_PRESETS,
  defaultDateRange,
  findMatchingPresetId,
  formatCompactRangeLabel,
  formatRangeLabel,
  parseRangeFromSearchParams,
  toInputValue,
  type DateRangeValue,
} from "@/lib/date-range-presets";
import { usePortalNavigation } from "@/components/layout/navigation-loading";
import { isOrdersOverviewPath, toDateOnlySearchParams } from "@/lib/orders/params";
import { cn } from "@/lib/utils";

function useIsLgUp() {
  const [isLgUp, setIsLgUp] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLgUp(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isLgUp;
}

function DateRangePanel({
  draft,
  activePreset,
  selectPreset,
  updateDraftFromInput,
  handleCancel,
  handleApply,
}: {
  draft: DateRangeValue;
  activePreset: string | null;
  selectPreset: (presetId: string) => void;
  updateDraftFromInput: (field: "from" | "to", value: string) => void;
  handleCancel: () => void;
  handleApply: () => void;
}) {
  return (
    <>
      <p className="mb-3 text-sm font-medium text-[var(--foreground)]">Quick select</p>
      <div className="flex flex-wrap gap-2">
        {QUICK_SELECT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => selectPreset(preset.id)}
            className={cn(
              "min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              activePreset === preset.id
                ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                : "border-[var(--card-border)] bg-[var(--table-header)] text-[var(--foreground)] hover:border-[var(--muted)] hover:bg-[var(--table-row-hover)]",
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3 border-t border-[var(--card-border)] pt-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--muted)]">
            Start date
          </span>
          <div className="relative">
            <input
              type="date"
              value={toInputValue(draft.from)}
              onChange={(e) => updateDraftFromInput("from", e.target.value)}
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] py-2.5 pl-3 pr-10 text-sm text-[var(--foreground)]"
            />
            <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--muted)]">
            End date
          </span>
          <div className="relative">
            <input
              type="date"
              value={toInputValue(draft.to)}
              onChange={(e) => updateDraftFromInput("to", e.target.value)}
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] py-2.5 pl-3 pr-10 text-sm text-[var(--foreground)]"
            />
            <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          </div>
        </label>
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-[var(--card-border)] pt-4">
        <button
          type="button"
          onClick={handleCancel}
          className="min-h-11 rounded-lg px-4 py-2 text-sm font-medium text-[var(--muted)] hover:bg-[var(--table-row-hover)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="min-h-11 rounded-xl bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-[var(--background)] hover:opacity-90"
        >
          Apply
        </button>
      </div>
    </>
  );
}

export function DateRangePicker({
  className,
  layout = "inline",
  compactOnMobile = false,
}: {
  className?: string;
  layout?: "inline" | "stacked" | "compact";
  compactOnMobile?: boolean;
}) {
  const { push: navigate } = usePortalNavigation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetTitleId = useId();
  const [mounted, setMounted] = useState(false);
  const isLgUp = useIsLgUp();
  const useSheet = compactOnMobile && !isLgUp;

  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const applied = useMemo(
    () => parseRangeFromSearchParams(fromParam, toParam, defaultDateRange()),
    [fromParam, toParam],
  );

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRangeValue>(applied);
  const [activePreset, setActivePreset] = useState<string | null>(
    findMatchingPresetId(applied),
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const next = parseRangeFromSearchParams(fromParam, toParam, defaultDateRange());
    setDraft(next);
    setActivePreset(findMatchingPresetId(next));
  }, [fromParam, toParam]);

  useEffect(() => {
    if (!open || !useSheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, useSheet]);

  useEffect(() => {
    if (!open || useSheet) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setDraft(applied);
      setActivePreset(findMatchingPresetId(applied));
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, useSheet, applied]);

  function applyRange(range: DateRangeValue, presetId: string | null) {
    const params = isOrdersOverviewPath(pathname)
      ? toDateOnlySearchParams(searchParams)
      : new URLSearchParams(searchParams.toString());
    params.set("from", format(range.from, "yyyy-MM-dd"));
    params.set("to", format(range.to, "yyyy-MM-dd"));
    if (presetId) params.set("range", presetId);
    else params.delete("range");
    const query = params.toString();
    navigate(query ? `${pathname}?${query}` : pathname);
    setOpen(false);
  }

  function handleApply() {
    let from = draft.from;
    let to = draft.to;
    if (from > to) [from, to] = [to, from];
    applyRange({ from, to }, findMatchingPresetId({ from, to }));
  }

  function handleCancel() {
    setDraft(applied);
    setActivePreset(findMatchingPresetId(applied));
    setOpen(false);
  }

  function selectPreset(presetId: string) {
    const preset = QUICK_SELECT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setDraft(preset.getRange());
    setActivePreset(presetId);
  }

  function updateDraftFromInput(field: "from" | "to", value: string) {
    if (!value) return;
    try {
      const parsed = parseISO(value);
      setDraft((prev) => ({
        ...prev,
        [field]: field === "from" ? startOfDay(parsed) : endOfDay(parsed),
      }));
      setActivePreset(null);
    } catch {
      /* ignore invalid */
    }
  }

  const displayLabel = formatRangeLabel(applied.from, applied.to);
  const compactLabel = formatCompactRangeLabel(applied.from, applied.to);

  const panelProps = {
    draft,
    activePreset,
    selectPreset,
    updateDraftFromInput,
    handleCancel,
    handleApply,
  };

  const desktopPopover = open && !useSheet && (
    <div
      className={cn(
        "absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-[var(--popover-border)] bg-[var(--popover-bg)] p-4 shadow-xl",
        layout === "inline" && "lg:right-0",
      )}
    >
      <DateRangePanel {...panelProps} />
    </div>
  );

  const sheet =
    open && mounted && useSheet ? (
      <>
        <button
          type="button"
          aria-label="Close date range"
          className="fixed inset-0 z-[100] bg-black/50"
          onClick={handleCancel}
        />
        <div
          role="dialog"
          aria-modal
          aria-labelledby={sheetTitleId}
          className="fixed inset-x-0 bottom-0 z-[101] flex max-h-[min(85dvh,560px)] flex-col overflow-hidden rounded-t-2xl border-t border-[var(--popover-border)] bg-[var(--popover-bg)] shadow-2xl"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--card-border)] px-4 py-3">
            <h2
              id={sheetTitleId}
              className="text-base font-semibold text-[var(--foreground)]"
            >
              Date range
            </h2>
            <button
              type="button"
              onClick={handleCancel}
              aria-label="Close"
              className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--table-row-hover)] hover:text-[var(--foreground)]"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <DateRangePanel {...panelProps} />
          </div>
        </div>
      </>
    ) : null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {useSheet ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 text-sm font-medium transition-colors text-teal-600",
            open && "opacity-80",
          )}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <Calendar className="h-3.5 w-3.5 shrink-0 opacity-80" />
          <span className="tabular-nums">{compactLabel}</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 opacity-60 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex w-full min-w-0 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--foreground)] transition-colors hover:border-[var(--muted)]",
            layout === "compact" &&
              "h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm shadow-sm",
            layout === "stacked" &&
              "min-h-[3.25rem] flex-col gap-1 rounded-xl px-3 py-2.5 text-left shadow-sm",
            layout === "inline" &&
              "items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm shadow-sm lg:h-8 lg:min-w-[11.5rem] lg:max-w-[13.5rem] lg:px-2.5 lg:py-1.5 lg:text-xs",
            open && "border-[var(--foreground)] ring-1 ring-[var(--card-border)]",
          )}
        >
          {layout === "stacked" ? (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Date range
            </span>
          ) : null}
          <span
            className={cn(
              "flex min-w-0 items-center gap-1.5",
              layout === "stacked" && "w-full justify-between",
              (layout === "inline" || layout === "compact") && "w-full",
            )}
          >
            <Calendar
              className={cn(
                "shrink-0 text-[var(--muted)]",
                layout === "compact" ? "h-3.5 w-3.5" : "h-4 w-4 lg:h-3.5 lg:w-3.5",
              )}
            />
            <span className="min-w-0 flex-1 truncate text-left font-medium">
              {layout === "inline" ? displayLabel : compactLabel}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-[var(--muted)] transition-transform lg:h-3.5 lg:w-3.5",
                open && "rotate-180",
              )}
            />
          </span>
        </button>
      )}

      {!useSheet && open ? desktopPopover : null}
      {mounted && useSheet && sheet ? createPortal(sheet, document.body) : null}
    </div>
  );
}
