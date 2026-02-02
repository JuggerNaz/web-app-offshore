import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess, apiError } from "@/utils/api-response";

export async function GET(request: NextRequest) {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from("workpl")
            .select("inspno")
            .order("inspno", { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== "PGRST116") {
            throw error;
        }

        let nextSeq = 1;
        if (data?.inspno) {
            const current = parseInt(data.inspno, 10);
            if (!isNaN(current)) {
                nextSeq = current + 1;
            }
        }

        const formatted = nextSeq.toString().padStart(11, "0");

        return apiSuccess({ nextInspNo: formatted });
    } catch (error: any) {
        return apiError(error instanceof Error ? error.message : "Failed to generate sequence");
    }
}
