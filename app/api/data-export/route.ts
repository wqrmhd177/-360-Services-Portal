import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";

type ExportType = "qr" | "pr" | "po";

function escapeCsvValue(val: unknown): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function csvRow(values: unknown[]): string {
  return values.map(escapeCsvValue).join(",");
}

export async function GET(request: NextRequest) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type") as ExportType | null;
  if (!type || !["qr", "pr", "po"].includes(type)) {
    return NextResponse.json({ error: "Invalid type. Use qr, pr, or po." }, { status: 400 });
  }

  const supabase = createSupabaseClient();
  const dateStr = new Date().toISOString().slice(0, 10);

  try {
    // ----- QR: Option B - one row per response line, each field in its own column -----
    if (type === "qr") {
      let query = supabase.from("qr").select("*").order("created_at", { ascending: false });
      if (!session.isAdmin && session.role === "growth") {
        query = query.eq("created_by_email", session.email);
      }
      const { data: qrs, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const headers = [
        "qr_id",
        "qr_number",
        "created_by_email",
        "reseller_code",
        "reseller_contact_no",
        "reseller_country",
        "existing_seller",
        "gold_seller",
        "service_needed",
        "countries",
        "shipping_type",
        "status",
        "remarks",
        "qr_created_at",
        "qr_updated_at",
        "detail_index",
        "product_name",
        "quantity",
        "target_price",
        "destination_country",
        "destination_countries",
        "country_details",
        "country_of_purchase",
        "detail_shipping_type",
        "detail_movement_type",
        "cost_per_unit",
        "freight_cost_per_unit",
        "landed_cost_per_unit",
        "eta_days",
        "response_remarks",
        "response_destination_country",
        "response_country_of_purchase",
        "response_shipping_type",
        "response_movement_type",
        "response_submitted_at",
        "response_last_edited_at",
      ];
      const rows: string[] = [csvRow(headers)];

      for (const qr of qrs ?? []) {
        const purchaseDetails = Array.isArray(qr.purchase_details) ? qr.purchase_details : [];
        let procurementResponse: Record<string | number, any> = {};
        if (qr.procurement_response) {
          try {
            procurementResponse =
              typeof qr.procurement_response === "string"
                ? JSON.parse(qr.procurement_response)
                : qr.procurement_response;
          } catch {
            procurementResponse = {};
          }
        }

        const qrPrefix = [
          qr.id,
          qr.qr_number ?? "",
          qr.created_by_email ?? "",
          qr.reseller_code ?? "",
          qr.reseller_contact_no ?? "",
          qr.reseller_country ?? "",
          qr.existing_seller ?? "",
          qr.gold_seller ?? "",
          qr.service_needed ?? "",
          Array.isArray(qr.countries) ? qr.countries.join("; ") : String(qr.countries ?? ""),
          qr.shipping_type ?? "",
          qr.status ?? "",
          qr.remarks ?? "",
          qr.created_at ?? "",
          qr.updated_at ?? "",
        ];

        if (purchaseDetails.length === 0) {
          rows.push(
            csvRow([
              ...qrPrefix,
              0,
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "", // country_details
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
            ])
          );
          continue;
        }

        for (let detailIndex = 0; detailIndex < purchaseDetails.length; detailIndex++) {
          const detail = purchaseDetails[detailIndex] ?? {};
          const resp = procurementResponse[detailIndex];
          const countryDetailsStr =
            Array.isArray(detail.countryDetails) && detail.countryDetails.length > 0
              ? detail.countryDetails
                  .map(
                    (cd: { country: string; quantity: number; targetPrice: number }) =>
                      `${cd.country}: ${cd.quantity} qty, ${cd.targetPrice ?? ""}`
                  )
                  .join("; ")
              : "";
          const detailCols = [
            detailIndex,
            detail.productName ?? detail.product_name ?? "",
            detail.quantity ?? "",
            detail.targetPrice ?? detail.target_price ?? "",
            detail.destinationCountry ?? detail.destination_country ?? "",
            Array.isArray(detail.destinationCountries)
              ? detail.destinationCountries.join("; ")
              : detail.destinationCountries ?? "",
            countryDetailsStr,
            detail.countryOfPurchase ?? detail.country_of_purchase ?? "",
            detail.shippingType ?? detail.shipping_type ?? "",
            detail.movementType ?? detail.movement_type ?? "",
          ];

          const hasCombinations =
            resp?.combinations && Array.isArray(resp.combinations) && resp.combinations.length > 0;
          if (hasCombinations) {
            for (const comb of resp.combinations) {
              rows.push(
                csvRow([
                  ...qrPrefix,
                  ...detailCols,
                  comb.costPerUnit ?? "",
                  comb.freightCostPerUnit ?? "",
                  comb.landedCostPerUnit ?? "",
                  comb.etaDays ?? "",
                  comb.remarks ?? "",
                  comb.destinationCountry ?? "",
                  comb.countryOfPurchase ?? "",
                  comb.shippingType ?? "",
                  comb.movementType ?? "",
                  comb.submittedAt ?? "",
                  comb.lastEditedAt ?? "",
                ])
              );
            }
          } else if (resp && (resp.costPerUnit != null || resp.landedCostPerUnit != null)) {
            rows.push(
              csvRow([
                ...qrPrefix,
                ...detailCols,
                resp.costPerUnit ?? "",
                resp.freightCostPerUnit ?? "",
                resp.landedCostPerUnit ?? "",
                resp.etaDays ?? "",
                resp.remarks ?? "",
                "",
                "",
                "",
                "",
                resp.submittedAt ?? "",
                resp.lastEditedAt ?? "",
              ])
            );
          } else {
            rows.push(
              csvRow([
                ...qrPrefix,
                ...detailCols,
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
              ])
            );
          }
        }
      }

      const csv = "\uFEFF" + rows.join("\r\n");
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="qr-export-${dateStr}.csv"`,
        },
      });
    }

    // ----- PR: Option B - one row per product line, each field in its own column -----
    if (type === "pr") {
      let query = supabase.from("pr").select("*").order("created_at", { ascending: false });
      if (!session.isAdmin && session.role === "growth") {
        query = query.eq("created_by_email", session.email);
      }
      const { data: prs, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const headers = [
        "pr_id",
        "pr_number",
        "from_qr_id",
        "created_by_email",
        "reseller_code",
        "payment_method",
        "reference_files",
        "remarks",
        "approval_status",
        "approved_by_email",
        "approval_remarks",
        "approved_at",
        "finance_verification_status",
        "finance_verified_by_email",
        "finance_remarks",
        "finance_verified_at",
        "rejection_reason",
        "rejected_at",
        "po_created",
        "pr_status",
        "seller_channel_name",
        "seller_user_id",
        "seller_service_type",
        "payment_type",
        "transaction_id",
        "payment_proof_path",
        "created_at",
        "updated_at",
        "product_index",
        "product_name",
        "sku_code",
        "destination_country",
        "quantity",
        "selling_price_per_unit",
        "currency",
        "total_amount",
        "shipping_type",
        "movement_type",
        "product_remarks",
      ];
      const rows: string[] = [csvRow(headers)];

      for (const pr of prs ?? []) {
        const prPrefix = [
          pr.id,
          pr.pr_number ?? "",
          pr.from_qr_id ?? "",
          pr.created_by_email ?? "",
          pr.reseller_code ?? "",
          pr.payment_method ?? "",
          Array.isArray(pr.reference_files) ? pr.reference_files.join("; ") : String(pr.reference_files ?? ""),
          pr.remarks ?? "",
          pr.approval_status ?? "",
          pr.approved_by_email ?? "",
          pr.approval_remarks ?? "",
          pr.approved_at ?? "",
          pr.finance_verification_status ?? "",
          pr.finance_verified_by_email ?? "",
          pr.finance_remarks ?? "",
          pr.finance_verified_at ?? "",
          pr.rejection_reason ?? "",
          pr.rejected_at ?? "",
          pr.po_created ?? false,
          pr.pr_status ?? "",
          pr.seller_channel_name ?? "",
          pr.seller_user_id ?? "",
          pr.seller_service_type ?? "",
          pr.payment_type ?? "",
          pr.transaction_id ?? "",
          pr.payment_proof_path ?? "",
          pr.created_at ?? "",
          pr.updated_at ?? "",
        ];

        const products = Array.isArray(pr.products) ? pr.products : [];
        const hasProducts = products.length > 0;

        if (hasProducts) {
          products.forEach((prod: any, productIndex: number) => {
            rows.push(
              csvRow([
                ...prPrefix,
                productIndex,
                prod.productName ?? prod.product_name ?? "",
                prod.skuCode ?? prod.sku_code ?? "",
                prod.destinationCountry ?? prod.destination_country ?? "",
                prod.quantity ?? "",
                prod.sellingPricePerUnit ?? prod.rate ?? "",
                prod.currency ?? "",
                prod.totalAmount ?? prod.amount ?? "",
                prod.shippingType ?? prod.shipping_type ?? "",
                prod.movementType ?? prod.movement_type ?? "",
                prod.remarks ?? "",
              ])
            );
          });
        } else {
          // Legacy single-product: one row from legacy fields
          rows.push(
            csvRow([
              ...prPrefix,
              0,
              pr.product_name ?? "",
              pr.sku_code ?? "",
              Array.isArray(pr.countries) && pr.countries.length > 0 ? pr.countries[0] : "",
              pr.quantity ?? "",
              pr.rate ?? "",
              "",
              pr.amount ?? "",
              pr.shipping_type ?? "",
              pr.movement_type ?? "",
              pr.remarks ?? "",
            ])
          );
        }
      }

      const csv = "\uFEFF" + rows.join("\r\n");
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="pr-export-${dateStr}.csv"`,
        },
      });
    }

    // ----- PO: Option B - one row per PO, every field in its own column (all data) -----
    if (type === "po") {
      const { data: pos, error } = await supabase
        .from("po")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const headers = [
        "id",
        "po_number",
        "pr_id",
        "created_by_email",
        "status",
        "po_type",
        "supplier_name",
        "supplier_location",
        "supplier_invoice_file",
        "supplier_payment_status",
        "supplier_payment_amount",
        "supplier_payment_remarks",
        "delivery_partner",
        "delivery_partner_tracking_id",
        "delivery_partner_invoice_file",
        "delivery_partner_payment_status",
        "delivery_partner_payment_amount",
        "delivery_partner_remarks",
        "remarks",
        "created_at",
        "updated_at",
        "delivery_dates_json",
        "status_history_json",
      ];
      const rows: string[] = [csvRow(headers)];
      for (const po of pos ?? []) {
        rows.push(
          csvRow([
            po.id,
            po.po_number ?? "",
            po.pr_id ?? "",
            po.created_by_email ?? "",
            po.status ?? "",
            po.po_type ?? "",
            po.supplier_name ?? "",
            po.supplier_location ?? "",
            po.supplier_invoice_file ?? "",
            po.supplier_payment_status ?? "",
            po.supplier_payment_amount ?? "",
            po.supplier_payment_remarks ?? "",
            po.delivery_partner ?? "",
            po.delivery_partner_tracking_id ?? "",
            po.delivery_partner_invoice_file ?? "",
            po.delivery_partner_payment_status ?? "",
            po.delivery_partner_payment_amount ?? "",
            po.delivery_partner_remarks ?? "",
            po.remarks ?? "",
            po.created_at ?? "",
            po.updated_at ?? "",
            po.delivery_dates != null ? JSON.stringify(po.delivery_dates) : "",
            po.status_history != null ? JSON.stringify(po.status_history) : "",
          ])
        );
      }
      const csv = "\uFEFF" + rows.join("\r\n");
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="po-export-${dateStr}.csv"`,
        },
      });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (err) {
    console.error("Data export error:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
