import { NextRequest, NextResponse } from "next/server";
import { getOracleConnection, OracleConnectionConfig } from "@/utils/oracle-db";
import { withAuth } from "@/utils/with-auth";
import { createClient, createAdminClient } from "@/utils/supabase/server";

/**
 * POST /api/migration/summary/[str_id]
 * Fetches the component summary for a given structure ID.
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

      const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabase = useAdmin ? createAdminClient() : createClient();

      connection = await getOracleConnection(config);
      
      // Fetch summary from allcompid view joined with comp_type to get description/full name
      let summary: any[] = [];
      try {
        const result = await connection.execute(
          `SELECT c.STR_ID, c.CODE, t.DESCRIP as NAME, COUNT(*) as ROW_COUNT 
           FROM allcompid c
           LEFT JOIN comp_type t ON c.CODE = t.CODE
           WHERE c.STR_ID = :strId 
             AND NOT (NVL(c.DEL, 0) = 1 AND NOT EXISTS (
               SELECT 1 FROM allinspid i WHERE i.COMP_ID = c.COMP_ID AND i.STR_ID = c.STR_ID
             ))
           GROUP BY c.STR_ID, c.CODE, t.DESCRIP 
           ORDER BY c.CODE ASC`,
          { strId: str_id }
        );
        summary = result.rows || [];
      } catch (err: any) {
        console.warn("Joined summary query failed, trying fallback without comp_type join:", err.message);
        const result = await connection.execute(
          `SELECT STR_ID, CODE, COUNT(*) as ROW_COUNT 
           FROM allcompid 
           WHERE STR_ID = :strId 
             AND NOT (NVL(DEL, 0) = 1 AND NOT EXISTS (
               SELECT 1 FROM allinspid i WHERE i.COMP_ID = allcompid.COMP_ID AND i.STR_ID = allcompid.STR_ID
             ))
           GROUP BY STR_ID, CODE 
           ORDER BY CODE ASC`,
          { strId: str_id }
        );
        summary = result.rows || [];
      }

      // Fetch library counts from Oracle U_LIB_MAST, U_LIB_LIST, U_LIB_COMBO
      let mastCount = 0;
      let listCount = 0;
      let comboCount = 0;
      try {
        const rMast = await connection.execute(`SELECT COUNT(DISTINCT TRIM(LIB_CODE)) as CNT FROM U_LIB_MAST`);
        mastCount = rMast.rows?.[0]?.CNT || rMast.rows?.[0]?.[0] || 0;
      } catch (e: any) {
        console.warn("Failed to fetch U_LIB_MAST count:", e.message);
      }
      try {
        const rList = await connection.execute(`SELECT COUNT(DISTINCT TRIM(LIB_CODE) || '::' || TRIM(LIB_ID)) as CNT FROM U_LIB_LIST`);
        listCount = rList.rows?.[0]?.CNT || rList.rows?.[0]?.[0] || 0;
      } catch (e: any) {
        console.warn("Failed to fetch U_LIB_LIST count:", e.message);
      }
      try {
        const rCombo = await connection.execute(`SELECT COUNT(DISTINCT TRIM(LIB_CODE) || '::' || TRIM(CODE_1) || '::' || TRIM(CODE_2)) as CNT FROM U_LIB_COMBO`);
        comboCount = rCombo.rows?.[0]?.CNT || rCombo.rows?.[0]?.[0] || 0;
      } catch (e: any) {
        console.warn("Failed to fetch U_LIB_COMBO count:", e.message);
      }

      // Fetch existing Postgres Library Counts
      let pgMastCount = 0;
      let pgListCount = 0;
      let pgComboCount = 0;
      try {
        const { count } = await supabase.from('u_lib_mast').select('*', { count: 'exact', head: true });
        pgMastCount = count || 0;
      } catch (e) {}
      try {
        const { count } = await supabase.from('u_lib_list').select('*', { count: 'exact', head: true });
        pgListCount = count || 0;
      } catch (e) {}
      try {
        const { count } = await supabase.from('u_lib_combo').select('*', { count: 'exact', head: true });
        pgComboCount = count || 0;
      } catch (e) {}

      // Fetch Oracle counts for System Framework
      let strCount = 0;
      let elvCount = 0;
      let levelCount = 0;
      let facesCount = 0;
      let assocCount = 0;

      try {
        const rStr = await connection.execute(`SELECT COUNT(*) as CNT FROM v_structure WHERE STR_ID = :strId`, { strId: str_id });
        strCount = rStr.rows?.[0]?.CNT || rStr.rows?.[0]?.[0] || 0;
      } catch (e) {}
      try {
        const rElv = await connection.execute(`SELECT COUNT(*) as CNT FROM STR_ELV WHERE PLAT_ID = :strId`, { strId: str_id });
        elvCount = rElv.rows?.[0]?.CNT || rElv.rows?.[0]?.[0] || 0;
      } catch (e) {}
      try {
        const rLvl = await connection.execute(`SELECT COUNT(*) as CNT FROM STR_LEVEL WHERE PLAT_ID = :strId`, { strId: str_id });
        levelCount = rLvl.rows?.[0]?.CNT || rLvl.rows?.[0]?.[0] || 0;
      } catch (e) {}
      try {
        const rFcs = await connection.execute(`SELECT COUNT(*) as CNT FROM STR_FACES WHERE PLAT_ID = :strId`, { strId: str_id });
        facesCount = rFcs.rows?.[0]?.CNT || rFcs.rows?.[0]?.[0] || 0;
      } catch (e) {}
      try {
        const rAsc = await connection.execute(
          `SELECT COUNT(*) as CNT FROM U_ASSOC a 
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
        assocCount = rAsc.rows?.[0]?.CNT || rAsc.rows?.[0]?.[0] || 0;
      } catch (e) {}

      // Fetch existing Postgres System Framework Counts
      let pgStrCount = 0;
      let pgElvCount = 0;
      let pgLevelCount = 0;
      let pgFacesCount = 0;
      let pgAssocCount = 0;

      try {
        // Query both platform and u_pipeline
        const { count: platCnt } = await supabase.from('platform').select('*', { count: 'exact', head: true }).eq('plat_id', Number(str_id));
        const { count: pipeCnt } = await supabase.from('u_pipeline').select('*', { count: 'exact', head: true }).eq('pipe_id', Number(str_id));
        pgStrCount = (platCnt || 0) + (pipeCnt || 0);
      } catch (e) {}
      try {
        const { count } = await supabase.from('str_elv').select('*', { count: 'exact', head: true }).eq('plat_id', Number(str_id));
        pgElvCount = count || 0;
      } catch (e) {}
      try {
        const { count } = await supabase.from('str_level').select('*', { count: 'exact', head: true }).eq('plat_id', Number(str_id));
        pgLevelCount = count || 0;
      } catch (e) {}
      try {
        const { count } = await supabase.from('str_faces').select('*', { count: 'exact', head: true }).eq('plat_id', Number(str_id));
        pgFacesCount = count || 0;
      } catch (e) {}
      try {
        const { count } = await supabase.from('structure_components').select('*', { count: 'exact', head: true })
          .eq('structure_id', Number(str_id))
          .not('metadata->associated_comp_id', 'is', null);
        pgAssocCount = count || 0;
      } catch (e) {}

      // Fetch existing Postgres Component counts mapped by Code
      const pgComponentCounts: Record<string, number> = {};
      try {
        const { data: pgComps } = await supabase.from('structure_components')
          .select('code')
          .eq('structure_id', Number(str_id));
        
        if (pgComps) {
          pgComps.forEach((c: any) => {
            if (c.code) {
              const codeUpper = String(c.code).toUpperCase().trim();
              pgComponentCounts[codeUpper] = (pgComponentCounts[codeUpper] || 0) + 1;
            }
          });
        }
      } catch (e) {}

      // Fetch U_COMPANY details from Oracle
      let companyDetails: any = null;
      try {
        const rComp = await connection.execute(`SELECT COMP_NAME, DEPART_NAME, ICONFILE, SERIAL_NO, VERSION FROM U_COMPANY WHERE ROWNUM <= 1`);
        if (rComp.rows && rComp.rows.length > 0) {
          const row: any = rComp.rows[0];
          companyDetails = {
            comp_name: row.COMP_NAME || row[0] || "",
            depart_name: row.DEPART_NAME || row[1] || "",
            iconfile: row.ICONFILE || row[2] || "",
            serial_no: row.SERIAL_NO || row[3] || "",
            version: row.VERSION || row[4] || ""
          };
        }
      } catch (e: any) {
        console.warn("Failed to fetch U_COMPANY details:", e.message);
      }

      // Fetch PREFERENCE details from Oracle
      let preferenceDetails: any = null;
      try {
        const rPref = await connection.execute(
          `SELECT DEF_UNIT, DEF_FP, DEF_FPUNIT, DEF_X, DEF_Y, DEF_DATE, WORKUNIT, DEF_FPFORMAT, DEF_XYUNIT, APPL_MODE, MGROW_PROFILE, DEF_DEPTUNIT 
           FROM PREFERENCE WHERE ROWNUM <= 1`
        );
        if (rPref.rows && rPref.rows.length > 0) {
          const row: any = rPref.rows[0];
          preferenceDetails = {
            def_unit: row.DEF_UNIT || row[0] || "",
            def_fp: row.DEF_FP || row[1] || "",
            def_fpunit: row.DEF_FPUNIT || row[2] || "",
            def_x: row.DEF_X || row[3] || "",
            def_y: row.DEF_Y || row[4] || "",
            def_date: row.DEF_DATE || row[5] || "",
            workunit: row.WORKUNIT || row[6] || "",
            def_fpformat: row.DEF_FPFORMAT || row[7] || "",
            def_xyunit: row.DEF_XYUNIT || row[8] || "",
            appl_mode: row.APPL_MODE || row[9] || "",
            mgrow_profile: row.MGROW_PROFILE || row[10] || "",
            def_deptunit: row.DEF_DEPTUNIT || row[11] || ""
          };
        }
      } catch (e: any) {
        console.warn("Failed to fetch PREFERENCE details:", e.message);
      }

      // Append Postgres counts to component summary list
      const summaryWithPg = summary.map((row: any) => {
        const rowObj = typeof row === 'object' && row !== null ? row : {};
        const codeVal = String(rowObj.CODE || rowObj[1] || "").toUpperCase().trim();
        const rowCount = Number(rowObj.ROW_COUNT || rowObj[3] || 0);
        return {
          STR_ID: rowObj.STR_ID || rowObj[0],
          CODE: codeVal,
          NAME: rowObj.NAME || rowObj[2],
          ROW_COUNT: rowCount,
          PG_ROW_COUNT: pgComponentCounts[codeVal] || 0
        };
      });

      return NextResponse.json({ 
        success: true, 
        data: summaryWithPg,
        company: companyDetails,
        preference: preferenceDetails,
        libraries: [
          { code: "U_LIB_MAST", name: "Master Library (u_lib_mast)", row_count: Number(mastCount), pg_row_count: pgMastCount },
          { code: "U_LIB_LIST", name: "Library List (u_lib_list)", row_count: Number(listCount), pg_row_count: pgListCount },
          { code: "U_LIB_COMBO", name: "Library Combo (u_lib_combo)", row_count: Number(comboCount), pg_row_count: pgComboCount }
        ],
        framework: [
          { code: "STRUCTURE", name: "Structure Master", row_count: Number(strCount), pg_row_count: pgStrCount },
          { code: "STR_ELV", name: "Structural Elevations", row_count: Number(elvCount), pg_row_count: pgElvCount },
          { code: "STR_LEVEL", name: "Structural Levels", row_count: Number(levelCount), pg_row_count: pgLevelCount },
          { code: "STR_FACES", name: "Structural Faces", row_count: Number(facesCount), pg_row_count: pgFacesCount },
          { code: "U_ASSOC", name: "Hierarchy Associations", row_count: Number(assocCount), pg_row_count: pgAssocCount }
        ]
      });

    } catch (error: any) {
      console.error(`[Oracle Fetch Summary Error for str_id]:`, error);
      return NextResponse.json({ 
        error: "Failed to fetch component summary from Oracle database", 
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

