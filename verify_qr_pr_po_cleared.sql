-- Verify QR, PR, and PO data is fully removed (Supabase)
-- Run in Supabase SQL Editor after clear_qr_pr_po_history.sql

SELECT
  (SELECT COUNT(*) FROM public.po) AS po_count,
  (SELECT COUNT(*) FROM public.pr) AS pr_count,
  (SELECT COUNT(*) FROM public.qr) AS qr_count;

-- If all counts are 0, you'll see: po_count=0, pr_count=0, qr_count=0
-- Optional: confirm tables are empty (returns no rows if cleared)
SELECT 'po' AS table_name, COUNT(*) AS rows FROM public.po
UNION ALL
SELECT 'pr', COUNT(*) FROM public.pr
UNION ALL
SELECT 'qr', COUNT(*) FROM public.qr;
