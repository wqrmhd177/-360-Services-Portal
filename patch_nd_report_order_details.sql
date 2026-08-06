-- ND Report: inventory-aware allocation fix, stuck-order list with approved dates.
-- Run AFTER patch_nd_report_enhancements.sql (step 13).
-- Then: SELECT refresh_ops_orders_summaries_simple();

DROP MATERIALIZED VIEW IF EXISTS ops_nd_sku_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS ops_nd_allocations CASCADE;

CREATE MATERIALIZED VIEW ops_nd_allocations AS
WITH eligible AS (
  SELECT
    o.id AS order_item_id,
    o.order_id,
    o.order_number,
    normalize_ops_country(o.country) AS country,
    COALESCE(NULLIF(TRIM(o.bifurcation), ''), '') AS bifurcation,
    UPPER(TRIM(o.sku)) AS sku,
    COALESCE(NULLIF(TRIM(o.title), ''), o.sku) AS title,
    COALESCE(o.store_id, 0) AS store_id,
    o.approved_date,
    o.order_date,
    o.order_date_day,
    o.quantity::INTEGER AS approved_qty
  FROM ops_orders_items o
  WHERE o.order_id IS NOT NULL
    AND o.quantity > 0
    AND o.sku IS NOT NULL
    AND TRIM(o.sku) <> ''
    AND o.status = 'Approved'
),
inventory_exact AS (
  SELECT
    normalize_ops_country(i.country) AS country,
    COALESCE(NULLIF(TRIM(i.category), ''), '') AS bifurcation,
    UPPER(TRIM(i.sku)) AS sku,
    COALESCE(SUM(i.available_quantity), 0)::NUMERIC AS available_qty
  FROM ops_inventory_items i
  WHERE i.sku IS NOT NULL
    AND TRIM(i.sku) <> ''
  GROUP BY 1, 2, 3
),
inventory_country_sku AS (
  SELECT
    normalize_ops_country(i.country) AS country,
    UPPER(TRIM(i.sku)) AS sku,
    COALESCE(SUM(i.available_quantity), 0)::NUMERIC AS available_qty
  FROM ops_inventory_items i
  WHERE i.sku IS NOT NULL
    AND TRIM(i.sku) <> ''
  GROUP BY 1, 2
),
ranked AS (
  SELECT
    e.*,
    COALESCE(exact.available_qty, pooled.available_qty, 0)::NUMERIC AS available_qty,
    COALESCE(
      SUM(e.approved_qty) OVER (
        PARTITION BY e.country, e.bifurcation, e.sku
        ORDER BY e.approved_date ASC NULLS LAST, e.order_id ASC, e.order_item_id ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ),
      0
    )::NUMERIC AS cumulative_before
  FROM eligible e
  LEFT JOIN inventory_exact exact
    ON exact.country = e.country
    AND exact.bifurcation = e.bifurcation
    AND exact.sku = e.sku
  LEFT JOIN inventory_country_sku pooled
    ON pooled.country = e.country
    AND pooled.sku = e.sku
),
allocated AS (
  SELECT
    country,
    bifurcation,
    sku,
    title,
    order_id,
    order_number,
    store_id,
    order_item_id,
    approved_date,
    order_date,
    order_date_day,
    approved_qty,
    available_qty,
    GREATEST(
      0,
      LEAST(approved_qty, available_qty - cumulative_before)
    )::INTEGER AS allocated_qty,
    (
      approved_qty - GREATEST(
        0,
        LEAST(approved_qty, available_qty - cumulative_before)
      )
    )::INTEGER AS nd_qty
  FROM ranked
)
SELECT * FROM allocated;

CREATE UNIQUE INDEX idx_ops_nd_allocations_unique
  ON ops_nd_allocations (country, bifurcation, sku, order_item_id);

CREATE INDEX idx_ops_nd_allocations_filters
  ON ops_nd_allocations (country, bifurcation, sku, order_date_day);

CREATE INDEX idx_ops_nd_allocations_sku
  ON ops_nd_allocations (country, bifurcation, sku);

COMMENT ON MATERIALIZED VIEW ops_nd_allocations IS
  'ND FIFO per Approved order line — only excess qty (approved minus allocated) appears in report; inventory exact country+bifurcation+sku, else country+sku pool.';

CREATE MATERIALIZED VIEW ops_nd_sku_summary AS
SELECT
  a.country,
  a.bifurcation,
  a.sku,
  MAX(a.title) AS title,
  COUNT(DISTINCT a.order_id) FILTER (WHERE a.nd_qty > 0)::INTEGER AS nd_orders,
  COALESCE(SUM(a.nd_qty) FILTER (WHERE a.nd_qty > 0), 0)::INTEGER AS nd_quantity,
  COUNT(DISTINCT a.store_id) FILTER (WHERE a.nd_qty > 0 AND a.store_id > 0)::INTEGER AS store_count,
  MAX(fr.fulfilment_route) AS fulfilment_route,
  NOW() AS mv_refreshed_at
FROM ops_nd_allocations a
LEFT JOIN ops_inventory_fulfilment_routes fr
  ON fr.sku = a.sku
GROUP BY a.country, a.bifurcation, a.sku
HAVING COALESCE(SUM(a.nd_qty), 0) > 0;

CREATE UNIQUE INDEX idx_ops_nd_sku_summary_unique
  ON ops_nd_sku_summary (country, bifurcation, sku);

CREATE INDEX idx_ops_nd_sku_summary_sort
  ON ops_nd_sku_summary (country, bifurcation, nd_quantity DESC);

-- Stuck orders for one SKU (nd_qty > 0 lines only), sorted by approved date ascending.
CREATE OR REPLACE FUNCTION get_ops_nd_stuck_orders(
  p_country     TEXT,
  p_bifurcation TEXT,
  p_sku         TEXT,
  p_from_date   DATE DEFAULT NULL,
  p_to_date     DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      normalize_ops_country(p_country) AS country,
      COALESCE(NULLIF(TRIM(p_bifurcation), ''), '') AS bifurcation,
      UPPER(TRIM(p_sku)) AS sku
  ),
  channel_by_store AS (
    SELECT DISTINCT ON (store_id)
      store_id,
      store_name
    FROM ops_channel_list_items
    WHERE store_id IS NOT NULL
    ORDER BY store_id, synced_at DESC NULLS LAST, id DESC
  ),
  filtered AS (
    SELECT a.*
    FROM ops_nd_allocations a
    CROSS JOIN params p
    WHERE a.country = p.country
      AND a.bifurcation = p.bifurcation
      AND a.sku = p.sku
      AND a.nd_qty > 0
      AND (p_from_date IS NULL OR a.order_date_day >= p_from_date)
      AND (p_to_date IS NULL OR a.order_date_day <= p_to_date)
  ),
  order_rows AS (
    SELECT
      f.order_id,
      MAX(f.order_number) AS order_number,
      MIN(f.approved_date) AS approved_date,
      MAX(f.sku) AS sku,
      COALESCE(SUM(f.nd_qty), 0)::INTEGER AS nd_quantity,
      f.store_id,
      MAX(cl.store_name) AS store_name
    FROM filtered f
    LEFT JOIN channel_by_store cl ON cl.store_id = f.store_id
    GROUP BY f.order_id, f.store_id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'order_id', order_id,
        'order_number', order_number,
        'approved_date', approved_date,
        'sku', sku,
        'nd_quantity', nd_quantity,
        'store_id', store_id,
        'store_name', store_name
      )
      ORDER BY approved_date ASC NULLS LAST, order_id ASC
    ),
    '[]'::JSONB
  )
  FROM order_rows;
$$;

COMMENT ON FUNCTION get_ops_nd_stuck_orders IS
  'ND SKU drill-down: order IDs with ND quantity and approved date (ascending), nd_qty > 0 lines only.';

-- Fix summary RPC if setup_nd_report.sql was re-run after patch_nd_report_enhancements (remarks_text mismatch).
CREATE OR REPLACE FUNCTION get_ops_nd_summary(
  p_country       TEXT DEFAULT NULL,
  p_bifurcation   TEXT DEFAULT NULL,
  p_from_date     DATE DEFAULT NULL,
  p_to_date       DATE DEFAULT NULL,
  p_search        TEXT DEFAULT NULL,
  p_sort_by       TEXT DEFAULT 'nd_quantity',
  p_sort_dir      TEXT DEFAULT 'desc',
  p_page          INTEGER DEFAULT 1,
  p_page_size     INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset INTEGER;
  v_total BIGINT;
  v_mv_refreshed TIMESTAMPTZ;
  v_search TEXT;
  v_sort_col TEXT;
  v_sort_dir TEXT;
  v_country TEXT;
  v_bifurcation TEXT;
  v_result JSONB;
  v_totals JSONB;
BEGIN
  v_offset := GREATEST(0, (GREATEST(1, COALESCE(p_page, 1)) - 1)
    * GREATEST(1, LEAST(100, COALESCE(p_page_size, 20))));
  v_search := NULLIF(TRIM(COALESCE(p_search, '')), '');
  v_sort_dir := CASE WHEN LOWER(COALESCE(p_sort_dir, 'desc')) = 'asc' THEN 'ASC' ELSE 'DESC' END;
  v_country := NULLIF(TRIM(COALESCE(p_country, '')), '');
  v_bifurcation := COALESCE(NULLIF(TRIM(COALESCE(p_bifurcation, '')), ''), NULL);

  v_sort_col := CASE LOWER(COALESCE(p_sort_by, 'nd_quantity'))
    WHEN 'title' THEN 'title'
    WHEN 'sku' THEN 'sku'
    WHEN 'nd_orders' THEN 'nd_orders'
    WHEN 'store_count' THEN 'store_count'
    WHEN 'suggestion_count' THEN 'suggestion_count'
    WHEN 'fulfilment_route' THEN 'fulfilment_route'
    ELSE 'nd_quantity'
  END;

  SELECT MAX(mv_refreshed_at) INTO v_mv_refreshed FROM ops_nd_sku_summary;

  WITH filtered_alloc AS (
    SELECT a.*
    FROM ops_nd_allocations a
    WHERE a.nd_qty > 0
      AND (p_from_date IS NULL OR a.order_date_day >= p_from_date)
      AND (p_to_date IS NULL OR a.order_date_day <= p_to_date)
      AND (
        v_country IS NULL
        OR ops_country_matches(v_country, a.country)
      )
      AND (
        v_bifurcation IS NULL
        OR a.bifurcation = v_bifurcation
      )
  ),
  filtered_summary AS (
    SELECT
      s.country,
      s.bifurcation,
      s.sku,
      MAX(s.title) AS title,
      COUNT(DISTINCT fa.order_id)::INTEGER AS nd_orders,
      COALESCE(SUM(fa.nd_qty), 0)::INTEGER AS nd_quantity,
      COUNT(DISTINCT fa.store_id) FILTER (WHERE fa.store_id > 0)::INTEGER AS store_count,
      s.fulfilment_route
    FROM ops_nd_sku_summary s
    INNER JOIN filtered_alloc fa
      ON fa.country = s.country
      AND fa.bifurcation = s.bifurcation
      AND fa.sku = s.sku
    WHERE (
        v_search IS NULL
        OR s.sku ILIKE '%' || v_search || '%'
        OR s.title ILIKE '%' || v_search || '%'
      )
    GROUP BY s.country, s.bifurcation, s.sku, s.fulfilment_route
  ),
  with_suggestions AS (
    SELECT
      fs.*,
      COALESCE(jsonb_array_length(get_ops_nd_movement_suggestions(fs.country, fs.bifurcation, fs.sku)), 0)::INTEGER AS suggestion_count
    FROM filtered_summary fs
  ),
  totals AS (
    SELECT
      (SELECT COUNT(*)::INTEGER FROM filtered_summary) AS nd_skus,
      (SELECT COUNT(DISTINCT fa.order_id)::INTEGER FROM filtered_alloc fa) AS nd_orders,
      (SELECT COALESCE(SUM(fa.nd_qty), 0)::INTEGER FROM filtered_alloc fa) AS nd_quantity,
      (SELECT COUNT(DISTINCT fa.store_id)::INTEGER FROM filtered_alloc fa WHERE fa.store_id > 0) AS affected_stores
  )
  SELECT
    jsonb_build_object(
      'nd_skus', nd_skus,
      'nd_orders', nd_orders,
      'nd_quantity', nd_quantity,
      'affected_stores', affected_stores
    )
  INTO v_totals
  FROM totals;

  SELECT COUNT(*)::BIGINT INTO v_total FROM (
    SELECT 1 FROM ops_nd_sku_summary s
    WHERE EXISTS (
      SELECT 1 FROM ops_nd_allocations a
      WHERE a.country = s.country
        AND a.bifurcation = s.bifurcation
        AND a.sku = s.sku
        AND a.nd_qty > 0
        AND (p_from_date IS NULL OR a.order_date_day >= p_from_date)
        AND (p_to_date IS NULL OR a.order_date_day <= p_to_date)
        AND (v_country IS NULL OR ops_country_matches(v_country, a.country))
        AND (v_bifurcation IS NULL OR a.bifurcation = v_bifurcation)
    )
    AND (
      v_search IS NULL
      OR s.sku ILIKE '%' || v_search || '%'
      OR s.title ILIKE '%' || v_search || '%'
    )
  ) counted;

  EXECUTE format(
    $sql$
    WITH filtered_alloc AS (
      SELECT a.*
      FROM ops_nd_allocations a
      WHERE a.nd_qty > 0
        AND ($1 IS NULL OR a.order_date_day >= $1)
        AND ($2 IS NULL OR a.order_date_day <= $2)
        AND ($3 IS NULL OR ops_country_matches($3, a.country))
        AND ($4 IS NULL OR a.bifurcation = $4)
    ),
    filtered_summary AS (
      SELECT
        s.country,
        s.bifurcation,
        s.sku,
        MAX(s.title) AS title,
        COUNT(DISTINCT fa.order_id)::INTEGER AS nd_orders,
        COALESCE(SUM(fa.nd_qty), 0)::INTEGER AS nd_quantity,
        COUNT(DISTINCT fa.store_id) FILTER (WHERE fa.store_id > 0)::INTEGER AS store_count,
        s.fulfilment_route
      FROM ops_nd_sku_summary s
      INNER JOIN filtered_alloc fa
        ON fa.country = s.country
        AND fa.bifurcation = s.bifurcation
        AND fa.sku = s.sku
      WHERE (
          $5 IS NULL
          OR s.sku ILIKE '%%' || $5 || '%%'
          OR s.title ILIKE '%%' || $5 || '%%'
        )
      GROUP BY s.country, s.bifurcation, s.sku, s.fulfilment_route
    ),
    with_suggestions AS (
      SELECT
        fs.*,
        COALESCE(jsonb_array_length(get_ops_nd_movement_suggestions(fs.country, fs.bifurcation, fs.sku)), 0)::INTEGER AS suggestion_count
      FROM filtered_summary fs
    )
    SELECT COALESCE(jsonb_agg(row_to_json(t)::JSONB), '[]'::JSONB)
    FROM (
      SELECT * FROM with_suggestions
      ORDER BY %I %s NULLS LAST
      LIMIT $6 OFFSET $7
    ) t
    $sql$,
    v_sort_col, v_sort_dir, v_sort_col, v_sort_dir
  )
  INTO v_result
  USING p_from_date, p_to_date, v_country, v_bifurcation, v_search,
        GREATEST(1, LEAST(100, COALESCE(p_page_size, 20))), v_offset;

  RETURN jsonb_build_object(
    'data', COALESCE(v_result, '[]'::JSONB),
    'totals', COALESCE(v_totals, jsonb_build_object(
      'nd_skus', 0, 'nd_orders', 0, 'nd_quantity', 0, 'affected_stores', 0
    )),
    'total_records', COALESCE(v_total, 0),
    'mv_refreshed_at', v_mv_refreshed
  );
END;
$$;
