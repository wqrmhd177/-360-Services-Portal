-- Patch: add Operations Orders analytics materialized views (run in Supabase SQL Editor).
-- Safe to re-run. Refresh views after applying: SELECT refresh_ops_orders_summaries_simple();

DROP MATERIALIZED VIEW IF EXISTS ops_orders_delivery_partner_rollup CASCADE;
DROP MATERIALIZED VIEW IF EXISTS ops_orders_revenue_loss_rollup CASCADE;
DROP MATERIALIZED VIEW IF EXISTS ops_orders_sla_rollup CASCADE;

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

SELECT refresh_ops_orders_summaries_simple();
