-- Run this in Supabase SQL Editor to enable OTP-based password reset
-- Creates a table to store one-time reset codes per email

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email       text NOT NULL UNIQUE,   -- one active token per email
  otp         text NOT NULL,
  expires_at  timestamptz NOT NULL,
  used        boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- RLS: table is accessed only by server-side API routes (anon key, same as profiles/qr/pr)
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "password_reset_tokens_all" ON public.password_reset_tokens;
CREATE POLICY "password_reset_tokens_all" ON public.password_reset_tokens
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Optional: auto-clean expired tokens daily
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('clean-reset-tokens', '0 3 * * *',
--   $$DELETE FROM public.password_reset_tokens WHERE expires_at < NOW() - INTERVAL '1 day'$$
-- );
