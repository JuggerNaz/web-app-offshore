const oracledb = require('oracledb');
const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../oracle_config.json'), 'utf8'));

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

    // Query some tape logs from PLATGI
    const res = await conn.execute(`
      SELECT STR_ID, INSPNO, DIVE_NO, TAPE_NO, COMMENTS, I_DATE, I_TIME, COUNTER_NO
      FROM PLATGI
      WHERE TAPE_NO IS NOT NULL AND DESCRIPTION LIKE '%TAPE LOG%' AND ROWNUM <= 100
      ORDER BY STR_ID, INSPNO, DIVE_NO, TAPE_NO, I_DATE, I_TIME, COUNTER_NO
    `);

    console.log(`Found ${res.rows.length} rows.`);
    res.rows.forEach((r, idx) => {
      console.log(`${idx + 1}: STR_ID=${r.STR_ID} | INSPNO=${r.INSPNO} | DIVE_NO=${r.DIVE_NO} | TAPE_NO=${r.TAPE_NO} | COUNTER=${r.COUNTER_NO} | COMMENTS=${r.COMMENTS}`);
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
