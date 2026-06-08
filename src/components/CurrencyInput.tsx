"use client";

import React, { useEffect, useState } from "react";

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

function formatDisplayValue(val: number | string): string {
  if (!val || val === 0) return "";
  const numVal = typeof val === "string" ? parseFloat(val) : val;
  if (Number.isNaN(numVal) || numVal === 0) return "";
  return numVal.toFixed(2);
}

export default function CurrencyInput({
  value,
  onChange,
  currency,
  label,
  required = false,
  disabled = false,
  placeholder = "",
  className = "",
}: CurrencyInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [rawValue, setRawValue] = useState("");

  useEffect(() => {
    if (!isFocused) {
      setRawValue("");
    }
  }, [value, isFocused]);

  const displayValue = isFocused ? rawValue : formatDisplayValue(value);

  const handleFocus = () => {
    setIsFocused(true);
    const numVal = typeof value === "string" ? parseFloat(value) : value;
    if (numVal && numVal > 0) {
      setRawValue(String(numVal));
    } else {
      setRawValue("");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, "");
    const parts = val.split(".");
    const sanitized =
      parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : val;
    setRawValue(sanitized);
    const numValue = sanitized === "" || sanitized === "." ? 0 : parseFloat(sanitized) || 0;
    onChange(numValue);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setRawValue("");
    const numVal = typeof value === "string" ? parseFloat(value) : value;
    if (Number.isNaN(numVal) || numVal <= 0) {
      onChange(0);
    }
  };

  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="flex border border-gray-300 rounded-md shadow-sm bg-white focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500">
        <span className="pl-3 py-2 text-gray-700 font-medium sm:text-sm flex items-center">
          {currency}
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          className="flex-1 min-w-0 py-2 pr-3 pl-2 border-0 rounded-r-md text-right sm:text-sm focus:ring-0 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}
