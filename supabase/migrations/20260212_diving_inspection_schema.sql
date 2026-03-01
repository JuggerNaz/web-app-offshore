-- ============================================================================
-- DIVING INSPECTION MODULE - DATABASE SCHEMA
-- Creates all tables required for diving inspection functionality
-- ============================================================================

-- ============================================================================
-- TABLE: insp_dive_jobs
-- Stores diving deployment/job information
-- ============================================================================
CREATE TABLE IF NOT EXISTS insp_dive_jobs (
    dive_job_id SERIAL PRIMARY KEY,
    deployment_no VARCHAR(50) UNIQUE NOT NULL,
    structure_id INTEGER,
    jobpack_id INTEGER,
    sow_report_no VARCHAR(50),
    
    -- Dive Team
    diver_name VARCHAR(100) NOT NULL,
    standby_diver VARCHAR(100) NOT NULL,
    dive_supervisor VARCHAR(100) NOT NULL,
    report_coordinator VARCHAR(100),
    
    -- Dive Details
    dive_type VARCHAR(50) DEFAULT 'Air Dive',
    deployment_date DATE NOT NULL,
    dive_start_time TIME NOT NULL,
    dive_end_time TIME,
    max_depth DECIMAL(10, 2),
    planned_duration INTEGER, -- in minutes
    actual_duration INTEGER, -- in minutes
    
    -- Status
    status VARCHAR(20) DEFAULT 'IN_PROGRESS',
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    CONSTRAINT fk_structure FOREIGN KEY (structure_id) REFERENCES structure(str_id) ON DELETE SET NULL,
    CONSTRAINT fk_jobpack FOREIGN KEY (jobpack_id) REFERENCES jobpack(id) ON DELETE SET NULL
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_dive_jobs_jobpack ON insp_dive_jobs(jobpack_id);
CREATE INDEX IF NOT EXISTS idx_dive_jobs_structure ON insp_dive_jobs(structure_id);
CREATE INDEX IF NOT EXISTS idx_dive_jobs_status ON insp_dive_jobs(status);

-- ============================================================================
-- TABLE: insp_dive_data
-- Stores inspection data collected during dive
-- ============================================================================
CREATE TABLE IF NOT EXISTS insp_dive_data (
    id SERIAL PRIMARY KEY,
    dive_job_id INTEGER NOT NULL REFERENCES insp_dive_jobs(dive_job_id) ON DELETE CASCADE,
    
    -- Component Information
    component_qid VARCHAR(100),
    
    -- Inspection Details
    inspection_type VARCHAR(100),
    condition VARCHAR(50),
    defects_found TEXT,
    observations TEXT,
    recommendations TEXT,
    photos_taken INTEGER DEFAULT 0,
    
    -- Timing
    inspection_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES auth.users(id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_dive_data_job ON insp_dive_data(dive_job_id);
CREATE INDEX IF NOT EXISTS idx_dive_data_component ON insp_dive_data(component_qid);

-- ============================================================================
-- TABLE: insp_dive_movements
-- Stores diver movement/location log during dive
-- ============================================================================
CREATE TABLE IF NOT EXISTS insp_dive_movements (
    id SERIAL PRIMARY KEY,
    dive_job_id INTEGER NOT NULL REFERENCES insp_dive_jobs(dive_job_id) ON DELETE CASCADE,
    
    -- Movement Details
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    location VARCHAR(200) NOT NULL,
    activity VARCHAR(500) NOT NULL,
    notes TEXT,
    
    -- Optional: Depth at this point
    depth_meters DECIMAL(10, 2),
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES auth.users(id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_dive_movements_job ON insp_dive_movements(dive_job_id);
CREATE INDEX IF NOT EXISTS idx_dive_movements_timestamp ON insp_dive_movements(timestamp);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE insp_dive_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_dive_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_dive_movements ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES FOR insp_dive_jobs
-- ============================================================================
DROP POLICY IF EXISTS "Allow authenticated users to insert dive jobs" ON insp_dive_jobs;
DROP POLICY IF EXISTS "Allow authenticated users to select dive jobs" ON insp_dive_jobs;
DROP POLICY IF EXISTS "Allow authenticated users to update dive jobs" ON insp_dive_jobs;
DROP POLICY IF EXISTS "Allow authenticated users to delete dive jobs" ON insp_dive_jobs;

CREATE POLICY "Allow authenticated users to insert dive jobs"
ON insp_dive_jobs FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to select dive jobs"
ON insp_dive_jobs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to update dive jobs"
ON insp_dive_jobs FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete dive jobs"
ON insp_dive_jobs FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- RLS POLICIES FOR insp_dive_data
-- ============================================================================
DROP POLICY IF EXISTS "Allow authenticated users to insert dive data" ON insp_dive_data;
DROP POLICY IF EXISTS "Allow authenticated users to select dive data" ON insp_dive_data;
DROP POLICY IF EXISTS "Allow authenticated users to update dive data" ON insp_dive_data;
DROP POLICY IF EXISTS "Allow authenticated users to delete dive data" ON insp_dive_data;

CREATE POLICY "Allow authenticated users to insert dive data"
ON insp_dive_data FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to select dive data"
ON insp_dive_data FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to update dive data"
ON insp_dive_data FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete dive data"
ON insp_dive_data FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- RLS POLICIES FOR insp_dive_movements
-- ============================================================================
DROP POLICY IF EXISTS "Allow authenticated users to insert dive movements" ON insp_dive_movements;
DROP POLICY IF EXISTS "Allow authenticated users to select dive movements" ON insp_dive_movements;
DROP POLICY IF EXISTS "Allow authenticated users to update dive movements" ON insp_dive_movements;
DROP POLICY IF EXISTS "Allow authenticated users to delete dive movements" ON insp_dive_movements;

CREATE POLICY "Allow authenticated users to insert dive movements"
ON insp_dive_movements FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to select dive movements"
ON insp_dive_movements FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to update dive movements"
ON insp_dive_movements FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete dive movements"
ON insp_dive_movements FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT ALL ON insp_dive_jobs TO authenticated;
GRANT ALL ON insp_dive_data TO authenticated;
GRANT ALL ON insp_dive_movements TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE insp_dive_jobs_dive_job_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE insp_dive_data_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE insp_dive_movements_id_seq TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE insp_dive_jobs IS 'Stores diving deployment and job information';
COMMENT ON TABLE insp_dive_data IS 'Stores inspection data collected during dives';
COMMENT ON TABLE insp_dive_movements IS 'Stores diver movement and location log';

-- ============================================================================
-- VERIFICATION QUERY
-- (Run this to verify tables and policies were created successfully)
-- ============================================================================
-- SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'insp_dive%';
-- SELECT tablename, policyname FROM pg_policies WHERE tablename LIKE 'insp_dive%';
