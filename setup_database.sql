-- Setup script for 360 Procurement Portal
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Step 1: Create Enums (if they don't exist)
DO $$ BEGIN
  CREATE TYPE public.shipping_type AS ENUM ('sea', 'air', 'road');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.movement_type AS ENUM ('normal', 'express');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('advance', 'partial', 'invoice');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.pr_approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.finance_verification_status AS ENUM ('pending', 'verified', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.po_status AS ENUM (
    'order_placed',
    'po_created',
    'shipment_at_supplier',
    'shipment_received_at_supplier_warehouse',
    'shipment_received_at_lp_warehouse',
    'shipment_received_at_destination_city',
    'shipment_received_at_destination_warehouse',
    'delivered',
    'canceled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('paid', 'unpaid');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('growth', 'approver', 'procurement', 'finance');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: Create Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text,
  role public.user_role,
  -- Plain password for admin visibility (internal portal only)
  password text,
  -- Bcrypt hash kept for backwards compatibility
  password_hash text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 3: Create QR table
CREATE TABLE IF NOT EXISTS public.qr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_email text NOT NULL,
  reseller_code text NOT NULL,
  reseller_contact_no text NOT NULL,
  reseller_country text NOT NULL,
  existing_seller text NOT NULL DEFAULT 'No',
  gold_seller text NOT NULL DEFAULT 'No',
  service_needed text NOT NULL,
  countries text[] NOT NULL,
  shipping_type public.shipping_type NOT NULL,
  shipping_type_by_country jsonb,
  movement_type_by_country jsonb NOT NULL,
  purchase_details jsonb NOT NULL,
  procurement_response jsonb,
  status text NOT NULL DEFAULT 'open',
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 4: Create PR table
CREATE TABLE IF NOT EXISTS public.pr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_qr_id uuid REFERENCES public.qr(id) ON DELETE SET NULL,
  created_by_email text NOT NULL,
  product_name text NOT NULL,
  sku_code text NOT NULL,
  quantity numeric NOT NULL,
  rate numeric NOT NULL,
  amount numeric NOT NULL,
  reseller_code text NOT NULL,
  countries text[] NOT NULL,
  shipping_type public.shipping_type NOT NULL,
  movement_type public.movement_type NOT NULL,
  payment_method public.payment_method NOT NULL,
  reference_files text[] DEFAULT array[]::text[],
  remarks text,
  approval_status public.pr_approval_status NOT NULL DEFAULT 'pending',
  approved_by_email text,
  finance_verification_status public.finance_verification_status NOT NULL DEFAULT 'pending',
  finance_verified_by_email text,
  po_created boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 5: Create PO table
CREATE TABLE IF NOT EXISTS public.po (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id uuid NOT NULL REFERENCES public.pr(id) ON DELETE RESTRICT,
  created_by_email text NOT NULL,
  status public.po_status NOT NULL DEFAULT 'order_placed',
  po_type text NOT NULL CHECK (po_type IN ('internal', 'external')),
  supplier_name text NOT NULL,
  supplier_location text NOT NULL,
  supplier_invoice_file text,
  delivery_partner text NOT NULL,
  delivery_partner_tracking_id text NOT NULL,
  delivery_partner_invoice_file text,
  remarks text,
  supplier_payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  delivery_partner_payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  delivery_dates jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 6: Create Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Step 7: Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Step 8: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "profiles_all" ON public.profiles;
DROP POLICY IF EXISTS "qr_all" ON public.qr;
DROP POLICY IF EXISTS "pr_all" ON public.pr;
DROP POLICY IF EXISTS "po_all" ON public.po;
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;

-- Step 9: Create RLS Policies (email-based ownership, role-aware at app layer)
-- NOTE: Because the app uses a custom email+password auth (not Supabase Auth),
-- row ownership is enforced in application code by filtering on email columns.
-- These policies keep the database open to the anon/service role, while *app code*
-- must always include appropriate email/role filters.

-- Profiles: allow full access for backend/service usage
CREATE POLICY "profiles_all" ON public.profiles
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- QR: allow all operations; application must always filter by created_by_email and role
CREATE POLICY "qr_all" ON public.qr
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- PR: allow all operations; application enforces role-based access
CREATE POLICY "pr_all" ON public.pr
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- PO: allow all operations; application enforces role-based access
CREATE POLICY "po_all" ON public.po
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Notifications: application code must always filter by user_email
CREATE POLICY "notifications_all" ON public.notifications
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Step 10: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_qr_created_by_email ON public.qr(created_by_email);
CREATE INDEX IF NOT EXISTS idx_qr_status ON public.qr(status);
CREATE INDEX IF NOT EXISTS idx_pr_created_by_email ON public.pr(created_by_email);
CREATE INDEX IF NOT EXISTS idx_pr_approval_status ON public.pr(approval_status);
CREATE INDEX IF NOT EXISTS idx_pr_finance_verification_status ON public.pr(finance_verification_status);
CREATE INDEX IF NOT EXISTS idx_po_pr_id ON public.po(pr_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_email ON public.notifications(user_email);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);

-- Success message
SELECT 'Database setup completed successfully!' AS message;
