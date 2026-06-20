const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  const sowId = null;
  const structureId = "1061";
  const jobpackId = "610";
  const sowReportNo = "14061";

  const jpNum = parseInt(jobpackId);
  const strNum = parseInt(structureId);

  let resolvedSowId = null;
  const { data: sowRec } = await supabase
    .from("u_sow")
    .select("id")
    .eq("jobpack_id", jpNum)
    .eq("structure_id", strNum)
    .limit(1)
    .maybeSingle();
  if (sowRec) resolvedSowId = sowRec.id;

  console.log("resolvedSowId:", resolvedSowId);

  // Fetch SOW items
  const { data: allSowItems } = await supabase
    .from("u_sow_items")
    .select(`
        status, 
        component_id, 
        component_qid,
        component_type, 
        inspection_code,
        report_number
    `)
    .eq("sow_id", Number(resolvedSowId));

  // Fetch records
  const { data: rawRecords } = await supabase
    .from("insp_records")
    .select(`
        status,
        has_anomaly,
        inspection_type_code,
        component_type,
        component_id,
        sow_report_no,
        structure_components:component_id!left(
            id, q_id, code, metadata
        )
    `)
    .eq("jobpack_id", jpNum)
    .eq("structure_id", strNum);

  const COMPONENT_TYPE_NAMES = {
      "RS": "Riser",
      "CD": "Conductor",
      "CA": "Caisson",
      "RG": "Riser Guard",
      "BL": "Boat Landing",
      "AN": "Anode",
      "SD": "Seabed Debris",
      "LG": "Leg",
      "MB": "Member",
      "PL": "Pipeline",
      "SH": "Sheave",
      "CP": "Cathodic Protection",
      "CL": "Clamp"
  };
  const getComponentTypeName = (code) => {
      const uc = (code || "").toUpperCase().trim();
      return COMPONENT_TYPE_NAMES[uc] || uc || "Other";
  };

  const componentSummary = {};

  allSowItems.forEach((item) => {
      const compTypeRaw = item.component_type || "Other";
      const compType = getComponentTypeName(compTypeRaw);
      const qid = item.component_qid || `ID: ${item.component_id}`;
      const inspCode = item.inspection_code || "UNKNOWN";
      
      if (!componentSummary[compType]) componentSummary[compType] = {};
      if (!componentSummary[compType][qid]) {
          componentSummary[compType][qid] = {
              totalRecords: 0,
              inspectionTypes: {}
          };
      }
      if (!componentSummary[compType][qid].inspectionTypes[inspCode]) {
          componentSummary[compType][qid].inspectionTypes[inspCode] = {
              completed: 0,
              incomplete: 0,
              anomaly: 0,
              pending: 0
          };
      }
      if (item.status === "pending" || item.status === "incomplete") {
          componentSummary[compType][qid].inspectionTypes[inspCode].pending++;
      }
  });

  rawRecords.forEach((r) => {
      const comp = r.structure_components || {};
      const compTypeRaw = r.component_type || comp.code || "Other";
      const compType = getComponentTypeName(compTypeRaw);
      const qid = comp.q_id || r.inspection_data?.q_id || `ID: ${r.component_id || "Unknown"}`;
      const inspCode = r.inspection_type_code || "UNKNOWN";

      if (!componentSummary[compType]) componentSummary[compType] = {};
      if (!componentSummary[compType][qid]) {
          componentSummary[compType][qid] = {
              totalRecords: 0,
              inspectionTypes: {}
          };
      }
      if (!componentSummary[compType][qid].inspectionTypes[inspCode]) {
          componentSummary[compType][qid].inspectionTypes[inspCode] = {
              completed: 0,
              incomplete: 0,
              anomaly: 0,
              pending: 0
          };
      }

      componentSummary[compType][qid].totalRecords++;
  });

  console.log("componentSummary for HM:", componentSummary["HM"]);
}

run().catch(console.error);
