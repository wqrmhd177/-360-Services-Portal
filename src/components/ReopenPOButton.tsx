"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ReopenPOButtonProps {
  poId: string;
}

export default function ReopenPOButton({ poId }: ReopenPOButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleReopen() {
    if (!confirm("Reopen this PO? It will be reset to 'Order Placed' status.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/procurement/po/${poId}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks: "Reopened by user" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to reopen PO");
        return;
      }
      router.refresh();
    } catch {
      alert("Failed to reopen PO");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleReopen}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg border border-orange-400 bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50"
    >
      {loading ? "Reopening…" : "Reopen PO"}
    </button>
  );
}
