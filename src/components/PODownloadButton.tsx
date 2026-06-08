"use client";

import { useState } from "react";
import type { jsPDF } from "jspdf";
import type { Po } from "@/types/workflows";
import type { ProcurementImageGroup } from "@/lib/procurementImages";

interface PODownloadButtonProps {
  po: Po;
  prNumber?: string | null;
  className?: string;
}

export default function PODownloadButton({
  po,
  prNumber,
  className = "",
}: PODownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const { appendProcurementImagesToPdf } = await import("@/lib/pdfImageUtils");

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = 20;

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Purchase Order", margin, y);
      y += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      if (po.po_number) {
        doc.text(`PO Number: ${po.po_number}`, margin, y);
        y += 5;
      }
      doc.text(
        `Date: ${po.created_at ? new Date(po.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-"}`,
        margin,
        y
      );
      y += 5;
      doc.text(
        `Status: ${po.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
        margin,
        y
      );
      y += 5;
      doc.text(`Type: ${po.po_type === "internal" ? "Internal" : "External"}`, margin, y);
      y += 5;
      if (prNumber) {
        doc.text(`Linked PR: ${prNumber}`, margin, y);
        y += 5;
      }
      doc.setTextColor(0);
      y += 4;

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Supplier Information", margin, y);
      y += 5;
      doc.setDrawColor(200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Name: ${po.supplier_name || "-"}`, margin, y);
      y += 5;
      doc.text(`Location: ${po.supplier_location || "-"}`, margin, y);
      y += 5;
      doc.text(`Payment Status: ${po.supplier_payment_status || "-"}`, margin, y);
      if (po.supplier_payment_amount) {
        y += 5;
        doc.text(`Payment Amount: AED ${po.supplier_payment_amount.toFixed(2)}`, margin, y);
      }
      y += 8;

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Delivery Information", margin, y);
      y += 5;
      doc.setDrawColor(200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Partner: ${po.delivery_partner || "-"}`, margin, y);
      y += 5;
      doc.text(`Tracking ID: ${po.delivery_partner_tracking_id || "-"}`, margin, y);
      y += 5;
      doc.text(`Payment Status: ${po.delivery_partner_payment_status || "-"}`, margin, y);
      if (po.delivery_partner_payment_amount) {
        y += 5;
        doc.text(`Payment Amount: AED ${po.delivery_partner_payment_amount.toFixed(2)}`, margin, y);
      }
      y += 8;

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Products / SKUs", margin, y);
      y += 5;

      const products = po.products && po.products.length > 0 ? po.products : [];
      const currency = (po as Po & { pr?: { products?: Array<{ currency?: string }> } }).pr?.products?.[0]?.currency || "AED";

      const tableRows: (string | number)[][] = products.map((p, i) => {
        const pCurrency = (p as { currency?: string }).currency || currency;
        return [
          i + 1,
          p.productName || "-",
          p.skuCode || "-",
          p.quantity,
          p.rate != null ? `${pCurrency} ${Number(p.rate).toFixed(2)}` : "-",
          p.amount != null ? `${pCurrency} ${Number(p.amount).toFixed(2)}` : "-",
        ];
      });

      if (tableRows.length === 0) {
        tableRows.push([1, "See linked PR for product details", "-", "-", "-", "-"]);
      }

      autoTable(doc, {
        startY: y,
        head: [["#", "Product Name", "SKU Code", "Qty", "Rate", "Amount"]],
        body: tableRows,
        theme: "striped",
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 8 },
          3: { halign: "center" },
          4: { halign: "right" },
          5: { halign: "right" },
        },
        margin: { left: margin, right: margin },
      });

      const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
      let contentEndY = finalY;

      if (products.length > 0) {
        const total = products.reduce((s, p) => s + (p.amount ?? 0), 0);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Total: ${currency} ${total.toFixed(2)}`, pageWidth - margin, finalY + 7, { align: "right" });
        contentEndY = finalY + 14;
      }

      if (po.remarks) {
        const remarksY = contentEndY + 4;
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("Remarks:", margin, remarksY);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(po.remarks, pageWidth - margin * 2 - 20) as string[];
        doc.text(lines, margin + 20, remarksY);
        contentEndY = remarksY + lines.length * 4 + 4;
      }

      let procurementGroups: ProcurementImageGroup[] = [];
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

      if (procurementGroups.length > 0) {
        contentEndY = await appendProcurementImagesToPdf(
          doc,
          procurementGroups,
          qrNumber,
          contentEndY,
          margin
        );
      }

      const pageHeight = doc.internal.pageSize.getHeight();
      const footerY = Math.max(contentEndY + 10, pageHeight - 10);
      if (footerY > pageHeight - 10) {
        doc.addPage();
      }
      const footerPageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("Generated by 360 Services Portal", margin, footerPageHeight - 10);
      doc.text(new Date().toLocaleString(), pageWidth - margin, footerPageHeight - 10, {
        align: "right",
      });

      const fileName = `PO_${po.po_number || po.id.slice(0, 8)}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className={
        className ||
        "inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      }
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
        />
      </svg>
      {loading ? "Generating…" : "Download PDF"}
    </button>
  );
}
