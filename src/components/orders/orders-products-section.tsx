import { ProductPerformanceTable } from "@/components/orders/product-performance-table";
import type { TitleBreakdownRow } from "@/lib/analytics/orders";

type OrdersProductsData = {
  titleBreakdown: TitleBreakdownRow[];
};

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
