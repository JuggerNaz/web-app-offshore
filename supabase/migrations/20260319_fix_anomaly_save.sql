-- 1. Ensure the new record_category column is added so the payload can save properly!
ALTER TABLE insp_anomalies 
ADD COLUMN IF NOT EXISTS record_category VARCHAR(50) DEFAULT 'ANOMALY';

-- 2. Ensure get_next_record_sequence is properly updated
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
      AND COALESCE(r.sow_report_no, '') = COALESCE(p_report_no, '')
      AND a.record_category = p_category;
      
    RETURN v_max_seq + 1;
END;
$$ LANGUAGE plpgsql;
