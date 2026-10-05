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
