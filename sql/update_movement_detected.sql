-- SQL Script to add movement_detected field to ROV inspection types
-- This field enables standardized offshore anomaly tracking

UPDATE inspection_type
SET default_properties = jsonb_set(
    default_properties,
    '{fields}',
    (
        SELECT jsonb_agg(elem)
        FROM (
            SELECT elem
            FROM jsonb_array_elements(
                CASE 
                    WHEN jsonb_typeof(default_properties) = 'object' THEN default_properties->'fields'
                    ELSE default_properties
                END
            ) as elem
            WHERE LOWER(TRIM(COALESCE(elem->>'name', ''))) != 'movement_detected'
            UNION ALL
            SELECT '{"name": "movement_detected", "label": "Movement Detected", "type": "boolean", "default": false}'::jsonb
        ) sub
    )
)
WHERE (UPPER(code) LIKE 'R%' OR UPPER(name) LIKE '%ROV%' OR COALESCE(metadata->>'rov', '0') = '1');
