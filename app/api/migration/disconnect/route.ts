import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/utils/with-auth";
import { closeOraclePool, closeAllOraclePools, OracleConnectionConfig } from "@/utils/oracle-db";

/**
 * POST /api/migration/disconnect
 * Auto-releases/disconnects any active connection states or performs session logging.
 */
export const POST = withAuth(async (request: NextRequest, { user }: any) => {
  try {
    let config: OracleConnectionConfig | undefined;
    try {
      config = await request.json();
    } catch (_) {
      // Body may be empty on beacon / auto-disconnect
    }

    if (config && (config.connectString || (config.host && config.serviceName))) {
      await closeOraclePool(config);
    } else {
      await closeAllOraclePools();
    }

    console.log(`[Oracle Disconnect] Disconnected and released Oracle pools for user ${user?.email || "unknown"}`);
    return NextResponse.json({
      success: true,
      message: "Successfully disconnected from Oracle legacy database."
    });
  } catch (error: any) {
    console.error("[Oracle Disconnect Error]:", error);
    return NextResponse.json({
      error: "Failed to release connection",
      details: error.message
    }, { status: 500 });
  }
});
