const oracledb = require("oracledb");
const fs = require("fs");
const path = require("path");

async function run() {
  const config = JSON.parse(fs.readFileSync("oracle_config.json", "utf8"));
  if (config.useThickMode) {
    try { oracledb.initOracleClient({ libDir: config.libDir }); } catch (e) {}
  }
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: config.user,
      password: config.password,
      connectString: config.connectString || `${config.host}:${config.port}/${config.serviceName}`
    });
    
    const countRes = await conn.execute(`SELECT COUNT(*) as cnt FROM RISER`);
    console.log("Total rows in RISER:", countRes.rows[0].CNT);
    
    const sampleRes = await conn.execute(
      `SELECT INSP_ID, WALL_THK, BOTTM_HT, ELEV_BOTTM, MG, CP_IN, CP_OUT FROM RISER WHERE (WALL_THK IS NOT NULL OR BOTTM_HT IS NOT NULL OR ELEV_BOTTM IS NOT NULL OR MG IS NOT NULL OR CP_IN IS NOT NULL OR CP_OUT IS NOT NULL) AND ROWNUM <= 10`
    );
    console.log("Sample RISER rows:", sampleRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    if (conn) await conn.close();
  }
}
run();
