"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AdminCreatorFilter from "@/components/AdminCreatorFilter";
import { ListPageHeader } from "@/components/lists/ListPageHeader";
import { StatusFilterPills } from "@/components/lists/StatusFilterPills";
import { ListTableShell, ListEmptyState, ListSkeleton } from "@/components/lists/ListTableShell";
import { MovementListTable } from "@/components/movements/MovementListTable";
import type { MovementRequest, MovementStatus } from "@/types/movements";
import { MOVEMENT_STATUS_LABELS } from "@/types/movements";

export default function MovementsPageClient() {
  const [rows, setRows] = useState<MovementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [creatorFilter, setCreatorFilter] = useState("");

  useEffect(() => {
    void loadRows();
  }, [creatorFilter]);

  async function loadRows() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (creatorFilter) params.set("createdBy", creatorFilter);
      const res = await fetch(`/api/movements?${params.toString()}`);
      const data = await res.json();
      setRows(res.ok && Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered =
    statusFilter === "all"
      ? rows
      : rows.filter((r) => r.status === statusFilter);

  const statusCounts = Object.keys(MOVEMENT_STATUS_LABELS).reduce(
    (acc, key) => {
      acc[key as MovementStatus] = rows.filter((r) => r.status === key).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  const filterOptions = [
    { key: "all", label: "All", count: rows.length },
    ...Object.entries(MOVEMENT_STATUS_LABELS).map(([key, label]) => ({
      key,
      label,
      count: statusCounts[key] ?? 0,
    })),
  ];

  function handleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.id)));
    }
  }

  function downloadCSV() {
    const selected = filtered.filter((r) => selectedIds.has(r.id));
    if (selected.length === 0) {
      alert("Please select at least one movement to download");
      return;
    }
    const headers = [
      "Movement #",
      "Head",
      "From SKU",
      "From Country",
      "To SKU",
      "To Country",
      "Qty",
      "Shipping",
      "Status",
      "Created By",
      "Created At",
    ];
    const csvRows = selected.map((r) => [
      r.movement_number,
      r.movement_head,
      r.from_sku,
      r.from_country,
      r.to_sku,
      r.to_country,
      String(r.quantity),
      r.shipping_mode,
      r.status,
      r.created_by_email,
      r.created_at,
    ]);
    const csv = [headers, ...csvRows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `movements-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }

  return (
    <div className="space-y-6">
      <ListPageHeader
        title="Movements"
        subtitle="Inventory movement requests — Partner, Gold to Gold, and 360 (coming soon)"
        actions={
          <>
            <Link href="/dashboard/movements/new" className="btn-primary">
              Create Movement
            </Link>
            <button type="button" onClick={downloadCSV} className="btn-secondary">
              Download CSV ({selectedIds.size} selected)
            </button>
          </>
        }
        filters={
          <>
            <AdminCreatorFilter value={creatorFilter} onChange={setCreatorFilter} />
            <StatusFilterPills
              options={filterOptions}
              activeKey={statusFilter}
              onChange={setStatusFilter}
            />
          </>
        }
      />

      <ListTableShell>
        {loading ? (
          <table className="min-w-full">
            <ListSkeleton rows={6} cols={10} />
          </table>
        ) : filtered.length === 0 ? (
          <ListEmptyState message="No movements found." />
        ) : (
          <MovementListTable
            rows={filtered}
            selectedIds={selectedIds}
            onSelectAll={handleSelectAll}
            onSelectOne={(id) => {
              const next = new Set(selectedIds);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              setSelectedIds(next);
            }}
            onView={() => {}}
          />
        )}
      </ListTableShell>
    </div>
  );
}
