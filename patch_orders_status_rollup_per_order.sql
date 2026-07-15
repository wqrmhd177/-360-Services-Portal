-- Patch: fix status rollup double-counting orders across line-level facet buckets.
-- Run in Supabase SQL Editor, then refresh:
--   SELECT refresh_ops_orders_summaries_simple();

DROP MATERIALIZED VIEW IF EXISTS ops_orders_status_rollup CASCADE;

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

SELECT refresh_ops_orders_summaries_simple();
