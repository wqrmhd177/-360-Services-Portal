"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { uploadFilesToStorage } from "@/lib/uploadClient";
import type { PlSupplier } from "@/lib/productListing/types";

// ─── Constants ────────────────────────────────────────────────────────────────
const PACKAGE_INCLUDES_OPTIONS = [
  "Battery", "Cells", "Power Adapter", "Charger", "Power Cable", "USB Cable",
  "Type-C Cable", "Micro-USB Cable", "Lightning Cable", "HDMI Cable", "AUX Cable",
  "Warranty Card", "Mounting Bracket", "Clip", "Holder", "Stand",
  "Protective Case", "Accessory Kit", "Other",
];

const VARIANT_NAME_SUGGESTIONS = [
  "Battery Capacity", "Color", "Charger Type", "Flavours", "Material",
  "Sizes", "Bundle", "Weight", "Power Output", "Pack SIZE",
];

const COLOR_OPTIONS = [
  "Black", "White", "Red", "Blue", "Navy", "Green", "Grey", "Brown", "Beige",
  "Pink", "Purple", "Yellow", "Orange", "Gold", "Silver",
];

const VARIANT_VALUE_PRESETS: Record<string, string[]> = {
  Color: COLOR_OPTIONS,
  "Charger Type": ["Lightning", "Micro-USB", "Type-C"],
  "Battery Capacity": ["500 mAh", "1000 mAh", "2000 mAh", "3000 mAh", "5000 mAh", "10000 mAh", "20000 mAh"],
  Sizes: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface VariantOption {
  name: string;
  values: string[];
}

interface VariantRow {
  combination: Record<string, string>;
  price: string;
  stock: string;
  sku: string;
  images: string[]; // uploaded image URLs for this specific variant
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function NewProductPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [suppliers, setSuppliers] = useState<PlSupplier[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Step 1: Product info
  const [supplierId, setSupplierId] = useState("");
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [material, setMaterial] = useState("");
  const [description, setDescription] = useState("");
  const [packageIncludes, setPackageIncludes] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  // Shared images used when sameImageForAllVariants is true
  const [sharedVariantImages, setSharedVariantImages] = useState<string[]>([]);
  const [uploadingShared, setUploadingShared] = useState(false);
  // Per-variant upload tracking: index → true means that zone is uploading
  const [uploadingVariant, setUploadingVariant] = useState<Record<number, boolean>>({});
  const [uploading, setUploading] = useState(false);
  // Whether all variants share the same images
  const [sameImageForAllVariants, setSameImageForAllVariants] = useState(false);

  // Step 2: Variants
  const [hasVariants, setHasVariants] = useState(false);
  const [options, setOptions] = useState<VariantOption[]>([{ name: "", values: [] }]);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);
  // Single-variant mode
  const [singlePrice, setSinglePrice] = useState("");
  const [singleStock, setSingleStock] = useState("");
  const [singleSku, setSingleSku] = useState("");

  // Step 3: Review (no extra fields)

  useEffect(() => {
    fetch("/api/product-listing/action")
      .then((r) => r.json())
      .then((d) => setSuppliers(d.suppliers ?? []));
  }, []);

  // Auto-generate variant combinations when options change
  useEffect(() => {
    if (!hasVariants) return;
    const filled = options.filter((o) => o.name && o.values.length > 0);
    if (filled.length === 0) { setVariantRows([]); return; }

    const combos = cartesian(filled.map((o) => o.values.map((v) => ({ [o.name]: v }))));
    const existing = new Map(variantRows.map((r) => [JSON.stringify(r.combination), r]));
    setVariantRows(
      combos.map((combo) => {
        const key = JSON.stringify(combo);
        return existing.get(key) ?? { combination: combo, price: "", stock: "", sku: "", images: [] };
      })
    );
  }, [options, hasVariants]);

  // ── Image upload helpers ──
  async function uploadFilesToStorageLocal(files: FileList | null): Promise<string[]> {
    if (!files || files.length === 0) return [];
    return uploadFilesToStorage(Array.from(files), "product-listing-images");
  }

  async function handleImageUpload(files: FileList | null) {
    setUploading(true);
    try {
      const urls = await uploadFilesToStorageLocal(files);
      setImageUrls((prev) => [...prev, ...urls]);
    } finally {
      setUploading(false);
    }
  }

  async function handleVariantImageUpload(variantIndex: number, files: FileList | null) {
    setUploadingVariant((prev) => ({ ...prev, [variantIndex]: true }));
    try {
      const urls = await uploadFilesToStorageLocal(files);
      setVariantRows((prev) =>
        prev.map((r, i) =>
          i === variantIndex ? { ...r, images: [...r.images, ...urls] } : r
        )
      );
    } finally {
      setUploadingVariant((prev) => ({ ...prev, [variantIndex]: false }));
    }
  }

  async function handleSharedVariantImageUpload(files: FileList | null) {
    setUploadingShared(true);
    try {
      const urls = await uploadFilesToStorageLocal(files);
      setSharedVariantImages((prev) => [...prev, ...urls]);
    } finally {
      setUploadingShared(false);
    }
  }

  // ── Validation ──
  function validateStep1() {
    if (!supplierId) { setError("Please select a supplier"); return false; }
    if (!title.trim()) { setError("Product title is required"); return false; }
    if (hasVariants) {
      const filled = options.filter((o) => o.name && o.values.length > 0);
      if (filled.length === 0) { setError("Add at least one variant option with values"); return false; }
      const emptyPrice = variantRows.some((r) => !r.price);
      if (emptyPrice) { setError("Set a price for all variants"); return false; }
    }
    setError("");
    return true;
  }

  function next() {
    if (step === 1 && !validateStep1()) return;
    setStep((s) => s + 1);
  }

  // ── Submit ──
  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      const filledOptions = options
        .filter((o) => o.name && o.values.length > 0)
        .map((o) => ({ name: o.name, values: o.values }));

      const res = await fetch("/api/product-listing/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          supplierId,
          imageUrls,
          brand,
          material,
          description,
          packageIncludes,
          hasVariants,
          options: filledOptions,
          variantRows: hasVariants
            ? variantRows.map((r) => ({
                combination: r.combination,
                price: r.price,
                stock: r.stock,
                sku: r.sku,
                images: sameImageForAllVariants ? sharedVariantImages : r.images,
              }))
            : [],
          singlePrice,
          singleStock,
          singleSku,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to create product");
        return;
      }
      router.push("/dashboard/product-listing/products");
    } finally {
      setSaving(false);
    }
  }

  const steps = ["Product Info & Variants", "Images", "Review"];

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Products
      </button>

      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Add New Product</h1>
        {/* Steps */}
        <div className="mt-4 flex items-center gap-0">
          {steps.map((label, idx) => {
            const n = idx + 1;
            const active = n === step;
            const done = n < step;
            return (
              <div key={n} className="flex flex-1 items-center">
                <div className="flex items-center gap-2">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-green-500 text-white" : active ? "bg-portal-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                    {done ? <CheckCircle className="h-4 w-4" /> : n}
                  </div>
                  <span className={`hidden text-sm sm:inline ${active ? "font-semibold text-gray-900" : "text-gray-400"}`}>{label}</span>
                </div>
                {idx < steps.length - 1 && <div className="mx-2 flex-1 border-t border-gray-200" />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card p-6 space-y-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* ── Step 1: Product Info & Variants ── */}
        {step === 1 && (
          <>
            <h2 className="text-base font-semibold text-gray-800">Product Information</h2>

            <Field label="Supplier *">
              <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s.supplier_code} value={s.supplier_code}>
                    {s.shop_name} ({s.supplier_code})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Product Title *">
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Wireless Earbuds Pro" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Brand Name">
                <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand" />
              </Field>
              <Field label="Material">
                <input className="input" value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Material" />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                className="input min-h-[80px] resize-y"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Product description…"
              />
            </Field>

            <Field label="Package Includes">
              <div className="flex flex-wrap gap-2">
                {PACKAGE_INCLUDES_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() =>
                      setPackageIncludes((prev) =>
                        prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
                      )
                    }
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      packageIncludes.includes(opt)
                        ? "bg-portal-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </Field>

            {/* ── Variant Setup ── */}
            <div className="border-t border-gray-100 pt-4 space-y-4">
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={hasVariants}
                    onChange={(e) => { setHasVariants(e.target.checked); setVariantRows([]); }}
                    className="h-4 w-4 rounded"
                  />
                  This product has multiple variants (Color, Size, etc.)
                </label>
              </div>

              {!hasVariants ? (
                <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                  <p className="text-sm font-medium text-gray-700">Pricing &amp; Stock</p>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Price *">
                      <input type="number" min={0} step={0.01} className="input" value={singlePrice} onChange={(e) => setSinglePrice(e.target.value)} placeholder="0.00" />
                    </Field>
                    <Field label="Stock">
                      <input type="number" min={0} className="input" value={singleStock} onChange={(e) => setSingleStock(e.target.value)} placeholder="0" />
                    </Field>
                    <Field label="SKU">
                      <input className="input" value={singleSku} onChange={(e) => setSingleSku(e.target.value)} placeholder="SKU" />
                    </Field>
                  </div>
                </div>
              ) : (
                <>
                  {options.map((opt, oi) => (
                    <div key={oi} className="rounded-xl border border-gray-200 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-700">Option {oi + 1}</p>
                        {options.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setOptions(options.filter((_, i) => i !== oi))}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500">Option Name</label>
                        <input
                          list={`opt-suggestions-${oi}`}
                          className="input"
                          value={opt.name}
                          onChange={(e) => {
                            const next = [...options];
                            next[oi] = { ...next[oi], name: e.target.value };
                            setOptions(next);
                          }}
                          placeholder="e.g. Color"
                        />
                        <datalist id={`opt-suggestions-${oi}`}>
                          {VARIANT_NAME_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
                        </datalist>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500">Values</label>
                        {VARIANT_VALUE_PRESETS[opt.name] && (
                          <div className="mb-2 flex flex-wrap gap-1">
                            {VARIANT_VALUE_PRESETS[opt.name].map((v) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => {
                                  const next = [...options];
                                  const vals = next[oi].values;
                                  next[oi] = {
                                    ...next[oi],
                                    values: vals.includes(v) ? vals.filter((x) => x !== v) : [...vals, v],
                                  };
                                  setOptions(next);
                                }}
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  opt.values.includes(v) ? "bg-portal-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-portal-400"
                                }`}
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        )}
                        <CustomValueInput
                          values={opt.values}
                          onChange={(vals) => {
                            const next = [...options];
                            next[oi] = { ...next[oi], values: vals };
                            setOptions(next);
                          }}
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setOptions([...options, { name: "", values: [] }])}
                    className="btn-secondary inline-flex items-center gap-1.5 text-sm"
                  >
                    <Plus className="h-4 w-4" /> Add Option
                  </button>

                  {variantRows.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-700">
                        {variantRows.length} Variant{variantRows.length !== 1 ? "s" : ""} — set price &amp; stock
                      </h3>
                      {variantRows.map((row, ri) => (
                        <div key={ri} className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(row.combination).map(([k, v]) => (
                              <span key={k} className="rounded-full bg-white border border-gray-200 px-2 py-0.5 text-xs text-gray-700">
                                {k}: {v}
                              </span>
                            ))}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              placeholder="Price *"
                              value={row.price}
                              onChange={(e) => {
                                const next = [...variantRows];
                                next[ri] = { ...next[ri], price: e.target.value };
                                setVariantRows(next);
                              }}
                              className="input text-sm"
                            />
                            <input
                              type="number"
                              min={0}
                              placeholder="Stock"
                              value={row.stock}
                              onChange={(e) => {
                                const next = [...variantRows];
                                next[ri] = { ...next[ri], stock: e.target.value };
                                setVariantRows(next);
                              }}
                              className="input text-sm"
                            />
                            <input
                              placeholder="SKU"
                              value={row.sku}
                              onChange={(e) => {
                                const next = [...variantRows];
                                next[ri] = { ...next[ri], sku: e.target.value };
                                setVariantRows(next);
                              }}
                              className="input text-sm"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* ── Step 2: Images ── */}
        {step === 2 && (
          <>
            <h2 className="text-base font-semibold text-gray-800">Product Images</h2>

            {!hasVariants ? (
              /* Single product — one upload zone */
              <>
                <Field label="Upload Images">
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 hover:border-portal-400 hover:text-portal-600">
                    <Upload className="h-4 w-4" />
                    {uploading ? "Uploading…" : "Click to upload images"}
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e.target.files)}
                    />
                  </label>
                  {imageUrls.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {imageUrls.map((url, i) => (
                        <div key={i} className="relative">
                          <img src={url} alt="" className="h-16 w-16 rounded-lg border border-gray-200 object-cover" />
                          <button
                            type="button"
                            onClick={() => setImageUrls((prev) => prev.filter((_, j) => j !== i))}
                            className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Field>
              </>
            ) : (
              /* Multi-variant */
              <div className="space-y-4">
                {/* Same-images checkbox */}
                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100">
                  <input
                    type="checkbox"
                    checked={sameImageForAllVariants}
                    onChange={(e) => setSameImageForAllVariants(e.target.checked)}
                    className="h-4 w-4 rounded"
                  />
                  All variants share the same images
                </label>

                {sameImageForAllVariants ? (
                  /* Single shared upload zone */
                  <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                    <p className="text-xs text-gray-500">
                      These images will be applied to all {variantRows.length} variant{variantRows.length !== 1 ? "s" : ""}.
                    </p>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 hover:border-portal-400 hover:text-portal-600">
                      <Upload className="h-4 w-4" />
                      {uploadingShared ? "Uploading…" : "Click to upload shared images"}
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleSharedVariantImageUpload(e.target.files)}
                      />
                    </label>
                    {sharedVariantImages.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {sharedVariantImages.map((url, i) => (
                          <div key={i} className="relative">
                            <img src={url} alt="" className="h-16 w-16 rounded-lg border border-gray-200 object-cover" />
                            <button
                              type="button"
                              onClick={() => setSharedVariantImages((prev) => prev.filter((_, j) => j !== i))}
                              className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* One upload zone per variant */
                  variantRows.map((row, ri) => (
                    <div key={ri} className="rounded-xl border border-gray-200 p-4 space-y-3">
                      {/* Variant label pills */}
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(row.combination).map(([k, v]) => (
                          <span
                            key={k}
                            className="rounded-full bg-portal-100 px-2.5 py-0.5 text-xs font-medium text-portal-700"
                          >
                            {k}: {v}
                          </span>
                        ))}
                      </div>

                      <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 px-4 py-3 text-sm text-gray-500 hover:border-portal-400 hover:text-portal-600">
                        <Upload className="h-4 w-4" />
                        {uploadingVariant[ri] ? "Uploading…" : "Click to upload images"}
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleVariantImageUpload(ri, e.target.files)}
                        />
                      </label>

                      {row.images.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {row.images.map((url, ii) => (
                            <div key={ii} className="relative">
                              <img
                                src={url}
                                alt=""
                                className="h-16 w-16 rounded-lg border border-gray-200 object-cover"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setVariantRows((prev) =>
                                    prev.map((r, i) =>
                                      i === ri
                                        ? { ...r, images: r.images.filter((_, j) => j !== ii) }
                                        : r
                                    )
                                  )
                                }
                                className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            <p className="text-xs text-gray-400">Images are optional — you can add them later.</p>
          </>
        )}

        {/* ── Step 3: Review ── */}
        {step === 3 && (
          <>
            <h2 className="text-base font-semibold text-gray-800">Review &amp; Submit</h2>
            <div className="space-y-3 text-sm">
              <ReviewRow label="Supplier" value={suppliers.find((s) => s.supplier_code === supplierId)?.shop_name ?? supplierId} />
              <ReviewRow label="Title" value={title} />
              {brand && <ReviewRow label="Brand" value={brand} />}
              {material && <ReviewRow label="Material" value={material} />}
              <ReviewRow label="Variants" value={hasVariants ? `${variantRows.length} combinations` : "Single variant"} />
              {hasVariants && variantRows.length > 0 && (
                <ReviewRow label="Price range" value={
                  (() => {
                    const prices = variantRows.map((r) => parseFloat(r.price) || 0);
                    const min = Math.min(...prices);
                    const max = Math.max(...prices);
                    return min === max ? `${min}` : `${min} – ${max}`;
                  })()
                } />
              )}
              {!hasVariants && singlePrice && <ReviewRow label="Price" value={singlePrice} />}
              {hasVariants ? (
                sameImageForAllVariants ? (
                  <ReviewRow
                    label="Images"
                    value={`${sharedVariantImages.length} shared image${sharedVariantImages.length !== 1 ? "s" : ""} → all ${variantRows.length} variants`}
                  />
                ) : (
                  <ReviewRow
                    label="Images"
                    value={`${variantRows.reduce((s, r) => s + r.images.length, 0)} image${variantRows.reduce((s, r) => s + r.images.length, 0) !== 1 ? "s" : ""} across ${variantRows.length} variant${variantRows.length !== 1 ? "s" : ""}`}
                  />
                )
              ) : (
                <ReviewRow label="Images" value={`${imageUrls.length} image${imageUrls.length !== 1 ? "s" : ""}`} />
              )}
              <ReviewRow label="Status after submit" value="Pending Approval" />
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {step > 1 ? (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        ) : (
          <div />
        )}
        {step < 3 ? (
          <button type="button" onClick={next} className="btn-primary inline-flex items-center gap-1.5">
            Next <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Create Product"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function cartesian(arrays: Record<string, string>[][]): Record<string, string>[] {
  return arrays.reduce<Record<string, string>[]>(
    (acc, arr) => acc.flatMap((a) => arr.map((b) => ({ ...a, ...b }))),
    [{}]
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-50 pb-2">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

function CustomValueInput({
  values,
  onChange,
}: {
  values: string[];
  onChange: (vals: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function add() {
    const v = input.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setInput("");
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          className="input flex-1 text-sm"
          placeholder="Custom value…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <button type="button" onClick={add} className="btn-secondary text-sm">
          Add
        </button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-portal-100 px-2 py-0.5 text-xs text-portal-700">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
