-- ============================================================================
-- FIX ALL LOGO UPLOADS - Company Logo + Contractor Logo
-- ============================================================================
-- This script sets up storage buckets and RLS policies for:
-- 1. Company logo (company-assets bucket)
-- 2. Contractor logos (library-logos bucket)
-- ============================================================================

-- PART 1: Add logo_url column to u_lib_list (for contractor logos)
-- ----------------------------------------------------------------------------
ALTER TABLE u_lib_list ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- PART 2: Create/Update BOTH storage buckets
-- ----------------------------------------------------------------------------

-- Bucket 1: company-assets (for company logo in settings)
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

-- Bucket 2: library-logos (for contractor logos in library)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'library-logos',
    'library-logos',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[];

-- PART 3: Drop ALL existing policies for both buckets
-- ----------------------------------------------------------------------------

-- Drop company-assets policies
DROP POLICY IF EXISTS "company_assets_insert" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_select_auth" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_select_public" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_update" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_delete" ON storage.objects;

-- Drop library-logos policies
DROP POLICY IF EXISTS "library_logos_insert" ON storage.objects;
DROP POLICY IF EXISTS "library_logos_select_auth" ON storage.objects;
DROP POLICY IF EXISTS "library_logos_select_public" ON storage.objects;
DROP POLICY IF EXISTS "library_logos_update" ON storage.objects;
DROP POLICY IF EXISTS "library_logos_delete" ON storage.objects;
DROP POLICY IF EXISTS "Enable insert for authenticated users on library-logos" ON storage.objects;
DROP POLICY IF EXISTS "Enable select for authenticated users on library-logos" ON storage.objects;
DROP POLICY IF EXISTS "Enable select for anon users on library-logos" ON storage.objects;
DROP POLICY IF EXISTS "Enable update for authenticated users on library-logos" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for authenticated users on library-logos" ON storage.objects;

-- PART 4: Create RLS policies for company-assets bucket
-- ----------------------------------------------------------------------------

CREATE POLICY "company_assets_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-assets');

CREATE POLICY "company_assets_select_auth"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'company-assets');

CREATE POLICY "company_assets_select_public"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'company-assets');

CREATE POLICY "company_assets_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'company-assets')
WITH CHECK (bucket_id = 'company-assets');

CREATE POLICY "company_assets_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'company-assets');

-- PART 5: Create RLS policies for library-logos bucket
-- ----------------------------------------------------------------------------

CREATE POLICY "library_logos_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'library-logos');

CREATE POLICY "library_logos_select_auth"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'library-logos');

CREATE POLICY "library_logos_select_public"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'library-logos');

CREATE POLICY "library_logos_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'library-logos')
WITH CHECK (bucket_id = 'library-logos');

CREATE POLICY "library_logos_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'library-logos');

-- PART 6: Verification
-- ----------------------------------------------------------------------------

-- Check buckets
SELECT 
    'Buckets Created' as check_name,
    COUNT(*) || ' buckets' as status
FROM storage.buckets 
WHERE id IN ('company-assets', 'library-logos');

-- Check policies for company-assets
SELECT 
    'company-assets policies' as check_name,
    COUNT(*) || ' policies' as status
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE 'company_assets%';

-- Check policies for library-logos
SELECT 
    'library-logos policies' as check_name,
    COUNT(*) || ' policies' as status
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE 'library_logos%';

-- List all policies
SELECT 
    policyname,
    cmd as operation,
    CASE 
        WHEN policyname LIKE 'company_assets%' THEN 'company-assets'
        WHEN policyname LIKE 'library_logos%' THEN 'library-logos'
    END as bucket
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND (policyname LIKE 'company_assets%' OR policyname LIKE 'library_logos%')
ORDER BY bucket, cmd, policyname;

-- ============================================================================
-- DONE! You should now be able to:
-- 1. Upload company logo in Settings page
-- 2. Upload contractor logos in Library page
-- ============================================================================
