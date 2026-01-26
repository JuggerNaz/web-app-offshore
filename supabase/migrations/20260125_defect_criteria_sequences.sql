-- ============================================================================
-- Defect/Anomaly Criteria Management System - Database Schema (Sequence-Based)
-- ============================================================================
-- This schema uses SEQUENCES for ID generation for better database portability
-- Compatible with PostgreSQL, MSSQL, Oracle, MySQL
-- ============================================================================

-- ============================================================================
-- SEQUENCES: ID Generation
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS defect_criteria_procedures_id_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS defect_criteria_custom_params_id_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS defect_criteria_rules_id_seq START WITH 1 INCREMENT BY 1;
-- inspection_defect_flags_id_seq - RESERVED for future use when inspection table is ready
-- defect_override_audit_log_id_seq - RESERVED for future use when inspection table is ready

-- ============================================================================
-- TABLE: defect_criteria_procedures
-- Stores procedure versions with effective dates for versioning
-- ============================================================================
CREATE TABLE IF NOT EXISTS defect_criteria_procedures (
  id BIGINT PRIMARY KEY DEFAULT nextval('defect_criteria_procedures_id_seq'),
  procedure_number VARCHAR(50) NOT NULL UNIQUE,
  procedure_name VARCHAR(255) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by VARCHAR(255),  -- User identifier
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) CHECK (status IN ('draft', 'active', 'archived')) DEFAULT 'draft',
  notes TEXT,
  
  -- Ensure unique version per procedure number
  CONSTRAINT unique_procedure_version UNIQUE (procedure_number, version)
);

-- Index for finding active procedures by effective date
CREATE INDEX idx_procedures_effective_date ON defect_criteria_procedures(effective_date, status);
CREATE INDEX idx_procedures_status ON defect_criteria_procedures(status);

-- ============================================================================
-- TABLE: defect_criteria_custom_params
-- Defines available custom parameters for a procedure
-- ============================================================================
CREATE TABLE IF NOT EXISTS defect_criteria_custom_params (
  id BIGINT PRIMARY KEY DEFAULT nextval('defect_criteria_custom_params_id_seq'),
  procedure_id BIGINT REFERENCES defect_criteria_procedures(id) ON DELETE CASCADE,
  parameter_name VARCHAR(100) NOT NULL,
  parameter_label VARCHAR(255) NOT NULL,
  parameter_type VARCHAR(20) CHECK (parameter_type IN ('number', 'text', 'boolean', 'date')),
  parameter_unit VARCHAR(50),
  validation_rules JSONB,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique parameter names per procedure
  CONSTRAINT unique_param_per_procedure UNIQUE (procedure_id, parameter_name)
);

CREATE INDEX idx_custom_params_procedure ON defect_criteria_custom_params(procedure_id);

-- ============================================================================
-- TABLE: defect_criteria_rules
-- Stores individual defect criteria rules
-- ============================================================================
CREATE TABLE IF NOT EXISTS defect_criteria_rules (
  id BIGINT PRIMARY KEY DEFAULT nextval('defect_criteria_rules_id_seq'),
  procedure_id BIGINT REFERENCES defect_criteria_procedures(id) ON DELETE CASCADE,
  structure_group VARCHAR(100) NOT NULL,
  
  -- References to U_LIB_LIST table (existing library data)
  -- Note: U_LIB_LIST.LIB_ID might be UUID - keep as VARCHAR for compatibility
  priority_id VARCHAR(255) NOT NULL,        -- LIB_ID from U_LIB_LIST where LIB_CODE = 'AMLY_TYP'
  defect_code_id VARCHAR(255) NOT NULL,     -- LIB_ID from U_LIB_LIST where LIB_CODE = 'AMLY_COD'
  defect_type_id VARCHAR(255) NOT NULL,     -- LIB_ID from U_LIB_LIST where LIB_CODE = 'AMLY_FND'
  
  -- Optional conditions
  jobpack_type VARCHAR(100),
  elevation_min DECIMAL(10, 2),
  elevation_max DECIMAL(10, 2),
  nominal_thickness DECIMAL(10, 2),
  threshold_value DECIMAL(10, 2),
  threshold_operator VARCHAR(5) CHECK (threshold_operator IN ('>', '<', '>=', '<=', '==', '!=')),
  
  -- Dynamic custom parameters (JSON)
  custom_parameters JSONB,
  
  -- Alert settings
  auto_flag BOOLEAN DEFAULT TRUE,
  alert_message TEXT NOT NULL,
  
  -- Ordering and priority
  rule_order INTEGER NOT NULL DEFAULT 0,
  evaluation_priority INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_rules_procedure ON defect_criteria_rules(procedure_id);
CREATE INDEX idx_rules_priority ON defect_criteria_rules(evaluation_priority DESC);
CREATE INDEX idx_rules_structure ON defect_criteria_rules(structure_group);

-- ============================================================================
-- TABLE: inspection_defect_flags (RESERVED FOR FUTURE USE)
-- ============================================================================
-- This table will be created when the inspection system is ready
-- It will record defects flagged during inspections with a single inspection_event_id
-- 
-- Planned structure:
-- - id: BIGINT DEFAULT nextval('inspection_defect_flags_id_seq')
-- - inspection_event_id: VARCHAR(255) - Single reference to inspection event
-- - procedure_id: BIGINT - Reference to defect_criteria_procedures
-- - rule_id: BIGINT - Reference to defect_criteria_rules
-- - flagged_at: TIMESTAMP
-- - auto_flagged: BOOLEAN
-- - overridden: BOOLEAN
-- - override_reason: TEXT
-- - final_defect_code_id: VARCHAR(255)
-- - final_priority_id: VARCHAR(255)
-- - final_notes: TEXT
-- ============================================================================

-- ============================================================================
-- TABLE: defect_override_audit_log (RESERVED FOR FUTURE USE)
-- ============================================================================
-- This table will be created when the inspection system is ready
-- It will provide audit trail for all defect flag overrides
-- 
-- Planned structure:
-- - id: BIGINT DEFAULT nextval('defect_override_audit_log_id_seq')
-- - defect_flag_id: BIGINT - Reference to inspection_defect_flags
-- - user_id: VARCHAR(255)
-- - override_timestamp: TIMESTAMP
-- - field_changed: VARCHAR(100)
-- - original_value: TEXT
-- - new_value: TEXT
-- - reason: TEXT
-- - ip_address: VARCHAR(50)
-- - session_id: VARCHAR(255)
-- ============================================================================

-- ============================================================================
-- TRIGGERS: Auto-update timestamps
-- ============================================================================
-- Global function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION gf_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_defect_criteria_rules_updated_at
  BEFORE UPDATE ON defect_criteria_rules
  FOR EACH ROW
  EXECUTE FUNCTION gf_update_updated_at();

-- Trigger for inspection_defect_flags will be created when inspection table is ready

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Enable RLS on all tables
ALTER TABLE defect_criteria_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE defect_criteria_custom_params ENABLE ROW LEVEL SECURITY;
ALTER TABLE defect_criteria_rules ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Policies for defect_criteria_procedures
-- ============================================================================
DROP POLICY IF EXISTS "Allow authenticated users to read procedures" ON defect_criteria_procedures;
CREATE POLICY "Allow authenticated users to read procedures"
    ON defect_criteria_procedures
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to create procedures" ON defect_criteria_procedures;
CREATE POLICY "Allow authenticated users to create procedures"
    ON defect_criteria_procedures
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update procedures" ON defect_criteria_procedures;
CREATE POLICY "Allow authenticated users to update procedures"
    ON defect_criteria_procedures
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to delete procedures" ON defect_criteria_procedures;
CREATE POLICY "Allow authenticated users to delete procedures"
    ON defect_criteria_procedures
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================================================
-- Policies for defect_criteria_custom_params
-- ============================================================================
DROP POLICY IF EXISTS "Allow authenticated users to read custom params" ON defect_criteria_custom_params;
CREATE POLICY "Allow authenticated users to read custom params"
    ON defect_criteria_custom_params
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to create custom params" ON defect_criteria_custom_params;
CREATE POLICY "Allow authenticated users to create custom params"
    ON defect_criteria_custom_params
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update custom params" ON defect_criteria_custom_params;
CREATE POLICY "Allow authenticated users to update custom params"
    ON defect_criteria_custom_params
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to delete custom params" ON defect_criteria_custom_params;
CREATE POLICY "Allow authenticated users to delete custom params"
    ON defect_criteria_custom_params
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================================================
-- Policies for defect_criteria_rules
-- ============================================================================
DROP POLICY IF EXISTS "Allow authenticated users to read rules" ON defect_criteria_rules;
CREATE POLICY "Allow authenticated users to read rules"
    ON defect_criteria_rules
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to create rules" ON defect_criteria_rules;
CREATE POLICY "Allow authenticated users to create rules"
    ON defect_criteria_rules
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update rules" ON defect_criteria_rules;
CREATE POLICY "Allow authenticated users to update rules"
    ON defect_criteria_rules
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to delete rules" ON defect_criteria_rules;
CREATE POLICY "Allow authenticated users to delete rules"
    ON defect_criteria_rules
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================================================
-- COMMENTS: Documentation
-- ============================================================================
COMMENT ON SEQUENCE defect_criteria_procedures_id_seq IS 'Sequence for defect_criteria_procedures.id - portable across databases';
COMMENT ON SEQUENCE defect_criteria_custom_params_id_seq IS 'Sequence for defect_criteria_custom_params.id - portable across databases';
COMMENT ON SEQUENCE defect_criteria_rules_id_seq IS 'Sequence for defect_criteria_rules.id - portable across databases';

COMMENT ON TABLE defect_criteria_procedures IS 'Stores defect criteria procedure versions with effective dates for audit compliance';
COMMENT ON TABLE defect_criteria_rules IS 'User-defined inspection criteria rules - fully configurable without code changes';
COMMENT ON TABLE defect_criteria_custom_params IS 'Dynamic custom parameters that users can define for flexible criteria';

COMMENT ON COLUMN defect_criteria_rules.priority_id IS 'References U_LIB_LIST.LIB_ID where LIB_CODE = AMLY_TYP';
COMMENT ON COLUMN defect_criteria_rules.defect_code_id IS 'References U_LIB_LIST.LIB_ID where LIB_CODE = AMLY_COD';
COMMENT ON COLUMN defect_criteria_rules.defect_type_id IS 'References U_LIB_LIST.LIB_ID where LIB_CODE = AMLY_FND';
COMMENT ON COLUMN defect_criteria_rules.custom_parameters IS 'JSON object with user-defined custom parameter values';
COMMENT ON COLUMN defect_criteria_rules.evaluation_priority IS 'Higher values take precedence when multiple rules match';

-- ============================================================================
-- FUTURE TABLES (To be added when inspection system is ready)
-- ============================================================================
-- 1. inspection_defect_flags - Will use single inspection_event_id column
-- 2. defect_override_audit_log - Will track all override changes
-- ============================================================================

