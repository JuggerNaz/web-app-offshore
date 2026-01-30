import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess, apiError } from "@/utils/api-response";

export async function GET(request: NextRequest) {
    const supabase = createClient();
    const searchParams = request.nextUrl.searchParams;
    const strType = searchParams.get("str_type");

    try {
        // Filter by structure type if provided
        // currently disabled pending schema verification
        // if (strType) { ... }

        const { data, error } = await supabase
            .from("inspection_type" as any)
            .select("*");

        if (error) throw error;

        return apiSuccess(data || []);
    } catch (error: any) {
        return apiError(error instanceof Error ? error.message : "Failed to fetch inspection types", 500);
    }
}
