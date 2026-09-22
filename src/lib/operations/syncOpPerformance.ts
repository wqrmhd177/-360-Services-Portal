import { getOpsServiceDb, logSync } from "@/lib/operations/opsDb";
import {
  factsFromCsv,
  opPerformanceCsvUrl,
  type OpFactRow,
} from "@/lib/operations/opSheet";

const BATCH = 500;

export type OpSyncResult = {
  ok: boolean;
  rowCount: number;
  error?: string;
};

async function fetchRawCsv(): Promise<string> {
  const res = await fetch(opPerformanceCsvUrl(), {
    cache: "no-store",
    headers: { "User-Agent": "360-portal-op-sync/1.0" },
  });
  const text = await res.text();
  if (!res.ok || text.trimStart().startsWith("<!")) {
    throw new Error(
      "OP Raw Data is not readable from the backend. Share the sheet with the sync service account.",
    );
  }
  return text;
}

function toInsertRow(row: OpFactRow, syncedAt: string, mode: "full" | "legacy") {
  const payload: Record<string, unknown> = {
    source_id: row.source_id,
    order_number: row.order_number,
    order_date: row.order_date,
    ndr_date: row.ndr_date,
    upsell_agreed: row.upsell_agreed,
    upsell_pitched: row.upsell_pitched,
    cs_status: row.cs_status,
    op_tag: row.op_tag,
    country: row.country,
    status: row.status,
    reschedule_check: row.reschedule_check,
    synced_at: syncedAt,
  };
  if (mode === "full") {
    payload.lucky_draw_pitched = row.lucky_draw_pitched;
    payload.op_remarks = row.op_remarks;
  }
  return payload;
}

async function upsertFacts(rows: OpFactRow[], syncedAt: string): Promise<void> {
  const supabase = getOpsServiceDb();
  let mode: "full" | "legacy" = "full";

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows
      .slice(i, i + BATCH)
      .map((row) => toInsertRow(row, syncedAt, mode));
    const { error } = await supabase.from("ops_op_facts").upsert(chunk, {
      onConflict: "source_id",
    });
    if (error) {
      const msg = error.message.toLowerCase();
      if (
        mode === "full" &&
        (msg.includes("schema cache") ||
          msg.includes("lucky_draw") ||
          msg.includes("op_remarks"))
      ) {
        mode = "legacy";
        i -= BATCH;
        continue;
      }
      throw new Error(error.message);
    }
  }
}

export async function syncOpPerformanceFromSheet(): Promise<OpSyncResult> {
  try {
    const csv = await fetchRawCsv();
    const rows = factsFromCsv(csv);
    const syncedAt = new Date().toISOString();
    await upsertFacts(rows, syncedAt);
    await logSync("op_performance", rows.length, "success");
    return { ok: true, rowCount: rows.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OP sync failed";
    await logSync("op_performance", 0, "failed", msg);
    return { ok: false, rowCount: 0, error: msg };
  }
}
