const oracledb = require("oracledb");
const config = require("../oracle_config.json");

async function check() {
  let connection;
  try {
    if (config.useThickMode) {
      oracledb.initOracleClient({ libDir: config.libDir });
    }
    const connectString = config.connectString || `${config.host}:${config.port}/${config.serviceName}`;
    connection = await oracledb.getConnection({
      user: config.user,
      password: config.password,
      connectString: connectString
    });

    console.log("Connected to Oracle database!");

    // Check if table u_company exists
    console.log("1. Checking U_COMPANY table...");
    try {
      const result = await connection.execute("SELECT * FROM U_COMPANY WHERE ROWNUM <= 5");
      console.log("U_COMPANY metadata:", result.metaData);
      console.log("U_COMPANY rows:", JSON.stringify(result.rows, null, 2));
    } catch (e) {
      console.log("U_COMPANY table query failed:", e.message);
    }

    // Check if table PREFERENCE exists
    console.log("\n1b. Checking PREFERENCE table...");
    try {
      const result = await connection.execute("SELECT * FROM PREFERENCE WHERE ROWNUM <= 5");
      console.log("PREFERENCE metadata:", result.metaData);
      console.log("PREFERENCE rows:", JSON.stringify(result.rows, null, 2));
    } catch (e) {
      console.log("PREFERENCE table query failed:", e.message);
    }

    // Check what tables are available in Oracle
    console.log("\n2. Finding table names starting with U_ or containing COMPANY or PREF...");
    try {
      const result = await connection.execute(
        `SELECT table_name FROM user_tables 
         WHERE table_name LIKE 'U_%' 
            OR table_name LIKE '%COMPANY%' 
            OR table_name LIKE '%PREF%'`
      );
      console.log("Tables found:", JSON.stringify(result.rows, null, 2));
    } catch (e) {
      console.log("Failed to query user_tables:", e.message);
    }
  } catch (err) {
    console.error("Connect error:", err);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

check();
