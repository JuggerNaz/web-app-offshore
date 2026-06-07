const oracledb = require('oracledb');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('oracle_config.json', 'utf8'));

if (config.useThickMode) {
  try {
    oracledb.initOracleClient({ libDir: config.libDir });
  } catch (err) {}
}

async function checkTapes() {
  let connection;
  try {
    connection = await oracledb.getConnection({
      user: config.user,
      password: config.password,
      connectString: config.connectString || `${config.host}:${config.port}/${config.serviceName}`
    });
    console.log("Connected to Oracle.");

    // Query count in VIDEO for STR_ID = 204 where TAPE_NO is not null
    const result = await connection.execute(`
      SELECT COUNT(*) 
      FROM VIDEO 
      WHERE TAPE_NO IS NOT NULL AND STR_ID = 204
    `);
    console.log(`Rows in VIDEO with TAPE_NO and STR_ID = 204: ${result.rows[0][0]}`);

    // Peek at some rows with STR_ID = 204
    const rows = await connection.execute(`
      SELECT TAPE_NO, DIVE_NO, INSPNO, STR_ID, SUBJECT 
      FROM VIDEO 
      WHERE TAPE_NO IS NOT NULL AND STR_ID = 204 AND ROWNUM <= 5
    `);
    console.log("\nSample rows matching STR_ID = 204:");
    rows.rows.forEach(r => console.log(r));

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    if (connection) await connection.close();
  }
}

checkTapes();
