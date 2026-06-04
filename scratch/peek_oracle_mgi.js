const oracledb = require("oracledb");

async function run() {
  let conn;
  try {
    console.log("Connecting to Oracle...");
    oracledb.initOracleClient({ libDir: "C:\\instantclient64_12_2" });
    
    conn = await oracledb.getConnection({
      user: "wincairs",
      password: "Nkumar@10",
      connectString: "nq-35:1522/orcl10"
    });
    
    console.log("Connection successful!");

    // Query U_MGI_PROFILE columns
    console.log("\n--- U_MGI_PROFILE columns ---");
    let result = await conn.execute(
      `SELECT COLUMN_NAME, DATA_TYPE FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'U_MGI_PROFILE'`
    );
    console.log(result.rows);

    // Query a few rows of U_MGI_PROFILE
    console.log("\n--- U_MGI_PROFILE sample ---");
    result = await conn.execute(
      `SELECT * FROM U_MGI_PROFILE WHERE ROWNUM <= 10`
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
