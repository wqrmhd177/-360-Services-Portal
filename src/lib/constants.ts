export const METABASE_ORDERS_URL =
  process.env.METABASE_ORDERS_API_URL ??
  "https://zambeel.metabaseapp.com/public/question/3a678d4c-3f65-433e-a451-73db490cac44.json";

export const METABASE_INVENTORY_URL =
  process.env.METABASE_INVENTORY_API_URL ??
  "https://zambeel.metabaseapp.com/public/question/1baaf009-da23-4baf-8dad-8e2657498666.json";

export const TOP_NAV = [
  { label: "Home", href: "/home" },
  { label: "Orders", href: "/orders/operations" },
  { label: "Inventory", href: "/inventory/search" },
  { label: "Margins", href: "/margins", adminOnly: true },
  { label: "Marketing", href: "/marketing", adminOnly: true },
] as const;

export const ORDERS_SUB_NAV = [
  { label: "Stores", href: "/orders/stores", adminOnly: true },
  { label: "Geography", href: "/orders/geography", adminOnly: true },
  { label: "Operations", href: "/orders/operations" },
  { label: "Explorer", href: "/orders/explorer" },
] as const;

export const INVENTORY_SUB_NAV = [
  { label: "Search", href: "/inventory/search" },
  { label: "Replenishment", href: "/inventory/replenishment" },
  { label: "Stock Cover Days", href: "/inventory/stock-cover-days" },
] as const;

export const STATUS_COLOR_PALETTE = [
  "#0d9488",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#64748b",
  "#f43f5e",
  "#06b6d4",
  "#84cc16",
] as const;

/** Excluded from Dispatch → Deliver denominator (order-level status). */
export const STATUS_DISPATCH_EXCLUDED = new Set([
  "Confirmation Pending",
  "Approved",
  "Dispatching in Process",
  "Cancelled",
  "Canceled",
]);

export const STATUS_COLORS: Record<string, string> = {
  Delivered: "#10b981",
  Shipped: "#3b82f6",
  Pending: "#f59e0b",
  Return: "#f43f5e",
  Returned: "#f43f5e",
  "Return in Transit": "#a78bfa",
  Cancelled: "#64748b",
  Canceled: "#64748b",
  Undelivered: "#94a3b8",
  Failed: "#dc2626",
};

export function statusColor(name: string, index = 0): string {
  return STATUS_COLORS[name] ?? STATUS_COLOR_PALETTE[index % STATUS_COLOR_PALETTE.length];
}
