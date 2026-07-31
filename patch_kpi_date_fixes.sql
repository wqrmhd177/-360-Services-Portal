-- KPI date fixes: correct aging date per status group + new drill-down date columns.
-- Run AFTER patch_store_visibility_status_detail.sql (step 4).
-- Requires patch_country_normalization.sql (normalize_ops_country / ops_country_matches).
-- This is step 11 in PERFORMANCE_SETUP.md.

-- ── 1. Add confirmation_pending_date column ──────────────────────────────────
ALTER TABLE ops_orders_items
  ADD COLUMN IF NOT EXISTS confirmation_pending_date TIMESTAMPTZ;

COMMENT ON COLUMN ops_orders_items.confirmation_pending_date IS
  'Metabase Confirmation_Pending_Date — used for confirmation aging (MAX with order_date).';

-- ── 2. Rebuild ops_orders_order_detail MV with all required date columns ─────
-- (Products rollup depends on it, so both are rebuilt.)

DROP MATERIALIZED VIEW IF EXISTS ops_orders_product_rollup CASCADE;
DROP MATERIALIZED VIEW IF EXISTS ops_orders_order_detail CASCADE;

CREATE MATERIALIZED VIEW ops_orders_order_detail AS
SELECT
  order_id,
  MIN(order_date_day)           AS order_date_day,
  normalize_ops_country((ARRAY_AGG(country ORDER BY id))[1]) AS country,
  COALESCE(NULLIF(TRIM((ARRAY_AGG(bifurcation  ORDER BY id))[1]), ''), '')        AS bifurcation,
  COALESCE((ARRAY_AGG(store_id ORDER BY id))[1], 0)                               AS store_id,
  COALESCE(NULLIF(TRIM((ARRAY_AGG(status       ORDER BY id))[1]), ''), 'Unknown') AS status,
  COALESCE(NULLIF(TRIM((ARRAY_AGG(tag          ORDER BY id))[1]), ''), 'No tag')  AS tag,
  COALESCE(NULLIF(TRIM((ARRAY_AGG(title        ORDER BY id))[1]), ''), 'No title') AS title,
  -- date columns used for aging calculations
  MIN(order_date)                AS order_date,
  MIN(shipment_date_log)         AS shipment_date_log,
  MIN(approved_date)             AS approved_date,
  MIN(shipment_date)             AS shipment_date,
  MIN(undelivered_date)          AS undelivered_date,
  MIN(confirmation_pending_date) AS confirmation_pending_date,
  -- confirmation_date = latest of order_date and confirmation_pending_date (whichever exists)
  CASE
    WHEN MIN(order_date) IS NOT NULL AND MIN(confirmation_pending_date) IS NOT NULL
      THEN GREATEST(MIN(order_date), MIN(confirmation_pending_date))
    ELSE COALESCE(MIN(order_date), MIN(confirmation_pending_date))
  END AS confirmation_date
FROM ops_orders_items
WHERE order_id IS NOT NULL AND order_date_day IS NOT NULL
GROUP BY order_id;

CREATE UNIQUE INDEX idx_ops_orders_order_detail_order_id
  ON ops_orders_order_detail(order_id);

CREATE INDEX idx_ops_orders_order_detail_filters
  ON ops_orders_order_detail(order_date_day, country, bifurcation, store_id, status);

-- ── 3. Rebuild ops_orders_product_rollup (depends on ops_orders_order_detail) ─

CREATE MATERIALIZED VIEW ops_orders_product_rollup AS
WITH distinct_titles AS (
  SELECT DISTINCT
    order_id,
    COALESCE(NULLIF(TRIM(title), ''), 'Unknown') AS title
  FROM ops_orders_items
  WHERE order_id IS NOT NULL
)
SELECT
  d.order_date_day,
  d.country,
  d.bifurcation,
  d.store_id,
  d.status,
  d.tag,
  d.order_date,
  d.shipment_date_log,
  d.approved_date,
  d.shipment_date,
  d.undelivered_date,
  d.confirmation_date,
  t.title,
  d.order_id
FROM ops_orders_order_detail d
INNER JOIN distinct_titles t ON t.order_id = d.order_id;

CREATE UNIQUE INDEX idx_ops_orders_product_rollup_unique
  ON ops_orders_product_rollup(order_id, title);

CREATE INDEX idx_ops_orders_product_rollup_filters
  ON ops_orders_product_rollup(order_date_day, country, bifurcation, store_id);

-- ── 4. Update get_ops_orders_status_detail with correct date per group ────────

CREATE OR REPLACE FUNCTION get_ops_orders_status_detail(
  p_group_id    TEXT,
  p_country     TEXT DEFAULT NULL,
  p_bifurcation TEXT DEFAULT NULL,
  p_store_id    BIGINT DEFAULT NULL,
  p_from_date   DATE DEFAULT NULL,
  p_to_date     DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_statuses TEXT[];
  v_group_by TEXT;
  v_days_from_label TEXT;   -- returned in JSON for client-side hint text
  v_layout   TEXT;
  v_title    TEXT;
  v_total    INTEGER;
  v_filtered_total INTEGER;
  v_result   JSONB;
  v_today    DATE := (NOW() AT TIME ZONE 'America/Los_Angeles')::DATE;
BEGIN
  v_statuses := CASE p_group_id
    WHEN 'confirmationPending' THEN ARRAY['Confirmation Pending']
    WHEN 'approved'            THEN ARRAY['Approved']
    WHEN 'dispatching'         THEN ARRAY['Dispatching in Process']
    WHEN 'shipped'             THEN ARRAY['Shipped']
    WHEN 'undelivered'         THEN ARRAY['Undelivered']
    WHEN 'preDispatchCancelled' THEN ARRAY['Cancelled', 'Canceled']
    WHEN 'return'              THEN ARRAY['Return in Transit', 'Return']
    ELSE NULL
  END;

  IF v_statuses IS NULL THEN
    RAISE EXCEPTION 'Unknown group: %', p_group_id;
  END IF;

  v_group_by := CASE p_group_id
    WHEN 'approved'    THEN 'title'
    WHEN 'dispatching' THEN 'title'
    ELSE 'tag'
  END;

  -- Label used in the drill-down hint and breadcrumb (matches OperationsDaysFrom in TS)
  v_days_from_label := CASE p_group_id
    WHEN 'confirmationPending' THEN 'confirmationDate'
    WHEN 'approved'            THEN 'approvedDate'
    WHEN 'dispatching'         THEN 'approvedDate'
    WHEN 'shipped'             THEN 'shipmentDateLog'
    WHEN 'undelivered'         THEN 'undeliveredDate'
    WHEN 'return'              THEN 'shipmentDateLog'
    ELSE 'orderDate'
  END;

  v_layout := CASE p_group_id
    WHEN 'preDispatchCancelled' THEN 'countryTag'
    WHEN 'return'               THEN 'countryTag'
    ELSE 'daysCountrySubgroup'
  END;

  v_title := CASE p_group_id
    WHEN 'confirmationPending'  THEN 'Orders in Confirmation'
    WHEN 'approved'             THEN 'Orders in Approved'
    WHEN 'dispatching'          THEN 'Orders in Dispatching in Process'
    WHEN 'shipped'              THEN 'Orders in Shipped'
    WHEN 'undelivered'          THEN 'Orders in Undelivered'
    WHEN 'preDispatchCancelled' THEN 'Pre Dispatch Cancelled'
    WHEN 'return'               THEN 'Orders in Return'
    ELSE p_group_id
  END;

  SELECT COUNT(DISTINCT order_id)::INTEGER
  INTO v_filtered_total
  FROM ops_orders_order_detail d
  WHERE
    (p_from_date IS NULL OR d.order_date_day >= p_from_date)
    AND (p_to_date IS NULL OR d.order_date_day <= p_to_date)
    AND (p_store_id IS NULL OR d.store_id = p_store_id)
    AND (
      (NULLIF(TRIM(p_country), '') IS NOT NULL AND ops_country_matches(p_country, d.country))
      OR (
        NULLIF(TRIM(p_country), '') IS NULL
        AND d.country IS NOT NULL
        AND TRIM(d.country) <> ''
        AND d.country <> 'Unknown'
      )
    )
    AND (
      (NULLIF(TRIM(p_bifurcation), '') IS NOT NULL AND d.bifurcation = NULLIF(TRIM(p_bifurcation), ''))
      OR (
        NULLIF(TRIM(p_bifurcation), '') IS NULL
        AND d.bifurcation IS NOT NULL
        AND TRIM(d.bifurcation) <> ''
      )
    );

  IF v_layout = 'countryTag' THEN
    WITH filtered AS (
      SELECT d.order_id, normalize_ops_country(d.country) AS country, d.tag
      FROM ops_orders_order_detail d
      WHERE
        d.status = ANY(v_statuses)
        AND (p_from_date IS NULL OR d.order_date_day >= p_from_date)
        AND (p_to_date IS NULL OR d.order_date_day <= p_to_date)
        AND (p_store_id IS NULL OR d.store_id = p_store_id)
        AND (
          (NULLIF(TRIM(p_country), '') IS NOT NULL AND ops_country_matches(p_country, d.country))
          OR (
            NULLIF(TRIM(p_country), '') IS NULL
            AND d.country IS NOT NULL AND TRIM(d.country) <> '' AND d.country <> 'Unknown'
          )
        )
        AND (
          (NULLIF(TRIM(p_bifurcation), '') IS NOT NULL AND d.bifurcation = NULLIF(TRIM(p_bifurcation), ''))
          OR (
            NULLIF(TRIM(p_bifurcation), '') IS NULL
            AND d.bifurcation IS NOT NULL AND TRIM(d.bifurcation) <> ''
          )
        )
    ),
    tag_rows AS (
      SELECT
        country,
        tag,
        array_agg(order_id ORDER BY order_id) AS order_ids,
        COUNT(*)::INTEGER AS orders
      FROM filtered
      GROUP BY country, tag
    ),
    country_rows AS (
      SELECT
        tr.country,
        ct.country_orders AS orders,
        jsonb_agg(
          jsonb_build_object(
            'tag', tr.tag,
            'orders', tr.orders,
            'pct', CASE WHEN ct.country_orders > 0
              THEN tr.orders::NUMERIC / ct.country_orders
              ELSE 0 END,
            'orderIds', to_jsonb(tr.order_ids)
          )
          ORDER BY tr.orders DESC, tr.tag
        ) AS tags
      FROM tag_rows tr
      JOIN (
        SELECT country, SUM(orders)::INTEGER AS country_orders
        FROM tag_rows
        GROUP BY country
      ) ct ON ct.country = tr.country
      GROUP BY tr.country, ct.country_orders
    )
    SELECT
      COALESCE(SUM(orders), 0)::INTEGER,
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'country', country,
          'orders', orders,
          'tags', tags
        )
        ORDER BY orders DESC, country
      ), '[]'::jsonb)
    INTO v_total, v_result
    FROM country_rows;

    RETURN jsonb_build_object(
      'groupId',             p_group_id,
      'title',               v_title,
      'groupBy',             v_group_by,
      'daysFrom',            v_days_from_label,
      'totalOrders',         v_total,
      'filteredTotalOrders', COALESCE(v_filtered_total, 0),
      'layout',              'countryTag',
      'countryGroups',       COALESCE(v_result, '[]'::jsonb)
    );
  END IF;

  -- daysCountrySubgroup layout — compute days from the correct date column per group
  WITH source AS (
    SELECT
      p.order_id,
      normalize_ops_country(p.country) AS country,
      p.tag,
      p.title,
      CASE
        WHEN p_group_id = 'confirmationPending' THEN
          CASE WHEN p.confirmation_date IS NOT NULL
            THEN GREATEST(0, v_today - (p.confirmation_date AT TIME ZONE 'America/Los_Angeles')::DATE)
            ELSE NULL
          END
        WHEN p_group_id = ANY(ARRAY['approved', 'dispatching']) THEN
          CASE WHEN p.approved_date IS NOT NULL
            THEN GREATEST(0, v_today - (p.approved_date AT TIME ZONE 'America/Los_Angeles')::DATE)
            ELSE NULL
          END
        WHEN p_group_id = 'shipped' THEN
          CASE WHEN p.shipment_date_log IS NOT NULL
            THEN GREATEST(0, v_today - (p.shipment_date_log AT TIME ZONE 'America/Los_Angeles')::DATE)
            ELSE NULL
          END
        WHEN p_group_id = 'undelivered' THEN
          CASE WHEN p.undelivered_date IS NOT NULL
            THEN GREATEST(0, v_today - (p.undelivered_date AT TIME ZONE 'America/Los_Angeles')::DATE)
            ELSE NULL
          END
        ELSE
          CASE WHEN p.order_date IS NOT NULL
            THEN GREATEST(0, v_today - (p.order_date AT TIME ZONE 'America/Los_Angeles')::DATE)
            ELSE NULL
          END
      END AS days,
      CASE WHEN v_group_by = 'title' THEN p.title ELSE p.tag END AS subgroup_label
    FROM (
      SELECT
        d.order_id, d.country, d.tag, d.title,
        d.order_date, d.shipment_date_log, d.approved_date,
        d.shipment_date, d.undelivered_date, d.confirmation_date,
        d.order_date_day, d.bifurcation, d.store_id, d.status
      FROM ops_orders_order_detail d
      WHERE v_group_by = 'tag'
        AND d.status = ANY(v_statuses)
      UNION ALL
      SELECT
        p.order_id, p.country, p.tag, p.title,
        p.order_date, p.shipment_date_log, p.approved_date,
        p.shipment_date, p.undelivered_date, p.confirmation_date,
        p.order_date_day, p.bifurcation, p.store_id, p.status
      FROM ops_orders_product_rollup p
      WHERE v_group_by = 'title'
        AND p.status = ANY(v_statuses)
    ) p
    WHERE
      (p_from_date IS NULL OR p.order_date_day >= p_from_date)
      AND (p_to_date IS NULL OR p.order_date_day <= p_to_date)
      AND (p_store_id IS NULL OR p.store_id = p_store_id)
      AND (
        (NULLIF(TRIM(p_country), '') IS NOT NULL AND ops_country_matches(p_country, p.country))
        OR (
          NULLIF(TRIM(p_country), '') IS NULL
          AND p.country IS NOT NULL AND TRIM(p.country) <> '' AND p.country <> 'Unknown'
        )
      )
      AND (
        (NULLIF(TRIM(p_bifurcation), '') IS NOT NULL AND p.bifurcation = NULLIF(TRIM(p_bifurcation), ''))
        OR (
          NULLIF(TRIM(p_bifurcation), '') IS NULL
          AND p.bifurcation IS NOT NULL AND TRIM(p.bifurcation) <> ''
        )
      )
  ),
  subgroup_rows AS (
    SELECT
      days,
      country,
      subgroup_label,
      array_agg(DISTINCT order_id ORDER BY order_id) AS order_ids,
      COUNT(DISTINCT order_id)::INTEGER AS orders
    FROM source
    GROUP BY days, country, subgroup_label
  ),
  country_rows AS (
    SELECT
      days,
      country,
      SUM(orders)::INTEGER AS orders,
      jsonb_agg(
        jsonb_build_object(
          'label', subgroup_label,
          'orders', orders,
          'orderIds', to_jsonb(order_ids)
        )
        ORDER BY orders DESC, subgroup_label
      ) AS subgroups
    FROM subgroup_rows
    GROUP BY days, country
  ),
  day_rows AS (
    SELECT
      days,
      SUM(orders)::INTEGER AS orders,
      jsonb_agg(
        jsonb_build_object(
          'country', country,
          'orders', orders,
          'subgroups', subgroups
        )
        ORDER BY orders DESC, country
      ) AS countries
    FROM country_rows
    GROUP BY days
  )
  SELECT
    COALESCE(SUM(orders), 0)::INTEGER,
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'days',  days,
        'label', CASE
          WHEN days IS NULL THEN 'No date'
          WHEN days = 0     THEN 'Today'
          WHEN days = 1     THEN '1 day'
          ELSE days::TEXT || ' days'
        END,
        'orders',    orders,
        'countries', countries
      )
      ORDER BY days DESC NULLS LAST
    ), '[]'::jsonb)
  INTO v_total, v_result
  FROM day_rows;

  RETURN jsonb_build_object(
    'groupId',             p_group_id,
    'title',               v_title,
    'groupBy',             v_group_by,
    'daysFrom',            v_days_from_label,
    'totalOrders',         v_total,
    'filteredTotalOrders', COALESCE(v_filtered_total, 0),
    'layout',              'daysCountrySubgroup',
    'dayBuckets',          COALESCE(v_result, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION get_ops_orders_status_detail IS
  'KPI drill-down: aging date per group — confirmationDate, approvedDate, shipmentDateLog, undeliveredDate, orderDate.';

COMMENT ON MATERIALIZED VIEW ops_orders_order_detail IS
  'One row per order for status drill-down — includes all date fields for per-group aging.';
COMMENT ON MATERIALIZED VIEW ops_orders_product_rollup IS
  'Order × product title rows for Store Visibility and Approved/Dispatching drill-down.';

-- ── 5. Rebuild ops_orders_sla_rollup to use shipment_date_log for ship SLA ───
-- The previous definition used shipment_date; all ship SLA metrics must now
-- use shipment_date_log for accuracy.

DROP MATERIALIZED VIEW IF EXISTS ops_orders_sla_rollup CASCADE;

CREATE MATERIALIZED VIEW ops_orders_sla_rollup AS
WITH per_order AS (
  SELECT
    order_id,
    order_date_day,
    COALESCE(country, 'Unknown') AS country,
    COALESCE(bifurcation, '') AS bifurcation,
    COALESCE(store_id, 0) AS store_id,
    MIN(order_date) AS order_date,
    MIN(approved_date) AS approved_date,
    MIN(delivered_date) AS delivered_date,
    MIN(returned_date) AS returned_date,
    MIN(final_action_date_undelivered) AS final_action_date_undelivered,
    MIN(shipment_date_log) AS shipment_date_log
  FROM ops_orders_items
  WHERE order_id IS NOT NULL AND order_date_day IS NOT NULL
  GROUP BY order_id, order_date_day, country, bifurcation, store_id
),
sla_days AS (
  SELECT
    order_date_day,
    country,
    bifurcation,
    store_id,
    CASE
      WHEN approved_date IS NOT NULL AND order_date IS NOT NULL
      THEN (approved_date::date - order_date::date)
    END AS confirm_days,
    CASE
      WHEN delivered_date IS NOT NULL AND order_date IS NOT NULL
      THEN (delivered_date::date - order_date::date)
    END AS deliver_days,
    CASE
      WHEN returned_date IS NOT NULL
        AND final_action_date_undelivered IS NOT NULL
        AND returned_date::date >= final_action_date_undelivered::date
      THEN (returned_date::date - final_action_date_undelivered::date)
    END AS return_days,
    CASE
      WHEN shipment_date_log IS NOT NULL AND order_date IS NOT NULL
      THEN (shipment_date_log::date - order_date::date)
    END AS ship_days,
    CASE
      WHEN shipment_date_log IS NOT NULL AND order_date IS NOT NULL
        AND (shipment_date_log::date - order_date::date) <= 2
      THEN 1
      ELSE 0
    END AS shipped_within_48h
  FROM per_order
)
SELECT
  order_date_day,
  country,
  bifurcation,
  store_id,
  COALESCE(SUM(confirm_days), 0)::BIGINT AS confirm_days_sum,
  COUNT(confirm_days)::INTEGER AS confirm_count,
  COALESCE(SUM(deliver_days), 0)::BIGINT AS deliver_days_sum,
  COUNT(deliver_days)::INTEGER AS deliver_count,
  COALESCE(SUM(return_days), 0)::BIGINT AS return_days_sum,
  COUNT(return_days)::INTEGER AS return_count,
  COALESCE(SUM(ship_days), 0)::BIGINT AS ship_days_sum,
  COUNT(ship_days)::INTEGER AS ship_count,
  COALESCE(SUM(shipped_within_48h), 0)::INTEGER AS shipped_within_48h_count
FROM sla_days
GROUP BY order_date_day, country, bifurcation, store_id;

CREATE UNIQUE INDEX idx_ops_orders_sla_rollup_unique
  ON ops_orders_sla_rollup(order_date_day, country, bifurcation, store_id);

COMMENT ON MATERIALIZED VIEW ops_orders_sla_rollup IS
  'SLA day aggregates — ship SLA now uses shipment_date_log instead of shipment_date.';

-- After running this patch, refresh the MVs:
-- SELECT refresh_ops_orders_summaries_simple();
