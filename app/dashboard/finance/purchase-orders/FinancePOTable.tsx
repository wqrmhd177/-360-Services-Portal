"use client";

import { useState, useTransition } from "react";
import type { Po, PrProduct } from "@/types/workflows";
import PODetailCard from "@/components/PODetailCard";
import { updateReportingMonth } from "./actions";
import { getServiceGroup, type ServiceGroup } from "@/lib/serviceTypes";

interface FinancePOTableProps {
  pos: Po[];
  creatorNames: Record<string, string>;
  initialServiceGroupFilter?: "all" | "zambeel" | "wholesale";
}

// Generate month options: last 24 months + next 3 months
function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 23, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 3, 1);

  for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
    const year = d.getFullYear();
    const month = d.getMonth();
    const value = `${year}-${String(month + 1).padStart(2, "0")}`;
    const label = new Date(year, month, 1).toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
    });
    options.push({ value, label });
  }
  return options.reverse();
}

const MONTH_OPTIONS = generateMonthOptions();

function formatPoDate(dateStr?: string): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getPrProducts(pr: Po["pr"]): PrProduct[] {
  if (!pr?.products) return [];
  try {
    const raw = pr.products as unknown;
    if (Array.isArray(raw)) return raw as PrProduct[];
  } catch {
    // ignore
  }
  return [];
}

function getPrTotalAmount(po: Po): string {
  const pr = po.pr as any;
  if (!pr) return "-";

  const products = getPrProducts(po.pr);
  if (products.length > 0) {
    const total = products.reduce((sum, p) => sum + (p.totalAmount ?? 0), 0);
    if (total > 0) return total.toLocaleString();
  }
  if (pr.amount != null && pr.amount > 0) return Number(pr.amount).toLocaleString();
  return "-";
}

function getPurchaseFrom(po: Po): string {
  const products = getPrProducts(po.pr);
  if (products.length === 0) return "-";
  const values = [...new Set(products.map((p) => p.countryOfPurchase).filter(Boolean))];
  return values.length > 0 ? values.join(", ") : "-";
}

function getDestinationCountry(po: Po): string {
  const products = getPrProducts(po.pr);
  if (products.length === 0) return "-";
  const values = [...new Set(products.map((p) => p.destinationCountry).filter(Boolean))];
  return values.length > 0 ? values.join(", ") : "-";
}

function getMovementType(po: Po): string {
  const pr = po.pr as any;
  if (!pr) return "-";
  // Try per-product first
  const products = getPrProducts(po.pr);
  if (products.length > 0) {
    const values = [...new Set(products.map((p) => p.movementType).filter(Boolean))];
    if (values.length > 0) return values.join(", ");
  }
  if (pr.movement_type) return pr.movement_type;
  return "-";
}

export default function FinancePOTable({
  pos,
  creatorNames,
  initialServiceGroupFilter = "all",
}: FinancePOTableProps) {
  const [selectedPo, setSelectedPo] = useState<Po | null>(null);
  const [selectedPoIds, setSelectedPoIds] = useState<Set<string>>(new Set());
  const [reportingMonths, setReportingMonths] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    pos.forEach((po) => {
      if (po.reporting_month) map[po.id] = po.reporting_month;
    });
    return map;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [, startTransition] = useTransition();
  const serviceGroupFilter: "all" | Exclude<ServiceGroup, "unknown"> =
    initialServiceGroupFilter;

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredPos = pos.filter((po) => {
    if (normalizedSearch) {
      const poNumber = (po.po_number ?? "").toLowerCase();
      if (!poNumber.includes(normalizedSearch)) return false;
    }

    if (serviceGroupFilter !== "all") {
      const serviceType = (po.pr as any)?.seller_service_type as string | undefined;
      const group = getServiceGroup(serviceType);
      // Exclude POs with no linked PR when a group filter is selected
      if (group === "unknown") return false;
      return group === serviceGroupFilter;
    }

    return true;
  });

  function handleSelectAllPos() {
    if (selectedPoIds.size === filteredPos.length) {
      setSelectedPoIds(new Set());
    } else {
      setSelectedPoIds(new Set(filteredPos.map((po) => po.id)));
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

  function handleReportingMonthChange(poId: string, month: string) {
    const value = month || null;
    setReportingMonths((prev) => ({ ...prev, [poId]: month }));
    startTransition(async () => {
      try {
        await updateReportingMonth(poId, value);
      } catch {
        // revert on failure
        setReportingMonths((prev) => {
          const reverted = { ...prev };
          delete reverted[poId];
          return reverted;
        });
      }
    });
  }

  function downloadPoCSV() {
    const selectedPos = filteredPos.filter((po) => selectedPoIds.has(po.id));
    if (selectedPos.length === 0) {
      alert("Please select at least one PO to download");
      return;
    }

    const headers = [
      "PO Number",
      "PO Date",
      "Channel Name",
      "Service Type",
      "Movement Type",
      "Supplier Name",
      "Supplier Payment Amount",
      "Delivery Partner Name",
      "Delivery Partner Payment Amount",
      "PO Amount (to Seller)",
      "Purchase From",
      "Destination Country",
      "Created By",
      "Status",
      "Reporting Month",
      "Supplier Invoice",
      "Delivery Invoice",
    ];

    const rows = selectedPos.map((po) => {
      const pr = po.pr as any;
      const creatorEmail = pr?.created_by_email ?? "";
      const creatorName = creatorNames[creatorEmail] || creatorEmail.split("@")[0] || "-";
      const reportingMonth = reportingMonths[po.id] ?? po.reporting_month ?? "";
      return [
        po.po_number || "-",
        formatPoDate(po.created_at),
        pr?.seller_channel_name || "-",
        pr?.seller_service_type || "-",
        getMovementType(po),
        po.supplier_name || "-",
        po.supplier_payment_amount != null ? String(po.supplier_payment_amount) : "-",
        po.delivery_partner || "-",
        po.delivery_partner_payment_amount != null ? String(po.delivery_partner_payment_amount) : "-",
        getPrTotalAmount(po),
        getPurchaseFrom(po),
        getDestinationCountry(po),
        creatorName,
        formatStatus(po.status),
        reportingMonth,
        po.supplier_invoice_file || "-",
        po.delivery_partner_invoice_file || "-",
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `purchase-orders-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
          Purchase Orders
        </h2>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">All Purchase Orders</h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search PO number…"
                className="pl-3 pr-7 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-portal-400 focus:border-portal-400 w-48"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button onClick={downloadPoCSV} className="btn-secondary text-sm px-4 py-2">
              Download CSV ({selectedPoIds.size})
            </button>
          </div>
        </div>

        {filteredPos.length === 0 ? (
          <p className="text-sm text-gray-400">
            {searchQuery || serviceGroupFilter !== "all"
              ? "No purchase orders found for the current search/filter."
              : "No purchase orders found."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs border-separate border-spacing-0">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-3 font-semibold text-gray-500 border-b border-gray-200 align-middle text-center w-8">
                    <input
                      type="checkbox"
                      checked={selectedPoIds.size === filteredPos.length && filteredPos.length > 0}
                      onChange={handleSelectAllPos}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-3 py-3 font-semibold text-gray-500 border-b border-gray-200 align-middle text-center min-w-[80px]">PO Number</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 border-b border-gray-200 align-middle text-center min-w-[90px]">PO Date</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 border-b border-gray-200 align-middle text-center min-w-[90px] leading-tight">Channel Name</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 border-b border-gray-200 align-middle text-center min-w-[80px] leading-tight">Service Type</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 border-b border-gray-200 align-middle text-center min-w-[80px] leading-tight">Movement Type</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 border-b border-gray-200 align-middle text-center min-w-[90px] leading-tight">Supplier Name</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 border-b border-gray-200 align-middle text-center min-w-[90px] leading-tight">Supplier Payment Amount</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 border-b border-gray-200 align-middle text-center min-w-[90px] leading-tight">Delivery Partner Name</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 border-b border-gray-200 align-middle text-center min-w-[90px] leading-tight">Delivery Partner Payment Amount</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 border-b border-gray-200 align-middle text-center min-w-[90px] leading-tight">PO Amount (to Seller)</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 border-b border-gray-200 align-middle text-center min-w-[90px] leading-tight">Purchase From</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 border-b border-gray-200 align-middle text-center min-w-[100px] leading-tight">Destination Country</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 border-b border-gray-200 align-middle text-center min-w-[90px] leading-tight">Created By</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 border-b border-gray-200 align-middle text-center min-w-[100px]">Status</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 border-b border-gray-200 align-middle text-center min-w-[120px] leading-tight">Reporting Month</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 border-b border-gray-200 align-middle text-center min-w-[80px] leading-tight">Invoice View</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 border-b border-gray-200 align-middle text-center w-10">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPos.map((po) => {
                  const pr = po.pr as any;
                  const creatorEmail = pr?.created_by_email ?? "";
                  const creatorName =
                    creatorNames[creatorEmail] || creatorEmail.split("@")[0] || "-";
                  const currentMonth = reportingMonths[po.id] ?? po.reporting_month ?? "";

                  return (
                    <tr
                      key={po.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-blue-50/30 transition-colors"
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3 align-middle text-center">
                        <input
                          type="checkbox"
                          checked={selectedPoIds.has(po.id)}
                          onChange={() => handleSelectOnePo(po.id)}
                          className="rounded border-gray-300"
                        />
                      </td>

                      {/* PO Number */}
                      <td className="px-3 py-3 align-middle text-center">
                        {po.po_number ? (
                          <span className="font-mono font-semibold text-gray-900">
                            {po.po_number}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* PO Date */}
                      <td className="px-3 py-3 align-middle text-center text-gray-600 whitespace-nowrap">
                        {formatPoDate(po.created_at)}
                      </td>

                      {/* Channel Name */}
                      <td className="px-3 py-3 align-middle text-center text-gray-700">
                        {pr?.seller_channel_name || <span className="text-gray-400">-</span>}
                      </td>

                      {/* Service Type */}
                      <td className="px-3 py-3 align-middle text-center text-gray-700">
                        {pr?.seller_service_type || <span className="text-gray-400">-</span>}
                      </td>

                      {/* Movement Type */}
                      <td className="px-3 py-3 align-middle text-center text-gray-700 capitalize">
                        {getMovementType(po) === "-" ? (
                          <span className="text-gray-400">-</span>
                        ) : (
                          getMovementType(po)
                        )}
                      </td>

                      {/* Supplier Name */}
                      <td className="px-3 py-3 align-middle text-center text-gray-900 font-medium">
                        {po.supplier_name || <span className="font-normal text-gray-400">-</span>}
                      </td>

                      {/* Supplier Payment Amount */}
                      <td className="px-3 py-3 align-middle text-center text-gray-700 tabular-nums">
                        {po.supplier_payment_amount != null ? (
                          po.supplier_payment_amount.toLocaleString()
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* Delivery Partner Name */}
                      <td className="px-3 py-3 align-middle text-center text-gray-700">
                        {po.delivery_partner || <span className="text-gray-400">-</span>}
                      </td>

                      {/* Delivery Partner Payment Amount */}
                      <td className="px-3 py-3 align-middle text-center text-gray-700 tabular-nums">
                        {po.delivery_partner_payment_amount != null ? (
                          po.delivery_partner_payment_amount.toLocaleString()
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* PO Amount (to Seller) */}
                      <td className="px-3 py-3 align-middle text-center text-gray-700 tabular-nums">
                        {getPrTotalAmount(po) === "-" ? (
                          <span className="text-gray-400">-</span>
                        ) : (
                          getPrTotalAmount(po)
                        )}
                      </td>

                      {/* Purchase From */}
                      <td className="px-3 py-3 align-middle text-center text-gray-700">
                        {getPurchaseFrom(po) === "-" ? (
                          <span className="text-gray-400">-</span>
                        ) : (
                          getPurchaseFrom(po)
                        )}
                      </td>

                      {/* Destination Country */}
                      <td className="px-3 py-3 align-middle text-center text-gray-700">
                        {getDestinationCountry(po) === "-" ? (
                          <span className="text-gray-400">-</span>
                        ) : (
                          getDestinationCountry(po)
                        )}
                      </td>

                      {/* Created By */}
                      <td className="px-3 py-3 align-middle text-center text-gray-700">
                        {creatorEmail ? creatorName : <span className="text-gray-400">-</span>}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3 align-middle text-center">
                        <span className="inline-block rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-600 whitespace-nowrap">
                          {formatStatus(po.status)}
                        </span>
                      </td>

                      {/* Reporting Month */}
                      <td className="px-3 py-3 align-middle text-center">
                        <select
                          value={currentMonth}
                          onChange={(e) => handleReportingMonthChange(po.id, e.target.value)}
                          className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-portal-400 focus:outline-none focus:ring-1 focus:ring-portal-400"
                        >
                          <option value="">— Select —</option>
                          {MONTH_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Invoice View */}
                      <td className="px-3 py-3 align-middle text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {po.supplier_invoice_file ? (
                            <a
                              href={po.supplier_invoice_file}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Supplier Invoice"
                              className="inline-flex items-center gap-0.5 rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                              S
                            </a>
                          ) : (
                            <span
                              title="No Supplier Invoice"
                              className="inline-flex items-center rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-300 cursor-default"
                            >
                              S
                            </span>
                          )}
                          {po.delivery_partner_invoice_file ? (
                            <a
                              href={po.delivery_partner_invoice_file}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Delivery Partner Invoice"
                              className="inline-flex items-center rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                            >
                              D
                            </a>
                          ) : (
                            <span
                              title="No Delivery Invoice"
                              className="inline-flex items-center rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-300 cursor-default"
                            >
                              D
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3 align-middle text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedPo(po)}
                          className="text-gray-400 hover:text-gray-700 transition-colors"
                          title="View details"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-4 h-4"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PO Detail Modal */}
      {selectedPo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSelectedPo(null)}
        >
          <div
            className="card max-w-4xl w-full mx-4 border-gray-200 bg-white max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                PO Details{" "}
                {selectedPo.po_number && (
                  <span className="text-sm font-mono text-gray-600">({selectedPo.po_number})</span>
                )}
              </h3>
              <button
                onClick={() => setSelectedPo(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <PODetailCard po={selectedPo} showFullDetails />
          </div>
        </div>
      )}
    </div>
  );
}
