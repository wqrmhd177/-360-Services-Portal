-- Security lockdown: deny public/anon access to all portal data.
-- Run in Supabase SQL Editor AFTER all feature patches.
-- Requires: app uses SUPABASE_SERVICE_ROLE_KEY on server only (see SECURITY_SETUP.md).
--
-- Effect:
--   • Enables RLS on every public table (fixes Supabase linter alerts)
--   • Drops permissive anon/authenticated policies (USING true)
--   • Revokes table/sequence/function access from anon + authenticated roles
--   • service_role retains full access (bypasses RLS)

-- ── 1. Drop all existing RLS policies on public tables ───────────────────────

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname,
      pol.schemaname,
      pol.tablename
    );
  END LOOP;
END $$;

-- ── 2. Enable RLS on all public tables (deny-by-default for anon/authenticated) ─

DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl.tablename);
  END LOOP;
END $$;

-- ── 3. Revoke direct access from anon and authenticated roles ──────────────────

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Keep schema usage for PostgREST introspection (no data without grants)
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- service_role: full access (used by Next.js API routes only)
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;

-- ── 4. Storage: remove public object access ────────────────────────────────────

DROP POLICY IF EXISTS "product_images_select" ON storage.objects;
DROP POLICY IF EXISTS "product_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "pr_payment_proofs_upload" ON storage.objects;
DROP POLICY IF EXISTS "pr_payment_proofs_read" ON storage.objects;
DROP POLICY IF EXISTS "supplier_invoices_upload" ON storage.objects;
DROP POLICY IF EXISTS "supplier_invoices_read" ON storage.objects;
DROP POLICY IF EXISTS "delivery_invoices_upload" ON storage.objects;
DROP POLICY IF EXISTS "delivery_invoices_read" ON storage.objects;

-- Deny anon/authenticated storage object access (uploads via service role API only)
REVOKE ALL ON storage.objects FROM anon, authenticated;

-- Make sensitive buckets private (if they exist)
UPDATE storage.buckets SET public = false WHERE id IN (
  'qr-attachments',
  'product_images',
  'product-listing-images',
  'pr-payment-proofs',
  'supplier-invoices',
  'delivery-invoices'
);

COMMENT ON SCHEMA public IS
  'Portal data — anon/authenticated roles have no table access; use service_role from authenticated API routes only.';
