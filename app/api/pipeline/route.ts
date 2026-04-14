import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess, apiCreated, apiPaginated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth } from "@/utils/with-auth";
import { getPaginationParams, createPaginationMeta, applyPagination } from "@/utils/pagination";

/**
 * GET /api/pipeline
 * Fetch all pipelines with pagination and optional field filtering
 * Query params: ?page=1&pageSize=50&field=fieldId
 */
export const GET = withAuth(async (request: NextRequest, { user }) => {
  const supabase = createClient();
  const paginationParams = getPaginationParams(request);
  const { searchParams } = new URL(request.url);
  const fieldId = searchParams.get("field");

  // Build query with count for pagination metadata
  let query = supabase.from("u_pipeline").select("*", { count: "exact" }).order("title");

  // Filter by field if provided
  if (fieldId) {
    query = query.eq("pfield", fieldId);
  }

  // Apply pagination
  query = applyPagination(query, paginationParams);

  const { data, error, count } = await query;

  if (error) {
    return handleSupabaseError(error, "Failed to fetch pipelines");
  }

  // Fetch all oil fields to resolve names efficiently
  const { data: allFields } = await supabase
    .from("u_lib_list")
    .select("lib_id, lib_desc")
    .eq("lib_code", "OILFIELD");

  const fieldMap = new Map((allFields || []).map(f => [f.lib_id.toString(), f.lib_desc]));

  // Attach field names
  const pipelinesWithFields = (data || []).map(pipeline => ({
    ...pipeline,
    field_name: fieldMap.get(pipeline.pfield?.toString()) || pipeline.pfield,
  }));

  // Create pagination metadata
  const pagination = createPaginationMeta(paginationParams, count || 0);

  return apiPaginated(pipelinesWithFields, pagination);
});

/**
 * POST /api/pipeline
 * Create a new pipeline
 */
export const POST = withAuth(async (request: NextRequest, { user }) => {
  const supabase = createClient();
  const body = await request.json();

  // Remove pipe_id if present (will be auto-generated)
  delete body.pipe_id;

  // Insert pipeline
  const { data, error } = await supabase.from("u_pipeline").insert(body).select().single();

  if (error) {
    return handleSupabaseError(error, "Failed to create pipeline");
  }

  // Create corresponding structure entry
  const { error: structureError } = await supabase
    .from("structure")
    .insert({ str_id: data.pipe_id, str_type: "PIPELINE" });

  if (structureError) {
    // If structure creation fails, we should ideally rollback the pipeline creation
    // For now, log the error and continue
    console.error("[Pipeline API] Failed to create structure entry:", structureError);
  }

  return apiCreated(data);
});
