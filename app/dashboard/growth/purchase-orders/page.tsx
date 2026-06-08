"use client";

import { useState, useEffect } from "react";
import type { Po } from "@/types/workflows";
import PODetailCard from "@/components/PODetailCard";
import AdminCreatorFilter from "@/components/AdminCreatorFilter";
import { ListPageHeader } from "@/components/lists/ListPageHeader";
import { StatusFilterPills } from "@/components/lists/StatusFilterPills";
import { ListTableShell, ListEmptyState, ListSkeleton } from "@/components/lists/ListTableShell";
import PoListTable from "@/components/lists/PoListTable";
import { formatStatusLabel } from "@/lib/format";

export default function GrowthPurchaseOrdersPage() {
  const [pos, setPos] = useState<Po[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPo, setSelectedPo] = useState<Po | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [creatorFilter, setCreatorFilter] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPos();
  }, [creatorFilter]);

  async function loadPos() {
    setLoading(true);
    try {
      const params = creatorFilter ? `?createdBy=${encodeURIComponent(creatorFilter)}` : "";
      const res = await fetch(`/api/growth/pos${params}`);
      const data = await res.json().catch(() => null);
      setPos(res.ok && Array.isArray(data) ? data : []);
    } catch {
      setPos([]);
    } finally {
      setLoading(false);
    }
  }

  const safePos = Array.isArray(pos) ? pos : [];
  const filteredPos =
    statusFilter === "all" ? safePos : safePos.filter((po) => po.status === statusFilter);

  function handleSelectAll() {
    setSelectedIds(
      selectedIds.size === filteredPos.length
        ? new Set()
        : new Set(filteredPos.map((po) => po.id))
    );
  }

  function handleSelectOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function downloadCSV() {
    const selected = filteredPos.filter((po) => selectedIds.has(po.id));
    if (selected.length === 0) {
      alert("Please select at least one PO to download");
      return;
    }
    const headers = ["PO Number", "PR Number", "Supplier", "Status", "Created At"];
    const rows = selected.map((po) => [
      po.po_number || "-",
      po.pr?.pr_number ?? "-",
      po.supplier_name || "-",
      formatStatusLabel(po.status),
      po.created_at ? new Date(po.created_at).toLocaleString() : "-",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `purchase-orders-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  }

  const statusCounts = {
    all: safePos.length,
    order_placed: safePos.filter((p) => p.status === "order_placed").length,
    shipment_at_supplier: safePos.filter((p) => p.status === "shipment_at_supplier").length,
    delivered: safePos.filter((p) => p.status === "delivered").length,
  };

  const filterOptions = [
    { key: "all", label: "All", count: statusCounts.all },
    { key: "order_placed", label: "Order Placed", count: statusCounts.order_placed },
    { key: "shipment_at_supplier", label: "At Supplier", count: statusCounts.shipment_at_supplier },
    { key: "delivered", label: "Delivered", count: statusCounts.delivered },
  ];

  return (
    <div className="space-y-6">
      <ListPageHeader
        title="My Purchase Orders"
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
          <table className="min-w-full"><ListSkeleton rows={6} cols={7} /></table>
        ) : filteredPos.length === 0 ? (
          <ListEmptyState message="No purchase orders found." />
        ) : (
          <PoListTable
            pos={filteredPos}
            selectedIds={selectedIds}
            onSelectAll={handleSelectAll}
            onSelectOne={handleSelectOne}
            onView={setSelectedPo}
          />
        )}
      </ListTableShell>

      {selectedPo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedPo(null)}
        >
          <div
            className="card max-h-[90vh] w-full max-w-3xl overflow-y-auto border-gray-200 bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-lg font-semibold text-gray-900">{selectedPo.po_number || "Purchase Order"}</h3>
              <button type="button" onClick={() => setSelectedPo(null)} className="text-gray-400 hover:text-gray-600" aria-label="Close">✕</button>
            </div>
            <PODetailCard po={selectedPo} />
          </div>
        </div>
      )}
    </div>
  );
}
