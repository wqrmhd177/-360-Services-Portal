/** OP - Performance workbook. Backend sync only — never fetch from the browser. */
export const OP_PERFORMANCE_SHEET_ID =
  "1sd2MZuKjMLiX7MdIusIypUBr74okVEmUO8MCH6TO4cM";
export const OP_PERFORMANCE_RAW_GID = "1966223894";

/** C, D, F, G, H, M, AF, AI plus optional A/E/I. Letters match the Raw Data tab. */
export const OP_PERFORMANCE_SELECT =
  "select A,C,D,E,F,G,H,I,M,AF,AI";

export const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

export type OpFactRow = {
  source_id: number;
  order_number: string | null;
  order_date: string | null;
  ndr_date: string | null;
  upsell_agreed: boolean | null;
  upsell_pitched: boolean | null;
  cs_status: string | null;
  op_tag: string | null;
  country: string | null;
  status: string | null;
  lucky_draw_pitched: boolean;
  op_remarks: string | null;
  reschedule_check: string | null;
};

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (c === "\r") continue;
    cell += c;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function headerIndex(headers: string[], ...names: string[]): number | null {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const name of names) {
    const exact = lower.indexOf(name);
    if (exact >= 0) return exact;
  }
  for (let i = 0; i < lower.length; i++) {
    for (const name of names) {
      if (name && lower[i].includes(name)) return i;
    }
  }
  return null;
}

function cell(row: string[], idx: number | null): string {
  if (idx == null || idx >= row.length) return "";
  return row[idx].trim();
}

export function parseYesNo(raw: string): boolean | null {
  const val = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!val) return null;
  // Column C is "Agreed" / "Not Agreed"; column D is "Yes" / "No".
  if (["yes", "y", "true", "1", "agreed"].includes(val)) return true;
  if (["no", "n", "false", "0", "not agreed", "not-agreed"].includes(val)) {
    return false;
  }
  return null;
}

export function parseSheetDate(raw: string): string | null {
  const val = raw.trim();
  if (!val) return null;

  const named = val.match(/^(\d{1,2})[-\s]+([A-Za-z]{3})[-\s]+(\d{2,4})$/);
  if (named) {
    const day = Number(named[1]);
    const month = MONTHS[named[2].toLowerCase()];
    let year = Number(named[3]);
    if (year < 100) year += 2000;
    if (month) {
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const check = new Date(`${iso}T00:00:00Z`);
      if (!Number.isNaN(check.getTime())) return iso;
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;

  const serial = Number(val);
  if (Number.isFinite(serial) && serial > 20000) {
    const epoch = Date.UTC(1899, 11, 30) + Math.trunc(serial) * 86400000;
    return new Date(epoch).toISOString().slice(0, 10);
  }

  return null;
}

export function parseSourceId(raw: string): number | null {
  let val = raw.trim().replace(/,/g, "");
  if (!val) return null;
  if (val.endsWith(".0")) val = val.slice(0, -2);
  if (!/^\d+$/.test(val)) return null;
  const n = Number(val);
  return Number.isSafeInteger(n) ? n : null;
}

export function isLuckyDrawPitched(raw: string): boolean {
  return raw.split(",").some((part) => {
    const token = part.trim().toLowerCase().replace(/\s+/g, " ");
    return token === "team a" || token === "teama";
  });
}

export function factsFromCsv(text: string): OpFactRow[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0];
  const iId = headerIndex(headers, "unique order id", "id");
  const iDate = headerIndex(headers, "order date");
  const iTag = headerIndex(headers, "tags", "tag");
  const iCountry = headerIndex(headers, "country");
  const iStatus = headerIndex(headers, "status");
  const iAgreed = headerIndex(headers, "upsell agreed");
  const iPitched = headerIndex(headers, "upsell pitched");
  const iCs = headerIndex(headers, "cs status");
  const iNdr = headerIndex(headers, "ndr date");
  const iNum = headerIndex(headers, "order_number", "order number");
  const iLucky = headerIndex(headers, "op_remarks", "op remarks");

  if (iId == null || iDate == null || iCountry == null || iStatus == null) {
    throw new Error(`OP Raw Data is missing mapped headers: ${headers.join(", ")}`);
  }

  const byId = new Map<number, OpFactRow>();
  for (const row of rows.slice(1)) {
    const sourceId = parseSourceId(cell(row, iId));
    if (sourceId == null) continue;
    const remarks = cell(row, iLucky);
    const pitched = isLuckyDrawPitched(remarks);
    byId.set(sourceId, {
      source_id: sourceId,
      order_number: cell(row, iNum) || null,
      order_date: parseSheetDate(cell(row, iDate)),
      ndr_date: parseSheetDate(cell(row, iNdr)),
      upsell_agreed: parseYesNo(cell(row, iAgreed)),
      upsell_pitched: parseYesNo(cell(row, iPitched)),
      cs_status: cell(row, iCs) || null,
      op_tag: cell(row, iTag) || null,
      country: cell(row, iCountry) || null,
      status: cell(row, iStatus) || null,
      lucky_draw_pitched: pitched,
      op_remarks: remarks || null,
      reschedule_check: pitched ? "Team A" : null,
    });
  }
  return [...byId.values()];
}

export function opPerformanceCsvUrl(): string {
  const tq = encodeURIComponent(OP_PERFORMANCE_SELECT);
  return (
    `https://docs.google.com/spreadsheets/d/${OP_PERFORMANCE_SHEET_ID}/gviz/tq` +
    `?tqx=out:csv&gid=${OP_PERFORMANCE_RAW_GID}&tq=${tq}`
  );
}
