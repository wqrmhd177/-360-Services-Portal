-- ============================================================
-- IMPORT: Product Availability Data into Services Portal
-- Run this SQL in the SERVICES PORTAL Supabase SQL Editor.
--
-- Prerequisites:
--   1. Run setup_product_availability.sql first.
--   2. All users referenced by email must already exist in the
--      Services Portal profiles table (create them via the
--      admin/user management if needed).
--   3. Replace the VALUES(...) sections below with the actual
--      exported data from export_product_availability_data.sql.
--
-- IMPORTANT: user identifiers are now EMAIL ADDRESSES, not
-- integer user IDs. The profiles table in the Services Portal
-- uses email as the primary user identifier.
-- ============================================================

-- ── Helper: verify all emails exist before importing ────────
-- Run this to check which emails are missing from profiles.
-- Adjust the list to match your exported data.
/*
SELECT DISTINCT email FROM (
  VALUES
    ('agent@example.com'),
    ('purchaser@example.com'),
    ('manager@example.com')
) AS emails(email)
WHERE email NOT IN (SELECT email FROM profiles);
*/

-- ── Step 1: Create a temp mapping table ──────────────────────
-- Maps old Supplier Portal request UUIDs → new Services Portal UUIDs.

CREATE TEMP TABLE IF NOT EXISTS pa_id_map (
  old_id  uuid PRIMARY KEY,
  new_id  uuid
);

-- ── Step 2: Insert requests ───────────────────────────────────
-- Replace the VALUES below with actual exported data.
-- Format: (old_id, requested_by_email, assigned_purchaser_email, ...)
--
-- Example rows (replace with your actual export):
/*
WITH inserted AS (
  INSERT INTO product_availability_requests (
    requested_by_user_id,
    requested_by_role,
    product_status,
    markets,
    market,
    assigned_purchaser_user_id,
    assignment_status,
    responded_at,
    reseller_name,
    product_name,
    sku,
    reference_link,
    remarks,
    priority_level,
    request_images,
    inventory_matches,
    status,
    is_draft,
    created_at,
    updated_at
  )
  SELECT
    src.requested_by_email,         -- email replaces integer user_id
    src.requested_by_role,
    src.product_status,
    src.markets,
    src.market,
    src.assigned_purchaser_email,   -- email replaces integer user_id
    src.assignment_status,
    src.responded_at,
    src.reseller_name,
    src.product_name,
    src.sku,
    src.reference_link,
    src.remarks,
    src.priority_level,
    src.request_images,
    src.inventory_matches,
    src.status,
    src.is_draft,
    src.created_at,
    src.updated_at
  FROM (VALUES
    -- (old_id::uuid, requested_by_email, requested_by_role, product_status,
    --  markets, market, assigned_purchaser_email, assignment_status,
    --  responded_at, reseller_name, product_name, sku, reference_link, remarks,
    --  priority_level, request_images, inventory_matches, status, is_draft,
    --  created_at, updated_at)
    (
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
      'agent@example.com',
      'agent',
      'not_sure',
      ARRAY['UAE']::text[],
      'UAE',
      'purchaser@example.com',
      'completed',
      NULL::timestamptz,
      'Sample Reseller',
      'Sample Product',
      NULL,
      NULL,
      NULL,
      'normal',
      ARRAY[]::text[],
      '[]'::jsonb,
      'completed',
      false,
      '2026-01-01T00:00:00Z'::timestamptz,
      '2026-01-02T00:00:00Z'::timestamptz
    )
  ) AS src(old_id, requested_by_email, requested_by_role, product_status,
           markets, market, assigned_purchaser_email, assignment_status,
           responded_at, reseller_name, product_name, sku, reference_link, remarks,
           priority_level, request_images, inventory_matches, status, is_draft,
           created_at, updated_at)
  RETURNING id, (
    SELECT old_id FROM (VALUES
      ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid)
    ) AS old_ids(old_id) LIMIT 1
  ) AS old_id
)
INSERT INTO pa_id_map (old_id, new_id)
SELECT old_id, id FROM inserted;
*/

-- ── Step 3: Insert responses ──────────────────────────────────
-- After step 2, use pa_id_map to link responses to new request IDs.
--
/*
INSERT INTO product_availability_responses (
  request_id,
  responded_by_user_id,
  availability,
  stock_status,
  single_unit_price,
  bulk_unit_price,
  response_images,
  remarks,
  round_number,
  created_at,
  updated_at
)
SELECT
  m.new_id,                       -- mapped new request UUID
  src.responded_by_email,         -- email replaces integer user_id
  src.availability,
  src.stock_status,
  src.single_unit_price,
  src.bulk_unit_price,
  src.response_images,
  src.remarks,
  src.round_number,
  src.created_at,
  src.updated_at
FROM (VALUES
  -- (old_request_id::uuid, responded_by_email, availability, stock_status,
  --  single_unit_price, bulk_unit_price, response_images, remarks, round_number,
  --  created_at, updated_at)
  (
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
    'purchaser@example.com',
    'available',
    'limited',
    99.99::numeric,
    NULL::numeric,
    ARRAY[]::text[],
    'In stock at warehouse',
    1,
    '2026-01-02T00:00:00Z'::timestamptz,
    '2026-01-02T00:00:00Z'::timestamptz
  )
) AS src(old_request_id, responded_by_email, availability, stock_status,
         single_unit_price, bulk_unit_price, response_images, remarks, round_number,
         created_at, updated_at)
JOIN pa_id_map m ON m.old_id = src.old_request_id;
*/

-- ── Step 4: Verify import ──────────────────────────────────────
SELECT
  COUNT(*) AS total_requests,
  COUNT(*) FILTER (WHERE is_draft = false) AS live_requests,
  COUNT(*) FILTER (WHERE is_draft = true)  AS draft_requests,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed,
  COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
  COUNT(*) FILTER (WHERE status = 'delayed')   AS delayed,
  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
FROM product_availability_requests;

SELECT COUNT(*) AS total_responses FROM product_availability_responses;
