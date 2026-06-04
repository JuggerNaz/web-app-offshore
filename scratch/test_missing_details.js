const { createClient } = require('@supabase/supabase-js');
const oracledb = require('oracledb');
const fs = require('fs');

// Read .env.local manually
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const anonKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

if (!url || !anonKey) {
  console.error("Could not find Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(url, anonKey);
const config = JSON.parse(fs.readFileSync('oracle_config.json', 'utf8'));

// Helper function to paginate and fetch all records from Supabase
async function fetchAllFromSupabase(
  supabase,
  table,
  columns,
  filterBuilder
) {
  let allData = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(table).select(columns).range(page * pageSize, (page + 1) * pageSize - 1);
    if (filterBuilder) {
      query = filterBuilder(query);
    }
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    if (data && data.length > 0) {
      allData = allData.concat(data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }
  return allData;
}

function parseComments(comments) {
  if (!comments) return {};
  const result = {};
  const subjectMatch = comments.match(/subject\s*(?:data)?:\s*([^;]+)/i);
  if (subjectMatch) result.subject = subjectMatch[1].trim();
  const chapterMatch = comments.match(/chapter\s*(?:number|no)?:\s*([^;]+)/i);
  if (chapterMatch) result.chapter = chapterMatch[1].trim();
  const tapeMatch = comments.match(/tape\s*(?:type)?:\s*([^;]+)/i);
  if (tapeMatch) result.tape = tapeMatch[1].trim();
  const findingsMatch = comments.match(/findings?:\s*([^;]+)/i);
  if (findingsMatch) result.findings = findingsMatch[1].trim();
  return result;
}

function parseDivingChapter(inspCond) {
  if (!inspCond) return null;
  const match = inspCond.match(/chapter\s*(?:number|no)?\s*:?\s*(\d+)/i);
  if (match) return match[1].trim();
  const simpleMatch = inspCond.match(/ch\s*(\d+)/i);
  if (simpleMatch) return simpleMatch[1].trim();
  return null;
}

async function testComparison(strId, inspno, upperCode) {
  console.log(`\n--- Testing Code: ${upperCode} on Str ID: ${strId}, Jobpack (INSPNO): ${inspno} ---`);
  
  let connection;
  try {
    connection = await oracledb.getConnection({
      user: config.user,
      password: config.password,
      connectString: config.connectString || `${config.host}:${config.port}/${config.serviceName}`
    });

    let oracleItems = [];
    let postgresItems = [];

    if (upperCode === "JOBPACK") {
      // Oracle
      const rRes = await connection.execute(
        `SELECT INSPNO, JOB_TYPE FROM taskstr WHERE STR_ID = :strId AND INSPNO = :inspNo`,
        { strId: strId, inspNo: String(inspno) }
      );
      oracleItems = (rRes.rows || []).map((row) => ({
        key: String(row.INSPNO || row[0] || "").trim(),
        label: `Jobpack ${row.INSPNO || row[0]} (${row.JOB_TYPE || row[1] || "ROV/Diving"})`
      }));

      // Postgres
      const { data: pgData } = await supabase
        .from('jobpack')
        .select('id, name')
        .eq('id', Number(inspno));
      postgresItems = (pgData || []).map((row) => ({
        key: String(row.id),
        label: `Jobpack ${row.id} (${row.name || "No name"})`
      }));

    } else if (upperCode === "U_SOW") {
      // Oracle
      const rRes = await connection.execute(
        `SELECT INSPNO, REP_PREFIX FROM sow_insp WHERE INSPNO = :inspNo`,
        { inspNo: String(inspno) }
      );
      oracleItems = (rRes.rows || []).map((row) => {
        const repPrefix = String(row.REP_PREFIX !== undefined ? row.REP_PREFIX : (row[1] !== undefined ? row[1] : "")).trim();
        return {
          key: `${inspno}::${repPrefix}`,
          label: `SOW: ${repPrefix} (Jobpack: ${inspno})`
        };
      });

      // Postgres
      const pgData = await fetchAllFromSupabase(
        supabase,
        'u_sow',
        'jobpack_id, report_numbers',
        (q) => q.eq('jobpack_id', Number(inspno))
      );
      postgresItems = [];
      (pgData || []).forEach((row) => {
        const jpId = String(row.jobpack_id);
        const repNums = row.report_numbers || [];
        if (Array.isArray(repNums)) {
          repNums.forEach((rn) => {
            const num = String(rn.number || rn.REP_PREFIX || "").trim();
            if (num) {
              postgresItems.push({
                key: `${jpId}::${num}`,
                label: `SOW for Jobpack ${jpId} (Report No: ${num})`
              });
            }
          });
        }
      });

    } else if (upperCode === "LOGS_JOBS") {
      // Oracle
      const rRes = await connection.execute(
        `SELECT DISTINCT INSPNO, DIVE_NO, LOG_TYPE FROM LOGS WHERE STR_ID = :strId AND INSPNO = :inspNo AND LOG_TYPE IN ('ROV LOG', 'DIVER LOG', 'BELL LOG')`,
        { strId: strId, inspNo: String(inspno) }
      );
      oracleItems = (rRes.rows || []).map((row) => {
        const ino = String(row.INSPNO || row[0] || "").trim();
        const dno = String(row.DIVE_NO || row[1] || "").trim();
        const ltype = String(row.LOG_TYPE || row[2] || "").trim();
        return {
          key: `${ino}::${dno}`,
          label: `Job: ${ltype} #${dno} (Jobpack: ${ino})`
        };
      });

      // Postgres
      const rovData = await fetchAllFromSupabase(supabase, 'insp_rov_jobs', 'deployment_no', (q) => q.eq('jobpack_id', Number(inspno)));
      const diveData = await fetchAllFromSupabase(supabase, 'insp_dive_jobs', 'dive_no', (q) => q.eq('jobpack_id', Number(inspno)));
      postgresItems = [
        ...(rovData || []).map((row) => ({
          key: `${inspno}::${String(row.deployment_no).trim()}`,
          label: `ROV Job #${row.deployment_no} (Jobpack: ${inspno})`
        })),
        ...(diveData || []).map((row) => ({
          key: `${inspno}::${String(row.dive_no).trim()}`,
          label: `Diving Job #${row.dive_no} (Jobpack: ${inspno})`
        }))
      ];

    } else if (upperCode === "LOGS_MOVEMENTS") {
      // Oracle
      const rRes = await connection.execute(
        `SELECT INSPNO, DIVE_NO, LOG_DETAIL FROM LOGS WHERE STR_ID = :strId AND INSPNO = :inspNo AND LOG_TYPE IN ('ROV LOG', 'DIVER LOG', 'BELL LOG')`,
        { strId: strId, inspNo: String(inspno) }
      );
      oracleItems = (rRes.rows || []).map((row) => {
        const ino = String(row.INSPNO || row[0] || "").trim();
        const dno = String(row.DIVE_NO || row[1] || "").trim();
        const detail = String(row.LOG_DETAIL || row[2] || "").trim();
        return {
          key: `${ino}::${dno}::${detail}`,
          label: `Movement: [${dno}] ${detail}`
        };
      });

      // Postgres
      const rovMovs = await fetchAllFromSupabase(
        supabase,
        'insp_rov_movements',
        'remarks, insp_rov_jobs!inner(jobpack_id, deployment_no)',
        (q) => q.eq('insp_rov_jobs.jobpack_id', Number(inspno))
      );
      const diveMovs = await fetchAllFromSupabase(
        supabase,
        'insp_dive_movements',
        'remarks, insp_dive_jobs!inner(jobpack_id, dive_no)',
        (q) => q.eq('insp_dive_jobs.jobpack_id', Number(inspno))
      );
      postgresItems = [
        ...(rovMovs || []).map((row) => {
          const dno = String(row.insp_rov_jobs?.deployment_no || "").trim();
          const remarks = String(row.remarks || "").trim();
          return {
            key: `${inspno}::${dno}::${remarks}`,
            label: `ROV Movement: [${dno}] ${remarks}`
          };
        }),
        ...(diveMovs || []).map((row) => {
          const dno = String(row.insp_dive_jobs?.dive_no || "").trim();
          const remarks = String(row.remarks || "").trim();
          return {
            key: `${inspno}::${dno}::${remarks}`,
            label: `Diving Movement: [${dno}] ${remarks}`
          };
        })
      ];

    } else if (upperCode === "VIDEO") {
      // Oracle (Diving tapes)
      const divRes = await connection.execute(
        `SELECT TAPE_NO, DIVE_NO, INSP_COND FROM video WHERE STR_ID = :strId AND INSPNO = :inspNo`,
        { strId: strId, inspNo: String(inspno) }
      );
      const divItems = (divRes.rows || []).map((row) => {
        const tno = String(row.TAPE_NO || row[0] || "").trim();
        const cond = String(row.INSP_COND || row[2] || "").trim();
        const chNo = parseDivingChapter(cond) || "1";
        return {
          key: `${tno}::${chNo}`,
          label: `Diving Tape: ${tno} (Chapter: ${chNo})`
        };
      });

      // Oracle (ROV tapes from PLATGI)
      const rovRes = await connection.execute(
        `SELECT TAPE_NO, COMMENTS FROM PLATGI WHERE STR_ID = :strId AND INSPNO = :inspNo AND UPPER(DESCRIPTION) LIKE '%TAPE LOG%'`,
        { strId: strId, inspNo: String(inspno) }
      );
      const rovTapesGrouped = new Map();
      (rovRes.rows || []).forEach((row) => {
        const tno = String(row.TAPE_NO || row[0] || "").trim();
        const comms = String(row.COMMENTS || row[1] || "").trim();
        if (!tno) return;
        if (!rovTapesGrouped.has(tno)) {
          rovTapesGrouped.set(tno, []);
        }
        rovTapesGrouped.get(tno).push(comms);
      });

      const rovItems = [];
      for (const [tno, commsList] of Array.from(rovTapesGrouped.entries())) {
        let hasExplicit = false;
        const assigned = new Set();
        commsList.forEach(comm => {
          const parsed = parseComments(comm);
          if (parsed.chapter) {
            hasExplicit = true;
            assigned.add(parsed.chapter);
          }
        });

        if (hasExplicit) {
          assigned.forEach(ch => {
            rovItems.push({
              key: `${tno}::${ch}`,
              label: `ROV Tape: ${tno} (Chapter: ${ch})`
            });
          });
        } else {
          rovItems.push({
            key: `${tno}::1`,
            label: `ROV Tape: ${tno} (Chapter: 1)`
          });
        }
      }
      oracleItems = [...divItems, ...rovItems];

      // Postgres
      const pgRovJobs = await fetchAllFromSupabase(
        supabase,
        'insp_rov_jobs',
        'rov_job_id',
        (q) => q.eq('jobpack_id', Number(inspno))
      );
      const pgRovJobIds = pgRovJobs.map((j) => Number(j.rov_job_id));

      const pgDiveJobs = await fetchAllFromSupabase(
        supabase,
        'insp_dive_jobs',
        'dive_job_id',
        (q) => q.eq('jobpack_id', Number(inspno))
      );
      const pgDiveJobIds = pgDiveJobs.map((j) => Number(j.dive_job_id));

      const pgTapes = [];
      if (pgRovJobIds.length > 0) {
        const rovTapes = await fetchAllFromSupabase(
          supabase,
          'insp_video_tapes',
          'tape_no, chapter_no, tape_type',
          (q) => q.in('rov_job_id', pgRovJobIds)
        );
        pgTapes.push(...(rovTapes || []));
      }
      if (pgDiveJobIds.length > 0) {
        const diveTapes = await fetchAllFromSupabase(
          supabase,
          'insp_video_tapes',
          'tape_no, chapter_no, tape_type',
          (q) => q.in('dive_job_id', pgDiveJobIds)
        );
        pgTapes.push(...(diveTapes || []));
      }

      postgresItems = pgTapes.map((row) => {
        const tno = String(row.tape_no || "").trim();
        const ch = String(row.chapter_no || "1").trim();
        return {
          key: `${tno}::${ch}`,
          label: `Video Tape: ${tno} (Chapter: ${ch}) [${row.tape_type || "UNKNOWN"}]`
        };
      });

    } else if (upperCode === "INSP_ROV" || upperCode === "INSP_DIVING" || upperCode === "ATTACHMENT" || upperCode === "INSP_ATTACHMENT") {
      const allComps = await fetchAllFromSupabase(
        supabase,
        'structure_components',
        'id, comp_id',
        (q) => q.eq('structure_id', Number(strId))
      );
      const compIdMap = new Map();
      allComps.forEach((c) => {
        if (c.comp_id) {
          compIdMap.set(Number(c.id), Number(c.comp_id));
        }
      });

      if (upperCode === "INSP_ROV") {
        let rovRes = await connection.execute(
          `SELECT COMP_ID, INSP_SCODE FROM PLATGI WHERE STR_ID = :strId AND INSPNO = :inspNo AND COMP_ID > 0`,
          { strId: strId, inspNo: String(inspno) }
        );
        oracleItems = (rovRes.rows || []).map((row) => {
          const cid = String(row.COMP_ID || row[0] || "").trim();
          const scode = String(row.INSP_SCODE || row[1] || "").trim();
          return {
            key: `${cid}::${scode}`,
            label: `ROV Platform Inspection for Comp ID ${cid} (Type: ${scode})`
          };
        });

        // Postgres
        const pgData = await fetchAllFromSupabase(
          supabase,
          'insp_records',
          'component_id, inspection_type_code',
          (q) => q.eq('jobpack_id', Number(inspno)).not('rov_job_id', 'is', null)
        );
        postgresItems = (pgData || []).map((row) => {
          const compId = Number(row.component_id);
          const oracleCompId = compIdMap.get(compId) || "";
          const tcode = String(row.inspection_type_code || "").trim();
          return {
            key: `${oracleCompId}::${tcode}`,
            label: `ROV Inspection for Comp ID ${oracleCompId} (Type: ${tcode})`
          };
        });

      } else if (upperCode === "INSP_DIVING") {
        const divRes = await connection.execute(
          `SELECT COMP_ID, INSP_TYPE FROM allinspid WHERE STR_ID = :strId AND INSPNO = :inspNo AND COMP_ID > 0 AND TRIM(UPPER(INSP_TYPE)) NOT IN ('PLATGI', 'NAVIG', 'LOGS', 'EXSUM')`,
          { strId: strId, inspNo: String(inspno) }
        );
        oracleItems = (divRes.rows || []).map((row) => {
          const cid = String(row.COMP_ID || row[0] || "").trim();
          const itype = String(row.INSP_TYPE || row[1] || "").trim();
          return {
            key: `${cid}::${itype}`,
            label: `Diving Inspection for Comp ID ${cid} (Type: ${itype})`
          };
        });

        // Postgres
        const pgData = await fetchAllFromSupabase(
          supabase,
          'insp_records',
          'component_id, inspection_type_code',
          (q) => q.eq('jobpack_id', Number(inspno)).not('dive_job_id', 'is', null)
        );
        postgresItems = (pgData || []).map((row) => {
          const compId = Number(row.component_id);
          const oracleCompId = compIdMap.get(compId) || "";
          const tcode = String(row.inspection_type_code || "").trim();
          return {
            key: `${oracleCompId}::${tcode}`,
            label: `Diving Inspection for Comp ID ${oracleCompId} (Type: ${tcode})`
          };
        });

      } else if (upperCode === "ATTACHMENT") {
        const rRes = await connection.execute(
          `SELECT ATTACH_ID, A_FILENAME, COMP_ID FROM U_ATTACH_1 WHERE STR_ID = :strId AND COMP_ID > 0 AND INSPNO IS NULL`,
          { strId: strId }
        );
        oracleItems = (rRes.rows || []).map((row) => {
          const fname = String(row.A_FILENAME !== undefined ? row.A_FILENAME : (row[1] !== undefined ? row[1] : "")).trim();
          const cid = String(row.COMP_ID !== undefined ? row.COMP_ID : (row[2] !== undefined ? row[2] : "")).trim();
          return {
            key: `${cid}::${fname}`,
            label: `Attachment: ${fname} (Comp ID: ${cid})`
          };
        });

        // Postgres
        const compDbIds = Array.from(compIdMap.keys());
        if (compDbIds.length > 0) {
          const pgData = await fetchAllFromSupabase(
            supabase,
            'attachment',
            'filename, source_id',
            (q) => q.eq('source_type', 'component').in('source_id', compDbIds)
          );
          postgresItems = (pgData || []).map((row) => {
            const fname = String(row.filename || "").trim();
            const oracleCompId = compIdMap.get(Number(row.source_id)) || "";
            return {
              key: `${oracleCompId}::${fname}`,
              label: `Component Attachment: ${fname} (Comp ID: ${oracleCompId})`
            };
          });
        }

      } else if (upperCode === "INSP_ATTACHMENT") {
        const rRes = await connection.execute(
          `SELECT ATTACH_ID, A_FILENAME, COMP_ID FROM U_ATTACH_1 WHERE STR_ID = :strId AND INSPNO = :inspNo`,
          { strId: strId, inspNo: String(inspno) }
        );
        oracleItems = (rRes.rows || []).map((row) => {
          const fname = String(row.A_FILENAME !== undefined ? row.A_FILENAME : (row[1] !== undefined ? row[1] : "")).trim();
          const cid = String(row.COMP_ID !== undefined ? row.COMP_ID : (row[2] !== undefined ? row[2] : "")).trim();
          return {
            key: fname,
            label: `Attachment: ${fname} (Comp ID: ${cid})`
          };
        });

        // Postgres
        const pgInsps = await fetchAllFromSupabase(
          supabase,
          'insp_records',
          'insp_id',
          (q) => q.eq('jobpack_id', Number(inspno))
        );
        const pgInspIds = pgInsps.map((i) => Number(i.insp_id));

        if (pgInspIds.length > 0) {
          const pgData = await fetchAllFromSupabase(
            supabase,
            'attachment',
            'filename, source_id',
            (q) => q.eq('source_type', 'inspection_record').in('source_id', pgInspIds)
          );
          postgresItems = (pgData || []).map((row) => {
            const fname = String(row.filename || "").trim();
            return {
              key: fname,
              label: `Inspection Attachment: ${fname}`
            };
          });
        }
      }
    } else if (upperCode === "ANOMALY") {
      // First find all migrated INSP_IDs for this jobpack in Oracle
      const inspIds = new Set();
      const r1 = await connection.execute(
        `SELECT DISTINCT INSP_ID FROM allinspid WHERE STR_ID = :strId AND INSPNO = :inspNo AND INSP_ID IS NOT NULL AND INSP_ID > 0`,
        { strId: strId, inspNo: String(inspno) }
      );
      (r1.rows || []).forEach((r) => inspIds.add(Number(r.INSP_ID || r[0])));

      // Also PLATGI for platform anomaly triggers
      const r2 = await connection.execute(
        `SELECT DISTINCT INSP_ID FROM PLATGI WHERE STR_ID = :strId AND INSPNO = :inspNo AND INSP_ID IS NOT NULL AND INSP_ID > 0`,
        { strId: strId, inspNo: String(inspno) }
      );
      (r2.rows || []).forEach((r) => inspIds.add(Number(r.INSP_ID || r[0])));

      if (inspIds.size > 0) {
        const inspIdList = Array.from(inspIds).join(',');
        const dRes = await connection.execute(
          `SELECT DFT_REF_NO, COMP_ID FROM u_defect WHERE STR_ID = :strId AND INSP_ID IN (${inspIdList})`,
          { strId: strId }
        );
        oracleItems = (dRes.rows || []).map((row) => {
          const refNo = String(row.DFT_REF_NO || row[0] || "").trim();
          const compId = String(row.COMP_ID || row[1] || "").trim();
          return {
            key: refNo,
            label: `Anomaly: ${refNo} (Comp ID: ${compId})`
          };
        });
      }

      // Postgres
      const pgInsps = await fetchAllFromSupabase(
        supabase,
        'insp_records',
        'insp_id',
        (q) => q.eq('jobpack_id', Number(inspno))
      );
      const pgInspIds = pgInsps.map((i) => Number(i.insp_id));

      if (pgInspIds.length > 0) {
        const pgData = await fetchAllFromSupabase(
          supabase,
          'insp_anomalies',
          'anomaly_ref_no',
          (q) => q.in('inspection_id', pgInspIds)
        );
        postgresItems = (pgData || []).map((row) => {
          const refNo = String(row.anomaly_ref_no || "").trim();
          return {
            key: refNo,
            label: `Anomaly: ${refNo}`
          };
        });
      }
    }

    const pgKeys = new Set(postgresItems.map(item => item.key));
    const oracleKeys = new Set(oracleItems.map(item => item.key));

    const missingInPostgres = oracleItems.filter(item => item.key && !pgKeys.has(item.key));
    const missingInOracle = postgresItems.filter(item => item.key && !oracleKeys.has(item.key));

    console.log(`Oracle total rows count: ${oracleItems.length}`);
    console.log(`Postgres total rows count: ${postgresItems.length}`);
    console.log(`Missing in Postgres: ${missingInPostgres.length}`);
    if (missingInPostgres.length > 0) {
      console.log("Sample missing in Postgres:", missingInPostgres.slice(0, 5));
    }
    console.log(`Missing in Oracle: ${missingInOracle.length}`);
    if (missingInOracle.length > 0) {
      console.log("Sample missing in Oracle:", missingInOracle.slice(0, 5));
    }

  } catch (err) {
    console.error(`Error during comparison test for ${upperCode}:`, err);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

async function run() {
  if (config.useThickMode) {
    try {
      oracledb.initOracleClient({ libDir: config.libDir });
    } catch (err) {}
  }
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  oracledb.fetchAsString = [oracledb.DATE, oracledb.NUMBER];

  // Try to find a valid structure and jobpack first
  let conn;
  let testStrId = "261";
  let testInspno = "591";
  
  try {
    conn = await oracledb.getConnection({
      user: config.user,
      password: config.password,
      connectString: config.connectString || `${config.host}:${config.port}/${config.serviceName}`
    });
    // Check if taskstr has any jobpacks for this structure
    const res = await conn.execute(`SELECT STR_ID, INSPNO FROM taskstr WHERE INSPNO IS NOT NULL AND ROWNUM <= 5`);
    console.log("Available structure-jobpacks in Oracle taskstr:", res.rows);
    if (res.rows.length > 0) {
      testStrId = String(res.rows[0].STR_ID || res.rows[0][0]);
      testInspno = String(res.rows[0].INSPNO || res.rows[0][1]);
    }
  } catch (e) {
    console.warn("Could not query taskstr for dynamic test parameters, using defaults.");
  } finally {
    if (conn) {
      await conn.close();
    }
  }

  console.log(`Using Test Parameters: Str ID = ${testStrId}, Jobpack = ${testInspno}`);

  // Test the new Phase 2/3/4 comparison endpoints
  await testComparison(testStrId, testInspno, "JOBPACK");
  await testComparison(testStrId, testInspno, "U_SOW");
  await testComparison(testStrId, testInspno, "LOGS_JOBS");
  await testComparison(testStrId, testInspno, "LOGS_MOVEMENTS");
  await testComparison(testStrId, testInspno, "VIDEO");
  await testComparison(testStrId, testInspno, "INSP_ROV");
  await testComparison(testStrId, testInspno, "INSP_DIVING");
  await testComparison(testStrId, testInspno, "ANOMALY");
  await testComparison(testStrId, testInspno, "ATTACHMENT");
  await testComparison(testStrId, testInspno, "INSP_ATTACHMENT");

  console.log("\nComparison verification tests completed.");
}

run();
