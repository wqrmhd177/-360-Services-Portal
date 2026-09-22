import { parseCsv, parseSheetDate } from "@/lib/operations/opSheet";

/** Ticketing Dashboard workbook. Backend sync only — never fetch from the browser. */
export const TICKETING_SHEET_ID = "1u9gqhrSUveX7Z3-3O8Dw9KlAbiIV9b_9ZImw0j2TDHk";

/** D, E, I, J, K, Q, Y, AB. Letters match the Raw Data tab. */
export const TICKETING_SELECT = "select D,E,I,J,K,Q,Y,AB";

export type TicketDirection = "Inbound" | "Outbound";

export type TicketFactRow = {
  ticket_id: string;
  ticket_date: string | null;
  direction: TicketDirection | null;
  category: string | null;
  sub_category: string | null;
  status: string | null;
  first_reply_minutes: number | null;
  resolution_hours: number | null;
};

function headerIndex(headers: string[], ...names: string[]): number | null {
  const lower = headers.map((h) => h.trim().toLowerCase().replace(/_/g, " "));
  for (const name of names) {
    const needle = name.trim().toLowerCase().replace(/_/g, " ");
    const exact = lower.indexOf(needle);
    if (exact >= 0) return exact;
  }
  for (let i = 0; i < lower.length; i++) {
    for (const name of names) {
      const needle = name.trim().toLowerCase().replace(/_/g, " ");
      if (needle && lower[i].includes(needle)) return i;
    }
  }
  return null;
}

function cell(row: string[], idx: number | null): string {
  if (idx == null || idx >= row.length) return "";
  return row[idx].trim();
}

export function parseTicketDirection(raw: string): TicketDirection | null {
  const val = raw.trim().toLowerCase();
  if (val === "inbound") return "Inbound";
  if (val === "outbound") return "Outbound";
  return null;
}

export function parseMetricNumber(raw: string): number | null {
  const val = raw.trim().replace(/,/g, "");
  if (!val) return null;
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function factsFromTicketingCsv(text: string): TicketFactRow[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0];
  const iId = headerIndex(headers, "ticket id", "ticket_id");
  const iDate = headerIndex(headers, "final ticket date", "ticket date");
  const iCat = headerIndex(headers, "category");
  const iSub = headerIndex(headers, "sub category", "sub_category");
  const iStatus = headerIndex(headers, "current status", "status");
  const iDir = headerIndex(headers, "ticket direction", "direction");
  const iReply = headerIndex(
    headers,
    "minutes to first staff reply",
    "minutes_to_first_staff_reply",
  );
  const iHours = headerIndex(
    headers,
    "hours to resolution",
    "hours_to_resolution",
  );

  if (iId == null || iDate == null) {
    throw new Error(
      `Ticketing Raw Data is missing mapped headers: ${headers.join(", ")}`,
    );
  }

  const byId = new Map<string, TicketFactRow>();
  for (const row of rows.slice(1)) {
    const ticketId = cell(row, iId);
    if (!ticketId) continue;
    byId.set(ticketId, {
      ticket_id: ticketId,
      ticket_date: parseSheetDate(cell(row, iDate)),
      direction: parseTicketDirection(cell(row, iDir)),
      category: cell(row, iCat) || null,
      sub_category: cell(row, iSub) || null,
      status: cell(row, iStatus) || null,
      first_reply_minutes: parseMetricNumber(cell(row, iReply)),
      resolution_hours: parseMetricNumber(cell(row, iHours)),
    });
  }
  return [...byId.values()];
}

export function ticketingCsvUrl(): string {
  const tq = encodeURIComponent(TICKETING_SELECT);
  return (
    `https://docs.google.com/spreadsheets/d/${TICKETING_SHEET_ID}/gviz/tq` +
    `?tqx=out:csv&sheet=${encodeURIComponent("Raw Data")}&tq=${tq}`
  );
}
