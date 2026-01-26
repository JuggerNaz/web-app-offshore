-- ============================================================================
-- Defect/Anomaly Criteria Management System - Database Schema
-- ============================================================================
-- This schema supports a flexible, user-defined defect criteria system
-- All validation rules are configurable by users without code changes
-- ============================================================================

-- ============================================================================
-- TABLE: defect_criteria_procedures
-- Stores procedure versions with effective dates for versioning
-- ============================================================================
CREATE TABLE IF NOT EXISTS defect_criteria_procedures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  procedure_number VARCHAR(50) NOT NULL UNIQUE,
  procedure_name VARCHAR(255) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by UUID REFERENCES auth.users(id),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  procedure_id UUID REFERENCES defect_criteria_procedures(id) ON DELETE CASCADE,
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  procedure_id UUID REFERENCES defect_criteria_procedures(id) ON DELETE CASCADE,
  structure_group VARCHAR(100) NOT NULL,
  
  -- References to U_LIB_LIST table (existing library data)
  priority_id UUID NOT NULL,        -- LIB_ID from U_LIB_LIST where LIB_CODE = 'AMLY_TYP'
  defect_code_id UUID NOT NULL,     -- LIB_ID from U_LIB_LIST where LIB_CODE = 'AMLY_COD'
  defect_type_id UUID NOT NULL,     -- LIB_ID from U_LIB_LIST where LIB_CODE = 'AMLY_FND'
  
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
-- TABLE: inspection_defect_flags
-- Records defects flagged during inspections
-- ============================================================================
CREATE TABLE IF NOT EXISTS inspection_defect_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID NOT NULL,
  event_id UUID NOT NULL,
  procedure_id UUID REFERENCES defect_criteria_procedures(id),
  rule_id UUID REFERENCES defect_criteria_rules(id),
  flagged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  auto_flagged BOOLEAN DEFAULT TRUE,
  overridden BOOLEAN DEFAULT FALSE,
  override_reason TEXT,
  
  -- Final values after user edits (LIB_ID references)
  final_defect_code_id UUID,
  final_priority_id UUID,
  final_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_defect_flags_inspection ON inspection_defect_flags(inspection_id);
CREATE INDEX idx_defect_flags_event ON inspection_defect_flags(event_id);
CREATE INDEX idx_defect_flags_procedure ON inspection_defect_flags(procedure_id);
CREATE INDEX idx_defect_flags_overridden ON inspection_defect_flags(overridden);

-- ============================================================================
-- TABLE: defect_override_audit_log
-- Audit trail for all defect flag overrides
-- ============================================================================
CREATE TABLE IF NOT EXISTS defect_override_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  defect_flag_id UUID REFERENCES inspection_defect_flags(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  override_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  field_changed VARCHAR(100) NOT NULL,
  original_value TEXT,
  new_value TEXT,
  reason TEXT NOT NULL,
  ip_address INET,
  session_id VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_log_defect_flag ON defect_override_audit_log(defect_flag_id);
CREATE INDEX idx_audit_log_user ON defect_override_audit_log(user_id);
CREATE INDEX idx_audit_log_timestamp ON defect_override_audit_log(override_timestamp DESC);

-- ============================================================================
-- TRIGGERS: Auto-update timestamps
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_defect_criteria_rules_updated_at
  BEFORE UPDATE ON defect_criteria_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inspection_defect_flags_updated_at
  BEFORE UPDATE ON inspection_defect_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS: Documentation
-- ============================================================================
COMMENT ON TABLE defect_criteria_procedures IS 'Stores defect criteria procedure versions with effective dates for audit compliance';
COMMENT ON TABLE defect_criteria_rules IS 'User-defined inspection criteria rules - fully configurable without code changes';
COMMENT ON TABLE defect_criteria_custom_params IS 'Dynamic custom parameters that users can define for flexible criteria';
COMMENT ON TABLE inspection_defect_flags IS 'Records of defects flagged during inspections with override tracking';
COMMENT ON TABLE defect_override_audit_log IS 'Complete audit trail of all user overrides for compliance';

COMMENT ON COLUMN defect_criteria_rules.priority_id IS 'References U_LIB_LIST.LIB_ID where LIB_CODE = AMLY_TYP';
COMMENT ON COLUMN defect_criteria_rules.defect_code_id IS 'References U_LIB_LIST.LIB_ID where LIB_CODE = AMLY_COD';
COMMENT ON COLUMN defect_criteria_rules.defect_type_id IS 'References U_LIB_LIST.LIB_ID where LIB_CODE = AMLY_FND';
COMMENT ON COLUMN defect_criteria_rules.custom_parameters IS 'JSON object with user-defined custom parameter values';
COMMENT ON COLUMN defect_criteria_rules.evaluation_priority IS 'Higher values take precedence when multiple rules match';
