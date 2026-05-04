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
    ],
  },
  {
    id: "inspection_records",
    label: "Inspection Records",
    description: "All inspection recordings and measurement data",
    icon: "ClipboardCheck",
    table: "v_smart_query_inspection_records",
    fields: [
      { key: "insp_id", label: "Inspection ID", dataType: "number", description: "Unique inspection record ID" },
      { key: "structure_name", label: "Structure Name", dataType: "text", description: "Inspected structure" },
      { key: "structure_spec_type", label: "Structure Type", dataType: "text", description: "Type classification" },
      
      // Component Details
      { key: "component_id_str", label: "Component ID", dataType: "text", description: "Inspected component identifier" },
      { key: "component_id_no", label: "Component ID No", dataType: "text", description: "Component ID number" },
      { key: "component_qid", label: "Component QID", dataType: "number", description: "Component queue ID" },
      { key: "component_description", label: "Component Description", dataType: "text", description: "Component description" },
      { key: "start_node", label: "Start Node", dataType: "text", description: "Start node" },
      { key: "end_node", label: "End Node", dataType: "text", description: "End node" },
      { key: "elevation1", label: "Elevation 1", dataType: "text", description: "Elevation 1" },
      { key: "elevation2", label: "Elevation 2", dataType: "text", description: "Elevation 2" },

      { key: "jobpack_name", label: "Job Pack", dataType: "text", description: "Linked job pack" },
      { key: "inspection_type_code", label: "Inspection Type", dataType: "text", description: "Type of inspection" },
      { key: "status", label: "Status", dataType: "text", description: "COMPLETED, INCOMPLETE, PENDING" },
      { key: "inspection_date", label: "Inspection Date", dataType: "date", description: "Date of inspection" },
      
      // Measurement Data Fields
      { key: "marine_growth", label: "Marine Growth", dataType: "text", description: "Marine growth details" },
      { key: "coating_condition", label: "Coating Condition", dataType: "text", description: "Condition of coating" },
      { key: "component_condition", label: "Component Condition", dataType: "text", description: "Overall condition" },
      { key: "nominal_thickness", label: "Nominal Thickness", dataType: "text", description: "Nominal thickness" },
      { key: "verification_depth", label: "Verification Depth", dataType: "text", description: "Depth of verification" },
      { key: "ut_12_o_clock", label: "UT 12:00", dataType: "text", description: "UT reading at 12:00" },
      { key: "ut_3_o_clock", label: "UT 03:00", dataType: "text", description: "UT reading at 03:00" },
      { key: "ut_6_o_clock", label: "UT 06:00", dataType: "text", description: "UT reading at 06:00" },
      { key: "ut_9_o_clock", label: "UT 09:00", dataType: "text", description: "UT reading at 09:00" },
      { key: "cp_reading", label: "CP Reading", dataType: "text", description: "CP potential reading" },
      { key: "pre_dive_cp_rdg", label: "Pre-Dive CP", dataType: "text", description: "Pre-dive CP reading" },
      { key: "post_dive_cp_rdg", label: "Post-Dive CP", dataType: "text", description: "Post-dive CP reading" },
      { key: "scour_depth", label: "Scour Depth", dataType: "text", description: "Depth of scour" },
      { key: "scour_location", label: "Scour Location", dataType: "text", description: "Location of scour" },
      { key: "finding_type", label: "Finding Type", dataType: "text", description: "Classification of finding" },
      { key: "debris_info", label: "Debris Info", dataType: "text", description: "Debris details" },
      { key: "distance_info", label: "Distance Info", dataType: "text", description: "Distance from leg/member" },
      { key: "anode_depletion", label: "Anode Depletion", dataType: "text", description: "Percentage of depletion" },
      { key: "anode_type", label: "Anode Type", dataType: "text", description: "Type of anode" },
      { key: "seepage_intensity", label: "Seepage Intensity", dataType: "text", description: "Intensity of seepage" },
      { key: "mgi_profile", label: "MGI Profile", dataType: "text", description: "Marine growth profile" },
      { key: "mgi_thickness_at", label: "MGI Thickness At", dataType: "text", description: "Thickness at point" },
      { key: "mgi_hard_thickness", label: "MGI Hard Thickness", dataType: "text", description: "Hard growth thickness" },
      { key: "mgi_soft_thickness", label: "MGI Soft Thickness", dataType: "text", description: "Soft growth thickness" },
      { key: "calib_block", label: "Calibration Block", dataType: "text", description: "UT calibration block" },
      { key: "serial_number", label: "Serial Number", dataType: "text", description: "Equipment serial number" },
      { key: "calib_equipment_type", label: "Equipment Type", dataType: "text", description: "Calibration equipment" },
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

export function parseNaturalLanguage(input: string, availableFields: FieldDef[]): ConditionRule[] {
  if (!input.trim()) return [];
  const conditions: ConditionRule[] = [];
  const parts = input.split(/\b(and|or)\b/i);
  let currentLogic: "AND" | "OR" = "AND";

  for (const rawPart of parts) {
    const part = rawPart.trim();
    const partLower = part.toLowerCase();
    if (!part) continue;
    if (partLower === "and") { currentLogic = "AND"; continue; }
    if (partLower === "or") { currentLogic = "OR"; continue; }

    let matchedField: FieldDef | undefined;
    let remaining = part;
    const sortedFields = [...availableFields].sort((a, b) => b.label.length - a.label.length);

    for (const f of sortedFields) {
      if (partLower.startsWith(f.label.toLowerCase()) || partLower.startsWith(f.key.toLowerCase())) {
        matchedField = f;
        remaining = part.slice(f.label.toLowerCase().length).trim();
        break;
      }
    }

    if (!matchedField) continue;

    const opPatterns: { pattern: RegExp; operator: string }[] = [
      { pattern: /^(?:is|equals?|=)\s+(.+)$/i, operator: "eq" },
      { pattern: /^(?:is not|not equals?|!=|<>)\s+(.+)$/i, operator: "neq" },
      { pattern: /^(?:contains?|includes?|like)\s+(.+)$/i, operator: "contains" },
      { pattern: /^(?:starts? with|begins? with)\s+(.+)$/i, operator: "starts_with" },
      { pattern: /^(?:ends? with)\s+(.+)$/i, operator: "ends_with" },
      { pattern: /^(?:is empty|is null)$/i, operator: "is_empty" },
      { pattern: /^(?:is not empty|is not null)$/i, operator: "is_not_empty" },
      { pattern: /^(?:greater than|more than|above|>)\s+(.+)$/i, operator: "gt" },
      { pattern: /^(?:less than|below|under|<)\s+(.+)$/i, operator: "lt" },
      { pattern: /^(?:greater or equal|>=|at least)\s+(.+)$/i, operator: "gte" },
      { pattern: /^(?:less or equal|<=|at most)\s+(.+)$/i, operator: "lte" },
      { pattern: /^(?:between)\s+(.+?)\s+(?:and|to)\s+(.+)$/i, operator: "between" },
    ];

    for (const { pattern, operator } of opPatterns) {
      const match = remaining.match(pattern);
      if (match) {
        const condition: ConditionRule = {
          field: matchedField.key,
          operator,
          value: match[1]?.trim() || "",
          logic: currentLogic,
        };
        if (operator === "between" && match[2]) condition.value2 = match[2].trim();
        conditions.push(condition);
        break;
      }
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
