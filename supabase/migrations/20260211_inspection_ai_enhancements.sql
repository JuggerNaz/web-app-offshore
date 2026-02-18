-- ============================================================================
-- INSPECTION MODULE AI ENHANCEMENTS - DATABASE ADDITIONS
-- ============================================================================
-- Description: Additional tables and functions for AI-powered features
-- Created: 2026-02-11
-- Version: 1.0
-- ============================================================================

-- ============================================================================
-- 1. AUTO-ASSIGNMENT PATTERN LEARNING
-- ============================================================================

-- Store user's numbering patterns for dive/ROV jobs
CREATE TABLE IF NOT EXISTS insp_numbering_patterns (
    pattern_id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    pattern_type VARCHAR(50) NOT NULL, -- DIVE_NO, DEPLOYMENT_NO
    pattern_format VARCHAR(200) NOT NULL, -- e.g., "DIVE-{YYYY}-{###}", "ROV-{MM}-{####}"
    sample_values TEXT[], -- Array of samples: ["DIVE-2026-001", "DIVE-2026-002"]
    last_sequence_number INTEGER,
    usage_count INTEGER DEFAULT 1,
    confidence_score NUMERIC(5,2) DEFAULT 50.0, -- 0-100
    last_used_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uk_user_pattern UNIQUE(user_id, pattern_type, pattern_format)
);

CREATE INDEX idx_numbering_patterns_user ON insp_numbering_patterns(user_id, pattern_type);
CREATE INDEX idx_numbering_patterns_confidence ON insp_numbering_patterns(confidence_score DESC);

-- ============================================================================
-- 2. PERSONNEL AUTO-ASSIGNMENT TRACKING
-- ============================================================================

-- Track personnel assignment history for auto-suggest
CREATE TABLE IF NOT EXISTS insp_personnel_history (
    history_id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    structure_id BIGINT REFERENCES u_structure(str_id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL, -- DIVING, ROV
    
    -- Personnel roles
    primary_person VARCHAR(200), -- Diver or ROV Operator
    supervisor VARCHAR(200),
    coordinator VARCHAR(200),
    
    -- Tracking
    assignment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    frequency_count INTEGER DEFAULT 1,
    
    CONSTRAINT uk_personnel_assignment UNIQUE(user_id, structure_id, job_type, primary_person, supervisor, coordinator)
);

CREATE INDEX idx_personnel_history_user ON insp_personnel_history(user_id, structure_id, job_type);
CREATE INDEX idx_personnel_history_frequency ON insp_personnel_history(frequency_count DESC);

-- ============================================================================
-- 3. INSPECTION FINDINGS TEXT LEARNING
-- ============================================================================

-- Store frequently used inspection remarks/descriptions
CREATE TABLE IF NOT EXISTS insp_text_patterns (
    text_pattern_id BIGSERIAL PRIMARY KEY,
    
    -- Context
    inspection_type_code VARCHAR(50) NOT NULL,
    component_type VARCHAR(100),
    field_name VARCHAR(100) NOT NULL, -- Which field this text is for (remarks, description, etc.)
    
    -- Text Pattern
    pattern_text TEXT NOT NULL,
    normalized_text TEXT, -- Lowercase, trimmed version for matching
    word_tokens TEXT[], -- Array of words for partial matching
    
    -- Usage Statistics
    usage_count INTEGER DEFAULT 1,
    user_count INTEGER DEFAULT 1, -- How many different users used this
    last_used_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Quality Score
    quality_score NUMERIC(5,2) DEFAULT 50.0, -- Based on usage, user count, recency
    
    -- Metadata
    cr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uk_text_pattern UNIQUE(inspection_type_code, component_type, field_name, normalized_text)
);

CREATE INDEX idx_text_patterns_context ON insp_text_patterns(inspection_type_code, component_type, field_name);
CREATE INDEX idx_text_patterns_quality ON insp_text_patterns(quality_score DESC);
CREATE INDEX idx_text_patterns_usage ON insp_text_patterns(usage_count DESC);

-- GIN index for text search
CREATE INDEX idx_text_patterns_tokens ON insp_text_patterns USING GIN (word_tokens);

-- ============================================================================
-- 4. VIDEO TAPE COUNTER TRACKING
-- ============================================================================

-- Enhance video_logs table with counter information
ALTER TABLE insp_video_logs
ADD COLUMN IF NOT EXISTS tape_counter_start INTEGER,
ADD COLUMN IF NOT EXISTS tape_counter_end INTEGER,
ADD COLUMN IF NOT EXISTS counter_format VARCHAR(50) DEFAULT 'HH:MM:SS'; -- or 'NUMERIC'

-- Virtual tape counter state (for active recordings)
CREATE TABLE IF NOT EXISTS insp_video_counters (
    counter_id BIGSERIAL PRIMARY KEY,
    tape_id BIGINT NOT NULL REFERENCES insp_video_tapes(tape_id) ON DELETE CASCADE,
    
    -- Counter State
    is_running BOOLEAN DEFAULT FALSE,
    current_counter_value INTEGER DEFAULT 0, -- In seconds or frame count
    counter_format VARCHAR(50) DEFAULT 'HH:MM:SS',
    
    -- Start/Stop Times
    started_at TIMESTAMP,
    stopped_at TIMESTAMP,
    
    -- Metadata
    cr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    md_date TIMESTAMP,
    
    CONSTRAINT uk_tape_counter UNIQUE(tape_id)
);

CREATE INDEX idx_video_counters_tape ON insp_video_counters(tape_id);
CREATE INDEX idx_video_counters_running ON insp_video_counters(is_running) WHERE is_running = TRUE;

-- ============================================================================
-- 5. COMPONENT INSPECTION HISTORY TRACKING
-- ============================================================================

-- Materialized view for quick historical data access
-- Materialized view for quick historical data access
CREATE MATERIALIZED VIEW IF NOT EXISTS vw_component_inspection_history AS
SELECT 
    ir.component_id,
    ir.structure_id,
    COUNT(*) AS total_inspections,
    MAX(ir.inspection_date) AS last_inspection_date,
    MIN(ir.inspection_date) AS first_inspection_date,
    
    -- Latest inspection details
    (SELECT inspection_type_code 
     FROM insp_records 
     WHERE component_id = ir.component_id 
     ORDER BY inspection_date DESC, inspection_time DESC 
     LIMIT 1) AS last_inspection_type,
    
    (SELECT status 
     FROM insp_records 
     WHERE component_id = ir.component_id 
     ORDER BY inspection_date DESC, inspection_time DESC 
     LIMIT 1) AS last_inspection_status,
    
    -- Anomaly tracking
    COUNT(*) FILTER (WHERE ir.has_anomaly = TRUE) AS total_anomalies,
    MAX(ir.inspection_date) FILTER (WHERE ir.has_anomaly = TRUE) AS last_anomaly_date,
    
    -- Condition trends (from JSON data)
    jsonb_agg(
        jsonb_build_object(
            'date', ir.inspection_date,
            'time', ir.inspection_time,
            'type', ir.inspection_type_code,
            'condition', ir.inspection_data->'overall_condition',
            'has_anomaly', ir.has_anomaly
        ) ORDER BY ir.inspection_date DESC, ir.inspection_time DESC
    ) FILTER (WHERE ir.inspection_date >= CURRENT_DATE - INTERVAL '2 years') AS recent_history,
    
    -- Statistics
    AVG(CAST(ir.inspection_data->>'marine_growth_percentage' AS NUMERIC)) AS avg_marine_growth,
    
    -- Last updated
    MAX(ir.cr_date) AS data_updated_at
    
FROM insp_records ir
WHERE ir.status IN ('COMPLETED', 'REVIEWED', 'APPROVED')
GROUP BY ir.component_id, ir.structure_id;

-- Indexes for the materialized view
CREATE UNIQUE INDEX idx_comp_history_component ON vw_component_inspection_history(component_id);
CREATE INDEX idx_comp_history_structure ON vw_component_inspection_history(structure_id);
CREATE INDEX idx_comp_history_last_date ON vw_component_inspection_history(last_inspection_date DESC);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_component_history()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY vw_component_inspection_history;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. AI LEARNING FUNCTIONS
-- ============================================================================

-- Function: Learn numbering pattern from user input
CREATE OR REPLACE FUNCTION fn_learn_numbering_pattern(
    p_user_id VARCHAR,
    p_pattern_type VARCHAR,
    p_sample_value VARCHAR
)
RETURNS void AS $$
DECLARE
    v_format VARCHAR;
    v_sequence_number INTEGER;
BEGIN
    -- Extract pattern format from sample value
    -- Example: "DIVE-2026-001" -> "DIVE-{YYYY}-{###}"
    v_format := regexp_replace(p_sample_value, '\d{4}', '{YYYY}', 'g');
    v_format := regexp_replace(v_format, '\d{3,}', '{###}', 'g');
    v_format := regexp_replace(v_format, '\d{2}', '{##}', 'g');
    v_format := regexp_replace(v_format, '\d{1}', '{#}', 'g');
    
    -- Extract sequence number (last numeric segment)
    v_sequence_number := COALESCE(
        CAST(regexp_replace(p_sample_value, '.*?(\d+)$', '\1') AS INTEGER),
        0
    );
    
    -- Insert or update pattern
    INSERT INTO insp_numbering_patterns (
        user_id, pattern_type, pattern_format, 
        sample_values, last_sequence_number, usage_count
    ) VALUES (
        p_user_id, p_pattern_type, v_format,
        ARRAY[p_sample_value], v_sequence_number, 1
    )
    ON CONFLICT (user_id, pattern_type, pattern_format) 
    DO UPDATE SET
        sample_values = array_append(
            CASE 
                WHEN array_length(insp_numbering_patterns.sample_values, 1) >= 10 
                THEN insp_numbering_patterns.sample_values[2:10]
                ELSE insp_numbering_patterns.sample_values
            END,
            p_sample_value
        ),
        last_sequence_number = v_sequence_number,
        usage_count = insp_numbering_patterns.usage_count + 1,
        confidence_score = LEAST(100.0, insp_numbering_patterns.confidence_score + 5.0),
        last_used_date = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function: Get suggested next number
CREATE OR REPLACE FUNCTION fn_suggest_next_number(
    p_user_id VARCHAR,
    p_pattern_type VARCHAR
)
RETURNS VARCHAR AS $$
DECLARE
    v_pattern RECORD;
    v_next_number VARCHAR;
    v_year VARCHAR;
    v_month VARCHAR;
    v_sequence VARCHAR;
BEGIN
    -- Get the most confident pattern
    SELECT * INTO v_pattern
    FROM insp_numbering_patterns
    WHERE user_id = p_user_id AND pattern_type = p_pattern_type
    ORDER BY confidence_score DESC, last_used_date DESC
    LIMIT 1;
    
    IF v_pattern IS NULL THEN
        -- Default pattern
        RETURN CASE p_pattern_type
            WHEN 'DIVE_NO' THEN 'DIVE-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-001'
            WHEN 'DEPLOYMENT_NO' THEN 'ROV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-001'
            ELSE 'INS-001'
        END;
    END IF;
    
    -- Generate next number based on pattern
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    v_month := TO_CHAR(CURRENT_DATE, 'MM');
    v_sequence := LPAD((v_pattern.last_sequence_number + 1)::TEXT, 3, '0');
    
    v_next_number := v_pattern.pattern_format;
    v_next_number := REPLACE(v_next_number, '{YYYY}', v_year);
    v_next_number := REPLACE(v_next_number, '{MM}', v_month);
    v_next_number := REPLACE(v_next_number, '{###}', v_sequence);
    
    RETURN v_next_number;
END;
$$ LANGUAGE plpgsql;

-- Function: Learn personnel assignment
CREATE OR REPLACE FUNCTION fn_learn_personnel_assignment(
    p_user_id VARCHAR,
    p_structure_id BIGINT,
    p_job_type VARCHAR,
    p_primary_person VARCHAR,
    p_supervisor VARCHAR,
    p_coordinator VARCHAR
)
RETURNS void AS $$
BEGIN
    INSERT INTO insp_personnel_history (
        user_id, structure_id, job_type,
        primary_person, supervisor, coordinator,
        frequency_count
    ) VALUES (
        p_user_id, p_structure_id, p_job_type,
        p_primary_person, p_supervisor, p_coordinator,
        1
    )
    ON CONFLICT (user_id, structure_id, job_type, primary_person, supervisor, coordinator)
    DO UPDATE SET
        frequency_count = insp_personnel_history.frequency_count + 1,
        assignment_date = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function: Get suggested personnel
CREATE OR REPLACE FUNCTION fn_suggest_personnel(
    p_user_id VARCHAR,
    p_structure_id BIGINT,
    p_job_type VARCHAR
)
RETURNS TABLE (
    primary_person VARCHAR,
    supervisor VARCHAR,
    coordinator VARCHAR,
    confidence NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ph.primary_person,
        ph.supervisor,
        ph.coordinator,
        (ph.frequency_count::NUMERIC / GREATEST(1, SUM(ph.frequency_count) OVER ())) * 100 AS confidence
    FROM insp_personnel_history ph
    WHERE ph.user_id = p_user_id 
        AND (ph.structure_id = p_structure_id OR ph.structure_id IS NULL)
        AND ph.job_type = p_job_type
    ORDER BY ph.frequency_count DESC, ph.assignment_date DESC
    LIMIT 3;
END;
$$ LANGUAGE plpgsql;

-- Function: Learn text pattern
CREATE OR REPLACE FUNCTION fn_learn_text_pattern(
    p_inspection_type VARCHAR,
    p_component_type VARCHAR,
    p_field_name VARCHAR,
    p_text TEXT
)
RETURNS void AS $$
DECLARE
    v_normalized TEXT;
    v_tokens TEXT[];
BEGIN
    -- Normalize text
    v_normalized := LOWER(TRIM(p_text));
    
    -- Skip if too short
    IF LENGTH(v_normalized) < 5 THEN
        RETURN;
    END IF;
    
    -- Tokenize
    v_tokens := string_to_array(v_normalized, ' ');
    
    -- Insert or update
    INSERT INTO insp_text_patterns (
        inspection_type_code, component_type, field_name,
        pattern_text, normalized_text, word_tokens,
        usage_count, quality_score
    ) VALUES (
        p_inspection_type, p_component_type, p_field_name,
        p_text, v_normalized, v_tokens,
        1, 50.0
    )
    ON CONFLICT (inspection_type_code, component_type, field_name, normalized_text)
    DO UPDATE SET
        usage_count = insp_text_patterns.usage_count + 1,
        quality_score = LEAST(100.0, insp_text_patterns.quality_score + 2.0),
        last_used_date = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function: Get text suggestions
CREATE OR REPLACE FUNCTION fn_suggest_text(
    p_inspection_type VARCHAR,
    p_component_type VARCHAR,
    p_field_name VARCHAR,
    p_partial_text TEXT,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    suggestion TEXT,
    confidence NUMERIC
) AS $$
DECLARE
    v_search_tokens TEXT[];
BEGIN
    v_search_tokens := string_to_array(LOWER(TRIM(p_partial_text)), ' ');
    
    RETURN QUERY
    SELECT 
        tp.pattern_text,
        (
            (tp.quality_score * 0.4) + 
            (LEAST(100, tp.usage_count * 5) * 0.3) +
            (CASE 
                WHEN tp.normalized_text LIKE LOWER(p_partial_text) || '%' THEN 30
                WHEN tp.word_tokens && v_search_tokens THEN 15
                ELSE 0
            END)
        ) AS confidence
    FROM insp_text_patterns tp
    WHERE tp.inspection_type_code = p_inspection_type
        AND (tp.component_type = p_component_type OR tp.component_type IS NULL)
        AND tp.field_name = p_field_name
        AND (
            tp.normalized_text LIKE '%' || LOWER(p_partial_text) || '%'
            OR tp.word_tokens && v_search_tokens
        )
    ORDER BY confidence DESC, tp.usage_count DESC, tp.last_used_date DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. VIDEO COUNTER FUNCTIONS
-- ============================================================================

-- Function: Start video counter
CREATE OR REPLACE FUNCTION fn_start_video_counter(
    p_tape_id BIGINT,
    p_counter_format VARCHAR DEFAULT 'HH:MM:SS'
)
RETURNS BIGINT AS $$
DECLARE
    v_counter_id BIGINT;
BEGIN
    INSERT INTO insp_video_counters (
        tape_id, is_running, current_counter_value, 
        counter_format, started_at
    ) VALUES (
        p_tape_id, TRUE, 0,
        p_counter_format, CURRENT_TIMESTAMP
    )
    ON CONFLICT (tape_id)
    DO UPDATE SET
        is_running = TRUE,
        current_counter_value = 0,
        started_at = CURRENT_TIMESTAMP,
        md_date = CURRENT_TIMESTAMP
    RETURNING counter_id INTO v_counter_id;
    
    RETURN v_counter_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Update counter position
CREATE OR REPLACE FUNCTION fn_update_counter_position(
    p_tape_id BIGINT,
    p_counter_value INTEGER
)
RETURNS void AS $$
BEGIN
    UPDATE insp_video_counters
    SET current_counter_value = p_counter_value,
        md_date = CURRENT_TIMESTAMP
    WHERE tape_id = p_tape_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Stop video counter
CREATE OR REPLACE FUNCTION fn_stop_video_counter(
    p_tape_id BIGINT
)
RETURNS INTEGER AS $$
DECLARE
    v_final_value INTEGER;
BEGIN
    UPDATE insp_video_counters
    SET is_running = FALSE,
        stopped_at = CURRENT_TIMESTAMP,
        md_date = CURRENT_TIMESTAMP
    WHERE tape_id = p_tape_id
    RETURNING current_counter_value INTO v_final_value;
    
    RETURN v_final_value;
END;
$$ LANGUAGE plpgsql;

-- Function: Format counter value
CREATE OR REPLACE FUNCTION fn_format_counter(
    p_counter_value INTEGER,
    p_format VARCHAR DEFAULT 'HH:MM:SS'
)
RETURNS VARCHAR AS $$
DECLARE
    v_hours INTEGER;
    v_minutes INTEGER;
    v_seconds INTEGER;
BEGIN
    IF p_format = 'HH:MM:SS' THEN
        v_hours := p_counter_value / 3600;
        v_minutes := (p_counter_value % 3600) / 60;
        v_seconds := p_counter_value % 60;
        
        RETURN LPAD(v_hours::TEXT, 2, '0') || ':' ||
               LPAD(v_minutes::TEXT, 2, '0') || ':' ||
               LPAD(v_seconds::TEXT, 2, '0');
    ELSE
        RETURN LPAD(p_counter_value::TEXT, 8, '0');
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. TRIGGERS FOR AI LEARNING
-- ============================================================================

-- Trigger: Learn from dive job creation
CREATE OR REPLACE FUNCTION trg_learn_from_dive_job()
RETURNS TRIGGER AS $$
BEGIN
    -- Learn numbering pattern
    PERFORM fn_learn_numbering_pattern(
        NEW.cr_user,
        'DIVE_NO',
        NEW.dive_no
    );
    
    -- Learn personnel assignment
    PERFORM fn_learn_personnel_assignment(
        NEW.cr_user,
        NEW.structure_id,
        'DIVING',
        NEW.diver_name,
        NEW.dive_supervisor,
        NEW.report_coordinator
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dive_job_ai_learning
    AFTER INSERT ON insp_dive_jobs
    FOR EACH ROW
    EXECUTE FUNCTION trg_learn_from_dive_job();

-- Trigger: Learn from ROV job creation
CREATE OR REPLACE FUNCTION trg_learn_from_rov_job()
RETURNS TRIGGER AS $$
BEGIN
    -- Learn numbering pattern
    PERFORM fn_learn_numbering_pattern(
        NEW.cr_user,
        'DEPLOYMENT_NO',
        NEW.deployment_no
    );
    
    -- Learn personnel assignment
    PERFORM fn_learn_personnel_assignment(
        NEW.cr_user,
        NEW.structure_id,
        'ROV',
        NEW.rov_operator,
        NEW.rov_supervisor,
        NEW.report_coordinator
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rov_job_ai_learning
    AFTER INSERT ON insp_rov_jobs
    FOR EACH ROW
    EXECUTE FUNCTION trg_learn_from_rov_job();

-- Trigger: Learn from inspection text
CREATE OR REPLACE FUNCTION trg_learn_from_inspection()
RETURNS TRIGGER AS $$
BEGIN
    -- Learn from remarks field
    IF NEW.inspection_data ? 'remarks' AND 
       LENGTH(NEW.inspection_data->>'remarks') >= 5 THEN
        PERFORM fn_learn_text_pattern(
            NEW.inspection_type_code,
            NEW.component_type,
            'remarks',
            NEW.inspection_data->>'remarks'
        );
    END IF;
    
    -- Learn from other text fields
    IF NEW.inspection_data ? 'defect_description' THEN
        PERFORM fn_learn_text_pattern(
            NEW.inspection_type_code,
            NEW.component_type,
            'defect_description',
            NEW.inspection_data->>'defect_description'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inspection_text_learning
    AFTER INSERT OR UPDATE ON insp_records
    FOR EACH ROW
    WHEN (NEW.status IN ('COMPLETED', 'REVIEWED', 'APPROVED'))
    EXECUTE FUNCTION trg_learn_from_inspection();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE insp_numbering_patterns IS 'AI learning table for dive/ROV numbering patterns';
COMMENT ON TABLE insp_personnel_history IS 'Track personnel assignments for auto-suggestion';
COMMENT ON TABLE insp_text_patterns IS 'Learned text patterns for auto-completion';
COMMENT ON TABLE insp_video_counters IS 'Virtual tape counter state for video recordings';
COMMENT ON MATERIALIZED VIEW vw_component_inspection_history IS 'Component historical inspection data for quick access';

-- ============================================================================
-- END OF AI ENHANCEMENTS
-- ============================================================================
