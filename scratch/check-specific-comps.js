const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  const qidsToCheck = [
    "HOM N2110-N2120",
    "HOM N2110–N2120",
    "HOM N2205-N2215",
    "HOM N2205–N2215",
    "HOM N4140-N4130",
    "HOM N4140–N4130",
    "HOM N22-N23",
    "HOM N22–N23"
  ];

  console.log("=== Checking SOW Items for these QIDs ===");
  const { data: sowItems } = await supabase
    .from("u_sow_items")
    .select("id, component_qid, component_id, status")
    .in("component_qid", qidsToCheck);
  console.log("SOW Items found:", sowItems);

  console.log("=== Checking Structure Components for these QIDs ===");
  const { data: comps } = await supabase
    .from("structure_components")
    .select("id, q_id")
    .in("q_id", qidsToCheck);
  console.log("Structure Components found:", comps);

  console.log("=== Checking Inspection Records for these Component IDs ===");
  if (sowItems && sowItems.length > 0) {
    const compIds = sowItems.map(i => i.component_id).filter(Boolean);
    const { data: recs } = await supabase
      .from("insp_records")
      .select("component_id, status, structure_components(q_id)")
      .in("component_id", compIds);
    console.log("Inspection Records found:", recs);
  }

  console.log("=== Checking SOW items where component_qid is like N2110 or N2205 or N4140 ===");
  const { data: likeItems } = await supabase
    .from("u_sow_items")
    .select("id, component_qid, component_id, status")
    .or("component_qid.ilike.%N2110%,component_qid.ilike.%N2205%,component_qid.ilike.%N4140%");
  console.log("SOW Items matching pattern:", likeItems);

  console.log("=== Checking structure_components where q_id is like N2110 or N2205 or N4140 ===");
  const { data: likeComps } = await supabase
    .from("structure_components")
    .select("id, q_id")
    .or("q_id.ilike.%N2110%,q_id.ilike.%N2205%,q_id.ilike.%N4140%");
  console.log("Structure Components matching pattern:", likeComps);

  console.log("=== Checking insp_records where component_id is one of those likeComps ===");
  if (likeComps && likeComps.length > 0) {
    const compIds = likeComps.map(c => c.id);
    const { data: likeRecs } = await supabase
      .from("insp_records")
      .select("component_id, status, structure_components(q_id)")
      .in("component_id", compIds);
    console.log("Records matching pattern:", likeRecs);
  }
}

run().catch(console.error);
