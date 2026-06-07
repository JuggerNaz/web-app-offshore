const oracledb = require('oracledb');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('oracle_config.json', 'utf8'));

if (config.useThickMode) {
  try {
    oracledb.initOracleClient({ libDir: config.libDir });
  } catch (err) {
    console.warn('Oracledb init thick mode warning:', err.message);
  }
}

async function run() {
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: config.user,
      password: config.password,
      connectString: config.connectString || `${config.host}:${config.port}/${config.serviceName}`
    });

    console.log('Connected to Oracle database!');

    // 1. Find structure in Oracle
    const strRes = await conn.execute(
      `SELECT STR_ID, TITLE FROM v_structure WHERE UPPER(TITLE) LIKE '%BOP-A%'`
    );
    console.log('--- Oracle v_structure ---');
    console.log(strRes.rows);

    let strId;
    if (strRes.rows && strRes.rows.length > 0) {
      strId = strRes.rows[0][0];
    }

    if (!strId) {
      console.log('BOP-A structure not found in Oracle');
      return;
    }

    console.log(`Using Oracle STR_ID: ${strId}`);

    // 2. Find INSPNOs from taskstr
    const taskRes = await conn.execute(
      `SELECT INSPNO, JOBNAME, CONTRAC, ISTART FROM workpl WHERE INSPNO IN (SELECT DISTINCT INSPNO FROM taskstr WHERE STR_ID = :strId)`,
      { strId }
    );
    console.log('--- Associated Jobpacks in Oracle ---');
    console.log(taskRes.rows);

    // Get the INSPNO for our jobpack (let's check which matches 'UIMC10/ROV/SKO/PLAT1')
    // Wait, in Oracle, UIMC10/ROV/SKO/PLAT1 might be the JOBNAME in workpl!
    let inspNo;
    if (taskRes.rows) {
      for (const row of taskRes.rows) {
        const jobName = row[1] || '';
        if (jobName.toUpperCase().includes('UIMC10') || jobName.toUpperCase().includes('PLAT1')) {
          inspNo = row[0];
          console.log(`Found matching Oracle INSPNO: ${inspNo} for jobname ${jobName}`);
        }
      }
    }

    if (!inspNo) {
      console.log('No matching jobpack found in taskstr/workpl for UIMC10/ROV/SKO/PLAT1');
      return;
    }

    // 3. Query sow_insp columns
    const sowColsRes = await conn.execute(
      `SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'SOW_INSP'`
    );
    const sowCols = sowColsRes.rows.map(r => r[0]);
    console.log('--- SOW_INSP Columns in Oracle ---', sowCols);

    // Query sow_insp for this structure and inspNo
    let sowQuery = `SELECT * FROM sow_insp WHERE INSPNO = :inspNo`;
    let sowParams = { inspNo: '00000001504' };
    if (sowCols.includes('STR_ID')) {
      sowQuery = `SELECT * FROM sow_insp WHERE INSPNO = :inspNo AND STR_ID = :strId`;
      sowParams.strId = strId;
    }
    const sowRes = await conn.execute(sowQuery, sowParams);
    console.log('--- SOW Insp for BOP-A in Oracle ---');
    console.log(sowRes.rows);

    // 4. Query LOGS table columns in Oracle
    const logsColsRes = await conn.execute(
      `SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'LOGS'`
    );
    const logsCols = logsColsRes.rows.map(r => r[0]);
    console.log('--- LOGS Columns in Oracle ---', logsCols);

    // 5. Query LOGS table for this structure and inspNo
    const logsRes = await conn.execute(
      `SELECT DISTINCT INSPNO, DIVE_NO FROM LOGS WHERE STR_ID = :strId AND INSPNO = :inspNo`,
      { strId, inspNo: '00000001504' }
    );
    console.log('--- LOGS in Oracle ---');
    console.log(logsRes.rows);

  } catch (err) {
    console.error('Error running query:', err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

run();
