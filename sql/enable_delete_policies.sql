-- Enable DELETE policies for video tapes and logs to allow the UI to remove them

CREATE POLICY "Allow delete video tapes" ON insp_video_tapes 
FOR DELETE TO authenticated 
USING (true);

CREATE POLICY "Allow delete video logs" ON insp_video_logs 
FOR DELETE TO authenticated 
USING (true);

CREATE POLICY "Allow delete insp records" ON insp_records 
FOR DELETE TO authenticated 
USING (true);

-- End of File
