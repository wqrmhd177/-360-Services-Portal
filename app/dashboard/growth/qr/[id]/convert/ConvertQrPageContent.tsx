"use client";

import { useState } from "react";
import type { Qr } from "@/types/workflows";
import ConvertQrToPrForm from "./ConvertQrToPrForm";
import QuotationSummary from "./QuotationSummary";

interface ConvertQrPageContentProps {
  qr: Qr;
  userEmail: string;
}

export default function ConvertQrPageContent({ qr: initialQr, userEmail }: ConvertQrPageContentProps) {
  const [qr, setQr] = useState(initialQr);

  function handleQrUpdated(purchaseDetails: unknown[]) {
    setQr((prev) => ({
      ...prev,
      purchase_details: purchaseDetails as Qr["purchase_details"],
    }));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="lg:col-span-1">
        <QuotationSummary qr={qr} showMovementsActions onQrUpdated={handleQrUpdated} />
      </div>
      <div className="lg:col-span-1">
        <ConvertQrToPrForm qr={qr} userEmail={userEmail} />
      </div>
    </div>
  );
}
