-- Run once in Supabase SQL Editor (required for Bulk PO upload and independent PO creation).
-- Fixes: null value in column "pr_id" of relation "po" violates not-null constraint

-- Allow POs without a linked Purchase Request (bulk CSV / independent PO flow).
ALTER TABLE public.po ALTER COLUMN pr_id DROP NOT NULL;

-- Product lines for independent POs (safe to re-run).
ALTER TABLE public.po ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '[]'::jsonb;

SELECT 'Bulk/independent PO ready: pr_id is now nullable.' AS message;
