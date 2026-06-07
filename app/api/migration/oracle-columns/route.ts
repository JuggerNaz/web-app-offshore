import { NextRequest, NextResponse } from "next/server";
import { getOracleConnection } from "@/utils/oracle-db";
import { withAuth } from "@/utils/with-auth";

/**
 * POST /api/migration/oracle-columns
 * Fetches the column names for a given Oracle table.
 */
export const POST = withAuth(
  async (request: NextRequest) => {
    let connection;
    try {
      const { config, tableName } = await request.json();

      // Basic parameter verification
      if (!config || ((!config.connectString && (!config.host || !config.serviceName)) || !config.user || !config.password)) {
        return NextResponse.json({ error: "Missing required database connection parameters" }, { status: 400 });
      }

      if (!tableName) {
        return NextResponse.json({ error: "Missing required tableName parameter" }, { status: 400 });
      }

      connection = await getOracleConnection(config);

      const result = await connection.execute(
        `SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = :tName ORDER BY COLUMN_ID`,
        { tName: tableName.toUpperCase() }
      );

      const columns: string[] = [];
      if (result.rows) {
        result.rows.forEach((r: any) => {
          const cName = r.COLUMN_NAME || r[0] || (typeof r === 'string' ? r : null);
          if (cName) {
            columns.push(String(cName).toUpperCase());
          }
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          columns
        }
      });

    } catch (error: any) {
      console.error(`[Oracle Columns Fetch Error]:`, error);
      return NextResponse.json({
        error: "Failed to fetch oracle columns",
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
