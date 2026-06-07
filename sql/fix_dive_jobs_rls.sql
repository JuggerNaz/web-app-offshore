-- ============================================================================
-- FIX ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Use this script to fix visibility issues where data exists in the table
-- but does not appear in the application.

-- 1. Enable RLS on the table (ensure it's on)
ALTER TABLE insp_dive_jobs ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow read dive jobs" ON insp_dive_jobs;
DROP POLICY IF EXISTS "Allow insert dive jobs" ON insp_dive_jobs;
DROP POLICY IF EXISTS "Allow update dive jobs" ON insp_dive_jobs;
DROP POLICY IF EXISTS "Allow update own dive jobs" ON insp_dive_jobs;

-- 3. Create Permissive Policies for Authenticated Users

-- Allow any authenticated user to VIEW dive jobs
CREATE POLICY "Allow read dive jobs" ON insp_dive_jobs
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow any authenticated user to CREATE dive jobs
CREATE POLICY "Allow insert dive jobs" ON insp_dive_jobs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow any authenticated user to UPDATE dive jobs
CREATE POLICY "Allow update dive jobs" ON insp_dive_jobs
    FOR UPDATE
    TO authenticated
    USING (true);

-- Verify Access (Optional - for testing in SQL Editor)
-- SET ROLE authenticated;
-- SELECT * FROM insp_dive_jobs;
