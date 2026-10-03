import { formatPdfDate } from "./shared-logo";

export type RecordStatusType = 'NORMAL' | 'ANOMALY' | 'FINDING' | 'RECTIFIED';

export interface RecordStatusInfo {
    type: RecordStatusType;
    isAnomaly: boolean;
    isFinding: boolean;
    isRectified: boolean;
    textColor: [number, number, number];
    hexColor: string;
    anomalyRefNo: string;
    defectDescription: string;
    rectifiedDescription: string;
    rectifiedDate: string | Date | null;
    additionalCpEntries: string[];
    additionalUtEntries: string[];
}

export const REPORT_COLORS = {
    navy: [31, 55, 93] as [number, number, number],
    teal: [20, 184, 166] as [number, number, number],
    lightGray: [248, 250, 252] as [number, number, number],
    border: [203, 213, 225] as [number, number, number],
    text: [30, 41, 59] as [number, number, number],
    anomaly: [220, 38, 38] as [number, number, number],      // Red
    rectified: [22, 163, 74] as [number, number, number],    // Green
    finding: [217, 119, 6] as [number, number, number],      // Orange
};

/**
 * Inspects a record and extracts anomaly/finding/rectification status and additional data.
 */
export function getRecordStatusInfo(r: any): RecordStatusInfo {
    if (!r) {
        return {
            type: 'NORMAL',
            isAnomaly: false,
            isFinding: false,
            isRectified: false,
            textColor: REPORT_COLORS.text,
            hexColor: '#1E293B',
            anomalyRefNo: '',
            defectDescription: '',
            rectifiedDescription: '',
            rectifiedDate: null,
            additionalCpEntries: [],
            additionalUtEntries: []
        };
    }

    const d = r.inspection_data || r.inspection_dat || {};
    const anomList = Array.isArray(r.insp_anomalies) ? r.insp_anomalies : (Array.isArray(r.anomalies) ? r.anomalies : []);
    const linkedAnom = anomList[0] || r.insp_anomaly || r.anomaly_details || d.anomaly || null;

    const metaStatus = String(d._meta_status || r._meta_status || r.meta_status || "").toLowerCase();
    const findingType = String(r.finding_type || d.finding_type || r.findingType || "").toUpperCase();
    const anomType = String(linkedAnom?.type || linkedAnom?.anomaly_type || linkedAnom?.record_type || "").toUpperCase();
    const refNo = String(
        linkedAnom?.anomaly_ref_no || 
        linkedAnom?.reference_no || 
        linkedAnom?.anomaly_ref || 
        r.anomaly_ref_no || 
        r.anomaly_no || 
        r.ref_no || 
        d.anomaly_ref_no || 
        d._meta_ref_no || 
        ""
    ).trim();

    // 1. Finding detection
    const isFinding = Boolean(
        metaStatus === "finding" || 
        r.is_finding === true || 
        r.is_finding === 1 || 
        d.is_finding === true || 
        d.is_finding === 1 || 
        findingType === "FINDING" || 
        anomType === "FINDING" || 
        refNo.toUpperCase().startsWith("F-")
    );

    // 2. Anomaly / Defect detection
    const hasAnomaly = Boolean(
        r.has_anomaly === 1 || 
        r.has_anomaly === true || 
        d.has_anomaly === 1 || 
        d.has_anomaly === true || 
        r.is_anomaly === true || 
        r.is_anomaly === 1 || 
        d.is_anomaly === true || 
        d.is_anomaly === 1 || 
        r.is_defect === true || 
        r.is_defect === 1 || 
        d.is_defect === true || 
        d.is_defect === 1 || 
        r.has_defect === true || 
        r.has_defect === 1 || 
        d.has_defect === true || 
        d.has_defect === 1 || 
        String(r.component_condition || "").toLowerCase() === "anomalous" ||
        String(d.component_condition || "").toLowerCase() === "anomalous" ||
        anomList.length > 0 || 
        !!r.anomaly_id || 
        (!!refNo && !isFinding)
    );

    // 3. Rectification detection
    const isRectified = Boolean(
        linkedAnom?.is_rectified || 
        linkedAnom?.rectified || 
        r.rectified || 
        r.is_rectified || 
        d.rectified ||
        d.is_rectified ||
        String(linkedAnom?.status || "").toUpperCase() === "CLOSED" || 
        String(linkedAnom?.status || "").toUpperCase() === "RECTIFIED" || 
        String(r.status || "").toUpperCase() === "RECTIFIED" || 
        String(d.status || "").toUpperCase() === "RECTIFIED" || 
        !!linkedAnom?.rectified_date || 
        !!linkedAnom?.rectified_remarks || 
        !!r.rectified_comments || 
        !!r.rectified_remarks ||
        !!d.rectified_remarks
    );

    // Defect / Anomaly description extraction
    const defectDescription = (
        linkedAnom?.defect_description || 
        linkedAnom?.description || 
        linkedAnom?.remarks || 
        linkedAnom?.anomaly_description || 
        linkedAnom?.defect_desc || 
        linkedAnom?.anom_desc || 
        d.defect_description || 
        d.anomaly_description || 
        d.defect_desc || 
        d.anomaly_desc || 
        d.anom_desc || 
        r.defect_description || 
        r.anomaly_description || 
        r.defect_desc || 
        r.anomaly_desc || 
        r.anom_desc || 
        ""
    ).toString().trim();

    // Rectified description extraction
    const rectifiedDescription = (
        linkedAnom?.rectified_remarks || 
        linkedAnom?.rectified_description || 
        r.rectified_comments || 
        r.rectified_remarks || 
        d.rectified_remarks || 
        d.rectified_comments || 
        (isRectified ? "Rectified" : "")
    ).toString().trim();

    const rectifiedDate = linkedAnom?.rectified_date || r.rectified_date || d.rectified_date || null;

    // Additional CP extraction
    const additionalCpEntries: string[] = [];
    const addCPData = d.cp_rdg_additional || d.cp_additional || d.cp_readings || r.additional_cp || r.cp_additional;

    if (Array.isArray(addCPData)) {
        addCPData.forEach((item: any) => {
            if (item === null || item === undefined) return;
            if (typeof item === 'object') {
                const val = item.reading ?? item.cp_rdg ?? item.value ?? '';
                if (val !== '' && val !== null && val !== undefined && val !== '-') {
                    const unit = String(val).toLowerCase().includes('mv') ? '' : ' mV';
                    const loc = item.location || item.position ? ` (${item.location || item.position})` : '';
                    additionalCpEntries.push(`Additional CP${loc}: ${val}${unit}`);
                }
            } else if (item !== '' && item !== '-') {
                const unit = String(item).toLowerCase().includes('mv') ? '' : ' mV';
                additionalCpEntries.push(`Additional CP: ${item}${unit}`);
            }
        });
    } else if (addCPData && typeof addCPData === 'object') {
        const val = addCPData.reading ?? addCPData.cp_rdg ?? '';
        if (val !== '' && val !== null && val !== '-') {
            const unit = String(val).toLowerCase().includes('mv') ? '' : ' mV';
            const loc = addCPData.location ? ` (${addCPData.location})` : '';
            additionalCpEntries.push(`Additional CP${loc}: ${val}${unit}`);
        }
    } else if (addCPData && addCPData !== '-') {
        const unit = String(addCPData).toLowerCase().includes('mv') ? '' : ' mV';
        additionalCpEntries.push(`Additional CP: ${addCPData}${unit}`);
    }

    // Additional UT extraction
    const additionalUtEntries: string[] = [];
    const addUTData = d.ut_readings_additional || d.ut_readings || d.ut_additional || d.additional_ut || r.additional_ut || r.ut_additional;

    if (Array.isArray(addUTData)) {
        addUTData.forEach((item: any) => {
            if (item === null || item === undefined) return;
            if (typeof item === 'object') {
                const val = item.reading ?? item.ut_rdg ?? item.thickness ?? item.value ?? '';
                if (val !== '' && val !== null && val !== undefined && val !== '-') {
                    const unit = String(val).toLowerCase().includes('mm') ? '' : ' mm';
                    const loc = item.location || item.position ? ` (${item.location || item.position})` : '';
                    additionalUtEntries.push(`Additional UT${loc}: ${val}${unit}`);
                }
            } else if (item !== '' && item !== '-') {
                const unit = String(item).toLowerCase().includes('mm') ? '' : ' mm';
                additionalUtEntries.push(`Additional UT: ${item}${unit}`);
            }
        });
    } else if (addUTData && typeof addUTData === 'object') {
        const val = addUTData.reading ?? addUTData.ut_rdg ?? '';
        if (val !== '' && val !== null && val !== '-') {
            const unit = String(val).toLowerCase().includes('mm') ? '' : ' mm';
            const loc = addUTData.location ? ` (${addUTData.location})` : '';
            additionalUtEntries.push(`Additional UT${loc}: ${val}${unit}`);
        }
    } else if (addUTData && addUTData !== '-') {
        const unit = String(addUTData).toLowerCase().includes('mm') ? '' : ' mm';
        additionalUtEntries.push(`Additional UT: ${addUTData}${unit}`);
    }

    // Determine type and colors
    let type: RecordStatusType = 'NORMAL';
    let textColor = REPORT_COLORS.text;
    let hexColor = '#1E293B';

    if (isRectified && (hasAnomaly || isFinding)) {
        type = 'RECTIFIED';
        textColor = REPORT_COLORS.rectified;
        hexColor = '#16A34A';
    } else if (isFinding) {
        type = 'FINDING';
        textColor = REPORT_COLORS.finding;
        hexColor = '#D97706';
    } else if (hasAnomaly) {
        type = 'ANOMALY';
        textColor = REPORT_COLORS.anomaly;
        hexColor = '#DC2626';
    }

    return {
        type,
        isAnomaly: hasAnomaly,
        isFinding,
        isRectified,
        textColor,
        hexColor,
        anomalyRefNo: refNo,
        defectDescription,
        rectifiedDescription,
        rectifiedDate,
        additionalCpEntries,
        additionalUtEntries
    };
}

/**
 * Formats the complete Finding / Description / Observation cell text according to requirements:
 * 1. Base Finding / Description
 * 2. Additional CP (if Got data)
 * 3. Additional UT (if Got data)
 * 4. 'Anomaly Description:' or 'Finding Description:' (if got data)
 * 5. If rectified: 'Rectified Description: {desc}'
 * 6. 'Please refer to Anomaly No.:' / 'Please refer to Finding No.:' {reference no.}
 */
export function formatReportFindingText(r: any, baseFinding?: string): string {
    const info = getRecordStatusInfo(r);
    const lines: string[] = [];

    // 1. Base Finding / Description
    let initialFinding = (baseFinding !== undefined ? baseFinding : (r.description || r.findings || r.inspection_data?.findings || r.inspection_data?.description || "")).toString().trim();
    
    // Clean up placeholder text if we have substantive anomaly/additional data
    const hasExtraInfo = info.isAnomaly || info.isFinding || info.isRectified || info.additionalCpEntries.length > 0 || info.additionalUtEntries.length > 0;
    if (hasExtraInfo && (initialFinding === "No significant findings" || initialFinding === "N/A" || initialFinding === "-" || initialFinding === "—" || initialFinding === "None")) {
        initialFinding = "";
    }

    let baseText = initialFinding;
    if (info.defectDescription && baseText === info.defectDescription) {
        baseText = ""; // Avoid duplicate text, will be shown under Anomaly Description / Finding Description
    }

    if (baseText) {
        lines.push(baseText);
    }

    // 2. Append Additional CP (if Got data)
    info.additionalCpEntries.forEach(cpStr => lines.push(cpStr));

    // 3. Append Additional UT (if Got data)
    info.additionalUtEntries.forEach(utStr => lines.push(utStr));

    // 4. Append Anomaly/Finding Description (if Got data)
    if (info.isAnomaly || info.isFinding) {
        if (info.defectDescription) {
            const prefix = info.isFinding ? "Finding Description:" : "Anomaly Description:";
            if (!baseText.includes(info.defectDescription)) {
                lines.push(`${prefix} ${info.defectDescription}`);
            }
        }
    }

    // 5. If rectified, append Rectified Description
    if (info.isRectified) {
        let rectText = info.rectifiedDescription || "Rectified";
        if (info.rectifiedDate) {
            const dateStr = formatPdfDate(info.rectifiedDate);
            if (dateStr && !rectText.includes(dateStr)) {
                rectText += ` (${dateStr})`;
            }
        }
        lines.push(`Rectified Description: ${rectText}`);
    }

    // 6. Append Reference No.
    if (info.anomalyRefNo) {
        const refLabel = info.isFinding ? "Please refer to Finding No.:" : "Please refer to Anomaly No.:";
        lines.push(`${refLabel} ${info.anomalyRefNo}`);
    }

    if (lines.length === 0) {
        return "No significant findings";
    }

    return lines.join("\n");
}

/**
 * Applies text color and bold styling to autoTable cells based on record status.
 * - Rectified -> Green
 * - Finding -> Orange
 * - Anomaly -> Red
 */
export function applyRecordCellStyling(cell: any, r: any, _isPrintFriendly?: boolean) {
    if (!cell || !cell.styles || !r) return;
    const status = getRecordStatusInfo(r);
    if (status.type === 'RECTIFIED') {
        cell.styles.textColor = REPORT_COLORS.rectified;
        cell.styles.fontStyle = 'bold';
    } else if (status.type === 'FINDING') {
        cell.styles.textColor = REPORT_COLORS.finding;
        cell.styles.fontStyle = 'bold';
    } else if (status.type === 'ANOMALY') {
        cell.styles.textColor = REPORT_COLORS.anomaly;
        cell.styles.fontStyle = 'bold';
    }
}
