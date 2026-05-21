const oracledb = require("oracledb");

async function tryConnect(password) {
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: "wincairs",
      password: password,
      connectString: "nq-35:1522/orcl10"
    });
    console.log(`SUCCESS with password: ${password}`);
    return conn;
  } catch (err) {
    console.log(`FAILED with password: ${password} - ${err.message}`);
    return null;
  }
}

async function run() {
  try {
    oracledb.initOracleClient({ libDir: "C:\\instantclient64_12_2" });
  } catch (e) {}

  const passwords = ["password123", "Nkumar@10", "K1Sfw1D4BHnkzx7L", "ezPixXo4B1D98RkS", "ezPixXo4B1D98RkS", "K1Sfw1D4BHnkzx7L"];
  for (const pw of passwords) {
    const conn = await tryConnect(pw);
    if (conn) {
      await conn.close();
      break;
    }
  }
}

run();
