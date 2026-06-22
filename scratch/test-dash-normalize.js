const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  console.log("--- Querying all SOW items containing HOM ---");
  const { data: sowItems } = await supabase
    .from("u_sow_items")
    .select("id, component_qid, status, sow_id")
    .ilike("component_qid", "%HOM%");
  
  console.log("SOW Items:", sowItems);

  console.log("--- Querying structure_components for those QIDs (normalized) ---");
  if (sowItems && sowItems.length > 0) {
    const qids = sowItems.map(i => i.component_qid);
    const normalizedQids = qids.map(q => q.replace(/\s+/g, "").replace(/–/g, "-").replace(/-/g, ""));
    console.log("Normalized QIDs from SOW:", normalizedQids);

    const { data: comps } = await supabase
      .from("structure_components")
      .select("id, q_id")
      .ilike("q_id", "%HOM%");
    
    console.log("DB Comps matching HOM:", comps.map(c => ({
      id: c.id,
      q_id: c.q_id,
      normalized: c.q_id.replace(/\s+/g, "").replace(/–/g, "-").replace(/-/g, "")
    })));
  }
}

run().catch(console.error);
