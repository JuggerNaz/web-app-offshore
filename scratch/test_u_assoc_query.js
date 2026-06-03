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

    const query = `
      SELECT a.COMP_ID, a.ASSOC_COMPID 
      FROM U_ASSOC a 
      WHERE a.STR_ID = :strId
        AND a.COMP_ID IN (SELECT c1.COMP_ID FROM ALLCOMPID c1 WHERE c1.STR_ID = :strId)
        AND a.ASSOC_COMPID IN (SELECT c2.COMP_ID FROM ALLCOMPID c2 WHERE c2.STR_ID = :strId)
    `;
    
    console.log("Running query for STR_ID = 203...");
    const result = await conn.execute(query, { strId: 203 });
    console.log(`Query successful! Count of rows: ${result.rows.length}`);
    if (result.rows.length > 0) {
      console.log("Sample rows:");
      console.log(result.rows.slice(0, 5));
    }

  } catch (err) {
    console.error("Error running query:", err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

run();
