export const METABASE_CHANNEL_LIST_URL =
  "https://zambeel.metabaseapp.com/public/question/4a368bc7-82ae-417d-b182-cfe3e3df7490.json";

export interface ChannelListRow {
  store_id: number;
  user_id: number;
  store_name: string;
  store_url: string;
  bifurcation: string;
  platform: string;
  confirmation_setting: string;
}

export function normalizeChannelListRows(raw: unknown): ChannelListRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      return {
        store_id: Number(r.store_id ?? 0),
        user_id: Number(r.user_id ?? 0),
        store_name: String(r.store_name ?? ""),
        store_url: String(r.store_url ?? ""),
        bifurcation: String(r.bifurcation ?? ""),
        platform: String(r.platform ?? ""),
        confirmation_setting: String(r.confirmation_setting ?? ""),
      };
    })
    .filter((row): row is ChannelListRow => row != null);
}

export function matchesChannelSearch(row: ChannelListRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    row.store_name.toLowerCase().includes(q) ||
    row.store_url.toLowerCase().includes(q) ||
    String(row.store_id).includes(q) ||
    String(row.user_id).includes(q)
  );
}
