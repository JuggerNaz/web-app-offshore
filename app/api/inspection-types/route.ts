import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess, apiError } from "@/utils/api-response";
import { withTenant } from "@/utils/tenant-auth";
import { withCacheHeaders } from "@/utils/api-cache";

export const GET = withTenant(async (request) => {
    const supabase = createClient();
    const searchParams = request.nextUrl.searchParams;
    const strType = searchParams.get("str_type");

    try {
        const { data, error } = await supabase
            .from("inspection_type" as any)
            .select("*");

        if (error) throw error;

        // Reference data — safe to cache briefly per browser.
        return withCacheHeaders(apiSuccess(data || []), 300);
    } catch (error: any) {
        return apiError(error instanceof Error ? error.message : "Failed to fetch inspection types", 500);
    }
});
