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
import { apiBadRequest, apiPaginated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";

/**
 * GET /api/structure-components/lookup
 *
 * Slim paged projection of structure_components for consumers that only need
 * identity/metadata fields (association pickers, duplicate-QID checks,
 * attachment dropdowns). Deliberately does NOT join insp_records / anomalies /
 * attachments like /api/structure-components/[structure_id] does.
 *
 * Query params:
 *   ?structure_id= (required)
 *   ?q=            (substring search over q_id / id_no / code)
 *   ?page=&pageSize=  (shared pagination helpers; pageSize max 1000)
 *
 * Rows are the default (active) set: is_deleted null or false, matching the
 * default view of /api/structure-components/[structure_id].
 */
export const GET = withAuth(async (request: NextRequest) => {
  const supabase = createClient();

  const structureIdRaw = request.nextUrl.searchParams.get("structure_id");
  const structureId = structureIdRaw ? Number(structureIdRaw) : NaN;
  if (isNaN(structureId)) {
    return apiBadRequest("structure_id query parameter is required");
  }

  const paginationParams = getPaginationParams(request);
  const q = getSearchParam(request);

  let query: any = supabase
    .from("structure_components")
    .select("id, comp_id, q_id, id_no, code, structure_id, metadata, is_deleted", {
      count: "exact",
    })
    .eq("structure_id", structureId)
    .or("is_deleted.is.null,is_deleted.eq.false");

  const searchFilter = buildSearchFilter(q, ["q_id", "id_no", "code"]);
  if (searchFilter) {
    query = query.or(searchFilter);
  }

  // Deterministic ordering keeps the paged windows stable.
  query = query.order("q_id");
  query = applyPagination(query, paginationParams);

  const { data, error, count } = await query;

  if (error) {
    return handleSupabaseError(error, "Failed to fetch structure components");
  }

  const pagination = createPaginationMeta(paginationParams, count || 0);

  return apiPaginated(data || [], pagination);
});
