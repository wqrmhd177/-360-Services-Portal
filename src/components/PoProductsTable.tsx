import type { PoProduct } from "@/types/workflows";

type ProductRow = PoProduct & {
  product_name?: string;
};

function formatMoney(value: number | undefined | null): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Number(value).toFixed(2);
}

function lineTotal(item: ProductRow): number | null {
  const qty = Number(item.quantity) || 0;
  const product =
    item.productCostAmount != null
      ? Number(item.productCostAmount)
      : item.productCostPerUnit != null
        ? Number(item.productCostPerUnit) * qty
        : 0;
  const freight =
    item.freightCostAmount != null
      ? Number(item.freightCostAmount)
      : item.freightCostPerUnit != null
        ? Number(item.freightCostPerUnit) * qty
        : 0;
  if (product === 0 && freight === 0 && item.amount == null && item.rate == null) {
    return null;
  }
  return product + freight;
}

function showCostColumns(items: ProductRow[], isIndependent?: boolean): boolean {
  if (isIndependent) return true;
  return items.some(
    (p) => p.productCostPerUnit != null || p.freightCostPerUnit != null
  );
}

interface PoProductsTableProps {
  products: ProductRow[];
  isIndependent?: boolean;
  compact?: boolean;
}

export default function PoProductsTable({
  products,
  isIndependent,
  compact = false,
}: PoProductsTableProps) {
  if (!products.length) return null;

  const useCosts = showCostColumns(products, isIndependent);
  const cellClass = compact ? "py-2 pr-3" : "py-2 pr-4";
  const textClass = compact ? "text-xs" : "text-sm";

  return (
    <div className="overflow-x-auto">
      <table className={`min-w-full text-left text-gray-700 ${textClass}`}>
        <thead className="border-b border-gray-200 text-gray-600">
          <tr>
            <th className={`${cellClass} font-medium`}>Product</th>
            <th className={`${cellClass} font-medium`}>SKU</th>
            <th className={`${cellClass} font-medium`}>Qty</th>
            {useCosts ? (
              <>
                <th className={`${cellClass} font-medium`}>Product Cost</th>
                <th className={`${cellClass} font-medium`}>Freight Cost</th>
                <th className={`${cellClass} font-medium`}>Line Total</th>
              </>
            ) : (
              <>
                <th className={`${cellClass} font-medium`}>Selling Price</th>
                <th className={`${cellClass} font-medium`}>Amount</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {products.map((item, idx) => {
            const total = lineTotal(item);
            return (
              <tr key={idx} className="border-b border-gray-100 last:border-0">
                <td className={`${cellClass} font-medium text-gray-900`}>
                  {item.productName ?? item.product_name ?? "—"}
                </td>
                <td className={cellClass}>{item.skuCode ?? "—"}</td>
                <td className={cellClass}>{item.quantity ?? "—"}</td>
                {useCosts ? (
                  <>
                    <td className={cellClass}>{formatMoney(item.productCostPerUnit)}</td>
                    <td className={cellClass}>{formatMoney(item.freightCostPerUnit)}</td>
                    <td className={cellClass}>
                      {total != null ? formatMoney(total) : "—"}
                    </td>
                  </>
                ) : (
                  <>
                    <td className={cellClass}>{formatMoney(item.rate)}</td>
                    <td className={cellClass}>
                      {formatMoney(item.amount ?? (item.rate != null && item.quantity ? item.rate * item.quantity : null))}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function recalcProductLine(
  line: PoProduct,
  field: keyof PoProduct,
  value: string | number
): PoProduct {
  const next = { ...line, [field]: value };
  const quantity = Number(next.quantity) || 0;
  const productCostPerUnit =
    next.productCostPerUnit != null ? Number(next.productCostPerUnit) : undefined;
  const freightCostPerUnit =
    next.freightCostPerUnit != null ? Number(next.freightCostPerUnit) : undefined;
  return {
    ...next,
    productCostAmount:
      productCostPerUnit != null ? productCostPerUnit * quantity : undefined,
    freightCostAmount:
      freightCostPerUnit != null ? freightCostPerUnit * quantity : undefined,
    amount:
      next.rate != null ? Number(next.rate) * quantity : next.amount,
  };
}
