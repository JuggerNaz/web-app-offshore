-- Corrected View Definition (User Final Version)
-- Logic: code_1 = Defect Code (Input), code_2 = Defect Type (Output)

CREATE OR REPLACE VIEW v_defect_types_by_code AS
SELECT 
    c.code_1 AS defect_code_id,
    l.lib_id,
    l.lib_desc,
    l.lib_code
FROM u_lib_combo c
JOIN u_lib_list l ON c.code_2 = l.lib_id::text
WHERE 
    c.lib_code = 'AMLYCODFND' 
    AND (c.lib_delete IS NULL OR c.lib_delete = 0)
    AND l.lib_code = 'AMLY_FND'
    AND (l.lib_delete IS NULL OR l.lib_delete = 0);

-- Grant Access
GRANT SELECT ON v_defect_types_by_code TO authenticated;
