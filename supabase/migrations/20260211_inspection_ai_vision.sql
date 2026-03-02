-- ============================================================================
-- INSPECTION AI VISION - Image Analysis & Condition Assessment
-- ============================================================================
-- Description: AI-powered image analysis for automatic condition evaluation
--              and finding suggestions based on inspection photos
-- Created: 2026-02-11
-- Version: 1.0
-- ============================================================================

-- ============================================================================
-- AI VISION ANALYSIS TABLES
-- ============================================================================

-- AI Image Analysis Results
CREATE TABLE IF NOT EXISTS insp_ai_image_analysis (
    analysis_id BIGSERIAL PRIMARY KEY,
    
    -- Link to Media
    media_id BIGINT NOT NULL REFERENCES insp_media(media_id) ON DELETE CASCADE,
    inspection_id BIGINT REFERENCES insp_records(insp_id) ON DELETE CASCADE,
    component_id BIGINT,
    
    -- AI Provider Info
    ai_provider VARCHAR(100) NOT NULL, -- OPENAI_VISION, GOOGLE_CLOUD_VISION, CUSTOM_MODEL
    model_version VARCHAR(100), -- gpt-4-vision-preview, gemini-pro-vision, etc.
    
    -- Analysis Results
    analysis_status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
    
    -- Detected Conditions (JSONB for flexibility)
    detected_conditions JSONB DEFAULT '{}'::JSONB,
    -- Structure:
    -- {
    --   "overall_condition": "FAIR",
    --   "confidence": 0.85,
    --   "detected_issues": [
    --     {
    --       "type": "CORROSION",
    --       "severity": "MODERATE",
    --       "location": "upper_section",
    --       "confidence": 0.78,
    --       "bounding_box": {"x": 120, "y": 340, "width": 200, "height": 150}
    --     },
    --     {
    --       "type": "MARINE_GROWTH",
    --       "coverage_estimate": 25,
    --       "confidence": 0.92
    --     }
    --   ],
    --   "suggested_remarks": "Moderate corrosion observed in upper section. Marine growth coverage approximately 25%. Further inspection recommended.",
    --   "raw_response": "..." -- Full AI response
    -- }
    
    -- Suggested Findings
    suggested_overall_condition VARCHAR(50), -- EXCELLENT, GOOD, FAIR, POOR, CRITICAL
    suggested_remarks TEXT,
    suggested_defect_type VARCHAR(50),
    suggested_priority VARCHAR(50),
    
    -- Confidence Metrics
    overall_confidence NUMERIC(5,4), -- 0.0000 to 1.0000
    
    -- Anomaly Detection
    anomaly_detected BOOLEAN DEFAULT FALSE,
    anomaly_confidence NUMERIC(5,4),
    anomaly_description TEXT,
    
    -- Processing Info
    processing_time_ms INTEGER, -- Time taken for analysis
    api_cost_usd NUMERIC(10,6), -- Cost of API call
    
    -- Review Status
    reviewed_by_human BOOLEAN DEFAULT FALSE,
    human_reviewer VARCHAR(100),
    human_review_date TIMESTAMP,
    ai_accuracy VARCHAR(50), -- ACCURATE, PARTIALLY_ACCURATE, INACCURATE
    human_feedback TEXT,
    
    -- Error Handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Metadata
    workunit VARCHAR(10) DEFAULT '000',
    cr_user VARCHAR(100),
    cr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    md_user VARCHAR(100),
    md_date TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_analysis_status CHECK (analysis_status IN (
        'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
    )),
    CONSTRAINT chk_ai_accuracy CHECK (ai_accuracy IN (
        'ACCURATE', 'PARTIALLY_ACCURATE', 'INACCURATE'
    ))
);

-- AI Training Data (for model improvement)
CREATE TABLE IF NOT EXISTS insp_ai_training_data (
    training_id BIGSERIAL PRIMARY KEY,
    
    -- Link to Analysis
    analysis_id BIGINT REFERENCES insp_ai_image_analysis(analysis_id) ON DELETE SET NULL,
    media_id BIGINT REFERENCES insp_media(media_id) ON DELETE CASCADE,
    
    -- Ground Truth (actual findings)
    actual_condition VARCHAR(50) NOT NULL,
    actual_defect_type VARCHAR(50),
    actual_remarks TEXT,
    actual_has_anomaly BOOLEAN,
    
    -- AI Prediction
    predicted_condition VARCHAR(50),
    predicted_defect_type VARCHAR(50),
    predicted_has_anomaly BOOLEAN,
    
    -- Accuracy Metrics
    prediction_correct BOOLEAN,
    condition_match BOOLEAN,
    defect_type_match BOOLEAN,
    
    -- Image Classification Labels
    manual_labels JSONB, -- Labels added by human reviewer
    -- {
    --   "corrosion": true,
    --   "marine_growth": true,
    --   "coating_damage": false,
    --   "structural_damage": false,
    --   "anode_depletion": true
    -- }
    
    -- Use for Training
    use_for_training BOOLEAN DEFAULT TRUE,
    training_weight NUMERIC(3,2) DEFAULT 1.0, -- Weight for this sample
    
    -- Metadata
    workunit VARCHAR(10) DEFAULT '000',
    cr_user VARCHAR(100),
    cr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Model Performance Metrics
CREATE TABLE IF NOT EXISTS insp_ai_model_metrics (
    metric_id BIGSERIAL PRIMARY KEY,
    
    -- Model Info
    ai_provider VARCHAR(100) NOT NULL,
    model_version VARCHAR(100) NOT NULL,
    
    -- Time Period
    metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Performance Metrics
    total_analyses INTEGER DEFAULT 0,
    successful_analyses INTEGER DEFAULT 0,
    failed_analyses INTEGER DEFAULT 0,
    
    -- Accuracy Metrics
    accurate_predictions INTEGER DEFAULT 0,
    partially_accurate_predictions INTEGER DEFAULT 0,
    inaccurate_predictions INTEGER DEFAULT 0,
    accuracy_percentage NUMERIC(5,2), -- Overall accuracy %
    
    -- Condition Detection Accuracy
    condition_detection_accuracy NUMERIC(5,2),
    defect_detection_accuracy NUMERIC(5,2),
    anomaly_detection_accuracy NUMERIC(5,2),
    
    -- Average Confidence
    avg_confidence NUMERIC(5,4),
    
    -- Performance
    avg_processing_time_ms INTEGER,
    total_api_cost_usd NUMERIC(10,2),
    
    -- Metadata
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT uk_model_metrics_date UNIQUE(ai_provider, model_version, metric_date)
);

-- AI Prompt Templates (for different inspection types)
CREATE TABLE IF NOT EXISTS insp_ai_prompt_templates (
    template_id BIGSERIAL PRIMARY KEY,
    
    -- Template Info
    template_name VARCHAR(200) NOT NULL,
    inspection_type_code VARCHAR(50), -- GVI, CVI, etc. (NULL = generic)
    component_type VARCHAR(100), -- PRIMARY_LEG, RISER, etc. (NULL = generic)
    
    -- Prompt Configuration
    system_prompt TEXT NOT NULL,
    user_prompt_template TEXT NOT NULL,
    -- Example: "Analyze this {component_type} image from a {inspection_type} inspection. 
    --           Assess the condition focusing on: {focus_areas}. 
    --           Previous inspection showed: {previous_condition}."
    
    -- Expected Response Format
    response_format JSONB,
    -- {
    --   "type": "json_object",
    --   "schema": {
    --     "overall_condition": "string (EXCELLENT|GOOD|FAIR|POOR|CRITICAL)",
    --     "detected_issues": "array",
    --     "confidence": "number",
    --     "suggested_remarks": "string"
    --   }
    -- }
    
    -- Settings
    temperature NUMERIC(3,2) DEFAULT 0.7, -- AI creativity (0.0 - 1.0)
    max_tokens INTEGER DEFAULT 1000,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    version INTEGER DEFAULT 1,
    
    -- Metadata
    workunit VARCHAR(10) DEFAULT '000',
    cr_user VARCHAR(100),
    cr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    md_user VARCHAR(100),
    md_date TIMESTAMP,
    
    -- Constraints
    CONSTRAINT uk_prompt_template UNIQUE(inspection_type_code, component_type, version)
);

-- AI Analysis Queue (for batch processing)
CREATE TABLE IF NOT EXISTS insp_ai_analysis_queue (
    queue_id BIGSERIAL PRIMARY KEY,
    
    -- Media to Analyze
    media_id BIGINT NOT NULL REFERENCES insp_media(media_id) ON DELETE CASCADE,
    inspection_id BIGINT REFERENCES insp_records(insp_id) ON DELETE CASCADE,
    
    -- Priority
    priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
    
    -- Status
    queue_status VARCHAR(50) DEFAULT 'QUEUED', -- QUEUED, PROCESSING, COMPLETED, FAILED, CANCELLED
    
    -- Processing Info
    queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    analysis_id BIGINT REFERENCES insp_ai_image_analysis(analysis_id) ON DELETE SET NULL,
    
    -- Auto-retry
    max_retries INTEGER DEFAULT 3,
    current_retry INTEGER DEFAULT 0,
    last_error TEXT,
    
    -- Constraints
    CONSTRAINT chk_queue_status CHECK (queue_status IN (
        'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'
    ))
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- AI Image Analysis
CREATE INDEX idx_ai_analysis_media ON insp_ai_image_analysis(media_id);
CREATE INDEX idx_ai_analysis_inspection ON insp_ai_image_analysis(inspection_id);
CREATE INDEX idx_ai_analysis_status ON insp_ai_image_analysis(analysis_status);
CREATE INDEX idx_ai_analysis_provider ON insp_ai_image_analysis(ai_provider);
CREATE INDEX idx_ai_analysis_date ON insp_ai_image_analysis(cr_date);
CREATE INDEX idx_ai_analysis_anomaly ON insp_ai_image_analysis(anomaly_detected);

-- GIN index for detected_conditions JSON
CREATE INDEX idx_ai_analysis_conditions_gin ON insp_ai_image_analysis USING GIN (detected_conditions);

-- Training Data
CREATE INDEX idx_ai_training_analysis ON insp_ai_training_data(analysis_id);
CREATE INDEX idx_ai_training_media ON insp_ai_training_data(media_id);
CREATE INDEX idx_ai_training_use ON insp_ai_training_data(use_for_training);

-- Model Metrics
CREATE INDEX idx_ai_metrics_provider ON insp_ai_model_metrics(ai_provider);
CREATE INDEX idx_ai_metrics_date ON insp_ai_model_metrics(metric_date);

-- Prompt Templates
CREATE INDEX idx_ai_prompt_type ON insp_ai_prompt_templates(inspection_type_code);
CREATE INDEX idx_ai_prompt_component ON insp_ai_prompt_templates(component_type);
CREATE INDEX idx_ai_prompt_active ON insp_ai_prompt_templates(is_active);

-- Analysis Queue
CREATE INDEX idx_ai_queue_status ON insp_ai_analysis_queue(queue_status);
CREATE INDEX idx_ai_queue_priority ON insp_ai_analysis_queue(priority, queued_at);
CREATE INDEX idx_ai_queue_media ON insp_ai_analysis_queue(media_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to queue image for AI analysis
CREATE OR REPLACE FUNCTION fn_queue_image_for_analysis(
    p_media_id BIGINT,
    p_inspection_id BIGINT DEFAULT NULL,
    p_priority INTEGER DEFAULT 5
)
RETURNS BIGINT AS $$
DECLARE
    v_queue_id BIGINT;
BEGIN
    INSERT INTO insp_ai_analysis_queue (
        media_id,
        inspection_id,
        priority
    ) VALUES (
        p_media_id,
        p_inspection_id,
        p_priority
    )
    RETURNING queue_id INTO v_queue_id;
    
    RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get next queued item for processing
CREATE OR REPLACE FUNCTION fn_get_next_analysis_task()
RETURNS TABLE (
    queue_id BIGINT,
    media_id BIGINT,
    inspection_id BIGINT,
    file_path TEXT,
    component_type VARCHAR,
    inspection_type_code VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.queue_id,
        q.media_id,
        q.inspection_id,
        m.file_path,
        ir.component_type,
        ir.inspection_type_code
    FROM insp_ai_analysis_queue q
    INNER JOIN insp_media m ON q.media_id = m.media_id
    LEFT JOIN insp_records ir ON q.inspection_id = ir.insp_id
    WHERE q.queue_status = 'QUEUED'
      AND q.current_retry < q.max_retries
    ORDER BY q.priority ASC, q.queued_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql;

-- Function to update model metrics
CREATE OR REPLACE FUNCTION fn_update_model_metrics(
    p_ai_provider VARCHAR,
    p_model_version VARCHAR,
    p_metric_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID AS $$
DECLARE
    v_total INTEGER;
    v_successful INTEGER;
    v_failed INTEGER;
    v_accurate INTEGER;
    v_partially_accurate INTEGER;
    v_inaccurate INTEGER;
    v_avg_confidence NUMERIC;
    v_avg_time INTEGER;
    v_total_cost NUMERIC;
BEGIN
    -- Calculate metrics
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE analysis_status = 'COMPLETED'),
        COUNT(*) FILTER (WHERE analysis_status = 'FAILED'),
        COUNT(*) FILTER (WHERE ai_accuracy = 'ACCURATE'),
        COUNT(*) FILTER (WHERE ai_accuracy = 'PARTIALLY_ACCURATE'),
        COUNT(*) FILTER (WHERE ai_accuracy = 'INACCURATE'),
        AVG(overall_confidence),
        AVG(processing_time_ms),
        SUM(api_cost_usd)
    INTO 
        v_total,
        v_successful,
        v_failed,
        v_accurate,
        v_partially_accurate,
        v_inaccurate,
        v_avg_confidence,
        v_avg_time,
        v_total_cost
    FROM insp_ai_image_analysis
    WHERE ai_provider = p_ai_provider
      AND model_version = p_model_version
      AND DATE(cr_date) = p_metric_date;
    
    -- Insert or update metrics
    INSERT INTO insp_ai_model_metrics (
        ai_provider,
        model_version,
        metric_date,
        total_analyses,
        successful_analyses,
        failed_analyses,
        accurate_predictions,
        partially_accurate_predictions,
        inaccurate_predictions,
        accuracy_percentage,
        avg_confidence,
        avg_processing_time_ms,
        total_api_cost_usd
    ) VALUES (
        p_ai_provider,
        p_model_version,
        p_metric_date,
        v_total,
        v_successful,
        v_failed,
        v_accurate,
        v_partially_accurate,
        v_inaccurate,
        CASE WHEN v_total > 0 THEN (v_accurate::NUMERIC / v_total * 100) ELSE 0 END,
        v_avg_confidence,
        v_avg_time,
        v_total_cost
    )
    ON CONFLICT (ai_provider, model_version, metric_date) DO UPDATE SET
        total_analyses = EXCLUDED.total_analyses,
        successful_analyses = EXCLUDED.successful_analyses,
        failed_analyses = EXCLUDED.failed_analyses,
        accurate_predictions = EXCLUDED.accurate_predictions,
        partially_accurate_predictions = EXCLUDED.partially_accurate_predictions,
        inaccurate_predictions = EXCLUDED.inaccurate_predictions,
        accuracy_percentage = EXCLUDED.accuracy_percentage,
        avg_confidence = EXCLUDED.avg_confidence,
        avg_processing_time_ms = EXCLUDED.avg_processing_time_ms,
        total_api_cost_usd = EXCLUDED.total_api_cost_usd,
        last_updated = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update modified date
CREATE TRIGGER trg_ai_analysis_modified
    BEFORE UPDATE ON insp_ai_image_analysis
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_modified_date();

CREATE TRIGGER trg_ai_prompt_modified
    BEFORE UPDATE ON insp_ai_prompt_templates
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_modified_date();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: AI Analysis Results with Media Info
CREATE OR REPLACE VIEW vw_ai_analysis_results AS
SELECT 
    aia.analysis_id,
    aia.media_id,
    m.file_name,
    m.file_path,
    m.captured_at,
    aia.inspection_id,
    ir.inspection_data->>'inspno' AS inspno,
    ir.component_type,
    ir.inspection_type_code,
    aia.ai_provider,
    aia.model_version,
    aia.analysis_status,
    aia.suggested_overall_condition,
    aia.suggested_remarks,
    aia.overall_confidence,
    aia.anomaly_detected,
    aia.anomaly_confidence,
    aia.reviewed_by_human,
    aia.ai_accuracy,
    aia.processing_time_ms,
    aia.api_cost_usd,
    aia.cr_date AS analyzed_at
FROM insp_ai_image_analysis aia
INNER JOIN insp_media m ON aia.media_id = m.media_id
LEFT JOIN insp_records ir ON aia.inspection_id = ir.insp_id
ORDER BY aia.cr_date DESC;

-- View: AI Queue Status
CREATE OR REPLACE VIEW vw_ai_queue_status AS
SELECT 
    q.queue_id,
    q.media_id,
    m.file_name,
    q.inspection_id,
    ir.inspection_data->>'inspno' AS inspno,
    q.priority,
    q.queue_status,
    q.queued_at,
    q.started_at,
    q.completed_at,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - q.queued_at))::INTEGER AS wait_time_seconds,
    q.current_retry,
    q.max_retries,
    q.last_error
FROM insp_ai_analysis_queue q
INNER JOIN insp_media m ON q.media_id = m.media_id
LEFT JOIN insp_records ir ON q.inspection_id = ir.insp_id
ORDER BY q.priority ASC, q.queued_at ASC;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE insp_ai_image_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_ai_training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_ai_model_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_ai_prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE insp_ai_analysis_queue ENABLE ROW LEVEL SECURITY;

-- Example policies
CREATE POLICY "Allow read AI analysis" ON insp_ai_image_analysis
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert AI analysis" ON insp_ai_image_analysis
    FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================================
-- SAMPLE PROMPT TEMPLATES
-- ============================================================================

-- Generic inspection prompt
INSERT INTO insp_ai_prompt_templates (
    template_name,
    inspection_type_code,
    component_type,
    system_prompt,
    user_prompt_template,
    response_format,
    is_active,
    cr_user
) VALUES (
    'Generic Visual Inspection Analysis',
    NULL,
    NULL,
    'You are an expert offshore structure inspector with 20+ years of experience. Analyze inspection images and provide accurate condition assessments focusing on corrosion, marine growth, coating condition, structural integrity, and anode condition. Be concise but thorough.',
    'Analyze this offshore structural component image. Identify any visible defects, estimate marine growth coverage percentage, assess coating condition, detect corrosion, and provide an overall condition rating (EXCELLENT, GOOD, FAIR, POOR, or CRITICAL). Also suggest appropriate remarks for the inspection report.',
    '{
      "type": "json_object",
      "schema": {
        "overall_condition": "string",
        "confidence": "number",
        "detected_issues": "array",
        "marine_growth_percentage": "number",
        "corrosion_severity": "string",
        "coating_condition": "string",
        "anode_condition": "string",
        "suggested_remarks": "string",
        "anomaly_detected": "boolean",
        "anomaly_description": "string"
      }
    }'::jsonb,
    true,
    'system'
)
ON CONFLICT DO NOTHING;

-- GVI specific prompt
INSERT INTO insp_ai_prompt_templates (
    template_name,
    inspection_type_code,
    component_type,
    system_prompt,
    user_prompt_template,
    response_format,
    is_active,
    cr_user
) VALUES (
    'General Visual Inspection (GVI) - Detailed',
    'GVI',
    NULL,
    'You are an expert in General Visual Inspection (GVI) of offshore structures. Focus on overall condition assessment, marine fouling, corrosion patterns, coating degradation, and cathodic protection system effectiveness.',
    'Perform a detailed GVI analysis of this component. Previous inspection showed: {previous_condition}. Assess: 1) Overall condition 2) Marine growth coverage and type (soft/hard) 3) Corrosion level and location 4) Coating condition 5) Anode condition and depletion estimate 6) Any anomalies requiring immediate attention.',
    '{
      "type": "json_object",
      "schema": {
        "overall_condition": "string",
        "confidence": "number",
        "marine_growth": {
          "coverage_percentage": "number",
          "type": "string",
          "thickness_mm": "number"
        },
        "corrosion": {
          "severity": "string",
          "location": "string",
          "pattern": "string"
        },
        "coating": {
          "condition": "string",
          "degradation_percentage": "number"
        },
        "anode": {
          "condition": "string",
          "depletion_percentage": "number"
        },
        "detected_issues": "array",
        "suggested_remarks": "string",
        "anomaly_detected": "boolean"
      }
    }'::jsonb,
    true,
    'system'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE insp_ai_image_analysis IS 'Stores AI analysis results for inspection images';
COMMENT ON COLUMN insp_ai_image_analysis.detected_conditions IS 'JSONB field containing all AI-detected conditions and issues';
COMMENT ON TABLE insp_ai_training_data IS 'Training data for improving AI model accuracy';
COMMENT ON TABLE insp_ai_model_metrics IS 'Daily performance metrics for AI models';
COMMENT ON TABLE insp_ai_prompt_templates IS 'Prompt templates for different inspection types and components';
COMMENT ON TABLE insp_ai_analysis_queue IS 'Queue for batch processing of image analysis';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
