-- ============================================================================
-- SQL Migration: Anode (AN) Component Spec Historical Archiving,
--                Manual & ANMAIN Replacement, Pre/Post CP Reading Isolation,
--                and Atomic Wrong-QID Rollback & Reassignment
-- ============================================================================

-- 1. Safe date parsing helper (handles YYYY-MM-DD, YYYY, DD/MM/YYYY, or free text)
CREATE OR REPLACE FUNCTION public.fn_try_parse_date(p_val TEXT)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_clean TEXT;
BEGIN
    IF p_val IS NULL THEN
        RETURN NULL;
    END IF;
    v_clean := TRIM(p_val);
    IF v_clean = '' THEN
        RETURN NULL;
    END IF;

    -- ISO YYYY-MM-DD (or timestamp prefix)
    IF v_clean ~ '^\d{4}-\d{2}-\d{2}' THEN
        BEGIN
            RETURN SUBSTRING(v_clean FROM 1 FOR 10)::DATE;
        EXCEPTION WHEN OTHERS THEN
            RETURN NULL;
        END;
    END IF;

    -- Year only YYYY -> YYYY-01-01
    IF v_clean ~ '^\d{4}$' THEN
        BEGIN
            RETURN (v_clean || '-01-01')::DATE;
        EXCEPTION WHEN OTHERS THEN
            RETURN NULL;
        END;
    END IF;

    -- DD/MM/YYYY
    IF v_clean ~ '^\d{2}/\d{2}/\d{4}$' THEN
        BEGIN
            RETURN TO_DATE(v_clean, 'DD/MM/YYYY');
        EXCEPTION WHEN OTHERS THEN
            RETURN NULL;
        END;
    END IF;

    RETURN NULL;
END;
$$;

-- 2. Create anode_spec_history table (exclusively for code = 'AN' components)
CREATE TABLE IF NOT EXISTS public.anode_spec_history (
    id BIGSERIAL PRIMARY KEY,
    component_id BIGINT NOT NULL REFERENCES public.structure_components(id) ON DELETE CASCADE,
    structure_id BIGINT NOT NULL REFERENCES public.structure(str_id) ON DELETE CASCADE,
    q_id TEXT NOT NULL,
    generation_no INTEGER NOT NULL,
    replacement_source TEXT NOT NULL DEFAULT 'ANMAIN' CHECK (replacement_source IN ('ANMAIN', 'MANUAL')),
    replaced_by_jobpack_id BIGINT REFERENCES public.jobpack(id) ON DELETE SET NULL,
    replaced_by_jobpack_name TEXT,
    replaced_by_insp_id BIGINT REFERENCES public.insp_records(insp_id) ON DELETE SET NULL,
    effective_from DATE,
    effective_to DATE NOT NULL,
    -- Denormalized archived additionalInfo fields for fast querying & reporting
    anode_type TEXT,
    position TEXT,
    fitting TEXT,
    material TEXT,
    installed_type TEXT,
    inst_date TEXT,
    life TEXT,
    -- Full snapshot of structure_components.metadata prior to replacement (enables lossless rollback)
    spec_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
    remarks TEXT,
    -- User/client local timestamp & timezone (reflects user's local clock, not DB server location)
    replaced_at_local TEXT,
    client_timezone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT
);

ALTER TABLE public.anode_spec_history ADD COLUMN IF NOT EXISTS replaced_at_local TEXT;
ALTER TABLE public.anode_spec_history ADD COLUMN IF NOT EXISTS client_timezone TEXT;

CREATE INDEX IF NOT EXISTS idx_anode_spec_history_comp_gen
    ON public.anode_spec_history (component_id, generation_no DESC);

CREATE INDEX IF NOT EXISTS idx_anode_spec_history_struct_qid
    ON public.anode_spec_history (structure_id, q_id);

CREATE INDEX IF NOT EXISTS idx_anode_spec_history_jobpack
    ON public.anode_spec_history (replaced_by_jobpack_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_anode_spec_history_insp_unique
    ON public.anode_spec_history (replaced_by_insp_id)
    WHERE replaced_by_insp_id IS NOT NULL;

-- 3. Add anode_history_id column to insp_records
--    NULL  => reading belongs to the currently active anode (or non-anode component)
--    NOT NULL => reading belongs to that exact historical (replaced) anode generation
ALTER TABLE public.insp_records
    ADD COLUMN IF NOT EXISTS anode_history_id BIGINT REFERENCES public.anode_spec_history(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_insp_records_comp_anode_hist
    ON public.insp_records (component_id, anode_history_id);

-- 4. Enable RLS with standard authenticated/service access
ALTER TABLE public.anode_spec_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'anode_spec_history' AND policyname = 'anode_spec_history_all_authenticated'
    ) THEN
        CREATE POLICY anode_spec_history_all_authenticated
            ON public.anode_spec_history
            FOR ALL
            TO authenticated, service_role
            USING (TRUE)
            WITH CHECK (TRUE);
    END IF;
END $$;

GRANT ALL ON TABLE public.anode_spec_history TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.anode_spec_history_id_seq TO authenticated, service_role;

-- 5. Atomic RPC: Archive old Anode Spec & Apply New Spec (ANMAIN or MANUAL)
DROP FUNCTION IF EXISTS public.fn_replace_anode_spec(BIGINT, JSONB, DATE, BIGINT, TEXT, BIGINT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.fn_replace_anode_spec(
    p_component_id BIGINT,
    p_new_spec JSONB,
    p_replaced_date DATE DEFAULT CURRENT_DATE,
    p_jobpack_id BIGINT DEFAULT NULL,
    p_jobpack_name TEXT DEFAULT NULL,
    p_insp_id BIGINT DEFAULT NULL,
    p_source TEXT DEFAULT 'ANMAIN',
    p_remarks TEXT DEFAULT NULL,
    p_user TEXT DEFAULT NULL,
    p_client_timestamp TIMESTAMPTZ DEFAULT NULL,
    p_client_local_time TEXT DEFAULT NULL,
    p_client_timezone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_comp RECORD;
    v_existing_hist RECORD;
    v_max_gen INTEGER;
    v_next_gen INTEGER;
    v_hist_id BIGINT;
    v_old_meta JSONB;
    v_old_add JSONB;
    v_new_add JSONB;
    v_new_meta JSONB;
    v_jp_name TEXT;
    v_eff_from DATE;
    v_eff_to DATE;
    v_ts TIMESTAMPTZ;
    v_archived_count INTEGER := 0;
BEGIN
    v_ts := COALESCE(p_client_timestamp, NOW());

    -- Lock component row to prevent concurrent replacement races
    SELECT id, structure_id, q_id, code, metadata
    INTO v_comp
    FROM public.structure_components
    WHERE id = p_component_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Component % not found', p_component_id;
    END IF;

    IF UPPER(COALESCE(v_comp.code, '')) <> 'AN' THEN
        RAISE EXCEPTION 'Anode replacement history is only supported for Anode (AN) components (got %)', COALESCE(v_comp.code, 'NULL');
    END IF;

    v_eff_to := COALESCE(p_replaced_date, v_ts::DATE);

    -- Resolve jobpack name if not passed
    v_jp_name := p_jobpack_name;
    IF v_jp_name IS NULL AND p_jobpack_id IS NOT NULL THEN
        SELECT name INTO v_jp_name FROM public.jobpack WHERE id = p_jobpack_id;
    END IF;

    -- Build merged additionalInfo for the new active anode (safely handle stringified or null metadata)
    v_old_meta := CASE
        WHEN v_comp.metadata IS NULL THEN '{}'::JSONB
        WHEN jsonb_typeof(v_comp.metadata) = 'object' THEN v_comp.metadata
        WHEN jsonb_typeof(v_comp.metadata) = 'string' THEN
            CASE
                WHEN LEFT(TRIM(v_comp.metadata #>> '{}'), 1) = '{' THEN (v_comp.metadata #>> '{}')::JSONB
                ELSE '{}'::JSONB
            END
        ELSE '{}'::JSONB
    END;
    v_old_add := CASE
        WHEN jsonb_typeof(v_old_meta->'additionalInfo') = 'object' THEN v_old_meta->'additionalInfo'
        ELSE '{}'::JSONB
    END;

    v_new_add := v_old_add || jsonb_strip_nulls(jsonb_build_object(
        'thetype',  COALESCE(p_new_spec->>'thetype',  p_new_spec->>'anode_type'),
        'position', COALESCE(p_new_spec->>'position', NULL),
        'fitting',  COALESCE(p_new_spec->>'fitting',  NULL),
        'material', COALESCE(p_new_spec->>'material', p_new_spec->>'material_alloy'),
        'type',     COALESCE(p_new_spec->>'type',     p_new_spec->>'installed_type'),
        'inst_date', COALESCE(p_new_spec->>'inst_date', p_new_spec->>'installed_date', TO_CHAR(v_eff_to, 'YYYY-MM-DD')),
        'life',     COALESCE(p_new_spec->>'life',     NULL)
    ));

    v_new_meta := jsonb_set(v_old_meta, '{additionalInfo}', v_new_add, TRUE);

    -- Idempotency check: if this ANMAIN insp_id already created a history entry for this component,
    -- update in place without duplicating history.
    IF p_insp_id IS NOT NULL THEN
        SELECT * INTO v_existing_hist
        FROM public.anode_spec_history
        WHERE replaced_by_insp_id = p_insp_id;

        IF FOUND THEN
            IF v_existing_hist.component_id <> p_component_id THEN
                RAISE EXCEPTION 'ANMAIN record % is currently linked to component %. Use fn_reassign_anmain_component to change QID.', p_insp_id, v_existing_hist.component_id;
            END IF;

            UPDATE public.anode_spec_history
            SET
                effective_to = v_eff_to,
                replaced_by_jobpack_id = COALESCE(p_jobpack_id, replaced_by_jobpack_id),
                replaced_by_jobpack_name = COALESCE(v_jp_name, replaced_by_jobpack_name),
                remarks = COALESCE(p_remarks, remarks),
                replaced_at_local = COALESCE(p_client_local_time, replaced_at_local),
                client_timezone = COALESCE(p_client_timezone, client_timezone)
            WHERE id = v_existing_hist.id;

            -- Only update current active spec if this is the latest replacement generation
            SELECT COALESCE(MAX(generation_no), 0) INTO v_max_gen
            FROM public.anode_spec_history
            WHERE component_id = p_component_id;

            IF v_existing_hist.generation_no = v_max_gen THEN
                UPDATE public.structure_components
                SET
                    metadata = v_new_meta,
                    updated_at = v_ts
                WHERE id = p_component_id;
            END IF;

            RETURN jsonb_build_object(
                'success', TRUE,
                'updated_existing', TRUE,
                'history_id', v_existing_hist.id,
                'generation_no', v_existing_hist.generation_no,
                'archived_records_count', 0
            );
        END IF;
    END IF;

    -- Compute next generation number
    SELECT COALESCE(MAX(generation_no), 0) + 1
    INTO v_next_gen
    FROM public.anode_spec_history
    WHERE component_id = p_component_id;

    v_eff_from := public.fn_try_parse_date(v_old_add->>'inst_date');

    -- 1. Insert snapshot of the OLD anode spec into anode_spec_history
    INSERT INTO public.anode_spec_history (
        component_id,
        structure_id,
        q_id,
        generation_no,
        replacement_source,
        replaced_by_jobpack_id,
        replaced_by_jobpack_name,
        replaced_by_insp_id,
        effective_from,
        effective_to,
        anode_type,
        position,
        fitting,
        material,
        installed_type,
        inst_date,
        life,
        spec_snapshot,
        remarks,
        replaced_at_local,
        client_timezone,
        created_at,
        created_by
    ) VALUES (
        v_comp.id,
        v_comp.structure_id,
        v_comp.q_id,
        v_next_gen,
        COALESCE(NULLIF(UPPER(p_source), ''), 'ANMAIN'),
        p_jobpack_id,
        v_jp_name,
        p_insp_id,
        v_eff_from,
        v_eff_to,
        v_old_add->>'thetype',
        v_old_add->>'position',
        v_old_add->>'fitting',
        v_old_add->>'material',
        v_old_add->>'type',
        v_old_add->>'inst_date',
        v_old_add->>'life',
        v_old_meta,
        p_remarks,
        p_client_local_time,
        p_client_timezone,
        v_ts,
        p_user
    )
    RETURNING id INTO v_hist_id;

    -- 2. Tag all prior active insp_records for this component_id with v_hist_id
    --    (Pre-replacement readings now belong to this archived historical anode!)
    UPDATE public.insp_records
    SET anode_history_id = v_hist_id
    WHERE component_id = p_component_id
      AND anode_history_id IS NULL
      AND (p_insp_id IS NULL OR insp_id <> p_insp_id)
      AND (
          public.fn_try_parse_date(inspection_date::TEXT) < v_eff_to
          OR (
              public.fn_try_parse_date(inspection_date::TEXT) = v_eff_to
              AND (p_insp_id IS NULL OR insp_id < p_insp_id)
          )
          OR (inspection_date IS NULL AND (p_insp_id IS NULL OR insp_id < p_insp_id))
      );

    GET DIAGNOSTICS v_archived_count = ROW_COUNT;

    -- 3. Update current structure_components.metadata.additionalInfo with the NEW anode spec
    UPDATE public.structure_components
    SET
        metadata = v_new_meta,
        updated_at = v_ts
    WHERE id = p_component_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'updated_existing', FALSE,
        'history_id', v_hist_id,
        'generation_no', v_next_gen,
        'archived_records_count', v_archived_count
    );
END;
$$;

-- 6. Atomic RPC: Rollback Latest Anode Replacement (Lossless Restore)
DROP FUNCTION IF EXISTS public.fn_rollback_anode_replacement(BIGINT, BIGINT, BIGINT, TEXT);
CREATE OR REPLACE FUNCTION public.fn_rollback_anode_replacement(
    p_component_id BIGINT,
    p_history_id BIGINT DEFAULT NULL,
    p_insp_id BIGINT DEFAULT NULL,
    p_user TEXT DEFAULT NULL,
    p_client_timestamp TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_hist RECORD;
    v_max_gen INTEGER;
    v_ts TIMESTAMPTZ;
    v_restored_count INTEGER := 0;
BEGIN
    v_ts := COALESCE(p_client_timestamp, NOW());

    -- Lock component
    PERFORM 1 FROM public.structure_components WHERE id = p_component_id FOR UPDATE;

    IF p_history_id IS NOT NULL THEN
        SELECT * INTO v_hist
        FROM public.anode_spec_history
        WHERE id = p_history_id AND component_id = p_component_id;
    ELSIF p_insp_id IS NOT NULL THEN
        SELECT * INTO v_hist
        FROM public.anode_spec_history
        WHERE replaced_by_insp_id = p_insp_id AND component_id = p_component_id;
    ELSE
        SELECT * INTO v_hist
        FROM public.anode_spec_history
        WHERE component_id = p_component_id
        ORDER BY generation_no DESC
        LIMIT 1;
    END IF;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'rolled_back', FALSE,
            'message', 'No matching anode replacement history entry found to roll back.'
        );
    END IF;

    -- Guard: only the latest replacement generation can be rolled back directly
    SELECT COALESCE(MAX(generation_no), 0) INTO v_max_gen
    FROM public.anode_spec_history
    WHERE component_id = p_component_id;

    IF v_hist.generation_no <> v_max_gen THEN
        RAISE EXCEPTION 'Cannot roll back Generation #% because newer replacement Generation #% exists. Roll back newer replacements first.', v_hist.generation_no, v_max_gen;
    END IF;

    -- 1. Restore previous component metadata from spec_snapshot
    UPDATE public.structure_components
    SET
        metadata = v_hist.spec_snapshot,
        updated_at = v_ts
    WHERE id = p_component_id;

    -- 2. Restore prior inspection records back to active anode (anode_history_id = NULL)
    UPDATE public.insp_records
    SET anode_history_id = NULL
    WHERE component_id = p_component_id
      AND anode_history_id = v_hist.id;

    GET DIAGNOSTICS v_restored_count = ROW_COUNT;

    -- 3. Delete the rolled-back history row
    DELETE FROM public.anode_spec_history WHERE id = v_hist.id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'rolled_back', TRUE,
        'deleted_history_id', v_hist.id,
        'restored_generation_no', v_hist.generation_no,
        'restored_records_count', v_restored_count
    );
END;
$$;

-- 7. Atomic RPC: Wrong-QID Reassignment for ANMAIN
DROP FUNCTION IF EXISTS public.fn_reassign_anmain_component(BIGINT, BIGINT, BIGINT, JSONB, BOOLEAN, DATE, BIGINT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.fn_reassign_anmain_component(
    p_insp_id BIGINT,
    p_old_component_id BIGINT,
    p_new_component_id BIGINT,
    p_new_spec JSONB DEFAULT '{}'::JSONB,
    p_replaced BOOLEAN DEFAULT TRUE,
    p_replaced_date DATE DEFAULT CURRENT_DATE,
    p_jobpack_id BIGINT DEFAULT NULL,
    p_jobpack_name TEXT DEFAULT NULL,
    p_remarks TEXT DEFAULT NULL,
    p_user TEXT DEFAULT NULL,
    p_client_timestamp TIMESTAMPTZ DEFAULT NULL,
    p_client_local_time TEXT DEFAULT NULL,
    p_client_timezone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old_comp RECORD;
    v_new_comp RECORD;
    v_ts TIMESTAMPTZ;
    v_rollback_res JSONB := '{}'::JSONB;
    v_replace_res JSONB := '{}'::JSONB;
BEGIN
    v_ts := COALESCE(p_client_timestamp, NOW());

    IF p_old_component_id = p_new_component_id THEN
        RAISE EXCEPTION 'Old and new component IDs are identical (%).', p_old_component_id;
    END IF;

    SELECT id, q_id, code INTO v_old_comp FROM public.structure_components WHERE id = p_old_component_id;
    SELECT id, q_id, code INTO v_new_comp FROM public.structure_components WHERE id = p_new_component_id;

    IF v_new_comp.id IS NULL THEN
        RAISE EXCEPTION 'Target component % not found.', p_new_component_id;
    END IF;

    -- Step 1: Roll back any anode replacement history on the wrongly selected QID
    IF EXISTS (
        SELECT 1 FROM public.anode_spec_history
        WHERE replaced_by_insp_id = p_insp_id AND component_id = p_old_component_id
    ) THEN
        v_rollback_res := public.fn_rollback_anode_replacement(
            p_component_id := p_old_component_id,
            p_history_id := NULL,
            p_insp_id := p_insp_id,
            p_user := p_user,
            p_client_timestamp := v_ts
        );
    END IF;

    -- Step 2: Reassign insp_records and component-tagged companion tables
    -- (attachment, insp_media, and insp_anomalies are keyed by insp_id and move automatically)
    UPDATE public.insp_records
    SET
        component_id = p_new_component_id,
        component_type = COALESCE(v_new_comp.code, component_type),
        anode_history_id = NULL,
        inspection_data = jsonb_set(
            COALESCE(inspection_data, '{}'::JSONB) - 'q_id',
            '{comp_id}',
            to_jsonb(p_new_component_id),
            TRUE
        ),
        md_date = v_ts
    WHERE insp_id = p_insp_id;

    -- Update AI image analysis records if table exists
    IF to_regclass('public.insp_ai_image_analysis') IS NOT NULL THEN
        EXECUTE 'UPDATE public.insp_ai_image_analysis SET component_id = $1 WHERE inspection_id = $2'
        USING p_new_component_id, p_insp_id;
    END IF;

    -- Update video log event_type QID label if old/new QIDs differ
    IF v_old_comp.q_id IS NOT NULL AND v_new_comp.q_id IS NOT NULL AND v_old_comp.q_id <> v_new_comp.q_id THEN
        UPDATE public.insp_video_logs
        SET event_type = REPLACE(event_type, v_old_comp.q_id, v_new_comp.q_id)
        WHERE inspection_id = p_insp_id
          AND event_type LIKE '%' || v_old_comp.q_id || '%';
    END IF;

    -- Step 3: Archive New QID and apply new anode spec if replaced = TRUE and target is AN
    IF p_replaced = TRUE AND UPPER(COALESCE(v_new_comp.code, '')) = 'AN' THEN
        v_replace_res := public.fn_replace_anode_spec(
            p_component_id := p_new_component_id,
            p_new_spec := p_new_spec,
            p_replaced_date := p_replaced_date,
            p_jobpack_id := p_jobpack_id,
            p_jobpack_name := p_jobpack_name,
            p_insp_id := p_insp_id,
            p_source := 'ANMAIN',
            p_remarks := p_remarks,
            p_user := p_user,
            p_client_timestamp := v_ts,
            p_client_local_time := p_client_local_time,
            p_client_timezone := p_client_timezone
        );
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'old_component_id', p_old_component_id,
        'new_component_id', p_new_component_id,
        'rollback', v_rollback_res,
        'replacement', v_replace_res
    );
END;
$$;

-- 8. Helper RPC: Resolve historical anode_history_id for backdated inspections
CREATE OR REPLACE FUNCTION public.fn_resolve_anode_history_for_date(
    p_component_id BIGINT,
    p_inspection_date DATE
)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_hist_id BIGINT;
BEGIN
    IF p_component_id IS NULL OR p_inspection_date IS NULL THEN
        RETURN NULL;
    END IF;

    -- Find earliest archived generation whose replacement date (effective_to) is strictly after p_inspection_date
    SELECT id INTO v_hist_id
    FROM public.anode_spec_history
    WHERE component_id = p_component_id
      AND effective_to > p_inspection_date
    ORDER BY generation_no ASC
    LIMIT 1;

    RETURN v_hist_id;
END;
$$;

-- 9. Safety Trigger: If an ANMAIN insp_record is deleted directly, roll back its replacement
--    if it was the latest replacement generation on that component.
CREATE OR REPLACE FUNCTION public.fn_rollback_anode_on_insp_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_hist RECORD;
    v_max_gen INTEGER;
BEGIN
    SELECT * INTO v_hist
    FROM public.anode_spec_history
    WHERE replaced_by_insp_id = OLD.insp_id;

    IF FOUND THEN
        -- Only roll back if component still exists (skip during full structure cascade delete)
        IF EXISTS (SELECT 1 FROM public.structure_components WHERE id = v_hist.component_id) THEN
            SELECT COALESCE(MAX(generation_no), 0) INTO v_max_gen
            FROM public.anode_spec_history
            WHERE component_id = v_hist.component_id;

            IF v_hist.generation_no = v_max_gen THEN
                UPDATE public.structure_components
                SET metadata = v_hist.spec_snapshot, updated_at = NOW()
                WHERE id = v_hist.component_id;

                UPDATE public.insp_records
                SET anode_history_id = NULL
                WHERE component_id = v_hist.component_id
                  AND anode_history_id = v_hist.id;

                DELETE FROM public.anode_spec_history WHERE id = v_hist.id;
            END IF;
        END IF;
    END IF;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_rollback_anode_on_insp_delete ON public.insp_records;
CREATE TRIGGER trg_rollback_anode_on_insp_delete
BEFORE DELETE ON public.insp_records
FOR EACH ROW
EXECUTE FUNCTION public.fn_rollback_anode_on_insp_delete();

GRANT EXECUTE ON FUNCTION public.fn_try_parse_date(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_replace_anode_spec(BIGINT, JSONB, DATE, BIGINT, TEXT, BIGINT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_rollback_anode_replacement(BIGINT, BIGINT, BIGINT, TEXT, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_reassign_anmain_component(BIGINT, BIGINT, BIGINT, JSONB, BOOLEAN, DATE, BIGINT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_resolve_anode_history_for_date(BIGINT, DATE) TO authenticated, service_role;

-- Reload PostgREST schema cache so new/updated RPC signatures are immediately visible
NOTIFY pgrst, 'reload schema';
