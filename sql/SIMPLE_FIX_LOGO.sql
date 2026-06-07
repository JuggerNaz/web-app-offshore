-- ============================================================================
-- SIMPLE FIX: Contractor Logo Storage RLS Policies
-- ============================================================================
-- This version skips the RLS enable step (it's already enabled by Supabase)
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Ensure logo_url column exists
ALTER TABLE u_lib_list ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Step 2: Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'library-logos',
    'library-logos',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[];

-- Step 3: Drop existing policies (clean slate)
DROP POLICY IF EXISTS "Enable insert for authenticated users on library-logos" ON storage.objects;
DROP POLICY IF EXISTS "Enable select for authenticated users on library-logos" ON storage.objects;
DROP POLICY IF EXISTS "Enable select for anon users on library-logos" ON storage.objects;
DROP POLICY IF EXISTS "Enable update for authenticated users on library-logos" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for authenticated users on library-logos" ON storage.objects;

-- Also drop any old policy names
DROP POLICY IF EXISTS "library_logos_insert" ON storage.objects;
DROP POLICY IF EXISTS "library_logos_select_auth" ON storage.objects;
DROP POLICY IF EXISTS "library_logos_select_public" ON storage.objects;
DROP POLICY IF EXISTS "library_logos_update" ON storage.objects;
DROP POLICY IF EXISTS "library_logos_delete" ON storage.objects;
DROP POLICY IF EXISTS "library_logos_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "library_logos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "library_logos_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "library_logos_authenticated_update" ON storage.objects;

-- Step 4: Create fresh policies

-- Allow authenticated users to INSERT (upload)
CREATE POLICY "Enable insert for authenticated users on library-logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'library-logos');

-- Allow authenticated users to SELECT (view)
CREATE POLICY "Enable select for authenticated users on library-logos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'library-logos');

-- Allow anonymous users to SELECT (public viewing)
CREATE POLICY "Enable select for anon users on library-logos"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'library-logos');

-- Allow authenticated users to UPDATE
CREATE POLICY "Enable update for authenticated users on library-logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'library-logos')
WITH CHECK (bucket_id = 'library-logos');

-- Allow authenticated users to DELETE
CREATE POLICY "Enable delete for authenticated users on library-logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'library-logos');

-- Step 5: Verify setup
SELECT 
    'Bucket exists' as check_name,
    CASE WHEN COUNT(*) > 0 THEN '✅ YES' ELSE '❌ NO' END as status
FROM storage.buckets 
WHERE id = 'library-logos'

UNION ALL

SELECT 
    'Column exists' as check_name,
    CASE WHEN COUNT(*) > 0 THEN '✅ YES' ELSE '❌ NO' END as status
FROM information_schema.columns 
WHERE table_name = 'u_lib_list' AND column_name = 'logo_url'

UNION ALL

SELECT 
    'Policies created' as check_name,
    COUNT(*)::text || ' policies' as status
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%library-logos%';

-- Show created policies
SELECT 
    policyname,
    cmd as operation
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%library-logos%'
ORDER BY cmd, policyname;
