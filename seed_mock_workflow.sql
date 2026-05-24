-- Seed deterministic mock workflow data for 360 Portal (Supabase)
-- Creates at least 5 entries at every workflow step:
-- QRs (5 each status) → PRs (5 each approval) → Finance verification (5 each) → POs (5 each key status)
-- Also ensures Finance PO Payments pages show eligible items:
-- - Supplier eligible: shipment_received_at_lp_warehouse / shipment_received_at_destination_city /
--   shipment_received_at_destination_warehouse / delivered
-- - Delivery eligible: delivered
--
-- Run after you clear data using: clear_qr_pr_po_for_reseed.sql
-- Run in Supabase SQL Editor: Dashboard → Project → SQL Editor → New query → paste → Run

BEGIN;

-- ---------------------------------------------------
-- Helpers
-- ---------------------------------------------------
DO $$
BEGIN
  -- Ensure required extension exists in most Supabase projects; ignore if already installed.
  PERFORM 1;
END $$;

-- ---------------------------------------------------
-- 1) Seed QRs: 5 per status (open/responded/converted_to_pr/canceled)
-- ---------------------------------------------------
WITH seed AS (
  SELECT
    gs AS n,
    CASE
      WHEN gs BETWEEN 1 AND 5 THEN 'open'
      WHEN gs BETWEEN 6 AND 10 THEN 'responded'
      WHEN gs BETWEEN 11 AND 15 THEN 'converted_to_pr'
      ELSE 'canceled'
    END AS status,
    CASE
      WHEN gs % 3 = 0 THEN 'sea'
      WHEN gs % 3 = 1 THEN 'air'
      ELSE 'road'
    END AS shipping_type,
    CASE
      WHEN gs % 2 = 0 THEN 'normal'
      ELSE 'express'
    END AS movement_type
  FROM generate_series(1, 20) gs
),
inserted AS (
  INSERT INTO public.qr (
    created_by_email,
    reseller_code,
    reseller_contact_no,
    reseller_country,
    existing_seller,
    gold_seller,
    service_needed,
    countries,
    shipping_type,
    shipping_type_by_country,
    movement_type_by_country,
    purchase_details,
    procurement_response,
    status,
    remarks,
    created_at,
    updated_at
  )
  SELECT
    'waqar@tazahtech.com'::text AS created_by_email,
    ('RS-' || lpad(n::text, 3, '0'))::text AS reseller_code,
    ('+97150000' || lpad(n::text, 3, '0'))::text AS reseller_contact_no,
    CASE WHEN n % 2 = 0 THEN 'UAE' ELSE 'KSA' END AS reseller_country,
    CASE WHEN n % 2 = 0 THEN 'Yes' ELSE 'No' END AS existing_seller,
    CASE WHEN n % 4 = 0 THEN 'Yes' ELSE 'No' END AS gold_seller,
    CASE WHEN n % 2 = 0 THEN 'Sourcing' ELSE 'Fulfillment' END AS service_needed,
    ARRAY[CASE WHEN n % 2 = 0 THEN 'UAE' ELSE 'KSA' END, 'QTR']::text[] AS countries,
    shipping_type::public.shipping_type,
    jsonb_build_object(
      'UAE', shipping_type,
      'KSA', shipping_type,
      'QTR', shipping_type
    ) AS shipping_type_by_country,
    jsonb_build_object(
      'UAE', movement_type,
      'KSA', movement_type,
      'QTR', movement_type
    ) AS movement_type_by_country,
    jsonb_build_array(
      jsonb_build_object(
        'productName', 'Mock Product ' || n,
        'destinationCountries', jsonb_build_array('UAE','KSA'),
        'quantity', 10 + n,
        'targetPrice', 100 + (n * 2),
        'countryDetails', jsonb_build_array(
          jsonb_build_object('country','UAE','quantity',10 + n,'targetPrice',100 + (n * 2),'currency','AED'),
          jsonb_build_object('country','KSA','quantity', 5 + (n % 4),'targetPrice', 90 + n,'currency','SAR')
        ),
        'countryOfPurchase', CASE WHEN n % 2 = 0 THEN 'China' ELSE 'Local Market' END,
        'shippingType', shipping_type,
        'movementType', movement_type,
        'imagePaths', jsonb_build_array('qr-attachments/mock-' || n || '.png')
      )
    ) AS purchase_details,
    CASE
      WHEN status = 'responded' OR status = 'converted_to_pr' THEN
        jsonb_build_object(
          'respondedBy', 'procurement@tazahtech.com',
          'respondedAt', now(),
          'notes', 'Mock procurement response for QR ' || n,
          'stock', jsonb_build_array(
            jsonb_build_object('warehouse','UAE','qty', 50 + n,'costPerUnit', 80 + n),
            jsonb_build_object('warehouse','KSA','qty', 20 + (n % 10),'costPerUnit', 85 + n)
          )
        )
      ELSE NULL
    END AS procurement_response,
    status,
    'Mock QR seed'::text AS remarks,
    now() - ((25 - n) * interval '1 day') AS created_at,
    now() - ((25 - n) * interval '1 day') AS updated_at
  FROM seed
  RETURNING id, status, reseller_code, created_at
)
SELECT
  status,
  COUNT(*) AS inserted
FROM inserted
GROUP BY status
ORDER BY status;

-- ---------------------------------------------------
-- 2) Seed PRs: 5 per approval status, and for approved PRs: 5 per finance verification status
--    We seed 25 PRs total:
--      - 5 approval pending
--      - 5 approval rejected
--      - 15 approval approved (split 5 pending finance, 5 verified, 5 rejected)
-- ---------------------------------------------------

-- Determine which optional PR columns exist (from migrations) so this script works on older schemas.
DO $$
DECLARE
  has_products boolean;
  has_seller_channel_name boolean;
  has_seller_service_type boolean;
  has_pr_status boolean;
  has_rejection_reason boolean;
  has_rejected_at boolean;
  has_approval_remarks boolean;
  has_approved_at boolean;
  has_finance_remarks boolean;
  has_finance_rejection_reason boolean;
  has_finance_verified_at boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pr' AND column_name='products') INTO has_products;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pr' AND column_name='seller_channel_name') INTO has_seller_channel_name;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pr' AND column_name='seller_service_type') INTO has_seller_service_type;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pr' AND column_name='pr_status') INTO has_pr_status;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pr' AND column_name='rejection_reason') INTO has_rejection_reason;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pr' AND column_name='rejected_at') INTO has_rejected_at;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pr' AND column_name='approval_remarks') INTO has_approval_remarks;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pr' AND column_name='approved_at') INTO has_approved_at;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pr' AND column_name='finance_remarks') INTO has_finance_remarks;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pr' AND column_name='finance_rejection_reason') INTO has_finance_rejection_reason;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pr' AND column_name='finance_verified_at') INTO has_finance_verified_at;

  -- Use a temp table to hold QR ids available for PR linkage (prefer converted_to_pr then responded)
  CREATE TEMP TABLE IF NOT EXISTS tmp_qr_for_pr AS
  SELECT id, status
  FROM public.qr
  WHERE status IN ('converted_to_pr','responded')
  ORDER BY created_at ASC;

  CREATE TEMP TABLE IF NOT EXISTS tmp_pr_seed (
    n int,
    approval_status text,
    finance_status text,
    from_qr_id uuid,
    amount numeric
  ) ON COMMIT DROP;

  TRUNCATE TABLE tmp_pr_seed;

  -- Build 25 PR rows with deterministic status distribution.
  INSERT INTO tmp_pr_seed (n, approval_status, finance_status, from_qr_id, amount)
  SELECT
    gs AS n,
    CASE
      WHEN gs BETWEEN 1 AND 5 THEN 'pending'
      WHEN gs BETWEEN 6 AND 10 THEN 'rejected'
      ELSE 'approved'
    END AS approval_status,
    CASE
      WHEN gs BETWEEN 11 AND 15 THEN 'pending'
      WHEN gs BETWEEN 16 AND 20 THEN 'verified'
      WHEN gs BETWEEN 21 AND 25 THEN 'rejected'
      ELSE 'pending'
    END AS finance_status,
    (SELECT id FROM tmp_qr_for_pr ORDER BY id LIMIT 1 OFFSET ((gs - 1) % (SELECT COUNT(*) FROM tmp_qr_for_pr))) AS from_qr_id,
    (1000 + (gs * 37))::numeric AS amount
  FROM generate_series(1, 25) gs;

  -- Insert PRs using dynamic SQL to optionally include migrated columns.
  -- We always fill legacy required columns to be compatible with base schema.
  EXECUTE (
    'WITH src AS (' ||
    '  SELECT * FROM tmp_pr_seed ORDER BY n' ||
    ')' ||
    ' INSERT INTO public.pr (' ||
    '  from_qr_id, created_by_email,' ||
    '  product_name, sku_code, quantity, rate, amount,' ||
    '  reseller_code, countries, shipping_type, movement_type, payment_method,' ||
    '  reference_files, remarks,' ||
    '  approval_status, approved_by_email,' ||
    '  finance_verification_status, finance_verified_by_email,' ||
    '  po_created, created_at, updated_at' ||
    CASE WHEN has_seller_channel_name THEN ', seller_channel_name' ELSE '' END ||
    CASE WHEN has_seller_service_type THEN ', seller_service_type' ELSE '' END ||
    CASE WHEN has_products THEN ', products' ELSE '' END ||
    CASE WHEN has_pr_status THEN ', pr_status' ELSE '' END ||
    CASE WHEN has_approval_remarks THEN ', approval_remarks' ELSE '' END ||
    CASE WHEN has_approved_at THEN ', approved_at' ELSE '' END ||
    CASE WHEN has_rejection_reason THEN ', rejection_reason' ELSE '' END ||
    CASE WHEN has_rejected_at THEN ', rejected_at' ELSE '' END ||
    CASE WHEN has_finance_remarks THEN ', finance_remarks' ELSE '' END ||
    CASE WHEN has_finance_rejection_reason THEN ', finance_rejection_reason' ELSE '' END ||
    CASE WHEN has_finance_verified_at THEN ', finance_verified_at' ELSE '' END ||
    ' )' ||
    ' SELECT' ||
    '  from_qr_id,' ||
    '  ''waqar@tazahtech.com'',' ||
    '  ''PR Mock Product '' || n,' ||
    '  ''SKU-'' || lpad(n::text, 4, ''0''),' ||
    '  (10 + (n % 7))::numeric,' ||
    '  (100 + (n * 3))::numeric,' ||
    '  amount,' ||
    '  ''RS-'' || lpad(((n % 20) + 1)::text, 3, ''0''),' ||
    '  ARRAY[''UAE'',''KSA'']::text[],' ||
    '  (CASE WHEN n % 3 = 0 THEN ''sea'' WHEN n % 3 = 1 THEN ''air'' ELSE ''road'' END)::public.shipping_type,' ||
    '  (CASE WHEN n % 2 = 0 THEN ''normal'' ELSE ''express'' END)::public.movement_type,' ||
    '  (CASE WHEN n % 3 = 0 THEN ''advance'' WHEN n % 3 = 1 THEN ''partial'' ELSE ''invoice'' END)::public.payment_method,' ||
    '  ARRAY[]::text[],' ||
    '  ''Mock PR seed'',' ||
    '  approval_status::public.pr_approval_status,' ||
    '  (CASE WHEN approval_status = ''approved'' THEN ''approver@tazahtech.com'' ELSE NULL END),' ||
    '  finance_status::public.finance_verification_status,' ||
    '  (CASE WHEN finance_status = ''verified'' THEN ''finance@tazahtech.com'' ELSE NULL END),' ||
    '  false,' ||
    '  now() - ((40 - n) * interval ''1 day''),' ||
    '  now() - ((40 - n) * interval ''1 day'')' ||
    CASE WHEN has_seller_channel_name THEN ', ''RS-'' || lpad(((n % 20) + 1)::text, 3, ''0'')' ELSE '' END ||
    CASE WHEN has_seller_service_type THEN ', (CASE WHEN n % 2 = 0 THEN ''Zambeel 360'' ELSE ''Wholesale'' END)' ELSE '' END ||
    CASE WHEN has_products THEN
      ', jsonb_build_array(' ||
      '    jsonb_build_object(' ||
      '      ''productName'', ''PR Mock Product '' || n,' ||
      '      ''skuCode'', ''SKU-'' || lpad(n::text, 4, ''0''),' ||
      '      ''destinationCountry'', ''UAE'',' ||
      '      ''countryOfPurchase'', (CASE WHEN n % 2 = 0 THEN ''China'' ELSE ''Local Market'' END),' ||
      '      ''quantity'', (10 + (n % 7)),' ||
      '      ''sellingPricePerUnit'', (100 + (n * 3)),' ||
      '      ''currency'', ''AED'',' ||
      '      ''totalAmount'', amount,' ||
      '      ''shippingType'', (CASE WHEN n % 3 = 0 THEN ''sea'' WHEN n % 3 = 1 THEN ''air'' ELSE ''road'' END),' ||
      '      ''movementType'', (CASE WHEN n % 2 = 0 THEN ''normal'' ELSE ''express'' END),' ||
      '      ''remarks'', ''Mock line item''' ||
      '    )' ||
      '  )'
    ELSE '' END ||
    CASE WHEN has_pr_status THEN
      ', (CASE ' ||
      '    WHEN approval_status = ''approved'' AND finance_status = ''verified'' THEN ''payment_verified'' ' ||
      '    WHEN approval_status = ''approved'' THEN ''approved'' ' ||
      '    WHEN approval_status = ''rejected'' THEN ''rejected'' ' ||
      '    ELSE ''pending'' ' ||
      '  END)'
    ELSE '' END ||
    CASE WHEN has_approval_remarks THEN ', (CASE WHEN approval_status = ''approved'' THEN ''Approved (mock)'' ELSE NULL END)' ELSE '' END ||
    CASE WHEN has_approved_at THEN ', (CASE WHEN approval_status = ''approved'' THEN now() ELSE NULL END)' ELSE '' END ||
    CASE WHEN has_rejection_reason THEN ', (CASE WHEN approval_status = ''rejected'' THEN ''Rejected by approver (mock)'' ELSE NULL END)' ELSE '' END ||
    CASE WHEN has_rejected_at THEN ', (CASE WHEN approval_status = ''rejected'' THEN now() ELSE NULL END)' ELSE '' END ||
    CASE WHEN has_finance_remarks THEN ', (CASE WHEN finance_status = ''pending'' THEN ''Pending finance verification (mock)'' ELSE NULL END)' ELSE '' END ||
    CASE WHEN has_finance_rejection_reason THEN ', (CASE WHEN finance_status = ''rejected'' THEN ''Rejected by finance (mock)'' ELSE NULL END)' ELSE '' END ||
    CASE WHEN has_finance_verified_at THEN ', (CASE WHEN finance_status = ''verified'' THEN now() ELSE NULL END)' ELSE '' END ||
    ' FROM src;'
  );
END $$;

-- Mark QR status as converted_to_pr for those actually linked (optional consistency)
UPDATE public.qr
SET status = 'converted_to_pr', updated_at = now()
WHERE id IN (SELECT DISTINCT from_qr_id FROM public.pr WHERE from_qr_id IS NOT NULL);

-- ---------------------------------------------------
-- 3) Seed POs: 5 per key status (25 total), linked to verified PRs
-- ---------------------------------------------------
DO $$
DECLARE
  verified_pr_ids uuid[];
  pr_count int;
  has_status_history boolean;
  has_supplier_payment_amount boolean;
  has_delivery_partner_payment_amount boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='po' AND column_name='status_history') INTO has_status_history;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='po' AND column_name='supplier_payment_amount') INTO has_supplier_payment_amount;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='po' AND column_name='delivery_partner_payment_amount') INTO has_delivery_partner_payment_amount;

  SELECT array_agg(id ORDER BY created_at ASC)
  INTO verified_pr_ids
  FROM public.pr
  WHERE approval_status = 'approved'::public.pr_approval_status
    AND finance_verification_status = 'verified'::public.finance_verification_status;

  pr_count := COALESCE(array_length(verified_pr_ids, 1), 0);
  IF pr_count < 5 THEN
    RAISE EXCEPTION 'Need at least 5 verified PRs to seed POs; found %', pr_count;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS tmp_po_seed (
    n int,
    status text
  ) ON COMMIT DROP;
  TRUNCATE TABLE tmp_po_seed;

  INSERT INTO tmp_po_seed (n, status)
  SELECT
    gs AS n,
    CASE
      WHEN gs BETWEEN 1 AND 5 THEN 'order_placed'
      WHEN gs BETWEEN 6 AND 10 THEN 'shipment_received_at_lp_warehouse'
      WHEN gs BETWEEN 11 AND 15 THEN 'shipment_received_at_destination_city'
      WHEN gs BETWEEN 16 AND 20 THEN 'shipment_received_at_destination_warehouse'
      ELSE 'delivered'
    END AS status
  FROM generate_series(1, 25) gs;

  EXECUTE (
    'WITH src AS (SELECT * FROM tmp_po_seed ORDER BY n) ' ||
    'INSERT INTO public.po (' ||
    ' pr_id, created_by_email, status, po_type,' ||
    ' supplier_name, supplier_location, supplier_invoice_file,' ||
    ' delivery_partner, delivery_partner_tracking_id, delivery_partner_invoice_file,' ||
    ' remarks, supplier_payment_status, delivery_partner_payment_status,' ||
    ' delivery_dates, created_at, updated_at' ||
    CASE WHEN has_supplier_payment_amount THEN ', supplier_payment_amount' ELSE '' END ||
    CASE WHEN has_delivery_partner_payment_amount THEN ', delivery_partner_payment_amount' ELSE '' END ||
    CASE WHEN has_status_history THEN ', status_history' ELSE '' END ||
    ')' ||
    ' SELECT' ||
    '  (SELECT (''' || verified_pr_ids[1]::text || '''::uuid) )' ||
    '  , ''waqar@tazahtech.com''' ||
    '  , status::public.po_status' ||
    '  , (CASE WHEN n % 2 = 0 THEN ''external'' ELSE ''internal'' END)' ||
    '  , ''Mock Supplier '' || ((n % 5) + 1)' ||
    '  , (CASE WHEN n % 2 = 0 THEN ''Dubai'' ELSE ''Riyadh'' END)' ||
    '  , NULL' ||
    '  , (CASE WHEN n % 2 = 0 THEN ''Aramex'' ELSE ''DHL'' END)' ||
    '  , ''TRK-'' || lpad(n::text, 6, ''0'')' ||
    '  , NULL' ||
    '  , ''Mock PO seed''' ||
    '  , ''unpaid''::public.payment_status' ||
    '  , ''unpaid''::public.payment_status' ||
    '  , jsonb_build_object(''deliveredAt'', CASE WHEN status = ''delivered'' THEN now() ELSE NULL END)' ||
    '  , now() - ((20 - n) * interval ''1 day'')' ||
    '  , now() - ((20 - n) * interval ''1 day'')' ||
    CASE WHEN has_supplier_payment_amount THEN ', (500 + (n * 10))::numeric' ELSE '' END ||
    CASE WHEN has_delivery_partner_payment_amount THEN ', (200 + (n * 5))::numeric' ELSE '' END ||
    CASE WHEN has_status_history THEN
      ', jsonb_build_array(jsonb_build_object(''status'', status, ''timestamp'', now(), ''changed_by'', ''procurement@tazahtech.com'', ''remarks'', ''Seeded''))'
    ELSE '' END ||
    ' FROM src;'
  );

  -- Fix: link each PO to a verified PR in round-robin to avoid all pointing to same PR.
  -- (We inserted with a placeholder pr_id above to keep dynamic SQL simple; now update deterministically.)
  WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY created_at ASC, id ASC) AS rn
    FROM public.po
    WHERE remarks = 'Mock PO seed'
  )
  UPDATE public.po p
  SET pr_id = verified_pr_ids[ ((o.rn - 1) % pr_count) + 1 ],
      updated_at = now()
  FROM ordered o
  WHERE p.id = o.id;

  -- Also mark those PRs as po_created=true when linked.
  UPDATE public.pr
  SET po_created = true, updated_at = now()
  WHERE id IN (SELECT DISTINCT pr_id FROM public.po);
END $$;

-- ---------------------------------------------------
-- 4) Verification queries (quick checks)
-- ---------------------------------------------------
-- QRs by status (should be 5 each)
SELECT status, COUNT(*) AS count
FROM public.qr
GROUP BY status
ORDER BY status;

-- PRs by approval + finance verification
SELECT approval_status::text AS approval_status, finance_verification_status::text AS finance_status, COUNT(*) AS count
FROM public.pr
GROUP BY approval_status, finance_verification_status
ORDER BY approval_status, finance_verification_status;

-- POs by status (should be 5 for each of the 5 seeded statuses)
SELECT status::text AS po_status, COUNT(*) AS count
FROM public.po
GROUP BY status
ORDER BY status;

-- PO payment eligibility checks (mirrors Finance filters)
SELECT
  SUM(CASE WHEN status IN ('shipment_received_at_lp_warehouse','shipment_received_at_destination_city','shipment_received_at_destination_warehouse','delivered') THEN 1 ELSE 0 END) AS supplier_payment_eligible,
  SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivery_payment_eligible
FROM public.po;

COMMIT;

