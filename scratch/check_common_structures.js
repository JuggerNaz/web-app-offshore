const oracledb = require('oracledb');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('oracle_config.json', 'utf8'));

if (config.useThickMode) {
  try {
    oracledb.initOracleClient({ libDir: config.libDir });
  } catch (err) {}
}

async function checkCommon() {
  let connection;
  try {
    connection = await oracledb.getConnection({
      user: config.user,
      password: config.password,
      connectString: config.connectString || `${config.host}:${config.port}/${config.serviceName}`
    });
    console.log("Connected to Oracle.");

    // Query distinct STR_IDs in PLATGI
    const platgiResult = await connection.execute(`
      SELECT STR_ID, COUNT(*) 
      FROM PLATGI 
      GROUP BY STR_ID
      ORDER BY STR_ID
    `);
    
    const platgiMap = new Map();
    platgiResult.rows.forEach(r => platgiMap.set(String(r[0]), Number(r[1])));

    // Query distinct STR_IDs in VIDEO
    const videoResult = await connection.execute(`
      SELECT STR_ID, COUNT(*) 
      FROM VIDEO 
      GROUP BY STR_ID
      ORDER BY STR_ID
    `);
    
    const videoMap = new Map();
    videoResult.rows.forEach(r => videoMap.set(String(r[0]), Number(r[1])));

    console.log("\nStructures with rows in BOTH tables:");
    console.log("------------------------------------");
    let found = false;
    for (const [strId, pCount] of platgiMap.entries()) {
      if (videoMap.has(strId)) {
        found = true;
        const vCount = videoMap.get(strId);
        console.log(`STR_ID: ${strId} | PLATGI Rows: ${pCount} | VIDEO Rows: ${vCount}`);
      }
    }
    if (!found) {
      console.log("No structures have data in both tables!");
    }

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    if (connection) await connection.close();
  }
}

checkCommon();
