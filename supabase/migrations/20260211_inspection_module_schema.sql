-- ============================================================================
-- INSPECTION MODULE DATABASE SCHEMA
-- ============================================================================
-- Description: Complete database schema for Diving and ROV inspection module
-- Created: 2026-02-11
-- Version: 1.0
-- ============================================================================

-- ============================================================================
-- SEQUENCES
-- ============================================================================

-- Dive Job Sequence
CREATE SEQUENCE IF NOT EXISTS seq_dive_job_id
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- ROV Job Sequence
CREATE SEQUENCE IF NOT EXISTS seq_rov_job_id
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Inspection Record Sequence
CREATE SEQUENCE IF NOT EXISTS seq_inspection_id
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Anomaly Sequence
CREATE SEQUENCE IF NOT EXISTS seq_anomaly_id
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Video Tape Sequence
CREATE SEQUENCE IF NOT EXISTS seq_video_tape_id
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Media Sequence
CREATE SEQUENCE IF NOT EXISTS seq_media_id
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Movement Log Sequence
CREATE SEQUENCE IF NOT EXISTS seq_movement_log_id
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Video Log Sequence
CREATE SEQUENCE IF NOT EXISTS seq_video_log_id
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- ============================================================================
-- DIVING JOB TABLES
-- ============================================================================

-- Dive Job Master Table
CREATE TABLE IF NOT EXISTS insp_dive_jobs (
    dive_job_id BIGINT PRIMARY KEY DEFAULT nextval('seq_dive_job_id'),
    dive_no VARCHAR(50) NOT NULL,
    structure_id BIGINT NOT NULL REFERENCES u_structure(str_id) ON DELETE RESTRICT,
    jobpack_id BIGINT REFERENCES u_jobpack(jobpack_id) ON DELETE RESTRICT,
    sow_report_no VARCHAR(100),
    
    -- Personnel
    diver_name VARCHAR(200) NOT NULL,
    dive_supervisor VARCHAR(200) NOT NULL,
    report_coordinator VARCHAR(200) NOT NULL,
    
    -- Dates and Times
    dive_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TIME,
    end_time TIME,
    
    -- Status
    status VARCHAR(50) DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, COMPLETED, CANCELLED
    
    -- Metadata
    workunit VARCHAR(10) DEFAULT '000',
    cr_user VARCHAR(100),
    cr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    md_user VARCHAR(100),
    md_date TIMESTAMP,
    
    -- Additional Info (JSON for flexibility)
    additional_info JSONB DEFAULT '{}'::JSONB,
    
    -- Constraints
    CONSTRAINT uk_dive_no UNIQUE(dive_no),
    CONSTRAINT chk_dive_status CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED'))
);

-- Dive Movement Logs
CREATE TABLE IF NOT EXISTS insp_dive_movements (
    movement_id BIGINT PRIMARY KEY DEFAULT nextval('seq_movement_log_id'),
    dive_job_id BIGINT NOT NULL REFERENCES insp_dive_jobs(dive_job_id) ON DELETE CASCADE,
    
    -- Movement Type
    movement_type VARCHAR(50) NOT NULL, -- LEAVING_SURFACE, AT_WORKSITE, LEAVING_WORKSITE, BACK_TO_SURFACE
    movement_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Optional Details
    depth_meters NUMERIC(10,2),
    remarks TEXT,
    
    -- Metadata
    workunit VARCHAR(10) DEFAULT '000',
    cr_user VARCHAR(100),
    cr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_movement_type CHECK (movement_type IN (
        'LEAVING_SURFACE', 'AT_WORKSITE', 'LEAVING_WORKSITE', 'BACK_TO_SURFACE'
    ))
);

-- ============================================================================
-- ROV JOB TABLES
-- ============================================================================

-- ROV Job Master Table
CREATE TABLE IF NOT EXISTS insp_rov_jobs (
    rov_job_id BIGINT PRIMARY KEY DEFAULT nextval('seq_rov_job_id'),
    deployment_no VARCHAR(50) NOT NULL,
    structure_id BIGINT NOT NULL REFERENCES u_structure(str_id) ON DELETE RESTRICT,
    jobpack_id BIGINT REFERENCES u_jobpack(jobpack_id) ON DELETE RESTRICT,
    sow_report_no VARCHAR(100),
    
    -- ROV Details
    rov_serial_no VARCHAR(100) NOT NULL,
    rov_operator VARCHAR(200) NOT NULL,
    rov_supervisor VARCHAR(200) NOT NULL,
    report_coordinator VARCHAR(200) NOT NULL,
    
    -- Dates and Times
    deployment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TIME,
    end_time TIME,
    
    -- Status
    status VARCHAR(50) DEFAULT 'IN_PROGRESS',
    
    -- Metadata
    workunit VARCHAR(10) DEFAULT '000',
    cr_user VARCHAR(100),
    cr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    md_user VARCHAR(100),
    md_date TIMESTAMP,
    
    -- Additional ROV Info (JSON)
    rov_telemetry JSONB DEFAULT '{}'::JSONB,
    additional_info JSONB DEFAULT '{}'::JSONB,
    
    -- Constraints
    CONSTRAINT uk_deployment_no UNIQUE(deployment_no),
    CONSTRAINT chk_rov_status CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED'))
);

-- ROV Movement Logs
CREATE TABLE IF NOT EXISTS insp_rov_movements (
    movement_id BIGINT PRIMARY KEY DEFAULT nextval('seq_movement_log_id'),
    rov_job_id BIGINT NOT NULL REFERENCES insp_rov_jobs(rov_job_id) ON DELETE CASCADE,
    
    -- Movement Type
    movement_type VARCHAR(50) NOT NULL, -- ROV_DEPLOYED, AT_WORKSITE, LEAVING_WORKSITE, ROV_RECOVERED
    movement_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Position Details
    depth_meters NUMERIC(10,2),
    latitude NUMERIC(12,9),
    longitude NUMERIC(12,9),
    heading_degrees NUMERIC(5,2),
    
    -- Telemetry Snapshot (JSON)
    telemetry_data JSONB,
    
    -- Optional Details
    remarks TEXT,
    
    -- Metadata
    workunit VARCHAR(10) DEFAULT '000',
    cr_user VARCHAR(100),
    cr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_rov_movement_type CHECK (movement_type IN (
        'ROV_DEPLOYED', 'AT_WORKSITE', 'LEAVING_WORKSITE', 'ROV_RECOVERED'
    ))
);

-- ============================================================================
-- VIDEO RECORDING TABLES (Common for both Diving & ROV)
-- ============================================================================

-- Video Tape/Recording Master
CREATE TABLE IF NOT EXISTS insp_video_tapes (
    tape_id BIGINT PRIMARY KEY DEFAULT nextval('seq_video_tape_id'),
    tape_no VARCHAR(50) NOT NULL,
    
    -- Link to Job (either dive or rov)
    dive_job_id BIGINT REFERENCES insp_dive_jobs(dive_job_id) ON DELETE CASCADE,
    rov_job_id BIGINT REFERENCES insp_rov_jobs(rov_job_id) ON DELETE CASCADE,
    
    -- Tape Details
    tape_type VARCHAR(50), -- VHS, DV, DIGITAL, etc.
    total_duration_minutes INTEGER,
    
    -- Status
    status VARCHAR(50) DEFAULT 'ACTIVE',
    
    -- Metadata
    workunit VARCHAR(10) DEFAULT '000',
    cr_user VARCHAR(100),
    cr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    md_user VARCHAR(100),
    md_date TIMESTAMP,
    
    -- Constraints
    CONSTRAINT uk_tape_no UNIQUE(tape_no),
    CONSTRAINT chk_tape_job CHECK (
        (dive_job_id IS NOT NULL AND rov_job_id IS NULL) OR
        (dive_job_id IS NULL AND rov_job_id IS NOT NULL)
    )
);

-- Video Log Events
CREATE TABLE IF NOT EXISTS insp_video_logs (
    video_log_id BIGINT PRIMARY KEY DEFAULT nextval('seq_video_log_id'),
    tape_id BIGINT NOT NULL REFERENCES insp_video_tapes(tape_id) ON DELETE CASCADE,
    
    -- Log Event Type
    event_type VARCHAR(50) NOT NULL, -- NEW_LOG_START, INTRODUCTION, PRE_INSPECTION, POST_INSPECTION, PAUSE, RESUME, END
    event_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Time Code (optional)
    timecode_start VARCHAR(20),
    timecode_end VARCHAR(20),
    
    -- Link to Inspection (for PRE/POST events)
    inspection_id BIGINT REFERENCES insp_records(insp_id) ON DELETE SET NULL,
    
    -- Remarks
    remarks TEXT,
    
    -- Metadata
    workunit VARCHAR(10) DEFAULT '000',
    cr_user VARCHAR(100),
    cr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_video_event_type CHECK (event_type IN (
        'NEW_LOG_START', 'INTRODUCTION', 'PRE_INSPECTION', 'POST_INSPECTION', 
        'PAUSE', 'RESUME', 'END'
    ))
);

-- ============================================================================
-- INSPECTION RECORDS TABLE (Common for both methods)
-- ============================================================================

CREATE TABLE IF NOT EXISTS insp_records (
    insp_id BIGINT PRIMARY KEY DEFAULT nextval('seq_inspection_id'),
    
    -- Link to Job
    dive_job_id BIGINT REFERENCES insp_dive_jobs(dive_job_id) ON DELETE CASCADE,
    rov_job_id BIGINT REFERENCES insp_rov_jobs(rov_job_id) ON DELETE CASCADE,
    
    -- Structure & Component
    structure_id BIGINT NOT NULL REFERENCES u_structure(str_id) ON DELETE RESTRICT,
    component_id BIGINT NOT NULL REFERENCES u_comp_spec(comp_id) ON DELETE RESTRICT,
    component_type VARCHAR(100),
    
    -- Job Pack & SOW
    jobpack_id BIGINT REFERENCES u_jobpack(jobpack_id) ON DELETE RESTRICT,
    sow_report_no VARCHAR(100),
    
    -- Inspection Details
    inspection_type_code VARCHAR(50) NOT NULL, -- GVI, CVI, FMD, CP, UTM, etc.
    inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
    inspection_time TIME NOT NULL DEFAULT CURRENT_TIME,
    
    -- Tape Reference
    tape_count_no INTEGER,
    tape_id BIGINT REFERENCES insp_video_tapes(tape_id) ON DELETE SET NULL,
    
    -- Location Details
    elevation NUMERIC(10,2),
    fp_kp VARCHAR(50), -- For pipeline: FP (From Point) or KP (Kilometer Point)
    
    -- Inspection Data (JSONB for flexibility)
    inspection_data JSONB NOT NULL DEFAULT '{}'::JSONB,
    
    -- Migration Compatibility Keys (stored in JSON)
    -- Structure: {"inspno": "...", "str_id": "...", "comp_id": "...", "insp_id": "..."}
    
    -- Anomaly Flag
    has_anomaly BOOLEAN DEFAULT FALSE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'DRAFT', -- DRAFT, COMPLETED, REVIEWED, APPROVED
    
    -- Metadata
    workunit VARCHAR(10) DEFAULT '000',
    cr_user VARCHAR(100),
    cr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    md_user VARCHAR(100),
    md_date TIMESTAMP,
    reviewed_by VARCHAR(100),
    reviewed_date TIMESTAMP,
    approved_by VARCHAR(100),
    approved_date TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_insp_job CHECK (
        (dive_job_id IS NOT NULL AND rov_job_id IS NULL) OR
        (dive_job_id IS NULL AND rov_job_id IS NOT NULL)
    ),
    CONSTRAINT chk_insp_status CHECK (status IN ('DRAFT', 'COMPLETED', 'REVIEWED', 'APPROVED'))
);

-- ============================================================================
-- ANOMALY/DEFECT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS insp_anomalies (
    anomaly_id BIGINT PRIMARY KEY DEFAULT nextval('seq_anomaly_id'),
    anomaly_ref_no VARCHAR(50) NOT NULL,
    
    -- Link to Inspection
    inspection_id BIGINT NOT NULL REFERENCES insp_records(insp_id) ON DELETE CASCADE,
    
    -- Anomaly Classification (from library)
    defect_type_code VARCHAR(50) NOT NULL, -- From U_LIB_LIST/U_LIB_COMBO
    priority_code VARCHAR(50) NOT NULL, -- P1, P2, P3, P4, P5
    defect_category_code VARCHAR(50) NOT NULL, -- CORROSION, STRUCTURAL, COATING, MECHANICAL
    
    -- Defect Description
    defect_description TEXT NOT NULL,
    
    -- Severity Assessment
    severity VARCHAR(50), -- MINOR, MODERATE, MAJOR, CRITICAL
    
    -- Recommended Action
    recommended_action TEXT,
    action_priority VARCHAR(50),
    action_deadline DATE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'OPEN', -- OPEN, UNDER_REVIEW, APPROVED, CLOSED
    
    -- Follow-up
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_notes TEXT,
    
    -- Metadata
    workunit VARCHAR(10) DEFAULT '000',
    cr_user VARCHAR(100),
    cr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    md_user VARCHAR(100),
    md_date TIMESTAMP,
    reviewed_by VARCHAR(100),
    reviewed_date TIMESTAMP,
    approved_by VARCHAR(100),
    approved_date TIMESTAMP,
    closed_by VARCHAR(100),
    closed_date TIMESTAMP,
    
    -- Constraints
    CONSTRAINT uk_anomaly_ref_no UNIQUE(anomaly_ref_no),
    CONSTRAINT chk_anomaly_status CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'APPROVED', 'CLOSED')),
    CONSTRAINT chk_severity CHECK (severity IN ('MINOR', 'MODERATE', 'MAJOR', 'CRITICAL'))
);

-- ============================================================================
-- MEDIA ATTACHMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS insp_media (
    media_id BIGINT PRIMARY KEY DEFAULT nextval('seq_media_id'),
    
    -- Link to Inspection or Anomaly
    inspection_id BIGINT REFERENCES insp_records(insp_id) ON DELETE CASCADE,
    anomaly_id BIGINT REFERENCES insp_anomalies(anomaly_id) ON DELETE CASCADE,
    
    -- Media Details
    media_type VARCHAR(50) NOT NULL, -- PHOTO, VIDEO, DOCUMENT
    file_name VARCHAR(500) NOT NULL,
    file_path TEXT NOT NULL, -- Supabase Storage path
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    
    -- Capture Details
    captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    captured_by VARCHAR(100),
    
    -- Source
    source VARCHAR(100), -- LIVE_SNAPSHOT, LIVE_VIDEO_CLIP, UPLOAD, etc.
    
    -- Thumbnail (for videos/images)
    thumbnail_path TEXT,
    
    -- Description
    description TEXT,
    
    -- Metadata
    workunit VARCHAR(10) DEFAULT '000',
    cr_user VARCHAR(100),
    cr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    md_user VARCHAR(100),
    md_date TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_media_link CHECK (
        (inspection_id IS NOT NULL AND anomaly_id IS NULL) OR
        (inspection_id IS NULL AND anomaly_id IS NOT NULL) OR
        (inspection_id IS NOT NULL AND anomaly_id IS NOT NULL)
    ),
    CONSTRAINT chk_media_type CHECK (media_type IN ('PHOTO', 'VIDEO', 'DOCUMENT'))
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Dive Jobs
CREATE INDEX idx_dive_jobs_structure ON insp_dive_jobs(structure_id);
CREATE INDEX idx_dive_jobs_jobpack ON insp_dive_jobs(jobpack_id);
CREATE INDEX idx_dive_jobs_date ON insp_dive_jobs(dive_date);
CREATE INDEX idx_dive_jobs_status ON insp_dive_jobs(status);

-- ROV Jobs
CREATE INDEX idx_rov_jobs_structure ON insp_rov_jobs(structure_id);
CREATE INDEX idx_rov_jobs_jobpack ON insp_rov_jobs(jobpack_id);
CREATE INDEX idx_rov_jobs_date ON insp_rov_jobs(deployment_date);
CREATE INDEX idx_rov_jobs_status ON insp_rov_jobs(status);

-- Dive Movements
CREATE INDEX idx_dive_movements_job ON insp_dive_movements(dive_job_id);
CREATE INDEX idx_dive_movements_time ON insp_dive_movements(movement_time);

-- ROV Movements
CREATE INDEX idx_rov_movements_job ON insp_rov_movements(rov_job_id);
CREATE INDEX idx_rov_movements_time ON insp_rov_movements(movement_time);

-- Video Tapes
CREATE INDEX idx_video_tapes_dive_job ON insp_video_tapes(dive_job_id);
CREATE INDEX idx_video_tapes_rov_job ON insp_video_tapes(rov_job_id);

-- Video Logs
CREATE INDEX idx_video_logs_tape ON insp_video_logs(tape_id);
CREATE INDEX idx_video_logs_inspection ON insp_video_logs(inspection_id);
CREATE INDEX idx_video_logs_time ON insp_video_logs(event_time);

-- Inspection Records
CREATE INDEX idx_insp_records_dive_job ON insp_records(dive_job_id);
CREATE INDEX idx_insp_records_rov_job ON insp_records(rov_job_id);
CREATE INDEX idx_insp_records_structure ON insp_records(structure_id);
CREATE INDEX idx_insp_records_component ON insp_records(component_id);
CREATE INDEX idx_insp_records_jobpack ON insp_records(jobpack_id);
CREATE INDEX idx_insp_records_date ON insp_records(inspection_date);
CREATE INDEX idx_insp_records_type ON insp_records(inspection_type_code);
CREATE INDEX idx_insp_records_status ON insp_records(status);
CREATE INDEX idx_insp_records_anomaly ON insp_records(has_anomaly);

-- Composite Indexes for Common Queries
CREATE INDEX idx_insp_records_composite ON insp_records(structure_id, component_id, inspection_date);
CREATE INDEX idx_insp_records_job_composite ON insp_records(jobpack_id, structure_id, status);

-- JSONB Indexes for inspection_data (GIN index for JSON queries)
CREATE INDEX idx_insp_records_data_gin ON insp_records USING GIN (inspection_data);

-- Anomalies
CREATE INDEX idx_anomalies_inspection ON insp_anomalies(inspection_id);
CREATE INDEX idx_anomalies_status ON insp_anomalies(status);
CREATE INDEX idx_anomalies_priority ON insp_anomalies(priority_code);
CREATE INDEX idx_anomalies_defect_type ON insp_anomalies(defect_type_code);

-- Media
CREATE INDEX idx_media_inspection ON insp_media(inspection_id);
CREATE INDEX idx_media_anomaly ON insp_media(anomaly_id);
CREATE INDEX idx_media_type ON insp_media(media_type);
CREATE INDEX idx_media_captured ON insp_media(captured_at);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to auto-generate inspection number in JSON
CREATE OR REPLACE FUNCTION fn_generate_inspection_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Add migration compatibility keys to JSON
    NEW.inspection_data = jsonb_set(
        COALESCE(NEW.inspection_data, '{}'::jsonb),
        '{inspno}',
        to_jsonb('INSP-' || LPAD(NEW.insp_id::TEXT, 8, '0'))
    );
    
    NEW.inspection_data = jsonb_set(
        NEW.inspection_data,
        '{str_id}',
        to_jsonb(NEW.structure_id::TEXT)
    );
    
    NEW.inspection_data = jsonb_set(
        NEW.inspection_data,
        '{comp_id}',
        to_jsonb(NEW.component_id::TEXT)
    );
    
    NEW.inspection_data = jsonb_set(
        NEW.inspection_data,
        '{insp_id}',
        to_jsonb(NEW.insp_id::TEXT)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for inspection records
CREATE TRIGGER trg_generate_inspection_number
    BEFORE INSERT ON insp_records
    FOR EACH ROW
    EXECUTE FUNCTION fn_generate_inspection_number();

-- Function to update modified date
CREATE OR REPLACE FUNCTION fn_update_modified_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.md_date = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for modified date
CREATE TRIGGER trg_dive_jobs_modified
    BEFORE UPDATE ON insp_dive_jobs
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_modified_date();

CREATE TRIGGER trg_rov_jobs_modified
    BEFORE UPDATE ON insp_rov_jobs
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_modified_date();

CREATE TRIGGER trg_insp_records_modified
    BEFORE UPDATE ON insp_records
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_modified_date();

CREATE TRIGGER trg_anomalies_modified
    BEFORE UPDATE ON insp_anomalies
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_modified_date();

CREATE TRIGGER trg_video_tapes_modified
    BEFORE UPDATE ON insp_video_tapes
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_modified_date();

CREATE TRIGGER trg_media_modified
    BEFORE UPDATE ON insp_media
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_modified_date();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Complete Dive Inspection Records
CREATE OR REPLACE VIEW vw_dive_inspections AS
SELECT 
    ir.insp_id,
    ir.inspection_data->>'inspno' AS inspno,
    dj.dive_no,
    dj.dive_date,
    dj.diver_name,
    dj.dive_supervisor,
    s.str_name AS structure_name,
    cs.comp_name AS component_name,
    ir.inspection_type_code,
    ir.inspection_date,
    ir.inspection_time,
    ir.has_anomaly,
    ir.status,
    ir.inspection_data,
    ir.cr_user,
    ir.cr_date
FROM insp_records ir
INNER JOIN insp_dive_jobs dj ON ir.dive_job_id = dj.dive_job_id
INNER JOIN u_structure s ON ir.structure_id = s.str_id
INNER JOIN u_comp_spec cs ON ir.component_id = cs.comp_id
ORDER BY ir.inspection_date DESC, ir.inspection_time DESC;

-- View: Complete ROV Inspection Records
CREATE OR REPLACE VIEW vw_rov_inspections AS
SELECT 
    ir.insp_id,
    ir.inspection_data->>'inspno' AS inspno,
    rj.deployment_no,
    rj.deployment_date,
    rj.rov_serial_no,
    rj.rov_operator,
    rj.rov_supervisor,
    s.str_name AS structure_name,
    cs.comp_name AS component_name,
    ir.inspection_type_code,
    ir.inspection_date,
    ir.inspection_time,
    ir.has_anomaly,
    ir.status,
    ir.inspection_data,
    ir.cr_user,
    ir.cr_date
FROM insp_records ir
INNER JOIN insp_rov_jobs rj ON ir.rov_job_id = rj.rov_job_id
INNER JOIN u_structure s ON ir.structure_id = s.str_id
INNER JOIN u_comp_spec cs ON ir.component_id = cs.comp_id
ORDER BY ir.inspection_date DESC, ir.inspection_time DESC;

-- View: Anomalies with Inspection Details
CREATE OR REPLACE VIEW vw_anomalies_detail AS
SELECT 
    a.anomaly_id,
    a.anomaly_ref_no,
    a.defect_type_code,
    a.priority_code,
    a.defect_category_code,
    a.defect_description,
    a.severity,
    a.status AS anomaly_status,
    ir.insp_id,
    ir.inspection_data->>'inspno' AS inspno,
    ir.inspection_type_code,
    s.str_name AS structure_name,
    cs.comp_name AS component_name,
    ir.inspection_date,
    a.recommended_action,
    a.action_priority,
    a.action_deadline,
    a.cr_user,
    a.cr_date,
    a.reviewed_by,
    a.reviewed_date
FROM insp_anomalies a
INNER JOIN insp_records ir ON a.inspection_id = ir.insp_id
INNER JOIN u_structure s ON ir.structure_id = s.str_id
INNER JOIN u_comp_spec cs ON ir.component_id = cs.comp_id
ORDER BY a.priority_code, a.cr_date DESC;

-- View: Latest Dive Movements
CREATE OR REPLACE VIEW vw_latest_dive_movements AS
SELECT DISTINCT ON (dive_job_id)
    dive_job_id,
    movement_type,
    movement_time,
    depth_meters,
    remarks
FROM insp_dive_movements
ORDER BY dive_job_id, movement_time DESC;

-- View: Latest ROV Movements
CREATE OR REPLACE VIEW vw_latest_rov_movements AS
SELECT DISTINCT ON (rov_job_id)
    rov_job_id,
    movement_type,
    movement_time,
    depth_meters,
    latitude,
    longitude,
    heading_degrees,
    remarks
FROM insp_rov_movements
ORDER BY rov_job_id, movement_time DESC;

-- View: Latest Video Logs
CREATE OR REPLACE VIEW vw_latest_video_logs AS
SELECT DISTINCT ON (tape_id)
    tape_id,
    event_type,
    event_time,
    timecode_start,
    timecode_end,
    remarks
FROM insp_video_logs
ORDER BY tape_id, event_time DESC;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE insp_dive_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_rov_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_dive_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_rov_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_video_tapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_video_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_media ENABLE ROW LEVEL SECURITY;

-- Example RLS Policies (adjust based on your auth setup)

-- Dive Jobs: Allow all authenticated users to view, inspectors to create/update
CREATE POLICY "Allow read dive jobs" ON insp_dive_jobs
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow insert dive jobs" ON insp_dive_jobs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow update own dive jobs" ON insp_dive_jobs
    FOR UPDATE
    TO authenticated
    USING (cr_user = current_user OR current_user IN (SELECT unnest(string_to_array(current_setting('app.user_roles', true), ','))));

-- Similar policies for other tables (customize based on your requirements)

-- ============================================================================
-- COMMENTS ON TABLES AND COLUMNS
-- ============================================================================

COMMENT ON TABLE insp_dive_jobs IS 'Master table for diving inspection jobs';
COMMENT ON TABLE insp_rov_jobs IS 'Master table for ROV inspection jobs';
COMMENT ON TABLE insp_dive_movements IS 'Log of dive movements (surface, worksite, etc.)';
COMMENT ON TABLE insp_rov_movements IS 'Log of ROV movements with telemetry data';
COMMENT ON TABLE insp_video_tapes IS 'Video tape/recording master records';
COMMENT ON TABLE insp_video_logs IS 'Video log events timeline';
COMMENT ON TABLE insp_records IS 'Main inspection records table (common for dive and ROV)';
COMMENT ON TABLE insp_anomalies IS 'Anomaly/defect records linked to inspections';
COMMENT ON TABLE insp_media IS 'Media attachments (photos, videos) for inspections and anomalies';

COMMENT ON COLUMN insp_records.inspection_data IS 'JSONB field storing inspection-specific data with migration compatibility keys';
COMMENT ON COLUMN insp_records.has_anomaly IS 'Boolean flag indicating if inspection has associated anomalies';
COMMENT ON COLUMN insp_anomalies.anomaly_ref_no IS 'Unique anomaly reference number (auto-generated)';
COMMENT ON COLUMN insp_media.source IS 'Source of media: LIVE_SNAPSHOT, LIVE_VIDEO_CLIP, UPLOAD, etc.';

-- ============================================================================
-- SAMPLE DATA INSERTION (Optional - for testing)
-- ============================================================================

-- Insert sample dive job
-- INSERT INTO insp_dive_jobs (
--     dive_no, structure_id, diver_name, dive_supervisor, report_coordinator, dive_date, cr_user
-- ) VALUES (
--     'DIVE-2026-001', 1, 'John Diver', 'Mike Supervisor', 'Sarah Coordinator', CURRENT_DATE, 'system'
-- );

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
