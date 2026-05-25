-- Ensure both password columns exist on profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS password text;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS password_hash text;
