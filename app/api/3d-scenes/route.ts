import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth } from "@/utils/with-auth";

// Helper function to map integer platform IDs to valid deterministic UUIDs
function toUuid(id: string | number): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const strId = String(id).trim();
  if (uuidRegex.test(strId)) {
    return strId;
  }
  
  // Extract digits and convert to hex for standard UUID padding
  const cleanId = strId.replace(/[^0-9]/g, '');
  const numericId = parseInt(cleanId || '0', 10);
  const hexVal = numericId.toString(16).padStart(12, '0').slice(-12);
  return `00000000-0000-0000-0000-${hexVal}`;
}

/**
 * GET /api/3d-scenes?platform_id=integer
 * Fetch 3D scene data for a platform
 */
export const GET = withAuth(
  async (request: NextRequest, { params, user }: { params: Promise<any>; user: any }) => {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const platform_id = searchParams.get("platform_id");

    if (!platform_id) {
      return NextResponse.json({ error: "Missing platform_id" }, { status: 400 });
    }

    const uuidPlatformId = toUuid(platform_id);

    const { data, error } = await (supabase as any)
      .from("platform_3d_scenes")
      .select("*")
      .eq("platform_id", uuidPlatformId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") { // PGRST116 is "No rows found"
      return handleSupabaseError(error, "Failed to fetch scene");
    }

    return apiSuccess(data || null);
  }
);

/**
 * POST /api/3d-scenes
 * Save or update 3D scene data
 */
export const POST = withAuth(
  async (request: NextRequest, { params, user }: { params: Promise<any>; user: any }) => {
    const supabase = createClient();
    const body = await request.json();
    const { platform_id, scene_data, name } = body;

    if (!platform_id) {
      return NextResponse.json({ error: "Missing platform_id" }, { status: 400 });
    }

    const uuidPlatformId = toUuid(platform_id);

    // Check if one exists
    const { data: existing } = await (supabase as any)
      .from("platform_3d_scenes")
      .select("id")
      .eq("platform_id", uuidPlatformId)
      .limit(1)
      .single();

    let result;
    if (existing) {
      result = await (supabase as any)
        .from("platform_3d_scenes")
        .update({ scene_data, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      result = await (supabase as any)
        .from("platform_3d_scenes")
        .insert({
          platform_id: uuidPlatformId,
          name: name || "Default Scene",
          scene_data,
        })
        .select()
        .single();
    }

    if (result.error) {
      return handleSupabaseError(result.error, "Failed to save scene");
    }

    return apiSuccess(result.data);
  }
);
