const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const anonKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(url, anonKey);

async function fetchAllFromSupabase(supabase, table, columns) {
  let allData = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(table).select(columns).range(page * pageSize, (page + 1) * pageSize - 1);
    const { data, error } = await query;
    if (error) {
      console.error("Supabase Query Error:", error);
      throw error;
    }
    if (data && data.length > 0) {
      allData = allData.concat(data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }
  return allData;
}

async function run() {
  try {
    const pgRows = await fetchAllFromSupabase(supabase, 'u_lib_list', 'lib_code, lib_id, lib_desc');
    
    const seen = new Map();
    const duplicates = [];

    pgRows.forEach(r => {
      const key = `${String(r.lib_code || "").trim()}::${String(r.lib_id || "").trim()}`;
      if (seen.has(key)) {
        duplicates.push({ key, first: seen.get(key), second: r });
      } else {
        seen.set(key, r);
      }
    });

    console.log(`Found ${duplicates.length} duplicate keys in Postgres u_lib_list:`);
    duplicates.forEach((d, idx) => {
      console.log(`\nDuplicate #${idx + 1}: Key = "${d.key}"`);
      console.log(`  Row 1: Desc = "${d.first.lib_desc}"`);
      console.log(`  Row 2: Desc = "${d.second.lib_desc}"`);
    });
  } catch (err) {
    console.error("Execution Error:", err);
  }
}

run();
