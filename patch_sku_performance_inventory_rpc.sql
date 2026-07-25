-- Bulk inventory lookup for SKU Performance (whitespace-insensitive SKU match)
-- Run in Supabase SQL Editor

CREATE OR REPLACE FUNCTION normalize_ops_sku_match(p_sku TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT UPPER(REGEXP_REPLACE(TRIM(BOTH FROM REGEXP_REPLACE(COALESCE(p_sku, ''), '^,+', '')), '\s+', '', 'g'));
$$;

CREATE OR REPLACE FUNCTION get_ops_inventory_totals_by_skus(
  p_skus TEXT[],
  p_country TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH requested AS (
    SELECT DISTINCT normalize_ops_sku_match(s) AS sku_norm
    FROM unnest(COALESCE(p_skus, ARRAY[]::TEXT[])) AS s
    WHERE normalize_ops_sku_match(s) <> ''
  ),
  inv AS (
    SELECT
      normalize_ops_sku_match(i.sku) AS sku_norm,
      COALESCE(SUM(i.available_quantity), 0)::NUMERIC AS available_quantity
    FROM ops_inventory_items i
    WHERE normalize_ops_sku_match(i.sku) IN (SELECT sku_norm FROM requested)
      AND (
        p_country IS NULL
        OR TRIM(p_country) = ''
        OR TRIM(i.country) = TRIM(p_country)
      )
    GROUP BY normalize_ops_sku_match(i.sku)
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'sku', sku_norm,
        'available_quantity', available_quantity
      )
    ),
    '[]'::JSONB
  )
  FROM inv;
$$;
