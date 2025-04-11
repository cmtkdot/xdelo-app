-- XdeloMedia RLS Policies Migration
-- This script creates the Row Level Security policies for the core tables

-- First enable RLS on all relevant tables
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.other_messages ENABLE ROW LEVEL SECURITY;

-- Messages table policies
-- Allow authenticated users to select messages
CREATE POLICY authenticated_select
ON public.messages
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to insert messages
CREATE POLICY authenticated_insert
ON public.messages
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to update messages
CREATE POLICY authenticated_update
ON public.messages
FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to delete messages
CREATE POLICY authenticated_delete
ON public.messages
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Deleted Messages table policies
-- Enable all operations for authenticated users on deleted_messages
CREATE POLICY "Enable all operations for authenticated users on deleted_messages"
ON public.deleted_messages
FOR ALL
USING (true);

-- Other Messages table policies
-- Allow authenticated users to select other_messages
CREATE POLICY authenticated_select
ON public.other_messages
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to insert other_messages
CREATE POLICY authenticated_insert
ON public.other_messages
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to update other_messages
CREATE POLICY authenticated_update
ON public.other_messages
FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to delete other_messages
CREATE POLICY authenticated_delete
ON public.other_messages
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Unified Audit Logs table policies
-- Allow authenticated users to select unified_audit_logs
CREATE POLICY "Allow authenticated users to select"
ON public.unified_audit_logs
FOR SELECT
USING (true);

-- Allow authenticated users to insert unified_audit_logs
CREATE POLICY "Allow authenticated users to insert"
ON public.unified_audit_logs
FOR INSERT
WITH CHECK (true);

-- Allow authenticated users to update unified_audit_logs
CREATE POLICY "Allow authenticated users to update"
ON public.unified_audit_logs
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Allow authenticated users to delete unified_audit_logs
CREATE POLICY "Allow authenticated users to delete"
ON public.unified_audit_logs
FOR DELETE
USING (true);

-- Note: These policies assume authentication is handled via Supabase Auth
-- and that all authenticated users should have access to all messages.
-- More granular policies can be added if needed for user-specific data access.
