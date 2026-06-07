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
            LOWER(TRIM(COALESCE(elem->>'label', ''))) NOT IN ('inspection task', 'inspection_task', 'event id', 'event_id', 'component type', 'component_type', 'component q-id', 'component_qid', 'supervisor', 'rep. cord. (rc)', 'rep. cord.', 'rep_cord', 'pilot', 'dive no', 'dive_no', 'tape no', 'tape_no', 'counter no', 'counter_no', 'defect?', 'defect', 'incomplete', 'description', 'comments', 'elevation', 'fp', 'kp', 'fp_kp', 'kilometer_post')
            AND LOWER(TRIM(COALESCE(elem->>'name', ''))) NOT IN ('inspection task', 'inspection_task', 'event id', 'event_id', 'component type', 'component_type', 'component q-id', 'component_qid', 'supervisor', 'rep. cord. (rc)', 'rep. cord.', 'rep_cord', 'pilot', 'dive no', 'dive_no', 'tape no', 'tape_no', 'counter no', 'counter_no', 'defect?', 'defect', 'incomplete', 'description', 'comments', 'elevation', 'fp', 'kp', 'fp_kp', 'kilometer_post')
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

-- 10. ADD Northing and Easting to ALL ROV Types
UPDATE inspection_type
SET default_properties = jsonb_build_object(
    'fields',
    COALESCE((
        SELECT jsonb_agg(new_elem)
        FROM (
            SELECT jsonb_build_object('name', 'northing', 'label', 'Northing', 'type', 'text') as new_elem
            UNION ALL
            SELECT jsonb_build_object('name', 'easting', 'label', 'Easting', 'type', 'text')
            UNION ALL
            SELECT elem
            FROM jsonb_array_elements(
                CASE 
                    WHEN jsonb_typeof(default_properties) = 'object' THEN default_properties->'fields'
                    ELSE default_properties
                END
            ) as elem
            WHERE 
                LOWER(TRIM(COALESCE(elem->>'label', ''))) NOT IN ('northing', 'easting', 'elevation', 'depth', 'fp', 'kp', 'fp_kp', 'kilometer_post')
                AND LOWER(TRIM(COALESCE(elem->>'name', ''))) NOT IN ('northing', 'easting', 'elevation', 'depth', 'fp', 'kp', 'fp_kp', 'kilometer_post')
        ) sub
    ), '[]'::jsonb)
)
WHERE (UPPER(code) LIKE 'R%' OR UPPER(name) LIKE '%ROV%' OR COALESCE(metadata->>'rov', '0') = '1');

-- 11. RUTWT specific additions (Nominal Thickness, Location, Position)
UPDATE inspection_type
SET default_properties = jsonb_build_object(
    'fields',
    COALESCE((
        SELECT jsonb_agg(elem)
        FROM (
            SELECT elem
            FROM jsonb_array_elements(
                CASE 
                    WHEN jsonb_typeof(default_properties) = 'object' THEN default_properties->'fields'
                    ELSE default_properties
                END
            ) as elem
            WHERE (
                LOWER(TRIM(COALESCE(elem->>'label', ''))) NOT IN ('nominal thickness', 'location', 'position', 'cp readings', 'ut thickness')
                AND LOWER(TRIM(COALESCE(elem->>'name', ''))) NOT IN ('nominal_thickness', 'location', 'position', 'cp_readings', 'ut_readings')
            )
            UNION ALL
            SELECT jsonb_build_object('name', 'nominal_thickness', 'label', 'Nominal Thickness', 'type', 'number')
            UNION ALL
            SELECT jsonb_build_object('name', 'location', 'label', 'Location', 'type', 'select', 'options', jsonb_build_array())
            UNION ALL
            SELECT jsonb_build_object('name', 'position', 'label', 'Position', 'type', 'select', 'options', jsonb_build_array('AT 3 O''CLK', 'AT 6 O''CLK', 'AT 9 O''CLK', 'AT 12 O''CLK'))
            UNION ALL
            SELECT '{
                "name": "cp_readings",
                "label": "CP Additional Readings",
                "type": "repeater",
                "subFields": [
                    { "name": "reading", "label": "CP Rdg (mV)", "type": "number", "step": "0.01" },
                    { "name": "location", "label": "Location", "type": "text" }
                ]
            }'::jsonb
            UNION ALL
            SELECT '{
                "name": "ut_readings",
                "label": "UT Additional Readings",
                "type": "repeater",
                "subFields": [
                    { "name": "reading", "label": "Thickness (mm)", "type": "number", "step": "0.01" },
                    { "name": "location", "label": "Location", "type": "text" }
                ]
            }'::jsonb
        ) sub
    ), '[]'::jsonb)
)
WHERE UPPER(code) LIKE '%RUTWT%' OR UPPER(name) LIKE '%RUTWT%';


