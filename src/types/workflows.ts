export type ShippingType = "sea" | "air" | "road";
export type MovementType = "normal" | "express";
export type PaymentMethod = "advance" | "partial" | "invoice";

/** Warehouse codes for stock entries in QR procurement response. */
export type WarehouseCode = "UAE" | "KSA" | "KWT" | "QTR" | "OMN" | "BHR" | "IRQ" | "PAK";
export const WAREHOUSE_CODES: WarehouseCode[] = ["UAE", "KSA", "KWT", "QTR", "OMN", "BHR", "IRQ", "PAK"];

export interface WarehouseStockEntry {
  /** @deprecated Legacy warehouse code — use sku for new entries */
  warehouse?: WarehouseCode;
  sku?: string;
  country?: string;
  qty: number;
  costPerUnit: number;
  currency?: string;
  procurementImagePaths?: string[];
}

export type PrApprovalStatus = "pending" | "approved" | "rejected";
export type FinanceVerificationStatus = "pending" | "verified" | "rejected";
export type PoStatus =
  | "order_placed"
  | "po_created"
  | "shipment_at_supplier"
  | "shipment_received_at_supplier_warehouse"
  | "shipment_received_at_lp_warehouse"
  | "shipment_received_at_destination_city"
  | "shipment_received_at_destination_warehouse"
  | "delivered"
  | "canceled";
export type PaymentStatus = "paid" | "unpaid";

export interface Qr {
  id: string;
  qr_number?: string;
  created_by_email: string;
  reseller_code: string;
  reseller_contact_no: string;
  reseller_country: string;
  existing_seller: "Yes" | "No";
  gold_seller: "Yes" | "No";
  service_needed: string;
  countries: string[];
  shipping_type: ShippingType;
  shipping_type_by_country?: Record<string, ShippingType>;
  movement_type_by_country: Record<string, MovementType>;
  purchase_details?: Array<{
    productName?: string;
    fromSku?: string;
    toSku?: string;
    /** Legacy: single country. New: use destinationCountries. */
    destinationCountry?: string;
    /** New: multiple destination countries per product (Growth does not set P/S/M). */
    destinationCountries?: string[];
    /**
     * Per-country quantity, unit price, and optional remarks.
     * Currency is explicitly selected (AED/SAR/PKR) at QR creation time.
     */
    countryDetails?: {
      country: string;
      quantity: number;
      unitPrice?: number;
      totalPrice?: number;
      /** @deprecated Use unitPrice */
      targetPrice?: number;
      remarks?: string;
      currency?: "SAR" | "PKR" | "AED";
    }[];
    countryOfPurchase?: "China" | "Local Market";
    shippingType?: ShippingType;
    movementType?: MovementType;
    quantity: number;
    unitPrice?: number;
    totalPrice?: number;
    /** @deprecated Use unitPrice */
    targetPrice?: number;
    imagePaths?: string[];
    movementSplits?: Array<{
      id: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      status: "ready" | "pending";
    }>;
    priceUpdatedAt?: string;
    priceUpdatedBy?: string;
  }>;
  procurement_response: string | Record<number, any> | null;
  status: "open" | "responded" | "converted_to_pr" | "canceled";
  remarks: string | null;
  created_at?: string;
  updated_at?: string;
}

// Product item for multi-product PR
export interface PrProduct {
  productName: string;
  skuCode: string;
  destinationCountry: string;
  /** Where the goods are purchased from (e.g. China, Local Market). */
  countryOfPurchase?: string;
  quantity: number;
  /** Cost per unit (landed). Used for margin calculation. */
  landedCostPrice?: number;
  sellingPricePerUnit: number;
  currency: "SAR" | "PKR" | "AED";
  totalAmount: number;
  shippingType: ShippingType;
  movementType: MovementType;
  remarks?: string;
}

// PR Status types
export type PrStatus = 
  | "pending" 
  | "approved" 
  | "rejected" 
  | "payment_verified" 
  | "converted_to_po";

export interface Pr {
  id: string;
  pr_number?: string;
  from_qr_id: string | null;
  created_by_email: string;
  
  // Seller Information
  seller_channel_name?: string;
  seller_user_id?: string;
  seller_service_type?: string;
  
  // Multi-product support (NEW)
  products?: PrProduct[];
  
  // Legacy single-product fields (kept for backward compatibility)
  product_name?: string;
  sku_code?: string;
  quantity?: number;
  rate?: number;
  amount?: number;
  reseller_code?: string;
  countries?: string[];
  shipping_type?: ShippingType;
  movement_type?: MovementType;
  
  // Payment Information
  payment_method?: PaymentMethod;
  payment_type?: string;
  transaction_id?: string;
  payment_proof_path?: string;
  /** Multiple transaction IDs with their payment proof paths (new format). */
  payment_entries?: Array<{
    transaction_id?: string | null;
    payment_proof_path?: string | null;
  }>;
  reference_files?: string[];
  remarks?: string | null;
  
  // Approval workflow
  pr_status?: PrStatus;
  approval_status: PrApprovalStatus;
  approved_by_email: string | null;
  approval_remarks?: string | null;
  approved_at?: string | null;
  
  // Finance workflow
  finance_verification_status: FinanceVerificationStatus;
  finance_verified_by_email: string | null;
  finance_remarks?: string | null;
  finance_rejection_reason?: string | null;
  finance_verified_at?: string | null;
  
  // Rejection tracking
  rejection_reason?: string | null;
  rejected_at?: string | null;
  
  po_created: boolean;
  created_at?: string;
  updated_at?: string;
}

// Status history entry for PO
export interface PoStatusHistoryEntry {
  status: string;
  timestamp: string;
  changed_by: string;
  remarks?: string;
}

/** Line item for independent POs (no linked PR). Stored in po.products JSONB. */
export interface PoProduct {
  productName: string;
  skuCode?: string;
  quantity: number;
  rate?: number;
  amount?: number;
  /** Procurement product cost per unit (excludes freight). Used on Supplier PO PDF. */
  productCostPerUnit?: number;
  productCostAmount?: number;
  /** Freight cost per unit. Used on Supplier PO PDF. */
  freightCostPerUnit?: number;
  freightCostAmount?: number;
}

export interface Po {
  id: string;
  po_number?: string;
  pr_id: string | null;
  /** Product line items for independent POs; empty or absent when linked to PR. */
  products?: PoProduct[] | null;
  created_by_email: string;
  status: PoStatus;
  po_type: "internal" | "external";
  
  // Supplier Information
  supplier_name: string;
  supplier_location: string;
  supplier_invoice_file: string | null;
  supplier_payment_amount?: number;
  supplier_payment_remarks?: string;
  supplier_payment_status: PaymentStatus;
  /** Public URL of uploaded payment proof when marked paid */
  supplier_payment_proof?: string | null;
  /** Audit trail of proof changes (array of events) */
  supplier_payment_proof_history?: Array<{
    action: "uploaded" | "marked_paid" | "reverted_unpaid" | "deleted_proof" | "replaced_proof";
    url?: string | null;
    at: string;
    by?: string | null;
    note?: string | null;
  }> | null;

  // Delivery Partner Information
  delivery_partner: string;
  delivery_partner_tracking_id: string | null;
  delivery_partner_invoice_file: string | null;
  delivery_partner_payment_amount?: number;
  delivery_partner_remarks?: string;
  delivery_partner_payment_status: PaymentStatus;
  /** Public URL of uploaded payment proof when marked paid */
  delivery_partner_payment_proof?: string | null;
  /** Audit trail of proof changes (array of events) */
  delivery_partner_payment_proof_history?: Array<{
    action: "uploaded" | "marked_paid" | "reverted_unpaid" | "deleted_proof" | "replaced_proof";
    url?: string | null;
    at: string;
    by?: string | null;
    note?: string | null;
  }> | null;

  remarks: string | null;
  invoice_path?: string | null;
  
  // Status tracking
  status_history?: PoStatusHistoryEntry[];
  delivery_dates?: Record<string, string> | null;
  
  created_at?: string;
  updated_at?: string;

  reporting_month?: string | null;

  /** Present when PO is fetched with PR join (e.g. growth POS list) */
  pr?: {
    id: string;
    pr_number?: string;
    created_by_email?: string;
    products?: unknown;
    product_name?: string;
    seller_channel_name?: string;
    seller_service_type?: string;
    movement_type?: MovementType;
    amount?: number;
  };
}

