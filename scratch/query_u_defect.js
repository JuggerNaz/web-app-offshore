const oracledb = require("oracledb");
const fs = require("fs");

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

    console.log("\n--- Querying u_defect for exactly '14/D21JT-A/A-014R' ---");
    let result = await conn.execute(
      `SELECT * FROM u_defect WHERE DFT_REF_NO = '14/D21JT-A/A-014R'`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    console.log("Found rows count:", result.rows.length);
    console.log("Rows:", JSON.stringify(result.rows, null, 2));

    if (result.rows.length > 0) {
      const row = result.rows[0];
      // Let's also check if these defect code/types map to library
      const codeType = row.DFT_CODE_TYPE || row.DFT_CODE_TYP;
      const defectCode = row.DEFECT_CODE;
      const defectType = row.DEFECT_TYPE;
      
      console.log(`\nDFT_CODE_TYPE = ${codeType}, DEFECT_CODE = ${defectCode}, DEFECT_TYPE = ${defectType}`);
      
      const libQuery = await conn.execute(
        `SELECT * FROM u_lib_list WHERE LIB_ID IN (:c1, :c2, :c3)`,
        [codeType, defectCode, defectType],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      console.log("Matching Library items:", JSON.stringify(libQuery.rows, null, 2));
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
