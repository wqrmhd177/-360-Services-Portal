-- Add plain-text password column for admin visibility in Supabase Table Editor.
-- WARNING: Plain passwords are visible to anyone with database access. Internal use only.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS password text;

COMMENT ON COLUMN public.profiles.password IS
  'Plain-text password for internal admin reference and login. Restrict Supabase access.';

-- Optional: backfill password_hash-only accounts (admin must set known passwords after this)
-- UPDATE public.profiles SET password = 'ChangeMe123' WHERE password IS NULL AND password_hash IS NOT NULL;
