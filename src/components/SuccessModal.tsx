"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface SuccessModalProps {
  type: "qr" | "pr" | "po";
  number: string;
  onClose: () => void;
}

export default function SuccessModal({ type, number, onClose }: SuccessModalProps) {
  const router = useRouter();
  const typeLabels = {
    qr: "Quotation Request",
    pr: "Purchase Request",
    po: "Purchase Order"
  };

  const historyPaths = {
    qr: "/dashboard/growth/quotation-requests",
    pr: "/dashboard/growth/purchase-requests",
    po: "/dashboard/procurement"
  };

  const dashboardPaths = {
    qr: "/dashboard/growth",
    pr: "/dashboard/growth",
    po: "/dashboard/procurement"
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="card max-w-md border-gray-200 bg-white">
        <div className="mb-4 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900">
            {typeLabels[type]} Created Successfully!
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            You have submitted a {typeLabels[type]}
          </p>
          <div className="mt-4 rounded-lg border-2 border-portal-400 bg-portal-50 p-4">
            <p className="text-xs font-medium text-gray-600">
              {typeLabels[type]} Number
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{number}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              onClose();
              router.push(dashboardPaths[type]);
            }}
            className="btn-primary flex-1"
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => {
              onClose();
              router.push(historyPaths[type]);
            }}
            className="btn-secondary flex-1"
          >
            View History
          </button>
        </div>
      </div>
    </div>
  );
}
