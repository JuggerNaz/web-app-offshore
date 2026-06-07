import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getPaginationParams, createPaginationMeta, applyPagination } from "@/utils/pagination";
import { apiPaginated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withTenant } from "@/utils/tenant-auth";

export const GET = withTenant(async (request, { companyId }) => {
  const supabase = createClient();
  const paginationParams = getPaginationParams(request);

  let query = (supabase as any).from("comment").select("*", { count: "exact" }).eq("company_id", companyId);

  query = applyPagination(query, paginationParams);

  const { data, error, count } = await query;

  if (error) {
    return handleSupabaseError(error, "Failed to fetch comments");
  }

  const pagination = createPaginationMeta(paginationParams, count || 0);

  return apiPaginated(data || [], pagination);
});

export const POST = withTenant(async (request, { companyId }) => {
  const supabase = createClient();
  const body = await request.json();
  console.log(body);
  const { data, error } = await (supabase as any).from("comment").insert({ ...body, company_id: companyId });

  if (error) {
    console.error(error.message);
    return NextResponse.json({ error: "Failed to insert comment" });
  }

  return NextResponse.json({ comment: data });
});
