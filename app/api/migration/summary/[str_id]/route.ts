import { NextRequest, NextResponse } from "next/server";
import { getOracleConnection, OracleConnectionConfig } from "@/utils/oracle-db";
import { withAuth } from "@/utils/with-auth";

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

      connection = await getOracleConnection(config);
      
      // Fetch summary from allcompid view joined with comp_type to get description/full name
      let summary = [];
      try {
        const result = await connection.execute(
          `SELECT c.STR_ID, c.CODE, t.DESCRIP as NAME, COUNT(*) as ROW_COUNT 
           FROM allcompid c
           LEFT JOIN comp_type t ON c.CODE = t.CODE
           WHERE c.STR_ID = :strId 
           GROUP BY c.STR_ID, c.CODE, t.DESCRIP 
           ORDER BY c.CODE ASC`,
          { strId: str_id }
        );
        summary = result.rows || [];
      } catch (err: any) {
        console.warn("Joined summary query failed, trying fallback without comp_type join:", err.message);
        const result = await connection.execute(
          `SELECT STR_ID, CODE, COUNT(*) as ROW_COUNT FROM allcompid WHERE STR_ID = :strId GROUP BY STR_ID, CODE ORDER BY CODE ASC`,
          { strId: str_id }
        );
        summary = result.rows || [];
      }

      return NextResponse.json({ 
        success: true, 
        data: summary
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
