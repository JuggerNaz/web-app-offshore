const { createClient } = require('@supabase/supabase-js');
const oracledb = require('oracledb');
const fs = require('fs');

require('dotenv').config({ path: '.env.local' });
const config = JSON.parse(fs.readFileSync('oracle_config.json', 'utf8'));

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  if (config.useThickMode) {
    try {
      oracledb.initOracleClient({ libDir: config.libDir });
    } catch (err) {}
  }
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  oracledb.fetchAsString = [oracledb.DATE, oracledb.NUMBER];

  let conn;
  try {
    // 1. Check if there are any video tapes and logs in Supabase currently
    const { data: tapes, error: tErr } = await supabase.from('insp_video_tapes').select('*');
    const { data: logs, error: lErr } = await supabase.from('insp_video_logs').select('*');

    console.log("Supabase Current State:");
    console.log(` - Tapes Count: ${tapes ? tapes.length : 0} (Error: ${tErr ? tErr.message : 'none'})`);
    console.log(` - Logs Count: ${logs ? logs.length : 0} (Error: ${lErr ? lErr.message : 'none'})`);

    if (tapes && tapes.length > 0) {
      console.log("Sample tape:", tapes[0]);
    }
    if (logs && logs.length > 0) {
      console.log("Sample log:", logs[0]);
    }

    // 2. Query Oracle to see if there are tape logs for a structure
    conn = await oracledb.getConnection({
      user: config.user,
      password: config.password,
      connectString: config.connectString || `${config.host}:${config.port}/${config.serviceName}`
    });

    // Query list of distinct structures in PLATGI that have TAPE LOG
    const structuresRes = await conn.execute(
      `SELECT DISTINCT STR_ID, COUNT(*) AS CNT FROM PLATGI WHERE DESCRIPTION = 'TAPE LOG' GROUP BY STR_ID`
    );
    console.log("\nStructures in PLATGI with 'TAPE LOG':");
    structuresRes.rows.forEach(r => console.log(` - STR_ID: ${r.STR_ID}, Log Count: ${r.CNT}`));

    // Query list of distinct structures in VIDEO table
    const videoStrRes = await conn.execute(
      `SELECT DISTINCT STR_ID, COUNT(*) AS CNT FROM VIDEO GROUP BY STR_ID`
    );
    console.log("\nStructures in VIDEO:");
    videoStrRes.rows.forEach(r => console.log(` - STR_ID: ${r.STR_ID}, Video Count: ${r.CNT}`));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

main();
