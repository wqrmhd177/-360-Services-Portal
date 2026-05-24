"use client";

import { useState, useEffect } from "react";
import type { Qr, Po } from "@/types/workflows";
import { formatQrStatusLabel } from "@/lib/format";

export default function ProcurementHistoryPage() {
  const [qrs, setQrs] = useState<Qr[]>([]);
  const [pos, setPos] = useState<Po[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQrIds, setSelectedQrIds] = useState<Set<string>>(new Set());
  const [selectedPoIds, setSelectedPoIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [qrRes, poRes] = await Promise.all([
        fetch("/api/procurement/qrs"),
        fetch("/api/procurement/pos")
      ]);
      
      if (qrRes.ok) {
        const qrData = await qrRes.json().catch(() => ({}));
        const list = qrData?.qrs ?? qrData;
        setQrs(Array.isArray(list) ? list : []);
      } else {
        setQrs([]);
      }

      if (poRes.ok) {
        const poData = await poRes.json().catch(() => ({}));
        const list = (poData as any)?.pos ?? poData;
        setPos(Array.isArray(list) ? list : []);
      } else {
        setPos([]);
      }
    } catch (error) {
      console.error("Failed to load history:", error);
      setQrs([]);
      setPos([]);
    } finally {
      setLoading(false);
    }
  }

  const safeQrs = Array.isArray(qrs) ? qrs : [];
  const safePos = Array.isArray(pos) ? pos : [];

  function handleSelectAllQrs() {
    if (selectedQrIds.size === safeQrs.length) {
      setSelectedQrIds(new Set());
    } else {
      setSelectedQrIds(new Set(safeQrs.map((qr) => qr.id)));
    }
  }

  function handleSelectOneQr(id: string) {
    const newSelected = new Set(selectedQrIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedQrIds(newSelected);
  }

  function handleSelectAllPos() {
    if (selectedPoIds.size === safePos.length) {
      setSelectedPoIds(new Set());
    } else {
      setSelectedPoIds(new Set(safePos.map((po) => po.id)));
    }
  }

  function handleSelectOnePo(id: string) {
    const newSelected = new Set(selectedPoIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPoIds(newSelected);
  }

  function downloadQrCSV() {
    const selectedQrs = safeQrs.filter((qr) => selectedQrIds.has(qr.id));
    if (selectedQrs.length === 0) {
      alert("Please select at least one QR to download");
      return;
    }

    const headers = ["QR Number", "Product", "Status", "Created At"];

    const rows = selectedQrs.map((qr) => {
      const productNames = qr.purchase_details && Array.isArray(qr.purchase_details) && qr.purchase_details.length > 0
        ? qr.purchase_details.map((d: any) => d.productName).join(" | ")
        : "-";

      return [
        qr.qr_number || "-",
        productNames,
        (formatQrStatusLabel(qr.status) === "—" ? "-" : formatQrStatusLabel(qr.status)),
        qr.created_at ? new Date(qr.created_at).toLocaleString() : "-"
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `qr-history-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function downloadPoCSV() {
    const selectedPos = safePos.filter((po) => selectedPoIds.has(po.id));
    if (selectedPos.length === 0) {
      alert("Please select at least one PO to download");
      return;
    }

    const headers = ["PO Number", "Supplier", "Status", "Created At"];

    const rows = selectedPos.map((po) => {
      return [
        po.po_number || "-",
        po.supplier_name || "-",
        po.status?.replace(/_/g, " ") || "-",
        po.created_at ? new Date(po.created_at).toLocaleString() : "-"
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `po-history-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Procurement History</h2>
        </div>
        <div className="py-8 text-center text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Procurement History</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Quotation Requests</h3>
            <button onClick={downloadQrCSV} className="btn-secondary text-xs px-3 py-1.5">
              Download CSV ({selectedQrIds.size})
            </button>
          </div>
          {safeQrs.length === 0 ? (
            <p className="text-xs text-gray-400">No QRs found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-gray-200 text-gray-500">
                  <tr>
                    <th className="px-2 py-2 font-medium">
                      <input
                        type="checkbox"
                        checked={selectedQrIds.size === safeQrs.length && safeQrs.length > 0}
                        onChange={handleSelectAllQrs}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-2 py-2 font-medium">QR Number</th>
                    <th className="px-2 py-2 font-medium">Product</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {safeQrs.map((qr) => (
                    <tr key={qr.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selectedQrIds.has(qr.id)}
                          onChange={() => handleSelectOneQr(qr.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-2 py-2 text-gray-900">
                        {qr.qr_number ? (
                          <span className="font-mono text-xs font-semibold text-gray-900">{qr.qr_number}</span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-gray-900 font-medium">
                        {qr.purchase_details && Array.isArray(qr.purchase_details) && qr.purchase_details.length > 0
                          ? qr.purchase_details.map((d: any) => d.productName).join(", ")
                          : "-"}
                      </td>
                      <td className="px-2 py-2">
                        <span className="badge">{formatQrStatusLabel(qr?.status)}</span>
                      </td>
                      <td className="px-2 py-2 text-gray-500">
                        {qr.created_at
                          ? new Date(qr.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric"
                            })
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Purchase Orders</h3>
            <button onClick={downloadPoCSV} className="btn-secondary text-xs px-3 py-1.5">
              Download CSV ({selectedPoIds.size})
            </button>
          </div>
          {pos.length === 0 ? (
            <p className="text-xs text-gray-400">No POs found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-gray-200 text-gray-500">
                  <tr>
                    <th className="px-2 py-2 font-medium">
                      <input
                        type="checkbox"
                        checked={selectedPoIds.size === safePos.length && safePos.length > 0}
                        onChange={handleSelectAllPos}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-2 py-2 font-medium">PO Number</th>
                    <th className="px-2 py-2 font-medium">Supplier</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {safePos.map((po) => (
                    <tr key={po.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selectedPoIds.has(po.id)}
                          onChange={() => handleSelectOnePo(po.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-2 py-2 text-gray-900">
                        {po.po_number ? (
                          <span className="font-mono text-xs font-semibold text-gray-900">{po.po_number}</span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-gray-900 font-medium">{po.supplier_name}</td>
                      <td className="px-2 py-2">
                        <span className="badge capitalize">{(po?.status ?? "").replace(/_/g, " ") || "—"}</span>
                      </td>
                      <td className="px-2 py-2 text-gray-500">
                        {po.created_at
                          ? new Date(po.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric"
                            })
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
