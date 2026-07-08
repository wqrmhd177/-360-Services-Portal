-- Promote an existing user to portal admin (run once for your first admin, or as needed).
-- Replace the email below, then run in Supabase SQL Editor.

UPDATE public.profiles
SET role = 'admin', updated_at = now()
WHERE email = 'your-email@example.com';
