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

    console.log("Connected to Oracle.");

    // Query EXSUM records
    const res = await conn.execute(
      `SELECT STR_ID, INSPNO, COUNT(*) as CNT FROM EXSUM GROUP BY STR_ID, INSPNO ORDER BY CNT DESC`
    );
    console.log("Oracle EXSUM groups (sample):", res.rows.slice(0, 10));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

run();
