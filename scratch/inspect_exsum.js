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

    // Find all tables that sound like exsum
    const tabRes = await conn.execute(
      `SELECT TABLE_NAME FROM USER_TABLES WHERE TABLE_NAME LIKE '%EX%'`
    );
    console.log("Tables containing EX:", tabRes.rows.map(r => r[0]));

    // Query EXSUM structure
    try {
      const colRes = await conn.execute(
        `SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'EXSUM'`
      );
      console.log("EXSUM columns:", colRes.rows.map(r => r[0]));

      const dataRes = await conn.execute(
        `SELECT * FROM EXSUM WHERE ROWNUM <= 5`
      );
      console.log("EXSUM sample metadata:", dataRes.metaData.map(m => m.name));
      console.log("EXSUM sample rows:", dataRes.rows);
    } catch (e) {
      console.log("Error querying EXSUM table:", e.message);
    }

  } catch (err) {
    console.error("Connection Error:", err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

run();
