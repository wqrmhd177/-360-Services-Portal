-- Queue MV refresh inside Supabase (no GitHub DATABASE_URL required).
-- Sync calls queue_ops_mv_refresh() via REST; pg_cron runs refresh within ~1 minute.
--
-- Prerequisite: enable pg_cron in Supabase Dashboard → Database → Extensions.
-- Run after patch_fix_refresh_summaries.sql.

CREATE TABLE IF NOT EXISTS ops_mv_refresh_queue (
  id BIGSERIAL PRIMARY KEY,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ops_mv_refresh_queue_pending
  ON ops_mv_refresh_queue (requested_at)
  WHERE processed_at IS NULL;

CREATE OR REPLACE FUNCTION queue_ops_mv_refresh()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO ops_mv_refresh_queue (requested_at) VALUES (now());
END;
$$;

CREATE OR REPLACE FUNCTION process_ops_mv_refresh_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO pending
  FROM ops_mv_refresh_queue
  WHERE processed_at IS NULL;

  IF pending = 0 THEN
    RETURN;
  END IF;

  PERFORM refresh_ops_orders_summaries_simple();

  UPDATE ops_mv_refresh_queue
  SET processed_at = now()
  WHERE processed_at IS NULL;
END;
$$;

COMMENT ON FUNCTION queue_ops_mv_refresh IS
  'Called by hourly sync via REST when direct Postgres refresh is unavailable.';
COMMENT ON FUNCTION process_ops_mv_refresh_queue IS
  'pg_cron worker: refresh MVs when queue has pending requests.';

-- pg_cron: enable in Dashboard → Database → Extensions first.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-ops-mv-refresh') THEN
    PERFORM cron.unschedule('process-ops-mv-refresh');
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'pg_cron not available — enable the pg_cron extension in Supabase Dashboard, then re-run this file.';
END;
$$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'process-ops-mv-refresh',
    '* * * * *',
    'SELECT process_ops_mv_refresh_queue()'
  );
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Skipped cron.schedule — enable pg_cron extension and re-run.';
  WHEN OTHERS THEN
    RAISE NOTICE 'cron.schedule failed: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION queue_ops_mv_refresh() TO service_role;
GRANT EXECUTE ON FUNCTION process_ops_mv_refresh_queue() TO service_role;
