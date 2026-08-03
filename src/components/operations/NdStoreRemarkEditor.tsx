"use client";

import { useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import type { NdRemarkStatus } from "@/lib/operations/ndReport";
import { cn } from "@/lib/utils";

export function NdRemarkTextCell({
  value,
  placeholder,
  onSave,
}: {
  value: string | null;
  placeholder: string;
  onSave: (next: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setDraft(value ?? "");
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(value ?? "");
    setError(null);
    setEditing(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="min-w-[9rem] space-y-1">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder={placeholder}
          className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-xs"
        />
        {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
        <div className="flex gap-1">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-1.5 py-0.5 text-[10px] font-medium text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={cancel}
            className="inline-flex items-center rounded-md border border-[var(--card-border)] px-1.5 py-0.5 text-[10px]"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-[8rem] items-start gap-1">
      <span className={cn("min-w-0 flex-1 text-xs", !value && "text-[var(--muted)]")}>
        {value?.trim() || "—"}
      </span>
      <button
        type="button"
        onClick={startEdit}
        className="shrink-0 rounded p-0.5 text-[var(--muted)] hover:bg-[var(--table-header)] hover:text-[var(--foreground)]"
        aria-label={`Edit ${placeholder}`}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const STATUS_STYLES: Record<NdRemarkStatus, string> = {
  Open: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Pending: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  Closed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export function NdRemarkStatusCell({
  value,
  onSave,
}: {
  value: NdRemarkStatus;
  onSave: (next: NdRemarkStatus) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (next: NdRemarkStatus) => {
    if (next === value) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-[6rem]">
      <select
        value={value}
        disabled={saving}
        onChange={(e) => void handleChange(e.target.value as NdRemarkStatus)}
        className={cn(
          "w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-xs font-medium",
          STATUS_STYLES[value],
          saving && "opacity-50",
        )}
      >
        <option value="Open">Open</option>
        <option value="Pending">Pending</option>
        <option value="Closed">Closed</option>
      </select>
      {error ? <p className="mt-1 text-[10px] text-red-600">{error}</p> : null}
    </div>
  );
}
