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

    // 1. Fetch column details of BSINS table
    const colRes = await conn.execute(
      `SELECT COLUMN_NAME, DATA_TYPE FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'BSINS'`
    );
    console.log("Columns of Oracle BSINS table:");
    colRes.rows.forEach(r => {
      console.log(` - ${r[0]} (${r[1]})`);
    });

    // 2. Fetch a sample row from BSINS
    const sampleRes = await conn.execute(
      `SELECT * FROM BSINS WHERE ROWNUM = 1`
    );
    if (sampleRes.rows && sampleRes.rows.length > 0) {
      console.log("\nSample row raw:");
      console.log(sampleRes.rows[0]);
      console.log("\nSample row with meta:");
      const meta = sampleRes.metaData.map(m => m.name);
      const row = sampleRes.rows[0];
      const obj = {};
      meta.forEach((name, idx) => {
        obj[name] = row[idx];
      });
      console.log(JSON.stringify(obj, null, 2));
    } else {
      console.log("\nNo rows found in Oracle BSINS table.");
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
