-- ============================================================================
-- COMPREHENSIVE FIX: Contractor Logo Storage
-- ============================================================================
-- This script will:
-- 1. Ensure the storage bucket exists
-- 2. Add the logo_url column
-- 3. Set up ALL necessary RLS policies
-- ============================================================================

-- PART 1: Add logo_url column to u_lib_list
-- ----------------------------------------------------------------------------
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'u_lib_list' AND column_name = 'logo_url'
    ) THEN
        ALTER TABLE u_lib_list ADD COLUMN logo_url TEXT;
        RAISE NOTICE '✅ Added logo_url column';
    ELSE
        RAISE NOTICE '✅ logo_url column already exists';
    END IF;
END $$;

-- PART 2: Ensure storage bucket exists
-- ----------------------------------------------------------------------------
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

-- PART 3: Remove ALL existing policies for this bucket
-- ----------------------------------------------------------------------------
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects'
        AND (
            policyname LIKE '%library%logo%' 
            OR policyname LIKE '%library_logos%'
        )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- PART 4: Create fresh RLS policies
-- ----------------------------------------------------------------------------

-- Policy 1: Allow authenticated users to INSERT (upload)
CREATE POLICY "library_logos_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'library-logos');

-- Policy 2: Allow authenticated users to SELECT (read)
CREATE POLICY "library_logos_select_auth"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'library-logos');

-- Policy 3: Allow public (anon) users to SELECT (read)
CREATE POLICY "library_logos_select_public"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'library-logos');

-- Policy 4: Allow authenticated users to UPDATE
CREATE POLICY "library_logos_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'library-logos')
WITH CHECK (bucket_id = 'library-logos');

-- Policy 5: Allow authenticated users to DELETE
CREATE POLICY "library_logos_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'library-logos');

-- PART 5: Verification
-- ----------------------------------------------------------------------------
DO $$ 
DECLARE
    bucket_count INTEGER;
    policy_count INTEGER;
    column_exists BOOLEAN;
BEGIN
    -- Check bucket
    SELECT COUNT(*) INTO bucket_count 
    FROM storage.buckets 
    WHERE id = 'library-logos';
    
    -- Check policies
    SELECT COUNT(*) INTO policy_count 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects'
    AND policyname LIKE 'library_logos%';
    
    -- Check column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'u_lib_list' AND column_name = 'logo_url'
    ) INTO column_exists;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICATION RESULTS:';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Storage bucket exists: %', CASE WHEN bucket_count > 0 THEN '✅ YES' ELSE '❌ NO' END;
    RAISE NOTICE 'RLS policies created: % policies', policy_count;
    RAISE NOTICE 'logo_url column exists: %', CASE WHEN column_exists THEN '✅ YES' ELSE '❌ NO' END;
    RAISE NOTICE '========================================';
    
    IF bucket_count > 0 AND policy_count >= 5 AND column_exists THEN
        RAISE NOTICE '✅ ALL CHECKS PASSED - Ready to upload logos!';
    ELSE
        RAISE WARNING '⚠️  Some checks failed - please review the output above';
    END IF;
END $$;

-- Show created policies for confirmation
SELECT 
    policyname,
    cmd as operation,
    CASE 
        WHEN roles = '{authenticated}' THEN 'authenticated users'
        WHEN roles = '{anon}' THEN 'anonymous users'
        ELSE roles::text
    END as allowed_for
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE 'library_logos%'
ORDER BY policyname;
