import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getPaginationParams, createPaginationMeta, applyPagination } from "@/utils/pagination";
import { apiPaginated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withTenant } from "@/utils/tenant-auth";

export const GET = withTenant(async (request, { companyId }) => {
  const supabase = createClient();
  const paginationParams = getPaginationParams(request);

  let structureQuery = (supabase as any).from("structure").select("*", { count: "exact" }).eq("company_id", companyId);

  // Apply pagination
  structureQuery = applyPagination(structureQuery, paginationParams);

  const { data: structures, error, count } = await structureQuery;

  const platformIds = (structures as any[])
    ?.filter((item: any) => item.str_type === "PLATFORM")
    .map((item: any) => item.str_id);
  const pipelineIds = (structures as any[])
    ?.filter((item: any) => item.str_type === "PIPELINE")
    .map((item: any) => item.str_id);

  const { data: platforms } = await supabase
    .from("platform")
    .select("*")
    .in("plat_id", platformIds || []);
  const { data: pipelines } = await supabase
    .from("u_pipeline")
    .select("*")
    .in("pipe_id", pipelineIds || []);

  //should return only required fields
  const result = (structures as any[])
    ?.filter((item: any) => item.str_type == "PLATFORM" || item.str_type == "PIPELINE")
    .map((item: any) => {
      const resultObj = {
        str_id: 0,
        str_title: "",
        str_field: "",
        str_type: "",
      };
      if (item.str_type === "PLATFORM") {
        const platform = platforms?.find((platform) => platform.plat_id === item.str_id);
        resultObj.str_id = item.str_id;
        resultObj.str_title = platform?.title!;
        resultObj.str_field = platform?.pfield!;
        resultObj.str_type = item.str_type;
        return resultObj;
      } else if (item.str_type === "PIPELINE") {
        const pipline = pipelines?.find((pipeline) => pipeline.pipe_id === item.str_id);
        resultObj.str_id = item.str_id;
        resultObj.str_title = pipline?.title!;
        resultObj.str_field = pipline?.pfield!;
        resultObj.str_type = item.str_type;
        return resultObj;
      }
      return;
    });

  if (error) {
    return handleSupabaseError(error, "Failed to fetch structures");
  }

  // Create pagination metadata
  const pagination = createPaginationMeta(paginationParams, count || 0);

  return apiPaginated(result || [], pagination);
});
