import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess, apiCreated, apiPaginated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth } from "@/utils/with-auth";
import { getPaginationParams, createPaginationMeta, applyPagination } from "@/utils/pagination";

/**
 * GET /api/platform
 * Fetch all platforms with pagination and optional field filtering
 * Query params: ?page=1&pageSize=50&field=fieldId
 */
export const GET = withAuth(async (request: NextRequest, { user }) => {
  const supabase = createClient();
  const paginationParams = getPaginationParams(request);
  const { searchParams } = new URL(request.url);
  const fieldId = searchParams.get("field");

  // Build query with count for pagination metadata
  let query = supabase.from("platform").select("*", { count: "exact" }).order("title");

  // Filter by field if provided
  if (fieldId) {
    query = query.eq("pfield", fieldId);
  }

  // Apply pagination
  query = applyPagination(query, paginationParams);

  const { data, error, count } = await query;

  if (error) {
    return handleSupabaseError(error, "Failed to fetch platforms");
  }

  // Fetch structure images for each platform
  const platformsWithImages = await Promise.all(
    (data || []).map(async (platform) => {
      const { data: images } = await supabase
        .from("attachment")
        .select("id, path, meta")
        .eq("source_type", "platform_structure_image")
        .eq("source_id", platform.plat_id);

      return {
        ...platform,
        images: images || [],
      };
    })
  );

  // Create pagination metadata
  const pagination = createPaginationMeta(paginationParams, count || 0);

  return apiPaginated(platformsWithImages, pagination);
});

/**
 * POST /api/platform
 * Create a new platform
 */
export const POST = withAuth(async (request: NextRequest, { user }) => {
  const supabase = createClient();
  const body = await request.json();

  // Remove plat_id if present (will be auto-generated)
  delete body.plat_id;

  // Insert platform
  const { data, error } = await supabase.from("platform").insert(body).select().single();

  if (error) {
    return handleSupabaseError(error, "Failed to create platform");
  }

  // Create corresponding structure entry
  const { error: structureError } = await supabase
    .from("structure")
    .insert({ str_id: data.plat_id, str_type: "PLATFORM" });

  if (structureError) {
    // If structure creation fails, we should ideally rollback the platform creation
    // For now, log the error and continue
    console.error("[Platform API] Failed to create structure entry:", structureError);
  }

  return apiCreated(data);
});
