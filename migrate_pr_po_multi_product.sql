-- Migration: Update PR and PO tables for multi-product support
-- Run this in Supabase SQL Editor after setup_database.sql

-- ===================================================
-- PART 1: Update PO Status Enum
-- ===================================================

-- Add new PO status values
DO $$ BEGIN
  ALTER TYPE public.po_status ADD VALUE IF NOT EXISTS 'po_created';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE public.po_status ADD VALUE IF NOT EXISTS 'shipment_received_at_supplier_warehouse';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE public.po_status ADD VALUE IF NOT EXISTS 'shipment_received_at_lp_warehouse';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE public.po_status ADD VALUE IF NOT EXISTS 'shipment_received_at_destination_city';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE public.po_status ADD VALUE IF NOT EXISTS 'shipment_received_at_destination_warehouse';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ===================================================
-- PART 2: Backup existing PR data
-- ===================================================

-- Create a backup table for existing PRs (single product structure)
CREATE TABLE IF NOT EXISTS public.pr_backup_single_product AS
SELECT * FROM public.pr;

-- ===================================================
-- PART 3: Update PR Table Structure
-- ===================================================

-- Add new columns to PR table
ALTER TABLE public.pr ADD COLUMN IF NOT EXISTS seller_channel_name TEXT;
ALTER TABLE public.pr ADD COLUMN IF NOT EXISTS seller_user_id TEXT;
ALTER TABLE public.pr ADD COLUMN IF NOT EXISTS seller_service_type TEXT;
ALTER TABLE public.pr ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.pr ADD COLUMN IF NOT EXISTS payment_type TEXT;
ALTER TABLE public.pr ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE public.pr ADD COLUMN IF NOT EXISTS payment_proof_path TEXT;
ALTER TABLE public.pr ADD COLUMN IF NOT EXISTS approval_remarks TEXT;
ALTER TABLE public.pr ADD COLUMN IF NOT EXISTS finance_remarks TEXT;
ALTER TABLE public.pr ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.pr ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.pr ADD COLUMN IF NOT EXISTS finance_verified_at TIMESTAMPTZ;
ALTER TABLE public.pr ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE public.pr ADD COLUMN IF NOT EXISTS pr_status TEXT DEFAULT 'pending';

-- Migrate existing single-product PRs to multi-product format
-- This converts old PR records to use the new products JSONB array
UPDATE public.pr
SET products = jsonb_build_array(
  jsonb_build_object(
    'productName', product_name,
    'skuCode', sku_code,
    'destinationCountry', COALESCE(countries[1], 'UAE'),
    'quantity', quantity,
    'sellingPricePerUnit', rate,
    'currency', 'AED',
    'totalAmount', amount,
    'shippingType', shipping_type::text,
    'movementType', movement_type::text,
    'remarks', remarks
  )
),
seller_channel_name = reseller_code,
seller_user_id = reseller_code,
seller_service_type = 'Zambeel 360',
payment_type = payment_method::text,
pr_status = CASE 
  WHEN approval_status = 'approved' AND finance_verification_status = 'verified' THEN 'payment_verified'
  WHEN approval_status = 'approved' THEN 'approved'
  WHEN approval_status = 'rejected' THEN 'rejected'
  ELSE 'pending'
END
WHERE products IS NULL OR products = '[]'::jsonb;

-- Make old single-product columns nullable (we'll keep them for now for backward compatibility)
ALTER TABLE public.pr ALTER COLUMN product_name DROP NOT NULL;
ALTER TABLE public.pr ALTER COLUMN sku_code DROP NOT NULL;
ALTER TABLE public.pr ALTER COLUMN quantity DROP NOT NULL;
ALTER TABLE public.pr ALTER COLUMN rate DROP NOT NULL;
ALTER TABLE public.pr ALTER COLUMN amount DROP NOT NULL;
ALTER TABLE public.pr ALTER COLUMN reseller_code DROP NOT NULL;
ALTER TABLE public.pr ALTER COLUMN countries DROP NOT NULL;
ALTER TABLE public.pr ALTER COLUMN shipping_type DROP NOT NULL;
ALTER TABLE public.pr ALTER COLUMN movement_type DROP NOT NULL;
ALTER TABLE public.pr ALTER COLUMN payment_method DROP NOT NULL;

-- ===================================================
-- PART 4: Update PO Table Structure
-- ===================================================

-- Add new columns to PO table
ALTER TABLE public.po ADD COLUMN IF NOT EXISTS supplier_payment_amount NUMERIC;
ALTER TABLE public.po ADD COLUMN IF NOT EXISTS supplier_payment_remarks TEXT;
ALTER TABLE public.po ADD COLUMN IF NOT EXISTS delivery_partner_payment_amount NUMERIC;
ALTER TABLE public.po ADD COLUMN IF NOT EXISTS delivery_partner_remarks TEXT;
ALTER TABLE public.po ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.po ADD COLUMN IF NOT EXISTS invoice_path TEXT;

-- Initialize status_history for existing POs
UPDATE public.po
SET status_history = jsonb_build_array(
  jsonb_build_object(
    'status', status::text,
    'timestamp', created_at,
    'changed_by', created_by_email,
    'remarks', 'Initial status'
  )
)
WHERE status_history = '[]'::jsonb OR status_history IS NULL;

-- ===================================================
-- PART 5: Create Storage Buckets (if not exist)
-- ===================================================

-- Note: These commands might need to be run separately in Supabase Storage UI
-- or via the Supabase Dashboard if they don't exist yet

-- Storage bucket for PR payment proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('pr-payment-proofs', 'pr-payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage bucket for supplier invoices
INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-invoices', 'supplier-invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Storage bucket for delivery invoices
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-invoices', 'delivery-invoices', true)
ON CONFLICT (id) DO NOTHING;

-- ===================================================
-- PART 6: Create Additional Indexes
-- ===================================================

CREATE INDEX IF NOT EXISTS idx_pr_status ON public.pr(pr_status);
CREATE INDEX IF NOT EXISTS idx_po_status ON public.po(status);
CREATE INDEX IF NOT EXISTS idx_po_supplier_payment_status ON public.po(supplier_payment_status);
CREATE INDEX IF NOT EXISTS idx_po_delivery_payment_status ON public.po(delivery_partner_payment_status);
CREATE INDEX IF NOT EXISTS idx_pr_from_qr_id ON public.pr(from_qr_id);

-- ===================================================
-- PART 7: Add Storage Policies (if needed)
-- ===================================================

-- Allow authenticated users to upload to pr-payment-proofs
DO $$ BEGIN
  CREATE POLICY "pr_payment_proofs_upload"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'pr-payment-proofs');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Allow public read access to pr-payment-proofs
DO $$ BEGIN
  CREATE POLICY "pr_payment_proofs_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'pr-payment-proofs');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Allow authenticated users to upload to supplier-invoices
DO $$ BEGIN
  CREATE POLICY "supplier_invoices_upload"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'supplier-invoices');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Allow public read access to supplier-invoices
DO $$ BEGIN
  CREATE POLICY "supplier_invoices_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'supplier-invoices');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Allow authenticated users to upload to delivery-invoices
DO $$ BEGIN
  CREATE POLICY "delivery_invoices_upload"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'delivery-invoices');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Allow public read access to delivery-invoices
DO $$ BEGIN
  CREATE POLICY "delivery_invoices_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'delivery-invoices');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Success message
SELECT 'PR and PO migration completed successfully! Multi-product support enabled.' AS message;
