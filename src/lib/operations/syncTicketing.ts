import { getOpsServiceDb, logSync } from "@/lib/operations/opsDb";
import {
  fetchSheetCsvFromPublicUrls,
  fetchSheetRangeViaServiceAccount,
  getServiceAccountConfigStatus,
  sheetAccessHelpMessage,
  valuesToCsv,
} from "@/lib/operations/googleSheetFetch";
import {
  factsFromTicketingCsv,
  ticketingCsvPublicUrls,
  ticketingSheetsApiRange,
  TICKETING_RAW_TAB,
  TICKETING_SHEET_ID,
  type TicketFactRow,
} from "@/lib/operations/ticketSheet";

const BATCH = 500;

export type TicketSyncResult = {
  ok: boolean;
  rowCount: number;
  error?: string;
};

async function fetchRawCsv(): Promise<string> {
  const saStatus = getServiceAccountConfigStatus();
  let serviceAccountFailure: string | undefined;

  if (saStatus.ok) {
    const api = await fetchSheetRangeViaServiceAccount(
      TICKETING_SHEET_ID,
      ticketingSheetsApiRange(),
    );
    if (api.ok) {
      return valuesToCsv(api.values);
    }
    serviceAccountFailure = api.reason;
  } else if (
    process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_BASE64
  ) {
    serviceAccountFailure = saStatus.reason;
  }

  const publicCsv = await fetchSheetCsvFromPublicUrls(ticketingCsvPublicUrls());
  if (publicCsv) return publicCsv;

  throw new Error(
    sheetAccessHelpMessage({
      sheetLabel: "Ticketing Raw Data",
      spreadsheetId: TICKETING_SHEET_ID,
      tabName: TICKETING_RAW_TAB,
      serviceAccountFailure,
    }),
  );
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
