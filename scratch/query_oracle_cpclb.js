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

    console.log("=== Querying Oracle ALLINSPID Metadata ===");
    const allinspMeta = await conn.execute(
      `SELECT * FROM ALLINSPID WHERE 1=0`
    );
    const allinspidCols = allinspMeta.metaData.map(m => m.name);
    console.log("ALLINSPID Columns:", allinspidCols);

    const colsToSelect = allinspidCols.filter(c => ['INSP_ID', 'INSPNO', 'COMP_ID', 'INSP_TYPE', 'STR_ID'].includes(c));

    const allinsp = await conn.execute(
      `SELECT ${colsToSelect.join(', ')} 
       FROM ALLINSPID 
       WHERE STR_ID = 1061 AND INSPNO = '00000003454' AND TRIM(UPPER(INSP_TYPE)) = 'CPCLB'
       ORDER BY INSP_ID`
    );
    console.log(`Found ${allinsp.rows.length} rows in ALLINSPID:`);
    console.log(allinsp.metaData.map(m => m.name));
    console.log(allinsp.rows);

    console.log("\n=== Querying Oracle CPCLB Table ===");
    const cpclbMeta = await conn.execute(
      `SELECT * FROM CPCLB WHERE 1=0`
    );
    const cpclbCols = cpclbMeta.metaData.map(m => m.name);
    console.log("CPCLB Columns:", cpclbCols);

    const cpclb = await conn.execute(
      `SELECT * FROM CPCLB WHERE STR_ID = 1061 AND INSP_ID IS NOT NULL`
    );
    console.log(`Found ${cpclb.rows.length} rows in CPCLB:`);
    console.log(cpclb.metaData.map(m => m.name));
    console.log(cpclb.rows.slice(0, 15));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

run();
