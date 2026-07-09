import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import {
  countryDetailTotal,
  getRequestedQuantity,
  normalizeCountryDetailRow,
  type MovementSplit,
} from "@/lib/qrPurchaseDetails";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = getPortalSession();
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "growth" && !session.isAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Growth role required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { purchaseDetailIndex, action, movementSplits, countryDetails } = body;

    if (purchaseDetailIndex === undefined || purchaseDetailIndex === null) {
      return NextResponse.json(
        { error: "purchaseDetailIndex is required" },
        { status: 400 }
      );
    }

    if (action !== "split" && action !== "updatePrices") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const supabase = createSupabaseClient();
    const { data: qr, error: fetchError } = await supabase
      .from("qr")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!qr) {
      return NextResponse.json({ error: "QR not found" }, { status: 404 });
    }

    if (qr.service_needed !== "Movements") {
      return NextResponse.json(
        { error: "This action is only available for Movements service" },
        { status: 400 }
      );
    }

    if (qr.status !== "responded") {
      return NextResponse.json(
        { error: "QR must be in responded status" },
        { status: 400 }
      );
    }

    if (qr.created_by_email !== session.email && !session.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const purchaseDetails = Array.isArray(qr.purchase_details)
      ? [...qr.purchase_details]
      : [];

    if (purchaseDetailIndex < 0 || purchaseDetailIndex >= purchaseDetails.length) {
      return NextResponse.json({ error: "Invalid purchaseDetailIndex" }, { status: 400 });
    }

    const detail = { ...purchaseDetails[purchaseDetailIndex] };
    const procurementResponse =
      qr.procurement_response && typeof qr.procurement_response === "object"
        ? (qr.procurement_response as Record<number, { inventoryAvailable?: number }>)
        : {};
    const responseEntry = procurementResponse[purchaseDetailIndex];
    const requestedQty = getRequestedQuantity(detail);
    const inventoryAvailable =
      responseEntry?.inventoryAvailable != null
        ? Number(responseEntry.inventoryAvailable)
        : null;

    if (action === "split") {
      if (!Array.isArray(movementSplits) || movementSplits.length === 0) {
        return NextResponse.json(
          { error: "movementSplits is required" },
          { status: 400 }
        );
      }

      const splits = movementSplits as MovementSplit[];
      const readySplit = splits.find((s) => s.status === "ready");
      const pendingSplit = splits.find((s) => s.status === "pending");

      if (!readySplit || !pendingSplit) {
        return NextResponse.json(
          { error: "Both ready and pending splits are required" },
          { status: 400 }
        );
      }

      const readyQty = Number(readySplit.quantity) || 0;
      const pendingQty = Number(pendingSplit.quantity) || 0;

      if (readyQty + pendingQty !== requestedQty) {
        return NextResponse.json(
          {
            error: `Split quantities must sum to requested quantity (${requestedQty})`,
          },
          { status: 400 }
        );
      }

      if (inventoryAvailable != null && readyQty > inventoryAvailable) {
        return NextResponse.json(
          {
            error: `Ready quantity cannot exceed inventory available (${inventoryAvailable})`,
          },
          { status: 400 }
        );
      }

      const normalizedSplits = splits.map((s) => {
        const quantity = Number(s.quantity) || 0;
        const unitPrice = Number(s.unitPrice) || 0;
        return {
          id: String(s.id || `${s.status}-${Date.now()}`),
          quantity,
          unitPrice,
          totalPrice: countryDetailTotal(quantity, unitPrice),
          status: s.status,
        };
      });

      purchaseDetails[purchaseDetailIndex] = {
        ...detail,
        movementSplits: normalizedSplits,
      };
    } else {
      if (!Array.isArray(countryDetails) || countryDetails.length === 0) {
        return NextResponse.json(
          { error: "countryDetails is required" },
          { status: 400 }
        );
      }

      const normalized = countryDetails.map((cd: Record<string, unknown>) => {
        const row = normalizeCountryDetailRow(cd);
        return {
          ...row,
          targetPrice: row.unitPrice,
        };
      });

      const totalQty = normalized.reduce((s, cd) => s + (cd.quantity || 0), 0);
      if (totalQty !== requestedQty) {
        return NextResponse.json(
          {
            error: `Total quantity must remain ${requestedQty}`,
          },
          { status: 400 }
        );
      }

      purchaseDetails[purchaseDetailIndex] = {
        ...detail,
        countryDetails: normalized,
        unitPrice: normalized[0]?.unitPrice,
        targetPrice: normalized[0]?.unitPrice,
        totalPrice: normalized.reduce((s, cd) => s + (cd.totalPrice || 0), 0),
        priceUpdatedAt: new Date().toISOString(),
        priceUpdatedBy: session.email,
      };
    }

    const { error: updateError } = await supabase
      .from("qr")
      .update({
        purchase_details: purchaseDetails,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      purchase_details: purchaseDetails,
    });
  } catch (error) {
    console.error("Error updating Movements QR:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
