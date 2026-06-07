-- Create a unified view for Smart Query that combines both Platform and Pipeline fields
-- This ensures the "Structures" category can be queried dynamically for both types of assets

CREATE OR REPLACE VIEW v_smart_query_structures AS
SELECT 
  s.str_id as id,
  s.str_type,
  -- common fields across both platforms and pipelines
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

  -- platform specific fields
  p.plat_id,
  p.st_north, 
  p.st_east, 
  p.plegs, 
  p.dleg, 
  p.conduct, 
  p.cslot, 
  p.riser, 
  p.caisson, 
  p.crane, 
  p.helipad, 
  p.manned, 
  p.north_angle, 
  p.north_side,

  -- pipeline specific fields
  pl.pipe_id,
  pl.st_loc, 
  pl.end_loc, 
  pl.st_x, 
  pl.st_y, 
  pl.end_x, 
  pl.end_y, 
  pl.desg_press, 
  pl.oper_press, 
  pl.st_fp, 
  pl.end_fp, 
  pl.conc_ctg, 
  pl.span_cons, 
  pl.span_oper, 
  pl.fp_tolerance, 
  pl.burial, 
  pl.conc_ctg_per, 
  pl.plength, 
  pl.ra_qty, 
  pl.ra_type, 
  pl.sent, 
  pl.workunit, 
  pl.line_diam

FROM structure s
LEFT JOIN platform p ON s.str_id = p.plat_id
LEFT JOIN u_pipeline pl ON s.str_id = pl.pipe_id;
