-- ============================================================================
-- PRODUCT LISTING PATCH — run AFTER setup_product_listing.sql
-- Adds missing unique constraints and disables RLS so the migration
-- script (anon key) can write data.
-- ============================================================================

-- 1. Unique constraint on pl_products.product_id (needed for upsert)
ALTER TABLE pl_products
  ADD CONSTRAINT pl_products_product_id_unique UNIQUE (product_id);

-- 2. Unique constraint on pl_product_variants.variant_id (already PK but explicit for upsert)
-- Already BIGSERIAL PK, no change needed.

-- 3. Disable RLS on all pl_ tables so the migration script (anon key) can insert
--    Re-enable (or add policies) after migration if needed.
ALTER TABLE pl_suppliers                    DISABLE ROW LEVEL SECURITY;
ALTER TABLE pl_products                     DISABLE ROW LEVEL SECURITY;
ALTER TABLE pl_product_variants             DISABLE ROW LEVEL SECURITY;
ALTER TABLE pl_price_history                DISABLE ROW LEVEL SECURITY;
ALTER TABLE pl_variant_status_change_requests DISABLE ROW LEVEL SECURITY;
