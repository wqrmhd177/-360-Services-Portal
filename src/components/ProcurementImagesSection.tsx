"use client";

import { useEffect, useState } from "react";
import ImageGallery from "./ImageGallery";
import type { ProcurementImageGroup } from "@/lib/procurementImages";

interface ProcurementImagesSectionProps {
  poId: string;
  className?: string;
  variant?: "card" | "inline";
}

export default function ProcurementImagesSection({
  poId,
  className = "",
  variant = "inline",
}: ProcurementImagesSectionProps) {
  const [groups, setGroups] = useState<ProcurementImageGroup[]>([]);
  const [qrNumber, setQrNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/po/${poId}/procurement-images`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load"))))
      .then((data: { groups?: ProcurementImageGroup[]; qrNumber?: string | null }) => {
        if (cancelled) return;
        setGroups(data.groups ?? []);
        setQrNumber(data.qrNumber ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setGroups([]);
          setQrNumber(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [poId]);

  if (loading) {
    const loadingContent = (
      <p className="text-sm text-gray-500">Loading procurement images…</p>
    );
    if (variant === "card") {
      return <div className={`card ${className}`}>{loadingContent}</div>;
    }
    return <div className={className}>{loadingContent}</div>;
  }

  if (groups.length === 0) {
    return null;
  }

  const content = (
    <>
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <h3
          className={
            variant === "card"
              ? "text-sm font-semibold text-gray-900"
              : "text-lg font-semibold text-gray-900 border-b pb-2 w-full"
          }
        >
          Procurement Images
        </h3>
        {qrNumber && (
          <span className="text-xs text-gray-500">from QR #{qrNumber}</span>
        )}
      </div>
      <div className="space-y-4">
        {groups.map((group, idx) => (
          <div key={`${group.productName}-${group.label}-${idx}`}>
            <p className="text-sm font-medium text-gray-900">{group.productName}</p>
            <p className="text-xs text-gray-500 mb-2">{group.label}</p>
            <ImageGallery
              images={group.imageUrls}
              alt={`${group.productName} procurement`}
              thumbnailSize="md"
            />
          </div>
        ))}
      </div>
    </>
  );

  if (variant === "card") {
    return <div className={`card ${className}`}>{content}</div>;
  }

  return <div className={className}>{content}</div>;
}
