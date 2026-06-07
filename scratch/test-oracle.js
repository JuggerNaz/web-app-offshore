const oracledb = require("oracledb");

async function run() {
  try {
    console.log("Starting Oracle Thick mode test...");
    
    // Attempt thick mode initialization
    oracledb.initOracleClient({ libDir: "C:\\instantclient_12_2" });
    console.log("Thick Mode initialized successfully!");
    
    const conn = await oracledb.getConnection({
      user: "wincairs",
      password: "password123", // we can replace with actual password if needed or let the error tell us if it passed version check
      connectString: "nq-35:1522/orcl10"
    });
    
    console.log("Connection successful!");
    await conn.close();
  } catch (err) {
    console.error("Test Error:", err);
  }
}

run();
