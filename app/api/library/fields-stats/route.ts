import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { withCacheHeaders } from "@/utils/api-cache";

export async function GET(request: Request) {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("company_id") || 
      request.headers.get("x-company-id") || 
      (request as any).cookies?.get?.("active_company_id")?.value;

    // Get all oil fields
    let fieldsQuery = (supabase as any)
        .from("u_lib_list")
        .select("*")
        .eq("lib_code", "OILFIELD")
        .or("lib_delete.is.null,lib_delete.neq.1");

    if (companyId) {
        fieldsQuery = fieldsQuery.eq("company_id", companyId);
    }

    const { data: fields, error: fieldsError } = (await fieldsQuery.order("lib_id")) as any;

    if (fieldsError) {
        return NextResponse.json({ error: `Failed to fetch fields` }, { status: 500 });
    }

    // Replace the per-field count N+1 (2 queries per field) with two light
    // queries selecting only the `pfield` column, counted in JS.
    let platQuery = (supabase as any).from("platform").select("pfield");
    let pipeQuery = (supabase as any).from("u_pipeline").select("pfield");

    if (companyId) {
        platQuery = platQuery.eq("company_id", companyId);
        pipeQuery = pipeQuery.eq("company_id", companyId);
    }

    const [platformRes, pipelineRes]: [any, any] = await Promise.all([
        platQuery,
        pipeQuery,
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

    // Reference data (field list + counts) — safe to cache briefly per browser.
    return withCacheHeaders(NextResponse.json({ data: fieldsWithStats }), 300);
}
