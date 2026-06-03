const oracledb = require("oracledb");
const fs = require("fs");
const path = require("path");

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

    // 1. Fetch 5 rows where DEL = 1
    console.log("--- Sample of DEL = 1 components ---");
    const r1 = await conn.execute(
      `SELECT COMP_ID, Q_ID, ID_NO, DESCRIPTION, DEL, ELV_1, ELV_2 FROM ALLCOMPID
       WHERE STR_ID = '260' AND CODE = 'WN' AND DEL = 1 AND ROWNUM <= 5`
    );
    console.log(r1.rows);

    // 2. Fetch 5 rows where DEL IS NULL
    console.log("\n--- Sample of DEL IS NULL components ---");
    const r2 = await conn.execute(
      `SELECT COMP_ID, Q_ID, ID_NO, DESCRIPTION, DEL, ELV_1, ELV_2 FROM ALLCOMPID
       WHERE STR_ID = '260' AND CODE = 'WN' AND DEL IS NULL AND ROWNUM <= 5`
    );
    console.log(r2.rows);

  } catch (err) {
    console.error(err);
  } finally {
    if (conn) await conn.close();
  }
}

main();
