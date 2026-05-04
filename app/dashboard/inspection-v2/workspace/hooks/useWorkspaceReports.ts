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
import { generateROVRiserGuardReport } from "@/utils/report-generators/rov-riser-guard-report";
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
    const [rgPreviewOpen, setRgPreviewOpen] = useState(false);
    const [seabedPreviewOpen, setSeabedPreviewOpen] = useState(false);
    const [photographyPreviewOpen, setPhotographyPreviewOpen] = useState(false);
    const [photographyLogPreviewOpen, setPhotographyLogPreviewOpen] = useState(false);
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
                showSignatures: showSignatures ?? true
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
            "seabed-survey-crater": "Crater"
        };
        
        const itemTypeFilter = filterMap[tid] || "Debris";
        const recordsToPrint = currentRecords.filter(r => 
            (r.inspection_type_code === 'RSEAB' || r.inspection_type?.code === 'RSEAB' || (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase() === 'SEABED') && 
            (r.inspection_data?.type === itemTypeFilter || (!r.inspection_data?.type && itemTypeFilter === "Debris"))
        );

        if (recordsToPrint.length === 0) {
            toast.error(`No ${itemTypeFilter} records found for Seabed Survey.`);
            return;
        }

        setSeabedTemplateType(tid);
        setSeabedPreviewOpen(true);
    };

    const generateSeabedReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const filterMap: Record<string, string> = {
            "seabed-survey-debris": "Debris",
            "seabed-survey-gas": "Gas Seepage",
            "seabed-survey-crater": "Crater"
        };
        
        const itemTypeFilter = filterMap[seabedTemplateType] || "Debris";
        const recordsToPrint = currentRecords.filter(r => 
            (r.inspection_type_code === 'RSEAB' || r.inspection_type?.code === 'RSEAB') && 
            (r.inspection_data?.type === itemTypeFilter || (!r.inspection_data?.type && itemTypeFilter === "Debris"))
        );

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
                showSignatures: showSignatures ?? true
            },
            itemTypeFilter
        );
        return result as Blob;
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

        const result = await generateROVMGIReport(
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
                showSignatures: showSignatures ?? true
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
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
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
                showSignatures: showSignatures ?? true
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
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
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
                showSignatures: showSignatures ?? true
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
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
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
                showSignatures: showSignatures ?? true
            }
        );
        return result as Blob;
    };

    const generateRGReport = async () => {
        const rgRecords = currentRecords.filter(r => {
            const qid = (r.structure_components?.q_id || r.component?.q_id || "").toUpperCase();
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
            return qid.startsWith("RG") || typeCode === "RG" || typeCode === "RISERGUARD" || compCode === "RG";
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
            return qid.startsWith("RG") || typeCode === "RG" || typeCode === "RISERGUARD" || compCode === "RG";
        });
        if (rgRecords.length === 0) return;

        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
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
                showSignatures: showSignatures ?? true
            }
        );
        return result as Blob;
    };

    const generateBLReport = async () => {
        const blRecords = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
            return typeCode === "BL" || compCode === "BL" || typeCode === "BOATLANDING";
        });
        if (blRecords.length === 0) {
            toast.error("No Boatlanding records found to generate report");
            return;
        }
        setBlPreviewOpen(true);
    };

    const generateBLReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const blRecords = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
            return typeCode === "BL" || compCode === "BL" || typeCode === "BOATLANDING";
        });
        if (blRecords.length === 0) return;

        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
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
                showSignatures: showSignatures ?? true
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
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
        }
        return await generateROVRSCORReport(rscorRecords, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? true, structureId: Number(structureId) }) as Blob;
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
        const records = currentRecords.filter(r => (r.structure_components?.q_id || "").toUpperCase().startsWith('R'));
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
        }
        return await generateROVRRISIReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? true, structureId: Number(structureId), reportType: 'R' }) as Blob;
    };

    const generateJTISIReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => (r.structure_components?.q_id || "").toUpperCase().startsWith('J'));
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
        }
        return await generateROVRRISIReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? true, structureId: Number(structureId), reportType: 'J' }) as Blob;
    };

    const generateITISIReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => (r.structure_components?.q_id || "").toUpperCase().startsWith('I'));
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
        }
        return await generateROVRRISIReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? true, structureId: Number(structureId), reportType: 'I' }) as Blob;
    };

    const generateAnodeReport = async () => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
            return typeCode === 'ANODE' || typeCode === 'ANOD' || compCode === 'AN';
        });
        if (records.length === 0) {
            toast.error("No Anode records found to generate report");
            return;
        }
        setAnodePreviewOpen(true);
    };

    const generateAnodeReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const records = currentRecords.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
            return typeCode === 'ANODE' || typeCode === 'ANOD' || compCode === 'AN';
        });
        if (records.length === 0) return;
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
        }
        return await generateROVAnodeReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? true }) as Blob;
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
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
        }
        return await generateROVCPReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? true }) as Blob;
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
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
        }
        return await generateROVRGVIReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? true }) as Blob;
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
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
        }
        return await generateROVCasnReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? true, structureId: Number(structureId) }) as Blob;
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
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
        }
        return await generateROVCasnSketchReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? true, structureId: Number(structureId) }) as Blob;
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
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
        }
        return await generateROVCondReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? true, structureId: Number(structureId) }) as Blob;
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
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
        }
        return await generateROVCondSketchReport(records, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? true, structureId: Number(structureId) }) as Blob;
    };



    const generatePhotographyReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
        }
        return await generateROVPhotographyReport(currentRecords, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? true }) as Blob;
    };

    const generatePhotographyLogReportBlob = async (printFriendly?: boolean, showSignatures?: boolean): Promise<Blob | void> => {
        const settings = await getReportHeaderData();
        const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
        let contractorLogoUrl = '';
        if (jobPack?.metadata?.contrac) {
            const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
            contractorLogoUrl = contrData?.lib_path || '';
        }
        return await generateROVPhotographyLogReport(currentRecords, { ...headerData, contractorLogoUrl }, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true, printFriendly, showSignatures: showSignatures ?? true }) as Blob;
    };

    const generatePhotographyReport = async () => {
        setPhotographyPreviewOpen(true);
    };

    const generatePhotographyLogReport = async () => {
        setPhotographyLogPreviewOpen(true);
    };

    const generateInspectionReportByType = async (typeId: number) => {
        const type = allInspectionTypes.find(t => t.id === typeId);
        const typeCode = (type?.code || "").toUpperCase();

        // Specialized Interception
        if (typeCode === 'RG' || typeCode === 'RISERGUARD') {
            await generateRGReport();
            return;
        }
        if (typeCode === 'BL' || typeCode === 'BOATLANDING') {
            await generateBLReport();
            return;
        }
        if (typeCode === 'RMGI' || typeCode === 'MGI') {
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
        if (typeCode === 'SEABED') {
            await generateSeabedReport();
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
        rgPreviewOpen, setRgPreviewOpen,
        seabedPreviewOpen, setSeabedPreviewOpen,
        photographyPreviewOpen, setPhotographyPreviewOpen,
        photographyLogPreviewOpen, setPhotographyLogPreviewOpen,
        seabedTemplateType, setSeabedTemplateType,
        previewRecord, setPreviewRecord,
        generateAnomalyReportBlob,
        generateMGIReport,
        generateMGIReportBlob,
        generateFMDReport,
        generateFMDReportBlob,
        generateSZCIReport,
        generateSZCIReportBlob,
        generateUTWTReport,
        generateUTWTReportBlob,
        generateRGReport,
        generateRGReportBlob,
        generateBLReport,
        generateBLReportBlob,
        generateRSCORReport,
        generateRSCORReportBlob,
        generateRRISIReport,
        generateRRISIReportBlob,
        generateJTISIReport,
        generateJTISIReportBlob,
        generateITISIReport,
        generateITISIReportBlob,
        generateAnodeReport,
        generateAnodeReportBlob,
        generateCPReport,
        generateCPReportBlob,
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
        generatePhotographyReport,
        generatePhotographyReportBlob,
        generatePhotographyLogReport,
        generatePhotographyLogReportBlob,
        generateInspectionReportByType,
        generateFullInspectionReport
    };
}
