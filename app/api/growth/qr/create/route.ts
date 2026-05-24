import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { isZambeelLikeService } from "@/lib/serviceTypes";
import type { MovementType, ShippingType } from "@/types/workflows";
import { getUsersByRole, notifyMultipleUsers } from "@/lib/notifications";

export async function POST(request: Request) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canCreate = session.role === "growth" || session.isAdmin;
  if (!canCreate) {
    return NextResponse.json(
      { error: "Forbidden - Growth role required to create QR" },
      { status: 403 }
    );
  }

  try {
    const email = session.email;

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

    const isSourcingService =
      isZambeelLikeService(serviceNeeded) ||
      serviceNeeded === "Sourcing & Logistics" ||
      serviceNeeded === "Sourcing only";

    // Normalize and validate purchase details
    const normalizedDetails = purchaseDetails.map((detail: any) => {
      const hasCountries = Array.isArray(detail.destinationCountries) && detail.destinationCountries.length > 0;
      const hasCountry = detail.destinationCountry && String(detail.destinationCountry).trim() !== "";
      const destinationCountries = hasCountries
        ? detail.destinationCountries
        : hasCountry
          ? [detail.destinationCountry]
          : [];
      const countryDetails = Array.isArray(detail.countryDetails) && detail.countryDetails.length > 0
        ? detail.countryDetails.map((cd: any) => ({
            country: String(cd?.country ?? ""),
            quantity: Number(cd?.quantity ?? 0),
            targetPrice: Number(cd?.targetPrice ?? 0),
          }))
        : undefined;
      const quantity = detail.quantity != null && detail.quantity !== "" ? Number(detail.quantity) : (countryDetails?.reduce((s: number, cd: any) => s + (cd.quantity || 0), 0) ?? 0);
      const targetPrice = detail.targetPrice != null && detail.targetPrice !== "" ? Number(detail.targetPrice) : (countryDetails?.[0]?.targetPrice ?? undefined);
      return {
        ...detail,
        destinationCountries: destinationCountries.length > 0 ? destinationCountries : undefined,
        destinationCountry: destinationCountries.length === 1 ? destinationCountries[0] : detail.destinationCountry,
        countryDetails: countryDetails?.length ? countryDetails : undefined,
        quantity,
        targetPrice,
      };
    });

    for (const detail of normalizedDetails) {
      if (!detail.productName) {
        return NextResponse.json(
          { error: "Each purchase detail must have a product name" },
          { status: 400 }
        );
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
      const hasCountryDetails = Array.isArray(detail.countryDetails) && detail.countryDetails.length > 0;
      const destCountries = detail.destinationCountries?.length ? detail.destinationCountries : (detail.destinationCountry ? [detail.destinationCountry] : []);
      if (hasCountryDetails) {
        const missing = destCountries.filter((c: string) => !detail.countryDetails.some((cd: any) => cd.country === c));
        if (missing.length > 0) {
          return NextResponse.json(
            { error: "Each destination country must have quantity and target price" },
            { status: 400 }
          );
        }
        const invalid = detail.countryDetails.find((cd: any) => (cd.quantity ?? 0) < 0 || (cd.targetPrice ?? 0) < 0);
        if (invalid) {
          return NextResponse.json(
            { error: "Per-country quantity and target price must be >= 0" },
            { status: 400 }
          );
        }
        const totalQty = detail.countryDetails.reduce((s: number, cd: any) => s + (cd.quantity || 0), 0);
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
        if (!isSourcingService && (detail.targetPrice == null || detail.targetPrice === "" || Number(detail.targetPrice) < 0)) {
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
        purchase_details: normalizedDetails
      })
      .select("id, qr_number")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If qr_number is not generated by trigger, generate it manually
    let qrNumber = newQr.qr_number;
    if (!qrNumber) {
      // Fetch the latest QR number to generate the next one
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
      
      // Update the QR with the generated number
      await supabase
        .from("qr")
        .update({ qr_number: qrNumber })
        .eq("id", newQr.id);
    }

    // Notify Approver and Procurement teams about the new QR
    try {
      const approverEmails = await getUsersByRole("approver");
      const procurementEmails = await getUsersByRole("procurement");
      const allRecipientsEmails = [...approverEmails, ...procurementEmails];

      if (allRecipientsEmails.length > 0) {
        const productNames = purchaseDetails.map((d: any) => d.productName).join(", ");
        await notifyMultipleUsers(allRecipientsEmails, "qr_created", {
          qr_id: newQr.id,
          qr_number: qrNumber,
          message: `New QR ${qrNumber} created for ${productNames}`
        });
      }
    } catch (notifError) {
      console.error("Failed to send notifications:", notifError);
      // Don't fail the QR creation if notifications fail
    }

    return NextResponse.json({ ok: true, qr_id: newQr.id, qr_number: qrNumber });
  } catch (err) {
    console.error("QR creation error:", err);
    return NextResponse.json({ error: "Failed to create QR" }, { status: 500 });
  }
}
