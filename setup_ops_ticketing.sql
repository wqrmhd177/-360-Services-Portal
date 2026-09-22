-- Ticketing facts + analytics RPC.
-- Run in Supabase SQL editor. Safe to re-run.
--
-- Raw Data column map (Ticketing Dashboard workbook):
--   D Final Ticket Date, E Ticket_ID, I Category, J Sub_Category,
--   K Current_Status, Q Ticket_Direction (Inbound/Outbound),
--   Y Minutes_To_First_Staff_Reply, AB Hours_To_Resolution.
-- No PII is stored (no names, comments, emails, or descriptions).

CREATE TABLE IF NOT EXISTS ops_ticket_facts (
  ticket_id              TEXT PRIMARY KEY,
  ticket_date            DATE,
  direction              TEXT,
  category               TEXT,
  sub_category           TEXT,
  status                 TEXT,
  first_reply_minutes    NUMERIC,
  resolution_hours       NUMERIC,
  synced_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_ticket_facts_date ON ops_ticket_facts (ticket_date);
CREATE INDEX IF NOT EXISTS idx_ops_ticket_facts_direction ON ops_ticket_facts (direction);
CREATE INDEX IF NOT EXISTS idx_ops_ticket_facts_category ON ops_ticket_facts (category);

ALTER TABLE ops_ticket_facts DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE ops_ticket_facts IS
  'Ticketing Raw Data (ticket grain). D date, E id, I category, J sub, K status, Q inbound/outbound, Y first staff reply minutes, AB resolution hours. PII is not stored.';

GRANT ALL ON TABLE ops_ticket_facts TO service_role;

CREATE OR REPLACE FUNCTION get_ops_ticketing(
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_direction TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  WITH filtered AS (
    SELECT
      f.ticket_id,
      f.ticket_date,
      INITCAP(LOWER(TRIM(COALESCE(f.direction, '')))) AS direction,
      NULLIF(TRIM(COALESCE(f.category, '')), '') AS category,
      NULLIF(TRIM(COALESCE(f.sub_category, '')), '') AS sub_category,
      TRIM(COALESCE(f.status, '')) AS status,
      f.first_reply_minutes,
      f.resolution_hours
    FROM ops_ticket_facts f
    WHERE (p_from_date IS NULL OR f.ticket_date >= p_from_date)
      AND (p_to_date IS NULL OR f.ticket_date <= p_to_date)
      AND (
        NULLIF(TRIM(p_direction), '') IS NULL
        OR LOWER(TRIM(f.direction)) = LOWER(TRIM(p_direction))
      )
  ),
  flagged AS (
    SELECT
      *,
      LOWER(status) = 'resolved' AS is_resolved,
      LOWER(status) = 'pending' AS is_pending,
      LOWER(status) IN ('in progress', 'in-progress') AS is_in_progress,
      LOWER(status) LIKE '%awaiting seller%' AS is_awaiting_seller
    FROM filtered
  ),
  kpis AS (
    SELECT
      COUNT(*)::INT AS tickets,
      COUNT(*) FILTER (WHERE NOT is_resolved)::INT AS open_count,
      COUNT(*) FILTER (WHERE is_resolved)::INT AS resolved,
      COUNT(*) FILTER (WHERE is_pending)::INT AS pending,
      COUNT(*) FILTER (WHERE is_in_progress)::INT AS in_progress,
      COUNT(*) FILTER (WHERE is_awaiting_seller)::INT AS awaiting_seller,
      COUNT(*) FILTER (WHERE first_reply_minutes IS NOT NULL)::INT AS first_reply_count,
      AVG(first_reply_minutes) FILTER (WHERE first_reply_minutes IS NOT NULL) AS avg_first_reply_minutes,
      COUNT(*) FILTER (WHERE resolution_hours IS NOT NULL)::INT AS resolution_count,
      AVG(resolution_hours) FILTER (WHERE resolution_hours IS NOT NULL) AS avg_resolution_hours
    FROM flagged
  ),
  inbound AS (
    SELECT
      COUNT(*)::INT AS tickets,
      COUNT(*) FILTER (WHERE NOT is_resolved)::INT AS open_count,
      COUNT(*) FILTER (WHERE is_resolved)::INT AS resolved,
      COUNT(*) FILTER (WHERE is_pending)::INT AS pending,
      COUNT(*) FILTER (WHERE is_in_progress)::INT AS in_progress,
      COUNT(*) FILTER (WHERE is_awaiting_seller)::INT AS awaiting_seller,
      COUNT(*) FILTER (WHERE first_reply_minutes IS NOT NULL)::INT AS first_reply_count,
      AVG(first_reply_minutes) FILTER (WHERE first_reply_minutes IS NOT NULL) AS avg_first_reply_minutes,
      COUNT(*) FILTER (WHERE resolution_hours IS NOT NULL)::INT AS resolution_count,
      AVG(resolution_hours) FILTER (WHERE resolution_hours IS NOT NULL) AS avg_resolution_hours
    FROM flagged
    WHERE LOWER(direction) = 'inbound'
  ),
  outbound AS (
    SELECT
      COUNT(*)::INT AS tickets,
      COUNT(*) FILTER (WHERE NOT is_resolved)::INT AS open_count,
      COUNT(*) FILTER (WHERE is_resolved)::INT AS resolved,
      COUNT(*) FILTER (WHERE is_pending)::INT AS pending,
      COUNT(*) FILTER (WHERE is_in_progress)::INT AS in_progress,
      COUNT(*) FILTER (WHERE is_awaiting_seller)::INT AS awaiting_seller,
      COUNT(*) FILTER (WHERE first_reply_minutes IS NOT NULL)::INT AS first_reply_count,
      AVG(first_reply_minutes) FILTER (WHERE first_reply_minutes IS NOT NULL) AS avg_first_reply_minutes,
      COUNT(*) FILTER (WHERE resolution_hours IS NOT NULL)::INT AS resolution_count,
      AVG(resolution_hours) FILTER (WHERE resolution_hours IS NOT NULL) AS avg_resolution_hours
    FROM flagged
    WHERE LOWER(direction) = 'outbound'
  ),
  cats AS (
    SELECT
      COALESCE(category, 'Uncategorized') AS category,
      COUNT(*)::INT AS tickets,
      COUNT(*) FILTER (WHERE LOWER(direction) = 'inbound')::INT AS inbound,
      COUNT(*) FILTER (WHERE LOWER(direction) = 'outbound')::INT AS outbound,
      COUNT(*) FILTER (WHERE NOT is_resolved)::INT AS open_count,
      COUNT(*) FILTER (WHERE is_resolved)::INT AS resolved,
      COUNT(*) FILTER (WHERE is_pending)::INT AS pending,
      COUNT(*) FILTER (WHERE is_in_progress)::INT AS in_progress,
      AVG(first_reply_minutes) FILTER (WHERE first_reply_minutes IS NOT NULL) AS avg_first_reply_minutes,
      AVG(resolution_hours) FILTER (WHERE resolution_hours IS NOT NULL) AS avg_resolution_hours
    FROM flagged
    GROUP BY COALESCE(category, 'Uncategorized')
  ),
  subs AS (
    SELECT
      COALESCE(category, 'Uncategorized') AS category,
      COALESCE(sub_category, 'Uncategorized') AS sub_category,
      COUNT(*)::INT AS tickets,
      COUNT(*) FILTER (WHERE LOWER(direction) = 'inbound')::INT AS inbound,
      COUNT(*) FILTER (WHERE LOWER(direction) = 'outbound')::INT AS outbound,
      COUNT(*) FILTER (WHERE NOT is_resolved)::INT AS open_count,
      COUNT(*) FILTER (WHERE is_resolved)::INT AS resolved,
      COUNT(*) FILTER (WHERE is_pending)::INT AS pending,
      COUNT(*) FILTER (WHERE is_in_progress)::INT AS in_progress,
      AVG(first_reply_minutes) FILTER (WHERE first_reply_minutes IS NOT NULL) AS avg_first_reply_minutes,
      AVG(resolution_hours) FILTER (WHERE resolution_hours IS NOT NULL) AS avg_resolution_hours
    FROM flagged
    GROUP BY COALESCE(category, 'Uncategorized'), COALESCE(sub_category, 'Uncategorized')
  )
  SELECT jsonb_build_object(
    'total', (SELECT tickets FROM kpis),
    'all', jsonb_build_object(
      'tickets', (SELECT tickets FROM kpis),
      'open', (SELECT open_count FROM kpis),
      'resolved', (SELECT resolved FROM kpis),
      'pending', (SELECT pending FROM kpis),
      'inProgress', (SELECT in_progress FROM kpis),
      'awaitingSeller', (SELECT awaiting_seller FROM kpis),
      'firstReplyCount', (SELECT first_reply_count FROM kpis),
      'avgFirstReplyMinutes', (SELECT avg_first_reply_minutes FROM kpis),
      'resolutionCount', (SELECT resolution_count FROM kpis),
      'avgResolutionHours', (SELECT avg_resolution_hours FROM kpis)
    ),
    'inbound', jsonb_build_object(
      'tickets', (SELECT tickets FROM inbound),
      'open', (SELECT open_count FROM inbound),
      'resolved', (SELECT resolved FROM inbound),
      'pending', (SELECT pending FROM inbound),
      'inProgress', (SELECT in_progress FROM inbound),
      'awaitingSeller', (SELECT awaiting_seller FROM inbound),
      'firstReplyCount', (SELECT first_reply_count FROM inbound),
      'avgFirstReplyMinutes', (SELECT avg_first_reply_minutes FROM inbound),
      'resolutionCount', (SELECT resolution_count FROM inbound),
      'avgResolutionHours', (SELECT avg_resolution_hours FROM inbound)
    ),
    'outbound', jsonb_build_object(
      'tickets', (SELECT tickets FROM outbound),
      'open', (SELECT open_count FROM outbound),
      'resolved', (SELECT resolved FROM outbound),
      'pending', (SELECT pending FROM outbound),
      'inProgress', (SELECT in_progress FROM outbound),
      'awaitingSeller', (SELECT awaiting_seller FROM outbound),
      'firstReplyCount', (SELECT first_reply_count FROM outbound),
      'avgFirstReplyMinutes', (SELECT avg_first_reply_minutes FROM outbound),
      'resolutionCount', (SELECT resolution_count FROM outbound),
      'avgResolutionHours', (SELECT avg_resolution_hours FROM outbound)
    ),
    'categories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'category', c.category,
        'tickets', c.tickets,
        'inbound', c.inbound,
        'outbound', c.outbound,
        'open', c.open_count,
        'resolved', c.resolved,
        'pending', c.pending,
        'inProgress', c.in_progress,
        'avgFirstReplyMinutes', c.avg_first_reply_minutes,
        'avgResolutionHours', c.avg_resolution_hours
      ) ORDER BY c.tickets DESC)
      FROM cats c
    ), '[]'::jsonb),
    'subcategories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'category', s.category,
        'subCategory', s.sub_category,
        'tickets', s.tickets,
        'inbound', s.inbound,
        'outbound', s.outbound,
        'open', s.open_count,
        'resolved', s.resolved,
        'pending', s.pending,
        'inProgress', s.in_progress,
        'avgFirstReplyMinutes', s.avg_first_reply_minutes,
        'avgResolutionHours', s.avg_resolution_hours
      ) ORDER BY s.tickets DESC)
      FROM subs s
    ), '[]'::jsonb)
  )
  INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_ops_ticketing(DATE, DATE, TEXT) TO service_role;

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
