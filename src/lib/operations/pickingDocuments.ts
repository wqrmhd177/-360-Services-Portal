import { pickingDocumentLabel } from "@/lib/operations/pickingSheet";

export type PickingDocType = "grn" | "awb";

export type PickingDocLine = {
  sku: string;
  product_name: string;
  image_url: string | null;
  quantity: number;
  good_qty?: number | null;
  bad_qty?: number | null;
};

export type PickingDocOptions = {
  type: PickingDocType;
  lines: PickingDocLine[];
  dateLabel: string;
  partTitle?: string;
  comments?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function qtyCell(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return escapeHtml(String(value));
}

function imageCell(url: string | null, alt: string): string {
  if (!url) {
    return `<div class="img-empty">Not Available</div>`;
  }
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" />`;
}

export function pickingDocumentFilename(
  type: PickingDocType,
  dateLabel: string,
): string {
  const stamp = dateLabel.replace(/\s+/g, "-");
  return type === "grn"
    ? `GRN-Document-${stamp}.html`
    : `Picking-List-${stamp}.html`;
}

export function buildPickingDocumentHtml(options: PickingDocOptions): string {
  const totalQty = options.lines.reduce((sum, line) => sum + line.quantity, 0);
  const body =
    options.type === "grn" ? grnBody(options) : awbBody(options, totalQty);
  const title =
    options.type === "grn" ? "Goods Received Note" : "Picking List";
  const comments = commentsBlock(options.comments);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      background: #fff;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 10px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .toolbar button {
      border: 1px solid #cbd5e1;
      background: #0f766e;
      color: #fff;
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 13px;
      cursor: pointer;
    }
    table { width: 100%; border-collapse: collapse; }
    img {
      max-width: 170px;
      max-height: 130px;
      object-fit: contain;
      display: block;
      margin: 0 auto;
    }
    .img-cell {
      text-align: center;
      vertical-align: middle;
    }
    .img-empty {
      color: #64748b;
      font-size: 12px;
      font-style: italic;
      text-align: center;
    }
    .grn-head {
      background: #2b6cb0;
      color: #fff;
      font-weight: 700;
    }
    .grn-head td { padding: 10px 12px; }
    .grn-sub td {
      background: #c6e6c6;
      font-weight: 700;
      text-align: center;
      padding: 8px;
      border: 1px solid #9ca3af;
    }
    .grn-row td {
      border: 1px solid #9ca3af;
      padding: 10px 12px;
      vertical-align: middle;
    }
    .grn-name { text-align: center; font-weight: 700; font-size: 16px; }
    .grn-qty { text-align: center; font-size: 18px; font-weight: 700; width: 90px; }
    .awb-title {
      background: #93c5fd;
      text-align: center;
      font-size: 28px;
      font-weight: 800;
      padding: 10px;
      border: 1px solid #64748b;
    }
    .awb-total-label {
      background: #93c5fd;
      text-align: center;
      font-size: 13px;
      font-weight: 700;
      border: 1px solid #64748b;
      padding: 4px;
    }
    .awb-total {
      background: #64748b;
      color: #fff;
      text-align: center;
      font-size: 28px;
      font-weight: 800;
      border: 1px solid #64748b;
      padding: 8px;
    }
    .awb-sub td {
      background: #93c5fd;
      font-weight: 700;
      padding: 8px 10px;
      border: 1px solid #64748b;
    }
    .awb-row td {
      border: 1px solid #64748b;
      padding: 10px;
      vertical-align: middle;
    }
    .awb-name { font-weight: 700; font-size: 16px; text-align: center; }
    .awb-qty { text-align: center; font-size: 32px; font-weight: 800; width: 90px; }
    .comments-box {
      margin: 12px 0 16px;
      border: 1px solid #64748b;
      padding: 10px 12px;
      font-size: 13px;
    }
    .comments-box h3 {
      margin: 0 0 6px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .comments-box p { margin: 0; white-space: pre-wrap; }
    .page-wrap { padding: 8px 16px 16px; }
    @media print {
      .toolbar { display: none; }
      body { margin: 0; }
      img { max-width: 150px; max-height: 115px; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" onclick="window.print()">Print / Save PDF</button>
  </div>
  <div class="page-wrap">
  ${comments}
  ${body}
  </div>
</body>
</html>`;
}

function commentsBlock(comments: string | undefined): string {
  const value = comments?.trim();
  if (!value) return "";
  return `<div class="comments-box"><h3>Comments</h3><p>${escapeHtml(value)}</p></div>`;
}

function grnBody(options: PickingDocOptions): string {
  const rows = options.lines
    .map((line) => {
      const name = pickingDocumentLabel(line.product_name, line.sku);
      return `<tr class="grn-row">
        <td class="grn-name">${escapeHtml(name)}</td>
        <td class="img-cell">${imageCell(line.image_url, name)}</td>
        <td class="grn-qty">${escapeHtml(String(line.quantity))}</td>
        <td class="grn-qty">${qtyCell(line.good_qty)}</td>
        <td class="grn-qty">${qtyCell(line.bad_qty)}</td>
      </tr>`;
    })
    .join("");

  return `<table>
    <tr class="grn-head">
      <td style="width:18%">${escapeHtml(options.dateLabel)}</td>
      <td colspan="4" style="text-align:center;font-size:22px">Goods Received Note</td>
    </tr>
    <tr class="grn-sub">
      <td>Product Name with SKU</td>
      <td>Image For Refrence</td>
      <td>Total Qty</td>
      <td>Good Qty</td>
      <td>Bad Qty</td>
    </tr>
    ${rows}
  </table>`;
}

function awbBody(options: PickingDocOptions, totalQty: number): string {
  const rows = options.lines
    .map((line) => {
      const name = pickingDocumentLabel(line.product_name, line.sku);
      return `<tr class="awb-row">
        <td class="img-cell" style="width:180px">${imageCell(line.image_url, name)}</td>
        <td class="awb-name">${escapeHtml(name)}</td>
        <td class="awb-qty">${escapeHtml(String(line.quantity))}</td>
      </tr>`;
    })
    .join("");

  return `<table>
    <tr>
      <td colspan="2" class="awb-title">Picking</td>
      <td class="awb-total-label">Total Quantity</td>
    </tr>
    <tr class="awb-sub">
      <td>Image</td>
      <td style="text-align:center">Product Name with SKU</td>
      <td class="awb-total">${escapeHtml(String(totalQty))}</td>
    </tr>
    ${rows}
  </table>`;
}
