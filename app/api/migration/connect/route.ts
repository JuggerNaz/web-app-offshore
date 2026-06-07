import { NextRequest, NextResponse } from "next/server";
import { getOracleConnection, OracleConnectionConfig } from "@/utils/oracle-db";
import { withAuth } from "@/utils/with-auth";

/**
 * POST /api/migration/connect
 * Tests the connection to the Oracle database using the provided credentials.
 */
export const POST = withAuth(async (request: NextRequest, { user }: any) => {
  try {
    const config: OracleConnectionConfig = await request.json();

    if ((!config.connectString && (!config.host || !config.serviceName)) || !config.user || !config.password) {
      return NextResponse.json({ error: "Missing required connection parameters" }, { status: 400 });
    }

    const connection = await getOracleConnection(config);
    
    // If we reach here, connection was successful. Let's do a quick ping query.
    const result = await connection.execute(`SELECT 'Connection Successful' as status FROM dual`);
    
    // Always close the connection back to the pool
    await connection.close();

    return NextResponse.json({ 
      success: true, 
      message: "Successfully connected to Oracle Database",
      data: result.rows
    });

  } catch (error: any) {
    console.error("[Oracle Connection Test Error]:", error);
    return NextResponse.json({ 
      error: "Failed to connect to Oracle database", 
      details: error.message 
    }, { status: 500 });
  }
});
