-- ============================================================================
-- GLOBAL SEARCH RPC (FULL-FIELD COVERAGE)
-- ============================================================================
-- Description: Enables AI-style searching across all text and JSONB fields
--              in key tables: platform, u_pipeline, jobpack, insp_records, insp_anomalies.
-- ============================================================================

CREATE OR REPLACE FUNCTION rpc_global_search(query_text text)
RETURNS TABLE (
    id text,
    title text,
    subtitle text,
    type text,
    url text,
    score float
) AS $$
DECLARE
    limit_val int := 25;
BEGIN
    RETURN QUERY
    WITH all_results AS (
        -- 1. Platforms
        SELECT 
            plat_id::text as id, 
            COALESCE(title, 'Unnamed Platform') as title, 
            COALESCE(pfield, 'Field') || ' • ' || COALESCE(ptype, 'Type') || ' • ' || COALESCE(powner, 'Owner') as subtitle, 
            'platform'::text as type, 
            '/dashboard/field/platform/' || plat_id as url,
            CASE 
                WHEN title ILIKE query_text THEN 100.0
                WHEN title ILIKE '%' || query_text || '%' THEN 95.0
                ELSE 70.0
            END as score
        FROM platform
        WHERE title ILIKE '%' || query_text || '%'
           OR powner ILIKE '%' || query_text || '%'
           OR pfield ILIKE '%' || query_text || '%'
           OR metadata::text ILIKE '%' || query_text || '%'
        
        UNION ALL
        -- 2. Pipelines
        SELECT 
            pipe_id::text as id, 
            COALESCE(title, 'Unnamed Pipeline') as title, 
            COALESCE(ptype, 'Pipeline') || ' • ' || COALESCE(material, 'Material') as subtitle, 
            'pipeline'::text as type, 
            '/dashboard/field/pipeline/' || pipe_id as url,
            CASE 
                WHEN title ILIKE query_text THEN 90.0
                ELSE 85.0
            END as score
        FROM u_pipeline
        WHERE title ILIKE '%' || query_text || '%'
           OR material ILIKE '%' || query_text || '%'
           OR ptype ILIKE '%' || query_text || '%'
        
        UNION ALL
        -- 3. Jobpacks
        SELECT 
            jobpack.id::text as id, 
            COALESCE(name, 'Untitled Jobpack') as title, 
            'Jobpack • ' || COALESCE(metadata->>'job_no', 'No Ref') as subtitle, 
            'jobpack'::text as type, 
            '/dashboard/jobpack/' || jobpack.id as url,
            85.0 as score
        FROM jobpack
        WHERE name ILIKE '%' || query_text || '%'
           OR metadata::text ILIKE '%' || query_text || '%'
        
        UNION ALL
        -- 4. Inspection Records
        SELECT 
            insp_id::text as id, 
            'Inspection: ' || inspection_type_code as title, 
            COALESCE(status, 'Draft') || ' • ' || inspection_date::text as subtitle, 
            'inspection'::text as type, 
            '/dashboard/inspection/workspace?id=' || insp_id as url,
            70.0 as score
        FROM insp_records
        WHERE inspection_type_code ILIKE '%' || query_text || '%'
           OR status ILIKE '%' || query_text || '%'
           OR inspection_data::text ILIKE '%' || query_text || '%'
        
        UNION ALL
        -- 5. Anomalies
        SELECT 
            anomaly_id::text as id, 
            COALESCE(anomaly_ref_no, 'ANOMALY') as title, 
            COALESCE(defect_category_code, 'Defect') || ' • ' || COALESCE(priority_code, 'P?') || ' • ' || LEFT(COALESCE(defect_description, ''), 50) as subtitle, 
            'anomaly'::text as type, 
            '/dashboard/inspection/anomalies/' || anomaly_id as url,
            80.0 as score
        FROM insp_anomalies
        WHERE anomaly_ref_no ILIKE '%' || query_text || '%'
           OR defect_type_code ILIKE '%' || query_text || '%'
           OR priority_code ILIKE '%' || query_text || '%'
           OR defect_category_code ILIKE '%' || query_text || '%'
           OR defect_description ILIKE '%' || query_text || '%'
    )
    SELECT * FROM all_results
    ORDER BY score DESC
    LIMIT limit_val;
END;
$$ LANGUAGE plpgsql;
