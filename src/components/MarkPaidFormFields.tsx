"use client";

import { useState } from "react";

const ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.gif,.webp,image/*,application/pdf";

export function MarkPaidFormFields() {
  const [hasFile, setHasFile] = useState(false);

  return (
    <>
      <label className="cursor-pointer rounded bg-gray-200 px-2 py-1 text-[10px] font-medium text-gray-700 hover:bg-gray-300">
        Choose file
        <input
          type="file"
          name="payment_proof"
          accept={ACCEPT}
          required
          className="sr-only"
          onChange={() => setHasFile(true)}
        />
      </label>
      <button
        type="submit"
        className={`rounded px-2 py-1 text-[10px] font-medium text-white transition-colors ${
          hasFile
            ? "bg-blue-600 hover:bg-blue-700"
            : "bg-gray-400 hover:bg-gray-500"
        }`}
      >
        Mark Paid
      </button>
    </>
  );
}
