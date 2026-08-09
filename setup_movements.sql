-- Zambeel 360 Movements module (Partner, Gold to Gold, 360 placeholder).
-- Run in Supabase SQL Editor after security lockdown patch (service_role access via app API).

CREATE TABLE IF NOT EXISTS public.movement_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_number TEXT NOT NULL UNIQUE,
  movement_head TEXT NOT NULL CHECK (
    movement_head IN (
      'partner',
      'gold_to_gold',
      '360_seller_inventory',
      '360_zambeel_inventory'
    )
  ),
  created_by_email TEXT NOT NULL,
  from_sku TEXT NOT NULL,
  from_country TEXT NOT NULL,
  from_product_name TEXT,
  to_sku TEXT NOT NULL,
  to_country TEXT NOT NULL,
  to_product_name TEXT,
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  shipping_mode TEXT NOT NULL CHECK (shipping_mode IN ('road', 'air', 'sea')),
  status TEXT NOT NULL DEFAULT 'submitted',
  approver_email TEXT,
  approver_action_at TIMESTAMPTZ,
  approver_remarks TEXT,
  procurement_email TEXT,
  procurement_action_at TIMESTAMPTZ,
  procurement_remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movement_requests_created_by
  ON public.movement_requests (created_by_email);
CREATE INDEX IF NOT EXISTS idx_movement_requests_status
  ON public.movement_requests (status);
CREATE INDEX IF NOT EXISTS idx_movement_requests_head_status
  ON public.movement_requests (movement_head, status);
CREATE INDEX IF NOT EXISTS idx_movement_requests_created_at
  ON public.movement_requests (created_at DESC);

CREATE TABLE IF NOT EXISTS public.movement_request_logs (
  id BIGSERIAL PRIMARY KEY,
  movement_id UUID NOT NULL REFERENCES public.movement_requests (id) ON DELETE CASCADE,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movement_request_logs_movement_id
  ON public.movement_request_logs (movement_id, created_at DESC);

ALTER TABLE public.movement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movement_request_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.movement_requests IS
  'Zambeel 360 inventory movement requests (Partner / Gold to Gold / 360). Isolated from QR/PR/PO.';
