import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request, context: any) {
    const { filter } = await context.params;

    const supabase = createClient();

    // Get field info
    const { data: fieldData, error: fieldError } = await supabase
        .from("u_lib_list")
        .select()
        .eq("lib_code", "OILFIELD")
        .eq("lib_id", filter)
        .single();

    if (fieldError) {
        return NextResponse.json({ error: `Failed to fetch field` }, { status: 500 });
    }

    // Count platforms for this field
    const { count: platformCount, error: platformError } = await supabase
        .from("platform")
        .select("*", { count: "exact", head: true })
        .eq("pfield", filter);

    if (platformError) {
        return NextResponse.json({ error: `Failed to count platforms` }, { status: 500 });
    }

    // Count pipelines for this field
    const { count: pipelineCount, error: pipelineError } = await supabase
        .from("u_pipeline")
        .select("*", { count: "exact", head: true })
        .eq("pfield", filter);

    if (pipelineError) {
        return NextResponse.json({ error: `Failed to count pipelines` }, { status: 500 });
    }

    return NextResponse.json({
        data: {
            ...fieldData,
            platform_count: platformCount || 0,
            pipeline_count: pipelineCount || 0,
        },
    });
}
