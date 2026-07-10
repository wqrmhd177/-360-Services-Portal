-- ============================================================================
-- OPERATIONS CACHE — Metabase data cache for fast multi-user reads
-- Run in 360-Portal Supabase SQL editor after setup_product_listing.sql
-- ============================================================================

-- ── Sync log ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ops_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('inventory', 'channel_list', 'orders')),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  row_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_ops_sync_log_source ON ops_sync_log(source, synced_at DESC);

-- ── Inventory cache ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ops_inventory_items (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  username TEXT,
  product_name TEXT,
  sku TEXT NOT NULL,
  available_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
  country TEXT,
  category TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_inv_sku ON ops_inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_ops_inv_user_id ON ops_inventory_items(user_id);
CREATE INDEX IF NOT EXISTS idx_ops_inv_product_name ON ops_inventory_items(product_name);
CREATE INDEX IF NOT EXISTS idx_ops_inv_country ON ops_inventory_items(country);

-- ── Channel list cache ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ops_channel_list_items (
  id BIGSERIAL PRIMARY KEY,
  store_id BIGINT,
  user_id BIGINT,
  store_name TEXT,
  store_url TEXT,
  platform TEXT,
  bifurcation TEXT,
  confirmation_setting TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_channel_store_id ON ops_channel_list_items(store_id);
CREATE INDEX IF NOT EXISTS idx_ops_channel_user_id ON ops_channel_list_items(user_id);
CREATE INDEX IF NOT EXISTS idx_ops_channel_store_name ON ops_channel_list_items(store_name);

-- ── Orders cache (populate when Metabase orders URL is configured) ───────────
CREATE TABLE IF NOT EXISTS ops_orders_items (
  id BIGSERIAL PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Read views (fast SELECT for the portal) ──────────────────────────────────
CREATE OR REPLACE VIEW ops_inventory_view AS
SELECT
  id,
  user_id,
  username,
  product_name,
  sku,
  available_quantity,
  country,
  category,
  synced_at
FROM ops_inventory_items
ORDER BY product_name, sku;

CREATE OR REPLACE VIEW ops_channel_list_view AS
SELECT
  id,
  store_id,
  user_id,
  store_name,
  store_url,
  platform,
  bifurcation,
  confirmation_setting,
  synced_at
FROM ops_channel_list_items
ORDER BY store_name, store_id;

-- ── Materialized view: inventory aggregates (refresh after each sync) ─────────
CREATE MATERIALIZED VIEW IF NOT EXISTS ops_inventory_summary AS
SELECT
  country,
  category,
  COUNT(*)::INTEGER AS sku_count,
  COALESCE(SUM(available_quantity), 0)::NUMERIC(14, 2) AS total_quantity
FROM ops_inventory_items
GROUP BY country, category;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_inventory_summary_unique
  ON ops_inventory_summary(country, category);

CREATE OR REPLACE FUNCTION refresh_ops_inventory_summary()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY ops_inventory_summary;
$$;

-- Fallback if concurrent refresh fails on first run (no unique index yet)
CREATE OR REPLACE FUNCTION refresh_ops_inventory_summary_simple()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  REFRESH MATERIALIZED VIEW ops_inventory_summary;
$$;

-- ── Paginated search: inventory ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_ops_inventory(
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 25,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  user_id TEXT,
  username TEXT,
  product_name TEXT,
  sku TEXT,
  available_quantity NUMERIC,
  country TEXT,
  category TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_q TEXT := NULLIF(TRIM(p_search), '');
  v_norm TEXT;
  v_prefix4 TEXT;
  v_prefix3 TEXT;
BEGIN
  IF v_q IS NOT NULL THEN
    v_norm := UPPER(REGEXP_REPLACE(v_q, '^,+', ''));
    IF LENGTH(v_norm) >= 4 THEN v_prefix4 := LEFT(v_norm, 4); END IF;
    IF LENGTH(v_norm) >= 3 THEN v_prefix3 := LEFT(v_norm, 3); END IF;
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT i.*
    FROM ops_inventory_items i
    WHERE v_q IS NULL
       OR i.user_id ILIKE '%' || v_q || '%'
       OR i.product_name ILIKE '%' || v_q || '%'
       OR COALESCE(i.username, '') ILIKE '%' || v_q || '%'
       OR i.sku ILIKE '%' || v_norm || '%'
       OR (v_prefix4 IS NOT NULL AND i.sku ILIKE v_prefix4 || '%')
       OR (v_prefix3 IS NOT NULL AND i.sku ILIKE v_prefix3 || '%')
  ),
  counted AS (SELECT COUNT(*)::BIGINT AS cnt FROM filtered)
  SELECT
    f.id,
    f.user_id,
    f.username,
    f.product_name,
    f.sku,
    f.available_quantity,
    f.country,
    f.category,
    c.cnt
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.product_name, f.sku
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
END;
$$;

-- ── Paginated search: channel list ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_ops_channel_list(
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 25,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  store_id BIGINT,
  user_id BIGINT,
  store_name TEXT,
  store_url TEXT,
  platform TEXT,
  bifurcation TEXT,
  confirmation_setting TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_q TEXT := NULLIF(TRIM(p_search), '');
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT c.*
    FROM ops_channel_list_items c
    WHERE v_q IS NULL
       OR c.store_name ILIKE '%' || v_q || '%'
       OR COALESCE(c.store_url, '') ILIKE '%' || v_q || '%'
       OR c.store_id::TEXT ILIKE '%' || v_q || '%'
       OR c.user_id::TEXT ILIKE '%' || v_q || '%'
  ),
  counted AS (SELECT COUNT(*)::BIGINT AS cnt FROM filtered)
  SELECT
    f.id,
    f.store_id,
    f.user_id,
    f.store_name,
    f.store_url,
    f.platform,
    f.bifurcation,
    f.confirmation_setting,
    c.cnt
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.store_name, f.store_id
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
END;
$$;

-- Disable RLS so API routes (service/anon) can read/write during sync
ALTER TABLE ops_sync_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE ops_inventory_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE ops_channel_list_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE ops_orders_items DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE ops_inventory_items IS 'Cached Metabase inventory feed for Operations > Inventory';
COMMENT ON TABLE ops_channel_list_items IS 'Cached Metabase channel list for Operations > Channel List';
COMMENT ON MATERIALIZED VIEW ops_inventory_summary IS 'Aggregated inventory by country/category — refresh after sync';
