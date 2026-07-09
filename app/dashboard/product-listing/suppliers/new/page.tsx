"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { createSupplier, generateSupplierCode } from "@/lib/productListing/supplierHelpers";

// ─── Constants ────────────────────────────────────────────────────────────────
const SUPPLIER_TYPES = ["Trader", "Wholesaler", "Retailer", "Selling from Home"] as const;
const CATEGORIES = [
  "Electronics", "Mobile Phones & Accessories", "Computers & IT Accessories",
  "Home Appliances", "Garments / Apparel", "Footwear", "Fashion Accessories",
  "Cosmetics & Beauty Products", "Personal Care & Hygiene", "Health & Wellness",
  "Baby Care Products", "Toys & Games", "Sports & Fitness Equipment",
  "Home & Kitchen", "Furniture", "Home Décor", "Grocery & Food Items",
  "Stationery & Office Supplies", "Books & Educational Material",
  "Automotive Parts & Accessories", "Tools & Hardware", "Jewellery & Watches",
  "Bags & Luggage", "Pet Supplies",
] as const;
const COUNTRIES = [
  "Pakistan", "United Arab Emirates", "Saudi Arabia", "United Kingdom",
  "United States", "Kuwait", "Qatar", "Bahrain", "Oman", "Germany",
  "France", "Canada", "Australia", "Turkey", "China", "India",
] as const;

const COUNTRY_CURRENCY: Record<string, string> = {
  Pakistan: "PKR",
  "United Arab Emirates": "AED",
  "Saudi Arabia": "SAR",
  "United Kingdom": "GBP",
  "United States": "USD",
  Kuwait: "KWD",
  Qatar: "QAR",
  Bahrain: "BHD",
  Oman: "OMR",
  Germany: "EUR",
  France: "EUR",
  Canada: "CAD",
  Australia: "AUD",
  Turkey: "TRY",
  China: "CNY",
  India: "INR",
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormData {
  shopName: string;
  ownerName: string;
  phone: string;
  whatsapp: string;
  country: string;
  city: string;
  currency: string;
  supplierType: string;
  category: string[];
}

const INIT: FormData = {
  shopName: "", ownerName: "", phone: "", whatsapp: "",
  country: "", city: "", currency: "USD", supplierType: "", category: [],
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function NewSupplierPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(INIT);
  const [sameAsPhone, setSameAsPhone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function set(field: keyof FormData, value: string | string[]) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  }

  function handleCountryChange(country: string) {
    const currency = COUNTRY_CURRENCY[country] ?? "USD";
    setForm((f) => ({ ...f, country, currency }));
    setErrors((e) => ({ ...e, country: "" }));
  }

  function handlePhoneChange(value: string) {
    set("phone", value);
    if (sameAsPhone) {
      set("whatsapp", value);
    }
  }

  function handleSameAsPhone(checked: boolean) {
    setSameAsPhone(checked);
    if (checked) {
      set("whatsapp", form.phone);
    }
  }

  function toggleCategory(cat: string) {
    setForm((f) => ({
      ...f,
      category: f.category.includes(cat)
        ? f.category.filter((c) => c !== cat)
        : [...f.category, cat],
    }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.shopName.trim()) e.shopName = "Shop name is required";
    if (!form.phone.trim()) e.phone = "Phone number is required";
    if (!form.whatsapp.trim()) e.whatsapp = "WhatsApp number is required";
    if (!form.country) e.country = "Country is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    setSubmitError("");
    try {
      const code = await generateSupplierCode();
      const session = await fetch("/api/auth/session").then((r) => r.json());
      const createdBy = session?.session?.email ?? "";

      const result = await createSupplier({
        supplier_code: code,
        shop_name: form.shopName,
        owner_name: form.ownerName || null,
        email: null,
        phone: form.phone,
        whatsapp: form.whatsapp,
        country: form.country,
        city: form.city || null,
        currency: form.currency,
        supplier_type: form.supplierType || null,
        category: form.category.length > 0 ? form.category : null,
        pickup_address: null,
        pickup_city: null,
        return_address: null,
        return_city: null,
        payment_method: null,
        bank_title: null,
        bank_name: null,
        bank_country: null,
        iban: null,
        bank_account_number: null,
        bank_account_title: null,
        paypal_email: null,
        paypal_account_name: null,
        exchange_name: null,
        exchange_account_name: null,
        exchange_id: null,
        exchange_country: null,
        binance_wallet: null,
        status: "pending",
        archived: false,
        created_by: createdBy,
      });

      if (!result) {
        setSubmitError("Failed to create supplier. Please try again.");
        return;
      }
      router.push("/dashboard/product-listing/suppliers");
    } catch {
      setSubmitError("Unexpected error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Suppliers
      </button>

      <h1 className="text-2xl font-semibold text-gray-900">Add New Supplier</h1>

      {/* Form card */}
      <div className="card space-y-5 p-6">
        <Field label="Shop / Store Name *" error={errors.shopName}>
          <input
            className={`input ${errors.shopName ? "border-red-400" : ""}`}
            value={form.shopName}
            onChange={(e) => set("shopName", e.target.value)}
            placeholder="Store name"
          />
        </Field>

        <Field label="Owner Name">
          <input
            className="input"
            value={form.ownerName}
            onChange={(e) => set("ownerName", e.target.value)}
            placeholder="Full name (optional)"
          />
        </Field>

        {/* Phone */}
        <Field label="Phone Number *" error={errors.phone}>
          <input
            className={`input ${errors.phone ? "border-red-400" : ""}`}
            value={form.phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="+92 300 0000000"
          />
        </Field>

        {/* WhatsApp */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              WhatsApp Number *
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-500 select-none">
              <input
                type="checkbox"
                checked={sameAsPhone}
                onChange={(e) => handleSameAsPhone(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300 accent-portal-600"
              />
              Same as phone number
            </label>
          </div>
          <input
            className={`input ${errors.whatsapp ? "border-red-400" : ""}`}
            value={form.whatsapp}
            onChange={(e) => {
              setSameAsPhone(false);
              set("whatsapp", e.target.value);
            }}
            placeholder="+92 300 0000000"
            disabled={sameAsPhone}
          />
          {errors.whatsapp && <p className="text-xs text-red-500">{errors.whatsapp}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Country *" error={errors.country}>
            <select
              className={`input ${errors.country ? "border-red-400" : ""}`}
              value={form.country}
              onChange={(e) => handleCountryChange(e.target.value)}
            >
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="City">
            <input
              className="input"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              placeholder="City (optional)"
            />
          </Field>
        </div>

        <Field label="Currency">
          <input
            className="input bg-gray-50 text-gray-600"
            value={form.currency}
            readOnly
            placeholder="Auto-set from country"
          />
        </Field>

        <Field label="Supplier Type">
          <select
            className="input"
            value={form.supplierType}
            onChange={(e) => set("supplierType", e.target.value)}
          >
            <option value="">Select type (optional)</option>
            {SUPPLIER_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>

        <Field label="Business Categories">
          <p className="mb-2 text-xs text-gray-400">Optional — select all that apply</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  form.category.includes(cat)
                    ? "bg-portal-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </Field>

        {submitError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {submitError}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
        >
          {saving ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
          ) : (
            <><Save className="h-4 w-4" /> Create Supplier</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Field helper ─────────────────────────────────────────────────────────────
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
