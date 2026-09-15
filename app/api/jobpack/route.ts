import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getPaginationParams, createPaginationMeta, applyPagination } from "@/utils/pagination";
import { apiPaginated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth, withOptionalAuth } from "@/utils/with-auth";

let serverJobpackCache: { data: any[]; timestamp: number } | null = null;
const JOBPACK_CACHE_TTL_MS = 60 * 1000; // 60s

async function getAllJobpacksCached(supabase: any) {
  const now = Date.now();
  if (serverJobpackCache && now - serverJobpackCache.timestamp < JOBPACK_CACHE_TTL_MS) {
    return serverJobpackCache.data;
  }
  const { data, error } = await supabase
    .from("jobpack")
    .select("*")
    .order("id", { ascending: false });

  if (error || !data) {
    return serverJobpackCache?.data || [];
  }
  serverJobpackCache = { data, timestamp: now };
  return data;
}

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
    const allJps = await getAllJobpacksCached(supabase);
    const found = allJps.find((jp: any) => Number(jp.id) === Number(singleIdParam));
    if (found) {
      return NextResponse.json({ data: found });
    }
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

    const allJps = await getAllJobpacksCached(supabase);
    const filtered = allJps.filter((jp: any) => allIds.has(Number(jp.id)));
    const sorted = sortByDate(filtered);
    return apiPaginated(sorted, createPaginationMeta(paginationParams, sorted.length));
  }

  // --- Jobpacks for a specific structure (uses relational tables and cached metadata scan) ---
  if (structureIdParam || structureTitleParam) {
    const rawSIdStr = structureIdParam ? String(structureIdParam).replace(/^(platform|pipeline)-/, "") : "";
    const sIdNum = Number(rawSIdStr);
    const validNum = !isNaN(sIdNum) && rawSIdStr !== "";

    // 1. Find jobpack IDs from relational tables in parallel
    const sowQuery = validNum
      ? (structureTitleParam
          ? (supabase as any).from("u_sow").select("jobpack_id").or(`structure_id.eq.${sIdNum},structure_title.eq."${structureTitleParam}"`).not("jobpack_id", "is", null)
          : (supabase as any).from("u_sow").select("jobpack_id").eq("structure_id", sIdNum).not("jobpack_id", "is", null))
      : (structureTitleParam
          ? (supabase as any).from("u_sow").select("jobpack_id").eq("structure_title", structureTitleParam).not("jobpack_id", "is", null)
          : Promise.resolve({ data: [] }));

    const recQuery = validNum
      ? (supabase as any).from("insp_records").select("jobpack_id").eq("structure_id", sIdNum).not("jobpack_id", "is", null)
      : Promise.resolve({ data: [] });
    const diveQuery = validNum
      ? (supabase as any).from("insp_dive_jobs").select("jobpack_id").eq("structure_id", sIdNum).not("jobpack_id", "is", null)
      : Promise.resolve({ data: [] });
    const rovQuery = validNum
      ? (supabase as any).from("insp_rov_jobs").select("jobpack_id").eq("structure_id", sIdNum).not("jobpack_id", "is", null)
      : Promise.resolve({ data: [] });

    const [sowJps, recJps, diveJps, rovJps, allJobpacks] = await Promise.all([
      sowQuery,
      recQuery,
      diveQuery,
      rovQuery,
      getAllJobpacksCached(supabase),
    ]);

    const matchedJpIds = new Set<number>();
    (Array.isArray(sowJps?.data) ? sowJps.data : []).forEach((r: any) => r.jobpack_id && matchedJpIds.add(Number(r.jobpack_id)));
    (Array.isArray(recJps?.data) ? recJps.data : []).forEach((r: any) => r.jobpack_id && matchedJpIds.add(Number(r.jobpack_id)));
    (Array.isArray(diveJps?.data) ? diveJps.data : []).forEach((r: any) => r.jobpack_id && matchedJpIds.add(Number(r.jobpack_id)));
    (Array.isArray(rovJps?.data) ? rovJps.data : []).forEach((r: any) => r.jobpack_id && matchedJpIds.add(Number(r.jobpack_id)));

    // 2. Scan in-memory jobpack list for metadata structures
    if (Array.isArray(allJobpacks)) {
      const cleanTitle = structureTitleParam?.toLowerCase().trim();
      allJobpacks.forEach((jp: any) => {
        const structures = jp.metadata?.structures || [];
        let matches = false;
        if (Array.isArray(structures)) {
          matches = structures.some((s: any) => {
            const sid = String(s.id || s.structure_id || s.platform_id || s.pipe_id || "").replace(/^(platform|pipeline)-/, "");
            if (rawSIdStr && (sid === rawSIdStr || (validNum && Number(sid) === sIdNum))) return true;
            if (cleanTitle) {
              const sName = String(s.title || s.name || s.code || "").toLowerCase().trim();
              if (sName === cleanTitle) return true;
            }
            return false;
          });
        }
        if (!matches) {
          const directSId = String(jp.metadata?.structure_id || jp.metadata?.platform_id || jp.metadata?.pipe_id || jp.metadata?.plat_id || "").replace(/^(platform|pipeline)-/, "");
          if (rawSIdStr && directSId && (directSId === rawSIdStr || (validNum && Number(directSId) === sIdNum))) {
            matches = true;
          }
          if (!matches && cleanTitle) {
            const directTitle = String(jp.metadata?.structure_name || jp.metadata?.plantype || jp.metadata?.title || "").toLowerCase().trim();
            if (directTitle && (directTitle === cleanTitle || directTitle.includes(cleanTitle) || cleanTitle.includes(directTitle))) {
              matches = true;
            }
          }
        }
        if (matches) matchedJpIds.add(Number(jp.id));
      });
    }

    if (matchedJpIds.size === 0) {
      return apiPaginated([], createPaginationMeta(paginationParams, 0));
    }

    // Filter matched jobpacks directly from in-memory cache
    const matched = allJobpacks.filter((jp: any) => matchedJpIds.has(Number(jp.id)));
    const sorted = sortByDate(matched);
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

  serverJobpackCache = null; // Invalidate cache on new jobpack creation

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


