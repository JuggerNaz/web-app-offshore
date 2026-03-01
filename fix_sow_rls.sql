-- ============================================================================
-- FIX INSPECTION TYPES & SOW RLS
-- ============================================================================

-- 1. Enable RLS on SOW tables
ALTER TABLE u_sow ENABLE ROW LEVEL SECURITY;
ALTER TABLE u_sow_items ENABLE ROW LEVEL SECURITY;

-- 2. Create Policies for u_sow
DROP POLICY IF EXISTS "Allow read u_sow" ON u_sow;
CREATE POLICY "Allow read u_sow" ON u_sow FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert u_sow" ON u_sow;
CREATE POLICY "Allow insert u_sow" ON u_sow FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update u_sow" ON u_sow;
CREATE POLICY "Allow update u_sow" ON u_sow FOR UPDATE TO authenticated USING (true);


-- 3. Create Policies for u_sow_items
DROP POLICY IF EXISTS "Allow read u_sow_items" ON u_sow_items;
CREATE POLICY "Allow read u_sow_items" ON u_sow_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert u_sow_items" ON u_sow_items;
CREATE POLICY "Allow insert u_sow_items" ON u_sow_items FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update u_sow_items" ON u_sow_items;
CREATE POLICY "Allow update u_sow_items" ON u_sow_items FOR UPDATE TO authenticated USING (true);


-- 4. Ensure Foreign Key exists for inspection_type_id
-- We need to check if u_lib_list exists properly with id primary key
-- Assuming u_lib_list(id) exists.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'u_sow_items_inspection_type_id_fkey'
    ) THEN
        ALTER TABLE u_sow_items 
        ADD CONSTRAINT u_sow_items_inspection_type_id_fkey 
        FOREIGN KEY (inspection_type_id) REFERENCES inspection_type(id);
    END IF;
END $$;

-- 5. Populate specific test data if needed (optional)
-- Ensuring link between SOW and Lib List matches what the code expects
