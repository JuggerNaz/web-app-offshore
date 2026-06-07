-- SQL Script to remove 'requires' key from metadata

-- 1. Remove 'requires' from a specific Inspection Type
UPDATE inspection_type
SET metadata = metadata - 'requires'
WHERE code = 'CPSURV';

-- 2. Remove 'requires' from ALL Inspection Types
-- UPDATE inspection_type
-- SET metadata = metadata - 'requires';

-- 3. Remove other keys (Example)
-- UPDATE inspection_type
-- SET metadata = metadata - 'default'
-- WHERE code = 'GVINS';
