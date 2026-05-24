import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import type { Qr } from "@/types/workflows";
import ConvertQrToPrForm from "./ConvertQrToPrForm";
import QuotationSummary from "./QuotationSummary";

/** Add N working days (Mon–Fri) to a date. */
function addWorkingDays(fromDate: Date, workingDays: number): Date {
  const d = new Date(fromDate);
  d.setHours(0, 0, 0, 0);
  let added = 0;
  while (added < workingDays) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

/** True if still within 3 working days of last response/re-edit (rates valid); after that reconfirm required. */
function canConvertQrToPr(qr: { status: string; updated_at?: string | null }): boolean {
  if (qr.status !== "responded") return false;
  const updatedAt = qr.updated_at;
  if (!updatedAt) return true;
  const from = new Date(updatedAt);
  const eligibleFrom = addWorkingDays(from, 3);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  eligibleFrom.setHours(0, 0, 0, 0);
  return today < eligibleFrom;
}

interface PageProps {
  params: {
    id: string;
  };
}

export default async function ConvertQrToPrPage({ params }: PageProps) {
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  const supabase = createSupabaseClient();
  const { data: qr } = await supabase
    .from("qr")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!qr) {
    redirect("/dashboard/growth");
  }

  // Check if user is the creator or admin
  if (qr.created_by_email !== session.email && !session.isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Access Denied
            </h2>
            <p className="text-sm text-gray-500">
              You can only convert Quotation Requests that you created.
            </p>
            <Link
              href="/dashboard/growth/quotation-requests"
              className="mt-4 inline-block text-xs font-medium text-gray-900 hover:text-gray-700"
            >
              ← Back to My Quotation Requests
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Check if QR has been responded to
  if (qr.status !== "responded") {
    redirect(`/dashboard/growth/qr/${params.id}/view`);
  }

  // Convert to PR allowed only within 3 working days of last response or re-edit; after that reconfirm required
  if (!canConvertQrToPr(qr)) {
    redirect("/dashboard/growth/quotation-requests?message=reconfirm_rates");
  }

  const typedQr = qr as Qr;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Convert QR to Purchase Request
              </h1>
              {typedQr.qr_number && (
                <p className="mt-1 text-sm text-gray-600">
                  QR Number:{" "}
                  <span className="font-semibold">{typedQr.qr_number}</span>
                </p>
              )}
            </div>
            <Link
              href="/dashboard/growth"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Enhanced Quotation Summary */}
          <div className="lg:col-span-1">
            <QuotationSummary qr={typedQr} />
          </div>

          {/* Right Column: PR Form */}
          <div className="lg:col-span-1">
            <ConvertQrToPrForm qr={typedQr} userEmail={session.email} />
          </div>
        </div>
      </div>
    </div>
  );
}
