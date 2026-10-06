import { format, min, max } from "date-fns";

/**
 * Safely parses an inspection date value (string or Date object) into a Date object without timezone shift.
 */
function parseInspectionDate(val: any): Date | null {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val === "string") {
        const str = val.trim();
        if (!str || str.toUpperCase() === "N/A" || str === "-" || str === "--") return null;

        // Match YYYY-MM-DD or YYYY/MM/DD format
        const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (ymdMatch) {
            const year = parseInt(ymdMatch[1], 10);
            const month = parseInt(ymdMatch[2], 10) - 1;
            const day = parseInt(ymdMatch[3], 10);
            const d = new Date(year, month, day);
            return isNaN(d.getTime()) ? null : d;
        }

        // Match DD/MM/YYYY or DD-MM-YYYY format
        const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (dmyMatch) {
            const day = parseInt(dmyMatch[1], 10);
            const month = parseInt(dmyMatch[2], 10) - 1;
            const year = parseInt(dmyMatch[3], 10);
            const d = new Date(year, month, day);
            return isNaN(d.getTime()) ? null : d;
        }

        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
}

/**
 * Calculates the inspection date range (minimum inspection_date as start date and maximum inspection_date as end date)
 * for the selected structure, jobpack, and sow report no.
 */
export function getInspectionDateRange(
    records?: any[],
    headerData?: any,
    config?: any
): string {
    // 1. Gather candidate records pool (prioritizing full workspace records if provided)
    const candidatePool = (headerData?.allWorkspaceRecords && headerData.allWorkspaceRecords.length > 0)
        ? headerData.allWorkspaceRecords
        : (headerData?.allRecords && headerData.allRecords.length > 0)
            ? headerData.allRecords
            : (records && records.length > 0)
                ? records
                : [];

    if (!candidatePool || candidatePool.length === 0) {
        // If explicit dateRange or inspDateRange is passed in headerData or config, use it if valid
        const explicitRange = headerData?.inspDateRange || headerData?.dateRange || headerData?.date_range || config?.inspDateRange || config?.dateRange;
        if (explicitRange && typeof explicitRange === "string" && explicitRange.trim() !== "" && explicitRange.trim().toUpperCase() !== "N/A") {
            return explicitRange.trim();
        }
        return "N/A";
    }

    // 2. Filter candidate pool by Structure, Jobpack, and SOW Report No
    const targetStructId = headerData?.structureId || headerData?.structure_id || config?.structureId || config?.structure_id;
    const targetJobpackId = headerData?.jobPackId || headerData?.jobpack_id || headerData?.jobpackId || config?.jobPackId || config?.jobpack_id;
    const targetSow = (headerData?.sowReportNo || headerData?.sow_report_no || config?.sowReportNo || config?.sow_report_no || "").trim().toLowerCase();

    let recordsToUse = candidatePool;

    if (targetStructId && String(targetStructId) !== "0") {
        const filtered = recordsToUse.filter((r: any) => {
            const rStructId = r.structure_id || r.structureId || r.str_id;
            return !rStructId || String(rStructId) === String(targetStructId);
        });
        if (filtered.length > 0) recordsToUse = filtered;
    }

    if (targetJobpackId && String(targetJobpackId) !== "0") {
        const filtered = recordsToUse.filter((r: any) => {
            const rJpId = r.jobpack_id || r.jobPackId || r.jobpackId;
            return !rJpId || String(rJpId) === String(targetJobpackId);
        });
        if (filtered.length > 0) recordsToUse = filtered;
    }

    if (targetSow && targetSow !== "all" && targetSow !== "n/a" && targetSow !== "unknown report" && targetSow !== "undefined") {
        const filtered = recordsToUse.filter((r: any) => {
            const rSow = (r.sow_report_no || r.sow_report_num || r.sowReportNo || "").trim().toLowerCase();
            return !rSow || rSow === targetSow;
        });
        if (filtered.length > 0) recordsToUse = filtered;
    }

    // 3. Extract only inspection_date values (min = start date, max = end date)
    const validDates: Date[] = [];
    recordsToUse.forEach((r: any) => {
        const inspDateVal = r.inspection_date || r.inspection_data?.inspection_date || r.inspection_dat?.inspection_date || r.insp_date || r.inspection_data?.insp_date;
        const parsed = parseInspectionDate(inspDateVal);
        if (parsed) {
            validDates.push(parsed);
        }
    });

    if (validDates.length === 0) {
        // Fallback to explicit header value if available
        const explicitRange = headerData?.inspDateRange || headerData?.dateRange || headerData?.date_range || config?.inspDateRange || config?.dateRange;
        if (explicitRange && typeof explicitRange === "string" && explicitRange.trim() !== "" && explicitRange.trim().toUpperCase() !== "N/A") {
            return explicitRange.trim();
        }
        return "N/A";
    }

    const startDate = min(validDates);
    const endDate = max(validDates);

    return `${format(startDate, "dd MMM yyyy")} – ${format(endDate, "dd MMM yyyy")}`;
}

/**
 * Safely extracts the Tape No for an inspection record from all possible locations
 * (joined insp_video_tapes, top-level tape_no, inspection_data, or fallback).
 */
/**
 * Safely extracts the Tape No for an inspection record from all possible locations
 * (joined insp_video_tapes, top-level tape_no, dive/job tape, inspection_data, or fallback).
 */
export function extractRecordTapeNo(r: any, fallback: string = "—"): string {
    if (!r) return fallback;
    const d = r.inspection_data || r.inspection_dat || {};

    // 1. Check joined insp_video_tapes object
    if (r.insp_video_tapes?.tape_no && typeof r.insp_video_tapes.tape_no === "string" && r.insp_video_tapes.tape_no.trim()) {
        return r.insp_video_tapes.tape_no.trim();
    }
    // 2. Check top-level tape_no if string and not purely numeric ID
    if (r.tape_no && typeof r.tape_no === "string" && r.tape_no.trim() && isNaN(Number(r.tape_no))) {
        return r.tape_no.trim();
    }
    // 3. Check explicit dive/job tape number fields
    if (r.dive_tape_no && typeof r.dive_tape_no === "string" && r.dive_tape_no.trim() && isNaN(Number(r.dive_tape_no))) {
        return r.dive_tape_no.trim();
    }
    if (r.job_tape_no && typeof r.job_tape_no === "string" && r.job_tape_no.trim() && isNaN(Number(r.job_tape_no))) {
        return r.job_tape_no.trim();
    }
    if (r.insp_dive_jobs?.tape_no && typeof r.insp_dive_jobs.tape_no === "string" && r.insp_dive_jobs.tape_no.trim() && isNaN(Number(r.insp_dive_jobs.tape_no))) {
        return r.insp_dive_jobs.tape_no.trim();
    }
    if (r.insp_rov_jobs?.tape_no && typeof r.insp_rov_jobs.tape_no === "string" && r.insp_rov_jobs.tape_no.trim() && isNaN(Number(r.insp_rov_jobs.tape_no))) {
        return r.insp_rov_jobs.tape_no.trim();
    }
    if (r.insp_dive_jobs?.insp_video_tapes?.tape_no && typeof r.insp_dive_jobs.insp_video_tapes.tape_no === "string" && r.insp_dive_jobs.insp_video_tapes.tape_no.trim()) {
        return r.insp_dive_jobs.insp_video_tapes.tape_no.trim();
    }
    if (r.insp_rov_jobs?.insp_video_tapes?.tape_no && typeof r.insp_rov_jobs.insp_video_tapes.tape_no === "string" && r.insp_rov_jobs.insp_video_tapes.tape_no.trim()) {
        return r.insp_rov_jobs.insp_video_tapes.tape_no.trim();
    }
    // 4. Check JSON inspection_data
    const dataTapeNo = d.tape_no || d.tape || d.video_tape_no || d.tape_number || d.video_tape || d.tapeNo || d.videoTapeNo || d.tapeno;
    if (dataTapeNo && typeof dataTapeNo === "string" && dataTapeNo.trim() && isNaN(Number(dataTapeNo))) {
        return dataTapeNo.trim();
    }
    // 5. If tape_no is defined on record even if numeric string
    if (r.tape_no && typeof r.tape_no === "string" && r.tape_no.trim()) {
        return r.tape_no.trim();
    }
    if (dataTapeNo && String(dataTapeNo).trim()) {
        return String(dataTapeNo).trim();
    }
    return fallback;
}

/**
 * Enriches a list of records with related insp_video_tapes, insp_rov_jobs, and insp_dive_jobs
 * resolving tapes by record tape_id, video logs, dive/ROV jobs, or dive number.
 */
export async function enrichRecordsWithTapesAndDeployments(supabase: any, records: any[]): Promise<any[]> {
    if (!records || !Array.isArray(records) || records.length === 0) {
        return records || [];
    }

    try {
        let client = supabase;
        if (!client) {
            try {
                const { createClient } = await import("@/utils/supabase/client");
                client = createClient();
            } catch (_) {}
        }
        if (!client) {
            return records;
        }

        const tapeIds = new Set<number | string>();
        const rovJobIds = new Set<number | string>();
        const diveJobIds = new Set<number | string>();
        const inspIds = new Set<number | string>();
        const diveNos = new Set<string>();
        const structureIds = new Set<number | string>();
        const jobpackIds = new Set<number | string>();

        for (const r of records) {
            const d = r.inspection_data || r.inspection_dat || {};
            
            // Record ID
            const iid = r.insp_id || r.id;
            if (iid && !isNaN(Number(iid))) {
                inspIds.add(Number(iid));
            }

            // Tape ID detection
            const tid = r.tape_id || d.tape_id || r.tapeId || d.tapeId;
            if (tid && !isNaN(Number(tid))) {
                tapeIds.add(Number(tid));
            } else if (r.tape_no && !isNaN(Number(r.tape_no))) {
                tapeIds.add(Number(r.tape_no));
            } else if (d.tape_no && !isNaN(Number(d.tape_no))) {
                tapeIds.add(Number(d.tape_no));
            }

            // ROV Job ID detection
            const rjid = r.rov_job_id || d.rov_job_id || d.deployment_id || r.deployment_id || d.deploymentId || r.deploymentId;
            if (rjid && !isNaN(Number(rjid))) {
                rovJobIds.add(Number(rjid));
            }

            // Dive Job ID detection
            const djid = r.dive_job_id || d.dive_job_id || d.dive_id || r.dive_id || d.diveId || r.diveId;
            if (djid && !isNaN(Number(djid))) {
                diveJobIds.add(Number(djid));
            }

            // Dive No / Job No detection
            const dNo = r.dive_no || d.dive_no || r.insp_dive_jobs?.job_no || r.insp_rov_jobs?.job_no || r.deployment_no || d.deployment_no;
            if (dNo && typeof dNo === "string" && dNo.trim() && dNo.trim() !== "—" && dNo.trim() !== "-") {
                diveNos.add(dNo.trim());
            }

            // Structure / Jobpack ID detection
            const sId = r.structure_id || d.structure_id || r.str_id;
            if (sId && !isNaN(Number(sId))) structureIds.add(Number(sId));
            const jpId = r.jobpack_id || d.jobpack_id;
            if (jpId && !isNaN(Number(jpId))) jobpackIds.add(Number(jpId));
        }

        const tapeMap = new Map<string | number, any>();
        const rovJobTapeMap = new Map<string | number, any>();
        const diveJobTapeMap = new Map<string | number, any>();
        const inspLogTapeMap = new Map<string | number, any>();
        const diveNoTapeMap = new Map<string, any>();
        const rovJobMap = new Map<string | number, any>();
        const diveJobMap = new Map<string | number, any>();

        // 1. Fetch missing ROV jobs in bulk & map
        if (rovJobIds.size > 0 || diveNos.size > 0) {
            try {
                if (rovJobIds.size > 0 && diveNos.size > 0) {
                    const { data: rjData } = await client
                        .from('insp_rov_jobs')
                        .select('rov_job_id, job_no, deployment_no, name, rov_operator')
                        .or(`rov_job_id.in.(${Array.from(rovJobIds).join(',')}),job_no.in.(${Array.from(diveNos).map(n => `"${n}"`).join(',')}),deployment_no.in.(${Array.from(diveNos).map(n => `"${n}"`).join(',')})`);
                    if (rjData) {
                        rjData.forEach((rj: any) => {
                            rovJobMap.set(Number(rj.rov_job_id), rj);
                            rovJobMap.set(String(rj.rov_job_id), rj);
                            rovJobIds.add(Number(rj.rov_job_id));
                            if (rj.job_no) diveNos.add(rj.job_no);
                            if (rj.deployment_no) diveNos.add(rj.deployment_no);
                        });
                    }
                } else if (rovJobIds.size > 0) {
                    const { data: rjData } = await client
                        .from('insp_rov_jobs')
                        .select('rov_job_id, job_no, deployment_no, name, rov_operator')
                        .in('rov_job_id', Array.from(rovJobIds));
                    if (rjData) {
                        rjData.forEach((rj: any) => {
                            rovJobMap.set(Number(rj.rov_job_id), rj);
                            rovJobMap.set(String(rj.rov_job_id), rj);
                        });
                    }
                }
            } catch (_) {}
        }

        // 2. Fetch missing Dive jobs in bulk & map
        if (diveJobIds.size > 0 || diveNos.size > 0) {
            try {
                if (diveJobIds.size > 0 && diveNos.size > 0) {
                    const { data: djData } = await client
                        .from('insp_dive_jobs')
                        .select('dive_job_id, job_no, dive_no, name, diver_name')
                        .or(`dive_job_id.in.(${Array.from(diveJobIds).join(',')}),job_no.in.(${Array.from(diveNos).map(n => `"${n}"`).join(',')}),dive_no.in.(${Array.from(diveNos).map(n => `"${n}"`).join(',')})`);
                    if (djData) {
                        djData.forEach((dj: any) => {
                            diveJobMap.set(Number(dj.dive_job_id), dj);
                            diveJobMap.set(String(dj.dive_job_id), dj);
                            diveJobIds.add(Number(dj.dive_job_id));
                            if (dj.job_no) diveNos.add(dj.job_no);
                            if (dj.dive_no) diveNos.add(dj.dive_no);
                        });
                    }
                } else if (diveJobIds.size > 0) {
                    const { data: djData } = await client
                        .from('insp_dive_jobs')
                        .select('dive_job_id, job_no, dive_no, name, diver_name')
                        .in('dive_job_id', Array.from(diveJobIds));
                    if (djData) {
                        djData.forEach((dj: any) => {
                            diveJobMap.set(Number(dj.dive_job_id), dj);
                            diveJobMap.set(String(dj.dive_job_id), dj);
                        });
                    }
                }
            } catch (_) {}
        }

        // 3. Query insp_video_logs by inspection_id
        if (inspIds.size > 0) {
            try {
                const { data: logs } = await client
                    .from('insp_video_logs')
                    .select('inspection_id, tape_id, insp_video_tapes:tape_id(tape_id, tape_no, chapter_no)')
                    .in('inspection_id', Array.from(inspIds));
                if (logs) {
                    logs.forEach((l: any) => {
                        if (l.insp_video_tapes?.tape_no) {
                            inspLogTapeMap.set(Number(l.inspection_id), l.insp_video_tapes);
                            inspLogTapeMap.set(String(l.inspection_id), l.insp_video_tapes);
                        } else if (l.tape_id) {
                            tapeIds.add(Number(l.tape_id));
                            inspLogTapeMap.set(Number(l.inspection_id), { tape_id: l.tape_id });
                            inspLogTapeMap.set(String(l.inspection_id), { tape_id: l.tape_id });
                        }
                    });
                }
            } catch (_) {}
        }

        // 4. Fetch all relevant tapes
        const tapeQueries: Promise<any>[] = [];
        if (tapeIds.size > 0) {
            tapeQueries.push(
                client.from('insp_video_tapes').select('tape_id, tape_no, chapter_no, dive_job_id, rov_job_id, structure_id, jobpack_id').in('tape_id', Array.from(tapeIds))
            );
        }
        if (diveJobIds.size > 0) {
            tapeQueries.push(
                client.from('insp_video_tapes').select('tape_id, tape_no, chapter_no, dive_job_id, rov_job_id, structure_id, jobpack_id').in('dive_job_id', Array.from(diveJobIds))
            );
        }
        if (rovJobIds.size > 0) {
            tapeQueries.push(
                client.from('insp_video_tapes').select('tape_id, tape_no, chapter_no, dive_job_id, rov_job_id, structure_id, jobpack_id').in('rov_job_id', Array.from(rovJobIds))
            );
        }
        if (structureIds.size > 0 && jobpackIds.size > 0) {
            tapeQueries.push(
                client.from('insp_video_tapes').select('tape_id, tape_no, chapter_no, dive_job_id, rov_job_id, structure_id, jobpack_id')
                    .in('structure_id', Array.from(structureIds))
                    .in('jobpack_id', Array.from(jobpackIds))
            );
        }

        const tapeQueryResults = await Promise.all(tapeQueries);
        tapeQueryResults.forEach((res) => {
            if (res?.data && Array.isArray(res.data)) {
                res.data.forEach((t: any) => {
                    if (t.tape_id) {
                        tapeMap.set(Number(t.tape_id), t);
                        tapeMap.set(String(t.tape_id), t);
                    }
                    if (t.dive_job_id) {
                        diveJobTapeMap.set(Number(t.dive_job_id), t);
                        diveJobTapeMap.set(String(t.dive_job_id), t);
                    }
                    if (t.rov_job_id) {
                        rovJobTapeMap.set(Number(t.rov_job_id), t);
                        rovJobTapeMap.set(String(t.rov_job_id), t);
                    }
                });
            }
        });

        // Link diveNos (e.g. JRG039) to tapes
        diveJobMap.forEach((dj, djId) => {
            const tape = diveJobTapeMap.get(djId) || (dj.tape_id && tapeMap.get(dj.tape_id));
            if (tape) {
                if (dj.job_no) diveNoTapeMap.set(String(dj.job_no).trim().toUpperCase(), tape);
                if (dj.dive_no) diveNoTapeMap.set(String(dj.dive_no).trim().toUpperCase(), tape);
            }
        });
        rovJobMap.forEach((rj, rjId) => {
            const tape = rovJobTapeMap.get(rjId) || (rj.tape_id && tapeMap.get(rj.tape_id));
            if (tape) {
                if (rj.job_no) diveNoTapeMap.set(String(rj.job_no).trim().toUpperCase(), tape);
                if (rj.deployment_no) diveNoTapeMap.set(String(rj.deployment_no).trim().toUpperCase(), tape);
            }
        });

        // 5. Enrich each record
        for (const r of records) {
            const d = r.inspection_data || r.inspection_dat || {};
            const iid = r.insp_id || r.id;

            // Dive Job mapping
            const djid = r.dive_job_id || d.dive_job_id || d.dive_id || r.dive_id;
            if (djid && diveJobMap.has(djid)) {
                const diveJob = diveJobMap.get(djid);
                r.insp_dive_jobs = { ...r.insp_dive_jobs, ...diveJob };
                if (!r.dive_no) {
                    r.dive_no = diveJob.job_no || diveJob.dive_no;
                }
            }

            // ROV Job mapping
            const rjid = r.rov_job_id || d.rov_job_id || d.deployment_id || r.deployment_id;
            if (rjid && rovJobMap.has(rjid)) {
                const rovJob = rovJobMap.get(rjid);
                r.insp_rov_jobs = { ...r.insp_rov_jobs, ...rovJob };
                if (!r.dive_no) {
                    r.dive_no = rovJob.job_no || rovJob.deployment_no;
                }
            }

            // Tape resolution order:
            // 1. Existing r.insp_video_tapes with non-empty tape_no
            // 2. Video log event for this inspection record
            // 3. Direct tape_id (from r.tape_id, d.tape_id, r.tape_no if numeric)
            // 4. ROV Job tape (from r.rov_job_id)
            // 5. Dive Job tape (from r.dive_job_id)
            // 6. Match by dive_no / deployment_no string (e.g. "JRG039")
            // 7. Top-level tape_no or d.tape_no if non-numeric string
            let resolvedTape: any = null;

            if (r.insp_video_tapes?.tape_no && typeof r.insp_video_tapes.tape_no === "string" && r.insp_video_tapes.tape_no.trim()) {
                resolvedTape = r.insp_video_tapes;
            }

            if (!resolvedTape && iid && inspLogTapeMap.has(iid)) {
                const logTape = inspLogTapeMap.get(iid);
                if (logTape.tape_no) {
                    resolvedTape = logTape;
                } else if (logTape.tape_id && tapeMap.has(logTape.tape_id)) {
                    resolvedTape = tapeMap.get(logTape.tape_id);
                }
            }

            const tid = r.tape_id || d.tape_id || r.tapeId || d.tapeId || 
                (r.tape_no && !isNaN(Number(r.tape_no)) ? Number(r.tape_no) : undefined) || 
                (d.tape_no && !isNaN(Number(d.tape_no)) ? Number(d.tape_no) : undefined);
            if (!resolvedTape && tid && tapeMap.has(tid)) {
                resolvedTape = tapeMap.get(tid);
            }

            if (!resolvedTape && rjid && rovJobTapeMap.has(rjid)) {
                resolvedTape = rovJobTapeMap.get(rjid);
            }

            if (!resolvedTape && djid && diveJobTapeMap.has(djid)) {
                resolvedTape = diveJobTapeMap.get(djid);
            }

            const recordDiveNo = (r.dive_no || d.dive_no || r.insp_dive_jobs?.job_no || r.insp_rov_jobs?.job_no || r.insp_rov_jobs?.deployment_no || "").toString().trim().toUpperCase();
            if (!resolvedTape && recordDiveNo && diveNoTapeMap.has(recordDiveNo)) {
                resolvedTape = diveNoTapeMap.get(recordDiveNo);
            }

            if (resolvedTape && resolvedTape.tape_no) {
                r.insp_video_tapes = resolvedTape;
                r.tape_no = resolvedTape.tape_no;
                r.dive_tape_no = resolvedTape.tape_no;
            } else if (r.tape_no && typeof r.tape_no === "string" && isNaN(Number(r.tape_no)) && r.tape_no.trim()) {
                r.tape_no = r.tape_no.trim();
            } else {
                const dataTapeNo = d.tape_no || d.tape || d.video_tape_no || d.tape_number || d.video_tape || d.tapeNo || d.videoTapeNo;
                if (dataTapeNo && typeof dataTapeNo === "string" && isNaN(Number(dataTapeNo)) && dataTapeNo.trim()) {
                    r.tape_no = dataTapeNo.trim();
                }
            }
        }
    } catch (err) {
        console.error("Error enriching records with tapes/deployments:", err);
    }

    return records;
}


