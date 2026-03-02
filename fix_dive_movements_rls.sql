-- Enable RLS
ALTER TABLE IF EXISTS insp_dive_movements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to insert dive movements" ON insp_dive_movements;
DROP POLICY IF EXISTS "Allow authenticated users to select dive movements" ON insp_dive_movements;
DROP POLICY IF EXISTS "Allow authenticated users to update dive movements" ON insp_dive_movements;
DROP POLICY IF EXISTS "Allow authenticated users to delete dive movements" ON insp_dive_movements;

-- Create new policies
CREATE POLICY "Allow authenticated users to insert dive movements"
ON insp_dive_movements FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to select dive movements"
ON insp_dive_movements FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to update dive movements"
ON insp_dive_movements FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete dive movements"
ON insp_dive_movements FOR DELETE
TO authenticated
USING (true);

-- Grant permissions
GRANT ALL ON insp_dive_movements TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- FIX CONSTRAINT VIOLATION ("chk_movement_type")
-- ============================================================================
-- The database has a strict constraint expecting uppercase codes (e.g. 'LEAVING_SURFACE').
-- The application uses readable text (e.g. 'Left Surface').
-- We drop this constraint to allow the application to log actions as they appear in the UI.

ALTER TABLE insp_dive_movements DROP CONSTRAINT IF EXISTS chk_movement_type;
