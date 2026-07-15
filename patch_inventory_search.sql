-- Patch: fix Operations Inventory SKU search (run in Supabase SQL Editor).
-- Safe to re-run. Matches SKUs by first hyphen-delimited segment; exact SKU sorts first.

CREATE OR REPLACE FUNCTION search_ops_inventory(
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 25,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  user_id TEXT,
  username TEXT,
  product_name TEXT,
  sku TEXT,
  available_quantity NUMERIC,
  country TEXT,
  category TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_q TEXT := NULLIF(TRIM(p_search), '');
  v_norm TEXT;
  v_token TEXT;
BEGIN
  IF v_q IS NOT NULL THEN
    v_norm := UPPER(REGEXP_REPLACE(v_q, '^,+', ''));
    v_token := UPPER(REGEXP_REPLACE(split_part(v_norm, '-', 1), '^,+', ''));
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT i.*
    FROM ops_inventory_items i
    WHERE v_q IS NULL
       OR i.user_id ILIKE '%' || v_q || '%'
       OR i.product_name ILIKE '%' || v_q || '%'
       OR COALESCE(i.username, '') ILIKE '%' || v_q || '%'
       OR (
         v_token IS NOT NULL
         AND v_token <> ''
         AND UPPER(split_part(i.sku, '-', 1)) LIKE v_token || '%'
       )
  ),
  counted AS (SELECT COUNT(*)::BIGINT AS cnt FROM filtered)
  SELECT
    f.id,
    f.user_id,
    f.username,
    f.product_name,
    f.sku,
    f.available_quantity,
    f.country,
    f.category,
    c.cnt
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY
    CASE
      WHEN v_norm IS NOT NULL AND f.sku = v_norm THEN 0
      WHEN v_norm IS NOT NULL AND f.sku ILIKE v_norm || '%' THEN 1
      WHEN v_token IS NOT NULL
           AND v_token <> ''
           AND UPPER(split_part(f.sku, '-', 1)) LIKE v_token || '%' THEN 2
      ELSE 3
    END,
    f.sku ASC
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
END;
$$;
