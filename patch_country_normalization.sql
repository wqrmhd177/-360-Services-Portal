-- Club country name variants (UAE / United Arab Emirates, KSA / Saudi Arabia / Saudia Arabia).
-- Run in Supabase SQL Editor (safe to re-run).

CREATE OR REPLACE FUNCTION normalize_ops_country(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN raw IS NULL OR TRIM(raw) = '' THEN 'Unknown'
    WHEN LOWER(REGEXP_REPLACE(TRIM(raw), '\s+', ' ', 'g')) IN (
      'uae', 'united arab emirates', 'u.a.e.', 'u.a.e'
    ) THEN 'United Arab Emirates'
    WHEN LOWER(REGEXP_REPLACE(TRIM(raw), '\s+', ' ', 'g')) IN (
      'ksa', 'saudi arabia', 'saudia arabia', 'kingdom of saudi arabia'
    )
      OR LOWER(REGEXP_REPLACE(TRIM(raw), '\s+', ' ', 'g')) LIKE '%saudi arabia%'
      OR LOWER(REGEXP_REPLACE(TRIM(raw), '\s+', ' ', 'g')) LIKE '%saudia arabia%'
      THEN 'Saudi Arabia'
    ELSE TRIM(raw)
  END;
$$;

CREATE OR REPLACE FUNCTION ops_country_matches(p_filter TEXT, p_country TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    NULLIF(TRIM(p_filter), '') IS NOT NULL
    AND normalize_ops_country(p_country) = normalize_ops_country(p_filter);
$$;

CREATE OR REPLACE FUNCTION get_ops_orders_filter_options_v2()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'countries', COALESCE((
      SELECT jsonb_agg(c.country ORDER BY c.country)
      FROM (
        SELECT DISTINCT normalize_ops_country(country) AS country
        FROM ops_orders_items
        WHERE country IS NOT NULL AND TRIM(country) <> ''
      ) c
      WHERE c.country <> 'Unknown'
    ), '[]'::jsonb),
    'bifurcations', COALESCE((
      SELECT jsonb_agg(b.bifurcation ORDER BY b.bifurcation)
      FROM (
        SELECT DISTINCT bifurcation
        FROM ops_orders_items
        WHERE bifurcation IS NOT NULL AND TRIM(bifurcation) <> ''
      ) b
    ), '[]'::jsonb),
    'storeIds', COALESCE((
      SELECT jsonb_agg(s.store_id ORDER BY s.store_id)
      FROM (
        SELECT DISTINCT store_id
        FROM ops_orders_items
        WHERE store_id IS NOT NULL AND store_id > 0
      ) s
    ), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION get_ops_orders_filtered_enriched(
  p_country     TEXT DEFAULT NULL,
  p_bifurcation TEXT DEFAULT NULL,
  p_store_id    BIGINT DEFAULT NULL,
  p_from_date   DATE DEFAULT NULL,
  p_to_date     DATE DEFAULT NULL
)
RETURNS SETOF ops_orders_items
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT o.*
  FROM ops_orders_items o
  WHERE
    o.order_id IS NOT NULL
    AND (p_store_id IS NULL OR o.store_id = p_store_id)
    AND (p_from_date IS NULL OR o.order_date_day >= p_from_date)
    AND (p_to_date IS NULL OR o.order_date_day <= p_to_date)
    AND (
      (NULLIF(TRIM(p_country), '') IS NOT NULL AND ops_country_matches(p_country, o.country))
      OR (NULLIF(TRIM(p_country), '') IS NULL AND o.country IS NOT NULL AND TRIM(o.country) <> '')
    )
    AND (
      (NULLIF(TRIM(p_bifurcation), '') IS NOT NULL AND o.bifurcation = NULLIF(TRIM(p_bifurcation), ''))
      OR (NULLIF(TRIM(p_bifurcation), '') IS NULL AND o.bifurcation IS NOT NULL AND TRIM(o.bifurcation) <> '')
    )
  ORDER BY o.id;
$$;

CREATE OR REPLACE FUNCTION get_ops_orders_counts(
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
  SELECT jsonb_build_object(
    'filteredCount', (
      SELECT COUNT(DISTINCT o.order_id)::INTEGER
      FROM ops_orders_items o
      WHERE
        o.order_id IS NOT NULL
        AND (p_store_id IS NULL OR o.store_id = p_store_id)
        AND (p_from_date IS NULL OR o.order_date_day >= p_from_date)
        AND (p_to_date IS NULL OR o.order_date_day <= p_to_date)
        AND (
          (NULLIF(TRIM(p_country), '') IS NOT NULL AND ops_country_matches(p_country, o.country))
          OR (NULLIF(TRIM(p_country), '') IS NULL AND o.country IS NOT NULL AND TRIM(o.country) <> '')
        )
        AND (
          (NULLIF(TRIM(p_bifurcation), '') IS NOT NULL AND o.bifurcation = NULLIF(TRIM(p_bifurcation), ''))
          OR (NULLIF(TRIM(p_bifurcation), '') IS NULL AND o.bifurcation IS NOT NULL AND TRIM(o.bifurcation) <> '')
        )
    )
  );
$$;

CREATE OR REPLACE FUNCTION get_ops_orders_status_counts(
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
      jsonb_build_object('status', status, 'order_count', cnt)
      ORDER BY status
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT r.status, SUM(r.order_count)::INTEGER AS cnt
    FROM ops_orders_status_rollup r
    WHERE
      (p_from_date IS NULL OR r.order_date_day >= p_from_date)
      AND (p_to_date IS NULL OR r.order_date_day <= p_to_date)
      AND (p_store_id IS NULL OR r.store_id = p_store_id)
      AND (
        (NULLIF(TRIM(p_country), '') IS NOT NULL AND ops_country_matches(p_country, r.country))
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
    GROUP BY r.status
  ) s;
$$;

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
      normalize_ops_country(r.country) AS country,
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
        (NULLIF(TRIM(p_country), '') IS NOT NULL AND ops_country_matches(p_country, r.country))
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
    GROUP BY normalize_ops_country(r.country)
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
      normalize_ops_country(r.country) AS country,
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
        (NULLIF(TRIM(p_country), '') IS NOT NULL AND ops_country_matches(p_country, r.country))
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
    GROUP BY normalize_ops_country(r.country), r.delivery_partner, r.status
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
        (NULLIF(TRIM(p_country), '') IS NOT NULL AND ops_country_matches(p_country, r.country))
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
