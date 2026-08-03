-- Fix hourly sync MV refresh: avoid REST statement timeout by extending limit
-- and refreshing optional views safely. Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION refresh_ops_orders_summaries_simple()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Supabase REST/RPC default is ~8s; direct Postgres sync needs longer for large tables.
  PERFORM set_config('statement_timeout', '600000', true);

  REFRESH MATERIALIZED VIEW ops_orders_daily_rollup;
  REFRESH MATERIALIZED VIEW ops_orders_status_rollup;
  REFRESH MATERIALIZED VIEW ops_orders_domain_rollup;
  REFRESH MATERIALIZED VIEW ops_orders_delivery_partner_rollup;
  REFRESH MATERIALIZED VIEW ops_orders_revenue_loss_rollup;
  REFRESH MATERIALIZED VIEW ops_orders_sla_rollup;

  BEGIN
    REFRESH MATERIALIZED VIEW ops_orders_order_detail;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW ops_orders_product_rollup;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW ops_nd_allocations;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW ops_nd_sku_summary;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;
END;
$$;

COMMENT ON FUNCTION refresh_ops_orders_summaries_simple IS
  'Refresh all ops order MVs after sync. Uses 10min statement_timeout; skips optional MVs if missing.';
