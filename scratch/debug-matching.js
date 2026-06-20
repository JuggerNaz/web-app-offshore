const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  const { data: allSowItems, error: sowErr } = await supabase
    .from("u_sow_items")
    .select(`
        status, 
        component_id, 
        component_qid,
        component_type, 
        inspection_code,
        report_number
    `)
    .eq("sow_id", 1);
  if (sowErr) console.error("sowItems error:", sowErr);

  const { data: compList } = await supabase
    .from("structure_components")
    .select("id, q_id, code")
    .eq("structure_id", 234);
  const compMap = new Map();
  if (compList) {
    compList.forEach(c => compMap.set(c.id, c));
  }

  // 2. Fetch insp_records for structure 234
  const { data: dbRecords } = await supabase
    .from("insp_records")
    .select(`
        status,
        has_anomaly,
        inspection_type_code,
        component_type,
        component_id,
        sow_report_no,
        jobpack_id,
        structure_components:component_id!left(
            id, q_id, code, metadata
        )
    `)
    .eq("structure_id", 234);

  const sowReportNumbers = new Set(
    allSowItems
      .map(item => (item.report_number || "").trim())
      .filter(r => r !== "")
  );

  const rawRecords = (dbRecords || []).filter(r => {
    const matchesJobpack = r.jobpack_id === 591;
    const matchesReport = r.sow_report_no && sowReportNumbers.has(r.sow_report_no.trim());
    return matchesJobpack || matchesReport;
  });

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
      const dbComp = compMap.get(item.component_id);
      const compTypeRaw = item.component_type || dbComp?.code || "Other";
      const compType = getComponentTypeName(compTypeRaw);
      const qid = item.component_qid || dbComp?.q_id || `ID: ${item.component_id}`;
      const inspCode = item.inspection_code || "UNKNOWN";
      
      if (!componentSummary[compType]) {
          componentSummary[compType] = {};
      }
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

  console.log("QIDs initialized in componentSummary['HM']:", Object.keys(componentSummary["HM"] || {}));

  console.log("\n--- Processing rawRecords ---");
  rawRecords.forEach((r) => {
      const comp = r.structure_components || {};
      const compTypeRaw = r.component_type || comp.code || "Other";
      const compType = getComponentTypeName(compTypeRaw);
      const qid = comp.q_id || r.inspection_data?.q_id || `ID: ${r.component_id || "Unknown"}`;
      
      if (compType === "HM" || qid.includes("HOM")) {
        console.log(`Processing Record componentType: '${compType}', qid: '${qid}', db component_id: ${r.component_id}`);
        
        const isMatched = componentSummary[compType] && componentSummary[compType][qid];
        console.log(`  -> Match found in initialized summary: ${!!isMatched}`);
      }
  });
}

run().catch(console.error);
