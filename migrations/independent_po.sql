-- Migration: Independent PO support
-- Run this in Supabase SQL Editor before deploying app changes.
-- Enables POs without a linked PR (pr_id nullable) and stores product line items on PO (products JSONB).

-- ===================================================
-- 1. Make pr_id nullable on PO table
-- ===================================================
-- Linked POs keep pr_id set; independent POs have pr_id = null.
-- FK to public.pr(id) is kept so linked POs still validate.

ALTER TABLE public.po ALTER COLUMN pr_id DROP NOT NULL;

-- ===================================================
-- 2. Add products JSONB column to PO table
-- ===================================================
-- Used only for independent POs. Structure per line item:
-- { "productName": string, "skuCode"?: string, "quantity": number, "rate": number, "amount": number }

ALTER TABLE public.po ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '[]'::jsonb;

-- Success
SELECT 'Independent PO migration completed: pr_id nullable, po.products added.' AS message;
