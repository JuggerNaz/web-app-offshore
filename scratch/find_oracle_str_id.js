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
    
    // Find D21JT-A str_id in Oracle using TITLE
    const result = await conn.execute(
      `SELECT STR_ID, TITLE FROM v_structure WHERE UPPER(TITLE) LIKE '%D21JT-A%'`
    );
    console.log("Oracle v_structure results:", result.rows);
    
    // Let's also check structure table using TITLE or other column
    try {
      const result2 = await conn.execute(
        `SELECT STR_ID, TITLE FROM structure WHERE UPPER(TITLE) LIKE '%D21JT-A%'`
      );
      console.log("Oracle structure results:", result2.rows);
    } catch (e) {
      console.log("Structure table check failed:", e.message);
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
