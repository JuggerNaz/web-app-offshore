-- Enable Row Level Security (if not already enabled)
ALTER TABLE insp_rov_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_dive_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_rov_movements ENABLE ROW LEVEL SECURITY;

-- ROV Jobs Policies
CREATE POLICY "Allow read rov jobs" ON insp_rov_jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert rov jobs" ON insp_rov_jobs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update rov jobs" ON insp_rov_jobs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete rov jobs" ON insp_rov_jobs FOR DELETE TO authenticated USING (true);

-- Dive Movements Policies
CREATE POLICY "Allow read dive movements" ON insp_dive_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert dive movements" ON insp_dive_movements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update dive movements" ON insp_dive_movements FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete dive movements" ON insp_dive_movements FOR DELETE TO authenticated USING (true);

-- ROV Movements Policies
CREATE POLICY "Allow read rov movements" ON insp_rov_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert rov movements" ON insp_rov_movements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update rov movements" ON insp_rov_movements FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete rov movements" ON insp_rov_movements FOR DELETE TO authenticated USING (true);
