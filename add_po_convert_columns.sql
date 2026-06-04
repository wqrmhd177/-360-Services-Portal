-- Run in Supabase SQL Editor (required for product lines on PO + payment amounts)
-- Fixes: "Could not find the 'products' column of 'po' in the schema cache"

ALTER TABLE public.po ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.po ADD COLUMN IF NOT EXISTS supplier_payment_amount NUMERIC;
ALTER TABLE public.po ADD COLUMN IF NOT EXISTS delivery_partner_payment_amount NUMERIC;
ALTER TABLE public.po ADD COLUMN IF NOT EXISTS po_number TEXT;

-- Storage bucket for invoice uploads (if missing)
INSERT INTO storage.buckets (id, name, public)
VALUES ('pr-payment-proofs', 'pr-payment-proofs', true)
ON CONFLICT (id) DO NOTHING;
