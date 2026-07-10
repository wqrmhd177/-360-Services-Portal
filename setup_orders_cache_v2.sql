-- ============================================================================
-- ORDERS CACHE v2 — Structured columns for analytics
-- Run in 360-Portal Supabase SQL editor
-- Replaces the JSONB payload table created in setup_operations_cache.sql
-- ============================================================================

-- Drop existing JSONB-payload table and recreate with structured columns
DROP TABLE IF EXISTS ops_orders_items CASCADE;

CREATE TABLE ops_orders_items (
  id               BIGSERIAL PRIMARY KEY,
  order_id         BIGINT,
  order_number     TEXT,
  domain           TEXT,
  store_id         BIGINT,
  store_url        TEXT,
  country          TEXT,
  city             TEXT,
  full_name        TEXT,
  title            TEXT,
  sku              TEXT,
  quantity         INTEGER NOT NULL DEFAULT 1,
  total_payable    NUMERIC(14, 2) NOT NULL DEFAULT 0,
  currency         TEXT,
  status           TEXT,
  substatus        TEXT,
  tag              TEXT,
  bifurcation      TEXT,
  delivery_partner TEXT,
  platform         TEXT,
  order_date       TIMESTAMPTZ,
  approved_date    TIMESTAMPTZ,
  shipment_date    TIMESTAMPTZ,
  shipment_date_log TIMESTAMPTZ,
  delivered_date   TIMESTAMPTZ,
  returned_date    TIMESTAMPTZ,
  undelivered_date TIMESTAMPTZ,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for filter queries
CREATE INDEX IF NOT EXISTS idx_ops_orders_country      ON ops_orders_items(country);
CREATE INDEX IF NOT EXISTS idx_ops_orders_bifurcation  ON ops_orders_items(bifurcation);
CREATE INDEX IF NOT EXISTS idx_ops_orders_store_id     ON ops_orders_items(store_id);
CREATE INDEX IF NOT EXISTS idx_ops_orders_date         ON ops_orders_items(order_date);
CREATE INDEX IF NOT EXISTS idx_ops_orders_status       ON ops_orders_items(status);

-- Disable RLS so API routes can read/write during sync
ALTER TABLE ops_orders_items DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE ops_orders_items IS 'Cached Metabase orders feed for Operations > Orders and Store Visibility';

-- ── RPC: fetch all rows matching filters (analytics needs full set, not paginated) ──
CREATE OR REPLACE FUNCTION get_ops_orders_filtered(
  p_country     TEXT DEFAULT NULL,
  p_bifurcation TEXT DEFAULT NULL,
  p_store_id    BIGINT DEFAULT NULL,
  p_from_date   DATE DEFAULT NULL,
  p_to_date     DATE DEFAULT NULL
)
RETURNS TABLE (
  id               BIGINT,
  order_id         BIGINT,
  order_number     TEXT,
  domain           TEXT,
  store_id         BIGINT,
  store_url        TEXT,
  country          TEXT,
  city             TEXT,
  title            TEXT,
  sku              TEXT,
  quantity         INTEGER,
  total_payable    NUMERIC,
  currency         TEXT,
  status           TEXT,
  substatus        TEXT,
  tag              TEXT,
  bifurcation      TEXT,
  delivery_partner TEXT,
  platform         TEXT,
  order_date       TIMESTAMPTZ,
  approved_date    TIMESTAMPTZ,
  shipment_date    TIMESTAMPTZ,
  shipment_date_log TIMESTAMPTZ,
  delivered_date   TIMESTAMPTZ,
  returned_date    TIMESTAMPTZ,
  undelivered_date TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.order_id,
    o.order_number,
    o.domain,
    o.store_id,
    o.store_url,
    o.country,
    o.city,
    o.title,
    o.sku,
    o.quantity,
    o.total_payable,
    o.currency,
    o.status,
    o.substatus,
    o.tag,
    o.bifurcation,
    o.delivery_partner,
    o.platform,
    o.order_date,
    o.approved_date,
    o.shipment_date,
    o.shipment_date_log,
    o.delivered_date,
    o.returned_date,
    o.undelivered_date
  FROM ops_orders_items o
  WHERE
    (p_country     IS NULL OR o.country     = p_country)
    AND (p_bifurcation IS NULL OR o.bifurcation = p_bifurcation)
    AND (p_store_id    IS NULL OR o.store_id    = p_store_id)
    AND (p_from_date   IS NULL OR o.order_date  >= p_from_date::TIMESTAMPTZ)
    AND (p_to_date     IS NULL OR o.order_date  <  (p_to_date + INTERVAL '1 day')::TIMESTAMPTZ);
END;
$$;

-- ── RPC: distinct filter options ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_ops_orders_filter_options()
RETURNS TABLE (
  opt_type TEXT,
  opt_value TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT 'country'     AS opt_type, country     AS opt_value FROM ops_orders_items WHERE country     IS NOT NULL GROUP BY country
  UNION ALL
  SELECT 'bifurcation' AS opt_type, bifurcation AS opt_value FROM ops_orders_items WHERE bifurcation IS NOT NULL GROUP BY bifurcation
  ORDER BY opt_type, opt_value;
$$;
