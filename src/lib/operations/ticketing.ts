import { getOpsServiceDb } from "@/lib/operations/opsDb";
import {
  parseOptionalDateParam,
} from "@/lib/operations/sheetCountries";
import {
  parseTicketDirection,
  type TicketDirection,
} from "@/lib/operations/ticketSheet";

export type TicketDirectionKpis = {
  tickets: number;
  open: number;
  resolved: number;
  pending: number;
  inProgress: number;
  awaitingSeller: number;
  openRate: number;
  resolvedRate: number;
  pendingRate: number;
  inProgressRate: number;
  awaitingSellerRate: number;
  firstReplyCount: number;
  avgFirstReplyMinutes: number | null;
  resolutionCount: number;
  avgResolutionHours: number | null;
};

export type TicketCategoryRow = {
  category: string;
  subCategory?: string;
  tickets: number;
  inbound: number;
  outbound: number;
  pending: number;
  inProgress: number;
  open: number;
  resolved: number;
  resolvedRate: number;
  avgFirstReplyMinutes: number | null;
  avgResolutionHours: number | null;
};

export type TicketingData = {
  available: boolean;
  sourceRowCount: number;
  all: TicketDirectionKpis;
  inbound: TicketDirectionKpis;
  outbound: TicketDirectionKpis;
  categories: TicketCategoryRow[];
  subcategories: TicketCategoryRow[];
};

const EMPTY_KPIS: TicketDirectionKpis = {
  tickets: 0,
  open: 0,
  resolved: 0,
  pending: 0,
  inProgress: 0,
  awaitingSeller: 0,
  openRate: 0,
  resolvedRate: 0,
  pendingRate: 0,
  inProgressRate: 0,
  awaitingSellerRate: 0,
  firstReplyCount: 0,
  avgFirstReplyMinutes: null,
  resolutionCount: 0,
  avgResolutionHours: null,
};

const EMPTY: TicketingData = {
  available: false,
  sourceRowCount: 0,
  all: EMPTY_KPIS,
  inbound: EMPTY_KPIS,
  outbound: EMPTY_KPIS,
  categories: [],
  subcategories: [],
};

export function parseTicketDirectionParam(
  raw: string | string[] | undefined,
): TicketDirection | "" {
  const value = typeof raw === "string" ? raw.trim() : "";
  return parseTicketDirection(value) ?? "";
}

function rate(num: number, den: number): number {
  if (!den) return 0;
  return (num / den) * 100;
}

function avg(sum: number, count: number): number | null {
  if (!count) return null;
  return sum / count;
}

export function formatMinutesAvg(value: number | null): string {
  if (value == null) return "—";
  if (value < 60) return `${Math.round(value)} min`;
  return `${(value / 60).toFixed(1)} hrs`;
}

export function formatHoursAvg(value: number | null): string {
  if (value == null) return "—";
  if (value < 1) return `${Math.round(value * 60)} min`;
  return `${value.toFixed(1)} hrs`;
}

type FactLite = {
  ticket_id: string;
  ticket_date: string | null;
  direction: string | null;
  category: string | null;
  sub_category: string | null;
  status: string | null;
  first_reply_minutes: number | null;
  resolution_hours: number | null;
};

type Acc = {
  tickets: number;
  open: number;
  resolved: number;
  pending: number;
  inProgress: number;
  awaitingSeller: number;
  firstReplyCount: number;
  firstReplySum: number;
  resolutionCount: number;
  resolutionSum: number;
  inbound: number;
  outbound: number;
};

function emptyAcc(): Acc {
  return {
    tickets: 0,
    open: 0,
    resolved: 0,
    pending: 0,
    inProgress: 0,
    awaitingSeller: 0,
    firstReplyCount: 0,
    firstReplySum: 0,
    resolutionCount: 0,
    resolutionSum: 0,
    inbound: 0,
    outbound: 0,
  };
}

function addFact(acc: Acc, row: FactLite): void {
  const status = (row.status ?? "").trim().toLowerCase();
  const direction = (row.direction ?? "").trim().toLowerCase();
  const resolved = status === "resolved";
  acc.tickets += 1;
  if (resolved) acc.resolved += 1;
  else acc.open += 1;
  if (status === "pending") acc.pending += 1;
  if (status === "in progress" || status === "in-progress") acc.inProgress += 1;
  if (status.includes("awaiting seller")) acc.awaitingSeller += 1;
  if (direction === "inbound") acc.inbound += 1;
  if (direction === "outbound") acc.outbound += 1;
  if (row.first_reply_minutes != null) {
    acc.firstReplyCount += 1;
    acc.firstReplySum += Number(row.first_reply_minutes);
  }
  if (row.resolution_hours != null) {
    acc.resolutionCount += 1;
    acc.resolutionSum += Number(row.resolution_hours);
  }
}

function toKpis(acc: Acc): TicketDirectionKpis {
  return {
    tickets: acc.tickets,
    open: acc.open,
    resolved: acc.resolved,
    pending: acc.pending,
    inProgress: acc.inProgress,
    awaitingSeller: acc.awaitingSeller,
    openRate: rate(acc.open, acc.tickets),
    resolvedRate: rate(acc.resolved, acc.tickets),
    pendingRate: rate(acc.pending, acc.tickets),
    inProgressRate: rate(acc.inProgress, acc.tickets),
    awaitingSellerRate: rate(acc.awaitingSeller, acc.tickets),
    firstReplyCount: acc.firstReplyCount,
    avgFirstReplyMinutes: avg(acc.firstReplySum, acc.firstReplyCount),
    resolutionCount: acc.resolutionCount,
    avgResolutionHours: avg(acc.resolutionSum, acc.resolutionCount),
  };
}

function toCategoryRow(
  label: { category: string; subCategory?: string },
  acc: Acc,
): TicketCategoryRow {
  return {
    category: label.category,
    subCategory: label.subCategory,
    tickets: acc.tickets,
    inbound: acc.inbound,
    outbound: acc.outbound,
    pending: acc.pending,
    inProgress: acc.inProgress,
    open: acc.open,
    resolved: acc.resolved,
    resolvedRate: rate(acc.resolved, acc.tickets),
    avgFirstReplyMinutes: avg(acc.firstReplySum, acc.firstReplyCount),
    avgResolutionHours: avg(acc.resolutionSum, acc.resolutionCount),
  };
}

type RpcPayload = {
  total?: number;
  all?: Partial<TicketDirectionKpis> & {
    avgFirstReplyMinutes?: number | null;
    avgResolutionHours?: number | null;
  };
  inbound?: Partial<TicketDirectionKpis>;
  outbound?: Partial<TicketDirectionKpis>;
  categories?: Array<Partial<TicketCategoryRow> & { open?: number }>;
  subcategories?: Array<
    Partial<TicketCategoryRow> & { subCategory?: string; open?: number }
  >;
};

function kpisFromRpc(raw: Partial<TicketDirectionKpis> | undefined): TicketDirectionKpis {
  const tickets = Number(raw?.tickets ?? 0);
  const open = Number(raw?.open ?? 0);
  const resolved = Number(raw?.resolved ?? 0);
  return {
    tickets,
    open,
    resolved,
    pending: Number(raw?.pending ?? 0),
    inProgress: Number(raw?.inProgress ?? 0),
    awaitingSeller: Number(raw?.awaitingSeller ?? 0),
    openRate: rate(open, tickets),
    resolvedRate: rate(resolved, tickets),
    pendingRate: rate(Number(raw?.pending ?? 0), tickets),
    inProgressRate: rate(Number(raw?.inProgress ?? 0), tickets),
    awaitingSellerRate: rate(Number(raw?.awaitingSeller ?? 0), tickets),
    firstReplyCount: Number(raw?.firstReplyCount ?? 0),
    avgFirstReplyMinutes:
      raw?.avgFirstReplyMinutes == null ? null : Number(raw.avgFirstReplyMinutes),
    resolutionCount: Number(raw?.resolutionCount ?? 0),
    avgResolutionHours:
      raw?.avgResolutionHours == null ? null : Number(raw.avgResolutionHours),
  };
}

function categoryFromRpc(
  row: Partial<TicketCategoryRow> & { open?: number; subCategory?: string },
): TicketCategoryRow {
  const tickets = Number(row.tickets ?? 0);
  const resolved = Number(row.resolved ?? 0);
  return {
    category: String(row.category ?? "Uncategorized"),
    subCategory: row.subCategory,
    tickets,
    inbound: Number(row.inbound ?? 0),
    outbound: Number(row.outbound ?? 0),
    pending: Number(row.pending ?? 0),
    inProgress: Number(row.inProgress ?? 0),
    open: Number(row.open ?? 0),
    resolved,
    resolvedRate: rate(resolved, tickets),
    avgFirstReplyMinutes:
      row.avgFirstReplyMinutes == null ? null : Number(row.avgFirstReplyMinutes),
    avgResolutionHours:
      row.avgResolutionHours == null ? null : Number(row.avgResolutionHours),
  };
}

async function fetchTicketFacts(
  from: string | null,
  to: string | null,
  direction: TicketDirection | "",
): Promise<{ rows: FactLite[]; sourceRowCount: number } | null> {
  const supabase = getOpsServiceDb();
  const [{ count, error: countError }, first] = await Promise.all([
    supabase.from("ops_ticket_facts").select("ticket_id", { count: "exact", head: true }),
    supabase.from("ops_ticket_facts").select("ticket_id").limit(1),
  ]);
  if (countError || first.error) {
    const msg = (countError ?? first.error)?.message.toLowerCase() ?? "";
    if (
      msg.includes("schema cache") ||
      msg.includes("does not exist") ||
      msg.includes("could not find")
    ) {
      return null;
    }
    throw new Error(countError?.message ?? first.error?.message);
  }

  const sourceRowCount = count ?? 0;
  const pageSize = 1000;
  const rows: FactLite[] = [];
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from("ops_ticket_facts")
      .select(
        "ticket_id,ticket_date,direction,category,sub_category,status,first_reply_minutes,resolution_hours",
      )
      .order("ticket_id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (from) query = query.gte("ticket_date", from);
    if (to) query = query.lte("ticket_date", to);
    if (direction) query = query.ilike("direction", direction);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as FactLite[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return { rows, sourceRowCount };
}

function aggregateFacts(rows: FactLite[]): TicketingData {
  const all = emptyAcc();
  const inbound = emptyAcc();
  const outbound = emptyAcc();
  const cats = new Map<string, Acc>();
  const subs = new Map<string, Acc>();

  for (const row of rows) {
    addFact(all, row);
    const direction = (row.direction ?? "").trim().toLowerCase();
    if (direction === "inbound") addFact(inbound, row);
    if (direction === "outbound") addFact(outbound, row);

    const category = (row.category ?? "").trim() || "Uncategorized";
    const subCategory = (row.sub_category ?? "").trim() || "Uncategorized";
    const catAcc = cats.get(category) ?? emptyAcc();
    addFact(catAcc, row);
    cats.set(category, catAcc);
    const subKey = `${category}\0${subCategory}`;
    const subAcc = subs.get(subKey) ?? emptyAcc();
    addFact(subAcc, row);
    subs.set(subKey, subAcc);
  }

  return {
    available: true,
    sourceRowCount: 0,
    all: toKpis(all),
    inbound: toKpis(inbound),
    outbound: toKpis(outbound),
    categories: [...cats.entries()]
      .map(([category, acc]) => toCategoryRow({ category }, acc))
      .sort((a, b) => b.tickets - a.tickets),
    subcategories: [...subs.entries()]
      .map(([key, acc]) => {
        const [category, subCategory] = key.split("\0");
        return toCategoryRow({ category, subCategory }, acc);
      })
      .sort((a, b) => b.tickets - a.tickets),
  };
}

export async function getTicketingAnalytics(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<TicketingData> {
  const from = parseOptionalDateParam(searchParams.from);
  const to = parseOptionalDateParam(searchParams.to);
  const direction = parseTicketDirectionParam(searchParams.direction);

  try {
    const supabase = getOpsServiceDb();
    const [{ data, error }, countRes] = await Promise.all([
      supabase.rpc("get_ops_ticketing", {
        p_from_date: from,
        p_to_date: to,
        p_direction: direction || null,
      }),
      supabase.from("ops_ticket_facts").select("ticket_id", { count: "exact", head: true }),
    ]);

    if (!error && data) {
      const payload = data as RpcPayload;
      return {
        available: true,
        sourceRowCount: countRes.count ?? 0,
        all: kpisFromRpc(payload.all),
        inbound: kpisFromRpc(payload.inbound),
        outbound: kpisFromRpc(payload.outbound),
        categories: (payload.categories ?? []).map(categoryFromRpc),
        subcategories: (payload.subcategories ?? []).map(categoryFromRpc),
      };
    }

    const facts = await fetchTicketFacts(from, to, direction);
    if (!facts) return EMPTY;
    const aggregated = aggregateFacts(facts.rows);
    aggregated.sourceRowCount = facts.sourceRowCount;
    aggregated.available = facts.sourceRowCount > 0;
    return aggregated;
  } catch {
    return EMPTY;
  }
}

export type TicketDayKpis = {
  tickets: number;
  pending: number;
  inProgress: number;
  awaitingSeller: number;
  resolved: number;
  open: number;
  avgFirstReplyMinutes: number | null;
  avgResolutionHours: number | null;
};

export type TicketDailyRow = {
  date: string;
  all: TicketDayKpis;
  inbound: TicketDayKpis;
  outbound: TicketDayKpis;
};

export type TicketDailyData = {
  from: string;
  to: string;
  days: TicketDailyRow[];
};

export type TicketDayStatsSection = "overview" | "inbound" | "outbound";

function toDayKpis(acc: Acc): TicketDayKpis {
  return {
    tickets: acc.tickets,
    pending: acc.pending,
    inProgress: acc.inProgress,
    awaitingSeller: acc.awaitingSeller,
    resolved: acc.resolved,
    open: acc.open,
    avgFirstReplyMinutes: avg(acc.firstReplySum, acc.firstReplyCount),
    avgResolutionHours: avg(acc.resolutionSum, acc.resolutionCount),
  };
}

async function ticketDateBounds(): Promise<{ min: string; max: string } | null> {
  const supabase = getOpsServiceDb();
  const [{ data: minRows }, { data: maxRows }] = await Promise.all([
    supabase
      .from("ops_ticket_facts")
      .select("ticket_date")
      .not("ticket_date", "is", null)
      .order("ticket_date", { ascending: true })
      .limit(1),
    supabase
      .from("ops_ticket_facts")
      .select("ticket_date")
      .not("ticket_date", "is", null)
      .order("ticket_date", { ascending: false })
      .limit(1),
  ]);
  const min = minRows?.[0]?.ticket_date;
  const max = maxRows?.[0]?.ticket_date;
  if (!min || !max) return null;
  return { min: String(min).slice(0, 10), max: String(max).slice(0, 10) };
}

export async function getTicketingDaily(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<TicketDailyData> {
  const from = parseOptionalDateParam(searchParams.from);
  const to = parseOptionalDateParam(searchParams.to);
  const direction = parseTicketDirectionParam(searchParams.direction);

  let rangeFrom = from;
  let rangeTo = to;
  if (!rangeFrom || !rangeTo) {
    const bounds = await ticketDateBounds();
    if (!bounds) return { from: "", to: "", days: [] };
    rangeFrom = rangeFrom ?? bounds.min;
    rangeTo = rangeTo ?? bounds.max;
  }
  if (rangeFrom > rangeTo) return { from: rangeFrom, to: rangeTo, days: [] };

  const facts = await fetchTicketFacts(rangeFrom, rangeTo, direction);
  if (!facts) return { from: rangeFrom, to: rangeTo, days: [] };

  const byDate = new Map<
    string,
    { all: Acc; inbound: Acc; outbound: Acc }
  >();

  for (const row of facts.rows) {
    const date = row.ticket_date ? String(row.ticket_date).slice(0, 10) : "";
    if (!date) continue;
    let bucket = byDate.get(date);
    if (!bucket) {
      bucket = { all: emptyAcc(), inbound: emptyAcc(), outbound: emptyAcc() };
      byDate.set(date, bucket);
    }
    addFact(bucket.all, row);
    const dir = (row.direction ?? "").trim().toLowerCase();
    if (dir === "inbound") addFact(bucket.inbound, row);
    if (dir === "outbound") addFact(bucket.outbound, row);
  }

  const days = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bucket]) => ({
      date,
      all: toDayKpis(bucket.all),
      inbound: toDayKpis(bucket.inbound),
      outbound: toDayKpis(bucket.outbound),
    }));

  return { from: rangeFrom, to: rangeTo, days };
}
