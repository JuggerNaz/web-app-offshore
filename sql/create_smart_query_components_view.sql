-- Create a unified view for Smart Query Components
-- This view joins the structure_components table with the v_smart_query_structures view
-- and extracts JSON metadata into searchable columns.

CREATE OR REPLACE VIEW v_smart_query_components AS
SELECT 
  -- Base Component Fields
  c.id,
  c.structure_id,
  c.q_id,
  c.comp_id,
  c.id_no,
  c.code,
  c.is_deleted,
  c.created_at,
  c.created_by,
  c.updated_at,
  c.modified_by,
  c.metadata,
  
  -- Parent Structure Fields (via JOIN)
  s.title as structure_name,
  s.ptype as structure_type,
  s.pfield as structure_field,
  s.str_type as structure_base_type,

  -- Extracted Metadata JSON Fields (cast where appropriate)
  c.metadata->>'description' as description,
  c.metadata->>'material' as material,
  c.metadata->>'installedType' as installed_type,
  (c.metadata->>'life')::numeric as life,
  c.metadata->>'installDate' as install_date,
  c.metadata->>'fitting' as fitting,
  c.metadata->>'part' as part,

  -- Platform Location Fields
  c.metadata->>'level' as level,
  c.metadata->>'face' as face,
  c.metadata->>'structuralGroup' as structural_group,
  c.metadata->>'position' as position,

  -- Pipeline Location Fields
  c.metadata->>'startNode' as start_node,
  c.metadata->>'endNode' as end_node,
  c.metadata->>'startLeg' as start_leg,
  c.metadata->>'endLeg' as end_leg,
  (c.metadata->>'elevation1')::numeric as elevation1,
  (c.metadata->>'elevation2')::numeric as elevation2,
  (c.metadata->>'distance')::numeric as distance,
  c.metadata->>'clockPosition' as clock_position,

  -- Component-specific Specs
  c.metadata->>'anodeType' as anode_type,
  (c.metadata->>'weight')::numeric as weight,
  (c.metadata->>'currentOutput')::numeric as current_output

FROM structure_components c
LEFT JOIN v_smart_query_structures s ON c.structure_id = s.id;
