-- SQL Script to remove redundant fields from ROV inspection specifications
-- Written as specific UPDATE statements that provide distinct outputs on execution.

-- 1. COMMON FIELDS removal for ALL ROV Types
UPDATE inspection_type
SET default_properties = jsonb_build_object(
    'fields', 
    COALESCE((
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(default_properties) = 'object' THEN default_properties->'fields'
                ELSE default_properties
            END
        ) as elem
        WHERE 
            LOWER(TRIM(COALESCE(elem->>'label', ''))) NOT IN ('inspection task', 'inspection_task', 'event id', 'event_id', 'component type', 'component_type', 'component q-id', 'component_qid', 'supervisor', 'rep. cord. (rc)', 'rep. cord.', 'rep_cord', 'pilot', 'dive no', 'dive_no', 'tape no', 'tape_no', 'counter no', 'counter_no', 'defect?', 'defect', 'incomplete', 'description', 'comments')
            AND LOWER(TRIM(COALESCE(elem->>'name', ''))) NOT IN ('inspection task', 'inspection_task', 'event id', 'event_id', 'component type', 'component_type', 'component q-id', 'component_qid', 'supervisor', 'rep. cord. (rc)', 'rep. cord.', 'rep_cord', 'pilot', 'dive no', 'dive_no', 'tape no', 'tape_no', 'counter no', 'counter_no', 'defect?', 'defect', 'incomplete', 'description', 'comments')
    ), '[]'::jsonb)
)
WHERE default_properties IS NOT NULL
  AND default_properties::text != '{}'
  AND (UPPER(code) LIKE 'R%' OR UPPER(name) LIKE '%ROV%' OR COALESCE(metadata->>'rov', '0') = '1');

-- 2. RMGI specific removals
UPDATE inspection_type
SET default_properties = jsonb_build_object(
    'fields', 
    COALESCE((
        SELECT jsonb_agg(elem) FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(default_properties) = 'object' THEN default_properties->'fields' ELSE default_properties END
        ) as elem
        WHERE 
            LOWER(TRIM(COALESCE(elem->>'label', ''))) NOT IN ('cp rdg', 'cp rdg (mv)', 'cp_rdg', 'debris', 'component condition', 'component_condition', 'coating condition', 'coating_condition')
            AND LOWER(TRIM(COALESCE(elem->>'name', ''))) NOT IN ('cp rdg', 'cp rdg (mv)', 'cp_rdg', 'debris', 'component condition', 'component_condition', 'coating condition', 'coating_condition')
    ), '[]'::jsonb)
)
WHERE UPPER(code) LIKE '%RMGI%' OR UPPER(name) LIKE '%RMGI%';

-- 3. RSCOR specific removals
UPDATE inspection_type
SET default_properties = jsonb_build_object(
    'fields', 
    COALESCE((
        SELECT jsonb_agg(elem) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(default_properties) = 'object' THEN default_properties->'fields' ELSE default_properties END) as elem
        WHERE LOWER(TRIM(COALESCE(elem->>'label', ''))) NOT IN ('debris', 'component condition', 'component_condition', 'coating condition', 'coating_condition', 'marine growth', 'marine_growth')
          AND LOWER(TRIM(COALESCE(elem->>'name', ''))) NOT IN ('debris', 'component condition', 'component_condition', 'coating condition', 'coating_condition', 'marine growth', 'marine_growth')
    ), '[]'::jsonb)
)
WHERE UPPER(code) LIKE '%RSCOR%' OR UPPER(name) LIKE '%RSCOR%';

-- 4. RSANI specific removals
UPDATE inspection_type
SET default_properties = jsonb_build_object('fields', COALESCE((SELECT jsonb_agg(elem) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(default_properties) = 'object' THEN default_properties->'fields' ELSE default_properties END) as elem
        WHERE LOWER(TRIM(COALESCE(elem->>'label', ''))) NOT IN ('debris', 'component condition', 'component_condition', 'coating condition', 'coating_condition')
          AND LOWER(TRIM(COALESCE(elem->>'name', ''))) NOT IN ('debris', 'component condition', 'component_condition', 'coating condition', 'coating_condition')
    ), '[]'::jsonb))
WHERE UPPER(code) LIKE '%RSANI%' OR UPPER(name) LIKE '%RSANI%';

-- 5. RSEAB specific removals
UPDATE inspection_type
SET default_properties = jsonb_build_object('fields', COALESCE((SELECT jsonb_agg(elem) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(default_properties) = 'object' THEN default_properties->'fields' ELSE default_properties END) as elem
        WHERE LOWER(TRIM(COALESCE(elem->>'label', ''))) NOT IN ('cp rdg', 'cp rdg (mv)', 'cp_rdg', 'component condition', 'component_condition', 'coating condition', 'coating_condition', 'marine growth', 'marine_growth')
          AND LOWER(TRIM(COALESCE(elem->>'name', ''))) NOT IN ('cp rdg', 'cp rdg (mv)', 'cp_rdg', 'component condition', 'component_condition', 'coating condition', 'coating_condition', 'marine growth', 'marine_growth')
    ), '[]'::jsonb))
WHERE UPPER(code) LIKE '%RSEAB%' OR UPPER(name) LIKE '%RSEAB%';

-- 6. RSWNI specific removals
UPDATE inspection_type
SET default_properties = jsonb_build_object('fields', COALESCE((SELECT jsonb_agg(elem) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(default_properties) = 'object' THEN default_properties->'fields' ELSE default_properties END) as elem
        WHERE LOWER(TRIM(COALESCE(elem->>'label', ''))) NOT IN ('debris', 'component condition', 'component_condition', 'coating condition', 'coating_condition')
          AND LOWER(TRIM(COALESCE(elem->>'name', ''))) NOT IN ('debris', 'component condition', 'component_condition', 'coating condition', 'coating_condition')
    ), '[]'::jsonb))
WHERE UPPER(code) LIKE '%RSWNI%' OR UPPER(name) LIKE '%RSWNI%';

-- 7. RSZCI specific removals
UPDATE inspection_type
SET default_properties = jsonb_build_object('fields', COALESCE((SELECT jsonb_agg(elem) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(default_properties) = 'object' THEN default_properties->'fields' ELSE default_properties END) as elem
        WHERE LOWER(TRIM(COALESCE(elem->>'label', ''))) NOT IN ('debris') AND LOWER(TRIM(COALESCE(elem->>'name', ''))) NOT IN ('debris')
    ), '[]'::jsonb))
WHERE UPPER(code) LIKE '%RSZCI%' OR UPPER(name) LIKE '%RSZCI%';

-- 8. RUTWT specific removals
UPDATE inspection_type
SET default_properties = jsonb_build_object('fields', COALESCE((SELECT jsonb_agg(elem) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(default_properties) = 'object' THEN default_properties->'fields' ELSE default_properties END) as elem
        WHERE LOWER(TRIM(COALESCE(elem->>'label', ''))) NOT IN ('debris', 'component condition', 'component_condition', 'coating condition', 'coating_condition', 'marine growth', 'marine_growth')
          AND LOWER(TRIM(COALESCE(elem->>'name', ''))) NOT IN ('debris', 'component condition', 'component_condition', 'coating condition', 'coating_condition', 'marine growth', 'marine_growth')
    ), '[]'::jsonb))
WHERE UPPER(code) LIKE '%RUTWT%' OR UPPER(name) LIKE '%RUTWT%';

-- 9. RFMD specific removals
UPDATE inspection_type
SET default_properties = jsonb_build_object('fields', COALESCE((SELECT jsonb_agg(elem) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(default_properties) = 'object' THEN default_properties->'fields' ELSE default_properties END) as elem
        WHERE LOWER(TRIM(COALESCE(elem->>'label', ''))) NOT IN ('debris', 'cp rdg', 'cp rdg (mv)', 'cp_rdg', 'coating condition', 'coating_condition', 'marine growth', 'marine_growth')
          AND LOWER(TRIM(COALESCE(elem->>'name', ''))) NOT IN ('debris', 'cp rdg', 'cp rdg (mv)', 'cp_rdg', 'coating condition', 'coating_condition', 'marine growth', 'marine_growth')
    ), '[]'::jsonb))
WHERE UPPER(code) LIKE '%RFMD%' OR UPPER(name) LIKE '%RFMD%';
