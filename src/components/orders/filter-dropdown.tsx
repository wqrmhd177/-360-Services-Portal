"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

function selectionLabel(
  label: string,
  selected: string[],
  options: FilterOption[],
): string {
  if (selected.length === 0) return label;
  if (selected.length === 1) {
    const match = options.find((o) => o.value === selected[0]);
    return match?.label ?? selected[0];
  }
  return `${label} (${selected.length})`;
}

type MenuPosition = { top: number; left: number; width: number };

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

function FilterMenuBody({
  listId,
  label,
  query,
  setQuery,
  filtered,
  scrollList,
  draftSet,
  toggle,
  selectAllVisible,
  clearDraft,
  handleApply,
}: {
  listId: string;
  label: string;
  query: string;
  setQuery: (q: string) => void;
  filtered: FilterOption[];
  scrollList: boolean;
  draftSet: Set<string>;
  toggle: (value: string) => void;
  selectAllVisible: () => void;
  clearDraft: () => void;
  handleApply: () => void;
}) {
  return (
    <>
      <div className="border-b border-[var(--card-border)] p-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${label.toLowerCase()}…`}
          className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--foreground)] focus:outline-none"
        />
      </div>

      <div className="flex items-center justify-between border-b border-[var(--card-border)] px-3 py-2">
        <span className="text-xs text-[var(--muted)]">
          {filtered.length} option{filtered.length === 1 ? "" : "s"}
        </span>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={selectAllVisible}
            className="text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            All
          </button>
          <button
            type="button"
            onClick={clearDraft}
            className="text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Clear
          </button>
        </div>
      </div>

      <ul
        id={listId}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto py-1",
          scrollList && "max-h-56",
        )}
        role="listbox"
        aria-multiselectable
      >
        {filtered.length === 0 ? (
          <li className="px-4 py-3 text-sm text-[var(--muted)]">No results</li>
        ) : (
          filtered.map((option) => {
            const checked = draftSet.has(option.value);
            return (
              <li key={option.value} className="min-w-0">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-[var(--foreground)] hover:bg-[var(--table-row-hover)]">
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                      checked
                        ? "border-[var(--foreground)] bg-[var(--foreground)]"
                        : "border-[var(--card-border)] bg-[var(--input-bg)]",
                    )}
                  >
                    {checked ? (
                      <svg
                        viewBox="0 0 12 12"
                        className="h-2.5 w-2.5 text-white"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    ) : null}
                  </span>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggle(option.value)}
                  />
                  <span
                    className="min-w-0 flex-1 truncate"
                    title={option.label}
                  >
                    {option.label}
                  </span>
                </label>
              </li>
            );
          })
        )}
      </ul>

      <div className="shrink-0 border-t border-[var(--card-border)] p-3">
        <button
          type="button"
          onClick={handleApply}
          className="w-full rounded-xl bg-[var(--foreground)] py-3 text-sm font-semibold text-[var(--background)] transition-colors hover:opacity-90"
        >
          Apply
        </button>
      </div>
    </>
  );
}

export function FilterDropdown({
  label,
  options,
  selected,
  onApply,
  onDraftChange,
  onOpenChange,
  disabled,
  className,
  compactOnMobile = false,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onApply: (values: string[]) => void;
  onDraftChange?: (values: string[]) => void;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  className?: string;
  /** On mobile: text chip + bottom sheet instead of full-width dropdown button. */
  compactOnMobile?: boolean;
}) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<string[]>(selected);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [mounted, setMounted] = useState(false);
  const isLgUp = useIsLgUp();
  const useSheet = compactOnMobile && !isLgUp;

  useEffect(() => setMounted(true), []);

  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;

  useEffect(() => {
    if (!open) setDraft(selected);
  }, [open, selected]);

  useEffect(() => {
    if (!open) return;
    onDraftChangeRef.current?.(draft);
  }, [open, draft]);

  useEffect(() => {
    if (!open || !useSheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, useSheet]);

  function setOpenState(next: boolean) {
    if (next) {
      setDraft([...selected]);
    }
    setOpen(next);
    onOpenChange?.(next);
    if (!next) setQuery("");
  }

  useLayoutEffect(() => {
    if (!open || useSheet || !containerRef.current) {
      setMenuPosition(null);
      return;
    }

    function updatePosition() {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 280), 320);
      let left = rect.left;
      if (left + width > window.innerWidth - 8) {
        left = window.innerWidth - width - 8;
      }
      setMenuPosition({
        top: rect.bottom + 8,
        left: Math.max(8, left),
        width,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, useSheet]);

  useEffect(() => {
    if (!open || useSheet) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        document.getElementById(`menu-${listId}`)?.contains(target)
      ) {
        return;
      }
      setOpenState(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, useSheet, listId]);

  const draftSet = new Set(draft);
  const normalizedOptions = options.filter(
    (o) => o.label.trim().length > 0 && o.value.length > 0,
  );
  const filtered = normalizedOptions.filter((o) =>
    o.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const scrollList = filtered.length > 7;

  function toggle(value: string) {
    setDraft((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(value)) nextSet.delete(value);
      else nextSet.add(value);
      return [...nextSet];
    });
  }

  function selectAllVisible() {
    setDraft(filtered.map((o) => o.value));
  }

  function clearDraft() {
    setDraft([]);
  }

  function handleApply() {
    onApply(draft);
    setOpenState(false);
  }

  const buttonText = selectionLabel(label, selected, normalizedOptions);
  const hasSelection = selected.length > 0;
  const menuId = `menu-${listId}`;

  const menuBodyProps = {
    listId,
    label,
    query,
    setQuery,
    filtered,
    scrollList: useSheet ? true : scrollList,
    draftSet,
    toggle,
    selectAllVisible,
    clearDraft,
    handleApply,
  };

  const desktopMenu =
    open && menuPosition && mounted && !useSheet ? (
      <div
        id={menuId}
        role="dialog"
        aria-label={`${label} filter`}
        style={{
          position: "fixed",
          top: menuPosition.top,
          left: menuPosition.left,
          width: menuPosition.width,
          zIndex: 9999,
        }}
        className="flex max-h-[min(24rem,70vh)] flex-col overflow-hidden rounded-2xl border border-[var(--popover-border)] bg-[var(--popover-bg)] shadow-xl"
      >
        <FilterMenuBody {...menuBodyProps} />
      </div>
    ) : null;

  const sheetMenu =
    open && mounted && useSheet ? (
      <>
        <button
          type="button"
          aria-label="Close filter"
          className="fixed inset-0 z-[100] bg-black/50"
          onClick={() => setOpenState(false)}
        />
        <div
          role="dialog"
          aria-modal
          aria-labelledby={`${listId}-sheet-title`}
          className="fixed inset-x-0 bottom-0 z-[101] flex max-h-[min(85dvh,560px)] flex-col rounded-t-2xl border-t border-[var(--popover-border)] bg-[var(--popover-bg)] shadow-2xl"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--card-border)] px-4 py-3">
            <h2
              id={`${listId}-sheet-title`}
              className="text-base font-semibold text-[var(--foreground)]"
            >
              {label}
            </h2>
            <button
              type="button"
              onClick={() => setOpenState(false)}
              aria-label="Close"
              className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--table-row-hover)] hover:text-[var(--foreground)]"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
          <FilterMenuBody {...menuBodyProps} />
        </div>
      </>
    ) : null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {useSheet ? (
        <button
          type="button"
          onClick={() => !disabled && setOpenState(!open)}
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1.5 text-sm font-medium transition-colors",
            hasSelection
              ? "text-teal-600 dark:text-teal-400"
              : "text-[var(--foreground)]",
            open && "text-teal-600 dark:text-teal-400",
            disabled && "cursor-not-allowed opacity-50",
          )}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <span>{label}</span>
          {hasSelection ? (
            <span className="rounded-full bg-teal-600/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
              {selected.length}
            </span>
          ) : null}
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
          onClick={() => !disabled && setOpenState(!open)}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-xl border bg-[var(--input-bg)] px-2.5 text-sm transition-colors",
            "lg:inline-flex lg:h-8 lg:max-w-[10.5rem] lg:min-w-[6.25rem] lg:rounded-full lg:px-3 lg:py-1.5 lg:text-xs",
            open || hasSelection
              ? "border-[var(--foreground)]"
              : "border-[var(--input-border)] hover:border-[var(--muted)]",
            disabled && "cursor-not-allowed opacity-50",
          )}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listId}
        >
          <span className="truncate font-medium text-[var(--foreground)]">
            {buttonText}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-[var(--muted)] transition-transform lg:h-3.5 lg:w-3.5",
              open && "rotate-180",
            )}
          />
        </button>
      )}

      {mounted && !useSheet && desktopMenu
        ? createPortal(desktopMenu, document.body)
        : null}
      {mounted && useSheet && sheetMenu ? createPortal(sheetMenu, document.body) : null}
    </div>
  );
}
