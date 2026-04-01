import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getPaginationParams, createPaginationMeta, applyPagination } from "@/utils/pagination";
import { apiPaginated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";

/**
 * GET /api/jobpack
 * Fetch all job packs with pagination
 * Query params: ?page=1&pageSize=50
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();

  // Get pagination params
  const paginationParams = getPaginationParams(request);

  // If pageSize is the default 50 and not explicitly requested, 
  // let's use a larger limit to "remove" the restriction for jobpacks
  const url = new URL(request.url);
  if (!url.searchParams.has("pageSize") && !url.searchParams.has("limit")) {
    paginationParams.pageSize = 1000;
    paginationParams.offset = (paginationParams.page - 1) * paginationParams.pageSize;
  }

  const hasInspection = url.searchParams.get("has_inspection") === "true";

  if (hasInspection) {
    // Fetch jobpack IDs that have at least one inspection record
    // via insp_records which references dive_job or rov_job which have jobpack_id
    const { data: diveJobPackIds } = await (supabase as any)
      .from("insp_dive_jobs")
      .select("jobpack_id")
      .not("jobpack_id", "is", null);

    const { data: rovJobPackIds } = await (supabase as any)
      .from("insp_rov_jobs")
      .select("jobpack_id")
      .not("jobpack_id", "is", null);

    const { data: directJobPackIds } = await (supabase as any)
      .from("insp_records")
      .select("jobpack_id")
      .not("jobpack_id", "is", null);

    const allIds = new Set<number>();
    (diveJobPackIds || []).forEach((r: any) => r.jobpack_id && allIds.add(Number(r.jobpack_id)));
    (rovJobPackIds || []).forEach((r: any) => r.jobpack_id && allIds.add(Number(r.jobpack_id)));
    (directJobPackIds || []).forEach((r: any) => r.jobpack_id && allIds.add(Number(r.jobpack_id)));

    if (allIds.size === 0) {
      return apiPaginated([], createPaginationMeta(paginationParams, 0));
    }

    let query = supabase
      .from("jobpack")
      .select("*", { count: "exact" })
      .in("id", Array.from(allIds))
      .order("metadata->>istart", { ascending: false });

    query = applyPagination(query, paginationParams);
    const { data, error, count } = await query;
    if (error) return handleSupabaseError(error, "Failed to fetch jobpack");
    return apiPaginated(data || [], createPaginationMeta(paginationParams, count || 0));
  }

  // Build query with count for pagination metadata
  let query = supabase.from("jobpack").select("*", { count: "exact" }).order("metadata->>istart", { ascending: false });

  // Apply pagination
  query = applyPagination(query, paginationParams);

  const { data, error, count } = await query;

  if (error) {
    return handleSupabaseError(error, "Failed to fetch jobpack");
  }

  // Create pagination metadata
  const pagination = createPaginationMeta(paginationParams, count || 0);

  return apiPaginated(data || [], pagination);
}

/**
 * POST /api/jobpack
 * Create a new jobpack record
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("jobpack")
    .insert({
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return handleSupabaseError(error, "Failed to create jobpack");
  return NextResponse.json({ data });
}
