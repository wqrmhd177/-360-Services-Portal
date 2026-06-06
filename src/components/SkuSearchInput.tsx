"use client";

import { useEffect, useState } from "react";
import type { InventorySku } from "@/lib/metabaseInventory";

interface SkuSearchInputProps {
  value: string;
  onSelect: (item: InventorySku) => void;
  onSearchChange?: (q: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function SkuSearchInput({
  value,
  onSelect,
  onSearchChange,
  disabled,
  placeholder = "Type 3+ letters to search SKU",
}: SkuSearchInputProps) {
  const [search, setSearch] = useState(value);
  const [results, setResults] = useState<InventorySku[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  useEffect(() => {
    if (search.trim().length < 3) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/inventory/sku-search?q=${encodeURIComponent(search.trim())}`
        );
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="relative">
      <input
        type="text"
        value={search}
        disabled={disabled}
        onChange={(e) => {
          setSearch(e.target.value);
          onSearchChange?.(e.target.value);
        }}
        onFocus={() => search.length >= 3 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs"
      />
      {loading && (
        <div className="absolute right-2 top-2 text-[10px] text-gray-400">...</div>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.map((item) => (
            <button
              key={`${item.sku}-${item.country}`}
              type="button"
              className="block w-full px-2 py-1.5 text-left text-xs hover:bg-portal-50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(item);
                setSearch(item.sku);
                setOpen(false);
              }}
            >
              <span className="font-medium">{item.sku}</span>
              <span className="ml-2 text-gray-500">
                {item.country} · Qty {item.quantity}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
