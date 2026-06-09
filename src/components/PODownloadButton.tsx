"use client";

import { useState } from "react";
import type { Po } from "@/types/workflows";
import type { PoPdfVariant } from "@/lib/poPdfGenerator";

interface PODownloadButtonProps {
  po: Po;
  prNumber?: string | null;
  className?: string;
}

const buttonBase =
  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50";

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
      />
    </svg>
  );
}

export default function PODownloadButton({
  po,
  prNumber,
  className = "",
}: PODownloadButtonProps) {
  const [loadingVariant, setLoadingVariant] = useState<PoPdfVariant | null>(null);

  async function handleDownload(variant: PoPdfVariant) {
    setLoadingVariant(variant);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const { generatePoPdf, poPdfFilename } = await import("@/lib/poPdfGenerator");

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      let poForPdf = po;
      if (variant === "supplier") {
        try {
          const costRes = await fetch(`/api/po/${po.id}/supplier-costs`);
          if (costRes.ok) {
            const costData = await costRes.json();
            if (costData.products?.length) {
              poForPdf = { ...po, products: costData.products };
            }
          }
        } catch {
          // continue with stored products
        }
      }

      let procurementGroups: import("@/lib/procurementImages").ProcurementImageGroup[] = [];
      let qrNumber: string | null = null;
      try {
        const imgRes = await fetch(`/api/po/${po.id}/procurement-images`);
        if (imgRes.ok) {
          const data = await imgRes.json();
          procurementGroups = data.groups ?? [];
          qrNumber = data.qrNumber ?? null;
        }
      } catch {
        // continue without images
      }

      await generatePoPdf(doc, autoTable, poForPdf, {
        variant,
        prNumber,
        procurementGroups,
        qrNumber,
      });

      doc.save(poPdfFilename(po, variant));
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setLoadingVariant(null);
    }
  }

  const wrapperClass = className || "flex flex-wrap items-center gap-2";

  return (
    <div className={wrapperClass}>
      <button
        type="button"
        onClick={() => handleDownload("internal")}
        disabled={loadingVariant !== null}
        className={`${buttonBase} border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
      >
        <DownloadIcon />
        {loadingVariant === "internal" ? "Generating…" : "Internal PO"}
      </button>
      <button
        type="button"
        onClick={() => handleDownload("supplier")}
        disabled={loadingVariant !== null}
        className={`${buttonBase} border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100`}
      >
        <DownloadIcon />
        {loadingVariant === "supplier" ? "Generating…" : "Supplier PO"}
      </button>
    </div>
  );
}
