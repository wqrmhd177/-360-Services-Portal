import { getOpsServiceDb, logSync } from "@/lib/operations/opsDb";
import {
  factsFromTicketingCsv,
  ticketingCsvUrl,
  type TicketFactRow,
} from "@/lib/operations/ticketSheet";

const BATCH = 500;

export type TicketSyncResult = {
  ok: boolean;
  rowCount: number;
  error?: string;
};

async function fetchRawCsv(): Promise<string> {
  const res = await fetch(ticketingCsvUrl(), {
    cache: "no-store",
    headers: { "User-Agent": "360-portal-ticketing-sync/1.0" },
  });
  const text = await res.text();
  if (!res.ok || text.trimStart().startsWith("<!")) {
    throw new Error(
      "Ticketing Raw Data is not readable from the backend. Share the sheet with the sync service account.",
    );
  }
  return text;
}

function toInsertRow(row: TicketFactRow, syncedAt: string) {
  return {
    ticket_id: row.ticket_id,
    ticket_date: row.ticket_date,
    direction: row.direction,
    category: row.category,
    sub_category: row.sub_category,
    status: row.status,
    first_reply_minutes: row.first_reply_minutes,
    resolution_hours: row.resolution_hours,
    synced_at: syncedAt,
  };
}

async function upsertFacts(rows: TicketFactRow[], syncedAt: string): Promise<void> {
  const supabase = getOpsServiceDb();
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH).map((row) => toInsertRow(row, syncedAt));
    const { error } = await supabase.from("ops_ticket_facts").upsert(chunk, {
      onConflict: "ticket_id",
    });
    if (error) throw new Error(error.message);
  }
}

export async function syncTicketingFromSheet(): Promise<TicketSyncResult> {
  try {
    const csv = await fetchRawCsv();
    const rows = factsFromTicketingCsv(csv);
    const syncedAt = new Date().toISOString();
    await upsertFacts(rows, syncedAt);
    await logSync("ticketing", rows.length, "success");
    return { ok: true, rowCount: rows.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Ticketing sync failed";
    await logSync("ticketing", 0, "failed", msg);
    return { ok: false, rowCount: 0, error: msg };
  }
}
