-- Enable RLS (Should be on already)
ALTER TABLE insp_dive_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_rov_jobs ENABLE ROW LEVEL SECURITY;

-- Dive Jobs: Allow Delete
DROP POLICY IF EXISTS "Allow delete dive jobs" ON insp_dive_jobs;
CREATE POLICY "Allow delete dive jobs" ON insp_dive_jobs
    FOR DELETE
    TO authenticated
    USING (true);

-- ROV Jobs: Allow Delete
DROP POLICY IF EXISTS "Allow authenticated users to delete ROV jobs" ON insp_rov_jobs;
CREATE POLICY "Allow authenticated users to delete ROV jobs" ON insp_rov_jobs
    FOR DELETE
    TO authenticated
    USING (true);
