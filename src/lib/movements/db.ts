import { createSupabaseClient } from "@/lib/supabaseClient";
import type { PortalSession } from "@/lib/session";
import type {
  CreateMovementPayload,
  MovementHead,
  MovementRequest,
  MovementStatus,
  UpdateMovementPayload,
} from "@/types/movements";
import { isActiveRole } from "@/lib/movements/access";
import {
  canCreatorCancel,
  canCreatorEdit,
  canProcurementAct,
  initialStatusForHead,
  isPhase2MovementHead,
  isVisibleToApprover,
  isVisibleToProcurement,
  nextStatusAfterProcurement,
  nextStatusAfterResubmit,
  statusAfterApproverApprove,
  statusAfterApproverReject,
  type ProcurementAction,
} from "@/lib/movements/status";
import { appendMovementLog, mapMovementRow } from "@/lib/movements/inventory";
import { nextMovementNumber } from "@/lib/movements/numbering";
import { notifyStandardUsers } from "@/lib/notifications";

function asMovement(row: Record<string, unknown>): MovementRequest {
  return mapMovementRow(row) as MovementRequest;
}

export async function listMovementsForSession(
  session: PortalSession,
  filters?: { status?: string; createdBy?: string },
): Promise<MovementRequest[]> {
  const supabase = createSupabaseClient();
  let query = supabase.from("movement_requests").select("*").order("created_at", {
    ascending: false,
  });

  if (session.isAdmin) {
    if (filters?.createdBy) {
      query = query.eq("created_by_email", filters.createdBy);
    }
  } else if (isActiveRole(session, ["approver"])) {
    query = query.eq("movement_head", "gold_to_gold");
  } else if (isActiveRole(session, ["procurement"])) {
    /* fetch all; filter in memory for procurement visibility */
  } else {
    query = query.eq("created_by_email", session.email);
  }

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query.limit(500);
  if (error) throw new Error(error.message);

  let rows = (data ?? []).map((r) => asMovement(r as Record<string, unknown>));

  if (!session.isAdmin && isActiveRole(session, ["procurement"])) {
    rows = rows.filter((r) =>
      isVisibleToProcurement(r.movement_head as MovementHead, r.status as MovementStatus),
    );
  }

  if (!session.isAdmin && isActiveRole(session, ["approver"]) && filters?.createdBy) {
    rows = rows.filter((r) => r.created_by_email === filters.createdBy);
  }

  return rows;
}

export async function getMovementById(id: string): Promise<MovementRequest | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("movement_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return asMovement(data as Record<string, unknown>);
}

export function canViewMovement(session: PortalSession, movement: MovementRequest): boolean {
  if (session.isAdmin) return true;
  if (movement.created_by_email === session.email) return true;
  if (isActiveRole(session, ["approver"]) && isVisibleToApprover(movement.movement_head)) {
    return true;
  }
  if (
    isActiveRole(session, ["procurement"]) &&
    isVisibleToProcurement(movement.movement_head, movement.status)
  ) {
    return true;
  }
  return false;
}

export async function createMovement(
  session: PortalSession,
  payload: CreateMovementPayload,
): Promise<MovementRequest> {
  if (isPhase2MovementHead(payload.movement_head)) {
    throw new Error("360 Movements are coming in the next phase");
  }

  const supabase = createSupabaseClient();
  const movementNumber = await nextMovementNumber();
  const status = initialStatusForHead(payload.movement_head);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("movement_requests")
    .insert({
      movement_number: movementNumber,
      movement_head: payload.movement_head,
      created_by_email: session.email,
      from_sku: payload.from_sku.trim(),
      from_country: payload.from_country.trim(),
      from_product_name: payload.from_product_name?.trim() || null,
      to_sku: payload.to_sku.trim(),
      to_country: payload.to_country.trim(),
      to_product_name: payload.to_product_name?.trim() || null,
      quantity: payload.quantity,
      shipping_mode: payload.shipping_mode,
      status,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const movement = asMovement(data as Record<string, unknown>);
  await appendMovementLog({
    movementId: movement.id,
    actorEmail: session.email,
    action: "created",
    toStatus: status,
  });

  if (payload.movement_head === "partner") {
    await notifyStandardUsers(
      { creatorEmail: session.email, roles: ["procurement"] },
      "qr_created",
      {
        message: `New Partner movement ${movement.movement_number} submitted`,
        movement_id: movement.id,
        movement_number: movement.movement_number,
      },
    );
  } else if (payload.movement_head === "gold_to_gold") {
    await notifyStandardUsers(
      { creatorEmail: session.email, roles: ["approver"] },
      "qr_created",
      {
        message: `New Gold to Gold movement ${movement.movement_number} pending approval`,
        movement_id: movement.id,
        movement_number: movement.movement_number,
      },
    );
  }

  return movement;
}

export async function updateMovementByCreator(
  session: PortalSession,
  id: string,
  payload: UpdateMovementPayload,
): Promise<MovementRequest> {
  const existing = await getMovementById(id);
  if (!existing) throw new Error("Movement not found");
  if (existing.created_by_email !== session.email && !session.isAdmin) {
    throw new Error("Forbidden");
  }

  const supabase = createSupabaseClient();
  const now = new Date().toISOString();

  if (payload.action === "cancel") {
    if (!canCreatorCancel(existing.status, existing.movement_head)) {
      throw new Error("Cannot cancel in current status");
    }
    const { data, error } = await supabase
      .from("movement_requests")
      .update({ status: "canceled", updated_at: now })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await appendMovementLog({
      movementId: id,
      actorEmail: session.email,
      action: "canceled",
      fromStatus: existing.status,
      toStatus: "canceled",
    });
    return asMovement(data as Record<string, unknown>);
  }

  if (!canCreatorEdit(existing.status)) {
    throw new Error("Movement cannot be edited in current status");
  }

  const patch: Record<string, unknown> = { updated_at: now };
  if (payload.from_sku != null) patch.from_sku = payload.from_sku.trim();
  if (payload.from_country != null) patch.from_country = payload.from_country.trim();
  if (payload.from_product_name !== undefined) {
    patch.from_product_name = payload.from_product_name?.trim() || null;
  }
  if (payload.to_sku != null) patch.to_sku = payload.to_sku.trim();
  if (payload.to_country != null) patch.to_country = payload.to_country.trim();
  if (payload.to_product_name !== undefined) {
    patch.to_product_name = payload.to_product_name?.trim() || null;
  }
  if (payload.quantity != null) patch.quantity = payload.quantity;
  if (payload.shipping_mode != null) patch.shipping_mode = payload.shipping_mode;

  if (payload.action === "resubmit") {
    patch.status = nextStatusAfterResubmit(existing.movement_head);
    patch.approver_email = null;
    patch.approver_action_at = null;
    patch.approver_remarks = null;
    patch.procurement_email = null;
    patch.procurement_action_at = null;
    patch.procurement_remarks = null;
  }

  const { data, error } = await supabase
    .from("movement_requests")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const updated = asMovement(data as Record<string, unknown>);
  await appendMovementLog({
    movementId: id,
    actorEmail: session.email,
    action: payload.action === "resubmit" ? "resubmitted" : "updated",
    fromStatus: existing.status,
    toStatus: updated.status,
  });

  if (payload.action === "resubmit") {
    if (existing.movement_head === "partner") {
      await notifyStandardUsers(
        { creatorEmail: session.email, roles: ["procurement"] },
        "pr_resubmitted",
        { movement_id: id, movement_number: updated.movement_number },
      );
    } else {
      await notifyStandardUsers(
        { creatorEmail: session.email, roles: ["approver"] },
        "pr_resubmitted",
        { movement_id: id, movement_number: updated.movement_number },
      );
    }
  }

  return updated;
}

export async function approveMovement(
  session: PortalSession,
  id: string,
  remarks?: string,
): Promise<MovementRequest> {
  if (!isActiveRole(session, ["approver"])) {
    throw new Error("Forbidden — Approver role required");
  }

  const existing = await getMovementById(id);
  if (!existing) throw new Error("Movement not found");
  if (existing.movement_head !== "gold_to_gold" || existing.status !== "pending_approver") {
    throw new Error("Movement is not pending approver action");
  }

  const supabase = createSupabaseClient();
  const now = new Date().toISOString();
  const newStatus = statusAfterApproverApprove();

  const { data, error } = await supabase
    .from("movement_requests")
    .update({
      status: newStatus,
      approver_email: session.email,
      approver_action_at: now,
      approver_remarks: remarks?.trim() || null,
      updated_at: now,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await appendMovementLog({
    movementId: id,
    actorEmail: session.email,
    action: "approved",
    fromStatus: existing.status,
    toStatus: newStatus,
    remarks: remarks?.trim() || null,
  });

  const movement = asMovement(data as Record<string, unknown>);
  await notifyStandardUsers(
    { creatorEmail: existing.created_by_email, roles: ["procurement"] },
    "pr_approved",
    { movement_id: id, movement_number: movement.movement_number },
  );

  return movement;
}

export async function rejectMovementByApprover(
  session: PortalSession,
  id: string,
  remarks?: string,
): Promise<MovementRequest> {
  if (!isActiveRole(session, ["approver"])) {
    throw new Error("Forbidden — Approver role required");
  }

  const existing = await getMovementById(id);
  if (!existing) throw new Error("Movement not found");
  if (existing.movement_head !== "gold_to_gold" || existing.status !== "pending_approver") {
    throw new Error("Movement is not pending approver action");
  }

  const supabase = createSupabaseClient();
  const now = new Date().toISOString();
  const newStatus = statusAfterApproverReject();

  const { data, error } = await supabase
    .from("movement_requests")
    .update({
      status: newStatus,
      approver_email: session.email,
      approver_action_at: now,
      approver_remarks: remarks?.trim() || null,
      updated_at: now,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await appendMovementLog({
    movementId: id,
    actorEmail: session.email,
    action: "rejected_by_approver",
    fromStatus: existing.status,
    toStatus: newStatus,
    remarks: remarks?.trim() || null,
  });

  const movement = asMovement(data as Record<string, unknown>);
  await notifyStandardUsers({ creatorEmail: existing.created_by_email }, "pr_rejected", {
    movement_id: id,
    movement_number: movement.movement_number,
    message: remarks?.trim() || "Rejected by approver",
  });

  return movement;
}

export async function procurementActionOnMovement(
  session: PortalSession,
  id: string,
  action: ProcurementAction,
  remarks?: string,
): Promise<MovementRequest> {
  if (!isActiveRole(session, ["procurement"])) {
    throw new Error("Forbidden — Procurement role required");
  }

  const existing = await getMovementById(id);
  if (!existing) throw new Error("Movement not found");

  if (!canProcurementAct(existing.movement_head, existing.status)) {
    throw new Error("Procurement cannot act on this movement in current status");
  }

  if (action === "accept" && existing.status !== "submitted" && existing.status !== "approved") {
    throw new Error("Invalid accept action for current status");
  }
  if (action === "complete" && existing.status !== "in_progress") {
    throw new Error("Movement must be in progress to complete");
  }

  const newStatus = nextStatusAfterProcurement(existing.movement_head, existing.status, action);
  const supabase = createSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("movement_requests")
    .update({
      status: newStatus,
      procurement_email: session.email,
      procurement_action_at: now,
      procurement_remarks: remarks?.trim() || null,
      updated_at: now,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await appendMovementLog({
    movementId: id,
    actorEmail: session.email,
    action: `procurement_${action}`,
    fromStatus: existing.status,
    toStatus: newStatus,
    remarks: remarks?.trim() || null,
  });

  const movement = asMovement(data as Record<string, unknown>);

  if (action === "reject") {
    await notifyStandardUsers({ creatorEmail: existing.created_by_email }, "pr_rejected", {
      movement_id: id,
      movement_number: movement.movement_number,
      message: remarks?.trim() || "Rejected by procurement",
    });
  }

  return movement;
}
