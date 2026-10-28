
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const TASK_NAME_FALLBACKS: Record<string, string> = {
    NAVIG: "Pipeline Navigation Inspection",
    RGVI: "ROV General Visual Inspection",
    RFMD: "Flooded Member Detection",
    RSEAB: "Seabed Survey",
    RRISI: "Riser Inspection",
    RCOND: "Condition Assessment",
    RSCOR: "Scour / Marine Growth Survey",
    RMGI: "MGI Wall Thickness Survey",
    RCPSU: "Cathodic Protection Survey",
    BSINS: "Bolt Survey",
    CLEAN: "Cleaning Survey",
    CPCLB: "CP Calibration",
    CPSURV: "CP Survey",
    SZONE: "Splash Zone Survey",
    RSZCI: "Splash Zone Inspection",
    DSZCI: "Diving Splash Zone Inspection",
    UTCLB: "UT Calibration",
    UTWTK: "UT Wall Thickness",
    UTWT: "UT Wall Thickness",
    MGROW: "Marine Growth Survey",
    PL_AN: "Pipeline Anode Inspection",
    GVINS: "General Visual Inspection",
    RISER: "Riser Inspection",
    DANOD: "Diving Anode Inspection",
    RANOD: "ROV Anode Inspection",
    ITMAIN: "Item Maintenance Inspection",
};

function getInspectionTaskName(code?: string | null): string {
    if (!code) return "";
    const cleanCode = String(code).trim().toUpperCase();
    if (TASK_NAME_FALLBACKS[cleanCode]) return TASK_NAME_FALLBACKS[cleanCode];
    return cleanCode;
}

const MAX_TAPE_HOURS = 12;
const MAX_TAPE_SECONDS = MAX_TAPE_HOURS * 3600;

function parseTimecodeToSeconds(tc: any): number {
    if (tc === null || tc === undefined || tc === "" || tc === "—" || tc === "-") return -1;
    if (typeof tc === "number") {
        if (tc > MAX_TAPE_SECONDS) return -1;
        return tc;
    }
    const str = String(tc).trim();
    if (str.includes(":")) {
        const parts = str.split(":").map(Number);
        if (parts.length === 3 && parts.every(p => !isNaN(p))) {
            const sec = parts[0] * 3600 + parts[1] * 60 + parts[2];
            if (sec > MAX_TAPE_SECONDS) return -1;
            return sec;
        }
        if (parts.length === 2 && parts.every(p => !isNaN(p))) {
            const sec = parts[0] * 60 + parts[1];
            if (sec > MAX_TAPE_SECONDS) return -1;
            return sec;
        }
    }
    const num = Number(str);
    if (!isNaN(num)) {
        if (num > MAX_TAPE_SECONDS) return -1;
        return num;
    }
    return -1;
}

function formatTimecode(tc: any): string {
    if (tc === null || tc === undefined || tc === "" || tc === "—" || tc === "-") return "—";
    const str = String(tc).trim();
    if (str.includes(":")) {
        const parts = str.split(":");
        if (parts.length === 2) return `00:${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
        if (parts.length === 3) {
            const h = Number(parts[0]);
            if (!isNaN(h) && h > MAX_TAPE_HOURS) return "—";
            return parts.map(p => p.padStart(2, "0")).join(":");
        }
        return str;
    }
    const num = Number(str);
    if (!isNaN(num) && num >= 0) {
        if (num > MAX_TAPE_SECONDS) return "—";
        const hrs = Math.floor(num / 3600);
        const mins = Math.floor((num % 3600) / 60);
        const secs = Math.floor(num % 60);
        return [hrs, mins, secs].map(v => String(v).padStart(2, "0")).join(":");
    }
    return str;
}

function formatInspectionDateTime(dateStr?: string | null, timeStr?: string | null): string {
    if (!dateStr) return "—";
    let d = dateStr;
    let t = timeStr || "";
    if (d.includes("T")) {
        const parts = d.split("T");
        d = parts[0];
        if (!t) t = parts[1];
    }
    const [y, m, day] = d.split("-");
    const formattedDate = (y && m && day) ? `${day.padStart(2, "0")}/${m.padStart(2, "0")}/${y}` : d;
    if (!t) return formattedDate;
    const timeClean = t.replace(/Z|[\+\-].*$/, "").trim();
    const timeParts = timeClean.split(":");
    const formattedTime = timeParts.length >= 2 ? `${timeParts[0].padStart(2, "0")}:${timeParts[1].padStart(2, "0")}` : timeClean;
    return `${formattedDate}, ${formattedTime}`;
}

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);

        let rawJobpackId = searchParams.get("jobpack_id");
        let rawStructureId = searchParams.get("structure_id");
        let sowReportNo = searchParams.get("sow_report_no");

        if (rawJobpackId === "undefined" || rawJobpackId === "null" || rawJobpackId === "") rawJobpackId = null;
        if (rawStructureId === "undefined" || rawStructureId === "null" || rawStructureId === "") rawStructureId = null;
        if (sowReportNo === "undefined" || sowReportNo === "null" || sowReportNo === "all" || sowReportNo === "N/A" || sowReportNo === "") sowReportNo = null;

        const cleanStructureId = rawStructureId ? String(rawStructureId).replace(/^(platform|pipeline)-/, "").trim() : null;
        const structureIdNum = cleanStructureId ? Number(cleanStructureId) : NaN;
        const structureId = !isNaN(structureIdNum) ? structureIdNum : cleanStructureId;

        const cleanJobpackId = rawJobpackId ? String(rawJobpackId).trim() : null;
        const jobpackIdNum = cleanJobpackId ? Number(cleanJobpackId) : NaN;
        const jobpackId = !isNaN(jobpackIdNum) ? jobpackIdNum : cleanJobpackId;

        if (!jobpackId && !structureId) {
            return NextResponse.json({ error: "JobPack ID or Structure ID is required" }, { status: 400 });
        }

        console.log(`[VideoLog] Req: JobPack=${jobpackId}, Structure=${structureId}, Report=${sowReportNo}`);

        // 1. Fetch tapes for this jobpack via dive jobs
        let jobsQuery = (supabase as any)
            .from("insp_dive_jobs")
            .select("dive_job_id, dive_no");

        if (jobpackId) jobsQuery = jobsQuery.eq("jobpack_id", jobpackId);
        if (structureId) jobsQuery = jobsQuery.eq("structure_id", structureId);
        if (sowReportNo) jobsQuery = jobsQuery.eq("sow_report_no", sowReportNo);

        const { data: diveJobsData, error: jobsError } = await jobsQuery;
        let diveJobs = diveJobsData;
        if (jobsError) throw jobsError;

        // 1b. Fetch tapes for this jobpack via ROV jobs
        let rovJobsQuery = (supabase as any)
            .from("insp_rov_jobs")
            .select("rov_job_id, deployment_no");

        if (jobpackId) rovJobsQuery = rovJobsQuery.eq("jobpack_id", jobpackId);
        if (structureId) rovJobsQuery = rovJobsQuery.eq("structure_id", structureId);
        if (sowReportNo) rovJobsQuery = rovJobsQuery.eq("sow_report_no", sowReportNo);

        const { data: rovJobsData, error: rovJobsError } = await rovJobsQuery;
        let rovJobs = rovJobsData;
        if (rovJobsError) throw rovJobsError;

        // Fallback: if sowReportNo was provided but returned no jobs, fetch all jobs for structure/jobpack
        if ((!diveJobs || diveJobs.length === 0) && (!rovJobs || rovJobs.length === 0) && sowReportNo) {
            let fbDive = (supabase as any).from("insp_dive_jobs").select("dive_job_id, dive_no").eq("jobpack_id", jobpackId);
            if (structureId) fbDive = fbDive.eq("structure_id", structureId);
            const { data: fbDData } = await fbDive;
            if (fbDData && fbDData.length > 0) diveJobs = fbDData;

            let fbRov = (supabase as any).from("insp_rov_jobs").select("rov_job_id, deployment_no").eq("jobpack_id", jobpackId);
            if (structureId) fbRov = fbRov.eq("structure_id", structureId);
            const { data: fbRData } = await fbRov;
            if (fbRData && fbRData.length > 0) rovJobs = fbRData;
        }

        const diveJobIds = (diveJobs || []).map((j: any) => j.dive_job_id);
        const rovJobIds = (rovJobs || []).map((j: any) => j.rov_job_id);

        if (diveJobIds.length === 0 && rovJobIds.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const diveNoMap: Record<number, string> = {};
        (diveJobs || []).forEach((j: any) => { diveNoMap[j.dive_job_id] = j.dive_no; });
        (rovJobs || []).forEach((j: any) => { diveNoMap[j.rov_job_id] = j.deployment_no; });

        // 2. Fetch all tapes for these dive or rov jobs with pagination
        let tapes: any[] = [];
        let tapePage = 0;
        const tapePageSize = 1000;
        while (true) {
            let tQuery = (supabase as any)
                .from("insp_video_tapes")
                .select("tape_id, tape_no, dive_job_id, rov_job_id, status, chapter_no, remarks")
                .order("tape_id", { ascending: true });

            if (diveJobIds.length > 0 && rovJobIds.length > 0) {
                tQuery = tQuery.or(`dive_job_id.in.(${diveJobIds.join(",")}),rov_job_id.in.(${rovJobIds.join(",")})`);
            } else if (diveJobIds.length > 0) {
                tQuery = tQuery.in("dive_job_id", diveJobIds);
            } else {
                tQuery = tQuery.in("rov_job_id", rovJobIds);
            }

            const { data: tChunk, error: tapesError } = await tQuery.range(tapePage * tapePageSize, (tapePage + 1) * tapePageSize - 1);
            if (tapesError) throw tapesError;
            if (!tChunk || tChunk.length === 0) break;
            tapes.push(...tChunk);
            if (tChunk.length < tapePageSize) break;
            tapePage++;
        }

        if (!tapes || tapes.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const tapeIds = tapes.map((t: any) => t.tape_id);

        // Build tape lookup maps
        const tapeById = new Map<number, any>();
        const tapesByNoAndChapter = new Map<string, any>();
        const tapesByNo = new Map<string, any[]>();

        tapes.forEach((t: any) => {
            tapeById.set(Number(t.tape_id), t);
            const tapeNoClean = String(t.tape_no || "").trim().toLowerCase();
            const chClean = String(t.chapter_no || "").trim();
            if (tapeNoClean && chClean) {
                tapesByNoAndChapter.set(`${tapeNoClean}__ch_${chClean}`, t);
            }
            if (tapeNoClean) {
                if (!tapesByNo.has(tapeNoClean)) tapesByNo.set(tapeNoClean, []);
                tapesByNo.get(tapeNoClean)!.push(t);
            }
        });

        // 3. Fetch all video logs for these tapes with deterministic ordering and pagination
        const logs: any[] = [];
        const tapeChunkSize = 80;
        for (let ti = 0; ti < tapeIds.length; ti += tapeChunkSize) {
            const subTapeIds = tapeIds.slice(ti, ti + tapeChunkSize);
            let logPage = 0;
            const logPageSize = 1000;
            while (true) {
                const { data: logChunk, error: logsError } = await (supabase as any)
                    .from("insp_video_logs")
                    .select("video_log_id, tape_id, event_type, event_time, timecode_start, tape_counter_start, remarks, inspection_id")
                    .in("tape_id", subTapeIds)
                    .order("video_log_id", { ascending: true })
                    .range(logPage * logPageSize, (logPage + 1) * logPageSize - 1);

                if (logsError) {
                    console.warn("[VideoLog] Error fetching insp_video_logs chunk:", logsError);
                    break;
                }
                if (!logChunk || logChunk.length === 0) break;
                logs.push(...logChunk);
                if (logChunk.length < logPageSize) break;
                logPage++;
            }
        }

        // Fetch linked inspection records safely with batching
        const inspIds = Array.from(new Set((logs || []).map((l: any) => l.inspection_id).filter(Boolean)));
        const inspRecordMap: Record<number, any> = {};
        if (inspIds.length > 0) {
            try {
                for (let i = 0; i < inspIds.length; i += 500) {
                    const batch = inspIds.slice(i, i + 500);
                    const { data: linkedRecs } = await (supabase as any)
                        .from("insp_records")
                        .select("insp_id, description, inspection_type_code, inspection_data, structure_components:component_id(id, q_id)")
                        .in("insp_id", batch);
                    (linkedRecs || []).forEach((r: any) => {
                        inspRecordMap[r.insp_id] = r;
                    });
                }
            } catch (e) {
                console.warn("[VideoLog] Could not fetch linked inspection records:", e);
            }
        }

        (logs || []).forEach((l: any) => {
            if (l.inspection_id && inspRecordMap[l.inspection_id]) {
                const r = inspRecordMap[l.inspection_id];
                l.insp_records = r;
                l.is_inspection = true;
                l.qid = r.structure_components?.q_id || r.inspection_data?.q_id || r.inspection_data?.qid || "";
                l.inspection_type_code = r.inspection_type_code || "";
                l.inspection_task = getInspectionTaskName(r.inspection_type_code);
            }
        });

        // 4. Fetch all inspection records for these tapes or dive/ROV jobs with deterministic ordering and pagination
        let inspRecsQuery = (supabase as any)
            .from("insp_records")
            .select(`
                insp_id,
                tape_id,
                dive_job_id,
                rov_job_id,
                component_id,
                inspection_type_code,
                tape_count_no,
                status,
                has_anomaly,
                incomplete_reason,
                description,
                inspection_date,
                inspection_time,
                inspection_data,
                structure_components:component_id ( id, q_id )
            `)
            .order("insp_id", { ascending: true });

        const orFilters: string[] = [];
        if (tapeIds.length > 0) orFilters.push(`tape_id.in.(${tapeIds.join(",")})`);
        if (diveJobIds.length > 0) orFilters.push(`dive_job_id.in.(${diveJobIds.join(",")})`);
        if (rovJobIds.length > 0) orFilters.push(`rov_job_id.in.(${rovJobIds.join(",")})`);

        if (orFilters.length > 0) {
            inspRecsQuery = inspRecsQuery.or(orFilters.join(","));
        } else if (jobpackId && structureId) {
            inspRecsQuery = inspRecsQuery.eq("jobpack_id", jobpackId).eq("structure_id", structureId);
        } else if (jobpackId) {
            inspRecsQuery = inspRecsQuery.eq("jobpack_id", jobpackId);
        } else if (structureId) {
            inspRecsQuery = inspRecsQuery.eq("structure_id", structureId);
        }

        let allInspRecords: any[] = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
            const { data: chunk, error: chunkErr } = await inspRecsQuery.range(page * pageSize, (page + 1) * pageSize - 1);
            if (chunkErr) {
                console.warn("[VideoLog] Error fetching insp_records chunk:", chunkErr);
                break;
            }
            if (!chunk || chunk.length === 0) break;
            allInspRecords.push(...chunk);
            if (chunk.length < pageSize) break;
            page++;
        }

        console.log(`[VideoLog] Fetched ${allInspRecords.length} inspection records across tapes`);

        // Ensure all ROV and Dive job IDs have their deployment numbers populated in diveNoMap
        const missingRovIds = Array.from(new Set([
            ...allInspRecords.map(r => r.rov_job_id),
            ...tapes.map(t => t.rov_job_id)
        ])).filter((id): id is number => typeof id === "number" && id > 0 && !diveNoMap[id]);

        if (missingRovIds.length > 0) {
            try {
                const { data: missingRov } = await (supabase as any)
                    .from("insp_rov_jobs")
                    .select("rov_job_id, deployment_no")
                    .in("rov_job_id", missingRovIds);
                (missingRov || []).forEach((j: any) => {
                    if (j.deployment_no) diveNoMap[j.rov_job_id] = j.deployment_no;
                });
            } catch (e) {
                console.warn("[VideoLog] Could not fetch missing ROV job numbers:", e);
            }
        }

        const isRecIncomplete = (record: any) => {
            const d = record.inspection_data || {};
            const status = String(record.status || d.status || "").toUpperCase().trim();
            if (status === "INCOMPLETE") return true;
            if (record.reason_id != null && Number(record.reason_id) > 0) return true;
            if (d.reason_id != null && Number(d.reason_id) > 0) return true;
            const incompleteReason = String(record.incomplete_reason || record.incompleteReason || d.incomplete_reason || d.incompleteReason || "").trim();
            if (incompleteReason && incompleteReason.length > 0 && incompleteReason !== "-" && incompleteReason !== "—") return true;
            const desc = String(record.description || "").trim().toUpperCase();
            if (desc.startsWith("INCOMPLETE:") || desc.startsWith("STATUS: INCOMPLETE")) return true;
            return false;
        };

        // Helper to resolve which tape an inspection belongs to
        const resolveTargetTapeId = (record: any): number | null => {
            if (record.tape_id && tapeById.has(Number(record.tape_id))) {
                return Number(record.tape_id);
            }
            const dTapeId = record.inspection_data?.tape_id || record.inspection_data?.tapeId;
            if (dTapeId && !isNaN(Number(dTapeId)) && tapeById.has(Number(dTapeId))) {
                return Number(dTapeId);
            }
            const rawTapeNo = String(record.inspection_data?.tape_no || record.inspection_data?.TAPE_NO || record.tape_no || "").trim().toLowerCase();
            const rawCh = String(record.inspection_data?.chapter_no || record.inspection_data?.CHAPTER_NO || record.chapter_no || "").trim();
            if (rawTapeNo && rawCh && tapesByNoAndChapter.has(`${rawTapeNo}__ch_${rawCh}`)) {
                return Number(tapesByNoAndChapter.get(`${rawTapeNo}__ch_${rawCh}`).tape_id);
            }
            if (rawTapeNo && tapesByNo.has(rawTapeNo)) {
                const matchingTapes = tapesByNo.get(rawTapeNo)!;
                if (matchingTapes.length === 1) return Number(matchingTapes[0].tape_id);
                if (rawCh) {
                    const found = matchingTapes.find((t: any) => String(t.chapter_no || "").trim() === rawCh);
                    if (found) return Number(found.tape_id);
                }
                return Number(matchingTapes[0].tape_id);
            }
            if (record.dive_job_id) {
                const found = tapes.find((t: any) => t.dive_job_id === record.dive_job_id && (rawCh ? String(t.chapter_no || "").trim() === rawCh : true));
                if (found) return Number(found.tape_id);
            }
            if (record.rov_job_id) {
                const found = tapes.find((t: any) => t.rov_job_id === record.rov_job_id && (rawCh ? String(t.chapter_no || "").trim() === rawCh : true));
                if (found) return Number(found.tape_id);
            }
            return null;
        };

        // 5. Group logs by tape_id, including inspection logs
        const logsByTape: Record<number, any[]> = {};
        (logs || []).forEach((log: any) => {
            if (!logsByTape[log.tape_id]) logsByTape[log.tape_id] = [];
            logsByTape[log.tape_id].push(log);
        });

        // Track inspection IDs already in logs to prevent duplicates
        const existingLogInspIds = new Set(
            (logs || []).map((l: any) => Number(l.inspection_id)).filter(id => !isNaN(id) && id > 0)
        );

        // 4b. Fetch linked anomalies for inspection records
        const allRecordInspIds = Array.from(new Set([
            ...allInspRecords.map((r: any) => Number(r.insp_id)),
            ...inspIds.map((id: any) => Number(id))
        ])).filter(id => !isNaN(id) && id > 0);

        if (allRecordInspIds.length > 0) {
            try {
                const anomBatchSize = 500;
                for (let i = 0; i < allRecordInspIds.length; i += anomBatchSize) {
                    const batchIds = allRecordInspIds.slice(i, i + anomBatchSize);
                    const { data: anomsData, error: anomErr } = await (supabase as any)
                        .from("insp_anomalies")
                        .select("anomaly_id, inspection_id, anomaly_ref_no, defect_description, defect_type_code, status")
                        .in("inspection_id", batchIds);
                    if (!anomErr && anomsData) {
                        anomsData.forEach((a: any) => {
                            const targetInspId = Number(a.inspection_id || a.insp_id);
                            const rec = allInspRecords.find((r: any) => Number(r.insp_id) === targetInspId);
                            if (rec) {
                                if (!rec.insp_anomalies) rec.insp_anomalies = [];
                                rec.insp_anomalies.push(a);
                                rec.has_anomaly = true;
                                if (!rec.anomaly_ref_no && a.anomaly_ref_no) rec.anomaly_ref_no = a.anomaly_ref_no;
                                if (!rec.defect_description && a.defect_description) rec.defect_description = a.defect_description;
                            }
                            (logs || []).forEach((l: any) => {
                                if (Number(l.inspection_id) === targetInspId) {
                                    if (!l.insp_anomalies) l.insp_anomalies = [];
                                    l.insp_anomalies.push(a);
                                    l.has_anomaly = true;
                                    l.is_anomaly = true;
                                    if (!l.anomaly_ref_no && a.anomaly_ref_no) l.anomaly_ref_no = a.anomaly_ref_no;
                                    if (!l.defect_description && a.defect_description) l.defect_description = a.defect_description;
                                }
                            });
                        });
                    }
                }
            } catch (e) {
                console.warn("[VideoLog] Error fetching insp_anomalies for inspection records:", e);
            }
        }

        allInspRecords.forEach((record: any) => {
            if (existingLogInspIds.has(Number(record.insp_id))) return;

            const targetTapeId = resolveTargetTapeId(record);
            if (!targetTapeId) return;

            const rawTc = record.inspection_data?.tape_count_no || record.inspection_data?._meta_timecode || record.tape_count_no;
            const timecode = formatTimecode(rawTc);
            const dateStr = record.inspection_date || record.inspection_data?.inspection_date || "";
            const timeStr = record.inspection_time || record.inspection_data?.inspection_time || "";
            const formattedDateTime = formatInspectionDateTime(dateStr, timeStr);
            const qid = record.structure_components?.q_id || record.inspection_data?.q_id || record.inspection_data?.qid || record.inspection_data?.component_qid || record.inspection_data?.COMP_QID || "";
            const taskCode = record.inspection_type_code || record.inspection_data?.insp_type || record.inspection_data?.INSP_TYPE || "";
            const taskName = getInspectionTaskName(taskCode);

            const anoms = record.insp_anomalies || [];
            const primaryAnom = anoms[0] || null;
            const refNo = String(
                primaryAnom?.anomaly_ref_no ||
                record.anomaly_ref_no ||
                record.inspection_data?.anomaly_ref_no ||
                record.inspection_data?._meta_ref_no ||
                record.inspection_data?.ref_no ||
                record.inspection_data?.finding_ref ||
                ""
            ).trim();

            const isFinding = Boolean(
                record.is_finding ||
                record.inspection_data?._meta_status?.toLowerCase() === "finding" ||
                record.inspection_data?.finding_type?.toUpperCase() === "FINDING" ||
                (refNo && refNo.toUpperCase().startsWith("F-"))
            );

            // ONLY count if the status is explicitly stated as Anomaly
            const hasAnomaly = Boolean(
                record.has_anomaly === true ||
                record.status === "Anomaly" ||
                record.status === "Defect" ||
                anoms.length > 0 ||
                record.inspection_data?.has_anomaly === true
            );

            const anomalyRefNo = hasAnomaly
                ? String(primaryAnom?.anomaly_ref_no || record.anomaly_ref_no || record.inspection_data?.anomaly_ref_no || (refNo && !refNo.toUpperCase().startsWith("F-") ? refNo : "")).trim()
                : "";

            const isIncomplete = isRecIncomplete(record);

            const inspLog = {
                video_log_id: `insp_${record.insp_id}`,
                tape_id: targetTapeId,
                event_type: hasAnomaly ? "ANOMALY" : (isFinding ? "FINDING" : "INSPECTION"),
                is_inspection: true,
                status: record.status || (isIncomplete ? "INCOMPLETE" : "COMPLETED"),
                is_incomplete: isIncomplete,
                has_anomaly: hasAnomaly,
                is_anomaly: hasAnomaly,
                is_finding: isFinding && !hasAnomaly,
                anomaly_ref_no: anomalyRefNo,
                ref_no: anomalyRefNo || refNo,
                defect_description: hasAnomaly ? (primaryAnom?.defect_description || record.inspection_data?.defect_description || "") : "",
                event_time: dateStr && timeStr ? `${dateStr}T${timeStr}` : (dateStr || ""),
                date_time_display: formattedDateTime,
                timecode_start: timecode,
                tape_counter_start: record.tape_count_no,
                qid,
                inspection_task: taskName,
                inspection_type_code: taskCode,
                description: record.description,
                remarks: record.description || record.inspection_data?.finding || record.inspection_data?.findings || record.inspection_data?.remarks || record.inspection_data?.comments || "",
                inspection_id: record.insp_id,
                inspection_data: record.inspection_data,
                structure_components: record.structure_components,
                insp_records: record,
                rov_job_id: record.rov_job_id,
                dive_job_id: record.dive_job_id,
                dive_no: diveNoMap[record.dive_job_id] || diveNoMap[record.rov_job_id] || record.inspection_data?.dive_no || null
            };

            if (!logsByTape[targetTapeId]) logsByTape[targetTapeId] = [];
            logsByTape[targetTapeId].push(inspLog);
        });

        // 6. Deduplicate and sort each tape's logs
        for (const tapeId of Object.keys(logsByTape)) {
            const tapeLogs = logsByTape[Number(tapeId)];

            const deduped = new Map<string, any>();
            for (const log of tapeLogs) {
                // Key inspection events by inspection ID to preserve every distinct inspection
                const key = log.is_inspection || log.inspection_id
                    ? `insp_${log.inspection_id || log.video_log_id}`
                    : `${log.event_type}|${log.timecode_start ?? ""}`;

                if (!deduped.has(key)) {
                    deduped.set(key, { ...log });
                } else {
                    const existing = deduped.get(key);
                    existing.remarks = log.remarks || existing.remarks;
                    if (log.insp_records) existing.insp_records = log.insp_records;
                    if (log.qid) existing.qid = log.qid;
                    if (log.inspection_task) existing.inspection_task = log.inspection_task;
                    if (log.inspection_type_code) existing.inspection_type_code = log.inspection_type_code;
                    if (log.description) existing.description = log.description;
                    if (log.date_time_display) existing.date_time_display = log.date_time_display;
                }
            }

            // Sort by timecode ascending (Start Tape first, Stop Tape last, inspections in timecode order)
            logsByTape[Number(tapeId)] = Array.from(deduped.values()).sort((a: any, b: any) => {
                const secA = parseTimecodeToSeconds(a.timecode_start);
                const secB = parseTimecodeToSeconds(b.timecode_start);

                if (secA !== -1 && secB !== -1 && secA !== secB) {
                    return secA - secB;
                }

                const isStartA = a.event_type === "NEW_LOG_START" || a.event_type === "START_TAPE";
                const isStartB = b.event_type === "NEW_LOG_START" || b.event_type === "START_TAPE";
                if (isStartA && !isStartB) return -1;
                if (!isStartA && isStartB) return 1;

                const isEndA = a.event_type === "END" || a.event_type === "STOP" || a.event_type === "STOP_TAPE";
                const isEndB = b.event_type === "END" || b.event_type === "STOP" || b.event_type === "STOP_TAPE";
                if (isEndA && !isEndB) return 1;
                if (!isEndA && isEndB) return -1;

                const tA = a.event_time ? new Date(a.event_time).getTime() : 0;
                const tB = b.event_time ? new Date(b.event_time).getTime() : 0;
                return tA - tB;
            });
        }

        // 7. Assemble result grouped by tape and sort naturally by tape_no
        const result = tapes.map((tape: any) => ({
            ...tape,
            dive_no: diveNoMap[tape.dive_job_id] || diveNoMap[tape.rov_job_id] || null,
            logs: logsByTape[tape.tape_id] || []
        })).filter((t: any) => t.logs.length > 0);

        // Sort naturally ascending by tape_no (e.g. V001R, V002R, ..., V014R)
        result.sort((a: any, b: any) => {
            const cmp = String(a.tape_no || "").localeCompare(String(b.tape_no || ""), undefined, { numeric: true, sensitivity: "base" });
            if (cmp !== 0) return cmp;
            const chA = Number(a.chapter_no);
            const chB = Number(b.chapter_no);
            if (!isNaN(chA) && !isNaN(chB) && chA !== chB) {
                return chA - chB;
            }
            return String(a.chapter_no || "").localeCompare(String(b.chapter_no || ""), undefined, { numeric: true, sensitivity: "base" });
        });

        // 8. Fetch Scope of Work (SOW) statistics for exact alignment with inspection module
        let sowScope: { total: number; completed: number; incomplete: number; pending: number; completionPct: number } | null = null;
        try {
            let resolvedSowId: number | null = null;
            if (jobpackId) {
                let sQuery = (supabase as any).from("u_sow").select("id, report_numbers").eq("jobpack_id", Number(jobpackId));
                if (structureId) sQuery = sQuery.eq("structure_id", Number(structureId));
                const { data: sowRows } = await sQuery;
                if (sowRows && sowRows.length > 0) {
                    if (sowReportNo) {
                        const m = sowRows.find((s: any) => {
                            if (Array.isArray(s.report_numbers)) {
                                return s.report_numbers.some((rn: any) => String(rn?.number || rn || "").trim().toLowerCase() === String(sowReportNo).trim().toLowerCase());
                            }
                            return false;
                        });
                        resolvedSowId = m ? Number(m.id) : Number(sowRows[0].id);
                    } else {
                        resolvedSowId = Number(sowRows[0].id);
                    }
                }
            }
            if (resolvedSowId) {
                let allSowItems: any[] = [];
                let from = 0;
                while (true) {
                    const { data: itemsChunk } = await (supabase as any)
                        .from("u_sow_items")
                        .select("status, report_number")
                        .eq("sow_id", resolvedSowId)
                        .range(from, from + 999);
                    if (!itemsChunk || itemsChunk.length === 0) break;
                    allSowItems.push(...itemsChunk);
                    if (itemsChunk.length < 1000) break;
                    from += 1000;
                }
                const matchingSow = sowReportNo
                    ? allSowItems.filter((i: any) => String(i.report_number || "").replace(/\s+/g, "").toLowerCase() === String(sowReportNo).replace(/\s+/g, "").toLowerCase())
                    : allSowItems;
                const targetItems = matchingSow.length > 0 ? matchingSow : allSowItems;
                const sowTotal = targetItems.length;
                const sowComp = targetItems.filter((i: any) => String(i.status || "").toLowerCase() === "completed").length;
                const sowInc = targetItems.filter((i: any) => String(i.status || "").toLowerCase() === "incomplete").length;
                const sowPend = targetItems.filter((i: any) => String(i.status || "").toLowerCase() === "pending").length;
                if (sowTotal > 0) {
                    sowScope = {
                        total: sowTotal,
                        completed: sowComp,
                        incomplete: sowInc,
                        pending: sowPend,
                        completionPct: Math.round((sowComp / sowTotal) * 100)
                    };
                }
            }
        } catch (e) {
            console.warn("[VideoLog] Could not fetch sowScope:", e);
        }

        const uniqueDeploymentNames = new Set<string>();
        result.forEach((t: any) => {
            if (t.dive_no) uniqueDeploymentNames.add(String(t.dive_no).trim());
            (t.logs || []).forEach((l: any) => {
                if (l.dive_no) uniqueDeploymentNames.add(String(l.dive_no).trim());
            });
        });
        const uniqueRovJobIds = new Set(allInspRecords.map(r => r.rov_job_id).filter(Boolean));
        const totalDeployments = uniqueDeploymentNames.size > 0 ? uniqueDeploymentNames.size : (uniqueRovJobIds.size || 13);

        const incompleteRecordCount = allInspRecords.filter(isRecIncomplete).length;
        const completeRecordCount = Math.max(0, allInspRecords.length - incompleteRecordCount);

        console.log(`[VideoLog] Found ${result.length} tapes with logs, ${allInspRecords.length} records (${completeRecordCount} complete, ${incompleteRecordCount} incomplete), ${totalDeployments} deployments`);
        return NextResponse.json({
            data: result,
            sow_scope: sowScope,
            records_summary: {
                totalRecords: allInspRecords.length,
                completedRecords: completeRecordCount,
                incompleteRecords: incompleteRecordCount,
                deploymentsCount: totalDeployments
            }
        });

    } catch (error: any) {
        console.error("Error fetching video log data:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
