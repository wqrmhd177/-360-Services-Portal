"use client";

import { ALL_SERVICE_OPTIONS } from "@/lib/serviceTypes";

interface ServiceTypeSelectProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  id?: string;
}

export default function ServiceTypeSelect({
  value,
  onChange,
  required = false,
  className = "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20",
  id,
}: ServiceTypeSelectProps) {
  return (
    <select
      id={id}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      <option value="">Select service</option>
      {ALL_SERVICE_OPTIONS.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
