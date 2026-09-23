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
  COALESCE(c.metadata->>'description', c.metadata->>'desc', c.metadata->>'component_description', c.comp_id, c.id_no) as description,
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

  -- Pipeline / Structural Location Fields
  COALESCE(c.metadata->>'startNode', c.metadata->>'s_node', c.metadata->>'start_node', c.metadata->>'sNode', c.metadata->>'s_leg', c.metadata->>'startLeg') as start_node,
  COALESCE(c.metadata->>'endNode', c.metadata->>'f_node', c.metadata->>'e_node', c.metadata->>'end_node', c.metadata->>'fNode', c.metadata->>'eNode', c.metadata->>'f_leg', c.metadata->>'endLeg') as end_node,
  COALESCE(c.metadata->>'startLeg', c.metadata->>'s_leg') as start_leg,
  COALESCE(c.metadata->>'endLeg', c.metadata->>'f_leg', c.metadata->>'e_leg') as end_leg,
  COALESCE(c.metadata->>'elevation1', c.metadata->>'elv_1', c.metadata->>'elev_1', c.metadata->>'elevation_1', c.metadata->>'start_elevation', c.metadata->>'elev1') as elevation1,
  COALESCE(c.metadata->>'elevation2', c.metadata->>'elv_2', c.metadata->>'elev_2', c.metadata->>'elevation_2', c.metadata->>'end_elevation', c.metadata->>'elev2') as elevation2,
  (c.metadata->>'distance')::numeric as distance,
  c.metadata->>'clockPosition' as clock_position,

  -- Component-specific Specs
  c.metadata->>'anodeType' as anode_type,
  (c.metadata->>'weight')::numeric as weight,
  (c.metadata->>'currentOutput')::numeric as current_output

FROM structure_components c
LEFT JOIN v_smart_query_structures s ON c.structure_id = s.id;
