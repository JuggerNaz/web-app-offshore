import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess, apiCreated, apiPaginated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth, withOptionalAuth } from "@/utils/with-auth";
import { getPaginationParams, createPaginationMeta, applyPagination } from "@/utils/pagination";
import { withCacheHeaders } from "@/utils/api-cache";

/**
 * GET /api/platform
 * Fetch all platforms with pagination and optional field filtering
 * Query params: ?page=1&pageSize=50&field=fieldId
 */
export const GET = withOptionalAuth(async (request: NextRequest, { user }) => {
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

  // Fetch all oil fields to resolve names efficiently
  const { data: allFields } = await supabase
    .from("u_lib_list")
    .select("lib_id, lib_desc")
    .eq("lib_code", "OILFIELD")
    .or("lib_delete.is.null,lib_delete.neq.1");

  const fieldMap = new Map((allFields || []).map(f => [f.lib_id.toString(), f.lib_desc]));

  // Fetch structure images for all platforms in ONE query (was one query
  // per platform — up to pageSize extra round trips per list fetch).
  const platIds = (data || []).map((platform) => platform.plat_id);
  const { data: allImages } = platIds.length
    ? await supabase
        .from("attachment")
        .select("id, path, meta, source_id")
        .eq("source_type", "platform_structure_image")
        .in("source_id", platIds)
    : { data: [] as any[] | null };

  const imagesByPlatform = new Map<number, { id: any; path: string; meta: any }[]>();
  for (const img of allImages || []) {
    const bucket = imagesByPlatform.get(img.source_id);
    const row = { id: img.id, path: img.path, meta: img.meta };
    if (bucket) bucket.push(row);
    else imagesByPlatform.set(img.source_id, [row]);
  }

  const platformsWithDetails = (data || []).map((platform) => ({
    ...platform,
    images: imagesByPlatform.get(platform.plat_id) || [],
    field_name: fieldMap.get(platform.pfield?.toString() ?? "") || platform.pfield,
  }));

  // Create pagination metadata
  const pagination = createPaginationMeta(paginationParams, count || 0);

  // Platform list changes rarely (admin edits) — brief browser cache.
  return withCacheHeaders(apiPaginated(platformsWithDetails, pagination), 60);
});

/**
 * POST /api/platform
 * Create a new platform
 */
export const POST = withAuth(async (request: NextRequest, { user }) => {
  const supabase = createClient();
  const body = await request.json();

  // Determine starting candidate ID
  const requestedId = Number(body.plat_id);
  delete body.plat_id;

  // Find max ID from structure and platform tables
  const { data: maxStruct } = await supabase
    .from("structure")
    .select("str_id")
    .order("str_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: maxPlat } = await supabase
    .from("platform")
    .select("plat_id")
    .order("plat_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const maxExistingId = Math.max(maxStruct?.str_id || 0, maxPlat?.plat_id || 0);

  let candidateId = requestedId > 0 ? requestedId : maxExistingId + 1;
  if (candidateId <= 0) candidateId = 1;

  // Auto-increment candidateId until a unique value is found in both tables
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 1000;

  while (!isUnique && attempts < maxAttempts) {
    attempts++;
    const { data: structRow } = await supabase
      .from("structure")
      .select("str_id")
      .eq("str_id", candidateId)
      .maybeSingle();

    const { data: platRow } = await supabase
      .from("platform")
      .select("plat_id")
      .eq("plat_id", candidateId)
      .maybeSingle();

    if (!structRow && !platRow) {
      isUnique = true;
    } else {
      candidateId++;
    }
  }

  // First create parent structure entry to satisfy foreign key constraint
  const { error: structureError } = await supabase
    .from("structure")
    .insert({ str_id: candidateId, str_type: "PLATFORM" });

  if (structureError) {
    return handleSupabaseError(structureError, "Failed to create structure entry for platform");
  }

  // Next insert platform entry with the unique candidateId
  const { data, error } = await supabase
    .from("platform")
    .insert({ ...body, plat_id: candidateId })
    .select()
    .single();

  if (error) {
    // Rollback parent structure entry if platform creation fails
    await supabase.from("structure").delete().eq("str_id", candidateId);
    return handleSupabaseError(error, "Failed to create platform");
  }

  return apiCreated(data);
});
