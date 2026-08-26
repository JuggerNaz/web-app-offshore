import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getPaginationParams, createPaginationMeta, applyPagination } from "@/utils/pagination";
import { apiPaginated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withTenant } from "@/utils/tenant-auth";

export const GET = withTenant(async (request, { companyId }) => {
  const supabase = createClient();

  const paginationParams = getPaginationParams(request);

  const url = new URL(request.url);
  if (!url.searchParams.has("pageSize") && !url.searchParams.has("limit")) {
    paginationParams.pageSize = 1000;
    paginationParams.offset = (paginationParams.page - 1) * paginationParams.pageSize;
  }

  const hasInspection = url.searchParams.get("has_inspection") === "true";
  let structureId = url.searchParams.get("structure_id");
  if (structureId === "undefined" || structureId === "null" || !structureId) {
    structureId = null;
  }
  let structureTitle = url.searchParams.get("structure_title");
  if (structureTitle === "undefined" || structureTitle === "null" || !structureTitle) {
    structureTitle = null;
  }

  if (hasInspection) {
    const { data: diveJobPackIds } = await (supabase as any)
      .from("insp_dive_jobs")
      .select("jobpack_id")
      .eq("company_id", companyId)
      .not("jobpack_id", "is", null);

    const { data: rovJobPackIds } = await (supabase as any)
      .from("insp_rov_jobs")
      .select("jobpack_id")
      .eq("company_id", companyId)
      .not("jobpack_id", "is", null);

    const { data: directJobPackIds } = await (supabase as any)
      .from("insp_records")
      .select("jobpack_id")
      .eq("company_id", companyId)
      .not("jobpack_id", "is", null);

    let allIds = new Set<number>();
    (diveJobPackIds || []).forEach((r: any) => r.jobpack_id && allIds.add(Number(r.jobpack_id)));
    (rovJobPackIds || []).forEach((r: any) => r.jobpack_id && allIds.add(Number(r.jobpack_id)));
    (directJobPackIds || []).forEach((r: any) => r.jobpack_id && allIds.add(Number(r.jobpack_id)));

    if (structureId || structureTitle) {
      let sowQuery = (supabase as any)
        .from("u_sow")
        .select("jobpack_id")
        .eq("company_id", companyId)
        .not("jobpack_id", "is", null);

      if (structureId && structureTitle) {
        sowQuery = sowQuery.or(`structure_id.eq.${structureId},structure_title.eq."${structureTitle}"`);
      } else if (structureId) {
        sowQuery = sowQuery.eq("structure_id", structureId);
      } else if (structureTitle) {
        sowQuery = sowQuery.eq("structure_title", structureTitle);
      }

      const { data: sowData } = await sowQuery;

      const sowIds = new Set<number>();
      (sowData || []).forEach((r: any) => r.jobpack_id && sowIds.add(Number(r.jobpack_id)));
      
      allIds = new Set([...allIds].filter(x => sowIds.has(x)));
    }

    if (allIds.size === 0) {
      return apiPaginated([], createPaginationMeta(paginationParams, 0));
    }

    let query = (supabase as any)
      .from("jobpack")
      .select("*", { count: "exact" })
      .eq("company_id", companyId)
      .in("id", Array.from(allIds))
      .order("metadata->>istart", { ascending: false });

    query = applyPagination(query, paginationParams);
    const { data, error, count } = await query;
    if (error) return handleSupabaseError(error, "Failed to fetch jobpack");
    return apiPaginated(data || [], createPaginationMeta(paginationParams, count || 0));
  }

  let query = (supabase as any)
    .from("jobpack")
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .order("metadata->>istart", { ascending: false });

  query = applyPagination(query, paginationParams);

  const { data, error, count } = await query;

  if (error) {
    return handleSupabaseError(error, "Failed to fetch jobpack");
  }

  const pagination = createPaginationMeta(paginationParams, count || 0);

  return apiPaginated(data || [], pagination);
});

export const POST = withTenant(async (request, { companyId }) => {
  const supabase = createClient();
  const body = await request.json();

  const { data, error } = await (supabase as any)
    .from("jobpack")
    .insert({
      ...body,
      company_id: companyId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return handleSupabaseError(error, "Failed to create jobpack");
  return NextResponse.json({ data });
});
