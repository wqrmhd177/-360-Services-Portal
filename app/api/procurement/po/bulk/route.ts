import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { createNotification, getUsersByRole, notifyMultipleUsers } from "@/lib/notifications";
import { insertPurchaseOrder } from "@/lib/poCreate";
import { requireWriteAccess } from "@/lib/accessControl";
import {
  groupBulkPoRowsByMode,
  parseBulkPoCsv,
  validatePoHeaderFields,
  validatePoProductLine,
  type BulkPoGroup,
  type BulkPoGroupingMode,
} from "@/lib/poValidation";

async function createGroupsFromRequest(request: Request): Promise<{
  groups: BulkPoGroup[];
  error: string | null;
}> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    const groups = body.groups as BulkPoGroup[] | undefined;
    if (!Array.isArray(groups) || groups.length === 0) {
      return { groups: [], error: "At least one PO group is required." };
    }
    return { groups, error: null };
  }

  const formData = await request.formData();
  const groupsJson = formData.get("groups");
  if (typeof groupsJson === "string" && groupsJson.trim()) {
    try {
      const groups = JSON.parse(groupsJson) as BulkPoGroup[];
      if (!Array.isArray(groups) || groups.length === 0) {
        return { groups: [], error: "At least one PO group is required." };
      }
      return { groups, error: null };
    } catch {
      return { groups: [], error: "Invalid groups payload." };
    }
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { groups: [], error: "CSV file or groups payload is required." };
  }

  const mode = (String(formData.get("grouping_mode") ?? "grouped") ||
    "grouped") as BulkPoGroupingMode;
  const text = await file.text();
  const { rows, errors: parseErrors } = parseBulkPoCsv(text);
  if (parseErrors.length > 0) {
    return { groups: [], error: parseErrors.join(" ") };
  }
  if (rows.length === 0) {
    return { groups: [], error: "No data rows found in CSV." };
  }

  return { groups: groupBulkPoRowsByMode(rows, mode), error: null };
}

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
    const { groups, error: inputError } = await createGroupsFromRequest(request);
    if (inputError) {
      return NextResponse.json({ error: inputError }, { status: 400 });
    }

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
            freightCostPerUnit: group.products[i].freightCostPerUnit,
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
