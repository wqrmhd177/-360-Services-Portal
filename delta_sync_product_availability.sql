-- ============================================================
-- DELTA SYNC: New/Updated Product Availability Data
-- Run in the SERVICES PORTAL Supabase SQL Editor when teams
-- are ready to fully transition.
--
-- This syncs only records created or updated AFTER the initial
-- import cutoff date. Run once before go-live.
--
-- Prerequisites:
--   - setup_product_availability.sql already applied.
--   - Initial import already done via import_product_availability_data.sql.
--   - Run the export query below in Supplier Portal first.
-- ============================================================

-- ── Set your cutoff date ──────────────────────────────────────
-- Replace with the timestamp when you ran the initial import.
-- Only records updated after this timestamp will be synced.

-- In Supplier Portal, run this export (replace the date):
/*
SELECT
  r.id AS old_id,
  requester.email AS requested_by_email,
  r.requested_by_role,
  r.product_status,
  r.markets,
  r.market,
  purchaser.email AS assigned_purchaser_email,
  r.assignment_status,
  r.responded_at,
  r.reseller_name,
  r.product_name,
  r.sku,
  r.reference_link,
  r.remarks,
  r.priority_level,
  r.request_images,
  r.inventory_matches,
  r.status,
  r.is_draft,
  r.created_at,
  r.updated_at
FROM product_availability_requests r
LEFT JOIN users requester ON requester.user_id::text = r.requested_by_user_id
LEFT JOIN users purchaser ON purchaser.user_id::text = r.assigned_purchaser_user_id
WHERE r.updated_at > '2026-07-08T00:00:00Z'   -- <<< replace with cutoff date
ORDER BY r.created_at ASC;
*/

-- ── Delta upsert (run in Services Portal) ────────────────────
-- Use ON CONFLICT to update existing rows or insert new ones.
-- The conflict target is the old Supplier Portal UUID stored in
-- a separate mapping column (add old_supplier_id text column
-- to track the original UUID if needed for future syncs).

-- Simpler approach: just INSERT new records that don't exist yet.
-- Match by created_at + product_name + reseller_name as a proxy
-- for uniqueness if you don't have the old UUID mapping.

-- ── Recommended: track original IDs ──────────────────────────
-- If you want to support delta syncs, add a source tracking column:

-- ALTER TABLE product_availability_requests
--   ADD COLUMN IF NOT EXISTS supplier_portal_id uuid;
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_par_supplier_portal_id
--   ON product_availability_requests (supplier_portal_id)
--   WHERE supplier_portal_id IS NOT NULL;

-- Then during import and delta sync, set supplier_portal_id = old_id
-- and use ON CONFLICT (supplier_portal_id) DO UPDATE to upsert.

-- ── Quick verification after delta sync ──────────────────────
SELECT
  COUNT(*) AS total,
  MAX(created_at) AS newest_request,
  MAX(updated_at) AS last_updated
FROM product_availability_requests;
