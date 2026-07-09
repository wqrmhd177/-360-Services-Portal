import type { Qr } from "@/types/workflows";
import { getPurchaseDetailLabel, getPendingMovementQuantity } from "@/lib/qrPurchaseDetails";

type Detail = {
  productName?: string;
  fromSku?: string;
  toSku?: string;
  movementSplits?: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    status: "ready" | "pending" | "converted";
    convertedToPrId?: string;
    convertedAt?: string;
  }>;
};

export default function PendingMovementSummary({
  qr,
  compact = false,
}: {
  qr: Pick<Qr, "service_needed" | "purchase_details">;
  compact?: boolean;
}) {
  if (qr.service_needed !== "Movements" || !qr.purchase_details?.length) return null;

  const lines = qr.purchase_details
    .map((detail, index) => {
      const pendingQty = getPendingMovementQuantity(detail as Detail);
      if (pendingQty <= 0) return null;
      const label = getPurchaseDetailLabel(detail as Detail);
      const pendingSplit = (detail as Detail).movementSplits?.find((s) => s.status === "pending");
      const convertedSplit = (detail as Detail).movementSplits?.find((s) => s.status === "converted");
      return {
        index,
        label,
        pendingQty,
        unitPrice: pendingSplit?.unitPrice ?? 0,
        totalPrice: pendingSplit?.totalPrice ?? 0,
        convertedQty: convertedSplit?.quantity ?? 0,
      };
    })
    .filter(Boolean) as Array<{
    index: number;
    label: string;
    pendingQty: number;
    unitPrice: number;
    totalPrice: number;
    convertedQty: number;
  }>;

  if (lines.length === 0) return null;

  const totalPending = lines.reduce((s, l) => s + l.pendingQty, 0);

  if (compact) {
    return (
      <span className="badge border-amber-500 bg-amber-50 text-amber-800 text-[10px] font-semibold">
        Pending movement: {totalPending} units
      </span>
    );
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs">
      <div className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Pending movement — {totalPending} units remaining
      </div>
      <p className="text-amber-800 mb-2">
        Part of this request was converted to PR. The remaining quantity below still needs to be completed when inventory is available.
      </p>
      <div className="space-y-2">
        {lines.map((line) => (
          <div key={line.index} className="rounded border border-amber-200 bg-white p-2">
            <div className="font-medium text-gray-900">{line.label}</div>
            <div className="mt-1 grid grid-cols-2 gap-2 text-[11px]">
              {line.convertedQty > 0 && (
                <div>
                  <span className="text-gray-500">Converted:</span>{" "}
                  <span className="font-medium text-green-700">{line.convertedQty} units</span>
                </div>
              )}
              <div>
                <span className="text-gray-500">Pending:</span>{" "}
                <span className="font-semibold text-amber-800">{line.pendingQty} units</span>
              </div>
              {line.unitPrice > 0 && (
                <div className="col-span-2">
                  <span className="text-gray-500">Unit price:</span>{" "}
                  {Number(line.unitPrice).toFixed(2)} · Total {Number(line.totalPrice).toFixed(2)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
