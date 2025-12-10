import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth } from "@/utils/with-auth";

/**
 * GET /api/components
 * Fetch all active component types
 */
export const GET = withAuth(async (request: NextRequest, { user }) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("components")
    .select("id, name, code, descrip, is_active")
    .eq("is_active", true)
    .order("name");

  if (error) {
    return handleSupabaseError(error, "Failed to fetch component types");
  }

  return apiSuccess(data || []);
});
