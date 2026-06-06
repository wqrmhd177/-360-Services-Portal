import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { createNotification, getUsersByRole, notifyMultipleUsers } from "@/lib/notifications";
import { getUserName } from "@/lib/getUserName";
import type { Pr } from "@/types/workflows";
import Link from "next/link";
import ImageGallery from "@/components/ImageGallery";
import FinancePrVerifyActions from "@/components/FinancePrVerifyActions";

async function verifyPrPayment(prId: string, email: string, formData: FormData) {
  "use server";
  const supabase = createSupabaseClient();

  // Handle file uploads - for now, store file paths as text array
  // In production, you'd upload to Supabase Storage and store the paths
  const referenceFilesRaw = formData.get("reference_files") as string | null;
  const referenceFiles = referenceFilesRaw
    ? referenceFilesRaw.split(",").map((f) => f.trim()).filter(Boolean)
    : [];

  await supabase
    .from("pr")
    .update({
      finance_verification_status: "verified",
      finance_verified_by_email: email,
      reference_files: referenceFiles,
      updated_at: new Date().toISOString()
    })
    .eq("id", prId);

  const { data: prRow } = await supabase.from("pr").select("product_name, pr_number, products").eq("id", prId).single();
  const productLabel = prRow?.products?.[0]?.productName ?? prRow?.product_name ?? "product";
  const prNumber = prRow?.pr_number ?? prId.slice(0, 8);
  const procurementEmails = await getUsersByRole("procurement");
  if (procurementEmails.length > 0) {
    await notifyMultipleUsers(procurementEmails, "pr_finance_verified", {
      pr_id: prId,
      pr_number: prNumber,
      message: `PR ${prNumber} (${productLabel}) is finance-verified and ready for PO conversion`
    });
  } else {
    await createNotification("procurement@example.com", "pr_finance_verified", {
      pr_id: prId,
      pr_number: prNumber,
      message: `PR ${prNumber} (${productLabel}) is finance-verified and ready for PO conversion`
    });
  }

  redirect("/dashboard/finance");
}

async function rejectPrPayment(prId: string, email: string) {
  "use server";
  const supabase = createSupabaseClient();
  
  const { data: prRow } = await supabase.from("pr").select("product_name, pr_number, products, created_by_email").eq("id", prId).single();

  await supabase
    .from("pr")
    .update({
      finance_verification_status: "rejected",
      finance_verified_by_email: email,
      updated_at: new Date().toISOString()
    })
    .eq("id", prId);

  const productLabel = prRow?.products?.[0]?.productName ?? prRow?.product_name ?? "product";
  const prNumber = prRow?.pr_number ?? prId.slice(0, 8);
  
  // Notify only the PR creator (Growth user who created this specific PR)
  if (prRow?.created_by_email) {
    await createNotification(prRow.created_by_email, "pr_finance_rejected", {
      pr_id: prId,
      pr_number: prNumber,
      message: `PR ${prNumber} (${productLabel}) payment was rejected by Finance`
    });
  }

  redirect("/dashboard/finance");
}

async function getPrDetails(prId: string) {
  const supabase = createSupabaseClient();
  const { data: pr } = await supabase.from("pr").select("*").eq("id", prId).maybeSingle();
  return pr as Pr | null;
}

export default async function FinancePrVerificationPage({ params }: { params: { id: string } }) {
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  const pr = await getPrDetails(params.id);
  const createdByName = pr ? await getUserName(pr.created_by_email) : null;
  if (!pr) {
    return (
      <div className="card">
        <p className="text-sm text-gray-500">PR not found.</p>
        <Link href="/dashboard/finance" className="mt-4 text-xs font-medium text-gray-900 hover:text-gray-700">
          ← Back to Finance Dashboard
        </Link>
      </div>
    );
  }

  if (pr.approval_status !== "approved") {
    return (
      <div className="card">
        <p className="text-sm text-gray-500">
          This PR must be approved before it can be verified for payment.
        </p>
        <Link href="/dashboard/finance" className="mt-4 text-xs font-medium text-gray-900 hover:text-gray-700">
          ← Back to Finance Dashboard
        </Link>
      </div>
    );
  }

  if (pr.finance_verification_status !== "pending") {
    return (
      <div className="card">
        <p className="text-sm text-gray-500">
          This PR has already been {pr.finance_verification_status}. It cannot be modified.
        </p>
        <Link href="/dashboard/finance" className="mt-4 text-xs font-medium text-gray-900 hover:text-gray-700">
          ← Back to Finance Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Verify PR Payment</h2>
            {pr.pr_number && (
              <span className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-1 text-sm font-mono font-semibold text-gray-900">
                {pr.pr_number}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            Upload payment proofs and verify this Purchase Request for payment processing.
          </p>
        </div>
        <Link href="/dashboard/finance" className="text-xs text-gray-700 font-medium hover:text-gray-900">
          ← Back
        </Link>
      </div>

      {/* PR Details */}
      <div className="card">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Purchase Request Details</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Seller / Channel</label>
            <div className="text-sm text-gray-900">{pr.seller_channel_name || pr.reseller_code || "-"}</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Service Type</label>
            <div className="text-sm text-gray-900">{pr.seller_service_type || "-"}</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Payment Type</label>
            <div className="text-sm text-gray-900 capitalize">{pr.payment_type || pr.payment_method || "-"}</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Created By</label>
            <div className="text-sm text-gray-900">{createdByName ?? "-"}</div>
          </div>
          {pr.created_at && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Created At</label>
              <div className="text-sm text-gray-900">
                {new Date(pr.created_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Approved By</label>
            <div className="text-sm text-gray-900">{pr.approved_by_email ?? "-"}</div>
          </div>
          {pr.products && pr.products.length > 0 ? (
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-medium text-gray-500">Products</label>
              <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
                {pr.products.map((p, idx) => (
                  <div key={idx} className="p-3 flex flex-wrap gap-4 text-sm">
                    <span className="font-medium text-gray-900">{p.productName}</span>
                    <span className="text-gray-600">SKU: {p.skuCode}</span>
                    <span className="text-gray-600">Qty: {p.quantity}</span>
                    <span className="text-gray-600">{p.currency} {p.sellingPricePerUnit.toFixed(2)}/unit</span>
                    <span className="font-semibold text-gray-900">{p.currency} {p.totalAmount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="text-sm font-semibold text-gray-900">
                Total: {pr.products[0].currency} {pr.products.reduce((s, p) => s + p.totalAmount, 0).toFixed(2)}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Product</label>
                <div className="text-sm text-gray-900">{pr.product_name}</div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Quantity</label>
                <div className="text-sm text-gray-900">{pr.quantity}</div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Total Amount</label>
                <div className="text-sm font-semibold text-gray-900">
                  {typeof pr.amount === "number" ? pr.amount.toFixed(2) : pr.amount}
                </div>
              </div>
            </>
          )}
          {pr.remarks && (
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-gray-500">Remarks</label>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900">
                {pr.remarks}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Entries — all transaction IDs and proof images submitted by Growth */}
      <div className="card">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Payment Information from Growth</h3>
        {pr.payment_entries && Array.isArray(pr.payment_entries) && pr.payment_entries.length > 0 ? (
          <div className="space-y-4">
            {pr.payment_entries.map((entry: { transaction_id?: string | null; payment_proof_path?: string | null }, idx: number) => (
              <div
                key={idx}
                className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3"
              >
                {pr.payment_entries!.length > 1 && (
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Entry #{idx + 1}
                  </p>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Transaction ID</label>
                    <div className="text-sm font-mono font-medium text-gray-900">
                      {entry.transaction_id || <span className="text-gray-400 font-sans font-normal">Not provided</span>}
                    </div>
                  </div>
                  {entry.payment_proof_path ? (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">Payment Proof</label>
                      <ImageGallery
                        images={[entry.payment_proof_path]}
                        alt={`Payment proof ${idx + 1}`}
                        thumbnailSize="lg"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">Payment Proof</label>
                      <p className="text-sm text-gray-400">No image uploaded</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Fallback: legacy PRs that only have scalar fields */
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Transaction ID</label>
                <div className="text-sm font-mono font-medium text-gray-900">
                  {pr.transaction_id || <span className="text-gray-400 font-sans font-normal">Not provided</span>}
                </div>
              </div>
              {pr.payment_proof_path ? (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Payment Proof</label>
                  <ImageGallery
                    images={[pr.payment_proof_path]}
                    alt="Payment proof"
                    thumbnailSize="lg"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Payment Proof</label>
                  <p className="text-sm text-gray-400">No image uploaded</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Payment Verification</h3>
        <FinancePrVerifyActions prId={pr.id} />
      </div>
    </div>
  );
}
