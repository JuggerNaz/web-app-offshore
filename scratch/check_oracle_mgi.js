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

    // Query U_MGI_PROFILE columns
    console.log("\n--- U_MGI_PROFILE columns ---");
    let colsResult = await conn.execute(
      `SELECT COLUMN_NAME, DATA_TYPE FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'U_MGI_PROFILE'`
    );
    colsResult.rows.forEach(r => console.log(`${r[0] || r.COLUMN_NAME}: ${r[1] || r.DATA_TYPE}`));

    // Query all records in U_MGI_PROFILE
    console.log("\n--- U_MGI_PROFILE data ---");
    let dataResult = await conn.execute(
      `SELECT * FROM U_MGI_PROFILE`
    );
    
    if (dataResult.rows && dataResult.rows.length > 0) {
      const meta = dataResult.metaData.map(m => m.name);
      dataResult.rows.forEach((row, i) => {
        console.log(`\nRow ${i+1}:`);
        row.forEach((val, idx) => {
          console.log(`  ${meta[idx]}: ${val}`);
        });
      });
    } else {
      console.log("No data found in U_MGI_PROFILE");
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
