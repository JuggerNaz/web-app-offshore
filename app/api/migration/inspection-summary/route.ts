import { NextRequest, NextResponse } from "next/server";
import { getOracleConnection, OracleConnectionConfig } from "@/utils/oracle-db";
import { withAuth } from "@/utils/with-auth";

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

      return NextResponse.json({
        success: true,
        data: {
          rovInspections,
          divingInspections,
          logsCount,
          platgVideoCount,
          videoCount
        }
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
