-- Clear Database Script for 360 Procurement Portal
-- This script will delete ALL data from all tables while keeping the table structure intact
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- 
-- WARNING: This will permanently delete all data. Make sure you have a backup if needed!

-- Step 1: Delete in order to respect foreign key constraints
-- Delete from child tables first, then parent tables

-- Delete notifications (references profiles)
DELETE FROM public.notifications;

-- Delete Purchase Orders (references PR)
DELETE FROM public.po;

-- Delete Purchase Requests (references QR)
DELETE FROM public.pr;

-- Delete Quotation Requests
DELETE FROM public.qr;

-- Delete Profiles (no dependencies, but delete last to be safe)
DELETE FROM public.profiles;

-- Step 2: Reset sequences if any (for auto-incrementing IDs)
-- Note: UUIDs don't use sequences, but if you have any sequences, reset them here
-- Example: ALTER SEQUENCE IF EXISTS your_sequence_name RESTART WITH 1;

-- Step 3: Verify deletion (should return 0 for all)
SELECT 
  (SELECT COUNT(*) FROM public.notifications) as notifications_count,
  (SELECT COUNT(*) FROM public.po) as po_count,
  (SELECT COUNT(*) FROM public.pr) as pr_count,
  (SELECT COUNT(*) FROM public.qr) as qr_count,
  (SELECT COUNT(*) FROM public.profiles) as profiles_count;

-- Success message
SELECT 'Database cleared successfully! All data has been deleted.' AS message;
