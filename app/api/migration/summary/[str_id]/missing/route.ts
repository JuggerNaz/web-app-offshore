import { NextRequest, NextResponse } from "next/server";
import { getOracleConnection, OracleConnectionConfig } from "@/utils/oracle-db";
import { withAuth } from "@/utils/with-auth";
import { createClient, createAdminClient } from "@/utils/supabase/server";

// Helper function to paginate and fetch all records from Supabase to avoid the default 1000 limit
async function fetchAllFromSupabase(
  supabase: any,
  table: string,
  columns: string,
  filterBuilder?: (query: any) => any
) {
  let allData: any[] = [];
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

function parseComments(comments: string): { subject?: string; chapter?: string; tape?: string; findings?: string } {
  if (!comments) return {};

  const result: { subject?: string; chapter?: string; tape?: string; findings?: string } = {};

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

function parseDivingChapter(inspCond: string): string | null {
  if (!inspCond) return null;
  const match = inspCond.match(/chapter\s*(?:number|no)?\s*:?\s*(\d+)/i);
  if (match) return match[1].trim();
  
  const simpleMatch = inspCond.match(/ch\s*(\d+)/i);
  if (simpleMatch) return simpleMatch[1].trim();
  
  return null;
}

export const POST = withAuth(
  async (
    request: NextRequest,
    { params, user }: { params: Promise<{ str_id: string }>; user: any }
  ) => {
    let connection;
    try {
      const { str_id } = await params;
      const { code, inspno, structureType, ...config }: { code: string; inspno?: string; structureType?: string } & OracleConnectionConfig = await request.json();

      if ((!config.connectString && (!config.host || !config.serviceName)) || !config.user || !config.password) {
        return NextResponse.json({ error: "Missing required connection parameters" }, { status: 400 });
      }

      if (!str_id) {
        return NextResponse.json({ error: "Missing structure ID" }, { status: 400 });
      }

      if (!code) {
        return NextResponse.json({ error: "Missing sync table code" }, { status: 400 });
      }

      const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabase = useAdmin ? createAdminClient() : createClient();

      let resolvedJobpackId = -1;
      if (inspno) {
        // First try to find by the Oracle INSPNO stored in metadata
        const { data: jpByMeta } = await supabase
          .from('jobpack')
          .select('id')
          .eq('metadata->>oracleInspNo', inspno)
          .maybeSingle();
        if (jpByMeta) {
          resolvedJobpackId = jpByMeta.id;
        } else {
          // Fallback: try by name (case-insensitive)
          const { data: jpByName } = await supabase
            .from('jobpack')
            .select('id')
            .ilike('name', inspno)
            .maybeSingle();
          if (jpByName) {
            resolvedJobpackId = jpByName.id;
          } else if (!isNaN(Number(inspno))) {
            resolvedJobpackId = Number(inspno);
          }
        }
      }

      connection = await getOracleConnection(config);

      let oracleItems: { key: string; label: string }[] = [];
      let postgresItems: { key: string; label: string }[] = [];
      let customMissingInPostgres: { key: string; label: string }[] | null = null;
      let customMissingInOracle: { key: string; label: string }[] | null = null;

      const upperCode = code.toUpperCase().trim();

      if (upperCode === "U_LIB_MAST") {
        // Oracle
        const rRes = await connection.execute(`SELECT LIB_CODE, LIB_NAME FROM U_LIB_MAST`);
        const seenKeys = new Set<string>();
        const duplicates: { key: string; label: string }[] = [];

        oracleItems = (rRes.rows || []).map((row: any) => {
          const key = String(row.LIB_CODE || row[0] || "").trim();
          const label = String(row.LIB_NAME || row[1] || "").trim() || String(row.LIB_CODE || row[0] || "").trim();
          
          if (seenKeys.has(key)) {
            duplicates.push({
              key: `${key}::dup::${duplicates.length}`,
              label: `[Duplicate Consolidated] ${label}`
            });
          } else {
            seenKeys.add(key);
          }
          return { key, label };
        });

        // Postgres
        const pgData = await fetchAllFromSupabase(supabase, 'u_lib_mast', 'lib_code, lib_name');
        postgresItems = (pgData || []).map((row: any) => ({
          key: String(row.lib_code || "").trim(),
          label: String(row.lib_name || "").trim() || String(row.lib_code || "").trim()
        }));

        const pgKeys = new Set(postgresItems.map(item => item.key));
        const missingUnique = Array.from(seenKeys).filter(k => !pgKeys.has(k)).map(k => {
          const match = oracleItems.find(item => item.key === k);
          return match || { key: k, label: k };
        });

        customMissingInPostgres = [
          ...missingUnique,
          ...duplicates
        ];

      } else if (upperCode === "U_LIB_LIST") {
        // Oracle
        const rRes = await connection.execute(`SELECT LIB_CODE, LIB_ID, LIB_DESC FROM U_LIB_LIST`);
        const seenKeys = new Set<string>();
        const duplicates: { key: string; label: string }[] = [];

        oracleItems = (rRes.rows || []).map((row: any) => {
          const lcode = String(row.LIB_CODE || row[0] || "").trim();
          const lid = String(row.LIB_ID || row[1] || "").trim();
          const ldesc = String(row.LIB_DESC || row[2] || "").trim();
          const key = `${lcode}::${lid}`;
          const label = `[${lcode}] ${lid}: ${ldesc || "(No Description)"}`;
          
          if (seenKeys.has(key)) {
            duplicates.push({
              key: `${key}::dup::${duplicates.length}`,
              label: `[Duplicate Consolidated] ${label}`
            });
          } else {
            seenKeys.add(key);
          }
          return { key, label };
        });

        // Postgres
        const pgData = await fetchAllFromSupabase(supabase, 'u_lib_list', 'lib_code, lib_id, lib_desc');
        postgresItems = (pgData || []).map((row: any) => {
          const lcode = String(row.lib_code || "").trim();
          const lid = String(row.lib_id || "").trim();
          const ldesc = String(row.lib_desc || "").trim();
          return {
            key: `${lcode}::${lid}`,
            label: `[${lcode}] ${lid}: ${ldesc || "(No Description)"}`
          };
        });

        const pgKeys = new Set(postgresItems.map(item => item.key));
        const missingUnique = Array.from(seenKeys).filter(k => !pgKeys.has(k)).map(k => {
          const match = oracleItems.find(item => item.key === k);
          return match || { key: k, label: k };
        });

        customMissingInPostgres = [
          ...missingUnique,
          ...duplicates
        ];

      } else if (upperCode === "U_LIB_COMBO") {
        // Oracle
        const rRes = await connection.execute(`SELECT LIB_CODE, COMB_ID, COMB_VAL FROM U_LIB_COMBO`);
        const seenKeys = new Set<string>();
        const duplicates: { key: string; label: string }[] = [];

        oracleItems = (rRes.rows || []).map((row: any) => {
          const lcode = String(row.LIB_CODE || row[0] || "").trim();
          const cid = String(row.COMB_ID || row[1] || "").trim();
          const cval = String(row.COMB_VAL || row[2] || "").trim();
          const key = `${lcode}::${cid}::${cval}`;
          const label = `[${lcode}] ${cid}: ${cval || "(No Value)"}`;
          
          if (seenKeys.has(key)) {
            duplicates.push({
              key: `${key}::dup::${duplicates.length}`,
              label: `[Duplicate Consolidated] ${label}`
            });
          } else {
            seenKeys.add(key);
          }
          return { key, label };
        });

        // Postgres
        const pgData = await fetchAllFromSupabase(supabase, 'u_lib_combo', 'lib_code, comb_id, comb_val');
        postgresItems = (pgData || []).map((row: any) => {
          const lcode = String(row.lib_code || "").trim();
          const cid = String(row.comb_id || "").trim();
          const cval = String(row.comb_val || "").trim();
          return {
            key: `${lcode}::${cid}::${cval}`,
            label: `[${lcode}] ${cid}: ${cval || "(No Value)"}`
          };
        });

        const pgKeys = new Set(postgresItems.map(item => item.key));
        const missingUnique = Array.from(seenKeys).filter(k => !pgKeys.has(k)).map(k => {
          const match = oracleItems.find(item => item.key === k);
          return match || { key: k, label: k };
        });

        customMissingInPostgres = [
          ...missingUnique,
          ...duplicates
        ];

      } else if (upperCode === "STRUCTURE") {
        // Oracle
        const rRes = await connection.execute(`SELECT STR_ID, TITLE FROM v_structure WHERE STR_ID = :strId`, { strId: str_id });
        oracleItems = (rRes.rows || []).map((row: any) => ({
          key: String(row.STR_ID || row[0] || "").trim(),
          label: String(row.TITLE || row[1] || "").trim() || `Structure ${str_id}`
        }));

        // Postgres (always returns 0 or 1 rows, so standard queries are fine)
        const { data: platData } = await supabase.from('platform').select('plat_id, title').eq('plat_id', Number(str_id));
        const { data: pipeData } = await supabase.from('u_pipeline').select('pipe_id, title').eq('pipe_id', Number(str_id));
        postgresItems = [
          ...(platData || []).map((r: any) => ({ key: String(r.plat_id), label: r.title })),
          ...(pipeData || []).map((r: any) => ({ key: String(r.pipe_id), label: r.title }))
        ];

      } else if (upperCode === "STR_ELV") {
        // Oracle
        const rRes = await connection.execute(`SELECT ELV_ID, ELV, ELV_DESC FROM STR_ELV WHERE PLAT_ID = :strId`, { strId: str_id });
        oracleItems = (rRes.rows || []).map((row: any) => ({
          key: String(row.ELV || row[1] || "").trim(),
          label: `Elevation: ${row.ELV || row[1]} (${row.ELV_DESC || row[2] || "No description"})`
        }));

        // Postgres
        const pgData = await fetchAllFromSupabase(supabase, 'str_elv', 'elevation, elv_desc', (q) => q.eq('plat_id', Number(str_id)));
        postgresItems = (pgData || []).map((row: any) => ({
          key: String(row.elevation || "").trim(),
          label: `Elevation: ${row.elevation} (${row.elv_desc || "No description"})`
        }));

      } else if (upperCode === "STR_LEVEL") {
        // Oracle
        const rRes = await connection.execute(`SELECT LEV_ID, LEV_VAL, LEV_NAME FROM STR_LEVEL WHERE PLAT_ID = :strId`, { strId: str_id });
        oracleItems = (rRes.rows || []).map((row: any) => ({
          key: String(row.LEV_VAL || row[1] || "").trim(),
          label: `Level: ${row.LEV_VAL || row[1]} (${row.LEV_NAME || row[2] || "No name"})`
        }));

        // Postgres
        const pgData = await fetchAllFromSupabase(supabase, 'str_level', 'level_value, level_name', (q) => q.eq('plat_id', Number(str_id)));
        postgresItems = (pgData || []).map((row: any) => ({
          key: String(row.level_value || "").trim(),
          label: `Level: ${row.level_value} (${row.level_name || "No name"})`
        }));

      } else if (upperCode === "STR_FACES") {
        // Oracle
        const rRes = await connection.execute(`SELECT FACE_ID, FACE, FACE_DESC FROM STR_FACES WHERE PLAT_ID = :strId`, { strId: str_id });
        oracleItems = (rRes.rows || []).map((row: any) => ({
          key: String(row.FACE || row[1] || "").trim(),
          label: `Face: ${row.FACE || row[1]} (${row.FACE_DESC || row[2] || "No description"})`
        }));

        // Postgres
        const pgData = await fetchAllFromSupabase(supabase, 'str_faces', 'face, face_desc', (q) => q.eq('plat_id', Number(str_id)));
        postgresItems = (pgData || []).map((row: any) => ({
          key: String(row.face || "").trim(),
          label: `Face: ${row.face} (${row.face_desc || "No description"})`
        }));

      } else if (upperCode === "U_ASSOC") {
        // Oracle (filter by active ALLCOMPID records to match summary/execute counts)
        const rRes = await connection.execute(
          `SELECT a.COMP_ID, a.ASSOC_COMPID 
           FROM U_ASSOC a 
           WHERE a.STR_ID = :strId
             AND a.COMP_ID IN (
               SELECT c1.COMP_ID FROM ALLCOMPID c1 
               WHERE c1.STR_ID = :strId
                 AND NOT (NVL(c1.DEL, 0) = 1 AND NOT EXISTS (
                   SELECT 1 FROM allinspid i1 WHERE i1.COMP_ID = c1.COMP_ID AND i1.STR_ID = c1.STR_ID
                 ))
             )
             AND a.ASSOC_COMPID IN (
               SELECT c2.COMP_ID FROM ALLCOMPID c2 
               WHERE c2.STR_ID = :strId
                 AND NOT (NVL(c2.DEL, 0) = 1 AND NOT EXISTS (
                   SELECT 1 FROM allinspid i2 WHERE i2.COMP_ID = c2.COMP_ID AND i2.STR_ID = c2.STR_ID
                 ))
             )`,
          { strId: str_id }
        );
        oracleItems = (rRes.rows || []).map((row: any) => {
          const cid = String(row.COMP_ID !== undefined ? row.COMP_ID : (row[0] !== undefined ? row[0] : "")).trim();
          const scid = String(row.ASSOC_COMPID !== undefined ? row.ASSOC_COMPID : (row[1] !== undefined ? row[1] : "")).trim();
          return {
            key: `${cid}::${scid}`,
            label: `Comp ID ${cid} associated with Comp ID ${scid}`
          };
        });

        // Postgres (Map the associated component's Postgres ID back to its Oracle COMP_ID to compare keys correctly)
        const allComps = await fetchAllFromSupabase(
          supabase,
          'structure_components',
          'id, comp_id, metadata',
          (q) => q.eq('structure_id', Number(str_id))
        );

        const pgIdToOracleId = new Map<string, string>();
        if (allComps) {
          allComps.forEach((c: any) => {
            const oId = String(c.comp_id || "").trim();
            if (oId) {
              pgIdToOracleId.set(String(c.id), oId);
            }
          });
        }

        postgresItems = (allComps || [])
          .filter((row: any) => row.metadata?.associated_comp_id)
          .map((row: any) => {
            const cid = String(row.comp_id || "").trim();
            const assocPgId = String(row.metadata.associated_comp_id).trim();
            const scid = pgIdToOracleId.get(assocPgId) || "";
            return {
              key: `${cid}::${scid}`,
              label: `Comp ID ${cid} associated with Comp ID ${scid}`
            };
          });

      } else if (upperCode === "JOBPACK") {
        if (!inspno) {
          return NextResponse.json({ error: "Missing active jobpack INSPNO" }, { status: 400 });
        }
        // Oracle
        const rRes = await connection.execute(
          `SELECT INSPNO, JOB_TYPE FROM taskstr WHERE STR_ID = :strId AND INSPNO = :inspNo`,
          { strId: str_id, inspNo: String(inspno) }
        );
        oracleItems = (rRes.rows || []).map((row: any) => ({
          key: String(row.INSPNO || row[0] || "").trim(),
          label: `Jobpack ${row.INSPNO || row[0]} (${row.JOB_TYPE || row[1] || "ROV/Diving"})`
        }));

        // Postgres
        const { data: pgData } = await supabase
          .from('jobpack')
          .select('id, name')
          .eq('id', resolvedJobpackId);
        postgresItems = (pgData || []).map((row: any) => ({
          key: String(row.name || row.id),
          label: `Jobpack ${row.id} (${row.name || "No name"})`
        }));

      } else if (upperCode === "U_SOW") {
        if (!inspno) {
          return NextResponse.json({ error: "Missing active jobpack INSPNO" }, { status: 400 });
        }
        // Oracle
        const rRes = await connection.execute(
          `SELECT INSPNO, REP_PREFIX FROM sow_insp WHERE INSPNO = :inspNo`,
          { inspNo: String(inspno) }
        );
        oracleItems = (rRes.rows || []).map((row: any) => {
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
          (q) => q.eq('jobpack_id', resolvedJobpackId)
        );
        postgresItems = [];
        (pgData || []).forEach((row: any) => {
          const repNums = row.report_numbers || [];
          if (Array.isArray(repNums)) {
            repNums.forEach((rn: any) => {
              const num = String(rn.number || rn.REP_PREFIX || "").trim();
              if (num) {
                postgresItems.push({
                  key: `${inspno}::${num}`,
                  label: `SOW for Jobpack ${inspno} (Report No: ${num})`
                });
              }
            });
          }
        });

      } else if (upperCode === "LOGS_JOBS") {
        if (!inspno) {
          return NextResponse.json({ error: "Missing active jobpack INSPNO" }, { status: 400 });
        }
        // Oracle
        const rRes = await connection.execute(
          `SELECT DISTINCT INSPNO, DIVE_NO, LOG_TYPE FROM LOGS WHERE STR_ID = :strId AND INSPNO = :inspNo AND LOG_TYPE IN ('ROV LOG', 'DIVER LOG', 'BELL LOG')`,
          { strId: str_id, inspNo: String(inspno) }
        );
        oracleItems = (rRes.rows || []).map((row: any) => {
          const ino = String(row.INSPNO || row[0] || "").trim();
          const dno = String(row.DIVE_NO || row[1] || "").trim();
          const ltype = String(row.LOG_TYPE || row[2] || "").trim();
          return {
            key: `${ino}::${dno}`,
            label: `Job: ${ltype} #${dno} (Jobpack: ${ino})`
          };
        });

        // Postgres
        const rovData = await fetchAllFromSupabase(supabase, 'insp_rov_jobs', 'deployment_no', (q) => q.eq('jobpack_id', resolvedJobpackId));
        const diveData = await fetchAllFromSupabase(supabase, 'insp_dive_jobs', 'dive_no', (q) => q.eq('jobpack_id', resolvedJobpackId));
        postgresItems = [
          ...(rovData || []).map((row: any) => ({
            key: `${inspno}::${String(row.deployment_no).trim()}`,
            label: `ROV Job #${row.deployment_no} (Jobpack: ${inspno})`
          })),
          ...(diveData || []).map((row: any) => ({
            key: `${inspno}::${String(row.dive_no).trim()}`,
            label: `Diving Job #${row.dive_no} (Jobpack: ${inspno})`
          }))
        ];

      } else if (upperCode === "LOGS_MOVEMENTS") {
        if (!inspno) {
          return NextResponse.json({ error: "Missing active jobpack INSPNO" }, { status: 400 });
        }
        // Oracle
        const rRes = await connection.execute(
          `SELECT INSPNO, DIVE_NO, LOG_DETAIL FROM LOGS WHERE STR_ID = :strId AND INSPNO = :inspNo AND LOG_TYPE IN ('ROV LOG', 'DIVER LOG', 'BELL LOG')`,
          { strId: str_id, inspNo: String(inspno) }
        );
        oracleItems = (rRes.rows || []).map((row: any) => {
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
          (q) => q.eq('insp_rov_jobs.jobpack_id', resolvedJobpackId)
        );
        const diveMovs = await fetchAllFromSupabase(
          supabase,
          'insp_dive_movements',
          'remarks, insp_dive_jobs!inner(jobpack_id, dive_no)',
          (q) => q.eq('insp_dive_jobs.jobpack_id', resolvedJobpackId)
        );
        postgresItems = [
          ...(rovMovs || []).map((row: any) => {
            const dno = String(row.insp_rov_jobs?.deployment_no || "").trim();
            const remarks = String(row.remarks || "").trim();
            return {
              key: `${inspno}::${dno}::${remarks}`,
              label: `ROV Movement: [${dno}] ${remarks}`
            };
          }),
          ...(diveMovs || []).map((row: any) => {
            const dno = String(row.insp_dive_jobs?.dive_no || "").trim();
            const remarks = String(row.remarks || "").trim();
            return {
              key: `${inspno}::${dno}::${remarks}`,
              label: `Diving Movement: [${dno}] ${remarks}`
            };
          })
        ];

      } else if (upperCode === "VIDEO") {
        if (!inspno) {
          return NextResponse.json({ error: "Missing active jobpack INSPNO" }, { status: 400 });
        }
        // Oracle (Diving tapes)
        const divRes = await connection.execute(
          `SELECT TAPE_NO, DIVE_NO, INSP_COND FROM video WHERE STR_ID = :strId AND INSPNO = :inspNo`,
          { strId: str_id, inspNo: String(inspno) }
        );
        const divItems = (divRes.rows || []).map((row: any) => {
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
          `SELECT TAPE_NO, COMMENTS FROM PLATGI WHERE STR_ID = :strId AND INSPNO = :inspNo AND (UPPER(DESCRIPTION) LIKE '%TAPE%' OR UPPER(DESCRIPTION) LIKE '%RECORDING%' OR UPPER(DESCRIPTION) LIKE '%VIDEO LOG%' OR TAPE_NO IS NOT NULL)`,
          { strId: str_id, inspNo: String(inspno) }
        );
        const rovTapesGrouped = new Map<string, string[]>();
        (rovRes.rows || []).forEach((row: any) => {
          const tno = String(row.TAPE_NO || row[0] || "").trim();
          const comms = String(row.COMMENTS || row[1] || "").trim();
          if (!tno) return;
          if (!rovTapesGrouped.has(tno)) {
            rovTapesGrouped.set(tno, []);
          }
          rovTapesGrouped.get(tno)!.push(comms);
        });

        const rovItems: { key: string; label: string }[] = [];
        for (const [tno, commsList] of Array.from(rovTapesGrouped.entries())) {
          let hasExplicit = false;
          const assigned = new Set<string>();
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
          (q) => q.eq('jobpack_id', resolvedJobpackId)
        );
        const pgRovJobIds = pgRovJobs.map((j: any) => Number(j.rov_job_id));

        const pgDiveJobs = await fetchAllFromSupabase(
          supabase,
          'insp_dive_jobs',
          'dive_job_id',
          (q) => q.eq('jobpack_id', resolvedJobpackId)
        );
        const pgDiveJobIds = pgDiveJobs.map((j: any) => Number(j.dive_job_id));

        const pgTapes: any[] = [];
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

        postgresItems = pgTapes.map((row: any) => {
          const tno = String(row.tape_no || "").trim();
          const ch = String(row.chapter_no || "1").trim();
          return {
            key: `${tno}::${ch}`,
            label: `Video Tape: ${tno} (Chapter: ${ch}) [${row.tape_type || "UNKNOWN"}]`
          };
        });

      } else if (upperCode === "INSP_ROV" || upperCode === "INSP_DIVING" || upperCode === "ATTACHMENT" || upperCode === "INSP_ATTACHMENT") {
        if (!inspno && (upperCode !== "ATTACHMENT")) {
          return NextResponse.json({ error: "Missing active jobpack INSPNO" }, { status: 400 });
        }
        // Fetch components mapping for this structure
        const allComps = await fetchAllFromSupabase(
          supabase,
          'structure_components',
          'id, comp_id',
          (q) => q.eq('structure_id', Number(str_id))
        );
        const compIdMap = new Map<number, number>();
        allComps.forEach((c: any) => {
          if (c.comp_id) {
            compIdMap.set(Number(c.id), Number(c.comp_id));
          }
        });

        if (upperCode === "INSP_ROV") {
          const structType = structureType || "PLATFORM";
          let rovRes;
          if (structType.toUpperCase() === "PLATFORM") {
            rovRes = await connection.execute(
              `SELECT COMP_ID, INSP_SCODE FROM PLATGI WHERE STR_ID = :strId AND INSPNO = :inspNo AND COMP_ID > 0`,
              { strId: str_id, inspNo: String(inspno) }
            );
            oracleItems = (rovRes.rows || []).map((row: any) => {
              const cid = String(row.COMP_ID || row[0] || "").trim();
              const scode = String(row.INSP_SCODE || row[1] || "").trim();
              return {
                key: `${cid}::${scode}`,
                label: `ROV Platform Inspection for Comp ID ${cid} (Type: ${scode})`
              };
            });
          } else {
            rovRes = await connection.execute(
              `SELECT COMP_ID, INSP_TYPE FROM allinspid WHERE STR_ID = :strId AND INSPNO = :inspNo AND INSP_TYPE = 'NAVIG' AND COMP_ID > 0`,
              { strId: str_id, inspNo: String(inspno) }
            );
            oracleItems = (rovRes.rows || []).map((row: any) => {
              const cid = String(row.COMP_ID || row[0] || "").trim();
              return {
                key: `${cid}::NAVIG`,
                label: `ROV Pipeline Inspection for Comp ID ${cid} (Type: NAVIG)`
              };
            });
          }

          // Postgres
          const pgData = await fetchAllFromSupabase(
            supabase,
            'insp_records',
            'component_id, inspection_type_code',
            (q) => q.eq('jobpack_id', resolvedJobpackId).not('rov_job_id', 'is', null)
          );
          postgresItems = (pgData || []).map((row: any) => {
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
            { strId: str_id, inspNo: String(inspno) }
          );
          oracleItems = (divRes.rows || []).map((row: any) => {
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
            (q) => q.eq('jobpack_id', resolvedJobpackId).not('dive_job_id', 'is', null)
          );
          postgresItems = (pgData || []).map((row: any) => {
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
            { strId: str_id }
          );
          oracleItems = (rRes.rows || []).map((row: any) => {
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
            postgresItems = (pgData || []).map((row: any) => {
              const fname = String(row.filename || "").trim();
              const oracleCompId = compIdMap.get(Number(row.source_id)) || "";
              return {
                key: `${oracleCompId}::${fname}`,
                label: `Component Attachment: ${fname} (Comp ID: ${oracleCompId})`
              };
            });
          } else {
            postgresItems = [];
          }

        } else if (upperCode === "INSP_ATTACHMENT") {
          const rRes = await connection.execute(
            `SELECT ATTACH_ID, A_FILENAME, COMP_ID FROM U_ATTACH_1 WHERE STR_ID = :strId AND INSPNO = :inspNo`,
            { strId: str_id, inspNo: String(inspno) }
          );
          oracleItems = (rRes.rows || []).map((row: any) => {
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
            (q) => q.eq('jobpack_id', resolvedJobpackId)
          );
          const pgInspIds = pgInsps.map((i: any) => Number(i.insp_id));

          if (pgInspIds.length > 0) {
            const pgData = await fetchAllFromSupabase(
              supabase,
              'attachment',
              'filename, source_id',
              (q) => q.eq('source_type', 'inspection_record').in('source_id', pgInspIds)
            );
            postgresItems = (pgData || []).map((row: any) => {
              const fname = String(row.filename || "").trim();
              return {
                key: fname,
                label: `Inspection Attachment: ${fname}`
              };
            });
          } else {
            postgresItems = [];
          }
        }

      } else if (upperCode === "ANOMALY") {
        if (!inspno) {
          return NextResponse.json({ error: "Missing active jobpack INSPNO" }, { status: 400 });
        }
        // First find all migrated INSP_IDs for this jobpack in Oracle
        const structType = structureType || "PLATFORM";
        const inspIds = new Set<number>();
        
        const r1 = await connection.execute(
          `SELECT DISTINCT INSP_ID FROM allinspid WHERE STR_ID = :strId AND INSPNO = :inspNo AND INSP_ID IS NOT NULL AND INSP_ID > 0`,
          { strId: str_id, inspNo: String(inspno) }
        );
        (r1.rows || []).forEach((r: any) => inspIds.add(Number(r.INSP_ID || r[0])));

        if (structType.toUpperCase() === "PLATFORM") {
          const r2 = await connection.execute(
            `SELECT DISTINCT INSP_ID FROM PLATGI WHERE STR_ID = :strId AND INSPNO = :inspNo AND INSP_ID IS NOT NULL AND INSP_ID > 0`,
            { strId: str_id, inspNo: String(inspno) }
          );
          (r2.rows || []).forEach((r: any) => inspIds.add(Number(r.INSP_ID || r[0])));
        }

        if (inspIds.size > 0) {
          const inspIdList = Array.from(inspIds).join(',');
          const dRes = await connection.execute(
            `SELECT DFT_REF_NO, COMP_ID FROM u_defect WHERE STR_ID = :strId AND INSP_ID IN (${inspIdList})`,
            { strId: str_id }
          );
          oracleItems = (dRes.rows || []).map((row: any) => {
            const refNo = String(row.DFT_REF_NO || row[0] || "").trim();
            const compId = String(row.COMP_ID || row[1] || "").trim();
            return {
              key: refNo,
              label: `Anomaly: ${refNo} (Comp ID: ${compId})`
            };
          });
        } else {
          oracleItems = [];
        }

        // Postgres
        const pgInsps = await fetchAllFromSupabase(
          supabase,
          'insp_records',
          'insp_id',
          (q) => q.eq('jobpack_id', resolvedJobpackId)
        );
        const pgInspIds = pgInsps.map((i: any) => Number(i.insp_id));

        if (pgInspIds.length > 0) {
          const pgData = await fetchAllFromSupabase(
            supabase,
            'insp_anomalies',
            'anomaly_ref_no',
            (q) => q.in('inspection_id', pgInspIds)
          );
          postgresItems = (pgData || []).map((row: any) => {
            const refNo = String(row.anomaly_ref_no || "").trim();
            return {
              key: refNo,
              label: `Anomaly: ${refNo}`
            };
          });
        } else {
          postgresItems = [];
        }

      } else {
        // Component type code (e.g. BAN)
        // Oracle
        const rRes = await connection.execute(
          `SELECT COMP_ID, Q_ID 
           FROM allcompid 
           WHERE STR_ID = :strId AND CODE = :code
             AND NOT (NVL(DEL, 0) = 1 AND NOT EXISTS (
               SELECT 1 FROM allinspid i WHERE i.COMP_ID = allcompid.COMP_ID AND i.STR_ID = allcompid.STR_ID
             ))`,
          { strId: str_id, code: code }
        );
        oracleItems = (rRes.rows || []).map((row: any) => ({
          key: String(row.COMP_ID || row[0] || "").trim(),
          label: `${row.Q_ID || row[1] || "Comp ID " + row.COMP_ID} (Oracle ID: ${row.COMP_ID || row[0]})`
        }));

        // Postgres
        const pgData = await fetchAllFromSupabase(
          supabase,
          'structure_components',
          'q_id, metadata',
          (q) => q.eq('structure_id', Number(str_id)).eq('code', code)
        );
        
        postgresItems = (pgData || []).map((row: any) => ({
          key: String(row.metadata?.oracleCompId || "").trim(),
          label: `${row.q_id || "Comp QID"} (Oracle ID: ${row.metadata?.oracleCompId || ""})`
        }));
      }

      // Compute diffs
      const pgKeys = new Set(postgresItems.map(item => item.key));
      const oracleKeys = new Set(oracleItems.map(item => item.key));

      const missingInPostgres = customMissingInPostgres || oracleItems.filter(item => item.key && !pgKeys.has(item.key));
      const missingInOracle = customMissingInOracle || postgresItems.filter(item => item.key && !oracleKeys.has(item.key));

      return NextResponse.json({
        success: true,
        tableName: upperCode,
        missingInPostgres,
        missingInOracle
      });

    } catch (error: any) {
      console.error(`[Oracle Fetch Missing Summary Error]:`, error);
      return NextResponse.json({ 
        error: "Failed to fetch missing summary details", 
        details: error.message 
      }, { status: 500 });
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (err) {
          console.error("Error closing Oracle connection:", err);
        }
      }
    }
  }
);
