-- SQL Script to append CP Readings and UT Thickness repeater fields to all ROV and Diving inspection types
-- This uses the new `repeater` type field supported by the UI
-- Written as an explicit UPDATE statement to ensure row counts show up in DBeaver natively.

WITH new_fields AS (
    SELECT 
        '{
            "name": "cp_readings",
            "label": "CP Readings",
            "type": "repeater",
            "subFields": [
                { "name": "reading", "label": "CP Rdg (mV)", "type": "number", "step": "0.01" },
                { "name": "location", "label": "Location", "type": "text" }
            ]
        }'::jsonb as cp_field,
        '{
            "name": "ut_readings",
            "label": "UT Thickness",
            "type": "repeater",
            "subFields": [
                { "name": "reading", "label": "Thickness (mm)", "type": "number", "step": "0.01" },
                { "name": "location", "label": "Location", "type": "text" }
            ]
        }'::jsonb as ut_field
),
parsed_data AS (
    SELECT 
        it.id,
        it.code,
        it.default_properties,
        CASE 
            WHEN jsonb_typeof(it.default_properties) = 'object' THEN COALESCE(it.default_properties->'fields', '[]'::jsonb)
            WHEN jsonb_typeof(it.default_properties) = 'array' THEN it.default_properties
            ELSE '[]'::jsonb
        END as arr_data
    FROM inspection_type it
    WHERE (
        COALESCE(it.metadata->>'rov', '0') = '1' 
        OR COALESCE(it.metadata->>'diving', '0') = '1'
        OR UPPER(TRIM(COALESCE(it.code,''))) LIKE 'R%'
        OR UPPER(TRIM(COALESCE(it.code,''))) LIKE 'D%'
        OR UPPER(TRIM(COALESCE(it.name,''))) LIKE '%ROV%'
        OR UPPER(TRIM(COALESCE(it.name,''))) LIKE '%DIVING%'
    )
),
filtered_data AS (
    SELECT 
        pd.id,
        COALESCE(
            (SELECT jsonb_agg(elem) 
             FROM jsonb_array_elements(pd.arr_data) elem 
             WHERE elem->>'name' NOT IN ('cp_readings', 'ut_readings')
            ), 
            '[]'::jsonb
        ) as filtered_arr
    FROM parsed_data pd
)
UPDATE inspection_type t
SET default_properties = CASE 
        WHEN jsonb_typeof(t.default_properties) = 'object' THEN jsonb_set(t.default_properties, '{fields}', fd.filtered_arr || (SELECT cp_field FROM new_fields) || (SELECT ut_field FROM new_fields))
        ELSE fd.filtered_arr || (SELECT cp_field FROM new_fields) || (SELECT ut_field FROM new_fields)
    END
FROM filtered_data fd
WHERE t.id = fd.id
  -- Avoid infinite updates if they already appended correctly
  AND t.default_properties::jsonb != (
      CASE 
        WHEN jsonb_typeof(t.default_properties) = 'object' THEN jsonb_set(t.default_properties, '{fields}', fd.filtered_arr || (SELECT cp_field FROM new_fields) || (SELECT ut_field FROM new_fields))
        ELSE fd.filtered_arr || (SELECT cp_field FROM new_fields) || (SELECT ut_field FROM new_fields)
      END
  )::jsonb
RETURNING t.code, t.name, t.default_properties as final_properties;
