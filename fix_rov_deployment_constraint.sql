-- SQL Script to fix ROV deployment number uniqueness
-- Scopes the uniqueness to Jobpack, Structure, and SOW Report

-- 1. Drop the overly restrictive global unique constraint
ALTER TABLE insp_rov_jobs DROP CONSTRAINT IF EXISTS uk_deployment_no;

-- 2. Add a composite unique constraint that allows same number across different scopes
-- Note: Using COALESCE for nullable fields in the constraint if needed, 
-- but Postgres UNIQUE allows multiple NULLs. For stricter control, we assume these are present.
ALTER TABLE insp_rov_jobs ADD CONSTRAINT uk_deployment_scope 
UNIQUE(deployment_no, jobpack_id, structure_id, sow_report_no);

-- 3. Verify the change
COMMENT ON CONSTRAINT uk_deployment_scope ON insp_rov_jobs IS 'Allows duplicate deployment numbers across different jobpacks/structures while maintaining uniqueness within a scope.';
