-- Signup team field + allow pending users without a portal role yet.
-- Run in Supabase SQL Editor.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS team TEXT;

COMMENT ON COLUMN public.profiles.team IS
  'Organizational team selected at signup (growth, operations, finance, strategy, partner_store, listing_team). Portal role/permissions are assigned by admin.';

ALTER TABLE public.profiles
  ALTER COLUMN role DROP NOT NULL;
