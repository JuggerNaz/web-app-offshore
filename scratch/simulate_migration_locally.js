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

    console.log("Connected to Oracle. Simulating dynamic PREFIX-FREE Phase 4 for Diving...");

    // Mappings payload is empty for specific inspection types (exactly as the user wants)
    const mappings = {};

    // 1. Fetch primary inspections from ALLINSPID (Filtered to SZONE type for testing)
    const selectCols = ['INSP_ID', 'INSPNO', 'COMP_ID', 'INSP_TYPE'];
    const primaryRes = await conn.execute(
      `SELECT ${selectCols.join(', ')} 
       FROM ALLINSPID 
       WHERE STR_ID = 1061 AND INSPNO = '00000003454' AND TRIM(UPPER(INSP_TYPE)) = 'SZONE'
       ORDER BY INSP_ID`
    );

    const primaryRows = primaryRes.rows.map(row => {
      const obj = {};
      selectCols.forEach((name, idx) => {
        obj[name] = row[idx];
      });
      return obj;
    });

    console.log(`Fetched ${primaryRows.length} primary SZONE inspections.`);

    // 2. Extract active diving types dynamically from primary inspections
    const activeDivingTypes = [...new Set(primaryRows.map(row => {
      return String(row.INSP_TYPE || '').trim().toUpperCase();
    }).filter(Boolean))];

    console.log("Resolved active diving types directly from database codes (no prefixes):", activeDivingTypes);

    const typeDataByInspId = {};

    // Helper to get columns (mocked function)
    const getOracleTableColumns = async (c, tName) => {
      const cols = new Set();
      const res = await c.execute(
        `SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = :tName`,
        { tName: tName.toUpperCase() }
      );
      res.rows.forEach(r => cols.add(String(r[0] || r.COLUMN_NAME).toUpperCase()));
      return cols;
    };

    for (const typeCode of activeDivingTypes) {
      const typeCols = await getOracleTableColumns(conn, typeCode);
      if (typeCols.size === 0) continue;

      console.log(`Querying Oracle table ${typeCode} dynamically (SELECT *)...`);
      const query = `SELECT * FROM ${typeCode} WHERE STR_ID = 1061 AND INSP_ID IS NOT NULL`;
      const typeRes = await conn.execute(query);

      const metaNames = typeRes.metaData.map(m => m.name.toUpperCase());
      typeRes.rows.forEach(row => {
        const inspIdIdx = metaNames.indexOf('INSP_ID');
        if (inspIdIdx === -1) return;
        const inspId = Number(row[inspIdIdx]);
        if (!inspId) return;

        const mappedData = {};
        metaNames.forEach((colName, idx) => {
          const val = row[idx];
          if (val !== undefined && val !== null) {
            const lowerColName = colName.toLowerCase();
            mappedData[lowerColName] = val;
            mappedData[colName] = val;
            
            // Auto-resolve specific common fields
            if (colName === 'DIVE_NO') mappedData.dive_job_id = val;
            if (colName === 'TAPE_NO') mappedData.tape_id = val;
            if (colName === 'INSP_DATE') mappedData.inspection_date = val;
            if (colName === 'INSP_TIME') mappedData.inspection_time = val;
          }
        });

        typeDataByInspId[inspId] = {
          ...(typeDataByInspId[inspId] || {}),
          ...mappedData
        };
      });
    }

    console.log(`Loaded dynamic prefix-free data for ${Object.keys(typeDataByInspId).length} SZONE inspections.`);

    // 3. Simulate mapping loop for first 3 rows
    console.log("\nSimulating record mapping loop:");
    const recordsToInsert = [];

    // Pre-populate compIdMap
    const { data: pgComps } = await supabase
      .from('structure_components')
      .select('id, comp_id, code')
      .eq('structure_id', 1061);
    const compIdMap = new Map();
    pgComps.forEach(c => compIdMap.set(Number(c.comp_id), c.id));

    for (let i = 0; i < Math.min(primaryRows.length, 3); i++) {
      const rowObj = primaryRows[i];
      const legacyInspId = Number(rowObj.INSP_ID);
      const legacyInspNo = String(rowObj.INSPNO || "").trim();
      const legacyCompId = Number(rowObj.COMP_ID);

      const mappedTypeData = typeDataByInspId[legacyInspId] || {};

      let legacyDiveNo = String(
        rowObj.DIVE_NO || 
        mappedTypeData.dive_job_id || 
        mappedTypeData.rov_job_id || 
        mappedTypeData.DIVE_NO || 
        ""
      ).trim();

      const pgCompId = compIdMap.get(legacyCompId);
      if (!pgCompId) continue;

      console.log(`\nRow ${i} (Oracle ID: ${legacyInspId}):`);
      console.log(`- Mapped Type Data keys: ${Object.keys(mappedTypeData).filter(k => k === k.toUpperCase()).join(', ')}`);
      console.log(`- legacyDiveNo resolved as: "${legacyDiveNo}"`);
      console.log(`- pgCompId resolved as: ${pgCompId}`);

      recordsToInsert.push({
        structure_id: 1061,
        component_id: pgCompId,
        jobpack_id: 610,
        inspection_type_code: "SZONE",
        inspection_date: mappedTypeData.inspection_date || new Date().toISOString(),
        inspection_time: mappedTypeData.inspection_time || "00:00:00",
        inspection_data: {
          ...rowObj,
          ...mappedTypeData
        },
        status: "COMPLETED",
        cr_user: 'migration_prefix_free_test'
      });
    }

    console.log("\nSample record ready for insertion into Postgres:");
    console.log(JSON.stringify(recordsToInsert[0], null, 2));

  } catch (err) {
    console.error("Error in simulate script:", err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

run();
