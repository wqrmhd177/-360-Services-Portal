"use client";

import React from "react";

export interface PaymentEntryInput {
  transactionId: string;
  file: File | null;
}

interface PaymentEntriesInputProps {
  entries: PaymentEntryInput[];
  onChange: (entries: PaymentEntryInput[]) => void;
  disabled?: boolean;
}

export default function PaymentEntriesInput({
  entries,
  onChange,
  disabled = false,
}: PaymentEntriesInputProps) {
  const updateEntry = (index: number, field: "transactionId" | "file", value: string | File | null) => {
    const next = [...entries];
    if (field === "transactionId") {
      next[index] = { ...next[index], transactionId: (value as string) ?? "" };
    } else {
      next[index] = { ...next[index], file: value as File | null };
    }
    onChange(next);
  };

  const addEntry = () => {
    onChange([...entries, { transactionId: "", file: null }]);
  };

  const removeEntry = (index: number) => {
    if (entries.length <= 1) return;
    onChange(entries.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {entries.map((entry, index) => (
        <div
          key={index}
          className="flex flex-col sm:flex-row gap-4 items-start p-4 border border-gray-200 rounded-lg bg-gray-50/50"
        >
          <div className="flex-1 w-full min-w-0 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transaction ID
              </label>
              <input
                type="text"
                value={entry.transactionId}
                onChange={(e) => updateEntry(index, "transactionId", e.target.value)}
                disabled={disabled}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Proof
              </label>
              <input
                type="file"
                onChange={(e) =>
                  updateEntry(index, "file", e.target.files?.[0] ?? null)
                }
                accept="image/*,.pdf"
                disabled={disabled}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
              />
              {entry.file && (
                <p className="mt-1 text-xs text-gray-500 truncate">
                  {entry.file.name}
                </p>
              )}
            </div>
          </div>
          {entries.length > 1 && (
            <button
              type="button"
              onClick={() => removeEntry(index)}
              disabled={disabled}
              className="shrink-0 p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              title="Remove this entry"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addEntry}
        disabled={disabled}
        className="w-full py-3 px-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add another transaction / payment proof
      </button>
    </div>
  );
}
