
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);

        let sowReportNo = searchParams.get("sow_report_no");
        let jobpackId = searchParams.get("jobpack_id");
        let structureId = searchParams.get("structure_id");
        let inspectionId = searchParams.get("inspection_id");

        // Clean up "undefined" or "null" strings
        if (sowReportNo === "undefined" || sowReportNo === "null") sowReportNo = null;
        if (jobpackId === "undefined" || jobpackId === "null") jobpackId = null;
        if (structureId === "undefined" || structureId === "null") structureId = null;
        if (inspectionId === "undefined" || inspectionId === "null") inspectionId = null;

        if (!jobpackId && !inspectionId) {
            return NextResponse.json({ error: "JobPack ID or Inspection ID is required" }, { status: 400 });
        }

        console.log(`[AnomalyReport] Req: JobPack=${jobpackId}, Structure=${structureId}, Report=${sowReportNo}, Inspection=${inspectionId}`);

        // 1. Query v_anomaly_details View
        let query = (supabase as any)
            .from("v_anomaly_details")
            .select("*");

        if (jobpackId) {
            query = query.eq("jobpack_id", jobpackId);
        }

        if (structureId) {
            query = query.eq("structure_id", structureId);
        }
        if (sowReportNo) {
            query = query.eq("sow_report_no", sowReportNo);
        }
        if (inspectionId) {
            query = query.eq("id", inspectionId); // View maps insp_id to 'id'
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

        // 2. Fetch Attachments (Both Inspection and Anomaly level)
        const inspIds = anomalies.map((a: any) => a.id).filter(Boolean);
        const anomalyIds = anomalies.map((a: any) => a.anomaly_id).filter(Boolean);

        let attachments: any[] = [];

        if (inspIds.length > 0 || anomalyIds.length > 0) {
            const { data: attData } = await (supabase as any)
                .from("attachment")
                .select("*")
                .or(`and(source_type.eq.inspection,source_id.in.(${inspIds.join(',')})),and(source_type.eq.anomaly,source_id.in.(${anomalyIds.join(',')}))`);

            if (attData) attachments.push(...attData);
        }

        // 3. Merge Attachments
        const result = anomalies.map((a: any) => {
            const relAttachments = attachments.filter((att: any) => {
                const isInsp = att.source_type === 'inspection' && String(att.source_id) === String(a.id);
                const isAnom = att.source_type === 'anomaly' && String(att.source_id) === String(a.anomaly_id);
                return isInsp || isAnom;
            });

            // Sort by meta.sort_order
            relAttachments.sort((ra, rb) => {
                const orderA = ra.meta?.sort_order ?? 999999;
                const orderB = rb.meta?.sort_order ?? 999999;
                if (orderA !== orderB) return orderA - orderB;
                return new Date(ra.created_at).getTime() - new Date(rb.created_at).getTime();
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
