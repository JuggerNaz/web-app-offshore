-- ============================================================================
-- Diagnostic Queries for Defect Criteria Procedures Retrieval Issue
-- ============================================================================
-- Run these queries in Supabase SQL Editor to diagnose the problem
-- ============================================================================

-- ============================================================================
-- 1. Check if table exists and has data
-- ============================================================================
SELECT 
    COUNT(*) as total_procedures,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_procedures,
    COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_procedures
FROM defect_criteria_procedures;

-- Expected: Should show at least 1 procedure
-- If 0, the data wasn't saved properly

-- ============================================================================
-- 2. View all procedures with details
-- ============================================================================
SELECT 
    id,
    procedure_number,
    procedure_name,
    version,
    status,
    effective_date,
    created_by,
    created_at
FROM defect_criteria_procedures
ORDER BY effective_date DESC;

-- Expected: Should show your saved procedure(s)
-- Check the column names match what the API expects

-- ============================================================================
-- 3. Check RLS (Row Level Security) status
-- ============================================================================
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'defect_criteria_procedures';

-- If rls_enabled = true, you need policies

-- ============================================================================
-- 4. Check existing RLS policies
-- ============================================================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'defect_criteria_procedures';

-- Expected: Should show SELECT policy for authenticated users
-- If empty and RLS is enabled, that's the problem!

-- ============================================================================
-- 5. Check column data types match API expectations
-- ============================================================================
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'defect_criteria_procedures'
ORDER BY ordinal_position;

-- Verify these columns exist:
-- - id (bigint)
-- - procedure_number (character varying)
-- - procedure_name (character varying)
-- - version (integer)
-- - effective_date (timestamp with time zone)
-- - status (character varying)
-- - created_by (character varying)
-- - created_at (timestamp with time zone)

-- ============================================================================
-- 6. Test direct SELECT query (simulating API)
-- ============================================================================
SELECT *
FROM defect_criteria_procedures
WHERE status = 'active'
ORDER BY effective_date DESC;

-- If this returns data but the API doesn't, it's an RLS issue

-- ============================================================================
-- SOLUTION: If RLS is enabled but no policies exist
-- ============================================================================
-- Run this to add RLS policies:

-- Enable RLS (if not already enabled)
ALTER TABLE defect_criteria_procedures ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to SELECT
DROP POLICY IF EXISTS "Allow authenticated users to read procedures" ON defect_criteria_procedures;
CREATE POLICY "Allow authenticated users to read procedures"
    ON defect_criteria_procedures
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Allow authenticated users to INSERT
DROP POLICY IF EXISTS "Allow authenticated users to create procedures" ON defect_criteria_procedures;
CREATE POLICY "Allow authenticated users to create procedures"
    ON defect_criteria_procedures
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy: Allow authenticated users to UPDATE
DROP POLICY IF EXISTS "Allow authenticated users to update procedures" ON defect_criteria_procedures;
CREATE POLICY "Allow authenticated users to update procedures"
    ON defect_criteria_procedures
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy: Allow authenticated users to DELETE
DROP POLICY IF EXISTS "Allow authenticated users to delete procedures" ON defect_criteria_procedures;
CREATE POLICY "Allow authenticated users to delete procedures"
    ON defect_criteria_procedures
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================================================
-- 7. Verify policies were created
-- ============================================================================
SELECT 
    policyname,
    cmd as operation
FROM pg_policies
WHERE tablename = 'defect_criteria_procedures'
ORDER BY cmd;

-- Expected output:
-- Allow authenticated users to read procedures     | SELECT
-- Allow authenticated users to create procedures   | INSERT
-- Allow authenticated users to update procedures   | UPDATE
-- Allow authenticated users to delete procedures   | DELETE

-- ============================================================================
-- 8. Test retrieval again
-- ============================================================================
SELECT *
FROM defect_criteria_procedures
WHERE status = 'active'
ORDER BY effective_date DESC;

-- This should now work both in SQL editor and via API
