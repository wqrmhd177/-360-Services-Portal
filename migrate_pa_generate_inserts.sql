-- ============================================================
-- STEP 1 OF 2 — Run this in SUPPLIER PORTAL Supabase SQL Editor
-- ============================================================
-- Produces ready-to-paste INSERT SQL for the Services Portal.
-- User IDs (integers) are automatically replaced with emails.
--
-- HOW TO USE:
--   1. Run QUERY A below — copy the full text from the result cell.
--   2. Run QUERY B below — copy the full text from the result cell.
--   3. Paste both into the SERVICES PORTAL SQL Editor and run.
-- ============================================================


-- ╔══════════════════════════════════════════════════════════╗
-- ║  QUERY A — Requests INSERT SQL (run this first)         ║
-- ╚══════════════════════════════════════════════════════════╝
SELECT
  string_agg(
    format(
      'INSERT INTO product_availability_requests'
      || ' (id, request_number, requested_by_user_id, requested_by_role,'
      || '  product_status, markets, market, assigned_purchaser_user_id,'
      || '  assignment_status, responded_at, reseller_name, product_name,'
      || '  sku, reference_link, remarks, priority_level,'
      || '  request_images, inventory_matches, status, is_draft, created_at, updated_at)'
      || E'\nVALUES ('
      || '  %L,'                                -- id
      || '  %L::integer,'                       -- request_number
      || '  %L,'                                -- requested_by_user_id (email)
      || '  %L,'                                -- requested_by_role
      || '  %L,'                                -- product_status
      || '  ARRAY[%s]::text[],'                 -- markets
      || '  %L,'                                -- market
      || '  %L,'                                -- assigned_purchaser_user_id (email)
      || '  %L,'                                -- assignment_status
      || '  %L,'                                -- responded_at
      || '  %L,'                                -- reseller_name
      || '  %L,'                                -- product_name
      || '  %L,'                                -- sku
      || '  %L,'                                -- reference_link
      || '  %L,'                                -- remarks
      || '  %L,'                                -- priority_level
      || '  ARRAY[%s]::text[],'                 -- request_images
      || '  %L::jsonb,'                         -- inventory_matches
      || '  %L,'                                -- status
      || '  %L,'                                -- is_draft
      || '  %L,'                                -- created_at
      || '  %L'                                 -- updated_at
      || E'\n) ON CONFLICT (id) DO NOTHING;',
      r.id,
      r.request_number,
      COALESCE(u_req.email, r.requested_by_user_id),
      r.requested_by_role,
      r.product_status,
      -- markets array → quoted list
      COALESCE(
        (SELECT string_agg(quote_literal(m), ',') FROM unnest(r.markets) AS m),
        ''
      ),
      r.market,
      COALESCE(u_pur.email, r.assigned_purchaser_user_id),
      r.assignment_status,
      r.responded_at,
      r.reseller_name,
      r.product_name,
      r.sku,
      r.reference_link,
      r.remarks,
      r.priority_level,
      -- request_images array → quoted list
      COALESCE(
        (SELECT string_agg(quote_literal(img), ',') FROM unnest(r.request_images) AS img),
        ''
      ),
      COALESCE(r.inventory_matches::text, '[]'),
      r.status,
      r.is_draft,
      r.created_at,
      r.updated_at
    ),
    E'\n\n'
    ORDER BY r.created_at ASC
  ) AS requests_sql
FROM product_availability_requests r
LEFT JOIN users u_req ON u_req.user_id::text = r.requested_by_user_id
LEFT JOIN users u_pur ON u_pur.user_id::text = r.assigned_purchaser_user_id;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  QUERY B — Responses INSERT SQL (run after A is done)  ║
-- ╚══════════════════════════════════════════════════════════╝
SELECT
  string_agg(
    format(
      'INSERT INTO product_availability_responses'
      || ' (id, request_id, assignment_id, responded_by_user_id,'
      || '  availability, stock_status, single_unit_price, bulk_unit_price,'
      || '  response_images, remarks, round_number, created_at, updated_at)'
      || E'\nVALUES ('
      || '  %L,'                     -- id
      || '  %L,'                     -- request_id (same UUID as in requests)
      || '  %L,'                     -- assignment_id (nullable)
      || '  %L,'                     -- responded_by_user_id (email)
      || '  %L,'                     -- availability
      || '  %L,'                     -- stock_status
      || '  %L,'                     -- single_unit_price
      || '  %L,'                     -- bulk_unit_price
      || '  ARRAY[%s]::text[],'      -- response_images
      || '  %L,'                     -- remarks
      || '  %L::integer,'            -- round_number
      || '  %L,'                     -- created_at
      || '  %L'                      -- updated_at
      || E'\n) ON CONFLICT (id) DO NOTHING;',
      rsp.id,
      rsp.request_id,
      rsp.assignment_id,
      COALESCE(u_rsp.email, rsp.responded_by_user_id),
      rsp.availability,
      COALESCE(rsp.stock_status, 'on_demand'),
      rsp.single_unit_price,
      rsp.bulk_unit_price,
      COALESCE(
        (SELECT string_agg(quote_literal(img), ',') FROM unnest(rsp.response_images) AS img),
        ''
      ),
      rsp.remarks,
      COALESCE(rsp.round_number, 1),
      rsp.created_at,
      rsp.updated_at
    ),
    E'\n\n'
    ORDER BY rsp.request_id, COALESCE(rsp.round_number, 1) ASC
  ) AS responses_sql
FROM product_availability_responses rsp
LEFT JOIN users u_rsp ON u_rsp.user_id::text = rsp.responded_by_user_id;
