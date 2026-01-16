-- ============================================================================
-- QUICK FIX: Contractor Logo Upload RLS Policies
-- ============================================================================
-- Copy and paste this into Supabase SQL Editor:
-- https://app.supabase.com/project/zpsmxtdqlpbdwfzctqzd/sql
-- ============================================================================

-- Step 1: Add logo_url column (if not exists)
ALTER TABLE u_lib_list ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Step 2: Drop existing policies (clean slate)
DROP POLICY IF EXISTS "library_logos_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "library_logos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "library_logos_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "library_logos_authenticated_update" ON storage.objects;

-- Step 3: Create RLS policies for library-logos bucket

-- Allow authenticated users to upload files
CREATE POLICY "library_logos_authenticated_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'library-logos');

-- Allow everyone to read/view files (public access)
CREATE POLICY "library_logos_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'library-logos');

-- Allow authenticated users to delete their files
CREATE POLICY "library_logos_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'library-logos');

-- Allow authenticated users to update their files
CREATE POLICY "library_logos_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'library-logos')
WITH CHECK (bucket_id = 'library-logos');

-- ============================================================================
-- DONE! Now try uploading a contractor logo again.
-- ============================================================================
