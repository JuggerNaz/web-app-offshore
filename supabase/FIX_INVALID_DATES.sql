-- Fix Invalid Effective Date Issue
-- Run this in Supabase SQL Editor

-- 1. Check current effective_date values
SELECT 
    id,
    procedure_number,
    procedure_name,
    effective_date,
    pg_typeof(effective_date) as date_type
FROM defect_criteria_procedures;

-- 2. Update any NULL or invalid effective dates to current date
UPDATE defect_criteria_procedures
SET effective_date = NOW()
WHERE effective_date IS NULL;

-- 3. Verify the fix
SELECT 
    id,
    procedure_number,
    procedure_name,
    effective_date,
    status
FROM defect_criteria_procedures
ORDER BY effective_date DESC;
