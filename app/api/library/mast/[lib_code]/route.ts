import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";

/**
 * GET /api/library/mast/[lib_code]
 * Fetch items from u_lib_mast filtered by lib_code, using lib_name as the display field.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lib_code: string }> }
) {
  const supabase = createClient();
  const { lib_code } = await params;
  const decodedCode = decodeURIComponent(lib_code);

  const { data, error } = await supabase
    .from("u_lib_mast" as any)
    .select("*")
    .eq("lib_code", decodedCode)
    .order("lib_name", { ascending: true });

  if (error) {
    return handleSupabaseError(error, "Failed to fetch library items from u_lib_mast");
  }

  return apiSuccess(data);
}
