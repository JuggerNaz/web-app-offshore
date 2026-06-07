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

const { createClient } = require('@supabase/supabase-js');

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

    console.log("Connected to Oracle.");
    
    // Check columns of PLATGI
    const colRes = await conn.execute(
      `SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'PLATGI'`
    );
    const cols = colRes.rows.map(r => r[0]);
    console.log("PLATGI columns:", cols.filter(c => c.includes('SD_') || c.includes('POS') || c.includes('X') || c.includes('Y')));

    const hasSdX = cols.includes('SD_XPOS');
    const hasSdY = cols.includes('SD_YPOS');
    
    if (hasSdX || hasSdY) {
      const qCols = ['INSP_ID', 'STR_ID', 'INSP_SCODE', 'COMMENTS'];
      if (hasSdX) qCols.push('SD_XPOS');
      if (hasSdY) qCols.push('SD_YPOS');
      
      const rowsRes = await conn.execute(
        `SELECT INSP_ID, COMP_ID, COMMENTS, SD_XPOS, SD_YPOS FROM PLATGI WHERE STR_ID = 824 AND INSP_SCODE = 'RSEAB' AND (SD_XPOS IS NOT NULL OR SD_YPOS IS NOT NULL) AND ROWNUM <= 5`
      );
      console.log("Fetched RSEAB rows:");
      for (const r of rowsRes.rows) {
        const oCompId = r[1];
        // Query Oracle ALLCOMPID for the Q_ID
        const qidRes = await conn.execute(
          `SELECT Q_ID FROM ALLCOMPID WHERE COMP_ID = :compId`,
          { compId: oCompId }
        );
        const oQId = qidRes.rows && qidRes.rows.length > 0 ? qidRes.rows[0][0] : 'N/A';
        console.log(`INSP_ID: ${r[0]}, COMP_ID: ${oCompId}, Q_ID: ${oQId}, SD_XPOS: ${r[3]}, SD_YPOS: ${r[4]}, COMMENTS: ${r[2].replace(/\r\n/g, ' ')}`);
      }
    } else {
      console.log("No SD_XPOS or SD_YPOS columns found!");
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

run();
