import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess, apiCreated, apiPaginated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth, withOptionalAuth } from "@/utils/with-auth";
import {
  getPaginationParams,
  createPaginationMeta,
  applyPagination,
  getSearchParam,
  buildSearchFilter,
} from "@/utils/pagination";

/**
 * GET /api/pipeline
 * Fetch pipelines with pagination, optional field filtering and optional
 * title search. Also supports a slim title-by-id lookup.
 * Query params: ?page=1&pageSize=50&field=fieldId&q=<title search>&ids=1,2,3
 */
export const GET = withOptionalAuth(async (request: NextRequest, { user }) => {
  const supabase = createClient();
  const paginationParams = getPaginationParams(request);
  const { searchParams } = new URL(request.url);
  const fieldId = searchParams.get("field");
  const q = getSearchParam(request);
  const companyId = searchParams.get("company_id") || request.headers.get("x-company-id") || request.cookies.get("active_company_id")?.value;

  // Build query with count for pagination metadata
  let query = (supabase as any).from("u_pipeline").select("*", { count: "exact" }).order("title");

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  // Filter by field if provided
  if (fieldId) {
    query = query.eq("pfield", fieldId);
  }

  // Optional slim lookup: ?ids=1,2,3 (title-by-id resolution for pickers,
  // restore-by-id flows, etc.) — composes with the other filters.
  const idsParam = searchParams.get("ids");
  const ids = idsParam
    ? idsParam
        .split(",")
        .map((s) => s.trim())
        .filter((s) => /^\d+$/.test(s))
        .map(Number)
    : [];
  if (ids.length > 0) {
    query = query.in("pipe_id", ids);
  }

  // Free-text title search before pagination so the count reflects the filter
  const searchFilter = buildSearchFilter(q, ["title"]);
  if (searchFilter) {
    query = query.or(searchFilter);
  }

  // Apply pagination
  query = applyPagination(query, paginationParams);

  const { data, error, count } = (await query) as any;

  if (error) {
    return handleSupabaseError(error, "Failed to fetch pipelines");
  }

  // Fetch oil fields for this tenant to resolve names efficiently
  let fieldsQuery = (supabase as any)
    .from("u_lib_list")
    .select("lib_id, lib_desc")
    .eq("lib_code", "OILFIELD")
    .or("lib_delete.is.null,lib_delete.neq.1");

  if (companyId) {
    fieldsQuery = fieldsQuery.eq("company_id", companyId);
  }

  const { data: allFields } = (await fieldsQuery) as any;

  const fieldMap = new Map((allFields || []).map((f: any) => [f.lib_id.toString(), f.lib_desc]));

  // Attach field names
  const pipelinesWithFields = (data || []).map(pipeline => ({
    ...pipeline,
    field_name: fieldMap.get(pipeline.pfield?.toString() ?? "") || pipeline.pfield,
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
  const companyId = request.headers.get("x-company-id") || request.cookies.get("active_company_id")?.value || body.company_id;
  if (companyId && !body.company_id) {
    body.company_id = companyId;
  }

  // Determine starting candidate ID
  const requestedId = Number(body.pipe_id);
  delete body.pipe_id;

  // Find max ID from structure and u_pipeline tables
  const { data: maxStruct } = await supabase
    .from("structure")
    .select("str_id")
    .order("str_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: maxPipe } = await supabase
    .from("u_pipeline")
    .select("pipe_id")
    .order("pipe_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const maxExistingId = Math.max(maxStruct?.str_id || 0, maxPipe?.pipe_id || 0);

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

    const { data: pipeRow } = await supabase
      .from("u_pipeline")
      .select("pipe_id")
      .eq("pipe_id", candidateId)
      .maybeSingle();

    if (!structRow && !pipeRow) {
      isUnique = true;
    } else {
      candidateId++;
    }
  }

  // First create parent structure entry to satisfy foreign key constraint
  const { error: structureError } = await (supabase as any)
    .from("structure")
    .insert({ str_id: candidateId, str_type: "PIPELINE", ...(companyId ? { company_id: companyId } : {}) });

  if (structureError) {
    return handleSupabaseError(structureError, "Failed to create structure entry for pipeline");
  }

  // Next insert pipeline entry with the unique candidateId
  const { data, error } = await (supabase as any)
    .from("u_pipeline")
    .insert({ ...body, pipe_id: candidateId, ...(companyId ? { company_id: companyId } : {}) })
    .select()
    .single();

  if (error) {
    // Rollback parent structure entry if pipeline creation fails
    await supabase.from("structure").delete().eq("str_id", candidateId);
    return handleSupabaseError(error, "Failed to create pipeline");
  }

  return apiCreated(data);
});
