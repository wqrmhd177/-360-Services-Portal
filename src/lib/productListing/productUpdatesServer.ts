import { createSupabaseServiceClient } from "@/lib/supabaseClient";
import {
  fetchPriceRequestsByStatus,
  approvePriceChange,
  rejectPriceChange,
} from "@/lib/productListing/priceHistoryHelpers";
import {
  fetchStatusRequestsByStatus,
  approveStatusChangeRequest,
  rejectStatusChangeRequest,
} from "@/lib/productListing/variantStatusChangeHelpers";
import type {
  PlPriceHistoryEntry,
  PlVariantStatusChangeRequest,
} from "@/lib/productListing/types";

type StatusTab = "pending" | "approved" | "rejected" | "all";

function toMinuteBucket(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
}

export type MergedProductUpdateRequest =
  | (PlPriceHistoryEntry & {
      request_type: "price";
      product_title?: string;
      option_values?: Record<string, string>;
      variant_image?: string[] | null;
      product_image?: string | string[] | null;
    })
  | (PlVariantStatusChangeRequest & {
      request_type: "status";
      product_title?: string;
      option_values?: Record<string, string>;
      variant_image?: string[] | null;
      product_image?: string | string[] | null;
    })
  | {
      id: string;
      request_type: "both";
      product_id: number;
      variant_id: number;
      created_at: string;
      created_by?: string | null;
      status: string;
      reviewed_at?: string | null;
      reviewed_by?: string | null;
      product_title?: string;
      option_values?: Record<string, string>;
      variant_image?: string[] | null;
      product_image?: string | string[] | null;
      previous_price?: number;
      updated_price?: number;
      previous_active?: boolean;
      updated_active?: boolean;
      price_request_id: string;
      status_request_id: string;
      request_scope?: string;
    };

export async function fetchMergedProductUpdates(
  tab: StatusTab,
): Promise<MergedProductUpdateRequest[]> {
  const supabase = createSupabaseServiceClient();
  const [priceData, statusData] = await Promise.all([
    fetchPriceRequestsByStatus(tab),
    fetchStatusRequestsByStatus(tab),
  ]);

  const allVariantIds = Array.from(
    new Set([...priceData.map((r) => r.variant_id), ...statusData.map((r) => r.variant_id)]),
  );
  let variantMeta = new Map<
    number,
    { option_values?: Record<string, string>; image?: string[] | null }
  >();
  if (allVariantIds.length > 0) {
    const { data } = await supabase
      .from("pl_product_variants")
      .select("variant_id, option_values, image")
      .in("variant_id", allVariantIds);
    variantMeta = new Map(
      (data || []).map(
        (v: { variant_id: number; option_values?: Record<string, string>; image?: string[] | null }) =>
          [v.variant_id, v],
      ),
    );
  }

  const allProductIds = Array.from(
    new Set([...priceData.map((r) => r.product_id), ...statusData.map((r) => r.product_id)]),
  );
  let productMeta = new Map<
    number,
    { product_title: string; image?: string | string[] | null }
  >();
  if (allProductIds.length > 0) {
    const { data } = await supabase
      .from("pl_products")
      .select("product_id, product_title, image")
      .in("product_id", allProductIds);
    productMeta = new Map(
      (data || []).map(
        (p: { product_id: number; product_title: string; image?: string | string[] | null }) =>
          [p.product_id, p],
      ),
    );
  }

  const groups = new Map<
    string,
    { price?: PlPriceHistoryEntry; status?: PlVariantStatusChangeRequest }
  >();

  priceData.forEach((r) => {
    const key = `${r.status}|${r.product_id}|${r.variant_id}|${r.created_by ?? ""}|${toMinuteBucket(r.created_at)}`;
    const ex = groups.get(key) ?? {};
    groups.set(key, { ...ex, price: r });
  });

  statusData.forEach((r) => {
    const scope = r.request_scope ?? "variant";
    const key =
      scope === "product"
        ? `${r.status}|product|${r.product_id}|${r.created_by ?? ""}|${toMinuteBucket(r.created_at)}`
        : `${r.status}|${r.product_id}|${r.variant_id}|${r.created_by ?? ""}|${toMinuteBucket(r.created_at)}`;
    const ex = groups.get(key) ?? {};
    groups.set(key, { ...ex, status: r });
  });

  const getVariantInfo = (vid: number) => variantMeta.get(vid);
  const getProductInfo = (pid: number) => productMeta.get(pid);

  return Array.from(groups.values())
    .map((g): MergedProductUpdateRequest => {
      if (g.price && g.status) {
        const vm = getVariantInfo(g.price.variant_id);
        const pm = getProductInfo(g.price.product_id);
        return {
          id: `${g.price.id}|${g.status.id}`,
          request_type: "both",
          product_id: g.price.product_id,
          variant_id: g.price.variant_id,
          created_at:
            g.price.created_at > g.status.created_at ? g.price.created_at : g.status.created_at,
          created_by: g.price.created_by ?? g.status.created_by,
          status: g.price.status,
          reviewed_at: g.price.reviewed_at ?? g.status.reviewed_at,
          reviewed_by: g.price.reviewed_by ?? g.status.reviewed_by,
          product_title: pm?.product_title,
          option_values: vm?.option_values ?? undefined,
          variant_image: vm?.image,
          product_image: pm?.image,
          previous_price: g.price.previous_price,
          updated_price: g.price.updated_price,
          previous_active: g.status.previous_active,
          updated_active: g.status.updated_active,
          price_request_id: g.price.id,
          status_request_id: g.status.id,
          request_scope: g.status.request_scope,
        };
      }

      if (g.price) {
        const vm = getVariantInfo(g.price.variant_id);
        const pm = getProductInfo(g.price.product_id);
        return {
          ...g.price,
          request_type: "price",
          product_title: pm?.product_title,
          option_values: vm?.option_values ?? undefined,
          variant_image: vm?.image,
          product_image: pm?.image,
        };
      }

      const s = g.status!;
      const vm = getVariantInfo(s.variant_id);
      const pm = getProductInfo(s.product_id);
      return {
        ...s,
        request_type: "status",
        product_title: pm?.product_title,
        option_values: vm?.option_values ?? undefined,
        variant_image: vm?.image,
        product_image: pm?.image,
      };
    })
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export async function processProductUpdateAction(
  action: "approve" | "reject",
  req: {
    request_type: "price" | "status" | "both";
    id: string;
    price_request_id?: string;
    status_request_id?: string;
  },
  reviewedBy: string,
): Promise<boolean> {
  if (action === "approve") {
    if (req.request_type === "price") {
      return approvePriceChange(req.id, reviewedBy);
    }
    if (req.request_type === "status") {
      return approveStatusChangeRequest(req.id, reviewedBy);
    }
    const a = await approvePriceChange(req.price_request_id!, reviewedBy);
    const b = await approveStatusChangeRequest(req.status_request_id!, reviewedBy);
    return a && b;
  }

  if (req.request_type === "price") {
    return rejectPriceChange(req.id, reviewedBy);
  }
  if (req.request_type === "status") {
    return rejectStatusChangeRequest(req.id, reviewedBy);
  }
  const a = await rejectPriceChange(req.price_request_id!, reviewedBy);
  const b = await rejectStatusChangeRequest(req.status_request_id!, reviewedBy);
  return a && b;
}
