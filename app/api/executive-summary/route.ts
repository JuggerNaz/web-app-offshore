import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const jobpackId = searchParams.get("jobpack_id");
        const structureId = searchParams.get("structure_id");
        const sowReportNo = searchParams.get("sow_report_no");

        if (!jobpackId || !structureId || !sowReportNo) {
            return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
        }

        const { data, error } = await (supabase as any)
            .from("u_executive_summaries")
            .select("*")
            .eq("jobpack_id", Number(jobpackId))
            .eq("structure_id", Number(structureId))
            .eq("sow_report_no", sowReportNo)
            .maybeSingle();

        if (error) throw error;

        return NextResponse.json({ data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { jobpack_id, structure_id, sow_report_no, sections, metadata } = body;

        if (!jobpack_id || !structure_id || !sow_report_no) {
            return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
        }

        // Check if exists first to be safe, or just use upsert with id if we had it
        // For now, we use upsert with onConflict but with better error handling
        const { data, error } = await (supabase as any)
            .from("u_executive_summaries")
            .upsert({
                jobpack_id: Number(jobpack_id),
                structure_id: Number(structure_id),
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
}
