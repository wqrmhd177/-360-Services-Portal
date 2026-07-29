import { createSupabaseClient } from "@/lib/supabaseClient";

export type FinanceDashboardCounts = {
  pendingVerification: number;
  verifiedPrs: number;
  unpaidSupplierPos: number;
  unpaidDeliveryPos: number;
  totalPos: number;
  supplierPaidPos: number;
  deliveryPaidPos: number;
};

export type GrowthDashboardCounts = {
  qrOpen: number;
  qrResponded: number;
  qrConverted: number;
  prPendingApproval: number;
  prApproved: number;
  prFinancePending: number;
  prFinanceVerified: number;
};

export type ProcurementDashboardCounts = {
  openQrs: number;
  verifiedPrsReadyForPo: number;
  poOrderPlaced: number;
  poInTransit: number;
  poDelivered: number;
  poByStatus: Record<string, number>;
};

function num(v: unknown) {
  return Number(v) || 0;
}

export async function fetchFinanceDashboardCounts(): Promise<FinanceDashboardCounts> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc("get_finance_dashboard_counts");
  if (error) {
    throw new Error(error.message);
  }
  const p = (data ?? {}) as Record<string, unknown>;
  return {
    pendingVerification: num(p.pendingVerification),
    verifiedPrs: num(p.verifiedPrs),
    unpaidSupplierPos: num(p.unpaidSupplierPos),
    unpaidDeliveryPos: num(p.unpaidDeliveryPos),
    totalPos: num(p.totalPos),
    supplierPaidPos: num(p.supplierPaidPos),
    deliveryPaidPos: num(p.deliveryPaidPos),
  };
}

export async function fetchGrowthDashboardCounts(
  email: string | null,
): Promise<GrowthDashboardCounts> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc("get_growth_dashboard_counts", {
    p_email: email,
  });
  if (error) {
    throw new Error(error.message);
  }
  const p = (data ?? {}) as Record<string, unknown>;
  return {
    qrOpen: num(p.qrOpen),
    qrResponded: num(p.qrResponded),
    qrConverted: num(p.qrConverted),
    prPendingApproval: num(p.prPendingApproval),
    prApproved: num(p.prApproved),
    prFinancePending: num(p.prFinancePending),
    prFinanceVerified: num(p.prFinanceVerified),
  };
}

export async function fetchProcurementDashboardCounts(): Promise<ProcurementDashboardCounts> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc("get_procurement_dashboard_counts");
  if (error) {
    throw new Error(error.message);
  }
  const p = (data ?? {}) as Record<string, unknown>;
  const byStatus =
    p.poByStatus && typeof p.poByStatus === "object"
      ? (p.poByStatus as Record<string, number>)
      : {};
  return {
    openQrs: num(p.openQrs),
    verifiedPrsReadyForPo: num(p.verifiedPrsReadyForPo),
    poOrderPlaced: num(p.poOrderPlaced),
    poInTransit: num(p.poInTransit),
    poDelivered: num(p.poDelivered),
    poByStatus: byStatus,
  };
}
