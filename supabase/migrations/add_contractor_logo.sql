-- ============================================================================
-- CONTRACTOR LOGO FEATURE - DATABASE SETUP
-- ============================================================================
-- This script sets up everything needed for contractor logo uploads:
-- 1. Adds logo_url column to u_lib_list table
-- 2. Creates storage bucket for library logos
-- 3. Sets up RLS policies for secure uploads
--
-- HOW TO RUN:
-- 1. Go to https://app.supabase.com/project/zpsmxtdqlpbdwfzctqzd/sql
-- 2. Copy and paste this entire script
-- 3. Click "Run" button
-- ============================================================================

-- Step 1: Add logo_url column to u_lib_list table
-- ----------------------------------------------------------------------------
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'u_lib_list' 
        AND column_name = 'logo_url'
    ) THEN
        ALTER TABLE u_lib_list ADD COLUMN logo_url TEXT;
        RAISE NOTICE 'Added logo_url column to u_lib_list table';
    ELSE
        RAISE NOTICE 'logo_url column already exists';
    END IF;
END $$;

-- Add comment to document the column's purpose
COMMENT ON COLUMN u_lib_list.logo_url IS 'URL to contractor logo image (for CONTRACTOR library)';

-- Step 2: Create storage bucket for library logos
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'library-logos', 
    'library-logos', 
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Step 3: Set up RLS policies for storage bucket
-- ----------------------------------------------------------------------------
-- Drop existing policies if they exist (for clean re-run)
DROP POLICY IF EXISTS "library_logos_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "library_logos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "library_logos_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "library_logos_authenticated_update" ON storage.objects;

-- Allow authenticated users to upload to library-logos bucket
CREATE POLICY "library_logos_authenticated_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'library-logos');

-- Allow public read access to library-logos
CREATE POLICY "library_logos_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'library-logos');

-- Allow authenticated users to delete from library-logos
CREATE POLICY "library_logos_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'library-logos');

-- Allow authenticated users to update files in library-logos
CREATE POLICY "library_logos_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'library-logos')
WITH CHECK (bucket_id = 'library-logos');

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify the setup was successful:

-- Check if logo_url column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'u_lib_list' AND column_name = 'logo_url';

-- Check if storage bucket exists
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'library-logos';

-- Check RLS policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'objects' AND policyname LIKE 'library_logos%';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$ 
BEGIN
    RAISE NOTICE '✅ Contractor logo feature setup complete!';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Verify the setup by running the verification queries above';
    RAISE NOTICE '2. Test uploading a contractor logo in the application';
    RAISE NOTICE '3. Check that logos display correctly in the library list';
END $$;
