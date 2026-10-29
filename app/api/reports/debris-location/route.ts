import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/reports/debris-location
 *
 * Returns debris inspection records for the selected campaign (jobpack + SOW report no.)
 * on structure MEMBERS. Seabed survey lines (code "SD" / QID "S/BED...") are excluded:
 * they are located by face / nearest leg and are covered by the Seabed debris reports.
 *
 * Query params: jobpack_id, structure_id, sow_report_no
 */

const EMPTY_VALUE = /^(none|n\/a|na|no|nil|null|-)$/i;

const pick = (d: any, key: string): any => {
    if (!d || typeof d !== "object") return undefined;
    const lower = d[key];
    if (lower !== undefined && lower !== null && String(lower).trim() !== "") return lower;
    const upper = d[key.toUpperCase()];
    if (upper !== undefined && upper !== null && String(upper).trim() !== "") return upper;
    return undefined;
};

const isFilled = (v: any): boolean => v !== undefined && v !== null && String(v).trim() !== "" && !EMPTY_VALUE.test(String(v).trim());

const parseJson = (v: any): any => {
    if (!v) return {};
    if (typeof v === "string") {
        try { return JSON.parse(v); } catch { return {}; }
    }
    return v;
};

const clean = (val: string | null) => (val === "undefined" || val === "null" || !val) ? null : val;

export async function GET(request: NextRequest) {
    try {
        const supabase: any = await createClient();
        const { searchParams } = new URL(request.url);

        const jobpackId = clean(searchParams.get("jobpack_id"));
        const structureId = clean(searchParams.get("structure_id"));
        let sowReportNo = clean(searchParams.get("sow_report_no"));
        if (sowReportNo) sowReportNo = decodeURIComponent(sowReportNo);

        if (!jobpackId && !structureId) {
            return NextResponse.json({ error: "JobPack ID or Structure ID is required" }, { status: 400 });
        }

        // 1. Candidate debris records (paged: PostgREST returns max 1000 rows per request)
        const baseSelect =
            "insp_id, component_id, structure_id, jobpack_id, sow_report_no, inspection_type_code, inspection_date, inspection_time, " +
            "tape_id, tape_count_no, elevation, has_anomaly, status, description, dive_job_id, rov_job_id, inspection_data, " +
            "insp_video_tapes:tape_id(tape_no)";

        let rows: any[] = [];
        const pageSize = 1000;
        for (let page = 0; page < 10; page++) {
            let q = supabase
                .from("insp_records")
                .select(baseSelect)
                .or("inspection_data->>debris.not.is.null,inspection_data->>debris_material.not.is.null,inspection_data->>debris_desc.not.is.null")
                .order("insp_id", { ascending: true })
                .range(page * pageSize, page * pageSize + pageSize - 1);
            if (jobpackId && jobpackId !== "0") q = q.eq("jobpack_id", jobpackId);
            if (structureId && structureId !== "0") q = q.eq("structure_id", structureId);

            const { data, error } = await q;
            if (error) throw error;
            if (!data || data.length === 0) break;
            rows = rows.concat(data);
            if (data.length < pageSize) break;
        }

        // 2. Campaign (SOW report) filter, normalised for whitespace / case
        if (sowReportNo && !["all", "n/a"].includes(sowReportNo.toLowerCase())) {
            const want = sowReportNo.replace(/\s+/g, "").toLowerCase();
            rows = rows.filter(r => String(r.sow_report_no || "").replace(/\s+/g, "").toLowerCase() === want);
        }

        // 3. Keep only records that really carry a debris value (and are not gas / crater findings)
        rows = rows.filter(r => {
            const d = parseJson(r.inspection_data);
            const category = String(pick(d, "category") || "").toLowerCase();
            if (category.includes("gas") || category.includes("crater")) return false;
            return isFilled(pick(d, "debris")) || isFilled(pick(d, "debris_material")) || isFilled(pick(d, "debris_desc"));
        });

        if (rows.length === 0) {
            return NextResponse.json({ data: [], debug: { message: "No debris records found", filters: { jobpackId, structureId, sowReportNo } } });
        }

        // 4. Resolve components, then drop seabed survey lines
        const compIds = Array.from(new Set(rows.map(r => r.component_id).filter(Boolean)));
        const compMap = new Map<number, any>();
        for (let i = 0; i < compIds.length; i += 100) {
            const part = compIds.slice(i, i + 100);
            const { data: comps } = await supabase
                .from("structure_components")
                .select("id, q_id, code, metadata")
                .in("id", part);
            (comps || []).forEach((c: any) => compMap.set(Number(c.id), c));
        }

        rows = rows.filter(r => {
            const c = compMap.get(Number(r.component_id));
            const code = String(c?.code || "").toUpperCase();
            const qid = String(c?.q_id || "").toUpperCase();
            const type = String(r.inspection_type_code || parseJson(r.inspection_data).insp_type || "").toUpperCase();
            if (code === "SD" || qid.startsWith("S/BED") || type === "RSEAB" || type === "RSCOR") return false;
            return Boolean(c);
        });

        // 5. Dive / ROV job metadata
        const rovJobIds = Array.from(new Set(rows.map(r => r.rov_job_id).filter(Boolean)));
        const diveJobIds = Array.from(new Set(rows.map(r => r.dive_job_id).filter(Boolean)));
        const rovMap = new Map<number, any>();
        const diveMap = new Map<number, any>();
        if (rovJobIds.length > 0) {
            const { data } = await supabase
                .from("insp_rov_jobs")
                .select("rov_job_id, deployment_no, rov_operator, rov_supervisor, report_coordinator")
                .in("rov_job_id", rovJobIds);
            (data || []).forEach((j: any) => rovMap.set(Number(j.rov_job_id), j));
        }
        if (diveJobIds.length > 0) {
            const { data } = await supabase
                .from("insp_dive_jobs")
                .select("dive_job_id, dive_no, diver_name, dive_supervisor, report_coordinator")
                .in("dive_job_id", diveJobIds);
            (data || []).forEach((j: any) => diveMap.set(Number(j.dive_job_id), j));
        }

        // 6. Attachments (inspection level + direct photo captures)
        const inspIds = rows.map(r => r.insp_id).filter(Boolean);
        const attachments: any[] = [];
        if (inspIds.length > 0) {
            for (let i = 0; i < inspIds.length; i += 200) {
                const part = inspIds.slice(i, i + 200).map(String);
                const { data: attData } = await supabase
                    .from("attachment")
                    .select("*")
                    .in("source_type", ["inspection", "INSPECTION", "insp_record", "INSP_RECORD"])
                    .in("source_id", part);
                if (attData) attachments.push(...attData);

                const { data: mediaData } = await supabase
                    .from("insp_media")
                    .select("*")
                    .in("inspection_id", inspIds.slice(i, i + 200));
                (mediaData || []).forEach((m: any) => {
                    if (!attachments.some((a: any) => a.path === m.file_path || String(a.id) === `media-${m.media_id}`)) {
                        attachments.push({
                            id: `media-${m.media_id}`,
                            name: m.name || `Photo ${m.media_id}`,
                            path: m.file_path,
                            source_type: "INSPECTION",
                            source_id: m.inspection_id,
                            meta: { ...m.meta, bucket: "inspection-media", is_insp_media: true },
                            created_at: m.captured_at
                        });
                    }
                });
            }
        }

        // 7. Shape the response
        const result = rows.map(r => {
            const d = parseJson(r.inspection_data);
            const c = compMap.get(Number(r.component_id)) || {};
            const rj = rovMap.get(Number(r.rov_job_id));
            const dj = diveMap.get(Number(r.dive_job_id));

            const myAtt = attachments
                .filter(a => String(a.source_id) === String(r.insp_id))
                .sort((a, b) => {
                    const oa = a.meta?.sort_order ?? 999999;
                    const ob = b.meta?.sort_order ?? 999999;
                    if (oa !== ob) return oa - ob;
                    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
                });

            const elevRaw = pick(d, "elevation") ?? r.elevation;

            return {
                insp_id: r.insp_id,
                component_id: r.component_id,
                component_qid: c.q_id || "",
                component_code: c.code || "",
                inspection_type_code: r.inspection_type_code || pick(d, "insp_type") || "",
                inspection_date: r.inspection_date,
                inspection_time: r.inspection_time,
                sow_report_no: r.sow_report_no,
                jobpack_id: r.jobpack_id,
                structure_id: r.structure_id,
                has_anomaly: r.has_anomaly,
                elevation: elevRaw === undefined || elevRaw === null || String(elevRaw).trim() === "" ? null : Number(elevRaw),
                tape_no: r.insp_video_tapes?.tape_no || pick(d, "tape_no") || "",
                video_ref: r.tape_count_no || pick(d, "counter_no") || pick(d, "counter") || "",
                dive_no: dj?.dive_no || pick(d, "dive_no") || "",
                deployment_no: rj?.deployment_no || pick(d, "deployment_no") || "",
                diver_name: dj?.diver_name || "",
                rov_name: rj?.rov_operator || pick(d, "pilot") || "",
                supervisor: rj?.rov_supervisor || dj?.dive_supervisor || pick(d, "supervisor") || "",
                report_coordinator: rj?.report_coordinator || dj?.report_coordinator || pick(d, "rep_cord") || "",
                debris_type: pick(d, "debris") || "",
                debris_material: pick(d, "debris_material") || pick(d, "material") || "",
                debris_desc: pick(d, "debris_desc") || "",
                findings: pick(d, "findings") || pick(d, "finding") || pick(d, "comments") || r.description || "",
                face: pick(d, "face") || "",
                clock_raw: pick(d, "clock_position") ?? pick(d, "clock_pos") ?? pick(d, "o_clock") ?? pick(d, "clock") ?? null,
                inspection_data: d,
                attachments: myAtt
            };
        });

        return NextResponse.json({ data: result });
    } catch (error: any) {
        console.error("Error fetching debris location report data:", error);
        return NextResponse.json({ error: error?.message || "Failed to fetch debris location data" }, { status: 500 });
    }
}
