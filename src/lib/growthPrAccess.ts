import type { Pr } from "@/types/workflows";
import { isMovementsService } from "@/lib/serviceTypes";

export function prHasPaymentDetails(
  pr: Pick<Pr, "transaction_id" | "payment_proof_path" | "payment_entries">
): boolean {
  if (pr.payment_entries && pr.payment_entries.length > 0) {
    return pr.payment_entries.some(
      (e) =>
        (e.transaction_id != null && String(e.transaction_id).trim() !== "") ||
        (e.payment_proof_path != null && String(e.payment_proof_path).trim() !== "")
    );
  }
  return !!(
    (pr.transaction_id && String(pr.transaction_id).trim() !== "") ||
    (pr.payment_proof_path && String(pr.payment_proof_path).trim() !== "")
  );
}

/** Movements PR approved by Approver — Growth must add payment before Finance review. */
export function canAddPaymentToMovementsPr(
  pr: Pick<
    Pr,
    | "seller_service_type"
    | "approval_status"
    | "pr_status"
    | "transaction_id"
    | "payment_proof_path"
    | "payment_entries"
  >
): boolean {
  return (
    isMovementsService(pr.seller_service_type ?? "") &&
    pr.approval_status === "approved" &&
    pr.pr_status === "awaiting_payment" &&
    !prHasPaymentDetails(pr)
  );
}

/** Growth user may reopen a rejected PR (not after PO is created). */
export function canReopenGrowthPr(pr: Pick<Pr, "approval_status" | "finance_verification_status" | "po_created">): boolean {
  if (pr.po_created) return false;
  return pr.approval_status === "rejected" || pr.finance_verification_status === "rejected";
}

/** Growth user may edit before a PO exists (rejected, finance-rejected, or pending after reopen). */
export function canEditGrowthPr(pr: Pick<Pr, "approval_status" | "finance_verification_status" | "po_created">): boolean {
  if (pr.po_created) return false;
  return (
    pr.approval_status === "pending" ||
    pr.approval_status === "rejected" ||
    pr.finance_verification_status === "rejected"
  );
}
