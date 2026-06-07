const oracledb = require('oracledb');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('oracle_config.json', 'utf8'));

async function main() {
  if (config.useThickMode) {
    try {
      oracledb.initOracleClient({ libDir: config.libDir });
    } catch (err) {}
  }
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  oracledb.fetchAsString = [oracledb.DATE, oracledb.NUMBER];

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: config.user,
      password: config.password,
      connectString: config.connectString || `${config.host}:${config.port}/${config.serviceName}`
    });

    console.log("Connected to Oracle!");
    const structureId = 261;

    // Fetch some non-null TAPE LOG rows
    const res = await conn.execute(`
      SELECT TAPE_NO, DIVE_NO, INSPNO, COMMENTS 
      FROM PLATGI 
      WHERE STR_ID = :strId AND DESCRIPTION = 'TAPE LOG' AND TAPE_NO IS NOT NULL AND ROWNUM <= 10
    `, { strId: structureId });

    console.log("\nSample NON-NULL TAPE LOG Rows:");
    res.rows.forEach((r, idx) => {
      console.log(`\nRow ${idx + 1}:`);
      console.log(` - TAPE_NO: "${r.TAPE_NO}"`);
      console.log(` - DIVE_NO: "${r.DIVE_NO}"`);
      console.log(` - INSPNO: "${r.INSPNO}"`);
      console.log(` - COMMENTS: "${r.COMMENTS}"`);
    });

  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

main();
