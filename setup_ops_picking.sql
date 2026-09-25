-- Picking & GRN product catalog.
-- Run in Supabase SQL editor. Safe to re-run.
--
-- Source workbook Product Images tab:
--   A Product Description & SKU, B cell image, D Link, E SKU.
-- Sync Data stores sheet picture links. Sync pictures copies new/missing
-- files into the product_images bucket once; later runs skip already-copied URLs.
-- No PII is stored.

CREATE TABLE IF NOT EXISTS ops_picking_products (
  sku           TEXT PRIMARY KEY,
  product_name  TEXT NOT NULL,
  image_url     TEXT,
  source        TEXT NOT NULL DEFAULT 'sheet'
                CHECK (source IN ('sheet', 'manual', 'bulk')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    TEXT
);

ALTER TABLE ops_picking_products
  ADD COLUMN IF NOT EXISTS sheet_image_url TEXT;
ALTER TABLE ops_picking_products
  ADD COLUMN IF NOT EXISTS image_source_url TEXT;

DROP INDEX IF EXISTS idx_ops_picking_image_pending;
ALTER TABLE ops_picking_products DROP COLUMN IF EXISTS image_pending;
ALTER TABLE ops_picking_products
  ADD COLUMN image_pending BOOLEAN
  GENERATED ALWAYS AS (
    sheet_image_url IS NOT NULL
    AND sheet_image_url LIKE 'http%'
    AND sheet_image_url NOT ILIKE '%/storage/v1/object/public/product_images/%'
    AND (image_source_url IS NULL OR image_source_url IS DISTINCT FROM sheet_image_url)
    AND NOT (
      COALESCE(source, 'sheet') = 'manual'
      AND image_url ILIKE '%/storage/v1/object/public/product_images/%'
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_ops_picking_products_name
  ON ops_picking_products (product_name);
CREATE INDEX IF NOT EXISTS idx_ops_picking_products_updated
  ON ops_picking_products (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_picking_image_pending
  ON ops_picking_products (sku)
  WHERE image_pending;

-- Drive/sheet links already in image_url become the source for the one-time copy.
UPDATE ops_picking_products
SET sheet_image_url = image_url
WHERE sheet_image_url IS NULL
  AND image_url LIKE 'http%'
  AND image_url NOT ILIKE '%/storage/v1/object/public/product_images/%';

-- Pictures already on Supabase are treated as copied for the current sheet link.
UPDATE ops_picking_products
SET image_source_url = sheet_image_url
WHERE image_url ILIKE '%/storage/v1/object/public/product_images/%'
  AND image_source_url IS NULL
  AND sheet_image_url IS NOT NULL;

ALTER TABLE ops_picking_products DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE ops_picking_products IS
  'Picking/GRN catalog: SKU, display name, product picture. Sheet links in sheet_image_url; Supabase public URL in image_url after copy.';

GRANT ALL ON TABLE ops_picking_products TO service_role;

CREATE OR REPLACE FUNCTION upsert_ops_picking_products(p_rows JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  n INT := 0;
BEGIN
  INSERT INTO ops_picking_products (
    sku, product_name, image_url, sheet_image_url, source, created_by
  )
  SELECT
    TRIM(x.sku),
    NULLIF(TRIM(x.product_name), ''),
    NULLIF(TRIM(x.image_url), ''),
    NULLIF(TRIM(x.sheet_image_url), ''),
    COALESCE(NULLIF(TRIM(x.source), ''), 'sheet'),
    NULLIF(TRIM(x.created_by), '')
  FROM jsonb_to_recordset(p_rows) AS x(
    sku TEXT,
    product_name TEXT,
    image_url TEXT,
    sheet_image_url TEXT,
    source TEXT,
    created_by TEXT
  )
  WHERE NULLIF(TRIM(x.sku), '') IS NOT NULL
    AND NULLIF(TRIM(x.product_name), '') IS NOT NULL
  ON CONFLICT (sku) DO UPDATE SET
    product_name = CASE
      WHEN ops_picking_products.source = 'manual' THEN ops_picking_products.product_name
      ELSE EXCLUDED.product_name
    END,
    sheet_image_url = COALESCE(
      EXCLUDED.sheet_image_url,
      ops_picking_products.sheet_image_url
    ),
    image_url = CASE
      WHEN ops_picking_products.image_url ILIKE '%/storage/v1/object/public/product_images/%'
        THEN ops_picking_products.image_url
      ELSE COALESCE(EXCLUDED.image_url, ops_picking_products.image_url)
    END,
    -- Already-copied Supabase pictures stay marked done for the current sheet link.
    image_source_url = CASE
      WHEN ops_picking_products.image_url ILIKE '%/storage/v1/object/public/product_images/%'
        AND ops_picking_products.image_source_url IS NULL
        THEN COALESCE(EXCLUDED.sheet_image_url, ops_picking_products.sheet_image_url)
      ELSE ops_picking_products.image_source_url
    END,
    updated_at = NOW();

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_ops_picking_products(JSONB) TO service_role;

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

-- Catalog pictures must be readable in the portal and GRN/AWB print views.
UPDATE storage.buckets
SET public = true
WHERE id = 'product_images';

DROP POLICY IF EXISTS "product_images_select" ON storage.objects;
CREATE POLICY "product_images_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'product_images');

CREATE TABLE IF NOT EXISTS ops_picking_product_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku          TEXT NOT NULL,
  action       TEXT NOT NULL
               CHECK (action IN ('created', 'name_changed', 'sku_changed', 'picture_changed', 'bulk_import')),
  summary      TEXT NOT NULL,
  old_value    TEXT,
  new_value    TEXT,
  changed_by   TEXT,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_picking_product_logs_sku
  ON ops_picking_product_logs (sku, changed_at DESC);

ALTER TABLE ops_picking_product_logs DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE ops_picking_product_logs IS
  'Audit trail for Product Pictures catalog changes (SKU, name, picture, bulk import).';

GRANT ALL ON TABLE ops_picking_product_logs TO service_role;

-- ─── merge_picking_products RPC ───────────────────────────────────────────────
-- Smart-merge rows from the Master Products Google Sheet:
--   INSERT rows whose SKU does not yet exist.
--   UPDATE only if a non-null image URL arrives and the current image_url is
--     either null or a Drive/external URL (never overwrites a Supabase URL).
--   Skip otherwise.
-- Returns the number of rows actually written (inserted + updated).

CREATE OR REPLACE FUNCTION merge_picking_products(p_rows JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r           JSONB;
  v_sku       TEXT;
  v_name      TEXT;
  v_image_url TEXT;
  v_sheet_url TEXT;
  existing    ops_picking_products%ROWTYPE;
  written     INT := 0;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_sku       := trim(r->>'sku');
    v_name      := trim(r->>'product_name');
    v_image_url := trim(r->>'image_url');
    v_sheet_url := trim(r->>'sheet_image_url');

    IF v_sku IS NULL OR v_sku = '' THEN
      CONTINUE;
    END IF;

    SELECT * INTO existing
    FROM ops_picking_products
    WHERE sku = v_sku
    LIMIT 1;

    IF NOT FOUND THEN
      -- INSERT new SKU
      INSERT INTO ops_picking_products (
        sku, product_name, image_url, sheet_image_url, source, updated_at
      ) VALUES (
        v_sku,
        COALESCE(NULLIF(v_name, ''), v_sku),
        NULLIF(v_image_url, ''),
        NULLIF(v_sheet_url, ''),
        'sheet',
        NOW()
      )
      ON CONFLICT (sku) DO NOTHING;
      written := written + 1;

    ELSIF v_image_url IS NOT NULL AND v_image_url <> ''
      AND (
        existing.image_url IS NULL
        OR (
          existing.image_url NOT LIKE '%/storage/v1/object/public/product_images/%'
          AND existing.image_url <> v_image_url
        )
      )
    THEN
      -- UPDATE only when a new Drive URL has arrived
      UPDATE ops_picking_products SET
        product_name    = COALESCE(NULLIF(v_name, ''), existing.product_name),
        image_url       = v_image_url,
        sheet_image_url = NULLIF(v_sheet_url, ''),
        source          = 'sheet',
        updated_at      = NOW()
      WHERE sku = v_sku;
      written := written + 1;

    END IF;
  END LOOP;

  RETURN written;
END;
$$;

GRANT EXECUTE ON FUNCTION merge_picking_products(JSONB) TO service_role;
