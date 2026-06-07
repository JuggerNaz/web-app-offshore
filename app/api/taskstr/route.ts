import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getPaginationParams, createPaginationMeta, applyPagination } from "@/utils/pagination";
import { apiPaginated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withTenant } from "@/utils/tenant-auth";

export const GET = withTenant(async (request, { companyId }) => {
  const supabase = createClient();
  const paginationParams = getPaginationParams(request);

  let query = (supabase as any).from("taskstr").select("*", { count: "exact" }).eq("company_id", companyId);

  query = applyPagination(query, paginationParams);

  const { data, error, count } = await query;

  if (error) {
    return handleSupabaseError(error, "Failed to fetch task structures");
  }

  const pagination = createPaginationMeta(paginationParams, count || 0);

  return apiPaginated(data || [], pagination);
});
