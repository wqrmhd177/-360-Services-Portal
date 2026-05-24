-- Add proof history columns for PO supplier/delivery payments.
-- Run in Supabase SQL editor.

ALTER TABLE po
  ADD COLUMN IF NOT EXISTS supplier_payment_proof_history jsonb,
  ADD COLUMN IF NOT EXISTS delivery_partner_payment_proof_history jsonb;

COMMENT ON COLUMN po.supplier_payment_proof_history IS 'Audit trail of supplier payment proof changes (array of events)';
COMMENT ON COLUMN po.delivery_partner_payment_proof_history IS 'Audit trail of delivery payment proof changes (array of events)';

