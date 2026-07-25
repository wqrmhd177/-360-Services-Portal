-- SKU Performance materialized view + RPCs
-- Run after setup_orders_cache_v2.sql and setup_operations_cache.sql
-- Safe to re-run (drops and recreates MV)

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
  SUM(CASE WHEN p.status = 'Approved' THEN p.qty ELSE 0 END)::INTEGER AS approved_quantity,
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

-- ── SKU summary (paginated) ───────────────────────────────────────────────────
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
  aggregated AS (
    SELECT
      sku,
      MAX(product_title) AS product_title,
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
      END AS weighted_average,
      COUNT(DISTINCT store_id)::INTEGER AS seller_count
    FROM filtered
    GROUP BY sku
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
    aggregated AS (
      SELECT
        sku,
        MAX(product_title) AS product_title,
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
        END AS weighted_average,
        COUNT(DISTINCT store_id)::INTEGER AS seller_count
      FROM filtered
      GROUP BY sku
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

-- ── Seller breakdown for one SKU ──────────────────────────────────────────────
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

  -- CTEs must live in a single statement; a second SELECT cannot reference them.
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

-- ── Extend refresh helper ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION refresh_ops_orders_summaries_simple()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW ops_orders_daily_rollup;
  REFRESH MATERIALIZED VIEW ops_orders_status_rollup;
  REFRESH MATERIALIZED VIEW ops_orders_domain_rollup;
  REFRESH MATERIALIZED VIEW ops_orders_delivery_partner_rollup;
  REFRESH MATERIALIZED VIEW ops_orders_revenue_loss_rollup;
  REFRESH MATERIALIZED VIEW ops_orders_sla_rollup;
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY ops_sku_daily_performance;
  EXCEPTION
    WHEN undefined_table THEN
      NULL;
    WHEN OTHERS THEN
      BEGIN
        REFRESH MATERIALIZED VIEW ops_sku_daily_performance;
      EXCEPTION
        WHEN undefined_table THEN NULL;
      END;
  END;
END;
$$;

-- Initial populate
REFRESH MATERIALIZED VIEW ops_sku_daily_performance;

SELECT get_ops_sku_performance_summary(
  NULL, NULL,
  (CURRENT_DATE AT TIME ZONE 'America/Los_Angeles')::DATE - 30,
  (CURRENT_DATE AT TIME ZONE 'America/Los_Angeles')::DATE,
  NULL, 'approved_quantity', 'desc', 1, 5
) AS sample_summary;
