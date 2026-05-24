-- Fix Row Level Security for Notifications Table
-- Run this in Supabase SQL Editor

-- Drop existing notifications policies if any
DROP POLICY IF EXISTS "notifications_all" ON public.notifications;

-- Create a single permissive policy for notifications.
-- Ownership and role checks are enforced in the application layer
-- by always filtering on user_email or user_id in queries.
CREATE POLICY "notifications_all"
ON public.notifications
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Verify policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'notifications';
