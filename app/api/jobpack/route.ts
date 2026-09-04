import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getPaginationParams, createPaginationMeta, applyPagination } from "@/utils/pagination";
import { apiPaginated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth, withOptionalAuth } from "@/utils/with-auth";

export const GET = withOptionalAuth(async (request: NextRequest, { user }: { user: any }) => {
  const supabase = createClient();

  const paginationParams = getPaginationParams(request);

  const url = new URL(request.url);
  if (!url.searchParams.has("pageSize") && !url.searchParams.has("limit")) {
    paginationParams.pageSize = 1000;
    paginationParams.offset = (paginationParams.page - 1) * paginationParams.pageSize;
  }

  const hasInspection = url.searchParams.get("has_inspection") === "true";
  let structureIdParam: string | null = url.searchParams.get("structure_id");
  if (structureIdParam === "undefined" || structureIdParam === "null" || !structureIdParam) {
    structureIdParam = null;
  }
  const singleIdParam = url.searchParams.get("id");
  let structureTitleParam: string | null = url.searchParams.get("structure_title");
  if (structureTitleParam === "undefined" || structureTitleParam === "null" || !structureTitleParam) {
    structureTitleParam = null;
  }

  // Helper to sort jobpacks by start date in memory
  const sortByDate = (items: any[]) => {
    return items.sort((a: any, b: any) => {
      const dateA = a.metadata?.istart || a.metadata?.date_start || "";
      const dateB = b.metadata?.istart || b.metadata?.date_start || "";
      return dateB.localeCompare(dateA);
    });
  };

  // --- Single jobpack by ID (includes full metadata) ---
  if (singleIdParam) {
    const { data, error } = await (supabase as any)
      .from("jobpack")
      .select("*")
      .eq("id", Number(singleIdParam))
      .single();
    if (error) return handleSupabaseError(error, "Failed to fetch jobpack");
    return NextResponse.json({ data });
  }

  // --- Jobpacks with inspection data (checked BEFORE the structure path so
  // has_inspection=true&structure_id=… keeps the inspection-filtered semantics) ---
  if (hasInspection) {
    const [diveRes, rovRes, recRes] = await Promise.all([
      (supabase as any).from("insp_dive_jobs").select("jobpack_id").not("jobpack_id", "is", null),
      (supabase as any).from("insp_rov_jobs").select("jobpack_id").not("jobpack_id", "is", null),
      (supabase as any).from("insp_records").select("jobpack_id").not("jobpack_id", "is", null),
    ]);

    let allIds = new Set<number>();
    (diveRes?.data || []).forEach((r: any) => r.jobpack_id && allIds.add(Number(r.jobpack_id)));
    (rovRes?.data || []).forEach((r: any) => r.jobpack_id && allIds.add(Number(r.jobpack_id)));
    (recRes?.data || []).forEach((r: any) => r.jobpack_id && allIds.add(Number(r.jobpack_id)));

    if (structureIdParam || structureTitleParam) {
      let sowQuery = (supabase as any)
        .from("u_sow")
        .select("jobpack_id")
        .not("jobpack_id", "is", null);

      if (structureIdParam && structureTitleParam) {
        sowQuery = sowQuery.or(`structure_id.eq.${structureIdParam},structure_title.eq."${structureTitleParam}"`);
      } else if (structureIdParam) {
        sowQuery = sowQuery.eq("structure_id", structureIdParam);
      } else if (structureTitleParam) {
        sowQuery = sowQuery.eq("structure_title", structureTitleParam);
      }

      const { data: sowData } = await sowQuery;

      const sowIds = new Set<number>();
      (sowData || []).forEach((r: any) => r.jobpack_id && sowIds.add(Number(r.jobpack_id)));
      
      allIds = new Set(Array.from(allIds).filter(x => sowIds.has(x)));
    }

    if (allIds.size === 0) {
      return apiPaginated([], createPaginationMeta(paginationParams, 0));
    }

    // Small set — metadata is fine
    const { data, error } = await (supabase as any)
      .from("jobpack")
      .select("*")
      .in("id", Array.from(allIds))
      .order("id", { ascending: false });

    if (error) return handleSupabaseError(error, "Failed to fetch jobpack");
    const sorted = sortByDate(data || []);
    return apiPaginated(sorted, createPaginationMeta(paginationParams, sorted.length));
  }

  // --- Jobpacks for a specific structure (uses relational tables only — NO metadata scan) ---
  if (structureIdParam) {
    const rawSIdStr = String(structureIdParam).replace(/^(platform|pipeline)-/, "");
    const sIdNum = Number(rawSIdStr);
    const validNum = !isNaN(sIdNum);

    // 1. Find jobpack IDs from relational tables
    const sowQuery = validNum
      ? (supabase as any).from("u_sow").select("jobpack_id").eq("structure_id", sIdNum).not("jobpack_id", "is", null)
      : Promise.resolve({ data: [] });
    const recQuery = validNum
      ? (supabase as any).from("insp_records").select("jobpack_id").eq("structure_id", sIdNum).not("jobpack_id", "is", null)
      : Promise.resolve({ data: [] });
    const diveQuery = validNum
      ? (supabase as any).from("insp_dive_jobs").select("jobpack_id").eq("structure_id", sIdNum).not("jobpack_id", "is", null)
      : Promise.resolve({ data: [] });
    const rovQuery = validNum
      ? (supabase as any).from("insp_rov_jobs").select("jobpack_id").eq("structure_id", sIdNum).not("jobpack_id", "is", null)
      : Promise.resolve({ data: [] });

    const [sowJps, recJps, diveJps, rovJps] = await Promise.all([
      sowQuery,
      recQuery,
      diveQuery,
      rovQuery,
    ]);

    const matchedJpIds = new Set<number>();
    (Array.isArray(sowJps?.data) ? sowJps.data : []).forEach((r: any) => r.jobpack_id && matchedJpIds.add(Number(r.jobpack_id)));
    (Array.isArray(recJps?.data) ? recJps.data : []).forEach((r: any) => r.jobpack_id && matchedJpIds.add(Number(r.jobpack_id)));
    (Array.isArray(diveJps?.data) ? diveJps.data : []).forEach((r: any) => r.jobpack_id && matchedJpIds.add(Number(r.jobpack_id)));
    (Array.isArray(rovJps?.data) ? rovJps.data : []).forEach((r: any) => r.jobpack_id && matchedJpIds.add(Number(r.jobpack_id)));

    // 2. Also scan jobpack metadata.structures to catch jobpacks only linked via metadata
    const { data: jobpackBatch } = await (supabase as any)
      .from("jobpack")
      .select("id, metadata")
      .limit(1000);

    if (Array.isArray(jobpackBatch)) {
      jobpackBatch.forEach((jp: any) => {
        const structures = jp.metadata?.structures || [];
        if (Array.isArray(structures)) {
          const matches = structures.some((s: any) => {
            const sid = String(s.id || s.structure_id || s.platform_id || "").replace(/^(platform|pipeline)-/, "");
            return sid === rawSIdStr || (validNum && Number(sid) === sIdNum);
          });
          if (matches) matchedJpIds.add(Number(jp.id));
        }
      });
    }

    if (matchedJpIds.size === 0) {
      return apiPaginated([], createPaginationMeta(paginationParams, 0));
    }

    // 3. Fetch only the matched jobpacks with full metadata (small set — fast)
    const { data, error } = await (supabase as any)
      .from("jobpack")
      .select("*")
      .in("id", Array.from(matchedJpIds))
      .order("id", { ascending: false });

    if (error) return handleSupabaseError(error, "Failed to fetch jobpack");
    const sorted = sortByDate(data || []);
    return apiPaginated(sorted, createPaginationMeta(paginationParams, sorted.length));
  }

  // --- Default listing: lean (NO metadata) to avoid timeouts ---
  let query = (supabase as any)
    .from("jobpack")
    .select("id, name, status, created_at, updated_at, company_id")
    .order("id", { ascending: false });

  query = applyPagination(query, paginationParams);

  const { data, error, count } = await query;

  if (error) {
    return handleSupabaseError(error, "Failed to fetch jobpack");
  }

  const pagination = createPaginationMeta(paginationParams, count || 0);

  return apiPaginated(data || [], pagination);
});

export const POST = withAuth(async (request: NextRequest, { user }: { user: any }) => {
  const supabase = createClient();
  const body = await request.json();

  const { data, error } = await (supabase as any)
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
});


