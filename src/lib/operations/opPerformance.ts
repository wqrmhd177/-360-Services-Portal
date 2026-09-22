import { getOpsServiceDb } from "@/lib/operations/opsDb";
import { countryFilterVariants } from "@/lib/country-normalization";
import { addPortalCalendarDays, todayInPortalTz } from "@/lib/portalTimezone";
import {
  parseOptionalDateParam,
  parseSheetCountryParam,
  sheetCountryCanonical,
} from "@/lib/operations/sheetCountries";

export type OpTeamRow = {
  team: string;
  total: number;
  cancelled: number;
  delivered: number;
  inProcess: number;
  cancelRate: number;
  deliveredRate: number;
  inProcessRate: number;
  share: number;
};

export type OpTrendRow = {
  team: string;
  lastTotal: number;
  lastCancelled: number;
  lastApproved: number;
  lastCancelRate: number;
  lastApprovedRate: number;
  prevTotal: number;
  prevCancelled: number;
  prevApproved: number;
  prevCancelRate: number;
  prevApprovedRate: number;
  cancelDelta: number;
  approvedDelta: number;
};

export type OpComparisonWindows = {
  lastFrom: string;
  lastTo: string;
  prevFrom: string;
  prevTo: string;
};

export type OpPerformanceData = {
  available: boolean;
  sourceRowCount: number;
  totalOrders: number;
  pendingConfirmation: number;
  pendingConfirmationRate: number;
  confirmation: number;
  confirmationRate: number;
  cancelled: number;
  cancelRate: number;
  upsellPitched: number;
  upsellAgreed: number;
  upsellDelivered: number;
  upsellPitchRate: number;
  upsellAgreeRate: number;
  upsellDeliverRate: number;
  luckyDrawPitched: number;
  luckyDrawDelivered: number;
  luckyDrawPitchRate: number;
  luckyDrawDeliverRate: number;
  teams: OpTeamRow[];
  trend: OpTrendRow[];
  windows: OpComparisonWindows;
};

export type OpDailyTeamRow = {
  team: string;
  total: number;
  cancelled: number;
  delivered: number;
  inProcess: number;
  approved: number;
};

export type OpDailyRow = {
  date: string;
  orders: number;
  pendingConfirmation: number;
  confirmation: number;
  cancelled: number;
  delivered: number;
  inProcess: number;
  upsellPitched: number;
  upsellAgreed: number;
  upsellDelivered: number;
  luckyDrawPitched: number;
  luckyDrawDelivered: number;
  teams: OpDailyTeamRow[];
};

export type OpDailyData = {
  from: string;
  to: string;
  days: OpDailyRow[];
};

export type OpDayStatsSection =
  | "outcome"
  | "teams"
  | "trend"
  | "upsell"
  | "lucky";

const EMPTY_WINDOWS: OpComparisonWindows = {
  lastFrom: "",
  lastTo: "",
  prevFrom: "",
  prevTo: "",
};

const EMPTY: OpPerformanceData = {
  available: false,
  sourceRowCount: 0,
  totalOrders: 0,
  pendingConfirmation: 0,
  pendingConfirmationRate: 0,
  confirmation: 0,
  confirmationRate: 0,
  cancelled: 0,
  cancelRate: 0,
  upsellPitched: 0,
  upsellAgreed: 0,
  upsellDelivered: 0,
  upsellPitchRate: 0,
  upsellAgreeRate: 0,
  upsellDeliverRate: 0,
  luckyDrawPitched: 0,
  luckyDrawDelivered: 0,
  luckyDrawPitchRate: 0,
  luckyDrawDeliverRate: 0,
  teams: [],
  trend: [],
  windows: EMPTY_WINDOWS,
};

export function rate(num: number, den: number): number {
  if (!den) return 0;
  return (num / den) * 100;
}

export function displayTeamName(raw: string): string {
  const trimmed = raw.trim();
  const stripped = trimmed.replace(/^\d+\s+/, "").trim();
  return stripped || "Untagged";
}

export function opComparisonWindows(
  from: string | null,
  to: string | null,
): OpComparisonWindows {
  if (from && to) {
    const span =
      Math.round(
        (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
          86400000,
      ) + 1;
    const prevTo = addPortalCalendarDays(from, -1);
    const prevFrom = addPortalCalendarDays(prevTo, -(Math.max(span, 1) - 1));
    return { lastFrom: from, lastTo: to, prevFrom, prevTo };
  }
  if (to) {
    const lastTo = to;
    const lastFrom = addPortalCalendarDays(to, -9);
    const prevTo = addPortalCalendarDays(lastFrom, -1);
    const prevFrom = addPortalCalendarDays(prevTo, -9);
    return { lastFrom, lastTo, prevFrom, prevTo };
  }
  if (from) {
    const lastFrom = from;
    const lastTo = addPortalCalendarDays(from, 9);
    const prevTo = addPortalCalendarDays(lastFrom, -1);
    const prevFrom = addPortalCalendarDays(prevTo, -9);
    return { lastFrom, lastTo, prevFrom, prevTo };
  }
  const lastTo = addPortalCalendarDays(todayInPortalTz(), -3);
  const lastFrom = addPortalCalendarDays(lastTo, -9);
  const prevTo = addPortalCalendarDays(lastFrom, -1);
  const prevFrom = addPortalCalendarDays(prevTo, -9);
  return { lastFrom, lastTo, prevFrom, prevTo };
}

function withFactFilters<T extends {
  gte: (column: string, value: string) => T;
  lte: (column: string, value: string) => T;
  in: (column: string, values: string[]) => T;
}>(query: T, canonical: string | null, from: string | null, to: string | null): T {
  let next = query;
  if (from) next = next.gte("order_date", from);
  if (to) next = next.lte("order_date", to);
  if (canonical) {
    const variants = countryFilterVariants(canonical);
    if (variants.length > 0) next = next.in("country", variants);
  }
  return next;
}

async function countConfirmationKpis(
  canonical: string | null,
  from: string | null,
  to: string | null,
): Promise<{ pending: number; confirmed: number; luckyPitched: number; luckyDelivered: number }> {
  const supabase = getOpsServiceDb();
  const pendingQuery = withFactFilters(
    supabase
      .from("ops_op_facts")
      .select("source_id", { count: "exact", head: true })
      .eq("cs_status", "Confirmation Pending"),
    canonical,
    from,
    to,
  );
  const confirmedQuery = withFactFilters(
    supabase
      .from("ops_op_facts")
      .select("source_id", { count: "exact", head: true })
      .eq("cs_status", "Approved")
      .not("op_tag", "ilike", "%AVI Team%"),
    canonical,
    from,
    to,
  );
  const luckyQuery = withFactFilters(
    supabase
      .from("ops_op_facts")
      .select("source_id", { count: "exact", head: true })
      .eq("reschedule_check", "Team A"),
    canonical,
    from,
    to,
  );
  const luckyDeliveredQuery = withFactFilters(
    supabase
      .from("ops_op_facts")
      .select("source_id", { count: "exact", head: true })
      .eq("reschedule_check", "Team A")
      .ilike("status", "%deliver%")
      .not("status", "ilike", "%undeliver%"),
    canonical,
    from,
    to,
  );
  const [pending, confirmed, luckyPitched, luckyDelivered] = await Promise.all([
    pendingQuery,
    confirmedQuery,
    luckyQuery,
    luckyDeliveredQuery,
  ]);
  return {
    pending: pending.count ?? 0,
    confirmed: confirmed.count ?? 0,
    luckyPitched: luckyPitched.count ?? 0,
    luckyDelivered: luckyDelivered.count ?? 0,
  };
}

async function headCount(
  canonical: string | null,
  from: string,
  to: string,
  apply: (
    query: {
      eq: (column: string, value: string) => unknown;
      ilike: (column: string, value: string) => unknown;
    },
  ) => unknown,
): Promise<number> {
  const supabase = getOpsServiceDb();
  const filtered = withFactFilters(
    supabase.from("ops_op_facts").select("source_id", { count: "exact", head: true }),
    canonical,
    from,
    to,
  );
  const query = apply(filtered as never) as PromiseLike<{ count: number | null }>;
  const { count } = await query;
  return count ?? 0;
}

async function trendFromFacts(
  tags: string[],
  windows: OpComparisonWindows,
  canonical: string | null,
): Promise<OpTrendRow[]> {
  const uniqueTags = [...new Set(tags.filter(Boolean))];
  const rows = await Promise.all(
    uniqueTags.map(async (tag) => {
      const isAvi = displayTeamName(tag).toLowerCase() === "avi team";
      const [
        lastTotal,
        lastCancelled,
        lastApproved,
        prevTotal,
        prevCancelled,
        prevApproved,
      ] = await Promise.all([
        headCount(canonical, windows.lastFrom, windows.lastTo, (q) =>
          q.eq("op_tag", tag),
        ),
        headCount(canonical, windows.lastFrom, windows.lastTo, (q) =>
          q.eq("op_tag", tag).ilike("status", "%cancel%"),
        ),
        isAvi
          ? Promise.resolve(0)
          : headCount(canonical, windows.lastFrom, windows.lastTo, (q) =>
              q.eq("op_tag", tag).eq("cs_status", "Approved"),
            ),
        headCount(canonical, windows.prevFrom, windows.prevTo, (q) =>
          q.eq("op_tag", tag),
        ),
        headCount(canonical, windows.prevFrom, windows.prevTo, (q) =>
          q.eq("op_tag", tag).ilike("status", "%cancel%"),
        ),
        isAvi
          ? Promise.resolve(0)
          : headCount(canonical, windows.prevFrom, windows.prevTo, (q) =>
              q.eq("op_tag", tag).eq("cs_status", "Approved"),
            ),
      ]);
      const lastCancelRate = rate(lastCancelled, lastTotal);
      const prevCancelRate = rate(prevCancelled, prevTotal);
      const lastApprovedRate = rate(lastApproved, lastTotal);
      const prevApprovedRate = rate(prevApproved, prevTotal);
      return {
        team: displayTeamName(tag),
        lastTotal,
        lastCancelled,
        lastApproved,
        lastCancelRate,
        lastApprovedRate,
        prevTotal,
        prevCancelled,
        prevApproved,
        prevCancelRate,
        prevApprovedRate,
        cancelDelta: lastCancelRate - prevCancelRate,
        approvedDelta: lastApprovedRate - prevApprovedRate,
      };
    }),
  );
  return rows.sort((a, b) => a.team.localeCompare(b.team));
}

type RpcPayload = {
  totalOrders?: number;
  cancelled?: number;
  pendingConfirmation?: number;
  confirmation?: number;
  upsellPitched?: number;
  upsellAgreed?: number;
  upsellDelivered?: number;
  luckyDrawPitched?: number;
  luckyDrawDelivered?: number;
  windows?: Partial<OpComparisonWindows>;
  teams?: Array<{
    team: string;
    total: number;
    cancelled: number;
    delivered: number;
    inProcess: number;
  }>;
  trend?: Array<{
    team: string;
    lastTotal?: number;
    lastCancelled?: number;
    lastApproved?: number;
    prevTotal?: number;
    prevCancelled?: number;
    prevApproved?: number;
    last10Total?: number;
    last10Cancelled?: number;
    prev10Total?: number;
    prev10Cancelled?: number;
  }>;
};

export async function getOpPerformanceAnalytics(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<OpPerformanceData> {
  const countryCode = parseSheetCountryParam(searchParams.country);
  const canonical = sheetCountryCanonical(countryCode);
  const from = parseOptionalDateParam(searchParams.from);
  const to = parseOptionalDateParam(searchParams.to);
  const fallbackWindows = opComparisonWindows(from, to);

  try {
    const supabase = getOpsServiceDb();
    const [{ data, error }, sourceCount] = await Promise.all([
      supabase.rpc("get_ops_op_performance", {
        p_country: canonical,
        p_from_date: from,
        p_to_date: to,
      }),
      supabase.from("ops_op_facts").select("source_id", { count: "exact", head: true }),
    ]);

    if (error || !data) {
      return EMPTY;
    }

    const payload = data as RpcPayload;
    const total = Number(payload.totalOrders ?? 0);
    const cancelled = Number(payload.cancelled ?? 0);
    const fallbackKpis =
      payload.pendingConfirmation == null || payload.confirmation == null
        ? await countConfirmationKpis(canonical, from, to)
        : null;
    const pendingConfirmation = Number(
      payload.pendingConfirmation ?? fallbackKpis?.pending ?? 0,
    );
    const confirmation = Number(
      payload.confirmation ?? fallbackKpis?.confirmed ?? 0,
    );
    const upsellPitched = Number(payload.upsellPitched ?? 0);
    const upsellAgreed = Number(payload.upsellAgreed ?? 0);
    const upsellDelivered = Number(payload.upsellDelivered ?? 0);
    const luckyDrawPitched = Number(
      payload.luckyDrawPitched ?? fallbackKpis?.luckyPitched ?? 0,
    );
    const luckyDrawDelivered = Number(
      payload.luckyDrawDelivered ?? fallbackKpis?.luckyDelivered ?? 0,
    );

    const windows: OpComparisonWindows = {
      lastFrom: String(payload.windows?.lastFrom ?? fallbackWindows.lastFrom),
      lastTo: String(payload.windows?.lastTo ?? fallbackWindows.lastTo),
      prevFrom: String(payload.windows?.prevFrom ?? fallbackWindows.prevFrom),
      prevTo: String(payload.windows?.prevTo ?? fallbackWindows.prevTo),
    };

    const teams: OpTeamRow[] = (payload.teams ?? []).map((row) => {
      const teamTotal = Number(row.total ?? 0);
      const teamCancelled = Number(row.cancelled ?? 0);
      const teamDelivered = Number(row.delivered ?? 0);
      const inProcessFromRpc = Number(row.inProcess ?? 0);
      const teamInProcess =
        payload.pendingConfirmation == null
          ? Math.max(0, teamTotal - teamCancelled - teamDelivered)
          : inProcessFromRpc;
      return {
        team: displayTeamName(row.team),
        total: teamTotal,
        cancelled: teamCancelled,
        delivered: teamDelivered,
        inProcess: teamInProcess,
        cancelRate: rate(teamCancelled, teamTotal),
        deliveredRate: rate(teamDelivered, teamTotal),
        inProcessRate: rate(teamInProcess, teamTotal),
        share: rate(teamTotal, total),
      };
    });

    const trendHasApproved =
      Array.isArray(payload.trend) &&
      payload.trend.some((row) => row.lastApproved != null);
    const trend: OpTrendRow[] = trendHasApproved
      ? (payload.trend ?? []).map((row) => {
          const lastTotal = Number(row.lastTotal ?? row.last10Total ?? 0);
          const lastCancelled = Number(row.lastCancelled ?? row.last10Cancelled ?? 0);
          const lastApproved = Number(row.lastApproved ?? 0);
          const prevTotal = Number(row.prevTotal ?? row.prev10Total ?? 0);
          const prevCancelled = Number(row.prevCancelled ?? row.prev10Cancelled ?? 0);
          const prevApproved = Number(row.prevApproved ?? 0);
          const lastCancelRate = rate(lastCancelled, lastTotal);
          const prevCancelRate = rate(prevCancelled, prevTotal);
          const lastApprovedRate = rate(lastApproved, lastTotal);
          const prevApprovedRate = rate(prevApproved, prevTotal);
          return {
            team: displayTeamName(row.team),
            lastTotal,
            lastCancelled,
            lastApproved,
            lastCancelRate,
            lastApprovedRate,
            prevTotal,
            prevCancelled,
            prevApproved,
            prevCancelRate,
            prevApprovedRate,
            cancelDelta: lastCancelRate - prevCancelRate,
            approvedDelta: lastApprovedRate - prevApprovedRate,
          };
        })
      : await trendFromFacts(
          (payload.teams ?? []).map((row) => row.team),
          fallbackWindows,
          canonical,
        );

    return {
      available: true,
      sourceRowCount: sourceCount.count ?? 0,
      totalOrders: total,
      pendingConfirmation,
      pendingConfirmationRate: rate(pendingConfirmation, total),
      confirmation,
      confirmationRate: rate(confirmation, total),
      cancelled,
      cancelRate: rate(cancelled, total),
      upsellPitched,
      upsellAgreed,
      upsellDelivered,
      upsellPitchRate: rate(upsellPitched, total),
      upsellAgreeRate: rate(upsellAgreed, upsellPitched),
      upsellDeliverRate: rate(upsellDelivered, upsellAgreed),
      luckyDrawPitched,
      luckyDrawDelivered,
      luckyDrawPitchRate: rate(luckyDrawPitched, total),
      luckyDrawDeliverRate: rate(luckyDrawDelivered, luckyDrawPitched),
      teams,
      trend,
      windows,
    };
  } catch {
    return EMPTY;
  }
}

type DailyRpc = {
  from?: string;
  to?: string;
  days?: Array<{
    date: string;
    orders?: number;
    pendingConfirmation?: number;
    confirmation?: number;
    cancelled?: number;
    delivered?: number;
    inProcess?: number;
    upsellPitched?: number;
    upsellAgreed?: number;
    upsellDelivered?: number;
    luckyDrawPitched?: number;
    luckyDrawDelivered?: number;
    teams?: OpDailyTeamRow[];
  }>;
};

async function factDateBounds(
  canonical: string | null,
): Promise<{ min: string; max: string } | null> {
  const supabase = getOpsServiceDb();
  const minQuery = withFactFilters(
    supabase
      .from("ops_op_facts")
      .select("order_date")
      .not("order_date", "is", null)
      .order("order_date", { ascending: true })
      .limit(1),
    canonical,
    null,
    null,
  );
  const maxQuery = withFactFilters(
    supabase
      .from("ops_op_facts")
      .select("order_date")
      .not("order_date", "is", null)
      .order("order_date", { ascending: false })
      .limit(1),
    canonical,
    null,
    null,
  );
  const [{ data: minRows }, { data: maxRows }] = await Promise.all([
    minQuery,
    maxQuery,
  ]);
  const min = minRows?.[0]?.order_date;
  const max = maxRows?.[0]?.order_date;
  if (!min || !max) return null;
  return { min: String(min).slice(0, 10), max: String(max).slice(0, 10) };
}

async function resolveDailyRange(
  canonical: string | null,
  from: string | null,
  to: string | null,
): Promise<{ from: string; to: string } | null> {
  if (from && to) return { from, to };
  const bounds = await factDateBounds(canonical);
  if (!bounds) return from || to ? { from: from ?? to!, to: to ?? from! } : null;
  const rangeFrom = from ?? bounds.min;
  const rangeTo = to ?? bounds.max;
  if (rangeFrom > rangeTo) return null;
  return { from: rangeFrom, to: rangeTo };
}

export async function getOpPerformanceDaily(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<OpDailyData> {
  const countryCode = parseSheetCountryParam(searchParams.country);
  const canonical = sheetCountryCanonical(countryCode);
  const from = parseOptionalDateParam(searchParams.from);
  const to = parseOptionalDateParam(searchParams.to);
  const range = await resolveDailyRange(canonical, from, to);
  if (!range) return { from: "", to: "", days: [] };

  const supabase = getOpsServiceDb();
  const { data, error } = await supabase.rpc("get_ops_op_daily", {
    p_country: canonical,
    p_from_date: range.from,
    p_to_date: range.to,
  });

  if (!error && data) {
    const payload = data as DailyRpc;
    return {
      from: String(payload.from ?? range.from).slice(0, 10),
      to: String(payload.to ?? range.to).slice(0, 10),
      days: (payload.days ?? []).map((row) => ({
        date: String(row.date).slice(0, 10),
        orders: Number(row.orders ?? 0),
        pendingConfirmation: Number(row.pendingConfirmation ?? 0),
        confirmation: Number(row.confirmation ?? 0),
        cancelled: Number(row.cancelled ?? 0),
        delivered: Number(row.delivered ?? 0),
        inProcess: Number(row.inProcess ?? 0),
        upsellPitched: Number(row.upsellPitched ?? 0),
        upsellAgreed: Number(row.upsellAgreed ?? 0),
        upsellDelivered: Number(row.upsellDelivered ?? 0),
        luckyDrawPitched: Number(row.luckyDrawPitched ?? 0),
        luckyDrawDelivered: Number(row.luckyDrawDelivered ?? 0),
        teams: (row.teams ?? []).map((team) => ({
          ...team,
          team: displayTeamName(team.team),
          total: Number(team.total ?? 0),
          cancelled: Number(team.cancelled ?? 0),
          delivered: Number(team.delivered ?? 0),
          inProcess: Number(team.inProcess ?? 0),
          approved: Number(team.approved ?? 0),
        })),
      })),
    };
  }

  return dailyFromFacts(canonical, range);
}

type FactLite = {
  order_date: string | null;
  status: string | null;
  cs_status: string | null;
  op_tag: string | null;
  upsell_pitched: boolean | null;
  upsell_agreed: boolean | null;
  reschedule_check: string | null;
};

function isCancelledStatus(status: string | null): boolean {
  return (status ?? "").toLowerCase().includes("cancel");
}

function isDeliveredStatus(status: string | null): boolean {
  const statusL = (status ?? "").toLowerCase();
  return statusL.includes("deliver") && !statusL.includes("undeliver");
}

async function dailyFromFacts(
  canonical: string | null,
  range: { from: string; to: string },
): Promise<OpDailyData> {
  const supabase = getOpsServiceDb();
  const pageSize = 1000;
  const facts: FactLite[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await withFactFilters(
      supabase
        .from("ops_op_facts")
        .select(
          "order_date,status,cs_status,op_tag,upsell_pitched,upsell_agreed,reschedule_check",
        )
        .order("order_date", { ascending: true })
        .range(offset, offset + pageSize - 1),
      canonical,
      range.from,
      range.to,
    );
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as FactLite[];
    facts.push(...batch);
    if (batch.length < pageSize) break;
  }

  const byDate = new Map<string, OpDailyRow>();

  for (const row of facts) {
    const date = row.order_date ? String(row.order_date).slice(0, 10) : "";
    if (!date) continue;
    let day = byDate.get(date);
    if (!day) {
      day = {
        date,
        orders: 0,
        pendingConfirmation: 0,
        confirmation: 0,
        cancelled: 0,
        delivered: 0,
        inProcess: 0,
        upsellPitched: 0,
        upsellAgreed: 0,
        upsellDelivered: 0,
        luckyDrawPitched: 0,
        luckyDrawDelivered: 0,
        teams: [],
      };
      byDate.set(date, day);
    }

    const cancelled = isCancelledStatus(row.status);
    const delivered = isDeliveredStatus(row.status);
    const cs = (row.cs_status ?? "").trim().toLowerCase();
    const team = displayTeamName(row.op_tag ?? "");
    const isAvi = team.toLowerCase() === "avi team";
    const lucky = (row.reschedule_check ?? "").toLowerCase().includes("team a");

    day.orders += 1;
    if (cs === "confirmation pending") day.pendingConfirmation += 1;
    if (cs === "approved" && !isAvi) day.confirmation += 1;
    if (cancelled) day.cancelled += 1;
    if (delivered) day.delivered += 1;
    if (!cancelled && !delivered) day.inProcess += 1;
    if (row.upsell_pitched === true) day.upsellPitched += 1;
    if (row.upsell_agreed === true) {
      day.upsellAgreed += 1;
      if (delivered) day.upsellDelivered += 1;
    }
    if (lucky) {
      day.luckyDrawPitched += 1;
      if (delivered) day.luckyDrawDelivered += 1;
    }

    let teamRow = day.teams.find((item) => item.team === team);
    if (!teamRow) {
      teamRow = {
        team,
        total: 0,
        cancelled: 0,
        delivered: 0,
        inProcess: 0,
        approved: 0,
      };
      day.teams.push(teamRow);
    }
    teamRow.total += 1;
    if (cancelled) teamRow.cancelled += 1;
    if (delivered) teamRow.delivered += 1;
    if (!cancelled && !delivered) teamRow.inProcess += 1;
    if (cs === "approved" && !isAvi) teamRow.approved += 1;
  }

  const days = [...byDate.values()].map((day) => ({
    ...day,
    teams: day.teams.sort((a, b) => a.team.localeCompare(b.team)),
  }));

  return { from: range.from, to: range.to, days };
}
