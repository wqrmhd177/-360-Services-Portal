"use client";

import { useMemo, useState, useTransition } from "react";

type Kind = "supplier" | "delivery";

interface PoPaymentActionsProps {
  poId: string;
  kind: Kind;
  actorEmail: string;
  currentStatus: "paid" | "unpaid";
  currentProofUrl: string | null | undefined;
  onSave: (formData: FormData) => void;
  onRevert: (formData: FormData) => void;
  onDeleteProof: (formData: FormData) => void;
}

export default function PoPaymentActions({
  poId,
  kind,
  actorEmail,
  currentStatus,
  currentProofUrl,
  onSave,
  onRevert,
  onDeleteProof,
}: PoPaymentActionsProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editMode, setEditMode] = useState(false);

  const effectiveProofUrl = uploadedUrl ?? currentProofUrl ?? null;

  const fileLabel = useMemo(() => {
    if (selectedFile) return selectedFile.name;
    if (uploadedUrl) return "Uploaded";
    return "No file selected";
  }, [selectedFile, uploadedUrl]);

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.set("file", selectedFile);
      fd.set("scope", "po_payment");
      fd.set("poId", poId);
      fd.set("kind", kind);
      const res = await fetch("/api/upload/payment-proof", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.publicUrl) {
        setUploadError(json?.error || "Upload failed");
        return;
      }
      setUploadedUrl(json.publicUrl as string);
      setSelectedFile(null);
    } catch (e: any) {
      setUploadError(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function submitSave() {
    const fd = new FormData();
    fd.set("poId", poId);
    fd.set("actor", actorEmail);
    if (effectiveProofUrl) fd.set("proofUrl", effectiveProofUrl);
    if (currentProofUrl) fd.set("previousProofUrl", currentProofUrl);
    startTransition(() => onSave(fd));
  }

  function submitRevert() {
    const fd = new FormData();
    fd.set("poId", poId);
    fd.set("actor", actorEmail);
    startTransition(() => onRevert(fd));
  }

  function submitDeleteProof() {
    if (!currentProofUrl) return;
    const fd = new FormData();
    fd.set("poId", poId);
    fd.set("actor", actorEmail);
    fd.set("proofUrl", currentProofUrl);
    startTransition(() => onDeleteProof(fd));
  }

  const showEditing = currentStatus === "unpaid" || editMode;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {currentStatus === "paid" && !editMode ? (
          <button
            type="button"
            onClick={() => setEditMode(true)}
            className="rounded bg-gray-200 px-2 py-1 text-[10px] font-medium text-gray-700 hover:bg-gray-300"
          >
            Edit
          </button>
        ) : null}

        {currentStatus === "paid" && editMode ? (
          <>
            <button
              type="button"
              onClick={submitRevert}
              disabled={isPending}
              className="rounded bg-amber-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-amber-700 disabled:opacity-60"
            >
              Revert to Unpaid
            </button>
            {currentProofUrl ? (
              <button
                type="button"
                onClick={submitDeleteProof}
                disabled={isPending}
                className="rounded bg-red-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                Delete proof
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setEditMode(false);
                setSelectedFile(null);
                setUploadedUrl(null);
                setUploadError(null);
              }}
              className="rounded bg-gray-200 px-2 py-1 text-[10px] font-medium text-gray-700 hover:bg-gray-300"
            >
              Cancel
            </button>
          </>
        ) : null}
      </div>

      {showEditing ? (
        <div className="flex flex-col items-center gap-1">
          <div className="flex flex-wrap items-center justify-center gap-1">
            <label className="cursor-pointer rounded bg-gray-200 px-2 py-1 text-[10px] font-medium text-gray-700 hover:bg-gray-300">
              Choose file
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,image/*,application/pdf"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setSelectedFile(f);
                  setUploadError(null);
                }}
              />
            </label>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="rounded bg-blue-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
            <button
              type="button"
              onClick={submitSave}
              disabled={isPending}
              className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Save / Mark Paid"}
            </button>
          </div>

          <div className="text-[10px] text-gray-500 max-w-[220px] truncate">{fileLabel}</div>

          {effectiveProofUrl ? (
            <a
              href={effectiveProofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-medium text-blue-600 hover:text-blue-800"
            >
              View current proof
            </a>
          ) : null}

          {uploadError ? <div className="text-[10px] text-red-600">{uploadError}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

