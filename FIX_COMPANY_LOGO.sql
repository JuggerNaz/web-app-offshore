-- ============================================================================
-- FIX COMPANY LOGO UPLOAD - Settings Page
-- ============================================================================
-- This script sets up the company-assets bucket and RLS policies
-- for the company logo upload feature in Settings page
-- ============================================================================

-- Step 1: Create/Update company-assets storage bucket
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'company-assets',
    'company-assets',
    true,
    2097152, -- 2MB limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']::text[];

-- Step 2: Drop any existing policies for company-assets
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "company_assets_insert" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_select_auth" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_select_public" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_update" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_delete" ON storage.objects;

-- Step 3: Create RLS policies for company-assets bucket
-- ----------------------------------------------------------------------------

-- Allow authenticated users to INSERT (upload)
CREATE POLICY "company_assets_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-assets');

-- Allow authenticated users to SELECT (view)
CREATE POLICY "company_assets_select_auth"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'company-assets');

-- Allow anonymous/public users to SELECT (view logos publicly)
CREATE POLICY "company_assets_select_public"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'company-assets');

-- Allow authenticated users to UPDATE
CREATE POLICY "company_assets_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'company-assets')
WITH CHECK (bucket_id = 'company-assets');

-- Allow authenticated users to DELETE
CREATE POLICY "company_assets_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'company-assets');

-- Step 4: Verification
-- ----------------------------------------------------------------------------

-- Check if bucket exists
SELECT 
    'Bucket Check' as check_name,
    CASE WHEN COUNT(*) > 0 THEN '✅ company-assets bucket exists' ELSE '❌ Bucket missing' END as status
FROM storage.buckets 
WHERE id = 'company-assets' AND public = true

UNION ALL

-- Check if policies exist
SELECT 
    'Policy Check' as check_name,
    CASE 
        WHEN COUNT(*) >= 5 THEN '✅ All 5 policies created'
        ELSE '❌ Only ' || COUNT(*) || ' policies found'
    END as status
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE 'company_assets%';

-- List all policies for company-assets
SELECT 
    policyname,
    cmd as operation,
    CASE 
        WHEN roles = '{authenticated}' THEN 'authenticated'
        WHEN roles = '{anon}' THEN 'public/anon'
        ELSE roles::text
    END as allowed_for
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE 'company_assets%'
ORDER BY cmd, policyname;

-- ============================================================================
-- DONE! Now test uploading company logo in Settings page
-- ============================================================================
