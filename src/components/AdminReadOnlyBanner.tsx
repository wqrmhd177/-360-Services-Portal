"use client";

import { useReadOnlyAdmin } from "@/hooks/useReadOnlyAdmin";

export default function AdminReadOnlyBanner() {
  const readOnly = useReadOnlyAdmin();

  if (!readOnly) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      Admin view — read only. You can browse all data but cannot create or modify records.
    </div>
  );
}
