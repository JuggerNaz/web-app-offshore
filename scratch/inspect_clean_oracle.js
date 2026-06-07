const oracledb = require("oracledb");
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [key, ...value] = line.split('=');
    if (key && value) acc[key.trim()] = value.join('=').trim();
    return acc;
  }, {});

async function run() {
  let conn;
  try {
    oracledb.initOracleClient({ libDir: "C:\\instantclient64_12_2" });
    conn = await oracledb.getConnection({
      user: "sko251",
      password: "sko251",
      connectString: "nq-35:1522/orcl10"
    });

    console.log("Connected to Oracle.");
    
    const colRes = await conn.execute(
      `SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'CLEAN'`
    );
    console.log("CLEAN columns:", colRes.rows.map(r => r[0]));

    const dataRes = await conn.execute(
      `SELECT * FROM CLEAN WHERE STR_ID = 1061 AND ROWNUM <= 5`
    );
    console.log("CLEAN sample meta:", dataRes.metaData.map(m => m.name));
    console.log("CLEAN sample data:", dataRes.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

run();
