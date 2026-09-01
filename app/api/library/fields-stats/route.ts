import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
    const supabase = createClient();

    // Get all oil fields
    const { data: fields, error: fieldsError } = await supabase
        .from("u_lib_list")
        .select("*")
        .eq("lib_code", "OILFIELD")
        .or("lib_delete.is.null,lib_delete.neq.1")
        .order("lib_id");

    if (fieldsError) {
        return NextResponse.json({ error: `Failed to fetch fields` }, { status: 500 });
    }

    // Replace the per-field count N+1 (2 queries per field) with two light
    // queries selecting only the `pfield` column, counted in JS.
    const [platformRes, pipelineRes] = await Promise.all([
        supabase.from("platform").select("pfield"),
        supabase.from("u_pipeline").select("pfield"),
    ]);

    const platformCounts = new Map<any, number>();
    for (const row of platformRes.data || []) {
        platformCounts.set(row.pfield, (platformCounts.get(row.pfield) || 0) + 1);
    }

    const pipelineCounts = new Map<any, number>();
    for (const row of pipelineRes.data || []) {
        pipelineCounts.set(row.pfield, (pipelineCounts.get(row.pfield) || 0) + 1);
    }

    const fieldsWithStats = (fields || []).map((field) => ({
        ...field,
        platform_count: platformCounts.get(field.lib_id) || 0,
        pipeline_count: pipelineCounts.get(field.lib_id) || 0,
    }));

    return NextResponse.json({ data: fieldsWithStats });
}
