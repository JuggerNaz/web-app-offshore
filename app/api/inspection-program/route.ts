import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth } from "@/utils/with-auth";

/**
 * GET /api/inspection-program
 * Fetch all inspection programs
 */
export const GET = withAuth(async (request: NextRequest) => {
    const supabase = createClient();

    const { data, error } = await supabase
        .from("inspection_program")
        .select("*")
        .order("program", { ascending: true });

    if (error) {
        return handleSupabaseError(error, "Failed to fetch inspection programs");
    }

    return apiSuccess(data || []);
});
