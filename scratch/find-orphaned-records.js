const fs = require('fs');
const oracledb = require('oracledb');
const config = JSON.parse(fs.readFileSync('oracle_config.json', 'utf8'));

// Initialize oracledb thick mode properties
if (config.useThickMode) {
  try {
    const initOpts = {};
    if (config.libDir) {
      initOpts.libDir = config.libDir;
    }
    oracledb.initOracleClient(initOpts);
    console.log("Oracle DB initialized in THICK mode using libDir:", config.libDir);
  } catch (err) {
    console.warn("Oracle Thick Mode Init Warning:", err.message);
  }
}
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.DATE, oracledb.NUMBER];

async function getOracleTableColumns(conn, tableName) {
  const cols = new Set();
  try {
    const result = await conn.execute(
      `SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = :tName`,
      { tName: tableName.toUpperCase() }
    );
    if (result.rows) {
      result.rows.forEach(r => {
        const cName = r.COLUMN_NAME || r[0] || (typeof r === 'string' ? r : null);
        if (cName) cols.add(String(cName).toUpperCase());
      });
    }
  } catch (err) {
    // Table might not exist, ignore
  }
  return cols;
}

async function main() {
  console.log("Connecting to Oracle database...");
  let connectString = config.connectString;
  if (!connectString && config.host && config.serviceName) {
    const port = config.port || 1521;
    connectString = `${config.host}:${port}/${config.serviceName}`;
  }

  const conn = await oracledb.getConnection({
    user: config.user,
    password: config.password,
    connectString: connectString
  });
  
  const structureId = "1061";
  const inspNo = "00000003454";

  console.log(`\n=== Analyzing Diving Records for STR_ID: ${structureId}, INSPNO: ${inspNo} ===`);

  // Check columns of ALLINSPID
  const allinspidCols = await getOracleTableColumns(conn, 'ALLINSPID');
  console.log("ALLINSPID columns:", Array.from(allinspidCols).join(', '));

  // Determine ALLINSPID query columns
  const qCols = ['INSP_ID', 'INSPNO', 'COMP_ID', 'INSP_TYPE'];
  if (allinspidCols.has('ELEVATION')) qCols.push('ELEVATION');
  if (allinspidCols.has('KP')) qCols.push('KP');
  if (allinspidCols.has('DIVE_NO')) qCols.push('DIVE_NO');

  // Query ALLINSPID rows
  const result = await conn.execute(`
    SELECT ${qCols.join(', ')}
    FROM ALLINSPID
    WHERE STR_ID = :strId AND INSPNO = :inspNo AND INSP_ID IS NOT NULL AND INSP_ID > 0 AND INSP_TYPE IS NOT NULL
      AND TRIM(UPPER(INSP_TYPE)) NOT IN ('PLATGI', 'LOGS', 'EXSUM', 'VIDEO')
  `, { strId: structureId, inspNo: inspNo });

  const rows = result.rows || [];
  console.log(`Total active diving inspections in ALLINSPID: ${rows.length}`);

  // We also want to fetch the DIVE_NO or DIVE_JOB_ID from type-specific tables
  // Let's identify which type-specific tables exist and their columns
  const activeTypes = Array.from(new Set(rows.map(r => String(r.INSP_TYPE).trim().toUpperCase())));
  console.log("Active Diving inspection types in ALLINSPID for this scope:", activeTypes);

  const typeTablesInfo = {};
  for (const typeCode of activeTypes) {
    const cols = await getOracleTableColumns(conn, typeCode);
    if (cols.size > 0) {
      typeTablesInfo[typeCode] = cols;
    }
  }

  // Fetch type-specific data for each active type
  const typeDataByInspId = {};
  for (const typeCode of Object.keys(typeTablesInfo)) {
    const cols = typeTablesInfo[typeCode];
    const colsToFetch = Array.from(cols).filter(c => ['INSP_ID', 'DIVE_NO', 'DIVE_JOB_ID', 'TAPE_NO', 'TAPE_ID'].includes(c));
    if (!colsToFetch.includes('INSP_ID')) {
      colsToFetch.push('INSP_ID');
    }

    try {
      let query = `SELECT ${colsToFetch.join(', ')} FROM ${typeCode}`;
      if (cols.has('STR_ID')) {
        query += ` WHERE STR_ID = :strId`;
      } else {
        query += ` WHERE INSP_ID IN (SELECT INSP_ID FROM ALLINSPID WHERE STR_ID = :strId AND INSPNO = :inspNo)`;
      }
      
      const binds = { strId: structureId };
      if (!cols.has('STR_ID')) {
        binds.inspNo = inspNo;
      }
      
      const typeRes = await conn.execute(query, binds);
      if (typeRes.rows) {
        typeRes.rows.forEach(row => {
          const inspId = Number(row.INSP_ID);
          if (inspId) {
            typeDataByInspId[inspId] = {
              ...(typeDataByInspId[inspId] || {}),
              ...row
            };
          }
        });
      }
    } catch (err) {
      console.log(`Warning fetching from ${typeCode}:`, err.message);
    }
  }

  // Now, let's analyze each record to see what dive number gets resolved
  const resolvedRecords = [];
  const unresolvedRecords = [];

  for (const r of rows) {
    const inspId = Number(r.INSP_ID);
    const typeCode = String(r.INSP_TYPE).trim().toUpperCase();
    const mappedTypeData = typeDataByInspId[inspId] || {};

    const legacyDiveNo = String(
      r.DIVE_NO || 
      mappedTypeData.dive_job_id || 
      mappedTypeData.DIVE_NO || 
      ""
    ).trim();

    if (!legacyDiveNo) {
      unresolvedRecords.push({
        INSP_ID: inspId,
        COMP_ID: Number(r.COMP_ID),
        INSP_TYPE: typeCode,
        RESOLVED_DIVE_NO: "None (Triggered DEFAULT-00000003454-DIV)"
      });
    } else {
      resolvedRecords.push({
        INSP_ID: inspId,
        COMP_ID: Number(r.COMP_ID),
        INSP_TYPE: typeCode,
        RESOLVED_DIVE_NO: legacyDiveNo
      });
    }
  }

  console.log(`\n=== ANALYSIS RESULTS ===`);
  console.log(`Successfully Resolved Dive Number: ${resolvedRecords.length} records`);
  console.log(`Triggered DEFAULT-00000003454-DIV (Missing Dive Number): ${unresolvedRecords.length} records`);

  if (unresolvedRecords.length > 0) {
    console.log("\nFirst 20 records that triggered the DEFAULT fallback job:");
    console.table(unresolvedRecords.slice(0, 20));
    
    // Summary by inspection type
    const typeSummary = {};
    unresolvedRecords.forEach(r => {
      typeSummary[r.INSP_TYPE] = (typeSummary[r.INSP_TYPE] || 0) + 1;
    });
    console.log("\nMissing Dive Number count by Inspection Type:");
    console.table(typeSummary);
  }

  await conn.close();
}

main().catch(console.error);
