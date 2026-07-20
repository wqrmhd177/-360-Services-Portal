-- Patch: status KPI counts from distinct order_id with same filters as Total Orders.
-- Run in Supabase SQL Editor after setup_orders_analytics_cache.sql.

CREATE OR REPLACE FUNCTION get_ops_orders_status_counts(
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
  WITH eligible_orders AS (
    SELECT DISTINCT o.order_id
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
  ),
  per_order AS (
    SELECT
      o.order_id,
      COALESCE(NULLIF(TRIM((ARRAY_AGG(o.status ORDER BY o.id))[1]), ''), 'Unknown') AS status
    FROM ops_orders_items o
    INNER JOIN eligible_orders e ON e.order_id = o.order_id
    GROUP BY o.order_id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('status', status, 'order_count', cnt)
      ORDER BY status
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT status, COUNT(*)::INTEGER AS cnt
    FROM per_order
    GROUP BY status
  ) s;
$$;
