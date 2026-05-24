"use client";

import React from "react";

interface CurrencyInputProps {
  value: number | string;
  onChange: (value: number) => void;
  currency: "SAR" | "PKR" | "AED";
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export default function CurrencyInput({
  value,
  onChange,
  currency,
  label,
  required = false,
  disabled = false,
  placeholder = "0.00",
  className = "",
}: CurrencyInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, "");
    const numValue = parseFloat(val) || 0;
    onChange(numValue);
  };

  const formatValue = (val: number | string): string => {
    if (!val || val === 0) return "";
    const numVal = typeof val === "string" ? parseFloat(val) : val;
    return numVal.toFixed(2);
  };

  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {/* Same visual style as Total Amount: currency left, value right so digits are not behind currency */}
      <div className="flex border border-gray-300 rounded-md shadow-sm bg-white focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500">
        <span className="pl-3 py-2 text-gray-700 font-medium sm:text-sm flex items-center">
          {currency}
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={formatValue(value)}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          className="flex-1 min-w-0 py-2 pr-3 pl-2 border-0 rounded-r-md text-right sm:text-sm focus:ring-0 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}
