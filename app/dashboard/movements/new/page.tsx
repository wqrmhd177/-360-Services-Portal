"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MovementCreateForm } from "@/components/movements/MovementCreateForm";

export default function NewMovementPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Create Movement</h2>
          <p className="mt-1 text-sm text-gray-500">
            Select movement type and enter SKU details. Inventory can be checked inline.
          </p>
        </div>
        <Link href="/dashboard/movements" className="btn-secondary">
          Back to list
        </Link>
      </div>

      <MovementCreateForm onSuccess={(id) => router.push(`/dashboard/movements/${id}`)} />
    </div>
  );
}
