const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function main() {
    const envPath = path.resolve(".env.local");
    const env = fs.readFileSync(envPath, "utf8");
    const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
    const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
    const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

    // Query records matching structure 234
    const { data: recs, error: rErr } = await supabase
        .from("insp_records")
        .select("insp_id, description, inspection_data, insp_anomalies(defect_description)")
        .eq("structure_id", 234)
        .eq("has_anomaly", true);
    
    recs.forEach(r => {
        console.log(`ID: ${r.insp_id}`);
        console.log(`  insp_records.description: "${r.description}"`);
        console.log(`  insp_anomalies.defect_description: "${r.insp_anomalies?.[0]?.defect_description}"`);
        console.log("-----------------------------------------");
    });
}

main();
