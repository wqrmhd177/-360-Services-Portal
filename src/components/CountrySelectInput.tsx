"use client";

import { useState, useEffect } from "react";
import { TOP_COUNTRIES } from "@/lib/countries";

interface CountrySelectInputProps {
  value: string;
  onChange: (country: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

function filterCountries(searchTerm: string): string[] {
  if (!searchTerm) return TOP_COUNTRIES;
  return TOP_COUNTRIES.filter((country) =>
    country.toLowerCase().includes(searchTerm.toLowerCase())
  );
}

export default function CountrySelectInput({
  value,
  onChange,
  label,
  required = false,
  placeholder = "Search or select country",
  className = "",
}: CountrySelectInputProps) {
  const [search, setSearch] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  function selectCountry(country: string) {
    onChange(country);
    setSearch(country);
    setShowDropdown(false);
  }

  return (
    <div className={`relative space-y-1 ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-gray-700">
          {label}
          {required && <span className="text-red-400"> *</span>}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          required={required}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => {
            const match = TOP_COUNTRIES.find(
              (c) => c.toLowerCase() === search.trim().toLowerCase()
            );
            if (match) {
              onChange(match);
              setSearch(match);
            } else if (value) {
              setSearch(value);
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
        />
        {showDropdown && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
            <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-card">
              {filterCountries(search).length === 0 ? (
                <div className="px-3 py-2 text-xs text-gray-500">No countries found</div>
              ) : (
                filterCountries(search).map((country) => (
                  <button
                    key={country}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectCountry(country)}
                    className="w-full px-3 py-2 text-left text-sm text-gray-900 transition-colors hover:bg-portal-400/20 hover:text-portal-900"
                  >
                    {country}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
