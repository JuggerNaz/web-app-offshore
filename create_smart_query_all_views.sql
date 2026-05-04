-- ============================================================================
-- MASTER SMART QUERY VIEWS
-- Run this in Supabase SQL Editor to create/update all necessary views
-- ============================================================================

-- Clean up existing views to avoid column mismatch errors
DROP VIEW IF EXISTS v_smart_query_incomplete CASCADE;
DROP VIEW IF EXISTS v_smart_query_findings CASCADE;
DROP VIEW IF EXISTS v_smart_query_anomalies CASCADE;
DROP VIEW IF EXISTS v_smart_query_inspection_records CASCADE;
DROP VIEW IF EXISTS v_smart_query_sow CASCADE;
DROP VIEW IF EXISTS v_smart_query_jobpacks CASCADE;
DROP VIEW IF EXISTS v_smart_query_components CASCADE;
DROP VIEW IF EXISTS v_smart_query_structures CASCADE;

-- 1. Unified Structures View (Platforms + Pipelines)
CREATE VIEW v_smart_query_structures AS
SELECT 
  s.str_id as id,
  s.str_type,
  COALESCE(p.title, pl.title) as title,
  COALESCE(p.pfield, pl.pfield) as pfield,
  COALESCE(p.pdesc, pl.pdesc) as pdesc,
  COALESCE(p.ptype, pl.ptype) as ptype,
  COALESCE(p.inst_date, pl.inst_date) as inst_date,
  COALESCE(p.desg_life, pl.desg_life) as desg_life,
  COALESCE(p.depth, pl.depth) as depth,
  COALESCE(p.an_qty, pl.an_qty) as an_qty,
  COALESCE(p.an_type, pl.an_type) as an_type,
  COALESCE(p.inst_ctr, pl.inst_ctr) as inst_ctr,
  COALESCE(p.wall_thk, pl.wall_thk) as wall_thk,
  COALESCE(p.process, pl.process) as process,
  COALESCE(p.material, pl.material) as material,
  COALESCE(p.cp_system, pl.cp_system) as cp_system,
  COALESCE(p.corr_ctg, pl.corr_ctg) as corr_ctg,
  COALESCE(p.def_unit, pl.def_unit) as def_unit,
  COALESCE(p.cr_user, pl.cr_user) as cr_user,
  COALESCE(p.cr_date, pl.cr_date) as cr_date,
  p.plegs, p.dleg, p.conduct, p.cslot, p.riser, p.caisson, p.crane, p.helipad, p.manned,
  pl.st_loc, pl.end_loc, pl.st_x, pl.st_y, pl.end_x, pl.end_y, pl.desg_press, pl.oper_press, pl.plength, pl.line_diam
FROM structure s
LEFT JOIN platform p ON s.str_id = p.plat_id
LEFT JOIN u_pipeline pl ON s.str_id = pl.pipe_id;

-- 2. Unified Components View (With parent structure details)
CREATE VIEW v_smart_query_components AS
SELECT 
  c.*,
  s.title as structure_name,
  s.pfield as structure_field,
  s.ptype as structure_spec_type,
  s.str_type as structure_base_type,
  c.metadata->>'description' as description,
  c.metadata->>'material' as material,
  c.metadata->>'level' as level,
  c.metadata->>'face' as face,
  c.metadata->>'position' as position,
  c.metadata->>'structuralGroup' as structural_group,
  c.metadata->>'anodeType' as anode_type,
  (c.metadata->>'weight')::numeric as weight,
  c.metadata->>'startNode' as start_node,
  c.metadata->>'endNode' as end_node,
  c.metadata->>'elevation1' as elevation1,
  c.metadata->>'elevation2' as elevation2
FROM structure_components c
LEFT JOIN v_smart_query_structures s ON c.structure_id = s.id;

-- 3. Unified Job Packs View (With aggregated structure names)
CREATE VIEW v_smart_query_jobpacks AS
WITH jobpack_structures AS (
  SELECT 
    sow.jobpack_id,
    string_agg(DISTINCT s.title, ', ') as structure_names
  FROM u_sow sow
  JOIN v_smart_query_structures s ON sow.structure_id = s.id
  GROUP BY sow.jobpack_id
)
SELECT 
  j.*,
  js.structure_names,
  j.metadata->>'contrac' as contractor,
  j.metadata->>'vessel' as vessel,
  j.metadata->>'plantype' as plan_type,
  j.metadata->>'tasktype' as task_type,
  j.metadata->>'from_date' as start_date,
  j.metadata->>'to_date' as end_date,
  j.metadata->>'workunit' as work_unit
FROM jobpack j
LEFT JOIN jobpack_structures js ON j.id = js.jobpack_id;

-- 4. Unified SOW View
CREATE VIEW v_smart_query_sow AS
SELECT 
  sow.*,
  s.title as structure_name_alt,
  s.pfield as structure_field_alt,
  s.ptype as structure_spec_type,
  j.name as jobpack_name_alt
FROM u_sow sow
LEFT JOIN v_smart_query_structures s ON sow.structure_id = s.id
LEFT JOIN jobpack j ON sow.jobpack_id = j.id;

-- 5. Unified Inspection Records View (Expanded with measurement properties and component info)
CREATE VIEW v_smart_query_inspection_records AS
SELECT 
  i.*,
  s.title as structure_name,
  s.pfield as structure_field,
  s.ptype as structure_spec_type,
  
  -- Component Details
  c.comp_id as component_id_str,
  c.id_no as component_id_no,
  c.q_id as component_qid,
  c.metadata->>'description' as component_description,
  c.metadata->>'startNode' as start_node,
  c.metadata->>'endNode' as end_node,
  c.metadata->>'elevation1' as elevation1,
  c.metadata->>'elevation2' as elevation2,
  
  j.name as jobpack_name,
  
  -- Core Status/Condition
  i.inspection_data->>'marine_growth' as marine_growth,
  i.inspection_data->>'coating_condition' as coating_condition,
  i.inspection_data->>'component_condition' as component_condition,
  i.inspection_data->>'nominal_thickness' as nominal_thickness,
  i.inspection_data->>'verification_depth' as verification_depth,
  
  -- UT / Thickness Readings
  i.inspection_data->>'ut_12_o_clock' as ut_12_o_clock,
  i.inspection_data->>'ut_3_o_clock' as ut_3_o_clock,
  i.inspection_data->>'ut_6_o_clock' as ut_6_o_clock,
  i.inspection_data->>'ut_9_o_clock' as ut_9_o_clock,
  
  -- CP Readings
  COALESCE(i.inspection_data->>'cp_rdg', i.inspection_data->>'CP Rdg (mV)') as cp_reading,
  i.inspection_data->>'pre_dive_cp_rdg' as pre_dive_cp_rdg,
  i.inspection_data->>'post_dive_cp_rdg' as post_dive_cp_rdg,
  
  -- Scour / Debris / Finding Info
  i.inspection_data->>'scour_depth' as scour_depth,
  i.inspection_data->>'scour_location' as scour_location,
  i.inspection_data->>'finding_type' as finding_type,
  COALESCE(i.inspection_data->>'debris_material', i.inspection_data->>'debris') as debris_info,
  COALESCE(i.inspection_data->>'distance_from_leg', i.inspection_data->>'distance_from_member') as distance_info,
  
  -- Anode / CP Status
  i.inspection_data->>'anode_depletion' as anode_depletion,
  i.inspection_data->>'anode_type' as anode_type,
  i.inspection_data->>'seepage_intensity' as seepage_intensity,
  
  -- MGI (Marine Growth) Profile
  i.inspection_data->>'mgi_profile' as mgi_profile,
  i.inspection_data->>'mgi_thickness_at' as mgi_thickness_at,
  i.inspection_data->>'mgi_hard_thickness' as mgi_hard_thickness,
  i.inspection_data->>'mgi_soft_thickness' as mgi_soft_thickness,
  
  -- Equipment / Calibration
  i.inspection_data->>'calib_block' as calib_block,
  i.inspection_data->>'serial_number' as serial_number,
  i.inspection_data->>'calib_equipment_type' as calib_equipment_type

FROM insp_records i
LEFT JOIN v_smart_query_structures s ON i.structure_id = s.id
LEFT JOIN structure_components c ON i.component_id = c.id
LEFT JOIN jobpack j ON i.jobpack_id = j.id;

-- 6. Unified Anomalies View (With component info)
CREATE VIEW v_smart_query_anomalies AS
SELECT 
  a.*,
  i.inspection_date as disc_date,
  i.inspection_type_code as disc_type,
  s.title as structure_name,
  s.pfield as structure_field,
  s.ptype as structure_spec_type,
  
  -- Component Details
  c.comp_id as component_id_str,
  c.id_no as component_id_no,
  c.q_id as component_qid,
  c.metadata->>'description' as component_description,
  c.metadata->>'startNode' as start_node,
  c.metadata->>'endNode' as end_node,
  c.metadata->>'elevation1' as elevation1,
  c.metadata->>'elevation2' as elevation2,
  
  j.name as jobpack_name
FROM insp_anomalies a
JOIN insp_records i ON a.inspection_id = i.insp_id
LEFT JOIN v_smart_query_structures s ON i.structure_id = s.id
LEFT JOIN structure_components c ON i.component_id = c.id
LEFT JOIN jobpack j ON i.jobpack_id = j.id;

-- 7. Filtered Findings View
CREATE VIEW v_smart_query_findings AS
SELECT * FROM v_smart_query_anomalies
WHERE record_category = 'Finding';

-- 8. Filtered Incomplete View
CREATE VIEW v_smart_query_incomplete AS
SELECT * FROM v_smart_query_inspection_records
WHERE status = 'INCOMPLETE';
