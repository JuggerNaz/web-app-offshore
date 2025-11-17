import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess, apiCreated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth } from "@/utils/with-auth";

/**
 * GET /api/platform
 * Fetch all platforms
 */
export const GET = withAuth(async (request: NextRequest, { user }) => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("platform")
    .select("*")
    .order("title");

  if (error) {
    return handleSupabaseError(error, "Failed to fetch platforms");
  }

  return apiSuccess(data);
});

/**
 * POST /api/platform
 * Create a new platform
 */
export const POST = withAuth(async (request: NextRequest, { user }) => {
  const supabase = createClient();
  const body = await request.json();

  // Remove plat_id if present (will be auto-generated)
  delete body.plat_id;

  // Insert platform
  const { data, error } = await supabase
    .from("platform")
    .insert(body)
    .select()
    .single();

  if (error) {
    return handleSupabaseError(error, "Failed to create platform");
  }

  // Create corresponding structure entry
  const { error: structureError } = await supabase
    .from("structure")
    .insert({ str_id: data.plat_id, str_type: "PLATFORM" });

  if (structureError) {
    // If structure creation fails, we should ideally rollback the platform creation
    // For now, log the error and continue
    console.error("[Platform API] Failed to create structure entry:", structureError);
  }

  return apiCreated(data);
});
