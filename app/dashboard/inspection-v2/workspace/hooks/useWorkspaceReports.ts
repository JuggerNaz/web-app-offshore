import { useState, useRef, useEffect } from "react";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { format } from "date-fns";
import { getReportHeaderData } from "@/utils/company-settings";
import { getMGIProfileForJobpack } from "@/utils/mgi-profile-helper";
import { generateDefectAnomalyReport } from "@/utils/report-generators/defect-anomaly-report";
import { generateMultiInspectionReport } from "@/utils/report-generators/multi-inspection-report";
import { generateROVRMGIReport } from "@/utils/report-generators/rov-rmgi-report";
import { generateROVMGIGraphReport } from "@/utils/report-generators/rov-mgi-report";
import { generateROVFMDReport } from "@/utils/report-generators/rov-fmd-report";
import { generateROVSZCIReport } from "@/utils/report-generators/rov-szci-report";
import { generateROVUTWTReport } from "@/utils/report-generators/rov-utwt-report";
import { generateROVRSCORReport } from "@/utils/report-generators/rov-rscor-report";
import { generateROVRSCORV2Report } from "@/utils/report-generators/rov-rscor-v2-report";
import { generateROVRRISIReport } from "@/utils/report-generators/rov-rrisi-report";
import { generateROVRRISIDetailReport } from "@/utils/report-generators/rov-rrisi-detail-report";
import { generateROVRRISIJTubeDetailReport } from "@/utils/report-generators/rov-jtisi-detail-report";
import { generateROVRRISIITubeDetailReport } from "@/utils/report-generators/rov-itisi-detail-report";
import { generateROVAnodeReport } from "@/utils/report-generators/rov-anode-report";
import { generateROVAnodeRSANIReport } from "@/utils/report-generators/rov-anode-rsani-report";
import { generateROVCPReport } from "@/utils/report-generators/rov-cp-report";
import { generateROVRICMIReport } from "@/utils/report-generators/rov-ricmi-report";
import { generateROVSelectedNodeReport } from "@/utils/report-generators/rov-selected-node-report";
import { generateROVRGVIReport } from "@/utils/report-generators/rov-rgvi-report";
import { generateROVCasnReport } from "@/utils/report-generators/rov-rcasn-report";
import { generateROVCasnSketchReport } from "@/utils/report-generators/rov-rcasn-sketch-report";
import { generateROVCondReport } from "@/utils/report-generators/rov-rcond-report";
import { generateROVCondSketchReport } from "@/utils/report-generators/rov-rcond-sketch-report";
import { generateROVBoatlandingReport } from "@/utils/report-generators/rov-boatlanding-report";
import { isBLRecord } from "../components/ReportWizardDialog";
import { generateROVRiserGuardReport } from "@/utils/report-generators/rov-riser-guard-report";
import { generateROVCaissonGuardReport } from "@/utils/report-generators/rov-caisson-guard-report";
import { generateROVConductorGuardReport } from "@/utils/report-generators/rov-conductor-guard-report";
import { generateROVPhotographyReport } from "@/utils/report-generators/rov-photography-report";
import { generateROVPhotographyLogReport } from "@/utils/report-generators/rov-photography-log-report";
import { generateSeabedSurveyReport } from "@/utils/report-generators/seabed-survey-report";
import { generateDivingGVINSReport } from "@/utils/report-generators/diving-gvins-report";
import { generateDivingSZONEReport } from "@/utils/report-generators/diving-szone-report";
import { generateDivingCPCLBReport } from "@/utils/report-generators/diving-cpclb-report";
import { generateDivingUTCLBReport } from "@/utils/report-generators/diving-utclb-report";
import { generateDivingAnodeReport } from "@/utils/report-generators/diving-anode-report";
import { generateDivingMGIReport } from "@/utils/report-generators/diving-mgi-report";
import { generateDivingFMDReport } from "@/utils/report-generators/diving-fmd-report";
import { generateDivingMEASUReport } from "@/utils/report-generators/diving-measu-report";
import { generateDivingRRISIReport as generateDivingRRISIReportGenerator } from "@/utils/report-generators/diving-rrisi-report";
import { generateDivingRRISIDetailReport as generateDivingRRISIDetailReportGenerator } from "@/utils/report-generators/diving-rrisi-detail-report";
import { generateDivingACFMCReport as generateDivingACFMCReportTemplate } from "@/utils/report-generators/diving-acfmc-report";
import { generateDivingPLCOReport as generateDivingPLCOReportTemplate } from "@/utils/report-generators/diving-plco-report";
import { generateROVRWDIReport as generateROVRWDIReportTemplate } from "@/utils/report-generators/rov-rwdi-report";
import { generateDivingANMAINReport } from "@/utils/report-generators/diving-anmain-report";
import { generateDivingItemReport as generateDivingItemReportTemplate } from "@/utils/report-generators/diving-item-report";
import { generateDivingITMAINReport as generateDivingITMAINReportTemplate } from "@/utils/report-generators/diving-itmain-report";
import { generateDivingDCASNUWReport as generateDivingDCASNUWReportTemplate } from "@/utils/report-generators/diving-dcasn-uw-report";
import { generateDivingDCASNTSReport as generateDivingDCASNTSReportTemplate } from "@/utils/report-generators/diving-dcasn-ts-report";
import { generateDivingDCASNReport as generateDivingDCASNReportTemplate } from "@/utils/report-generators/diving-dcasn-report";
import { generateDivingDCONDUWReport as generateDivingDCONDUWReportTemplate } from "@/utils/report-generators/diving-dcond-uw-report";
import { generateDivingDCONDTSReport as generateDivingDCONDTSReportTemplate } from "@/utils/report-generators/diving-dcond-ts-report";
import { generateDivingDCONDReport as generateDivingDCONDReportTemplate } from "@/utils/report-generators/diving-dcond-report";
import { generatePipelineEventSketchReport } from "@/utils/report-generators/pipeline-event-sketch-report";

import { applyWatermarkAndSignaturesGlobal } from "@/utils/report-generators/shared-logo";

export function useWorkspaceReports(
    supabase: any,
    jobPackId: string | null,
    structureId: string | null,
    headerData: any,
    currentRecords: any[],
    pendingAttachments: any[],
    allInspectionTypes: any[]
) {
    const [reportConfig, setReportConfig] = useState({
        preparedBy: { name: "", date: format(new Date(), "yyyy-MM-dd") },
        reviewedBy: { name: "", date: format(new Date(), "yyyy-MM-dd") },
        approvedBy: { name: "", date: format(new Date(), "yyyy-MM-dd") },
        watermark: { enabled: false, text: "DRAFT", transparency: 0.15, color: "gray" },
        showSignatures: true
    });

    useEffect(() => {
        if (typeof window !== "undefined") {
            (window as any).__reportConfig = reportConfig;
        }
    }, [reportConfig]);

    const [previewOpen, setPreviewOpen] = useState(false);
    const [mPreviewOpen, setMPreviewOpen] = useState(false);
    const [rmgiPreviewOpen, setRmgiPreviewOpen] = useState(false);
    const [fmdPreviewOpen, setFmdPreviewOpen] = useState(false);
    const [szciPreviewOpen, setSzciPreviewOpen] = useState(false);
    const [utwtPreviewOpen, setUtwtPreviewOpen] = useState(false);
    const [rscorPreviewOpen, setRscorPreviewOpen] = useState(false);
    const [rscorV2PreviewOpen, setRscorV2PreviewOpen] = useState(false);
    const [rrisiPreviewOpen, setRrisiPreviewOpen] = useState(false);
    const [rrisiDetailPreviewOpen, setRrisiDetailPreviewOpen] = useState(false);
    const [jtisiPreviewOpen, setJtisiPreviewOpen] = useState(false);
    const [jtisiDetailPreviewOpen, setJtisiDetailPreviewOpen] = useState(false);
    const [itisiPreviewOpen, setItisiPreviewOpen] = useState(false);
    const [itisiDetailPreviewOpen, setItisiDetailPreviewOpen] = useState(false);
    const [anodePreviewOpen, setAnodePreviewOpen] = useState(false);
    const [anodeRsaniPreviewOpen, setAnodeRsaniPreviewOpen] = useState(false);
    const [cpPreviewOpen, setCpPreviewOpen] = useState(false);
    const [rswniPreviewOpen, setRswniPreviewOpen] = useState(false);
    const [rovRicmiPreviewOpen, setRovRicmiPreviewOpen] = useState(false);
    const [rgviPreviewOpen, setRgviPreviewOpen] = useState(false);
    const [rcasnPreviewOpen, setRcasnPreviewOpen] = useState(false);
    const [rcasnSketchPreviewOpen, setRcasnSketchPreviewOpen] = useState(false);
    const [rcondPreviewOpen, setRcondPreviewOpen] = useState(false);
    const [rcondSketchPreviewOpen, setRcondSketchPreviewOpen] = useState(false);
    const [blPreviewOpen, setBlPreviewOpen] = useState(false);
    const [rgPreviewOpen, setRgPreviewOpen] = useState(false);
    const [sgPreviewOpen, setSgPreviewOpen] = useState(false);
    const [cuPreviewOpen, setCuPreviewOpen] = useState(false);
    const [seabedPreviewOpen, setSeabedPreviewOpen] = useState(false);
    const [seabedDetailPreviewOpen, setSeabedDetailPreviewOpen] = useState(false);
    const [seabedGasDetailPreviewOpen, setSeabedGasDetailPreviewOpen] = useState(false);
    const [seabedCraterDetailPreviewOpen, setSeabedCraterDetailPreviewOpen] = useState(false);
    const [photographyPreviewOpen, setPhotographyPreviewOpen] = useState(false);
    const [photographyLogPreviewOpen, setPhotographyLogPreviewOpen] = useState(false);
    const [gvinsPreviewOpen, setGvinsPreviewOpen] = useState(false);
    const [bsinsPreviewOpen, setBsinsPreviewOpen] = useState(false);
    const [cvinsPreviewOpen, setCvinsPreviewOpen] = useState(false);
    const [cleanPreviewOpen, setCleanPreviewOpen] = useState(false);
    const [mpinsPreviewOpen, setMpinsPreviewOpen] = useState(false);
    const [utwtkPreviewOpen, setUtwtkPreviewOpen] = useState(false);
    const [szonePreviewOpen, setSzonePreviewOpen] = useState(false);
    const [cpclbPreviewOpen, setCpclbPreviewOpen] = useState(false);
    const [utclbPreviewOpen, setUtclbPreviewOpen] = useState(false);
    const [pipelineEventSketchPreviewOpen, setPipelineEventSketchPreviewOpen] = useState(false);
    const [divingAnodePreviewOpen, setDivingAnodePreviewOpen] = useState(false);
    const [divingAnmainPreviewOpen, setDivingAnmainPreviewOpen] = useState(false);
    const [divingMgiPreviewOpen, setDivingMgiPreviewOpen] = useState(false);
    const [divingAcfmcPreviewOpen, setDivingAcfmcPreviewOpen] = useState(false);
    const [divingPlcoPreviewOpen, setDivingPlcoPreviewOpen] = useState(false);
    const [divingItemReportPreviewOpen, setDivingItemReportPreviewOpen] = useState(false);
    const [divingItmainReportPreviewOpen, setDivingItmainReportPreviewOpen] = useState(false);
    const [rovRwdiPreviewOpen, setRovRwdiPreviewOpen] = useState(false);
    const [divingDcasnUwPreviewOpen, setDivingDcasnUwPreviewOpen] = useState(false);
    const [divingDcasnTsPreviewOpen, setDivingDcasnTsPreviewOpen] = useState(false);
    const [divingDcondUwPreviewOpen, setDivingDcondUwPreviewOpen] = useState(false);
    const [divingDcondTsPreviewOpen, setDivingDcondTsPreviewOpen] = useState(false);
    const [divingFmdPreviewOpen, setDivingFmdPreviewOpen] = useState(false);
    const [divingMeasuPreviewOpen, setDivingMeasuPreviewOpen] = useState(false);
    const [divingRrisiPreviewOpen, setDivingRrisiPreviewOpen] = useState(false);
    const [divingRrisiDetailPreviewOpen, setDivingRrisiDetailPreviewOpen] = useState(false);
    const [divingJtisiPreviewOpen, setDivingJtisiPreviewOpen] = useState(false);
    const [divingJtisiDetailPreviewOpen, setDivingJtisiDetailPreviewOpen] = useState(false);
    const [divingItisiPreviewOpen, setDivingItisiPreviewOpen] = useState(false);
    const [divingItisiDetailPreviewOpen, setDivingItisiDetailPreviewOpen] = useState(false);
    const [seabedTemplateType, setSeabedTemplateType] = useState<string>('seabed-survey-debris');

    const [previewRecord, setPreviewRecord] = useState<any>(null);

    const generateAnomalyReportBlob = async (printFriendly?: boolean, showSignatures?: boolean) => {
        if (!previewRecord) return;
        const record = previewRecord;
        try {
            const settings = await getReportHeaderData();
            const config = {
                reportNoPrefix: "ANOMALY",
                reportYear: new Date().getFullYear().toString(),
                preparedBy: { name: "Inspector", date: new Date().toLocaleDateString() },
                reviewedBy: { name: "", date: "" },
                approvedBy: { name: "", date: "" },
                watermark: { enabled: false, text: "", transparency: 0.1 },
                showContractorLogo: true,
                showPageNumbers: true,
                inspectionId: record.insp_id,
                returnBlob: true,
                printFriendly: printFriendly || false,
                showSignatures: showSignatures ?? reportConfig.showSignatures
            };
            return await generateDefectAnomalyReport(
                { id: jobPackId || "0", name: headerData.jobpackName },
                { id: structureId || "0", str_name: headerData.platformName },
                headerData.sowReportNo || "",
                { company_name: settings.companyName, logo_url: settings.companyLogo },
                config
            );
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate report");
            return;
        }
    };

    const generateSeabedReport = async (templateId?: string) => {
        const tid = templateId || seabedTemplateType || 'seabed-survey-debris';
        const filterMap: Record<string, string> = {
            "seabed-survey-debris": "Debris",
            "seabed-survey-gas": "Gas Seepage",
            "seabed-survey-crater": "Crater",
            "rov-seabed-report": ""
        };
        
        const itemTypeFilter = filterMap[tid] !== undefined ? filterMap[tid] : "Debris";
        const recordsToPrint = currentRecords.filter(r => {
            if (!(r.inspection_type_code === 'RSEAB' || r.inspection_type?.code === 'RSEAB' || (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'SEABED')) {
                return false;
            }
            const cat = (r.inspection_data?.category || r.inspection_data?.type || '').toLowerCase();
            const desc = (r.description || '').toLowerCase();
            if (tid === 'seabed-survey-gas') {
                return cat === 'gas seepage' || desc.startsWith('gas seepage');
            } else if (tid === 'seabed-survey-crater') {
                return cat === 'crater' || desc.startsWith('crater') || desc.startsWith('seabed crater');
            } else if (tid === 'seabed-survey-debris') {
                return cat === 'debris' || cat === '' || (!cat && (desc.startsWith('debris') || desc.startsWith('seabed debris') || (!desc.startsWith('gas') && !desc.startsWith('crater'))));
            }
            return true;
        });

        if (recordsToPrint.length === 0) {
            toast.error(`No ${itemTypeFilter || "Seabed"} records found for Seabed Survey.`);
            return;
        }

        setSeabedTemplateType(tid);
        setSeabedPreviewOpen(true);
    };

    const generateSeabedReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const filterMap: Record<string, string> = {
            "seabed-survey-debris": "Debris",
            "seabed-survey-gas": "Gas Seepage",
            "seabed-survey-crater": "Crater",
            "rov-seabed-report": ""
        };
        
        const itemTypeFilter = filterMap[seabedTemplateType] !== undefined ? filterMap[seabedTemplateType] : "Debris";
        const recordsToPrint = currentRecords.filter(r => {
            if (!(r.inspection_type_code === 'RSEAB' || r.inspection_type?.code === 'RSEAB' || (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'SEABED')) {
                return false;
            }
            const cat = (r.inspection_data?.category || r.inspection_data?.type || '').toLowerCase();
            const desc = (r.description || '').toLowerCase();
            if (seabedTemplateType === 'seabed-survey-gas') {
                return cat === 'gas seepage' || desc.startsWith('gas seepage');
            } else if (seabedTemplateType === 'seabed-survey-crater') {
                return cat === 'crater' || desc.startsWith('crater') || desc.startsWith('seabed crater');
            } else if (seabedTemplateType === 'seabed-survey-debris') {
                return cat === 'debris' || cat === '' || (!cat && (desc.startsWith('debris') || desc.startsWith('seabed debris') || (!desc.startsWith('gas') && !desc.startsWith('crater'))));
            }
            return true;
        });

        if (recordsToPrint.length === 0) return;

        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('*').eq('id', Number(jobPackId)).single();
        const { data: structure } = await supabase.from('structure').select('*').eq('str_id', Number(structureId)).single();

        if (!jobPack || !structure) return;

        const result = await generateSeabedSurveyReport(
            { ...jobPack, id: jobPack.id },
            { ...structure, id: structure.str_id },
            headerData.sowReportNo,
            { company_name: settings.companyName, logo_url: settings.companyLogo, departmentName: settings.departmentName },
            {
                reportNoPrefix: "SEABED",
                reportYear: new Date().getFullYear().toString(),
                preparedBy: { name: "Inspector", date: new Date().toLocaleDateString() },
                showContractorLogo: true,
                showPageNumbers: true,
                printFriendly: printFriendly || false,
                returnBlob: true,
                showSignatures: showSignatures ?? reportConfig.showSignatures
            },
            itemTypeFilter
        );
        return result as Blob;
    };

    const generateSeabedDetailReport = async () => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            if (typeCode !== 'RSEAB') return false;
            const cat = (r.inspection_data?.category || r.inspection_data?.type || '').toLowerCase();
            const desc = (r.description || '').toLowerCase();
            return cat === 'debris' || cat === '' || (!cat && (desc.startsWith('debris') || desc.startsWith('seabed debris') || !desc.startsWith('gas') && !desc.startsWith('crater')));
        });
        if (records.length === 0) {
            toast.error("No Seabed Survey Debris records found to generate report");
            return;
        }
        setSeabedDetailPreviewOpen(true);
    };

    const generateSeabedDetailReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            if (typeCode !== 'RSEAB') return false;
            const cat = (r.inspection_data?.category || r.inspection_data?.type || '').toLowerCase();
            const desc = (r.description || '').toLowerCase();
            return cat === 'debris' || cat === '' || (!cat && (desc.startsWith('debris') || desc.startsWith('seabed debris') || !desc.startsWith('gas') && !desc.startsWith('crater')));
        });
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        const { generateROVRSEABDetailReport } = await import("@/utils/report-generators/rov-rseab-detail-report");
        return await generateROVRSEABDetailReport(
            records.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
            { ...headerData, contractorLogoUrl },
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
            { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId), sowReportNo: headerData.sowReportNo }
        ) as Blob;
    };

    const generateSeabedGasDetailReport = async () => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            if (typeCode !== 'RSEAB') return false;
            const cat = (r.inspection_data?.category || r.inspection_data?.type || '').toLowerCase();
            const desc = (r.description || '').toLowerCase();
            return cat === 'gas seepage' || desc.startsWith('gas seepage');
        });
        if (records.length === 0) {
            toast.error("No Seabed Survey Gas Seepage records found to generate report");
            return;
        }
        setSeabedGasDetailPreviewOpen(true);
    };

    const generateSeabedGasDetailReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            if (typeCode !== 'RSEAB') return false;
            const cat = (r.inspection_data?.category || r.inspection_data?.type || '').toLowerCase();
            const desc = (r.description || '').toLowerCase();
            return cat === 'gas seepage' || desc.startsWith('gas seepage');
        });
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        const { generateROVRSEABGasDetailReport } = await import("@/utils/report-generators/rov-rseab-gas-detail-report");
        return await generateROVRSEABGasDetailReport(
            records.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
            { ...headerData, contractorLogoUrl },
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
            { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId), sowReportNo: headerData.sowReportNo }
        ) as Blob;
    };

    const generateSeabedCraterDetailReport = async () => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            if (typeCode !== 'RSEAB') return false;
            const cat = (r.inspection_data?.category || r.inspection_data?.type || '').toLowerCase();
            const desc = (r.description || '').toLowerCase();
            return cat === 'crater' || desc.startsWith('crater') || desc.startsWith('seabed crater');
        });
        if (records.length === 0) {
            toast.error("No Seabed Survey Crater records found to generate report");
            return;
        }
        setSeabedCraterDetailPreviewOpen(true);
    };

    const generateSeabedCraterDetailReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            if (typeCode !== 'RSEAB') return false;
            const cat = (r.inspection_data?.category || r.inspection_data?.type || '').toLowerCase();
            const desc = (r.description || '').toLowerCase();
            return cat === 'crater' || desc.startsWith('crater') || desc.startsWith('seabed crater');
        });
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        const { generateROVRSEABCraterDetailReport } = await import("@/utils/report-generators/rov-rseab-crater-detail-report");
        return await generateROVRSEABCraterDetailReport(
            records.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
            { ...headerData, contractorLogoUrl },
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
            { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId), sowReportNo: headerData.sowReportNo }
        ) as Blob;
    };

    const generateRMGIReport = async () => {
        const rmgiRecords = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'RMGI');
        if (rmgiRecords.length === 0) {
            toast.error("No RMGI records found to generate report");
            return;
        }
        setRmgiPreviewOpen(true);
    };

    const generateRMGIReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const rmgiRecords = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'RMGI');
        if (rmgiRecords.length === 0) return;

        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }

        const generatedConfig = {
            returnBlob: true,
            printFriendly,
            showSignatures: showSignatures ?? reportConfig.showSignatures,
            structureId: Number(structureId),
            watermark: reportConfig.watermark,
            preparedBy: reportConfig.preparedBy,
            reviewedBy: reportConfig.reviewedBy,
            approvedBy: reportConfig.approvedBy,
        };
        if (typeof window !== 'undefined') {
            (window as any).__reportConfig = generatedConfig;
        }

        return await generateROVRMGIReport(
            rmgiRecords,
            { ...headerData, contractorLogoUrl },
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
            generatedConfig
        ) as Blob;
    };

    const generateMGIReport = async () => {
        const mgiRecords = currentRecords.filter(r => r.inspection_type_code === 'RMGI' || r.inspection_type?.code === 'RMGI');
        if (mgiRecords.length === 0) {
            toast.error("No MGI records found to generate report");
            return;
        }
        setMPreviewOpen(true);
    };

    const generateMGIReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const mgiRecords = currentRecords.filter(r => r.inspection_type_code === 'RMGI' || r.inspection_type?.code === 'RMGI');
        if (mgiRecords.length === 0) return;

        const settings = await getReportHeaderData();
        
        const profileId = mgiRecords.find(r => r.inspection_data?._mgi_profile_id)?.inspection_data?._mgi_profile_id;
        const profile = await getMGIProfileForJobpack(supabase, jobPackId, profileId);

        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }

        const result = await generateROVMGIGraphReport(
            mgiRecords,
            profile,
            { 
                ...headerData, 
                contractorLogoUrl,
                vessel: headerData.vessel
            },
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
            {
                jobPackId: Number(jobPackId),
                structureId: Number(structureId),
                sowReportNo: headerData.sowReportNo,
                preparedBy: { name: "Inspector", date: new Date().toLocaleDateString() },
                returnBlob: true,
                printFriendly: printFriendly || false,
                showSignatures: showSignatures ?? reportConfig.showSignatures
            }
        );
        return result as Blob;
    };

    const generateFMDReport = async () => {
        const fmdRecords = currentRecords.filter(r => r.inspection_type_code === 'RFMD' || r.inspection_type?.code === 'RFMD');
        if (fmdRecords.length === 0) {
            toast.error("No FMD records found to generate report");
            return;
        }
        setFmdPreviewOpen(true);
    };

    const generateFMDReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const fmdRecords = currentRecords.filter(r => r.inspection_type_code === 'RFMD' || r.inspection_type?.code === 'RFMD');
        if (fmdRecords.length === 0) return;

        const settings = await getReportHeaderData();

        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }

        const result = await generateROVFMDReport(
            fmdRecords,
            { 
                ...headerData, 
                contractorLogoUrl,
                vessel: headerData.vessel
            },
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
            {
                jobPackId: Number(jobPackId),
                structureId: Number(structureId),
                sowReportNo: headerData.sowReportNo,
                preparedBy: { name: "Inspector", date: new Date().toLocaleDateString() },
                returnBlob: true,
                printFriendly: printFriendly || false,
                showSignatures: showSignatures ?? reportConfig.showSignatures
            }
        );
        return result as Blob;
    };

    const generateSZCIReport = async () => {
        const szciRecords = currentRecords.filter(r => r.inspection_type_code === 'RSZCI' || r.inspection_type?.code === 'RSZCI');
        if (szciRecords.length === 0) {
            toast.error("No Splash Zone records found to generate report");
            return;
        }
        setSzciPreviewOpen(true);
    };

    const generateSZCIReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const szciRecords = currentRecords.filter(r => r.inspection_type_code === 'RSZCI' || r.inspection_type?.code === 'RSZCI');
        if (szciRecords.length === 0) return;

        const settings = await getReportHeaderData();
        
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }

        const result = await generateROVSZCIReport(
            szciRecords,
            { 
                ...headerData, 
                contractorLogoUrl,
                vessel: headerData.vessel
            },
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
            {
                jobPackId: Number(jobPackId),
                structureId: Number(structureId),
                sowReportNo: headerData.sowReportNo,
                preparedBy: { name: "Inspector", date: new Date().toLocaleDateString() },
                returnBlob: true,
                printFriendly: printFriendly || false,
                showSignatures: showSignatures ?? reportConfig.showSignatures
            }
        );
        return result as Blob;
    };

    const generateUTWTReport = async () => {
        const utwtRecords = currentRecords.filter(r => r.inspection_type_code === 'RUTWT' || r.inspection_type?.code === 'RUTWT');
        if (utwtRecords.length === 0) {
            toast.error("No UTWT records found to generate report");
            return;
        }
        setUtwtPreviewOpen(true);
    };

    const generateUTWTReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const utwtRecords = currentRecords.filter(r => r.inspection_type_code === 'RUTWT' || r.inspection_type?.code === 'RUTWT');
        if (utwtRecords.length === 0) return;

        const settings = await getReportHeaderData();
        
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }

        const result = await generateROVUTWTReport(
            utwtRecords,
            { 
                ...headerData, 
                contractorLogoUrl,
                vessel: headerData.vessel
            },
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
            {
                jobPackId: Number(jobPackId),
                structureId: Number(structureId),
                sowReportNo: headerData.sowReportNo,
                preparedBy: { name: "Inspector", date: new Date().toLocaleDateString() },
                returnBlob: true,
                printFriendly: printFriendly || false,
                showSignatures: showSignatures ?? reportConfig.showSignatures
            }
        );
        return result as Blob;
    };

    const generateRGReport = async () => {
        const rgRecords = currentRecords.filter(r => {
            const qid = (r.structure_components?.q_id || r.component?.q_id || "").toUpperCase();
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
            return typeCode === "RGVI" || qid.startsWith("RG") || qid.startsWith("RISG") || qid.startsWith("RISER_GUARD") || qid.startsWith("RISER-GUARD") || typeCode === "RG" || typeCode === "RISG" || typeCode === "RISERGUARD" || compCode === "RG" || compCode === "RISG";
        });
        if (rgRecords.length === 0) {
            toast.error("No Riser Guard records found to generate report");
            return;
        }
        setRgPreviewOpen(true);
    };

    const generateRGReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const rgRecords = currentRecords.filter(r => {
            const qid = (r.structure_components?.q_id || r.component?.q_id || "").toUpperCase();
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
            return typeCode === "RGVI" || qid.startsWith("RG") || qid.startsWith("RISG") || qid.startsWith("RISER_GUARD") || qid.startsWith("RISER-GUARD") || typeCode === "RG" || typeCode === "RISG" || typeCode === "RISERGUARD" || compCode === "RG" || compCode === "RISG";
        });
        if (rgRecords.length === 0) return;

        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }

        const result = await generateROVRiserGuardReport(
            rgRecords.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
            { 
                ...headerData, 
                contractorLogoUrl,
                vessel: headerData.vessel
            },
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
            {
                jobPackId: Number(jobPackId),
                structureId: Number(structureId),
                sowReportNo: headerData.sowReportNo,
                preparedBy: { name: "Inspector", date: new Date().toLocaleDateString() },
                returnBlob: true,
                printFriendly: printFriendly || false,
                showSignatures: showSignatures ?? reportConfig.showSignatures
            }
        );
        return result as Blob;
    };

    const generateSGReport = async () => {
        const sgRecords = currentRecords.filter(r => {
            const qid = (r.structure_components?.q_id || r.component?.q_id || "").toUpperCase();
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
            const compName = (r.structure_components?.comp_name || r.component?.comp_name || r.structure_components?.name || r.component?.name || "").toUpperCase();
            return qid.startsWith("SG") || qid.startsWith("CS_GUARD") || qid.startsWith("CS-GUARD") || (qid.includes("GUARD") && qid.includes("CS")) || typeCode === "SG" || typeCode === "CAISSONGUARD" || compCode === "SG" || compCode === "CS_GUARD" || compName.includes("CAISSON GUARD");
        });
        if (sgRecords.length === 0) {
            toast.error("No Caisson Guard records found to generate report");
            return;
        }
        setSgPreviewOpen(true);
    };

    const generateSGReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const sgRecords = currentRecords.filter(r => {
            const qid = (r.structure_components?.q_id || r.component?.q_id || "").toUpperCase();
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
            const compName = (r.structure_components?.comp_name || r.component?.comp_name || r.structure_components?.name || r.component?.name || "").toUpperCase();
            return qid.startsWith("SG") || qid.startsWith("CS_GUARD") || qid.startsWith("CS-GUARD") || (qid.includes("GUARD") && qid.includes("CS")) || typeCode === "SG" || typeCode === "CAISSONGUARD" || compCode === "SG" || compCode === "CS_GUARD" || compName.includes("CAISSON GUARD");
        });
        if (sgRecords.length === 0) return;

        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }

        const result = await generateROVCaissonGuardReport(
            sgRecords.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
            { 
                ...headerData, 
                contractorLogoUrl,
                vessel: headerData.vessel
            },
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
            {
                jobPackId: Number(jobPackId),
                structureId: Number(structureId),
                sowReportNo: headerData.sowReportNo,
                preparedBy: { name: "Inspector", date: new Date().toLocaleDateString() },
                returnBlob: true,
                printFriendly: printFriendly || false,
                showSignatures: showSignatures ?? reportConfig.showSignatures
            }
        );
        return result as Blob;
    };

    const generateCUReport = async () => {
        const cuRecords = currentRecords.filter(r => {
            const qid = (r.structure_components?.q_id || r.component?.q_id || "").toUpperCase();
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
            const compName = (r.structure_components?.comp_name || r.component?.comp_name || r.structure_components?.name || r.component?.name || "").toUpperCase();
            return qid.startsWith("CU") || qid.startsWith("CD_GUARD") || qid.startsWith("CD-GUARD") || (qid.includes("GUARD") && (qid.includes("CD") || qid.includes("COND"))) || typeCode === "CU" || typeCode === "CONDUCTORGUARD" || compCode === "CU" || compCode === "CD_GUARD" || compName.includes("CONDUCTOR GUARD");
        });
        if (cuRecords.length === 0) {
            toast.error("No Conductor Guard records found to generate report");
            return;
        }
        setCuPreviewOpen(true);
    };

    const generateCUReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const cuRecords = currentRecords.filter(r => {
            const qid = (r.structure_components?.q_id || r.component?.q_id || "").toUpperCase();
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
            const compName = (r.structure_components?.comp_name || r.component?.comp_name || r.structure_components?.name || r.component?.name || "").toUpperCase();
            return qid.startsWith("CU") || qid.startsWith("CD_GUARD") || qid.startsWith("CD-GUARD") || (qid.includes("GUARD") && (qid.includes("CD") || qid.includes("COND"))) || typeCode === "CU" || typeCode === "CONDUCTORGUARD" || compCode === "CU" || compCode === "CD_GUARD" || compName.includes("CONDUCTOR GUARD");
        });
        if (cuRecords.length === 0) return;

        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData = null } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }

        const result = await generateROVConductorGuardReport(
            cuRecords.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
            { 
                ...headerData, 
                contractorLogoUrl,
                vessel: headerData.vessel
            },
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
            {
                jobPackId: Number(jobPackId),
                structureId: Number(structureId),
                sowReportNo: headerData.sowReportNo,
                preparedBy: { name: "Inspector", date: new Date().toLocaleDateString() },
                returnBlob: true,
                printFriendly: printFriendly || false,
                showSignatures: showSignatures ?? reportConfig.showSignatures
            }
        );
        return result as Blob;
    };

    const generateBLReport = async () => {
        const blRecords = currentRecords.filter(r => isBLRecord(r));
        if (blRecords.length === 0) {
            toast.error("No Boatlanding records found to generate report");
            return;
        }
        setBlPreviewOpen(true);
    };

    const generateBLReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const blRecords = currentRecords.filter(r => isBLRecord(r));
        if (blRecords.length === 0) return;

        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }

        const result = await generateROVBoatlandingReport(
            blRecords.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
            { 
                ...headerData, 
                contractorLogoUrl,
                vessel: headerData.vessel
            },
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
            {
                jobPackId: Number(jobPackId),
                structureId: Number(structureId),
                sowReportNo: headerData.sowReportNo,
                preparedBy: { name: "Inspector", date: new Date().toLocaleDateString() },
                returnBlob: true,
                printFriendly: printFriendly || false,
                showSignatures: showSignatures ?? reportConfig.showSignatures
            }
        );
        return result as Blob;
    };

    const generateRSCORReport = async () => {
        const rscorRecords = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'RSCOR' || (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'SCOUR');
        if (rscorRecords.length === 0) {
            toast.error("No Scour records found to generate report");
            return;
        }
        setRscorPreviewOpen(true);
    };

    const generateRSCORReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const rscorRecords = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'RSCOR' || (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'SCOUR');
        if (rscorRecords.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        const generatedConfig = {
            returnBlob: true,
            printFriendly,
            showSignatures: showSignatures ?? reportConfig.showSignatures,
            structureId: Number(structureId),
            watermark: reportConfig.watermark,
            preparedBy: reportConfig.preparedBy,
            reviewedBy: reportConfig.reviewedBy,
            approvedBy: reportConfig.approvedBy,
        };
        if (typeof window !== 'undefined') {
            (window as any).__reportConfig = generatedConfig;
        }
        return await generateROVRSCORReport(rscorRecords, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, generatedConfig) as Blob;
    };

    const generateRSCORV2Report = async () => {
        const rscorRecords = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'RSCOR' || (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'SCOUR');
        if (rscorRecords.length === 0) {
            toast.error("No Scour records found to generate report");
            return;
        }
        setRscorV2PreviewOpen(true);
    };

    const generateRSCORV2ReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const rscorRecords = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'RSCOR' || (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'SCOUR');
        if (rscorRecords.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        const generatedConfig = {
            returnBlob: true,
            printFriendly,
            structureId: Number(structureId),
            showSignatures: showSignatures ?? reportConfig.showSignatures,
            preparedBy: reportConfig.preparedBy,
            reviewedBy: reportConfig.reviewedBy,
            approvedBy: reportConfig.approvedBy,
            watermark: reportConfig.watermark
        };
        if (typeof window !== 'undefined') {
            (window as any).__reportConfig = generatedConfig;
        }
        return await generateROVRSCORV2Report(rscorRecords, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, generatedConfig as any) as Blob;
    };

    const generateRRISIReport = async () => {
        const records = currentRecords.filter(r => (r.structure_components?.q_id || "").toUpperCase().startsWith('R'));
        if (records.length === 0) {
            toast.error("No Riser records found to generate report");
            return;
        }
        setRrisiPreviewOpen(true);
    };

    const generateJTISIReport = async () => {
        const records = currentRecords.filter(r => (r.structure_components?.q_id || "").toUpperCase().startsWith('J'));
        if (records.length === 0) {
            toast.error("No J-Tube records found to generate report");
            return;
        }
        setJtisiPreviewOpen(true);
    };

    const generateITISIReport = async () => {
        const records = currentRecords.filter(r => (r.structure_components?.q_id || "").toUpperCase().startsWith('I'));
        if (records.length === 0) {
            toast.error("No I-Tube records found to generate report");
            return;
        }
        setItisiPreviewOpen(true);
    };

    const generateRRISIReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const qid = (r.structure_components?.q_id || "").toUpperCase();
            const compCode = (r.structure_components?.code || "").toUpperCase();
            // Strict: Must be RRISI type AND (Component RS OR starts with R but NOT RISG)
            return typeCode === 'RRISI' && qid.startsWith('R') && !qid.startsWith('RISG') && (compCode === 'RS' || compCode === 'CL' || compCode === 'WELD');
        });
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateROVRRISIReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId), reportType: 'R' }) as Blob;
    };

    const generateRRISIDetailReport = async () => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const qid = (r.structure_components?.q_id || "").toUpperCase();
            const compCode = (r.structure_components?.code || "").toUpperCase();
            return typeCode === 'RRISI' && qid.startsWith('R') && !qid.startsWith('RISG') && (compCode === 'RS' || compCode === 'CL' || compCode === 'WELD');
        });
        if (records.length === 0) {
            toast.error("No Riser records found to generate report");
            return;
        }
        setRrisiDetailPreviewOpen(true);
    };

    const generateRRISIDetailReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const qid = (r.structure_components?.q_id || "").toUpperCase();
            const compCode = (r.structure_components?.code || "").toUpperCase();
            return typeCode === 'RRISI' && qid.startsWith('R') && !qid.startsWith('RISG') && (compCode === 'RS' || compCode === 'CL' || compCode === 'WELD');
        });
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateROVRRISIDetailReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId) }) as Blob;
    };

    const generateJTISIDetailReport = async () => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const qid = (r.structure_components?.q_id || "").toUpperCase();
            const compCode = (r.structure_components?.code || "").toUpperCase();
            return typeCode === 'RRISI' && qid.startsWith('J') && (compCode === 'RS' || compCode === 'CL' || compCode === 'WELD');
        });
        if (records.length === 0) {
            toast.error("No J-Tube records found to generate report");
            return;
        }
        setJtisiDetailPreviewOpen(true);
    };

    const generateJTISIDetailReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const qid = (r.structure_components?.q_id || "").toUpperCase();
            const compCode = (r.structure_components?.code || "").toUpperCase();
            return typeCode === 'RRISI' && qid.startsWith('J') && (compCode === 'RS' || compCode === 'CL' || compCode === 'WELD');
        });
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateROVRRISIJTubeDetailReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId) }) as Blob;
    };

    const generateJTISIReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => (r.structure_components?.q_id || "").toUpperCase().startsWith('J'));
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateROVRRISIReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId), reportType: 'J' }) as Blob;
    };

    const generateITISIReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => (r.structure_components?.q_id || "").toUpperCase().startsWith('I'));
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateROVRRISIReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId), reportType: 'I' }) as Blob;
    };

    const generateITISIDetailReport = async () => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const qid = (r.structure_components?.q_id || "").toUpperCase();
            const compCode = (r.structure_components?.code || "").toUpperCase();
            return typeCode === 'RRISI' && qid.startsWith('I') && (compCode === 'RS' || compCode === 'CL' || compCode === 'WELD');
        });
        if (records.length === 0) {
            toast.error("No I-Tube records found to generate report");
            return;
        }
        setItisiDetailPreviewOpen(true);
    };

    const generateITISIDetailReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const qid = (r.structure_components?.q_id || "").toUpperCase();
            const compCode = (r.structure_components?.code || "").toUpperCase();
            return typeCode === 'RRISI' && qid.startsWith('I') && (compCode === 'RS' || compCode === 'CL' || compCode === 'WELD');
        });
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateROVRRISIITubeDetailReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId) }) as Blob;
    };

    const generateAnodeReport = async () => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
            const isAnode = typeCode === 'RGVI' || typeCode === 'ANODE' || typeCode === 'ANOD';
            return isAnode && compCode === 'AN' && typeCode !== 'RSANI';
        });
        if (records.length === 0) {
            toast.error("No ROV Anode records (RGVI + component_type: AN) found to generate report");
            return;
        }
        setAnodePreviewOpen(true);
    };

    const generateAnodeReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
            const isAnode = typeCode === 'RGVI' || typeCode === 'ANODE' || typeCode === 'ANOD';
            return isAnode && compCode === 'AN' && typeCode !== 'RSANI';
        });
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateROVAnodeReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures }) as Blob;
    };

    const generateAnodeRsaniReport = async () => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
            return typeCode === 'RSANI' && compCode === 'AN';
        });
        if (records.length === 0) {
            toast.error("No ROV Anode CVI records (RSANI + component_type: AN) found to generate report");
            return;
        }
        setAnodeRsaniPreviewOpen(true);
    };

    const generateAnodeRsaniReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
            return typeCode === 'RSANI' && compCode === 'AN';
        });
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateROVAnodeRSANIReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures }) as Blob;
    };

    const generateCPReport = async () => {
        const records = currentRecords.filter(r => {
            const d = r.inspection_data || {};
            return d.cp_rdg !== undefined || d.cp_reading_mv !== undefined || d.cp !== undefined;
        });
        if (records.length === 0) {
            toast.error("No CP records found to generate report");
            return;
        }
        setCpPreviewOpen(true);
    };

    const generateCPReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const d = r.inspection_data || {};
            return d.cp_rdg !== undefined || d.cp_reading_mv !== undefined || d.cp !== undefined;
        });
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateROVCPReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures }) as Blob;
    };

    const generateRSWNIReport = async () => {
        const records = currentRecords.filter(r => {
            const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return code === 'RSWNI' || code === 'SWNI';
        });
        if (records.length === 0) {
            toast.error("No RSWNI Selected Node records found to generate report");
            return;
        }
        setRswniPreviewOpen(true);
    };

    const generateRSWNIReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return code === 'RSWNI' || code === 'SWNI';
        });
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateROVSelectedNodeReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures }) as Blob;
    };

    const generateROVRICMIReportAction = async () => {
        const records = currentRecords.filter(r => {
            const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return code === 'RICMI';
        });
        if (records.length === 0) {
            toast.error("No Inclinometer records found to generate report");
            return;
        }
        setRovRicmiPreviewOpen(true);
    };

    const generateROVRICMIReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return code === 'RICMI';
        });
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateROVRICMIReport(
            records.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
            { ...headerData, contractorLogoUrl },
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
            { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, jobPackId: Number(jobPackId), structureId: Number(structureId), sowReportNo: headerData.sowReportNo }
        ) as Blob;
    };

    const generateDivingANMAINReportAction = async () => {
        const records = currentRecords.filter(r => {
            const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return code === 'ANMAIN';
        });
        if (records.length === 0) {
            toast.error("No Anode Maintenance records found to generate report");
            return;
        }
        setDivingAnmainPreviewOpen(true);
    };

    const generateDivingANMAINReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return code === 'ANMAIN';
        });
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateDivingANMAINReport(
            records.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
            { ...headerData, contractorLogoUrl },
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
            { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, jobPackId: Number(jobPackId), structureId: Number(structureId), sowReportNo: headerData.sowReportNo }
        ) as Blob;
    };

    const generateRGVIReport = async () => {
        const records = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'RGVI');
        if (records.length === 0) {
            toast.error("No RGVI records found to generate report");
            return;
        }
        setRgviPreviewOpen(true);
    };

    const generateRGVIReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'RGVI');
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }

        const isRG = records.some(r => {
            const qid = (r.structure_components?.q_id || r.component?.q_id || "").toUpperCase();
            const code = (r.structure_components?.code || r.component?.code || "").toUpperCase();
            return qid.startsWith("RG") || qid.startsWith("RISG") || code === "RG";
        });

        if (isRG) {
            return await generateROVRiserGuardReport(
                records.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                { ...headerData, contractorLogoUrl, vessel: headerData.vessel },
                { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
                {
                    jobPackId: Number(jobPackId),
                    structureId: Number(structureId),
                    sowReportNo: headerData.sowReportNo,
                    preparedBy: { name: "Inspector", date: new Date().toLocaleDateString() },
                    returnBlob: true,
                    printFriendly: printFriendly || false,
                    showSignatures: showSignatures ?? reportConfig.showSignatures
                }
            );
        }

        return await generateROVRGVIReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures }) as Blob;
    };

    const generateGVINSReport = async () => {
        const records = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'GVINS');
        if (records.length === 0) {
            toast.error("No GVINS records found to generate report");
            return;
        }
        setGvinsPreviewOpen(true);
    };

    const generateGVINSReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'GVINS');
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateDivingGVINSReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures }) as Blob;
    };

    const generateDivingDCASNUWReport = async () => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return ['GVINS', 'CVINS', 'CPSURV', 'UTWTK', 'DUTWT'].includes(typeCode);
        });
        if (records.length === 0) {
            toast.error("No matching caisson records found to generate report");
            return;
        }
        setDivingDcasnUwPreviewOpen(true);
    };

    const generateDivingDCASNUWReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return ['GVINS', 'CVINS', 'CPSURV', 'UTWTK', 'DUTWT'].includes(typeCode);
        });
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateDivingDCASNUWReportTemplate(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId) }) as Blob;
    };

    const generateDivingDCASNTSReport = async () => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return ['GVINS', 'CVINS', 'CPSURV', 'UTWTK', 'DUTWT'].includes(typeCode);
        });
        if (records.length === 0) {
            toast.error("No matching caisson records found to generate report");
            return;
        }
        setDivingDcasnTsPreviewOpen(true);
    };

    const generateDivingDCASNTSReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return ['GVINS', 'CVINS', 'CPSURV', 'UTWTK', 'DUTWT'].includes(typeCode);
        });
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateDivingDCASNTSReportTemplate(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId) }) as Blob;
    };

    const generateDivingDCONDUWReport = async () => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return ['GVINS', 'CVINS', 'CPSURV', 'UTWTK', 'DUTWT'].includes(typeCode);
        });
        if (records.length === 0) {
            toast.error("No matching conductor records found to generate report");
            return;
        }
        setDivingDcondUwPreviewOpen(true);
    };

    const generateDivingDCONDUWReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return ['GVINS', 'CVINS', 'CPSURV', 'UTWTK', 'DUTWT'].includes(typeCode);
        });
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateDivingDCONDUWReportTemplate(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId) }) as Blob;
    };

    const generateDivingDCONDTSReport = async () => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return ['GVINS', 'CVINS', 'CPSURV', 'UTWTK', 'DUTWT'].includes(typeCode);
        });
        if (records.length === 0) {
            toast.error("No matching conductor records found to generate report");
            return;
        }
        setDivingDcondTsPreviewOpen(true);
    };

    const generateDivingDCONDTSReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return ['GVINS', 'CVINS', 'CPSURV', 'UTWTK', 'DUTWT'].includes(typeCode);
        });
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateDivingDCONDTSReportTemplate(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId) }) as Blob;
    };

    const generateDivingRRISIReport = async () => {
        setDivingRrisiPreviewOpen(true);
    };

    const generateDivingRRISIReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const qid = (r.structure_components?.q_id || r.q_id || "").toUpperCase();
            return qid.startsWith('R') && !qid.startsWith('RISG');
        });
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateDivingRRISIReportGenerator(
            records,
            { ...headerData, contractorLogoUrl },
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
            { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId), reportType: 'R' }
        ) as Blob;
    };

    const generateDivingRRISIDetailReport = async () => {
        setDivingRrisiDetailPreviewOpen(true);
    };

    const generateDivingRRISIDetailReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const qid = (r.structure_components?.q_id || r.q_id || "").toUpperCase();
            return qid.startsWith('R') && !qid.startsWith('RISG');
        });
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateDivingRRISIDetailReportGenerator(
            records,
            { ...headerData, contractorLogoUrl },
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
            { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId), reportType: 'R' }
        ) as Blob;
    };

    const generateDivingJTISIReport = async () => {
        setDivingJtisiPreviewOpen(true);
    };

    const generateDivingJTISIReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const qid = (r.structure_components?.q_id || r.q_id || "").toUpperCase();
            return qid.startsWith('J');
        });
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateDivingRRISIReportGenerator(
            records,
            { ...headerData, contractorLogoUrl },
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
            { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId), reportType: 'J' }
        ) as Blob;
    };

    const generateDivingJTISIDetailReport = async () => {
        setDivingJtisiDetailPreviewOpen(true);
    };

    const generateDivingJTISIDetailReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const qid = (r.structure_components?.q_id || r.q_id || "").toUpperCase();
            return qid.startsWith('J');
        });
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateDivingRRISIDetailReportGenerator(
            records,
            { ...headerData, contractorLogoUrl },
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
            { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId), reportType: 'J' }
        ) as Blob;
    };

    const generateDivingITISIReport = async () => {
        setDivingItisiPreviewOpen(true);
    };

    const generateDivingITISIReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const qid = (r.structure_components?.q_id || r.q_id || "").toUpperCase();
            return qid.startsWith('I');
        });
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateDivingRRISIReportGenerator(
            records,
            { ...headerData, contractorLogoUrl },
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
            { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId), reportType: 'I' }
        ) as Blob;
    };

    const generateDivingITISIDetailReport = async () => {
        setDivingItisiDetailPreviewOpen(true);
    };

    const generateDivingITISIDetailReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const qid = (r.structure_components?.q_id || r.q_id || "").toUpperCase();
            return qid.startsWith('I');
        });
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateDivingRRISIDetailReportGenerator(
            records,
            { ...headerData, contractorLogoUrl },
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
            { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId), reportType: 'I' }
        ) as Blob;
    };

    const generateDivingACFMCReport = async () => {
        const records = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'ACFMC');
        if (records.length === 0) {
            toast.error("No ACFMC records found to generate report");
            return;
        }
        setDivingAcfmcPreviewOpen(true);
    };

    const generateDivingACFMCReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'ACFMC');
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateDivingACFMCReportTemplate(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures });
    };

    const generateDivingPLCOReport = async () => {
        const records = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'PL_CO');
        if (records.length === 0) {
            toast.error("No PL_CO records found to generate report");
            return;
        }
        setDivingPlcoPreviewOpen(true);
    };

    const generateDivingPLCOReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'PL_CO');
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateDivingPLCOReportTemplate(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures });
    };

    const generateROVRWDIReport = async () => {
        const records = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'RWDI');
        if (records.length === 0) {
            toast.error("No RWDI records found to generate report");
            return;
        }
        setRovRwdiPreviewOpen(true);
    };

    const generateROVRWDIReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'RWDI');
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateROVRWDIReportTemplate(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures });
    };

    const generateBSINSReport = async () => {
        const records = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'BSINS');
        if (records.length === 0) {
            toast.error("No BSINS records found to generate report");
            return;
        }
        setBsinsPreviewOpen(true);
    };

    const generateBSINSReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'BSINS');
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        try {
            const { generateDivingBSINSReport } = await import("@/utils/report-generators/diving-bsins-report");
            return await generateDivingBSINSReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures }) as Blob;
        } catch (error) {
            console.error("BSINS report error:", error);
        }
    };

    const generateCVINSReport = async () => {
        const records = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'CVINS');
        if (records.length === 0) {
            toast.error("No CVINS records found to generate report");
            return;
        }
        setCvinsPreviewOpen(true);
    };

    const generateCVINSReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'CVINS');
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        try {
            const { generateDivingCVINSReport } = await import("@/utils/report-generators/diving-cvins-report");
            return await generateDivingCVINSReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures }) as Blob;
        } catch (error) {
            console.error("CVINS report error:", error);
        }
    };

    const generateCLEANReport = async () => {
        const records = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'CLEAN');
        if (records.length === 0) {
            toast.error("No CLEAN records found to generate report");
            return;
        }
        setCleanPreviewOpen(true);
    };

    const generateCLEANReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'CLEAN');
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        try {
            const { generateDivingCLEANReport } = await import("@/utils/report-generators/diving-clean-report");
            return await generateDivingCLEANReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures }) as Blob;
        } catch (error) {
            console.error("CLEAN report error:", error);
        }
    };

    const generateMPINSReport = async () => {
        const records = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'MPINS');
        if (!records.length) {
            toast.error("No MPINS records found to generate report");
            return;
        }
        setMpinsPreviewOpen(true);
    };

    const generateMPINSReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'MPINS');
        if (!records.length) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        try {
            const { generateDivingMPINSReport } = await import("@/utils/report-generators/diving-mpins-report");
            return await generateDivingMPINSReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures }) as Blob;
        } catch (error) {
            console.error("MPINS report error:", error);
        }
    };

    const generateUTWTKReport = async () => {
        const records = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'UTWTK');
        if (!records.length) {
            toast.error("No UTWTK records found to generate report");
            return;
        }
        setUtwtkPreviewOpen(true);
    };

    const generateUTWTKReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'UTWTK');
        if (!records.length) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        try {
            const { generateDivingUTWTKReport } = await import("@/utils/report-generators/diving-utwtk-report");
            return await generateDivingUTWTKReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures }) as Blob;
        } catch (error) {
            console.error("UTWTK report error:", error);
        }
    };

    const generateSZONEReport = async () => {
        const records = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'SZONE');
        if (records.length === 0) {
            toast.error("No Splashzone records found to generate report");
            return;
        }
        setSzonePreviewOpen(true);
    };

    const generateSZONEReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'SZONE');
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }

        return await generateDivingSZONEReport(
            records, 
            { ...headerData, contractorLogoUrl }, 
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, 
            { 
                returnBlob: true, 
                printFriendly, 
                showSignatures: showSignatures ?? reportConfig.showSignatures,
                structureId: Number(structureId),
                jobPackId: Number(jobPackId)
            },
            supabase
        ) as Blob;
    };

    const fetchCPCLBRecords = async () => {
        const { data, error } = await supabase.from('insp_records').select(`
            *,
            inspection_type:inspection_type_id!left(id, code, name),
            structure_components:component_id!left(id, q_id, code, metadata),
            insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
            insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
            insp_anomalies(*)
        `)
        .eq('structure_id', Number(structureId))
        .eq('jobpack_id', Number(jobPackId));

        if (error) {
            console.error("Error fetching CPCLB records:", error);
            return [];
        }

        const filtered = (data || []).filter((r: any) => {
            const isCPCLB = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'CPCLB';
            const sowMatches = !headerData?.sowReportNo || String(r.sow_report_no || '').toLowerCase().includes(headerData.sowReportNo.toLowerCase());
            return isCPCLB && sowMatches;
        });

        filtered.sort((a: any, b: any) => {
            const diveA = String(a.insp_dive_jobs?.job_no || a.insp_dive_jobs?.name || a.dive_job_id || '');
            const diveB = String(b.insp_dive_jobs?.job_no || b.insp_dive_jobs?.name || b.dive_job_id || '');
            return diveA.localeCompare(diveB, undefined, { numeric: true });
        });

        return filtered;
    };

    const generateCPCLBReport = async () => {
        const records = await fetchCPCLBRecords();
        if (records.length === 0) {
            toast.error("No CP Calibration records found for this SOW/Jobpack");
            return;
        }
        setCpclbPreviewOpen(true);
    };

    const generateCPCLBReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = await fetchCPCLBRecords();
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }

        return await generateDivingCPCLBReport(
            records, 
            { ...headerData, contractorLogoUrl }, 
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, 
            { 
                returnBlob: true, 
                printFriendly, 
                showSignatures: showSignatures ?? reportConfig.showSignatures,
                structureId: Number(structureId),
                jobPackId: Number(jobPackId)
            }
        ) as Blob;
    };

    const fetchUTCLBRecords = async () => {
        const { data, error } = await supabase.from('insp_records').select(`
            *,
            inspection_type:inspection_type_id!left(id, code, name),
            structure_components:component_id!left(id, q_id, code, metadata),
            insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
            insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
            insp_anomalies(*)
        `)
        .eq('structure_id', Number(structureId))
        .eq('jobpack_id', Number(jobPackId));

        if (error) {
            console.error("Error fetching UTCLB records:", error);
            return [];
        }

        const filtered = (data || []).filter((r: any) => {
            const isUTCLB = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'UTCLB';
            const sowMatches = !headerData?.sowReportNo || String(r.sow_report_no || '').toLowerCase().includes(headerData.sowReportNo.toLowerCase());
            return isUTCLB && sowMatches;
        });

        filtered.sort((a: any, b: any) => {
            const diveA = String(a.insp_dive_jobs?.job_no || a.insp_dive_jobs?.name || a.dive_job_id || '');
            const diveB = String(b.insp_dive_jobs?.job_no || b.insp_dive_jobs?.name || b.dive_job_id || '');
            return diveA.localeCompare(diveB, undefined, { numeric: true });
        });

        return filtered;
    };

    const generateUTCLBReport = async () => {
        const records = await fetchUTCLBRecords();
        if (records.length === 0) {
            toast.error("No UT Calibration records found for this SOW/Jobpack");
            return;
        }
        setUtclbPreviewOpen(true);
    };

    const generateUTCLBReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = await fetchUTCLBRecords();
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }

        return await generateDivingUTCLBReport(
            records, 
            { ...headerData, contractorLogoUrl }, 
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, 
            { 
                returnBlob: true, 
                printFriendly, 
                showSignatures: showSignatures ?? reportConfig.showSignatures,
                structureId: Number(structureId),
                jobPackId: Number(jobPackId)
            }
        ) as Blob;
    };

    const fetchDivingAnodeRecords = async () => {
        const { data, error } = await supabase.from('insp_records').select(`
            *,
            inspection_type:inspection_type_id!left(id, code, name),
            structure_components:component_id!left(id, q_id, code, metadata),
            insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
            insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
            insp_anomalies(*)
        `)
        .eq('structure_id', Number(structureId))
        .eq('jobpack_id', Number(jobPackId));

        if (error) {
            console.error("Error fetching Diving Anode records:", error);
            return [];
        }

        const filtered = (data || []).filter((r: any) => {
            const isPL_AN = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'PL_AN';
            const sowMatches = !headerData?.sowReportNo || String(r.sow_report_no || '').toLowerCase().includes(headerData.sowReportNo.toLowerCase());
            return isPL_AN && sowMatches;
        });

        filtered.sort((a: any, b: any) => {
            const diveA = String(a.insp_dive_jobs?.job_no || a.insp_dive_jobs?.name || a.dive_job_id || '');
            const diveB = String(b.insp_dive_jobs?.job_no || b.insp_dive_jobs?.name || b.dive_job_id || '');
            return diveA.localeCompare(diveB, undefined, { numeric: true });
        });

        return filtered;
    };

    const generateDivingAnodeReport_ws = async () => {
        const records = await fetchDivingAnodeRecords();
        if (records.length === 0) {
            toast.error("No Diving Selected Anode (PL_AN) records found for this SOW/Jobpack");
            return;
        }
        setDivingAnodePreviewOpen(true);
    };

    const generateDivingAnodeReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = await fetchDivingAnodeRecords();
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }

        return await generateDivingAnodeReport(
            records, 
            { ...headerData, contractorLogoUrl }, 
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, 
            { 
                returnBlob: true, 
                printFriendly, 
                showSignatures: showSignatures ?? reportConfig.showSignatures,
                structureId: Number(structureId),
                jobPackId: Number(jobPackId)
            },
            supabase
        ) as Blob;
    };

    const generateRCASNReport = async () => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || "").toUpperCase();
            return typeCode === 'RCASN' || compCode === 'CS';
        });
        if (records.length === 0) {
            toast.error("No Caisson records found to generate report");
            return;
        }
        setRcasnPreviewOpen(true);
    };

    const generateRCASNReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || "").toUpperCase();
            return typeCode === 'RCASN' || compCode === 'CS';
        });
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateROVCasnReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId) }) as Blob;
    };

    const generateRCASNSketchReport = async () => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || "").toUpperCase();
            return typeCode === 'RCASN' || compCode === 'CS';
        });
        if (records.length === 0) {
            toast.error("No Caisson records found to generate report");
            return;
        }
        setRcasnSketchPreviewOpen(true);
    };

    const generateRCASNSketchReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || "").toUpperCase();
            return typeCode === 'RCASN' || compCode === 'CS';
        });
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateROVCasnSketchReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId) }) as Blob;
    };

    const generateRCONDReport = async () => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || "").toUpperCase();
            return ['RCOND', 'RCON'].includes(typeCode) || ['CD', 'CON'].includes(compCode);
        });
        if (records.length === 0) {
            toast.error("No Conductor records found to generate report");
            return;
        }
        setRcondPreviewOpen(true);
    };

    const generateRCONDReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || "").toUpperCase();
            return ['RCOND', 'RCON'].includes(typeCode) || ['CD', 'CON'].includes(compCode);
        });
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateROVCondReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId) }) as Blob;
    };

    const generateRCONDSketchReport = async () => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || "").toUpperCase();
            return ['RCOND', 'RCON'].includes(typeCode) || ['CD', 'CON'].includes(compCode);
        });
        if (records.length === 0) {
            toast.error("No Conductor records found to generate report");
            return;
        }
        setRcondSketchPreviewOpen(true);
    };

    const generateRCONDSketchReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || "").toUpperCase();
            return ['RCOND', 'RCON'].includes(typeCode) || ['CD', 'CON'].includes(compCode);
        });
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateROVCondSketchReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId) }) as Blob;
    };

    const generatePipelineEventSketchReportHandler = async () => {
        setPipelineEventSketchPreviewOpen(true);
    };

    const generatePipelineEventSketchReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const settings = await getReportHeaderData();
        const { data: jobPackData } = await supabase.from('jobpack').select('*, metadata').eq('id', Number(jobPackId)).maybeSingle();
        let contractorLogoUrl = '';
        if (jobPackData?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPackData?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        const { data: structData } = await supabase.from('structure').select('*').eq('id', Number(structureId)).maybeSingle();

        return await generatePipelineEventSketchReport(
            jobPackData || { id: Number(jobPackId) },
            structData || { id: Number(structureId), str_name: headerData?.platformName },
            headerData?.sowReportNo || 'N/A',
            { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
            {
                returnBlob: true,
                printFriendly,
                showSignatures: showSignatures ?? reportConfig.showSignatures,
                structureId: Number(structureId),
                jobPackId: Number(jobPackId),
                sowReportNo: headerData?.sowReportNo,
                headerData: { ...headerData, contractorLogoUrl },
                preparedBy: reportConfig.preparedBy,
                reviewedBy: reportConfig.reviewedBy,
                approvedBy: reportConfig.approvedBy
            },
            currentRecords
        ) as Blob;
    };



    const generatePhotographyReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }

        // 1. Get database attachments for currently filtered records
        const inspIds = currentRecords.map(r => r.insp_id).filter(Boolean);
        let dbAttachments: any[] = [];
        
        if (inspIds.length > 0) {
            const { data } = await supabase
                .from('attachment')
                .select('*')
                .in('source_id', inspIds)
                .in('source_type', ['inspection', 'INSPECTION'])
                .is('is_deleted', false);
            dbAttachments = data || [];
        }

        // 2. Map DB attachments to match report format
        const photosFromDb = dbAttachments.filter(a => !a.type || a.type === 'PHOTO');

        // 3. Include Pending Attachments (local state)
        // Only include those that are marked as 'PHOTO'
        const photosFromPending = pendingAttachments
            .filter(a => a.type === 'PHOTO' || !a.type)
            .map(a => ({
                ...a,
                path: a.path || a.previewUrl // Generator uses path, but pending might only have previewUrl/blob
            }));

        const allPhotos = [...photosFromDb, ...photosFromPending];

        // Ensure we always return a Blob (even if empty) to avoid "Preview unavailable"
        return await generateROVPhotographyReport(allPhotos, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures }) as Blob;
    };

    const generatePhotographyLogReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }

        const inspIds = currentRecords.map(r => r.insp_id).filter(Boolean);
        let dbAttachments: any[] = [];
        if (inspIds.length > 0) {
            const { data } = await supabase
                .from('attachment')
                .select('*')
                .in('source_id', inspIds)
                .in('source_type', ['inspection', 'INSPECTION'])
                .is('is_deleted', false);
            dbAttachments = data || [];
        }

        const allPhotos = [...dbAttachments, ...pendingAttachments];

        return await generateROVPhotographyLogReport(allPhotos, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? reportConfig.showSignatures }) as Blob;
    };

    const generatePhotographyReport = async () => {
        setPhotographyPreviewOpen(true);
    };

    const generatePhotographyLogReport = async () => {
        setPhotographyLogPreviewOpen(true);
    };

    const generateDivingItemReportAction = async () => {
        setDivingItemReportPreviewOpen(true);
    };

    const generateDivingItemReportBlob = async (printFriendly?: boolean, showSignatures?: boolean) => {
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateDivingItemReportTemplate(currentRecords, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { ...reportConfig, printFriendly, returnBlob: true, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId), sowReportNo: headerData.sowReportNo } as any) as Blob;
    };

    const generateDivingITMAINReportAction = async () => {
        setDivingItmainReportPreviewOpen(true);
    };

    const generateDivingITMAINReportBlob = async (printFriendly?: boolean, showSignatures?: boolean) => {
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }
        return await generateDivingITMAINReportTemplate(currentRecords, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { ...reportConfig, printFriendly, returnBlob: true, showSignatures: showSignatures ?? reportConfig.showSignatures, structureId: Number(structureId), sowReportNo: headerData.sowReportNo } as any) as Blob;
    };

    const generateInspectionReportByType = async (typeId: number) => {
        const type = allInspectionTypes.find(t => t.id === typeId);
        const typeCode = (type?.code || "").toUpperCase();

        // Specialized Interception
        if (typeCode === 'RG' || typeCode === 'RISERGUARD') {
            await generateRGReport();
            return;
        }
        if (typeCode === 'SG' || typeCode === 'CAISSONGUARD') {
            await generateSGReport();
            return;
        }
        if (typeCode === 'CU' || typeCode === 'CONDUCTORGUARD') {
            await generateCUReport();
            return;
        }
        if (typeCode === 'BL' || typeCode === 'BOATLANDING') {
            await generateBLReport();
            return;
        }
        if (typeCode === 'RMGI') {
            await generateRMGIReport();
            return;
        }
        if (typeCode === 'MGI') {
            await generateMGIReport();
            return;
        }
        if (typeCode === 'RFMD' || typeCode === 'FMD') {
            await generateFMDReport();
            return;
        }
        if (typeCode === 'RUTWT' || typeCode === 'UTWT' || typeCode === 'UTWTK') {
            await generateUTWTReport();
            return;
        }
        if (typeCode === 'RSCOR' || typeCode === 'SCOUR') {
            await generateRSCORReport();
            return;
        }
        if (typeCode === 'RRISI' || typeCode === 'RISER') {
            await generateRRISIReport();
            return;
        }
        if (typeCode === 'JTISI' || typeCode === 'JTUBE') {
            await generateJTISIReport();
            return;
        }
        if (typeCode === 'ITISI' || typeCode === 'ITUBE') {
            await generateITISIReport();
            return;
        }
        if (typeCode === 'RGVI') {
            await generateRGVIReport();
            return;
        }
        if (typeCode === 'ANODE' || typeCode === 'ANOD') {
            await generateAnodeReport();
            return;
        }
        if (typeCode === 'CP') {
            await generateCPReport();
            return;
        }
        if (typeCode === 'RSWNI' || typeCode === 'SWNI') {
            await generateRSWNIReport();
            return;
        }
        if (typeCode === 'RCASN' || typeCode === 'CAISSON') {
            await generateRCASNReport();
            return;
        }
        if (typeCode === 'RCOND' || typeCode === 'RCON' || typeCode === 'CONDUCTOR') {
            await generateRCONDReport();
            return;
        }
        if (typeCode === 'RSZCI' || typeCode === 'SZCI') {
            await generateSZCIReport();
            return;
        }
        if (typeCode === 'ACFMC') {
            await generateDivingACFMCReport();
            return;
        }
        if (typeCode === 'PL_CO') {
            await generateDivingPLCOReport();
            return;
        }
        if (typeCode === 'PL_IC' || typeCode === 'ITEM') {
            await generateDivingItemReportAction();
            return;
        }
        if (typeCode === 'ITMAIN') {
            await generateDivingITMAINReportAction();
            return;
        }
        if (typeCode === 'RWDI') {
            await generateROVRWDIReport();
            return;
        }
        if (typeCode === 'SZONE' || typeCode === 'SZ') {
            await generateSZONEReport();
            return;
        }
        if (typeCode === 'SEABED') {
            await generateSeabedReport();
            return;
        }
        if (typeCode === 'PL_AN') {
            setDivingAnodePreviewOpen(true);
            return;
        }
        if (typeCode === 'MGROW') {
            setDivingMgiPreviewOpen(true);
            return;
        }

        const recordsToPrint = currentRecords.filter(r => r.inspection_type_id === typeId || r.inspection_type?.id === typeId);
        if (recordsToPrint.length === 0) {
            toast.error("No records found for this inspection type");
            return;
        }

        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }

        await generateMultiInspectionReport(
            recordsToPrint.map(r => r.insp_id),
            { company_name: settings.companyName, logo_url: settings.companyLogo },
            {
                reportNoPrefix: type?.code || "REPORT",
                reportYear: new Date().getFullYear().toString(),
                preparedBy: { name: "Inspector", date: new Date().toLocaleDateString() },
                reviewedBy: { name: "", date: "" },
                approvedBy: { name: "", date: "" },
                watermark: { enabled: false, text: "", transparency: 0.1 },
                showContractorLogo: true,
                contractorLogoUrl,
                showPageNumbers: true,
                printFriendly: false
            }
        );
    };

    const generateFullInspectionReport = async () => {
        if (currentRecords.length === 0) {
            toast.error("No records captured to generate report");
            return;
        }

        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.logo_url || '';
        }

        await generateMultiInspectionReport(
            currentRecords.map(r => r.insp_id),
            { company_name: settings.companyName, logo_url: settings.companyLogo },
            {
                reportNoPrefix: "FULL_INSPECTION",
                reportYear: new Date().getFullYear().toString(),
                preparedBy: { name: "Inspector", date: new Date().toLocaleDateString() },
                reviewedBy: { name: "", date: "" },
                approvedBy: { name: "", date: "" },
                watermark: { enabled: false, text: "", transparency: 0.1 },
                showContractorLogo: true,
                contractorLogoUrl,
                showPageNumbers: true,
                printFriendly: false
            }
        );
    };

    const outputs = {
        previewOpen, setPreviewOpen,
        mPreviewOpen, setMPreviewOpen,
        fmdPreviewOpen, setFmdPreviewOpen,
        szciPreviewOpen, setSzciPreviewOpen,
        utwtPreviewOpen, setUtwtPreviewOpen,
        rscorPreviewOpen, setRscorPreviewOpen,
        rscorV2PreviewOpen, setRscorV2PreviewOpen,
        rrisiPreviewOpen, setRrisiPreviewOpen,
        rrisiDetailPreviewOpen, setRrisiDetailPreviewOpen,
        jtisiPreviewOpen, setJtisiPreviewOpen,
        jtisiDetailPreviewOpen, setJtisiDetailPreviewOpen,
        itisiPreviewOpen, setItisiPreviewOpen,
        itisiDetailPreviewOpen, setItisiDetailPreviewOpen,
        anodePreviewOpen, setAnodePreviewOpen,
        anodeRsaniPreviewOpen, setAnodeRsaniPreviewOpen,
        cpPreviewOpen, setCpPreviewOpen,
        rswniPreviewOpen, setRswniPreviewOpen,
        rovRicmiPreviewOpen, setRovRicmiPreviewOpen,
        divingAnmainPreviewOpen, setDivingAnmainPreviewOpen,
        rgviPreviewOpen, setRgviPreviewOpen,
        rcasnPreviewOpen, setRcasnPreviewOpen,
        rcasnSketchPreviewOpen, setRcasnSketchPreviewOpen,
        rcondPreviewOpen, setRcondPreviewOpen,
        rcondSketchPreviewOpen, setRcondSketchPreviewOpen,
        blPreviewOpen, setBlPreviewOpen,
        rgPreviewOpen, setRgPreviewOpen,
        sgPreviewOpen, setSgPreviewOpen,
        cuPreviewOpen, setCuPreviewOpen,
        seabedPreviewOpen, setSeabedPreviewOpen,
        seabedDetailPreviewOpen, setSeabedDetailPreviewOpen,
        photographyPreviewOpen, setPhotographyPreviewOpen,
        photographyLogPreviewOpen, setPhotographyLogPreviewOpen,
        gvinsPreviewOpen, setGvinsPreviewOpen,
        divingAcfmcPreviewOpen, setDivingAcfmcPreviewOpen,
        divingPlcoPreviewOpen, setDivingPlcoPreviewOpen,
        rovRwdiPreviewOpen, setRovRwdiPreviewOpen,
        bsinsPreviewOpen, setBsinsPreviewOpen,
        cvinsPreviewOpen, setCvinsPreviewOpen,
        cleanPreviewOpen, setCleanPreviewOpen,
        mpinsPreviewOpen, setMpinsPreviewOpen,
        szonePreviewOpen, setSzonePreviewOpen,
        cpclbPreviewOpen, setCpclbPreviewOpen,
        utclbPreviewOpen, setUtclbPreviewOpen,
        divingAnodePreviewOpen, setDivingAnodePreviewOpen,
        divingDcasnUwPreviewOpen, setDivingDcasnUwPreviewOpen,
        divingDcasnTsPreviewOpen, setDivingDcasnTsPreviewOpen,
        divingDcondUwPreviewOpen, setDivingDcondUwPreviewOpen,
        divingDcondTsPreviewOpen, setDivingDcondTsPreviewOpen,
        divingRrisiPreviewOpen, setDivingRrisiPreviewOpen,
        divingRrisiDetailPreviewOpen, setDivingRrisiDetailPreviewOpen,
        divingJtisiPreviewOpen, setDivingJtisiPreviewOpen,
        divingJtisiDetailPreviewOpen, setDivingJtisiDetailPreviewOpen,
        divingItisiPreviewOpen, setDivingItisiPreviewOpen,
        divingItisiDetailPreviewOpen, setDivingItisiDetailPreviewOpen,
        divingItemReportPreviewOpen, setDivingItemReportPreviewOpen,
        divingItmainReportPreviewOpen, setDivingItmainReportPreviewOpen,

        seabedTemplateType, setSeabedTemplateType,
        previewRecord, setPreviewRecord,
        generateAnomalyReportBlob,
        generateMGIReport,
        generateMGIReportBlob,
        generateRMGIReport,
        generateRMGIReportBlob,
        rmgiPreviewOpen, setRmgiPreviewOpen,
        generateFMDReport,
        generateFMDReportBlob,
        generateSZCIReport,
        generateSZCIReportBlob,
        generateUTWTReport,
        generateUTWTReportBlob,
        generateRGReport,
        generateRGReportBlob,
        generateSGReport,
        generateSGReportBlob,
        generateCUReport,
        generateCUReportBlob,
        generateBLReport,
        generateBLReportBlob,
        generateRSCORReport,
        generateRSCORReportBlob,
        generateRSCORV2Report,
        generateRSCORV2ReportBlob,
        generateRRISIReport,
        generateRRISIReportBlob,
        generateRRISIDetailReport,
        generateRRISIDetailReportBlob,
        generateJTISIReport,
        generateJTISIReportBlob,
        generateJTISIDetailReport,
        generateJTISIDetailReportBlob,
        generateITISIReport,
        generateITISIReportBlob,
        generateITISIDetailReport,
        generateITISIDetailReportBlob,
        generateDivingRRISIReport,
        generateDivingRRISIReportBlob,
        generateDivingRRISIDetailReport,
        generateDivingRRISIDetailReportBlob,
        generateDivingJTISIReport,
        generateDivingJTISIReportBlob,
        generateDivingJTISIDetailReport,
        generateDivingJTISIDetailReportBlob,
        generateDivingITISIReport,
        generateDivingITISIReportBlob,
        generateDivingITISIDetailReport,
        generateDivingITISIDetailReportBlob,
        generateAnodeReport,
        generateAnodeReportBlob,
        generateAnodeRsaniReport,
        generateAnodeRsaniReportBlob,
        generateCPReport,
        generateCPReportBlob,
        generateRSWNIReport,
        generateRSWNIReportBlob,
        generateROVRICMIReport: generateROVRICMIReportAction,
        generateROVRICMIReportBlob,
        generateDivingANMAINReport: generateDivingANMAINReportAction,
        generateDivingANMAINReportBlob,
        generateDivingItemReport: generateDivingItemReportAction,
        generateDivingItemReportBlob,
        generateDivingITMAINReport: generateDivingITMAINReportAction,
        generateDivingITMAINReportBlob,
        generateRGVIReport,
        generateRGVIReportBlob,
        generateRCASNReport,
        generateRCASNReportBlob,
        generateRCASNSketchReport,
        generateRCASNSketchReportBlob,
        generateRCONDReport,
        generateRCONDReportBlob,
        generateRCONDSketchReport,
        generateRCONDSketchReportBlob,
        generateSeabedReport,
        generateSeabedReportBlob,
        generateSeabedDetailReport,
        generateSeabedDetailReportBlob,
        generateSeabedGasDetailReport,
        generateSeabedGasDetailReportBlob,
        seabedGasDetailPreviewOpen, setSeabedGasDetailPreviewOpen,
        generateSeabedCraterDetailReport,
        generateSeabedCraterDetailReportBlob,
        seabedCraterDetailPreviewOpen, setSeabedCraterDetailPreviewOpen,
        generatePhotographyReport,
        generatePhotographyReportBlob,
        generatePhotographyLogReport,
        generatePhotographyLogReportBlob,
        generateGVINSReport,
        generateGVINSReportBlob,
        generateDivingDCASNUWReport: async () => {
            const settings = await getReportHeaderData();
            const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
            let contractorLogoUrl = '';
            if (jobPack?.metadata?.contrac) {
                const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
                contractorLogoUrl = contrData?.logo_url || '';
            }
            await generateDivingDCASNUWReportTemplate(currentRecords, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { ...reportConfig, structureId: Number(structureId), sowReportNo: headerData.sowReportNo } as any);
        },
        generateDivingDCASNUWReportBlob: async (printFriendly?: boolean) => {
            const settings = await getReportHeaderData();
            const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
            let contractorLogoUrl = '';
            if (jobPack?.metadata?.contrac) {
                const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
                contractorLogoUrl = contrData?.logo_url || '';
            }
            return await generateDivingDCASNUWReportTemplate(currentRecords, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { ...reportConfig, printFriendly, returnBlob: true, structureId: Number(structureId), sowReportNo: headerData.sowReportNo } as any) as Blob;
        },
        generateDivingDCASNTSReport: async () => {
            const settings = await getReportHeaderData();
            const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
            let contractorLogoUrl = '';
            if (jobPack?.metadata?.contrac) {
                const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
                contractorLogoUrl = contrData?.logo_url || '';
            }
            await generateDivingDCASNTSReportTemplate(currentRecords, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { ...reportConfig, structureId: Number(structureId), sowReportNo: headerData.sowReportNo } as any);
        },
        generateDivingDCASNTSReportBlob: async (printFriendly?: boolean) => {
            const settings = await getReportHeaderData();
            const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
            let contractorLogoUrl = '';
            if (jobPack?.metadata?.contrac) {
                const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
                contractorLogoUrl = contrData?.logo_url || '';
            }
            return await generateDivingDCASNTSReportTemplate(currentRecords, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { ...reportConfig, printFriendly, returnBlob: true, structureId: Number(structureId), sowReportNo: headerData.sowReportNo } as any) as Blob;
        },
        generateDivingDCASNReport: async () => {
            const settings = await getReportHeaderData();
            const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
            let contractorLogoUrl = '';
            if (jobPack?.metadata?.contrac) {
                const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
                contractorLogoUrl = contrData?.logo_url || '';
            }
            await generateDivingDCASNReportTemplate(currentRecords, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { ...reportConfig, structureId: Number(structureId), sowReportNo: headerData.sowReportNo } as any);
        },
        generateDivingDCASNReportBlob: async (printFriendly?: boolean) => {
            const settings = await getReportHeaderData();
            const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
            let contractorLogoUrl = '';
            if (jobPack?.metadata?.contrac) {
                const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
                contractorLogoUrl = contrData?.logo_url || '';
            }
            return await generateDivingDCASNReportTemplate(
                currentRecords,
                { ...headerData, contractorLogoUrl },
                { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
                { ...reportConfig, printFriendly, returnBlob: true, structureId: Number(structureId), sowReportNo: headerData.sowReportNo } as any
            ) as Blob;
        },
        generateDivingDCONDUWReport: async () => {
            const settings = await getReportHeaderData();
            const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
            let contractorLogoUrl = '';
            if (jobPack?.metadata?.contrac) {
                const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
                contractorLogoUrl = contrData?.logo_url || '';
            }
            await generateDivingDCONDUWReportTemplate(currentRecords, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { ...reportConfig, structureId: Number(structureId), sowReportNo: headerData.sowReportNo } as any);
        },
        generateDivingDCONDUWReportBlob: async (printFriendly?: boolean) => {
            const settings = await getReportHeaderData();
            const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
            let contractorLogoUrl = '';
            if (jobPack?.metadata?.contrac) {
                const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
                contractorLogoUrl = contrData?.logo_url || '';
            }
            return await generateDivingDCONDUWReportTemplate(currentRecords, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { ...reportConfig, printFriendly, returnBlob: true, structureId: Number(structureId), sowReportNo: headerData.sowReportNo } as any) as Blob;
        },
        generateDivingDCONDTSReport: async () => {
            const settings = await getReportHeaderData();
            const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
            let contractorLogoUrl = '';
            if (jobPack?.metadata?.contrac) {
                const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
                contractorLogoUrl = contrData?.logo_url || '';
            }
            await generateDivingDCONDTSReportTemplate(currentRecords, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { ...reportConfig, structureId: Number(structureId), sowReportNo: headerData.sowReportNo } as any);
        },
        generateDivingDCONDTSReportBlob: async (printFriendly?: boolean) => {
            const settings = await getReportHeaderData();
            const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
            let contractorLogoUrl = '';
            if (jobPack?.metadata?.contrac) {
                const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
                contractorLogoUrl = contrData?.logo_url || '';
            }
            return await generateDivingDCONDTSReportTemplate(currentRecords, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { ...reportConfig, printFriendly, returnBlob: true, structureId: Number(structureId), sowReportNo: headerData.sowReportNo } as any) as Blob;
        },
        generateDivingDCONDReport: async () => {
            const settings = await getReportHeaderData();
            const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
            let contractorLogoUrl = '';
            if (jobPack?.metadata?.contrac) {
                const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
                contractorLogoUrl = contrData?.logo_url || '';
            }
            await generateDivingDCONDReportTemplate(
                currentRecords,
                { ...headerData, contractorLogoUrl },
                { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
                { ...reportConfig, structureId: Number(structureId), sowReportNo: headerData.sowReportNo } as any
            );
        },
        generateDivingDCONDReportBlob: async (printFriendly?: boolean) => {
            const settings = await getReportHeaderData();
            const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
            let contractorLogoUrl = '';
            if (jobPack?.metadata?.contrac) {
                const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
                contractorLogoUrl = contrData?.logo_url || '';
            }
            return await generateDivingDCONDReportTemplate(
                currentRecords,
                { ...headerData, contractorLogoUrl },
                { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
                { ...reportConfig, printFriendly, returnBlob: true, structureId: Number(structureId), sowReportNo: headerData.sowReportNo } as any
            ) as Blob;
        },
        divingFmdPreviewOpen, setDivingFmdPreviewOpen,
        generateDivingFMDReport: async () => {
            const fmdRecords = currentRecords.filter(r => ['FLOOD', 'FMD', 'DFMD'].includes((r.inspection_type_code || r.inspection_type?.code || '').toUpperCase()));
            if (fmdRecords.length === 0) {
                toast.error("No Flooded Member (Diving) records found to generate report");
                return;
            }
            setDivingFmdPreviewOpen(true);
        },
        generateDivingFMDReportBlob: async (printFriendly?: boolean) => {
            const fmdRecords = currentRecords.filter(r => ['FLOOD', 'FMD', 'DFMD'].includes((r.inspection_type_code || r.inspection_type?.code || '').toUpperCase()));
            const settings = await getReportHeaderData();
            const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
            let contractorLogoUrl = '';
            if (jobPack?.metadata?.contrac) {
                const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
                contractorLogoUrl = contrData?.logo_url || '';
            }
            return await generateDivingFMDReport(
                fmdRecords,
                { ...headerData, contractorLogoUrl },
                { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
                { ...reportConfig, printFriendly, returnBlob: true, structureId: Number(structureId), sowReportNo: headerData.sowReportNo } as any
            ) as Blob;
        },
        divingMeasuPreviewOpen, setDivingMeasuPreviewOpen,
        generateDivingMEASUReport: async () => {
            const measuRecords = currentRecords.filter(r => ['MEASU', 'DMSR', 'MEASUREMENT', 'DMEAS'].includes((r.inspection_type_code || r.inspection_type?.code || '').toUpperCase()));
            if (measuRecords.length === 0) {
                toast.error("No Measurement Dimensional (Diving) records found to generate report");
                return;
            }
            setDivingMeasuPreviewOpen(true);
        },
        generateDivingMEASUReportBlob: async (printFriendly?: boolean) => {
            const measuRecords = currentRecords.filter(r => ['MEASU', 'DMSR', 'MEASUREMENT', 'DMEAS'].includes((r.inspection_type_code || r.inspection_type?.code || '').toUpperCase()));
            const settings = await getReportHeaderData();
            const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
            let contractorLogoUrl = '';
            if (jobPack?.metadata?.contrac) {
                const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
                contractorLogoUrl = contrData?.logo_url || '';
            }
            return await generateDivingMEASUReport(
                measuRecords,
                { ...headerData, contractorLogoUrl },
                { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
                { ...reportConfig, printFriendly, returnBlob: true, structureId: Number(structureId), sowReportNo: headerData.sowReportNo } as any
            ) as Blob;
        },
        generateDivingACFMCReport,
        generateDivingACFMCReportBlob,
        generateDivingPLCOReport,
        generateDivingPLCOReportBlob,
        generateROVRWDIReport,
        generateROVRWDIReportBlob,
        generateBSINSReport,
        generateBSINSReportBlob,
        generateCVINSReport,
        generateCVINSReportBlob,
        generateCLEANReport,
        generateCLEANReportBlob,
        generateMPINSReport,
        generateMPINSReportBlob,
        generateUTWTKReport,
        generateUTWTKReportBlob,
        generateJobPackSummaryReportBlob: async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
            const settings = await getReportHeaderData();
            const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).maybeSingle();
            let contractorLogoUrl = '';
            if (jobPack?.metadata?.contrac) {
                const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
                contractorLogoUrl = contrData?.logo_url || '';
            }

            // Fetch live inspection summary data for this SOW report
            const params = new URLSearchParams();
            if (structureId) params.set("structure_id", structureId);
            if (jobPackId) params.set("jobpack_id", jobPackId);
            if (headerData.sowReportNo && headerData.sowReportNo !== "N/A") params.set("sow_report_no", headerData.sowReportNo);

            const res = await fetch(`/api/inspection-summary?${params.toString()}`);
            const json = await res.json();
            const summaryData = json.data || {};

            const { generatePlatformInspectionSummaryReport } = await import("@/utils/report-generators/platform-inspection-summary-report");
            return await generatePlatformInspectionSummaryReport(
                summaryData,
                { ...headerData, contractorLogoUrl },
                { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
                { returnBlob: true, printFriendly, sowReportNo: headerData.sowReportNo, showSignatures: showSignatures ?? reportConfig.showSignatures } as any
            ) as Blob;
        },
        generateSZONEReport,
        generateSZONEReportBlob,
        generateCPCLBReport,
        generateCPCLBReportBlob,
        generateUTCLBReport,
        generateUTCLBReportBlob,
        generateDivingAnodeReportBlob,
        divingMgiPreviewOpen, setDivingMgiPreviewOpen,
        generateDivingMGIReport: async (printFriendly?: boolean) => {
            const settings = await getReportHeaderData();
            const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
            let contractorLogoUrl = '';
            if (jobPack?.metadata?.contrac) {
                const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
                contractorLogoUrl = contrData?.logo_url || '';
            }

            const mgiRecords = currentRecords.filter(r => {
                const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                return code === 'MGROW' || code === 'RMGI' || code === 'DMGI';
            });
            const profileId = mgiRecords.find(r => r.inspection_data?._mgi_profile_id)?.inspection_data?._mgi_profile_id;
            const profile = await getMGIProfileForJobpack(supabase, jobPackId, profileId);

            return await generateDivingMGIReport(
                mgiRecords,
                profile,
                { ...headerData, contractorLogoUrl, waterDepth: headerData.waterDepth || 0 },
                { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
                { printFriendly: printFriendly || false, sowReportNo: headerData.sowReportNo, structureId: Number(structureId), jobPackId: Number(jobPackId), returnBlob: false },
                supabase
            );
        },
        generateDivingMGIReportBlob: async (printFriendly?: boolean) => {
            const settings = await getReportHeaderData();
            const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
            let contractorLogoUrl = '';
            if (jobPack?.metadata?.contrac) {
                const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
                contractorLogoUrl = contrData?.logo_url || '';
            }

            const mgiRecords = currentRecords.filter(r => {
                const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                return code === 'MGROW' || code === 'RMGI' || code === 'DMGI';
            });
            const profileId = mgiRecords.find(r => r.inspection_data?._mgi_profile_id)?.inspection_data?._mgi_profile_id;
            const profile = await getMGIProfileForJobpack(supabase, jobPackId, profileId);

            return await generateDivingMGIReport(
                mgiRecords,
                profile,
                { ...headerData, contractorLogoUrl, waterDepth: headerData.waterDepth || 0 },
                { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
                { printFriendly: printFriendly || false, sowReportNo: headerData.sowReportNo, structureId: Number(structureId), jobPackId: Number(jobPackId), returnBlob: true },
                supabase
            );
        },
        pipelineEventSketchPreviewOpen,
        setPipelineEventSketchPreviewOpen,
        generatePipelineEventSketchReport: async () => {
            setPipelineEventSketchPreviewOpen(true);
        },
        generatePipelineEventSketchReportBlob: async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
            const settings = await getReportHeaderData();
            const { data: jobPack } = await supabase.from('jobpack').select('metadata, name').eq('id', Number(jobPackId)).maybeSingle();
            let contractorLogoUrl = '';
            if (jobPack?.metadata?.contrac) {
                const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac).maybeSingle();
                contractorLogoUrl = contrData?.logo_url || '';
            }

            const { data: structData } = await supabase.from('u_pipegeo').select('*').eq('structure_id', Number(structureId)).maybeSingle();

            return await generatePipelineEventSketchReport(
                jobPack || { name: headerData.jobpackName },
                structData || { str_name: headerData.platformName },
                headerData.sowReportNo,
                { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
                {
                    ...reportConfig,
                    printFriendly: printFriendly || false,
                    showSignatures: showSignatures ?? reportConfig.showSignatures,
                    returnBlob: true,
                    structureId: Number(structureId),
                    sowReportNo: headerData.sowReportNo,
                    headerData: {
                        date: new Date().toLocaleDateString('en-GB'),
                        jobpackName: headerData.jobpackName,
                        sowReportNo: headerData.sowReportNo,
                        platformName: headerData.platformName,
                        contractorLogoUrl,
                        vessel: headerData.vessel
                    }
                },
                currentRecords
            ) as Blob;
        },
        generateInspectionReportByType,
        generateFullInspectionReport,
        reportConfig,
        setReportConfig
    };

    // Intercept and wrap blob-generating helper functions
    const wrappedOutputs: any = { ...outputs };
    Object.keys(wrappedOutputs).forEach((key) => {
        if (key.endsWith("Blob") && typeof wrappedOutputs[key] === "function") {
            const originalFn = wrappedOutputs[key];
            wrappedOutputs[key] = async function (printFriendly?: boolean, showSignatures?: boolean, ...args: any[]) {
                if (typeof window !== "undefined") {
                    const currentConfig = (window as any).__reportConfig || reportConfig;
                    (window as any).__reportConfig = {
                        ...currentConfig,
                        printFriendly: printFriendly !== undefined ? printFriendly : currentConfig.printFriendly,
                        showSignatures: showSignatures !== undefined ? showSignatures : currentConfig.showSignatures,
                    };
                }
                return originalFn(printFriendly, showSignatures, ...args);
            };
        }
    });

    return wrappedOutputs;
}

