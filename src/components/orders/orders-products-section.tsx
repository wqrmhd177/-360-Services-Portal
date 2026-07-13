import { ProductPerformanceTable } from "@/components/orders/product-performance-table";
import type { getStoresAnalytics } from "@/lib/orders/data";

type OrdersProductsData = Awaited<ReturnType<typeof getStoresAnalytics>>;

export function OrdersProductsSection({ data }: { data: OrdersProductsData }) {
  return (
    <section className="space-y-6">
      <ProductPerformanceTable
        title="Product performance"
        rows={data.titleBreakdown}
      />
    </section>
  );
}
