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
      try {
        // Try left joining TASKSTR to get JOB_TYPE (Select a.INSPNO for ROV/Diving lookup)
        const result = await connection.execute(
          `SELECT DISTINCT a.INSPNO, w.JOBNAME, w.ISTART AS START_DATE, t.JOB_TYPE 
           FROM allinspid a 
           JOIN workpl w ON a.INSPNO = w.INSPNO 
           LEFT JOIN TASKSTR t ON a.STR_ID = t.STR_ID AND a.INSPNO = t.INSPNO 
           WHERE a.STR_ID = :strId 
           ORDER BY w.ISTART ASC`,
          { strId: str_id }
        );
        jobpacks = result.rows || [];
      } catch (err: any) {
        console.warn("Oracle query with t.JOB_TYPE failed, trying fallback with t.JOBTYPE:", err.message);
        try {
          const result = await connection.execute(
            `SELECT DISTINCT a.INSPNO, w.JOBNAME, w.ISTART AS START_DATE, t.JOBTYPE AS JOB_TYPE 
             FROM allinspid a 
             JOIN workpl w ON a.INSPNO = w.INSPNO 
             LEFT JOIN TASKSTR t ON a.STR_ID = t.STR_ID AND a.INSPNO = t.INSPNO 
             WHERE a.STR_ID = :strId 
             ORDER BY w.ISTART ASC`,
            { strId: str_id }
          );
          jobpacks = result.rows || [];
        } catch (fallbackErr: any) {
          console.warn("Oracle query with t.JOBTYPE also failed, trying fallback without TASKSTR join:", fallbackErr.message);
          const result = await connection.execute(
            `SELECT DISTINCT a.INSPNO, w.JOBNAME, w.ISTART AS START_DATE 
             FROM allinspid a 
             JOIN workpl w ON a.INSPNO = w.INSPNO 
             WHERE a.STR_ID = :strId 
             ORDER BY w.ISTART ASC`,
            { strId: str_id }
          );
          jobpacks = result.rows || [];
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

      // Enrich jobpacks with HAS_ROV and HAS_DIVING flags
      const enrichedJobpacks = jobpacks.map((jp: any) => {
        const inspno = String(jp.INSPNO || jp.inspno || "");
        const data = inspnoDataMap[inspno] || { rovCount: 0, divingCounts: {} };

        // ROV rule: platform general visual or navigation has more than 1 record
        const hasRov = data.rovCount > 1;

        // Diving rule: any other inspection type (excluding 4 ignored ones) has more than 1 record
        const hasDiving = Object.values(data.divingCounts).some(count => count > 1);

        return {
          ...jp,
          HAS_ROV: hasRov,
          HAS_DIVING: hasDiving
        };
      });

      return NextResponse.json({ 
        success: true, 
        data: enrichedJobpacks
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
