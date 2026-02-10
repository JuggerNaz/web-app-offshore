-- Check if structure_components has data for PLAT-C
-- Run this query in your Supabase SQL editor to verify data exists

-- First, find the structure_id for PLAT-C
SELECT plat_id, title FROM u_platform WHERE title = 'PLAT-C';

-- Then check if there are components for this structure
-- Replace XXX with the plat_id from the query above
SELECT 
    id as component_id,
    structure_id,
    qid,
    type,
    elv_1,
    elv_2
FROM structure_components 
WHERE structure_id = XXX  -- Replace with actual plat_id
ORDER BY qid;

-- If no results, check if the table has any data at all
SELECT COUNT(*) as total_components FROM structure_components;

-- Check a sample of what's in the table
SELECT 
    id,
    structure_id,
    qid,
    type
FROM structure_components 
LIMIT 10;
