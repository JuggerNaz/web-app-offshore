-- SQL Script to update 'metadata' column in 'inspection_type' table

-- 1. Enable 'Default' selection for specific inspection types (e.g. CVINS, GVINS)
-- Replace 'CVINS' with the codes you want to be default
UPDATE inspection_type
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"default": 1}'
WHERE code IN ('CVINS', 'GVINS'); -- Add your codes here

-- 2. Set 'ROV' flag for specific inspection types (rov=1)
-- Replace codes as needed
UPDATE inspection_type
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"rov": 1}'
WHERE code IN ('GVINS', 'CP', 'FMD'); -- Add your codes here

-- 3. Set 'DIVING' flag for specific inspection types (diving=1)
-- Replace codes as needed
UPDATE inspection_type
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"diving": 1}'
WHERE code IN ('MPI', 'BSINS', 'CVINS'); -- Add your codes here

-- 4. Set Platform scope (platform=1) if needed (assuming these are Platform inspections)
UPDATE inspection_type
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"platform": 1}'
WHERE code IN ('CVINS', 'GVINS', 'MPI', 'FMD', 'CP', 'BSINS');

-- 5. Set Pipeline scope (pipeline=1) if needed
UPDATE inspection_type
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"pipeline": 1}'
WHERE code IN ('GVINS', 'CP'); -- Example pipeline inspections
