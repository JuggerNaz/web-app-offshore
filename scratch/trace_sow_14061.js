const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  // 1. Find the platform with title containing "D21JT-A"
  const { data: platforms } = await supabase
    .from("platform")
    .select("plat_id, title, field_name")
    .ilike("title", "%D21JT%")
    .limit(10);

  console.log("=== Platforms matching D21JT ===");
  console.log(JSON.stringify(platforms, null, 2));

  // 2. Find jobpack with report 14061
  const { data: sowItems14061 } = await supabase
    .from("u_sow_items")
    .select("id, sow_id, status, report_number, inspection_code")
    .eq("report_number", "14061")
    .limit(10);
  console.log("\n=== SOW Items with report_number = 14061 ===");
  console.log(`Count: ${sowItems14061?.length || 0}`);
  if (sowItems14061 && sowItems14061.length > 0) {
    console.log("Sample:", JSON.stringify(sowItems14061.slice(0, 5), null, 2));
  }

  // 3. Check insp_records for sow_report_no = 14061
  const { data: records14061, count } = await supabase
    .from("insp_records")
    .select("insp_id, structure_id, jobpack_id, inspection_type_code, sow_report_no, status", { count: "exact" })
    .eq("sow_report_no", "14061")
    .limit(5);
  console.log(`\n=== insp_records with sow_report_no = 14061 ===`);
  console.log(`Count: ${count}`);
  if (records14061 && records14061.length > 0) {
    console.log("Sample:", JSON.stringify(records14061.slice(0, 5), null, 2));
    
    // Get unique structure_id and jobpack_id
    const structIds = [...new Set(records14061.map(r => r.structure_id))];
    const jpIds = [...new Set(records14061.map(r => r.jobpack_id))];
    console.log(`Unique structure IDs: ${structIds}`);
    console.log(`Unique jobpack IDs: ${jpIds}`);

    // Check if there's a SOW for this structure+jobpack combination
    for (const jpId of jpIds) {
      for (const strId of structIds) {
        const { data: sow } = await supabase
          .from("u_sow")
          .select("id, jobpack_id, structure_id")
          .eq("jobpack_id", jpId)
          .eq("structure_id", strId)
          .maybeSingle();
        console.log(`\nSOW for jobpack=${jpId}, structure=${strId}:`, sow ? `Found SOW id=${sow.id}` : "NOT FOUND");
        
        if (sow) {
          // Check items for this SOW
          const { data: items, count: itemCount } = await supabase
            .from("u_sow_items")
            .select("*", { count: "exact" })
            .eq("sow_id", sow.id)
            .limit(5);
          console.log(`SOW ${sow.id} items count: ${itemCount}`);
          if (items && items.length > 0) {
            const completed = items.filter(i => i.status === "completed").length;
            console.log(`Status breakdown: completed=${completed}, pending=${(items || []).filter(i => i.status === 'pending').length}`);
          }
        }
      }
    }
  }
}

run().catch(console.error);
