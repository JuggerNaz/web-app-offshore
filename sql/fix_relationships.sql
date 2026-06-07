-- Ensure u_comp_spec exists and has correct PK
-- (Assuming u_comp_spec exists as it's a core table)

-- Re-establish the Foreign Key relationship explicitly to ensure PostgREST detects it
-- We drop it first to be sure
ALTER TABLE insp_records DROP CONSTRAINT IF EXISTS insp_records_component_id_fkey;

-- Add it back
ALTER TABLE insp_records 
    ADD CONSTRAINT insp_records_component_id_fkey 
    FOREIGN KEY (component_id) 
    REFERENCES u_comp_spec (comp_id) 
    ON DELETE RESTRICT;

-- Grant permissions just in case
GRANT SELECT ON u_comp_spec TO authenticated;
GRANT SELECT ON u_comp_spec TO anon;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload config';
