const STORAGE_PREFIX = "chart-panel:v2:";
const LEGACY_PREFIX = "chart-panel:";
const MIGRATION_FLAG = "chart-panel:migrated-v2";

export function chartPanelStorageId(key: string) {
  return `${STORAGE_PREFIX}${key}`;
}

export function readChartPanelOpen(
  storageKey: string | undefined,
  defaultOpen: boolean,
): boolean {
  if (!storageKey || typeof window === "undefined") return defaultOpen;
  try {
    const stored = localStorage.getItem(chartPanelStorageId(storageKey));
    if (stored === "0") return false;
    if (stored === "1") return true;
  } catch {
    /* ignore */
  }
  return defaultOpen;
}

export function persistChartPanelOpen(
  storageKey: string | undefined,
  open: boolean,
) {
  if (!storageKey || typeof window === "undefined") return;
  try {
    localStorage.setItem(chartPanelStorageId(storageKey), open ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** One-time cleanup of pre-v2 keys that caused cross-page bleed. */
export function migrateLegacyChartPanelStorage() {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(MIGRATION_FLAG) === "1") return;
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(LEGACY_PREFIX) && !key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
    localStorage.setItem(MIGRATION_FLAG, "1");
  } catch {
    /* ignore */
  }
}
