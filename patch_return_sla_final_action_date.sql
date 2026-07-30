-- Add final_action_date_undelivered and fix Avg order → return SLA calculation.
-- Return days = returned_date - final_action_date_undelivered (return request → actual return).
-- Run in Supabase SQL Editor, then: SELECT refresh_ops_orders_summaries_simple();

ALTER TABLE ops_orders_items
  ADD COLUMN IF NOT EXISTS final_action_date_undelivered TIMESTAMPTZ;

COMMENT ON COLUMN ops_orders_items.final_action_date_undelivered IS
  'Metabase Final_action_date_undelivered — when return was requested for undelivered orders.';

DROP MATERIALIZED VIEW IF EXISTS ops_orders_sla_rollup;

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
    MIN(final_action_date_undelivered) AS final_action_date_undelivered,
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
      WHEN returned_date IS NOT NULL
        AND final_action_date_undelivered IS NOT NULL
        AND returned_date::date >= final_action_date_undelivered::date
      THEN (returned_date::date - final_action_date_undelivered::date)
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

SELECT refresh_ops_orders_summaries_simple();
