import { NextRequest, NextResponse } from "next/server";
import { getOracleConnection, OracleConnectionConfig } from "@/utils/oracle-db";
import { withAuth } from "@/utils/with-auth";

/**
 * POST /api/migration/jobpacks/[str_id]
 * Fetches the list of jobpack names from Oracle matching the selected structure's INSPNOs.
 * Expects Oracle credentials in the request body.
 */
export const POST = withAuth(
  async (
    request: NextRequest,
    { params, user }: { params: Promise<{ str_id: string }>; user: any }
  ) => {
    let connection;
    try {
      const { str_id } = await params;
      const config: OracleConnectionConfig = await request.json();

      if ((!config.connectString && (!config.host || !config.serviceName)) || !config.user || !config.password) {
        return NextResponse.json({ error: "Missing required connection parameters" }, { status: 400 });
      }

      if (!str_id) {
        return NextResponse.json({ error: "Missing structure ID" }, { status: 400 });
      }

      connection = await getOracleConnection(config);

      let jobpacks = [];
      // Progressive fallback queries for fetching jobpack details
      // Tables: workpl (INSPNO only, no STR_ID!), job_vessel (INSPNO, V_NAME, START_DATE), taskstr (STR_ID+INSPNO), sow_insp (STR_ID+INSPNO)
      const jobpackQueries = [
        // 1st: Full join with all 4 tables
        {
          label: "workpl + taskstr + sow_insp + job_vessel",
          sql: `SELECT DISTINCT a.INSPNO, w.JOBNAME, w.ISTART AS START_DATE, t.JOB_TYPE,
                  jv.V_NAME, jv.START_DATE AS VESSEL_START_DATE,
                  si.REP_PREFIX
                FROM allinspid a
                LEFT JOIN workpl w ON a.INSPNO = w.INSPNO
                LEFT JOIN TASKSTR t ON a.STR_ID = t.STR_ID AND a.INSPNO = t.INSPNO
                LEFT JOIN job_vessel jv ON a.INSPNO = jv.INSPNO
                LEFT JOIN sow_insp si ON a.INSPNO = si.INSPNO AND a.STR_ID = si.STR_ID
                WHERE a.STR_ID = :strId
                ORDER BY w.ISTART ASC`
        },
        // 2nd: Without sow_insp
        {
          label: "workpl + taskstr + job_vessel",
          sql: `SELECT DISTINCT a.INSPNO, w.JOBNAME, w.ISTART AS START_DATE, t.JOB_TYPE,
                  jv.V_NAME, jv.START_DATE AS VESSEL_START_DATE
                FROM allinspid a
                LEFT JOIN workpl w ON a.INSPNO = w.INSPNO
                LEFT JOIN TASKSTR t ON a.STR_ID = t.STR_ID AND a.INSPNO = t.INSPNO
                LEFT JOIN job_vessel jv ON a.INSPNO = jv.INSPNO
                WHERE a.STR_ID = :strId
                ORDER BY w.ISTART ASC`
        },
        // 3rd: Without job_vessel and sow_insp
        {
          label: "workpl + taskstr only",
          sql: `SELECT DISTINCT a.INSPNO, w.JOBNAME, w.ISTART AS START_DATE, t.JOB_TYPE
                FROM allinspid a
                LEFT JOIN workpl w ON a.INSPNO = w.INSPNO
                LEFT JOIN TASKSTR t ON a.STR_ID = t.STR_ID AND a.INSPNO = t.INSPNO
                WHERE a.STR_ID = :strId
                ORDER BY w.ISTART ASC`
        },
        // 4th: workpl only
        {
          label: "workpl only",
          sql: `SELECT DISTINCT a.INSPNO, w.JOBNAME, w.ISTART AS START_DATE
                FROM allinspid a
                LEFT JOIN workpl w ON a.INSPNO = w.INSPNO
                WHERE a.STR_ID = :strId
                ORDER BY w.ISTART ASC`
        }
      ];
      
      for (const q of jobpackQueries) {
        try {
          const result = await connection.execute(q.sql, { strId: str_id });
          jobpacks = result.rows || [];
          console.log(`Jobpacks query succeeded with: ${q.label}`);
          break;
        } catch (err: any) {
          console.warn(`Jobpacks query failed with ${q.label}: ${err.message}. Trying next fallback...`);
        }
      }

      // Query allinspid for INSP_TYPE counts to determine ROV/Diving inspection data presence
      let typeCounts = [];
      try {
        const typeResult = await connection.execute(
          `SELECT INSPNO, INSP_TYPE, COUNT(*) as REC_COUNT 
           FROM allinspid 
           WHERE STR_ID = :strId AND COMP_ID > 0 
           GROUP BY INSPNO, INSP_TYPE`,
          { strId: str_id }
        );
        typeCounts = typeResult.rows || [];
        
        // If query succeeded but returned 0 rows or only rows with empty/null INSP_TYPE,
        // trigger the fallback to try INSPTYPE column.
        const hasValidTypes = typeCounts.some((row: any) => {
          const code = row.INSP_TYPE || row.insp_type || "";
          return String(code).trim() !== "";
        });
        
        if (typeCounts.length === 0 || !hasValidTypes) {
          throw new Error("INSP_TYPE returned no records or only empty values. Trying INSPTYPE fallback.");
        }
      } catch (countErr: any) {
        console.warn("Oracle query with INSP_TYPE failed, trying fallback with INSPTYPE:", countErr.message);
        try {
          const typeResult = await connection.execute(
            `SELECT INSPNO, INSPTYPE AS INSP_TYPE, COUNT(*) as REC_COUNT 
             FROM allinspid 
             WHERE STR_ID = :strId AND COMP_ID > 0 
             GROUP BY INSPNO, INSPTYPE`,
            { strId: str_id }
          );
          typeCounts = typeResult.rows || [];
        } catch (countFallbackErr: any) {
          console.error("Failed to query INSP_TYPE/INSPTYPE from allinspid:", countFallbackErr.message);
        }
      }

      // Process counts in-memory to match ROV & Diving criteria
      const inspnoDataMap: Record<string, { rovCount: number; divingCounts: Record<string, number> }> = {};
      
      for (const row of typeCounts) {
        const inspno = String(row.INSPNO || row.inspno || "");
        const rawType = String(row.INSP_TYPE || row.insp_type || "");
        const inspType = rawType.toUpperCase().trim();
        const count = Number(row.REC_COUNT || row.rec_count || 0);

        if (!inspno) continue;

        if (!inspnoDataMap[inspno]) {
          inspnoDataMap[inspno] = { rovCount: 0, divingCounts: {} };
        }

        // ROV logic: insp_type = 'PLATGI' or 'NAVIG'
        if (inspType === 'PLATGI' || inspType === 'NAVIG') {
          inspnoDataMap[inspno].rovCount += count;
        }

        // Diving logic: insp_type not in ('PLATGI','NAVIG','LOGS','EXSUM') and is not empty
        if (inspType && !['PLATGI', 'NAVIG', 'LOGS', 'EXSUM'].includes(inspType)) {
          inspnoDataMap[inspno].divingCounts[inspType] = (inspnoDataMap[inspno].divingCounts[inspType] || 0) + count;
        }
      }

      // Helper to format Date objects or string dates as local YYYY-MM-DD
      const formatLocalDateOnly = (dateVal: any): string | null => {
        if (!dateVal) return null;
        if (dateVal instanceof Date) {
          const yyyy = dateVal.getFullYear();
          const mm = String(dateVal.getMonth() + 1).padStart(2, '0');
          const dd = String(dateVal.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        }
        const str = String(dateVal).trim();
        if (!str) return null;
        
        // If already in YYYY-MM-DD format
        const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (isoMatch) {
          return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
        }
        
        const parsed = Date.parse(str);
        if (isNaN(parsed)) return str;
        const d = new Date(parsed);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      // Enrich jobpacks with HAS_ROV and HAS_DIVING flags
      const enrichedJobpacks = jobpacks.map((jp: any) => {
        const inspno = String(jp.INSPNO || jp.inspno || "");
        const data = inspnoDataMap[inspno] || { rovCount: 0, divingCounts: {} };

        // ROV rule: platform general visual or navigation has more than 1 record
        const hasRov = data.rovCount > 1;

        // Diving rule: any other inspection type (excluding 4 ignored ones) has more than 1 record
        const hasDiving = Object.values(data.divingCounts).some(count => count > 1);

        const rawStartDate = jp.START_DATE || jp.start_date || jp.ISTART || jp.istart;
        const rawVesselStartDate = jp.VESSEL_START_DATE || jp.vessel_start_date;

        return {
          ...jp,
          START_DATE: formatLocalDateOnly(rawStartDate),
          VESSEL_START_DATE: formatLocalDateOnly(rawVesselStartDate),
          HAS_ROV: hasRov,
          HAS_DIVING: hasDiving
        };
      });
      // Deduplicate enrichedJobpacks by INSPNO to ensure no duplicate jobpacks are returned in the UI
      const uniqueJobpacks: any[] = [];
      const seenInspNos = new Set<string>();
      for (const jp of enrichedJobpacks) {
        const inspno = String(jp.INSPNO || jp.inspno || "").trim();
        if (inspno && !seenInspNos.has(inspno)) {
          seenInspNos.add(inspno);
          uniqueJobpacks.push(jp);
        }
      }

      return NextResponse.json({ 
        success: true, 
        data: uniqueJobpacks
      });

    } catch (error: any) {
      console.error(`[Oracle Fetch Jobpacks Error for str_id]:`, error);
      return NextResponse.json({ 
        error: "Failed to fetch jobpacks from Oracle database", 
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
