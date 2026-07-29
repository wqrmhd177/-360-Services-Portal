-- ============================================================
-- Add agent, purchaser, manager roles to the user_role enum
-- Run in the SERVICES PORTAL Supabase SQL Editor
-- ============================================================

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'agent';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'purchaser';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'manager';
