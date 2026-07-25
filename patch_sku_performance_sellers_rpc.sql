-- Fix: get_ops_sku_performance_sellers CTE scope (relation "aggregated" does not exist)
-- Run in Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_ops_sku_performance_sellers(
  p_sku TEXT,
  p_country TEXT DEFAULT NULL,
  p_bifurcation TEXT DEFAULT NULL,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_sku TEXT;
  v_offset INTEGER;
  v_total BIGINT;
  v_result JSONB;
BEGIN
  v_sku := UPPER(TRIM(COALESCE(p_sku, '')));
  IF v_sku = '' THEN
    RETURN jsonb_build_object('data', '[]'::JSONB, 'total_records', 0);
  END IF;

  v_offset := GREATEST(0, (GREATEST(1, COALESCE(p_page, 1)) - 1) * GREATEST(1, LEAST(100, COALESCE(p_page_size, 50))));

  WITH filtered AS (
    SELECT *
    FROM ops_sku_daily_performance mv
    WHERE mv.sku = v_sku
      AND (p_from_date IS NULL OR mv.order_date_day_pst >= p_from_date)
      AND (p_to_date IS NULL OR mv.order_date_day_pst <= p_to_date)
      AND (p_country IS NULL OR mv.country = p_country)
      AND (
        p_bifurcation IS NULL
        OR (p_bifurcation = '' AND mv.bifurcation = '')
        OR mv.bifurcation = p_bifurcation
      )
  ),
  aggregated AS (
    SELECT
      user_id,
      store_id,
      MAX(store_name) AS store_name,
      SUM(approved_quantity)::INTEGER AS approved_quantity,
      SUM(dispatched_quantity)::INTEGER AS dispatched_quantity,
      SUM(delivered_quantity)::INTEGER AS delivered_quantity,
      CASE
        WHEN SUM(dispatched_quantity) = 0 THEN NULL
        ELSE ROUND(
          SUM(delivered_quantity)::NUMERIC / SUM(dispatched_quantity)::NUMERIC * 100,
          2
        )
      END AS dispatch_to_delivery_pct,
      CASE
        WHEN COUNT(*) FILTER (WHERE dispatched_quantity > 0) = 0 THEN NULL
        ELSE ROUND(
          SUM(dispatched_quantity)::NUMERIC
            / COUNT(*) FILTER (WHERE dispatched_quantity > 0)::NUMERIC,
          1
        )
      END AS weighted_average
    FROM filtered
    GROUP BY user_id, store_id
  )
  SELECT
    (SELECT COUNT(*)::BIGINT FROM aggregated),
    COALESCE((
      SELECT jsonb_agg(row_to_json(t)::JSONB)
      FROM (
        SELECT *
        FROM aggregated
        ORDER BY approved_quantity DESC NULLS LAST
        LIMIT GREATEST(1, LEAST(100, COALESCE(p_page_size, 50)))
        OFFSET v_offset
      ) t
    ), '[]'::JSONB)
  INTO v_total, v_result;

  RETURN jsonb_build_object(
    'data', COALESCE(v_result, '[]'::JSONB),
    'total_records', COALESCE(v_total, 0)
  );
END;
$$;
