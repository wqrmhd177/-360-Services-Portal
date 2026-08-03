import { isFinanceSkipService } from "@/lib/serviceTypes";

type PrWorkflowFields = {
  approval_status?: string | null;
  finance_verification_status?: string | null;
  po_created?: boolean | null;
  seller_service_type?: string | null;
};

/** True when procurement may convert this PR to a PO. */
export function isPrReadyForPo(pr: PrWorkflowFields): boolean {
  if (pr.po_created) return false;
  if (pr.approval_status !== "approved") return false;
  if (isFinanceSkipService(pr.seller_service_type)) return true;
  return pr.finance_verification_status === "verified";
}

/** Finance manual verification is not required for this PR. */
export function isPrFinanceVerificationRequired(pr: PrWorkflowFields): boolean {
  return !isFinanceSkipService(pr.seller_service_type);
}
