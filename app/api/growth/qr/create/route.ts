import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { isLogisticsService, isMovementsService, isSourcingService } from "@/lib/serviceTypes";
import type { MovementType, ShippingType } from "@/types/workflows";
import { notifyStandardUsers } from "@/lib/notifications";
import { requireWriteAccess } from "@/lib/accessControl";
import {
  enrichPurchaseDetailForStorage,
  getPurchaseDetailLabel,
  normalizeCountryDetailRow,
} from "@/lib/qrPurchaseDetails";

export async function POST(request: Request) {
  const session = getPortalSession();
  const denied = requireWriteAccess(session, ["growth"], "Forbidden - Growth role required to create QR");
  if (denied) return denied;

  try {
    const email = session!.email;

    const formData = await request.formData();
    const resellerCode = String(formData.get("reseller_code") ?? "");
    const resellerContactNo = String(formData.get("reseller_contact_no") ?? "");
    const resellerCountry = String(formData.get("reseller_country") ?? "");
    const existingSeller = String(formData.get("existing_seller") ?? "No");
    const goldSeller = String(formData.get("gold_seller") ?? "No");
    const serviceNeeded = String(formData.get("service_needed") ?? "");
    const countriesRaw = String(formData.get("countries") ?? "");
    const shippingType = String(formData.get("shipping_type") ?? "sea") as ShippingType;
    const shippingTypeByCountryRaw = String(formData.get("shipping_type_by_country") ?? "{}");
    const movementTypeByCountryRaw = String(formData.get("movement_type_by_country") ?? "{}");
    const purchaseDetailsRaw = String(formData.get("purchase_details") ?? "[]");

    const countries = JSON.parse(countriesRaw) as string[];
    const shippingTypeByCountry = JSON.parse(shippingTypeByCountryRaw) as Record<
      string,
      ShippingType
    >;
    const movementTypeByCountry = JSON.parse(movementTypeByCountryRaw) as Record<
      string,
      MovementType
    >;
    const purchaseDetails = JSON.parse(purchaseDetailsRaw);

    if (
      !resellerCode ||
      !resellerContactNo ||
      !resellerCountry ||
      !serviceNeeded ||
      purchaseDetails.length === 0
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (countries.length === 0) {
      return NextResponse.json({ error: "At least one country is required" }, { status: 400 });
    }

    const isLogistics = isLogisticsService(serviceNeeded);
    const isMovements = isMovementsService(serviceNeeded);
    const isSourcing = isSourcingService(serviceNeeded);

    // Normalize and validate purchase details
    const normalizedDetails = purchaseDetails.map((detail: Record<string, unknown>) => {
      if (isLogistics) {
        const shipTo = String(detail.shipTo ?? "").trim();
        return {
          ...detail,
          destinationCountry: shipTo || detail.destinationCountry,
          destinationCountries: shipTo ? [shipTo] : undefined,
          quantity: detail.noOfCartons ? Number(detail.noOfCartons) : 0,
        };
      }

      const hasCountries =
        Array.isArray(detail.destinationCountries) && detail.destinationCountries.length > 0;
      const hasCountry =
        detail.destinationCountry && String(detail.destinationCountry).trim() !== "";
      const destinationCountries: string[] = hasCountries
        ? (detail.destinationCountries as string[])
        : hasCountry
          ? [String(detail.destinationCountry)]
          : [];

      if (isMovements) {
        const countryDetails =
          Array.isArray(detail.countryDetails) && detail.countryDetails.length > 0
            ? detail.countryDetails.map((cd) => {
                const row = normalizeCountryDetailRow(cd as Record<string, unknown>);
                return { ...row, targetPrice: row.unitPrice };
              })
            : undefined;

        return enrichPurchaseDetailForStorage({
          ...detail,
          destinationCountries: destinationCountries.length > 0 ? destinationCountries : undefined,
          destinationCountry:
            destinationCountries.length === 1 ? destinationCountries[0] : detail.destinationCountry,
          countryDetails: countryDetails?.length ? countryDetails : undefined,
        });
      }

      const countryDetails =
        Array.isArray(detail.countryDetails) && detail.countryDetails.length > 0
          ? detail.countryDetails.map((cd) => ({
              country: String((cd as Record<string, unknown>)?.country ?? ""),
              quantity: Number((cd as Record<string, unknown>)?.quantity ?? 0),
              targetPrice: Number(
                (cd as Record<string, unknown>)?.targetPrice ??
                  (cd as Record<string, unknown>)?.unitPrice ??
                  0
              ),
              remarks:
                (cd as Record<string, unknown>)?.remarks != null
                  ? String((cd as Record<string, unknown>).remarks)
                  : undefined,
              currency:
                (cd as Record<string, unknown>)?.currency === "SAR" ||
                (cd as Record<string, unknown>)?.currency === "PKR" ||
                (cd as Record<string, unknown>)?.currency === "AED"
                  ? ((cd as Record<string, unknown>).currency as "AED" | "SAR" | "PKR")
                  : undefined,
            }))
          : undefined;
      const quantity =
        detail.quantity != null && detail.quantity !== ""
          ? Number(detail.quantity)
          : (countryDetails?.reduce((s, cd) => s + (cd.quantity || 0), 0) ?? 0);
      const targetPrice =
        detail.targetPrice != null && detail.targetPrice !== ""
          ? Number(detail.targetPrice)
          : (countryDetails?.[0]?.targetPrice ?? undefined);

      return {
        ...detail,
        destinationCountries: destinationCountries.length > 0 ? destinationCountries : undefined,
        destinationCountry:
          destinationCountries.length === 1 ? destinationCountries[0] : detail.destinationCountry,
        countryDetails: countryDetails?.length ? countryDetails : undefined,
        quantity,
        targetPrice,
      };
    });

    for (const detail of normalizedDetails) {
      if (isMovements) {
        const fromSku = String(detail.fromSku ?? "").trim();
        const toSku = String(detail.toSku ?? "").trim();
        if (!fromSku || !toSku) {
          return NextResponse.json(
            { error: "Each purchase detail must have From (SKU) and To (SKU)" },
            { status: 400 }
          );
        }
      } else if (!detail.productName) {
        return NextResponse.json(
          { error: "Each purchase detail must have a product name" },
          { status: 400 }
        );
      }

      if (isLogistics) {
        if (!detail.shipFrom?.trim()) {
          return NextResponse.json(
            { error: "Each purchase detail must have a ship-from address" },
            { status: 400 }
          );
        }
        if (!detail.shipTo?.trim()) {
          return NextResponse.json(
            { error: "Each purchase detail must have a ship-to address" },
            { status: 400 }
          );
        }
        if (!detail.shippingType) {
          return NextResponse.json(
            { error: "Each purchase detail must have a shipping type" },
            { status: 400 }
          );
        }
        if (!detail.productType) {
          return NextResponse.json(
            { error: "Each purchase detail must have a product type" },
            { status: 400 }
          );
        }
        if (!detail.noOfCartons || Number(detail.noOfCartons) <= 0) {
          return NextResponse.json(
            { error: "Each purchase detail must have number of cartons > 0" },
            { status: 400 }
          );
        }
        continue;
      }

      const hasDest =
        (Array.isArray(detail.destinationCountries) && detail.destinationCountries.length > 0) ||
        (detail.destinationCountry && String(detail.destinationCountry).trim() !== "");
      if (!hasDest) {
        return NextResponse.json(
          { error: "Each purchase detail must have at least one destination country" },
          { status: 400 }
        );
      }

      if (
        serviceNeeded === "Sourcing & Logistics" &&
        (!detail.shipToAddress || !String(detail.shipToAddress).trim())
      ) {
        return NextResponse.json(
          { error: "Ship-to address is required for Sourcing & Logistics" },
          { status: 400 }
        );
      }

      const hasCountryDetails =
        Array.isArray(detail.countryDetails) && detail.countryDetails.length > 0;
      const destCountries = detail.destinationCountries?.length
        ? detail.destinationCountries
        : detail.destinationCountry
          ? [detail.destinationCountry]
          : [];
      if (hasCountryDetails) {
        const missing = destCountries.filter(
          (c: string) => !detail.countryDetails.some((cd: any) => cd.country === c)
        );
        if (missing.length > 0) {
          return NextResponse.json(
            {
              error: isMovements
                ? "Each destination country must have quantity and unit price"
                : "Each destination country must have quantity and target price",
            },
            { status: 400 }
          );
        }
        const invalid = detail.countryDetails.find(
          (cd: { quantity?: number; unitPrice?: number; targetPrice?: number }) => {
            const price = isMovements
              ? (cd.unitPrice ?? cd.targetPrice ?? 0)
              : (cd.targetPrice ?? cd.unitPrice ?? 0);
            return (cd.quantity ?? 0) < 0 || price < 0;
          }
        );
        if (invalid) {
          return NextResponse.json(
            {
              error: isMovements
                ? "Per-country quantity and unit price must be >= 0"
                : "Per-country quantity and target price must be >= 0",
            },
            { status: 400 }
          );
        }
        const totalQty = detail.countryDetails.reduce(
          (s: number, cd: any) => s + (cd.quantity || 0),
          0
        );
        if (totalQty <= 0) {
          return NextResponse.json(
            { error: "At least one destination country must have quantity > 0" },
            { status: 400 }
          );
        }
      } else {
        if (!detail.quantity || detail.quantity <= 0) {
          return NextResponse.json(
            { error: "Each purchase detail must have quantity > 0" },
            { status: 400 }
          );
        }
        if (
          !isSourcing &&
          (detail.targetPrice == null ||
            detail.targetPrice === "" ||
            Number(detail.targetPrice) < 0)
        ) {
          return NextResponse.json(
            { error: "Target price is required for this service" },
            { status: 400 }
          );
        }
      }
    }

    const supabase = createSupabaseClient();
    const { data: newQr, error } = await supabase
      .from("qr")
      .insert({
        created_by_email: email,
        reseller_code: resellerCode,
        reseller_contact_no: resellerContactNo,
        reseller_country: resellerCountry,
        existing_seller: existingSeller,
        gold_seller: goldSeller,
        service_needed: serviceNeeded,
        countries,
        shipping_type: shippingType,
        shipping_type_by_country: shippingTypeByCountry,
        movement_type_by_country: movementTypeByCountry,
        purchase_details: normalizedDetails,
      })
      .select("id, qr_number")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If qr_number is not generated by trigger, generate it manually
    let qrNumber = newQr.qr_number;
    if (!qrNumber) {
      const { data: latestQr } = await supabase
        .from("qr")
        .select("qr_number")
        .not("qr_number", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      let nextNum = 1;
      if (latestQr?.qr_number) {
        const match = latestQr.qr_number.match(/QR-(\d+)/);
        if (match) {
          nextNum = parseInt(match[1], 10) + 1;
        }
      }
      qrNumber = `QR-${String(nextNum).padStart(3, "0")}`;

      await supabase.from("qr").update({ qr_number: qrNumber }).eq("id", newQr.id);
    }

    try {
      const productNames = normalizedDetails
        .map((d: Record<string, unknown>) =>
          getPurchaseDetailLabel(d as { productName?: string; fromSku?: string; toSku?: string })
        )
        .join(", ");
      await notifyStandardUsers(
        { creatorEmail: email, roles: ["admin", "approver", "procurement"] },
        "qr_created",
        {
          qr_id: newQr.id,
          qr_number: qrNumber,
          message: `New QR ${qrNumber} created for ${productNames}`,
        }
      );
    } catch (notifError) {
      console.error("Failed to send notifications:", notifError);
    }

    return NextResponse.json({ ok: true, qr_id: newQr.id, qr_number: qrNumber });
  } catch (err) {
    console.error("QR creation error:", err);
    return NextResponse.json({ error: "Failed to create QR" }, { status: 500 });
  }
}
