-- Dashboard KPI counts for Finance / Growth / Procurement (SQL instead of JS filter).
-- Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION get_finance_dashboard_counts()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'pendingVerification', (
      SELECT COUNT(*)::INTEGER
      FROM pr
      WHERE approval_status = 'approved'
        AND COALESCE(pr_status, '') <> 'awaiting_payment'
        AND finance_verification_status = 'pending'
    ),
    'verifiedPrs', (
      SELECT COUNT(*)::INTEGER FROM pr WHERE finance_verification_status = 'verified'
    ),
    'unpaidSupplierPos', (
      SELECT COUNT(*)::INTEGER FROM po WHERE supplier_payment_status = 'unpaid'
    ),
    'unpaidDeliveryPos', (
      SELECT COUNT(*)::INTEGER FROM po WHERE delivery_partner_payment_status = 'unpaid'
    ),
    'totalPos', (SELECT COUNT(*)::INTEGER FROM po),
    'supplierPaidPos', (
      SELECT COUNT(*)::INTEGER FROM po WHERE supplier_payment_status = 'paid'
    ),
    'deliveryPaidPos', (
      SELECT COUNT(*)::INTEGER FROM po WHERE delivery_partner_payment_status = 'paid'
    )
  );
$$;

CREATE OR REPLACE FUNCTION get_growth_dashboard_counts(p_email TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'qrOpen', (
      SELECT COUNT(*)::INTEGER FROM qr
      WHERE status = 'open'
        AND (p_email IS NULL OR created_by_email = p_email)
    ),
    'qrResponded', (
      SELECT COUNT(*)::INTEGER FROM qr
      WHERE status = 'responded'
        AND (p_email IS NULL OR created_by_email = p_email)
    ),
    'qrConverted', (
      SELECT COUNT(*)::INTEGER FROM qr
      WHERE status = 'converted_to_pr'
        AND (p_email IS NULL OR created_by_email = p_email)
    ),
    'prPendingApproval', (
      SELECT COUNT(*)::INTEGER FROM pr
      WHERE approval_status = 'pending'
        AND (p_email IS NULL OR created_by_email = p_email)
    ),
    'prApproved', (
      SELECT COUNT(*)::INTEGER FROM pr
      WHERE approval_status = 'approved'
        AND (p_email IS NULL OR created_by_email = p_email)
    ),
    'prFinancePending', (
      SELECT COUNT(*)::INTEGER FROM pr
      WHERE approval_status = 'approved'
        AND finance_verification_status = 'pending'
        AND (p_email IS NULL OR created_by_email = p_email)
    ),
    'prFinanceVerified', (
      SELECT COUNT(*)::INTEGER FROM pr
      WHERE finance_verification_status = 'verified'
        AND (p_email IS NULL OR created_by_email = p_email)
    )
  );
$$;

CREATE OR REPLACE FUNCTION get_procurement_dashboard_counts()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'openQrs', (SELECT COUNT(*)::INTEGER FROM qr WHERE status = 'open'),
    'verifiedPrsReadyForPo', (
      SELECT COUNT(*)::INTEGER
      FROM pr
      WHERE finance_verification_status = 'verified'
        AND po_created = false
    ),
    'poOrderPlaced', (
      SELECT COUNT(*)::INTEGER FROM po WHERE status = 'order_placed'
    ),
    'poInTransit', (
      SELECT COUNT(*)::INTEGER FROM po
      WHERE status IN (
        'shipment_at_supplier',
        'shipment_received_at_lp_warehouse',
        'shipment_received_at_destination_city',
        'shipment_received_at_destination_warehouse'
      )
    ),
    'poDelivered', (
      SELECT COUNT(*)::INTEGER FROM po WHERE status = 'delivered'
    ),
    'poByStatus', COALESCE((
      SELECT jsonb_object_agg(status, cnt)
      FROM (
        SELECT status, COUNT(*)::INTEGER AS cnt
        FROM po
        GROUP BY status
      ) s
    ), '{}'::jsonb)
  );
$$;
