import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { getReportHeaderData } from "@/utils/company-settings";
import { generateDefectAnomalyReport } from "@/utils/report-generators/defect-anomaly-report";
import { generateMultiInspectionReport } from "@/utils/report-generators/multi-inspection-report";
import { generateROVMGIReport } from "@/utils/report-generators/rov-mgi-report";
import { generateROVFMDReport } from "@/utils/report-generators/rov-fmd-report";
import { generateROVSZCIReport } from "@/utils/report-generators/rov-szci-report";
import { generateROVUTWTReport } from "@/utils/report-generators/rov-utwt-report";
import { generateROVRSCORReport } from "@/utils/report-generators/rov-rscor-report";
import { generateROVRRISIReport } from "@/utils/report-generators/rov-rrisi-report";
import { generateROVAnodeReport } from "@/utils/report-generators/rov-anode-report";
import { generateROVCPReport } from "@/utils/report-generators/rov-cp-report";
import { generateROVRGVIReport } from "@/utils/report-generators/rov-rgvi-report";
import { generateROVCasnReport } from "@/utils/report-generators/rov-rcasn-report";
import { generateROVCasnSketchReport } from "@/utils/report-generators/rov-rcasn-sketch-report";
import { generateROVCondReport } from "@/utils/report-generators/rov-rcond-report";
import { generateROVCondSketchReport } from "@/utils/report-generators/rov-rcond-sketch-report";
import { generateROVBoatlandingReport } from "@/utils/report-generators/rov-boatlanding-report";
import { generateROVPhotographyReport } from "@/utils/report-generators/rov-photography-report";
import { generateROVPhotographyLogReport } from "@/utils/report-generators/rov-photography-log-report";
import { generateSeabedSurveyReport } from "@/utils/report-generators/seabed-survey-report";

export function useWorkspaceReports(
    supabase: any,
    jobPackId: string | null,
    structureId: string | null,
    headerData: any,
    currentRecords: any[],
    allInspectionTypes: any[]
) {
    const [previewOpen, setPreviewOpen] = useState(false);
    const [mPreviewOpen, setMPreviewOpen] = useState(false);
    const [fmdPreviewOpen, setFmdPreviewOpen] = useState(false);
    const [szciPreviewOpen, setSzciPreviewOpen] = useState(false);
    const [utwtPreviewOpen, setUtwtPreviewOpen] = useState(false);
    const [rscorPreviewOpen, setRscorPreviewOpen] = useState(false);
    const [rrisiPreviewOpen, setRrisiPreviewOpen] = useState(false);
    const [jtisiPreviewOpen, setJtisiPreviewOpen] = useState(false);
    const [itisiPreviewOpen, setItisiPreviewOpen] = useState(false);
    const [anodePreviewOpen, setAnodePreviewOpen] = useState(false);
    const [cpPreviewOpen, setCpPreviewOpen] = useState(false);
    const [rgviPreviewOpen, setRgviPreviewOpen] = useState(false);
    const [rcasnPreviewOpen, setRcasnPreviewOpen] = useState(false);
    const [rcasnSketchPreviewOpen, setRcasnSketchPreviewOpen] = useState(false);
    const [rcondPreviewOpen, setRcondPreviewOpen] = useState(false);
    const [rcondSketchPreviewOpen, setRcondSketchPreviewOpen] = useState(false);
    const [blPreviewOpen, setBlPreviewOpen] = useState(false);
    const [seabedPreviewOpen, setSeabedPreviewOpen] = useState(false);
    const [photographyPreviewOpen, setPhotographyPreviewOpen] = useState(false);
    const [photographyLogPreviewOpen, setPhotographyLogPreviewOpen] = useState(false);
    const [seabedTemplateType, setSeabedTemplateType] = useState<string>('seabed-survey-debris');
    const [previewRecord, setPreviewRecord] = useState<any>(null);

    const generateAnomalyReportBlob = async (printFriendly?: boolean) => {
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
                printFriendly: printFriendly || false
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

    const generateSeabedReport = async (templateId: string) => {
        const filterMap: Record<string, string> = {
            "seabed-survey-debris": "Debris",
            "seabed-survey-gas": "Gas Seepage",
            "seabed-survey-crater": "Crater"
        };
        
        const itemTypeFilter = filterMap[templateId] || "Debris";
        const recordsToPrint = currentRecords.filter(r => 
            (r.inspection_type_code === 'RSEAB' || r.inspection_type?.code === 'RSEAB') && 
            (r.inspection_data?.type === itemTypeFilter || (!r.inspection_data?.type && itemTypeFilter === "Debris"))
        );

        if (recordsToPrint.length === 0) {
            toast.error(`No ${itemTypeFilter} records found for Seabed Survey.`);
            return;
        }

        setSeabedTemplateType(templateId);
        setSeabedPreviewOpen(true);
    };

    const generateSeabedReportBlob = async (templateId: string, printFriendly?: boolean): Promise<Blob | void> => {
        const filterMap: Record<string, string> = {
            "seabed-survey-debris": "Debris",
            "seabed-survey-gas": "Gas Seepage",
            "seabed-survey-crater": "Crater"
        };
        
        const itemTypeFilter = filterMap[templateId] || "Debris";
        const recordsToPrint = currentRecords.filter(r => 
            (r.inspection_type_code === 'RSEAB' || r.inspection_type?.code === 'RSEAB') && 
            (r.inspection_data?.type === itemTypeFilter || (!r.inspection_data?.type && itemTypeFilter === "Debris"))
        );

        if (recordsToPrint.length === 0) return;

        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('*').eq('id', Number(jobPackId)).single();
        const { data: structure } = await supabase.from('structure').select('*').eq('str_id', Number(structureId)).single();

        if (!jobPack || !structure) return;

        return await generateSeabedSurveyReport(
            { ...jobPack, id: jobPack.id },
            { ...structure, id: structure.str_id },
            headerData.sowReportNo,
            { company_name: settings.companyName, logo_url: settings.companyLogo },
            {
                reportNoPrefix: "SEABED",
                reportYear: new Date().getFullYear().toString(),
                preparedBy: { name: "Inspector", date: new Date().toLocaleDateString() },
                showContractorLogo: true,
                showPageNumbers: true,
                printFriendly: printFriendly || false,
                returnBlob: true
            },
            itemTypeFilter
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

    const generateMGIReportBlob = async (): Promise<Blob | void> => {
        const mgiRecords = currentRecords.filter(r => r.inspection_type_code === 'RMGI' || r.inspection_type?.code === 'RMGI');
        if (mgiRecords.length === 0) return;

        const settings = await getReportHeaderData();
        
        let profile = null;
        const profileId = mgiRecords[0]?.inspection_data?._mgi_profile_id;
        if (profileId) {
            const { data } = await supabase.from('mgi_profiles').select('*').eq('id', profileId).maybeSingle();
            profile = data;
        }

        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
        }

        return (await generateROVMGIReport(
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
                returnBlob: true
            }
        )) as Blob;
    };

    const generateFMDReport = async () => {
        const fmdRecords = currentRecords.filter(r => r.inspection_type_code === 'RFMD' || r.inspection_type?.code === 'RFMD');
        if (fmdRecords.length === 0) {
            toast.error("No FMD records found to generate report");
            return;
        }
        setFmdPreviewOpen(true);
    };

    const generateFMDReportBlob = async (): Promise<Blob | void> => {
        const fmdRecords = currentRecords.filter(r => r.inspection_type_code === 'RFMD' || r.inspection_type?.code === 'RFMD');
        if (fmdRecords.length === 0) return;

        const settings = await getReportHeaderData();

        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
        }

        return (await generateROVFMDReport(
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
                returnBlob: true
            }
        )) as Blob;
    };

    const generateSZCIReport = async () => {
        const szciRecords = currentRecords.filter(r => r.inspection_type_code === 'RSZCI' || r.inspection_type?.code === 'RSZCI');
        if (szciRecords.length === 0) {
            toast.error("No Splash Zone records found to generate report");
            return;
        }
        setSzciPreviewOpen(true);
    };

    const generateSZCIReportBlob = async (): Promise<Blob | void> => {
        const szciRecords = currentRecords.filter(r => r.inspection_type_code === 'RSZCI' || r.inspection_type?.code === 'RSZCI');
        if (szciRecords.length === 0) return;

        const settings = await getReportHeaderData();
        
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
        }

        return (await generateROVSZCIReport(
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
                returnBlob: true
            }
        )) as Blob;
    };

    const generateUTWTReport = async () => {
        const utwtRecords = currentRecords.filter(r => r.inspection_type_code === 'RUTWT' || r.inspection_type?.code === 'RUTWT');
        if (utwtRecords.length === 0) {
            toast.error("No UTWT records found to generate report");
            return;
        }
        setUtwtPreviewOpen(true);
    };

    const generateUTWTReportBlob = async (): Promise<Blob | void> => {
        const utwtRecords = currentRecords.filter(r => r.inspection_type_code === 'RUTWT' || r.inspection_type?.code === 'RUTWT');
        if (utwtRecords.length === 0) return;

        const settings = await getReportHeaderData();
        
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
        }

        return (await generateROVUTWTReport(
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
                returnBlob: true
            }
        )) as Blob;
    };

    const generateInspectionReportByType = async (typeId: number) => {
        const recordsToPrint = currentRecords.filter(r => r.inspection_type_id === typeId || r.inspection_type?.id === typeId);
        if (recordsToPrint.length === 0) {
            toast.error("No records found for this inspection type");
            return;
        }

        const type = allInspectionTypes.find(t => t.id === typeId);
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
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
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
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

    return {
        previewOpen, setPreviewOpen,
        mPreviewOpen, setMPreviewOpen,
        fmdPreviewOpen, setFmdPreviewOpen,
        szciPreviewOpen, setSzciPreviewOpen,
        utwtPreviewOpen, setUtwtPreviewOpen,
        rscorPreviewOpen, setRscorPreviewOpen,
        rrisiPreviewOpen, setRrisiPreviewOpen,
        jtisiPreviewOpen, setJtisiPreviewOpen,
        itisiPreviewOpen, setItisiPreviewOpen,
        anodePreviewOpen, setAnodePreviewOpen,
        cpPreviewOpen, setCpPreviewOpen,
        rgviPreviewOpen, setRgviPreviewOpen,
        rcasnPreviewOpen, setRcasnPreviewOpen,
        rcasnSketchPreviewOpen, setRcasnSketchPreviewOpen,
        rcondPreviewOpen, setRcondPreviewOpen,
        rcondSketchPreviewOpen, setRcondSketchPreviewOpen,
        blPreviewOpen, setBlPreviewOpen,
        seabedPreviewOpen, setSeabedPreviewOpen,
        photographyPreviewOpen, setPhotographyPreviewOpen,
        photographyLogPreviewOpen, setPhotographyLogPreviewOpen,
        seabedTemplateType, setSeabedTemplateType,
        previewRecord, setPreviewRecord,
        generateAnomalyReportBlob,
        generateSeabedReport,
        generateSeabedReportBlob,
        generateMGIReport,
        generateMGIReportBlob,
        generateFMDReport,
        generateFMDReportBlob,
        generateSZCIReport,
        generateSZCIReportBlob,
        generateUTWTReport,
        generateUTWTReportBlob,
        generateInspectionReportByType,
        generateFullInspectionReport
    };
}
