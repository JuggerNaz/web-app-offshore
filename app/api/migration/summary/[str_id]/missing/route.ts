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

export const POST = withAuth(
  async (
    request: NextRequest,
    { params, user }: { params: Promise<{ str_id: string }>; user: any }
  ) => {
    let connection;
    try {
      const { str_id } = await params;
      const { code, ...config }: { code: string } & OracleConnectionConfig = await request.json();

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
      connection = await getOracleConnection(config);

      let oracleItems: { key: string; label: string }[] = [];
      let postgresItems: { key: string; label: string }[] = [];

      const upperCode = code.toUpperCase().trim();

      if (upperCode === "U_LIB_MAST") {
        // Oracle
        const rRes = await connection.execute(`SELECT LIB_CODE, LIB_NAME FROM U_LIB_MAST`);
        oracleItems = (rRes.rows || []).map((row: any) => ({
          key: String(row.LIB_CODE || row[0] || "").trim(),
          label: String(row.LIB_NAME || row[1] || "").trim() || String(row.LIB_CODE || row[0] || "").trim()
        }));

        // Postgres
        const pgData = await fetchAllFromSupabase(supabase, 'u_lib_mast', 'lib_code, lib_name');
        postgresItems = (pgData || []).map((row: any) => ({
          key: String(row.lib_code || "").trim(),
          label: String(row.lib_name || "").trim() || String(row.lib_code || "").trim()
        }));

      } else if (upperCode === "U_LIB_LIST") {
        // Oracle
        const rRes = await connection.execute(`SELECT LIB_CODE, LIB_ID, LIB_DESC FROM U_LIB_LIST`);
        oracleItems = (rRes.rows || []).map((row: any) => {
          const lcode = String(row.LIB_CODE || row[0] || "").trim();
          const lid = String(row.LIB_ID || row[1] || "").trim();
          const ldesc = String(row.LIB_DESC || row[2] || "").trim();
          return {
            key: `${lcode}::${lid}`,
            label: `[${lcode}] ${lid}: ${ldesc || "(No Description)"}`
          };
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

      } else if (upperCode === "U_LIB_COMBO") {
        // Oracle
        const rRes = await connection.execute(`SELECT LIB_CODE, COMB_ID, COMB_VAL FROM U_LIB_COMBO`);
        oracleItems = (rRes.rows || []).map((row: any) => {
          const lcode = String(row.LIB_CODE || row[0] || "").trim();
          const cid = String(row.COMB_ID || row[1] || "").trim();
          const cval = String(row.COMB_VAL || row[2] || "").trim();
          return {
            key: `${lcode}::${cid}::${cval}`,
            label: `[${lcode}] ${cid}: ${cval || "(No Value)"}`
          };
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

      const missingInPostgres = oracleItems.filter(item => item.key && !pgKeys.has(item.key));
      const missingInOracle = postgresItems.filter(item => item.key && !oracleKeys.has(item.key));

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
