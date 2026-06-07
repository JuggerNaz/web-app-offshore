const oracledb = require("oracledb");
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [key, ...value] = line.split('=');
    if (key && value) acc[key.trim()] = value.join('=').trim();
    return acc;
  }, {});

const supabase = createClient(
  envConfig.NEXT_PUBLIC_SUPABASE_URL,
  envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  let conn;
  try {
    oracledb.initOracleClient({ libDir: "C:\\instantclient64_12_2" });
    conn = await oracledb.getConnection({
      user: "sko251",
      password: "sko251",
      connectString: "nq-35:1522/orcl10"
    });

    console.log("Checking COMP_ID mapping for CPCLB and UTCLB...");

    // Get unique COMP_IDs for CPCLB
    const cpclbComps = await conn.execute(
      `SELECT DISTINCT COMP_ID FROM ALLINSPID WHERE STR_ID = 1061 AND INSPNO = '00000003454' AND TRIM(UPPER(INSP_TYPE)) = 'CPCLB'`
    );
    const cpclbCompIds = cpclbComps.rows.map(r => Number(r[0]));
    console.log("CPCLB COMP_IDs in Oracle:", cpclbCompIds);

    // Get unique COMP_IDs for UTCLB
    const utclbComps = await conn.execute(
      `SELECT DISTINCT COMP_ID FROM ALLINSPID WHERE STR_ID = 1061 AND INSPNO = '00000003454' AND TRIM(UPPER(INSP_TYPE)) = 'UTCLB'`
    );
    const utclbCompIds = utclbComps.rows.map(r => Number(r[0]));
    console.log("UTCLB COMP_IDs in Oracle:", utclbCompIds);

    // Query Postgres for these COMP_IDs
    const { data: pgCPComps } = await supabase
      .from('structure_components')
      .select('id, comp_id, code')
      .eq('structure_id', 1061)
      .in('comp_id', [...cpclbCompIds, ...utclbCompIds]);

    console.log("PostgreSQL structure_components matching these COMP_IDs:");
    console.log(pgCPComps);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

run();
