"use client";

interface StatusFilterOption {
  key: string;
  label: string;
  count: number;
}

interface StatusFilterPillsProps {
  options: StatusFilterOption[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function StatusFilterPills({ options, activeKey, onChange }: StatusFilterPillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            activeKey === opt.key
              ? "bg-portal-400/20 text-portal-900 ring-1 ring-portal-400/40"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {opt.label} ({opt.count})
        </button>
      ))}
    </div>
  );
}
