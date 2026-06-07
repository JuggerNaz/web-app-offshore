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
    
    const mgRes = await conn.execute(
      `SELECT DISTINCT MG FROM RISER WHERE MG IS NOT NULL`
    );
    console.log("Distinct MG values in RISER:", mgRes.rows);

    const bRes = await conn.execute(
      `SELECT DISTINCT BOTTM_HT FROM RISER WHERE BOTTM_HT IS NOT NULL`
    );
    console.log("Distinct BOTTM_HT values in RISER:", bRes.rows.slice(0, 10));

    const eRes = await conn.execute(
      `SELECT DISTINCT ELEV_BOTTM FROM RISER WHERE ELEV_BOTTM IS NOT NULL`
    );
    console.log("Distinct ELEV_BOTTM values in RISER:", eRes.rows.slice(0, 10));

    const wtRes = await conn.execute(
      `SELECT DISTINCT WALL_THK FROM RISER WHERE WALL_THK IS NOT NULL`
    );
    console.log("Distinct WALL_THK values in RISER:", wtRes.rows.slice(0, 10));
    
  } catch (err) {
    console.error(err);
  } finally {
    if (conn) await conn.close();
  }
}
run();
