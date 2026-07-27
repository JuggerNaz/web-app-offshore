const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  console.log("Loading all components with non-null q_id...");

  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  const comps = [];
  while (hasMore) {
    const { data, error } = await supabase
      .from("structure_components")
      .select("id, structure_id, comp_id, q_id")
      .not("q_id", "is", null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      comps.push(...data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  console.log(`Loaded total ${comps.length} components.`);

  const vemMatches = comps.filter(c => String(c.q_id).toUpperCase().trim() === "VEM N100-N178");
  console.log(`Matches for VEM N100-N178 in comps:`, JSON.stringify(vemMatches, null, 2));

  // Run the seen matching logic to see what happens
  const seen = new Map();
  const idsToDelete = [];

  comps.forEach(c => {
    const cleanQid = String(c.q_id).trim().toUpperCase();
    if (cleanQid === "") return;
    
    const key = `${c.structure_id}-${cleanQid}`;
    if (seen.has(key)) {
      const existing = seen.get(key);
      if (c.id > existing.id) {
        idsToDelete.push(c.id);
      } else {
        idsToDelete.push(existing.id);
        seen.set(key, c);
      }
    } else {
      seen.set(key, c);
    }
  });

  console.log("Duplicate count detected:", idsToDelete.length);
  const matchedDeletes = idsToDelete.filter(id => vemMatches.some(m => m.id === id));
  console.log("VEM N100-N178 duplicate IDs scheduled to delete:", matchedDeletes);
}

run();
