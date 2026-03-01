
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
    -- Anomaly Specifics
    a.status as status,
    a.is_rectified as rectified,
    a.rectified_by,
    a.rectified_date,
    a.rectified_remarks,
    a.action_priority,
    a.status as anomaly_status,

    -- Inspection Record
    r.insp_id as id,
    r.inspection_date,
    r.description as observations, 
    r.has_anomaly,
    r.elevation,
    r.fp_kp,

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
    jp.metadata ->> 'contrac' as contractor_id,
    ull.lib_desc as contractor_name,
    ull.logo_url,

    -- Priority Color (from u_lib_combo ANMLYCLR)
    pac.code_2 as priority_color,

    -- Dive Job Info
    dj.dive_job_id,
    dj.dive_no,
    dj.diver_name,
    dj.start_time as dive_start,

    -- ROV Job Info
    rj.rov_job_id,
    rj.deployment_no,
    rj.rov_operator as rov_name,
    rj.rov_serial_no as rov_machine,
    rj.start_time as rov_start,

    -- Structure Details
    vsd.str_type,
    vsd.title as structure_name,
    vsd.pfield as field_name

FROM insp_anomalies a
JOIN insp_records r ON a.inspection_id = r.insp_id
LEFT JOIN v_structure_details vsd ON r.structure_id = vsd.str_id -- Using newly created view
LEFT JOIN structure_components sc ON r.component_id = sc.id
LEFT JOIN insp_dive_jobs dj ON r.dive_job_id = dj.dive_job_id
LEFT JOIN insp_rov_jobs rj ON r.rov_job_id = rj.rov_job_id
LEFT JOIN insp_video_tapes vt ON r.tape_id = vt.tape_id
LEFT JOIN jobpack jp ON COALESCE(dj.jobpack_id, rj.jobpack_id, r.jobpack_id) = jp.id
LEFT JOIN u_lib_list ull ON ull.lib_code = 'CONTR_NAM' AND ull.lib_id::text = jp.metadata ->> 'contrac'
-- Join for Priority Color Code: ANMLYCLR maps Priority ID (code1) to Color (code2)
LEFT JOIN u_lib_combo pac ON pac.lib_code = 'ANMLYCLR' AND (pac.lib_delete IS NULL OR pac.lib_delete = 0) AND pac.code_1 = ( 
    SELECT lib_id FROM u_lib_list 
    WHERE lib_code ='AMLY_TYP' 
    AND (lib_delete IS NULL OR lib_delete = 0) 
    AND lib_desc = a.priority_code
);
