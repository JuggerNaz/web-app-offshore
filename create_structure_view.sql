-- Create View: v_structure_details
-- Combines structure table with platform and u_pipeline tables based on str_id
CREATE OR REPLACE VIEW v_structure_details AS
SELECT 
    s.str_id,
    s.str_type,
    COALESCE(p.title, pl.title) as title,
    COALESCE(p.pfield, pl.pfield) as pfield,
    COALESCE(p.pdesc, pl.pdesc) as pdesc
FROM structure s
LEFT JOIN platform p ON s.str_id = p.plat_id
LEFT JOIN u_pipeline pl ON s.str_id = pl.pipe_id;
