import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { createNotification, getUsersByRole, notifyMultipleUsers } from "@/lib/notifications";
import { insertPurchaseOrder } from "@/lib/poCreate";
import { requireWriteAccess } from "@/lib/accessControl";
import {
  groupBulkPoRows,
  parseBulkPoCsv,
  validatePoHeaderFields,
  validatePoProductLine,
} from "@/lib/poValidation";

export async function POST(request: Request) {
  const session = getPortalSession();
  const denied = requireWriteAccess(
    session,
    ["procurement"],
    "Forbidden - Procurement role required to create bulk POs"
  );
  if (denied) return denied;
  const authSession = session!;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "CSV file is required." }, { status: 400 });
    }

    const text = await file.text();
    const { rows, errors: parseErrors } = parseBulkPoCsv(text);
    if (parseErrors.length > 0) {
      return NextResponse.json({ error: parseErrors.join(" ") }, { status: 400 });
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: "No data rows found in CSV." }, { status: 400 });
    }

    const groups = groupBulkPoRows(rows);
    const supabase = createSupabaseClient();

    const created: Array<{ po_id: string; po_number: string | null | undefined; lineCount: number }> =
      [];
    const failed: Array<{ groupKey: string; error: string }> = [];

    for (const group of groups) {
      const headerError = validatePoHeaderFields(group);
      if (headerError) {
        failed.push({ groupKey: group.groupKey, error: headerError });
        continue;
      }

      let groupInvalid = false;
      for (let i = 0; i < group.products.length; i++) {
        const lineError = validatePoProductLine(
          {
            productName: group.products[i].productName,
            quantity: group.products[i].quantity,
            productCostPerUnit: group.products[i].productCostPerUnit,
          },
          `Line ${i + 1}`
        );
        if (lineError) {
          failed.push({ groupKey: group.groupKey, error: lineError });
          groupInvalid = true;
          break;
        }
      }
      if (groupInvalid) continue;

      const { data: newPo, error: poError } = await insertPurchaseOrder(supabase, {
        pr_id: null,
        created_by_email: authSession.email,
        po_type: group.po_type || "internal",
        supplier_name: group.supplier_name,
        supplier_location: group.supplier_location,
        delivery_partner: group.delivery_partner,
        delivery_partner_tracking_id: group.delivery_partner_tracking_id,
        remarks: group.remarks,
        products: group.products,
      });

      if (poError || !newPo) {
        failed.push({
          groupKey: group.groupKey,
          error: poError || "Failed to create purchase order",
        });
        continue;
      }

      created.push({
        po_id: newPo.id,
        po_number: newPo.po_number,
        lineCount: group.products.length,
      });

      try {
        const financeEmails = await getUsersByRole("finance");
        const poLabel = newPo.po_number ?? newPo.id.slice(0, 8);
        const payload = {
          po_id: newPo.id,
          po_number: newPo.po_number ?? undefined,
          message: `New PO ${poLabel} created for ${group.supplier_name} (bulk import)`,
        };
        if (financeEmails.length > 0) {
          await notifyMultipleUsers(financeEmails, "po_created", payload);
        } else {
          await createNotification("finance@example.com", "po_created", payload);
        }
      } catch (notifError) {
        console.error("Bulk PO notification error:", notifError);
      }
    }

    return NextResponse.json({ created, failed });
  } catch (error) {
    console.error("Bulk PO creation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
