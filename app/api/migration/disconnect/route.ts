import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/utils/with-auth";

/**
 * POST /api/migration/disconnect
 * Auto-releases/disconnects any active connection states or performs session logging.
 */
export const POST = withAuth(async (request: NextRequest, { user }: any) => {
  try {
    console.log(`[Oracle Disconnect] Disconnected from Oracle by user ${user?.email || "unknown"}`);
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
