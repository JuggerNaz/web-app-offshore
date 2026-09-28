import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getPaginationParams, createPaginationMeta, applyPagination } from "@/utils/pagination";
import { apiPaginated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth, withOptionalAuth } from "@/utils/with-auth";
import { withTenant, TenantContext } from "@/utils/tenant-auth";
import { getUserMembership } from "@/utils/role-auth";

let serverJobpackCache = new Map<string, { data: any[]; timestamp: number }>();
const JOBPACK_CACHE_TTL_MS = 60 * 1000; // 60s

async function getAllJobpacksCached(supabase: any, companyId?: string) {
  const cacheKey = companyId || "global";
  const now = Date.now();
  const cached = serverJobpackCache.get(cacheKey);
  if (cached && now - cached.timestamp < JOBPACK_CACHE_TTL_MS) {
    return cached.data;
  }
  let query = supabase
    .from("jobpack")
    .select("*")
    .order("id", { ascending: false });

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return cached?.data || [];
  }
  serverJobpackCache.set(cacheKey, { data, timestamp: now });
  return data;
}

export const GET = withOptionalAuth(async (request: NextRequest, { user }: { user: any }) => {
  const supabase = createClient();

  const paginationParams = getPaginationParams(request);

  const url = new URL(request.url);
  let companyId = url.searchParams.get("company_id") || request.headers.get("x-company-id") || request.cookies.get("active_company_id")?.value;

  if (!companyId && user?.id) {
    const membershipRes = await getUserMembership(supabase, user.id);
    if (!("error" in membershipRes) && membershipRes.company?.id) {
      companyId = membershipRes.company.id;
    }
  }

  if (!url.searchParams.has("pageSize") && !url.searchParams.has("limit")) {
    paginationParams.pageSize = 1000;
    paginationParams.offset = (paginationParams.page - 1) * paginationParams.pageSize;
  }

  const hasInspection = url.searchParams.get("has_inspection") === "true";
  let structureIdParam: string | null = url.searchParams.get("structure_id") || url.searchParams.get("structure_ids");
  if (structureIdParam === "undefined" || structureIdParam === "null" || !structureIdParam) {
    structureIdParam = null;
  }
  const singleIdParam = url.searchParams.get("id");
  let structureTitleParam: string | null =
    url.searchParams.get("structure_title") ||
    url.searchParams.get("structure_titles") ||
    url.searchParams.get("structure_name") ||
    url.searchParams.get("structure_names");
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
    const allJps = await getAllJobpacksCached(supabase, companyId);
    const found = allJps.find((jp: any) => Number(jp.id) === Number(singleIdParam));
    if (found) {
      return NextResponse.json({ data: found });
    }
    let singleQuery = (supabase as any)
      .from("jobpack")
      .select("*")
      .eq("id", Number(singleIdParam));

    if (companyId) {
      singleQuery = singleQuery.eq("company_id", companyId);
    }

    const { data, error } = await singleQuery.single();
    if (error) return handleSupabaseError(error, "Failed to fetch jobpack");
    return NextResponse.json({ data });
  }

  // --- Jobpacks with inspection data (checked BEFORE the structure path so
  // has_inspection=true&structure_id=… keeps the inspection-filtered semantics) ---
  if (hasInspection) {
    let diveQ = (supabase as any).from("insp_dive_jobs").select("jobpack_id").not("jobpack_id", "is", null);
    let rovQ = (supabase as any).from("insp_rov_jobs").select("jobpack_id").not("jobpack_id", "is", null);
    let recQ = (supabase as any).from("insp_records").select("jobpack_id").not("jobpack_id", "is", null);

    if (companyId) {
      diveQ = diveQ.eq("company_id", companyId);
      rovQ = rovQ.eq("company_id", companyId);
      recQ = recQ.eq("company_id", companyId);
    }

    const [diveRes, rovRes, recRes] = await Promise.all([diveQ, rovQ, recQ]);

    let allIds = new Set<number>();
    (diveRes?.data || []).forEach((r: any) => r.jobpack_id && allIds.add(Number(r.jobpack_id)));
    (rovRes?.data || []).forEach((r: any) => r.jobpack_id && allIds.add(Number(r.jobpack_id)));
    (recRes?.data || []).forEach((r: any) => r.jobpack_id && allIds.add(Number(r.jobpack_id)));

    if (structureIdParam || structureTitleParam) {
      const rawSIds = structureIdParam
        ? structureIdParam.split(",").map((s) => s.trim().replace(/^(platform|pipeline)-/, "")).filter(Boolean)
        : [];
      const sIdNums = rawSIds.map(Number).filter((n) => !isNaN(n));

      let sowQuery = (supabase as any)
        .from("u_sow")
        .select("jobpack_id")
        .not("jobpack_id", "is", null);

      if (companyId) {
        sowQuery = sowQuery.eq("company_id", companyId);
      }

      if (sIdNums.length > 1) {
        sowQuery = sowQuery.in("structure_id", sIdNums);
      } else if (sIdNums.length === 1 && structureTitleParam) {
        sowQuery = sowQuery.or(`structure_id.eq.${sIdNums[0]},structure_title.eq."${structureTitleParam}"`);
      } else if (sIdNums.length === 1) {
        sowQuery = sowQuery.eq("structure_id", sIdNums[0]);
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

    const allJps = await getAllJobpacksCached(supabase, companyId);
    const filtered = allJps.filter((jp: any) => allIds.has(Number(jp.id)));
    const sorted = sortByDate(filtered);
    return apiPaginated(sorted, createPaginationMeta(paginationParams, sorted.length));
  }

  // --- Jobpacks for specific structure(s) (uses relational tables and cached metadata scan) ---
  if (structureIdParam || structureTitleParam) {
    const rawSIds = structureIdParam
      ? structureIdParam.split(",").map((s) => s.trim().replace(/^(platform|pipeline)-/, "")).filter(Boolean)
      : [];
    const sIdNums = rawSIds.map(Number).filter((n) => !isNaN(n));
    const cleanTitles = structureTitleParam
      ? structureTitleParam.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
      : [];

    // 1. Find jobpack IDs from relational tables in parallel
    let sowQuery = (supabase as any).from("u_sow").select("jobpack_id, structure_id, structure_title").not("jobpack_id", "is", null);
    let recQuery = (supabase as any).from("insp_records").select("jobpack_id, structure_id").not("jobpack_id", "is", null);
    let diveQuery = (supabase as any).from("insp_dive_jobs").select("jobpack_id, structure_id").not("jobpack_id", "is", null);
    let rovQuery = (supabase as any).from("insp_rov_jobs").select("jobpack_id, structure_id").not("jobpack_id", "is", null);

    if (sIdNums.length > 0) {
      recQuery = recQuery.in("structure_id", sIdNums);
      diveQuery = diveQuery.in("structure_id", sIdNums);
      rovQuery = rovQuery.in("structure_id", sIdNums);
    } else {
      recQuery = Promise.resolve({ data: [] });
      diveQuery = Promise.resolve({ data: [] });
      rovQuery = Promise.resolve({ data: [] });
    }

    if (sIdNums.length > 0 && cleanTitles.length > 0) {
      sowQuery = sowQuery.or(`structure_id.in.(${sIdNums.join(",")}),structure_title.in.(${cleanTitles.map((t) => `"${t}"`).join(",")})`);
    } else if (sIdNums.length > 0) {
      sowQuery = sowQuery.in("structure_id", sIdNums);
    } else if (cleanTitles.length > 0) {
      sowQuery = sowQuery.in("structure_title", cleanTitles);
    } else {
      sowQuery = Promise.resolve({ data: [] });
    }

    if (companyId) {
      if (typeof sowQuery.eq === "function" || typeof sowQuery.in === "function") sowQuery = sowQuery.eq("company_id", companyId);
      if (typeof recQuery.eq === "function" || typeof recQuery.in === "function") recQuery = recQuery.eq("company_id", companyId);
      if (typeof diveQuery.eq === "function" || typeof diveQuery.in === "function") diveQuery = diveQuery.eq("company_id", companyId);
      if (typeof rovQuery.eq === "function" || typeof rovQuery.in === "function") rovQuery = rovQuery.eq("company_id", companyId);
    }

    const [sowJps, recJps, diveJps, rovJps, allJobpacks] = await Promise.all([
      sowQuery,
      recQuery,
      diveQuery,
      rovQuery,
      getAllJobpacksCached(supabase, companyId),
    ]);

    const matchedJpIds = new Set<number>();
    (Array.isArray(sowJps?.data) ? sowJps.data : []).forEach((r: any) => r.jobpack_id && matchedJpIds.add(Number(r.jobpack_id)));
    (Array.isArray(recJps?.data) ? recJps.data : []).forEach((r: any) => r.jobpack_id && matchedJpIds.add(Number(r.jobpack_id)));
    (Array.isArray(diveJps?.data) ? diveJps.data : []).forEach((r: any) => r.jobpack_id && matchedJpIds.add(Number(r.jobpack_id)));
    (Array.isArray(rovJps?.data) ? rovJps.data : []).forEach((r: any) => r.jobpack_id && matchedJpIds.add(Number(r.jobpack_id)));

    // 2. Scan in-memory jobpack list for metadata structures
    if (Array.isArray(allJobpacks)) {
      const sIdNumSet = new Set(sIdNums);
      const rawSIdSet = new Set(rawSIds);

      allJobpacks.forEach((jp: any) => {
        const structures = jp.metadata?.structures || [];
        let matches = false;
        if (Array.isArray(structures)) {
          matches = structures.some((s: any) => {
            const sid = String(s.id || s.structure_id || s.platform_id || s.pipe_id || s.str_id || s.plat_id || "").replace(/^(platform|pipeline)-/, "");
            const num = Number(sid);
            if (sid && (rawSIdSet.has(sid) || (!isNaN(num) && sIdNumSet.has(num)))) return true;
            if (cleanTitles.length > 0) {
              const sName = String(s.title || s.name || s.code || "").toLowerCase().trim();
              if (sName && cleanTitles.some((ct) => sName === ct || sName.includes(ct) || ct.includes(sName))) return true;
            }
            return false;
          });
        }
        if (!matches) {
          const directSId = String(jp.metadata?.structure_id || jp.metadata?.platform_id || jp.metadata?.pipe_id || jp.metadata?.plat_id || jp.metadata?.str_id || "").replace(/^(platform|pipeline)-/, "");
          const directNum = Number(directSId);
          if (directSId && (rawSIdSet.has(directSId) || (!isNaN(directNum) && sIdNumSet.has(directNum)))) {
            matches = true;
          }
          if (!matches && cleanTitles.length > 0) {
            const directTitle = String(jp.metadata?.structure_name || jp.metadata?.plantype || jp.metadata?.title || "").toLowerCase().trim();
            if (directTitle && cleanTitles.some((ct) => directTitle === ct || directTitle.includes(ct) || ct.includes(directTitle))) {
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

  // --- Default listing: includes metadata for plantype, tasktype, structures, and dates ---
  let query = (supabase as any)
    .from("jobpack")
    .select("id, name, status, metadata, created_at, updated_at, company_id")
    .order("id", { ascending: false });

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  query = applyPagination(query, paginationParams);

  const { data, error, count } = await query;

  if (error) {
    return handleSupabaseError(error, "Failed to fetch jobpack");
  }

  const pagination = createPaginationMeta(paginationParams, count || 0);

  return apiPaginated(data || [], pagination);
});

export const POST = withTenant(async (request: NextRequest, { user, companyId }: TenantContext) => {
  const supabase = createClient();
  const body = await request.json();

  serverJobpackCache.clear(); // Invalidate cache on new jobpack creation

  // Always guarantee company_id is populated from active tenant context
  body.company_id = body.company_id || companyId;

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


