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

    // Query distinct count for U_LIB_MAST
    const rMast = await connection.execute(`SELECT COUNT(DISTINCT TRIM(LIB_CODE)) as CNT FROM U_LIB_MAST`);
    console.log("U_LIB_MAST unique count:", rMast.rows[0].CNT);

    // Query distinct count for U_LIB_LIST
    const rList = await connection.execute(`SELECT COUNT(DISTINCT TRIM(LIB_CODE) || '::' || TRIM(LIB_ID)) as CNT FROM U_LIB_LIST`);
    console.log("U_LIB_LIST unique count:", rList.rows[0].CNT);

    // Query distinct count for U_LIB_COMBO
    const rCombo = await connection.execute(`SELECT COUNT(DISTINCT TRIM(LIB_CODE) || '::' || TRIM(CODE_1) || '::' || TRIM(CODE_2)) as CNT FROM U_LIB_COMBO`);
    console.log("U_LIB_COMBO unique count:", rCombo.rows[0].CNT);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

run();
