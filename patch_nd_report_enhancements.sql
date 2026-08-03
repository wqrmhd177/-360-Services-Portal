-- ND Report enhancements: store-level remarks, fulfilment routes, change logs.
-- Requires: setup_nd_report.sql
-- Run patch_nd_report_enhancements.sql then: SELECT refresh_ops_orders_summaries_simple();

-- ── Backup legacy SKU-level remarks (optional) ───────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ops_nd_remarks'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ops_nd_remarks'
      AND column_name = 'store_id'
  ) THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS ops_nd_remarks_backup AS SELECT * FROM ops_nd_remarks';
  END IF;
END $$;

-- ── Store-level remarks ───────────────────────────────────────────────────────

DROP TABLE IF EXISTS ops_nd_remarks CASCADE;

CREATE TABLE ops_nd_remarks (
  country          TEXT        NOT NULL,
  bifurcation      TEXT        NOT NULL,
  sku              TEXT        NOT NULL,
  store_id         INTEGER     NOT NULL,
  ops_remarks      TEXT,
  growth_feedback  TEXT,
  status           TEXT        NOT NULL DEFAULT 'Open',
  updated_by       TEXT        NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (country, bifurcation, sku, store_id),
  CONSTRAINT ops_nd_remarks_status_check
    CHECK (status IN ('Open', 'Pending', 'Closed'))
);

COMMENT ON TABLE ops_nd_remarks IS
  'Store-level ND remarks — keyed by country + bifurcation + sku + store_id.';

-- ── Remarks change log ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ops_nd_remark_logs (
  id           BIGSERIAL PRIMARY KEY,
  country      TEXT        NOT NULL,
  bifurcation  TEXT        NOT NULL,
  sku          TEXT        NOT NULL,
  store_id     INTEGER     NOT NULL,
  field_name   TEXT        NOT NULL,
  old_value    TEXT,
  new_value    TEXT,
  changed_by   TEXT        NOT NULL,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ops_nd_remark_logs_field_check
    CHECK (field_name IN ('ops_remarks', 'growth_feedback', 'status'))
);

CREATE INDEX IF NOT EXISTS idx_ops_nd_remark_logs_key
  ON ops_nd_remark_logs (country, bifurcation, sku, store_id, changed_at DESC);

-- ── Fulfilment route storage ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ops_inventory_fulfilment_routes (
  sku              TEXT PRIMARY KEY,
  fulfilment_route TEXT        NOT NULL,
  updated_by       TEXT        NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops_inventory_fulfilment_route_logs (
  id         BIGSERIAL PRIMARY KEY,
  sku        TEXT        NOT NULL,
  old_route  TEXT,
  new_route  TEXT        NOT NULL,
  changed_by TEXT        NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_inventory_fulfilment_route_logs_sku
  ON ops_inventory_fulfilment_route_logs (sku, changed_at DESC);

-- ── Rebuild SKU summary MV with fulfilment routes ────────────────────────────

DROP MATERIALIZED VIEW IF EXISTS ops_nd_sku_summary CASCADE;

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

COMMENT ON MATERIALIZED VIEW ops_nd_sku_summary IS
  'ND SKU rollup with fulfilment route from ops_inventory_fulfilment_routes.';

-- ── Update ND summary RPC (remove SKU-level remarks) ──────────────────────────

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

-- ── Store-level details with remarks ──────────────────────────────────────────

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
        'store_id', sr.store_id,
        'user_id', sr.user_id,
        'store_name', sr.store_name,
        'nd_orders', sr.nd_orders,
        'nd_quantity', sr.nd_quantity,
        'po_qty', NULL,
        'in_transit_inventory', NULL,
        'ops_remarks', r.ops_remarks,
        'growth_feedback', r.growth_feedback,
        'status', COALESCE(r.status, 'Open'),
        'remark_updated_by', r.updated_by,
        'remark_updated_at', r.updated_at
      )
      ORDER BY sr.nd_quantity DESC, sr.store_id
    ),
    '[]'::JSONB
  )
  FROM store_rows sr
  CROSS JOIN params p
  LEFT JOIN ops_nd_remarks r
    ON r.country = p.country
    AND r.bifurcation = p.bifurcation
    AND r.sku = p.sku
    AND r.store_id = sr.store_id;
$$;

-- ── Store remark upsert with change logging ───────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_ops_nd_store_remark(
  p_country         TEXT,
  p_bifurcation     TEXT,
  p_sku             TEXT,
  p_store_id        INTEGER,
  p_ops_remarks     TEXT DEFAULT NULL,
  p_growth_feedback TEXT DEFAULT NULL,
  p_status          TEXT DEFAULT NULL,
  p_updated_by      TEXT DEFAULT NULL
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
  v_store_id INTEGER := COALESCE(p_store_id, 0);
  v_existing ops_nd_remarks%ROWTYPE;
  v_row ops_nd_remarks%ROWTYPE;
  v_ops TEXT := NULLIF(TRIM(COALESCE(p_ops_remarks, '')), '');
  v_growth TEXT := NULLIF(TRIM(COALESCE(p_growth_feedback, '')), '');
  v_status TEXT := COALESCE(NULLIF(TRIM(COALESCE(p_status, '')), ''), 'Open');
BEGIN
  IF v_store_id <= 0 THEN
    RAISE EXCEPTION 'store_id is required';
  END IF;

  IF v_status NOT IN ('Open', 'Pending', 'Closed') THEN
    RAISE EXCEPTION 'Invalid status: %', v_status;
  END IF;

  SELECT * INTO v_existing
  FROM ops_nd_remarks
  WHERE country = v_country
    AND bifurcation = v_bifurcation
    AND sku = v_sku
    AND store_id = v_store_id;

  IF FOUND THEN
    IF v_ops IS DISTINCT FROM v_existing.ops_remarks THEN
      INSERT INTO ops_nd_remark_logs (country, bifurcation, sku, store_id, field_name, old_value, new_value, changed_by)
      VALUES (v_country, v_bifurcation, v_sku, v_store_id, 'ops_remarks', v_existing.ops_remarks, v_ops, p_updated_by);
    END IF;
    IF v_growth IS DISTINCT FROM v_existing.growth_feedback THEN
      INSERT INTO ops_nd_remark_logs (country, bifurcation, sku, store_id, field_name, old_value, new_value, changed_by)
      VALUES (v_country, v_bifurcation, v_sku, v_store_id, 'growth_feedback', v_existing.growth_feedback, v_growth, p_updated_by);
    END IF;
    IF v_status IS DISTINCT FROM v_existing.status THEN
      INSERT INTO ops_nd_remark_logs (country, bifurcation, sku, store_id, field_name, old_value, new_value, changed_by)
      VALUES (v_country, v_bifurcation, v_sku, v_store_id, 'status', v_existing.status, v_status, p_updated_by);
    END IF;

    UPDATE ops_nd_remarks SET
      ops_remarks = v_ops,
      growth_feedback = v_growth,
      status = v_status,
      updated_by = p_updated_by,
      updated_at = NOW()
    WHERE country = v_country
      AND bifurcation = v_bifurcation
      AND sku = v_sku
      AND store_id = v_store_id
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO ops_nd_remarks (
      country, bifurcation, sku, store_id,
      ops_remarks, growth_feedback, status, updated_by, updated_at
    )
    VALUES (
      v_country, v_bifurcation, v_sku, v_store_id,
      v_ops, v_growth, v_status, p_updated_by, NOW()
    )
    RETURNING * INTO v_row;

    IF v_ops IS NOT NULL THEN
      INSERT INTO ops_nd_remark_logs (country, bifurcation, sku, store_id, field_name, old_value, new_value, changed_by)
      VALUES (v_country, v_bifurcation, v_sku, v_store_id, 'ops_remarks', NULL, v_ops, p_updated_by);
    END IF;
    IF v_growth IS NOT NULL THEN
      INSERT INTO ops_nd_remark_logs (country, bifurcation, sku, store_id, field_name, old_value, new_value, changed_by)
      VALUES (v_country, v_bifurcation, v_sku, v_store_id, 'growth_feedback', NULL, v_growth, p_updated_by);
    END IF;
    INSERT INTO ops_nd_remark_logs (country, bifurcation, sku, store_id, field_name, old_value, new_value, changed_by)
    VALUES (v_country, v_bifurcation, v_sku, v_store_id, 'status', NULL, v_status, p_updated_by);
  END IF;

  RETURN jsonb_build_object(
    'country', v_row.country,
    'bifurcation', v_row.bifurcation,
    'sku', v_row.sku,
    'store_id', v_row.store_id,
    'ops_remarks', v_row.ops_remarks,
    'growth_feedback', v_row.growth_feedback,
    'status', v_row.status,
    'updated_by', v_row.updated_by,
    'updated_at', v_row.updated_at
  );
END;
$$;

-- ── Remark change history ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_ops_nd_remark_logs(
  p_country     TEXT,
  p_bifurcation TEXT,
  p_sku         TEXT,
  p_store_id    INTEGER
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'field_name', l.field_name,
        'old_value', l.old_value,
        'new_value', l.new_value,
        'changed_by', l.changed_by,
        'changed_at', l.changed_at
      )
      ORDER BY l.changed_at DESC, l.id DESC
    ),
    '[]'::JSONB
  )
  FROM ops_nd_remark_logs l
  WHERE l.country = normalize_ops_country(p_country)
    AND l.bifurcation = COALESCE(NULLIF(TRIM(p_bifurcation), ''), '')
    AND l.sku = UPPER(TRIM(p_sku))
    AND l.store_id = p_store_id;
$$;

-- ── Fulfilment route upsert with logging ──────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_ops_inventory_fulfilment_route(
  p_sku      TEXT,
  p_route    TEXT,
  p_updated_by TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sku TEXT := UPPER(TRIM(p_sku));
  v_route TEXT := NULLIF(TRIM(p_route), '');
  v_existing TEXT;
  v_row ops_inventory_fulfilment_routes%ROWTYPE;
BEGIN
  IF v_sku = '' THEN
    RAISE EXCEPTION 'sku is required';
  END IF;
  IF v_route IS NULL THEN
    RAISE EXCEPTION 'fulfilment_route is required';
  END IF;

  SELECT fulfilment_route INTO v_existing
  FROM ops_inventory_fulfilment_routes
  WHERE sku = v_sku;

  INSERT INTO ops_inventory_fulfilment_routes (sku, fulfilment_route, updated_by, updated_at)
  VALUES (v_sku, v_route, p_updated_by, NOW())
  ON CONFLICT (sku) DO UPDATE SET
    fulfilment_route = EXCLUDED.fulfilment_route,
    updated_by = EXCLUDED.updated_by,
    updated_at = NOW()
  RETURNING * INTO v_row;

  IF v_existing IS DISTINCT FROM v_route THEN
    INSERT INTO ops_inventory_fulfilment_route_logs (sku, old_route, new_route, changed_by)
    VALUES (v_sku, v_existing, v_route, p_updated_by);
  END IF;

  RETURN jsonb_build_object(
    'sku', v_row.sku,
    'fulfilment_route', v_row.fulfilment_route,
    'updated_by', v_row.updated_by,
    'updated_at', v_row.updated_at
  );
END;
$$;

-- ── Bulk fulfilment route upsert ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION bulk_upsert_ops_inventory_fulfilment_routes(
  p_routes     JSONB,
  p_updated_by TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_sku TEXT;
  v_route TEXT;
  v_updated INTEGER := 0;
  v_skipped INTEGER := 0;
  v_errors JSONB := '[]'::JSONB;
BEGIN
  IF p_routes IS NULL OR jsonb_typeof(p_routes) <> 'array' THEN
    RAISE EXCEPTION 'p_routes must be a JSON array';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_routes)
  LOOP
    v_sku := UPPER(TRIM(COALESCE(v_item->>'sku', '')));
    v_route := NULLIF(TRIM(COALESCE(v_item->>'fulfilment_route', v_item->>'route', '')), '');

    IF v_sku = '' OR v_route IS NULL THEN
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_object(
        'sku', COALESCE(v_item->>'sku', ''),
        'error', 'sku and fulfilment_route are required'
      );
      CONTINUE;
    END IF;

    PERFORM upsert_ops_inventory_fulfilment_route(v_sku, v_route, p_updated_by);
    v_updated := v_updated + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'updated', v_updated,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$$;

-- ── Fulfilment route change history ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_ops_inventory_fulfilment_route_logs(
  p_sku TEXT
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'sku', l.sku,
        'old_route', l.old_route,
        'new_route', l.new_route,
        'changed_by', l.changed_by,
        'changed_at', l.changed_at
      )
      ORDER BY l.changed_at DESC, l.id DESC
    ),
    '[]'::JSONB
  )
  FROM ops_inventory_fulfilment_route_logs l
  WHERE l.sku = UPPER(TRIM(p_sku));
$$;

-- ── Fetch routes for SKU list ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_ops_inventory_fulfilment_routes(
  p_skus TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'sku', fr.sku,
        'fulfilment_route', fr.fulfilment_route,
        'updated_by', fr.updated_by,
        'updated_at', fr.updated_at
      )
      ORDER BY fr.sku
    ),
    '[]'::JSONB
  )
  FROM ops_inventory_fulfilment_routes fr
  WHERE p_skus IS NULL
    OR fr.sku = ANY(
      SELECT UPPER(TRIM(s)) FROM unnest(p_skus) AS s WHERE TRIM(s) <> ''
    );
$$;

-- ── Distinct fulfilment route options ───────────────────────────────────────

CREATE OR REPLACE FUNCTION get_ops_inventory_fulfilment_route_options()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(DISTINCT fr.fulfilment_route ORDER BY fr.fulfilment_route),
    '[]'::JSONB
  )
  FROM ops_inventory_fulfilment_routes fr;
$$;

-- Drop legacy SKU-level remark RPC
DROP FUNCTION IF EXISTS upsert_ops_nd_remark(TEXT, TEXT, TEXT, TEXT, TEXT);

COMMENT ON FUNCTION get_ops_nd_summary IS
  'ND Report main table — filtered totals, pagination, suggestion counts.';
COMMENT ON FUNCTION get_ops_nd_sku_details IS
  'ND store breakdown with store-level remarks and channel list store_name.';
COMMENT ON FUNCTION upsert_ops_nd_store_remark IS
  'Store-level ND remark upsert with change logging.';
COMMENT ON FUNCTION get_ops_nd_remark_logs IS
  'Change history for store-level ND remarks.';
COMMENT ON FUNCTION upsert_ops_inventory_fulfilment_route IS
  'Upsert SKU fulfilment route with change logging.';
COMMENT ON FUNCTION bulk_upsert_ops_inventory_fulfilment_routes IS
  'Bulk CSV import for SKU fulfilment routes.';
