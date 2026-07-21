-- Patch: Operations Inventory SKU search — exact SKU first, then closest segment matches.
-- Run in Supabase SQL Editor. Safe to re-run.

CREATE OR REPLACE FUNCTION sku_segment_prefix_depth(p_sku TEXT, p_query TEXT)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  sku_parts TEXT[];
  query_parts TEXT[];
  i INT := 1;
  depth INT := 0;
  max_i INT;
BEGIN
  IF p_sku IS NULL OR p_query IS NULL OR p_query = '' THEN
    RETURN 0;
  END IF;

  sku_parts := string_to_array(UPPER(TRIM(p_sku)), '-');
  query_parts := string_to_array(UPPER(TRIM(p_query)), '-');
  max_i := LEAST(array_length(sku_parts, 1), array_length(query_parts, 1));

  WHILE i <= max_i LOOP
    IF sku_parts[i] = query_parts[i] THEN
      depth := depth + 1;
    ELSE
      EXIT;
    END IF;
    i := i + 1;
  END LOOP;

  RETURN depth;
END;
$$;

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
      WHEN v_norm IS NOT NULL AND UPPER(f.sku) = v_norm THEN 0
      WHEN v_norm IS NOT NULL AND UPPER(f.sku) LIKE v_norm || '%' THEN 1
      WHEN v_norm IS NOT NULL AND v_norm LIKE UPPER(f.sku) || '%' THEN 2
      WHEN v_norm IS NOT NULL AND POSITION(v_norm IN UPPER(f.sku)) > 0 THEN 3
      WHEN v_token IS NOT NULL
           AND v_token <> ''
           AND UPPER(split_part(f.sku, '-', 1)) LIKE v_token || '%' THEN 4
      ELSE 5
    END,
    sku_segment_prefix_depth(f.sku, v_norm) DESC,
    LENGTH(f.sku) ASC,
    f.sku ASC
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
END;
$$;
