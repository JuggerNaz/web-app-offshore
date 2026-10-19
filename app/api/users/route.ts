import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
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
export const GET = withAuth(async (request: NextRequest) => {
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

  const pagination = createPaginationMeta(paginationParams, count || 0);

  return apiPaginated(data || [], pagination);
});
