const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  if (!fs.existsSync(envPath)) {
    console.error(".env.local not found");
    return;
  }
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  
  if (!urlMatch || !keyMatch) {
    console.error("Could not parse Supabase URL/Key from .env.local");
    return;
  }
  
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());
  console.log("Connected to Supabase!");
  
  const structureId = 1061;
  
  // 1. Fetch total inspection records count
  const { data: recs, error: recsErr } = await supabase
    .from("insp_records")
    .select("insp_id, component_id, inspection_type_id, inspection_type_code, status, sow_report_no, elevation")
    .eq("structure_id", structureId);
    
  if (recsErr) {
    console.error("Error fetching records:", recsErr);
  } else {
    console.log(`Total inspection records for structure ${structureId}:`, recs.length);
    if (recs.length > 0) {
      console.log("Sample records (first 5):", JSON.stringify(recs.slice(0, 5), null, 2));
      
      // Let's count records with different sow_report_no
      const reportNumbers = {};
      recs.forEach(r => {
        reportNumbers[r.sow_report_no] = (reportNumbers[r.sow_report_no] || 0) + 1;
      });
      console.log("Migrated records grouped by sow_report_no:", reportNumbers);
    }
  }
}

run().catch(console.error);
