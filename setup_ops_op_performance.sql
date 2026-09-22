-- OP Performance facts + analytics RPC.
-- Run in Supabase SQL editor. Safe to re-run.
--
-- Raw Data column map (OP - Performance workbook):
--   C Upsell Agreed, D Upsell Pitched, F Order Date, G Tags (OP team/queue),
--   H Unique Order ID, M Country, AF Status, AI OP_remarks ("Team A" = lucky draw pitched).
-- Optional stored (not PII): A NDR Date, E CS Status, I order_number.

CREATE TABLE IF NOT EXISTS ops_op_facts (
  source_id           BIGINT PRIMARY KEY,
  order_number        TEXT,
  order_date          DATE,
  ndr_date            DATE,
  reschedule_check    TEXT,
  upsell_agreed       BOOLEAN,
  upsell_pitched      BOOLEAN,
  cs_status           TEXT,
  op_tag              TEXT,
  country             TEXT,
  status              TEXT,
  sku                 TEXT,
  lucky_draw_pitched  BOOLEAN,
  op_remarks          TEXT,
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_op_facts_order_date ON ops_op_facts (order_date);
CREATE INDEX IF NOT EXISTS idx_ops_op_facts_country ON ops_op_facts (country);
CREATE INDEX IF NOT EXISTS idx_ops_op_facts_op_tag ON ops_op_facts (op_tag);

ALTER TABLE ops_op_facts ADD COLUMN IF NOT EXISTS lucky_draw_pitched BOOLEAN;
ALTER TABLE ops_op_facts ADD COLUMN IF NOT EXISTS op_remarks TEXT;

ALTER TABLE ops_op_facts DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE ops_op_facts IS
  'OP Performance Raw Data (order grain). C agreed, D pitched, F order_date, G op_tag, H source_id, M country, AF status, AI Team A = lucky draw. PII is not stored.';

GRANT ALL ON TABLE ops_op_facts TO service_role;

-- Extend country clubbing used by analytics filters.
CREATE OR REPLACE FUNCTION normalize_ops_country(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN raw IS NULL OR TRIM(raw) = '' THEN 'Unknown'
    WHEN LOWER(REGEXP_REPLACE(TRIM(raw), '\s+', ' ', 'g')) IN (
      'uae', 'united arab emirates', 'united arab emirate', 'u.a.e.', 'u.a.e'
    ) OR LOWER(REGEXP_REPLACE(TRIM(raw), '\s+', ' ', 'g')) LIKE 'united arab emirat%'
      THEN 'United Arab Emirates'
    WHEN LOWER(REGEXP_REPLACE(TRIM(raw), '\s+', ' ', 'g')) IN (
      'ksa', 'saudi arabia', 'saudia arabia', 'kingdom of saudi arabia', 'saudi arab'
    )
      OR LOWER(REGEXP_REPLACE(TRIM(raw), '\s+', ' ', 'g')) LIKE '%saudi arab%'
      THEN 'Saudi Arabia'
    WHEN LOWER(REGEXP_REPLACE(TRIM(raw), '\s+', ' ', 'g')) IN (
      'pak', 'pakistan', 'pk'
    ) THEN 'Pakistan'
    WHEN LOWER(REGEXP_REPLACE(TRIM(raw), '\s+', ' ', 'g')) IN (
      'usa', 'us', 'u.s.a.', 'u.s.', 'united states', 'united states of america'
    ) THEN 'United States'
    WHEN LOWER(REGEXP_REPLACE(TRIM(raw), '\s+', ' ', 'g')) IN ('qatar', 'qa', 'state of qatar')
      THEN 'Qatar'
    WHEN LOWER(REGEXP_REPLACE(TRIM(raw), '\s+', ' ', 'g')) IN ('oman', 'om', 'sultanate of oman')
      THEN 'Oman'
    WHEN LOWER(REGEXP_REPLACE(TRIM(raw), '\s+', ' ', 'g')) IN ('bahrain', 'bh', 'kingdom of bahrain')
      THEN 'Bahrain'
    WHEN LOWER(REGEXP_REPLACE(TRIM(raw), '\s+', ' ', 'g')) IN ('iraq', 'iq')
      THEN 'Iraq'
    WHEN LOWER(REGEXP_REPLACE(TRIM(raw), '\s+', ' ', 'g')) IN ('kuwait', 'kw', 'state of kuwait')
      THEN 'Kuwait'
    ELSE TRIM(raw)
  END;
$$;

CREATE OR REPLACE FUNCTION ops_op_team_label(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(TRIM(REGEXP_REPLACE(TRIM(COALESCE(raw, '')), '^\d+\s+', '')), ''),
    'Untagged'
  );
$$;

CREATE OR REPLACE FUNCTION get_ops_op_performance(
  p_country TEXT DEFAULT NULL,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  v_today DATE;
  v_last_from DATE;
  v_last_to DATE;
  v_prev_from DATE;
  v_prev_to DATE;
  v_span INT;
BEGIN
  v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Los_Angeles')::DATE;

  IF p_from_date IS NOT NULL AND p_to_date IS NOT NULL THEN
    v_last_from := p_from_date;
    v_last_to := p_to_date;
  ELSIF p_to_date IS NOT NULL THEN
    v_last_to := p_to_date;
    v_last_from := p_to_date - 9;
  ELSIF p_from_date IS NOT NULL THEN
    v_last_from := p_from_date;
    v_last_to := p_from_date + 9;
  ELSE
    v_last_to := v_today - 3;
    v_last_from := v_last_to - 9;
  END IF;

  v_span := (v_last_to - v_last_from) + 1;
  v_prev_to := v_last_from - 1;
  v_prev_from := v_prev_to - (v_span - 1);

  WITH country_scope AS (
    SELECT
      f.*,
      ops_op_team_label(f.op_tag) AS team,
      LOWER(TRIM(COALESCE(f.cs_status, ''))) AS cs_l,
      LOWER(COALESCE(f.status, '')) AS status_l,
      LOWER(ops_op_team_label(f.op_tag)) = 'avi team' AS is_avi
    FROM ops_op_facts f
    WHERE (
      NULLIF(TRIM(p_country), '') IS NULL
      OR normalize_ops_country(f.country) = normalize_ops_country(p_country)
    )
  ),
  classified AS (
    SELECT
      *,
      (status_l LIKE '%cancel%') AS is_cancelled,
      (
        status_l LIKE '%deliver%'
        AND status_l NOT LIKE '%undeliver%'
      ) AS is_delivered,
      (cs_l = 'confirmation pending') AS is_pending_confirmation,
      (cs_l = 'approved' AND NOT is_avi) AS is_confirmed,
      (
        COALESCE(reschedule_check, '') ILIKE '%team a%'
      ) AS is_lucky_draw
    FROM country_scope
  ),
  filtered AS (
    SELECT *
    FROM classified
    WHERE (p_from_date IS NULL OR order_date >= p_from_date)
      AND (p_to_date IS NULL OR order_date <= p_to_date)
  ),
  kpis AS (
    SELECT
      COUNT(*)::INT AS total_orders,
      COUNT(*) FILTER (WHERE is_cancelled)::INT AS cancelled,
      COUNT(*) FILTER (WHERE is_delivered)::INT AS delivered,
      COUNT(*) FILTER (WHERE is_pending_confirmation)::INT AS pending_confirmation,
      COUNT(*) FILTER (WHERE is_confirmed)::INT AS confirmation,
      COUNT(*) FILTER (WHERE NOT is_cancelled AND NOT is_delivered)::INT AS in_process,
      COUNT(*) FILTER (WHERE upsell_pitched IS TRUE)::INT AS upsell_pitched,
      COUNT(*) FILTER (WHERE upsell_agreed IS TRUE)::INT AS upsell_agreed,
      COUNT(*) FILTER (
        WHERE upsell_agreed IS TRUE AND is_delivered
      )::INT AS upsell_delivered,
      COUNT(*) FILTER (WHERE is_lucky_draw)::INT AS lucky_draw_pitched,
      COUNT(*) FILTER (
        WHERE is_lucky_draw AND is_delivered
      )::INT AS lucky_draw_delivered
    FROM filtered
  ),
  teams AS (
    SELECT
      team,
      COUNT(*)::INT AS total,
      COUNT(*) FILTER (WHERE is_cancelled)::INT AS cancelled,
      COUNT(*) FILTER (WHERE is_delivered)::INT AS delivered,
      COUNT(*) FILTER (WHERE NOT is_cancelled AND NOT is_delivered)::INT AS in_process
    FROM filtered
    GROUP BY team
  ),
  trend AS (
    SELECT
      i.team,
      COUNT(*) FILTER (
        WHERE i.order_date BETWEEN v_last_from AND v_last_to
      )::INT AS last_total,
      COUNT(*) FILTER (
        WHERE i.is_cancelled AND i.order_date BETWEEN v_last_from AND v_last_to
      )::INT AS last_cancelled,
      COUNT(*) FILTER (
        WHERE i.is_confirmed AND i.order_date BETWEEN v_last_from AND v_last_to
      )::INT AS last_approved,
      COUNT(*) FILTER (
        WHERE i.order_date BETWEEN v_prev_from AND v_prev_to
      )::INT AS prev_total,
      COUNT(*) FILTER (
        WHERE i.is_cancelled AND i.order_date BETWEEN v_prev_from AND v_prev_to
      )::INT AS prev_cancelled,
      COUNT(*) FILTER (
        WHERE i.is_confirmed AND i.order_date BETWEEN v_prev_from AND v_prev_to
      )::INT AS prev_approved
    FROM classified i
    GROUP BY i.team
    HAVING COUNT(*) FILTER (
      WHERE i.order_date BETWEEN v_last_from AND v_last_to
         OR i.order_date BETWEEN v_prev_from AND v_prev_to
    ) > 0
  )
  SELECT jsonb_build_object(
    'totalOrders', COALESCE((SELECT total_orders FROM kpis), 0),
    'cancelled', COALESCE((SELECT cancelled FROM kpis), 0),
    'delivered', COALESCE((SELECT delivered FROM kpis), 0),
    'pendingConfirmation', COALESCE((SELECT pending_confirmation FROM kpis), 0),
    'confirmation', COALESCE((SELECT confirmation FROM kpis), 0),
    'inProcess', COALESCE((SELECT in_process FROM kpis), 0),
    'upsellPitched', COALESCE((SELECT upsell_pitched FROM kpis), 0),
    'upsellAgreed', COALESCE((SELECT upsell_agreed FROM kpis), 0),
    'upsellDelivered', COALESCE((SELECT upsell_delivered FROM kpis), 0),
    'luckyDrawPitched', COALESCE((SELECT lucky_draw_pitched FROM kpis), 0),
    'luckyDrawDelivered', COALESCE((SELECT lucky_draw_delivered FROM kpis), 0),
    'windows', jsonb_build_object(
      'lastFrom', v_last_from,
      'lastTo', v_last_to,
      'prevFrom', v_prev_from,
      'prevTo', v_prev_to
    ),
    'teams', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'team', team,
        'total', total,
        'cancelled', cancelled,
        'delivered', delivered,
        'inProcess', in_process
      ) ORDER BY cancelled::NUMERIC / NULLIF(total, 0) DESC NULLS LAST)
      FROM teams
    ), '[]'::jsonb),
    'trend', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'team', team,
        'lastTotal', last_total,
        'lastCancelled', last_cancelled,
        'lastApproved', last_approved,
        'prevTotal', prev_total,
        'prevCancelled', prev_cancelled,
        'prevApproved', prev_approved
      ) ORDER BY team)
      FROM trend
    ), '[]'::jsonb)
  )
  INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION get_ops_op_daily(
  p_country TEXT DEFAULT NULL,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  v_today DATE;
  v_from DATE;
  v_to DATE;
BEGIN
  v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Los_Angeles')::DATE;

  IF p_from_date IS NOT NULL AND p_to_date IS NOT NULL THEN
    v_from := p_from_date;
    v_to := p_to_date;
  ELSE
    SELECT MIN(f.order_date), MAX(f.order_date)
    INTO v_from, v_to
    FROM ops_op_facts f
    WHERE f.order_date IS NOT NULL
      AND (
        NULLIF(TRIM(p_country), '') IS NULL
        OR normalize_ops_country(f.country) = normalize_ops_country(p_country)
      )
      AND (p_from_date IS NULL OR f.order_date >= p_from_date)
      AND (p_to_date IS NULL OR f.order_date <= p_to_date);
    IF v_from IS NULL THEN
      v_from := COALESCE(p_from_date, v_today);
      v_to := COALESCE(p_to_date, v_today);
    END IF;
  END IF;

  WITH classified AS (
    SELECT
      f.order_date,
      ops_op_team_label(f.op_tag) AS team,
      LOWER(TRIM(COALESCE(f.cs_status, ''))) AS cs_l,
      LOWER(COALESCE(f.status, '')) AS status_l,
      LOWER(ops_op_team_label(f.op_tag)) = 'avi team' AS is_avi,
      f.upsell_pitched,
      f.upsell_agreed,
      COALESCE(f.reschedule_check, '') ILIKE '%team a%' AS is_lucky_draw
    FROM ops_op_facts f
    WHERE f.order_date BETWEEN v_from AND v_to
      AND (
        NULLIF(TRIM(p_country), '') IS NULL
        OR normalize_ops_country(f.country) = normalize_ops_country(p_country)
      )
  ),
  flagged AS (
    SELECT
      *,
      (status_l LIKE '%cancel%') AS is_cancelled,
      (
        status_l LIKE '%deliver%'
        AND status_l NOT LIKE '%undeliver%'
      ) AS is_delivered,
      (cs_l = 'confirmation pending') AS is_pending_confirmation,
      (cs_l = 'approved' AND NOT is_avi) AS is_confirmed
    FROM classified
  ),
  days AS (
    SELECT
      order_date,
      COUNT(*)::INT AS orders,
      COUNT(*) FILTER (WHERE is_pending_confirmation)::INT AS pending_confirmation,
      COUNT(*) FILTER (WHERE is_confirmed)::INT AS confirmation,
      COUNT(*) FILTER (WHERE is_cancelled)::INT AS cancelled,
      COUNT(*) FILTER (WHERE is_delivered)::INT AS delivered,
      COUNT(*) FILTER (WHERE NOT is_cancelled AND NOT is_delivered)::INT AS in_process,
      COUNT(*) FILTER (WHERE upsell_pitched IS TRUE)::INT AS upsell_pitched,
      COUNT(*) FILTER (WHERE upsell_agreed IS TRUE)::INT AS upsell_agreed,
      COUNT(*) FILTER (
        WHERE upsell_agreed IS TRUE AND is_delivered
      )::INT AS upsell_delivered,
      COUNT(*) FILTER (WHERE is_lucky_draw)::INT AS lucky_draw_pitched,
      COUNT(*) FILTER (
        WHERE is_lucky_draw AND is_delivered
      )::INT AS lucky_draw_delivered
    FROM flagged
    GROUP BY order_date
  ),
  team_days AS (
    SELECT
      order_date,
      team,
      COUNT(*)::INT AS total,
      COUNT(*) FILTER (WHERE is_cancelled)::INT AS cancelled,
      COUNT(*) FILTER (WHERE is_delivered)::INT AS delivered,
      COUNT(*) FILTER (WHERE NOT is_cancelled AND NOT is_delivered)::INT AS in_process,
      COUNT(*) FILTER (WHERE is_confirmed)::INT AS approved
    FROM flagged
    GROUP BY order_date, team
  )
  SELECT jsonb_build_object(
    'from', v_from,
    'to', v_to,
    'days', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'date', d.order_date,
        'orders', d.orders,
        'pendingConfirmation', d.pending_confirmation,
        'confirmation', d.confirmation,
        'cancelled', d.cancelled,
        'delivered', d.delivered,
        'inProcess', d.in_process,
        'upsellPitched', d.upsell_pitched,
        'upsellAgreed', d.upsell_agreed,
        'upsellDelivered', d.upsell_delivered,
        'luckyDrawPitched', d.lucky_draw_pitched,
        'luckyDrawDelivered', d.lucky_draw_delivered,
        'teams', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'team', td.team,
            'total', td.total,
            'cancelled', td.cancelled,
            'delivered', td.delivered,
            'inProcess', td.in_process,
            'approved', td.approved
          ) ORDER BY td.team)
          FROM team_days td
          WHERE td.order_date = d.order_date
        ), '[]'::jsonb)
      ) ORDER BY d.order_date)
      FROM days d
    ), '[]'::jsonb)
  )
  INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION normalize_ops_country(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION ops_op_team_label(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_ops_op_performance(TEXT, DATE, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION get_ops_op_daily(TEXT, DATE, DATE) TO service_role;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname, t.relname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname IN ('ops_sync_log', 'ops_sync_jobs')
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%source%'
      AND pg_get_constraintdef(c.oid) NOT ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.relname, r.conname);
  END LOOP;
END $$;

DO $$
BEGIN
  ALTER TABLE ops_sync_log ADD CONSTRAINT ops_sync_log_source_check
    CHECK (source IN (
      'inventory', 'channel_list', 'orders', 'op_performance', 'ticketing', 'picking'
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE ops_sync_jobs ADD CONSTRAINT ops_sync_jobs_source_check
    CHECK (source IN (
      'inventory', 'channel_list', 'orders', 'op_performance', 'ticketing', 'picking'
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

