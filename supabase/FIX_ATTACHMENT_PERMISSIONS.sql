-- ============================================================================
-- FIX: Enable RLS Policies for Attachments Table
-- ============================================================================
-- This script enables Row Level Security (RLS) and adds policies for the
-- 'attachment' table to allow users to view, upload, and delete their files.
-- ============================================================================

-- 1. Enable RLS on the attachment table
ALTER TABLE IF EXISTS public.attachment ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow public read access" ON public.attachment;
DROP POLICY IF EXISTS "Allow authenticated users to read attachments" ON public.attachment;
DROP POLICY IF EXISTS "Allow authenticated users to insert attachments" ON public.attachment;
DROP POLICY IF EXISTS "Allow authenticated users to delete attachments" ON public.attachment;
DROP POLICY IF EXISTS "Allow authenticated users to update attachments" ON public.attachment;

-- 3. Create comprehensive policies for authenticated users
-- Allow everyone (including guests) to read attachments if that's intended, 
-- or restrict to 'authenticated' as shown below.

CREATE POLICY "Allow authenticated users to read attachments"
    ON public.attachment
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert attachments"
    ON public.attachment
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update attachments"
    ON public.attachment
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete attachments"
    ON public.attachment
    FOR DELETE
    TO authenticated
    USING (true);

-- 4. Enable RLS and policies for Storage (if not already set)
-- This allows deleting physical files from the 'attachments' bucket
-- Note: Replace 'attachments' with your actual bucket name if different

-- Ensure policies exist for the storage.objects table for the 'attachments' bucket
-- Note: These might need to be run as an admin/super-user
-- INSERT INTO storage.policies (name, bucket_id, definition, action)
-- VALUES ('Allow delete', 'attachments', '(auth.role() = ''authenticated'')', 'DELETE')
-- ON CONFLICT DO NOTHING;

-- Verification
SELECT 
    tablename,
    policyname,
    cmd as operation
FROM pg_policies
WHERE tablename = 'attachment'
ORDER BY cmd;
