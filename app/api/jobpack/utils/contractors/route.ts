import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess, apiError } from "@/utils/api-response";

export async function GET(request: NextRequest) {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from("u_lib_list")
            .select("*")
            .eq("lib_code", "CONTR_NAM") // Category: Contractor Name
            .or("lib_delete.is.null,lib_delete.eq.0") // Active items only
            .order("lib_desc", { ascending: true });

        if (error) {
            console.error("Contractor fetch error:", error);
            throw error;
        }

        return apiSuccess(data || []);
    } catch (error: any) {
        console.error("Contractor API Exception:", error);
        return apiError(error instanceof Error ? error.message : "Failed to fetch contractors", 500);
    }
}
