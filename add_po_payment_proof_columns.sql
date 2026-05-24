-- Add payment proof URL columns to po table (for Finance "Mark Paid" uploads).
-- Run this in Supabase SQL Editor if your po table doesn't have these columns yet.

ALTER TABLE po
  ADD COLUMN IF NOT EXISTS supplier_payment_proof text,
  ADD COLUMN IF NOT EXISTS delivery_partner_payment_proof text;

COMMENT ON COLUMN po.supplier_payment_proof IS 'Public URL of uploaded payment proof when supplier payment is marked paid';
COMMENT ON COLUMN po.delivery_partner_payment_proof IS 'Public URL of uploaded payment proof when delivery partner payment is marked paid';
