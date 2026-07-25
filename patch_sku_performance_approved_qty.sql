-- Fix Approved Quantity: count all orders past confirmation (not snapshot of status='Approved' only)
-- Run in Supabase SQL Editor, then refresh the MV.

DROP MATERIALIZED VIEW IF EXISTS ops_sku_daily_performance CASCADE;

CREATE MATERIALIZED VIEW ops_sku_daily_performance AS
WITH latest_titles AS (
  SELECT DISTINCT ON (UPPER(TRIM(sku)))
    UPPER(TRIM(sku)) AS sku_norm,
    title AS product_title
  FROM ops_orders_items
  WHERE sku IS NOT NULL
    AND TRIM(sku) <> ''
    AND title IS NOT NULL
    AND TRIM(title) <> ''
  ORDER BY UPPER(TRIM(sku)), id DESC
),
channel_by_store AS (
  SELECT DISTINCT ON (store_id)
    store_id,
    user_id,
    store_name
  FROM ops_channel_list_items
  WHERE store_id IS NOT NULL
  ORDER BY store_id, synced_at DESC NULLS LAST, id DESC
),
per_order_sku AS (
  SELECT
    order_id,
    UPPER(TRIM(sku)) AS sku_norm,
    (order_date AT TIME ZONE 'America/Los_Angeles')::DATE AS order_date_day_pst,
    COALESCE(NULLIF(TRIM(country), ''), 'Unknown') AS country,
    COALESCE(NULLIF(TRIM(bifurcation), ''), '') AS bifurcation,
    COALESCE(store_id, 0) AS store_id,
    COALESCE(NULLIF(TRIM(status), ''), 'Unknown') AS status,
    COALESCE(SUM(quantity), 0) AS qty,
    MAX(synced_at) AS synced_at
  FROM ops_orders_items
  WHERE order_date IS NOT NULL
    AND sku IS NOT NULL
    AND TRIM(sku) <> ''
  GROUP BY
    order_id,
    UPPER(TRIM(sku)),
    (order_date AT TIME ZONE 'America/Los_Angeles')::DATE,
    country,
    bifurcation,
    store_id,
    status
)
SELECT
  p.order_date_day_pst,
  p.country,
  p.bifurcation,
  p.sku_norm AS sku,
  COALESCE(lt.product_title, p.sku_norm) AS product_title,
  p.store_id,
  cl.user_id,
  cl.store_name,
  SUM(
    CASE
      WHEN p.status NOT IN ('Confirmation Pending', 'Cancelled', 'Canceled')
      THEN p.qty
      ELSE 0
    END
  )::INTEGER AS approved_quantity,
  SUM(
    CASE
      WHEN p.status IN ('Shipped', 'Delivered', 'Undelivered', 'Return', 'Return in Transit')
      THEN p.qty
      ELSE 0
    END
  )::INTEGER AS dispatched_quantity,
  SUM(CASE WHEN p.status = 'Delivered' THEN p.qty ELSE 0 END)::INTEGER AS delivered_quantity,
  MAX(p.synced_at) AS source_last_updated_at,
  NOW() AS mv_refreshed_at
FROM per_order_sku p
LEFT JOIN latest_titles lt ON lt.sku_norm = p.sku_norm
LEFT JOIN channel_by_store cl ON cl.store_id = p.store_id
GROUP BY
  p.order_date_day_pst,
  p.country,
  p.bifurcation,
  p.sku_norm,
  lt.product_title,
  p.store_id,
  cl.user_id,
  cl.store_name;

CREATE UNIQUE INDEX idx_ops_sku_daily_perf_unique
  ON ops_sku_daily_performance (order_date_day_pst, country, bifurcation, sku, store_id);

CREATE INDEX idx_ops_sku_daily_perf_date ON ops_sku_daily_performance (order_date_day_pst);
CREATE INDEX idx_ops_sku_daily_perf_sku ON ops_sku_daily_performance (sku);
CREATE INDEX idx_ops_sku_daily_perf_store ON ops_sku_daily_performance (store_id);

REFRESH MATERIALIZED VIEW ops_sku_daily_performance;
