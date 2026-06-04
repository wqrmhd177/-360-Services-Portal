-- Run this in Supabase SQL Editor if password reset fails with RLS error (42501)
-- Fixes: "new row violates row-level security policy for table password_reset_tokens"

DROP POLICY IF EXISTS "password_reset_tokens_all" ON public.password_reset_tokens;
CREATE POLICY "password_reset_tokens_all" ON public.password_reset_tokens
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
