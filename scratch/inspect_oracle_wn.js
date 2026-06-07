const oracledb = require("oracledb");
const fs = require("fs");
const path = require("path");

async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, "../oracle_config.json"), "utf8"));
  
  if (config.useThickMode) {
    try {
      oracledb.initOracleClient({ libDir: config.libDir });
      console.log("Oracle thick client initialized with libDir:", config.libDir);
    } catch (e) {
      console.log("Thick mode init failed or already initialized:", e.message);
    }
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: config.user,
      password: config.password,
      connectString: config.connectString || `${config.host}:${config.port}/${config.serviceName}`
    });
    console.log("Successfully connected to Oracle!");

    // 1. Describe ALLCOMPID table/view columns
    console.log("\n--- Describing ALLCOMPID columns ---");
    const descRes = await conn.execute("SELECT * FROM ALLCOMPID WHERE ROWNUM = 1");
    console.log("ALLCOMPID columns:", descRes.metaData.map(m => m.name));

    // 2. Count records in WN_COMP directly
    console.log("\n--- Count of WN_COMP ---");
    try {
      const wnDirect = await conn.execute("SELECT COUNT(*) as CNT FROM WN_COMP");
      console.log("Total WN_COMP count:", wnDirect.rows[0]);
    } catch (e) {
      console.log("Error querying WN_COMP directly:", e.message);
    }

    // 3. Count in ALLCOMPID for STR_ID = 260 and CODE = 'WN'
    console.log("\n--- Count in ALLCOMPID for STR_ID=260, CODE='WN' (No DEL check) ---");
    const countAll = await conn.execute(
      "SELECT COUNT(*) FROM ALLCOMPID WHERE STR_ID = :strId AND CODE = :code",
      { strId: "260", code: "WN" }
    );
    console.log("Count (No DEL filter):", countAll.rows[0]);

    // 4. Count with c.DEL = 1 AND NOT EXISTS(...) logic
    console.log("\n--- Count in ALLCOMPID with DEL = 1 filter ---");
    const countFilterOld = await conn.execute(
      `SELECT COUNT(*) FROM ALLCOMPID 
       WHERE STR_ID = :strId AND CODE = :code 
         AND NOT (DEL = 1 AND NOT EXISTS (
           SELECT 1 FROM allinspid i WHERE i.COMP_ID = allcompid.COMP_ID AND i.STR_ID = allcompid.STR_ID
         ))`,
      { strId: "260", code: "WN" }
    );
    console.log("Count (Old DEL = 1 filter):", countFilterOld.rows[0]);

    // 5. Count with NVL(DEL, 0) = 1 AND NOT EXISTS(...) logic
    console.log("\n--- Count in ALLCOMPID with NVL(DEL, 0) = 1 filter ---");
    const countFilterNew = await conn.execute(
      `SELECT COUNT(*) FROM ALLCOMPID 
       WHERE STR_ID = :strId AND CODE = :code 
         AND NOT (NVL(DEL, 0) = 1 AND NOT EXISTS (
           SELECT 1 FROM allinspid i WHERE i.COMP_ID = allcompid.COMP_ID AND i.STR_ID = allcompid.STR_ID
         ))`,
      { strId: "260", code: "WN" }
    );
    console.log("Count (NVL DEL filter):", countFilterNew.rows[0]);

    // 6. See DEL values in ALLCOMPID for CODE='WN', STR_ID=260
    console.log("\n--- Inspecting DEL values ---");
    const delValues = await conn.execute(
      `SELECT DEL, COUNT(*) FROM ALLCOMPID 
       WHERE STR_ID = :strId AND CODE = :code
       GROUP BY DEL`,
      { strId: "260", code: "WN" }
    );
    console.log("DEL value distribution:", delValues.rows);

  } catch (err) {
    console.error("Oracle execution error:", err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

main();
