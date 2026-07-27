const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  // Input params matching the 500 error call:
  // /api/inspection-summary?jobpack_id=610&structure_id=211&sow_report_no=PP-19025
  const structureId = "211";
  const jobpackId = "610";
  const sowReportNo = "PP-19025";
  const companyId = "a13fb356-6131-4b78-8fe1-e7c8bcc31ab2"; // Target company ID

  try {
    let resolvedSowId = null;
    const jpNum = parseInt(String(jobpackId));
    const strNum = parseInt(String(structureId));

    // 1. Resolve SOW ID
    const { data: sowRec } = await supabase
        .from("u_sow")
        .select("id")
        .eq("company_id", companyId)
        .eq("jobpack_id", jpNum)
        .eq("structure_id", strNum)
        .limit(1)
        .maybeSingle();
    
    if (sowRec) {
        resolvedSowId = String(sowRec.id);
        console.log("Resolved SOW ID:", resolvedSowId);
    }

    // 2. Fetch SOW items
    let allSowItems = [];
    if (resolvedSowId) {
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
            .eq("sow_id", Number(resolvedSowId));
        
        if (err) throw err;
        allSowItems = itemsData || [];
    }

    console.log("Fetched SOW items count:", allSowItems.length);

    // 3. Process SOW items
    const isReportSpecific = sowReportNo && sowReportNo !== "N/A" && sowReportNo !== "null" && sowReportNo !== "all";
    const sowItemsToProcess = isReportSpecific
        ? allSowItems.filter((i) => {
            const itemRep = String(i.report_number || "").replace(/\s+/g, "").toLowerCase();
            const filterRep = String(sowReportNo).replace(/\s+/g, "").toLowerCase();
            return itemRep === filterRep;
          })
        : allSowItems;

    console.log("sowItemsToProcess count:", sowItemsToProcess.length);

    // 4. Fetch components (this is where we changed the query)
    const componentIds = sowItemsToProcess
        .map((i) => {
            const val = parseInt(String(i.component_id));
            return isNaN(val) ? null : val;
        })
        .filter(Boolean);
    const componentQids = sowItemsToProcess.map((i) => String(i.component_qid || "").trim()).filter(q => q !== "");

    console.log("componentIds count:", componentIds.length);
    console.log("componentQids count:", componentQids.length);

    let compList = [];
    if (!isNaN(strNum)) {
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

        if (queries.length > 0) {
            console.log("Executing Promise.all on queries...");
            const results = await Promise.all(queries);
            results.forEach((res) => {
                if (res.error) {
                    console.error("Query item error:", res.error);
                    throw res.error;
                }
                if (res.data) {
                    compList = compList.concat(res.data);
                }
            });
        }
    }

    console.log("Fetched components count:", compList.length);
    console.log("Success!");

  } catch (error) {
    console.error("DIAGNOSED ERROR STACK TRACE:");
    console.error(error);
  }
}

run();
