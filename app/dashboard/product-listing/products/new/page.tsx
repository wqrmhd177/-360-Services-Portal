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
import { createSupabaseClient } from "@/lib/supabaseClient";
import { fetchAllSuppliers } from "@/lib/productListing/supplierHelpers";
import { generateProductId } from "@/lib/productListing/productHelpers";
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
  const [uploading, setUploading] = useState(false);

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
    fetchAllSuppliers().then(setSuppliers);
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
        return existing.get(key) ?? { combination: combo, price: "", stock: "", sku: "" };
      })
    );
  }, [options, hasVariants]);

  // ── Image upload ──
  async function handleImageUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const supabase = createSupabaseClient();
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("product-listing-images")
          .upload(path, file, { upsert: false });
        if (!upErr) {
          const { data } = supabase.storage
            .from("product-listing-images")
            .getPublicUrl(path);
          if (data?.publicUrl) urls.push(data.publicUrl);
        }
      }
      setImageUrls((prev) => [...prev, ...urls]);
    } finally {
      setUploading(false);
    }
  }

  // ── Validation ──
  function validateStep1() {
    if (!supplierId) { setError("Please select a supplier"); return false; }
    if (!title.trim()) { setError("Product title is required"); return false; }
    setError("");
    return true;
  }

  function validateStep2() {
    if (hasVariants) {
      const filled = options.filter((o) => o.name && o.values.length > 0);
      if (filled.length === 0) { setError("Add at least one option with values"); return false; }
      const emptyPrice = variantRows.some((r) => !r.price);
      if (emptyPrice) { setError("Set a price for all variants"); return false; }
    }
    setError("");
    return true;
  }

  function next() {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((s) => s + 1);
  }

  // ── Submit ──
  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      const supabase = createSupabaseClient();
      const productId = await generateProductId();

      // Insert product header
      const { error: prodErr } = await supabase.from("pl_products").insert([{
        product_id: productId,
        product_title: title,
        fk_owned_by: supplierId,
        image: imageUrls.length > 0 ? imageUrls : null,
        brand_name: brand || null,
        material: material || null,
        description: description || null,
        package_includes: packageIncludes.length > 0 ? packageIncludes : null,
        has_variants: hasVariants,
        options: hasVariants
          ? options.filter((o) => o.name && o.values.length > 0).map((o) => ({ name: o.name, values: o.values }))
          : null,
        status: "pending",
      }]);

      if (prodErr) {
        setError(prodErr.message || "Failed to create product");
        return;
      }

      // Insert variants
      if (hasVariants && variantRows.length > 0) {
        const variantInserts = variantRows.map((r) => ({
          product_id: productId,
          option_values: r.combination,
          price: parseFloat(r.price) || 0,
          stock: parseInt(r.stock) || 0,
          sku: r.sku || null,
          active: true,
        }));
        const { error: varErr } = await supabase
          .from("pl_product_variants")
          .insert(variantInserts);
        if (varErr) {
          await supabase.from("pl_products").delete().eq("product_id", productId);
          setError(varErr.message || "Failed to create variants");
          return;
        }
      } else {
        // Single variant
        await supabase.from("pl_product_variants").insert([{
          product_id: productId,
          option_values: null,
          price: parseFloat(singlePrice) || 0,
          stock: parseInt(singleStock) || 0,
          sku: singleSku || null,
          active: true,
        }]);
      }

      router.push("/dashboard/product-listing/products");
    } finally {
      setSaving(false);
    }
  }

  const steps = ["Product Info", "Variants", "Review"];

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

        {/* ── Step 1: Product Info ── */}
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

            {/* Images */}
            <Field label="Product Images">
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
        )}

        {/* ── Step 2: Variants ── */}
        {step === 2 && (
          <>
            <h2 className="text-base font-semibold text-gray-800">Variants &amp; Pricing</h2>

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
              // Single variant
              <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">Single Variant</p>
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
              // Multi-variant
              <>
                {options.map((opt, oi) => (
                  <div key={oi} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
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
                      {options.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setOptions(options.filter((_, i) => i !== oi))}
                          className="mt-5 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">Values (click to add)</label>
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

                {/* Variant rows */}
                {variantRows.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-700">
                      {variantRows.length} Variant{variantRows.length !== 1 ? "s" : ""}
                    </h3>
                    {variantRows.map((row, ri) => (
                      <div key={ri} className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-white p-3">
                        <div className="flex flex-wrap gap-1 flex-1">
                          {Object.entries(row.combination).map(([k, v]) => (
                            <span key={k} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                              {k}: {v}
                            </span>
                          ))}
                        </div>
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
                          className="input w-24 text-sm"
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
                          className="input w-20 text-sm"
                        />
                        <input
                          placeholder="SKU"
                          value={row.sku}
                          onChange={(e) => {
                            const next = [...variantRows];
                            next[ri] = { ...next[ri], sku: e.target.value };
                            setVariantRows(next);
                          }}
                          className="input w-24 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
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
              <ReviewRow label="Images" value={`${imageUrls.length} image${imageUrls.length !== 1 ? "s" : ""}`} />
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
