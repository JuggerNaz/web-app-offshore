const { createClient } = require('@supabase/supabase-js');
const oracledb = require('oracledb');
const fs = require('fs');

// Read .env.local manually
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const anonKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

if (!url || !anonKey) {
  console.error("Could not find Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(url, anonKey);
const config = JSON.parse(fs.readFileSync('oracle_config.json', 'utf8'));

// Helper function to paginate and fetch all records from Supabase
async function fetchAllFromSupabase(
  supabase,
  table,
  columns,
  filterBuilder
) {
  let allData = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(table).select(columns).range(page * pageSize, (page + 1) * pageSize - 1);
    if (filterBuilder) {
      query = filterBuilder(query);
    }
    const { data, error } = await query;
    if (error) {
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
  if (config.useThickMode) {
    try {
      oracledb.initOracleClient({ libDir: config.libDir });
    } catch (err) {}
  }
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  oracledb.fetchAsString = [oracledb.DATE, oracledb.NUMBER];

  let connection;
  try {
    connection = await oracledb.getConnection({
      user: config.user,
      password: config.password,
      connectString: config.connectString || `${config.host}:${config.port}/${config.serviceName}`
    });

    console.log("Connected to Oracle.");

    // Oracle query
    const rRes = await connection.execute(`SELECT LIB_CODE, LIB_ID, LIB_DESC FROM U_LIB_LIST`);
    const oracleItems = (rRes.rows || []).map((row) => {
      const lcode = String(row.LIB_CODE || row[0] || "").trim();
      const lid = String(row.LIB_ID || row[1] || "").trim();
      const ldesc = String(row.LIB_DESC || row[2] || "").trim();
      return {
        key: `${lcode}::${lid}`,
        label: `[${lcode}] ${lid}: ${ldesc || "(No Description)"}`,
        raw: row
      };
    });

    // Postgres query
    const pgData = await fetchAllFromSupabase(supabase, 'u_lib_list', 'lib_code, lib_id, lib_desc');
    const postgresItems = (pgData || []).map((row) => {
      const lcode = String(row.lib_code || "").trim();
      const lid = String(row.lib_id || "").trim();
      const ldesc = String(row.lib_desc || "").trim();
      return {
        key: `${lcode}::${lid}`,
        label: `[${lcode}] ${lid}: ${ldesc || "(No Description)"}`,
        raw: row
      };
    });

    console.log(`Oracle total rows count: ${oracleItems.length}`);
    console.log(`Postgres total rows count: ${postgresItems.length}`);

    const pgKeys = new Set(postgresItems.map(item => item.key));
    const oracleKeys = new Set(oracleItems.map(item => item.key));

    const missingInPostgres = oracleItems.filter(item => item.key && !pgKeys.has(item.key));
    const missingInOracle = postgresItems.filter(item => item.key && !oracleKeys.has(item.key));

    console.log(`Computed Missing in Postgres (size): ${missingInPostgres.length}`);
    if (missingInPostgres.length > 0) {
      console.log("Sample missing in Postgres:", missingInPostgres.slice(0, 5));
    } else {
      console.log("NO MISSING IN POSTGRES FOUND VIA KEY COMPARISON!");
      // Let's print some sample keys to see what's going on
      console.log("\nOracle sample keys:", oracleItems.slice(0, 10).map(x => x.key));
      console.log("\nPostgres sample keys:", postgresItems.slice(0, 10).map(x => x.key));
    }
    
    console.log(`Computed Extra in Postgres (size): ${missingInOracle.length}`);
    if (missingInOracle.length > 0) {
      console.log("Sample extra in Postgres:", missingInOracle.slice(0, 5));
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

run();
