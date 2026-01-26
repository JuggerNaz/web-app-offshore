-- ============================================================================
-- QUICK FIX: Enable RLS Policies for Defect Criteria Tables
-- ============================================================================
-- This fixes the issue where procedures can be saved but not retrieved
-- Root cause: RLS is enabled but no policies exist for SELECT operations
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE defect_criteria_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE defect_criteria_custom_params ENABLE ROW LEVEL SECURITY;
ALTER TABLE defect_criteria_rules ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Policies for defect_criteria_procedures
-- ============================================================================
DROP POLICY IF EXISTS "Allow authenticated users to read procedures" ON defect_criteria_procedures;
CREATE POLICY "Allow authenticated users to read procedures"
    ON defect_criteria_procedures
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to create procedures" ON defect_criteria_procedures;
CREATE POLICY "Allow authenticated users to create procedures"
    ON defect_criteria_procedures
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update procedures" ON defect_criteria_procedures;
CREATE POLICY "Allow authenticated users to update procedures"
    ON defect_criteria_procedures
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to delete procedures" ON defect_criteria_procedures;
CREATE POLICY "Allow authenticated users to delete procedures"
    ON defect_criteria_procedures
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================================================
-- Policies for defect_criteria_custom_params
-- ============================================================================
DROP POLICY IF EXISTS "Allow authenticated users to read custom params" ON defect_criteria_custom_params;
CREATE POLICY "Allow authenticated users to read custom params"
    ON defect_criteria_custom_params
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to create custom params" ON defect_criteria_custom_params;
CREATE POLICY "Allow authenticated users to create custom params"
    ON defect_criteria_custom_params
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update custom params" ON defect_criteria_custom_params;
CREATE POLICY "Allow authenticated users to update custom params"
    ON defect_criteria_custom_params
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to delete custom params" ON defect_criteria_custom_params;
CREATE POLICY "Allow authenticated users to delete custom params"
    ON defect_criteria_custom_params
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================================================
-- Policies for defect_criteria_rules
-- ============================================================================
DROP POLICY IF EXISTS "Allow authenticated users to read rules" ON defect_criteria_rules;
CREATE POLICY "Allow authenticated users to read rules"
    ON defect_criteria_rules
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to create rules" ON defect_criteria_rules;
CREATE POLICY "Allow authenticated users to create rules"
    ON defect_criteria_rules
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update rules" ON defect_criteria_rules;
CREATE POLICY "Allow authenticated users to update rules"
    ON defect_criteria_rules
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to delete rules" ON defect_criteria_rules;
CREATE POLICY "Allow authenticated users to delete rules"
    ON defect_criteria_rules
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================================================
-- Verify policies were created
-- ============================================================================
SELECT 
    tablename,
    policyname,
    cmd as operation
FROM pg_policies
WHERE tablename IN ('defect_criteria_procedures', 'defect_criteria_custom_params', 'defect_criteria_rules')
ORDER BY tablename, cmd;

-- Expected: 12 policies total (4 per table: SELECT, INSERT, UPDATE, DELETE)

-- ============================================================================
-- Test retrieval
-- ============================================================================
SELECT 
    id,
    procedure_number,
    procedure_name,
    version,
    status,
    effective_date
FROM defect_criteria_procedures
ORDER BY effective_date DESC;

-- This should now return your saved procedures!
