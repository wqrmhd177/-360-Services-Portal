"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function InfoTooltip({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={ref} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={popoverId}
        aria-label={title ?? "More information"}
        onClick={() => setOpen((v) => !v)}
        className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--table-row-hover)] hover:text-[var(--muted)]"
      >
        <Info className="h-4 w-4" strokeWidth={2} />
      </button>
      {open ? (
        <div
          id={popoverId}
          role="dialog"
          className="absolute right-0 top-8 z-50 w-[min(100vw-2rem,26rem)] rounded-lg border border-[var(--card-border)] bg-[var(--card)] p-4 text-left text-sm leading-relaxed shadow-lg"
        >
          {title ? (
            <p className="font-semibold text-[var(--foreground)]">{title}</p>
          ) : null}
          <div className={cn("leading-relaxed text-[var(--muted)]", title && "mt-2")}>
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}
