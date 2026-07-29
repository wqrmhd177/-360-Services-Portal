-- ============================================================
-- PRODUCT AVAILABILITY — Full Setup for Services Portal (360-Portal)
-- Run this in the Supabase SQL Editor for the Services Portal project.
--
-- This creates:
--   1. country column on profiles (for manager market filtering)
--   2. product_availability_requests table
--   3. product_availability_responses table
--   4. Indexes, triggers, RLS policies
--   5. submit_availability_response RPC
--   6. request_alternative_search RPC
--   7. auto_mark_delayed trigger (server-side 48-hour delayed status)
--   8. Storage bucket: product_images
-- ============================================================

-- ─── 1. Add country to profiles (managers need it for market filtering) ─────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS country text;

-- ─── 2. product_availability_requests ────────────────────────────────────────
-- User identifiers are stored as email addresses (not integer user IDs)
-- because the Services Portal uses cookie-based auth and emails are the
-- common identifier across both portals.

CREATE SEQUENCE IF NOT EXISTS product_availability_requests_request_number_seq;

CREATE TABLE IF NOT EXISTS product_availability_requests (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number              integer     NOT NULL DEFAULT nextval('product_availability_requests_request_number_seq'),
  requested_by_user_id        text        NOT NULL,          -- email of the requesting user
  requested_by_role           text        NOT NULL DEFAULT 'agent',
  product_status              text        NOT NULL,
  markets                     text[]      NOT NULL DEFAULT '{}',  -- legacy multi-market array
  market                      text,                           -- current single-market field
  assigned_purchaser_user_id  text,                           -- email of the assigned purchaser
  assignment_status           text        NOT NULL DEFAULT 'pending',
  responded_at                timestamptz,
  reseller_name               text        NOT NULL,
  product_name                text        NOT NULL,
  sku                         text,
  reference_link              text,
  remarks                     text,
  priority_level              text        NOT NULL DEFAULT 'normal',
  request_images              text[]      NOT NULL DEFAULT '{}',
  inventory_matches           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  status                      text        NOT NULL DEFAULT 'pending',
  is_draft                    boolean     NOT NULL DEFAULT false,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT par_role_check
    CHECK (requested_by_role IN ('agent', 'purchaser', 'admin', 'manager')),
  CONSTRAINT par_product_status_check
    CHECK (product_status IN ('already_listed', 'not_listed', 'not_sure')),
  CONSTRAINT par_priority_check
    CHECK (priority_level IN ('urgent', 'normal')),
  CONSTRAINT par_status_check
    CHECK (status IN ('pending', 'delayed', 'completed', 'cancelled')),
  CONSTRAINT par_assignment_status_check
    CHECK (assignment_status IN ('pending', 'completed')),
  CONSTRAINT par_images_limit_check
    CHECK (coalesce(array_length(request_images, 1), 0) <= 5),
  CONSTRAINT par_sku_required_check
    CHECK (product_status <> 'already_listed' OR (sku IS NOT NULL AND length(trim(sku)) > 0))
);

CREATE UNIQUE INDEX IF NOT EXISTS product_availability_requests_request_number_idx
  ON product_availability_requests (request_number);
CREATE INDEX IF NOT EXISTS idx_par_status
  ON product_availability_requests (status);
CREATE INDEX IF NOT EXISTS idx_par_created_at
  ON product_availability_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_par_requested_by
  ON product_availability_requests (requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_par_assigned_purchaser
  ON product_availability_requests (assigned_purchaser_user_id);
CREATE INDEX IF NOT EXISTS idx_par_market
  ON product_availability_requests (market);

-- ─── 3. product_availability_responses ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_availability_responses (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id              uuid        NOT NULL REFERENCES product_availability_requests(id) ON DELETE CASCADE,
  assignment_id           uuid,                               -- nullable (legacy field)
  responded_by_user_id    text        NOT NULL,               -- email
  availability            text        NOT NULL,
  stock_status            text        NOT NULL DEFAULT 'on_demand',
  single_unit_price       numeric(12, 2),
  bulk_unit_price         numeric(12, 2),
  response_images         text[]      NOT NULL DEFAULT '{}',
  remarks                 text,
  round_number            integer     NOT NULL DEFAULT 1,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT parsp_availability_check
    CHECK (availability IN ('available', 'not_available', 'on_demand', 'alternative')),
  CONSTRAINT parsp_stock_status_check
    CHECK (stock_status IN ('limited', 'on_demand', 'bulk_limited_both')),
  CONSTRAINT parsp_single_price_check
    CHECK (single_unit_price IS NULL OR single_unit_price >= 0),
  CONSTRAINT parsp_bulk_price_check
    CHECK (bulk_unit_price IS NULL OR bulk_unit_price >= 0),
  CONSTRAINT parsp_images_limit_check
    CHECK (coalesce(array_length(response_images, 1), 0) <= 5)
);

CREATE INDEX IF NOT EXISTS idx_parsp_request_id
  ON product_availability_responses (request_id);

-- ─── 4. Auto-update updated_at trigger ───────────────────────────────────────

CREATE OR REPLACE FUNCTION set_product_availability_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_par_updated_at ON product_availability_requests;
CREATE TRIGGER trg_par_updated_at
  BEFORE UPDATE ON product_availability_requests
  FOR EACH ROW EXECUTE FUNCTION set_product_availability_updated_at();

DROP TRIGGER IF EXISTS trg_parsp_updated_at ON product_availability_responses;
CREATE TRIGGER trg_parsp_updated_at
  BEFORE UPDATE ON product_availability_responses
  FOR EACH ROW EXECUTE FUNCTION set_product_availability_updated_at();

-- ─── 5. Auto-mark delayed trigger ────────────────────────────────────────────
-- Sets status = 'delayed' server-side for requests pending > 48 hours.

CREATE OR REPLACE FUNCTION auto_mark_delayed()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'pending'
     AND NEW.assignment_status = 'pending'
     AND NEW.created_at <= NOW() - INTERVAL '48 hours' THEN
    NEW.status := 'delayed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_mark_delayed ON product_availability_requests;
CREATE TRIGGER trg_auto_mark_delayed
  BEFORE INSERT OR UPDATE ON product_availability_requests
  FOR EACH ROW EXECUTE FUNCTION auto_mark_delayed();

-- Back-fill any existing requests that should already be delayed
UPDATE product_availability_requests
SET status = 'delayed'
WHERE status = 'pending'
  AND assignment_status = 'pending'
  AND created_at <= NOW() - INTERVAL '48 hours';

-- ─── 6. RLS policies (permissive — app-level security handles filtering) ─────

ALTER TABLE product_availability_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_availability_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_par"  ON product_availability_requests;
DROP POLICY IF EXISTS "anon_insert_par"  ON product_availability_requests;
DROP POLICY IF EXISTS "anon_update_par"  ON product_availability_requests;
DROP POLICY IF EXISTS "auth_select_par"  ON product_availability_requests;
DROP POLICY IF EXISTS "auth_insert_par"  ON product_availability_requests;
DROP POLICY IF EXISTS "auth_update_par"  ON product_availability_requests;

CREATE POLICY "anon_select_par"  ON product_availability_requests FOR SELECT TO anon        USING (true);
CREATE POLICY "anon_insert_par"  ON product_availability_requests FOR INSERT TO anon        WITH CHECK (true);
CREATE POLICY "anon_update_par"  ON product_availability_requests FOR UPDATE TO anon        USING (true) WITH CHECK (true);
CREATE POLICY "auth_select_par"  ON product_availability_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_par"  ON product_availability_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_par"  ON product_availability_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_parsp"  ON product_availability_responses;
DROP POLICY IF EXISTS "anon_insert_parsp"  ON product_availability_responses;
DROP POLICY IF EXISTS "anon_update_parsp"  ON product_availability_responses;
DROP POLICY IF EXISTS "auth_select_parsp"  ON product_availability_responses;
DROP POLICY IF EXISTS "auth_insert_parsp"  ON product_availability_responses;
DROP POLICY IF EXISTS "auth_update_parsp"  ON product_availability_responses;

CREATE POLICY "anon_select_parsp"  ON product_availability_responses FOR SELECT TO anon        USING (true);
CREATE POLICY "anon_insert_parsp"  ON product_availability_responses FOR INSERT TO anon        WITH CHECK (true);
CREATE POLICY "anon_update_parsp"  ON product_availability_responses FOR UPDATE TO anon        USING (true) WITH CHECK (true);
CREATE POLICY "auth_select_parsp"  ON product_availability_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_parsp"  ON product_availability_responses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_parsp"  ON product_availability_responses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ─── 7. submit_availability_response RPC ─────────────────────────────────────
-- SECURITY DEFINER so purchasers can submit without elevated RLS roles.
-- Supports multiple rounds: each call appends a new response row and
-- increments round_number.

CREATE OR REPLACE FUNCTION submit_availability_response(
  p_request_id             uuid,
  p_responded_by_user_id   text,
  p_availability           text,
  p_stock_status           text,
  p_single_unit_price      numeric  DEFAULT NULL,
  p_bulk_unit_price        numeric  DEFAULT NULL,
  p_response_images        text[]   DEFAULT ARRAY[]::text[],
  p_remarks                text     DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_round integer;
BEGIN
  -- Determine next round number for this request
  SELECT COALESCE(MAX(round_number), 0) + 1
    INTO v_next_round
    FROM product_availability_responses
   WHERE request_id = p_request_id;

  INSERT INTO product_availability_responses (
    request_id,
    responded_by_user_id,
    availability,
    stock_status,
    single_unit_price,
    bulk_unit_price,
    response_images,
    remarks,
    round_number
  ) VALUES (
    p_request_id,
    p_responded_by_user_id,
    p_availability,
    p_stock_status,
    p_single_unit_price,
    p_bulk_unit_price,
    p_response_images,
    p_remarks,
    v_next_round
  );

  -- Mark the request as completed
  UPDATE product_availability_requests
  SET
    assignment_status = 'completed',
    responded_at      = NOW(),
    status            = 'completed',
    updated_at        = NOW()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'round_number', v_next_round);
END;
$$;

-- ─── 8. request_alternative_search RPC ───────────────────────────────────────
-- Lets agents re-open a completed request for a new purchaser search round.

CREATE OR REPLACE FUNCTION request_alternative_search(
  p_request_id   uuid,
  p_new_remarks  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE product_availability_requests
  SET
    assignment_status = 'pending',
    status            = 'pending',
    remarks           = p_new_remarks,
    updated_at        = NOW()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ─── 9. Storage bucket ────────────────────────────────────────────────────────
-- Run these in the Supabase Dashboard → Storage → New bucket, OR via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('product_images', 'product_images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow all users (anon + authenticated) to upload and read images
DROP POLICY IF EXISTS "product_images_select" ON storage.objects;
DROP POLICY IF EXISTS "product_images_insert" ON storage.objects;

CREATE POLICY "product_images_select"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product_images');

CREATE POLICY "product_images_insert"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'product_images');
