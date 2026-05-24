-- Migration: Add payment_entries to PR table for multiple transaction IDs + payment proofs
-- Run this in Supabase SQL Editor after migrate_pr_po_multi_product.sql

ALTER TABLE public.pr ADD COLUMN IF NOT EXISTS payment_entries JSONB DEFAULT NULL;

-- Optional: backfill existing single transaction_id/payment_proof_path into payment_entries
UPDATE public.pr
SET payment_entries = jsonb_build_array(
  jsonb_build_object(
    'transaction_id', COALESCE(transaction_id, null),
    'payment_proof_path', COALESCE(payment_proof_path, null)
  )
)
WHERE payment_entries IS NULL
  AND (transaction_id IS NOT NULL OR payment_proof_path IS NOT NULL);
