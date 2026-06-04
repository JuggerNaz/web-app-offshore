const oracledb = require('oracledb');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('oracle_config.json', 'utf8'));

async function run() {
  if (config.useThickMode) {
    try {
      oracledb.initOracleClient({ libDir: config.libDir });
    } catch (err) {}
  }
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  oracledb.fetchAsString = [oracledb.DATE, oracledb.NUMBER];

  let connection;
  try {
    connection = await oracledb.getConnection({
      user: config.user,
      password: config.password,
      connectString: config.connectString || `${config.host}:${config.port}/${config.serviceName}`
    });

    console.log("Connected to Oracle.");

    // Query to find duplicate keys
    const res = await connection.execute(`
      SELECT LIB_CODE, LIB_ID, COUNT(*) as CNT 
      FROM U_LIB_LIST 
      GROUP BY LIB_CODE, LIB_ID 
      HAVING COUNT(*) > 1
    `);

    console.log(`Found ${res.rows.length} keys that have duplicates in Oracle:`);
    
    let totalDuplicatesCount = 0;
    for (const row of res.rows) {
      const lcode = String(row.LIB_CODE || row[0] || "").trim();
      const lid = String(row.LIB_ID || row[1] || "").trim();
      const cnt = Number(row.CNT || row[2] || 0);
      totalDuplicatesCount += (cnt - 1);
      
      console.log(`\nKey: ${lcode}::${lid} (appears ${cnt} times)`);
      
      // Query details for this key
      const details = await connection.execute(`
        SELECT LIB_CODE, LIB_ID, LIB_DESC, WORKUNIT, CR_USER, CR_DATE 
        FROM U_LIB_LIST 
        WHERE LIB_CODE = :lcode AND LIB_ID = :lid
      `, { lcode, lid });
      
      console.log(details.rows);
    }
    
    console.log(`\nTotal duplicate rows (redundant copies): ${totalDuplicatesCount}`);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

run();
