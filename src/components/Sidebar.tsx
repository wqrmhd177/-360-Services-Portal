"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Home,
  TrendingUp,
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
  Radio,
  Megaphone,
  ClipboardList,
  Layers,
  List,
  Settings,
  Truck,
  BarChart3,
  Warehouse,
  Eye,
} from "lucide-react";
import { deriveEffectivePermissions } from "@/lib/permissions";
import type { UserPermissions } from "@/lib/permissions";

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

interface Session {
  email: string;
  fullName: string;
  role: string | null;
  isAdmin?: boolean;
  permissions?: UserPermissions;
}

type SearchType = "qr" | "pr" | "po";

function NavLink({
  href,
  pathname,
  collapsed,
  icon,
  label,
  indent = false,
  matchPrefix,
  badge,
}: {
  href: string;
  pathname: string;
  collapsed: boolean;
  icon: ReactNode;
  label: string;
  indent?: boolean;
  matchPrefix?: string;
  badge?: number;
}) {
  const active = matchPrefix ? pathname.includes(matchPrefix) : pathname === href;
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
        indent ? "py-2 text-xs" : "font-medium"
      } ${
        active
          ? indent
            ? "bg-portal-800 text-white"
            : "bg-portal-700 text-white"
          : indent
            ? "text-portal-300 hover:bg-portal-800 hover:text-white"
            : "text-portal-100 hover:bg-portal-800"
      } ${indent ? "ml-2 pl-2" : ""}`}
      title={label}
    >
      {icon}
      {!collapsed && (
        <span className="flex flex-1 items-center justify-between gap-2">
          <span>{label}</span>
          {badge != null && badge > 0 && (
            <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </span>
      )}
    </Link>
  );
}

function SectionToggle({
  open,
  onToggle,
  onSidebarExpand,
  collapsed,
  label,
  icon,
  active,
}: {
  open: boolean;
  onToggle: () => void;
  onSidebarExpand?: () => void;
  collapsed: boolean;
  label: string;
  icon: ReactNode;
  active?: boolean;
}) {
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => (onSidebarExpand ? onSidebarExpand() : onToggle())}
        className={`flex w-full items-center justify-center rounded-lg px-3 py-2.5 text-sm transition-colors ${
          active ? "bg-portal-700 text-white" : "text-portal-100 hover:bg-portal-800"
        }`}
        title={label}
      >
        {icon}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
        active ? "bg-portal-800 text-white" : "text-portal-100 hover:bg-portal-800"
      }`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {open ? (
        <ChevronDown className="h-4 w-4 shrink-0" />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0" />
      )}
    </button>
  );
}

function DeptToggle({
  open,
  onToggle,
  collapsed,
  label,
  active,
}: {
  open: boolean;
  onToggle: () => void;
  collapsed: boolean;
  label: string;
  active?: boolean;
}) {
  if (collapsed) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`ml-2 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
        active ? "bg-portal-800 text-white" : "text-portal-200 hover:bg-portal-800"
      }`}
    >
      <span className="flex-1 text-left">{label}</span>
      {open ? (
        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
      )}
    </button>
  );
}

export default function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParamsRaw = useSearchParams();
  const searchParams = searchParamsRaw != null ? searchParamsRaw : null;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
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

  const [zambeelOpen, setZambeelOpen] = useState(false);
  const [growthOpen, setGrowthOpen] = useState(false);
  const [approverOpen, setApproverOpen] = useState(false);
  const [procurementOpen, setProcurementOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [paOpen, setPaOpen] = useState(false);
  const [plOpen, setPlOpen] = useState(false);
  const [opsOpen, setOpsOpen] = useState(false);
  const [plPendingCount, setPlPendingCount] = useState(0);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.session) setSession(data.session);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    }

    fetch("/api/finance/service-types")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.serviceTypes)) setServiceTypes(data.serviceTypes);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!session) return;
    const { isAdmin, permissions } = session as { isAdmin?: boolean; permissions?: UserPermissions };
    const { productListing } = deriveEffectivePermissions({
      role: session.role ?? null,
      isAdmin: !!isAdmin,
      permissions,
    });
    if (!isAdmin && !productListing) return;
    const load = async () => {
      try {
        const supabase = (await import("@/lib/supabaseClient")).createSupabaseClient();
        const [ph, vs] = await Promise.all([
          supabase.from("pl_price_history").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("pl_variant_status_change_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        ]);
        setPlPendingCount((ph.count ?? 0) + (vs.count ?? 0));
      } catch {
        // silently ignore
      }
    };
    load();
  }, [session]);


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
      setSearchError(
        data.error || (res.status === 404 ? "No record found with this number." : "Search failed.")
      );
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

  if (loading || !session) {
    return (
      <aside
        className={`flex h-screen flex-col border-r border-portal-700 bg-portal-900 ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="flex items-center justify-center p-6">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-portal-700 border-t-white" />
        </div>
      </aside>
    );
  }

  const role = session.role ?? null;
  const isAdmin = !!session.isAdmin;
  const { zambeelPerms, paRole, productListing, operations } = deriveEffectivePermissions({
    role,
    isAdmin,
    permissions: session.permissions,
  });

  const showZambeel = isAdmin || zambeelPerms.length > 0;
  const showGrowth = isAdmin || zambeelPerms.includes("growth");
  const showApprover = isAdmin || zambeelPerms.includes("approver");
  const showProcurement = isAdmin || zambeelPerms.includes("procurement");
  const showFinance = isAdmin || zambeelPerms.includes("finance");
  const showPa = isAdmin || !!paRole;
  const showPl = isAdmin || productListing;
  const showOps = isAdmin || operations;

  const isOnSellerPayments = pathname.includes("/finance/seller-payments");
  const effectiveSellerPaymentsOpen = sellerPaymentsOpen || isOnSellerPayments;
  const effectivePurchaseOrdersOpen = purchaseOrdersOpen;
  const effectivePoPaymentsOpen = poPaymentsOpen;

  const iconClass = collapsed ? "h-5 w-5 shrink-0" : "h-4 w-4 shrink-0";
  const iconClassLg = "h-5 w-5 shrink-0";

  return (
    <aside
      className={`flex h-screen flex-col border-r border-portal-700 bg-portal-900 transition-all duration-200 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
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
            <div className="min-w-0 flex-1">
              <div className="break-words font-semibold leading-snug text-white">
                {session.fullName}
              </div>
              <div className="mt-0.5 break-all text-xs leading-snug text-portal-200">
                {session.email}
              </div>
            </div>
          )}
        </div>
      </div>

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
                className="rounded-lg p-1 text-portal-600 hover:bg-portal-50 hover:text-portal-800"
                aria-label="Close"
              >
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
                    className="rounded-lg border border-portal-200 bg-white px-4 py-2.5 text-sm font-medium text-portal-900 shadow-sm hover:bg-portal-50"
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
                  onClick={() => {
                    setSearchStep(1);
                    setSearchType(null);
                    setSearchNumber("");
                    setSearchError(null);
                  }}
                  className="text-xs font-medium text-portal-600 hover:text-portal-900"
                >
                  ← Back
                </button>
                <input
                  type="text"
                  value={searchNumber}
                  onChange={(e) => {
                    setSearchNumber(e.target.value);
                    setSearchError(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
                  placeholder={
                    searchType === "qr"
                      ? "e.g. QR-123 or 123"
                      : searchType === "pr"
                        ? "e.g. PR-001 or 1"
                        : "e.g. PO-001 or 1"
                  }
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
                  className="w-full rounded-lg bg-portal-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-portal-700 disabled:opacity-50"
                >
                  {searchSubmitting ? "Searching…" : "Search"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
                className="rounded-lg p-1 text-portal-600 hover:bg-portal-50"
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
                  className="rounded-lg border border-portal-200 bg-white px-4 py-2 text-sm font-medium text-portal-800 shadow-sm hover:bg-portal-50 disabled:opacity-50"
                >
                  {dataDownloading === t ? "Downloading…" : `Download ${t.toUpperCase()} (CSV)`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          <NavLink
            href="/dashboard"
            pathname={pathname}
            collapsed={collapsed}
            icon={<Home className={iconClassLg} />}
            label="Home"
          />

          {showZambeel && (
            <div>
              <SectionToggle
                open={zambeelOpen}
                onToggle={() => setZambeelOpen((p) => !p)}
                onSidebarExpand={() => {
                  onToggle?.();
                  setZambeelOpen(true);
                }}
                collapsed={collapsed}
                label="Zambeel 360"
                icon={<Layers className={iconClassLg} />}
                active={pathname.match(/\/dashboard\/(growth|approver|procurement|finance)/) != null}
              />
              {zambeelOpen && !collapsed && (
                <div className="mt-0.5 space-y-0.5 border-l border-portal-700 pl-2">
                  {showGrowth && (
                    <div>
                      <DeptToggle
                        open={growthOpen}
                        onToggle={() => setGrowthOpen((p) => !p)}
                        collapsed={collapsed}
                        label="Growth"
                        active={pathname.includes("/dashboard/growth")}
                      />
                      {growthOpen && (
                        <div className="ml-2 space-y-0.5 border-l border-portal-700 pl-2">
                          <NavLink href="/dashboard/growth" pathname={pathname} collapsed={collapsed} icon={<Home className={iconClass} />} label="Growth Dashboard" indent />
                          <NavLink href="/dashboard/growth/quotation-requests" pathname={pathname} collapsed={collapsed} icon={<FileText className={iconClass} />} label="Quotation Requests" indent matchPrefix="/growth/quotation-requests" />
                          <NavLink href="/dashboard/growth/purchase-requests" pathname={pathname} collapsed={collapsed} icon={<ShoppingCart className={iconClass} />} label="Purchase Requests" indent matchPrefix="/growth/purchase-requests" />
                          <NavLink href="/dashboard/growth/purchase-orders" pathname={pathname} collapsed={collapsed} icon={<Package className={iconClass} />} label="Purchase Orders" indent matchPrefix="/growth/purchase-orders" />
                        </div>
                      )}
                    </div>
                  )}

                  {showApprover && (
                    <div>
                      <DeptToggle
                        open={approverOpen}
                        onToggle={() => setApproverOpen((p) => !p)}
                        collapsed={collapsed}
                        label="Approver"
                        active={pathname.includes("/dashboard/approver")}
                      />
                      {approverOpen && (
                        <div className="ml-2 space-y-0.5 border-l border-portal-700 pl-2">
                          <NavLink href="/dashboard/approver" pathname={pathname} collapsed={collapsed} icon={<CheckSquare className={iconClass} />} label="Approver Dashboard" indent />
                          <NavLink href="/dashboard/approver/quotation-requests" pathname={pathname} collapsed={collapsed} icon={<FileText className={iconClass} />} label="Quotation Requests" indent matchPrefix="/approver/quotation-requests" />
                          <NavLink href="/dashboard/approver/pr" pathname={pathname} collapsed={collapsed} icon={<ShoppingCart className={iconClass} />} label="Purchase Requests" indent matchPrefix="/approver/pr" />
                          <NavLink href="/dashboard/approver/purchase-orders" pathname={pathname} collapsed={collapsed} icon={<Package className={iconClass} />} label="Purchase Orders" indent matchPrefix="/approver/purchase-orders" />
                        </div>
                      )}
                    </div>
                  )}

                  {showFinance && (
                    <div>
                      <DeptToggle
                        open={financeOpen}
                        onToggle={() => setFinanceOpen((p) => !p)}
                        collapsed={collapsed}
                        label="Finance"
                        active={pathname.includes("/dashboard/finance")}
                      />
                      {financeOpen && (
                        <div className="ml-2 space-y-0.5 border-l border-portal-700 pl-2">
                          <NavLink href="/dashboard/finance" pathname={pathname} collapsed={collapsed} icon={<Banknote className={iconClass} />} label="Finance Dashboard" indent />
                          <div>
                            <button
                              type="button"
                              onClick={() => setSellerPaymentsOpen((p) => !p)}
                              className={`ml-2 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors ${
                                effectiveSellerPaymentsOpen
                                  ? "bg-portal-800 text-white"
                                  : "text-portal-300 hover:bg-portal-800 hover:text-white"
                              }`}
                            >
                              <ShoppingCart className="h-3 w-3 shrink-0" />
                              <span className="flex-1 text-left">Seller Payments Knocking off</span>
                              {effectiveSellerPaymentsOpen ? (
                                <ChevronDown className="h-3 w-3 shrink-0" />
                              ) : (
                                <ChevronRight className="h-3 w-3 shrink-0" />
                              )}
                            </button>
                            {effectiveSellerPaymentsOpen && (
                              <div className="ml-4 space-y-0.5 border-l border-portal-700 pl-2">
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
                                            ? "bg-portal-700 font-medium text-white"
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
                          <div>
                            <button
                              type="button"
                              onClick={() => setPurchaseOrdersOpen((p) => !p)}
                              className={`ml-2 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors ${
                                effectivePurchaseOrdersOpen
                                  ? "bg-portal-800 text-white"
                                  : "text-portal-300 hover:bg-portal-800 hover:text-white"
                              }`}
                            >
                              <Package className="h-3 w-3 shrink-0" />
                              <span className="flex-1 text-left">Purchase Orders</span>
                              {effectivePurchaseOrdersOpen ? (
                                <ChevronDown className="h-3 w-3 shrink-0" />
                              ) : (
                                <ChevronRight className="h-3 w-3 shrink-0" />
                              )}
                            </button>
                            {effectivePurchaseOrdersOpen && (
                              <div className="ml-4 space-y-0.5 border-l border-portal-700 pl-2">
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
                                            ? "bg-portal-700 font-medium text-white"
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
                                            ? "bg-portal-700 font-medium text-white"
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
                                            ? "bg-portal-700 font-medium text-white"
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
                          <div>
                            <button
                              type="button"
                              onClick={() => setPoPaymentsOpen((p) => !p)}
                              className={`ml-2 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors ${
                                effectivePoPaymentsOpen
                                  ? "bg-portal-800 text-white"
                                  : "text-portal-300 hover:bg-portal-800 hover:text-white"
                              }`}
                            >
                              <Banknote className="h-3 w-3 shrink-0" />
                              <span className="flex-1 text-left">PO Payments</span>
                              {effectivePoPaymentsOpen ? (
                                <ChevronDown className="h-3 w-3 shrink-0" />
                              ) : (
                                <ChevronRight className="h-3 w-3 shrink-0" />
                              )}
                            </button>
                            {effectivePoPaymentsOpen && (
                              <div className="ml-4 space-y-0.5 border-l border-portal-700 pl-2">
                                <Link
                                  href="/dashboard/finance/po-payments/supplier"
                                  className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors ${
                                    pathname.startsWith("/dashboard/finance/po-payments/supplier")
                                      ? "bg-portal-700 font-medium text-white"
                                      : "text-portal-300 hover:bg-portal-800 hover:text-white"
                                  }`}
                                >
                                  <Tag className="h-3 w-3 shrink-0" />
                                  <span>Supplier Payments</span>
                                </Link>
                                <Link
                                  href="/dashboard/finance/po-payments/delivery"
                                  className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors ${
                                    pathname.startsWith("/dashboard/finance/po-payments/delivery")
                                      ? "bg-portal-700 font-medium text-white"
                                      : "text-portal-300 hover:bg-portal-800 hover:text-white"
                                  }`}
                                >
                                  <Tag className="h-3 w-3 shrink-0" />
                                  <span>Delivery Payments</span>
                                </Link>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {showProcurement && (
                    <div>
                      <DeptToggle
                        open={procurementOpen}
                        onToggle={() => setProcurementOpen((p) => !p)}
                        collapsed={collapsed}
                        label="Procurement"
                        active={pathname.includes("/dashboard/procurement")}
                      />
                      {procurementOpen && (
                        <div className="ml-2 space-y-0.5 border-l border-portal-700 pl-2">
                          <NavLink href="/dashboard/procurement" pathname={pathname} collapsed={collapsed} icon={<TrendingUp className={iconClass} />} label="Procurement Dashboard" indent />
                          <NavLink href="/dashboard/procurement/quotation-requests" pathname={pathname} collapsed={collapsed} icon={<FileText className={iconClass} />} label="Quotation Requests" indent matchPrefix="/procurement/quotation-requests" />
                          <NavLink href="/dashboard/procurement/pr" pathname={pathname} collapsed={collapsed} icon={<ShoppingCart className={iconClass} />} label="Purchase Requests" indent matchPrefix="/procurement/pr" />
                          <NavLink href="/dashboard/procurement/po" pathname={pathname} collapsed={collapsed} icon={<Package className={iconClass} />} label="Purchase Orders" indent matchPrefix="/procurement/po" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {showPa && (
            <div>
              <SectionToggle
                open={paOpen}
                onToggle={() => setPaOpen((p) => !p)}
                onSidebarExpand={() => {
                  onToggle?.();
                  setPaOpen(true);
                }}
                collapsed={collapsed}
                label="Product Availability"
                icon={<ClipboardList className={iconClassLg} />}
                active={pathname.startsWith("/dashboard/product-availability")}
              />
              {paOpen && !collapsed && (
                <div className="mt-0.5 ml-2 space-y-0.5 border-l border-portal-700 pl-2">
                  <NavLink
                    href="/dashboard/product-availability"
                    pathname={pathname}
                    collapsed={collapsed}
                    icon={<ClipboardList className={iconClass} />}
                    label="Product Availability"
                    indent
                  />
                </div>
              )}
            </div>
          )}

          {showPl && (
            <div>
              <SectionToggle
                open={plOpen}
                onToggle={() => setPlOpen((p) => !p)}
                onSidebarExpand={() => {
                  onToggle?.();
                  setPlOpen(true);
                }}
                collapsed={collapsed}
                label="Product Listing"
                icon={<List className={iconClassLg} />}
                active={pathname.startsWith("/dashboard/product-listing")}
              />
              {plOpen && !collapsed && (
                <div className="mt-0.5 ml-2 space-y-0.5 border-l border-portal-700 pl-2">
                  <NavLink href="/dashboard/product-listing/suppliers" pathname={pathname} collapsed={collapsed} icon={<Truck className={iconClass} />} label="Suppliers" indent matchPrefix="/product-listing/suppliers" />
                  <NavLink href="/dashboard/product-listing/products" pathname={pathname} collapsed={collapsed} icon={<Package className={iconClass} />} label="Products" indent matchPrefix="/product-listing/products" />
                  <NavLink href="/dashboard/product-listing/product-updates" pathname={pathname} collapsed={collapsed} icon={<FileText className={iconClass} />} label="Product Updates" indent matchPrefix="/product-listing/product-updates" badge={plPendingCount} />
                </div>
              )}
            </div>
          )}

          {showOps && (
            <div>
              <SectionToggle
                open={opsOpen}
                onToggle={() => setOpsOpen((p) => !p)}
                onSidebarExpand={() => {
                  onToggle?.();
                  setOpsOpen(true);
                }}
                collapsed={collapsed}
                label="Operations"
                icon={<BarChart3 className={iconClassLg} />}
                active={pathname.startsWith("/dashboard/operations")}
              />
              {opsOpen && !collapsed && (
                <div className="mt-0.5 ml-2 space-y-0.5 border-l border-portal-700 pl-2">
                  <NavLink href="/dashboard/operations" pathname={pathname} collapsed={collapsed} icon={<Home className={iconClass} />} label="Dashboard" indent />
                  <NavLink href="/dashboard/operations/orders" pathname={pathname} collapsed={collapsed} icon={<ShoppingCart className={iconClass} />} label="Orders" indent matchPrefix="/operations/orders" />
                  <NavLink href="/dashboard/operations/store-visibility" pathname={pathname} collapsed={collapsed} icon={<Eye className={iconClass} />} label="Store Visibility" indent matchPrefix="/operations/store-visibility" />
                  <NavLink href="/dashboard/operations/inventory" pathname={pathname} collapsed={collapsed} icon={<Warehouse className={iconClass} />} label="Inventory" indent matchPrefix="/operations/inventory" />
                  <NavLink href="/dashboard/operations/nd-report" pathname={pathname} collapsed={collapsed} icon={<FileText className={iconClass} />} label="ND Report" indent matchPrefix="/operations/nd-report" />
                  <NavLink href="/dashboard/operations/channel-list" pathname={pathname} collapsed={collapsed} icon={<Radio className={iconClass} />} label="Channel List" indent matchPrefix="/operations/channel-list" />
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      <div className="border-t border-portal-700 p-4">
        <div className="flex flex-col gap-1">
          {isAdmin && (
            <Link
              href="/dashboard/admin/users"
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                pathname.startsWith("/dashboard/admin/users")
                  ? "bg-portal-700 text-white"
                  : "text-portal-100 hover:bg-portal-800"
              }`}
              title="User Settings"
            >
              <Settings className="h-5 w-5 shrink-0" />
              {!collapsed && <span>User Settings</span>}
            </Link>
          )}
          {(isAdmin || zambeelPerms.includes("procurement")) && (
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
