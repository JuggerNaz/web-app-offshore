import { normalizeReportRecords , applyRecordCellStyling, formatReportFindingText } from "./shared-logo";
import { format } from "date-fns";
import { isBLRecord } from "@/app/dashboard/inspection-v2/workspace/components/ReportWizardDialog";
import { getMGIProfileForJobpack } from "@/utils/mgi-profile-helper";
import { isROVRecord, hasCPReading } from "./rov-cp-report";
import { isDivingCPSURVRecord } from "./diving-cpsurv-report";

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
        const pages: any[] = [];

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

export const DEFAULT_SUB_REPORT_ALIASES: Record<string, string[]> = {
    'rov-photo-report': ['RPHOTO', 'RPHOTO_REPORT', 'ROV_PHOTO', 'ROV_PHOTO_REPORT', 'PHOTO_REPORT', 'PHOTOGRAPHY_REPORT', 'PHOTO_SHEETS', 'RPHOTO_PAGES', 'PHOTO_PAGES'],
    'rov-photo-log-report': ['RPHOTO_LOG', 'RPHOTO_LOG_REPORT', 'ROV_PHOTO_LOG', 'ROV_PHOTO_LOG_REPORT', 'PHOTO_LOG', 'PHOTO_LOG_REPORT', 'PHOTOGRAPHY_LOG', 'RPHOTO_LOG_PAGES', 'PHOTO_LOG_PAGES'],
    'diving-photo-report': ['DPHOTO', 'DPHOTO_REPORT', 'DIVING_PHOTO', 'DIVING_PHOTO_REPORT', 'DPHOTO_PAGES'],
    'diving-photo-log-report': ['DPHOTO_LOG', 'DPHOTO_LOG_REPORT', 'DIVING_PHOTO_LOG', 'DIVING_PHOTO_LOG_REPORT', 'DPHOTO_LOG_PAGES'],
    'defect-anomaly-report': ['DFT_REPORT', 'DFT_ANOMALY', 'DEFECT_ANOMALY', 'DEFECT_ANOMALY_REPORT', 'ANOMALY_REPORT', 'DEFECT_REPORT', 'ANOMALIES_REPORT', 'DFT_REPORT_PAGES', 'ANOMALY_REPORT_PAGES'],
    'findings-report': ['FND_REPORT', 'FINDINGS_REPORT', 'FINDINGS_DETAIL_REPORT', 'FND_REPORT_PAGES', 'FINDINGS_REPORT_PAGES'],
    'defect-summary': ['DEFECT_SUMMARY', 'ANOMALIES_SUMMARY_REPORT', 'DFT_SUMMARY', 'DEFECT_SUMMARY_PAGES'],
    'findings-summary': ['FINDINGS_SUMMARY', 'FND_SUMMARY', 'FINDINGS_SUMMARY_PAGES'],
    'defect-summary-pipeline': ['DEFECT_SUMMARY_PIPELINE', 'DEFECT_SUMMARY_PIPELINE_REPORT', 'DEFECT_SUMMARY_PIPELINE_PAGES'],
    'findings-summary-pipeline': ['FINDINGS_SUMMARY_PIPELINE', 'FINDINGS_SUMMARY_PIPELINE_REPORT', 'FINDINGS_SUMMARY_PIPELINE_PAGES'],
    'rov-cp-report': ['RCP', 'RCP_REPORT', 'CP', 'CP_REPORT', 'CP_SURVEY', 'ROV_CP', 'ROV_CP_REPORT', 'CP_ROV', 'CP_ROV_REPORT', 'RECORDS_CP_ROV', 'RCP_PAGES', 'ROV_CP_PAGES', 'CP_PAGES'],
    'diving-cpsurv-report': ['DCPSURV', 'CPSURV', 'CP', 'CP_SURVEY', 'DCP', 'DCP_REPORT', 'DIVING_CP', 'DIVING_CP_REPORT', 'CP_DIVE', 'CP_DIVE_REPORT', 'DCPSURV_REPORT', 'CPSURV_REPORT', 'RECORDS_CP_DIVE', 'DCPSURV_PAGES', 'CPSURV_PAGES'],
    'rov-fmd-report': ['RFMD', 'FMD', 'RFMD_REPORT', 'FMD_REPORT', 'RFMD_PAGES', 'FMD_PAGES'],
    'diving-fmd-report': ['DFMD', 'FMD', 'FLOOD', 'DFMD_REPORT', 'DFMD_PAGES', 'FLOOD_PAGES'],
    'video-log-report': ['VDO_LOG', 'VDO_LOG_PAGES', 'VIDEO_LOG', 'VIDEO_LOG_REPORT', 'VIDEO_LOG_PAGES', 'VDO_PAGES', 'VDR_LOG', 'VDD_LOG'],
    'diver-log-report': ['DIVER_LOG', 'DIVER_LOG_PAGES', 'DIVER_LOG_REPORT', 'DVR_LOG_PAGES'],
    'rov-gvi-report': ['RGVI', 'GVI', 'RGVI_REPORT', 'GVI_REPORT', 'RGVI_PAGES'],
    'rov-rgvi-report': ['RGVI', 'GVI', 'RGVI_REPORT', 'GVI_REPORT', 'RGVI_PAGES'],
    'rov-rwdi-report': ['RWDI', 'WDI', 'RWDI_REPORT', 'WDI_REPORT', 'RWDI_PAGES'],
    'rov-mgi-report': ['RMGI', 'MGI', 'MGROW', 'RMGI_REPORT', 'RMGI_PAGES', 'MGI_PAGES'],
    'mgi-report': ['MGI_GRAPH', 'MGI_GRAPH_REPORT', 'MGI_GRAPH_PAGES'],
    'diving-mgi-report': ['DMGI', 'DIVING_MGI', 'DMGI_PAGES'],
    'rov-ricmi-report': ['RICMI', 'ICMI', 'RICMI_REPORT', 'RICMI_PAGES'],
    'rov-seabed-report': ['RSEAB', 'SEAB', 'RSEAB_REPORT', 'RSEAB_PAGES', 'SEABED_PAGES'],
    'rov-rseab-detail-report': ['RSEAB_DETAIL', 'RSEAB_DETAIL_REPORT', 'RSEAB_DETAIL_PAGES'],
    'rov-rseab-gas-detail-report': ['RSEAB_GAS', 'RSEAB_GAS_REPORT', 'RSEAB_GAS_PAGES'],
    'rov-rseab-crater-detail-report': ['RSEAB_CRATER', 'RSEAB_CRATER_REPORT', 'RSEAB_CRATER_PAGES'],
    'rov-scour-report': ['RSCOR', 'SCOUR', 'RSCOR_REPORT', 'RSCOR_PAGES', 'SCOUR_PAGES'],
    'rov-caisson-report': ['RCASN', 'CAISSON', 'CAISSON_SUB', 'RCASN_REPORT', 'RCASN_PAGES'],
    'rov-conductor-report': ['RCOND', 'CONDUCTOR', 'CONDUCTOR_SUB', 'RCOND_REPORT', 'RCOND_PAGES'],
    'rov-bl-report': ['RBLTG', 'BL', 'BOATLANDING', 'BOATLANDING_SUB', 'RBLTG_REPORT', 'RBLTG_PAGES'],
    'rov-rg-report': ['RGUARD', 'RG', 'RISERGUARD', 'RISERGUARD_SUB', 'RGUARD_REPORT', 'RGUARD_PAGES'],
    'rov-sg-report': ['RCG', 'SG', 'CAISSONGUARD', 'CAISSONGUARD_SUB', 'RCG_REPORT', 'RCG_PAGES'],
    'rov-cu-report': ['RCDG', 'CU', 'CONDUCTORGUARD', 'CONDUCTORGUARD_SUB', 'RCDG_REPORT', 'RCDG_PAGES'],
    'rrisi-report': ['RRISI', 'RISER', 'RISER_SUB', 'RRISI_REPORT', 'RRISI_PAGES'],
    'rov-riser-report': ['RRISI', 'RISER', 'RISER_SUB', 'RRISI_REPORT', 'RRISI_PAGES'],
    'rrisi-detail-report': ['RRISI_DETAIL', 'RRISI_DETAIL_REPORT', 'RRISI_DETAIL_PAGES'],
    'diving-rrisi-report': ['DRRISI', 'DRISI', 'RISER', 'DRRISI_REPORT', 'DRRISI_PAGES'],
    'diving-rrisi-detail-report': ['DRRISI_DETAIL', 'DRISI_DETAIL', 'DRRISI_DETAIL_REPORT', 'DRRISI_DETAIL_PAGES'],
    'rov-anode-report': ['RSANI', 'ANODE', 'RAN', 'RSANI_REPORT', 'RSANI_PAGES'],
    'rov-anode-rsani-report': ['RSANI', 'ANODE', 'RAN', 'RSANI_REPORT', 'RSANI_PAGES'],
    'szci-report': ['RSZCI', 'SZCI', 'SPLASH_ZONE', 'RSZCI_REPORT', 'RSZCI_PAGES'],
    'rov-splash-zone-report': ['RSZCI', 'SZCI', 'SPLASH_ZONE', 'RSZCI_REPORT', 'RSZCI_PAGES'],
    'rov-navig-report': ['NAVIG', 'RNAVIG', 'NAVIG_REPORT', 'NAVIG_PAGES'],
    'work-scope-report': ['WORK_SCOPE', 'WORK_SCOPE_REPORT', 'WORK_SCOPE_PAGES', 'SOW_REPORT_PAGES'],
    'work-scope-status-report': ['WORK_SCOPE_STATUS', 'WORK_SCOPE_STATUS_REPORT', 'WORK_SCOPE_STATUS_PAGES'],
    'work-scope-incomplete-report': ['WORK_SCOPE_INCOMPLETE', 'WORK_SCOPE_INCOMPLETE_REPORT', 'WORK_SCOPE_INCOMPLETE_PAGES'],
    'defect-criteria-report': ['DEFECT_CRITERIA', 'DEFECT_CRITERIA_REPORT', 'DEFECT_CRITERIA_PAGES'],
    'structure-summary': ['STRUCTURE_SUMMARY', 'STRUCTURE_SUMMARY_REPORT', 'STRUCTURE_SUMMARY_PAGES']
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
    companySettings?: any,
    activeTemplateTags?: Set<string> | null
) => {
    records = normalizeReportRecords(records);
    const safeAliases = Array.isArray(aliases) ? aliases : [];
    const aliasMap = new Map(safeAliases.map(a => [a.template_id, (a.alias || "").trim()]));

    // Fetch all attachments for these inspection records if any
    const recordIds = records.map(r => r.insp_id).filter(Boolean);
    let attachments: any[] = [];
    if (recordIds.length > 0) {
        try {
            const { createClient } = await import("@/utils/supabase/client");
            const supabase = createClient();

            // Query attachments in parallel batches of 100 to maximize throughput and avoid URL length limitations
            const chunks: number[][] = [];
            for (let i = 0; i < recordIds.length; i += 100) {
                chunks.push(recordIds.slice(i, i + 100));
            }

            const results = await Promise.all(
                chunks.map(chunk =>
                    supabase
                        .from('attachment')
                        .select('*')
                        .in('source_id', chunk)
                )
            );

            for (const { data, error } of results) {
                if (!error && data && data.length > 0) {
                    attachments.push(...data);
                }
            }

            if (attachments.length === 0) {
                const mediaResults = await Promise.all(
                    chunks.map(chunk =>
                        supabase
                            .from('insp_media' as any)
                            .select('*')
                            .in('inspection_id', chunk)
                    )
                );
                for (const { data: media } of mediaResults) {
                    if (media && media.length > 0) {
                        attachments.push(...media.map((m: any) => ({
                            id: m.media_id,
                            path: m.file_path,
                            file_path: m.file_path,
                            name: m.file_name || `Photo ${m.media_id}`,
                            source_id: m.inspection_id,
                            source_type: 'inspection',
                            meta: m.meta,
                            bucket: (m.meta as any)?.bucket || 'inspection-media'
                        })));
                    }
                }
            }
        } catch (e) {
            console.error("Failed to fetch attachments for docx:", e);
        }
    }

    const attMap = new Map<number, any[]>();
    attachments.forEach(att => {
        const sid = Number(att.source_id);
        if (!attMap.has(sid)) attMap.set(sid, []);
        attMap.get(sid)!.push(att);
    });
    records.forEach(r => {
        if (r.insp_id && attMap.has(Number(r.insp_id))) {
            const list = attMap.get(Number(r.insp_id)) || [];
            r.attachments = list;
            r.insp_photos = list;
            r.photos = list;
        }
    });

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

    // GVI Table (ROV GVI Table of Results for inline Word tables)
    const rgviRecsForTable = records.filter(r => {
        const c = (r.inspection_type?.code || r.inspection_type_code || "").toUpperCase();
        return c === "RGVI" || c === "GVI";
    });
    if (rgviRecsForTable.length > 0) {
        reportData.HAS_GVI = true;
        reportData.HAS_RGVI = true;
        reportData.GVI_TABLE = rgviRecsForTable.map((r, idx) => {
            const d = r.inspection_data || r.inspection_dat || {};
            return {
                no: idx + 1,
                item_no: idx + 1,
                qid: r.structure_components?.q_id || r.component?.q_id || r.component_qid || "N/A",
                elevation: r.elevation || "-",
                dive_no: d.dive_no || r.dive_no || "-",
                tape_no: d.tape_no || r.tape_no || "-",
                cp: d.cp_reading || d.cp_rdg || d.cp_reading_mv || "-",
                findings: r.description || d.findings || "N/A",
                condition: d.condition || d.comp_condition || "Satisfactory"
            };
        });
        reportData.RGVI_TABLE = reportData.GVI_TABLE;
    }

    // 3. Handle System Aliases
    // For every alias defined in settings, we create a specific tag
    const templateCodeMap: Record<string, string[]> = {
        'rov-gvi-report': ['RGVI', 'GVI'],
        'rov-rgvi-report': ['RGVI', 'GVI'],
        'rov-mgi-report': ['RMGI', 'MGROW'],
        'rov-seabed-report': ['RSEAB'],
        'rov-rseab-detail-report': ['RSEAB'],
        'rov-rseab-gas-detail-report': ['RSEAB'],
        'rov-rseab-crater-detail-report': ['RSEAB'],
        'rov-cp-report': ['CP', 'RSANI', 'RCP', 'CPSURV', 'CPSURV_ROV', 'CPCLB', 'CP_SURV', 'CATHODIC'],
        'diving-cpsurv-report': ['CPSURV', 'DCPSURV', 'CPINS', 'PIPECP', 'CP', 'DCP'],
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
        'rov-scour-report': ['RSCOR', 'SCOUR'],
        'rov-rscor-survey-report': ['RSCOR', 'SCOUR'],
        'rscor-survey': ['RSCOR', 'SCOUR'],
        'rov-caisson-report': ['RCASN'],
        'rov-conductor-report': ['RCOND'],
        'rov-splash-zone-report': ['RSZCI'],
        'rov-node-report': ['RSWNI']
    };

    let contractorLogoUrl = "";
    const contracCode = String(jobPack?.metadata?.contrac || jobPack?.metadata?.contractor || jobPack?.metadata?.contractorId || "").trim();
    try {
        const { createClient } = await import("@/utils/supabase/client");
        const supabase = createClient();
        if (contracCode) {
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contracCode);
            let query = supabase.from('u_lib_list' as any).select('logo_url, lib_id, code, lib_desc').eq('lib_code', 'CONTR_NAM');
            if (isUUID) {
                query = query.or(`id.eq.${contracCode},lib_id.eq.${contracCode}`);
            } else {
                query = query.or(`lib_id.eq.${contracCode},code.eq.${contracCode}`);
            }
            const { data: cData } = await query.maybeSingle();
            if ((cData as any)?.logo_url) {
                contractorLogoUrl = (cData as any).logo_url;
            }
        }
        if (!contractorLogoUrl) {
            const cRes = await fetch(`/api/library/CONTR_NAM`);
            if (cRes.ok) {
                const cJson = await cRes.json();
                if (Array.isArray(cJson?.data)) {
                    const cList = cJson.data;
                    const cLow = contracCode.toLowerCase();
                    // 1. Direct match
                    let found = contracCode ? cList.find((c: any) =>
                        String(c.lib_id).toLowerCase() === cLow ||
                        String(c.id).toLowerCase() === cLow ||
                        String(c.code || "").toLowerCase() === cLow ||
                        String(c.lib_desc || "").toLowerCase() === cLow
                    ) : null;
                    // 2. Fuzzy / substring match (e.g. 'ALAM_SWS' matches 'SWS')
                    if (!found && contracCode) {
                        found = cList.find((c: any) =>
                            (c.lib_id && cLow.includes(String(c.lib_id).toLowerCase())) ||
                            (c.code && cLow.includes(String(c.code).toLowerCase())) ||
                            (c.lib_desc && cLow.includes(String(c.lib_desc).toLowerCase()))
                        );
                    }
                    // 3. Fallback to any contractor that has a valid logo_url
                    if (!found) {
                        found = cList.find((c: any) => Boolean(c.logo_url));
                    }
                    if (found?.logo_url) {
                        contractorLogoUrl = found.logo_url;
                    }
                }
            }
        }
    } catch (e) {
        console.error("Contractor logo resolution error in report-data-mapper:", e);
    }

    const sharedHeaderData: any = {
        jobpackName: jobPack?.name,
        sowReportNo,
        platformName: structure?.str_name,
        vessel: jobPack?.metadata?.vessel,
        contractorLogoUrl,
        contractorId: jobPack?.metadata?.contrac,
        contrac: jobPack?.metadata?.contrac,
        jobpack: jobPack,
        jobPack: jobPack,
        jobPackId: jobPack?.id,
        structureId: structure?.id,
    };

    const sharedConfig: any = {
        returnBlob: true,
        showSignatures: false,
        showPageNumbers: false,
        showContractorLogo: true,
        contractorLogoUrl,
        jobPack,
        jobPackId: jobPack?.id,
        structureId: structure?.id,
        sowReportNo,
    };

    // Merge database-defined report aliases with all system default sub-report templates
    const combinedAliases: { template_id: string; alias: string }[] = [...safeAliases];
    for (const [tid, aliasList] of Object.entries(DEFAULT_SUB_REPORT_ALIASES)) {
        if (!combinedAliases.some(a => (a.template_id || "").toLowerCase() === tid.toLowerCase())) {
            combinedAliases.push({
                template_id: tid,
                alias: aliasList[0]
            });
        }
    }

    for (const a of combinedAliases) {
        const templateId = (a.template_id || "").toLowerCase();
        const alias = (a.alias || "").trim();
        if (!templateId) continue;

        const targetAliases = Array.from(new Set([
            alias,
            ...(DEFAULT_SUB_REPORT_ALIASES[templateId] || [])
        ])).map(x => x.trim().toUpperCase()).filter(Boolean);

        // If template tags were inspected and neither this alias nor any of its page tags exist in the template, skip heavy PDF generation & page rasterization
        if (activeTemplateTags && activeTemplateTags.size > 0) {
            let isUsedInTemplate = false;
            for (const cleanT of targetAliases) {
                if (
                    activeTemplateTags.has(cleanT) ||
                    activeTemplateTags.has(`${cleanT}_PAGES`) ||
                    activeTemplateTags.has(`${cleanT}_RECORDS`) ||
                    activeTemplateTags.has(`HAS_${cleanT}`) ||
                    activeTemplateTags.has(`HAS_${cleanT}_PAGES`) ||
                    activeTemplateTags.has(`NO_${cleanT}`) ||
                    activeTemplateTags.has(`NO_${cleanT}_PAGES`) ||
                    activeTemplateTags.has(`T_${cleanT}`)
                ) {
                    isUsedInTemplate = true;
                    break;
                }
            }

            if (!isUsedInTemplate) {
                targetAliases.forEach(cleanT => {
                    reportData[`T_${cleanT}`] = false;
                    reportData[`HAS_${cleanT}`] = false;
                    reportData[`NO_${cleanT}`] = true;
                    reportData[`HAS_${cleanT}_PAGES`] = false;
                    reportData[`NO_${cleanT}_PAGES`] = true;
                    reportData[`${cleanT}_PAGES`] = [];
                    reportData[cleanT] = [];
                    if (cleanT.endsWith('_PAGES')) {
                        const base = cleanT.replace(/_PAGES$/, '');
                        reportData[`${base}_PAGES`] = [];
                        reportData[base] = [];
                        reportData[`HAS_${base}_PAGES`] = false;
                        reportData[`NO_${base}_PAGES`] = true;
                    }
                });
                continue;
            }
        }
        
        // Filter records for this template first to check if there is data
        const recordsForTemplate = records.filter(r => {
            const code = (r.inspection_type?.code || r.inspection_type_code || r.type || "").toUpperCase();
            
            // System level reports explicit routing
            if (['defect-summary', 'defect-summary-pipeline'].includes(templateId)) {
                return r.has_anomaly === 1 || r.has_anomaly === true || (Array.isArray(r.insp_anomalies) && r.insp_anomalies.length > 0);
            }
            if (['findings-summary', 'findings-summary-pipeline'].includes(templateId)) {
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

            // Photography reports explicit routing
            if (['rov-photo-report', 'rov-photo-log-report', 'diving-photo-report', 'diving-photo-log-report', 'photo-report', 'photo-log-report'].includes(templateId)) {
                return true;
            }

            // Defect / Anomaly reports explicit routing
            if (['defect-anomaly-report', 'findings-report', 'dft_report', 'dft-report', 'defect-report', 'anomaly-report'].includes(templateId)) {
                return true;
            }

            // CP reports explicit routing
            if (templateId === 'rov-cp-report' || templateId === 'cp-report' || templateId === 'rov-cp') {
                return (isROVRecord(r) && hasCPReading(r)) || ['CP', 'RSANI', 'RCP', 'CPSURV', 'CPSURV_ROV', 'CPCLB', 'CP_SURV', 'CATHODIC'].includes(code);
            }
            if (templateId === 'diving-cpsurv-report' || templateId === 'cpsurv-diving-report' || templateId === 'diving-cp') {
                return isDivingCPSURVRecord(r) || ['CPSURV', 'DCPSURV', 'CPINS', 'PIPECP', 'CP', 'DCP'].includes(code);
            }

            // Activity-specific reports routing
            if (templateCodeMap[templateId] && templateCodeMap[templateId].includes(code)) {
                return true;
            }

            // Fallback heuristic
            const upperTemplateId = templateId.toUpperCase();
            return upperTemplateId.includes(code) || code.includes(upperTemplateId.replace('-REPORT', '').replace('ROV-', 'R'));
        });

        let pdfBlob: any = null;
        
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
            'component-spec',
            'defect-summary',
            'findings-summary',
            'defect-anomaly-report',
            'findings-report',
            'dft_report',
            'dft-report',
            'defect-summary-pipeline',
            'findings-summary-pipeline',
            'rov-photo-report',
            'rov-photo-log-report',
            'diving-photo-report',
            'diving-photo-log-report',
            'photo-report',
            'photo-log-report'
        ].includes(templateId);

        if (isJobpackLevel || recordsForTemplate.length > 0) {
            try {
            if (templateId === 'defect-summary' || templateId === 'findings-summary') {
                const { generateDefectSummaryReport } = await import("./defect-summary-report");
                const isFindingsReport = templateId === "findings-summary";
                pdfBlob = await generateDefectSummaryReport(
                    jobPack,
                    structure,
                    sowReportNo || "",
                    companySettings || {},
                    { ...sharedConfig, prefix: isFindingsReport ? "F-" : "A-", isFindingsReport } as any
                ) as any;
            } else if (templateId === 'defect-summary-pipeline' || templateId === 'findings-summary-pipeline' || templateId === 'defect-summary-pipeline-report' || templateId === 'findings-summary-pipeline-report') {
                const { generatePipelineDefectSummaryReport } = await import("./defect-summary-pipeline-report");
                const isFindingsReport = templateId.includes("findings");
                pdfBlob = await generatePipelineDefectSummaryReport(
                    jobPack,
                    structure,
                    sowReportNo || "",
                    companySettings || {},
                    { ...sharedConfig, prefix: isFindingsReport ? "F-" : "A-", isFindingsReport } as any
                ) as any;
            } else if (templateId === 'defect-anomaly-report' || templateId === 'findings-report') {
                const { generateDefectAnomalyReport } = await import("./defect-anomaly-report");
                const isFindingsReport = templateId === "findings-report";
                pdfBlob = await generateDefectAnomalyReport(
                    jobPack,
                    structure,
                    sowReportNo || "",
                    companySettings || {},
                    { ...sharedConfig, prefix: isFindingsReport ? "F-" : "A-", isFindingsReport } as any
                ) as any;
            } else if (templateId === 'defect-criteria-report') {
                const { generateDefectCriteriaReport } = await import("./defect-criteria-report");
                pdfBlob = await generateDefectCriteriaReport(
                    companySettings || {},
                    { ...sharedConfig, reportNoPrefix: sowReportNo || "" } as any
                ) as any;
            } else if (templateId === 'jobpack-summary-report') {
                const { generateJobPackSummaryReport } = await import("./jobpack-summary-report");
                pdfBlob = await generateJobPackSummaryReport(
                    jobPack,
                    companySettings || {},
                    sharedConfig as any
                ) as any;
            } else if (templateId === 'work-scope-status-report') {
                const { generateWorkScopeStatusReport } = await import("./work-scope-status-report");
                pdfBlob = await generateWorkScopeStatusReport(
                    jobPack,
                    structure,
                    (sowReportNo || "") as any,
                    companySettings || {},
                    sharedConfig as any
                ) as any;
            } else if (templateId === 'work-scope-incomplete-report') {
                const { generateWorkScopeIncompleteReport } = await import("./work-scope-incomplete-report");
                pdfBlob = await generateWorkScopeIncompleteReport(
                    jobPack,
                    structure,
                    (sowReportNo || "") as any,
                    companySettings || {},
                    sharedConfig as any
                ) as any;
            } else if (templateId === 'work-scope-report') {
                const { generateWorkScopeReport } = await import("./work-scope-report");
                pdfBlob = await generateWorkScopeReport(
                    jobPack,
                    structure,
                    (sowReportNo || "") as any,
                    companySettings || {},
                    sharedConfig as any
                ) as any;
            } else if (templateId === 'diver-log-report') {
                const { generateDiverLogReport } = await import("./diver-log-report");
                pdfBlob = await generateDiverLogReport(
                    jobPack,
                    structure,
                    sowReportNo || "",
                    companySettings || {},
                    sharedConfig as any
                ) as any;
            } else if (templateId === 'video-log-report') {
                const { generateVideoLogReport } = await import("./video-log-report");
                pdfBlob = await generateVideoLogReport(
                    jobPack,
                    structure,
                    sowReportNo || "",
                    companySettings || {},
                    sharedConfig as any
                ) as any;
            } else if (templateId === 'rov-rgvi-report' || templateId === 'rov-gvi-report') {
                const { generateROVRGVIReport, isExcludedFromRGVI } = await import("./rov-rgvi-report");
                const rgviRecords = records.filter(r => {
                    const c = (r.inspection_type?.code || r.inspection_type_code || "").toUpperCase();
                    return (c === "RGVI" || c === "GVI") && !isExcludedFromRGVI(r);
                });
                pdfBlob = await generateROVRGVIReport(
                    rgviRecords,
                    sharedHeaderData,
                    companySettings || {},
                    sharedConfig as any
                );
            } else if (templateId === 'rov-rwdi-report') {
                const { generateROVRWDIReport } = await import("./rov-rwdi-report");
                pdfBlob = await generateROVRWDIReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RWDI"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-ricmi-report') {
                const { generateROVRICMIReport } = await import("./rov-ricmi-report");
                pdfBlob = await generateROVRICMIReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RICMI"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-cp-report') {
                const { generateROVCPReport, isROVRecord, hasCPReading } = await import("./rov-cp-report");
                pdfBlob = await generateROVCPReport(records.filter(r => isROVRecord(r) && hasCPReading(r)), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-fmd-report' || templateId === 'fmd-report') {
                const { generateROVFMDReport } = await import("./rov-fmd-report");
                pdfBlob = await generateROVFMDReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RFMD" || (r.inspection_type?.code || "").toUpperCase() === "FMD"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'diving-fmd-report' || templateId === 'fmd-diving-report') {
                const { generateDivingFMDReport } = await import("./diving-fmd-report");
                pdfBlob = await generateDivingFMDReport(records.filter(r => ["FLOOD", "FMD", "DFMD"].includes((r.inspection_type?.code || "").toUpperCase())), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'diving-measu-report' || templateId === 'measu-report') {
                const { generateDivingMEASUReport } = await import("./diving-measu-report");
                pdfBlob = await generateDivingMEASUReport(records.filter(r => ["MEASU", "DMSR", "MEASUREMENT", "DMEAS"].includes((r.inspection_type?.code || "").toUpperCase())), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-rcond-report') {
                const { generateROVCondReport } = await import("./rov-rcond-report");
                pdfBlob = await generateROVCondReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RCOND"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-rcasn-report') {
                const { generateROVCasnReport } = await import("./rov-rcasn-report");
                pdfBlob = await generateROVCasnReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RCASN"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-bl-report') {
                const { generateROVBoatlandingReport } = await import("./rov-boatlanding-report");
                pdfBlob = await generateROVBoatlandingReport(records.filter(r => isBLRecord(r) || (r.inspection_type?.code || "").toUpperCase() === "RBLTG"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-rg-report') {
                const { generateROVRiserGuardReport } = await import("./rov-riser-guard-report");
                pdfBlob = await generateROVRiserGuardReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RGUARD"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-sg-report') {
                const { generateROVCaissonGuardReport } = await import("./rov-caisson-guard-report");
                pdfBlob = await generateROVCaissonGuardReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RCG"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-cu-report') {
                const { generateROVConductorGuardReport } = await import("./rov-conductor-guard-report");
                pdfBlob = await generateROVConductorGuardReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RCDG"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-navig-report' || templateId === 'navig-report') {
                const { generateROVNavigReport } = await import("./rov-navig-report");
                pdfBlob = await generateROVNavigReport(jobPack, structure, sowReportNo || "N/A", companySettings || {}, { ...sharedConfig, headerData: sharedHeaderData } as any, records);
            } else if (templateId === 'rov-rcond-sketch-report') {
                const { generateROVCondSketchReport } = await import("./rov-rcond-sketch-report");
                pdfBlob = await generateROVCondSketchReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RCOND"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-rcasn-sketch-report') {
                const { generateROVCasnSketchReport } = await import("./rov-rcasn-sketch-report");
                pdfBlob = await generateROVCasnSketchReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RCASN"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rrisi-report') {
                const { generateROVRRISIReport } = await import("./rov-rrisi-report");
                pdfBlob = await generateROVRRISIReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RRISI"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (['diving-rrisi-report', 'drrisi-report', 'diving-jtisi-report', 'diving-itisi-report'].includes(templateId)) {
                const { generateDivingRRISIReport } = await import("./diving-rrisi-report");
                let reportType: 'R' | 'J' | 'I' = 'R';
                if (templateId === 'diving-jtisi-report') reportType = 'J';
                if (templateId === 'diving-itisi-report') reportType = 'I';
                pdfBlob = await generateDivingRRISIReport(records, sharedHeaderData, companySettings || {}, { ...sharedConfig, reportType } as any);
            } else if (templateId === 'rrisi-detail-report') {
                const { generateROVRRISIDetailReport } = await import("./rov-rrisi-detail-report");
                pdfBlob = await generateROVRRISIDetailReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RRISI"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (['diving-rrisi-detail-report', 'drrisi-detail-report', 'diving-jtisi-detail-report', 'diving-itisi-detail-report'].includes(templateId)) {
                const { generateDivingRRISIDetailReport } = await import("./diving-rrisi-detail-report");
                let reportType: 'R' | 'J' | 'I' = 'R';
                if (templateId === 'diving-jtisi-detail-report') reportType = 'J';
                if (templateId === 'diving-itisi-detail-report') reportType = 'I';
                pdfBlob = await generateDivingRRISIDetailReport(records, sharedHeaderData, companySettings || {}, { ...sharedConfig, reportType } as any);
            } else if (templateId === 'rov-jtisi-detail-report') {
                const { generateROVRRISIJTubeDetailReport } = await import("./rov-jtisi-detail-report");
                pdfBlob = await generateROVRRISIJTubeDetailReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RRISI"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-itisi-detail-report') {
                const { generateROVRRISIITubeDetailReport } = await import("./rov-itisi-detail-report");
                pdfBlob = await generateROVRRISIITubeDetailReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RRISI"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'szci-report') {
                const { generateROVSZCIReport } = await import("./rov-szci-report");
                pdfBlob = await generateROVSZCIReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RSZCI"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-anode-report') {
                const { generateROVAnodeReport } = await import("./rov-anode-report");
                pdfBlob = await generateROVAnodeReport(records.filter(r => {
                    const t = (r.inspection_type?.code || r.inspection_type_code || "").toUpperCase();
                    const c = (r.structure_components?.code || r.component?.code || "").toUpperCase();
                    return t === "RAN" || (['RGVI', 'ANODE', 'ANOD'].includes(t) && c === 'AN' && t !== 'RSANI');
                }), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-anode-rsani-report') {
                const { generateROVAnodeRSANIReport } = await import("./rov-anode-rsani-report");
                pdfBlob = await generateROVAnodeRSANIReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RSANI"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'mgi-report') {
                const { generateROVMGIGraphReport } = await import("./rov-mgi-report");
                pdfBlob = await generateROVMGIGraphReport(records.filter(r => ["RMGI", "MGROW"].includes((r.inspection_type?.code || "").toUpperCase())), {}, sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-rmgi-report') {
                const { generateROVRMGIReport } = await import("./rov-rmgi-report");
                pdfBlob = await generateROVRMGIReport(records.filter(r => ["RMGI", "MGROW"].includes((r.inspection_type?.code || "").toUpperCase())), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-scour-report') {
                const { generateROVRSCORReport } = await import("./rov-rscor-report");
                pdfBlob = await generateROVRSCORReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RSCOR" || (r.inspection_type?.code || "").toUpperCase() === "SCOUR"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-rscor-survey-report' || templateId === 'rscor-survey') {
                const { generateROVRSCORSurveyReport } = await import("./rov-rscor-survey-report");
                pdfBlob = await generateROVRSCORSurveyReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RSCOR" || (r.inspection_type?.code || "").toUpperCase() === "SCOUR"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-selected-node-report') {
                const { generateROVSelectedNodeReport } = await import("./rov-selected-node-report");
                pdfBlob = await generateROVSelectedNodeReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RSWNI"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'utwt-report') {
                const { generateROVUTWTReport } = await import("./rov-utwt-report");
                pdfBlob = await generateROVUTWTReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "RUTWT"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-photo-report') {
                const { generateROVPhotographyReport } = await import("./rov-photography-report");
                const photoRecs = records.filter(r => (r.attachments && r.attachments.length > 0) || (r.inspection_type?.code || "").toUpperCase() === "RPHOTO");
                const targetRecs = photoRecs.length > 0 ? photoRecs : (attachments.length > 0 ? attachments : records);
                pdfBlob = await generateROVPhotographyReport(targetRecs, sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-photo-log-report') {
                const { generateROVPhotographyLogReport } = await import("./rov-photography-log-report");
                const photoRecs = records.filter(r => (r.attachments && r.attachments.length > 0) || (r.inspection_type?.code || "").toUpperCase() === "RPHOTO");
                const targetRecs = photoRecs.length > 0 ? photoRecs : (attachments.length > 0 ? attachments : records);
                pdfBlob = await generateROVPhotographyLogReport(targetRecs, sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-seabed-report' || templateId === 'seabed-survey-debris' || templateId === 'seabed-survey-gas' || templateId === 'seabed-survey-crater') {
                const { generateSeabedSurveyReport } = await import("./seabed-survey-report");
                const filterMap: Record<string, string> = { "rov-seabed-report": "", "seabed-survey-debris": "Debris", "seabed-survey-gas": "Gas Seepage", "seabed-survey-crater": "Crater" };
                pdfBlob = await generateSeabedSurveyReport(jobPack, structure, sowReportNo || "", companySettings || {}, sharedConfig as any, filterMap[templateId]);
            } else if (templateId === 'rov-rseab-detail-report') {
                const { generateROVRSEABDetailReport } = await import("./rov-rseab-detail-report");
                pdfBlob = await generateROVRSEABDetailReport(records.filter(r => { const c = (r.inspection_type?.code || r.inspection_type_code || "").toUpperCase(); return c === "RSEAB" || c === "SEABED"; }), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-rseab-gas-detail-report') {
                const { generateROVRSEABGasDetailReport } = await import("./rov-rseab-gas-detail-report");
                pdfBlob = await generateROVRSEABGasDetailReport(records.filter(r => { const c = (r.inspection_type?.code || r.inspection_type_code || "").toUpperCase(); return c === "RSEAB" || c === "SEABED"; }), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'rov-rseab-crater-detail-report') {
                const { generateROVRSEABCraterDetailReport } = await import("./rov-rseab-crater-detail-report");
                pdfBlob = await generateROVRSEABCraterDetailReport(records.filter(r => { const c = (r.inspection_type?.code || r.inspection_type_code || "").toUpperCase(); return c === "RSEAB" || c === "SEABED"; }), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'diving-gvins-report') {
                const { generateDivingGVINSReport } = await import("./diving-gvins-report");
                pdfBlob = await generateDivingGVINSReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "GVINS"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'diving-bsins-report') {
                const { generateDivingBSINSReport } = await import("./diving-bsins-report");
                pdfBlob = await generateDivingBSINSReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "BSINS"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'diving-cvins-report') {
                const { generateDivingCVINSReport } = await import("./diving-cvins-report");
                pdfBlob = await generateDivingCVINSReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "CVINS"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'diving-clean-report') {
                const { generateDivingCLEANReport } = await import("./diving-clean-report");
                pdfBlob = await generateDivingCLEANReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "CLEAN"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'diving-mpins-report') {
                const { generateDivingMPINSReport } = await import("./diving-mpins-report");
                pdfBlob = await generateDivingMPINSReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "MPINS"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'diving-utwtk-report') {
                const { generateDivingUTWTKReport } = await import("./diving-utwtk-report");
                pdfBlob = await generateDivingUTWTKReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "UTWTK"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'diving-acfmc-report') {
                const { generateDivingACFMCReport } = await import("./diving-acfmc-report");
                pdfBlob = await generateDivingACFMCReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "ACFMC"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'diving-plco-report') {
                const { generateDivingPLCOReport } = await import("./diving-plco-report");
                pdfBlob = await generateDivingPLCOReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "PL_CO"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'diving-anmain-report') {
                const { generateDivingANMAINReport } = await import("./diving-anmain-report");
                pdfBlob = await generateDivingANMAINReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "ANMAIN"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'diving-cpsurv-report' || templateId === 'cpsurv-diving-report') {
                const { generateDivingCPSURVReport, isDivingCPSURVRecord } = await import("./diving-cpsurv-report");
                pdfBlob = await generateDivingCPSURVReport(records.filter(isDivingCPSURVRecord), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'diving-cpclb-report') {
                const { generateDivingCPCLBReport } = await import("./diving-cpclb-report");
                pdfBlob = await generateDivingCPCLBReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "CPCLB"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'diving-dcasn-uw-report') {
                const { generateDivingDCASNUWReport } = await import("./diving-dcasn-uw-report");
                pdfBlob = await generateDivingDCASNUWReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "DCASN"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'diving-dcasn-ts-report') {
                const { generateDivingDCASNTSReport } = await import("./diving-dcasn-ts-report");
                pdfBlob = await generateDivingDCASNTSReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "DCASN"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'diving-dcond-uw-report') {
                const { generateDivingDCONDUWReport } = await import("./diving-dcond-uw-report");
                pdfBlob = await generateDivingDCONDUWReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "DCOND"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'diving-dcond-ts-report') {
                const { generateDivingDCONDTSReport } = await import("./diving-dcond-ts-report");
                pdfBlob = await generateDivingDCONDTSReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "DCOND"), sharedHeaderData, companySettings || {}, sharedConfig as any);
            } else if (templateId === 'diving-szone-report') {
                const { generateDivingSZONEReport } = await import("./diving-szone-report");
                pdfBlob = (await generateDivingSZONEReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "DSZCI"), sharedHeaderData, companySettings || {}, sharedConfig as any, null)) || null;
            } else if (templateId === 'diving-anode-report') {
                const { generateDivingAnodeReport } = await import("./diving-anode-report");
                pdfBlob = (await generateDivingAnodeReport(records.filter(r => {
                    const t = (r.inspection_type?.code || r.inspection_type_code || "").toUpperCase();
                    const c = (r.structure_components?.code || r.component?.code || "").toUpperCase();
                    return t === "DAN" || (['DGVI', 'ANODE', 'ANOD', 'PL_AN'].includes(t) && c === 'AN');
                }), sharedHeaderData, companySettings || {}, sharedConfig as any)) || null;
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
                    { ...sharedHeaderData, waterDepth: structure?.depth || structure?.metadata?.water_depth || 0 },
                    companySettings || {},
                    sharedConfig as any,
                    supabase
                )) || null;
            } else if (templateId === 'diving-utclb-report') {
                const { generateDivingUTCLBReport } = await import("./diving-utclb-report");
                pdfBlob = (await generateDivingUTCLBReport(records.filter(r => (r.inspection_type?.code || "").toUpperCase() === "UTCLB"), sharedHeaderData, companySettings || {}, sharedConfig as any)) || null;
            } else if (templateId === 'inspection-report') {
                const { generateInspectionReport } = await import("./inspection-report");
                const firstId = records[0]?.insp_id;
                if (firstId) {
                    pdfBlob = (await generateInspectionReport(firstId, companySettings || {}, sharedConfig as any)) || null;
                }
            } else if (templateId === 'structure-summary') {
                const { generateStructureReport } = await import("../pdf-generator");
                let fullStructure = structure;
                const structId = structure.id || structure.str_id || structure.plat_id || structure.pipe_id;
                try {
                    const structRes = await fetch(`/api/structures/${structId}`);
                    if (structRes.ok) {
                        const structJson = await structRes.json();
                        if (structJson.success && structJson.data) {
                            fullStructure = structJson.data;
                            try {
                                const strType = fullStructure.str_type?.toLowerCase() || "platform";
                                const commentRes = await fetch(`/api/comment/${strType}/${structId}`);
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
                pdfBlob = (await generateStructureReport(fullStructure, companySettings, { ...sharedConfig, sowReportNo: sowReportNo || "", reportNoPrefix: sowReportNo || "" } as any)) || null;
            }
        } catch (genErr) {
            console.error(`Failed to generate PDF for template ${templateId}:`, genErr);
        }
        }

        // targetAliases already resolved and normalized at top of loop

        // If PDF was generated, convert its pages to images and assign to {alias}_PAGES
        if (pdfBlob) {
            const pages = await convertPdfBlobToImages(pdfBlob);
            if (pages.length > 0) {
                targetAliases.forEach(tAlias => {
                    const cleanT = tAlias.trim().toUpperCase();
                    if (!cleanT) return;
                    reportData[`T_${cleanT}`] = true;
                    reportData[`${cleanT}_PAGES`] = pages;
                    reportData[`${cleanT}_RECORDS`] = pages;
                    reportData[cleanT] = pages;
                    if (cleanT.endsWith('_PAGES')) {
                        const base = cleanT.replace(/_PAGES$/, '');
                        reportData[`${base}_PAGES`] = pages;
                        reportData[base] = pages;
                    }
                    reportData[`HAS_${cleanT}_PAGES`] = true;
                    reportData[`NO_${cleanT}_PAGES`] = false;
                    reportData[`HAS_${cleanT}`] = true;
                    reportData[`NO_${cleanT}`] = false;
                });
                const lastPageLandscape = pages[pages.length - 1].is_landscape;
                reportData[`${alias}_RESET_PORTRAIT`] = lastPageLandscape ? LANDSCAPE_SECTION_XML : PORTRAIT_SECTION_XML;
                continue;
            }
        }

        // Fallback: If no PDF was generated, map records and their attachment photos

        if (recordsForTemplate.length > 0) {
            targetAliases.forEach(tAlias => {
                const cleanT = tAlias.trim().toUpperCase();
                if (cleanT) reportData[`T_${cleanT}`] = true;
            });
            
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

            // Generate flattened pages list only for photo or anomaly/defect templates (e.g. DFT_REP_PAGES, PHOTO_PAGES)
            // Tabular reports like RGVI should never have raw photos dumped as full pages
            const isPhotoOrAnomalyTemplate = /photo|dft|defect|anomaly|drawing/i.test(templateId);
            const pages: any[] = [];
            if (isPhotoOrAnomalyTemplate) {
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
            }

            targetAliases.forEach(tAlias => {
                const cleanT = tAlias.trim().toUpperCase();
                if (!cleanT) return;
                reportData[`${cleanT}_RECORDS`] = mappedRecords;
                reportData[`${cleanT}_PAGES`] = pages;
                reportData[cleanT] = pages;
                if (cleanT.endsWith('_PAGES')) {
                    const base = cleanT.replace(/_PAGES$/, '');
                    reportData[`${base}_PAGES`] = pages;
                    reportData[base] = pages;
                }
                reportData[`HAS_${cleanT}_PAGES`] = pages.length > 0;
                reportData[`NO_${cleanT}_PAGES`] = pages.length === 0;
                reportData[`HAS_${cleanT}`] = true;
                reportData[`NO_${cleanT}`] = false;
            });
        } else {
            targetAliases.forEach(tAlias => {
                const cleanT = tAlias.trim().toUpperCase();
                if (!cleanT) return;
                reportData[`${cleanT}_PAGES`] = [];
                reportData[`${cleanT}_RECORDS`] = [];
                reportData[cleanT] = [];
                if (cleanT.endsWith('_PAGES')) {
                    const base = cleanT.replace(/_PAGES$/, '');
                    reportData[`${base}_PAGES`] = [];
                    reportData[base] = [];
                }
                reportData[`HAS_${cleanT}_PAGES`] = false;
                reportData[`NO_${cleanT}_PAGES`] = true;
                reportData[`HAS_${cleanT}`] = false;
                reportData[`NO_${cleanT}`] = true;
            });
        }
    }

    // 4. Format VDR_LST_BLK and VDD_LST_BLK for video logs
    try {
        const jobpackId = jobPack?.id;
        const structureId = structure?.id;
        if (jobpackId) {
            let vUrl = `/api/reports/video-log?jobpack_id=${jobpackId}&`;
            if (sowReportNo) vUrl += `sow_report_no=${encodeURIComponent(sowReportNo)}&`;
            if (structureId) vUrl += `structure_id=${structureId}&`;
            const vRes = await fetch(vUrl);
            if (vRes.ok) {
                const vJson = await vRes.json();
                const vTapes = Array.isArray(vJson?.data) ? vJson.data : [];
                const rovTapes = vTapes.filter((t: any) => Boolean(t.rov_job_id) || !t.dive_job_id);
                const diveTapes = vTapes.filter((t: any) => Boolean(t.dive_job_id));

                const formatTapeBlock = (tList: any[]) => {
                    if (tList.length === 0) return "No video log entries recorded.";
                    return tList.map(t => {
                        const header = `Tape No: ${t.tape_no || t.tape_id}${t.dive_no ? ` | Deployment/Dive: ${t.dive_no}` : ''}${t.chapter_no ? ` | Chapter: ${t.chapter_no}` : ''}`;
                        const logLines = (t.logs || []).map((l: any, idx: number) => {
                            const tc = l.timecode_start || (l.tape_counter_start !== undefined && l.tape_counter_start !== null ? String(l.tape_counter_start) : "-");
                            const act = l.event_type || l.action || "";
                            const rem = l.remarks || l.description || "";
                            return `  ${idx + 1}. [${tc}] ${act}${rem ? ` - ${rem}` : ''}`;
                        }).join('\n');
                        return `${header}\n${logLines}`;
                    }).join('\n\n');
                };

                reportData.VDR_LST_BLK = formatTapeBlock(rovTapes);
                reportData.VDD_LST_BLK = formatTapeBlock(diveTapes);
                reportData.HAS_VDR = rovTapes.length > 0;
                reportData.NO_VDR = rovTapes.length === 0;
                reportData.HAS_VDD = diveTapes.length > 0;
                reportData.NO_VDD = diveTapes.length === 0;
            }
        }
    } catch (e) {
        console.warn("[DocxMapper] Error resolving video log blocks:", e);
    }
    if (!reportData.VDR_LST_BLK) reportData.VDR_LST_BLK = "No ROV video logs recorded.";
    if (!reportData.VDD_LST_BLK) reportData.VDD_LST_BLK = "No diving video logs recorded.";

    return reportData;
};

/**
 * Generates an MGI profile chart as a Base64 image using a hidden canvas.
 */
export const generateMgiProfileImage = async (records: any[]): Promise<string | null> => {
    if (typeof window === 'undefined') return null;

    try {
        records = normalizeReportRecords(records);
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
        records = normalizeReportRecords(records);
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
