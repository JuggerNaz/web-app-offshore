const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  // 1. Check u_sow table
  const { data: sows, error: sowErr } = await supabase
    .from("u_sow")
    .select("id, jobpack_id, structure_id, metadata")
    .limit(20);

  if (sowErr) {
    console.error("Error fetching u_sow:", sowErr);
    return;
  }
  console.log(`\n=== u_sow table (${sows.length} rows) ===`);
  sows.forEach(s => console.log(`  SOW id=${s.id}, jobpack_id=${s.jobpack_id}, structure_id=${s.structure_id}`));

  // 2. For each SOW, check items
  for (const s of sows) {
    const { data: items, error: itemsErr } = await supabase
      .from("u_sow_items")
      .select("id, sow_id, status, report_number, inspection_code, component_id")
      .eq("sow_id", s.id);

    if (itemsErr) {
      console.error(`Error fetching items for SOW ${s.id}:`, itemsErr);
      continue;
    }
    
    const total = items.length;
    const completed = items.filter(i => i.status === "completed").length;
    const incomplete = items.filter(i => i.status === "incomplete").length;
    const pending = items.filter(i => i.status === "pending").length;
    const nullStatus = items.filter(i => !i.status).length;
    const otherStatus = items.filter(i => i.status && !["completed", "incomplete", "pending"].includes(i.status)).length;
    
    console.log(`\n--- SOW id=${s.id} items summary ---`);
    console.log(`  Total: ${total}, Completed: ${completed}, Incomplete: ${incomplete}, Pending: ${pending}, Null: ${nullStatus}, Other: ${otherStatus}`);
    
    // Show status distribution
    const statusMap = {};
    items.forEach(i => {
      const key = i.status || "(null)";
      statusMap[key] = (statusMap[key] || 0) + 1;
    });
    console.log(`  Status distribution:`, statusMap);
    
    // Check report_number distribution
    const reportMap = {};
    items.forEach(i => {
      const key = i.report_number || "(null)";
      reportMap[key] = (reportMap[key] || 0) + 1;
    });
    console.log(`  Report number distribution:`, reportMap);
    
    // Show first 5 items for reference
    console.log(`  First 5 items:`, items.slice(0, 5).map(i => ({
      id: i.id, status: i.status, report: i.report_number, code: i.inspection_code
    })));
  }
}

run().catch(console.error);
