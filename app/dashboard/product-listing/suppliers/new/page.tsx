"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, Save } from "lucide-react";
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
const PAYMENT_METHODS = ["Bank Account", "Paypal", "Crypto Payments"] as const;
const CURRENCIES = ["USD", "PKR", "AED", "EUR", "GBP", "SAR", "OMR", "BHD", "KWD", "QAR"] as const;
const COUNTRIES = [
  "Pakistan", "United Arab Emirates", "Saudi Arabia", "United Kingdom",
  "United States", "Kuwait", "Qatar", "Bahrain", "Oman", "Germany",
  "France", "Canada", "Australia", "Turkey", "China", "India",
] as const;
const CRYPTO_EXCHANGES = ["Binance", "OKX", "MEXC", "Crypto.com"] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormData {
  // Step 1
  shopName: string;
  ownerName: string;
  email: string;
  phone: string;
  whatsapp: string;
  country: string;
  city: string;
  supplierType: string;
  category: string[];
  // Step 2
  currency: string;
  pickupAddress: string;
  pickupCity: string;
  returnAddress: string;
  returnCity: string;
  // Step 3
  paymentMethod: string;
  bankTitle: string;
  bankName: string;
  bankCountry: string;
  iban: string;
  bankAccountNumber: string;
  bankAccountTitle: string;
  paypalEmail: string;
  paypalAccountName: string;
  exchangeName: string;
  exchangeAccountName: string;
  exchangeId: string;
  exchangeCountry: string;
  binanceWallet: string;
}

const INIT: FormData = {
  shopName: "", ownerName: "", email: "", phone: "", whatsapp: "",
  country: "", city: "", supplierType: "", category: [],
  currency: "USD", pickupAddress: "", pickupCity: "", returnAddress: "", returnCity: "",
  paymentMethod: "", bankTitle: "", bankName: "", bankCountry: "", iban: "",
  bankAccountNumber: "", bankAccountTitle: "", paypalEmail: "", paypalAccountName: "",
  exchangeName: "", exchangeAccountName: "", exchangeId: "", exchangeCountry: "", binanceWallet: "",
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function NewSupplierPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(INIT);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function set(field: keyof FormData, value: string | string[]) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  }

  function toggleCategory(cat: string) {
    setForm((f) => ({
      ...f,
      category: f.category.includes(cat)
        ? f.category.filter((c) => c !== cat)
        : [...f.category, cat],
    }));
  }

  function validateStep1() {
    const e: Record<string, string> = {};
    if (!form.shopName.trim()) e.shopName = "Shop name is required";
    if (!form.email.trim()) e.email = "Email is required";
    if (!form.country) e.country = "Country is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2() {
    return true;
  }

  function nextStep() {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((s) => s + 1);
  }

  async function handleSubmit() {
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
        email: form.email || null,
        phone: form.phone || null,
        whatsapp: form.whatsapp || null,
        country: form.country || null,
        city: form.city || null,
        currency: form.currency,
        supplier_type: form.supplierType || null,
        category: form.category.length > 0 ? form.category : null,
        pickup_address: form.pickupAddress || null,
        pickup_city: form.pickupCity || null,
        return_address: form.returnAddress || null,
        return_city: form.returnCity || null,
        payment_method: form.paymentMethod || null,
        bank_title: form.bankTitle || null,
        bank_name: form.bankName || null,
        bank_country: form.bankCountry || null,
        iban: form.iban || null,
        bank_account_number: form.bankAccountNumber || null,
        bank_account_title: form.bankAccountTitle || null,
        paypal_email: form.paypalEmail || null,
        paypal_account_name: form.paypalAccountName || null,
        exchange_name: form.exchangeName || null,
        exchange_account_name: form.exchangeAccountName || null,
        exchange_id: form.exchangeId || null,
        exchange_country: form.exchangeCountry || null,
        binance_wallet: form.binanceWallet || null,
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

  const steps = ["Account & Info", "Business", "Payment"];

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

      {/* Step indicator */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Add New Supplier</h1>
        <div className="mt-4 flex items-center gap-0">
          {steps.map((label, idx) => {
            const n = idx + 1;
            const active = n === step;
            const done = n < step;
            return (
              <div key={n} className="flex flex-1 items-center">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      done
                        ? "bg-green-500 text-white"
                        : active
                        ? "bg-portal-600 text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {done ? <CheckCircle className="h-4 w-4" /> : n}
                  </div>
                  <span
                    className={`hidden text-sm sm:inline ${
                      active ? "font-semibold text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className="mx-2 flex-1 border-t border-gray-200" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Card */}
      <div className="card p-6 space-y-5">
        {/* ── Step 1 ── */}
        {step === 1 && (
          <>
            <h2 className="text-base font-semibold text-gray-800">Account &amp; Personal Info</h2>

            <Field label="Shop / Store Name *" error={errors.shopName}>
              <input
                className={`input ${errors.shopName ? "border-red-400" : ""}`}
                value={form.shopName}
                onChange={(e) => set("shopName", e.target.value)}
                placeholder="Zambeel Store Name"
              />
            </Field>

            <Field label="Owner Name">
              <input className="input" value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} placeholder="Full name" />
            </Field>

            <Field label="Email *" error={errors.email}>
              <input
                className={`input ${errors.email ? "border-red-400" : ""}`}
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="supplier@email.com"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Phone">
                <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+92 300 0000000" />
              </Field>
              <Field label="WhatsApp">
                <input className="input" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+92 300 0000000" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Country *" error={errors.country}>
                <select
                  className={`input ${errors.country ? "border-red-400" : ""}`}
                  value={form.country}
                  onChange={(e) => set("country", e.target.value)}
                >
                  <option value="">Select country</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="City">
                <input className="input" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="City" />
              </Field>
            </div>

            <Field label="Supplier Type">
              <select className="input" value={form.supplierType} onChange={(e) => set("supplierType", e.target.value)}>
                <option value="">Select type</option>
                {SUPPLIER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            <Field label="Business Categories">
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
          </>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <>
            <h2 className="text-base font-semibold text-gray-800">Business Details</h2>

            <Field label="Currency">
              <select className="input" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>

            <Field label="Pickup Address">
              <input className="input" value={form.pickupAddress} onChange={(e) => set("pickupAddress", e.target.value)} placeholder="Street address" />
            </Field>

            <Field label="Pickup City">
              <input className="input" value={form.pickupCity} onChange={(e) => set("pickupCity", e.target.value)} placeholder="City" />
            </Field>

            <Field label="Return Address">
              <input className="input" value={form.returnAddress} onChange={(e) => set("returnAddress", e.target.value)} placeholder="Street address" />
            </Field>

            <Field label="Return City">
              <input className="input" value={form.returnCity} onChange={(e) => set("returnCity", e.target.value)} placeholder="City" />
            </Field>
          </>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <>
            <h2 className="text-base font-semibold text-gray-800">Payment Details</h2>

            <Field label="Payment Method">
              <select className="input" value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}>
                <option value="">Select method</option>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>

            {form.paymentMethod === "Bank Account" && (
              <>
                <Field label="Bank Title">
                  <input className="input" value={form.bankTitle} onChange={(e) => set("bankTitle", e.target.value)} placeholder="Account title" />
                </Field>
                <Field label="Bank Name">
                  <input className="input" value={form.bankName} onChange={(e) => set("bankName", e.target.value)} placeholder="Bank name" />
                </Field>
                <Field label="Bank Country">
                  <select className="input" value={form.bankCountry} onChange={(e) => set("bankCountry", e.target.value)}>
                    <option value="">Select country</option>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="IBAN / Account Number">
                  <input className="input" value={form.iban} onChange={(e) => set("iban", e.target.value)} placeholder="IBAN or account number" />
                </Field>
              </>
            )}

            {form.paymentMethod === "Paypal" && (
              <>
                <Field label="PayPal Email">
                  <input className="input" type="email" value={form.paypalEmail} onChange={(e) => set("paypalEmail", e.target.value)} placeholder="PayPal email" />
                </Field>
                <Field label="PayPal Account Name">
                  <input className="input" value={form.paypalAccountName} onChange={(e) => set("paypalAccountName", e.target.value)} placeholder="Account name" />
                </Field>
              </>
            )}

            {form.paymentMethod === "Crypto Payments" && (
              <>
                <Field label="Exchange">
                  <select className="input" value={form.exchangeName} onChange={(e) => set("exchangeName", e.target.value)}>
                    <option value="">Select exchange</option>
                    {CRYPTO_EXCHANGES.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </Field>
                {form.exchangeName === "Binance" && (
                  <Field label="Binance Wallet Address">
                    <input className="input" value={form.binanceWallet} onChange={(e) => set("binanceWallet", e.target.value)} placeholder="Wallet address" />
                  </Field>
                )}
                {form.exchangeName && form.exchangeName !== "Binance" && (
                  <>
                    <Field label="Exchange Account Name">
                      <input className="input" value={form.exchangeAccountName} onChange={(e) => set("exchangeAccountName", e.target.value)} />
                    </Field>
                    <Field label="Exchange ID">
                      <input className="input" value={form.exchangeId} onChange={(e) => set("exchangeId", e.target.value)} />
                    </Field>
                    <Field label="Exchange Country">
                      <select className="input" value={form.exchangeCountry} onChange={(e) => set("exchangeCountry", e.target.value)}>
                        <option value="">Select country</option>
                        {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Field>
                  </>
                )}
              </>
            )}

            {submitError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {submitError}
              </div>
            )}
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
          <button type="button" onClick={nextStep} className="btn-primary inline-flex items-center gap-1.5">
            Next <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              <><Save className="h-4 w-4" /> Create Supplier</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
