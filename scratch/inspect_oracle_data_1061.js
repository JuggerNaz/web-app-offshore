const oracledb = require("oracledb");

async function run() {
  let conn;
  try {
    oracledb.initOracleClient({ libDir: "C:\\instantclient64_12_2" });
    conn = await oracledb.getConnection({
      user: "sko251",
      password: "sko251",
      connectString: "nq-35:1522/orcl10"
    });

    // 1. Get all INSPNOs from taskstr for STR_ID = 1061
    const taskstrResult = await conn.execute(
      `SELECT INSPNO, JOB_TYPE, CR_DATE FROM taskstr WHERE STR_ID = 1061`
    );
    console.log("Oracle taskstr rows for STR_ID 1061:", taskstrResult.rows);

    // 2. Fetch corresponding jobpack names from workpl
    if (taskstrResult.rows && taskstrResult.rows.length > 0) {
      const inspnos = taskstrResult.rows.map(r => `'${r[0] || r.INSPNO}'`).join(",");
      const workplResult = await conn.execute(
        `SELECT INSPNO, JOBNAME, STATUS FROM workpl WHERE INSPNO IN (${inspnos})`
      );
      console.log("Oracle workpl rows for STR_ID 1061:", workplResult.rows);
    }

    // 3. Check PLATGI rows for STR_ID = 1061
    const platgiCount = await conn.execute(
      `SELECT COUNT(*) FROM PLATGI WHERE STR_ID = 1061`
    );
    console.log("Oracle PLATGI count for STR_ID 1061:", platgiCount.rows[0][0]);

    // 4. Check ALLINSPID rows for STR_ID = 1061
    const allinspidCount = await conn.execute(
      `SELECT COUNT(*) FROM ALLINSPID WHERE STR_ID = 1061`
    );
    console.log("Oracle ALLINSPID count for STR_ID 1061:", allinspidCount.rows[0][0]);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

run();
