-- ============================================================================
-- INSPECTION MODULE DATABASE SCHEMA - CORRECTED VERSION
-- ============================================================================
-- Description: Complete database schema for Diving and ROV inspection module
--              with corrected table references
-- Created: 2026-02-11
-- Version: 1.1 (Corrected)
-- ============================================================================

-- ============================================================================
-- INSPECTION TYPE TABLE - ADD MISSING COLUMNS TO EXISTING TABLE
-- ============================================================================
-- Note: inspection_type table already exists with columns:
--       id, name, code, sname, metadata, created_at, updated_at, modified_by, created_by
-- We will add any missing columns that are needed for the inspection module

-- Add description column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='inspection_type' AND column_name='description') THEN
        ALTER TABLE inspection_type ADD COLUMN description TEXT;
    END IF;
END $$;

-- Add category column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='inspection_type' AND column_name='category') THEN
        ALTER TABLE inspection_type ADD COLUMN category VARCHAR(100);
    END IF;
END $$;

-- Add default_properties column if it doesn't exist
-- Note: The existing 'metadata' column may serve similar purpose, 
--       but we'll add this for explicit inspection form field definitions
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='inspection_type' AND column_name='default_properties') THEN
        ALTER TABLE inspection_type ADD COLUMN default_properties JSONB DEFAULT '{}'::JSONB;
    END IF;
END $$;

-- Add is_active column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='inspection_type' AND column_name='is_active') THEN
        ALTER TABLE inspection_type ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- Add requires_video column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='inspection_type' AND column_name='requires_video') THEN
        ALTER TABLE inspection_type ADD COLUMN requires_video BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add requires_photos column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='inspection_type' AND column_name='requires_photos') THEN
        ALTER TABLE inspection_type ADD COLUMN requires_photos BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add min_photo_count column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='inspection_type' AND column_name='min_photo_count') THEN
        ALTER TABLE inspection_type ADD COLUMN min_photo_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add workunit column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='inspection_type' AND column_name='workunit') THEN
        ALTER TABLE inspection_type ADD COLUMN workunit VARCHAR(10) DEFAULT '000';
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_inspection_type_code ON inspection_type(code);
CREATE INDEX IF NOT EXISTS idx_inspection_type_active ON inspection_type(is_active);
CREATE INDEX IF NOT EXISTS idx_inspection_type_category ON inspection_type(category);

-- GIN index for default_properties JSON search
CREATE INDEX IF NOT EXISTS idx_inspection_type_properties_gin ON inspection_type USING GIN (default_properties);

-- GIN index for existing metadata JSON search
CREATE INDEX IF NOT EXISTS idx_inspection_type_metadata_gin ON inspection_type USING GIN (metadata);

COMMENT ON COLUMN inspection_type.default_properties IS 'JSONB field containing default form field definitions for this inspection type';
COMMENT ON COLUMN inspection_type.metadata IS 'JSONB field containing additional metadata (sbm, tank, diving, pipeline, platform, requires array)';
COMMENT ON TABLE inspection_type IS 'Master table for inspection types with form field definitions';

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
    structure_id BIGINT NOT NULL REFERENCES structure(str_id) ON DELETE RESTRICT,
    jobpack_id BIGINT REFERENCES jobpack(id) ON DELETE RESTRICT,
    sow_report_no VARCHAR(100),
    
    -- Dive Type
    dive_type VARCHAR(50) NOT NULL DEFAULT 'AIR', -- AIR, BELL
    
    -- Personnel
    diver_name VARCHAR(200) NOT NULL,
    dive_supervisor VARCHAR(200) NOT NULL,
    report_coordinator VARCHAR(200) NOT NULL,
    
    -- Additional Personnel for Bell Dive
    standby_diver VARCHAR(200), -- For bell dive
    bell_operator VARCHAR(200), -- For bell dive
    life_support_technician VARCHAR(200), -- For bell dive
    
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
    CONSTRAINT chk_dive_type CHECK (dive_type IN ('AIR', 'BELL')),
    CONSTRAINT chk_dive_status CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED'))
);

-- Dive Movement Logs
CREATE TABLE IF NOT EXISTS insp_dive_movements (
    movement_id BIGINT PRIMARY KEY DEFAULT nextval('seq_movement_log_id'),
    dive_job_id BIGINT NOT NULL REFERENCES insp_dive_jobs(dive_job_id) ON DELETE CASCADE,
    
    -- Movement Type (supports both Air and Bell diving)
    movement_type VARCHAR(50) NOT NULL,
    movement_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Optional Details
    depth_meters NUMERIC(10,2),
    pressure_bar NUMERIC(10,2), -- For bell dive
    bell_depth_meters NUMERIC(10,2), -- For bell dive
    remarks TEXT,
    
    -- Metadata
    workunit VARCHAR(10) DEFAULT '000',
    cr_user VARCHAR(100),
    cr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_movement_type CHECK (movement_type IN (
        -- Air Dive Movements
        'LEAVING_SURFACE',
        'AT_WORKSITE',
        'LEAVING_WORKSITE', 
        'BACK_TO_SURFACE',
        
        -- Bell Dive Movements
        'BELL_LAUNCHED',
        'BELL_DESCENDING',
        'BELL_AT_DEPTH',
        'DIVER_EXITING_BELL',
        'DIVER_AT_WORKSITE',
        'DIVER_LEAVING_WORKSITE',
        'DIVER_RETURNING_TO_BELL',
        'DIVER_IN_BELL',
        'BELL_ASCENDING',
        'BELL_AT_SURFACE',
        'BELL_MATED_TO_CHAMBER',
        'DIVERS_IN_CHAMBER'
    ))
);

-- ============================================================================
-- ROV JOB TABLES
-- ============================================================================

-- ROV Job Master Table
CREATE TABLE IF NOT EXISTS insp_rov_jobs (
    rov_job_id BIGINT PRIMARY KEY DEFAULT nextval('seq_rov_job_id'),
    deployment_no VARCHAR(50) NOT NULL,
    structure_id BIGINT NOT NULL REFERENCES structure(str_id) ON DELETE RESTRICT,
    jobpack_id BIGINT REFERENCES jobpack(id) ON DELETE RESTRICT,
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
    movement_type VARCHAR(50) NOT NULL,
    movement_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Position Details
    depth_meters NUMERIC(10,2),
    latitude NUMERIC(12,9),
    longitude NUMERIC(12,9),
    heading_degrees NUMERIC(5,2),
    altitude_meters NUMERIC(10,2), -- Height above seabed
    
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
        -- Deployment Phase
        'ROV_IN_TMS',                  -- ROV placed in Tether Management System
        'TMS_LAUNCHED',                -- TMS deployed from vessel
        'TMS_DESCENDING',              -- TMS descending to depth
        'TMS_AT_DEPTH',                -- TMS at target depth
        'ROV_EXITING_TMS',             -- ROV leaving TMS cage
        'ROV_DEPLOYED',                -- ROV free swimming
        
        -- Operation Phase
        'ROV_TRANSITING',              -- ROV moving to worksite
        'ROV_AT_WORKSITE',             -- ROV at inspection location
        'ROV_WORKING',                 -- ROV performing task
        'ROV_LEAVING_WORKSITE',        -- ROV departing worksite
        
        -- Recovery Phase
        'ROV_RETURNING_TO_TMS',        -- ROV heading back to TMS
        'ROV_ENTERING_TMS',            -- ROV entering TMS cage
        'ROV_IN_TMS_SECURED',          -- ROV secured in TMS
        'TMS_ASCENDING',               -- TMS ascending to surface
        'TMS_AT_SURFACE',              -- TMS at surface
        'ROV_RECOVERED',               -- ROV back on vessel
        
        -- Alternative Deployment (Cage/Direct)
        'ROV_IN_CAGE',                 -- ROV in deployment cage
        'CAGE_LAUNCHED',               -- Cage deployed
        'CAGE_AT_DEPTH',               -- Cage at depth
        'ROV_EXITING_CAGE',            -- ROV leaving cage
        'ROV_RETURNING_TO_CAGE',       -- ROV returning to cage
        'ROV_IN_CAGE_SECURED',         -- ROV secured in cage
        'CAGE_RECOVERED',              -- Cage back on vessel
        
        -- Emergency/Special
        'ROV_EMERGENCY_RECOVERY',      -- Emergency recovery initiated
        'ROV_HOLDING_POSITION',        -- ROV maintaining position
        'ROV_ABORT_OPERATION'          -- Operation aborted
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
    
    -- Structure & Component (CORRECTED REFERENCES)
    structure_id BIGINT NOT NULL,
    component_id BIGINT NOT NULL REFERENCES structure_components(id) ON DELETE RESTRICT,
    component_type VARCHAR(100),
    
    -- Add foreign key constraint for structure_id that references structure_components
    CONSTRAINT fk_insp_records_structure 
        FOREIGN KEY (structure_id) 
        REFERENCES structure(str_id) 
        ON DELETE RESTRICT,
    
    -- Job Pack & SOW (CORRECTED REFERENCE)
    jobpack_id BIGINT REFERENCES jobpack(id) ON DELETE RESTRICT,
    sow_report_no VARCHAR(100),
    
    -- Inspection Details (CORRECTED REFERENCE)
    inspection_type_id BIGINT REFERENCES inspection_type(id) ON DELETE RESTRICT,
    inspection_type_code VARCHAR(50) NOT NULL, -- Denormalized for quick access
    inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
    inspection_time TIME NOT NULL DEFAULT CURRENT_TIME,
    
    -- Tape Reference
    tape_count_no INTEGER,
    tape_id BIGINT REFERENCES insp_video_tapes(tape_id) ON DELETE SET NULL,
    
    -- Location Details
    elevation NUMERIC(10,2),
    fp_kp VARCHAR(50), -- For pipeline: FP (From Point) or KP (Kilometer Point)
    
    -- Inspection Data (JSONB for flexibility)
    -- This will be populated based on inspection_type.default_properties
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

-- Inspection Type
CREATE INDEX idx_inspection_type_code ON inspection_type(code);
CREATE INDEX idx_inspection_type_active ON inspection_type(is_active);

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
CREATE INDEX idx_insp_records_type_id ON insp_records(inspection_type_id);
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

-- Function to auto-populate inspection data based on inspection type
CREATE OR REPLACE FUNCTION fn_populate_inspection_defaults()
RETURNS TRIGGER AS $$
DECLARE
    v_default_props JSONB;
BEGIN
    -- Get default properties from inspection_type
    SELECT default_properties INTO v_default_props
    FROM inspection_type
    WHERE id = NEW.inspection_type_id;
    
    -- Merge default properties with provided inspection_data
    -- User data takes precedence over defaults
    IF v_default_props IS NOT NULL THEN
        NEW.inspection_data = v_default_props || COALESCE(NEW.inspection_data, '{}'::jsonb);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to populate defaults before insert
CREATE TRIGGER trg_populate_inspection_defaults
    BEFORE INSERT ON insp_records
    FOR EACH ROW
    EXECUTE FUNCTION fn_populate_inspection_defaults();

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

CREATE TRIGGER trg_inspection_type_modified
    BEFORE UPDATE ON inspection_type
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_modified_date();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES (CORRECTED)
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
    sc.structure_name,
    sc.component_name,
    ir.inspection_type_code,
    it.name AS inspection_type_name,
    ir.inspection_date,
    ir.inspection_time,
    ir.has_anomaly,
    ir.status,
    ir.inspection_data,
    ir.cr_user,
    ir.cr_date
FROM insp_records ir
INNER JOIN insp_dive_jobs dj ON ir.dive_job_id = dj.dive_job_id
INNER JOIN structure_components sc ON ir.component_id = sc.id
LEFT JOIN inspection_type it ON ir.inspection_type_id = it.id
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
    sc.structure_name,
    sc.component_name,
    ir.inspection_type_code,
    it.name AS inspection_type_name,
    ir.inspection_date,
    ir.inspection_time,
    ir.has_anomaly,
    ir.status,
    ir.inspection_data,
    ir.cr_user,
    ir.cr_date
FROM insp_records ir
INNER JOIN insp_rov_jobs rj ON ir.rov_job_id = rj.rov_job_id
INNER JOIN structure_components sc ON ir.component_id = sc.id
LEFT JOIN inspection_type it ON ir.inspection_type_id = it.id
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
    sc.structure_name,
    sc.component_name,
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
INNER JOIN structure_components sc ON ir.component_id = sc.id
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
ALTER TABLE inspection_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_dive_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_rov_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_dive_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_rov_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_video_tapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_video_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_media ENABLE ROW LEVEL SECURITY;

-- Example RLS Policies
CREATE POLICY "Allow read inspection types" ON inspection_type
    FOR SELECT
    TO authenticated
    USING (is_active = TRUE);

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

-- Video Tapes Policies
CREATE POLICY "Allow read video tapes" ON insp_video_tapes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert video tapes" ON insp_video_tapes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update video tapes" ON insp_video_tapes FOR UPDATE TO authenticated USING (true);

-- Video Logs Policies
CREATE POLICY "Allow read video logs" ON insp_video_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert video logs" ON insp_video_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update video logs" ON insp_video_logs FOR UPDATE TO authenticated USING (true);

-- Inspection Records Policies
CREATE POLICY "Allow read insp records" ON insp_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert insp records" ON insp_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update insp records" ON insp_records FOR UPDATE TO authenticated USING (true);

-- Anomalies Policies
CREATE POLICY "Allow read anomalies" ON insp_anomalies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert anomalies" ON insp_anomalies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update anomalies" ON insp_anomalies FOR UPDATE TO authenticated USING (true);

-- Media Policies
CREATE POLICY "Allow read media" ON insp_media FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert media" ON insp_media FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update media" ON insp_media FOR UPDATE TO authenticated USING (true);

-- ========================================================================
-- COMMENTS ON TABLES AND COLUMNS
-- ============================================================================

COMMENT ON TABLE inspection_type IS 'Master table for inspection type definitions with default properties in JSON format';
COMMENT ON COLUMN inspection_type.default_properties IS 'JSON field defining default form fields and validation rules for this inspection type';

COMMENT ON TABLE insp_dive_jobs IS 'Master table for diving inspection jobs';
COMMENT ON TABLE insp_rov_jobs IS 'Master table for ROV inspection jobs';
COMMENT ON TABLE insp_dive_movements IS 'Log of dive movements (surface, worksite, etc.)';
COMMENT ON TABLE insp_rov_movements IS 'Log of ROV movements with telemetry data';
COMMENT ON TABLE insp_video_tapes IS 'Video tape/recording master records';
COMMENT ON TABLE insp_video_logs IS 'Video log events timeline';
COMMENT ON TABLE insp_records IS 'Main inspection records table (common for dive and ROV)';
COMMENT ON TABLE insp_anomalies IS 'Anomaly/defect records linked to inspections';
COMMENT ON TABLE insp_media IS 'Media attachments (photos, videos) for inspections and anomalies';

COMMENT ON COLUMN insp_records.inspection_data IS 'JSONB field storing inspection-specific data populated from inspection_type.default_properties';
COMMENT ON COLUMN insp_records.has_anomaly IS 'Boolean flag indicating if inspection has associated anomalies';
COMMENT ON COLUMN insp_anomalies.anomaly_ref_no IS 'Unique anomaly reference number (auto-generated)';
COMMENT ON COLUMN insp_media.source IS 'Source of media: LIVE_SNAPSHOT, LIVE_VIDEO_CLIP, UPLOAD, etc.';

-- ============================================================================
-- SAMPLE INSPECTION TYPE DATA
-- ============================================================================

-- Insert common inspection types with default properties
INSERT INTO inspection_type (code, name, description, category, default_properties, requires_video, requires_photos, min_photo_count, is_active, cr_user) VALUES
('GVI', 'General Visual Inspection', 'Overall visual assessment of component condition', 'VISUAL', 
'{
  "fields": [
    {"name": "overall_condition", "type": "select", "required": true, "options": ["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL"], "label": "Overall Condition"},
    {"name": "marine_growth_percentage", "type": "number", "required": true, "min": 0, "max": 100, "label": "Marine Growth (%)"},
    {"name": "corrosion_level", "type": "select", "required": false, "options": ["NONE", "MINOR", "MODERATE", "SEVERE"], "label": "Corrosion Level"},
    {"name": "coating_condition", "type": "select", "required": false, "options": ["EXCELLENT", "GOOD", "FAIR", "POOR"], "label": "Coating Condition"},
    {"name": "anode_condition", "type": "select", "required": false, "options": ["EXCELLENT", "GOOD", "FAIR", "POOR", "DEPLETED"], "label": "Anode Condition"},
    {"name": "remarks", "type": "textarea", "required": true, "label": "Remarks"}
  ],
  "requires_video": true,
  "requires_photos": true,
  "min_photos": 2
}'::jsonb, true, true, 2, true, 'system')
ON CONFLICT (code) DO NOTHING;

INSERT INTO inspection_type (code, name, description, category, default_properties, requires_video, requires_photos, cr_user) VALUES
('CVI', 'Close Visual Inspection', 'Detailed close-up visual inspection', 'VISUAL',
'{
  "fields": [
    {"name": "inspection_area", "type": "text", "required": true, "label": "Inspection Area"},
    {"name": "surface_condition", "type": "select", "required": true, "options": ["GOOD", "MINOR_DAMAGE", "SIGNIFICANT_DAMAGE"], "label": "Surface Condition"},
    {"name": "crack_detected", "type": "boolean", "required": true, "label": "Crack Detected"},
    {"name": "crack_details", "type": "textarea", "required": false, "label": "Crack Details"},
    {"name": "weld_integrity", "type": "select", "required": false, "options": ["SATISFACTORY", "QUESTIONABLE", "UNSATISFACTORY"], "label": "Weld Integrity"},
    {"name": "remarks", "type": "textarea", "required": true, "label": "Remarks"}
  ]
}'::jsonb, true, true, 'system')
ON CONFLICT (code) DO NOTHING;

INSERT INTO inspection_type (code, name, description, category, default_properties, cr_user) VALUES
('CP', 'Cathodic Protection', 'Cathodic protection potential measurement', 'MEASUREMENT',
'{
  "fields": [
    {"name": "cp_potential_mv", "type": "number", "required": true, "label": "CP Potential (mV vs Ag/AgCl)", "min": -2000, "max": 0},
    {"name": "reference_electrode", "type": "select", "required": true, "options": ["Ag/AgCl", "Cu/CuSO4", "Zn"], "label": "Reference Electrode"},
    {"name": "anode_depletion", "type": "number", "required": false, "min": 0, "max": 100, "label": "Anode Depletion (%)"},
    {"name": "cp_status", "type": "select", "required": true, "options": ["ADEQUATE", "MARGINAL", "INADEQUATE"], "label": "CP Status"},
    {"name": "remarks", "type": "textarea", "required": true, "label": "Remarks"}
  ]
}'::jsonb, false, false, 'system')
ON CONFLICT (code) DO NOTHING;

INSERT INTO inspection_type (code, name, description, category, default_properties, cr_user) VALUES
('FMD', 'Flooded Member Detection', 'Detection of water ingress in tubular members', 'MEASUREMENT',
'{
  "fields": [
    {"name": "fmd_reading_db", "type": "number", "required": true, "label": "FMD Reading (dB)"},
    {"name": "flooded_indication", "type": "boolean", "required": true, "label": "Flooded Indication"},
    {"name": "water_level_estimate", "type": "text", "required": false, "label": "Estimated Water Level"},
    {"name": "member_status", "type": "select", "required": true, "options": ["DRY", "PARTIALLY_FLOODED", "FULLY_FLOODED"], "label": "Member Status"},
    {"name": "remarks", "type": "textarea", "required": true, "label": "Remarks"}
  ]
}'::jsonb, false, false, 'system')
ON CONFLICT (code) DO NOTHING;

INSERT INTO inspection_type (code, name, description, category, default_properties, cr_user) VALUES
('UTM', 'Ultrasonic Thickness Measurement', 'Wall thickness measurement using ultrasonic testing', 'MEASUREMENT',
'{
  "fields": [
    {"name": "nominal_thickness_mm", "type": "number", "required": true, "label": "Nominal Thickness (mm)", "min": 0},
    {"name": "measured_thickness_mm", "type": "number", "required": true, "label": "Measured Thickness (mm)", "min": 0},
    {"name": "thickness_loss_percentage", "type": "number", "required": false, "label": "Thickness Loss (%)", "min": 0, "max": 100},
    {"name": "acceptance_criteria", "type": "select", "required": true, "options": ["PASSED", "MARGINAL", "FAILED"], "label": "Acceptance Criteria"},
    {"name": "remarks", "type": "textarea", "required": true, "label": "Remarks"}
  ]
}'::jsonb, false, true, 'system')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
