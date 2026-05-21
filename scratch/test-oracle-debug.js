const oracledb = require("oracledb");

async function run() {
  try {
    console.log("Starting Oracle Thick mode test...");
    
    // Attempt thick mode initialization
    oracledb.initOracleClient({ libDir: "C:\\instantclient64_12_2" });
    console.log("Thick Mode initialized successfully!");
    
    const conn = await oracledb.getConnection({
      user: "wincairs",
      password: "password123",
      connectString: "nq-35:1522/orcl10"
    });
    
    console.log("Connection successful!");
    await conn.close();
  } catch (err) {
    console.error("Test Error:", err);
  }
}

run();
