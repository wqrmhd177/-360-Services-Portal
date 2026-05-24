-- Clear only workflow transactional data (Supabase)
-- Deletes: purchase orders, purchase requests, quotation requests
-- Keeps: profiles (logins/roles), storage, and other setup
--
-- Run in Supabase SQL Editor:
-- Dashboard → Project → SQL Editor → New query → paste → Run
--
-- NOTE: Order matters (children first): PO → PR → QR

BEGIN;

DELETE FROM public.po;
DELETE FROM public.pr;
DELETE FROM public.qr;

-- Optional: uncomment if you want to clear workflow notifications too (keeps profiles)
-- DELETE FROM public.notifications;

-- Verify counts (should be 0)
SELECT
  (SELECT COUNT(*) FROM public.po) AS po_count,
  (SELECT COUNT(*) FROM public.pr) AS pr_count,
  (SELECT COUNT(*) FROM public.qr) AS qr_count;

COMMIT;

