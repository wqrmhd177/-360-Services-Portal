"use client";

import { useState, useEffect } from "react";
import type { Qr } from "@/types/workflows";
import QrDetailModal from "@/components/QrDetailModal";
import CreatorFilterDropdown from "@/components/CreatorFilterDropdown";
import { ListPageHeader } from "@/components/lists/ListPageHeader";
import { StatusFilterPills } from "@/components/lists/StatusFilterPills";
import { ListTableShell, ListEmptyState, ListSkeleton } from "@/components/lists/ListTableShell";
import QrListTable from "@/components/lists/QrListTable";
import { summarizeDestinations, summarizeProducts } from "@/lib/format";

export default function ApproverQuotationRequestsPage() {
  const [qrs, setQrs] = useState<Qr[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [creatorFilter, setCreatorFilter] = useState<string>("");
  const [selectedQrId, setSelectedQrId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadQrs();
  }, [creatorFilter]);

  async function loadQrs() {
    setLoading(true);
    try {
      const params = creatorFilter ? `?createdBy=${encodeURIComponent(creatorFilter)}` : "";
      const res = await fetch(`/api/approver/qrs${params}`);
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
    statusFilter === "all" ? safeQrs : safeQrs.filter((qr) => qr.status === statusFilter);

  function handleSelectAll() {
    setSelectedIds(
      selectedIds.size === filteredQrs.length
        ? new Set()
        : new Set(filteredQrs.map((qr) => qr.id))
    );
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
    const rows = selectedQrs.map((qr) => [
      qr.qr_number || qr.id,
      summarizeProducts(qr.purchase_details),
      qr.reseller_code,
      summarizeDestinations(qr.purchase_details),
      qr.status,
      qr.created_at ? new Date(qr.created_at).toLocaleString() : "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
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

  return (
    <div className="space-y-6">
      <ListPageHeader
        title="Quotation Request History"
        subtitle="View only"
        actions={
          <button type="button" onClick={downloadCSV} className="btn-secondary">
            Download CSV ({selectedIds.size} selected)
          </button>
        }
        filters={
          <>
            <CreatorFilterDropdown value={creatorFilter} onChange={setCreatorFilter} />
            <StatusFilterPills options={filterOptions} activeKey={statusFilter} onChange={setStatusFilter} />
          </>
        }
      />

      <ListTableShell>
        {loading ? (
          <table className="min-w-full"><ListSkeleton rows={6} cols={8} /></table>
        ) : filteredQrs.length === 0 ? (
          <ListEmptyState message="No quotation requests found." />
        ) : (
          <QrListTable
            qrs={filteredQrs}
            selectedIds={selectedIds}
            onSelectAll={handleSelectAll}
            onSelectOne={handleSelectOne}
            onView={setSelectedQrId}
          />
        )}
      </ListTableShell>

      {selectedQrId && (
        <QrDetailModal qrId={selectedQrId} onClose={() => setSelectedQrId(null)} />
      )}
    </div>
  );
}
