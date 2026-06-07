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

    // Count of DEL=1 with at least one inspection
    const r1 = await conn.execute(
      `SELECT COUNT(*) FROM ALLCOMPID c
       WHERE c.STR_ID = '260' AND c.CODE = 'WN'
         AND c.DEL = 1
         AND EXISTS (SELECT 1 FROM allinspid i WHERE i.COMP_ID = c.COMP_ID AND i.STR_ID = c.STR_ID)`
    );
    console.log("DEL=1 with inspections:", r1.rows[0]);

    // Count of DEL=null with at least one inspection
    const r2 = await conn.execute(
      `SELECT COUNT(*) FROM ALLCOMPID c
       WHERE c.STR_ID = '260' AND c.CODE = 'WN'
         AND c.DEL IS NULL
         AND EXISTS (SELECT 1 FROM allinspid i WHERE i.COMP_ID = c.COMP_ID AND i.STR_ID = c.STR_ID)`
    );
    console.log("DEL=null with inspections:", r2.rows[0]);

    // Count of ALLCOMPID records where DEL=1
    const r3 = await conn.execute(
      `SELECT COUNT(*) FROM ALLCOMPID c
       WHERE c.STR_ID = '260' AND c.CODE = 'WN'
         AND c.DEL = 1`
    );
    console.log("Total DEL=1 components:", r3.rows[0]);

    // Count of ALLCOMPID records where DEL is NULL
    const r4 = await conn.execute(
      `SELECT COUNT(*) FROM ALLCOMPID c
       WHERE c.STR_ID = '260' AND c.CODE = 'WN'
         AND c.DEL IS NULL`
    );
    console.log("Total DEL=null components:", r4.rows[0]);

  } catch (err) {
    console.error(err);
  } finally {
    if (conn) await conn.close();
  }
}

main();
