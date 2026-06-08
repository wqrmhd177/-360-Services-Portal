"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { Qr } from "@/types/workflows";
import QrDetailModal from "@/components/QrDetailModal";
import AdminCreatorFilter from "@/components/AdminCreatorFilter";
import { ListPageHeader } from "@/components/lists/ListPageHeader";
import { StatusFilterPills } from "@/components/lists/StatusFilterPills";
import { ListTableShell, ListEmptyState, ListSkeleton } from "@/components/lists/ListTableShell";
import QrListTable from "@/components/lists/QrListTable";

export default function GrowthQuotationRequestsPage() {
  const searchParams = useSearchParams();
  const [qrs, setQrs] = useState<Qr[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [creatorFilter, setCreatorFilter] = useState<string>("");
  const [selectedQrId, setSelectedQrId] = useState<string | null>(null);

  useEffect(() => {
    loadQrs();
  }, [creatorFilter]);

  async function loadQrs() {
    setLoading(true);
    try {
      const params = creatorFilter ? `?createdBy=${encodeURIComponent(creatorFilter)}` : "";
      const res = await fetch(`/api/growth/qrs${params}`);
      const data = await res.json().catch(() => null);
      setQrs(res.ok && Array.isArray(data) ? data : []);
    } catch {
      setQrs([]);
    } finally {
      setLoading(false);
    }
  }

  const safeQrs = Array.isArray(qrs) ? qrs : [];
  const filteredQrs =
    statusFilter === "all"
      ? safeQrs
      : safeQrs.filter((qr) => (qr?.status ?? "") === statusFilter);

  function handleSelectAll() {
    if (selectedIds.size === filteredQrs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQrs.map((qr) => qr.id)));
    }
  }

  function handleSelectOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function downloadCSV() {
    const selectedQrs = filteredQrs.filter((qr) => selectedIds.has(qr.id));
    if (selectedQrs.length === 0) {
      alert("Please select at least one QR to download");
      return;
    }

    const headers = ["QR Number", "Product", "Seller", "Destinations", "Status", "Created At"];
    const rows = selectedQrs.map((qr) => {
      const products =
        qr.purchase_details?.map((d) => d.productName).filter(Boolean).join(" | ") || "";
      const destinations = qr.purchase_details
        ?.flatMap((d) => d.destinationCountries?.length ? d.destinationCountries : d.destinationCountry ? [d.destinationCountry] : [])
        .join(", ") || "";
      return [
        qr.qr_number || qr.id,
        products,
        qr.reseller_code,
        destinations,
        qr.status,
        qr.created_at ? new Date(qr.created_at).toLocaleString() : "",
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `quotation-requests-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  }

  const statusCounts = {
    all: safeQrs.length,
    open: safeQrs.filter((q) => q.status === "open").length,
    responded: safeQrs.filter((q) => q.status === "responded").length,
    converted_to_pr: safeQrs.filter((q) => q.status === "converted_to_pr").length,
    canceled: safeQrs.filter((q) => q.status === "canceled").length,
  };

  const filterOptions = [
    { key: "all", label: "All", count: statusCounts.all },
    { key: "open", label: "Open", count: statusCounts.open },
    { key: "responded", label: "Responded", count: statusCounts.responded },
    { key: "converted_to_pr", label: "Converted to PR", count: statusCounts.converted_to_pr },
    { key: "canceled", label: "Canceled", count: statusCounts.canceled },
  ];

  const showReconfirmMessage = searchParams?.get("message") === "reconfirm_rates";

  return (
    <div className="space-y-6">
      {showReconfirmMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Convert to PR is available within 3 working days of the last response or re-edit by Procurement.
          After that, please reconfirm rates with Procurement before converting.
        </div>
      )}

      <ListPageHeader
        title="Quotation Request History"
        actions={
          <button type="button" onClick={downloadCSV} className="btn-secondary">
            Download CSV ({selectedIds.size} selected)
          </button>
        }
        filters={
          <>
            <AdminCreatorFilter value={creatorFilter} onChange={setCreatorFilter} />
            <StatusFilterPills options={filterOptions} activeKey={statusFilter} onChange={setStatusFilter} />
          </>
        }
      />

      <ListTableShell>
        {loading ? (
          <table className="min-w-full">
            <ListSkeleton rows={6} cols={8} />
          </table>
        ) : filteredQrs.length === 0 ? (
          <ListEmptyState message="No quotation requests found." />
        ) : (
          <QrListTable
            qrs={filteredQrs}
            selectedIds={selectedIds}
            onSelectAll={handleSelectAll}
            onSelectOne={handleSelectOne}
            onView={setSelectedQrId}
            showConvertAction
          />
        )}
      </ListTableShell>

      {selectedQrId && (
        <QrDetailModal qrId={selectedQrId} onClose={() => setSelectedQrId(null)} />
      )}
    </div>
  );
}
