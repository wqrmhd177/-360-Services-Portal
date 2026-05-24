-- Remove QRs without qr_number (readable ID)
-- Run this in Supabase SQL Editor

-- Step 1: Add qr_number column if it doesn't exist
ALTER TABLE public.qr ADD COLUMN IF NOT EXISTS qr_number text;

-- Step 2: Check if there are any QRs without qr_number
-- First, let's see which QRs don't have a qr_number (for verification)
SELECT id, qr_number, created_by_email, reseller_code, status, created_at
FROM public.qr
WHERE qr_number IS NULL OR qr_number = '';

-- Step 3: Delete QRs that don't have a qr_number
DELETE FROM public.qr
WHERE qr_number IS NULL OR qr_number = '';

-- Step 4: Verify deletion (should return 0 rows)
SELECT COUNT(*) as remaining_qrs_without_id
FROM public.qr
WHERE qr_number IS NULL OR qr_number = '';

SELECT 'QRs without ID have been removed successfully!' AS message;
