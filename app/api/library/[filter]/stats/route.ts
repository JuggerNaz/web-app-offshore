import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ filter: string }> }) {
    const { filter } = await params;
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("company_id") || 
      request.headers.get("x-company-id") || 
      (request as any).cookies?.get?.("active_company_id")?.value;

    // Get field info
    let fieldQuery = (supabase as any)
        .from("u_lib_list")
        .select()
        .eq("lib_code", "OILFIELD")
        .eq("lib_id", filter);

    if (companyId) {
        fieldQuery = fieldQuery.eq("company_id", companyId);
    }

    const { data: fieldData, error: fieldError } = (await fieldQuery.maybeSingle()) as any;

    if (fieldError || !fieldData) {
        return NextResponse.json({ error: `Failed to fetch field` }, { status: 404 });
    }

    // Count platforms for this field
    let platQuery = (supabase as any)
        .from("platform")
        .select("*", { count: "exact", head: true })
        .eq("pfield", filter);

    if (companyId) {
        platQuery = platQuery.eq("company_id", companyId);
    }

    const { count: platformCount, error: platformError } = (await platQuery) as any;

    if (platformError) {
        return NextResponse.json({ error: `Failed to count platforms` }, { status: 500 });
    }

    // Count pipelines for this field
    let pipeQuery = (supabase as any)
        .from("u_pipeline")
        .select("*", { count: "exact", head: true })
        .eq("pfield", filter);

    if (companyId) {
        pipeQuery = pipeQuery.eq("company_id", companyId);
    }

    const { count: pipelineCount, error: pipelineError } = await pipeQuery;

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
