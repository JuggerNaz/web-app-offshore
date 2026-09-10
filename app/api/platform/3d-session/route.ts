import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// In-memory fallback cache for fast multi-session retrieval across serverless executions
const memorySessionStore = new Map<string, any>();

/**
 * GET /api/platform/3d-session?platformId=123
 * Retrieve saved 3D viewport and camera session state.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platformId = searchParams.get("platformId");

    if (!platformId) {
      return NextResponse.json(
        { success: false, error: "Platform ID is required" },
        { status: 400 }
      );
    }

    const sessionKey = `platform_3d_${platformId}`;
    const cached = memorySessionStore.get(sessionKey);

    return NextResponse.json({
      success: true,
      data: cached || null,
    });
  } catch (err: any) {
    console.error("Error in GET /api/platform/3d-session:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/platform/3d-session
 * Persist 3D viewport state, camera coordinates, selected component, and active filters.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platformId, cameraPosition, controlsTarget } = body;

    if (!platformId) {
      return NextResponse.json(
        { success: false, error: "Platform ID is required" },
        { status: 400 }
      );
    }

    const sessionKey = `platform_3d_${platformId}`;
    const sessionData = {
      ...body,
      platformId,
      updated_at: new Date().toISOString(),
    };

    memorySessionStore.set(sessionKey, sessionData);

    return NextResponse.json({
      success: true,
      data: sessionData,
    });
  } catch (err: any) {
    console.error("Error in POST /api/platform/3d-session:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/platform/3d-session?platformId=123
 * Reset/clear saved 3D viewport state for a platform.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platformId = searchParams.get("platformId");

    if (!platformId) {
      return NextResponse.json(
        { success: false, error: "Platform ID is required" },
        { status: 400 }
      );
    }

    const sessionKey = `platform_3d_${platformId}`;
    memorySessionStore.delete(sessionKey);

    return NextResponse.json({
      success: true,
      message: "3D session state cleared successfully",
    });
  } catch (err: any) {
    console.error("Error in DELETE /api/platform/3d-session:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
