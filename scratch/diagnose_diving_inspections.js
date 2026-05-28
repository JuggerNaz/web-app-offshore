const oracledb = require("oracledb");
const { createClient } = require('@supabase/supabase-js');
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

const supabase = createClient(
  envConfig.NEXT_PUBLIC_SUPABASE_URL,
  envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  let conn;
  try {
    oracledb.initOracleClient({ libDir: "C:\\instantclient64_12_2" });
    conn = await oracledb.getConnection({
      user: "sko251",
      password: "sko251",
      connectString: "nq-35:1522/orcl10"
    });

    console.log("Connected to Oracle. Querying ALLINSPID metadata...");
    
    // Check total and sample rows
    console.log("Connected to Oracle. Querying ALLINSPID table columns...");
    
    // Fetch USER_TAB_COLUMNS to see what columns exist in ALLINSPID
    const colRes = await conn.execute(
      `SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'ALLINSPID'`
    );
    const existingCols = new Set(colRes.rows.map(r => String(r[0] || r.COLUMN_NAME).toUpperCase()));
    console.log("ALLINSPID columns in Oracle:", [...existingCols]);

    const selectCols = ['INSP_ID', 'INSPNO', 'COMP_ID', 'INSP_TYPE'];
    if (existingCols.has('DIVE_NO')) selectCols.push('DIVE_NO');
    if (existingCols.has('TAPE_NO')) selectCols.push('TAPE_NO');
    if (existingCols.has('INSP_DATE')) selectCols.push('INSP_DATE');
    if (existingCols.has('INSP_TIME')) selectCols.push('INSP_TIME');

    const res = await conn.execute(
      `SELECT ${selectCols.join(', ')} 
       FROM ALLINSPID 
       WHERE STR_ID = 1061 AND INSPNO = '00000003454'
         AND TRIM(UPPER(INSP_TYPE)) NOT IN ('PLATGI', 'LOGS', 'EXSUM', 'VIDEO')
       ORDER BY INSP_ID`
    );

    console.log(`Found ${res.rows.length} rows in Oracle ALLINSPID for diving inspections.`);
    
    // Let's get column names
    const colNames = res.metaData.map(m => m.name);
    console.log("Columns returned:", colNames);

    if (res.rows.length === 0) {
      console.log("No rows returned from ALLINSPID matching the criteria!");
      return;
    }

    // Inspect the first 10 rows
    const rows = res.rows.map(row => {
      const obj = {};
      colNames.forEach((name, idx) => {
        obj[name] = row[idx];
      });
      return obj;
    });

    console.log("Sample 5 rows from Oracle ALLINSPID:");
    console.log(JSON.stringify(rows.slice(0, 5), null, 2));

    // Get unique COMP_ID values from these Oracle rows
    const oracleCompIds = [...new Set(rows.map(r => Number(r.COMP_ID)).filter(Boolean))];
    console.log(`Unique COMP_IDs in Oracle rows: ${oracleCompIds.join(", ")}`);

    console.log("\nChecking columns of SZONE table...");
    const szColsRes = await conn.execute(
      `SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'SZONE'`
    );
    console.log("SZONE columns:", szColsRes.rows.map(r => r[0]));

    console.log("\nChecking columns of MGROW table...");
    const mgColsRes = await conn.execute(
      `SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'MGROW'`
    );
    console.log("MGROW columns:", mgColsRes.rows.map(r => r[0]));

    // Query sample rows from SZONE
    const szRes = await conn.execute(
      `SELECT * FROM SZONE WHERE STR_ID = 1061 AND ROWNUM <= 5`
    );
    console.log("\nSZONE Sample Rows (metaData and rows):");
    console.log("SZONE Meta:", szRes.metaData.map(m => m.name));
    console.log("SZONE Data:", szRes.rows);

    // Query sample rows from MGROW
    const mgRes = await conn.execute(
      `SELECT * FROM MGROW WHERE STR_ID = 1061 AND ROWNUM <= 5`
    );
    console.log("\nMGROW Sample Rows (metaData and rows):");
    console.log("MGROW Meta:", mgRes.metaData.map(m => m.name));
    console.log("MGROW Data:", mgRes.rows);
  } catch (err) {
    console.error("Error in diagnose script:", err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

run();
