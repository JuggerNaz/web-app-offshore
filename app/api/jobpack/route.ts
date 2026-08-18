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
  const structureIdParam = url.searchParams.get("structure_id");

  if (structureIdParam) {
    const rawSIdStr = String(structureIdParam).replace(/^(platform|pipeline)-/, "");
    const sIdNum = Number(rawSIdStr);

    // Fetch all jobpacks for company to check metadata.structures JSON array
    const { data: allJps } = await (supabase as any)
      .from("jobpack")
      .select("id, metadata, structure_id, platform_id")
      .eq("company_id", companyId);

    // Fetch from u_sow table linking jobpack_id to structure_id
    const { data: sowJps } = await (supabase as any)
      .from("u_sow")
      .select("jobpack_id")
      .eq("company_id", companyId)
      .or(`structure_id.eq.${sIdNum},structure_id.eq.platform-${rawSIdStr}`)
      .not("jobpack_id", "is", null);

    // Fetch from insp_records, insp_dive_jobs, insp_rov_jobs
    const [recJps, diveJps, rovJps] = await Promise.all([
      (supabase as any).from("insp_records").select("jobpack_id").eq("company_id", companyId).eq("structure_id", sIdNum).not("jobpack_id", "is", null),
      (supabase as any).from("insp_dive_jobs").select("jobpack_id").eq("company_id", companyId).eq("structure_id", sIdNum).not("jobpack_id", "is", null),
      (supabase as any).from("insp_rov_jobs").select("jobpack_id").eq("company_id", companyId).eq("structure_id", sIdNum).not("jobpack_id", "is", null),
    ]);

    const matchedJpIds = new Set<number>();

    // 1. Match from jobpack table (direct column & metadata.structures JSON array)
    (allJps || []).forEach((jp: any) => {
      const topStructId = String(jp.structure_id || jp.platform_id || "").replace(/^(platform|pipeline)-/, "");
      if (topStructId && (topStructId === rawSIdStr || Number(topStructId) === sIdNum)) {
        matchedJpIds.add(Number(jp.id));
        return;
      }

      const structures = (jp.metadata as any)?.structures || [];
      if (Array.isArray(structures)) {
        const matches = structures.some((s: any) => {
          const sid = String(s.id || s.structure_id || s.platform_id || "").replace(/^(platform|pipeline)-/, "");
          return sid === rawSIdStr || Number(sid) === sIdNum;
        });
        if (matches) {
          matchedJpIds.add(Number(jp.id));
        }
      }
    });

    // 2. Match from u_sow and inspection jobs
    (sowJps?.data || sowJps || []).forEach((r: any) => r.jobpack_id && matchedJpIds.add(Number(r.jobpack_id)));
    (recJps?.data || []).forEach((r: any) => r.jobpack_id && matchedJpIds.add(Number(r.jobpack_id)));
    (diveJps?.data || []).forEach((r: any) => r.jobpack_id && matchedJpIds.add(Number(r.jobpack_id)));
    (rovJps?.data || []).forEach((r: any) => r.jobpack_id && matchedJpIds.add(Number(r.jobpack_id)));

    if (matchedJpIds.size === 0) {
      return apiPaginated([], createPaginationMeta(paginationParams, 0));
    }

    let query = (supabase as any)
      .from("jobpack")
      .select("*", { count: "exact" })
      .eq("company_id", companyId)
      .in("id", Array.from(matchedJpIds))
      .order("metadata->>istart", { ascending: false });

    query = applyPagination(query, paginationParams);
    const { data, error, count } = await query;
    if (error) return handleSupabaseError(error, "Failed to fetch jobpack");
    return apiPaginated(data || [], createPaginationMeta(paginationParams, count || 0));
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

    const allIds = new Set<number>();
    (diveJobPackIds || []).forEach((r: any) => r.jobpack_id && allIds.add(Number(r.jobpack_id)));
    (rovJobPackIds || []).forEach((r: any) => r.jobpack_id && allIds.add(Number(r.jobpack_id)));
    (directJobPackIds || []).forEach((r: any) => r.jobpack_id && allIds.add(Number(r.jobpack_id)));

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
