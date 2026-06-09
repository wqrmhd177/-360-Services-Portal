import type { jsPDF } from "jspdf";
import type { Po, PoProduct } from "@/types/workflows";
import type { ProcurementImageGroup } from "@/lib/procurementImages";
import { appendProcurementImagesToPdf } from "@/lib/pdfImageUtils";

export type PoPdfVariant = "internal" | "supplier";

export interface GeneratePoPdfOptions {
  variant: PoPdfVariant;
  prNumber?: string | null;
  procurementGroups?: ProcurementImageGroup[];
  qrNumber?: string | null;
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getCurrency(po: Po): string {
  return (
    (po as Po & { pr?: { products?: Array<{ currency?: string }> } }).pr?.products?.[0]
      ?.currency || "AED"
  );
}

function formatMoney(currency: string, value: number | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return `${currency} ${Number(value).toFixed(2)}`;
}

function getInternalLineTotal(p: PoProduct): number {
  if (p.amount != null) return Number(p.amount);
  if (p.rate != null) return Number(p.rate) * p.quantity;
  return 0;
}

function getSupplierLineTotal(p: PoProduct): number {
  const productTotal =
    p.productCostAmount != null
      ? Number(p.productCostAmount)
      : p.productCostPerUnit != null
        ? Number(p.productCostPerUnit) * p.quantity
        : 0;
  const freightTotal =
    p.freightCostAmount != null
      ? Number(p.freightCostAmount)
      : p.freightCostPerUnit != null
        ? Number(p.freightCostPerUnit) * p.quantity
        : 0;
  return productTotal + freightTotal;
}

export async function generatePoPdf(
  doc: jsPDF,
  autoTable: (doc: jsPDF, options: Record<string, unknown>) => void,
  po: Po,
  options: GeneratePoPdfOptions
): Promise<void> {
  const { variant, prNumber, procurementGroups = [], qrNumber = null } = options;
  const isInternal = variant === "internal";

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 20;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(isInternal ? "Internal Purchase Order" : "Supplier Purchase Order", margin, y);
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
  doc.text(`Status: ${formatStatus(po.status)}`, margin, y);
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

  if (isInternal) {
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
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Products / SKUs", margin, y);
  y += 5;

  const products = po.products && po.products.length > 0 ? po.products : [];
  const currency = getCurrency(po);

  let tableRows: (string | number)[][];
  let tableHead: string[][];

  if (isInternal) {
    tableHead = [["#", "Product Name", "SKU Code", "Qty", "Selling Price", "Total"]];
    tableRows = products.map((p, i) => {
      const pCurrency = (p as { currency?: string }).currency || currency;
      const lineTotal = getInternalLineTotal(p);
      return [
        i + 1,
        p.productName || "-",
        p.skuCode || "-",
        p.quantity,
        formatMoney(pCurrency, p.rate),
        lineTotal > 0 ? formatMoney(pCurrency, lineTotal) : "-",
      ];
    });
  } else {
    tableHead = [["#", "Product Name", "SKU Code", "Qty", "Product Cost", "Freight Cost", "Total"]];
    tableRows = products.map((p, i) => {
      const pCurrency = (p as { currency?: string }).currency || currency;
      const lineTotal = getSupplierLineTotal(p);
      return [
        i + 1,
        p.productName || "-",
        p.skuCode || "-",
        p.quantity,
        formatMoney(pCurrency, p.productCostPerUnit),
        formatMoney(pCurrency, p.freightCostPerUnit),
        lineTotal > 0 ? formatMoney(pCurrency, lineTotal) : "-",
      ];
    });
  }

  if (tableRows.length === 0) {
    tableRows = isInternal
      ? [[1, "See linked PR for product details", "-", "-", "-", "-"]]
      : [[1, "See linked PR for product details", "-", "-", "-", "-", "-"]];
  }

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableRows,
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    columnStyles: isInternal
      ? {
          0: { cellWidth: 8 },
          3: { halign: "center" },
          4: { halign: "right" },
          5: { halign: "right" },
        }
      : {
          0: { cellWidth: 8 },
          3: { halign: "center" },
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "right" },
        },
    margin: { left: margin, right: margin },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
  let contentEndY = finalY;

  if (products.length > 0) {
    const total = products.reduce(
      (s, p) => s + (isInternal ? getInternalLineTotal(p) : getSupplierLineTotal(p)),
      0
    );
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Total: ${currency} ${total.toFixed(2)}`, pageWidth - margin, finalY + 7, {
      align: "right",
    });
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
}

export function poPdfFilename(po: Po, variant: PoPdfVariant): string {
  const base = po.po_number || po.id.slice(0, 8);
  return variant === "internal" ? `PO_${base}_Internal.pdf` : `PO_${base}_Supplier.pdf`;
}
