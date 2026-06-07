-- ============================================================================
-- FIX ALL INSPECTION MODULE RLS POLICIES
-- This script ensures all inspection-related tables have proper RLS policies
-- ============================================================================

-- Enable RLS on all inspection tables
ALTER TABLE IF EXISTS insp_rov_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS insp_rov_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS insp_rov_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS insp_dive_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS insp_dive_data ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROV JOBS TABLE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to insert ROV jobs" ON insp_rov_jobs;
DROP POLICY IF EXISTS "Allow authenticated users to select ROV jobs" ON insp_rov_jobs;
DROP POLICY IF EXISTS "Allow authenticated users to update ROV jobs" ON insp_rov_jobs;
DROP POLICY IF EXISTS "Allow authenticated users to delete ROV jobs" ON insp_rov_jobs;

-- Create new policies
CREATE POLICY "Allow authenticated users to insert ROV jobs"
ON insp_rov_jobs FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to select ROV jobs"
ON insp_rov_jobs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to update ROV jobs"
ON insp_rov_jobs FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete ROV jobs"
ON insp_rov_jobs FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- ROV DATA TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated users to insert ROV data" ON insp_rov_data;
DROP POLICY IF EXISTS "Allow authenticated users to select ROV data" ON insp_rov_data;
DROP POLICY IF EXISTS "Allow authenticated users to update ROV data" ON insp_rov_data;
DROP POLICY IF EXISTS "Allow authenticated users to delete ROV data" ON insp_rov_data;

CREATE POLICY "Allow authenticated users to insert ROV data"
ON insp_rov_data FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to select ROV data"
ON insp_rov_data FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to update ROV data"
ON insp_rov_data FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete ROV data"
ON insp_rov_data FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- ROV MOVEMENTS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated users to insert ROV movements" ON insp_rov_movements;
DROP POLICY IF EXISTS "Allow authenticated users to select ROV movements" ON insp_rov_movements;
DROP POLICY IF EXISTS "Allow authenticated users to update ROV movements" ON insp_rov_movements;
DROP POLICY IF EXISTS "Allow authenticated users to delete ROV movements" ON insp_rov_movements;

CREATE POLICY "Allow authenticated users to insert ROV movements"
ON insp_rov_movements FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to select ROV movements"
ON insp_rov_movements FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to update ROV movements"
ON insp_rov_movements FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete ROV movements"
ON insp_rov_movements FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- DIVE JOBS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated users to insert dive jobs" ON insp_dive_jobs;
DROP POLICY IF EXISTS "Allow authenticated users to select dive jobs" ON insp_dive_jobs;
DROP POLICY IF EXISTS "Allow authenticated users to update dive jobs" ON insp_dive_jobs;
DROP POLICY IF EXISTS "Allow authenticated users to delete dive jobs" ON insp_dive_jobs;

CREATE POLICY "Allow authenticated users to insert dive jobs"
ON insp_dive_jobs FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to select dive jobs"
ON insp_dive_jobs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to update dive jobs"
ON insp_dive_jobs FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete dive jobs"
ON insp_dive_jobs FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- DIVE DATA TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated users to insert dive data" ON insp_dive_data;
DROP POLICY IF EXISTS "Allow authenticated users to select dive data" ON insp_dive_data;
DROP POLICY IF EXISTS "Allow authenticated users to update dive data" ON insp_dive_data;
DROP POLICY IF EXISTS "Allow authenticated users to delete dive data" ON insp_dive_data;

CREATE POLICY "Allow authenticated users to insert dive data"
ON insp_dive_data FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to select dive data"
ON insp_dive_data FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to update dive data"
ON insp_dive_data FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete dive data"
ON insp_dive_data FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT ALL ON insp_rov_jobs TO authenticated;
GRANT ALL ON insp_rov_data TO authenticated;
GRANT ALL ON insp_rov_movements TO authenticated;
GRANT ALL ON insp_dive_jobs TO authenticated;
GRANT ALL ON insp_dive_data TO authenticated;

-- Grant sequence usage
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these to verify policies are created:
-- SELECT tablename, policyname FROM pg_policies WHERE tablename LIKE 'insp_%';
-- SELECT table_name, privilege_type FROM information_schema.table_privileges WHERE grantee = 'authenticated' AND table_name LIKE 'insp_%';
