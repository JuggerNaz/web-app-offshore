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
    // 3. Check JSON inspection_data
    const dataTapeNo = d.tape_no || d.tape || d.video_tape_no || d.tape_number || d.video_tape || d.tapeNo || d.videoTapeNo;
    if (dataTapeNo && typeof dataTapeNo === "string" && dataTapeNo.trim() && isNaN(Number(dataTapeNo))) {
        return dataTapeNo.trim();
    }
    // 4. If tape_no is defined on record even if numeric string
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
 * if they are missing or if tape_no is a raw numeric ID.
 */
export async function enrichRecordsWithTapesAndDeployments(supabase: any, records: any[]): Promise<any[]> {
    if (!supabase || !records || !Array.isArray(records) || records.length === 0) {
        return records;
    }

    try {
        const tapeIds = new Set<number | string>();
        const rovJobIds = new Set<number | string>();
        const diveJobIds = new Set<number | string>();

        for (const r of records) {
            const d = r.inspection_data || r.inspection_dat || {};
            // Tape ID detection
            const tid = r.tape_id || d.tape_id || r.tapeId;
            if (tid && !isNaN(Number(tid))) {
                tapeIds.add(Number(tid));
            } else if (r.tape_no && !isNaN(Number(r.tape_no))) {
                tapeIds.add(Number(r.tape_no));
            } else if (d.tape_no && !isNaN(Number(d.tape_no))) {
                tapeIds.add(Number(d.tape_no));
            }

            // ROV Job ID detection
            const rjid = r.rov_job_id || d.rov_job_id || d.deployment_id || r.deployment_id;
            if (rjid && !isNaN(Number(rjid))) {
                rovJobIds.add(Number(rjid));
            }

            // Dive Job ID detection
            const djid = r.dive_job_id || d.dive_job_id || d.dive_id || r.dive_id;
            if (djid && !isNaN(Number(djid))) {
                diveJobIds.add(Number(djid));
            }
        }

        // Fetch missing tapes in bulk
        const tapeMap = new Map<string | number, any>();
        if (tapeIds.size > 0) {
            const { data: tapes } = await supabase
                .from('insp_video_tapes')
                .select('tape_id, tape_no, chapter_no, structure_id, jobpack_id')
                .in('tape_id', Array.from(tapeIds));
            if (tapes) {
                tapes.forEach((t: any) => {
                    tapeMap.set(Number(t.tape_id), t);
                    tapeMap.set(String(t.tape_id), t);
                });
            }
        }

        // Fetch missing ROV jobs in bulk
        const rovJobMap = new Map<string | number, any>();
        if (rovJobIds.size > 0) {
            const { data: rovJobs } = await supabase
                .from('insp_rov_jobs')
                .select('rov_job_id, job_no, name')
                .in('rov_job_id', Array.from(rovJobIds));
            if (rovJobs) {
                rovJobs.forEach((rj: any) => {
                    rovJobMap.set(Number(rj.rov_job_id), rj);
                    rovJobMap.set(String(rj.rov_job_id), rj);
                });
            }
        }

        // Fetch missing Dive jobs in bulk
        const diveJobMap = new Map<string | number, any>();
        if (diveJobIds.size > 0) {
            const { data: diveJobs } = await supabase
                .from('insp_dive_jobs')
                .select('dive_job_id, job_no, name')
                .in('dive_job_id', Array.from(diveJobIds));
            if (diveJobs) {
                diveJobs.forEach((dj: any) => {
                    diveJobMap.set(Number(dj.dive_job_id), dj);
                    diveJobMap.set(String(dj.dive_job_id), dj);
                });
            }
        }

        // Enrich each record
        for (const r of records) {
            const d = r.inspection_data || r.inspection_dat || {};
            const tid = r.tape_id || d.tape_id || r.tapeId || (r.tape_no && !isNaN(Number(r.tape_no)) ? Number(r.tape_no) : undefined) || (d.tape_no && !isNaN(Number(d.tape_no)) ? Number(d.tape_no) : undefined);
            if (tid && tapeMap.has(tid)) {
                const tape = tapeMap.get(tid);
                r.insp_video_tapes = tape;
                if (!r.tape_no || !isNaN(Number(r.tape_no))) {
                    r.tape_no = tape.tape_no;
                }
            } else if (r.insp_video_tapes?.tape_no && (!r.tape_no || !isNaN(Number(r.tape_no)))) {
                r.tape_no = r.insp_video_tapes.tape_no;
            }

            // ROV Job
            const rjid = r.rov_job_id || d.rov_job_id || d.deployment_id || r.deployment_id;
            if (rjid && rovJobMap.has(rjid)) {
                const rovJob = rovJobMap.get(rjid);
                r.insp_rov_jobs = rovJob;
                if (!r.dive_no) {
                    r.dive_no = rovJob.job_no;
                }
            }

            // Dive Job
            const djid = r.dive_job_id || d.dive_job_id || d.dive_id || r.dive_id;
            if (djid && diveJobMap.has(djid)) {
                const diveJob = diveJobMap.get(djid);
                r.insp_dive_jobs = diveJob;
                if (!r.dive_no) {
                    r.dive_no = diveJob.job_no;
                }
            }
        }
    } catch (err) {
        console.error("Error enriching records with tapes/deployments:", err);
    }

    return records;
}


