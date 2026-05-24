import { headers } from "next/headers";
import { getProcurementPOs } from "@/lib/procurementPos";
import PurchaseOrdersClient from "@/components/procurement/PurchaseOrdersClient";

/** Always fetch POs on the server when this page is opened (no cached empty list). */
export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage() {
  let initialPos: Awaited<ReturnType<typeof getProcurementPOs>> = [];
  try {
    initialPos = await getProcurementPOs();
    // If direct Supabase returned empty, try same data via API (same code path as client fallback)
    if (initialPos.length === 0) {
      try {
        const headersList = await headers();
        const host = headersList.get("host") ?? "localhost:3000";
        const protocol = host.includes("localhost") ? "http" : "https";
        const res = await fetch(`${protocol}://${host}/api/procurement/pos`, {
          cache: "no-store",
          headers: { "Accept": "application/json" },
        });
        if (res.ok) {
          const data = (await res.json()) as { pos?: unknown[] };
          const list = data?.pos ?? [];
          if (Array.isArray(list) && list.length > 0) {
            initialPos = list as Awaited<ReturnType<typeof getProcurementPOs>>;
          }
        }
      } catch (_) {
        // ignore fallback fetch errors
      }
    }
  } catch (e) {
    console.error("[Purchase Orders page] getProcurementPOs failed:", e);
  }
  return <PurchaseOrdersClient initialPos={initialPos ?? []} />;
}
