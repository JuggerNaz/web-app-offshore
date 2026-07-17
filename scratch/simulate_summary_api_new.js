const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());


  // Dynamically resolve SOW details for SOW 255
  const { data: sowRec } = await supabase
    .from("u_sow")
    .select("id, company_id, structure_id, report_numbers")
    .eq("id", 255)
    .single();

  if (!sowRec) {
    console.error("SOW 255 not found");
    return;
  }

  const resolvedSowId = sowRec.id;
  const companyId = sowRec.company_id;
  const strNum = sowRec.structure_id;
  
  console.log("Report numbers type:", typeof sowRec.report_numbers, JSON.stringify(sowRec.report_numbers));
  
  const sowReportNo = "14061"; // Force 14061 since it matches SOW items we saw

  console.log("=== Simulating API call ===");
  console.log(`Resolved SOW ID: ${resolvedSowId}, Company ID: ${companyId}, Structure ID: ${strNum}, Report No: ${sowReportNo}`);

  // 1. Fetch SOW items (similar to route.ts query)
  const { data: itemsData, error: err } = await supabase
    .from("u_sow_items")
    .select(`
        status, 
        component_id, 
        component_qid,
        component_type, 
        inspection_code,
        inspection_name,
        elevation_required,
        elevation_data,
        notes,
        report_number
    `)
    .eq("company_id", companyId)
    .eq("sow_id", resolvedSowId);

  if (err) {
    console.error("SOW items err:", err);
    return;
  }

  console.log(`Fetched ${itemsData.length} SOW items`);

  // 2. Fetch components without filters first to inspect them
  const { data: rawComps } = await supabase
    .from("structure_components")
    .select("id, q_id, structure_id, company_id")
    .in("q_id", ["BAN135", "BAN067", "HOM N481-N482"]);
    
  console.log("Raw components check:", JSON.stringify(rawComps, null, 2));

  const { data: compList } = await supabase
    .from("structure_components")
    .select("id, q_id, code, metadata, structure_id, company_id")
    .eq("structure_id", strNum);

  console.log(`Fetched ${compList?.length || 0} structure components for structure ${strNum}`);

  const compMap = new Map();
  const qidMap = new Map();
  if (compList) {
      compList.forEach((c) => {
          compMap.set(String(c.id), c);
          if (c.q_id) {
              qidMap.set(String(c.q_id).trim().toUpperCase(), c);
          }
      });
  }

  // 3. Process SOW items to outstanding list
  const isReportSpecific = true;
  const sowItemsToProcess = itemsData.filter((i) => {
      const itemRep = String(i.report_number || "").replace(/\s+/g, "").toLowerCase();
      const filterRep = String(sowReportNo).replace(/\s+/g, "").toLowerCase();
      return itemRep === filterRep;
  });

  console.log(`sowItemsToProcess length: ${sowItemsToProcess.length}`);

  // Print summary of statuses
  const statusCounts = {};
  sowItemsToProcess.forEach(i => {
    statusCounts[i.status] = (statusCounts[i.status] || 0) + 1;
  });
  console.log("Status counts:", statusCounts);

  const elevationRequiredCounts = { true: 0, false: 0 };
  sowItemsToProcess.forEach(i => {
    const key = i.elevation_required ? "true" : "false";
    elevationRequiredCounts[key]++;
  });
  console.log("Elevation required counts:", elevationRequiredCounts);

  const sampleIncomplete = sowItemsToProcess.find(i => String(i.status).toLowerCase() === "incomplete");
  if (sampleIncomplete) {
    console.log("Sample incomplete item:", JSON.stringify(sampleIncomplete, null, 2));
  } else {
    console.log("NO incomplete items found in sowItemsToProcess!");
  }

  const outstandingTasks = [];
  sowItemsToProcess.forEach((item) => {
      const statusStr = String(item.status || "").toLowerCase().trim();
      if (statusStr === "incomplete" || statusStr === "pending") {
          let comp = compMap.get(String(item.component_id));
          if (!comp && item.component_qid) {
              comp = qidMap.get(String(item.component_qid).trim().toUpperCase());
          }
          const compMeta = comp?.metadata || {};
          const elv1 = compMeta.elv_1 !== undefined && compMeta.elv_1 !== null ? compMeta.elv_1 : null;
          const elv2 = compMeta.elv_2 !== undefined && compMeta.elv_2 !== null ? compMeta.elv_2 : null;

          let compElv = null;
          if (elv1 !== null && parseFloat(String(elv1)) < 0) {
              compElv = elv1;
          } else if (elv2 !== null && parseFloat(String(elv2)) < 0) {
              compElv = elv2;
          } else {
              compElv = elv1 !== null ? elv1 : elv2;
          }

          const formatElevation = (val) => {
              if (val === undefined || val === null || String(val).trim() === "" || String(val).trim() === "-") return "-";
              const num = parseFloat(String(val));
              if (isNaN(num)) return String(val);
              if (num < 0) return `(-)${Math.abs(num)}`;
              return String(val);
          };

          if (item.elevation_required && Array.isArray(item.elevation_data) && item.elevation_data.length > 0) {
              item.elevation_data.forEach((elev) => {
                  const elevStatus = String(elev.status || "").toLowerCase().trim();
                  if (elevStatus === "incomplete" || elevStatus === "pending") {
                      outstandingTasks.push({
                          qid: item.component_qid || "N/A",
                          hasComp: !!comp,
                          metaKeys: Object.keys(compMeta),
                          elv1,
                          elv2,
                          selectedElv: compElv,
                          elevation: formatElevation(elev.start !== undefined ? elev.start : compElv),
                          comments: elev.comments || elev.notes || item.notes || "Incomplete"
                      });
                  }
              });
          } else {
              outstandingTasks.push({
                  qid: item.component_qid || "N/A",
                  hasComp: !!comp,
                  metaKeys: Object.keys(compMeta),
                  elv1,
                  elv2,
                  selectedElv: compElv,
                  elevation: formatElevation(compElv),
                  comments: item.notes || "Incomplete"
              });
          }
      }
  });

  console.log("Outstanding tasks result:");
  console.log(JSON.stringify(outstandingTasks.slice(0, 5), null, 2));
}

run().catch(console.error);
