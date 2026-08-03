-- KPI drill-down enhancements: bifurcation sidebar counts + User/SKU order grouping.
-- Run AFTER patch_kpi_date_fixes.sql (step 11).
-- Requires: patch_country_normalization.sql, setup_operations_cache.sql (channel list).

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
SET search_path = public
AS $$
DECLARE
  v_statuses TEXT[];
  v_group_by TEXT;
  v_days_from_label TEXT;
  v_layout   TEXT;
  v_title    TEXT;
  v_total    INTEGER;
  v_filtered_total INTEGER;
  v_result   JSONB;
  v_country_summaries JSONB;
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
    WITH channel_by_store AS (
      SELECT DISTINCT ON (store_id)
        store_id,
        user_id
      FROM ops_channel_list_items
      WHERE store_id IS NOT NULL
      ORDER BY store_id, synced_at DESC NULLS LAST, id DESC
    ),
    filtered AS (
      SELECT
        d.order_id,
        normalize_ops_country(d.country) AS country,
        d.tag,
        COALESCE(NULLIF(TRIM(d.bifurcation), ''), 'Unknown') AS bifurcation,
        COALESCE(d.store_id, 0) AS store_id
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
    line_details AS (
      SELECT DISTINCT
        f.country,
        f.tag,
        f.bifurcation,
        f.order_id,
        COALESCE(NULLIF(TRIM(UPPER(oi.sku)), ''), 'No SKU') AS sku,
        COALESCE(cl.user_id, 0) AS user_id
      FROM filtered f
      INNER JOIN ops_orders_items oi ON oi.order_id = f.order_id
      LEFT JOIN channel_by_store cl ON cl.store_id = COALESCE(NULLIF(oi.store_id, 0), f.store_id)
      WHERE oi.order_id IS NOT NULL
    ),
    sku_groups AS (
      SELECT
        country,
        tag,
        user_id,
        sku,
        bifurcation,
        array_agg(DISTINCT order_id ORDER BY order_id) AS order_ids
      FROM line_details
      GROUP BY country, tag, user_id, sku, bifurcation
    ),
    user_groups AS (
      SELECT
        country,
        tag,
        user_id,
        jsonb_agg(
          jsonb_build_object(
            'sku', sku,
            'bifurcation', bifurcation,
            'orderIds', to_jsonb(order_ids)
          )
          ORDER BY array_length(order_ids, 1) DESC NULLS LAST, sku
        ) AS skus
      FROM sku_groups
      GROUP BY country, tag, user_id
    ),
    tag_order_groups AS (
      SELECT
        country,
        tag,
        jsonb_agg(
          jsonb_build_object(
            'userId', CASE WHEN user_id = 0 THEN NULL ELSE user_id END,
            'skus', skus
          )
          ORDER BY user_id
        ) AS order_groups
      FROM user_groups
      GROUP BY country, tag
    ),
    tag_rows AS (
      SELECT
        ld.country,
        ld.tag,
        array_agg(DISTINCT ld.order_id ORDER BY ld.order_id) AS order_ids,
        COUNT(DISTINCT ld.order_id)::INTEGER AS orders,
        COALESCE(tog.order_groups, '[]'::JSONB) AS order_groups
      FROM line_details ld
      LEFT JOIN tag_order_groups tog
        ON tog.country = ld.country
        AND tog.tag = ld.tag
      GROUP BY ld.country, ld.tag, tog.order_groups
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
            'orderIds', to_jsonb(tr.order_ids),
            'orderGroups', tr.order_groups
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
    ),
    country_bifurcation AS (
      SELECT
        country,
        bifurcation,
        COUNT(DISTINCT order_id)::INTEGER AS orders
      FROM filtered
      GROUP BY country, bifurcation
    ),
    country_summary_rows AS (
      SELECT
        country,
        SUM(orders)::INTEGER AS orders,
        jsonb_agg(
          jsonb_build_object('bifurcation', bifurcation, 'orders', orders)
          ORDER BY orders DESC, bifurcation
        ) AS bifurcations
      FROM country_bifurcation
      GROUP BY country
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
      ), '[]'::jsonb),
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'country', country,
            'orders', orders,
            'bifurcations', bifurcations
          )
          ORDER BY orders DESC, country
        )
        FROM country_summary_rows
      ), '[]'::jsonb)
    INTO v_total, v_result, v_country_summaries
    FROM country_rows;

    RETURN jsonb_build_object(
      'groupId',             p_group_id,
      'title',               v_title,
      'groupBy',             v_group_by,
      'daysFrom',            v_days_from_label,
      'totalOrders',         v_total,
      'filteredTotalOrders', COALESCE(v_filtered_total, 0),
      'layout',              'countryTag',
      'countryGroups',       COALESCE(v_result, '[]'::jsonb),
      'countrySummaries',    COALESCE(v_country_summaries, '[]'::jsonb)
    );
  END IF;

  -- daysCountrySubgroup layout
  WITH channel_by_store AS (
    SELECT DISTINCT ON (store_id)
      store_id,
      user_id
    FROM ops_channel_list_items
    WHERE store_id IS NOT NULL
    ORDER BY store_id, synced_at DESC NULLS LAST, id DESC
  ),
  source AS (
    SELECT
      p.order_id,
      normalize_ops_country(p.country) AS country,
      COALESCE(NULLIF(TRIM(p.bifurcation), ''), 'Unknown') AS bifurcation,
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
      CASE WHEN v_group_by = 'title' THEN p.title ELSE p.tag END AS subgroup_label,
      COALESCE(p.store_id, 0) AS store_id
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
        pr.order_id, pr.country, pr.tag, pr.title,
        pr.order_date, pr.shipment_date_log, pr.approved_date,
        pr.shipment_date, pr.undelivered_date, pr.confirmation_date,
        pr.order_date_day, pr.bifurcation, pr.store_id, pr.status
      FROM ops_orders_product_rollup pr
      WHERE v_group_by = 'title'
        AND pr.status = ANY(v_statuses)
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
  line_details AS (
    SELECT DISTINCT
      s.days,
      s.country,
      s.subgroup_label,
      s.bifurcation,
      s.order_id,
      COALESCE(NULLIF(TRIM(UPPER(oi.sku)), ''), 'No SKU') AS sku,
      COALESCE(cl.user_id, 0) AS user_id
    FROM source s
    INNER JOIN ops_orders_items oi ON oi.order_id = s.order_id
    LEFT JOIN channel_by_store cl ON cl.store_id = COALESCE(NULLIF(oi.store_id, 0), s.store_id)
    WHERE oi.order_id IS NOT NULL
  ),
  sku_groups AS (
    SELECT
      days,
      country,
      subgroup_label,
      user_id,
      sku,
      bifurcation,
      array_agg(DISTINCT order_id ORDER BY order_id) AS order_ids
    FROM line_details
    GROUP BY days, country, subgroup_label, user_id, sku, bifurcation
  ),
  user_groups AS (
    SELECT
      days,
      country,
      subgroup_label,
      user_id,
      jsonb_agg(
        jsonb_build_object(
          'sku', sku,
          'bifurcation', bifurcation,
          'orderIds', to_jsonb(order_ids)
        )
        ORDER BY array_length(order_ids, 1) DESC NULLS LAST, sku
      ) AS skus
    FROM sku_groups
    GROUP BY days, country, subgroup_label, user_id
  ),
  subgroup_order_groups AS (
    SELECT
      days,
      country,
      subgroup_label,
      jsonb_agg(
        jsonb_build_object(
          'userId', CASE WHEN user_id = 0 THEN NULL ELSE user_id END,
          'skus', skus
        )
        ORDER BY user_id
      ) AS order_groups
    FROM user_groups
    GROUP BY days, country, subgroup_label
  ),
  subgroup_rows AS (
    SELECT
      s.days,
      s.country,
      s.subgroup_label,
      array_agg(DISTINCT s.order_id ORDER BY s.order_id) AS order_ids,
      COUNT(DISTINCT s.order_id)::INTEGER AS orders,
      COALESCE(sog.order_groups, '[]'::JSONB) AS order_groups
    FROM source s
    LEFT JOIN subgroup_order_groups sog
      ON sog.days IS NOT DISTINCT FROM s.days
      AND sog.country = s.country
      AND sog.subgroup_label = s.subgroup_label
    GROUP BY s.days, s.country, s.subgroup_label, sog.order_groups
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
          'orderIds', to_jsonb(order_ids),
          'orderGroups', order_groups
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
  ),
  country_bifurcation AS (
    SELECT
      country,
      bifurcation,
      COUNT(DISTINCT order_id)::INTEGER AS orders
    FROM source
    GROUP BY country, bifurcation
  ),
  country_summary_rows AS (
    SELECT
      country,
      SUM(orders)::INTEGER AS orders,
      jsonb_agg(
        jsonb_build_object('bifurcation', bifurcation, 'orders', orders)
        ORDER BY orders DESC, bifurcation
      ) AS bifurcations
    FROM country_bifurcation
    GROUP BY country
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
    ), '[]'::jsonb),
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'country', country,
          'orders', orders,
          'bifurcations', bifurcations
        )
        ORDER BY orders DESC, country
      )
      FROM country_summary_rows
    ), '[]'::jsonb)
  INTO v_total, v_result, v_country_summaries
  FROM day_rows;

  RETURN jsonb_build_object(
    'groupId',             p_group_id,
    'title',               v_title,
    'groupBy',             v_group_by,
    'daysFrom',            v_days_from_label,
    'totalOrders',         v_total,
    'filteredTotalOrders', COALESCE(v_filtered_total, 0),
    'layout',              'daysCountrySubgroup',
    'dayBuckets',          COALESCE(v_result, '[]'::jsonb),
    'countrySummaries',    COALESCE(v_country_summaries, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION get_ops_orders_status_detail IS
  'KPI drill-down with bifurcation sidebar counts and User/SKU order grouping.';
