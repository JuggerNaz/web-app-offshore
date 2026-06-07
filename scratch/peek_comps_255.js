const oracledb = require("oracledb");

async function run() {
  let conn;
  try {
    oracledb.initOracleClient({ libDir: "C:\\instantclient64_12_2" });
    conn = await oracledb.getConnection({
      user: "sko251",
      password: "sko251",
      connectString: "nq-35:1522/orcl10"
    });

    // Check distinct COMP_IDs from PLATGI for STR_ID 255
    let result = await conn.execute(
      `SELECT DISTINCT p.COMP_ID, a.CODE, a.ID_NO 
       FROM PLATGI p 
       LEFT JOIN ALLCOMPID a ON a.COMP_ID = p.COMP_ID AND a.STR_ID = p.STR_ID
       WHERE p.STR_ID = 255 AND p.INSP_ID > 0 AND p.DESCRIPTION != 'TAPE LOG'
       ORDER BY p.COMP_ID`
    );
    console.log(`\nDistinct COMP_IDs in PLATGI for STR_ID 255: ${result.rows.length}`);
    result.rows.slice(0, 20).forEach(r => console.log(`  COMP_ID: ${r[0]}, CODE: ${r[1]}, ID_NO: ${r[2]}`));

    // Check what's in PostgreSQL structure_components for structure_id 255
    const { createClient } = require("@supabase/supabase-js");
    const dotenv = require("dotenv");
    dotenv.config({ path: ".env.local" });
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: pgComps, error } = await supabase
      .from("structure_components")
      .select("id, comp_id, code")
      .eq("structure_id", 255);

    if (error) {
      console.log(`\nPostgreSQL error: ${error.message}`);
    } else {
      console.log(`\nPostgreSQL structure_components for structure_id 255: ${pgComps?.length || 0} records`);
      if (pgComps && pgComps.length > 0) {
        pgComps.slice(0, 10).forEach(c => console.log(`  id: ${c.id}, comp_id: ${c.comp_id}, code: ${c.code}`));
      }
    }

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    if (conn) await conn.close();
  }
}

run();
