-- Existing users may have password_hash only (plain password column empty).
-- Plain text cannot be recovered from a bcrypt hash.
--
-- Option 1 (recommended): each user uses Forgot password once.
-- Option 2: admin sets known passwords manually, e.g.:
--
-- UPDATE public.profiles
-- SET password = 'TheirNewPassword123', updated_at = now()
-- WHERE email = 'user@example.com';
--
-- Option 3: after deploying login sync, users sign in once — the app
-- writes the typed password into the password column automatically.
--
-- Check status:
SELECT
  email,
  full_name,
  role,
  CASE
    WHEN password IS NOT NULL AND password <> '' THEN password
    ELSE '(empty — sign in once or reset password)'
  END AS password,
  CASE
    WHEN password IS NOT NULL AND password <> '' THEN 'visible'
    WHEN password_hash IS NOT NULL THEN 'hash only'
    ELSE 'missing'
  END AS status
FROM public.profiles
ORDER BY email;
