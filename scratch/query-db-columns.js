const oracledb = require("oracledb");

async function run() {
  let conn;
  try {
    console.log("Connecting to Oracle with Nkumar@10...");
    oracledb.initOracleClient({ libDir: "C:\\instantclient64_12_2" });
    
    conn = await oracledb.getConnection({
      user: "wincairs",
      password: "Nkumar@10",
      connectString: "nq-35:1522/orcl10"
    });
    
    console.log("Connection successful!");

    // Query INSPTYPE columns
    console.log("\n--- INSPTYPE columns ---");
    let result = await conn.execute(
      `SELECT COLUMN_NAME, DATA_TYPE FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'INSPTYPE'`
    );
    console.log(result.rows);

    // Query a few rows of INSPTYPE
    console.log("\n--- INSPTYPE sample ---");
    result = await conn.execute(
      `SELECT * FROM INSPTYPE WHERE ROWNUM <= 5`
    );
    console.log(result.rows);

    // Query ALLINSPID columns
    console.log("\n--- ALLINSPID columns ---");
    result = await conn.execute(
      `SELECT COLUMN_NAME, DATA_TYPE FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'ALLINSPID'`
    );
    console.log(result.rows);

    // Query a few rows of ALLINSPID
    console.log("\n--- ALLINSPID sample ---");
    result = await conn.execute(
      `SELECT * FROM ALLINSPID WHERE ROWNUM <= 5`
    );
    console.log(result.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

run();
