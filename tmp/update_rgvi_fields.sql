-- Run this script in the Supabase SQL Editor to manually add the Component Override for Anodes

UPDATE inspection_type
SET default_properties = jsonb_set(
    COALESCE(default_properties, '{"fields": [], "component_overrides": []}'::jsonb),
    '{component_overrides}',
    -- This safely appends the specific 'AN' override to the existing component_overrides array
    COALESCE(default_properties->'component_overrides', '[]'::jsonb) || 
    '[
      {
        "component_types": ["AN"],
        "fields": [
          { "name": "anode_type", "type": "text", "label": "Anode Type" },
          { "name": "anode_depletion", "type": "select", "label": "Anode Depletion" }
        ]
      }
    ]'::jsonb
)
WHERE code = 'RGVI';
