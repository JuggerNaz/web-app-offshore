import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
    const supabase = createClient();

    // Get all oil fields
    const { data: fields, error: fieldsError } = await supabase
        .from("u_lib_list")
        .select("*")
        .eq("lib_code", "OILFIELD")
        .order("lib_id");

    if (fieldsError) {
        return NextResponse.json({ error: `Failed to fetch fields` }, { status: 500 });
    }

    // Get counts for each field and filter out fields with no structures
    const fieldsWithStats = await Promise.all(
        (fields || []).map(async (field) => {
            // Count platforms
            const { count: platformCount } = await supabase
                .from("platform")
                .select("*", { count: "exact", head: true })
                .eq("pfield", field.lib_id);

            // Count pipelines
            const { count: pipelineCount } = await supabase
                .from("u_pipeline")
                .select("*", { count: "exact", head: true })
                .eq("pfield", field.lib_id);

            return {
                ...field,
                platform_count: platformCount || 0,
                pipeline_count: pipelineCount || 0,
            };
        })
    );

    // Filter to only include fields that have at least one structure (platform or pipeline)
    const fieldsWithStructures = fieldsWithStats.filter(
        (field) => field.platform_count > 0 || field.pipeline_count > 0
    );

    return NextResponse.json({ data: fieldsWithStructures });
}
