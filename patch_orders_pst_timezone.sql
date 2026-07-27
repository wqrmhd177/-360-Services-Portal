-- Re-align order_date_day to PST/PDT (America/Los_Angeles) so Orders matches SKU Performance and Metabase report dates.
-- Run in Supabase SQL Editor after deploying portal PST calendar-range changes.

UPDATE ops_orders_items
SET order_date_day = (order_date AT TIME ZONE 'America/Los_Angeles')::DATE
WHERE order_date IS NOT NULL;

SELECT refresh_ops_orders_summaries();

COMMENT ON COLUMN ops_orders_items.order_date_day IS
  'PST/PDT calendar date derived from order_date — used for all Operations date filters';
