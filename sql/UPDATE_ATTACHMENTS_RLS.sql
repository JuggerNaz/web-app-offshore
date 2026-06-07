-- ============================================================================
-- FIX: Attachments Storage RLS
-- ============================================================================
-- Run this in Supabase SQL Editor: 
-- https://app.supabase.com/project/zpsmxtdqlpbdwfzctqzd/sql
-- ============================================================================

-- Step 1: Allow authenticated users to UPDATE files in the attachments bucket
CREATE POLICY "Enable update for authenticated users on attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'attachments')
WITH CHECK (bucket_id = 'attachments');

-- Step 2: Verify the policy exists
SELECT 
    policyname,
    cmd as operation,
    roles::text as for_role
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND (qual LIKE '%attachments%' OR with_check LIKE '%attachments%')
ORDER BY policyname;
