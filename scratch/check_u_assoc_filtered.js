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

    // 1. Count without DEL filter
    const r1 = await conn.execute(
      `SELECT COUNT(*) FROM U_ASSOC a 
       WHERE a.STR_ID = :strId
         AND a.COMP_ID IN (SELECT c1.COMP_ID FROM ALLCOMPID c1 WHERE c1.STR_ID = :strId)
         AND a.ASSOC_COMPID IN (SELECT c2.COMP_ID FROM ALLCOMPID c2 WHERE c2.STR_ID = :strId)`,
      { strId: "260" }
    );
    console.log("U_ASSOC count (unfiltered c1/c2):", r1.rows[0]);

    // 2. Count with NVL(DEL, 0) = 1 filter
    const r2 = await conn.execute(
      `SELECT COUNT(*) FROM U_ASSOC a 
       WHERE a.STR_ID = :strId
         AND a.COMP_ID IN (
           SELECT c1.COMP_ID FROM ALLCOMPID c1 
           WHERE c1.STR_ID = :strId
             AND NOT (NVL(c1.DEL, 0) = 1 AND NOT EXISTS (
               SELECT 1 FROM allinspid i1 WHERE i1.COMP_ID = c1.COMP_ID AND i1.STR_ID = c1.STR_ID
             ))
         )
         AND a.ASSOC_COMPID IN (
           SELECT c2.COMP_ID FROM ALLCOMPID c2 
           WHERE c2.STR_ID = :strId
             AND NOT (NVL(c2.DEL, 0) = 1 AND NOT EXISTS (
               SELECT 1 FROM allinspid i2 WHERE i2.COMP_ID = c2.COMP_ID AND i2.STR_ID = c2.STR_ID
             ))
         )`,
      { strId: "260" }
    );
    console.log("U_ASSOC count (filtered with NVL DEL):", r2.rows[0]);

  } catch (err) {
    console.error(err);
  } finally {
    if (conn) await conn.close();
  }
}

main();
