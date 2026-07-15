-- ============================================================================
-- ORDERS ANALYTICS CACHE — enriched columns, materialized views, sync jobs
-- Run in Supabase SQL editor AFTER setup_orders_cache_v2.sql
-- ============================================================================

-- ── FX rates (USD conversion at sync time) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS ops_fx_rates (
  currency TEXT PRIMARY KEY,
  rate_to_usd NUMERIC(14, 8) NOT NULL
);

INSERT INTO ops_fx_rates (currency, rate_to_usd) VALUES
  ('USD', 1),
  ('KWD', 3.27),
  ('AED', 0.272294),
  ('SAR', 0.266667),
  ('QAR', 0.274725),
  ('OMR', 2.597403),
  ('BHD', 2.65252),
  ('PKR', 0.00359),
  ('IQD', 0.00076)
ON CONFLICT (currency) DO NOTHING;

-- ── Enriched columns on ops_orders_items ────────────────────────────────────
ALTER TABLE ops_orders_items
  ADD COLUMN IF NOT EXISTS resolved_payable NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS payable_estimated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS usd_revenue NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS account_manager_key TEXT,
  ADD COLUMN IF NOT EXISTS order_date_day DATE;

-- Backfill order_date_day for existing rows
UPDATE ops_orders_items
SET order_date_day = (order_date AT TIME ZONE 'UTC')::DATE
WHERE order_date IS NOT NULL AND order_date_day IS NULL;

UPDATE ops_orders_items
SET account_manager_key = COALESCE(
  NULLIF(TRIM(domain), ''),
  NULLIF(TRIM(store_url), ''),
  CASE WHEN store_id IS NOT NULL THEN 'Store ' || store_id::TEXT END,
  'Unknown'
)
WHERE account_manager_key IS NULL;

UPDATE ops_orders_items
SET resolved_payable = total_payable,
    usd_revenue = total_payable
WHERE resolved_payable IS NULL;

CREATE INDEX IF NOT EXISTS idx_ops_orders_date_day
  ON ops_orders_items(order_date_day);

CREATE INDEX IF NOT EXISTS idx_ops_orders_filter_composite
  ON ops_orders_items(country, bifurcation, store_id, order_date_day);

CREATE INDEX IF NOT EXISTS idx_ops_orders_status_date
  ON ops_orders_items(status, order_date_day);

-- ── Unique key on (order_id, sku) — Metabase `id` + SKU ───────────────────────
-- order_id = Metabase `id` — unique key for all KPI counts and analytics.
-- order_number is seller-facing and may repeat; never used for grouping/counts.

DROP INDEX IF EXISTS idx_ops_orders_order_sku_unique;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ops_orders_items_order_number_sku_key'
  ) THEN
    ALTER TABLE ops_orders_items DROP CONSTRAINT ops_orders_items_order_number_sku_key;
  END IF;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ops_orders_items_order_id_sku_key'
  ) THEN
    ALTER TABLE ops_orders_items DROP CONSTRAINT ops_orders_items_order_id_sku_key;
  END IF;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Keep newest row per Metabase line id + sku
DELETE FROM ops_orders_items a
USING ops_orders_items b
WHERE a.order_id IS NOT NULL
  AND a.sku IS NOT NULL
  AND b.order_id = a.order_id
  AND b.sku = a.sku
  AND b.id > a.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_orders_line_sku_unique
  ON ops_orders_items(order_id, sku)
  WHERE order_id IS NOT NULL AND sku IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ops_orders_items_order_id_sku_key'
  ) THEN
    ALTER TABLE ops_orders_items
      ADD CONSTRAINT ops_orders_items_order_id_sku_key UNIQUE (order_id, sku);
  END IF;
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- ── Background sync jobs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ops_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('inventory', 'channel_list', 'orders')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'success', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  row_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_ops_sync_jobs_source_started
  ON ops_sync_jobs(source, started_at DESC);

-- ── Materialized views ────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS ops_orders_daily_rollup CASCADE;
DROP MATERIALIZED VIEW IF EXISTS ops_orders_status_rollup CASCADE;
DROP MATERIALIZED VIEW IF EXISTS ops_orders_domain_rollup CASCADE;
DROP MATERIALIZED VIEW IF EXISTS ops_orders_delivery_partner_rollup CASCADE;
DROP MATERIALIZED VIEW IF EXISTS ops_orders_revenue_loss_rollup CASCADE;
DROP MATERIALIZED VIEW IF EXISTS ops_orders_sla_rollup CASCADE;

CREATE MATERIALIZED VIEW ops_orders_daily_rollup AS
SELECT
  order_date_day,
  COALESCE(country, 'Unknown') AS country,
  COALESCE(bifurcation, '') AS bifurcation,
  COALESCE(store_id, 0) AS store_id,
  COUNT(DISTINCT order_id)::INTEGER AS order_count,
  COALESCE(SUM(quantity), 0)::INTEGER AS units,
  COALESCE(SUM(COALESCE(usd_revenue, 0)), 0)::NUMERIC(14, 4) AS revenue_usd
FROM ops_orders_items
WHERE order_date_day IS NOT NULL
GROUP BY order_date_day, country, bifurcation, store_id;

CREATE UNIQUE INDEX idx_ops_orders_daily_rollup_unique
  ON ops_orders_daily_rollup(order_date_day, country, bifurcation, store_id);

CREATE MATERIALIZED VIEW ops_orders_status_rollup AS
WITH per_order AS (
  SELECT
    order_id,
    MIN(order_date_day) AS order_date_day,
    COALESCE(NULLIF(TRIM((ARRAY_AGG(country ORDER BY id))[1]), ''), 'Unknown') AS country,
    COALESCE(NULLIF(TRIM((ARRAY_AGG(bifurcation ORDER BY id))[1]), ''), '') AS bifurcation,
    COALESCE((ARRAY_AGG(store_id ORDER BY id))[1], 0) AS store_id,
    COALESCE(NULLIF(TRIM((ARRAY_AGG(status ORDER BY id))[1]), ''), 'Unknown') AS status,
    COALESCE(SUM(quantity), 0)::INTEGER AS units,
    COALESCE(SUM(COALESCE(usd_revenue, 0)), 0)::NUMERIC(14, 4) AS revenue_usd
  FROM ops_orders_items
  WHERE order_id IS NOT NULL AND order_date_day IS NOT NULL
  GROUP BY order_id
)
SELECT
  order_date_day,
  country,
  bifurcation,
  store_id,
  status,
  COUNT(*)::INTEGER AS order_count,
  COALESCE(SUM(units), 0)::INTEGER AS units,
  COALESCE(SUM(revenue_usd), 0)::NUMERIC(14, 4) AS revenue_usd
FROM per_order
GROUP BY order_date_day, country, bifurcation, store_id, status;

CREATE UNIQUE INDEX idx_ops_orders_status_rollup_unique
  ON ops_orders_status_rollup(order_date_day, country, bifurcation, store_id, status);

CREATE MATERIALIZED VIEW ops_orders_domain_rollup AS
SELECT
  order_date_day,
  COALESCE(account_manager_key, 'Unknown') AS account_manager_key,
  COALESCE(country, 'Unknown') AS country,
  COUNT(DISTINCT order_id)::INTEGER AS order_count,
  COALESCE(SUM(quantity), 0)::INTEGER AS units,
  COALESCE(SUM(COALESCE(usd_revenue, 0)), 0)::NUMERIC(14, 4) AS revenue_usd
FROM ops_orders_items
WHERE order_date_day IS NOT NULL
GROUP BY order_date_day, account_manager_key, country;

CREATE UNIQUE INDEX idx_ops_orders_domain_rollup_unique
  ON ops_orders_domain_rollup(order_date_day, account_manager_key, country);

CREATE MATERIALIZED VIEW ops_orders_delivery_partner_rollup AS
WITH per_order AS (
  SELECT
    order_id,
    order_date_day,
    COALESCE(country, 'Unknown') AS country,
    COALESCE(bifurcation, '') AS bifurcation,
    COALESCE(store_id, 0) AS store_id,
    COALESCE(NULLIF(TRIM((ARRAY_AGG(delivery_partner ORDER BY id))[1]), ''), 'Unknown') AS delivery_partner,
    COALESCE(NULLIF(TRIM((ARRAY_AGG(status ORDER BY id))[1]), ''), 'Unknown') AS status,
    SUM(COALESCE(usd_revenue, 0))::NUMERIC(14, 4) AS revenue_usd,
    SUM(COALESCE(quantity, 0))::INTEGER AS units
  FROM ops_orders_items
  WHERE order_id IS NOT NULL AND order_date_day IS NOT NULL
  GROUP BY order_id, order_date_day, country, bifurcation, store_id
)
SELECT
  order_date_day,
  country,
  bifurcation,
  store_id,
  delivery_partner,
  status,
  COUNT(*)::INTEGER AS order_count,
  SUM(revenue_usd) AS revenue_usd,
  SUM(units)::INTEGER AS units
FROM per_order
GROUP BY order_date_day, country, bifurcation, store_id, delivery_partner, status;

CREATE UNIQUE INDEX idx_ops_orders_delivery_partner_rollup_unique
  ON ops_orders_delivery_partner_rollup(order_date_day, country, bifurcation, store_id, delivery_partner, status);

CREATE MATERIALIZED VIEW ops_orders_revenue_loss_rollup AS
WITH per_order AS (
  SELECT
    order_id,
    order_date_day,
    COALESCE(country, 'Unknown') AS country,
    COALESCE(bifurcation, '') AS bifurcation,
    COALESCE(store_id, 0) AS store_id,
    COALESCE(NULLIF(TRIM((ARRAY_AGG(status ORDER BY id))[1]), ''), 'Unknown') AS status,
    COALESCE(NULLIF(TRIM((ARRAY_AGG(tag ORDER BY id))[1]), ''), 'No tag') AS tag,
    SUM(COALESCE(usd_revenue, 0))::NUMERIC(14, 4) AS revenue_usd,
    SUM(COALESCE(quantity, 0))::INTEGER AS units
  FROM ops_orders_items
  WHERE order_id IS NOT NULL AND order_date_day IS NOT NULL
  GROUP BY order_id, order_date_day, country, bifurcation, store_id
)
SELECT
  order_date_day,
  country,
  bifurcation,
  store_id,
  tag,
  CASE
    WHEN status IN ('Cancelled', 'Canceled') THEN 'Pre Dispatch'
    WHEN status IN ('Return', 'Return in Transit') THEN 'Post Dispatch'
  END AS dispatch_label,
  COUNT(*)::INTEGER AS order_count,
  SUM(revenue_usd) AS revenue_usd,
  SUM(units)::INTEGER AS units
FROM per_order
WHERE status IN ('Cancelled', 'Canceled', 'Return', 'Return in Transit')
GROUP BY order_date_day, country, bifurcation, store_id, tag, dispatch_label;

CREATE UNIQUE INDEX idx_ops_orders_revenue_loss_rollup_unique
  ON ops_orders_revenue_loss_rollup(order_date_day, country, bifurcation, store_id, tag, dispatch_label);

CREATE MATERIALIZED VIEW ops_orders_sla_rollup AS
WITH per_order AS (
  SELECT
    order_id,
    order_date_day,
    COALESCE(country, 'Unknown') AS country,
    COALESCE(bifurcation, '') AS bifurcation,
    COALESCE(store_id, 0) AS store_id,
    MIN(order_date) AS order_date,
    MIN(approved_date) AS approved_date,
    MIN(delivered_date) AS delivered_date,
    MIN(returned_date) AS returned_date,
    MIN(shipment_date) AS shipment_date
  FROM ops_orders_items
  WHERE order_id IS NOT NULL AND order_date_day IS NOT NULL
  GROUP BY order_id, order_date_day, country, bifurcation, store_id
),
sla_days AS (
  SELECT
    order_date_day,
    country,
    bifurcation,
    store_id,
    CASE
      WHEN approved_date IS NOT NULL AND order_date IS NOT NULL
      THEN (approved_date::date - order_date::date)
    END AS confirm_days,
    CASE
      WHEN delivered_date IS NOT NULL AND order_date IS NOT NULL
      THEN (delivered_date::date - order_date::date)
    END AS deliver_days,
    CASE
      WHEN returned_date IS NOT NULL AND order_date IS NOT NULL
      THEN (returned_date::date - order_date::date)
    END AS return_days,
    CASE
      WHEN shipment_date IS NOT NULL AND order_date IS NOT NULL
      THEN (shipment_date::date - order_date::date)
    END AS ship_days,
    CASE
      WHEN shipment_date IS NOT NULL AND order_date IS NOT NULL
        AND (shipment_date::date - order_date::date) <= 2
      THEN 1
      ELSE 0
    END AS shipped_within_48h
  FROM per_order
)
SELECT
  order_date_day,
  country,
  bifurcation,
  store_id,
  COALESCE(SUM(confirm_days), 0)::BIGINT AS confirm_days_sum,
  COUNT(confirm_days)::INTEGER AS confirm_count,
  COALESCE(SUM(deliver_days), 0)::BIGINT AS deliver_days_sum,
  COUNT(deliver_days)::INTEGER AS deliver_count,
  COALESCE(SUM(return_days), 0)::BIGINT AS return_days_sum,
  COUNT(return_days)::INTEGER AS return_count,
  COALESCE(SUM(ship_days), 0)::BIGINT AS ship_days_sum,
  COUNT(ship_days)::INTEGER AS ship_count,
  COALESCE(SUM(shipped_within_48h), 0)::INTEGER AS shipped_within_48h_count
FROM sla_days
GROUP BY order_date_day, country, bifurcation, store_id;

CREATE UNIQUE INDEX idx_ops_orders_sla_rollup_unique
  ON ops_orders_sla_rollup(order_date_day, country, bifurcation, store_id);

-- ── Refresh helpers ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION refresh_ops_orders_summaries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY ops_orders_daily_rollup;
  REFRESH MATERIALIZED VIEW CONCURRENTLY ops_orders_status_rollup;
  REFRESH MATERIALIZED VIEW CONCURRENTLY ops_orders_domain_rollup;
  REFRESH MATERIALIZED VIEW CONCURRENTLY ops_orders_delivery_partner_rollup;
  REFRESH MATERIALIZED VIEW CONCURRENTLY ops_orders_revenue_loss_rollup;
  REFRESH MATERIALIZED VIEW CONCURRENTLY ops_orders_sla_rollup;
EXCEPTION
  WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW ops_orders_daily_rollup;
    REFRESH MATERIALIZED VIEW ops_orders_status_rollup;
    REFRESH MATERIALIZED VIEW ops_orders_domain_rollup;
    REFRESH MATERIALIZED VIEW ops_orders_delivery_partner_rollup;
    REFRESH MATERIALIZED VIEW ops_orders_revenue_loss_rollup;
    REFRESH MATERIALIZED VIEW ops_orders_sla_rollup;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_ops_orders_summaries_simple()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  REFRESH MATERIALIZED VIEW ops_orders_daily_rollup;
  REFRESH MATERIALIZED VIEW ops_orders_status_rollup;
  REFRESH MATERIALIZED VIEW ops_orders_domain_rollup;
  REFRESH MATERIALIZED VIEW ops_orders_delivery_partner_rollup;
  REFRESH MATERIALIZED VIEW ops_orders_revenue_loss_rollup;
  REFRESH MATERIALIZED VIEW ops_orders_sla_rollup;
$$;

-- ── Filter options (fast DISTINCT) ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_ops_orders_filter_options_v2()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'countries', COALESCE((
      SELECT jsonb_agg(c.country ORDER BY c.country)
      FROM (
        SELECT DISTINCT country
        FROM ops_orders_items
        WHERE country IS NOT NULL AND TRIM(country) <> ''
      ) c
    ), '[]'::jsonb),
    'bifurcations', COALESCE((
      SELECT jsonb_agg(b.bifurcation ORDER BY b.bifurcation)
      FROM (
        SELECT DISTINCT bifurcation
        FROM ops_orders_items
        WHERE bifurcation IS NOT NULL AND TRIM(bifurcation) <> ''
      ) b
    ), '[]'::jsonb),
    'storeIds', COALESCE((
      SELECT jsonb_agg(s.store_id ORDER BY s.store_id)
      FROM (
        SELECT DISTINCT store_id
        FROM ops_orders_items
        WHERE store_id IS NOT NULL AND store_id > 0
      ) s
    ), '[]'::jsonb)
  );
$$;

-- ── Filtered enriched fetch (replaces full-table load) ────────────────────────
CREATE OR REPLACE FUNCTION get_ops_orders_filtered_enriched(
  p_country     TEXT DEFAULT NULL,
  p_bifurcation TEXT DEFAULT NULL,
  p_store_id    BIGINT DEFAULT NULL,
  p_from_date   DATE DEFAULT NULL,
  p_to_date     DATE DEFAULT NULL
)
RETURNS SETOF ops_orders_items
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT o.*
  FROM ops_orders_items o
  WHERE
    o.order_id IS NOT NULL
    AND (p_store_id IS NULL OR o.store_id = p_store_id)
    AND (p_from_date IS NULL OR o.order_date_day >= p_from_date)
    AND (p_to_date IS NULL OR o.order_date_day <= p_to_date)
    AND (
      (NULLIF(TRIM(p_country), '') IS NOT NULL AND o.country = NULLIF(TRIM(p_country), ''))
      OR (NULLIF(TRIM(p_country), '') IS NULL AND o.country IS NOT NULL AND TRIM(o.country) <> '')
    )
    AND (
      (NULLIF(TRIM(p_bifurcation), '') IS NOT NULL AND o.bifurcation = NULLIF(TRIM(p_bifurcation), ''))
      OR (NULLIF(TRIM(p_bifurcation), '') IS NULL AND o.bifurcation IS NOT NULL AND TRIM(o.bifurcation) <> '')
    )
  ORDER BY o.id;
$$;

-- ── Row counts for empty-state checks ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_ops_orders_counts(
  p_country     TEXT DEFAULT NULL,
  p_bifurcation TEXT DEFAULT NULL,
  p_store_id    BIGINT DEFAULT NULL,
  p_from_date   DATE DEFAULT NULL,
  p_to_date     DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'allCount', (
      SELECT COUNT(DISTINCT order_id)::INTEGER
      FROM ops_orders_items
      WHERE order_id IS NOT NULL
    ),
    'filteredCount', (
      SELECT COUNT(DISTINCT o.order_id)::INTEGER
      FROM ops_orders_items o
      WHERE
        o.order_id IS NOT NULL
        AND (p_store_id IS NULL OR o.store_id = p_store_id)
        AND (p_from_date IS NULL OR o.order_date_day >= p_from_date)
        AND (p_to_date IS NULL OR o.order_date_day <= p_to_date)
        AND (
          (NULLIF(TRIM(p_country), '') IS NOT NULL AND o.country = NULLIF(TRIM(p_country), ''))
          OR (NULLIF(TRIM(p_country), '') IS NULL AND o.country IS NOT NULL AND TRIM(o.country) <> '')
        )
        AND (
          (NULLIF(TRIM(p_bifurcation), '') IS NOT NULL AND o.bifurcation = NULLIF(TRIM(p_bifurcation), ''))
          OR (NULLIF(TRIM(p_bifurcation), '') IS NULL AND o.bifurcation IS NOT NULL AND TRIM(o.bifurcation) <> '')
        )
    )
  );
$$;

-- ── Daily trends from materialized view (fast path) ───────────────────────────
CREATE OR REPLACE FUNCTION get_ops_orders_daily_trends(
  p_country     TEXT DEFAULT NULL,
  p_bifurcation TEXT DEFAULT NULL,
  p_store_id    BIGINT DEFAULT NULL,
  p_from_date   DATE DEFAULT NULL,
  p_to_date     DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date', day_row.order_date_day::TEXT,
      'orders', day_row.orders,
      'revenue', day_row.revenue,
      'units', day_row.units
    ) ORDER BY day_row.order_date_day
  ), '[]'::jsonb)
  FROM (
    SELECT
      r.order_date_day,
      SUM(r.order_count)::INTEGER AS orders,
      SUM(r.revenue_usd) AS revenue,
      SUM(r.units)::INTEGER AS units
    FROM ops_orders_daily_rollup r
    WHERE
      (p_from_date IS NULL OR r.order_date_day >= p_from_date)
      AND (p_to_date IS NULL OR r.order_date_day <= p_to_date)
      AND (p_country IS NULL OR r.country = p_country)
      AND (p_bifurcation IS NULL OR r.bifurcation = p_bifurcation)
      AND (p_store_id IS NULL OR r.store_id = p_store_id)
    GROUP BY r.order_date_day
  ) day_row;
$$;

COMMENT ON MATERIALIZED VIEW ops_orders_daily_rollup IS 'Daily order aggregates — refresh after orders sync';
COMMENT ON MATERIALIZED VIEW ops_orders_status_rollup IS 'Status aggregates by day — refresh after orders sync';
COMMENT ON MATERIALIZED VIEW ops_orders_domain_rollup IS 'Store/domain aggregates — refresh after orders sync';
COMMENT ON MATERIALIZED VIEW ops_orders_delivery_partner_rollup IS 'Delivery partner aggregates — refresh after orders sync';
COMMENT ON MATERIALIZED VIEW ops_orders_revenue_loss_rollup IS 'Revenue loss tag/dispatch aggregates — refresh after orders sync';
COMMENT ON MATERIALIZED VIEW ops_orders_sla_rollup IS 'Fulfillment SLA day/count aggregates — refresh after orders sync';
