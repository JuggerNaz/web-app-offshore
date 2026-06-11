import { NextRequest, NextResponse } from "next/server";
import { getOracleConnection, OracleConnectionConfig } from "@/utils/oracle-db";
import { withAuth } from "@/utils/with-auth";
import { createClient, createAdminClient } from "@/utils/supabase/server";

/**
 * POST /api/migration/inspection-summary
 * Fetches Phase 2 inspection summary data based on the selected jobpack's str_id and inspno.
 */
export const POST = withAuth(
  async (request: NextRequest) => {
    let connection;
    try {
      const { config, str_id, inspno, structureType } = await request.json();

      // Basic parameter verification
      if (!config || ((!config.connectString && (!config.host || !config.serviceName)) || !config.user || !config.password)) {
        return NextResponse.json({ error: "Missing required database connection parameters" }, { status: 400 });
      }

      if (!str_id || !inspno) {
        return NextResponse.json({ error: "Missing required str_id or inspno parameters" }, { status: 400 });
      }

      const structType = structureType || "PLATFORM";

      const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabase = useAdmin ? createAdminClient() : createClient();

      connection = await getOracleConnection(config);

      let rovInspections = [];
      let divingInspections = [];

      if (structType === "PLATFORM") {
        // 1. ROV platform inspections reside in the PLATGI table, grouped by subcode (INSP_SCODE)
        // Subcodes are matched to human-readable names via insptype_sub table.
        try {
          const result = await connection.execute(
            `SELECT TRIM(p.INSP_SCODE) AS CODE, TRIM(s.FULLNAME) AS FULL_NAME, COUNT(*) AS REC_COUNT 
             FROM PLATGI p 
             LEFT JOIN insptype_sub s ON TRIM(p.INSP_SCODE) = TRIM(s.SCODE) 
             WHERE p.STR_ID = :strId AND p.INSPNO = :inspNo AND p.COMP_ID > 0 
             GROUP BY p.INSP_SCODE, s.FULLNAME 
             ORDER BY p.INSP_SCODE`,
            { strId: str_id, inspNo: String(inspno) }
          );
          rovInspections = (result.rows || []).map((row: any) => ({
            code: row.CODE || row.code || "",
            name: row.FULL_NAME || row.full_name || row.CODE || row.code || "ROV Platform Inspection",
            count: Number(row.REC_COUNT || row.rec_count || 0)
          }));
        } catch (err: any) {
          console.warn("PLATGI query with s.FULLNAME failed, trying fallback with s.NAME:", err.message);
          try {
            const result = await connection.execute(
              `SELECT TRIM(p.INSP_SCODE) AS CODE, TRIM(s.NAME) AS FULL_NAME, COUNT(*) AS REC_COUNT 
               FROM PLATGI p 
               LEFT JOIN insptype_sub s ON TRIM(p.INSP_SCODE) = TRIM(s.SCODE) 
               WHERE p.STR_ID = :strId AND p.INSPNO = :inspNo AND p.COMP_ID > 0 
               GROUP BY p.INSP_SCODE, s.NAME 
               ORDER BY p.INSP_SCODE`,
              { strId: str_id, inspNo: String(inspno) }
            );
            rovInspections = (result.rows || []).map((row: any) => ({
              code: row.CODE || row.code || "",
              name: row.FULL_NAME || row.full_name || row.CODE || row.code || "ROV Platform Inspection",
              count: Number(row.REC_COUNT || row.rec_count || 0)
            }));
          } catch (err2: any) {
            console.warn("PLATGI query with s.NAME also failed, running fallback without join:", err2.message);
            try {
              const result = await connection.execute(
                `SELECT TRIM(INSP_SCODE) AS CODE, COUNT(*) AS REC_COUNT 
                 FROM PLATGI 
                 WHERE STR_ID = :strId AND INSPNO = :inspNo AND COMP_ID > 0 
                 GROUP BY INSP_SCODE 
                 ORDER BY INSP_SCODE`,
                { strId: str_id, inspNo: String(inspno) }
              );
              rovInspections = (result.rows || []).map((row: any) => ({
                code: row.CODE || row.code || "",
                name: `ROV Platform Sub-Type ${row.CODE || row.code || ""}`,
                count: Number(row.REC_COUNT || row.rec_count || 0)
              }));
            } catch (err3: any) {
              console.error("All fallback queries for PLATGI table failed:", err3.message);
            }
          }
        }
        // 2. Diving platform inspections: any other inspection type (excluding PLATGI, NAVIG, LOGS, EXSUM) from allinspid
        try {
          const result = await connection.execute(
            `SELECT TRIM(a.INSP_TYPE) AS CODE, TRIM(t.NAME) AS FULL_NAME, COUNT(*) AS REC_COUNT 
             FROM allinspid a 
             LEFT JOIN insptype t ON TRIM(a.INSP_TYPE) = TRIM(t.CODE) 
             WHERE a.STR_ID = :strId AND a.INSPNO = :inspNo AND TRIM(UPPER(a.INSP_TYPE)) NOT IN ('PLATGI', 'NAVIG', 'LOGS', 'EXSUM') 
             GROUP BY a.INSP_TYPE, t.NAME 
             ORDER BY a.INSP_TYPE`,
            { strId: str_id, inspNo: String(inspno) }
          );
          divingInspections = (result.rows || []).map((row: any) => ({
            code: row.CODE || row.code || "",
            name: row.FULL_NAME || row.full_name || row.CODE || row.code || "Diving Platform Inspection",
            count: Number(row.REC_COUNT || row.rec_count || 0)
          }));
        } catch (err: any) {
          console.warn("Diving inspections query with t.NAME failed, trying fallback with t.DESCRIP:", err.message);
          try {
            const result = await connection.execute(
              `SELECT TRIM(a.INSP_TYPE) AS CODE, TRIM(t.DESCRIP) AS FULL_NAME, COUNT(*) AS REC_COUNT 
               FROM allinspid a 
               LEFT JOIN insptype t ON TRIM(a.INSP_TYPE) = TRIM(t.CODE) 
               WHERE a.STR_ID = :strId AND a.INSPNO = :inspNo AND TRIM(UPPER(a.INSP_TYPE)) NOT IN ('PLATGI', 'NAVIG', 'LOGS', 'EXSUM') 
               GROUP BY a.INSP_TYPE, t.DESCRIP 
               ORDER BY a.INSP_TYPE`,
              { strId: str_id, inspNo: String(inspno) }
            );
            divingInspections = (result.rows || []).map((row: any) => ({
              code: row.CODE || row.code || "",
              name: row.FULL_NAME || row.full_name || row.CODE || row.code || "Diving Platform Inspection",
              count: Number(row.REC_COUNT || row.rec_count || 0)
            }));
          } catch (err2: any) {
            console.warn("Diving inspections query with t.DESCRIP failed, trying fallback without join:", err2.message);
            try {
              const result = await connection.execute(
                `SELECT TRIM(a.INSP_TYPE) AS CODE, COUNT(*) AS REC_COUNT 
                 FROM allinspid a 
                 WHERE a.STR_ID = :strId AND a.INSPNO = :inspNo AND TRIM(UPPER(a.INSP_TYPE)) NOT IN ('PLATGI', 'NAVIG', 'LOGS', 'EXSUM') 
                 GROUP BY a.INSP_TYPE 
                 ORDER BY a.INSP_TYPE`,
                { strId: str_id, inspNo: String(inspno) }
              );
              divingInspections = (result.rows || []).map((row: any) => ({
                code: row.CODE || row.code || "",
                name: `Diving Platform Type ${row.CODE || row.code || ""}`,
                count: Number(row.REC_COUNT || row.rec_count || 0)
              }));
            } catch (err3: any) {
              console.error("All fallback queries for diving platform inspections failed:", err3.message);
            }
          }
        }
      } else {
        // PIPELINE Structure
        // 1. NAVIG is ROV for Pipeline structures.
        // 2. All other codes except PLATGI, NAVIG, LOGS, EXSUM are Diving.
        try {
          const result = await connection.execute(
            `SELECT TRIM(a.INSP_TYPE) AS CODE, TRIM(t.NAME) AS FULL_NAME, COUNT(*) AS REC_COUNT 
             FROM allinspid a 
             LEFT JOIN insptype t ON TRIM(a.INSP_TYPE) = TRIM(t.CODE) 
             WHERE a.STR_ID = :strId AND a.INSPNO = :inspNo 
             GROUP BY a.INSP_TYPE, t.NAME 
             ORDER BY a.INSP_TYPE`,
            { strId: str_id, inspNo: String(inspno) }
          );
          const rows = result.rows || [];
          for (const row of rows) {
            const code = row.CODE || row.code || "";
            const name = row.FULL_NAME || row.full_name || code || "Pipeline Inspection";
            const count = Number(row.REC_COUNT || row.rec_count || 0);
            const upperCode = code.toUpperCase().trim();
            
            if (upperCode === 'NAVIG') {
              rovInspections.push({ code, name, count });
            } else if (!['PLATGI', 'NAVIG', 'LOGS', 'EXSUM'].includes(upperCode)) {
              divingInspections.push({ code, name, count });
            }
          }
        } catch (err: any) {
          console.warn("Pipeline allinspid query with t.NAME failed, trying fallback with t.DESCRIP:", err.message);
          try {
            const result = await connection.execute(
              `SELECT TRIM(a.INSP_TYPE) AS CODE, TRIM(t.DESCRIP) AS FULL_NAME, COUNT(*) AS REC_COUNT 
               FROM allinspid a 
               LEFT JOIN insptype t ON TRIM(a.INSP_TYPE) = TRIM(t.CODE) 
               WHERE a.STR_ID = :strId AND a.INSPNO = :inspNo 
               GROUP BY a.INSP_TYPE, t.DESCRIP 
               ORDER BY a.INSP_TYPE`,
              { strId: str_id, inspNo: String(inspno) }
            );
            const rows = result.rows || [];
            for (const row of rows) {
              const code = row.CODE || row.code || "";
              const name = row.FULL_NAME || row.full_name || code || "Pipeline Inspection";
              const count = Number(row.REC_COUNT || row.rec_count || 0);
              const upperCode = code.toUpperCase().trim();
              
              if (upperCode === 'NAVIG') {
                rovInspections.push({ code, name, count });
              } else if (!['PLATGI', 'NAVIG', 'LOGS', 'EXSUM'].includes(upperCode)) {
                divingInspections.push({ code, name, count });
              }
            }
          } catch (err2: any) {
            console.warn("Pipeline allinspid query with t.DESCRIP failed, trying fallback without join:", err2.message);
            try {
              const result = await connection.execute(
                `SELECT TRIM(a.INSP_TYPE) AS CODE, COUNT(*) AS REC_COUNT 
                 FROM allinspid a 
                 WHERE a.STR_ID = :strId AND a.INSPNO = :inspNo 
                 GROUP BY a.INSP_TYPE 
                 ORDER BY a.INSP_TYPE`,
                { strId: str_id, inspNo: String(inspno) }
              );
              const rows = result.rows || [];
              for (const row of rows) {
                const code = row.CODE || row.code || "";
                const name = `Pipeline Type ${code}`;
                const count = Number(row.REC_COUNT || row.rec_count || 0);
                const upperCode = code.toUpperCase().trim();
                
                if (upperCode === 'NAVIG') {
                  rovInspections.push({ code, name, count });
                } else if (!['PLATGI', 'NAVIG', 'LOGS', 'EXSUM'].includes(upperCode)) {
                  divingInspections.push({ code, name, count });
                }
              }
            } catch (err3: any) {
              console.error("All fallback queries for pipeline inspections failed:", err3.message);
            }
          }
        }
      }

      // 3. Query Diver logs (LOGS table counts)
      let logsCount = 0;
      try {
        const result = await connection.execute(
          `SELECT COUNT(*) AS REC_COUNT FROM LOGS WHERE STR_ID = :strId AND INSPNO = :inspNo`,
          { strId: str_id, inspNo: String(inspno) }
        );
        const rows = result.rows || [];
        if (rows.length > 0) {
          logsCount = Number(rows[0].REC_COUNT || rows[0].rec_count || Object.values(rows[0])[0] || 0);
        }
      } catch (err: any) {
        console.warn("Query LOGS count failed:", err.message);
      }

      // 4. Query ROV Video log (PLATG/PLATGI table counts)
      let platgVideoCount = 0;
      try {
        const result = await connection.execute(
          `SELECT COUNT(*) AS REC_COUNT FROM PLATG WHERE STR_ID = :strId AND INSPNO = :inspNo`,
          { strId: str_id, inspNo: String(inspno) }
        );
        const rows = result.rows || [];
        if (rows.length > 0) {
          platgVideoCount = Number(rows[0].REC_COUNT || rows[0].rec_count || Object.values(rows[0])[0] || 0);
        }
      } catch (err: any) {
        console.warn("Query PLATG video count failed, trying fallback with PLATGI:", err.message);
        try {
          const result = await connection.execute(
            `SELECT COUNT(*) AS REC_COUNT FROM PLATGI WHERE STR_ID = :strId AND INSPNO = :inspNo AND COMP_ID > 0`,
            { strId: str_id, inspNo: String(inspno) }
          );
          const rows = result.rows || [];
          if (rows.length > 0) {
            platgVideoCount = Number(rows[0].REC_COUNT || rows[0].rec_count || Object.values(rows[0])[0] || 0);
          }
        } catch (err2: any) {
          console.warn("Query PLATGI count failed:", err2.message);
        }
      }

      // 5. Query Diving Video log (video table counts)
      let videoCount = 0;
      try {
        const result = await connection.execute(
          `SELECT COUNT(*) AS REC_COUNT FROM video WHERE STR_ID = :strId AND INSPNO = :inspNo`,
          { strId: str_id, inspNo: String(inspno) }
        );
        const rows = result.rows || [];
        if (rows.length > 0) {
          videoCount = Number(rows[0].REC_COUNT || rows[0].rec_count || Object.values(rows[0])[0] || 0);
        }
      } catch (err: any) {
        console.warn("Query video count failed:", err.message);
      }

      // Query Oracle counts for additional SOW, Anomalies and attachments
      let sowCount = 0;
      let anomalyCount = 0;
      let compAttachCount = 0;
      let inspAttachCount = 0;

      try {
        const result = await connection.execute(
          `SELECT COUNT(*) AS CNT FROM U_SOW WHERE INSPNO = :inspNo`,
          { inspNo: String(inspno) }
        );
        sowCount = result.rows?.[0]?.CNT || result.rows?.[0]?.[0] || 0;
      } catch (e) {}

      try {
        const result = await connection.execute(
          `SELECT COUNT(*) AS CNT FROM u_defect WHERE STR_ID = :strId AND INSP_ID IN (
             SELECT INSP_ID FROM PLATGI WHERE STR_ID = :strId AND INSPNO = :inspNo AND INSP_ID IS NOT NULL
             UNION
             SELECT INSP_ID FROM allinspid WHERE STR_ID = :strId AND INSPNO = :inspNo AND INSP_ID IS NOT NULL
           )`,
          { strId: str_id, inspNo: String(inspno) }
        );
        anomalyCount = result.rows?.[0]?.CNT || result.rows?.[0]?.[0] || 0;
      } catch (e) {}

      let compNotInspCount = 0;
      try {
        const result = await connection.execute(
          `SELECT COUNT(*) AS CNT FROM COMP_NOT_INSP WHERE INSP_ID IN (
             SELECT INSP_ID FROM PLATGI WHERE STR_ID = :strId AND INSPNO = :inspNo AND INSP_ID IS NOT NULL
             UNION
             SELECT INSP_ID FROM allinspid WHERE STR_ID = :strId AND INSPNO = :inspNo AND INSP_ID IS NOT NULL
           )`,
          { strId: str_id, inspNo: String(inspno) }
        );
        compNotInspCount = result.rows?.[0]?.CNT || result.rows?.[0]?.[0] || 0;
      } catch (e) {}

      try {
        // component attachments (where COMP_ID is not null and INSPNO is null)
        const result = await connection.execute(
          `SELECT COUNT(*) AS CNT FROM U_ATTACH_1 WHERE STR_ID = :strId AND COMP_ID > 0 AND INSPNO IS NULL`,
          { strId: str_id }
        );
        compAttachCount = result.rows?.[0]?.CNT || result.rows?.[0]?.[0] || 0;
      } catch (e) {}

      try {
        // inspection attachments (where INSPNO matches)
        const result = await connection.execute(
          `SELECT COUNT(*) AS CNT FROM U_ATTACH_1 WHERE STR_ID = :strId AND INSPNO = :inspNo`,
          { strId: str_id, inspNo: String(inspno) }
        );
        inspAttachCount = result.rows?.[0]?.CNT || result.rows?.[0]?.[0] || 0;
      } catch (e) {}

      // Fetch existing Postgres inspection related counts
      let pgJobpackCount = 0;
      let pgSowCount = 0;
      let pgLogsJobsCount = 0;
      let pgLogsMovementsCount = 0;
      let pgVideoCount = 0;
      let pgInspRovCount = 0;
      let pgInspDivingCount = 0;
      let pgAnomalyCount = 0;
      let pgCompAttachCount = 0;
      let pgInspAttachCount = 0;
      let pgCompNotInspCount = 0;

      try {
        const { count } = await (supabase as any).from('jobpack').select('*', { count: 'exact', head: true }).eq('jobpack_id', Number(inspno));
        pgJobpackCount = count || 0;
      } catch (e) {}

      try {
        const { count } = await (supabase as any).from('u_sow').select('*', { count: 'exact', head: true }).eq('jobpack_id', Number(inspno));
        pgSowCount = count || 0;
      } catch (e) {}

      try {
        // Jobs count: sum of rov and dive jobs for this jobpack
        const { count: rovJobs } = await (supabase as any).from('insp_rov_jobs').select('*', { count: 'exact', head: true }).eq('jobpack_id', Number(inspno));
        const { count: diveJobs } = await (supabase as any).from('insp_dive_jobs').select('*', { count: 'exact', head: true }).eq('jobpack_id', Number(inspno));
        pgLogsJobsCount = (rovJobs || 0) + (diveJobs || 0);

        // Fetch parent job IDs to count movements
        const { data: rJobs } = await (supabase as any).from('insp_rov_jobs').select('id').eq('jobpack_id', Number(inspno));
        const { data: dJobs } = await (supabase as any).from('insp_dive_jobs').select('id').eq('jobpack_id', Number(inspno));
        
        const rovJobIds = rJobs?.map((j: any) => j.id) || [];
        const diveJobIds = dJobs?.map((j: any) => j.id) || [];

        let rovMovs = 0;
        let diveMovs = 0;

        if (rovJobIds.length > 0) {
          const { count } = await (supabase as any).from('insp_rov_movements').select('*', { count: 'exact', head: true }).in('rov_job_id', rovJobIds);
          rovMovs = count || 0;
        }
        if (diveJobIds.length > 0) {
          const { count } = await (supabase as any).from('insp_dive_movements').select('*', { count: 'exact', head: true }).in('dive_job_id', diveJobIds);
          diveMovs = count || 0;
        }
        pgLogsMovementsCount = rovMovs + diveMovs;
      } catch (e) {}

      try {
        const { count } = await (supabase as any).from('insp_video_tapes').select('*', { count: 'exact', head: true }).eq('jobpack_id', Number(inspno));
        pgVideoCount = count || 0;
      } catch (e) {}

      try {
        // Query pg inspection records count by type
        // ROV platform GI records in public.insp_video_logs or public.insp_records
        // Diver inspections in public.insp_records where type matches diving sub-types
        // Let's query public.insp_records directly for this jobpack!
        const { data: recs } = await (supabase as any).from('insp_records')
          .select('id, metadata')
          .eq('jobpack_id', Number(inspno));
        
        if (recs) {
          recs.forEach((r: any) => {
            const hasRovTag = r.metadata?.rov_operator || r.metadata?.deployment_no || r.metadata?.rov_supervisor;
            if (hasRovTag) {
              pgInspRovCount++;
            } else {
              pgInspDivingCount++;
            }
          });
        }
      } catch (e) {}

      try {
        const { count } = await (supabase as any).from('insp_anomalies').select('*', { count: 'exact', head: true })
          .eq('jobpack_id', Number(inspno));
        pgAnomalyCount = count || 0;
      } catch (e) {}

      try {
        // Query component attachments (source_type = 'component')
        // We can approximate by querying all component IDs for this structure
        const { data: pgComps } = await (supabase as any).from('structure_components').select('id').eq('structure_id', Number(str_id));
        const pgCompIds = pgComps?.map((c: any) => c.id) || [];
        if (pgCompIds.length > 0) {
          const { count } = await (supabase as any).from('attachment').select('*', { count: 'exact', head: true })
            .eq('source_type', 'component')
            .in('source_id', pgCompIds);
          pgCompAttachCount = count || 0;
        }
      } catch (e) {}

      try {
        // Query inspection attachments for records in this jobpack
        const { data: recs } = await (supabase as any).from('insp_records')
          .select('id')
          .eq('jobpack_id', Number(inspno));
        const recIds = recs?.map((r: any) => r.id) || [];
        if (recIds.length > 0) {
          const { count } = await (supabase as any).from('attachment').select('*', { count: 'exact', head: true })
            .eq('source_type', 'inspection_record')
            .in('source_id', recIds);
          pgInspAttachCount = count || 0;
        }
      } catch (e) {}

      try {
        const { count } = await (supabase as any).from('insp_records')
          .select('*', { count: 'exact', head: true })
          .eq('jobpack_id', Number(inspno))
          .eq('status', 'INCOMPLETE');
        pgCompNotInspCount = count || 0;
      } catch (e) {}

      // Calculate total Oracle counts
      const totalRovCount = rovInspections.reduce((sum: number, r: any) => sum + r.count, 0);
      const totalDivingCount = divingInspections.reduce((sum: number, r: any) => sum + r.count, 0);
      const totalJobsCount = logsCount + platgVideoCount; // approximate log entry triggers
      const totalMovementsCount = logsCount + platgVideoCount; // approximate logs

      return NextResponse.json({
        success: true,
        data: {
          rovInspections,
          divingInspections,
          logsCount,
          platgVideoCount,
          videoCount
        },
        jobs: [
          { code: "JOBPACK", name: "Job Pack Master (jobpack)", row_count: 1, pg_row_count: pgJobpackCount },
          { code: "U_SOW", name: "Scope of Work (u_sow)", row_count: Number(sowCount), pg_row_count: pgSowCount },
          { code: "LOGS_JOBS", name: "Job Logs (ROV/Diving Jobs)", row_count: Number(totalJobsCount), pg_row_count: pgLogsJobsCount },
          { code: "LOGS_MOVEMENTS", name: "Movement Logs (ROV/Diving)", row_count: Number(totalMovementsCount), pg_row_count: pgLogsMovementsCount },
          { code: "VIDEO", name: "Video Tapes (insp_video_tapes)", row_count: Number(videoCount), pg_row_count: pgVideoCount },
          { code: "INSP_ROV", name: "ROV Inspections (insp_records)", row_count: Number(totalRovCount), pg_row_count: pgInspRovCount },
          { code: "INSP_DIVING", name: "Diving Inspections (insp_records)", row_count: Number(totalDivingCount), pg_row_count: pgInspDivingCount },
          { code: "ANOMALY", name: "Anomalies (insp_anomalies)", row_count: Number(anomalyCount), pg_row_count: pgAnomalyCount },
          { code: "ATTACHMENT", name: "Component Attachments (attachment)", row_count: Number(compAttachCount), pg_row_count: pgCompAttachCount },
          { code: "INSP_ATTACHMENT", name: "Inspection Attachments (attachment)", row_count: Number(inspAttachCount), pg_row_count: pgInspAttachCount },
          { code: "COMP_NOT_INSP", name: "Incomplete Inspections (comp_not_insp)", row_count: Number(compNotInspCount), pg_row_count: pgCompNotInspCount }
        ]
      });

    } catch (error: any) {
      console.error(`[Oracle Inspection Summary Error]:`, error);
      return NextResponse.json({
        error: "Failed to fetch inspection summary from Oracle database",
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

