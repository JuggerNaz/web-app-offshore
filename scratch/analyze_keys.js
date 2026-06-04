const { createClient } = require('@supabase/supabase-js');
const oracledb = require('oracledb');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const anonKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(url, anonKey);
const config = JSON.parse(fs.readFileSync('oracle_config.json', 'utf8'));

// Helper function to paginate and fetch all records from Supabase
async function fetchAllFromSupabase(supabase, table, columns) {
  let allData = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(table).select(columns).range(page * pageSize, (page + 1) * pageSize - 1);
    const { data, error } = await query;
    if (error) throw error;
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

    // 1. Fetch Oracle
    const rRes = await connection.execute(`SELECT LIB_CODE, LIB_ID FROM U_LIB_LIST`);
    const oracleRows = rRes.rows || [];
    
    // 2. Fetch Postgres
    const pgRows = await fetchAllFromSupabase(supabase, 'u_lib_list', 'lib_code, lib_id');

    console.log(`Oracle total rows: ${oracleRows.length}`);
    console.log(`Postgres total rows: ${pgRows.length}`);

    // Map to keys
    const oracleKeys = oracleRows.map(r => `${String(r.LIB_CODE || "").trim()}::${String(r.LIB_ID || "").trim()}`);
    const pgKeys = pgRows.map(r => `${String(r.lib_code || "").trim()}::${String(r.lib_id || "").trim()}`);

    const uniqueOracleKeys = new Set(oracleKeys);
    const uniquePgKeys = new Set(pgKeys);

    console.log(`Oracle unique keys: ${uniqueOracleKeys.size}`);
    console.log(`Postgres unique keys: ${uniquePgKeys.size}`);

    // Let's check duplicates
    if (oracleKeys.length !== uniqueOracleKeys.size) {
      console.log(`Oracle has ${oracleKeys.length - uniqueOracleKeys.size} duplicate keys!`);
      const seen = new Set();
      const dups = [];
      oracleKeys.forEach(k => {
        if (seen.has(k)) dups.push(k);
        else seen.add(k);
      });
      console.log("Sample duplicates in Oracle:", dups.slice(0, 10));
    }

    if (pgKeys.length !== uniquePgKeys.size) {
      console.log(`Postgres has ${pgKeys.length - uniquePgKeys.size} duplicate keys!`);
    }

    // Let's compute missing in Postgres (in Oracle but not in Postgres)
    const missing = [];
    uniqueOracleKeys.forEach(k => {
      if (!uniquePgKeys.has(k)) {
        missing.push(k);
      }
    });

    console.log(`Missing in Postgres count: ${missing.length}`);
    if (missing.length > 0) {
      console.log("Sample missing keys in Postgres:", missing.slice(0, 10));
    }

    // Let's check case-insensitive matching
    const pgKeysLower = new Set(Array.from(uniquePgKeys).map(k => k.toLowerCase()));
    const missingCaseInsensitive = [];
    missing.forEach(k => {
      if (!pgKeysLower.has(k.toLowerCase())) {
        missingCaseInsensitive.push(k);
      }
    });

    console.log(`Missing in Postgres (case-insensitive) count: ${missingCaseInsensitive.length}`);
    if (missingCaseInsensitive.length > 0) {
      console.log("Sample missing keys (case-insensitive):", missingCaseInsensitive.slice(0, 10));
    }

  } catch (err) {
    console.error(err);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

run();
