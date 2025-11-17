import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess, apiCreated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth } from "@/utils/with-auth";

/**
 * GET /api/pipeline
 * Fetch all pipelines
 */
export const GET = withAuth(async (request: NextRequest, { user }) => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("u_pipeline")
    .select("*");

  if (error) {
    return handleSupabaseError(error, "Failed to fetch pipelines");
  }

  return apiSuccess(data);
});

/**
 * POST /api/pipeline
 * Create a new pipeline
 */
export const POST = withAuth(async (request: NextRequest, { user }) => {
  const supabase = createClient();
  const body = await request.json();

  // Remove pipe_id if present (will be auto-generated)
  delete body.pipe_id;

  // Insert pipeline
  const { data, error } = await supabase
    .from("u_pipeline")
    .insert(body)
    .select()
    .single();

  if (error) {
    return handleSupabaseError(error, "Failed to create pipeline");
  }

  // Create corresponding structure entry
  const { error: structureError } = await supabase
    .from("structure")
    .insert({ str_id: data.pipe_id, str_type: "PIPELINE" });

  if (structureError) {
    // If structure creation fails, we should ideally rollback the pipeline creation
    // For now, log the error and continue
    console.error("[Pipeline API] Failed to create structure entry:", structureError);
  }

  return apiCreated(data);
});
