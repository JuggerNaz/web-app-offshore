require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const sowId = 338;
  const strNum = 211;
  const companyId = "a13fb356-6131-4b78-8fe1-e7c8bcc31ab2";
  const sowReportNo = "PP-19025";

  // 1. Fetch SOW items
  const { data: itemsData } = await supabase
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
    .eq("sow_id", sowId);

  // 3. Filter SOW items by report number first
  const sowItemsToProcess = itemsData.filter((i) => {
      const itemRep = String(i.report_number || "").replace(/\s+/g, "").toLowerCase();
      const filterRep = String(sowReportNo).replace(/\s+/g, "").toLowerCase();
      return itemRep === filterRep;
  });

  // 2. Fetch components target-style, only for incomplete items in this specific report to avoid huge URI length
  const incompleteItems = sowItemsToProcess.filter((i) => {
      const statusStr = String(i.status || "").toLowerCase().trim();
      return statusStr === "incomplete" || statusStr === "pending";
  });
  
  const componentIds = incompleteItems.map((i) => i.component_id).filter(Boolean);
  const componentQids = incompleteItems.map((i) => String(i.component_qid || "").trim()).filter(q => q !== "");

  let compList = [];
  if (componentIds.length > 0 || componentQids.length > 0) {
      const queries = [];
      if (componentIds.length > 0) {
          queries.push(
              supabase
                  .from("structure_components")
                  .select("id, q_id, code, metadata")
                  .eq("structure_id", strNum)
                  .in("id", componentIds)
          );
      }
      if (componentQids.length > 0) {
          queries.push(
              supabase
                  .from("structure_components")
                  .select("id, q_id, code, metadata")
                  .eq("structure_id", strNum)
                  .in("q_id", componentQids)
          );
      }
      
      const results = await Promise.all(queries);
      results.forEach((res) => {
          if (res.error) console.error("QUERY ERROR:", res.error);
          if (res.data) compList = compList.concat(res.data);
      });
  }

  console.log(`Fetched ${compList.length} targeted components`);

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

  // 3. Process SOW items

  const outstandingTasks = [];
  sowItemsToProcess.forEach((item) => {
      const statusStr = String(item.status || "").toLowerCase().trim();
      if (statusStr === "incomplete" || statusStr === "pending") {
          let comp = compMap.get(String(item.component_id));
          if (item.component_qid === "BAN135") {
              console.log(`Debug BAN135 Item:`, {
                  item_id: item.id,
                  component_id: item.component_id,
                  component_qid: item.component_qid,
                  found_by_id: !!comp,
                  found_by_id_qid: comp?.q_id,
                  found_by_id_meta: comp?.metadata
              });
          }
          if (!comp && item.component_qid) {
              comp = qidMap.get(String(item.component_qid).trim().toUpperCase());
              if (item.component_qid === "BAN135") {
                  console.log(`  Fallback lookup by QID:`, {
                      found: !!comp,
                      qid: comp?.q_id,
                      meta: comp?.metadata
                  });
              }
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
                      const hasStart = elev.start !== undefined && elev.start !== null && String(elev.start).trim() !== "" && String(elev.start).trim() !== "-";
                      const t = {
                          qid: item.component_qid || "N/A",
                          elevation: formatElevation(hasStart ? elev.start : compElv),
                          comments: elev.comments || elev.notes || item.notes || "Incomplete"
                      };
                      outstandingTasks.push(t);
                  }
              });
          } else {
              const t = {
                  qid: item.component_qid || "N/A",
                  elevation: formatElevation(compElv),
                  comments: item.notes || "Incomplete"
              };
              outstandingTasks.push(t);
          }
      }
  });

  outstandingTasks.sort((a, b) => {
      const parseElevationForSort = (elvStr) => {
          if (!elvStr || elvStr === "-") return null;
          const cleaned = elvStr.replace(/\(-\)/g, "-").replace(/[^\d.-]/g, "");
          const num = parseFloat(cleaned);
          return isNaN(num) ? null : num;
      };

      const valA = parseElevationForSort(a.elevation);
      const valB = parseElevationForSort(b.elevation);

      if (valA === null && valB === null) return 0;
      if (valA === null) return 1;
      if (valB === null) return -1;

      return valB - valA;
  });

  console.log("Total outstanding tasks:", outstandingTasks.length);
  console.log("Sorted sample tasks:", JSON.stringify(outstandingTasks.slice(0, 5), null, 2));
}

run();
