-- Enable RLS and add policies for Video Recording and Inspection tables

-- Video Tapes
ALTER TABLE insp_video_tapes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read video tapes" ON insp_video_tapes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert video tapes" ON insp_video_tapes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update video tapes" ON insp_video_tapes FOR UPDATE TO authenticated USING (true);

-- Video Logs
ALTER TABLE insp_video_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read video logs" ON insp_video_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert video logs" ON insp_video_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update video logs" ON insp_video_logs FOR UPDATE TO authenticated USING (true);

-- Inspection Records
ALTER TABLE insp_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read insp records" ON insp_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert insp records" ON insp_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update insp records" ON insp_records FOR UPDATE TO authenticated USING (true);

-- Anomalies
ALTER TABLE insp_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read anomalies" ON insp_anomalies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert anomalies" ON insp_anomalies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update anomalies" ON insp_anomalies FOR UPDATE TO authenticated USING (true);

-- Media
ALTER TABLE insp_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read media" ON insp_media FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert media" ON insp_media FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update media" ON insp_media FOR UPDATE TO authenticated USING (true);
