const oracledb = require("oracledb");
const fs = require("fs");
const path = require("path");

async function run() {
  const configPath = path.resolve("oracle_config.json");
  if (!fs.existsSync(configPath)) {
    console.error("oracle_config.json not found");
    return;
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  
  if (config.useThickMode) {
    try {
      oracledb.initOracleClient({ libDir: config.libDir });
      console.log("Initialized thick mode");
    } catch (e) {
      console.warn("Thick mode init warning:", e.message);
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
    console.log("Connected to Oracle database!");
    
    for (const table of ["GVINS", "RISER"]) {
      console.log(`\n=================== ${table} Columns ===================`);
      const colsRes = await conn.execute(
        `SELECT COLUMN_NAME, DATA_TYPE FROM USER_TAB_COLUMNS WHERE TABLE_NAME = :tName`,
        { tName: table }
      );
      console.log(colsRes.rows);
      
      console.log(`\n=================== ${table} Sample Data ===================`);
      const dataRes = await conn.execute(
        `SELECT * FROM ${table} WHERE ROWNUM <= 2`
      );
      console.log(JSON.stringify(dataRes.rows, null, 2));
    }
    
  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (e) {}
    }
  }
}

run();
