import type { Pr } from "@/types/workflows";

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
