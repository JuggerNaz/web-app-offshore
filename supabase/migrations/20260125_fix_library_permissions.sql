-- Enable access to Library tables
ALTER TABLE u_lib_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE u_lib_combo ENABLE ROW LEVEL SECURITY;

-- Create permissive read policies
DROP POLICY IF EXISTS "Allow authenticated read u_lib_list" ON u_lib_list;
CREATE POLICY "Allow authenticated read u_lib_list"
ON u_lib_list FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow authenticated read u_lib_combo" ON u_lib_combo;
CREATE POLICY "Allow authenticated read u_lib_combo"
ON u_lib_combo FOR SELECT
TO authenticated
USING (true);

-- Also fix permissions just in case
GRANT SELECT ON u_lib_list TO authenticated;
GRANT SELECT ON u_lib_combo TO authenticated;
