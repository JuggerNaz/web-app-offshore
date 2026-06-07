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

    console.log("Connected to Oracle.");

    // Describe WN_COMP
    const descWn = await conn.execute("SELECT * FROM WN_COMP WHERE ROWNUM = 1");
    console.log("WN_COMP columns:", descWn.metaData.map(m => m.name));

    // Let's check how many records in WN_COMP are there for STR_ID = 260?
    // Wait, does WN_COMP have a STR_ID or do we join it with ALLCOMPID?
    // Let's inspect the count of records in WN_COMP for COMP_ID that belongs to STR_ID = 260.
    const countWnJoined = await conn.execute(
      `SELECT COUNT(*) FROM WN_COMP w
       JOIN ALLCOMPID c ON w.COMP_ID = c.COMP_ID
       WHERE c.STR_ID = :strId`,
      { strId: "260" }
    );
    console.log("WN_COMP joined with ALLCOMPID count for str_id=260:", countWnJoined.rows[0]);

    // Let's see the DEL values for these:
    const delJoined = await conn.execute(
      `SELECT c.DEL, COUNT(*) FROM WN_COMP w
       JOIN ALLCOMPID c ON w.COMP_ID = c.COMP_ID
       WHERE c.STR_ID = :strId
       GROUP BY c.DEL`,
      { strId: "260" }
    );
    console.log("DEL values in ALLCOMPID for WN_COMP components on str_id=260:", delJoined.rows);

    // Let's check if there are inspections for these:
    const inspCount = await conn.execute(
      `SELECT c.DEL, COUNT(i.INSP_ID) as INSP_COUNT, COUNT(DISTINCT c.COMP_ID) as DISTINCT_COMP
       FROM ALLCOMPID c
       LEFT JOIN allinspid i ON c.COMP_ID = i.COMP_ID AND c.STR_ID = i.STR_ID
       WHERE c.STR_ID = :strId AND c.CODE = 'WN'
       GROUP BY c.DEL`,
      { strId: "260" }
    );
    console.log("Inspections count by DEL for WN components on str_id=260:", inspCount.rows);

  } catch (err) {
    console.error(err);
  } finally {
    if (conn) await conn.close();
  }
}

main();
