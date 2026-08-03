-- ND Report: FIFO allocation MVs, remarks table, and RPCs.
-- Requires: setup_orders_cache_v2.sql, setup_operations_cache.sql,
--           patch_country_normalization.sql (normalize_ops_country).
-- Run setup_nd_report.sql then: SELECT refresh_ops_orders_summaries_simple();

-- ── Remarks (persistent, not in MV) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ops_nd_remarks (
  country      TEXT        NOT NULL,
  bifurcation  TEXT        NOT NULL,
  sku          TEXT        NOT NULL,
  remarks_text TEXT,
  updated_by   TEXT        NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (country, bifurcation, sku)
);

COMMENT ON TABLE ops_nd_remarks IS
  'Admin remarks for ND SKUs — keyed by country + bifurcation + sku; survives SKU leaving ND.';

-- ── MV 1: per order-line FIFO allocation ──────────────────────────────────────

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
    AND (
      o.status = 'Approved'
      OR (
        o.status = 'Dispatching in Process'
        AND (o.courier_tracking_id IS NULL OR TRIM(o.courier_tracking_id) = '')
      )
    )
),
inventory_by_key AS (
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
ranked AS (
  SELECT
    e.*,
    COALESCE(inv.available_qty, 0) AS available_qty,
    COALESCE(
      SUM(e.approved_qty) OVER (
        PARTITION BY e.country, e.bifurcation, e.sku
        ORDER BY e.approved_date ASC NULLS LAST, e.order_id ASC, e.order_item_id ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ),
      0
    )::NUMERIC AS cumulative_before
  FROM eligible e
  LEFT JOIN inventory_by_key inv
    ON inv.country = e.country
    AND inv.bifurcation = e.bifurcation
    AND inv.sku = e.sku
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
  'ND FIFO allocation per order line — approved/non-dispatched demand vs inventory by country+bifurcation+sku.';

-- ── MV 2: SKU summary (only rows with ND quantity) ───────────────────────────

CREATE MATERIALIZED VIEW ops_nd_sku_summary AS
SELECT
  country,
  bifurcation,
  sku,
  MAX(title) AS title,
  COUNT(DISTINCT order_id) FILTER (WHERE nd_qty > 0)::INTEGER AS nd_orders,
  COALESCE(SUM(nd_qty) FILTER (WHERE nd_qty > 0), 0)::INTEGER AS nd_quantity,
  COUNT(DISTINCT store_id) FILTER (WHERE nd_qty > 0 AND store_id > 0)::INTEGER AS store_count,
  NULL::TEXT AS fulfilment_route,
  NOW() AS mv_refreshed_at
FROM ops_nd_allocations
GROUP BY country, bifurcation, sku
HAVING COALESCE(SUM(nd_qty), 0) > 0;

CREATE UNIQUE INDEX idx_ops_nd_sku_summary_unique
  ON ops_nd_sku_summary (country, bifurcation, sku);

CREATE INDEX idx_ops_nd_sku_summary_sort
  ON ops_nd_sku_summary (country, bifurcation, nd_quantity DESC);

COMMENT ON MATERIALIZED VIEW ops_nd_sku_summary IS
  'ND SKU rollup — one row per country+bifurcation+sku with nd_qty > 0.';

-- ── Helper: movement suggestions for one target SKU ───────────────────────────

CREATE OR REPLACE FUNCTION get_ops_nd_movement_suggestions(
  p_country     TEXT,
  p_bifurcation TEXT,
  p_sku         TEXT
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
      UPPER(TRIM(p_sku)) AS target_sku,
      split_part(UPPER(TRIM(p_sku)), '-', 1) AS sku_family
  ),
  target_nd AS (
    SELECT COALESCE(SUM(a.nd_qty), 0)::INTEGER AS nd_qty
    FROM ops_nd_allocations a
    CROSS JOIN params p
    WHERE a.country = p.country
      AND a.bifurcation = p.bifurcation
      AND a.sku = p.target_sku
      AND a.nd_qty > 0
  ),
  inventory_by_key AS (
    SELECT
      normalize_ops_country(i.country) AS country,
      COALESCE(NULLIF(TRIM(i.category), ''), '') AS bifurcation,
      UPPER(TRIM(i.sku)) AS sku,
      COALESCE(SUM(i.available_quantity), 0)::NUMERIC AS available_qty
    FROM ops_inventory_items i
    WHERE i.sku IS NOT NULL AND TRIM(i.sku) <> ''
    GROUP BY 1, 2, 3
  ),
  demand_by_sku AS (
    SELECT
      a.country,
      a.bifurcation,
      a.sku,
      SUM(a.approved_qty)::NUMERIC AS total_demand
    FROM ops_nd_allocations a
    CROSS JOIN params p
    WHERE a.country = p.country
      AND a.bifurcation = p.bifurcation
    GROUP BY a.country, a.bifurcation, a.sku
  ),
  related_sources AS (
    SELECT DISTINCT a.sku AS source_sku
    FROM ops_nd_allocations a
    CROSS JOIN params p
    WHERE a.country = p.country
      AND a.bifurcation = p.bifurcation
      AND split_part(a.sku, '-', 1) = p.sku_family
      AND a.sku <> p.target_sku
  ),
  surplus AS (
    SELECT
      rs.source_sku,
      GREATEST(
        0,
        COALESCE(inv.available_qty, 0) - COALESCE(d.total_demand, 0)
      )::INTEGER AS surplus_qty
    FROM related_sources rs
    CROSS JOIN params p
    LEFT JOIN inventory_by_key inv
      ON inv.country = p.country
      AND inv.bifurcation = p.bifurcation
      AND inv.sku = rs.source_sku
    LEFT JOIN demand_by_sku d
      ON d.country = p.country
      AND d.bifurcation = p.bifurcation
      AND d.sku = rs.source_sku
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'source_sku', s.source_sku,
        'surplus_qty', s.surplus_qty,
        'suggested_qty', LEAST(t.nd_qty, s.surplus_qty)
      )
      ORDER BY LEAST(t.nd_qty, s.surplus_qty) DESC, s.source_sku
    ),
    '[]'::JSONB
  )
  FROM surplus s
  CROSS JOIN target_nd t
  WHERE s.surplus_qty > 0
    AND t.nd_qty > 0
    AND LEAST(t.nd_qty, s.surplus_qty) > 0;
$$;

-- ── ND summary (paginated list + totals) ────────────────────────────────────

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
  with_remarks AS (
    SELECT
      ws.*,
      r.remarks_text,
      r.updated_by AS remark_updated_by,
      r.updated_at AS remark_updated_at
    FROM with_suggestions ws
    LEFT JOIN ops_nd_remarks r
      ON r.country = ws.country
      AND r.bifurcation = ws.bifurcation
      AND r.sku = ws.sku
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
    ),
    with_remarks AS (
      SELECT
        ws.*,
        r.remarks_text,
        r.updated_by AS remark_updated_by,
        r.updated_at AS remark_updated_at
      FROM with_suggestions ws
      LEFT JOIN ops_nd_remarks r
        ON r.country = ws.country
        AND r.bifurcation = ws.bifurcation
        AND r.sku = ws.sku
    )
    SELECT COALESCE(jsonb_agg(row_to_json(t)::JSONB), '[]'::JSONB)
    FROM (
      SELECT * FROM with_remarks
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

-- ── Store-level details for one SKU ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_ops_nd_sku_details(
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
      user_id,
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
  store_rows AS (
    SELECT
      f.store_id,
      cl.user_id,
      cl.store_name,
      COUNT(DISTINCT f.order_id)::INTEGER AS nd_orders,
      COALESCE(SUM(f.nd_qty), 0)::INTEGER AS nd_quantity
    FROM filtered f
    LEFT JOIN channel_by_store cl ON cl.store_id = f.store_id
    GROUP BY f.store_id, cl.user_id, cl.store_name
    ORDER BY nd_quantity DESC, f.store_id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'store_id', store_id,
        'user_id', user_id,
        'store_name', store_name,
        'nd_orders', nd_orders,
        'nd_quantity', nd_quantity,
        'in_transit_inventory', NULL
      )
    ),
    '[]'::JSONB
  )
  FROM store_rows;
$$;

-- ── Remark upsert ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_ops_nd_remark(
  p_country      TEXT,
  p_bifurcation    TEXT,
  p_sku            TEXT,
  p_remarks_text   TEXT,
  p_updated_by     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country TEXT := normalize_ops_country(p_country);
  v_bifurcation TEXT := COALESCE(NULLIF(TRIM(p_bifurcation), ''), '');
  v_sku TEXT := UPPER(TRIM(p_sku));
  v_row ops_nd_remarks%ROWTYPE;
BEGIN
  INSERT INTO ops_nd_remarks (country, bifurcation, sku, remarks_text, updated_by, updated_at)
  VALUES (v_country, v_bifurcation, v_sku, NULLIF(TRIM(p_remarks_text), ''), p_updated_by, NOW())
  ON CONFLICT (country, bifurcation, sku) DO UPDATE SET
    remarks_text = EXCLUDED.remarks_text,
    updated_by = EXCLUDED.updated_by,
    updated_at = NOW()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'country', v_row.country,
    'bifurcation', v_row.bifurcation,
    'sku', v_row.sku,
    'remarks_text', v_row.remarks_text,
    'updated_by', v_row.updated_by,
    'updated_at', v_row.updated_at
  );
END;
$$;

-- ── Filter options from ND summary ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_ops_nd_filter_options()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'countries', COALESCE((
      SELECT jsonb_agg(c.country ORDER BY c.country)
      FROM (SELECT DISTINCT country FROM ops_nd_sku_summary WHERE country <> 'Unknown') c
    ), '[]'::JSONB),
    'bifurcations', COALESCE((
      SELECT jsonb_agg(b.bifurcation ORDER BY b.bifurcation)
      FROM (SELECT DISTINCT bifurcation FROM ops_nd_sku_summary WHERE bifurcation <> '') b
    ), '[]'::JSONB)
  );
$$;

COMMENT ON FUNCTION get_ops_nd_summary IS
  'ND Report main table — filtered totals, pagination, remarks, suggestion counts.';
COMMENT ON FUNCTION get_ops_nd_sku_details IS
  'ND store breakdown for one SKU with channel list store_name.';
COMMENT ON FUNCTION get_ops_nd_movement_suggestions IS
  'Related SKU movement suggestions with source demand protection.';
COMMENT ON FUNCTION upsert_ops_nd_remark IS
  'Admin remark upsert keyed by country+bifurcation+sku.';
