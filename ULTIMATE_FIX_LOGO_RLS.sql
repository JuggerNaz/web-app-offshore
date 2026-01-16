-- ============================================================================
-- ULTIMATE FIX: Contractor Logo Storage RLS
-- ============================================================================
-- Run this in Supabase SQL Editor: 
-- https://app.supabase.com/project/zpsmxtdqlpbdwfzctqzd/sql
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

-- Step 3: Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop ALL existing policies for library-logos
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects'
    ) LOOP
        IF r.policyname LIKE '%library%' OR r.policyname LIKE '%logo%' THEN
            EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON storage.objects';
        END IF;
    END LOOP;
END $$;

-- Step 5: Create NEW policies with correct syntax

-- Allow authenticated users to INSERT files
CREATE POLICY "Enable insert for authenticated users on library-logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'library-logos');

-- Allow authenticated users to SELECT files  
CREATE POLICY "Enable select for authenticated users on library-logos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'library-logos');

-- Allow public/anon to SELECT files (for displaying logos)
CREATE POLICY "Enable select for anon users on library-logos"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'library-logos');

-- Allow authenticated users to UPDATE files
CREATE POLICY "Enable update for authenticated users on library-logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'library-logos')
WITH CHECK (bucket_id = 'library-logos');

-- Allow authenticated users to DELETE files
CREATE POLICY "Enable delete for authenticated users on library-logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'library-logos');

-- Step 6: Verify everything is set up correctly
SELECT 
    'Bucket Check' as check_type,
    CASE WHEN COUNT(*) > 0 THEN '✅ PASS' ELSE '❌ FAIL' END as status,
    'library-logos bucket exists and is public' as description
FROM storage.buckets 
WHERE id = 'library-logos' AND public = true

UNION ALL

SELECT 
    'Column Check' as check_type,
    CASE WHEN COUNT(*) > 0 THEN '✅ PASS' ELSE '❌ FAIL' END as status,
    'logo_url column exists in u_lib_list' as description
FROM information_schema.columns 
WHERE table_name = 'u_lib_list' AND column_name = 'logo_url'

UNION ALL

SELECT 
    'Policy Check' as check_type,
    CASE WHEN COUNT(*) >= 5 THEN '✅ PASS' ELSE '❌ FAIL - Found ' || COUNT(*) || ' policies' END as status,
    'At least 5 RLS policies exist for library-logos' as description
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND (qual LIKE '%library-logos%' OR with_check LIKE '%library-logos%');

-- Step 7: Show all policies for library-logos
SELECT 
    policyname,
    cmd as operation,
    roles::text as for_role
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND (qual LIKE '%library-logos%' OR with_check LIKE '%library-logos%')
ORDER BY policyname;
