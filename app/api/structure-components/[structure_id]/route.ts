import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth } from "@/utils/with-auth";

/**
 * GET /api/structure-components/[structure_id]
 * Fetch structure components by structure_id and optional code filter
 * Query params: ?code=ANODE (optional)
 */
export const GET = withAuth(
  async (
    request: NextRequest,
    context: { params: Promise<{ structure_id: string }>; user: any }
  ) => {
    const supabase = createClient();
    const { structure_id } = await context.params;
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    const structureIdNumber = Number(structure_id);

    // Build query
    let query = supabase
      .from("structure_components")
      .select("*")
      .eq("structure_id", structureIdNumber)
      .order("q_id");

    // Apply code filter if provided and not "ALL COMPONENTS"
    if (code && code !== "ALL COMPONENTS") {
      query = query.eq("code", code);
    }

    const { data, error } = await query;

    if (error) {
      return handleSupabaseError(error, "Failed to fetch structure components");
    }

    return apiSuccess(data || []);
  }
);

export const POST = withAuth(
  async (
    request: NextRequest,
    context: { params: Promise<{ structure_id: string }>; user: any }
  ) => {
    const supabase = createClient();
    const { structure_id } = await context.params;
    const body = await request.json();

    // Insert the component with structure_id
    const { data, error } = await supabase
      .from("structure_components")
      .insert({
        ...body,
        structure_id: parseInt(structure_id),
      })
      .select()
      .single();

    if (error) {
      return handleSupabaseError(error, "Failed to create structure component");
    }

    return apiSuccess(data);
  }
);
