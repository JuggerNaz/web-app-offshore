const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  const { data: sowItem } = await supabase
    .from("u_sow_items")
    .select("component_qid")
    .ilike("component_qid", "%HOM%N2110%")
    .limit(1);
  
  console.log("SOW Item QID:", sowItem);
  if (sowItem && sowItem[0]) {
    const qid = sowItem[0].component_qid;
    console.log("SOW Item QID characters:", qid.split("").map(c => `${c} (${c.charCodeAt(0)})`));
  }

  const { data: comp } = await supabase
    .from("structure_components")
    .select("q_id")
    .ilike("q_id", "%HOM%N2110%")
    .limit(1);
  
  console.log("DB Comp QID:", comp);
  if (comp && comp[0]) {
    const qid = comp[0].q_id;
    console.log("DB Comp QID characters:", qid.split("").map(c => `${c} (${c.charCodeAt(0)})`));
  }
}

run().catch(console.error);
