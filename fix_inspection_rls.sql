-- Enable RLS (just in case)
ALTER TABLE insp_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_video_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_media ENABLE ROW LEVEL SECURITY;

-- Clean up existing policies for Inspection Records
DROP POLICY IF EXISTS "Enable read access for all users" ON insp_records;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON insp_records;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON insp_records;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON insp_records;

-- Clean up existing policies for Video Logs
DROP POLICY IF EXISTS "Enable read access for all users" ON insp_video_logs;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON insp_video_logs;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON insp_video_logs;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON insp_video_logs;

-- Clean up existing policies for Anomalies
DROP POLICY IF EXISTS "Enable read access for all users" ON insp_anomalies;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON insp_anomalies;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON insp_anomalies;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON insp_anomalies;

-- Clean up existing policies for Media
DROP POLICY IF EXISTS "Enable read access for all users" ON insp_media;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON insp_media;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON insp_media;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON insp_media;


-- Create Permissive Policies for Inspection Records
CREATE POLICY "Enable read access for all users" ON insp_records
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON insp_records
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON insp_records
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON insp_records
    FOR DELETE USING (auth.role() = 'authenticated');

-- Create Permissive Policies for Video Logs
CREATE POLICY "Enable read access for all users" ON insp_video_logs
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON insp_video_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON insp_video_logs
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON insp_video_logs
    FOR DELETE USING (auth.role() = 'authenticated');

-- Create Permissive Policies for Anomalies
CREATE POLICY "Enable read access for all users" ON insp_anomalies
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON insp_anomalies
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON insp_anomalies
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON insp_anomalies
    FOR DELETE USING (auth.role() = 'authenticated');

-- Create Permissive Policies for Media
CREATE POLICY "Enable read access for all users" ON insp_media
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON insp_media
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON insp_media
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON insp_media
    FOR DELETE USING (auth.role() = 'authenticated');
