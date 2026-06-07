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

    const result = await conn.execute(
      `SELECT COLUMN_NAME, DATA_TYPE FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'U_ATTACH_1'`
    );
    
    console.log("\n--- U_ATTACH_1 columns ---");
    result.rows.forEach(r => console.log(`${r[0]}: ${r[1]}`));

    console.log("\n--- Sample row from U_ATTACH_1 ---");
    const sample = await conn.execute(
      `SELECT * FROM U_ATTACH_1 WHERE ROWNUM = 1`
    );
    if (sample.rows && sample.rows.length > 0) {
      console.log("Sample meta keys:", sample.metaData.map(m => m.name));
      console.log("Sample values:", sample.rows[0]);
    } else {
      console.log("No rows in U_ATTACH_1");
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

run();
