import type { jsPDF } from "jspdf";
import type { ProcurementImageGroup } from "./procurementImages";

export async function loadImageAsJpegDataUrl(url: string): Promise<string | null> {
  if (!url) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const maxDim = 1200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function appendProcurementImagesToPdf(
  doc: jsPDF,
  groups: ProcurementImageGroup[],
  qrNumber: string | null,
  startY: number,
  margin: number
): Promise<number> {
  if (groups.length === 0) return startY;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let y = startY + 8;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 20) {
      doc.addPage();
      y = margin;
    }
  };

  ensureSpace(12);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Procurement Images", margin, y);
  y += 5;

  if (qrNumber) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`From linked QR #${qrNumber}`, margin, y);
    y += 5;
    doc.setTextColor(0);
  }

  y += 3;

  const imagesPerRow = 2;
  const gap = 4;
  const cellWidth = (contentWidth - gap * (imagesPerRow - 1)) / imagesPerRow;
  const maxImgHeight = 55;

  for (const group of groups) {
    ensureSpace(14);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(group.productName, margin, y);
    y += 4;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    const labelLines = doc.splitTextToSize(group.label, contentWidth) as string[];
    doc.text(labelLines, margin, y);
    y += labelLines.length * 3.5 + 2;
    doc.setTextColor(0);

    let col = 0;
    let rowMaxHeight = 0;

    for (const imageUrl of group.imageUrls) {
      const dataUrl = await loadImageAsJpegDataUrl(imageUrl);
      if (!dataUrl) continue;

      let imgW = cellWidth;
      let imgH = maxImgHeight;
      try {
        const props = doc.getImageProperties(dataUrl);
        const aspect = props.width / props.height;
        imgH = imgW / aspect;
        if (imgH > maxImgHeight) {
          imgH = maxImgHeight;
          imgW = imgH * aspect;
        }
      } catch {
        // keep default dimensions
      }

      ensureSpace(imgH + 6);
      const x = margin + col * (cellWidth + gap);
      try {
        doc.addImage(dataUrl, "JPEG", x, y, imgW, imgH, undefined, "FAST");
      } catch {
        continue;
      }

      rowMaxHeight = Math.max(rowMaxHeight, imgH);
      col++;
      if (col >= imagesPerRow) {
        y += rowMaxHeight + gap;
        col = 0;
        rowMaxHeight = 0;
      }
    }

    if (col > 0) {
      y += rowMaxHeight + gap;
    }
    y += 4;
  }

  return y;
}
