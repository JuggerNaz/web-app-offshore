import { NextRequest } from "next/server";
import { createClient, createAdminClient, isServiceRoleConfigured } from "@/utils/supabase/server";
import { withAuth } from "@/utils/with-auth";
import {
  getPaginationParams,
  createPaginationMeta,
  applyPagination,
  getSearchParam,
  buildSearchFilter,
} from "@/utils/pagination";
import { apiPaginated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";

/**
 * GET /api/users
 * Paginated access to the `get_all_users` RPC (id, email, role, modules,
 * presence + profile metadata). Replaces the previous pattern of client
 * components fetching the entire user table in one call.
 *
 * Query params: ?page=1&pageSize=50&q=<email / full name / designation search>
 */
export const GET = withAuth(async (request: NextRequest, { user: authUser }) => {
  const supabase = createClient();
  const paginationParams = getPaginationParams(request);
  const q = getSearchParam(request);

  // get_all_users is a set-returning (RETURNS TABLE) security definer
  // function, so PostgREST applies or-filters, range and exact count to it
  // like a regular table.
  let query: any = (supabase as any).rpc("get_all_users", {}, { count: "exact" });

  const searchFilter = buildSearchFilter(q, ["email", "full_name", "designation"]);
  if (searchFilter) {
    query = query.or(searchFilter);
  }

  query = applyPagination(query, paginationParams);

  const { data, error, count } = await query;

  if (error) {
    return handleSupabaseError(error, "Failed to fetch users");
  }

  if (data && data.length > 0) {
    let db = supabase as any;
    try {
      if (isServiceRoleConfigured()) {
        db = createAdminClient() as any;
      }
    } catch (_) {}

    const userIds = data.map((u: any) => u.id);

    try {
      const targetCompanyId = request.headers.get("x-company-id");

      let companyId = targetCompanyId;
      if (!companyId && authUser) {
        const { data: myMem } = await db
          .from("company_memberships")
          .select("company_id")
          .eq("user_id", authUser.id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        companyId = myMem?.company_id || null;
      }

      // 1. Fetch memberships scoped to target company
      let scopedMemQuery = db
        .from("company_memberships")
        .select("id, user_id, is_active, role, company_id")
        .in("user_id", userIds);

      if (companyId) {
        scopedMemQuery = scopedMemQuery.eq("company_id", companyId);
      }

      // 2. Fetch profiles table is_active
      // 3. Fallback: all memberships across companies
      const [scopedMemRes, profilesRes, allMemRes] = await Promise.all([
        scopedMemQuery,
        db.from("profiles").select("id, is_active").in("id", userIds),
        db.from("company_memberships").select("id, user_id, is_active").in("user_id", userIds),
      ]);

      const scopedMemMap = new Map<string, boolean>();
      if (scopedMemRes.data) {
        for (const m of scopedMemRes.data) {
          scopedMemMap.set(m.user_id, m.is_active);
        }
      }

      const profileActiveMap = new Map<string, boolean>();
      if (profilesRes.data) {
        for (const p of profilesRes.data) {
          if (p.is_active !== null && p.is_active !== undefined) {
            profileActiveMap.set(p.id, p.is_active);
          }
        }
      }

      const allMemMap = new Map<string, { hasActive: boolean; hasInactive: boolean }>();
      if (allMemRes.data) {
        for (const m of allMemRes.data) {
          const entry = allMemMap.get(m.user_id) || { hasActive: false, hasInactive: false };
          if (m.is_active === false) entry.hasInactive = true;
          if (m.is_active === true) entry.hasActive = true;
          allMemMap.set(m.user_id, entry);
        }
      }

      data.forEach((u: any) => {
        // Current logged-in user is always active while authenticated
        if (authUser && u.id === authUser.id) {
          u.is_active = true;
          return;
        }

        // Check scoped company membership status first
        const scopedActive = scopedMemMap.get(u.id);
        if (scopedActive !== undefined) {
          u.is_active = scopedActive;
          return;
        }

        // Check profiles table is_active
        const profileActive = profileActiveMap.get(u.id);
        if (profileActive !== undefined) {
          u.is_active = profileActive;
          return;
        }

        // Check all memberships
        const memStats = allMemMap.get(u.id);
        if (memStats) {
          if (memStats.hasInactive && !memStats.hasActive) {
            u.is_active = false;
            return;
          }
          if (memStats.hasInactive) {
            u.is_active = false;
            return;
          }
          if (memStats.hasActive) {
            u.is_active = true;
            return;
          }
        }

        // Default: if RPC returned is_active === false
        if (u.is_active === false) {
          u.is_active = false;
        } else {
          u.is_active = true;
        }
      });
    } catch (enrichErr) {
      console.warn("[GET /api/users] Error enriching is_active status:", enrichErr);
    }
  }

  const pagination = createPaginationMeta(paginationParams, count || 0);

  return apiPaginated(data || [], pagination);
});
