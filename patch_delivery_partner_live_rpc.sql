-- Delivery partner chart: live aggregates + tracking-aware Blank / Unknown / Unassigned labels.
-- Run after deploying sync code, then re-sync orders from Metabase.
-- Requires patch_country_normalization.sql (normalize_ops_country / ops_country_matches).

ALTER TABLE ops_orders_items
  ADD COLUMN IF NOT EXISTS courier_tracking_id TEXT;

COMMENT ON COLUMN ops_orders_items.courier_tracking_id IS
  'Courier or system tracking id from Metabase (Courier_tracking_id / System_gen_tracking_id).';

CREATE OR REPLACE FUNCTION resolve_ops_delivery_partner_chart_label(
  p_delivery_partner TEXT,
  p_courier_tracking_id TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN NULLIF(TRIM(p_courier_tracking_id), '') IS NOT NULL THEN
      CASE
        WHEN NULLIF(TRIM(p_delivery_partner), '') IS NULL THEN 'Blank'
        WHEN LOWER(TRIM(p_delivery_partner)) = 'unknown' THEN 'Unknown'
        ELSE TRIM(p_delivery_partner)
      END
    ELSE
      CASE
        WHEN NULLIF(TRIM(p_delivery_partner), '') IS NULL THEN 'Unassigned'
        WHEN LOWER(TRIM(p_delivery_partner)) = 'unknown' THEN 'Unknown'
        ELSE TRIM(p_delivery_partner)
      END
  END;
$$;

CREATE OR REPLACE FUNCTION get_ops_orders_delivery_partner_summary(
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
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'country', country,
        'delivery_partner', delivery_partner,
        'status', status,
        'order_count', order_count,
        'revenue_usd', revenue_usd,
        'units', units
      )
      ORDER BY country, delivery_partner, status
    ),
    '[]'::jsonb
  )
  FROM (
    WITH filtered AS (
      SELECT o.*
      FROM ops_orders_items o
      WHERE
        o.order_id IS NOT NULL
        AND o.order_date_day IS NOT NULL
        AND (p_store_id IS NULL OR o.store_id = p_store_id)
        AND (p_from_date IS NULL OR o.order_date_day >= p_from_date)
        AND (p_to_date IS NULL OR o.order_date_day <= p_to_date)
        AND (
          (NULLIF(TRIM(p_country), '') IS NOT NULL AND ops_country_matches(p_country, o.country))
          OR (
            NULLIF(TRIM(p_country), '') IS NULL
            AND o.country IS NOT NULL
            AND TRIM(o.country) <> ''
          )
        )
        AND (
          (NULLIF(TRIM(p_bifurcation), '') IS NOT NULL AND o.bifurcation = NULLIF(TRIM(p_bifurcation), ''))
          OR (
            NULLIF(TRIM(p_bifurcation), '') IS NULL
            AND o.bifurcation IS NOT NULL
            AND TRIM(o.bifurcation) <> ''
          )
        )
    ),
    per_order AS (
      SELECT
        order_id,
        order_date_day,
        normalize_ops_country(country) AS country,
        COALESCE(bifurcation, '') AS bifurcation,
        COALESCE(store_id, 0) AS store_id,
        resolve_ops_delivery_partner_chart_label(
          (ARRAY_AGG(delivery_partner ORDER BY id))[1],
          (ARRAY_AGG(courier_tracking_id ORDER BY id))[1]
        ) AS delivery_partner,
        COALESCE(NULLIF(TRIM((ARRAY_AGG(status ORDER BY id))[1]), ''), 'Unknown') AS status,
        SUM(COALESCE(usd_revenue, 0))::NUMERIC(14, 4) AS revenue_usd,
        SUM(COALESCE(quantity, 0))::INTEGER AS units
      FROM filtered
      GROUP BY order_id, order_date_day, country, bifurcation, store_id
    )
    SELECT
      country,
      delivery_partner,
      status,
      COUNT(*)::INTEGER AS order_count,
      SUM(revenue_usd) AS revenue_usd,
      SUM(units)::INTEGER AS units
    FROM per_order
    WHERE country <> 'Unknown'
    GROUP BY country, delivery_partner, status
  ) s;
$$;

COMMENT ON FUNCTION get_ops_orders_delivery_partner_summary IS
  'Live delivery partner chart: Blank = tracking without courier name; Unknown = tracking + unknown courier; Unassigned = no tracking yet.';
