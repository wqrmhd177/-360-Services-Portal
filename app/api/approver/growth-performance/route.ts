import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";

/** Convert amount to AED. 1 AED = 78 PKR, 1 SAR = 0.98 AED */
function toAed(amount: number, currency: string): number {
  const c = (currency || "AED").toUpperCase();
  if (c === "AED") return amount;
  if (c === "PKR") return amount / 78;
  if (c === "SAR") return amount * 0.98;
  return amount; // fallback
}

/** Sum PR products totalAmount in AED */
function sumPrProductsToAed(products: Array<{ totalAmount?: number; currency?: string }> | null): number {
  if (!products || !Array.isArray(products)) return 0;
  return products.reduce((sum, p) => {
    const amt = typeof p.totalAmount === "number" ? p.totalAmount : 0;
    return sum + toAed(amt, p.currency || "AED");
  }, 0);
}

/** Margin = Total Amount - (Landed Cost Price * Quantity). Sum in AED */
function sumPrProductsMarginToAed(
  products: Array<{ totalAmount?: number; quantity?: number; landedCostPrice?: number; currency?: string }> | null
): number {
  if (!products || !Array.isArray(products)) return 0;
  return products.reduce((sum, p) => {
    const total = typeof p.totalAmount === "number" ? p.totalAmount : 0;
    const qty = typeof p.quantity === "number" ? p.quantity : 0;
    const landedCost = typeof p.landedCostPrice === "number" ? p.landedCostPrice : 0;
    const margin = total - landedCost * qty;
    return sum + toAed(margin, p.currency || "AED");
  }, 0);
}

/** Legacy PR: amount in AED */
function legacyPrAmountToAed(pr: { amount?: number; product_name?: string }): number {
  const amt = typeof pr.amount === "number" ? pr.amount : 0;
  return amt; // legacy PRs typically store AED
}

export interface GrowthPerformanceRow {
  growthUserEmail: string;
  growthUserName: string;
  quotationRequestsCount: number;
  approvedPrCount: number;
  deliveredPoCount: number;
  inprocessPoCount: number;
  deliveredPoAmountAed: number;
  inprocessPoAmountAed: number;
  totalAmountAed: number;
  deliveredPoMarginAed: number;
  inprocessPoMarginAed: number;
  totalMarginAed: number;
}

const DELIVERED_STATUS = "shipment_received_at_destination_warehouse";
const CANCELED_STATUS = "canceled";

interface PrData {
  id: string;
  created_by_email?: string;
  products?: Array<{ totalAmount?: number; quantity?: number; landedCostPrice?: number; currency?: string }>;
  amount?: number;
  product_name?: string;
}

/** Supabase may return pr as object or array depending on relation config */
interface PoWithPr {
  pr_id: string;
  status: string;
  pr?: PrData | PrData[];
}

export async function GET() {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canAccess = session.role === "approver" || session.isAdmin;
  if (!canAccess) {
    return NextResponse.json(
      { error: "Forbidden - Approver role required" },
      { status: 403 }
    );
  }

  try {
    const supabase = createSupabaseClient();

    // 1. Profiles for full names
    const { data: profiles } = await supabase
      .from("profiles")
      .select("email, full_name");
    const emailToName = new Map(
      (profiles ?? []).map((p: { email: string; full_name?: string }) => [
        p.email,
        p.full_name || p.email
      ])
    );

    // 2. Growth users = distinct created_by_email from qr + pr
    const [{ data: qrs }, { data: prs }, { data: posWithPr }] = await Promise.all([
      supabase.from("qr").select("id, created_by_email"),
      supabase.from("pr").select("id, created_by_email, products, amount, product_name"),
      supabase
        .from("po")
        .select("id, status, pr_id, pr!inner(id, created_by_email, products, amount, product_name)")
    ]);

    const growthEmails = new Set<string>();
    (qrs ?? []).forEach((q: { created_by_email: string }) => growthEmails.add(q.created_by_email));
    (prs ?? []).forEach((p: { created_by_email: string }) => growthEmails.add(p.created_by_email));

    const prMap = new Map<string, PrData>((prs ?? []).map((p) => [p.id, p as PrData]));

    const rows: GrowthPerformanceRow[] = Array.from(growthEmails).map((email) => {
      const name = emailToName.get(email) ?? email;

      const qrCount = (qrs ?? []).filter((q: { created_by_email: string }) => q.created_by_email === email).length;
      const approvedPrCount = (prs ?? []).filter(
        (p: { created_by_email: string; approval_status?: string }) =>
          p.created_by_email === email && p.approval_status === "approved"
      ).length;

      let deliveredPoCount = 0;
      let inprocessPoCount = 0;
      let deliveredPoAmountAed = 0;
      let inprocessPoAmountAed = 0;
      let deliveredPoMarginAed = 0;
      let inprocessPoMarginAed = 0;

      (posWithPr ?? []).forEach((po: PoWithPr) => {
        const rawPr = po.pr;
        const prData = (Array.isArray(rawPr) ? rawPr[0] : rawPr) ?? prMap.get(po.pr_id);
        if (!prData || prData.created_by_email !== email) return;

        // Skip canceled POs - they don't count toward delivered or inprocess
        if (po.status === CANCELED_STATUS) return;

        const products = prData.products;
        const hasProducts = products && Array.isArray(products) && products.length > 0;
        const poAmountAed = hasProducts
          ? sumPrProductsToAed(products)
          : legacyPrAmountToAed(prData);
        const poMarginAed = hasProducts ? sumPrProductsMarginToAed(products) : 0;

        if (po.status === DELIVERED_STATUS) {
          deliveredPoCount++;
          deliveredPoAmountAed += poAmountAed;
          deliveredPoMarginAed += poMarginAed;
        } else {
          inprocessPoCount++;
          inprocessPoAmountAed += poAmountAed;
          inprocessPoMarginAed += poMarginAed;
        }
      });

      const totalAmountAed = deliveredPoAmountAed + inprocessPoAmountAed;
      const totalMarginAed = deliveredPoMarginAed + inprocessPoMarginAed;

      return {
        growthUserEmail: email,
        growthUserName: name,
        quotationRequestsCount: qrCount,
        approvedPrCount,
        deliveredPoCount,
        inprocessPoCount,
        deliveredPoAmountAed: Math.round(deliveredPoAmountAed * 100) / 100,
        inprocessPoAmountAed: Math.round(inprocessPoAmountAed * 100) / 100,
        totalAmountAed: Math.round(totalAmountAed * 100) / 100,
        deliveredPoMarginAed: Math.round(deliveredPoMarginAed * 100) / 100,
        inprocessPoMarginAed: Math.round(inprocessPoMarginAed * 100) / 100,
        totalMarginAed: Math.round(totalMarginAed * 100) / 100
      };
    });

    // Sort by totalAmountAed descending
    rows.sort((a, b) => b.totalAmountAed - a.totalAmountAed);

    return NextResponse.json({ rows });
  } catch (error) {
    console.error("Error fetching growth performance:", error);
    return NextResponse.json(
      { error: "Failed to fetch growth performance" },
      { status: 500 }
    );
  }
}
