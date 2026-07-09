-- ============================================================================
-- PRODUCT LISTING MODULE — SETUP SCRIPT
-- Run this in the 360-Portal Supabase SQL editor.
-- All tables are prefixed with pl_ to avoid collisions.
-- ============================================================================

-- ============================================================================
-- 1. pl_suppliers
-- ============================================================================
CREATE TABLE IF NOT EXISTS pl_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code TEXT UNIQUE NOT NULL,         -- e.g. SUP001
  shop_name TEXT NOT NULL,
  owner_name TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  country TEXT,
  city TEXT,
  currency TEXT DEFAULT 'USD',
  supplier_type TEXT,
  category JSONB,                             -- array of category strings
  pickup_address TEXT,
  pickup_city TEXT,
  return_address TEXT,
  return_city TEXT,
  payment_method TEXT,                        -- 'Bank Account' | 'Paypal' | 'Crypto Payments'
  bank_title TEXT,
  bank_name TEXT,
  bank_country TEXT,
  iban TEXT,
  bank_account_number TEXT,
  bank_account_title TEXT,
  paypal_email TEXT,
  paypal_account_name TEXT,
  exchange_name TEXT,
  exchange_account_name TEXT,
  exchange_id TEXT,
  exchange_country TEXT,
  binance_wallet TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT pl_suppliers_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT,                            -- portal user email who created this supplier
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pl_suppliers_code    ON pl_suppliers(supplier_code);
CREATE INDEX IF NOT EXISTS idx_pl_suppliers_status  ON pl_suppliers(status);
CREATE INDEX IF NOT EXISTS idx_pl_suppliers_country ON pl_suppliers(country);
CREATE INDEX IF NOT EXISTS idx_pl_suppliers_created ON pl_suppliers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pl_suppliers_cat     ON pl_suppliers USING GIN(category);

COMMENT ON TABLE pl_suppliers IS 'Product Listing module: supplier records';

-- ============================================================================
-- 2. pl_products
-- ============================================================================
CREATE TABLE IF NOT EXISTS pl_products (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL,                 -- groups variants of same product
  product_title TEXT NOT NULL,
  fk_owned_by TEXT NOT NULL,                  -- references pl_suppliers.supplier_code
  image JSONB,                                -- array of image URLs
  brand_name TEXT,
  material TEXT,
  package_includes JSONB,
  description TEXT,
  category JSONB,
  bar_code TEXT,
  has_variants BOOLEAN DEFAULT false,
  options JSONB,                              -- [{name, values}]
  status TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT pl_products_status_check CHECK (status IN ('pending', 'active', 'inactive', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pl_products_price_positive CHECK (true)
);

CREATE INDEX IF NOT EXISTS idx_pl_products_product_id  ON pl_products(product_id);
CREATE INDEX IF NOT EXISTS idx_pl_products_owned_by    ON pl_products(fk_owned_by);
CREATE INDEX IF NOT EXISTS idx_pl_products_status      ON pl_products(status);
CREATE INDEX IF NOT EXISTS idx_pl_products_created     ON pl_products(created_at DESC);

COMMENT ON TABLE pl_products IS 'Product Listing module: product headers (one row per product)';

-- ============================================================================
-- 3. pl_product_variants
-- ============================================================================
CREATE TABLE IF NOT EXISTS pl_product_variants (
  variant_id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL,                 -- references pl_products.product_id
  option_values JSONB,                        -- {"Color":"Red","Sizes":"M"}
  option_values_abbrev JSONB,
  sku TEXT,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  image JSONB,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pl_product_variants_price_check CHECK (price >= 0),
  CONSTRAINT pl_product_variants_stock_check CHECK (stock >= 0)
);

CREATE INDEX IF NOT EXISTS idx_pl_pv_product_id ON pl_product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_pl_pv_active     ON pl_product_variants(product_id, active);

COMMENT ON TABLE pl_product_variants IS 'Product Listing module: Shopify-style variant rows';

-- ============================================================================
-- 4. pl_price_history
-- ============================================================================
CREATE TABLE IF NOT EXISTS pl_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id BIGINT NOT NULL,
  variant_id BIGINT NOT NULL,
  previous_price NUMERIC(10, 2) NOT NULL,
  updated_price NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT pl_price_history_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,                           -- portal user email
  notes TEXT,
  created_by TEXT,                            -- portal user email
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pl_price_history_different CHECK (previous_price <> updated_price)
);

CREATE INDEX IF NOT EXISTS idx_pl_ph_variant_id ON pl_price_history(variant_id);
CREATE INDEX IF NOT EXISTS idx_pl_ph_product_id ON pl_price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_pl_ph_status     ON pl_price_history(status);
CREATE INDEX IF NOT EXISTS idx_pl_ph_created    ON pl_price_history(created_at DESC);

COMMENT ON TABLE pl_price_history IS 'Product Listing module: price change approval requests';

-- ============================================================================
-- 5. pl_variant_status_change_requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS pl_variant_status_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id BIGINT NOT NULL,
  variant_id BIGINT NOT NULL,
  request_scope TEXT NOT NULL DEFAULT 'variant'
    CONSTRAINT pl_vscr_scope_check CHECK (request_scope IN ('variant', 'product')),
  previous_active BOOLEAN NOT NULL,
  updated_active BOOLEAN NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT pl_vscr_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pl_vscr_status     ON pl_variant_status_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_pl_vscr_variant_id ON pl_variant_status_change_requests(variant_id);
CREATE INDEX IF NOT EXISTS idx_pl_vscr_product_id ON pl_variant_status_change_requests(product_id);

COMMENT ON TABLE pl_variant_status_change_requests IS 'Product Listing module: variant active/inactive change approval requests';

-- ============================================================================
-- 6. Storage bucket: product-listing-images
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-listing-images', 'product-listing-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload; public reads are covered by bucket.public = true
CREATE POLICY "product_listing_images_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-listing-images');

CREATE POLICY "product_listing_images_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-listing-images');

CREATE POLICY "product_listing_images_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-listing-images');
