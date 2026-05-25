-- Supabase schema for 360 Procurement Portal

-- Enums
create type public.shipping_type as enum ('sea', 'air', 'road');
create type public.movement_type as enum ('normal', 'express');
create type public.payment_method as enum ('advance', 'partial', 'invoice');
create type public.pr_approval_status as enum ('pending', 'approved', 'rejected');
create type public.finance_verification_status as enum ('pending', 'verified', 'rejected');
create type public.po_status as enum (
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
create type public.payment_status as enum ('paid', 'unpaid');
create type public.user_role as enum ('growth', 'approver', 'procurement', 'finance');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role public.user_role,
  password text,
  password_hash text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Quotation Requests (QR)
create table public.qr (
  id uuid primary key default gen_random_uuid(),
  created_by_email text not null,
  reseller_code text not null,
  reseller_contact_no text not null,
  reseller_country text not null,
  existing_seller text not null default 'No',
  gold_seller text not null default 'No',
  service_needed text not null,
  countries text[] not null,
  shipping_type public.shipping_type not null,
  shipping_type_by_country jsonb,
  movement_type_by_country jsonb not null,
  purchase_details jsonb not null,
  procurement_response jsonb,
  status text not null default 'open',
  remarks text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Purchase Requests (PR)
create table public.pr (
  id uuid primary key default gen_random_uuid(),
  from_qr_id uuid references public.qr(id) on delete set null,
  created_by_email text not null,
  product_name text not null,
  sku_code text not null,
  quantity numeric not null,
  rate numeric not null,
  amount numeric not null,
  reseller_code text not null,
  countries text[] not null,
  shipping_type public.shipping_type not null,
  movement_type public.movement_type not null,
  payment_method public.payment_method not null,
  reference_files text[] default array[]::text[],
  remarks text,
  approval_status public.pr_approval_status not null default 'pending',
  approved_by_email text,
  finance_verification_status public.finance_verification_status not null default 'pending',
  finance_verified_by_email text,
  po_created boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Purchase Orders (PO)
create table public.po (
  id uuid primary key default gen_random_uuid(),
  pr_id uuid not null references public.pr(id) on delete restrict,
  created_by_email text not null,
  status public.po_status not null default 'order_placed',
  po_type text not null check (po_type in ('internal', 'external')),
  supplier_name text not null,
  supplier_location text not null,
  supplier_invoice_file text,
  delivery_partner text not null,
  delivery_partner_tracking_id text not null,
  delivery_partner_invoice_file text,
  remarks text,
  supplier_payment_status public.payment_status not null default 'unpaid',
  delivery_partner_payment_status public.payment_status not null default 'unpaid',
  delivery_dates jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  user_email text not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz default now()
);

-- Buckets (run via Supabase dashboard or CLI)
-- Storage buckets to create:
-- - pr_references
-- - supplier_invoices
-- - delivery_invoices

-- Basic RLS setup (enable then add policies)
alter table public.profiles enable row level security;
alter table public.qr enable row level security;
alter table public.pr enable row level security;
alter table public.po enable row level security;
alter table public.notifications enable row level security;

-- Example policies (adjust as needed)

-- profiles: user can view/update own profile
create policy "profiles_select_own" on public.profiles
  for select
  using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update
  using (auth.uid() = id);

-- qr: growth creates & owns; procurement can read/update response
create policy "qr_insert_growth" on public.qr
  for insert
  with check (created_by = auth.uid());

create policy "qr_select_own_or_procurement" on public.qr
  for select
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'procurement'
    )
  );

-- pr: created by growth; updated by role during workflow
create policy "pr_select_relevant" on public.pr
  for select
  using (true); -- refine per role if needed

create policy "pr_insert_growth" on public.pr
  for insert
  with check (created_by = auth.uid());

-- notifications: each user sees own
create policy "notifications_select_own" on public.notifications
  for select
  using (user_id = auth.uid());

