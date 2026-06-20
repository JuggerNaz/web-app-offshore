const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  console.log("Fetching all inspection records for structure 234...");
  const { data: recs, error } = await supabase
    .from("insp_records")
    .select("insp_id, component_id, jobpack_id, status, sow_report_no, structure_components(q_id, code)")
    .eq("structure_id", 234);
  
  if (error) console.error(error);
  console.log("Total records found for structure 234:", recs?.length);

  const hmRecs = recs?.filter(r => r.structure_components?.code === "HM" || r.structure_components?.q_id?.includes("HOM"));
  console.log("HM records found:", hmRecs?.length);
  hmRecs.forEach(r => {
    console.log(`Record ID: ${r.insp_id} | comp_id: ${r.component_id} | QID: '${r.structure_components?.q_id}' | jobpack: ${r.jobpack_id} | report: '${r.sow_report_no}' | status: '${r.status}'`);
  });
}

run().catch(console.error);
