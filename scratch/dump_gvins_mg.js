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
    const res = await conn.execute(
      `SELECT DISTINCT MARINE_GROW FROM GVINS WHERE MARINE_GROW IS NOT NULL`
    );
    console.log("Distinct MARINE_GROW in GVINS:", res.rows);
    
    const sampleRes = await conn.execute(
      `SELECT * FROM GVINS WHERE MARINE_GROW IS NOT NULL AND ROWNUM <= 5`
    );
    console.log("Sample records with MARINE_GROW:", sampleRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    if (conn) await conn.close();
  }
}
run();
