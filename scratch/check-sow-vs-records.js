const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  // Get SOW ID
  const { data: sowRec } = await supabase
    .from("u_sow")
    .select("id")
    .eq("jobpack_id", 610)
    .eq("structure_id", 1061)
    .maybeSingle();

  if (!sowRec) {
    console.log("No SOW record found");
    return;
  }

  // Fetch SOW items
  const { data: sowItems } = await supabase
    .from("u_sow_items")
    .select("component_qid, component_id, status")
    .eq("sow_id", sowRec.id);

  console.log("=== SOW items matching HOM ===");
  sowItems.filter(i => i.component_qid.includes("HOM")).forEach(item => {
    console.log(`SOW Item: qid='${item.component_qid}', component_id=${item.component_id}, status='${item.status}'`);
  });

  // Fetch actual inspection records
  const { data: recs } = await supabase
    .from("insp_records")
    .select("component_id, status, has_anomaly, structure_components(id, q_id)")
    .eq("jobpack_id", 610)
    .eq("structure_id", 1061);

  console.log("\n=== Inspection Records matching HOM ===");
  recs.forEach(r => {
    const qid = r.structure_components?.q_id;
    if (qid && qid.includes("HOM")) {
      console.log(`Record: component_id=${r.component_id}, db_qid='${qid}', status='${r.status}', has_anomaly=${r.has_anomaly}`);
    }
  });
}

run().catch(console.error);
