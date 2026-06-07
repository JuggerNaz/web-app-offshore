const oracledb = require("oracledb");
const fs = require("fs");
const path = require("path");

async function run() {
  const config = JSON.parse(fs.readFileSync("oracle_config.json", "utf8"));
  console.log("Oracle config loaded:", config);

  if (config.useThickMode) {
    try {
      oracledb.initOracleClient({ libDir: config.libDir });
      console.log("Initialized in Thick Mode");
    } catch (err) {
      console.log("Thick mode init warning:", err.message);
    }
  }

  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: config.user,
      password: config.password,
      connectString: config.connectString || `${config.host}:${config.port}/${config.serviceName}`
    });
    console.log("Connected to Oracle!");

    // Helper to print columns and record count
    async function inspectTable(tableName) {
      console.log(`\n=== Inspecting ${tableName} ===`);
      try {
        const countRes = await conn.execute(`SELECT COUNT(*) AS CNT FROM ${tableName}`);
        console.log("Total Count:", countRes.rows[0].CNT);

        const columnsRes = await conn.execute(
          `SELECT COLUMN_NAME, DATA_TYPE FROM USER_TAB_COLUMNS WHERE TABLE_NAME = :tName`,
          { tName: tableName.toUpperCase() }
        );
        console.log("Columns:");
        columnsRes.rows.forEach(r => {
          console.log(`  - ${r.COLUMN_NAME}: ${r.DATA_TYPE}`);
        });

        const sampleRes = await conn.execute(`SELECT * FROM ${tableName} WHERE ROWNUM <= 2`);
        console.log("Sample Rows:");
        console.log(JSON.stringify(sampleRes.rows, null, 2));
      } catch (err) {
        console.error(`Error inspecting table ${tableName}:`, err.message);
      }
    }

    await inspectTable("u_lib_mast");
    await inspectTable("u_lib_list");
    await inspectTable("u_lib_combo");

  } catch (err) {
    console.error("Connection error:", err);
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (e) {}
    }
  }
}

run();
