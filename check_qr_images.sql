-- Check QR image data
-- Run this in Supabase SQL Editor

SELECT 
  qr_number,
  created_at,
  purchase_details::text as details
FROM public.qr
WHERE qr_number IN ('QR-002', 'QR-003')
ORDER BY created_at DESC;

-- This will show if imagePaths are stored in the purchase_details
