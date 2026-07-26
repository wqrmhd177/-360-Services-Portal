-- Fix SKU-level Wtd. Avg: average daily dispatched units per calendar day (exclude zero-dispatch days)
-- Run in Supabase SQL Editor ONLY — no MV drop/refresh required.
-- Seller expand rows are unchanged (already per-store daily average).

CREATE OR REPLACE FUNCTION get_ops_sku_performance_summary(
  p_country TEXT DEFAULT NULL,
  p_bifurcation TEXT DEFAULT NULL,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'approved_quantity',
  p_sort_direction TEXT DEFAULT 'desc',
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_offset INTEGER;
  v_total BIGINT;
  v_mv_refreshed TIMESTAMPTZ;
  v_search TEXT;
  v_sort_col TEXT;
  v_sort_dir TEXT;
  v_result JSONB;
BEGIN
  v_offset := GREATEST(0, (GREATEST(1, COALESCE(p_page, 1)) - 1) * GREATEST(1, LEAST(100, COALESCE(p_page_size, 20))));
  v_search := NULLIF(TRIM(COALESCE(p_search, '')), '');
  v_sort_dir := CASE WHEN LOWER(COALESCE(p_sort_direction, 'desc')) = 'asc' THEN 'ASC' ELSE 'DESC' END;
  v_sort_col := CASE LOWER(COALESCE(p_sort_by, 'approved_quantity'))
    WHEN 'product_title' THEN 'product_title'
    WHEN 'sku' THEN 'sku'
    WHEN 'dispatched_to_delivered_pct' THEN 'dispatch_to_delivery_pct'
    WHEN 'weighted_average' THEN 'weighted_average'
    ELSE 'approved_quantity'
  END;

  SELECT MAX(mv_refreshed_at) INTO v_mv_refreshed FROM ops_sku_daily_performance;

  WITH filtered AS (
    SELECT *
    FROM ops_sku_daily_performance mv
    WHERE (p_from_date IS NULL OR mv.order_date_day_pst >= p_from_date)
      AND (p_to_date IS NULL OR mv.order_date_day_pst <= p_to_date)
      AND (p_country IS NULL OR mv.country = p_country)
      AND (
        p_bifurcation IS NULL
        OR (p_bifurcation = '' AND mv.bifurcation = '')
        OR mv.bifurcation = p_bifurcation
      )
      AND (
        v_search IS NULL
        OR mv.sku ILIKE '%' || v_search || '%'
        OR mv.product_title ILIKE '%' || v_search || '%'
      )
  ),
  daily_by_sku AS (
    SELECT
      sku,
      order_date_day_pst,
      SUM(dispatched_quantity) AS day_dispatched
    FROM filtered
    GROUP BY sku, order_date_day_pst
  ),
  wa_by_sku AS (
    SELECT
      sku,
      CASE
        WHEN COUNT(*) FILTER (WHERE day_dispatched > 0) = 0 THEN NULL
        ELSE ROUND(
          SUM(day_dispatched)::NUMERIC
            / COUNT(*) FILTER (WHERE day_dispatched > 0)::NUMERIC,
          1
        )
      END AS weighted_average
    FROM daily_by_sku
    GROUP BY sku
  ),
  aggregated AS (
    SELECT
      f.sku,
      MAX(f.product_title) AS product_title,
      SUM(f.approved_quantity)::INTEGER AS approved_quantity,
      SUM(f.dispatched_quantity)::INTEGER AS dispatched_quantity,
      SUM(f.delivered_quantity)::INTEGER AS delivered_quantity,
      CASE
        WHEN SUM(f.dispatched_quantity) = 0 THEN NULL
        ELSE ROUND(
          SUM(f.delivered_quantity)::NUMERIC / SUM(f.dispatched_quantity)::NUMERIC * 100,
          2
        )
      END AS dispatch_to_delivery_pct,
      w.weighted_average,
      COUNT(DISTINCT f.store_id)::INTEGER AS seller_count
    FROM filtered f
    LEFT JOIN wa_by_sku w ON w.sku = f.sku
    GROUP BY f.sku, w.weighted_average
  ),
  counted AS (
    SELECT COUNT(*)::BIGINT AS total FROM aggregated
  )
  SELECT total INTO v_total FROM counted;

  EXECUTE format(
    $sql$
    WITH filtered AS (
      SELECT *
      FROM ops_sku_daily_performance mv
      WHERE ($1 IS NULL OR mv.order_date_day_pst >= $1)
        AND ($2 IS NULL OR mv.order_date_day_pst <= $2)
        AND ($3 IS NULL OR mv.country = $3)
        AND (
          $4 IS NULL
          OR ($4 = '' AND mv.bifurcation = '')
          OR mv.bifurcation = $4
        )
        AND (
          $5 IS NULL
          OR mv.sku ILIKE '%%' || $5 || '%%'
          OR mv.product_title ILIKE '%%' || $5 || '%%'
        )
    ),
    daily_by_sku AS (
      SELECT
        sku,
        order_date_day_pst,
        SUM(dispatched_quantity) AS day_dispatched
      FROM filtered
      GROUP BY sku, order_date_day_pst
    ),
    wa_by_sku AS (
      SELECT
        sku,
        CASE
          WHEN COUNT(*) FILTER (WHERE day_dispatched > 0) = 0 THEN NULL
          ELSE ROUND(
            SUM(day_dispatched)::NUMERIC
              / COUNT(*) FILTER (WHERE day_dispatched > 0)::NUMERIC,
            1
          )
        END AS weighted_average
      FROM daily_by_sku
      GROUP BY sku
    ),
    aggregated AS (
      SELECT
        f.sku,
        MAX(f.product_title) AS product_title,
        SUM(f.approved_quantity)::INTEGER AS approved_quantity,
        SUM(f.dispatched_quantity)::INTEGER AS dispatched_quantity,
        SUM(f.delivered_quantity)::INTEGER AS delivered_quantity,
        CASE
          WHEN SUM(f.dispatched_quantity) = 0 THEN NULL
          ELSE ROUND(
            SUM(f.delivered_quantity)::NUMERIC / SUM(f.dispatched_quantity)::NUMERIC * 100,
            2
          )
        END AS dispatch_to_delivery_pct,
        w.weighted_average,
        COUNT(DISTINCT f.store_id)::INTEGER AS seller_count
      FROM filtered f
      LEFT JOIN wa_by_sku w ON w.sku = f.sku
      GROUP BY f.sku, w.weighted_average
    )
    SELECT COALESCE(jsonb_agg(row_to_json(t)::JSONB), '[]'::JSONB)
    FROM (
      SELECT *
      FROM aggregated
      ORDER BY %I %s NULLS LAST
      LIMIT $6 OFFSET $7
    ) t
    $sql$,
    v_sort_col,
    v_sort_dir
  )
  INTO v_result
  USING p_from_date, p_to_date, p_country, p_bifurcation, v_search,
        GREATEST(1, LEAST(100, COALESCE(p_page_size, 20))), v_offset;

  RETURN jsonb_build_object(
    'data', COALESCE(v_result, '[]'::JSONB),
    'total_records', COALESCE(v_total, 0),
    'mv_refreshed_at', v_mv_refreshed
  );
END;
$$;
