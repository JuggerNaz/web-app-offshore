-- Function to get the next sequence number for an anomaly or finding
-- Grouped by: Structure, Jobpack, and Report Number
CREATE OR REPLACE FUNCTION get_next_record_sequence(
    p_structure_id BIGINT,
    p_jobpack_id BIGINT,
    p_report_no TEXT,
    p_category TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_max_seq INTEGER;
BEGIN
    SELECT COALESCE(MAX(a.sequence_no), 0)
    INTO v_max_seq
    FROM insp_anomalies a
    JOIN insp_records r ON a.inspection_id = r.insp_id
    WHERE r.structure_id = p_structure_id
      AND r.jobpack_id = p_jobpack_id
      AND r.sow_report_no = p_report_no
      AND a.record_category = p_category;
      
    RETURN v_max_seq + 1;
END;
$$ LANGUAGE plpgsql;
