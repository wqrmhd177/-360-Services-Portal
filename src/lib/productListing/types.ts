// ============================================================================
// Product Listing — shared TypeScript types
// ============================================================================

export interface PlSupplier {
  id: string
  supplier_code: string
  shop_name: string
  owner_name: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  country: string | null
  city: string | null
  currency: string
  supplier_type: string | null
  category: string[] | null
  pickup_address: string | null
  pickup_city: string | null
  return_address: string | null
  return_city: string | null
  payment_method: string | null
  bank_title: string | null
  bank_name: string | null
  bank_country: string | null
  iban: string | null
  bank_account_number: string | null
  bank_account_title: string | null
  paypal_email: string | null
  paypal_account_name: string | null
  exchange_name: string | null
  exchange_account_name: string | null
  exchange_id: string | null
  exchange_country: string | null
  binance_wallet: string | null
  status: 'pending' | 'approved' | 'rejected'
  archived: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PlSupplierWithCount extends PlSupplier {
  productCount: number
}

export interface PlProductRow {
  id: number
  product_id: number
  product_title: string
  fk_owned_by: string
  image: string | string[] | null
  brand_name: string | null
  material: string | null
  package_includes: string[] | null
  description: string | null
  category: string[] | null
  bar_code: string | null
  has_variants: boolean
  options: Array<{ name: string; values: string[] }> | null
  status: 'pending' | 'active' | 'inactive' | 'rejected'
  created_at: string
  updated_at: string
}

export interface PlProductVariantRow {
  variant_id: number
  product_id: number
  option_values: Record<string, string> | null
  option_values_abbrev: Record<string, string> | null
  sku: string | null
  price: number
  stock: number
  image: string[] | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface PlVariantInfo {
  variant_id: number
  option_values: Record<string, string> | null
  sku: string | null
  price: number
  stock: number
  image: string[] | null
  active: boolean
}

export interface PlGroupedProduct {
  product_id: number
  product_title: string
  image: string | string[] | null
  fk_owned_by: string
  brand_name: string | null
  material: string | null
  bar_code: string | null
  has_variants: boolean
  options: Array<{ name: string; values: string[] }> | null
  status: 'pending' | 'active' | 'inactive' | 'rejected'
  created_at: string
  updated_at: string
  variants: PlVariantInfo[]
}

export interface PlPriceHistoryEntry {
  id: string
  product_id: number
  variant_id: number
  previous_price: number
  updated_price: number
  status: 'pending' | 'approved' | 'rejected'
  reviewed_at: string | null
  reviewed_by: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface PlVariantStatusChangeRequest {
  id: string
  product_id: number
  variant_id: number
  request_scope: 'variant' | 'product'
  previous_active: boolean
  updated_active: boolean
  status: 'pending' | 'approved' | 'rejected'
  reviewed_at: string | null
  reviewed_by: string | null
  created_by: string | null
  created_at: string
}
