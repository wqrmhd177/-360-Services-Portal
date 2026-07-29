-- Performance: use status MV, drop expensive allCount, add indexes.
-- Run in Supabase SQL Editor after setup_orders_analytics_cache.sql.

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
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('status', status, 'order_count', cnt)
      ORDER BY status
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT r.status, SUM(r.order_count)::INTEGER AS cnt
    FROM ops_orders_status_rollup r
    WHERE
      (p_from_date IS NULL OR r.order_date_day >= p_from_date)
      AND (p_to_date IS NULL OR r.order_date_day <= p_to_date)
      AND (p_store_id IS NULL OR r.store_id = p_store_id)
      AND (
        (NULLIF(TRIM(p_country), '') IS NOT NULL AND r.country = NULLIF(TRIM(p_country), ''))
        OR (
          NULLIF(TRIM(p_country), '') IS NULL
          AND r.country IS NOT NULL
          AND TRIM(r.country) <> ''
          AND r.country <> 'Unknown'
        )
      )
      AND (
        (NULLIF(TRIM(p_bifurcation), '') IS NOT NULL AND r.bifurcation = NULLIF(TRIM(p_bifurcation), ''))
        OR (
          NULLIF(TRIM(p_bifurcation), '') IS NULL
          AND r.bifurcation IS NOT NULL
          AND TRIM(r.bifurcation) <> ''
        )
      )
    GROUP BY r.status
  ) s;
$$;

CREATE INDEX IF NOT EXISTS idx_ops_inv_sku_normalized
  ON ops_inventory_items (normalize_ops_sku_match(sku));

CREATE INDEX IF NOT EXISTS idx_ops_sku_daily_perf_date_country_bif
  ON ops_sku_daily_performance (order_date_day_pst, country, bifurcation);
