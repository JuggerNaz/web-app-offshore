import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth } from "@/utils/with-auth";

/**
 * GET /api/3d-scenes?platform_id=UUID
 * Fetch 3D scene data for a platform
 */
export const GET = withAuth(
  async (request: NextRequest, { user }: { user: any }) => {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const platform_id = searchParams.get("platform_id");

    if (!platform_id) {
      return new Response(JSON.stringify({ error: "Missing platform_id" }), { status: 400 });
    }

    const { data, error } = await supabase
      .from("platform_3d_scenes")
      .select("*")
      .eq("platform_id", platform_id)
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
  async (request: NextRequest, { user }: { user: any }) => {
    const supabase = createClient();
    const body = await request.json();
    const { platform_id, scene_data, name } = body;

    if (!platform_id) {
      return new Response(JSON.stringify({ error: "Missing platform_id" }), { status: 400 });
    }

    // Check if one exists
    const { data: existing } = await supabase
      .from("platform_3d_scenes")
      .select("id")
      .eq("platform_id", platform_id)
      .limit(1)
      .single();

    let result;
    if (existing) {
      result = await supabase
        .from("platform_3d_scenes")
        .update({ scene_data, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("platform_3d_scenes")
        .insert({
          platform_id,
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
