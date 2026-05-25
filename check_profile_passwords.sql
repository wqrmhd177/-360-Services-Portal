-- View user passwords for admin (run in Supabase SQL Editor)
-- If you see "Failed to fetch", use Table Editor → profiles instead (see note below).

SELECT
  email,
  full_name,
  role,
  password,
  CASE
    WHEN password IS NOT NULL AND password <> '' THEN 'set'
    WHEN password_hash IS NOT NULL AND password_hash <> '' THEN 'hash only'
    ELSE 'missing'
  END AS password_status,
  updated_at
FROM public.profiles
ORDER BY email;
