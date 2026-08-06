-- ND Report: Undelivered/Returning qty from orders by status only (no date filter).
-- Run after patch_nd_report_ux.sql if that patch was already applied.

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
            tag ILIKE 'FA - Request to Return'
            OR tag ILIKE 'FA - Hold for Working'
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
            tag ILIKE 'FA - Request to Return'
            OR tag ILIKE 'FA - Hold for Working'
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
  'ND SKU store breakdown; Undelivered/Returning qty from all matching orders (status only, no date filter).';
