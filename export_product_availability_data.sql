-- ============================================================
-- EXPORT: Product Availability Data from Supplier Portal
-- Run this SQL in the SUPPLIER PORTAL Supabase SQL Editor.
--
-- This exports requests and responses joined with user emails
-- so the data can be imported into the Services Portal with
-- email-based user identifiers.
--
-- Step 1: Run this query in Supplier Portal Supabase.
-- Step 2: Copy the result as CSV / JSON.
-- Step 3: Use import_product_availability_data.sql in Services Portal.
-- ============================================================

-- ── Requests export ──────────────────────────────────────────
-- Includes the requesting user's email (for mapping) and the
-- assigned purchaser's email (for mapping to the new portal).

SELECT
  r.id                           AS old_id,
  r.request_number,
  -- Requester email (agent/admin)
  requester.email                AS requested_by_email,
  r.requested_by_role,
  r.product_status,
  r.markets,
  r.market,
  -- Purchaser email
  purchaser.email                AS assigned_purchaser_email,
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
LEFT JOIN users requester
  ON requester.user_id::text = r.requested_by_user_id
LEFT JOIN users purchaser
  ON purchaser.user_id::text = r.assigned_purchaser_user_id
ORDER BY r.created_at ASC;


-- ── Responses export ─────────────────────────────────────────

SELECT
  rsp.id               AS old_response_id,
  r.id                 AS old_request_id,
  responder.email      AS responded_by_email,
  rsp.availability,
  rsp.stock_status,
  rsp.single_unit_price,
  rsp.bulk_unit_price,
  rsp.response_images,
  rsp.remarks,
  rsp.round_number,
  rsp.created_at,
  rsp.updated_at
FROM product_availability_responses rsp
JOIN product_availability_requests r
  ON r.id = rsp.request_id
LEFT JOIN users responder
  ON responder.user_id::text = rsp.responded_by_user_id
ORDER BY rsp.request_id, rsp.round_number ASC;
