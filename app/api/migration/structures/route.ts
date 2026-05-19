import { NextRequest, NextResponse } from "next/server";
import { getOracleConnection, OracleConnectionConfig } from "@/utils/oracle-db";
import { withAuth } from "@/utils/with-auth";

/**
 * POST /api/migration/structures
 * Fetches the list of structures from the Oracle database.
 * We use POST to securely pass the Oracle credentials in the request body.
 */
export const POST = withAuth(async (request: NextRequest, { user }: any) => {
  let connection;
  try {
    const config: OracleConnectionConfig = await request.json();

    if ((!config.connectString && (!config.host || !config.serviceName)) || !config.user || !config.password) {
      return NextResponse.json({ error: "Missing required connection parameters" }, { status: 400 });
    }

    connection = await getOracleConnection(config);
    
    // Fetch from v_structure view
    const result = await connection.execute(
      `SELECT STR_ID, TITLE, PTYPE, DEF_UNIT FROM v_structure ORDER BY TITLE ASC`
    );
    
    // The result.rows is an array of objects because we set OUT_FORMAT_OBJECT globally in oracle-db.ts
    const structures = result.rows || [];

    return NextResponse.json({ 
      success: true, 
      data: structures
    });

  } catch (error: any) {
    console.error("[Oracle Fetch Structures Error]:", error);
    return NextResponse.json({ 
      error: "Failed to fetch structures from Oracle database", 
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
});
