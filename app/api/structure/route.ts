import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getPaginationParams, createPaginationMeta, applyPagination } from "@/utils/pagination";
import { apiPaginated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";

/**
 * GET /api/structure
 * Fetch all structures with pagination
 * Query params: ?page=1&pageSize=50
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const paginationParams = getPaginationParams(request);

  // Build query with count for pagination metadata
  let structureQuery = supabase.from("structure").select("*", { count: "exact" });

  // Apply pagination
  structureQuery = applyPagination(structureQuery, paginationParams);

  const { data: structures, error, count } = await structureQuery;

  const platformIds = structures
    ?.filter((item) => item.str_type === "PLATFORM")
    .map((item) => item.str_id);
  const pipelineIds = structures
    ?.filter((item) => item.str_type === "PIPELINE")
    .map((item) => item.str_id);

  const { data: platforms } = await supabase
    .from("platform")
    .select("*")
    .in("plat_id", platformIds || []);
  const { data: pipelines } = await supabase
    .from("u_pipeline")
    .select("*")
    .in("pipe_id", pipelineIds || []);

  //should return only required fields
  const result = structures
    ?.filter((item) => item.str_type == "PLATFORM" || item.str_type == "PIPELINE")
    .map((item) => {
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
}
