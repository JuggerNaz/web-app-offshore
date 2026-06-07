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

    // Query PLATGI for sample row
    console.log("\n--- PLATGI row for INSP_ID 646181 ---");
    let result = await conn.execute(
      `SELECT INSP_ID, STR_ID, INSPNO, COMP_ID, TAPE_NO FROM PLATGI WHERE INSP_ID = 646181`
    );
    result.rows.forEach(r => console.log(r));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

run();
