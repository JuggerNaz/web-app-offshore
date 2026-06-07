const oracledb = require("oracledb");

async function run() {
  let conn;
  try {
    console.log("Connecting to Oracle...");
    oracledb.initOracleClient({ libDir: "C:\\instantclient64_12_2" });
    
    conn = await oracledb.getConnection({
      user: "sko251",
      password: "sko251",
      connectString: "nq-35:1522/orcl10"
    });
    
    console.log("Connection successful!");

    // Query u_defect columns
    console.log("\n--- u_defect columns ---");
    let result = await conn.execute(
      `SELECT COLUMN_NAME, DATA_TYPE FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'U_DEFECT'`
    );
    result.rows.forEach(r => console.log(`${r[0] || r.COLUMN_NAME}: ${r[1] || r.DATA_TYPE}`));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

run();
