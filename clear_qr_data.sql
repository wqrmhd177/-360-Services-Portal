-- Clear QR, PR, PO, and Notifications Data (Keep User Profiles)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- 
-- This script deletes all transaction data while preserving user profiles

-- Step 1: Delete all notifications
DELETE FROM public.notifications;

-- Step 2: Delete all Purchase Orders (PO)
DELETE FROM public.po;

-- Step 3: Delete all Purchase Requests (PR)
DELETE FROM public.pr;

-- Step 4: Delete all Quotation Requests (QR)
DELETE FROM public.qr;

-- Step 5: Verify deletion
SELECT 'QRs deleted' as table_name, COUNT(*) as remaining_rows FROM public.qr
UNION ALL
SELECT 'PRs deleted', COUNT(*) FROM public.pr
UNION ALL
SELECT 'POs deleted', COUNT(*) FROM public.po
UNION ALL
SELECT 'Notifications deleted', COUNT(*) FROM public.notifications
UNION ALL
SELECT 'Profiles kept', COUNT(*) FROM public.profiles;

-- Success message
SELECT 'Database cleared! All QR/PR/PO/Notifications deleted. User profiles preserved.' AS message;
