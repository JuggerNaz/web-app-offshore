import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { withTenant } from "@/utils/tenant-auth";

export const GET = withTenant(async (request, { companyId }) => {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const jobpackIdRaw = searchParams.get("jobpack_id");
        const structureIdRaw = searchParams.get("structure_id");
        const sowReportNo = searchParams.get("sow_report_no");

        if (!jobpackIdRaw || !structureIdRaw || !sowReportNo) {
            return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
        }

        const jobpackId = parseInt(String(jobpackIdRaw).replace(/^(jobpack)-/, ""), 10);
        const structureId = parseInt(String(structureIdRaw).replace(/^(platform|pipeline)-/, ""), 10);

        if (isNaN(jobpackId) || isNaN(structureId)) {
            return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
        }

        let query = (supabase as any)
            .from("u_executive_summaries")
            .select("*")
            .eq("jobpack_id", jobpackId)
            .eq("structure_id", structureId)
            .eq("sow_report_no", sowReportNo);

        if (companyId) {
            query = query.or(`company_id.eq.${companyId},company_id.is.null`);
        }

        const { data, error } = await query.maybeSingle();

        if (error) throw error;

        return NextResponse.json({ data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});

export const POST = withTenant(async (request, { companyId }) => {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { jobpack_id, structure_id, sow_report_no, sections, metadata } = body;

        if (!jobpack_id || !structure_id || !sow_report_no) {
            return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
        }

        const cleanJobpackId = parseInt(String(jobpack_id).replace(/^(jobpack)-/, ""), 10);
        const cleanStructureId = parseInt(String(structure_id).replace(/^(platform|pipeline)-/, ""), 10);

        if (isNaN(cleanJobpackId) || isNaN(cleanStructureId)) {
            return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
        }

        const { data, error } = await (supabase as any)
            .from("u_executive_summaries")
            .upsert({
                company_id: companyId,
                jobpack_id: cleanJobpackId,
                structure_id: cleanStructureId,
                sow_report_no,
                sections,
                metadata,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'jobpack_id,structure_id,sow_report_no'
            })
            .select()
            .maybeSingle();

        if (error) {
            console.error("Supabase upsert error:", error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ data });
    } catch (error: any) {
        console.error("Executive Summary POST error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});
