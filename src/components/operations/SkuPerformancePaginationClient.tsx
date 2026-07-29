"use client";

import { usePathname, useRouter } from "next/navigation";
import { ListPagination } from "@/components/lists/ListPagination";

export function SkuPerformancePaginationClient({
  currentPage,
  totalPages,
  totalRecords,
  filterQuery,
}: {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  filterQuery: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <ListPagination
      currentPage={currentPage}
      totalPages={totalPages}
      totalItems={totalRecords}
      itemLabel="SKUs"
      onPageChange={(nextPage) => {
        const params = new URLSearchParams(filterQuery);
        params.set("page", String(nextPage));
        router.push(`${pathname}?${params.toString()}`);
      }}
    />
  );
}
