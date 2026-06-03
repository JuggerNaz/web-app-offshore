const { createClient } = require('@supabase/supabase-js');
const oracledb = require("oracledb");
const fs = require("fs");
const path = require("path");

require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, "../oracle_config.json"), "utf8"));
  
  if (config.useThickMode) {
    try {
      oracledb.initOracleClient({ libDir: config.libDir });
    } catch (e) {}
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: config.user,
      password: config.password,
      connectString: config.connectString || `${config.host}:${config.port}/${config.serviceName}`
    });

    // 1. Fetch Oracle U_LIB_LIST
    const rRes = await conn.execute(`SELECT LIB_CODE, LIB_ID, LIB_DESC FROM U_LIB_LIST`);
    const oracleItems = (rRes.rows || []).map((row) => {
      const lcode = String(row.LIB_CODE || row[0] || "").trim();
      const lid = String(row.LIB_ID || row[1] || "").trim();
      return `${lcode}::${lid}`;
    });

    console.log("Oracle U_LIB_LIST keys count:", oracleItems.length);
    console.log("Oracle Sample Keys:", oracleItems.slice(0, 10));

    // 2. Fetch Postgres u_lib_list
    const { data: pgData, error: pgErr } = await supabase.from('u_lib_list').select('lib_code, lib_id, lib_desc');
    if (pgErr) {
      console.error("Postgres error:", pgErr);
      return;
    }

    const postgresItems = (pgData || []).map((row) => {
      const lcode = String(row.lib_code || "").trim();
      const lid = String(row.lib_id || "").trim();
      return `${lcode}::${lid}`;
    });

    console.log("Postgres U_LIB_LIST keys count:", postgresItems.length);
    console.log("Postgres Sample Keys:", postgresItems.slice(0, 10));

    // Compare
    const pgKeys = new Set(postgresItems);
    const missing = oracleItems.filter(k => !pgKeys.has(k));
    console.log("Number of missing keys in Postgres:", missing.length);
    console.log("Sample missing keys:", missing.slice(0, 10));

    // Let's inspect COMPGRP specifically
    console.log("\n--- COMPGRP items in Oracle ---");
    const oracleCompGrp = (rRes.rows || [])
      .filter((row) => String(row.LIB_CODE || row[0]).trim() === 'COMPGRP')
      .map((row) => ({
        lib_code: String(row.LIB_CODE || row[0]).trim(),
        lib_id: String(row.LIB_ID || row[1]).trim(),
        lib_desc: String(row.LIB_DESC || row[2]).trim()
      }));
    console.log(oracleCompGrp);

    console.log("\n--- COMPGRP items in Postgres ---");
    const pgCompGrp = (pgData || [])
      .filter((row) => String(row.lib_code).trim() === 'COMPGRP')
      .map((row) => ({
        lib_code: String(row.lib_code).trim(),
        lib_id: String(row.lib_id).trim(),
        lib_desc: String(row.lib_desc).trim()
      }));
    console.log(pgCompGrp);

  } catch (err) {
    console.error(err);
  } finally {
    if (conn) await conn.close();
  }
}

main();
