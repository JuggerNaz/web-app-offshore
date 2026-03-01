-- ============================================================================
-- ROV DATA ACQUISITION & VIDEO SETTINGS INTEGRATION
-- ============================================================================
-- Description: Links inspection module with existing ROV data acquisition 
--              and video grab settings
-- Created: 2026-02-11
-- Version: 1.0
-- ============================================================================

-- ============================================================================
-- ADD ROV DATA SETTINGS REFERENCES TO INSPECTION TABLES
-- ============================================================================

-- Add ROV data acquisition configuration reference to ROV jobs
ALTER TABLE insp_rov_jobs 
ADD COLUMN IF NOT EXISTS rov_data_config_id BIGINT,
ADD COLUMN IF NOT EXISTS video_grab_config_id BIGINT,
ADD COLUMN IF NOT EXISTS auto_capture_data BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS auto_grab_video BOOLEAN DEFAULT FALSE;

-- Add comments
COMMENT ON COLUMN insp_rov_jobs.rov_data_config_id IS 'Reference to saved ROV data acquisition configuration';
COMMENT ON COLUMN insp_rov_jobs.video_grab_config_id IS 'Reference to saved video grab configuration';
COMMENT ON COLUMN insp_rov_jobs.auto_capture_data IS 'Automatically capture ROV data string at inspection events';
COMMENT ON COLUMN insp_rov_jobs.auto_grab_video IS 'Automatically grab video frames at inspection events';

-- Add ROV telemetry snapshot to inspection records
ALTER TABLE insp_records
ADD COLUMN IF NOT EXISTS rov_data_snapshot JSONB,
ADD COLUMN IF NOT EXISTS rov_data_timestamp TIMESTAMP,
ADD COLUMN IF NOT EXISTS video_frame_grabbed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS video_frame_media_id BIGINT REFERENCES insp_media(media_id) ON DELETE SET NULL;

-- Add comments
COMMENT ON COLUMN insp_records.rov_data_snapshot IS 'Snapshot of ROV telemetry data at time of inspection (depth, heading, lat/long, etc.)';
COMMENT ON COLUMN insp_records.rov_data_timestamp IS 'Timestamp when ROV data was captured';
COMMENT ON COLUMN insp_records.video_frame_grabbed IS 'Whether a video frame was automatically grabbed for this inspection';
COMMENT ON COLUMN insp_records.video_frame_media_id IS 'Link to automatically grabbed video frame';

-- ============================================================================
-- ROV DATA CONFIGURATION TABLE (if not exists)
-- ============================================================================

-- Table to store ROV data acquisition configurations
-- This links to the existing data acquisition settings in the system
CREATE TABLE IF NOT EXISTS rov_data_acquisition_config (
    config_id BIGSERIAL PRIMARY KEY,
    config_name VARCHAR(200) NOT NULL,
    structure_type VARCHAR(50), -- PLATFORM, PIPELINE, etc.
    
    -- Connection Settings
    connection_type VARCHAR(50) NOT NULL, -- SERIAL, NETWORK
    connection_params JSONB NOT NULL DEFAULT '{}'::JSONB,
    -- Example for Serial: {"port": "COM5", "baud_rate": 9600, "data_bits": 8, "parity": "NONE", "stop_bits": 1}
    -- Example for Network: {"host": "192.168.1.100", "port": 5000, "protocol": "TCP"}
    
    -- Data Parsing Method
    parsing_method VARCHAR(50) NOT NULL, -- POSITION_BASED, ID_BASED
    data_format JSONB NOT NULL DEFAULT '{}'::JSONB,
    -- Example for Position-based: {"start_pos": 1, "length": 10, "field_mappings": [...]}
    -- Example for ID-based: {"start_id": "LAT:", "end_id": ",", "field_mappings": [...]}
    
    -- Field Mappings to Inspection Data
    field_mappings JSONB NOT NULL DEFAULT '[]'::JSONB,
    -- [
    --   {"source_field": "DEPTH", "target_field": "depth_meters", "data_type": "number", "operation": null},
    --   {"source_field": "LAT", "target_field": "latitude", "data_type": "number", "operation": null},
    --   {"source_field": "TEMP", "target_field": "water_temperature", "data_type": "number", "operation": "multiply", "operation_value": 0.1}
    -- ]
    
    -- Default Data Sources
    default_data_sources JSONB DEFAULT '[]'::JSONB,
    -- [
    --   {"field": "inspection_date", "source": "SYSTEM_DATE"},
    --   {"field": "inspection_time", "source": "SYSTEM_TIME"},
    --   {"field": "online_status", "source": "ONLINE"}
    -- ]
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    workunit VARCHAR(10) DEFAULT '000',
    cr_user VARCHAR(100),
    cr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    md_user VARCHAR(100),
    md_date TIMESTAMP
);

-- ============================================================================
-- VIDEO GRAB CONFIGURATION TABLE (if not exists)
-- ============================================================================

-- Table to store video grab configurations
CREATE TABLE IF NOT EXISTS rov_video_grab_config (
    config_id BIGSERIAL PRIMARY KEY,
    config_name VARCHAR(200) NOT NULL,
    
    -- Camera/Video Source
    video_source VARCHAR(100), -- Camera device name or stream URL
    video_source_type VARCHAR(50), -- CAMERA, RTSP_STREAM, FILE
    
    -- Grab Settings
    grab_format VARCHAR(50) DEFAULT 'JPEG', -- JPEG, PNG, BMP
    grab_quality INTEGER DEFAULT 90, -- 1-100 for JPEG quality
    resolution_width INTEGER DEFAULT 1920,
    resolution_height INTEGER DEFAULT 1080,
    
    -- Auto-grab Settings
    auto_grab_on_inspection BOOLEAN DEFAULT TRUE,
    auto_grab_on_anomaly BOOLEAN DEFAULT TRUE,
    grab_interval_seconds INTEGER, -- For continuous grabbing (null = manual only)
    
    -- Storage Settings
    storage_path_template VARCHAR(500), -- e.g., "inspections/{job_id}/{component_id}/{timestamp}.jpg"
    storage_bucket VARCHAR(100) DEFAULT 'inspection-media',
    
    -- Overlay Settings (burn-in data on image)
    enable_overlay BOOLEAN DEFAULT TRUE,
    overlay_template JSONB DEFAULT '[]'::JSONB,
    -- [
    --   {"type": "text", "position": "top-left", "content": "{date} {time}"},
    --   {"type": "text", "position": "top-right", "content": "Depth: {depth}m"},
    --   {"type": "text", "position": "bottom-left", "content": "ROV: {rov_serial_no}"},
    --   {"type": "text", "position": "bottom-right", "content": "{component_id}"}
    -- ]
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    workunit VARCHAR(10) DEFAULT '000',
    cr_user VARCHAR(100),
    cr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    md_user VARCHAR(100),
    md_date TIMESTAMP
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- ROV Jobs
CREATE INDEX IF NOT EXISTS idx_rov_jobs_data_config ON insp_rov_jobs(rov_data_config_id);
CREATE INDEX IF NOT EXISTS idx_rov_jobs_video_config ON insp_rov_jobs(video_grab_config_id);

-- Inspection Records
CREATE INDEX IF NOT EXISTS idx_insp_records_video_frame ON insp_records(video_frame_media_id);
CREATE INDEX IF NOT EXISTS idx_insp_records_rov_data_time ON insp_records(rov_data_timestamp);

-- Data Acquisition Config
CREATE INDEX IF NOT EXISTS idx_rov_data_config_active ON rov_data_acquisition_config(is_active);
CREATE INDEX IF NOT EXISTS idx_rov_data_config_default ON rov_data_acquisition_config(is_default);
CREATE INDEX IF NOT EXISTS idx_rov_data_config_structure_type ON rov_data_acquisition_config(structure_type);

-- Video Grab Config
CREATE INDEX IF NOT EXISTS idx_video_grab_config_active ON rov_video_grab_config(is_active);
CREATE INDEX IF NOT EXISTS idx_video_grab_config_default ON rov_video_grab_config(is_default);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get active ROV data config for a structure type
CREATE OR REPLACE FUNCTION fn_get_default_rov_data_config(
    p_structure_type VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    config_id BIGINT,
    config_name VARCHAR,
    connection_type VARCHAR,
    connection_params JSONB,
    parsing_method VARCHAR,
    field_mappings JSONB,
    default_data_sources JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rdc.config_id,
        rdc.config_name,
        rdc.connection_type,
        rdc.connection_params,
        rdc.parsing_method,
        rdc.field_mappings,
        rdc.default_data_sources
    FROM rov_data_acquisition_config rdc
    WHERE rdc.is_active = TRUE
      AND (rdc.structure_type = p_structure_type OR rdc.structure_type IS NULL)
      AND rdc.is_default = TRUE
    ORDER BY 
        CASE WHEN rdc.structure_type = p_structure_type THEN 1 ELSE 2 END,
        rdc.cr_date DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get active video grab config
CREATE OR REPLACE FUNCTION fn_get_default_video_grab_config()
RETURNS TABLE (
    config_id BIGINT,
    config_name VARCHAR,
    video_source VARCHAR,
    grab_format VARCHAR,
    grab_quality INTEGER,
    resolution_width INTEGER,
    resolution_height INTEGER,
    enable_overlay BOOLEAN,
    overlay_template JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vgc.config_id,
        vgc.config_name,
        vgc.video_source,
        vgc.grab_format,
        vgc.grab_quality,
        vgc.resolution_width,
        vgc.resolution_height,
        vgc.enable_overlay,
        vgc.overlay_template
    FROM rov_video_grab_config vgc
    WHERE vgc.is_active = TRUE
      AND vgc.is_default = TRUE
    ORDER BY vgc.cr_date DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to capture ROV data snapshot
CREATE OR REPLACE FUNCTION fn_capture_rov_data_snapshot(
    p_rov_job_id BIGINT,
    p_raw_data_string TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_config RECORD;
    v_snapshot JSONB := '{}'::JSONB;
    v_mapping JSONB;
    v_source_value TEXT;
    v_parsed_value TEXT;
BEGIN
    -- Get ROV data config
    SELECT 
        rdc.parsing_method,
        rdc.field_mappings,
        rdc.default_data_sources
    INTO v_config
    FROM insp_rov_jobs rj
    INNER JOIN rov_data_acquisition_config rdc ON rj.rov_data_config_id = rdc.config_id
    WHERE rj.rov_job_id = p_rov_job_id;
    
    IF NOT FOUND THEN
        RETURN v_snapshot;
    END IF;
    
    -- Parse data string based on method
    -- This is a simplified version - actual implementation would parse based on config
    
    -- Add default data sources
    IF v_config.default_data_sources IS NOT NULL THEN
        FOR v_mapping IN SELECT * FROM jsonb_array_elements(v_config.default_data_sources)
        LOOP
            IF v_mapping->>'source' = 'SYSTEM_DATE' THEN
                v_snapshot := jsonb_set(v_snapshot, ARRAY[v_mapping->>'field'], to_jsonb(CURRENT_DATE::TEXT));
            ELSIF v_mapping->>'source' = 'SYSTEM_TIME' THEN
                v_snapshot := jsonb_set(v_snapshot, ARRAY[v_mapping->>'field'], to_jsonb(CURRENT_TIME::TEXT));
            ELSIF v_mapping->>'source' = 'ONLINE' THEN
                v_snapshot := jsonb_set(v_snapshot, ARRAY[v_mapping->>'field'], to_jsonb(TRUE));
            END IF;
        END LOOP;
    END IF;
    
    -- Store raw data string
    v_snapshot := jsonb_set(v_snapshot, ARRAY['raw_data_string'], to_jsonb(p_raw_data_string));
    v_snapshot := jsonb_set(v_snapshot, ARRAY['capture_timestamp'], to_jsonb(CURRENT_TIMESTAMP::TEXT));
    
    RETURN v_snapshot;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to auto-update modified date on configs
CREATE TRIGGER trg_rov_data_config_modified
    BEFORE UPDATE ON rov_data_acquisition_config
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_modified_date();

CREATE TRIGGER trg_video_grab_config_modified
    BEFORE UPDATE ON rov_video_grab_config
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_modified_date();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: ROV Inspections with Data Settings
CREATE OR REPLACE VIEW vw_rov_inspections_with_settings AS
SELECT 
    rj.rov_job_id,
    rj.deployment_no,
    rj.rov_serial_no,
    rj.deployment_date,
    rj.status,
    
    -- Data Config
    rdc.config_name AS data_config_name,
    rdc.connection_type,
    rdc.parsing_method,
    rj.auto_capture_data,
    
    -- Video Config
    vgc.config_name AS video_config_name,
    vgc.video_source,
    vgc.grab_format,
    vgc.resolution_width,
    vgc.resolution_height,
    rj.auto_grab_video,
    
    -- Counts
    (SELECT COUNT(*) FROM insp_records WHERE rov_job_id = rj.rov_job_id) AS total_inspections,
    (SELECT COUNT(*) FROM insp_records WHERE rov_job_id = rj.rov_job_id AND rov_data_snapshot IS NOT NULL) AS inspections_with_data,
    (SELECT COUNT(*) FROM insp_records WHERE rov_job_id = rj.rov_job_id AND video_frame_grabbed = TRUE) AS inspections_with_video
    
FROM insp_rov_jobs rj
LEFT JOIN rov_data_acquisition_config rdc ON rj.rov_data_config_id = rdc.config_id
LEFT JOIN rov_video_grab_config vgc ON rj.video_grab_config_id = vgc.config_id
ORDER BY rj.deployment_date DESC;

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Sample ROV Data Acquisition Configuration
INSERT INTO rov_data_acquisition_config (
    config_name,
    structure_type,
    connection_type,
    connection_params,
    parsing_method,
    data_format,
    field_mappings,
    default_data_sources,
    is_active,
    is_default,
    cr_user
) VALUES (
    'Standard ROV Serial Data (9600 baud)',
    NULL, -- Generic for all structure types
    'SERIAL',
    '{
      "port": "COM5",
      "baud_rate": 9600,
      "data_bits": 8,
      "parity": "NONE",
      "stop_bits": 1
    }'::jsonb,
    'POSITION_BASED',
    '{
      "start_pos": 1,
      "delimiter": ",",
      "fields_per_line": 8
    }'::jsonb,
    '[
      {"position": 1, "source_field": "DEPTH", "target_field": "depth_meters", "data_type": "number", "operation": null},
      {"position": 2, "source_field": "HEADING", "target_field": "heading_degrees", "data_type": "number", "operation": null},
      {"position": 3, "source_field": "LAT", "target_field": "latitude", "data_type": "number", "operation": null},
      {"position": 4, "source_field": "LONG", "target_field": "longitude", "data_type": "number", "operation": null},
      {"position": 5, "source_field": "ALTITUDE", "target_field": "altitude_meters", "data_type": "number", "operation": null},
      {"position": 6, "source_field": "TEMP", "target_field": "water_temperature", "data_type": "number", "operation": "multiply", "operation_value": 0.1},
      {"position": 7, "source_field": "VOLTAGE", "target_field": "battery_voltage", "data_type": "number", "operation": null},
      {"position": 8, "source_field": "STATUS", "target_field": "rov_status", "data_type": "text", "operation": null}
    ]'::jsonb,
    '[
      {"field": "inspection_date", "source": "SYSTEM_DATE"},
      {"field": "inspection_time", "source": "SYSTEM_TIME"},
      {"field": "online_status", "source": "ONLINE"}
    ]'::jsonb,
    true,
    true,
    'system'
)
ON CONFLICT DO NOTHING;

-- Sample ID-based configuration
INSERT INTO rov_data_acquisition_config (
    config_name,
    structure_type,
    connection_type,
    connection_params,
    parsing_method,
    data_format,
    field_mappings,
    is_active,
    is_default,
    cr_user
) VALUES (
    'ROV Network Stream (ID-based)',
    NULL,
    'NETWORK',
    '{
      "host": "192.168.1.100",
      "port": 5000,
      "protocol": "TCP"
    }'::jsonb,
    'ID_BASED',
    '{
      "format": "id_value_pairs",
      "separator": ":"
    }'::jsonb,
    '[
      {"start_id": "DEPTH:", "end_id": ",", "target_field": "depth_meters", "data_type": "number"},
      {"start_id": "HDG:", "end_id": ",", "target_field": "heading_degrees", "data_type": "number"},
      {"start_id": "LAT:", "end_id": ",", "target_field": "latitude", "data_type": "number"},
      {"start_id": "LON:", "end_id": ",", "target_field": "longitude", "data_type": "number"},
      {"start_id": "ALT:", "end_id": ",", "target_field": "altitude_meters", "data_type": "number"}
    ]'::jsonb,
    true,
    false,
    'system'
)
ON CONFLICT DO NOTHING;

-- Sample Video Grab Configuration
INSERT INTO rov_video_grab_config (
    config_name,
    video_source,
    video_source_type,
    grab_format,
    grab_quality,
    resolution_width,
    resolution_height,
    auto_grab_on_inspection,
    auto_grab_on_anomaly,
    storage_path_template,
    enable_overlay,
    overlay_template,
    is_active,
    is_default,
    cr_user
) VALUES (
    'Main ROV Camera (1080p)',
    'ROV_CAMERA_1',
    'CAMERA',
    'JPEG',
    90,
    1920,
    1080,
    true,
    true,
    'inspections/{rov_job_id}/{inspection_id}/{timestamp}.jpg',
    true,
    '[
      {"type": "text", "position": "top-left", "content": "{date} {time}", "font_size": 16, "color": "white", "background": "black"},
      {"type": "text", "position": "top-right", "content": "Depth: {depth}m | Alt: {altitude}m", "font_size": 14, "color": "yellow"},
      {"type": "text", "position": "bottom-left", "content": "ROV: {rov_serial_no}", "font_size": 14, "color": "white"},
      {"type": "text", "position": "bottom-right", "content": "{component_id} | Heading: {heading}°", "font_size": 14, "color": "white"}
    ]'::jsonb,
    true,
    true,
    'system'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE rov_data_acquisition_config IS 'Configuration for ROV data acquisition from external sources (Serial/Network)';
COMMENT ON TABLE rov_video_grab_config IS 'Configuration for automatic video frame grabbing during ROV inspections';

COMMENT ON COLUMN rov_data_acquisition_config.parsing_method IS 'How to parse data: POSITION_BASED (fixed positions) or ID_BASED (find by identifier)';
COMMENT ON COLUMN rov_data_acquisition_config.field_mappings IS 'Maps source data fields to inspection record fields with optional transformations';
COMMENT ON COLUMN rov_video_grab_config.overlay_template IS 'Template for text overlay on grabbed frames (burn-in data)';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
