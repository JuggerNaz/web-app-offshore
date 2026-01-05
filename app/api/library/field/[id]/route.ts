import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth } from "@/utils/with-auth";

/**
 * GET /api/library/field/[id]
 * Fetch a single field by ID
 */
export const GET = withAuth(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const supabase = createClient();
    const { id: fieldId } = await context.params;

    const { data, error } = await supabase
        .from("u_lib_list")
        .select("*")
        .eq("lib_id", fieldId)
        .eq("lib_code", "OILFIELD")
        .single();

    if (error) {
        return handleSupabaseError(error, "Failed to fetch field");
    }

    return apiSuccess(data);
});
