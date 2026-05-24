-- Clear QR, PR, and PO history only (Supabase)
-- Keeps: profiles, notifications. Deletes: quotation requests, purchase requests, purchase orders.
-- Run in Supabase SQL Editor: Project → SQL Editor → New query → paste → Run

-- Order matters: delete children first (PO → PR → QR)

DELETE FROM public.po;
DELETE FROM public.pr;
DELETE FROM public.qr;

-- Optional: verify counts (should be 0)
SELECT
  (SELECT COUNT(*) FROM public.po) AS po_count,
  (SELECT COUNT(*) FROM public.pr) AS pr_count,
  (SELECT COUNT(*) FROM public.qr) AS qr_count;
