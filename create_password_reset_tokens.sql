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

-- RLS: deny all direct client access (server-side only via service role)
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- No public policies — this table is accessed only by the API (service role key bypasses RLS)

-- Optional: auto-clean expired tokens daily
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('clean-reset-tokens', '0 3 * * *',
--   $$DELETE FROM public.password_reset_tokens WHERE expires_at < NOW() - INTERVAL '1 day'$$
-- );
