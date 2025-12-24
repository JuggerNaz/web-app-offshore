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
    const archived = searchParams.get("archived");

    const structureIdNumber = Number(structure_id);

    // Build query
    let query = supabase
      .from("structure_components")
      .select("*")
      .eq("structure_id", structureIdNumber)
      .order("q_id");

    // Filter by archived / active
    if (archived === "true") {
      query = query.eq("is_deleted", true);
    } else {
      // Default: only non-deleted (treat null as not deleted)
      query = query.or("is_deleted.is.null,is_deleted.eq.false");
    }

    // Apply code filter if provided and not "ALL COMPONENTS"
    if (code && code !== "ALL COMPONENTS") {
      query = query.eq("code", code);
    }

    const { data, error } = await query;

    if (error) {
      return handleSupabaseError(error, "Failed to fetch structure components");
    }

    if (!data || data.length === 0) {
      return apiSuccess([]);
    }

    // Enrich created_by / modified_by with user names via get_user_info RPC (same pattern as comments API)
    try {
      const userIds = Array.from(
        new Set(
          data
            .flatMap((item: any) => [item.created_by, item.modified_by])
            .filter(Boolean)
        )
      );

      if (userIds.length > 0) {
        const { data: usersData, error: usersError } = await (supabase.rpc as any)(
          "get_user_info",
          {
            user_ids: userIds,
          }
        );

        if (!usersError && Array.isArray(usersData)) {
          const userMap = new Map<string, string>();
          usersData.forEach((user: any) => {
            const userName = user.full_name || user.email || "Unknown User";
            userMap.set(user.id, userName);
          });

          const enrichedData = data.map((item: any) => ({
            ...item,
            created_by_name: item.created_by
              ? userMap.get(item.created_by) || item.created_by
              : null,
            modified_by_name: item.modified_by
              ? userMap.get(item.modified_by) || item.modified_by
              : null,
          }));

          return apiSuccess(enrichedData);
        }
      }
    } catch (rpcError) {
      console.error("[Structure Components API] Failed to enrich user names", rpcError);
      // Fallback to returning raw data below
    }

    return apiSuccess(data);
  }
);

export const POST = withAuth(
  async (
    request: NextRequest,
    context: { params: Promise<{ structure_id: string }>; user: any }
  ) => {
    const supabase = createClient();
    const { structure_id } = await context.params;
    const { user } = context;
    const body = await request.json();

    const createdAt = new Date().toISOString();
    const structureIdNumber = Number(structure_id);

    const { data, error } = await supabase
      .from("structure_components")
      .insert({
        ...body,
        structure_id: structureIdNumber,
        created_at: createdAt,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      return handleSupabaseError(error, "Failed to create structure component");
    }

    return apiSuccess(data);
  }
);
