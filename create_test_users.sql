-- Create Pre-signed Test Users for 360 Procurement Portal
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- 
-- This script creates test user profiles in the database
-- Note: The simple-login system uses cookies, so passwords are not stored in the database
-- These profiles are created for reference and to ensure users exist in the profiles table

-- Insert test users into profiles table
-- Growth Role
INSERT INTO public.profiles (email, full_name, role, created_at, updated_at)
VALUES ('waqar@tazahtech.com', 'Waqar', 'growth', now(), now())
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  updated_at = now();

-- Approver Role
INSERT INTO public.profiles (email, full_name, role, created_at, updated_at)
VALUES ('ilqa@tazahtech.com', 'Ilqa', 'approver', now(), now())
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  updated_at = now();

-- Procurement Role
INSERT INTO public.profiles (email, full_name, role, created_at, updated_at)
VALUES ('moazam@tazahtech.com', 'Moazam', 'procurement', now(), now())
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  updated_at = now();

-- Finance Role
INSERT INTO public.profiles (email, full_name, role, created_at, updated_at)
VALUES ('saif@tazahtech.com', 'Saif', 'finance', now(), now())
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  updated_at = now();

-- Verify users were created
SELECT email, full_name, role, created_at
FROM public.profiles
WHERE email IN (
  'waqar@tazahtech.com',
  'ilqa@tazahtech.com',
  'moazam@tazahtech.com',
  'saif@tazahtech.com'
)
ORDER BY role;

-- Success message
SELECT 'Test users created successfully!' AS message;
