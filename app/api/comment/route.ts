import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getPaginationParams, createPaginationMeta, applyPagination } from "@/utils/pagination";
import { apiPaginated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";

/**
 * GET /api/comment
 * Fetch all comments with pagination
 * Query params: ?page=1&pageSize=50
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const paginationParams = getPaginationParams(request);

  // Build query with count for pagination metadata
  let query = supabase.from("comment").select("*", { count: "exact" });

  // Apply pagination
  query = applyPagination(query, paginationParams);

  const { data, error, count } = await query;

  if (error) {
    return handleSupabaseError(error, "Failed to fetch comments");
  }

  // Create pagination metadata
  const pagination = createPaginationMeta(paginationParams, count || 0);

  return apiPaginated(data || [], pagination);
}

export async function POST(request: Request, context: any) {
  const supabase = createClient();
  const body = await request.json();
  console.log(body);
  const { data, error } = await supabase.from("comment").insert(body);

  if (error) {
    console.error(error.message);
    return NextResponse.json({ error: "Failed to insert comment" });
  }

  return NextResponse.json({ comment: data });
}
