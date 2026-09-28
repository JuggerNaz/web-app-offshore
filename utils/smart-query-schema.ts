/**
 * Smart Query Schema Definitions
 * Maps categories to Supabase tables/views and field metadata.
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type FieldDataType = "text" | "number" | "date" | "boolean" | "json";

export interface FieldDef {
  key: string;           // Actual DB column name
  label: string;         // User-friendly display name
  dataType: FieldDataType;
  description?: string;  // Tooltip help text
}

export interface CategoryDef {
  id: string;
  label: string;
  description: string;
  icon: string;          // Lucide icon name
  table: string;         // Supabase table name
  fields: FieldDef[];
}

export interface SortRule {
  field: string;
  direction: "asc" | "desc";
}

export interface ConditionRule {
  field: string;
  operator: string;
  value: string;
  value2?: string;
  logic?: "AND" | "OR";
  transform?: string;
}

export interface ComputedField {
  name: string;
  sourceField: string;
  operation: string;
  params: Record<string, string | number>;
}

export interface SavedQuery {
  id?: string;
  name: string;
  description?: string;
  category: string;
  selectedFields: string[];
  computedFields: ComputedField[];
  sorting: SortRule[];
  conditions: ConditionRule[];
  created_at?: string;
  updated_at?: string;
  user_id?: string;
}

// ─── CATEGORIES ──────────────────────────────────────────────────────────────

export const QUERY_CATEGORIES: CategoryDef[] = [
  {
    id: "structures",
    label: "Structures",
    description: "Platforms & Pipelines — structural specs, location, and design data",
    icon: "Building2",
    table: "v_smart_query_structures",
    fields: [
      { key: "id", label: "Structure ID", dataType: "number", description: "Unique structure identifier" },
      { key: "str_type", label: "Structure Base Type", dataType: "text", description: "Type of structure (platform/pipeline)" },
      { key: "title", label: "Structure Name", dataType: "text", description: "Display name of structure" },
      { key: "pfield", label: "Field", dataType: "text", description: "Field/area the structure belongs to" },
      { key: "pdesc", label: "Description", dataType: "text", description: "Structure description" },
      { key: "ptype", label: "Structure Type", dataType: "text", description: "Type classification" },
      { key: "inst_date", label: "Installation Date", dataType: "date", description: "Date of installation" },
      { key: "desg_life", label: "Design Life", dataType: "text", description: "Design life specification" },
      { key: "depth", label: "Water Depth", dataType: "number", description: "Water depth at location" },
      { key: "an_qty", label: "Anode Quantity", dataType: "number", description: "Number of anodes" },
      { key: "an_type", label: "Anode Type", dataType: "text", description: "Type of anode" },
      { key: "inst_ctr", label: "Installation Contractor", dataType: "text", description: "Installing contractor" },
      { key: "wall_thk", label: "Wall Thickness", dataType: "text", description: "Wall thickness specification" },
      { key: "process", label: "Process", dataType: "text", description: "Process type" },
      { key: "plegs", label: "Number of Legs", dataType: "number", description: "Leg count (Platform)" },
      { key: "dleg", label: "Diagonal Legs", dataType: "text", description: "Diagonal leg info (Platform)" },
      { key: "conduct", label: "Conductors", dataType: "text", description: "Conductor count (Platform)" },
      { key: "cslot", label: "Conductor Slots", dataType: "text", description: "Conductor slot count (Platform)" },
      { key: "riser", label: "Risers", dataType: "text", description: "Riser count (Platform)" },
      { key: "caisson", label: "Caissons", dataType: "text", description: "Caisson count (Platform)" },
      { key: "crane", label: "Crane", dataType: "text", description: "Crane information (Platform)" },
      { key: "helipad", label: "Helipad", dataType: "text", description: "Helipad availability (Platform)" },
      { key: "manned", label: "Manned", dataType: "text", description: "Manned or unmanned (Platform)" },
      { key: "material", label: "Material", dataType: "text", description: "Construction material" },
      { key: "cp_system", label: "CP System", dataType: "text", description: "Cathodic protection system" },
      { key: "corr_ctg", label: "Corrosion Category", dataType: "text", description: "Corrosion category" },
      { key: "def_unit", label: "Default Unit", dataType: "text", description: "Default measurement unit" },
      { key: "st_loc", label: "Start Location", dataType: "text", description: "Pipeline start location" },
      { key: "end_loc", label: "End Location", dataType: "text", description: "Pipeline end location" },
      { key: "st_x", label: "Start X", dataType: "text", description: "Start X coordinate (Pipeline)" },
      { key: "st_y", label: "Start Y", dataType: "text", description: "Start Y coordinate (Pipeline)" },
      { key: "end_x", label: "End X", dataType: "text", description: "End X coordinate (Pipeline)" },
      { key: "end_y", label: "End Y", dataType: "text", description: "End Y coordinate (Pipeline)" },
      { key: "desg_press", label: "Design Pressure", dataType: "text", description: "Design pressure (Pipeline)" },
      { key: "oper_press", label: "Operating Pressure", dataType: "text", description: "Operating pressure (Pipeline)" },
      { key: "plength", label: "Pipeline Length", dataType: "text", description: "Total pipeline length" },
      { key: "line_diam", label: "Line Diameter", dataType: "text", description: "Pipeline line diameter" },

      // Audit User & Date Fields
      { key: "cr_user", label: "Create User", dataType: "text", description: "User who created the record" },
      { key: "cr_date", label: "Create Date", dataType: "date", description: "Record creation date" },
      { key: "md_user", label: "Modified User", dataType: "text", description: "User who last modified the record" },
      { key: "md_date", label: "Modified Date", dataType: "date", description: "Record last modification date" },
    ],
  },
  {
    id: "components",
    label: "Components",
    description: "Structural components, pipeline segments, members, and attachments",
    icon: "Puzzle",
    table: "v_smart_query_components",
    fields: [
      { key: "id", label: "Record ID", dataType: "number", description: "Internal record ID" },
      { key: "q_id", label: "Component QID", dataType: "number", description: "Component queue identifier" },
      { key: "comp_id", label: "Component ID", dataType: "text", description: "Component identifier" },
      { key: "id_no", label: "ID Number", dataType: "text", description: "Component ID number" },
      { key: "structure_name", label: "Structure Name", dataType: "text", description: "Name of parent structure" },
      { key: "structure_spec_type", label: "Structure Type", dataType: "text", description: "Type of parent structure" },
      { key: "structure_field", label: "Field", dataType: "text", description: "Field/area of parent structure" },
      { key: "code", label: "Component Code", dataType: "text", description: "Short code (e.g., AN, MB, RS)" },
      { key: "description", label: "Description", dataType: "text", description: "Component description" },
      { key: "material", label: "Material", dataType: "text", description: "Component material" },
      { key: "level", label: "Level", dataType: "text", description: "Platform level" },
      { key: "face", label: "Face", dataType: "text", description: "Platform face" },
      { key: "position", label: "Position", dataType: "text", description: "Position details" },
      { key: "structural_group", label: "Structural Group", dataType: "text", description: "Structural group" },
      { key: "anode_type", label: "Anode Type", dataType: "text", description: "Anode type" },
      { key: "weight", label: "Weight", dataType: "number", description: "Component weight" },
      { key: "start_node", label: "Start Node", dataType: "text", description: "Start node number" },
      { key: "end_node", label: "End Node", dataType: "text", description: "End node number" },
      { key: "elevation1", label: "Elevation 1", dataType: "text", description: "Starting elevation" },
      { key: "elevation2", label: "Elevation 2", dataType: "text", description: "Ending elevation" },

      // Audit User & Date Fields
      { key: "created_by", label: "Create User", dataType: "text", description: "User who created the component" },
      { key: "created_at", label: "Create Date", dataType: "date", description: "Component creation date" },
      { key: "modified_by", label: "Modified User", dataType: "text", description: "User who last modified the component" },
      { key: "updated_at", label: "Modified Date", dataType: "date", description: "Component last modification date" },
    ],
  },
  {
    id: "jobpacks",
    label: "Job Packs",
    description: "Work packages and job pack records",
    icon: "Package",
    table: "v_smart_query_jobpacks",
    fields: [
      { key: "id", label: "Job Pack ID", dataType: "number", description: "Unique job pack identifier" },
      { key: "name", label: "Name", dataType: "text", description: "Job pack name" },
      { key: "status", label: "Status", dataType: "text", description: "Current status" },
      { key: "structure_names", label: "Included Structures", dataType: "text", description: "List of structures in this pack" },
      { key: "contractor", label: "Contractor", dataType: "text", description: "Executing contractor" },
      { key: "vessel", label: "Vessel", dataType: "text", description: "Support vessel" },
      { key: "plan_type", label: "Plan Type", dataType: "text", description: "Type of plan" },
      { key: "task_type", label: "Task Type", dataType: "text", description: "Type of task" },
      { key: "start_date", label: "Start Date", dataType: "date", description: "Planned start date" },
      { key: "end_date", label: "End Date", dataType: "date", description: "Planned end date" },
      { key: "work_unit", label: "Work Unit", dataType: "text", description: "Work unit identifier" },

      // Audit User & Date Fields
      { key: "created_by", label: "Create User", dataType: "text", description: "User who created the job pack" },
      { key: "created_at", label: "Create Date", dataType: "date", description: "Job pack creation date" },
      { key: "modified_by", label: "Modified User", dataType: "text", description: "User who last modified the job pack" },
      { key: "updated_at", label: "Modified Date", dataType: "date", description: "Job pack last modification date" },
    ],
  },
  {
    id: "sow",
    label: "Scope of Work",
    description: "Scope of work definitions and items",
    icon: "ClipboardList",
    table: "v_smart_query_sow",
    fields: [
      { key: "id", label: "SOW ID", dataType: "number", description: "Unique SOW identifier" },
      { key: "jobpack_name_alt", label: "Job Pack Name", dataType: "text", description: "Linked job pack" },
      { key: "structure_name_alt", label: "Structure Name", dataType: "text", description: "Structure display name" },
      { key: "structure_type", label: "Structure Base Type", dataType: "text", description: "PLATFORM or PIPELINE" },
      { key: "structure_spec_type", label: "Structure Type", dataType: "text", description: "Type classification" },
      { key: "structure_field_alt", label: "Field", dataType: "text", description: "Field/area" },
      { key: "total_items", label: "Total Items", dataType: "number", description: "Total SOW items" },
      { key: "completed_items", label: "Completed Items", dataType: "number", description: "Completed SOW items" },
      { key: "incomplete_items", label: "Incomplete Items", dataType: "number", description: "Incomplete SOW items" },

      // Audit User & Date Fields
      { key: "created_by", label: "Create User", dataType: "text", description: "User who created the SOW" },
      { key: "created_at", label: "Create Date", dataType: "date", description: "SOW creation date" },
      { key: "updated_by", label: "Modified User", dataType: "text", description: "User who last modified the SOW" },
      { key: "updated_at", label: "Modified Date", dataType: "date", description: "SOW last modification date" },
    ],
  },
  {
    id: "inspection_records",
    label: "Inspection Records",
    description: "All inspection recordings, measurements, calibration, and condition data",
    icon: "ClipboardCheck",
    table: "v_smart_query_inspection_records",
    fields: [
          {
                "key": "insp_id",
                "label": "Inspection ID",
                "dataType": "number",
                "description": "Unique inspection record ID"
          },
          {
                "key": "structure_name",
                "label": "Structure Name",
                "dataType": "text",
                "description": "Inspected structure display name"
          },
          {
                "key": "structure_spec_type",
                "label": "Structure Type",
                "dataType": "text",
                "description": "Type classification (Platform / Pipeline)"
          },
          {
                "key": "structure_field",
                "label": "Field",
                "dataType": "text",
                "description": "Field / offshore area"
          },
          {
                "key": "component_id_str",
                "label": "Component ID",
                "dataType": "text",
                "description": "Inspected component identifier"
          },
          {
                "key": "component_id_no",
                "label": "Component ID No",
                "dataType": "text",
                "description": "Component ID number"
          },
          {
                "key": "component_qid",
                "label": "Component QID",
                "dataType": "number",
                "description": "Component queue ID"
          },
          {
                "key": "component_description",
                "label": "Component Description",
                "dataType": "text",
                "description": "Component description"
          },
          {
                "key": "start_node",
                "label": "Start Node",
                "dataType": "text",
                "description": "Start node"
          },
          {
                "key": "end_node",
                "label": "End Node",
                "dataType": "text",
                "description": "End node"
          },
          {
                "key": "elevation1",
                "label": "Elevation 1",
                "dataType": "text",
                "description": "Starting elevation"
          },
          {
                "key": "elevation2",
                "label": "Elevation 2",
                "dataType": "text",
                "description": "Ending elevation"
          },
          {
                "key": "elevation",
                "label": "Elevation",
                "dataType": "number",
                "description": "Reading elevation / water depth"
          },
          {
                "key": "fp_kp",
                "label": "FP / KP",
                "dataType": "text",
                "description": "Fix point / Kilometer post"
          },
          {
                "key": "jobpack_name",
                "label": "Job Pack",
                "dataType": "text",
                "description": "Linked job pack"
          },
          {
                "key": "inspection_type_code",
                "label": "Inspection Type",
                "dataType": "text",
                "description": "Type of inspection (e.g. GVI, CPSURV, UTWTK, UTCLB, MGI)"
          },
          {
                "key": "status",
                "label": "Status",
                "dataType": "text",
                "description": "COMPLETED, INCOMPLETE, PENDING"
          },
          {
                "key": "inspection_date",
                "label": "Inspection Date",
                "dataType": "date",
                "description": "Date of inspection"
          },
          {
                "key": "inspection_time",
                "label": "Inspection Time",
                "dataType": "text",
                "description": "Time of inspection"
          },
          {
                "key": "sow_report_no",
                "label": "SOW Report No",
                "dataType": "text",
                "description": "SOW report number"
          },
          {
                "key": "workunit",
                "label": "Work Unit",
                "dataType": "text",
                "description": "Diving / ROV Work unit"
          },
          {
                "key": "description",
                "label": "Inspection Description / Remarks",
                "dataType": "text",
                "description": "Record remarks & findings"
          },
          {
                "key": "cp_rdg",
                "label": "CP Rdg",
                "dataType": "number",
                "description": "VOLTAGE | Shared Inspection Field"
          },
          {
                "key": "marine_growth_soft",
                "label": "Soft Marine Growth",
                "dataType": "text",
                "description": "Shared Inspection Field"
          },
          {
                "key": "marine_growth_hard",
                "label": "Hard Marine Growth",
                "dataType": "text",
                "description": "Shared Inspection Field"
          },
          {
                "key": "debris",
                "label": "Debris",
                "dataType": "text",
                "description": "Shared Inspection Field"
          },
          {
                "key": "debris_material",
                "label": "Debris Material",
                "dataType": "text",
                "description": "Shared Inspection Field"
          },
          {
                "key": "component_condition",
                "label": "Component Condition",
                "dataType": "text",
                "description": "Shared Inspection Field"
          },
          {
                "key": "coating_condition",
                "label": "Coating Condition",
                "dataType": "text",
                "description": "Shared Inspection Field"
          },
          {
                "key": "surface_condition",
                "label": "Surface Condition",
                "dataType": "text",
                "description": "Shared Inspection Field"
          },
          {
                "key": "cleaning_method",
                "label": "Cleaning Method",
                "dataType": "text",
                "description": "Shared Inspection Field"
          },
          {
                "key": "northing",
                "label": "Northing",
                "dataType": "text",
                "description": "Shared Inspection Field"
          },
          {
                "key": "easting",
                "label": "Easting",
                "dataType": "text",
                "description": "Shared Inspection Field"
          },
          {
                "key": "nominal_thickness",
                "label": "Nominal",
                "dataType": "number",
                "description": "LENGTH | Shared Inspection Field"
          },
          {
                "key": "ut_3_o_clock",
                "label": "3",
                "dataType": "number",
                "description": "LENGTH | Shared Inspection Field"
          },
          {
                "key": "ut_6_o_clock",
                "label": "6",
                "dataType": "number",
                "description": "LENGTH | Shared Inspection Field"
          },
          {
                "key": "ut_9_o_clock",
                "label": "9",
                "dataType": "number",
                "description": "LENGTH | Shared Inspection Field"
          },
          {
                "key": "ut_12_o_clock",
                "label": "12",
                "dataType": "number",
                "description": "LENGTH | Shared Inspection Field"
          },
          {
                "key": "mgi_profile",
                "label": "MGI Profile",
                "dataType": "text",
                "description": "Shared Inspection Field"
          },
          {
                "key": "mgi_hard_thickness_at_12",
                "label": "12",
                "dataType": "number",
                "description": "LENGTH | Shared Inspection Field"
          },
          {
                "key": "mgi_hard_thickness_at_3",
                "label": "3",
                "dataType": "number",
                "description": "LENGTH | Shared Inspection Field"
          },
          {
                "key": "mgi_hard_thickness_at_6",
                "label": "6",
                "dataType": "number",
                "description": "LENGTH | Shared Inspection Field"
          },
          {
                "key": "mgi_hard_thickness_at_9",
                "label": "9",
                "dataType": "number",
                "description": "LENGTH | Shared Inspection Field"
          },
          {
                "key": "mgi_soft_thickness_at_12",
                "label": "12",
                "dataType": "number",
                "description": "LENGTH | Shared Inspection Field"
          },
          {
                "key": "mgi_soft_thickness_at_3",
                "label": "3",
                "dataType": "number",
                "description": "LENGTH | Shared Inspection Field"
          },
          {
                "key": "mgi_soft_thickness_at_6",
                "label": "6",
                "dataType": "number",
                "description": "LENGTH | Shared Inspection Field"
          },
          {
                "key": "mgi_soft_thickness_at_9",
                "label": "9",
                "dataType": "number",
                "description": "LENGTH | Shared Inspection Field"
          },
          {
                "key": "cp_rdg_additional",
                "label": "CP Additional Readings",
                "dataType": "json",
                "description": "Shared Inspection Field"
          },
          {
                "key": "fmd_density_rdg_additional",
                "label": "FMD Additonal Readings",
                "dataType": "json",
                "description": "Shared Inspection Field"
          },
          {
                "key": "ut_readings_additional",
                "label": "UT Additional Readings",
                "dataType": "json",
                "description": "Shared Inspection Field"
          },
          {
                "key": "it_main_detail_readings",
                "label": "Item Maintenance Detail Readings",
                "dataType": "json",
                "description": "Shared Inspection Field"
          },
          {
                "key": "lighting_method",
                "label": "Lighting Method",
                "dataType": "text",
                "description": "Close Visual Inspection"
          },
          {
                "key": "width",
                "label": "Width",
                "dataType": "number",
                "description": "LENGTH | Close Visual Inspection"
          },
          {
                "key": "length",
                "label": "Length",
                "dataType": "number",
                "description": "LENGTH | Close Visual Inspection"
          },
          {
                "key": "depth",
                "label": "Depth",
                "dataType": "number",
                "description": "LENGTH | Coating Damage Inspection"
          },
          {
                "key": "assessment",
                "label": "Assessment",
                "dataType": "text",
                "description": "Coating Damage Inspection"
          },
          {
                "key": "acfmc_page",
                "label": "ACFM Page",
                "dataType": "number",
                "description": "NONE | ACFM Survey"
          },
          {
                "key": "probe_fl",
                "label": "Probe",
                "dataType": "text",
                "description": "ACFM Survey"
          },
          {
                "key": "chord_weld_brace",
                "label": "Chord / Weld / Brace",
                "dataType": "text",
                "description": "ACFM Survey"
          },
          {
                "key": "direction_travl",
                "label": "Direction of Travel",
                "dataType": "text",
                "description": "ACFM Survey"
          },
          {
                "key": "probe_flow",
                "label": "Probe Flow",
                "dataType": "number",
                "description": "NONE | ACFM Survey"
          },
          {
                "key": "clk_pos",
                "label": "Clock Position",
                "dataType": "text",
                "description": "ACFM Survey"
          },
          {
                "key": "orientation",
                "label": "Orientation",
                "dataType": "text",
                "description": "ACFM Survey"
          },
          {
                "key": "report",
                "label": "Report",
                "dataType": "text",
                "description": "ACFM Survey"
          },
          {
                "key": "brace_thick_3clk",
                "label": "Brace Thick @ 3 Clocks",
                "dataType": "number",
                "description": "LENGTH | ACFM Survey"
          },
          {
                "key": "brace_thick_9clk",
                "label": "Brace Thick @ 9 Clocks",
                "dataType": "number",
                "description": "LENGTH | ACFM Survey"
          },
          {
                "key": "brace_thick_12clk",
                "label": "Brace Thick @ 12 Clocks",
                "dataType": "number",
                "description": "LENGTH | ACFM Survey"
          },
          {
                "key": "brace_thick_6clk",
                "label": "Brace Thick @ 6 Clocks",
                "dataType": "number",
                "description": "LENGTH | ACFM Survey"
          },
          {
                "key": "chord_thick_3clk",
                "label": "Chord Thick @ 3 Clocks",
                "dataType": "number",
                "description": "LENGTH | ACFM Survey"
          },
          {
                "key": "chord_thick_9clk",
                "label": "Chord Thick @ 9 Clocks",
                "dataType": "number",
                "description": "LENGTH | ACFM Survey"
          },
          {
                "key": "chord_thick_12clk",
                "label": "Chord Thick @ 12 Clocks",
                "dataType": "number",
                "description": "LENGTH | ACFM Survey"
          },
          {
                "key": "chord_thick_6clk",
                "label": "Chord Thick @ 6 Clocks",
                "dataType": "number",
                "description": "LENGTH | ACFM Survey"
          },
          {
                "key": "surface_condition_evaluation",
                "label": "Surface Condition Evaluation",
                "dataType": "text",
                "description": "Cleaning"
          },
          {
                "key": "cleaning_pressure",
                "label": "Cleaning Pressure",
                "dataType": "number",
                "description": "PRESSURE | Cleaning"
          },
          {
                "key": "calib_equipment_type",
                "label": "Equipment Type",
                "dataType": "text",
                "description": "CP Calibration"
          },
          {
                "key": "serial_number",
                "label": "Serial Number",
                "dataType": "text",
                "description": "CP Calibration"
          },
          {
                "key": "calib_block",
                "label": "Calibration Block",
                "dataType": "text",
                "description": "CP Calibration"
          },
          {
                "key": "pre_dive_cp_rdg",
                "label": "Pre-Dive CP Reading",
                "dataType": "number",
                "description": "VOLTAGE | CP Calibration"
          },
          {
                "key": "in_water1",
                "label": "In Water 1",
                "dataType": "number",
                "description": "VOLTAGE | CP Calibration"
          },
          {
                "key": "in_water2",
                "label": "In Water 2",
                "dataType": "number",
                "description": "VOLTAGE | CP Calibration"
          },
          {
                "key": "in_water3",
                "label": "In Water 3",
                "dataType": "number",
                "description": "VOLTAGE | CP Calibration"
          },
          {
                "key": "post_dive_cp_rdg",
                "label": "Post-Dive CP Reading",
                "dataType": "number",
                "description": "VOLTAGE | CP Calibration"
          },
          {
                "key": "probe_type",
                "label": "Probe Type",
                "dataType": "text",
                "description": "CP Calibration"
          },
          {
                "key": "probe_number",
                "label": "Probe Number",
                "dataType": "text",
                "description": "CP Calibration"
          },
          {
                "key": "calib_number",
                "label": "Calib Number",
                "dataType": "text",
                "description": "CP Calibration"
          },
          {
                "key": "test_value",
                "label": "Test Value",
                "dataType": "text",
                "description": "CP Calibration"
          },
          {
                "key": "pre_dive_reading",
                "label": "Pre-Dive Reading",
                "dataType": "number",
                "description": "VOLTAGE | CP Calibration"
          },
          {
                "key": "post_dive_reading",
                "label": "Post-Dive Reading",
                "dataType": "number",
                "description": "VOLTAGE | CP Calibration"
          },
          {
                "key": "pre_dive_calib_acceptable",
                "label": "Pre-Dive Calib Acceptable",
                "dataType": "boolean",
                "description": "CP Calibration"
          },
          {
                "key": "post_dive_calib_acceptable",
                "label": "Post-Dive Calib Acceptable",
                "dataType": "boolean",
                "description": "CP Calibration"
          },
          {
                "key": "probe",
                "label": "Probe",
                "dataType": "text",
                "description": "UT Calibration"
          },
          {
                "key": "probe_size",
                "label": "Probe Size",
                "dataType": "text",
                "description": "UT Calibration"
          },
          {
                "key": "probe_frequency",
                "label": "Probe Frequency",
                "dataType": "text",
                "description": "UT Calibration"
          },
          {
                "key": "label01",
                "label": "Label 01",
                "dataType": "text",
                "description": "UT Calibration"
          },
          {
                "key": "label02",
                "label": "Label 02",
                "dataType": "text",
                "description": "UT Calibration"
          },
          {
                "key": "label03",
                "label": "Label 03",
                "dataType": "text",
                "description": "UT Calibration"
          },
          {
                "key": "label04",
                "label": "Label 04",
                "dataType": "text",
                "description": "UT Calibration"
          },
          {
                "key": "label05",
                "label": "Label 05",
                "dataType": "text",
                "description": "UT Calibration"
          },
          {
                "key": "label06",
                "label": "Label 06",
                "dataType": "text",
                "description": "UT Calibration"
          },
          {
                "key": "reading01",
                "label": "Reading 01",
                "dataType": "number",
                "description": "UT Calibration"
          },
          {
                "key": "reading02",
                "label": "Reading 02",
                "dataType": "number",
                "description": "UT Calibration"
          },
          {
                "key": "reading03",
                "label": "Reading 03",
                "dataType": "number",
                "description": "UT Calibration"
          },
          {
                "key": "reading04",
                "label": "Reading 04",
                "dataType": "number",
                "description": "UT Calibration"
          },
          {
                "key": "reading05",
                "label": "Reading 05",
                "dataType": "number",
                "description": "UT Calibration"
          },
          {
                "key": "reading06",
                "label": "Reading 06",
                "dataType": "number",
                "description": "UT Calibration"
          },
          {
                "key": "no_bolts_pres_memb",
                "label": "Bolts Present",
                "dataType": "number",
                "description": "Bolted Support Inspection"
          },
          {
                "key": "no_bolts_loose_memb",
                "label": "Bolts Loose",
                "dataType": "number",
                "description": "Bolted Support Inspection"
          },
          {
                "key": "no_bolts_miss_memb",
                "label": "Bolts Missing",
                "dataType": "number",
                "description": "Bolted Support Inspection"
          },
          {
                "key": "max_gap_top_member",
                "label": "Max Gap Top",
                "dataType": "number",
                "description": "LENGTH | Bolted Support Inspection"
          },
          {
                "key": "max_gap_bottom_member",
                "label": "Max Gap Bottom",
                "dataType": "number",
                "description": "LENGTH | Bolted Support Inspection"
          },
          {
                "key": "max_flange_misalign_member",
                "label": "Max Flange Misalign",
                "dataType": "number",
                "description": "LENGTH | Bolted Support Inspection"
          },
          {
                "key": "member_clamp_cp",
                "label": "Clamp CP",
                "dataType": "number",
                "description": "VOLTAGE | Bolted Support Inspection"
          },
          {
                "key": "member_cp",
                "label": "CP 1",
                "dataType": "number",
                "description": "VOLTAGE | Bolted Support Inspection"
          },
          {
                "key": "member_cp_2",
                "label": "CP 2",
                "dataType": "number",
                "description": "VOLTAGE | Bolted Support Inspection"
          },
          {
                "key": "no_bolts_pres_brace",
                "label": "Bolts Present",
                "dataType": "number",
                "description": "Bolted Support Inspection"
          },
          {
                "key": "no_bolts_loose_brace",
                "label": "Bolts Loose",
                "dataType": "number",
                "description": "Bolted Support Inspection"
          },
          {
                "key": "no_bolts_miss_brace",
                "label": "Bolts Missing",
                "dataType": "number",
                "description": "Bolted Support Inspection"
          },
          {
                "key": "max_gap_top_brace",
                "label": "Max Gap Top",
                "dataType": "number",
                "description": "LENGTH | Bolted Support Inspection"
          },
          {
                "key": "max_gap_bottom_brace",
                "label": "Max Gap Bottom",
                "dataType": "number",
                "description": "LENGTH | Bolted Support Inspection"
          },
          {
                "key": "max_flange_misalign_brace",
                "label": "Max Flange Misalign",
                "dataType": "number",
                "description": "LENGTH | Bolted Support Inspection"
          },
          {
                "key": "appurtenance_clamp_type",
                "label": "Clamp Type",
                "dataType": "text",
                "description": "Bolted Support Inspection"
          },
          {
                "key": "appurtenance_cp",
                "label": "Appurtenance CP",
                "dataType": "number",
                "description": "VOLTAGE | Bolted Support Inspection"
          },
          {
                "key": "appurtenance_clamp_cp",
                "label": "Clamp CP",
                "dataType": "number",
                "description": "VOLTAGE | Bolted Support Inspection"
          },
          {
                "key": "stub_cp",
                "label": "Stub CP",
                "dataType": "number",
                "description": "VOLTAGE | Bolted Support Inspection"
          },
          {
                "key": "clamp_coating_satisfactory",
                "label": "Coating Satisfactory",
                "dataType": "boolean",
                "description": "Bolted Support Inspection"
          },
          {
                "key": "all_bolts_double_nutted",
                "label": "Double Nutted",
                "dataType": "boolean",
                "description": "Bolted Support Inspection"
          },
          {
                "key": "liner_present_member_end",
                "label": "Liner @ Member",
                "dataType": "boolean",
                "description": "Bolted Support Inspection"
          },
          {
                "key": "earthing_wire_or_bolt_present",
                "label": "Earthing Wire/Bolt",
                "dataType": "boolean",
                "description": "Bolted Support Inspection"
          },
          {
                "key": "liner_present_component_end",
                "label": "Liner @ Component",
                "dataType": "boolean",
                "description": "Bolted Support Inspection"
          },
          {
                "key": "washers_present_all_bolts",
                "label": "Washers Present",
                "dataType": "boolean",
                "description": "Bolted Support Inspection"
          },
          {
                "key": "magnetic_ink",
                "label": "Magnetic Ink",
                "dataType": "text",
                "description": "Magenetic Particle Inspection"
          },
          {
                "key": "magnetic_method",
                "label": "Magnetic Method",
                "dataType": "text",
                "description": "Magenetic Particle Inspection"
          },
          {
                "key": "background_condition",
                "label": "Background Condition",
                "dataType": "text",
                "description": "Magenetic Particle Inspection"
          },
          {
                "key": "magnetic_lifting_power",
                "label": "Magnetic Lifting Power",
                "dataType": "number",
                "description": "MAG | Magenetic Particle Inspection"
          },
          {
                "key": "indication",
                "label": "Indication Strength",
                "dataType": "text",
                "description": "Magenetic Particle Inspection"
          },
          {
                "key": "burmah_c_strip",
                "label": "Burmah C Strip",
                "dataType": "text",
                "description": "Magenetic Particle Inspection"
          },
          {
                "key": "brace_nominal_thickness",
                "label": "Brace Nominal Thickness",
                "dataType": "number",
                "description": "LENGTH | Magenetic Particle Inspection"
          },
          {
                "key": "chord_nominal_thickness",
                "label": "Chord Nominal Thickness",
                "dataType": "number",
                "description": "LENGTH | Magenetic Particle Inspection"
          },
          {
                "key": "cp_at_3clk",
                "label": "CP @ 3 Clocks",
                "dataType": "number",
                "description": "VOLTAGE | Magenetic Particle Inspection"
          },
          {
                "key": "cp_at_9clk",
                "label": "CP @ 9 Clocks",
                "dataType": "number",
                "description": "VOLTAGE | Magenetic Particle Inspection"
          },
          {
                "key": "cp_at_12clk",
                "label": "CP @ 12 Clocks",
                "dataType": "number",
                "description": "VOLTAGE | Magenetic Particle Inspection"
          },
          {
                "key": "cp_at_6clk",
                "label": "CP @ 6 Clocks",
                "dataType": "number",
                "description": "VOLTAGE | Magenetic Particle Inspection"
          },
          {
                "key": "current_in_coil_magnet",
                "label": "Current in Coil / Magnet",
                "dataType": "number",
                "description": "AMPERE | Magenetic Particle Inspection"
          },
          {
                "key": "voltage_in_coil_magnet",
                "label": "Voltage in Coil / Magnet",
                "dataType": "number",
                "description": "VOLTAGE | Magenetic Particle Inspection"
          },
          {
                "key": "current_pole_spacing",
                "label": "Current Pole Spacing",
                "dataType": "number",
                "description": "LENGTH | Magenetic Particle Inspection"
          },
          {
                "key": "toe_chord_6_9",
                "label": "Toe Chord 6-9",
                "dataType": "text",
                "description": "Magenetic Particle Inspection"
          },
          {
                "key": "toe_chord_9_12",
                "label": "Toe Chord 9-12",
                "dataType": "text",
                "description": "Magenetic Particle Inspection"
          },
          {
                "key": "toe_chord_12_3",
                "label": "Toe Chord 12-3",
                "dataType": "text",
                "description": "Magenetic Particle Inspection"
          },
          {
                "key": "toe_chord_3_6",
                "label": "Toe Chord 3-6",
                "dataType": "text",
                "description": "Magenetic Particle Inspection"
          },
          {
                "key": "weld_6_9",
                "label": "Weld 6-9",
                "dataType": "text",
                "description": "Magenetic Particle Inspection"
          },
          {
                "key": "weld_9_12",
                "label": "Weld 9-12",
                "dataType": "text",
                "description": "Magenetic Particle Inspection"
          },
          {
                "key": "weld_12_3",
                "label": "Weld 12-3",
                "dataType": "text",
                "description": "Magenetic Particle Inspection"
          },
          {
                "key": "weld_3_6",
                "label": "Weld 3-6",
                "dataType": "text",
                "description": "Magenetic Particle Inspection"
          },
          {
                "key": "toe_brace_6_9",
                "label": "Toe Brace 6-9",
                "dataType": "text",
                "description": "Magenetic Particle Inspection"
          },
          {
                "key": "toe_brace_9_12",
                "label": "Toe Brace 9-12",
                "dataType": "text",
                "description": "Magenetic Particle Inspection"
          },
          {
                "key": "toe_brace_12_3",
                "label": "Toe Brace 12-3",
                "dataType": "text",
                "description": "Magenetic Particle Inspection"
          },
          {
                "key": "toe_brace_3_6",
                "label": "Toe Brace 3-6",
                "dataType": "text",
                "description": "Magenetic Particle Inspection"
          },
          {
                "key": "demagnetised",
                "label": "Demagnetised",
                "dataType": "boolean",
                "description": "Magenetic Particle Inspection"
          },
          {
                "key": "wall_thickness",
                "label": "Wall Thickness",
                "dataType": "number",
                "description": "LENGTH | Riser Survey"
          },
          {
                "key": "riserbend_elevation",
                "label": "Riserbend Elevation",
                "dataType": "number",
                "description": "LENGTH | Riser Survey"
          },
          {
                "key": "span_height",
                "label": "Span Height",
                "dataType": "number",
                "description": "LENGTH | Riser Survey"
          },
          {
                "key": "mgi_hard_growth",
                "label": "MGI Hard Growth",
                "dataType": "number",
                "description": "PERCENTAGE | Marine Growth Removal"
          },
          {
                "key": "mgi_soft_growth",
                "label": "MGI Soft Growth",
                "dataType": "number",
                "description": "PERCENTAGE | Marine Growth Removal"
          },
          {
                "key": "circumferential_measurement_5m_above",
                "label": "Circumferential Measurement 5m above",
                "dataType": "number",
                "description": "LENGTH | Marine Growth Removal"
          },
          {
                "key": "circumferential_measurement_0m",
                "label": "Circumferential Measurement 0m",
                "dataType": "number",
                "description": "LENGTH | Marine Growth Removal"
          },
          {
                "key": "circumferential_measurement_5m_below",
                "label": "Circumferential Measurement 5m below",
                "dataType": "number",
                "description": "LENGTH | Marine Growth Removal"
          },
          {
                "key": "effective_thickness",
                "label": "Effective Thickness",
                "dataType": "number",
                "description": "LENGTH | Marine Growth Removal"
          },
          {
                "key": "hard_circum",
                "label": "Hard MGI",
                "dataType": "boolean",
                "description": "Marine Growth Removal"
          },
          {
                "key": "soft_circum",
                "label": "Soft MGI",
                "dataType": "boolean",
                "description": "Marine Growth Removal"
          },
          {
                "key": "growth_circum",
                "label": "Growth Circum %",
                "dataType": "number",
                "description": "PERCENTAGE | Marine Growth Removal"
          },
          {
                "key": "coating_damage",
                "label": "Coating Damage",
                "dataType": "boolean",
                "description": "Marine Growth Removal"
          },
          {
                "key": "nominal_diameter",
                "label": "Nominal Diameter",
                "dataType": "number",
                "description": "LENGTH | Marine Growth Removal"
          },
          {
                "key": "calibration_checked",
                "label": "Calibration Checked",
                "dataType": "boolean",
                "description": "Cathodic Protection Survey"
          },
          {
                "key": "scour_location",
                "label": "Scour Location",
                "dataType": "text",
                "description": "Scour Survey Inspection"
          },
          {
                "key": "scour_depth",
                "label": "Scour Depth",
                "dataType": "number",
                "description": "LENGTH | Scour Survey Inspection"
          },
          {
                "key": "Exposed_pile",
                "label": "Exposed Pile",
                "dataType": "boolean",
                "description": "Scour Survey Inspection"
          },
          {
                "key": "Burial_percent",
                "label": "Burial Percent",
                "dataType": "number",
                "description": "PERCENTAGE | Scour Survey Inspection"
          },
          {
                "key": "flooded",
                "label": "Flooded",
                "dataType": "boolean",
                "description": "Flooded Member Inspection"
          },
          {
                "key": "grout",
                "label": "Grouted",
                "dataType": "boolean",
                "description": "Flooded Member Inspection"
          },
          {
                "key": "item_type",
                "label": "Type of Item",
                "dataType": "text",
                "description": "Item Inspection"
          },
          {
                "key": "camera_type",
                "label": "Camera Type",
                "dataType": "text",
                "description": "Photographic Inspection"
          },
          {
                "key": "subject_of_photo",
                "label": "Subject of Photo",
                "dataType": "text",
                "description": "Photographic Inspection"
          },
          {
                "key": "exposure_number",
                "label": "Exposure #",
                "dataType": "text",
                "description": "Photographic Inspection"
          },
          {
                "key": "photo_no",
                "label": "Photo #",
                "dataType": "number",
                "description": "Photographic Inspection"
          },
          {
                "key": "measurement",
                "label": "Measurements",
                "dataType": "json",
                "description": "Measurement Dimensional Survey"
          },
          {
                "key": "coating_coverage_percent",
                "label": "Coating Coverage Percent",
                "dataType": "number",
                "description": "PERCENTAGE | Splash Zone Inspection"
          },
          {
                "key": "anode_type",
                "label": "Anode Type",
                "dataType": "text",
                "description": "Selected Anode Inspection"
          },
          {
                "key": "anode_length",
                "label": "Anode Length",
                "dataType": "number",
                "description": "LENGTH | Selected Anode Inspection"
          },
          {
                "key": "anode_depletion_percent",
                "label": "Anode Depletion",
                "dataType": "number",
                "description": "PERCENTAGE | Selected Anode Inspection"
          },
          {
                "key": "anode_cp",
                "label": "Anode CP",
                "dataType": "number",
                "description": "VOLTAGE | Selected Anode Inspection"
          },
          {
                "key": "topstub_cp",
                "label": "Top stub CP",
                "dataType": "number",
                "description": "VOLTAGE | Selected Anode Inspection"
          },
          {
                "key": "bottomstub_cp",
                "label": "Bottom stub CP",
                "dataType": "number",
                "description": "VOLTAGE | Selected Anode Inspection"
          },
          {
                "key": "max_pitting_depth",
                "label": "Max Pitting Depth",
                "dataType": "number",
                "description": "LENGTH | Selected Anode Inspection"
          },
          {
                "key": "avg_pitting_depth",
                "label": "Avg Pitting Depth",
                "dataType": "number",
                "description": "LENGTH | Selected Anode Inspection"
          },
          {
                "key": "max_pitting_diameter",
                "label": "Max Pitting Diameter",
                "dataType": "number",
                "description": "LENGTH | Selected Anode Inspection"
          },
          {
                "key": "avg_pitting_diameter",
                "label": "Avg Pitting Diameter",
                "dataType": "number",
                "description": "LENGTH | Selected Anode Inspection"
          },
          {
                "key": "circumference_c1",
                "label": "Circumference C1",
                "dataType": "number",
                "description": "LENGTH | Selected Anode Inspection"
          },
          {
                "key": "circumference_c2",
                "label": "Circumference C2",
                "dataType": "number",
                "description": "LENGTH | Selected Anode Inspection"
          },
          {
                "key": "circumference_c3",
                "label": "Circumference C3",
                "dataType": "number",
                "description": "LENGTH | Selected Anode Inspection"
          },
          {
                "key": "anode_secured_to_structure",
                "label": "Anode Secured to Structure",
                "dataType": "boolean",
                "description": "Selected Anode Inspection"
          },
          {
                "key": "avg_reading",
                "label": "Avg Thickness",
                "dataType": "number",
                "description": "LENGTH | UT Wall Thickness"
          },
          {
                "key": "min_reading",
                "label": "Min Thickness",
                "dataType": "number",
                "description": "LENGTH | UT Wall Thickness"
          },
          {
                "key": "max_reading",
                "label": "Max Thickness",
                "dataType": "number",
                "description": "LENGTH | UT Wall Thickness"
          },
          {
                "key": "wall_thickness_loss",
                "label": "Wall Thickness Loss",
                "dataType": "number",
                "description": "LENGTH | UT Wall Thickness"
          },
          {
                "key": "%_wall_thickness_loss",
                "label": "% Wall Thickness Loss",
                "dataType": "number",
                "description": "PERCENTAGE | UT Wall Thickness"
          },
          {
                "key": "size_of_area_tested",
                "label": "Size of Area Tested",
                "dataType": "text",
                "description": "UT Wall Thickness"
          },
          {
                "key": "reference_point_position",
                "label": "Reference Point Position",
                "dataType": "text",
                "description": "UT Wall Thickness"
          },
          {
                "key": "scan_type",
                "label": "Scan Type",
                "dataType": "text",
                "description": "UT Wall Thickness"
          },
          {
                "key": "event_name",
                "label": "Event Name",
                "dataType": "text",
                "description": "Pipeline Navigation Inspection"
          },
          {
                "key": "event_type",
                "label": "Event Type",
                "dataType": "text",
                "description": "Pipeline Navigation Inspection"
          },
          {
                "key": "event_description",
                "label": "Event Description",
                "dataType": "text",
                "description": "Pipeline Navigation Inspection"
          },
          {
                "key": "event_position",
                "label": "Event Position",
                "dataType": "text",
                "description": "Pipeline Navigation Inspection"
          },
          {
                "key": "flow_direction",
                "label": "Flow Direction",
                "dataType": "text",
                "description": "Pipeline Navigation Inspection"
          },
          {
                "key": "insp_mode",
                "label": "Inspection Mode",
                "dataType": "text",
                "description": "Pipeline Navigation Inspection"
          },
          {
                "key": "cp_fg_rdg",
                "label": "CP FG Reading",
                "dataType": "number",
                "description": "VOLTAGE | Pipeline Navigation Inspection"
          },
          {
                "key": "rov_heading",
                "label": "ROV Heading",
                "dataType": "number",
                "description": "ANGLE | Pipeline Navigation Inspection"
          },
          {
                "key": "height",
                "label": "Height",
                "dataType": "number",
                "description": "LENGTH | Pipeline Navigation Inspection"
          },
          {
                "key": "raw_fp",
                "label": "Raw FP",
                "dataType": "text",
                "description": "Pipeline Navigation Inspection"
          },
          {
                "key": "raw_northing",
                "label": "Raw Northing",
                "dataType": "number",
                "description": "LENGTH | Pipeline Navigation Inspection"
          },
          {
                "key": "raw_easting",
                "label": "Raw Easting",
                "dataType": "number",
                "description": "LENGTH | Pipeline Navigation Inspection"
          },
          {
                "key": "raw_length",
                "label": "Raw Length",
                "dataType": "number",
                "description": "LENGTH | Pipeline Navigation Inspection"
          },
          {
                "key": "crossing_angle",
                "label": "Crossing Angle",
                "dataType": "number",
                "description": "ANGLE | Pipeline Navigation Inspection"
          },
          {
                "key": "crossing_gap",
                "label": "Gap",
                "dataType": "number",
                "description": "LENGTH | Pipeline Navigation Inspection"
          },
          {
                "key": "num_supports",
                "label": "Number of Supports",
                "dataType": "number",
                "description": "NONE | Pipeline Navigation Inspection"
          },
          {
                "key": "crossing_line",
                "label": "Crossing Line",
                "dataType": "text",
                "description": "Pipeline Navigation Inspection"
          },
          {
                "key": "crossing_type",
                "label": "Crossing Type",
                "dataType": "text",
                "description": "Pipeline Navigation Inspection"
          },
          {
                "key": "crossing_fp",
                "label": "Crossing FP",
                "dataType": "number",
                "description": "LENGTH | Pipeline Navigation Inspection"
          },
          {
                "key": "anode_depletion",
                "label": "Anode Depletion",
                "dataType": "text",
                "description": "Selected Anode Inspection"
          },
          {
                "key": "riser_item",
                "label": "Riser Part",
                "dataType": "text",
                "description": "Riser Structural Integrity Inspection"
          },
          {
                "key": "distance_from_member",
                "label": "Distance From Member",
                "dataType": "number",
                "description": "LENGTH | Riser Structural Integrity Inspection"
          },
          {
                "key": "suspention_height",
                "label": "Suspention Height",
                "dataType": "number",
                "description": "LENGTH | Riser Structural Integrity Inspection"
          },
          {
                "key": "category",
                "label": "Item Category",
                "dataType": "text",
                "description": "Seabed Inspection"
          },
          {
                "key": "material",
                "label": "Material",
                "dataType": "text",
                "description": "Seabed Inspection"
          },
          {
                "key": "size_length",
                "label": "Size Length",
                "dataType": "number",
                "description": "LENGTH | Seabed Inspection"
          },
          {
                "key": "size_width",
                "label": "Size Width",
                "dataType": "number",
                "description": "LENGTH | Seabed Inspection"
          },
          {
                "key": "size_height",
                "label": "Size Height",
                "dataType": "number",
                "description": "LENGTH | Seabed Inspection"
          },
          {
                "key": "size_diameter",
                "label": "Size Diameter",
                "dataType": "number",
                "description": "LENGTH | Seabed Inspection"
          },
          {
                "key": "debris_desc",
                "label": "Debris Description",
                "dataType": "text",
                "description": "Seabed Inspection"
          },
          {
                "key": "seepage_intensity",
                "label": "Seepage Intensity",
                "dataType": "text",
                "description": "Seabed Inspection"
          },
          {
                "key": "crater_diameter",
                "label": "Crater Diameter",
                "dataType": "number",
                "description": "LENGTH | Seabed Inspection"
          },
          {
                "key": "crater_depth",
                "label": "Crater Depth",
                "dataType": "number",
                "description": "LENGTH | Seabed Inspection"
          },
          {
                "key": "nearest_leg",
                "label": "Nearest Leg",
                "dataType": "text",
                "description": "Seabed Inspection"
          },
          {
                "key": "distance_from_leg",
                "label": "Distance From Leg",
                "dataType": "number",
                "description": "LENGTH | Seabed Inspection"
          },
          {
                "key": "x",
                "label": "X Coordinate (%)",
                "dataType": "number",
                "description": "Seabed Inspection"
          },
          {
                "key": "y",
                "label": "Y Coordinate (%)",
                "dataType": "number",
                "description": "Seabed Inspection"
          },
          {
                "key": "water_depth",
                "label": "Water Depth",
                "dataType": "number",
                "description": "LENGTH | Water Depth Inspection"
          },
          {
                "key": "member_status",
                "label": "Member Status",
                "dataType": "text",
                "description": "Flooded Member Detection"
          },
          {
                "key": "test_point_location",
                "label": "Test Point Location",
                "dataType": "text",
                "description": "Flooded Member Detection"
          },
          {
                "key": "density_value",
                "label": "Density Value",
                "dataType": "number",
                "description": "DENSITY | Flooded Member Detection"
          },
          {
                "key": "angle_rdg",
                "label": "Angle Reading",
                "dataType": "number",
                "description": "ANGLE | Inclinometer Reading"
          },
          {
                "key": "inc_reading_additional",
                "label": "Inclinometer Reading Additional",
                "dataType": "json",
                "description": "Inclinometer Reading"
          },
          {
                "key": "position",
                "label": "Position",
                "dataType": "text",
                "description": "Anodes Maintainance Inspection"
          },
          {
                "key": "fitting",
                "label": "Fitting",
                "dataType": "text",
                "description": "Anodes Maintainance Inspection"
          },
          {
                "key": "installed_date",
                "label": "Installed Date",
                "dataType": "date",
                "description": "Anodes Maintainance Inspection"
          },
          {
                "key": "material_alloy",
                "label": "Material Alloy",
                "dataType": "text",
                "description": "Anodes Maintainance Inspection"
          },
          {
                "key": "installed_type",
                "label": "Installed Type",
                "dataType": "text",
                "description": "Anodes Maintainance Inspection"
          },
          {
                "key": "life",
                "label": "Life",
                "dataType": "number",
                "description": "TIME | Anodes Maintainance Inspection"
          },
          {
                "key": "replaced",
                "label": "Replaced",
                "dataType": "boolean",
                "description": "Anodes Maintainance Inspection"
          },
          {
                "key": "angle",
                "label": "Angle",
                "dataType": "number",
                "description": "ANGLE | Item Maintenance Inspection"
          },
          {
                "key": "dimension1",
                "label": "Dimension 1",
                "dataType": "number",
                "description": "LENGTH | Item Maintenance Inspection"
          },
          {
                "key": "dimension2",
                "label": "Dimension 2",
                "dataType": "number",
                "description": "LENGTH | Item Maintenance Inspection"
          },
          {
                "key": "dimension3",
                "label": "Dimension 3",
                "dataType": "number",
                "description": "LENGTH | Item Maintenance Inspection"
          },
          {
                "key": "comments",
                "label": "Comments",
                "dataType": "text",
                "description": "Item Maintenance Inspection"
          },
          {
                "key": "cr_user",
                "label": "Create User",
                "dataType": "text",
                "description": "User who created the inspection record"
          },
          {
                "key": "cr_date",
                "label": "Create Date",
                "dataType": "date",
                "description": "Record creation date"
          },
          {
                "key": "md_user",
                "label": "Modified User",
                "dataType": "text",
                "description": "User who last modified the inspection record"
          },
          {
                "key": "md_date",
                "label": "Modified Date",
                "dataType": "date",
                "description": "Record last modification date"
          }
    ],
  },
  {
    id: "anomalies",
    label: "Anomalies",
    description: "Inspection anomalies and defects",
    icon: "AlertTriangle",
    table: "v_smart_query_anomalies",
    fields: [
      { key: "anomaly_id", label: "Anomaly ID", dataType: "number", description: "Unique anomaly identifier" },
      { key: "anomaly_ref_no", label: "Reference No", dataType: "text", description: "Anomaly reference number" },
      { key: "structure_name", label: "Structure Name", dataType: "text", description: "Parent structure" },
      { key: "structure_spec_type", label: "Structure Type", dataType: "text", description: "Type classification" },
      
      // Component Details
      { key: "component_id_str", label: "Component ID", dataType: "text", description: "Parent component identifier" },
      { key: "component_id_no", label: "Component ID No", dataType: "text", description: "Component ID number" },
      { key: "component_qid", label: "Component QID", dataType: "number", description: "Component queue ID" },
      { key: "component_description", label: "Component Description", dataType: "text", description: "Component description" },
      { key: "start_node", label: "Start Node", dataType: "text", description: "Start node" },
      { key: "end_node", label: "End Node", dataType: "text", description: "End node" },
      { key: "elevation1", label: "Elevation 1", dataType: "text", description: "Elevation 1" },
      { key: "elevation2", label: "Elevation 2", dataType: "text", description: "Elevation 2" },

      { key: "jobpack_name", label: "Job Pack", dataType: "text", description: "Linked job pack" },
      { key: "disc_date", label: "Discovery Date", dataType: "date", description: "Date of discovery" },
      { key: "status", label: "Status", dataType: "text", description: "OPEN or CLOSED" },
      { key: "priority_code", label: "Priority", dataType: "text", description: "P1, P2, P3, etc." },
      { key: "defect_description", label: "Defect Description", dataType: "text", description: "Detailed defect description" },
      { key: "recommended_action", label: "Recommended Action", dataType: "text", description: "Recommended corrective action" },

      // Audit User & Date Fields
      { key: "cr_user", label: "Create User", dataType: "text", description: "User who created the anomaly" },
      { key: "cr_date", label: "Create Date", dataType: "date", description: "Anomaly creation date" },
      { key: "md_user", label: "Modified User", dataType: "text", description: "User who last modified the anomaly" },
      { key: "md_date", label: "Modified Date", dataType: "date", description: "Anomaly last modification date" },
    ],
  },
  {
    id: "findings",
    label: "Findings",
    description: "Inspection findings (non-anomaly observations)",
    icon: "Search",
    table: "v_smart_query_findings",
    fields: [
      { key: "anomaly_id", label: "Finding ID", dataType: "number", description: "Unique finding identifier" },
      { key: "structure_name", label: "Structure Name", dataType: "text", description: "Parent structure" },
      
      // Component Details
      { key: "component_id_str", label: "Component ID", dataType: "text", description: "Parent component identifier" },
      { key: "component_id_no", label: "Component ID No", dataType: "text", description: "Component ID number" },
      { key: "component_qid", label: "Component QID", dataType: "number", description: "Component queue ID" },
      { key: "component_description", label: "Component Description", dataType: "text", description: "Component description" },
      { key: "start_node", label: "Start Node", dataType: "text", description: "Start node" },
      { key: "end_node", label: "End Node", dataType: "text", description: "End node" },
      { key: "elevation1", label: "Elevation 1", dataType: "text", description: "Elevation 1" },
      { key: "elevation2", label: "Elevation 2", dataType: "text", description: "Elevation 2" },

      { key: "disc_date", label: "Observation Date", dataType: "date", description: "Date of observation" },
      { key: "defect_description", label: "Finding Description", dataType: "text", description: "Observation details" },

      // Audit User & Date Fields
      { key: "cr_user", label: "Create User", dataType: "text", description: "User who created the finding" },
      { key: "cr_date", label: "Create Date", dataType: "date", description: "Finding creation date" },
      { key: "md_user", label: "Modified User", dataType: "text", description: "User who last modified the finding" },
      { key: "md_date", label: "Modified Date", dataType: "date", description: "Finding last modification date" },
    ],
  },
  {
    id: "incomplete",
    label: "Incomplete",
    description: "Incomplete inspection records requiring follow-up",
    icon: "Clock",
    table: "v_smart_query_incomplete",
    fields: [
      { key: "insp_id", label: "Inspection ID", dataType: "number", description: "Unique record ID" },
      { key: "structure_name", label: "Structure Name", dataType: "text", description: "Target structure" },
      
      // Component Details
      { key: "component_id_str", label: "Component ID", dataType: "text", description: "Target component identifier" },
      { key: "component_id_no", label: "Component ID No", dataType: "text", description: "Component ID number" },
      { key: "component_qid", label: "Component QID", dataType: "number", description: "Component queue ID" },
      { key: "component_description", label: "Component Description", dataType: "text", description: "Component description" },
      { key: "start_node", label: "Start Node", dataType: "text", description: "Start node" },
      { key: "end_node", label: "End Node", dataType: "text", description: "End node" },
      { key: "elevation1", label: "Elevation 1", dataType: "text", description: "Elevation 1" },
      { key: "elevation2", label: "Elevation 2", dataType: "text", description: "Elevation 2" },

      { key: "inspection_type_code", label: "Inspection Type", dataType: "text", description: "Planned inspection type" },
      { key: "incomplete_reason", label: "Reason", dataType: "text", description: "Reason for incomplete status" },

      // Audit User & Date Fields
      { key: "cr_user", label: "Create User", dataType: "text", description: "User who created the record" },
      { key: "cr_date", label: "Create Date", dataType: "date", description: "Record creation date" },
      { key: "md_user", label: "Modified User", dataType: "text", description: "User who last modified the record" },
      { key: "md_date", label: "Modified Date", dataType: "date", description: "Record last modification date" },
    ],
  },
];

// ─── COMPUTED OPERATIONS ───────────────────────────────────────────────────

export interface ComputedFieldOp {
  id: string;
  label: string;
  group: "arithmetic" | "string" | "date";
  description: string;
  applicableTo: FieldDataType[];
  params: { name: string; label: string; type: "number" | "text" }[];
}

export const COMPUTED_OPERATIONS: ComputedFieldOp[] = [
  { id: "multiply", label: "Multiply", group: "arithmetic", description: "Multiply by number", applicableTo: ["number"], params: [{ name: "factor", label: "Multiply by", type: "number" }] },
  { id: "divide", label: "Divide", group: "arithmetic", description: "Divide by number", applicableTo: ["number"], params: [{ name: "divisor", label: "Divide by", type: "number" }] },
  { id: "add", label: "Add", group: "arithmetic", description: "Add number", applicableTo: ["number"], params: [{ name: "addend", label: "Add", type: "number" }] },
  { id: "subtract", label: "Subtract", group: "arithmetic", description: "Subtract number", applicableTo: ["number"], params: [{ name: "subtrahend", label: "Subtract", type: "number" }] },
  { id: "round", label: "Round", group: "arithmetic", description: "Round to decimals", applicableTo: ["number"], params: [{ name: "decimals", label: "Decimals", type: "number" }] },
  { id: "uppercase", label: "UPPERCASE", group: "string", description: "To uppercase", applicableTo: ["text"], params: [] },
  { id: "lowercase", label: "lowercase", group: "string", description: "To lowercase", applicableTo: ["text"], params: [] },
  { id: "year", label: "Year", group: "date", description: "Extract year", applicableTo: ["date"], params: [] },
];

// ─── OPERATORS ──────────────────────────────────────────────────────────────

export interface OperatorDef {
  id: string;
  label: string;
  symbol: string;
  applicableTo: FieldDataType[];
  requiresValue: boolean;
  valueCount: 1 | 2 | 0;
}

export const QUERY_OPERATORS: OperatorDef[] = [
  { id: "eq", label: "Equals", symbol: "=", applicableTo: ["text", "number", "date", "boolean"], requiresValue: true, valueCount: 1 },
  { id: "neq", label: "Not Equals", symbol: "!=", applicableTo: ["text", "number", "date"], requiresValue: true, valueCount: 1 },
  { id: "contains", label: "Contains", symbol: "~", applicableTo: ["text"], requiresValue: true, valueCount: 1 },
  { id: "starts_with", label: "Starts With", symbol: "^", applicableTo: ["text"], requiresValue: true, valueCount: 1 },
  { id: "ends_with", label: "Ends With", symbol: "$", applicableTo: ["text"], requiresValue: true, valueCount: 1 },
  { id: "is_empty", label: "Is Empty", symbol: "∅", applicableTo: ["text", "json"], requiresValue: false, valueCount: 0 },
  { id: "is_not_empty", label: "Is Not Empty", symbol: "∃", applicableTo: ["text", "json"], requiresValue: false, valueCount: 0 },
  { id: "gt", label: "Greater Than", symbol: ">", applicableTo: ["number", "date"], requiresValue: true, valueCount: 1 },
  { id: "lt", label: "Less Than", symbol: "<", applicableTo: ["number", "date"], requiresValue: true, valueCount: 1 },
  { id: "gte", label: "Greater or Equal", symbol: ">=", applicableTo: ["number", "date"], requiresValue: true, valueCount: 1 },
  { id: "lte", label: "Less or Equal", symbol: "<=", applicableTo: ["number", "date"], requiresValue: true, valueCount: 1 },
  { id: "between", label: "Between", symbol: "↔", applicableTo: ["number", "date"], requiresValue: true, valueCount: 2 },
  { id: "is_true", label: "Is True", symbol: "✓", applicableTo: ["boolean"], requiresValue: false, valueCount: 0 },
  { id: "is_false", label: "Is False", symbol: "✗", applicableTo: ["boolean"], requiresValue: false, valueCount: 0 },
];

// ─── NATURAL LANGUAGE PARSER ───────────────────────────────────────────────

const FIELD_ALIASES: Record<string, string[]> = {
  plegs: ["legged", "legs", "leg count"],
  depth: ["water depth", "deep", "shallow"],
  title: ["named", "called", "name"],
  priority_code: ["priority", "criticality"],
  status: ["state", "stage"],
  inst_date: ["installed", "installation"],
  line_diam: ["diameter", "diam"],
  structure_name: ["platform name", "structure"],
  cr_user: ["created by", "create user", "creator", "created user"],
  created_by: ["created by", "create user", "creator", "created user"],
  cr_date: ["created date", "create date", "created at", "creation date"],
  created_at: ["created date", "create date", "created at", "creation date"],
  md_user: ["modified by", "modified user", "updated by", "updater"],
  modified_by: ["modified by", "modified user", "updated by", "updater"],
  updated_by: ["modified by", "modified user", "updated by", "updater"],
  md_date: ["modified date", "modified at", "updated date", "updated at"],
  updated_at: ["modified date", "modified at", "updated date", "updated at"],
};

export function parseNaturalLanguage(input: string, availableFields: FieldDef[]): ConditionRule[] {
  if (!input.trim()) return [];
  
  // Clean input
  const cleanInput = input.trim().toLowerCase().replace(/\ball\b/g, "").replace(/\bplatforms?\b/g, "").replace(/\bstructures?\b/g, "").trim();
  const conditions: ConditionRule[] = [];
  
  // Split by logical separators
  const parts = cleanInput.split(/\b(and|or)\b/i);
  let currentLogic: "AND" | "OR" = "AND";

  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part) continue;
    if (part === "and") { currentLogic = "AND"; continue; }
    if (part === "or") { currentLogic = "OR"; continue; }

    let matchedField: FieldDef | undefined;
    let operator = "eq";
    let value = "";
    let transform: string | undefined;

    // 1. Find Field (Fuzzy)
    // Sort fields by length descending to match longest possible label first
    const sortedFields = [...availableFields].sort((a, b) => b.label.length - a.label.length);
    
    for (const f of sortedFields) {
      const aliases = FIELD_ALIASES[f.key] || [];
      const keywords = [f.label.toLowerCase(), f.key.toLowerCase(), ...aliases];
      
      if (keywords.some(k => part.includes(k))) {
        matchedField = f;

        // Check for transformations (e.g. "year of", "in 2024")
        if (f.dataType === "date") {
          if (part.includes("year") || part.match(/\b(in|during)\s+\d{4}\b/)) {
            transform = "year";
          }
        }

        // Check if we can find a number if the field is numeric or has year transform
        if (f.dataType === "number" || transform === "year") {
          const numMatch = part.match(/\d+(?:\.\d+)?/);
          if (numMatch) {
            value = numMatch[0];
            // Infer operator if possible
            if (part.match(/more than|greater|above|>/)) operator = "gt";
            else if (part.match(/less than|below|under|</)) operator = "lt";
            else if (part.match(/at least|>=/)) operator = "gte";
            else if (part.match(/at most|<=/)) operator = "lte";
          }
        }
        break;
      }
    }

    if (matchedField && (value || operator === "is_empty" || operator === "is_not_empty")) {
      conditions.push({
        field: matchedField.key,
        operator,
        value: value,
        logic: currentLogic,
        transform: transform
      });
      continue;
    }

    // 2. Regex Pattern Matching (Fallback/Specific)
    if (matchedField && !value) {
      const opPatterns: { pattern: RegExp; operator: string }[] = [
          { pattern: /(?:is|equals?|=)\s+(.+)$/i, operator: "eq" },
          { pattern: /(?:is not|not equals?|!=|<>)\s+(.+)$/i, operator: "neq" },
          { pattern: /(?:contains?|includes?|like)\s+(.+)$/i, operator: "contains" },
          { pattern: /(?:starts? with|begins? with)\s+(.+)$/i, operator: "starts_with" },
          { pattern: /(?:ends? with)\s+(.+)$/i, operator: "ends_with" },
          { pattern: /(?:is empty|is null)$/i, operator: "is_empty" },
          { pattern: /(?:is not empty|is not null)$/i, operator: "is_not_empty" },
          { pattern: /(?:between)\s+(.+?)\s+(?:and|to)\s+(.+)$/i, operator: "between" },
      ];

      for (const { pattern, operator: op } of opPatterns) {
        const match = part.match(pattern);
        if (match) {
          operator = op;
          value = match[1]?.trim() || "";
          break;
        }
      }
    }

    // 3. Last Resort: Implicit Value Match (e.g. "P1 priority" where field is detected but no operator)
    if (matchedField && !value) {
      // Try to find any word that isn't a keyword/operator as the value
      const words = part.split(/\s+/);
      const aliases = FIELD_ALIASES[matchedField.key] || [];
      const keywords = [matchedField.label.toLowerCase(), matchedField.key.toLowerCase(), ...aliases];
      
      const potentialValue = words.find(w => !keywords.some(k => k.includes(w)) && !["is", "equal", "to", "at"].includes(w));
      if (potentialValue) {
        value = potentialValue;
      }
    }

    if (matchedField && (value || operator === "is_empty" || operator === "is_not_empty")) {
      conditions.push({
        field: matchedField.key,
        operator,
        value: value,
        logic: currentLogic,
        transform: transform
      });
    }
  }

  return conditions;
}

/** Get category definition by ID */
export function getCategoryById(id: string): CategoryDef | undefined {
  return QUERY_CATEGORIES.find(c => c.id === id);
}

/** Get field definition from a category */
export function getFieldByKey(categoryId: string, fieldKey: string): FieldDef | undefined {
  const cat = getCategoryById(categoryId);
  return cat?.fields.find(f => f.key === fieldKey);
}

/** Get operators applicable to a field data type */
export function getOperatorsForType(dataType: FieldDataType): OperatorDef[] {
  return QUERY_OPERATORS.filter(op => op.applicableTo.includes(dataType));
}

/** Get computed operations applicable to a field data type */
export function getOperationsForType(dataType: FieldDataType): ComputedFieldOp[] {
  return COMPUTED_OPERATIONS.filter(op => op.applicableTo.includes(dataType));
}

/** Apply a computed operation to a raw value */
export function applyComputedOp(
  value: any,
  operation: string,
  params: Record<string, string | number>
): any {
  if (value === null || value === undefined) return null;
  switch (operation) {
    case "multiply": return Number(value) * Number(params.factor || 1);
    case "divide": return Number(params.divisor || 1) !== 0 ? Number(value) / Number(params.divisor || 1) : null;
    case "add": return Number(value) + Number(params.addend || 0);
    case "subtract": return Number(value) - Number(params.subtrahend || 0);
    case "round": return Number(Number(value).toFixed(Number(params.decimals || 0)));
    case "uppercase": return String(value).toUpperCase();
    case "lowercase": return String(value).toLowerCase();
    case "year": return new Date(value).getFullYear();
    default: return value;
  }
}
