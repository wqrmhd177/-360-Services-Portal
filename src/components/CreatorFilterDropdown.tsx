"use client";

import { useEffect, useState } from "react";

export type GrowthCreator = { email: string; name: string };

interface CreatorFilterDropdownProps {
  value: string;
  onChange: (email: string) => void;
  className?: string;
}

export default function CreatorFilterDropdown({
  value,
  onChange,
  className = "",
}: CreatorFilterDropdownProps) {
  const [creators, setCreators] = useState<GrowthCreator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/users/growth-creators")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCreators(data);
      })
      .catch(() => setCreators([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
        Created by
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-portal-400 focus:outline-none focus:ring-2 focus:ring-portal-400/20"
      >
        <option value="">All users</option>
        {creators.map((c) => (
          <option key={c.email} value={c.email}>
            {c.name} ({c.email})
          </option>
        ))}
      </select>
    </div>
  );
}
