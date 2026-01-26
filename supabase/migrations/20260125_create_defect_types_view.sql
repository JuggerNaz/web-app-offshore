-- Create a View for efficient Defect Type retrieval
-- This joins u_lib_combo and u_lib_list to get valid types for each code
CREATE OR REPLACE VIEW v_defect_types_by_code AS
SELECT 
    c.code_1 AS defect_code_id,
    l.lib_id,
    l.lib_desc,
    l.lib_val,
    l.lib_code
FROM u_lib_combo c
JOIN u_lib_list l ON c.code_2 = l.lib_id::text
WHERE 
    c.lib_code = 'AMLYCODFND' 
    AND (c.lib_delete IS NULL OR c.lib_delete = 0)
    AND l.lib_code = 'AMLY_FND'  -- Using AMLY_FND (Findings/Types) as AMLY_TYP is Priorities
    AND (l.lib_delete IS NULL OR l.lib_delete = 0);

-- Grant access
GRANT SELECT ON v_defect_types_by_code TO authenticated;
