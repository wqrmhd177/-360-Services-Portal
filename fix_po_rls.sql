-- Fix Row Level Security for PO table (Purchase Orders)
-- Run this in Supabase SQL Editor so the portal can read POs with the anon key.
-- Your table has rows but the app was getting 0 because RLS was blocking anon.

-- Allow anon to read all rows in po (portal uses anon key for getProcurementPOs)
DROP POLICY IF EXISTS "Allow anon read po" ON public.po;
CREATE POLICY "Allow anon read po"
ON public.po
FOR SELECT
TO anon
USING (true);

-- Optional: allow anon to insert/update if your app creates/updates POs with the anon key
-- DROP POLICY IF EXISTS "Allow anon insert update po" ON public.po;
-- CREATE POLICY "Allow anon insert update po"
-- ON public.po
-- FOR ALL
-- TO anon
-- USING (true)
-- WITH CHECK (true);
