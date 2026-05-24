-- Setup Supabase Storage Bucket for QR Attachments
-- Run this in Supabase SQL Editor

-- Note: Storage buckets are usually created through the Supabase Dashboard UI
-- Go to Storage → Create a new bucket

-- Bucket Configuration:
-- Name: qr-attachments
-- Public: YES (so images can be viewed without authentication)
-- File Size Limit: 50MB
-- Allowed MIME types: image/*

-- After creating the bucket through UI, you can set policies with SQL:

-- Allow public read access to all files in qr-attachments bucket
CREATE POLICY "Public Access to QR Images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'qr-attachments');

-- Allow authenticated users to upload to qr-attachments
CREATE POLICY "Authenticated users can upload QR images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'qr-attachments');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Authenticated users can delete QR images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'qr-attachments');

-- Verify policies
SELECT * FROM storage.policies WHERE bucket_id = 'qr-attachments';
