-- ============================================================
-- STEP 2 OF 2 — Paste into SERVICES PORTAL Supabase SQL Editor
-- ============================================================
-- Run AFTER setup_product_availability.sql has been applied.
--
-- 1. First run this header block below to prepare the sequence.
-- 2. Then paste the output from QUERY A (requests) and run.
-- 3. Then paste the output from QUERY B (responses) and run.
-- 4. Then run the verification block at the bottom.
-- ============================================================

-- ── Prepare: reset sequence so it won't clash with imported numbers ──
-- Run this BEFORE pasting the requests SQL:
ALTER SEQUENCE IF EXISTS product_availability_requests_request_number_seq
  RESTART WITH 100000;

-- ══════════════════════════════════════════════════════════════
-- PASTE QUERY A OUTPUT HERE  (requests INSERT statements)
-- ══════════════════════════════════════════════════════════════

-- [paste here]


-- ══════════════════════════════════════════════════════════════
-- PASTE QUERY B OUTPUT HERE  (responses INSERT statements)
-- ══════════════════════════════════════════════════════════════

-- [paste here]


-- ── After import: fix sequence to resume after the highest imported number ──
SELECT setval(
  'product_availability_requests_request_number_seq',
  COALESCE(MAX(request_number), 0) + 1,
  false
)
FROM product_availability_requests;

-- ── Verification: check imported counts ─────────────────────
SELECT
  (SELECT COUNT(*) FROM product_availability_requests)                           AS total_requests,
  (SELECT COUNT(*) FROM product_availability_requests WHERE is_draft = false)    AS live_requests,
  (SELECT COUNT(*) FROM product_availability_requests WHERE status = 'completed') AS completed,
  (SELECT COUNT(*) FROM product_availability_requests WHERE status = 'pending')   AS pending,
  (SELECT COUNT(*) FROM product_availability_requests WHERE status = 'delayed')   AS delayed,
  (SELECT COUNT(*) FROM product_availability_requests WHERE status = 'cancelled') AS cancelled,
  (SELECT COUNT(*) FROM product_availability_responses)                           AS total_responses;
