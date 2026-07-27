const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  console.log("Cleaning up duplicate components from structure_components...");

  try {
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

    const seen = new Map();
    const idsToDelete = [];
    const redirectMap = new Map(); // uniqueId -> Array of duplicateIds

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

    // Populate redirectMap
    for (const idToDelete of idsToDelete) {
      const duplicateComp = comps.find(c => c.id === idToDelete);
      const cleanQid = String(duplicateComp.q_id).trim().toUpperCase();
      const key = `${duplicateComp.structure_id}-${cleanQid}`;
      const uniqueComp = seen.get(key);

      if (!redirectMap.has(uniqueComp.id)) {
        redirectMap.set(uniqueComp.id, []);
      }
      redirectMap.get(uniqueComp.id).push(idToDelete);
    }

    console.log(`Found ${idsToDelete.length} duplicate components (by QID) to clean up.`);
    console.log(`Grouping updates across ${redirectMap.size} unique components...`);

    if (idsToDelete.length > 0) {
      let index = 0;
      for (const [uniqueId, duplicateIds] of redirectMap.entries()) {
        index++;
        if (index % 100 === 0 || index === redirectMap.size) {
          console.log(`Redirecting references: ${index}/${redirectMap.size}...`);
        }

        // Redirect foreign keys in batches
        const { error: err1 } = await supabase
          .from("insp_records")
          .update({ component_id: uniqueId })
          .in("component_id", duplicateIds);
        if (err1) {
          console.error(`Error redirecting insp_records to unique ID ${uniqueId}:`, err1.message);
        }

        const { error: err2 } = await supabase
          .from("u_sow_items")
          .update({ component_id: uniqueId })
          .in("component_id", duplicateIds);
        if (err2) {
          console.error(`Error redirecting u_sow_items to unique ID ${uniqueId}:`, err2.message);
        }
      }

      // Bulk delete the duplicate component rows in chunks of 1000
      console.log(`Bulk deleting ${idsToDelete.length} duplicate component rows...`);
      const chunkSize = 1000;
      for (let i = 0; i < idsToDelete.length; i += chunkSize) {
        const chunk = idsToDelete.slice(i, i + chunkSize);
        console.log(`Deleting chunk ${Math.floor(i / chunkSize) + 1} of size ${chunk.length}...`);
        const { error: delErr } = await supabase
          .from("structure_components")
          .delete()
          .in("id", chunk);

        if (delErr) {
          console.error(`Failed to delete chunk starting at index ${i}:`, delErr.message);
        }
      }
      console.log("Cleanup process completed successfully!");
    } else {
      console.log("No duplicate components found.");
    }
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
}

run();
