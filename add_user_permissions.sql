-- Run in Supabase SQL Editor to enable per-user module permissions.
-- Example shape:
-- {"zambeel360":["growth","procurement"],"product_availability":"agent","product_listing":true,"operations":false}

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS permissions JSONB;

COMMENT ON COLUMN public.profiles.permissions IS
  'Per-module access: zambeel360 (string[]), product_availability (agent|purchaser|manager|null), product_listing (bool), operations (bool)';
