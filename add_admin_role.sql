-- Add 'admin' to user_role enum so users can sign up as Admin.
-- Run in Supabase SQL Editor.

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin';
