import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_SIZES = {
  sm: "h-5 w-5",
  md: "h-8 w-8",
  lg: "h-10 w-10",
} as const;

export function PortalLoading({
  label = "Loading",
  className,
  size = "md",
  showLabel = true,
}: {
  label?: string;
  className?: string;
  size?: keyof typeof ICON_SIZES;
  showLabel?: boolean;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-[var(--muted)]",
        className
      )}
    >
      <Loader2
        className={cn(ICON_SIZES[size], "animate-spin text-teal-600")}
        strokeWidth={2.25}
      />
      {showLabel ? (
        <p className="text-sm font-medium tracking-wide text-[var(--muted)]">
          {label}
        </p>
      ) : null}
    </div>
  );
}

export function PortalDialogLoading({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <PortalLoading
      label={label}
      className={cn("min-h-[14rem] w-full px-5 py-12", className)}
    />
  );
}

export function PortalPageLoading({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <PortalLoading
      label={label}
      className={cn("min-h-[40vh] w-full py-16", className)}
    />
  );
}

export function PortalInlineLoading({
  label = "Loading",
  className,
  showLabel = true,
}: {
  label?: string;
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <PortalLoading
      label={label}
      size="sm"
      showLabel={showLabel}
      className={cn("flex-row gap-2 py-1", className)}
    />
  );
}
