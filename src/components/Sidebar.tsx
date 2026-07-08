"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Home,
  TrendingUp,
  BarChart3,
  Package,
  LogOut,
  Search,
  ShoppingCart,
  FileText,
  CheckSquare,
  Banknote,
  Download,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Tag,
  Megaphone,
  ClipboardList,
} from "lucide-react";
import type { UserRole } from "@/lib/simpleAuth";

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

interface Session {
  email: string;
  fullName: string;
  role: string | null;
  isAdmin?: boolean;
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: "growth", label: "Growth" },
  { value: "approver", label: "Approver" },
  { value: "procurement", label: "Procurement" },
  { value: "finance", label: "Finance" },
];

type SearchType = "qr" | "pr" | "po";

export default function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParamsRaw = useSearchParams();
  // Guard: useSearchParams() can be null during SSR / before hydration — never call .get on null
  const searchParams = searchParamsRaw != null ? searchParamsRaw : null;
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchStep, setSearchStep] = useState<1 | 2>(1);
  const [searchType, setSearchType] = useState<SearchType | null>(null);
  const [searchNumber, setSearchNumber] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSubmitting, setSearchSubmitting] = useState(false);
  const [dataDownloadOpen, setDataDownloadOpen] = useState(false);
  const [dataDownloading, setDataDownloading] = useState<SearchType | null>(null);
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [sellerPaymentsOpen, setSellerPaymentsOpen] = useState(false);
  const [purchaseOrdersOpen, setPurchaseOrdersOpen] = useState(false);
  const [poPaymentsOpen, setPoPaymentsOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.session) {
          setSession(data.session);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Apply saved theme preference on load
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    }

    // Fetch service types for Finance dropdown
    fetch("/api/finance/service-types")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.serviceTypes)) {
          setServiceTypes(data.serviceTypes);
        }
      })
      .catch(() => {});
  }, []);

  const handleRoleChange = async (newRole: UserRole) => {
    if (!session?.isAdmin || newRole === session.role) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/admin/switch-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        router.push("/dashboard");
      }
    } finally {
      setSwitching(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
    } catch {
      router.push("/");
    }
  };

  const openSearch = () => {
    setSearchOpen(true);
    setSearchStep(1);
    setSearchType(null);
    setSearchNumber("");
    setSearchError(null);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchStep(1);
    setSearchType(null);
    setSearchNumber("");
    setSearchError(null);
  };

  const handleSearchTypeSelect = (type: SearchType) => {
    setSearchType(type);
    setSearchNumber("");
    setSearchError(null);
    setSearchStep(2);
  };

  const handleSearchSubmit = async () => {
    if (!searchType || !searchNumber.trim()) {
      setSearchError("Please enter a number.");
      return;
    }
    setSearchSubmitting(true);
    setSearchError(null);
    try {
      const res = await fetch(
        `/api/search/lookup?type=${encodeURIComponent(searchType)}&number=${encodeURIComponent(searchNumber.trim())}`
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.id) {
        closeSearch();
        router.push(`/dashboard/search/${searchType}/${data.id}`);
        return;
      }
      setSearchError(data.error || (res.status === 404 ? "No record found with this number." : "Search failed."));
    } catch {
      setSearchError("Search failed.");
    } finally {
      setSearchSubmitting(false);
    }
  };

  const handleDataDownload = async (exportType: SearchType) => {
    setDataDownloading(exportType);
    try {
      const res = await fetch(`/api/data-export?type=${exportType}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Download failed");
        return;
      }
      const blob = await res.blob();
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `${exportType}-export-${dateStr}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setDataDownloadOpen(false);
    } catch {
      alert("Download failed");
    } finally {
      setDataDownloading(null);
    }
  };

  useEffect(() => {
    if (!searchOpen && !dataDownloadOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeSearch();
        setDataDownloadOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchOpen, dataDownloadOpen]);

  // Auto-expand Purchase Orders when navigating to finance purchase-orders route (must be before early return)
  useEffect(() => {
    if (pathname.includes("/finance/purchase-orders")) {
      setPurchaseOrdersOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (pathname.includes("/finance/po-payments")) {
      setPoPaymentsOpen(true);
    }
  }, [pathname]);

  if (loading || !session) {
    return (
      <aside
        className={`flex h-screen flex-col border-r border-portal-700 bg-portal-900 ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="flex items-center justify-center p-6">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-portal-700 border-t-white"></div>
        </div>
      </aside>
    );
  }

  const role = session.role ?? null;
  const isAdmin = !!session.isAdmin;
  const showAll = isAdmin || !role;

  // Auto-expand Seller Payments dropdown when on a seller-payments sub-route
  const isOnSellerPayments = pathname.includes("/finance/seller-payments");
  const effectiveSellerPaymentsOpen = sellerPaymentsOpen || isOnSellerPayments;

  // Purchase Orders: use state only so the toggle can open/close (auto-expand is in useEffect above).
  const effectivePurchaseOrdersOpen = purchaseOrdersOpen;

  // PO Payments: use state only so the toggle can open/close (auto-expand is in useEffect above).
  const effectivePoPaymentsOpen = poPaymentsOpen;

  // Get initials for avatar
  const initials = session.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside
      className={`flex h-screen flex-col border-r border-portal-700 bg-portal-900 transition-all duration-200 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Top Section with toggle + user profile */}
      <div className="border-b border-portal-700 p-4">
        <div className="flex items-center gap-3">
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-portal-700 bg-portal-800 text-portal-100 hover:bg-portal-700 focus:outline-none focus:ring-2 focus:ring-portal-400"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          )}
          {!collapsed && (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-portal-700 text-white font-semibold">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate">
                  {session.fullName}
                </div>
                <div className="text-xs text-portal-200 truncate">{session.email}</div>
              </div>
            </>
          )}
          {collapsed && (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-portal-700 text-white font-semibold">
              {initials}
            </div>
          )}
        </div>

        {/* Role Selector for Admins */}
        {!collapsed && isAdmin && (
          <div className="mt-3">
            <select
              value={role ?? "growth"}
              onChange={(e) => handleRoleChange(e.target.value as UserRole)}
              disabled={switching}
              className="w-full rounded-lg border border-portal-600 bg-portal-800 px-3 py-2 text-sm text-white outline-none focus:border-portal-400 focus:ring-1 focus:ring-portal-400 disabled:opacity-50"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  View as: {r.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Search - clickable */}
      <div className="border-b border-portal-700 p-4">
        <button
          type="button"
          onClick={openSearch}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-white transition-colors hover:bg-portal-800 focus:outline-none focus:ring-2 focus:ring-portal-400 focus:ring-offset-2 focus:ring-offset-portal-900"
          title="Search"
        >
          <Search className="h-4 w-4 text-portal-200" />
          {!collapsed && <span>Search</span>}
        </button>
      </div>

      {/* Search modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          aria-modal="true"
          role="dialog"
          aria-labelledby="search-dialog-title"
          onClick={closeSearch}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-portal-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="search-dialog-title" className="text-lg font-semibold text-portal-900">
                {searchStep === 1 ? "What do you want to search?" : `Enter ${searchType?.toUpperCase()} number`}
              </h2>
              <button
                type="button"
                onClick={closeSearch}
                className="rounded-lg p-1 text-portal-600 hover:bg-portal-50 hover:text-portal-800 focus:outline-none focus:ring-2 focus:ring-portal-400"
                aria-label="Close"
              >
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {searchStep === 1 && (
              <div className="flex flex-wrap gap-2">
                {(["qr", "pr", "po"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSearchTypeSelect(type)}
                    className="rounded-lg border border-portal-200 bg-white px-4 py-2.5 text-sm font-medium text-portal-900 shadow-sm transition-colors hover:bg-portal-50 focus:outline-none focus:ring-2 focus:ring-portal-400 focus:ring-offset-1"
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            )}

            {searchStep === 2 && searchType && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => { setSearchStep(1); setSearchType(null); setSearchNumber(""); setSearchError(null); }}
                  className="text-xs font-medium text-portal-600 hover:text-portal-900"
                >
                  ← Back
                </button>
                <input
                  type="text"
                  value={searchNumber}
                  onChange={(e) => { setSearchNumber(e.target.value); setSearchError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
                  placeholder={searchType === "qr" ? "e.g. QR-123 or 123" : searchType === "pr" ? "e.g. PR-001 or 1" : "e.g. PO-001 or 1"}
                  className="w-full rounded-lg border border-portal-200 px-3 py-2 text-sm text-portal-900 placeholder-portal-500 focus:border-portal-400 focus:outline-none focus:ring-1 focus:ring-portal-400"
                  autoFocus
                />
                {searchError && (
                  <p className="text-sm text-red-600" role="alert">
                    {searchError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleSearchSubmit}
                  disabled={searchSubmitting}
                  className="w-full rounded-lg bg-portal-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-portal-700 focus:outline-none focus:ring-2 focus:ring-portal-400 focus:ring-offset-1 disabled:opacity-50"
                >
                  {searchSubmitting ? "Searching…" : "Search"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Data Download modal */}
      {dataDownloadOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          aria-modal="true"
          role="dialog"
          aria-labelledby="data-download-dialog-title"
          onClick={() => setDataDownloadOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-portal-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="data-download-dialog-title" className="text-lg font-semibold text-portal-900">
                What to download?
              </h2>
              <button
                type="button"
                onClick={() => setDataDownloadOpen(false)}
                className="rounded-lg p-1 text-portal-600 hover:bg-portal-50 hover:text-portal-800 focus:outline-none focus:ring-2 focus:ring-portal-400"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["qr", "pr", "po"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={dataDownloading !== null}
                  onClick={() => handleDataDownload(t)}
                  className="rounded-lg border border-portal-200 bg-white px-4 py-2 text-sm font-medium text-portal-800 shadow-sm transition-colors hover:bg-portal-50 disabled:opacity-50"
                >
                  {dataDownloading === t ? "Downloading…" : `Download ${t.toUpperCase()} (CSV)`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {/* Growth Department */}
          {(showAll || role === "growth") && (
            <>
              <Link
                href="/dashboard/growth"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  pathname === "/dashboard/growth"
                    ? "bg-portal-700 text-white"
                    : "text-portal-100 hover:bg-portal-800"
                }`}
                title="Growth Dashboard"
              >
                <Home className="h-5 w-5" />
                {!collapsed && <span>Growth Dashboard</span>}
              </Link>
              <Link
                href="/dashboard/growth/quotation-requests"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  pathname.includes("/growth/quotation-requests")
                    ? "bg-portal-800 text-white"
                    : "text-portal-200 hover:bg-portal-800"
                }`}
                title="Quotation Requests"
              >
                <FileText className="h-4 w-4" />
                {!collapsed && <span>Quotation Requests</span>}
              </Link>
              <Link
                href="/dashboard/growth/purchase-requests"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  pathname.includes("/growth/purchase-requests")
                    ? "bg-portal-800 text-white"
                    : "text-portal-200 hover:bg-portal-800"
                }`}
                title="Purchase Requests"
              >
                <ShoppingCart className="h-4 w-4" />
                {!collapsed && <span>Purchase Requests</span>}
              </Link>
              <Link
                href="/dashboard/growth/purchase-orders"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  pathname.includes("/growth/purchase-orders")
                    ? "bg-portal-800 text-white"
                    : "text-portal-200 hover:bg-portal-800"
                }`}
                title="Purchase Orders"
              >
                <Package className="h-4 w-4" />
                {!collapsed && <span>Purchase Orders</span>}
              </Link>
            </>
          )}

          {/* Approver Department */}
          {(showAll || role === "approver") && (
            <>
              <Link
                href="/dashboard/approver"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  pathname === "/dashboard/approver"
                    ? "bg-portal-700 text-white"
                    : "text-portal-100 hover:bg-portal-800"
                }`}
                title="Approver Dashboard"
              >
                <CheckSquare className="h-5 w-5" />
                {!collapsed && <span>Approver Dashboard</span>}
              </Link>
              <Link
                href="/dashboard/approver/quotation-requests"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  pathname.includes("/approver/quotation-requests")
                    ? "bg-portal-800 text-white"
                    : "text-portal-200 hover:bg-portal-800"
                }`}
                title="Quotation Requests"
              >
                <FileText className="h-4 w-4" />
                {!collapsed && <span>Quotation Requests</span>}
              </Link>
              <Link
                href="/dashboard/approver/pr"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  pathname.includes("/approver/pr")
                    ? "bg-portal-800 text-white"
                    : "text-portal-200 hover:bg-portal-800"
                }`}
                title="Purchase Requests"
              >
                <ShoppingCart className="h-4 w-4" />
                {!collapsed && <span>Purchase Requests</span>}
              </Link>
              <Link
                href="/dashboard/approver/purchase-orders"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  pathname.includes("/approver/purchase-orders")
                    ? "bg-portal-800 text-white"
                    : "text-portal-200 hover:bg-portal-800"
                }`}
                title="Purchase Orders"
              >
                <Package className="h-4 w-4" />
                {!collapsed && <span>Purchase Orders</span>}
              </Link>
            </>
          )}

          {/* Procurement Department */}
          {(showAll || role === "procurement") && (
            <>
              <Link
                href="/dashboard/procurement"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  pathname === "/dashboard/procurement"
                    ? "bg-portal-700 text-white"
                    : "text-portal-100 hover:bg-portal-800"
                }`}
                title="Procurement Dashboard"
              >
                <TrendingUp className="h-5 w-5" />
                {!collapsed && <span>Procurement Dashboard</span>}
              </Link>
              <Link
                href="/dashboard/procurement/quotation-requests"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  pathname.includes("/procurement/quotation-requests")
                    ? "bg-portal-800 text-white"
                    : "text-portal-200 hover:bg-portal-800"
                }`}
                title="Quotation Requests"
              >
                <FileText className="h-4 w-4" />
                {!collapsed && <span>Quotation Requests</span>}
              </Link>
              <Link
                href="/dashboard/procurement/pr"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  pathname.includes("/procurement/pr")
                    ? "bg-portal-800 text-white"
                    : "text-portal-200 hover:bg-portal-800"
                }`}
                title="Purchase Requests"
              >
                <ShoppingCart className="h-4 w-4" />
                {!collapsed && <span>Purchase Requests</span>}
              </Link>
              <Link
                href="/dashboard/procurement/po"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  pathname.includes("/procurement/po")
                    ? "bg-portal-800 text-white"
                    : "text-portal-200 hover:bg-portal-800"
                }`}
                title="Purchase Orders"
              >
                <Package className="h-4 w-4" />
                {!collapsed && <span>Purchase Orders</span>}
              </Link>
            </>
          )}

          {/* Finance Department */}
          {(showAll || role === "finance") && (
            <>
              <Link
                href="/dashboard/finance"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  pathname === "/dashboard/finance"
                    ? "bg-portal-700 text-white"
                    : "text-portal-100 hover:bg-portal-800"
                }`}
                title="Finance Dashboard"
              >
                <Banknote className="h-5 w-5" />
                {!collapsed && <span>Finance Dashboard</span>}
              </Link>
              {/* Seller Payments Knocking off — collapsible service-type menu */}
              {!collapsed && (
                <div>
                  <button
                    type="button"
                    onClick={() => setSellerPaymentsOpen((prev) => !prev)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      effectiveSellerPaymentsOpen
                        ? "bg-portal-800 text-white"
                        : "text-portal-200 hover:bg-portal-800"
                    }`}
                  >
                    <ShoppingCart className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">Seller Payments Knocking off</span>
                    {effectiveSellerPaymentsOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    )}
                  </button>
                  {effectiveSellerPaymentsOpen && (
                    <div className="mt-0.5 ml-4 space-y-0.5 border-l border-portal-700 pl-3">
                      {serviceTypes.length === 0 ? (
                        <p className="px-2 py-1.5 text-xs text-portal-400">No service types found</p>
                      ) : (
                        serviceTypes.map((st) => {
                          const href = `/dashboard/finance/seller-payments/${encodeURIComponent(st)}`;
                          const isActive = pathname === href;
                          return (
                            <Link
                              key={st}
                              href={href}
                              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors ${
                                isActive
                                  ? "bg-portal-700 text-white font-medium"
                                  : "text-portal-300 hover:bg-portal-800 hover:text-white"
                              }`}
                            >
                              <Tag className="h-3 w-3 shrink-0" />
                              <span>{st}</span>
                            </Link>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
              {/* Purchase Orders — collapsible menu (same pattern as Seller Payments Knocking off) */}
              {collapsed ? (
                <Link
                  href="/dashboard/finance/purchase-orders"
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    pathname.includes("/finance/purchase-orders")
                      ? "bg-portal-800 text-white"
                      : "text-portal-200 hover:bg-portal-800"
                  }`}
                  title="Purchase Orders"
                >
                  <Package className="h-4 w-4" />
                </Link>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={() => setPurchaseOrdersOpen((prev) => !prev)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      effectivePurchaseOrdersOpen
                        ? "bg-portal-800 text-white"
                        : "text-portal-200 hover:bg-portal-800"
                    }`}
                  >
                    <Package className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">Purchase Orders</span>
                    {effectivePurchaseOrdersOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    )}
                  </button>
                  {effectivePurchaseOrdersOpen && (
                    <div className="mt-0.5 ml-4 space-y-0.5 border-l border-portal-700 pl-3">
                      {(() => {
                        const group = searchParams ? searchParams.get("group") : undefined;
                        const isAllActive = !group;
                        const isZambeelActive = group === "zambeel";
                        const isWholesaleActive = group === "wholesale";
                        return (
                          <>
                            <Link
                              href="/dashboard/finance/purchase-orders"
                              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors ${
                                isAllActive
                                  ? "bg-portal-700 text-white font-medium"
                                  : "text-portal-300 hover:bg-portal-800 hover:text-white"
                              }`}
                            >
                              <Tag className="h-3 w-3 shrink-0" />
                              <span>All</span>
                            </Link>
                            <Link
                              href="/dashboard/finance/purchase-orders?group=zambeel"
                              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors ${
                                isZambeelActive
                                  ? "bg-portal-700 text-white font-medium"
                                  : "text-portal-300 hover:bg-portal-800 hover:text-white"
                              }`}
                            >
                              <Tag className="h-3 w-3 shrink-0" />
                              <span>Zambeel Services</span>
                            </Link>
                            <Link
                              href="/dashboard/finance/purchase-orders?group=wholesale"
                              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors ${
                                isWholesaleActive
                                  ? "bg-portal-700 text-white font-medium"
                                  : "text-portal-300 hover:bg-portal-800 hover:text-white"
                              }`}
                            >
                              <Tag className="h-3 w-3 shrink-0" />
                              <span>Wholesale Purchase</span>
                            </Link>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
              {/* PO Payments — collapsible submenu (Supplier / Delivery) */}
              {collapsed ? (
                <Link
                  href="/dashboard/finance/po-payments/supplier"
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    pathname.includes("/finance/po-payments")
                      ? "bg-portal-800 text-white"
                      : "text-portal-200 hover:bg-portal-800"
                  }`}
                  title="PO Payments"
                >
                  <Banknote className="h-4 w-4" />
                </Link>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={() => setPoPaymentsOpen((prev) => !prev)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      effectivePoPaymentsOpen
                        ? "bg-portal-800 text-white"
                        : "text-portal-200 hover:bg-portal-800"
                    }`}
                  >
                    <Banknote className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">PO Payments</span>
                    {effectivePoPaymentsOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    )}
                  </button>
                  {effectivePoPaymentsOpen && (
                    <div className="mt-0.5 ml-4 space-y-0.5 border-l border-portal-700 pl-3">
                      {(() => {
                        const base = "/dashboard/finance/po-payments";
                        const supplierHref = `${base}/supplier`;
                        const deliveryHref = `${base}/delivery`;
                        const supplierActive = pathname.startsWith(supplierHref);
                        const deliveryActive = pathname.startsWith(deliveryHref);
                        return (
                          <>
                            <Link
                              href={supplierHref}
                              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors ${
                                supplierActive
                                  ? "bg-portal-700 text-white font-medium"
                                  : "text-portal-300 hover:bg-portal-800 hover:text-white"
                              }`}
                            >
                              <Tag className="h-3 w-3 shrink-0" />
                              <span>Supplier Payments</span>
                            </Link>
                            <Link
                              href={deliveryHref}
                              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors ${
                                deliveryActive
                                  ? "bg-portal-700 text-white font-medium"
                                  : "text-portal-300 hover:bg-portal-800 hover:text-white"
                              }`}
                            >
                              <Tag className="h-3 w-3 shrink-0" />
                              <span>Delivery Payments</span>
                            </Link>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {/* Product Availability — admin, agent, purchaser, manager */}
          {(showAll || role === "admin" || role === "agent" || role === "purchaser" || role === "manager") && (
            <Link
              href="/dashboard/product-availability"
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                pathname.startsWith("/dashboard/product-availability")
                  ? "bg-portal-700 text-white"
                  : "text-portal-100 hover:bg-portal-800"
              }`}
              title="Product Availability"
            >
              <ClipboardList className="h-5 w-5 shrink-0" />
              {!collapsed && <span>Product Availability</span>}
            </Link>
          )}
        </div>
      </nav>

      {/* Bottom Section - Announcement, Data Download & Logout */}
      <div className="border-t border-portal-700 p-4">
        <div className="flex flex-col gap-1">
          {(showAll || role === "procurement") && (
            <Link
              href="/dashboard/procurement/announcement"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-portal-100 transition-colors hover:bg-portal-800"
              title="Announcement"
            >
              <Megaphone className="h-5 w-5 shrink-0" />
              {!collapsed && <span>Announcement</span>}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setDataDownloadOpen(true)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-portal-100 transition-colors hover:bg-portal-800"
            title="Data Download"
          >
            <Download className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Data Download</span>}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-portal-100 transition-colors hover:bg-portal-800"
            title="Logout"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
