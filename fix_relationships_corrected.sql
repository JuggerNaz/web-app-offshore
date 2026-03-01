-- Drop the incorrect constraint to u_comp_spec
ALTER TABLE insp_records DROP CONSTRAINT IF EXISTS insp_records_component_id_fkey;

-- Add the correct constraint to structure_components
ALTER TABLE insp_records 
    ADD CONSTRAINT insp_records_component_id_fkey 
    FOREIGN KEY (component_id) 
    REFERENCES structure_components (id) 
    ON DELETE RESTRICT;

-- Grant permissions on structure_components
GRANT SELECT ON structure_components TO authenticated;
GRANT SELECT ON structure_components TO anon;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload config';
