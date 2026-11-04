import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { withTenant } from "@/utils/tenant-auth";

export const GET = withTenant(async (request, { companyId }) => {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const jobpackIdRaw = searchParams.get("jobpack_id");
        const structureIdRaw = searchParams.get("structure_id");
        const sowReportNoRaw = searchParams.get("sow_report_no");

        if (!structureIdRaw && !jobpackIdRaw) {
            return NextResponse.json({ error: "Missing structure_id or jobpack_id parameter" }, { status: 400 });
        }

        const jobpackId = jobpackIdRaw ? parseInt(String(jobpackIdRaw).replace(/^(jobpack)-/, ""), 10) : NaN;
        const structureId = structureIdRaw ? parseInt(String(structureIdRaw).replace(/^(platform|pipeline)-/, ""), 10) : NaN;
        const sowReportNo = sowReportNoRaw ? sowReportNoRaw.trim() : "";

        let exactRecord: any = null;
        let fallbackRecord: any = null;
        let historicalRecords: any[] = [];

        // 1. Try exact match if all 3 parameters are present
        if (!isNaN(jobpackId) && !isNaN(structureId) && sowReportNo) {
            let exactQuery = (supabase as any)
                .from("u_executive_summaries")
                .select("*")
                .eq("jobpack_id", jobpackId)
                .eq("structure_id", structureId)
                .eq("sow_report_no", sowReportNo);

            if (companyId) {
                exactQuery = exactQuery.or(`company_id.eq.${companyId},company_id.is.null`);
            }

            const { data } = await exactQuery.maybeSingle();
            exactRecord = data;

            // 1b. If not found by exact string, try case-insensitive ilike
            if (!exactRecord) {
                let ilikeQuery = (supabase as any)
                    .from("u_executive_summaries")
                    .select("*")
                    .eq("jobpack_id", jobpackId)
                    .eq("structure_id", structureId)
                    .ilike("sow_report_no", sowReportNo);

                if (companyId) {
                    ilikeQuery = ilikeQuery.or(`company_id.eq.${companyId},company_id.is.null`);
                }

                const { data: ilikeData } = await ilikeQuery.maybeSingle();
                exactRecord = ilikeData;
            }
        }

        // 2. Fetch all saved summaries for this structure to provide fallbacks & historical data
        if (!isNaN(structureId)) {
            let histQuery = (supabase as any)
                .from("u_executive_summaries")
                .select("id, jobpack_id, structure_id, sow_report_no, sections, metadata, updated_at, created_at")
                .eq("structure_id", structureId)
                .order("updated_at", { ascending: false })
                .limit(20);

            if (companyId) {
                histQuery = histQuery.or(`company_id.eq.${companyId},company_id.is.null`);
            }

            const { data: histList } = await histQuery;
            if (Array.isArray(histList) && histList.length > 0) {
                historicalRecords = histList.map((r: any) => {
                    const sec = r.sections;
                    let count = 0;
                    if (Array.isArray(sec)) {
                        count = sec.filter((s: any) => s && (s.content || s.findings || s.text)).length;
                    } else if (sec && typeof sec === "object") {
                        count = Object.values(sec).filter(Boolean).length;
                    }
                    return {
                        id: r.id,
                        jobpack_id: r.jobpack_id,
                        structure_id: r.structure_id,
                        sow_report_no: r.sow_report_no,
                        updated_at: r.updated_at || r.created_at,
                        sections_count: count,
                        metadata: r.metadata,
                        sections: r.sections,
                    };
                });

                // If no exact match for this specific SOW report number:
                if (!exactRecord) {
                    // Try to find a record from the same jobpack
                    if (!isNaN(jobpackId)) {
                        fallbackRecord = histList.find((r: any) => Number(r.jobpack_id) === Number(jobpackId)) || null;
                    }
                    // Or fallback to the most recent record for this structure
                    if (!fallbackRecord) {
                        fallbackRecord = histList[0] || null;
                    }
                }
            }
        }

        return NextResponse.json({
            data: exactRecord || null,
            fallbackData: fallbackRecord || null,
            historicalRecords: historicalRecords || [],
            hasSavedData: !!(exactRecord || fallbackRecord || historicalRecords.length > 0),
        });
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
                sow_report_no: String(sow_report_no).trim(),
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
