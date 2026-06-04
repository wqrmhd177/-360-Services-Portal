-- Run in Supabase SQL Editor if PO creation fails (missing columns)
-- Combines PO migrations needed for convert + payment amounts + product lines

ALTER TABLE public.po ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.po ADD COLUMN IF NOT EXISTS supplier_payment_amount NUMERIC;
ALTER TABLE public.po ADD COLUMN IF NOT EXISTS delivery_partner_payment_amount NUMERIC;
ALTER TABLE public.po ADD COLUMN IF NOT EXISTS po_number TEXT;
