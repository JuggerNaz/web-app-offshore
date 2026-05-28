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

  const conn = await oracledb.getConnection({
    user: config.user,
    password: config.password,
    connectString: config.connectString || `${config.host}:${config.port}/${config.serviceName}`
  });

  try {
    const res = await conn.execute(
      `SELECT * FROM VIDEO WHERE STR_ID = 204 AND ROWNUM <= 5`
    );
    console.log("VIDEO Sample Rows for STR_ID 204:");
    console.log(JSON.stringify(res.rows, null, 2));

    const cols = await conn.execute(
      `SELECT COLUMN_NAME, DATA_TYPE FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'VIDEO'`
    );
    console.log("\nVIDEO Columns:");
    cols.rows.forEach(c => console.log(` - ${c.COLUMN_NAME}: ${c.DATA_TYPE}`));
  } catch (err) {
    console.error(err);
  } finally {
    await conn.close();
  }
}

main().catch(console.error);
