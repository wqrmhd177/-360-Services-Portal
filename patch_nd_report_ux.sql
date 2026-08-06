-- ND Report UX overhaul: multi-select filters, min ND date, PO/Movement qty, Undelivered/Returning.
-- Run AFTER patch_nd_report_order_details.sql (step 16).
-- Then:
--   REFRESH MATERIALIZED VIEW ops_nd_allocations;  -- only if allocations MV unchanged
--   REFRESH MATERIALIZED VIEW ops_nd_sku_summary;
--   SELECT refresh_ops_orders_summaries_simple();  -- optional

-- ── 1. Inventory cache: PO + Movement quantities ─────────────────────────────

ALTER TABLE ops_inventory_items
  ADD COLUMN IF NOT EXISTS po_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS movement_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN ops_inventory_items.po_quantity IS
  'PO quantity from Metabase inventory feed (optional column mapping on sync).';
COMMENT ON COLUMN ops_inventory_items.movement_quantity IS
  'In-movement quantity from Metabase inventory feed (optional column mapping on sync).';

-- ── 2. Multi-select filter helpers (comma-separated URL params) ───────────────

CREATE OR REPLACE FUNCTION ops_nd_country_list_matches(p_filter TEXT, p_country TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    NULLIF(TRIM(COALESCE(p_filter, '')), '') IS NULL
    OR EXISTS (
      SELECT 1
      FROM unnest(string_to_array(p_filter, ',')) AS part(raw)
      WHERE ops_country_matches(TRIM(part.raw), p_country)
    );
$$;

CREATE OR REPLACE FUNCTION ops_nd_value_list_matches(p_filter TEXT, p_value TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    NULLIF(TRIM(COALESCE(p_filter, '')), '') IS NULL
    OR TRIM(COALESCE(p_value, '')) = ANY (
      SELECT TRIM(unnest) FROM unnest(string_to_array(p_filter, ','))
    );
$$;

-- ── 3. Rebuild SKU summary MV ─────────────────────────────────────────────────

DROP MATERIALIZED VIEW IF EXISTS ops_nd_sku_summary CASCADE;

CREATE MATERIALIZED VIEW ops_nd_sku_summary AS
WITH inventory_exact AS (
  SELECT
    normalize_ops_country(i.country) AS country,
    COALESCE(NULLIF(TRIM(i.category), ''), '') AS bifurcation,
    UPPER(TRIM(i.sku)) AS sku,
    COALESCE(SUM(i.po_quantity), 0)::NUMERIC AS po_qty,
    COALESCE(SUM(i.movement_quantity), 0)::NUMERIC AS movement_qty
  FROM ops_inventory_items i
  WHERE i.sku IS NOT NULL
    AND TRIM(i.sku) <> ''
  GROUP BY 1, 2, 3
),
inventory_country_sku AS (
  SELECT
    normalize_ops_country(i.country) AS country,
    UPPER(TRIM(i.sku)) AS sku,
    COALESCE(SUM(i.po_quantity), 0)::NUMERIC AS po_qty,
    COALESCE(SUM(i.movement_quantity), 0)::NUMERIC AS movement_qty
  FROM ops_inventory_items i
  WHERE i.sku IS NOT NULL
    AND TRIM(i.sku) <> ''
  GROUP BY 1, 2
),
alloc_summary AS (
  SELECT
    a.country,
    a.bifurcation,
    a.sku,
    MAX(a.title) AS title,
    COUNT(DISTINCT a.order_id) FILTER (WHERE a.nd_qty > 0)::INTEGER AS nd_orders,
    COALESCE(SUM(a.nd_qty) FILTER (WHERE a.nd_qty > 0), 0)::INTEGER AS nd_quantity,
    COUNT(DISTINCT a.store_id) FILTER (WHERE a.nd_qty > 0 AND a.store_id > 0)::INTEGER AS store_count,
    MIN(a.approved_date) FILTER (WHERE a.nd_qty > 0) AS min_nd_date
  FROM ops_nd_allocations a
  GROUP BY a.country, a.bifurcation, a.sku
  HAVING COALESCE(SUM(a.nd_qty), 0) > 0
)
SELECT
  s.country,
  s.bifurcation,
  s.sku,
  s.title,
  s.nd_orders,
  s.nd_quantity,
  s.store_count,
  s.min_nd_date,
  fr.fulfilment_route,
  COALESCE(exact.po_qty, pooled.po_qty, 0)::NUMERIC AS po_qty,
  COALESCE(exact.movement_qty, pooled.movement_qty, 0)::NUMERIC AS movement_qty,
  NOW() AS mv_refreshed_at
FROM alloc_summary s
LEFT JOIN ops_inventory_fulfilment_routes fr ON fr.sku = s.sku
LEFT JOIN inventory_exact exact
  ON exact.country = s.country
  AND exact.bifurcation = s.bifurcation
  AND exact.sku = s.sku
LEFT JOIN inventory_country_sku pooled
  ON pooled.country = s.country
  AND pooled.sku = s.sku;

CREATE UNIQUE INDEX idx_ops_nd_sku_summary_unique
  ON ops_nd_sku_summary (country, bifurcation, sku);

CREATE INDEX idx_ops_nd_sku_summary_sort
  ON ops_nd_sku_summary (country, bifurcation, nd_quantity DESC);

COMMENT ON MATERIALIZED VIEW ops_nd_sku_summary IS
  'ND SKU rollup with min approved date, fulfilment route, PO/Movement inventory qty.';

-- ── 4. Summary RPC (multi-filter + new columns) ───────────────────────────────

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
  v_bifurcation := NULLIF(TRIM(COALESCE(p_bifurcation, '')), '');

  v_sort_col := CASE LOWER(COALESCE(p_sort_by, 'nd_quantity'))
    WHEN 'title' THEN 'title'
    WHEN 'sku' THEN 'sku'
    WHEN 'bifurcation' THEN 'bifurcation'
    WHEN 'fulfilment_route' THEN 'fulfilment_route'
    WHEN 'min_nd_date' THEN 'min_nd_date'
    WHEN 'po_qty' THEN 'po_qty'
    WHEN 'movement_qty' THEN 'movement_qty'
    ELSE 'nd_quantity'
  END;

  SELECT MAX(mv_refreshed_at) INTO v_mv_refreshed FROM ops_nd_sku_summary;

  WITH filtered_alloc AS (
    SELECT a.*
    FROM ops_nd_allocations a
    WHERE a.nd_qty > 0
      AND (p_from_date IS NULL OR a.order_date_day >= p_from_date)
      AND (p_to_date IS NULL OR a.order_date_day <= p_to_date)
      AND ops_nd_country_list_matches(v_country, a.country)
      AND ops_nd_value_list_matches(v_bifurcation, a.bifurcation)
  ),
  filtered_summary AS (
    SELECT
      s.country,
      s.bifurcation,
      s.sku,
      MAX(s.title) AS title,
      MAX(s.fulfilment_route) AS fulfilment_route,
      COALESCE(SUM(fa.nd_qty), 0)::INTEGER AS nd_quantity,
      MIN(fa.approved_date) AS min_nd_date,
      MAX(s.po_qty) AS po_qty,
      MAX(s.movement_qty) AS movement_qty
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
    GROUP BY s.country, s.bifurcation, s.sku
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
        AND ops_nd_country_list_matches(v_country, a.country)
        AND ops_nd_value_list_matches(v_bifurcation, a.bifurcation)
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
        AND ops_nd_country_list_matches($3, a.country)
        AND ops_nd_value_list_matches($4, a.bifurcation)
    ),
    filtered_summary AS (
      SELECT
        s.country,
        s.bifurcation,
        s.sku,
        MAX(s.title) AS title,
        MAX(s.fulfilment_route) AS fulfilment_route,
        COALESCE(SUM(fa.nd_qty), 0)::INTEGER AS nd_quantity,
        MIN(fa.approved_date) AS min_nd_date,
        MAX(s.po_qty) AS po_qty,
        MAX(s.movement_qty) AS movement_qty
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
      GROUP BY s.country, s.bifurcation, s.sku
    )
    SELECT COALESCE(jsonb_agg(row_to_json(t)::JSONB), '[]'::JSONB)
    FROM (
      SELECT * FROM filtered_summary
      ORDER BY %I %s NULLS LAST
      LIMIT $6 OFFSET $7
    ) t
    $sql$,
    v_sort_col, v_sort_dir
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

-- ── 5. SKU details RPC: Undelivered/Returning per store + SKU totals ──────────

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
  order_lines AS (
    SELECT
      COALESCE(o.store_id, 0) AS store_id,
      o.status,
      o.quantity,
      o.tag
    FROM ops_orders_items o
    CROSS JOIN params p
    WHERE normalize_ops_country(o.country) = p.country
      AND COALESCE(NULLIF(TRIM(o.bifurcation), ''), '') = p.bifurcation
      AND UPPER(TRIM(o.sku)) = p.sku
      AND o.order_id IS NOT NULL
  ),
  store_status AS (
    SELECT
      store_id,
      COALESCE(SUM(quantity) FILTER (
        WHERE status = 'Undelivered'
          AND (
            tag IS NULL
            OR TRIM(tag) = ''
            OR tag ILIKE 'FA - Request to Return'
            OR tag ILIKE 'FA - Hold for Working'
            OR tag NOT ILIKE 'FA%%'
          )
      ), 0)::INTEGER AS undelivered_qty,
      COALESCE(SUM(quantity) FILTER (
        WHERE status = 'Return in Transit'
      ), 0)::INTEGER AS returning_qty
    FROM order_lines
    GROUP BY store_id
  ),
  sku_status AS (
    SELECT
      COALESCE(SUM(quantity) FILTER (
        WHERE status = 'Undelivered'
          AND (
            tag IS NULL
            OR TRIM(tag) = ''
            OR tag ILIKE 'FA - Request to Return'
            OR tag ILIKE 'FA - Hold for Working'
            OR tag NOT ILIKE 'FA%%'
          )
      ), 0)::INTEGER AS undelivered_qty,
      COALESCE(SUM(quantity) FILTER (
        WHERE status = 'Return in Transit'
      ), 0)::INTEGER AS returning_qty
    FROM order_lines
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
  ),
  rows_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'store_id', sr.store_id,
          'user_id', sr.user_id,
          'store_name', sr.store_name,
          'nd_orders', sr.nd_orders,
          'nd_quantity', sr.nd_quantity,
          'undelivered_qty', COALESCE(ss.undelivered_qty, 0),
          'returning_qty', COALESCE(ss.returning_qty, 0),
          'ops_remarks', r.ops_remarks,
          'growth_feedback', r.growth_feedback,
          'status', COALESCE(r.status, 'Open'),
          'remark_updated_by', r.updated_by,
          'remark_updated_at', r.updated_at
        )
        ORDER BY sr.nd_quantity DESC, sr.store_id
      ),
      '[]'::JSONB
    ) AS payload
    FROM store_rows sr
    CROSS JOIN params p
    LEFT JOIN store_status ss ON ss.store_id = sr.store_id
    LEFT JOIN ops_nd_remarks r
      ON r.country = p.country
      AND r.bifurcation = p.bifurcation
      AND r.sku = p.sku
      AND r.store_id = sr.store_id
  )
  SELECT jsonb_build_object(
    'rows', (SELECT payload FROM rows_json),
    'sku_totals', (
      SELECT jsonb_build_object(
        'undelivered_qty', undelivered_qty,
        'returning_qty', returning_qty
      )
      FROM sku_status
    )
  );
$$;

COMMENT ON FUNCTION get_ops_nd_sku_details IS
  'ND SKU store breakdown with per-store and SKU-level Undelivered/Returning qty.';

COMMENT ON FUNCTION get_ops_nd_summary IS
  'Paginated ND SKU summary — supports comma-separated country/bifurcation filters.';
