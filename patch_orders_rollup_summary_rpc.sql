-- Aggregate rollup MVs in SQL instead of paginating thousands of rows to Node.js.
-- Run in Supabase SQL Editor (safe to re-run).

CREATE OR REPLACE FUNCTION get_ops_orders_sla_summary(
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
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'country', country,
        'confirm_days_sum', confirm_days_sum,
        'confirm_count', confirm_count,
        'deliver_days_sum', deliver_days_sum,
        'deliver_count', deliver_count,
        'return_days_sum', return_days_sum,
        'return_count', return_count,
        'ship_days_sum', ship_days_sum,
        'ship_count', ship_count,
        'shipped_within_48h_count', shipped_within_48h_count
      )
      ORDER BY country
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT
      r.country,
      COALESCE(SUM(r.confirm_days_sum), 0)::BIGINT AS confirm_days_sum,
      COALESCE(SUM(r.confirm_count), 0)::INTEGER AS confirm_count,
      COALESCE(SUM(r.deliver_days_sum), 0)::BIGINT AS deliver_days_sum,
      COALESCE(SUM(r.deliver_count), 0)::INTEGER AS deliver_count,
      COALESCE(SUM(r.return_days_sum), 0)::BIGINT AS return_days_sum,
      COALESCE(SUM(r.return_count), 0)::INTEGER AS return_count,
      COALESCE(SUM(r.ship_days_sum), 0)::BIGINT AS ship_days_sum,
      COALESCE(SUM(r.ship_count), 0)::INTEGER AS ship_count,
      COALESCE(SUM(r.shipped_within_48h_count), 0)::INTEGER AS shipped_within_48h_count
    FROM ops_orders_sla_rollup r
    WHERE
      (p_from_date IS NULL OR r.order_date_day >= p_from_date)
      AND (p_to_date IS NULL OR r.order_date_day <= p_to_date)
      AND (p_store_id IS NULL OR r.store_id = p_store_id)
      AND (
        (NULLIF(TRIM(p_country), '') IS NOT NULL AND r.country = NULLIF(TRIM(p_country), ''))
        OR (
          NULLIF(TRIM(p_country), '') IS NULL
          AND r.country IS NOT NULL
          AND TRIM(r.country) <> ''
          AND r.country <> 'Unknown'
        )
      )
      AND (
        (NULLIF(TRIM(p_bifurcation), '') IS NOT NULL AND r.bifurcation = NULLIF(TRIM(p_bifurcation), ''))
        OR (
          NULLIF(TRIM(p_bifurcation), '') IS NULL
          AND r.bifurcation IS NOT NULL
          AND TRIM(r.bifurcation) <> ''
        )
      )
    GROUP BY r.country
  ) s;
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
    SELECT
      r.country,
      r.delivery_partner,
      r.status,
      SUM(r.order_count)::INTEGER AS order_count,
      SUM(r.revenue_usd) AS revenue_usd,
      SUM(r.units)::INTEGER AS units
    FROM ops_orders_delivery_partner_rollup r
    WHERE
      (p_from_date IS NULL OR r.order_date_day >= p_from_date)
      AND (p_to_date IS NULL OR r.order_date_day <= p_to_date)
      AND (p_store_id IS NULL OR r.store_id = p_store_id)
      AND (
        (NULLIF(TRIM(p_country), '') IS NOT NULL AND r.country = NULLIF(TRIM(p_country), ''))
        OR (
          NULLIF(TRIM(p_country), '') IS NULL
          AND r.country IS NOT NULL
          AND TRIM(r.country) <> ''
          AND r.country <> 'Unknown'
        )
      )
      AND (
        (NULLIF(TRIM(p_bifurcation), '') IS NOT NULL AND r.bifurcation = NULLIF(TRIM(p_bifurcation), ''))
        OR (
          NULLIF(TRIM(p_bifurcation), '') IS NULL
          AND r.bifurcation IS NOT NULL
          AND TRIM(r.bifurcation) <> ''
        )
      )
    GROUP BY r.country, r.delivery_partner, r.status
  ) s;
$$;

CREATE OR REPLACE FUNCTION get_ops_orders_revenue_loss_summary(
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
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'tag', tag,
        'dispatch_label', dispatch_label,
        'order_count', order_count,
        'revenue_usd', revenue_usd,
        'units', units
      )
      ORDER BY tag, dispatch_label
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT
      r.tag,
      r.dispatch_label,
      SUM(r.order_count)::INTEGER AS order_count,
      SUM(r.revenue_usd) AS revenue_usd,
      SUM(r.units)::INTEGER AS units
    FROM ops_orders_revenue_loss_rollup r
    WHERE
      (p_from_date IS NULL OR r.order_date_day >= p_from_date)
      AND (p_to_date IS NULL OR r.order_date_day <= p_to_date)
      AND (p_store_id IS NULL OR r.store_id = p_store_id)
      AND (
        (NULLIF(TRIM(p_country), '') IS NOT NULL AND r.country = NULLIF(TRIM(p_country), ''))
        OR (
          NULLIF(TRIM(p_country), '') IS NULL
          AND r.country IS NOT NULL
          AND TRIM(r.country) <> ''
          AND r.country <> 'Unknown'
        )
      )
      AND (
        (NULLIF(TRIM(p_bifurcation), '') IS NOT NULL AND r.bifurcation = NULLIF(TRIM(p_bifurcation), ''))
        OR (
          NULLIF(TRIM(p_bifurcation), '') IS NULL
          AND r.bifurcation IS NOT NULL
          AND TRIM(r.bifurcation) <> ''
        )
      )
    GROUP BY r.tag, r.dispatch_label
  ) s;
$$;
