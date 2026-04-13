-- update_debris_material_fields.sql
-- Injects debris_material into inspection_type where debris is enabled

UPDATE inspection_type
SET default_properties = 
    CASE 
        -- Case 1: default_properties is an object with a 'fields' key
        WHEN jsonb_typeof(default_properties) = 'object' AND default_properties ? 'fields' THEN
            jsonb_set(
                default_properties,
                '{fields}',
                (
                    SELECT jsonb_agg(sub.f)
                    FROM (
                        SELECT x.f FROM jsonb_array_elements(default_properties->'fields') AS x(f)
                        UNION ALL
                        SELECT '{"name": "debris_material", "label": "Material Type", "type": "select", "lib_code": "DBMAT_TYP"}'::jsonb
                        WHERE NOT EXISTS (
                            SELECT 1 FROM jsonb_array_elements(default_properties->'fields') AS y(f) 
                            WHERE y.f->>'name' = 'debris_material'
                        )
                        AND EXISTS (
                            SELECT 1 FROM jsonb_array_elements(default_properties->'fields') AS z(f) 
                            WHERE z.f->>'name' ILIKE '%debris%' OR z.f->>'label' ILIKE '%debris%'
                        )
                    ) sub
                )
            )
        -- Case 2: default_properties is the array itself
        WHEN jsonb_typeof(default_properties) = 'array' THEN
            (
                SELECT jsonb_agg(sub.f)
                FROM (
                    SELECT x.f FROM jsonb_array_elements(default_properties) AS x(f)
                    UNION ALL
                    SELECT '{"name": "debris_material", "label": "Material Type", "type": "select", "lib_code": "DBMAT_TYP"}'::jsonb
                    WHERE NOT EXISTS (
                        SELECT 1 FROM jsonb_array_elements(default_properties) AS y(f) 
                        WHERE y.f->>'name' = 'debris_material'
                    )
                    AND EXISTS (
                        SELECT 1 FROM jsonb_array_elements(default_properties) AS z(f) 
                        WHERE z.f->>'name' ILIKE '%debris%' OR z.f->>'label' ILIKE '%debris%'
                    )
                ) sub
            )
        ELSE default_properties
    END
WHERE default_properties::text ILIKE '%debris%';
