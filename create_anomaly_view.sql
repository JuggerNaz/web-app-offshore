
-- Drop view if exists
DROP VIEW IF EXISTS v_anomaly_details;

-- Create View for Anomaly Reporting
CREATE VIEW v_anomaly_details AS
SELECT 
    -- Anomaly Core
    a.anomaly_id,
    a.anomaly_ref_no as display_ref_no,
    a.defect_description as description,
    a.priority_code as priority,
    a.defect_category_code as category,
    a.defect_type_code as defect_type,
    a.recommended_action,
    a.action_priority,
    a.status as anomaly_status,
    a.is_rectified,

    -- Inspection Record
    r.insp_id as id,
    r.inspection_date,
    r.description as observations, 
    r.has_anomaly,

    -- Tape/Video Info
    r.tape_id,
    vt.tape_no,
    r.tape_count_no as video_ref, 

    -- Component
    sc.id as component_id,
    sc.code as component_type,
    sc.q_id as component_qid,

    -- Filtering IDs
    COALESCE(dj.jobpack_id, rj.jobpack_id, r.jobpack_id) as jobpack_id,
    COALESCE(dj.structure_id, rj.structure_id, r.structure_id) as structure_id,
    COALESCE(dj.sow_report_no, rj.sow_report_no, r.sow_report_no) as sow_report_no,

    -- Job Pack Info
    jp.name as jobpack_name,
    jp.metadata ->> 'vessel' as main_vessel,
    jp.metadata ->> 'contractor_ref' as contractor_ref,

    -- Dive Job Info
    dj.dive_job_id,
    dj.dive_no,
    dj.diver_name,
    dj.start_time as dive_start,

    -- ROV Job Info
    rj.rov_job_id,
    rj.deployment_no,
    rj.rov_operator as rov_name,
    rj.start_time as rov_start

FROM insp_anomalies a
JOIN insp_records r ON a.inspection_id = r.insp_id
LEFT JOIN structure_components sc ON r.component_id = sc.id
LEFT JOIN insp_dive_jobs dj ON r.dive_job_id = dj.dive_job_id
LEFT JOIN insp_rov_jobs rj ON r.rov_job_id = rj.rov_job_id
LEFT JOIN insp_video_tapes vt ON r.tape_id = vt.tape_id
LEFT JOIN jobpack jp ON COALESCE(dj.jobpack_id, rj.jobpack_id, r.jobpack_id) = jp.id;
