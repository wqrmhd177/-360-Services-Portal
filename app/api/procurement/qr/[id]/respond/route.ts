import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { createNotification, getUsersByRole, notifyMultipleUsers } from "@/lib/notifications";
import { WAREHOUSE_CODES } from "@/types/workflows";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canRespond = session.role === "procurement" || session.isAdmin;
  if (!canRespond) {
    return NextResponse.json(
      { error: "Forbidden - Procurement role required to respond to QR" },
      { status: 403 }
    );
  }

  const VALID_WAREHOUSES = new Set(WAREHOUSE_CODES);

  const VALID_CURRENCIES = new Set(["AED", "SAR", "PKR"]);

  function normalizeWarehouseStock(raw: unknown): { warehouse: string; qty: number; costPerUnit: number; currency?: string; procurementImagePaths?: string[] }[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (e: any) =>
          e != null &&
          typeof e.warehouse === "string" &&
          VALID_WAREHOUSES.has(e.warehouse as any) &&
          (typeof e.qty === "number" || (typeof e.qty === "string" && e.qty !== "")) &&
          Number(e.qty) >= 0 &&
          (typeof e.costPerUnit === "number" || (typeof e.costPerUnit === "string" && e.costPerUnit !== "")) &&
          Number(e.costPerUnit) >= 0
      )
      .map((e: any) => ({
        warehouse: e.warehouse,
        qty: Number(e.qty),
        costPerUnit: Number(e.costPerUnit),
        currency: typeof e.currency === "string" && VALID_CURRENCIES.has(e.currency) ? e.currency : undefined,
        procurementImagePaths: Array.isArray(e.procurementImagePaths) ? e.procurementImagePaths : undefined
      }));
  }

  try {
    const body = await request.json();
    const {
      purchaseDetailIndex,
      combinations,
      costPerUnit,
      freightCostPerUnit,
      landedCostPerUnit,
      etaDays,
      procurementImagePaths,
      remarks,
      warehouseStock: bodyWarehouseStock
    } = body;

    const warehouseStock = normalizeWarehouseStock(bodyWarehouseStock);

    if (purchaseDetailIndex === undefined) {
      return NextResponse.json({ error: "Missing purchaseDetailIndex" }, { status: 400 });
    }

    const supabase = createSupabaseClient();

    // Get current QR
    const { data: qr } = await supabase.from("qr").select("*").eq("id", params.id).single();

    if (!qr) {
      return NextResponse.json({ error: "QR not found" }, { status: 404 });
    }

    // Get or initialize procurement_response
    let procurementResponse: any = {};
    if (qr.procurement_response) {
      procurementResponse =
        typeof qr.procurement_response === "string"
          ? JSON.parse(qr.procurement_response)
          : qr.procurement_response;
    }

    // Initialize metadata if it doesn't exist
    if (!procurementResponse._metadata) {
      procurementResponse._metadata = {
        firstSubmittedAt: null,
        lastEditedAt: null,
        editCount: 0
      };
    }

    const existingResponse = procurementResponse[purchaseDetailIndex];
    const warehouseStockToSave =
      bodyWarehouseStock !== undefined ? warehouseStock : (existingResponse?.warehouseStock ?? []);
    const hasCombinations = Array.isArray(combinations) && combinations.length > 0;

    if (hasCombinations) {
      const validCombinations = combinations
        .filter(
          (c: any) =>
            c != null &&
            c.costPerUnit != null &&
            c.freightCostPerUnit != null &&
            c.landedCostPerUnit != null
        )
        .map((c: any) => ({
          destinationCountry: c.destinationCountry ?? "",
          countryOfPurchase: c.countryOfPurchase ?? "China",
          shippingType: c.shippingType ?? "sea",
          movementType: c.movementType ?? "normal",
          currency: typeof c.currency === "string" && VALID_CURRENCIES.has(c.currency) ? c.currency : undefined,
          costPerUnit: Number(c.costPerUnit),
          freightCostPerUnit: Number(c.freightCostPerUnit),
          landedCostPerUnit: Number(c.landedCostPerUnit),
          etaDays: c.etaDays ?? null,
          remarks: c.remarks ?? "",
          procurementImagePaths: Array.isArray(c.procurementImagePaths) ? c.procurementImagePaths : [],
          submittedAt: existingResponse?.combinations?.[0]?.submittedAt || new Date().toISOString(),
          lastEditedAt: new Date().toISOString()
        }));

      if (validCombinations.length === 0) {
        return NextResponse.json(
          { error: "At least one combination with cost fields is required" },
          { status: 400 }
        );
      }

      const isReEdit = existingResponse && (existingResponse.combinations?.length > 0 || existingResponse.costPerUnit !== undefined);
      if (isReEdit) {
        procurementResponse._metadata.editCount = (procurementResponse._metadata.editCount || 0) + 1;
        procurementResponse._metadata.lastEditedAt = new Date().toISOString();
        if (!procurementResponse._metadata.firstSubmittedAt) {
          procurementResponse._metadata.firstSubmittedAt =
            existingResponse?.combinations?.[0]?.submittedAt || new Date().toISOString();
        }
      } else if (!procurementResponse._metadata.firstSubmittedAt) {
        procurementResponse._metadata.firstSubmittedAt = new Date().toISOString();
      }

      procurementResponse[purchaseDetailIndex] = {
        combinations: validCombinations,
        submittedAt: existingResponse?.submittedAt || new Date().toISOString(),
        lastEditedAt: isReEdit ? new Date().toISOString() : undefined,
        warehouseStock: warehouseStockToSave
      };
    } else {
      const isReEdit = existingResponse && existingResponse.costPerUnit !== undefined;

      if (
        costPerUnit == null ||
        freightCostPerUnit == null ||
        landedCostPerUnit == null
      ) {
        return NextResponse.json({ error: "Missing required cost fields" }, { status: 400 });
      }

      if (isReEdit) {
        procurementResponse._metadata.editCount = (procurementResponse._metadata.editCount || 0) + 1;
        procurementResponse._metadata.lastEditedAt = new Date().toISOString();
        if (!procurementResponse._metadata.firstSubmittedAt) {
          procurementResponse._metadata.firstSubmittedAt =
            existingResponse.submittedAt || new Date().toISOString();
        }
      } else if (!procurementResponse._metadata.firstSubmittedAt) {
        procurementResponse._metadata.firstSubmittedAt = new Date().toISOString();
      }

      const newProcurementImagePaths: string[] = Array.isArray(procurementImagePaths)
        ? procurementImagePaths
        : [];
      const mergedImagePaths: string[] = [
        ...(existingResponse?.procurementImagePaths || []),
        ...newProcurementImagePaths
      ];

      procurementResponse[purchaseDetailIndex] = {
        costPerUnit: Number(costPerUnit),
        freightCostPerUnit: Number(freightCostPerUnit),
        landedCostPerUnit: Number(landedCostPerUnit),
        etaDays: etaDays ?? existingResponse?.etaDays ?? null,
        remarks: remarks ?? existingResponse?.remarks ?? "",
        procurementImagePaths: mergedImagePaths,
        submittedAt: existingResponse?.submittedAt || new Date().toISOString(),
        lastEditedAt: isReEdit ? new Date().toISOString() : undefined,
        warehouseStock: warehouseStockToSave
      };
    }

    const purchaseDetails = qr.purchase_details || [];
    const isReEdit =
      existingResponse &&
      (existingResponse.combinations?.length > 0 || existingResponse.costPerUnit !== undefined);
    const detailIsSubmitted = (resp: any) => {
      if (!resp) return false;
      if (resp.combinations && Array.isArray(resp.combinations) && resp.combinations.length > 0) return true;
      return resp.costPerUnit !== undefined;
    };
    const allSubmitted = purchaseDetails.every(
      (_: any, idx: number) => detailIsSubmitted(procurementResponse[idx])
    );

    // Update QR
    const { error } = await supabase
      .from("qr")
      .update({
        procurement_response: procurementResponse,
        status: allSubmitted ? "responded" : "open",
        updated_at: new Date().toISOString()
      })
      .eq("id", params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify Growth team and Approver
    try {
      const productNames =
        qr.purchase_details && Array.isArray(qr.purchase_details) && qr.purchase_details.length > 0
          ? qr.purchase_details.map((d: any) => d.productName).join(", ")
          : "products";
      
      const qrNumber = qr.qr_number || params.id;
      
      // Get approver emails
      const approverEmails = await getUsersByRole("approver");
      const allNotifyEmails = qr.created_by_email 
        ? [qr.created_by_email, ...approverEmails]
        : approverEmails;
      
      if (allNotifyEmails.length > 0) {
        if (isReEdit) {
          // Notify about re-edit (always notify on re-edit)
          await notifyMultipleUsers(allNotifyEmails, "qr_re_edited", {
            qr_id: params.id,
            qr_number: qrNumber,
            message: `${qrNumber} has been re-submitted by Procurement for ${productNames}`
          });
        } else if (allSubmitted) {
          // Notify about initial submission when all items are completed
          await notifyMultipleUsers(allNotifyEmails, "qr_response", {
            qr_id: params.id,
            qr_number: qrNumber,
            message: `${qrNumber} has been responded by Procurement for ${productNames}`
          });
        }
      }
    } catch (notifError) {
      console.error("Failed to send notifications:", notifError);
      // Don't fail the response submission if notifications fail
    }

    return NextResponse.json({ ok: true, allSubmitted });
  } catch (error) {
    console.error("QR response error:", error);
    return NextResponse.json({ error: "Failed to submit costs" }, { status: 500 });
  }
}
