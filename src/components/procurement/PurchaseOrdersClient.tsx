"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import type { Po, PoStatus } from "@/types/workflows";
import { ListPageHeader } from "@/components/lists/ListPageHeader";
import { StatusFilterPills } from "@/components/lists/StatusFilterPills";
import { ListTableShell, ListEmptyState, ListSkeleton } from "@/components/lists/ListTableShell";
import PoListTable from "@/components/lists/PoListTable";

const statusLabels: Record<PoStatus, string> = {
  order_placed: "Order Placed",
  po_created: "Processing",
  shipment_at_supplier: "At Supplier WH",
  shipment_received_at_supplier_warehouse: "Received At Supplier WH",
  shipment_received_at_lp_warehouse: "Received At LMP WH",
  shipment_received_at_destination_city: "At Destination City",
  shipment_received_at_destination_warehouse: "At Destination Country",
  delivered: "Delivered",
  canceled: "Canceled",
};

interface PurchaseOrdersClientProps {
  initialPos: Po[];
}

export default function PurchaseOrdersClient({ initialPos }: PurchaseOrdersClientProps) {
  const [allPos, setAllPos] = useState<Po[]>(Array.isArray(initialPos) ? initialPos : []);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (allPos.length > 0) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch("/api/procurement/pos", { cache: "no-store" })
      .then((res) => {
        if (cancelled) return null;
        if (!res.ok) {
          setLoadError(`Could not load POs: ${res.status}`);
          setAllPos([]);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled || data === null) return;
        const list = data?.pos ?? data;
        setAllPos(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) {
          setAllPos([]);
          setLoadError("Failed to load purchase orders.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allPos.length]);

  const filteredPos =
    statusFilter === "all" ? allPos : allPos.filter((po) => po.status === statusFilter);

  const filterKeys: PoStatus[] = [
    "order_placed",
    "po_created",
    "shipment_at_supplier",
    "shipment_received_at_lp_warehouse",
    "shipment_received_at_destination_warehouse",
    "delivered",
    "canceled",
  ];

  const filterOptions = [
    { key: "all", label: "All", count: allPos.length },
    ...filterKeys.map((key) => ({
      key,
      label: statusLabels[key],
      count: allPos.filter((p) => p.status === key).length,
    })),
  ];

  return (
    <div className="space-y-6">
      <ListPageHeader
        title="Purchase Orders"
        subtitle="View and manage all purchase orders with supplier and delivery partner details."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/procurement/po/bulk" className="btn-secondary">
              Bulk Upload CSV
            </Link>
            <Link href="/dashboard/procurement/po/new" className="btn-primary">
              Create New PO
            </Link>
          </div>
        }
        filters={
          <StatusFilterPills options={filterOptions} activeKey={statusFilter} onChange={setStatusFilter} />
        }
      />

      <ListTableShell>
        {loading ? (
          <table className="min-w-full"><ListSkeleton rows={6} cols={6} /></table>
        ) : filteredPos.length === 0 ? (
          <ListEmptyState
            message={loadError || "No purchase orders found."}
            action={
              !loadError ? (
                <Link href="/dashboard/procurement/po/new" className="text-sm text-portal-700 hover:underline">
                  Create your first PO →
                </Link>
              ) : undefined
            }
          />
        ) : (
          <PoListTable
            pos={filteredPos}
            selectedIds={new Set()}
            onSelectAll={() => {}}
            onSelectOne={() => {}}
            onView={() => {}}
            showCheckbox={false}
            viewHref={(po) => `/dashboard/procurement/po/${po.id}`}
          />
        )}
      </ListTableShell>
    </div>
  );
}
