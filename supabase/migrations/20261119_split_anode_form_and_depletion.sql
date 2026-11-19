-- ============================================================================
-- SQL Migration & Data Correction Script:
-- Split combined "Anode Depletion" (e.g. "Bar: 0 - 25% Depletion") into:
--   1. anode_form       ("Bar", "Bracelet", "Collar", "Sled")
--   2. anode_depletion / anode_depletion_percent
--      ("0 - 25%", "25 - 50%", "50 - 75%", "75 - 100%", "Unable to Estimate")
--
-- Covers:
--   Part 1: Update public.inspection_type (both ROV: RGVI, RSANI & Diving: PL_AN)
--   Part 2: Migrate & clean all existing records in public.insp_records
-- ============================================================================

-- ============================================================================
-- PART 1: Update public.inspection_type (default_properties) for ROV & Diving
-- ============================================================================
DO $$
DECLARE
    v_row RECORD;
    v_props JSONB;
    v_fields JSONB;
    v_new_fields JSONB;
    v_overrides JSONB;
    v_new_overrides JSONB;
    v_ov JSONB;
    v_ov_fields JSONB;
    v_new_ov_fields JSONB;
    v_f JSONB;
    v_has_form BOOLEAN;
    v_anode_form_field JSONB := '{
        "name": "anode_form",
        "label": "Anode Form",
        "type": "combo",
        "options": ["Bar", "Bracelet", "Collar", "Sled"],
        "required": false
    }'::JSONB;
    v_depl_options JSONB := '["0 - 25%", "25 - 50%", "50 - 75%", "75 - 100%", "Unable to Estimate"]'::JSONB;
    v_updated_types INTEGER := 0;
BEGIN
    FOR v_row IN
        SELECT id, code, default_properties
        FROM public.inspection_type
        WHERE UPPER(TRIM(COALESCE(code, ''))) IN ('PL_AN', 'RGVI', 'RSANI')
    LOOP
        v_props := COALESCE(v_row.default_properties, '{}'::JSONB);

        -- Case A: default_properties is an object containing "fields" and/or "component_overrides"
        IF jsonb_typeof(v_props) = 'object' THEN
            -- A1. Update top-level "fields" array (PL_AN, RSANI)
            IF jsonb_typeof(v_props->'fields') = 'array' THEN
                v_fields := v_props->'fields';
                v_has_form := EXISTS (
                    SELECT 1 FROM jsonb_array_elements(v_fields) elem
                    WHERE elem->>'name' = 'anode_form'
                );
                v_new_fields := '[]'::JSONB;

                FOR v_f IN SELECT value FROM jsonb_array_elements(v_fields)
                LOOP
                    IF v_f->>'name' IN ('anode_depletion', 'anode_depletion_percent') THEN
                        IF NOT v_has_form THEN
                            v_new_fields := v_new_fields || jsonb_build_array(v_anode_form_field);
                            v_has_form := TRUE;
                        END IF;
                        v_new_fields := v_new_fields || jsonb_build_array(
                            (v_f - 'lib_code') || jsonb_build_object(
                                'label', 'Anode Depletion',
                                'type', 'combo',
                                'options', v_depl_options
                            )
                        );
                    ELSE
                        v_new_fields := v_new_fields || jsonb_build_array(v_f);
                    END IF;
                END LOOP;

                v_props := jsonb_set(v_props, '{fields}', v_new_fields, TRUE);
            END IF;

            -- A2. Update "component_overrides" (RGVI -> component_types containing "AN")
            IF jsonb_typeof(v_props->'component_overrides') = 'array' THEN
                v_overrides := v_props->'component_overrides';
                v_new_overrides := '[]'::JSONB;

                FOR v_ov IN SELECT value FROM jsonb_array_elements(v_overrides)
                LOOP
                    IF jsonb_typeof(v_ov->'fields') = 'array' THEN
                        v_ov_fields := v_ov->'fields';
                        v_has_form := EXISTS (
                            SELECT 1 FROM jsonb_array_elements(v_ov_fields) elem
                            WHERE elem->>'name' = 'anode_form'
                        );
                        v_new_ov_fields := '[]'::JSONB;

                        FOR v_f IN SELECT value FROM jsonb_array_elements(v_ov_fields)
                        LOOP
                            IF v_f->>'name' IN ('anode_depletion', 'anode_depletion_percent') THEN
                                IF NOT v_has_form THEN
                                    v_new_ov_fields := v_new_ov_fields || jsonb_build_array(v_anode_form_field);
                                    v_has_form := TRUE;
                                END IF;
                                v_new_ov_fields := v_new_ov_fields || jsonb_build_array(
                                    (v_f - 'lib_code') || jsonb_build_object(
                                        'label', 'Anode Depletion',
                                        'type', 'combo',
                                        'options', v_depl_options
                                    )
                                );
                            ELSE
                                v_new_ov_fields := v_new_ov_fields || jsonb_build_array(v_f);
                            END IF;
                        END LOOP;

                        v_ov := jsonb_set(v_ov, '{fields}', v_new_ov_fields, TRUE);
                    END IF;
                    v_new_overrides := v_new_overrides || jsonb_build_array(v_ov);
                END LOOP;

                v_props := jsonb_set(v_props, '{component_overrides}', v_new_overrides, TRUE);
            END IF;

        -- Case B: Legacy bare-array default_properties
        ELSIF jsonb_typeof(v_props) = 'array' THEN
            v_has_form := EXISTS (
                SELECT 1 FROM jsonb_array_elements(v_props) elem
                WHERE elem->>'name' = 'anode_form'
            );
            v_new_fields := '[]'::JSONB;

            FOR v_f IN SELECT value FROM jsonb_array_elements(v_props)
            LOOP
                IF v_f->>'name' IN ('anode_depletion', 'anode_depletion_percent') THEN
                    IF NOT v_has_form THEN
                        v_new_fields := v_new_fields || jsonb_build_array(v_anode_form_field);
                        v_has_form := TRUE;
                    END IF;
                    v_new_fields := v_new_fields || jsonb_build_array(
                        (v_f - 'lib_code') || jsonb_build_object(
                            'label', 'Anode Depletion',
                            'type', 'combo',
                            'options', v_depl_options
                        )
                    );
                ELSE
                    v_new_fields := v_new_fields || jsonb_build_array(v_f);
                END IF;
            END LOOP;

            v_props := v_new_fields;
        END IF;

        UPDATE public.inspection_type
        SET default_properties = v_props
        WHERE id = v_row.id;

        v_updated_types := v_updated_types + 1;
    END LOOP;

    RAISE NOTICE 'Part 1 complete: updated % inspection_type row(s) (PL_AN, RGVI, RSANI).', v_updated_types;
END $$;


-- ============================================================================
-- PART 2: Migrate & Clean Existing Data in public.insp_records
-- Splits combined strings like "Bar: 0 - 25% Depletion" into:
--   inspection_data.anode_form = "Bar"
--   inspection_data.<depletion_key> = "0 - 25%"
-- Safe & idempotent: can be re-run without corrupting already-migrated rows.
-- ============================================================================
DO $$
DECLARE
    v_rec RECORD;
    v_data JSONB;
    v_key TEXT;
    v_raw TEXT;
    v_lower TEXT;
    v_detected_form TEXT;
    v_clean_depl TEXT;
    v_changed BOOLEAN;
    v_updated_records INTEGER := 0;
BEGIN
    FOR v_rec IN
        SELECT insp_id, inspection_data
        FROM public.insp_records
        WHERE inspection_data IS NOT NULL
          AND (
              inspection_data ? 'anode_depletion'
              OR inspection_data ? 'anode_depletion_percent'
              OR inspection_data ? 'depletion'
          )
    LOOP
        v_data := v_rec.inspection_data;
        v_changed := FALSE;
        v_detected_form := NULL;

        FOREACH v_key IN ARRAY ARRAY['anode_depletion', 'anode_depletion_percent', 'depletion']
        LOOP
            IF v_data ? v_key AND v_data->>v_key IS NOT NULL AND TRIM(v_data->>v_key) <> '' THEN
                v_raw := TRIM(v_data->>v_key);
                v_lower := LOWER(v_raw);

                -- 1. Extract Anode Form if embedded in the depletion string
                IF v_lower ~ '^bar\s*[:\-]' OR v_lower ~ '^bar\s+' THEN
                    v_detected_form := COALESCE(v_detected_form, 'Bar');
                ELSIF v_lower ~ '^bracelet\s*[:\-]' OR v_lower ~ '^bracelet\s+' THEN
                    v_detected_form := COALESCE(v_detected_form, 'Bracelet');
                ELSIF v_lower ~ '^collar\s*[:\-]' OR v_lower ~ '^collar\s+' THEN
                    v_detected_form := COALESCE(v_detected_form, 'Collar');
                ELSIF v_lower ~ '^sled\s*[:\-]' OR v_lower ~ '^sled\s+' THEN
                    v_detected_form := COALESCE(v_detected_form, 'Sled');
                END IF;

                -- 2. Strip leading form prefix ("Bar:", "Bracelet -", etc.) & trailing "Depletion"
                v_clean_depl := REGEXP_REPLACE(v_raw, '^(bar|bracelet|collar|sled)\s*[:\-]?\s*', '', 'i');
                v_clean_depl := REGEXP_REPLACE(v_clean_depl, '\s*depletion\s*$', '', 'i');
                v_clean_depl := TRIM(v_clean_depl);

                -- 3. Normalize standard depletion bucket labels
                IF LOWER(v_clean_depl) ~ '^0\s*[-–]\s*25\s*%?$' THEN
                    v_clean_depl := '0 - 25%';
                ELSIF LOWER(v_clean_depl) ~ '^(25|26)\s*[-–]\s*50\s*%?$' THEN
                    v_clean_depl := '25 - 50%';
                ELSIF LOWER(v_clean_depl) ~ '^(50|51)\s*[-–]\s*75\s*%?$' THEN
                    v_clean_depl := '50 - 75%';
                ELSIF LOWER(v_clean_depl) ~ '^(75|76)\s*[-–]\s*100\s*%?$' THEN
                    v_clean_depl := '75 - 100%';
                ELSIF LOWER(v_clean_depl) LIKE '%unable to estimate%' THEN
                    v_clean_depl := 'Unable to Estimate';
                END IF;

                IF v_clean_depl <> '' AND v_clean_depl <> v_raw THEN
                    v_data := jsonb_set(v_data, ARRAY[v_key], to_jsonb(v_clean_depl), TRUE);
                    v_changed := TRUE;
                END IF;
            END IF;
        END LOOP;

        -- Set anode_form if detected and not already populated
        IF v_detected_form IS NOT NULL
           AND (NOT (v_data ? 'anode_form') OR COALESCE(TRIM(v_data->>'anode_form'), '') = '') THEN
            v_data := jsonb_set(v_data, '{anode_form}', to_jsonb(v_detected_form), TRUE);
            v_changed := TRUE;
        END IF;

        IF v_changed THEN
            UPDATE public.insp_records
            SET inspection_data = v_data
            WHERE insp_id = v_rec.insp_id;
            v_updated_records := v_updated_records + 1;
        END IF;
    END LOOP;

    RAISE NOTICE 'Part 2 complete: migrated & cleaned % insp_records row(s).', v_updated_records;
END $$;

-- ============================================================================
-- PART 3: Backfill anode_form on already-migrated Diving (PL_AN) & ROV Anodes
--   - ROV (RGVI on AN / RSANI): detect form from description/findings if missing
--   - Diving (PL_AN): detect form from description/findings, default to 'Bar'
-- ============================================================================
DO $$
DECLARE
    v_rec RECORD;
    v_text TEXT;
    v_form TEXT;
    v_updated INTEGER := 0;
BEGIN
    FOR v_rec IN
        SELECT r.insp_id, r.inspection_type_code, r.description, r.inspection_data, sc.code AS comp_code
        FROM public.insp_records r
        LEFT JOIN public.structure_components sc ON sc.id = r.component_id
        WHERE r.inspection_data IS NOT NULL
          AND COALESCE(TRIM(r.inspection_data->>'anode_form'), '') = ''
          AND (
              UPPER(TRIM(COALESCE(r.inspection_type_code, ''))) IN ('PL_AN', 'RSANI', 'SANI')
              OR (UPPER(TRIM(COALESCE(r.inspection_type_code, ''))) = 'RGVI' AND UPPER(TRIM(COALESCE(sc.code, r.component_type, ''))) = 'AN')
          )
    LOOP
        v_text := LOWER(CONCAT_WS(' ', v_rec.description, v_rec.inspection_data->>'findings', v_rec.inspection_data->>'finding'));
        v_form := NULL;

        IF v_text LIKE '%bracelet%' THEN
            v_form := 'Bracelet';
        ELSIF v_text LIKE '%collar%' THEN
            v_form := 'Collar';
        ELSIF v_text LIKE '%sled%' THEN
            v_form := 'Sled';
        ELSIF v_text ~ '\mbar\M' THEN
            v_form := 'Bar';
        END IF;

        -- Diving PL_AN defaults to 'Bar' if not specified
        IF v_form IS NULL AND UPPER(TRIM(COALESCE(v_rec.inspection_type_code, ''))) = 'PL_AN' THEN
            v_form := 'Bar';
        END IF;

        IF v_form IS NOT NULL THEN
            UPDATE public.insp_records
            SET inspection_data = jsonb_set(inspection_data, '{anode_form}', to_jsonb(v_form), TRUE)
            WHERE insp_id = v_rec.insp_id;
            v_updated := v_updated + 1;
        END IF;
    END LOOP;

    RAISE NOTICE 'Part 3 complete: backfilled anode_form on % ROV/Diving anode record(s).', v_updated;
END $$;

-- Verification query (uncomment to preview migrated data):
-- SELECT insp_id, inspection_type_code,
--        inspection_data->>'anode_form' AS anode_form,
--        COALESCE(inspection_data->>'anode_depletion', inspection_data->>'anode_depletion_percent') AS anode_depletion
-- FROM public.insp_records
-- WHERE inspection_data ? 'anode_form'
--    OR inspection_data ? 'anode_depletion'
--    OR inspection_data ? 'anode_depletion_percent'
-- ORDER BY insp_id DESC
-- LIMIT 50;
