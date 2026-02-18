
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);

        let sowReportNo = searchParams.get("sow_report_no");
        let jobpackId = searchParams.get("jobpack_id");
        let structureId = searchParams.get("structure_id");

        // Clean up "undefined" or "null" strings
        if (sowReportNo === "undefined" || sowReportNo === "null") sowReportNo = null;
        if (jobpackId === "undefined" || jobpackId === "null") jobpackId = null;
        if (structureId === "undefined" || structureId === "null") structureId = null;

        if (!jobpackId) {
            return NextResponse.json({ error: "JobPack ID is required" }, { status: 400 });
        }

        console.log(`[AnomalyReport] Req: JobPack=${jobpackId}, Structure=${structureId}, Report=${sowReportNo}`);

        // 1. Query v_anomaly_details View
        let query = (supabase as any)
            .from("v_anomaly_details")
            .select("*")
            .eq("jobpack_id", jobpackId);

        if (structureId) {
            query = query.eq("structure_id", structureId);
        }
        if (sowReportNo) {
            query = query.eq("sow_report_no", sowReportNo);
        }

        const { data: anomalies, error: viewError } = await query;

        if (viewError) {
            console.error("View Error:", viewError);
            throw viewError;
        }

        if (!anomalies || anomalies.length === 0) {
            return NextResponse.json({
                data: [],
                debug: {
                    message: "No data found with filters",
                    filters: { jobpackId, structureId, sowReportNo },
                    viewError
                }
            });
        }

        console.log(`[AnomalyReport] Found ${anomalies.length} anomalies via View.`);

        // 2. Fetch Attachments (Inspection Record Level Only)
        const inspIds = anomalies.map((a: any) => a.id).filter(Boolean);

        let attachments: any[] = [];

        if (inspIds.length > 0) {
            const { data: attData } = await (supabase as any)
                .from("attachment")
                .select("*")
                .eq("source_type", "inspection")
                .in("source_id", inspIds);
            if (attData) attachments.push(...attData);
        }

        // 3. Merge Attachments
        const result = anomalies.map((a: any) => {
            const relAttachments = attachments.filter((att: any) => {
                // strict check for inspection type and matching ID
                return att.source_type === 'inspection' && String(att.source_id) === String(a.id);
            });
            return {
                ...a,
                attachments: relAttachments
            };
        });

        return NextResponse.json({ data: result });

    } catch (error: any) {
        console.error("Error fetching anomaly report data:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
