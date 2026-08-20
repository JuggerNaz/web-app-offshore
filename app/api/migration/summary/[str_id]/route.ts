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

      // Fetch library counts from Oracle U_LIB_MAST, U_LIB_LIST, U_LIB_COMBO, U_MGI_PROFILE
      let mastCount = 0;
      let listCount = 0;
      let comboCount = 0;
      let mgiProfileCount = 0;
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
      try {
        const rMgi = await connection.execute(`SELECT COUNT(*) as CNT FROM U_MGI_PROFILE`);
        mgiProfileCount = rMgi.rows?.[0]?.CNT || rMgi.rows?.[0]?.[0] || 0;
      } catch (e: any) {
        console.warn("Failed to fetch U_MGI_PROFILE count:", e.message);
      }

      // Fetch existing Postgres Library Counts
      let pgMastCount = 0;
      let pgListCount = 0;
      let pgComboCount = 0;
      let pgMgiProfileCount = 0;
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
      try {
        const { count } = await supabase.from('mgi_profiles').select('*', { count: 'exact', head: true });
        pgMgiProfileCount = count || 0;
      } catch (e) {}

      // Fetch Oracle counts for System Framework
      let strCount = 0;
      let elvCount = 0;
      let levelCount = 0;
      let facesCount = 0;
      let assocCount = 0;
      let pipeGeoCount = 0;

      try {
        const rStr = await connection.execute(`SELECT COUNT(*) as CNT FROM v_structure WHERE STR_ID = :strId`, { strId: str_id });
        strCount = rStr.rows?.[0]?.CNT || rStr.rows?.[0]?.[0] || 0;
      } catch (e) {}
      try {
        const rElv = await connection.execute(`SELECT COUNT(*) as CNT FROM STR_ELV WHERE PLAT_ID = :strId`, { strId: str_id });
        elvCount = rElv.rows?.[0]?.CNT || rElv.rows?.[0]?.[0] || 0;
      } catch (e) {}
      try {
        const rLevel = await connection.execute(`SELECT COUNT(*) as CNT FROM STR_LEVEL WHERE PLAT_ID = :strId`, { strId: str_id });
        levelCount = rLevel.rows?.[0]?.CNT || rLevel.rows?.[0]?.[0] || 0;
      } catch (e) {}
      try {
        const rFaces = await connection.execute(`SELECT COUNT(*) as CNT FROM STR_FACES WHERE PLAT_ID = :strId`, { strId: str_id });
        facesCount = rFaces.rows?.[0]?.CNT || rFaces.rows?.[0]?.[0] || 0;
      } catch (e) {}
      try {
        let rGeo = null;
        try {
          rGeo = await connection.execute(`SELECT COUNT(*) as CNT FROM PIPE_GEO WHERE STR_ID = :strId`, { strId: str_id });
        } catch (_) {
          try {
            rGeo = await connection.execute(`SELECT COUNT(*) as CNT FROM PIPE_GEO WHERE PIPE_ID = :strId`, { strId: str_id });
          } catch (__) {
            rGeo = await connection.execute(`SELECT COUNT(*) as CNT FROM U_PIPEGEO WHERE STR_ID = :strId`, { strId: str_id });
          }
        }
        pipeGeoCount = rGeo?.rows?.[0]?.CNT || rGeo?.rows?.[0]?.[0] || 0;
      } catch (e) {}
      try {
        const rAsc = await connection.execute(
          `SELECT COUNT(*) as CNT FROM U_ASSOC a 
            WHERE a.COMP_ID IN (
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
      let pgPipeGeoCount = 0;

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
        const { count } = await (supabase.from as any)('u_pipegeo').select('*', { count: 'exact', head: true }).eq('str_id', Number(str_id));
        pgPipeGeoCount = count || 0;
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
            icon_file: row.ICONFILE || row[2] || "",
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
        const rPref = await connection.execute(`SELECT DEF_UNIT, DEF_FORMAT, DEF_COMPID, DEF_DRAWID, DEF_REPORT, DEF_LANG, DEF_CURR, DEF_TAX, DEF_MAP, APPL_MODE, MGROW_PROFILE, DEF_DEPTUNIT FROM PREFERENCE WHERE ROWNUM <= 1`);
        if (rPref.rows && rPref.rows.length > 0) {
          const row: any = rPref.rows[0];
          preferenceDetails = {
            def_unit: row.DEF_UNIT || row[0] || "",
            def_format: row.DEF_FORMAT || row[1] || "",
            def_compid: row.DEF_COMPID || row[2] || "",
            def_drawid: row.DEF_DRAWID || row[3] || "",
            def_report: row.DEF_REPORT || row[4] || "",
            def_lang: row.DEF_LANG || row[5] || "",
            def_curr: row.DEF_CURR || row[6] || "",
            def_tax: row.DEF_TAX || row[7] || "",
            def_map: row.DEF_MAP || row[8] || "",
            appl_mode: row.APPL_MODE || row[9] || "",
            mgrow_profile: row.MGROW_PROFILE || row[10] || "",
            def_deptunit: row.DEF_DEPTUNIT || row[11] || ""
          };
        }
      } catch (e: any) {
        console.warn("Failed to fetch PREFERENCE details:", e.message);
      }

      let isPipe = false;
      try {
        const rPipe = await connection.execute(`SELECT PTYPE FROM v_structure WHERE STR_ID = :strId`, { strId: str_id });
        const pTypeVal = String((rPipe.rows?.[0]?.PTYPE || rPipe.rows?.[0]?.[0]) || "").toUpperCase();
        if (pTypeVal === "PIPE" || pTypeVal === "PIPELINE") {
          isPipe = true;
        }
      } catch (e) {}

      // Fetch component reference table from Supabase to filter by pipe=1 or plat=1
      let dbComponentsMap: Map<string, { descrip?: string; plat?: number; pipe?: number }> = new Map();
      try {
        const { data: dbComps } = await supabase.from('components').select('code, descrip, name, plat, pipe');
        if (dbComps && dbComps.length > 0) {
          dbComps.forEach((c: any) => {
            if (c.code) {
              dbComponentsMap.set(String(c.code).toUpperCase().trim(), {
                descrip: c.descrip || c.name,
                plat: Number(c.plat),
                pipe: Number(c.pipe)
              });
            }
          });
        }
      } catch (e) {}

      // Append Postgres counts to component summary list, filtered by structure type (pipe=1 vs plat=1)
      const summaryWithPg = summary
        .map((row: any) => {
          const rowObj = typeof row === 'object' && row !== null ? row : {};
          const codeVal = String(rowObj.CODE || rowObj[1] || "").toUpperCase().trim();
          const rowCount = Number(rowObj.ROW_COUNT || rowObj[3] || 0);
          const dbMeta = dbComponentsMap.get(codeVal);
          return {
            STR_ID: rowObj.STR_ID || rowObj[0],
            CODE: codeVal,
            NAME: dbMeta?.descrip || rowObj.NAME || rowObj[2],
            ROW_COUNT: rowCount,
            PG_ROW_COUNT: pgComponentCounts[codeVal] || 0,
            PIPE: dbMeta?.pipe ?? 1,
            PLAT: dbMeta?.plat ?? 1,
          };
        })
        .filter((item: any) => {
          const dbMeta = dbComponentsMap.get(item.CODE);
          if (isPipe) {
            // For pipeline, only list components where pipe = 1
            if (dbMeta && dbMeta.pipe !== undefined) {
              return dbMeta.pipe === 1;
            }
            return true;
          } else {
            // For platform, only list components where plat = 1
            if (dbMeta && dbMeta.plat !== undefined) {
              return dbMeta.plat === 1;
            }
            return true;
          }
        });

      const frameworkList: any[] = [
        { code: isPipe ? "STRUCTURE_PIPELINE" : "STRUCTURE", name: isPipe ? "Pipeline Master (U_PIPELINE)" : "Structure Master (PLATFORM)", row_count: Number(strCount), pg_row_count: pgStrCount }
      ];

      if (!isPipe) {
        frameworkList.push(
          { code: "STR_ELV", name: "Structural Elevations", row_count: Number(elvCount), pg_row_count: pgElvCount },
          { code: "STR_LEVEL", name: "Structural Levels", row_count: Number(levelCount), pg_row_count: pgLevelCount },
          { code: "STR_FACES", name: "Structural Faces", row_count: Number(facesCount), pg_row_count: pgFacesCount },
          { code: "U_ASSOC", name: "Hierarchy Associations", row_count: Number(assocCount), pg_row_count: pgAssocCount }
        );
      }

      if (isPipe || pipeGeoCount > 0 || pgPipeGeoCount > 0) {
        frameworkList.push({
          code: "PIPE_GEO",
          name: "Geodetic Parameters (PIPE_GEO)",
          row_count: Number(pipeGeoCount),
          pg_row_count: pgPipeGeoCount
        });
      }

      return NextResponse.json({ 
        success: true, 
        isPipe,
        data: summaryWithPg,
        company: companyDetails,
        preference: preferenceDetails,
        libraries: [
          { code: "U_LIB_MAST", name: "Master Library (u_lib_mast)", row_count: Number(mastCount), pg_row_count: pgMastCount },
          { code: "U_LIB_LIST", name: "Library List (u_lib_list)", row_count: Number(listCount), pg_row_count: pgListCount },
          { code: "U_LIB_COMBO", name: "Library Combo (u_lib_combo)", row_count: Number(comboCount), pg_row_count: pgComboCount },
          { code: "U_MGI_PROFILE", name: "MGI Profiles (mgi_profiles)", row_count: Number(mgiProfileCount), pg_row_count: pgMgiProfileCount }
        ],
        framework: frameworkList
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

