import type { MovementHead, MovementStatus } from "@/types/movements";

const PHASE2_HEADS: MovementHead[] = ["360_seller_inventory", "360_zambeel_inventory"];

export function isPhase2MovementHead(head: MovementHead): boolean {
  return PHASE2_HEADS.includes(head);
}

export function initialStatusForHead(head: MovementHead): MovementStatus {
  if (head === "gold_to_gold") return "pending_approver";
  return "submitted";
}

export function canCreatorEdit(status: MovementStatus): boolean {
  return status === "rejected" || status === "rejected_by_approver";
}

export function canCreatorCancel(status: MovementStatus, head: MovementHead): boolean {
  if (head === "gold_to_gold") {
    return status === "pending_approver" || status === "rejected_by_approver";
  }
  return status === "submitted";
}

export function canApproverAct(head: MovementHead, status: MovementStatus): boolean {
  return head === "gold_to_gold" && status === "pending_approver";
}

export function canProcurementAct(head: MovementHead, status: MovementStatus): boolean {
  if (head === "partner") {
    return status === "submitted" || status === "in_progress";
  }
  if (head === "gold_to_gold") {
    return status === "approved" || status === "in_progress";
  }
  return false;
}

export type ProcurementAction = "accept" | "complete" | "reject";

export function nextStatusAfterProcurement(
  head: MovementHead,
  current: MovementStatus,
  action: ProcurementAction,
): MovementStatus {
  if (action === "accept") return "in_progress";
  if (action === "complete") return "completed";
  if (action === "reject") return "rejected";
  return current;
}

export function nextStatusAfterResubmit(head: MovementHead): MovementStatus {
  return head === "gold_to_gold" ? "pending_approver" : "submitted";
}

export function statusAfterApproverApprove(): MovementStatus {
  return "approved";
}

export function statusAfterApproverReject(): MovementStatus {
  return "rejected_by_approver";
}

/** Procurement queue: Partner submitted+ ; Gold approved+ */
export function isVisibleToProcurement(head: MovementHead, status: MovementStatus): boolean {
  if (head === "partner") {
    return ["submitted", "in_progress", "completed", "rejected"].includes(status);
  }
  if (head === "gold_to_gold") {
    return ["approved", "in_progress", "completed", "rejected"].includes(status);
  }
  return false;
}

export function isVisibleToApprover(head: MovementHead): boolean {
  return head === "gold_to_gold";
}
