import { format } from "date-fns";
import { isBLRecord } from "@/app/dashboard/inspection-v2/workspace/components/ReportWizardDialog";
import { getMGIProfileForJobpack } from "@/utils/mgi-profile-helper";

const LANDSCAPE_SECTION_XML = `<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0"/></w:sectPr>`;
const PORTRAIT_SECTION_XML = `<w:sectPr><w:pgSz w:w="11906" w:h="16838" w:orient="portrait"/><w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0"/></w:sectPr>`;

// Helper to load pdf.js from CDN and convert a PDF Blob to an array of images (page_image)
const convertPdfBlobToImages = async (pdfBlob: Blob): Promise<Array<{ page_image: any, photo: any, is_landscape: boolean, section_break: string, qid: string, elevation: string, description: string }>> => {
    try {
        // Load pdf.js dynamically
        const pdfjsLib = await new Promise<any>((resolve, reject) => {
            if ((window as any).pdfjsLib) {
                resolve((window as any).pdfjsLib);
                return;
            }
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
            script.onload = () => {
                const lib = (window as any).pdfjsLib;
                lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
                resolve(lib);
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });

        const arrayBuffer = await pdfBlob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });

            // Check if page is landscape
            const isLandscape = viewport.width > viewport.height;

            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            if (!context) continue;

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            const base64Data = canvas.toDataURL("image/png");
            
            pages.push({
                page_image: {
                    data: base64Data,
                    extension: ".png"
                },
                photo: {
                    data: base64Data,
                    extension: ".png"
                },
                is_landscape: isLandscape,
                section_break: "",
                qid: `Page ${i}`,
                elevation: "-",
                description: `Rendered page ${i} of report`
            });
        }

        // Second pass: Shift section breaks to match OpenXML layout offset logic
        for (let i = 0; i < pages.length; i++) {
            if (i === 0) {
                // Break before Page 1 closes the preceding section (which is portrait)
                pages[i].section_break = PORTRAIT_SECTION_XML;
            } else {
                // Break before Page i+1 closes Page i (so matches Page i's orientation)
                pages[i].section_break = pages[i - 1].is_landscape ? LANDSCAPE_SECTION_XML : PORTRAIT_SECTION_XML;
            }
        }

        return pages;
    } catch (err) {
        console.error("Error converting PDF to images:", err);
        return [];
    }
};

/**
 * Maps raw inspection records into a format suitable for docxtemplater loops.
 */
export const mapInspectionDataForDocx = async (
    records: any[],
    aliases: any[],
    jobPack?: any,
    structure?: any,
    sowReportNo?: string,
    companySettings?: any
) => {
    const safeAliases = Array.isArray(aliases) ? aliases : [];
    const aliasMap = new Map(safeAliases.map(a => [a.template_id, (a.alias || "").trim()]));

    // Fetch all attachments for these inspection records if any
    const recordIds = records.map(r => r.insp_id).filter(Boolean);
    let attachments: any[] = [];
    if (recordIds.length > 0) {
        try {
            const { createClient } = await import("@/utils/supabase/client");
            const supabase = createClient();
            const { data } = await supabase
                .from('attachment')
                .select('*')
                .in('source_id', recordIds)
                .in('source_type', ['inspection', 'INSPECTION'])
                .is('is_deleted', false);
            attachments = data || [];
        } catch (e) {
            console.error("Failed to fetch attachments for docx:", e);
        }
    }

    // 1. Group records by their inspection type code
    const grouped: Record<string, any[]> = {};
    records.forEach(r => {
        const code = r.inspection_type?.code || "GENERAL";
        if (!grouped[code]) grouped[code] = [];
        grouped[code].push(r);
    });

    const reportData: any = {
        HAS_GVI: (grouped['RGVI']?.length || 0) > 0,
        HAS_CP: (grouped['CP']?.length || 0) > 0,
        HAS_MGI: (grouped['RMGI']?.length || 0) > 0,
        HAS_FMD: (grouped['FMD']?.length || 0) > 0,
    };

    // 2. Format specific tables
    
    // CP Table
    if (reportData.HAS_CP) {
        reportData.CP_TABLE = grouped['CP'].map(r => ({
            component: r.structure_components?.q_id || "N/A",
            reading: r.inspection_data?.cp_reading || r.inspection_dat?.cp_reading || "-",
            status: r.inspection_data?.status || "N/A",
            date: r.inspection_date ? format(new Date(r.inspection_date), 'dd/MM/yyyy') : "-"
        }));
    }

    // MGI Table
    if (reportData.HAS_MGI) {
        reportData.MGI_TABLE = grouped['RMGI'].map(r => {
            const d = r.inspection_data || r.inspection_dat || {};
            return {
                depth: r.elevation || "-",
                hard_12: d.mgi_hard_thickness_at_12 || "-",
                hard_3: d.mgi_hard_thickness_at_3 || "-",
                hard_6: d.mgi_hard_thickness_at_6 || "-",
                hard_9: d.mgi_hard_thickness_at_9 || "-",
                limit: d.mgi_profile || "-",
                findings: r.description || "N/A"
            };
        });
    }

    // 3. Handle System Aliases
    // For every alias defined in settings, we create a specific tag
    const templateCodeMap: Record<string, string[]> = {
        'rov-gvi-report': ['RGVI'],
        'rov-mgi-report': ['RMGI', 'MGROW'],
        'rov-seabed-report': ['RSEAB'],
        'rov-rseab-detail-report': ['RSEAB'],
        'rov-rseab-gas-detail-report': ['RSEAB'],
        'rov-rseab-crater-detail-report': ['RSEAB'],
        'rov-cp-report': ['CP', 'RSANI'],
        'rov-fmd-report': ['RFMD'],
        'diving-fmd-report': ['FLOOD', 'FMD', 'DFMD'],
        'diving-measu-report': ['MEASU', 'DMSR', 'MEASUREMENT', 'DMEAS'],
        'rov-riser-report': ['RRISI'],
        'rrisi-report': ['RRISI'],
        'rrisi-detail-report': ['RRISI'],
        'diving-rrisi-report': ['DRRISI', 'DRISI', 'RSURV', 'RISER', 'DRSER', 'DRSI'],
        'diving-rrisi-detail-report': ['DRRISI', 'DRISI', 'RSURV', 'RISER', 'DRSER', 'DRSI'],
        'diving-jtisi-report': ['DRRISI', 'DRISI', 'RSURV', 'RISER', 'DRSER', 'DRSI', 'JTISI'],
        'diving-jtisi-detail-report': ['DRRISI', 'DRISI', 'RSURV', 'RISER', 'DRSER', 'DRSI', 'JTISI'],
        'diving-itisi-report': ['DRRISI', 'DRISI', 'RSURV', 'RISER', 'DRSER', 'DRSI', 'ITISI'],
        'diving-itisi-detail-report': ['DRRISI', 'DRISI', 'RSURV', 'RISER', 'DRSER', 'DRSI', 'ITISI'],
        'rov-jtisi-detail-report': ['RRISI'],
        'rov-itisi-detail-report': ['RRISI'],
        'rov-scour-report': ['RSCOR'],
        'rov-caisson-report': ['RCASN'],
        'rov-conductor-report': ['RCOND'],
        'rov-splash-zone-report': ['RSZCI'],
        'rov-node-report': ['RSWNI']
    };

    for (const a of safeAliases) {
        const alias = (a.alias || "").trim();
        if (!alias) continue;

        const templateId = a.template_id.toLowerCase();
        
        // Filter records for this template first to check if there is data
        const recordsForTemplate = records.filter(r => {
            const code = (r.inspection_type?.code || "").toUpperCase();
            
            // System level reports explicit routing
            if (templateId === 'defect-summary') {
                return r.has_anomaly === 1 || r.has_anomaly === true || (Array.isArray(r.insp_anomalies) && r.insp_anomalies.length > 0);
            }
            if (templateId === 'findings-summary') {
                return (r.description && r.description !== "N/A") && !(r.has_anomaly === 1 || r.has_anomaly === true);
            }
            if (templateId === 'inspection-report') {
                return true;
            }
            if (templateId === 'work-scope-incomplete') {
                return r.status && !['COMPLETED', 'APPROVED', 'CLOSE', 'CLOSED'].includes(r.status.toUpperCase());
            }
            if (templateId === 'inspection-schedule' || templateId === 'planning-overview') {
                return true;
            }

            // Activity-specific reports routing
            if (templateCodeMap[templateId] && templateCodeMap[templateId].includes(code)) {
                return true;
            }

            // Fallback heuristic
            const upperTemplateId = templateId.toUpperCase();
            return upperTemplateId.includes(code) || code.includes(upperTemplateId.replace('-REPORT', '').replace('ROV-', 'R'));
        });

        // Skip CPU-heavy PDF generation for record-level reports if there are no records
        const isJobpackLevel = [
            'defect-criteria-report',
            'jobpack-summary-report',
            'work-scope-status-report',
            'work-scope-incomplete-report',
            'work-scope-report',
            'diver-log-report',
            'video-log-report',
            'structure-summary',
            'component-catalog',
            'technical-specs',
            'component-spec'
        ].includes(templateId);

        if (!isJobpackLevel && recordsForTemplate.length === 0) {
            continue;
        }

        let pdfBlob: any = null;
        
        try {
            if (templateId === 'defect-summary' || templateId === 'findings-summary') {
                const { generateDefectSummaryReport } = await import("./defect-summary-report");
                const isFindingsReport = templateId === "findings-summary";
                pdfBlob = await generateDefectSummaryReport(
                    jobPack,
                    structure,
                    sowReportNo || "",
                    companySettings || {},
                    { returnBlob: true, prefix: isFindingsReport ? "F-" : "A-", isFindingsReport, showPageNumbers: false } as any
                ) as any;
            } else if (templateId === 'defect-summary-pipeline' || templateId === 'findings-summary-pipeline' || templateId === 'defect-summary-pipeline-report' || templateId === 'findings-summary-pipeline-report') {
                const { generatePipelineDefectSummaryReport } = await import("./defect-summary-pipeline-report");
                const isFindingsReport = templateId.includes("findings");
                pdfBlob = await generatePipelineDefectSummaryReport(
                    jobPack,
                    structure,
                    sowReportNo || "",
                    companySettings || {},
                    { returnBlob: true, prefix: isFindingsReport ? "F-" : "A-", isFindingsReport, showPageNumbers: false } as any
                ) as any;
            } else if (templateId === 'defect-anomaly-report' || templateId === 'findings-report') {
                const { generateDefectAnomalyReport } = await import("./defect-anomaly-report");
                const isFindingsReport = templateId === "findings-report";
                pdfBlob = await generateDefectAnomalyReport(
                    jobPack,
                    structure,
                    sowReportNo || "",
                    companySettings || {},
                    { returnBlob: true, prefix: isFindingsReport ? "F-" : "A-", isFindingsReport, showPageNumbers: false } as any
                ) as any;
            } else if (templateId === 'defect-criteria-report') {
                const { generateDefectCriteriaReport } = await import("./defect-criteria-report");
                pdfBlob = await generateDefectCriteriaReport(
                    companySettings || {},
                    { returnBlob: true, showPageNumbers: false } as any
                ) as any;
            } else if (templateId === 'jobpack-summary-report') {
                const { generateJobPackSummaryReport } = await import("./jobpack-summary-report");
                pdfBlob = await generateJobPackSummaryReport(
                    jobPack,
                    companySettings || {},
                    { returnBlob: true, showPageNumbers: false } as any
                ) as any;
            } else if (templateId === 'work-scope-status-report') {
                const { generateWorkScopeStatusReport } = await import("./work-scope-status-report");
                pdfBlob = await generateWorkScopeStatusReport(
                    jobPack,
                    structure,
                    (sowReportNo || "") as any,
                    companySettings || {},
                    { returnBlob: true, showPageNumbers: false } as any
                ) as any;
            } else if (templateId === 'work-scope-incomplete-report') {
                const { generateWorkScopeIncompleteReport } = await import("./work-scope-incomplete-report");
                pdfBlob = await generateWorkScopeIncompleteReport(
                    jobPack,
                    structure,
                    (sowReportNo || "") as any,
                    companySettings || {},
                    { returnBlob: true, showPageNumbers: false } as any
                ) as any;
            } else if (templateId === 'work-scope-report') {
                const { generateWorkScopeReport } = await import("./work-scope-report");
                pdfBlob = await generateWorkScopeReport(
                    jobPack,
                    structure,
                    (sowReportNo || "") as any,
                    companySettings || {},
                    { returnBlob: true, showPageNumbers: false } as any
                ) as any;
            } else if (templateId === 'diver-log-report') {
                const { generateDiverLogReport } = await import("./diver-log-report");
                pdfBlob = await generateDiverLogReport(
                    jobPack,
                    structure,
                    sowReportNo || "",
                    companySettings || {},
                    { returnBlob: true, showPageNumbers: false } as any
                ) as any;
            } else if (templateId === 'video-log-report') {
                const { generateVideoLogReport } = await import("./video-log-report");
                pdfBlob = await generateVideoLogReport(
                    jobPack,
                    structure,
                    sowReportNo || "",
                    companySettings || {},
                    { returnBlob: true, showPageNumbers: false } as any
                ) as any;
            } else if (templateId === 'rov-rgvi-report') {
                const { generateROVRGVIReport } = await import("./rov-rgvi-report");
                pdfBlob = await generateROVRGVIReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RGVI"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-rwdi-report') {
                const { generateROVRWDIReport } = await import("./rov-rwdi-report");
                pdfBlob = await generateROVRWDIReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RWDI"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-ricmi-report') {
                const { generateROVRICMIReport } = await import("./rov-ricmi-report");
                pdfBlob = await generateROVRICMIReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RICMI"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-cp-report') {
                const { generateROVCPReport } = await import("./rov-cp-report");
                pdfBlob = await generateROVCPReport(records.filter(r => ["CP", "RSANI"].includes((r.inspection_type?.code || "").toUpperCase())), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-fmd-report' || templateId === 'fmd-report') {
                const { generateROVFMDReport } = await import("./rov-fmd-report");
                pdfBlob = await generateROVFMDReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RFMD" || (r.inspection_type?.code || "").toUpperCase() === "FMD"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'diving-fmd-report' || templateId === 'fmd-diving-report') {
                const { generateDivingFMDReport } = await import("./diving-fmd-report");
                pdfBlob = await generateDivingFMDReport(records.filter(r => ["FLOOD", "FMD", "DFMD"].includes((r.inspection_type?.code || "").toUpperCase())), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'diving-measu-report' || templateId === 'measu-report') {
                const { generateDivingMEASUReport } = await import("./diving-measu-report");
                pdfBlob = await generateDivingMEASUReport(records.filter(r => ["MEASU", "DMSR", "MEASUREMENT", "DMEAS"].includes((r.inspection_type?.code || "").toUpperCase())), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-rcond-report') {
                const { generateROVCondReport } = await import("./rov-rcond-report");
                pdfBlob = await generateROVCondReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RCOND"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-rcasn-report') {
                const { generateROVCasnReport } = await import("./rov-rcasn-report");
                pdfBlob = await generateROVCasnReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RCASN"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-bl-report') {
                const { generateROVBoatlandingReport } = await import("./rov-boatlanding-report");
                pdfBlob = await generateROVBoatlandingReport(records.filter(r => isBLRecord(r) || (r.inspection_type?.code || "").toUpperCase() === "RBLTG"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-rg-report') {
                const { generateROVRiserGuardReport } = await import("./rov-riser-guard-report");
                pdfBlob = await generateROVRiserGuardReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RGUARD"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-sg-report') {
                const { generateROVCaissonGuardReport } = await import("./rov-caisson-guard-report");
                pdfBlob = await generateROVCaissonGuardReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RCG"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-cu-report') {
                const { generateROVConductorGuardReport } = await import("./rov-conductor-guard-report");
                pdfBlob = await generateROVConductorGuardReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RCDG"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-navig-report' || templateId === 'navig-report') {
                const { generateROVNavigReport } = await import("./rov-navig-report");
                pdfBlob = await generateROVNavigReport(jobPack, structure, sowReportNo || "N/A", companySettings || {}, { headerData: { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, returnBlob: true, showSignatures: false, showPageNumbers: false } as any, records);
            } else if (templateId === 'rov-rcond-sketch-report') {
                const { generateROVCondSketchReport } = await import("./rov-rcond-sketch-report");
                pdfBlob = await generateROVCondSketchReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RCOND"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-rcasn-sketch-report') {
                const { generateROVCasnSketchReport } = await import("./rov-rcasn-sketch-report");
                pdfBlob = await generateROVCasnSketchReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RCASN"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rrisi-report') {
                const { generateROVRRISIReport } = await import("./rov-rrisi-report");
                pdfBlob = await generateROVRRISIReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RRISI"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (['diving-rrisi-report', 'drrisi-report', 'diving-jtisi-report', 'diving-itisi-report'].includes(templateId)) {
                const { generateDivingRRISIReport } = await import("./diving-rrisi-report");
                let reportType: 'R' | 'J' | 'I' = 'R';
                if (templateId === 'diving-jtisi-report') reportType = 'J';
                if (templateId === 'diving-itisi-report') reportType = 'I';
                pdfBlob = await generateDivingRRISIReport(records, { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false, structureId: structure?.id, reportType } as any);
            } else if (templateId === 'rrisi-detail-report') {
                const { generateROVRRISIDetailReport } = await import("./rov-rrisi-detail-report");
                pdfBlob = await generateROVRRISIDetailReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RRISI"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (['diving-rrisi-detail-report', 'drrisi-detail-report', 'diving-jtisi-detail-report', 'diving-itisi-detail-report'].includes(templateId)) {
                const { generateDivingRRISIDetailReport } = await import("./diving-rrisi-detail-report");
                let reportType: 'R' | 'J' | 'I' = 'R';
                if (templateId === 'diving-jtisi-detail-report') reportType = 'J';
                if (templateId === 'diving-itisi-detail-report') reportType = 'I';
                pdfBlob = await generateDivingRRISIDetailReport(records, { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false, structureId: structure?.id, reportType } as any);
            } else if (templateId === 'rov-jtisi-detail-report') {
                const { generateROVRRISIJTubeDetailReport } = await import("./rov-jtisi-detail-report");
                pdfBlob = await generateROVRRISIJTubeDetailReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RRISI"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-itisi-detail-report') {
                const { generateROVRRISIITubeDetailReport } = await import("./rov-itisi-detail-report");
                pdfBlob = await generateROVRRISIITubeDetailReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RRISI"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'szci-report') {
                const { generateROVSZCIReport } = await import("./rov-szci-report");
                pdfBlob = await generateROVSZCIReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RSZCI"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-anode-report') {
                const { generateROVAnodeReport } = await import("./rov-anode-report");
                pdfBlob = await generateROVAnodeReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RAN"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-anode-rsani-report') {
                const { generateROVAnodeRSANIReport } = await import("./rov-anode-rsani-report");
                pdfBlob = await generateROVAnodeRSANIReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RSANI"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'mgi-report') {
                const { generateROVMGIGraphReport } = await import("./rov-mgi-report");
                pdfBlob = await generateROVMGIGraphReport(records.filter(r => ["RMGI", "MGROW"].includes((r.inspection_type?.code || "").toUpperCase())), {}, { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-rmgi-report') {
                const { generateROVRMGIReport } = await import("./rov-rmgi-report");
                pdfBlob = await generateROVRMGIReport(records.filter(r => ["RMGI", "MGROW"].includes((r.inspection_type?.code || "").toUpperCase())), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-scour-report') {
                const { generateROVRSCORReport } = await import("./rov-rscor-report");
                pdfBlob = await generateROVRSCORReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RSCOR"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-selected-node-report') {
                const { generateROVSelectedNodeReport } = await import("./rov-selected-node-report");
                pdfBlob = await generateROVSelectedNodeReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RSWNI"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'utwt-report') {
                const { generateROVUTWTReport } = await import("./rov-utwt-report");
                pdfBlob = await generateROVUTWTReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RUTWT"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-photo-report') {
                const { generateROVPhotographyReport } = await import("./rov-photography-report");
                pdfBlob = await generateROVPhotographyReport(records, { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-photo-log-report') {
                const { generateROVPhotographyLogReport } = await import("./rov-photography-log-report");
                pdfBlob = await generateROVPhotographyLogReport(records, { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-seabed-report' || templateId === 'seabed-survey-debris' || templateId === 'seabed-survey-gas' || templateId === 'seabed-survey-crater') {
                const { generateSeabedSurveyReport } = await import("./seabed-survey-report");
                const filterMap: Record<string, string> = { "rov-seabed-report": "", "seabed-survey-debris": "Debris", "seabed-survey-gas": "Gas Seepage", "seabed-survey-crater": "Crater" };
                pdfBlob = await generateSeabedSurveyReport(jobPack, structure, sowReportNo || "", companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any, filterMap[templateId]);
            } else if (templateId === 'rov-rseab-detail-report') {
                const { generateROVRSEABDetailReport } = await import("./rov-rseab-detail-report");
                pdfBlob = await generateROVRSEABDetailReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RSEAB"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-rseab-gas-detail-report') {
                const { generateROVRSEABGasDetailReport } = await import("./rov-rseab-gas-detail-report");
                pdfBlob = await generateROVRSEABGasDetailReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RSEAB"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'rov-rseab-crater-detail-report') {
                const { generateROVRSEABCraterDetailReport } = await import("./rov-rseab-crater-detail-report");
                pdfBlob = await generateROVRSEABCraterDetailReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RSEAB"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'diving-gvins-report') {
                const { generateDivingGVINSReport } = await import("./diving-gvins-report");
                pdfBlob = await generateDivingGVINSReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "GVINS"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'diving-bsins-report') {
                const { generateDivingBSINSReport } = await import("./diving-bsins-report");
                pdfBlob = await generateDivingBSINSReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "BSINS"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'diving-cvins-report') {
                const { generateDivingCVINSReport } = await import("./diving-cvins-report");
                pdfBlob = await generateDivingCVINSReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "CVINS"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'diving-clean-report') {
                const { generateDivingCLEANReport } = await import("./diving-clean-report");
                pdfBlob = await generateDivingCLEANReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "CLEAN"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'diving-mpins-report') {
                const { generateDivingMPINSReport } = await import("./diving-mpins-report");
                pdfBlob = await generateDivingMPINSReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "MPINS"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'diving-utwtk-report') {
                const { generateDivingUTWTKReport } = await import("./diving-utwtk-report");
                pdfBlob = await generateDivingUTWTKReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "UTWTK"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'diving-acfmc-report') {
                const { generateDivingACFMCReport } = await import("./diving-acfmc-report");
                pdfBlob = await generateDivingACFMCReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "ACFMC"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'diving-plco-report') {
                const { generateDivingPLCOReport } = await import("./diving-plco-report");
                pdfBlob = await generateDivingPLCOReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "PL_CO"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'diving-anmain-report') {
                const { generateDivingANMAINReport } = await import("./diving-anmain-report");
                pdfBlob = await generateDivingANMAINReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "ANMAIN"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'diving-cpclb-report') {
                const { generateDivingCPCLBReport } = await import("./diving-cpclb-report");
                pdfBlob = await generateDivingCPCLBReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "CPCLB"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'diving-dcasn-uw-report') {
                const { generateDivingDCASNUWReport } = await import("./diving-dcasn-uw-report");
                pdfBlob = await generateDivingDCASNUWReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "DCASN"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'diving-dcasn-ts-report') {
                const { generateDivingDCASNTSReport } = await import("./diving-dcasn-ts-report");
                pdfBlob = await generateDivingDCASNTSReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "DCASN"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'diving-dcond-uw-report') {
                const { generateDivingDCONDUWReport } = await import("./diving-dcond-uw-report");
                pdfBlob = await generateDivingDCONDUWReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "DCOND"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'diving-dcond-ts-report') {
                const { generateDivingDCONDTSReport } = await import("./diving-dcond-ts-report");
                pdfBlob = await generateDivingDCONDTSReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "DCOND"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any);
            } else if (templateId === 'diving-szone-report') {
                const { generateDivingSZONEReport } = await import("./diving-szone-report");
                pdfBlob = (await generateDivingSZONEReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "DSZCI"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any, null)) || null;
            } else if (templateId === 'diving-anode-report') {
                const { generateDivingAnodeReport } = await import("./diving-anode-report");
                pdfBlob = (await generateDivingAnodeReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "DAN"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any)) || null;
            } else if (templateId === 'diving-mgi-report') {
                const { generateDivingMGIReport } = await import("./diving-mgi-report");
                const { createClient } = await import("@/utils/supabase/client");
                const supabase = createClient();
                const mgiRecs = records.filter(r => ['DMGI', 'MGROW', 'RMGI'].includes((r.inspection_type?.code || r.inspection_type_code || "").toUpperCase()));
                const profileId = mgiRecs.find(r => r.inspection_data?._mgi_profile_id)?.inspection_data?._mgi_profile_id;
                const mgiProfile = await getMGIProfileForJobpack(supabase, jobPack?.id, profileId);
                pdfBlob = (await generateDivingMGIReport(
                    mgiRecs,
                    mgiProfile,
                    { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel, waterDepth: structure?.depth || structure?.metadata?.water_depth || 0 },
                    companySettings || {},
                    { jobPackId: jobPack?.id, returnBlob: true, showSignatures: false, showPageNumbers: false } as any,
                    supabase
                )) || null;
            } else if (templateId === 'diving-utclb-report') {
                const { generateDivingUTCLBReport } = await import("./diving-utclb-report");
                pdfBlob = (await generateDivingUTCLBReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "UTCLB"), { jobpackName: jobPack?.name, sowReportNo, platformName: structure?.str_name, vessel: jobPack?.metadata?.vessel }, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any)) || null;
            } else if (templateId === 'inspection-report') {
                const { generateInspectionReport } = await import("./inspection-report");
                const firstId = records[0]?.insp_id;
                if (firstId) {
                    pdfBlob = (await generateInspectionReport(firstId, companySettings || {}, { returnBlob: true, showSignatures: false, showPageNumbers: false } as any)) || null;
                }
            } else if (templateId === 'structure-summary') {
                const { generateStructureReport } = await import("../pdf-generator");
                let fullStructure = structure;
                try {
                    const structRes = await fetch(`/api/structures/${structure.id}`);
                    if (structRes.ok) {
                        const structJson = await structRes.json();
                        if (structJson.success && structJson.data) {
                            fullStructure = structJson.data;
                            try {
                                const strType = fullStructure.str_type?.toLowerCase() || "platform";
                                const commentRes = await fetch(`/api/comment/${strType}/${structure.id}`);
                                if (commentRes.ok) {
                                    const commentJson = await commentRes.json();
                                    if (commentJson.data && Array.isArray(commentJson.data)) {
                                        fullStructure.discussions = commentJson.data;
                                    }
                                }
                            } catch (e) {
                                console.error("Error fetching comments in docx mapper:", e);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Error fetching full structure in docx mapper:", e);
                }
                pdfBlob = (await generateStructureReport(fullStructure, companySettings, { returnBlob: true } as any)) || null;
            }
        } catch (genErr) {
            console.error(`Failed to generate PDF for template ${templateId}:`, genErr);
        }

        // If PDF was generated, convert its pages to images and assign to {alias}_PAGES
        if (pdfBlob) {
            const pages = await convertPdfBlobToImages(pdfBlob);
            if (pages.length > 0) {
                reportData[`T_${alias}`] = true;
                reportData[`${alias}_PAGES`] = pages;
                reportData[`${alias}_RECORDS`] = pages; // Fallback mapping
                const lastPageLandscape = pages[pages.length - 1].is_landscape;
                reportData[`${alias}_RESET_PORTRAIT`] = lastPageLandscape ? LANDSCAPE_SECTION_XML : PORTRAIT_SECTION_XML;
                continue;
            }
        }

        // Fallback: If no PDF was generated, map records and their attachment photos

        if (recordsForTemplate.length > 0) {
            reportData[`T_${alias}`] = true; // Conditional flag
            
            const mappedRecords = recordsForTemplate.map((r, idx) => {
                const d = r.inspection_data || r.inspection_dat || {};
                const recordAttachments = attachments.filter(att => 
                    Number(att.source_id) === Number(r.insp_id) && 
                    (!att.type || att.type.toUpperCase() === 'PHOTO' || att.type.toUpperCase() === 'IMAGE' || /\.(jpg|jpeg|png|webp)$/i.test(att.path || ""))
                );
                const firstPhoto = recordAttachments[0];
                
                // Specific flattening for Seabed Records
                if (a.template_id.toLowerCase() === 'rov-seabed-report') {
                    return {
                        id: idx + 1,
                        qid: r.structure_components?.q_id || "N/A",
                        face: d.face || "-",
                        distance: parseFloat(d.distance_from_leg) || 0,
                        northing: d.northing || "-",
                        easting: d.easting || "-",
                        description: r.description?.replace(/^(Debris|Gas Seepage|Crater|Seabed Debris):\s*/, '') || "-",
                        material: d.material || d.debris_material || "Unknown",
                        dims: d.size_dimensions || d.dimension_1 || "-",
                        photo: firstPhoto ? { data: `/api/attachment/url?id=${firstPhoto.id}`, extension: '.jpg' } : "",
                        page_image: firstPhoto ? { data: `/api/attachment/url?id=${firstPhoto.id}`, extension: '.jpg' } : ""
                    };
                }

                // Default flattening for other aliases
                return {
                    qid: r.structure_components?.q_id || "N/A",
                    elevation: r.elevation || "-",
                    description: r.description || "N/A",
                    data: d,
                    photo: firstPhoto ? { data: `/api/attachment/url?id=${firstPhoto.id}`, extension: '.jpg' } : "",
                    page_image: firstPhoto ? { data: `/api/attachment/url?id=${firstPhoto.id}`, extension: '.jpg' } : ""
                };
            });

            reportData[`${alias}_RECORDS`] = mappedRecords;

            // Generate flattened pages list (e.g. for DFT_REP_PAGES)
            const pages: any[] = [];
            recordsForTemplate.forEach(r => {
                const recordAttachments = attachments.filter(att => 
                    Number(att.source_id) === Number(r.insp_id) && 
                    (!att.type || att.type.toUpperCase() === 'PHOTO' || att.type.toUpperCase() === 'IMAGE' || /\.(jpg|jpeg|png|webp)$/i.test(att.path || ""))
                );
                recordAttachments.forEach(att => {
                    pages.push({
                        page_image: { data: `/api/attachment/url?id=${att.id}`, extension: '.jpg' },
                        photo: { data: `/api/attachment/url?id=${att.id}`, extension: '.jpg' },
                        qid: r.structure_components?.q_id || "N/A",
                        elevation: r.elevation || "-",
                        description: r.description || "N/A"
                    });
                });
            });
            reportData[`${alias}_PAGES`] = pages;
        }
    }

    return reportData;
};

/**
 * Generates an MGI profile chart as a Base64 image using a hidden canvas.
 */
export const generateMgiProfileImage = async (records: any[]): Promise<string | null> => {
    if (typeof window === 'undefined') return null;

    try {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Draw Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Simple line chart representation
        ctx.strokeStyle = '#1e3a8a'; // Navy
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const padding = 40;
        const chartWidth = canvas.width - (padding * 2);
        const chartHeight = canvas.height - (padding * 2);

        // Sort by elevation
        const sorted = [...records].sort((a,b) => parseFloat(a.elevation) - parseFloat(b.elevation));

        sorted.forEach((r, i) => {
            const x = padding + (i * (chartWidth / (sorted.length - 1 || 1)));
            const val = parseFloat(r.inspection_data?.mgi_hard_thickness_at_12 || 0);
            const y = (canvas.height - padding) - (val * (chartHeight / 500)); // Assume 500mm max

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        return canvas.toDataURL('image/png').split(',')[1]; // Return only base64 part
    } catch (e) {
        console.error("Error generating MGI image:", e);
        return null;
    }
};

/**
 * Generates a Seabed Map as a Base64 image using a hidden canvas.
 */
export const generateSeabedMapImage = async (records: any[]): Promise<string | null> => {
    if (typeof window === 'undefined') return null;

    try {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Draw Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const maxRadius = 250;
        
        // Find max distance, default to 21
        let maxDist = 21;
        records.forEach(r => {
            const d = parseFloat(r.inspection_data?.distance_from_leg || r.inspection_dat?.distance_from_leg || 0);
            if (d > maxDist) maxDist = Math.ceil(d / 21) * 21;
        });

        // Draw compass labels
        ctx.fillStyle = '#666666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('NORTH', cx, 20);
        ctx.fillText('SOUTH', cx, canvas.height - 10);
        ctx.textAlign = 'left';
        ctx.fillText('WEST', 10, cy);
        ctx.textAlign = 'right';
        ctx.fillText('EAST', canvas.width - 10, cy);

        // Platform Center Square (Legs)
        const innerRatio = 0.15;
        const dx = maxRadius * innerRatio;
        const scale = (maxRadius - dx) / maxDist;

        ctx.strokeStyle = '#aaaaaa';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - dx, cy - dx, dx * 2, dx * 2);
        ctx.fillStyle = '#cccccc';
        
        // Legs
        const legOffsets = [
            { x: -dx, y: -dx, n: "A1" },
            { x: dx,  y: -dx, n: "A2" },
            { x: -dx, y: dx,  n: "B1" },
            { x: dx,  y: dx,  n: "B2" },
        ];
        
        legOffsets.forEach(leg => {
            ctx.beginPath();
            ctx.arc(cx + leg.x, cy + leg.y, 6, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#000';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(leg.n, cx + leg.x, cy + leg.y);
            ctx.fillStyle = '#cccccc';
        });

        // Grid Rings
        ctx.strokeStyle = '#eeeeee';
        for (let d = 3; d <= maxDist; d += 3) {
            const r = dx + (d * scale);
            ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
            
            // Labels
            ctx.fillStyle = '#aaaaaa';
            ctx.font = '10px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`${d}m`, cx - r + 2, cy - r + 12);
        }

        // Draw Items
        records.forEach((r, idx) => {
            const x = parseFloat(r.inspection_data?.x || r.inspection_dat?.x || 50);
            const y = parseFloat(r.inspection_data?.y || r.inspection_dat?.y || 50);
            const d = parseFloat(r.inspection_data?.distance_from_leg || r.inspection_dat?.distance_from_leg || 0);
            const type = r.inspection_data?.category || r.inspection_data?.type || r.description || '';
            const material = r.inspection_data?.material || r.inspection_data?.debris_material || '';

            const angle = Math.atan2(y - 50, x - 50);
            const radius = dx + (d * scale);
            const screenX = cx + radius * Math.cos(angle);
            const screenY = cy + radius * Math.sin(angle);

            if (type.includes('Gas Seepage')) ctx.fillStyle = '#22c55e'; // Green
            else if (type.includes('Crater')) ctx.fillStyle = '#a855f7'; // Purple
            else if (material.includes('Metallic')) ctx.fillStyle = '#1d4ed8'; // Blue
            else ctx.fillStyle = '#ea580c'; // Orange

            ctx.beginPath();
            ctx.arc(screenX, screenY, 8, 0, 2 * Math.PI);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((idx + 1).toString(), screenX, screenY);
        });

        // Draw Legend
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        let legX = 20;
        const legY = canvas.height - 20;
        
        ctx.fillStyle = '#1d4ed8'; ctx.beginPath(); ctx.arc(legX, legY, 5, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = '#666'; ctx.fillText('METALLIC', legX + 10, legY + 4); legX += 90;

        ctx.fillStyle = '#ea580c'; ctx.beginPath(); ctx.arc(legX, legY, 5, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = '#666'; ctx.fillText('NON-METALLIC', legX + 10, legY + 4); legX += 110;

        ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.arc(legX, legY, 5, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = '#666'; ctx.fillText('SEEPAGE', legX + 10, legY + 4); legX += 90;

        ctx.fillStyle = '#a855f7'; ctx.beginPath(); ctx.arc(legX, legY, 5, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = '#666'; ctx.fillText('CRATER', legX + 10, legY + 4);

        return canvas.toDataURL('image/png').split(',')[1];
    } catch (e) {
        console.error("Error generating Seabed image:", e);
        return null;
    }
};
