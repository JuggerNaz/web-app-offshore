const oracledb = require('oracledb');
const config = require('../oracle_config.json');

async function test() {
  console.log('Connecting to Oracle DB...');
  if (config.useThickMode) {
    try {
      oracledb.initOracleClient({ libDir: config.libDir });
      console.log('Thick Mode Initialized.');
    } catch (e) {
      console.warn('Init Thick Mode error:', e.message);
    }
  }
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: config.user,
      password: config.password,
      connectString: config.connectString || `${config.host}:${config.port}/${config.serviceName}`
    });
    console.log('CONNECTED TO ORACLE!');
    
    // Get columns of SOW_INSP table
    const result = await conn.execute(
      `SELECT COLUMN_NAME, DATA_TYPE FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'SOW_INSP'`
    );
    console.log('Columns in SOW_INSP:');
    console.log(result.rows);
    
    // Let's also query a sample row of SOW_INSP
    const sample = await conn.execute(
      `SELECT * FROM sow_insp WHERE ROWNUM <= 2`
    );
    console.log('Sample rows from SOW_INSP:');
    console.log(sample.metaData);
    console.log(sample.rows);
    
  } catch (err) {
    console.error('Connection failed:', err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

test();
