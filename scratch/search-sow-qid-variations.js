const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  const { data: items } = await supabase
    .from("u_sow_items")
    .select("component_qid, component_id, component_type, status")
    .eq("sow_id", 1);

  const matched = items.filter(i => 
    i.component_qid?.includes("N2110") || 
    i.component_qid?.includes("N2205") || 
    i.component_qid?.includes("N4140") || 
    i.component_qid?.includes("N22-N23") || 
    i.component_qid?.includes("N22–N23")
  );

  console.log("Matched SOW items for SOW ID 1:", matched);

  // Let's also check structure components for structure 234
  const { data: comps } = await supabase
    .from("structure_components")
    .select("id, q_id")
    .eq("structure_id", 234)
    .or("q_id.ilike.%N2110%,q_id.ilike.%N2205%,q_id.ilike.%N4140%,q_id.ilike.%N22-N23%");
  console.log("Comps in DB for structure 234 matching those numbers:", comps);

  // Let's check actual inspection records for SOW ID 1 / jobpack 591 / structure 234
  const { data: recs } = await supabase
    .from("insp_records")
    .select("id, component_id, status, structure_components(id, q_id)")
    .eq("jobpack_id", 591)
    .eq("structure_id", 234);
  
  const matchedRecs = recs.filter(r => 
    r.structure_components?.q_id?.includes("N2110") ||
    r.structure_components?.q_id?.includes("N2205") ||
    r.structure_components?.q_id?.includes("N4140") ||
    r.structure_components?.q_id?.includes("N22-N23")
  );
  console.log("Matched Inspection Records:", matchedRecs);
}

run().catch(console.error);
