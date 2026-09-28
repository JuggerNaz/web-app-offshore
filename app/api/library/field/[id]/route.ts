import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth } from "@/utils/with-auth";

/**
 * GET /api/library/field/[id]
 * Fetch a single field by ID
 */
export const GET = withAuth(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const supabase = createClient();
    const { id: fieldId } = await params;
    const companyId = request.nextUrl.searchParams.get("company_id") || 
      request.headers.get("x-company-id") || 
      request.cookies.get("active_company_id")?.value;

    let query = supabase
        .from("u_lib_list" as any)
        .select("*")
        .eq("lib_id", fieldId)
        .eq("lib_code", "OILFIELD");

    if (companyId) {
        query = query.eq("company_id", companyId);
    }

    const { data, error } = await query.single();

    if (error) {
        return handleSupabaseError(error, "Failed to fetch field");
    }

    return apiSuccess(data);
});
