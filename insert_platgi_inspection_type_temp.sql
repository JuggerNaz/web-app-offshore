-- =========================================================================================
-- SQL Script: Insert 'PLATGI' spec into inspection_type from insptype_sub
-- =========================================================================================

INSERT INTO inspection_type (
    code,
    name,
    description,
    category,
    metadata,
    default_properties,
    requires_video,
    requires_photos,
    is_active,
    cr_user
)
SELECT 
    -- Map "SCODE" to "code" field in the new table
    TRIM("SCODE"), 
    
    -- Map "NAME" from insptype_sub directly and format it nicely
    TRIM("NAME"), 
    
    'Platform General Visual Inspection',
    'VISUAL',
    
    -- Target exactly the integer mapping requested
    '{"rov": 1, "sbm": 1, "tank": 1, "diving": 0, "default": 0, "pipeline": 0, "platform": 1}'::jsonb,
    
    -- Dynamically defined default properties mirroring the Oracle PLATGI structure
    '{
        "fields": [
            {"name": "inspection_task", "type": "select", "required": false, "label": "Inspection Task", "options": ["Conductor Inspection", "General Visual", "Close Visual", "Member Inspection"]},
            {"name": "event_id", "type": "text", "required": false, "label": "Event ID"},
            {"name": "elevation", "type": "number", "required": false, "label": "Elevation", "step": "0.01"},
            {"name": "easting", "type": "text", "required": false, "label": "Easting"},
            {"name": "northing", "type": "text", "required": false, "label": "Northing"},
            {"name": "component_type", "type": "text", "required": false, "label": "Component Type"},
            {"name": "component_qid", "type": "text", "required": false, "label": "Component Q-Id"},
            {"name": "cp_rdg", "type": "number", "required": false, "label": "CP Rdg (mV)"},
            {"name": "supervisor", "type": "text", "required": false, "label": "Supervisor"},
            {"name": "rep_cord", "type": "text", "required": false, "label": "Rep. Cord. (RC)"},
            {"name": "pilot", "type": "text", "required": false, "label": "Pilot"},
            {"name": "dive_no", "type": "text", "required": false, "label": "Dive No"},
            {"name": "tape_no", "type": "text", "required": false, "label": "Tape No"},
            {"name": "counter_no", "type": "text", "required": false, "label": "Counter No"},
            {"name": "defect", "type": "boolean", "required": false, "label": "Defect?"},
            {"name": "incomplete", "type": "boolean", "required": false, "label": "Incomplete"},
            {"name": "marine_growth", "type": "text", "required": false, "label": "Marine Growth"},
            {"name": "debris", "type": "text", "required": false, "label": "Debris"},
            {"name": "component_condition", "type": "text", "required": false, "label": "Component Condition"},
            {"name": "coating_condition", "type": "text", "required": false, "label": "Coating Condition"},
            {"name": "description", "type": "text", "required": false, "label": "Description"},
            {"name": "comments", "type": "textarea", "required": false, "label": "Comments"}
        ]
    }'::jsonb,
    
    true,   -- requires_video
    true,   -- requires_photos
    true,   -- is_active
    'system' -- cr_user
FROM 
    insptype_sub 
WHERE 
    -- Broaden the WHERE clause to match 'PLATGI' in either CODE or SCODE just in case
    -- and use TRIM/UPPER to ensure spaces/casing don't cause the row to be skipped!
    TRIM(UPPER("CODE")) = 'PLATGI' OR TRIM(UPPER("SCODE")) = 'PLATGI';
