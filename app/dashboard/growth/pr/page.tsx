import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import type { MovementType, PaymentMethod, ShippingType } from "@/types/workflows";

async function createPr(formData: FormData) {
  "use server";
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  const productName = String(formData.get("product_name") ?? "");
  const skuCode = String(formData.get("sku_code") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const rate = Number(formData.get("rate") ?? 0);
  const amount = quantity * rate;
  const resellerCode = String(formData.get("reseller_code") ?? "");
  const countriesRaw = String(formData.get("countries") ?? "");
  const countries = countriesRaw
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const shippingType = String(formData.get("shipping_type") ?? "sea") as ShippingType;
  const movementType = String(formData.get("movement_type") ?? "normal") as MovementType;
  const paymentMethod = String(formData.get("payment_method") ?? "advance") as PaymentMethod;
  const remarks = (formData.get("remarks") as string | null) || null;

  const supabase = createSupabaseClient();
  const { data: newPr } = await supabase
    .from("pr")
    .insert({
      created_by_email: session.email,
      product_name: productName,
      sku_code: skuCode,
      quantity,
      rate,
      amount,
      reseller_code: resellerCode,
      countries,
      shipping_type: shippingType,
      movement_type: movementType,
      payment_method: paymentMethod,
      remarks
    })
    .select("id, pr_number")
    .single();

  // Redirect with PR number in query params to show success modal
  if (newPr?.pr_number) {
    redirect(`/dashboard/growth?pr_created=${newPr.pr_number}`);
  } else {
    redirect("/dashboard/growth");
  }
}

export default function GrowthPrFormPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Create Purchase Request (PR)</h2>
      <p className="text-sm text-gray-500">
        Create a purchase request from confirmed quotations, including pricing, payment method, and references.
      </p>
      <form action={createPr} className="card space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500">Product Name</label>
            <input
              name="product_name"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500">SKU Code</label>
            <input
              name="sku_code"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500">Quantity</label>
            <input
              name="quantity"
              type="number"
              required
              min={1}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500">Rate</label>
            <input
              name="rate"
              type="number"
              step="0.01"
              required
              min={0}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500">Customer Name / Code</label>
            <input
              name="reseller_code"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500">
              Countries <span className="text-[10px] text-gray-400">(comma separated)</span>
            </label>
            <input
              name="countries"
              placeholder="UAE, KSA, India"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500">Shipping Type</label>
            <select
              name="shipping_type"
              defaultValue="sea"
            >
              <option value="sea">Sea</option>
              <option value="air">Air</option>
              <option value="road">Road</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500">Movement Type</label>
            <select
              name="movement_type"
              defaultValue="normal"
            >
              <option value="normal">Normal</option>
              <option value="express">Express</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500">Payment Method</label>
            <select
              name="payment_method"
              defaultValue="advance"
            >
              <option value="advance">Advance</option>
              <option value="partial">Partial</option>
              <option value="invoice">Invoice</option>
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-500">Remarks</label>
          <textarea
            name="remarks"
            rows={3}
          />
        </div>
        <button type="submit" className="btn-primary">
          Save PR
        </button>
      </form>
    </div>
  );
}

