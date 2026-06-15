const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  console.log("--- Querying structure_components ---");
  const { data: comps } = await supabase
    .from("structure_components")
    .select("id, q_id, code")
    .eq("structure_id", 1061)
    .eq("code", "HM");
  
  console.log("Components (HM):", comps);

  console.log("--- Querying u_sow_items for SOW ---");
  // Let's get the sow_id first
  const { data: sowRec } = await supabase
    .from("u_sow")
    .select("id")
    .eq("jobpack_id", 610)
    .eq("structure_id", 1061)
    .maybeSingle();

  if (sowRec) {
    const { data: sowItems } = await supabase
      .from("u_sow_items")
      .select("component_qid, component_type")
      .eq("sow_id", sowRec.id);
    console.log("SOW Items:", sowItems.filter(i => i.component_type === "HM" || i.component_qid.includes("HOM")));
  }

  console.log("--- Querying actual insp_records ---");
  const { data: recs } = await supabase
    .from("insp_records")
    .select("component_id, inspection_data, structure_components(q_id)")
    .eq("jobpack_id", 610)
    .eq("structure_id", 1061);
  
  console.log("Inspection Records:", recs.map(r => ({
    component_id: r.component_id,
    q_id_from_relation: r.structure_components?.q_id,
    q_id_from_data: r.inspection_data?.q_id
  })).filter(r => r.q_id_from_relation?.includes("HOM") || r.q_id_from_data?.includes("HOM")));
}

run().catch(console.error);
