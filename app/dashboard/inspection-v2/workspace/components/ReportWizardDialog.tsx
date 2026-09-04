"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Search, 
    X, 
    FileText, 
    Printer, 
    Check, 
    Activity, 
    Video, 
    Camera, 
    Grid3X3,
    Waves,
    Cpu,
    Layers,
    Calendar,
    FileCheck,
    ChevronRight,
    ChevronLeft,
    Settings2,
    Eye,
    EyeOff,
    Globe,
    List,
    LayoutGrid
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInspectionTypeName } from "@/utils/inspection-utils";

interface ReportTemplate {
    id: string;
    code: string;
    name: string;
    mode: "ROV" | "DIVING" | "BOTH";
    category: "Structure" | "Job Pack" | "Planning" | "Inspection" | "Final" | "Others";
    description?: string;
    handler: () => void;
    available: boolean;
}

export const isSGRecord = (r: any) => {
    const qid = (r.structure_components?.q_id || r.component?.q_id || "").toUpperCase();
    const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
    const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
    const compName = (r.structure_components?.comp_name || r.component?.comp_name || r.structure_components?.name || r.component?.name || "").toUpperCase();
    return qid.startsWith("SG") || qid.startsWith("CS_GUARD") || qid.startsWith("CS-GUARD") || (qid.includes("GUARD") && qid.includes("CS")) || typeCode === "SG" || typeCode === "CAISSONGUARD" || compCode === "SG" || compCode === "CS_GUARD" || compName.includes("CAISSON GUARD");
};

export const isCURecord = (r: any) => {
    const qid = (r.structure_components?.q_id || r.component?.q_id || "").toUpperCase();
    const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
    const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
    const compName = (r.structure_components?.comp_name || r.component?.comp_name || r.structure_components?.name || r.component?.name || "").toUpperCase();
    return qid.startsWith("CU") || qid.startsWith("CD_GUARD") || qid.startsWith("CD-GUARD") || (qid.includes("GUARD") && (qid.includes("CD") || qid.includes("COND"))) || typeCode === "CU" || typeCode === "CONDUCTORGUARD" || compCode === "CU" || compCode === "CD_GUARD" || compName.includes("CONDUCTOR GUARD");
};

export const isRGRecord = (r: any) => {
    const qid = (r.structure_components?.q_id || r.component?.q_id || "").toUpperCase();
    const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
    const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
    const compName = (r.structure_components?.comp_name || r.component?.comp_name || r.structure_components?.name || r.component?.name || "").toUpperCase();
    return typeCode === "RGVI" || qid.startsWith("RG") || qid.startsWith("RISG") || qid.startsWith("RISER_GUARD") || qid.startsWith("RISER-GUARD") || typeCode === "RG" || typeCode === "RISG" || typeCode === "RISERGUARD" || compCode === "RG" || compCode === "RISG" || compName.includes("RISER GUARD");
};

export const isBLRecord = (r: any) => {
    if (!r) return false;
    const comp = r.structure_components || r.component || {};
    const qid = String(comp.q_id || comp.qid || "").toUpperCase();
    const typeCode = String(r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
    const compCode = String(comp.code || comp.metadata?.comp_type || "").toUpperCase();
    const compName = String(comp.comp_name || comp.name || "").toUpperCase();

    // 1. Explicit Exclusions for non-Boatlanding components (Conductor Shield, Riser Guard, etc.)
    const excludedPrefixes = ["CS_", "CS-", "RG_", "RG-", "CU_", "CU-", "SG_", "SG-", "CD_", "CD-", "LEG_", "LEG-", "MB_", "MB-", "R_"];
    const excludedCodes = ["CS", "RG", "CU", "SG", "CD", "CON", "LEG", "MB", "RS", "JT"];
    if (excludedCodes.includes(compCode)) return false;
    if (excludedPrefixes.some(p => qid.startsWith(p))) return false;

    // 2. Check Boatlanding or Boat Fender code / QID / name
    const isBLCode = ["BL", "BLTG", "BOATLANDING"].includes(compCode) || ["BL", "BLTG", "BOATLANDING", "RBLTG", "DBLTG"].includes(typeCode);
    const isBFCode = ["BF", "BOATFENDER", "FENDER"].includes(compCode);
    if (isBLCode || isBFCode) return true;

    const isBLQid = qid.startsWith("BL") || qid.startsWith("BOATLANDING") || qid.startsWith("BOAT_LANDING");
    const isBFQid = qid.startsWith("BF") || qid.startsWith("BOATFENDER") || qid.startsWith("BOAT_FENDER") || qid.startsWith("FENDER");
    if (isBLQid || isBFQid) return true;

    if (compName.includes("BOATLANDING") || compName.includes("BOAT LANDING") || compName.includes("BOAT FENDER") || compName.includes("BOATFENDER") || compName.includes("FENDER")) {
        return true;
    }

    return false;
};

export function getMatchingRecordsForTemplate(templateOrId: any, records: any[]): any[] {
    if (!templateOrId || !Array.isArray(records)) return [];

    let templateIdStr = "";
    let templateCodeStr = "";

    if (typeof templateOrId === "string") {
        templateIdStr = templateOrId;
        templateCodeStr = templateOrId;
    } else if (typeof templateOrId === "object" && templateOrId !== null) {
        templateIdStr = String(templateOrId.id || templateOrId.code || templateOrId.name || "");
        templateCodeStr = String(templateOrId.code || templateOrId.id || "");
    } else {
        templateIdStr = String(templateOrId || "");
        templateCodeStr = String(templateOrId || "");
    }

    const idLower = templateIdStr.toLowerCase();
    const codeUpper = templateCodeStr.toUpperCase();

    const hasCode = (r: any, codes: string[]) => {
        const rCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
        return codes.includes(rCode);
    };

    // 1. Anomaly / Defect templates
    if (
        idLower.includes("anomaly") || 
        idLower.includes("defect") || 
        codeUpper === "ANOM" || 
        codeUpper === "DEFECT"
    ) {
        return records.filter(r => 
            r.has_anomaly === true || 
            r.is_anomaly === true || 
            r.has_anomaly === 1 ||
            r.has_anomaly === "true" ||
            r.component_condition === 'Anomalous' || 
            (r.description && r.description.toLowerCase().includes('anomaly')) || 
            (r.insp_anomalies && r.insp_anomalies.length > 0)
        );
    }

    // 2. Generic/All-Records templates
    const allRecordsTemplates = [
        'findings', 'photo', 'video_log', 'diver_log', 'compliance', 
        'jp_summary', 'sow_report', 'struct_over', 'exec_sum', 'insp_report',
        'pipeline_event_sketch_report', 'pipe-evt-s', 'pipe_evt_s', 'pipeline_event_sketch'
    ];
    if (allRecordsTemplates.includes(idLower) || allRecordsTemplates.includes(templateCodeStr.toLowerCase())) {
        return records;
    }

    // 3. Specific mapping rules based on code
    switch (codeUpper) {
        case 'RGVI':
        case 'DGVI':
            return records.filter(r => hasCode(r, ['RGVI', 'DGVI']));
        case 'CP':
            return records.filter(r => r.inspection_data?.cp_rdg !== undefined || r.inspection_data?.cp_reading_mv !== undefined || r.inspection_data?.cp !== undefined);
        case 'RSWNI':
        case 'SWNI':
            return records.filter(r => hasCode(r, ['RSWNI', 'SWNI']));
        case 'RICMI':
            return records.filter(r => hasCode(r, ['RICMI']));
        case 'ANODE':
        case 'ANOD':
        case 'RSANI':
        case 'SANI':
        case 'PL_AN':
            // Anode / Selected Anode
            if (idLower.includes("rsani") || idLower.includes("sani")) {
                return records.filter(r => {
                    const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                    const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
                    return typeCode === 'RSANI' && compCode === 'AN';
                });
            } else if (idLower.includes("diving") || idLower.includes("dive")) {
                return records.filter(r => hasCode(r, ['PL_AN']));
            } else {
                return records.filter(r => {
                    const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                    const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
                    const isAnode = typeCode === 'RGVI' || typeCode === 'ANODE' || typeCode === 'ANOD';
                    return isAnode && compCode === 'AN' && typeCode !== 'RSANI';
                });
            }
        case 'RFMD':
        case 'FMD':
        case 'DFMD':
            return records.filter(r => hasCode(r, ['RFMD', 'FMD', 'DFMD']));
        case 'RUTWT':
        case 'UTWT':
        case 'UTWTK':
        case 'DUTWT':
            return records.filter(r => hasCode(r, ['RUTWT', 'UTWT', 'UTWTK', 'DUTWT']));
        case 'RSEAB':
        case 'SEABED':
            return records.filter(r => {
                if (!hasCode(r, ['RSEAB', 'SEABED'])) return false;
                const cat = (r.inspection_data?.category || r.inspection_data?.type || '').toLowerCase();
                const desc = (r.description || '').toLowerCase();
                if (idLower.includes('gas')) {
                    return cat === 'gas seepage' || desc.startsWith('gas seepage');
                } else if (idLower.includes('crater')) {
                    return cat === 'crater' || desc.startsWith('crater') || desc.startsWith('seabed crater');
                } else if (idLower.includes('debris') || idLower.includes('detail')) {
                    return cat === 'debris' || cat === '' || (!cat && (desc.startsWith('debris') || desc.startsWith('seabed debris') || (!desc.startsWith('gas') && !desc.startsWith('crater'))));
                }
                // default general report
                return true;
            });
        case 'RWDI':
            return records.filter(r => hasCode(r, ['RWDI']));
        case 'RMGI':
        case 'MGROW':
        case 'DMGI':
            return records.filter(r => hasCode(r, ['RMGI', 'MGROW', 'DMGI']));
        case 'RSZCI':
        case 'SZCI':
        case 'DSZCI':
        case 'SZONE':
            return records.filter(r => hasCode(r, ['RSZCI', 'SZCI', 'DSZCI', 'SZONE']));
        case 'RSCOR':
        case 'SCOUR':
        case 'DSCOR':
            return records.filter(r => hasCode(r, ['RSCOR', 'SCOUR', 'DSCOR']));
        case 'RRISI':
        case 'DRISI':
            return records.filter(r => hasCode(r, ['RRISI', 'DRISI']));
        case 'JTISI':
            return records.filter(r => hasCode(r, ['JTISI']));
        case 'ITISI':
            return records.filter(r => hasCode(r, ['ITISI']));
        case 'RCASN':
        case 'DCASN':
        case 'RCASN-S':
        case 'DCASN-UW':
        case 'DCASN-TS':
            // Caisson Topside vs Underwater
            if (idLower.includes("-uw")) {
                return records.filter(r => {
                    const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                    const compCode = (r.structure_components?.code || "").toUpperCase();
                    const elev = parseFloat(r.elevation ?? r.inspection_data?.elevation ?? 0);
                    return ['GVINS', 'CVINS', 'CPSURV', 'UTWTK', 'DUTWT'].includes(typeCode) && (compCode === 'CS' || compCode.startsWith('CS-') || compCode.startsWith('CS_')) && elev < 0;
                });
            } else if (idLower.includes("-ts")) {
                return records.filter(r => {
                    const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                    const compCode = (r.structure_components?.code || "").toUpperCase();
                    const elev = parseFloat(r.elevation ?? r.inspection_data?.elevation ?? 0);
                    return ['GVINS', 'CVINS', 'CPSURV', 'UTWTK', 'DUTWT'].includes(typeCode) && (compCode === 'CS' || compCode.startsWith('CS-') || compCode.startsWith('CS_')) && elev >= 0;
                });
            }
            return records.filter(r => hasCode(r, ['RCASN', 'DCASN']));
        case 'RCOND':
        case 'DCOND':
        case 'RCON':
        case 'DCON':
        case 'DCOND-UW':
        case 'DCOND-TS':
            // Conductor Topside vs Underwater
            if (idLower.includes("-uw")) {
                return records.filter(r => {
                    const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                    const compCode = (r.structure_components?.code || "").toUpperCase();
                    const elev = parseFloat(r.elevation ?? r.inspection_data?.elevation ?? 0);
                    return ['GVINS', 'CVINS', 'CPSURV', 'UTWTK', 'DUTWT'].includes(typeCode) && (compCode === 'CD' || compCode === 'CON' || compCode.startsWith('CD-') || compCode.startsWith('CD_')) && elev < 0;
                });
            } else if (idLower.includes("-ts")) {
                return records.filter(r => {
                    const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                    const compCode = (r.structure_components?.code || "").toUpperCase();
                    const elev = parseFloat(r.elevation ?? r.inspection_data?.elevation ?? 0);
                    return ['GVINS', 'CVINS', 'CPSURV', 'UTWTK', 'DUTWT'].includes(typeCode) && (compCode === 'CD' || compCode === 'CON' || compCode.startsWith('CD-') || compCode.startsWith('CD_')) && elev >= 0;
                });
            }
            return records.filter(r => hasCode(r, ['RCOND', 'RCON', 'DCOND', 'DCON']));
        case 'BL':
        case 'BOATLANDING':
            return records.filter(r => isBLRecord(r));
        case 'RG':
        case 'RISERGUARD':
            return records.filter(r => isRGRecord(r));
        case 'SG':
        case 'CAISSONGUARD':
            return records.filter(r => isSGRecord(r));
        case 'CU':
        case 'CONDUCTORGUARD':
            return records.filter(r => isCURecord(r));
        case 'GVINS':
            return records.filter(r => hasCode(r, ['GVINS']));
        case 'BSINS':
            return records.filter(r => hasCode(r, ['BSINS']));
        case 'CVINS':
            return records.filter(r => hasCode(r, ['CVINS']));
        case 'CLEAN':
            return records.filter(r => hasCode(r, ['CLEAN']));
        case 'MPINS':
            return records.filter(r => hasCode(r, ['MPINS']));
        case 'CPCLB':
            return records.filter(r => hasCode(r, ['CPCLB']));
        case 'UTCLB':
            return records.filter(r => hasCode(r, ['UTCLB']));
        case 'ACFMC':
            return records.filter(r => hasCode(r, ['ACFMC']));
        case 'PL_CO':
            return records.filter(r => hasCode(r, ['PL_CO']));
        case 'ITMAIN':
            return records.filter(r => hasCode(r, ['ITMAIN']));
        case 'ANMAIN':
            return records.filter(r => hasCode(r, ['ANMAIN']));
        default:
            // Dynamic fallback: match by template code or ID case-insensitively
            return records.filter(r => {
                const rCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                const rTypeId = String(r.inspection_type_id || "");
                return (
                    rCode === codeUpper ||
                    rCode === idLower.toUpperCase() ||
                    rTypeId === templateIdStr
                );
            });
    }
}


interface ReportWizardDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    inspMethod: "ROV" | "DIVING";
    currentRecords: any[];
    allInspectionTypes: any[];
    headerData?: any;
    config: any;
    setConfig: (cfg: any) => void;
    currentStep?: number;
    setCurrentStep?: (step: number) => void;
    selectedTemplate?: any;
    setSelectedTemplate?: (t: any) => void;
    handlers: {
        generateRGVIReport: () => void;
        generateGVINSReport: () => void;
        generateBSINSReport: () => void;
        generateCVINSReport: () => void;
        generateCLEANReport: () => void;
        generateMPINSReport: () => void;
        generateUTWTKReport: () => void;
        generateSZONEReport: () => void;
        generateCPCLBReport: () => void;
        generateCPReport: () => void;
        generateRSWNIReport: () => void;
        generateROVRICMIReport: () => void;
        generateDivingANMAINReport: () => void;
        generateDivingDCASNUWReport: () => void;
        generateDivingDCASNTSReport: () => void;
        generateDivingDCASNReport: () => void;
        generateDivingDCONDUWReport: () => void;
        generateDivingDCONDTSReport: () => void;
        generateDivingDCONDReport: () => void;
        generateUTCLBReport: () => void;
        generateAnodeReport: () => void;
        generateAnodeRsaniReport: () => void;
        generateDivingAnodeReport: () => void;
        generateDivingACFMCReport: () => void;
        generateDivingPLCOReport: () => void;
        generateDivingItemReport?: () => void;
        generateDivingITMAINReport?: () => void;
        generatePhotographyReport: () => void;
        generateROVRWDIReport: () => void;
        generatePhotographyLogReport: () => void;
        generateFMDReport: () => void;
        generateDivingFMDReport?: () => void;
        generateDivingMEASUReport?: () => void;
        generateDivingRRISIReport?: () => void;
        generateDivingRRISIDetailReport?: () => void;
        generateUTWTReport: () => void;
        generateMGIReport: () => void;
        generateRMGIReport: () => void;
        generateDivingMGIReport: () => void;
        generateSZCIReport: () => void;
        generateRSCORReport: () => void;
        generateRSCORV2Report: () => void;
        generateRRISIReport: () => void;
        generateRRISIDetailReport: () => void;
        generateJTISIReport: () => void;
        generateJTISIDetailReport: () => void;
        generateITISIReport: () => void;
        generateITISIDetailReport: () => void;
        generateDivingJTISIReport?: () => void;
        generateDivingJTISIDetailReport?: () => void;
        generateDivingITISIReport?: () => void;
        generateDivingITISIDetailReport?: () => void;
        generateRCASNReport: () => void;
        generateRCASNSketchReport: () => void;
        generateRCONDReport: () => void;
        generateRCONDSketchReport: () => void;
        generatePipelineEventSketchReport?: () => void;
        generateROVNavigReport?: () => void;
        generatePipelineDefectSummaryReport?: () => void;
        generateBLReport: () => void;
        generateRGReport: () => void;
        generateSGReport: () => void;
        generateCUReport: () => void;
        generateSeabedReport: (templateId: string) => void;
        generateSeabedDetailReport: () => void;
        generateSeabedGasDetailReport: () => void;
        generateSeabedCraterDetailReport: () => void;
        generateFullInspectionReport: () => void;
        generateInspectionReportByType: (id: any) => void;
    };
}

const steps = [
    { id: 1, name: "TEMPLATE", icon: <FileText className="w-4 h-4" /> },
    { id: 2, name: "CONTEXT", icon: <Globe className="w-4 h-4" /> },
    { id: 3, name: "CONFIGURATION", icon: <Settings2 className="w-4 h-4" /> },
    { id: 4, name: "PREVIEW", icon: <Eye className="w-4 h-4" /> }
];

const TemplateCard = ({ template, onSelect, getIcon }: { template: ReportTemplate, onSelect: (t: ReportTemplate) => void, getIcon: (cat: string) => React.ReactNode }) => (
    <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
    >
        <Card 
            className={`group relative overflow-hidden border transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer flex flex-col h-full bg-white dark:bg-slate-950 ${
                template.available 
                ? 'border-slate-200 dark:border-slate-800' 
                : 'border-slate-100 dark:border-slate-900 opacity-60 grayscale'
            }`}
            onClick={() => {
                if (template.available) {
                    onSelect(template);
                }
            }}
        >
            <div className="p-4 flex flex-col h-full">
                <div className="flex justify-between items-start mb-3">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                        {getIcon(template.category)}
                    </div>
                    <div className="flex gap-1">
                        {template.mode === 'BOTH' ? (
                            <>
                                <Badge variant="outline" className="text-[8px] font-black tracking-tighter bg-blue-50 text-blue-600 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800">ROV</Badge>
                                <Badge variant="outline" className="text-[8px] font-black tracking-tighter bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800">DIVING</Badge>
                            </>
                        ) : (
                            <Badge 
                                variant="outline" 
                                className={`text-[8px] font-black tracking-tighter ${
                                    template.mode === 'ROV' 
                                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' 
                                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800'
                                }`}
                            >
                                {template.mode}
                            </Badge>
                        )}
                    </div>
                </div>
                
                <div className="flex-1">
                    <h4 className="font-black text-[14px] text-slate-800 dark:text-slate-100 mb-1 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {template.name}
                    </h4>
                    {template.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-3 line-clamp-2">
                            {template.description}
                        </p>
                    )}
                    <div className="flex items-center gap-2 mt-auto">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-800">{template.code}</span>
                        <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600">•</span>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{template.category}</span>
                    </div>
                </div>

                {!template.available && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-900">
                        <p className="text-[9px] font-bold text-amber-600 dark:text-amber-500/70 flex items-center gap-1.5 italic">
                            <Check className="w-3 h-3" /> No captured records found
                        </p>
                    </div>
                )}
            </div>

            {template.available && (
                <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 transition-all pointer-events-none" />
            )}
        </Card>
    </motion.div>
);

export function ReportWizardDialog({
    open,
    onOpenChange,
    inspMethod,
    currentRecords,
    allInspectionTypes,
    headerData,
    config,
    setConfig,
    handlers,
    currentStep: propCurrentStep,
    setCurrentStep: propSetCurrentStep,
    selectedTemplate: propSelectedTemplate,
    setSelectedTemplate: propSetSelectedTemplate,
}: ReportWizardDialogProps) {
    const [localStep, setLocalStep] = useState(1);
    const currentStep = propCurrentStep ?? localStep;
    const setCurrentStep = propSetCurrentStep ?? setLocalStep;

    const [localTemplate, setLocalTemplate] = useState<ReportTemplate | null>(null);
    const selectedTemplate = propSelectedTemplate ?? localTemplate;
    const setSelectedTemplate = propSetSelectedTemplate ?? setLocalTemplate;
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState<string>("Inspection");
    const [activeMode, setActiveMode] = useState<string>("ALL");
    const [viewMode, setViewMode] = useState<"card" | "table">("card");
    const [showAllTemplates, setShowAllTemplates] = useState<boolean>(false);

    const templates: ReportTemplate[] = useMemo(() => {
        const hasRecords = (codes: string[]) => 
            currentRecords.some(r => codes.includes((r.inspection_type_code || r.inspection_type?.code || "").toUpperCase()));

        const baseTemplates: ReportTemplate[] = [
            // ── INSPECTION REPORTS (ROV) ───────────────────────────────────────────
            { id: 'rgvi', code: 'RGVI', name: 'General Visual Inspection (ROV)', description: 'Full visual assessment of structural integrity and coatings.', mode: 'ROV', category: 'Inspection', handler: handlers.generateRGVIReport, available: hasRecords(['RGVI']) },
            { id: 'cp_rov', code: 'CP', name: 'CP Survey Report (ROV)', description: 'Cathodic protection potential readings and anode depletion.', mode: 'ROV', category: 'Inspection', handler: handlers.generateCPReport, available: currentRecords.some(r => r.inspection_data?.cp_rdg !== undefined || r.inspection_data?.cp_reading_mv !== undefined || (r.inspection_type_code || '').toUpperCase() === 'CP') },
            { id: 'rswni_rov', code: 'RSWNI', name: 'Selected Node Report (ROV)', description: 'Portrait Selected Node Report (RSWNI) with QID, Elevation, CP, Component/Coating Condition, and findings.', mode: 'ROV', category: 'Inspection', handler: handlers.generateRSWNIReport, available: hasRecords(['RSWNI', 'SWNI']) },
            { id: 'rov_ricmi_report', code: 'RICMI', name: 'Inclinometer Survey Report (ROV)', description: 'Portrait Inclinometer Survey Report (RICMI) with QID, Elevation, Dive No., Angle readings, additional readings, and findings.', mode: 'ROV', category: 'Inspection', handler: handlers.generateROVRICMIReport, available: hasRecords(['RICMI']) },
            { id: 'anode_rov', code: 'ANODE', name: 'Anode Inspection Report (ROV)', description: 'Detailed depletion measurements and attachment status (excluding RSANI).', mode: 'ROV', category: 'Inspection', handler: handlers.generateAnodeReport, available: currentRecords.some(r => {
                const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
                const isAnode = typeCode === 'RGVI' || typeCode === 'ANODE' || typeCode === 'ANOD' || typeCode === 'PL_AN';
                return (isAnode || compCode === 'AN') && typeCode !== 'RSANI';
            }) },
            { id: 'anode_rsani_rov', code: 'RSANI', name: 'Selected Anode Report (ROV)', description: 'Selected Anode Close Visual Inspection (CVI) Report (RSANI) with depletion measurements and CP readings.', mode: 'ROV', category: 'Inspection', handler: handlers.generateAnodeRsaniReport, available: currentRecords.some(r => {
                const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
                return typeCode === 'RSANI' || (compCode === 'AN' && typeCode === 'RSANI');
            }) },
            { id: 'video_log', code: 'VIDLOG', name: 'Video Log Report (ROV)', description: 'Chronological log of video events with timecodes.', mode: 'ROV', category: 'Inspection', handler: handlers.generatePhotographyLogReport, available: currentRecords.some(r => (r.tape_logs && r.tape_logs.length > 0) || r.tape_no || r.video_no || r.dive_no || (r.dive_logs && r.dive_logs.length > 0) || currentRecords.length > 0) },
            { id: 'fmd_rov', code: 'RFMD', name: 'FMD Survey Report (ROV)', description: 'Flooded Member Detection summary report with QID, Elevation, Dive and Tape details', mode: 'ROV', category: 'Inspection', handler: handlers.generateFMDReport, available: hasRecords(['RFMD', 'FMD']) },
            { id: 'utwt_rov', code: 'RUTWT', name: 'UT Thickness Report (ROV)', description: 'Detailed ROV UT wall thickness report with 4 clock positions and elevation reference', mode: 'ROV', category: 'Inspection', handler: handlers.generateUTWTReport, available: hasRecords(['RUTWT', 'UTWT', 'UTWTK']) },
            { id: 'seabed_rov', code: 'RSEAB-SKETCH', name: 'Seabed Survey Inspection Sketch Report (ROV)', description: 'General unfiltered Seabed GUI maps showing all debris, craters, and gas seepages.', mode: 'ROV', category: 'Inspection', handler: () => handlers.generateSeabedReport('rov-seabed-report'), available: hasRecords(['RSEAB', 'SEABED']) },
            { id: 'seabed_rov_debris_sketch', code: 'RSEAB-DEBRIS', name: 'Seabed Survey Debris Sketch Report (ROV)', description: 'Filtered Seabed GUI maps with debris items marked.', mode: 'ROV', category: 'Inspection', handler: () => handlers.generateSeabedReport('seabed-survey-debris'), available: hasRecords(['RSEAB', 'SEABED']) },
            { id: 'seabed_rov_gas_sketch', code: 'RSEAB-GAS', name: 'Seabed Survey Gas Seepage Sketch Report (ROV)', description: 'Filtered Seabed GUI maps with gas seepages marked.', mode: 'ROV', category: 'Inspection', handler: () => handlers.generateSeabedReport('seabed-survey-gas'), available: hasRecords(['RSEAB', 'SEABED']) },
            { id: 'seabed_rov_crater_sketch', code: 'RSEAB-CRATER', name: 'Seabed Survey Crater Sketch Report (ROV)', description: 'Filtered Seabed GUI maps with craters marked.', mode: 'ROV', category: 'Inspection', handler: () => handlers.generateSeabedReport('seabed-survey-crater'), available: hasRecords(['RSEAB', 'SEABED']) },
            { id: 'seabed_rov_detail', code: 'RSEAB-DET-DEBRIS', name: 'Seabed Survey Debris Inspection Report (ROV)', description: 'Detailed portrait tabular Seabed Survey Debris inspection report with anomalies and findings.', mode: 'ROV', category: 'Inspection', handler: handlers.generateSeabedDetailReport, available: hasRecords(['RSEAB', 'SEABED']) },
            { id: 'seabed_rov_gas_detail', code: 'RSEAB-DET-GAS', name: 'Seabed Survey Gas Seepage Inspection Report (ROV)', description: 'Detailed portrait tabular Seabed Survey Gas Seepage inspection report with anomalies and findings.', mode: 'ROV', category: 'Inspection', handler: handlers.generateSeabedGasDetailReport, available: hasRecords(['RSEAB', 'SEABED']) },
            { id: 'seabed_rov_crater_detail', code: 'RSEAB-DET-CRATER', name: 'Seabed Survey Crater Inspection Report (ROV)', description: 'Detailed portrait tabular Seabed Survey Crater inspection report with anomalies and findings.', mode: 'ROV', category: 'Inspection', handler: handlers.generateSeabedCraterDetailReport, available: hasRecords(['RSEAB', 'SEABED']) },
            { id: 'rwdi', code: 'RWDI', name: 'Water Depth Inspection Report (ROV)', description: 'Portrait ROV Water Depth Inspection report.', mode: 'ROV', category: 'Inspection', handler: handlers.generateROVRWDIReport, available: hasRecords(['RWDI']) },
            { id: 'mgi_rov', code: 'RMGI-GRAPH', name: 'Marine Growth Graph Report (ROV)', description: 'Marine Growth Graph Report (ROV) RMGI with Graph', mode: 'ROV', category: 'Inspection', handler: handlers.generateMGIReport, available: hasRecords(['RMGI', 'MGROW']) },
            { id: 'rov_rmgi_report', code: 'RMGI', name: 'Marine Growth Inspection Report (ROV)', description: 'Marine Growth Inspection Report (ROV) RMGI Standard Table', mode: 'ROV', category: 'Inspection', handler: handlers.generateRMGIReport, available: hasRecords(['RMGI', 'MGROW']) },
            { id: 'szci_rov', code: 'RSZCI', name: 'Splash Zone Inspection Report (ROV)', description: 'Splash zone wall thickness and CP inspection summary with clock positions', mode: 'ROV', category: 'Inspection', handler: handlers.generateSZCIReport, available: hasRecords(['RSZCI', 'SZCI']) },
            { id: 'rscor_rov', code: 'RSCOR', name: 'Scour Survey Sketch Report (ROV)', description: 'ROV Scour Inspection report.', mode: 'ROV', category: 'Inspection', handler: handlers.generateRSCORReport, available: hasRecords(['RSCOR', 'SCOUR']) },
            { id: 'rscor_v2_rov', code: 'RSCOR_V2', name: 'Scour Survey Sketch Report v2 (ROV)', description: 'ROV Scour Survey Sketch v2 Report with side-by-side layout.', mode: 'ROV', category: 'Inspection', handler: handlers.generateRSCORV2Report, available: hasRecords(['RSCOR', 'SCOUR']) },
            { id: 'rrisi_rov', code: 'RRISI', name: 'Riser Survey Inspection Sketch Report (ROV)', description: 'ROV Riser inspection report.', mode: 'ROV', category: 'Inspection', handler: handlers.generateRRISIReport, available: hasRecords(['RRISI', 'DRISI']) },
            { id: 'rrisi_detail_rov', code: 'RRISI-DETAIL', name: 'Riser Inspection Report (ROV)', description: 'Detailed portrait Riser inspection tabular report.', mode: 'ROV', category: 'Inspection', handler: handlers.generateRRISIDetailReport, available: hasRecords(['RRISI', 'DRISI']) },
            { id: 'jtisi_rov', code: 'JTISI', name: 'J-Tube Survey Inspection Sketch Report (ROV)', description: 'ROV J-Tube Inspection report.', mode: 'ROV', category: 'Inspection', handler: handlers.generateJTISIReport, available: hasRecords(['JTISI']) },
            { id: 'jtisi_detail_rov', code: 'JTISI-DETAIL', name: 'J-Tube Inspection Report (ROV)', description: 'Detailed portrait J-Tube inspection tabular report.', mode: 'ROV', category: 'Inspection', handler: handlers.generateJTISIDetailReport, available: hasRecords(['JTISI']) },
            { id: 'itisi_rov', code: 'ITISI', name: 'I-Tube Survey Inspection Sketch Report (ROV)', description: 'ROV I-Tube Inspection report.', mode: 'ROV', category: 'Inspection', handler: handlers.generateITISIReport, available: hasRecords(['ITISI']) },
            { id: 'itisi_detail_rov', code: 'ITISI-DETAIL', name: 'I-Tube Inspection Report (ROV)', description: 'Detailed portrait I-Tube inspection tabular report.', mode: 'ROV', category: 'Inspection', handler: handlers.generateITISIDetailReport, available: hasRecords(['ITISI']) },
            { id: 'rcasn_rov', code: 'RCASN', name: 'Caisson Inspection Report (ROV)', description: 'ROV Caisson Inspection report.', mode: 'ROV', category: 'Inspection', handler: handlers.generateRCASNReport, available: hasRecords(['RCASN']) },
            { id: 'rcasn_sketch_rov', code: 'RCASN-S', name: 'Caisson Sketch Report (ROV)', description: 'ROV Caisson Sketch Report.', mode: 'ROV', category: 'Inspection', handler: handlers.generateRCASNSketchReport, available: hasRecords(['RCASN']) },
            { id: 'rcond_rov', code: 'RCOND', name: 'Conductor Inspection Report (ROV)', description: 'ROV Conductor Inspection report.', mode: 'ROV', category: 'Inspection', handler: handlers.generateRCONDReport, available: hasRecords(['RCOND', 'RCON']) },
            { id: 'rcond_sketch_rov', code: 'RCOND-S', name: 'Conductor Sketch Report (ROV)', description: 'ROV Conductor Sketch Report.', mode: 'ROV', category: 'Inspection', handler: handlers.generateRCONDSketchReport, available: hasRecords(['RCOND', 'RCON']) },
            { id: 'pipeline_event_sketch_report', code: 'PIPE-EVT-S', name: 'Pipeline Event List Sketch Report', description: 'Landscape Pipeline Navigation event list sketch report with graphical KP pipeline elevation profile, span/burial profiles, geodetic header, and matched event table.', mode: 'ROV', category: 'Inspection', handler: handlers.generatePipelineEventSketchReport || (() => {}), available: hasRecords(['PIPE-EVT-S', 'PIPE_EVT_S', 'NAVIG', 'EVENT', 'PL_EV']) || currentRecords.some(r => (r.kp !== undefined && r.kp !== null) || (r.pipeline_events && r.pipeline_events.length > 0)) },
            { id: 'rov_navig_report', code: 'NAVIG', name: 'Pipeline Visual Inspection Report', description: 'Landscape Pipeline Visual Inspection Report for inspection type NAVIG — Item No., Date, Time, Easting, Northing, KP, Depth, CP Reading, Event Name, Finding & Anomaly Priority.', mode: 'ROV', category: 'Inspection', handler: (handlers as any).generateROVNavigReport || (() => {}), available: hasRecords(['NAVIG', 'PL_NAV']) || currentRecords.some(r => (r.kp !== undefined && r.kp !== null)) },
            { id: 'defect_summary_pipeline', code: 'DSR-PL', name: 'Defect Summary Report (Pipeline)', description: 'Priority-ordered summary of pipeline anomalies and associated structure risers with combined span/burial events and color coding.', mode: 'BOTH', category: 'Inspection', handler: (handlers as any).generatePipelineDefectSummaryReport || handlers.generateFullInspectionReport, available: currentRecords.some(r => (r.has_anomaly || r.is_anomaly || r.component_condition === 'Anomalous') && ((r.kp !== undefined && r.kp !== null) || ['NAVIG', 'PIPE'].includes((r.inspection_type_code || '').toUpperCase()))) },
            { id: 'findings_summary_pipeline', code: 'FSR-PL', name: 'Finding Summary Report (Pipeline)', description: 'Priority-ordered summary of pipeline findings with reference numbers containing "F" and combined span/burial events.', mode: 'BOTH', category: 'Inspection', handler: (handlers as any).generatePipelineFindingSummaryReport || (handlers as any).generatePipelineDefectSummaryReport || handlers.generateFullInspectionReport, available: currentRecords.some(r => (r.findings || r.has_finding) && ((r.kp !== undefined && r.kp !== null) || ['NAVIG', 'PIPE'].includes((r.inspection_type_code || '').toUpperCase()))) },
            { id: 'bl_rov', code: 'BL', name: 'Boatlanding Inspection Report (ROV)', description: 'ROV Boatlanding Inspection report.', mode: 'ROV', category: 'Inspection', handler: handlers.generateBLReport, available: currentRecords.some(r => isBLRecord(r)) },
            { id: 'rg_rov', code: 'RG', name: 'Riser Guard Inspection Report (ROV)', description: 'ROV Riser Guard Inspection report.', mode: 'ROV', category: 'Inspection', handler: handlers.generateRGReport, available: currentRecords.some(r => isRGRecord(r)) },
            { id: 'sg_rov', code: 'SG', name: 'Caisson Guard Inspection Report (ROV)', description: 'ROV Caisson Guard Inspection report.', mode: 'ROV', category: 'Inspection', handler: handlers.generateSGReport, available: currentRecords.some(r => isSGRecord(r)) },
            { id: 'cu_rov', code: 'CU', name: 'Conductor Guard Inspection Report (ROV)', description: 'ROV Conductor Guard Inspection report.', mode: 'ROV', category: 'Inspection', handler: handlers.generateCUReport, available: currentRecords.some(r => isCURecord(r)) },

            // ── INSPECTION REPORTS (DIVING) ────────────────────────────────────────
            { id: 'gvins', code: 'GVINS', name: 'General Visual Inspection Report (Diving)', description: 'General visual inspection report.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateGVINSReport, available: hasRecords(['GVINS', 'DGVI']) },
            { id: 'diving-item-report', code: 'PL_IC', name: 'Item Inspection Report (Diving)', description: 'Portrait Item Inspection report (Diving) with QID, Elevation, Dive No., CP, Item Type, Description, and Findings.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateDivingItemReport || handlers.generateFullInspectionReport, available: hasRecords(['PL_IC', 'ITEM']) },
            { id: 'diving-itmain-report', code: 'ITMAIN', name: 'Item Maintenance Inspection Report (Diving)', description: 'Portrait Item Maintenance Inspection report (Diving) with QID, Elevation, Dive No., Angle, Dim 1, Dim 2, Dim 3, and Findings.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateDivingITMAINReport || handlers.generateFullInspectionReport, available: hasRecords(['ITMAIN']) },
            { id: 'bsins', code: 'BSINS', name: 'Bolted Support Inspection (Diving)', description: 'Detailed bolted support inspection.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateBSINSReport, available: hasRecords(['BSINS']) },
            { id: 'cvins', code: 'CVINS', name: 'Close Visual Inspection (Diving)', description: 'Close visual inspection report with findings.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateCVINSReport, available: hasRecords(['CVINS']) },
            { id: 'clean', code: 'CLEAN', name: 'Cleaning Inspection (Diving)', description: 'Cleaning inspection report.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateCLEANReport, available: hasRecords(['CLEAN']) },
            { id: 'mpins', code: 'MPINS', name: 'Magnetic Particle Inspection (Diving)', description: 'Detailed magnetic particle inspection.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateMPINSReport, available: hasRecords(['MPINS']) },
            { id: 'utwtk', code: 'UTWTK', name: 'UT Wall Thickness Inspection (Diving)', description: 'UT Wall Thickness Inspection.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateUTWTKReport, available: hasRecords(['UTWTK', 'DUTWT']) },
            { id: 'szone', code: 'SZONE', name: 'Splash Zone Inspection (Diving)', description: 'Splash zone wall thickness and CP inspection summary with grouped clock positions', mode: 'DIVING', category: 'Inspection', handler: handlers.generateSZONEReport, available: hasRecords(['SZONE', 'DSZCI']) },
            { id: 'diver_log', code: 'DIVLOG', name: 'Diver Log Report (Diving)', description: 'Chronological diver activities and findings per dive.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateFullInspectionReport, available: hasRecords(['DIVLOG', 'DIVER_LOG', 'DIVE_LOG']) || (inspMethod === 'DIVING' && currentRecords.length > 0) },
            { id: 'acfmc', code: 'ACFMC', name: 'ACFM Crack Inspection (Diving)', description: 'Landscape Diving ACFM Survey report.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateDivingACFMCReport, available: hasRecords(['ACFMC']) },
            { id: 'plco', code: 'PL_CO', name: 'Coating Damage Inspection (Diving)', description: 'Landscape Diving Coating Damage Survey report.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateDivingPLCOReport, available: hasRecords(['PL_CO']) },
            { id: 'cp_div', code: 'CP', name: 'CP Survey Report (Diving)', description: 'Diver-held CP probe measurements and potential readings.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateCPReport, available: currentRecords.some(r => r.inspection_data?.cp_rdg !== undefined || r.inspection_data?.cp_reading_mv !== undefined) },
            { id: 'cpclb', code: 'CPCLB', name: 'CP Calibration Report (Diving)', description: 'Pre-dive and post-dive calibration records for CP probes.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateCPCLBReport, available: hasRecords(['CPCLB']) },
            { id: 'fmd_div', code: 'DFMD', name: 'Flooded Member Inspection Report (Diving)', description: 'Flooded Member Inspection report (Diving) with QID, Elevation, Dive No., Flooded, Grouted, and findings.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateDivingFMDReport || handlers.generateFMDReport, available: hasRecords(['DFMD', 'FLOOD', 'FMD']) },
            { id: 'measu_div', code: 'MEASU', name: 'Measurement Dimensional Survey Report (Diving)', description: 'Measurement Dimensional Survey report (Diving) with QID, Elevation, Dive No., Type, Unit, Result, and findings.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateDivingMEASUReport || handlers.generateFullInspectionReport, available: hasRecords(['MEASU', 'DMSR', 'MEASUREMENT', 'DMEAS']) },
            { id: 'rrisi_div', code: 'DRRISI', name: 'Riser Inspection Report with Sketch (Diving)', description: 'Riser Survey report (Diving) with Sketch — QID, Elevation, Dive No., CP, UT, and findings.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateDivingRRISIReport || handlers.generateFullInspectionReport, available: currentRecords.some(r => {
                const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                const qid = (r.structure_components?.q_id || r.q_id || "").toUpperCase();
                return ['DRRISI', 'DRISI', 'RSURV', 'RISER', 'DRSER', 'DRSI', 'RRISI'].includes(code) || (qid.startsWith('R') && !qid.startsWith('RISG'));
            }) },
            { id: 'rrisi_detail_div', code: 'DRRISI-DET', name: 'Riser Inspection Summary Report without Sketch (Diving)', description: 'Riser Survey summary report (Diving) without Sketch — QID, Elevation, Dive No., CP, UT, and findings.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateDivingRRISIDetailReport || handlers.generateFullInspectionReport, available: currentRecords.some(r => {
                const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                const qid = (r.structure_components?.q_id || r.q_id || "").toUpperCase();
                return ['DRRISI', 'DRISI', 'RSURV', 'RISER', 'DRSER', 'DRSI', 'RRISI'].includes(code) || (qid.startsWith('R') && !qid.startsWith('RISG'));
            }) },
            { id: 'jtisi_div', code: 'DJTISI', name: 'J-Tube Inspection Report with Sketch (Diving)', description: 'J-Tube Survey report (Diving) with Sketch — QID, Elevation, Dive No., CP, UT, and findings.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateDivingJTISIReport || handlers.generateFullInspectionReport, available: currentRecords.some(r => {
                const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                const qid = (r.structure_components?.q_id || r.q_id || "").toUpperCase();
                return ['DJTISI', 'JTISI'].includes(code) || qid.startsWith('J');
            }) },
            { id: 'jtisi_detail_div', code: 'DJTISI-DET', name: 'J-Tube Inspection Summary Report without Sketch (Diving)', description: 'J-Tube Survey summary report (Diving) without Sketch — QID, Elevation, Dive No., CP, UT, and findings.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateDivingJTISIDetailReport || handlers.generateFullInspectionReport, available: currentRecords.some(r => {
                const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                const qid = (r.structure_components?.q_id || r.q_id || "").toUpperCase();
                return ['DJTISI', 'JTISI'].includes(code) || qid.startsWith('J');
            }) },
            { id: 'itisi_div', code: 'DITISI', name: 'I-Tube Inspection Report with Sketch (Diving)', description: 'I-Tube Survey report (Diving) with Sketch — QID, Elevation, Dive No., CP, UT, and findings.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateDivingITISIReport || handlers.generateFullInspectionReport, available: currentRecords.some(r => {
                const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                const qid = (r.structure_components?.q_id || r.q_id || "").toUpperCase();
                return ['DITISI', 'ITISI'].includes(code) || qid.startsWith('I');
            }) },
            { id: 'itisi_detail_div', code: 'DITISI-DET', name: 'I-Tube Inspection Summary Report without Sketch (Diving)', description: 'I-Tube Survey summary report (Diving) without Sketch — QID, Elevation, Dive No., CP, UT, and findings.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateDivingITISIDetailReport || handlers.generateFullInspectionReport, available: currentRecords.some(r => {
                const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                const qid = (r.structure_components?.q_id || r.q_id || "").toUpperCase();
                return ['DITISI', 'ITISI'].includes(code) || qid.startsWith('I');
            }) },
            { id: 'mgi_div', code: 'DMGI', name: 'Marine Growth Inspection (Diving)', description: 'Diving Marine Growth Inspection report.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateDivingMGIReport, available: hasRecords(['DMGI', 'MGROW']) },
            { id: 'diving_anmain_report', code: 'ANMAIN', name: 'Anode Maintenance Inspection Report (Diving)', description: 'Landscape Anode Maintenance Inspection Report.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateDivingANMAINReport, available: hasRecords(['ANMAIN']) },
            { id: 'diving-dcasn-uw-report', code: 'DCASN-UW', name: 'Caisson Inspection Underwater (Diving)', description: 'Portrait Caisson underwater inspection report (< 0 elevation) combining GVINS, CVINS, CPSURV, UTWTK.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateDivingDCASNUWReport, available: currentRecords.some(r => {
                const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                const compCode = (r.structure_components?.code || "").toUpperCase();
                return ['GVINS', 'CVINS', 'CPSURV', 'UTWTK', 'DUTWT', 'MPINS', 'CLEAN'].includes(typeCode) && (compCode === 'CS' || compCode.startsWith('CS-') || compCode.startsWith('CS_'));
            }) },
            { id: 'diving-dcasn-ts-report', code: 'DCASN-TS', name: 'Caisson Inspection Above Water (Diving)', description: 'Portrait Caisson topside inspection report (>= 0 elevation) combining GVINS, CVINS, CPSURV, UTWTK.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateDivingDCASNTSReport, available: currentRecords.some(r => {
                const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                const compCode = (r.structure_components?.code || "").toUpperCase();
                return ['GVINS', 'CVINS', 'CPSURV', 'UTWTK', 'DUTWT', 'MPINS', 'CLEAN'].includes(typeCode) && (compCode === 'CS' || compCode.startsWith('CS-') || compCode.startsWith('CS_'));
            }) },
            { id: 'diving-dcasn-report', code: 'DCASN', name: 'Caisson Inspection (Diving)', description: 'Portrait combined Caisson inspection report (Above & Underwater) combining GVINS, CVINS, CPSURV, UTWTK.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateDivingDCASNReport, available: currentRecords.some(r => {
                const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                const compCode = (r.structure_components?.code || "").toUpperCase();
                return ['GVINS', 'CVINS', 'CPSURV', 'UTWTK', 'DUTWT', 'MPINS', 'CLEAN'].includes(typeCode) && (compCode === 'CS' || compCode.startsWith('CS-') || compCode.startsWith('CS_'));
            }) },
            { id: 'diving-dcond-uw-report', code: 'DCOND-UW', name: 'Conductor Inspection Underwater (Diving)', description: 'Portrait Conductor underwater inspection report (< 0 elevation) combining GVINS, CVINS, CPSURV, UTWTK.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateDivingDCONDUWReport, available: currentRecords.some(r => {
                const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                const compCode = (r.structure_components?.code || "").toUpperCase();
                return ['GVINS', 'CVINS', 'CPSURV', 'UTWTK', 'DUTWT', 'MPINS', 'CLEAN'].includes(typeCode) && (compCode === 'CD' || compCode === 'CON' || compCode.startsWith('CD-') || compCode.startsWith('CD_'));
            }) },
            { id: 'diving-dcond-ts-report', code: 'DCOND-TS', name: 'Conductor Inspection Above Water (Diving)', description: 'Portrait Conductor topside inspection report (>= 0 elevation) combining GVINS, CVINS, CPSURV, UTWTK.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateDivingDCONDTSReport, available: currentRecords.some(r => {
                const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                const compCode = (r.structure_components?.code || "").toUpperCase();
                return ['GVINS', 'CVINS', 'CPSURV', 'UTWTK', 'DUTWT', 'MPINS', 'CLEAN'].includes(typeCode) && (compCode === 'CD' || compCode === 'CON' || compCode.startsWith('CD-') || compCode.startsWith('CD_'));
            }) },
            { id: 'diving-dcond-report', code: 'DCOND', name: 'Conductor Inspection (Diving)', description: 'Portrait combined Conductor inspection report (Above & Underwater) combining GVINS, CVINS, CPSURV, UTWTK.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateDivingDCONDReport, available: currentRecords.some(r => {
                const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                const compCode = (r.structure_components?.code || "").toUpperCase();
                return ['GVINS', 'CVINS', 'CPSURV', 'UTWTK', 'DUTWT', 'MPINS', 'CLEAN'].includes(typeCode) && (compCode === 'CD' || compCode === 'CON' || compCode.startsWith('CD-') || compCode.startsWith('CD_'));
            }) },

            { id: 'insp_report', code: 'INSP', name: 'Inspection Report', description: 'Detailed inspection findings, observations and results.', mode: 'BOTH', category: 'Inspection', handler: handlers.generateFullInspectionReport, available: currentRecords.length > 0 },
            { id: 'defect_summary', code: 'DEFECT', name: 'Defect Summary Report', description: 'Priority-ordered summary of all anomalies with status.', mode: 'BOTH', category: 'Inspection', handler: handlers.generateFullInspectionReport, available: currentRecords.some(r => r.has_anomaly || r.is_anomaly || r.component_condition === 'Anomalous' || (r.insp_anomalies && r.insp_anomalies.length > 0)) },
            { id: 'findings', code: 'FINDINGS', name: 'Findings Summary Report', description: 'Consolidated summary of all findings across the SOW.', mode: 'BOTH', category: 'Inspection', handler: handlers.generateFullInspectionReport, available: currentRecords.length > 0 },
            { id: 'anomaly', code: 'ANOM', name: 'Defect / Anomaly Report', description: 'Detailed defect and anomaly report including images.', mode: 'BOTH', category: 'Inspection', handler: handlers.generateFullInspectionReport, available: currentRecords.some(r => r.has_anomaly || r.is_anomaly || r.component_condition === 'Anomalous' || (r.insp_anomalies && r.insp_anomalies.length > 0)) },
            { id: 'photo', code: 'PHOTO', name: 'Photography Report', description: 'Visual documentation of all inspection points.', mode: 'BOTH', category: 'Inspection', handler: handlers.generatePhotographyReport, available: currentRecords.some(r => (r.photos && r.photos.length > 0) || (r.attachments && r.attachments.length > 0) || r.has_photo || r.photo_count > 0 || currentRecords.length > 0) },
            { id: 'compliance', code: 'COMP', name: 'Compliance Report', description: 'Regulatory compliance and standards documentation.', mode: 'BOTH', category: 'Inspection', handler: handlers.generateFullInspectionReport, available: currentRecords.length > 0 },

            // ── JOB PACK & STRUCTURE REPORTS ──────────────────────────────────────
            { id: 'jp_summary', code: 'JP_SUM', name: 'Job Pack Summary', description: 'Aggregated progress and status of the entire job pack.', mode: 'BOTH', category: 'Job Pack', handler: handlers.generateFullInspectionReport, available: !!headerData?.jobpackName || currentRecords.length > 0 },
            { id: 'sow_report', code: 'SOW_REP', name: 'Scope of Work Report', description: 'Detailed tracking of SOW items and completion status.', mode: 'BOTH', category: 'Job Pack', handler: handlers.generateFullInspectionReport, available: !!headerData?.sowReport || currentRecords.length > 0 },
            { id: 'struct_over', code: 'STR_OVR', name: 'Structure Overview', description: 'Summary of all inspection work performed on this structure.', mode: 'BOTH', category: 'Structure', handler: handlers.generateFullInspectionReport, available: !!headerData?.platformName || currentRecords.length > 0 },
            
            // ── FINAL REPORTS ──────────────────────────────────────────────────────
            { id: 'exec_sum', code: 'EXEC', name: 'Executive Summary', description: 'High-level management summary of the entire operation.', mode: 'BOTH', category: 'Final', handler: handlers.generateFullInspectionReport, available: currentRecords.length > 0 || !!headerData?.platformName },
        ];

        // Base codes already handled by primary baseTemplates
        const baseCodesSet = new Set(baseTemplates.map(b => b.code.toUpperCase()));
        const extraExcludedCodes = ['PL_IC', 'ITEM', 'ITMAIN', 'RCASN', 'DCASN', 'RCOND', 'DCOND', 'RCON', 'DCON', 'RRISI', 'DRISI', 'SZONE', 'SZCI', 'RSZCI', 'DSZCI', 'SEABED', 'RSEAB', 'MGROW', 'RMGI', 'DMGI', 'FMD', 'RFMD', 'DFMD', 'UTWT', 'RUTWT', 'DUTWT', 'UTWTK', 'SCOUR', 'RSCOR', 'DSCOR', 'BOATLANDING', 'BL', 'RISERGUARD', 'RG', 'CAISSONGUARD', 'SG', 'CONDUCTORGUARD', 'CU', 'RSANI', 'ANODE', 'ANOD', 'PL_AN', 'ANMAIN', 'CP', 'CPCLB', 'UTCLB', 'ACFMC', 'PL_CO', 'RWDI', 'RICMI', 'RSWNI', 'SWNI', 'JTISI', 'ITISI', 'GVINS', 'DGVI', 'RGVI', 'BSINS', 'CVINS', 'CLEAN', 'MPINS', 'INSP', 'DEFECT', 'FINDINGS', 'ANOM', 'PHOTO', 'COMP', 'JP_SUM', 'SOW_REP', 'STR_OVR', 'EXEC'];
        extraExcludedCodes.forEach(c => baseCodesSet.add(c));

        // Add dynamic reports (excluding any codes covered by base templates)
        const dynamicReports: ReportTemplate[] = allInspectionTypes.filter(t => 
            !baseCodesSet.has((t.code || "").toUpperCase()) &&
            currentRecords.some(r => (r.inspection_type_id === t.id || r.inspection_type_code === t.code))
        ).map(t => ({
            id: t.id,
            code: t.code,
            name: formatInspectionTypeName(t.name),
            description: `Dynamic report for ${formatInspectionTypeName(t.name)} records.`,
            mode: (t.code.startsWith('R') && t.code.length > 2) ? 'ROV' : (t.code.startsWith('D') && t.code.length > 2) ? 'DIVING' : 'BOTH',
            category: 'Inspection',
            handler: () => handlers.generateInspectionReportByType(t.id),
            available: true
        }));

        const combined = [...baseTemplates, ...dynamicReports];
        const unique: ReportTemplate[] = [];
        const seenKeys = new Set<string>();

        for (const t of combined) {
            let updatedName = t.name.trim();
            
            // Strip redundant mode prefix since the postfix will be added
            if (t.mode === 'ROV') {
                if (updatedName.toUpperCase().startsWith('ROV ')) {
                    updatedName = updatedName.substring(4).trim();
                }
            } else if (t.mode === 'DIVING') {
                if (updatedName.toUpperCase().startsWith('DIVING ')) {
                    updatedName = updatedName.substring(7).trim();
                } else if (updatedName.toUpperCase().startsWith('DIVER ')) {
                    updatedName = updatedName.substring(6).trim();
                }
            }

            if (t.mode === 'ROV' && !updatedName.toUpperCase().endsWith('(ROV)')) {
                updatedName = `${updatedName} (ROV)`;
            } else if (t.mode === 'DIVING' && !updatedName.toUpperCase().endsWith('(DIVING)')) {
                updatedName = `${updatedName} (Diving)`;
            }
            
            const normalizedName = updatedName.toLowerCase()
                .replace(/report/g, "")
                .replace(/inspection/g, "")
                .replace(/summary/g, "")
                .replace(/[^a-z0-9]/g, "");

            const nameModeKey = `${normalizedName}_${t.mode.toLowerCase()}`;
            const idKey = String(t.id).toLowerCase();

            if (!seenKeys.has(nameModeKey) && !seenKeys.has(idKey)) {
                seenKeys.add(nameModeKey);
                seenKeys.add(idKey);
                unique.push({
                    ...t,
                    name: updatedName
                });
            }
        }
        unique.sort((a, b) => a.name.localeCompare(b.name));
        return unique;
    }, [currentRecords, allInspectionTypes, handlers]);

    const categoryTemplates = useMemo(() => {
        return templates.filter(t => {
            const matchesCategory = t.category === activeCategory;
            const matchesMode = activeCategory !== "Inspection" || activeMode === "ALL" || t.mode === "BOTH" || t.mode === activeMode;
            return matchesCategory && matchesMode;
        });
    }, [templates, activeCategory, activeMode]);

    const hiddenUnavailableCount = useMemo(() => {
        return categoryTemplates.filter(t => !t.available).length;
    }, [categoryTemplates]);

    const searchHiddenCount = useMemo(() => {
        if (showAllTemplates) return 0;
        return categoryTemplates.filter(t => {
            const matchesSearch = !search.trim() || 
                t.name.toLowerCase().includes(search.toLowerCase()) || 
                t.code.toLowerCase().includes(search.toLowerCase()) ||
                (t.description && t.description.toLowerCase().includes(search.toLowerCase()));
            return matchesSearch && !t.available;
        }).length;
    }, [categoryTemplates, search, showAllTemplates]);

    const filteredTemplates = useMemo(() => {
        return categoryTemplates.filter(t => {
            const matchesSearch = !search.trim() || 
                t.name.toLowerCase().includes(search.toLowerCase()) || 
                t.code.toLowerCase().includes(search.toLowerCase()) ||
                (t.description && t.description.toLowerCase().includes(search.toLowerCase()));
            const matchesAvailability = showAllTemplates ? true : t.available;
            return matchesSearch && matchesAvailability;
        });
    }, [categoryTemplates, search, showAllTemplates]);

    const groupedTemplates = useMemo(() => {
        const rov = filteredTemplates.filter(t => t.mode === 'ROV');
        const diving = filteredTemplates.filter(t => t.mode === 'DIVING');
        const both = filteredTemplates.filter(t => t.mode === 'BOTH');
        
        return [
            { label: "ROV Operations", icon: <Cpu className="w-3.5 h-3.5" />, templates: rov, colorClass: "text-blue-500" },
            { label: "Diving Operations", icon: <Waves className="w-3.5 h-3.5" />, templates: diving, colorClass: "text-emerald-500" },
            { label: "Combined Operations", icon: <Activity className="w-3.5 h-3.5" />, templates: both, colorClass: "text-indigo-500" }
        ].filter(group => group.templates.length > 0);
    }, [filteredTemplates]);

    const categories = ["Structure", "Job Pack", "Planning", "Inspection", "Final", "Others"];

    const getIcon = (category: string) => {
        switch (category) {
            case 'Structure': return <Grid3X3 className="w-5 h-5 text-blue-500" />;
            case 'Job Pack': return <Layers className="w-5 h-5 text-amber-500" />;
            case 'Planning': return <Calendar className="w-5 h-5 text-emerald-500" />;
            case 'Inspection': return <Activity className="w-5 h-5 text-indigo-500" />;
            case 'Final': return <FileCheck className="w-5 h-5 text-rose-500" />;
            default: return <FileText className="w-5 h-5 text-slate-400" />;
        }
    };

    const handleNextStep = () => {
        if (currentStep < 4) setCurrentStep(currentStep + 1);
    };

    const handlePrevStep = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    const handleTemplateSelect = (template: ReportTemplate) => {
        setSelectedTemplate(template);
        setCurrentStep(2);
    };

    const handleGenerate = () => {
        if (selectedTemplate) {
            selectedTemplate.handler();
            onOpenChange(false);
            if (!propCurrentStep) {
                // Reset wizard for next time if not parent-controlled
                setCurrentStep(1);
                setSelectedTemplate(null);
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            onOpenChange(val);
            if (!val) {
                // Reset step when closed (only for local state)
                if (!propCurrentStep) {
                    setTimeout(() => {
                        setLocalStep(1);
                        setLocalTemplate(null);
                    }, 300);
                }
            }
        }}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                <DialogHeader className="p-6 pb-4 bg-slate-900 text-white shrink-0">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400">
                                <Printer className="w-6 h-6" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black uppercase tracking-[0.2em]">
                                    Reports Center
                                </DialogTitle>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Generate and manage inspection reports</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <Badge className="bg-blue-600 text-[10px] font-black tracking-widest px-2 py-1">
                                {inspMethod} MODE ACTIVE
                            </Badge>
                        </div>
                    </div>

                    {/* Stepper (Matching Pic 1) */}
                    <div className="flex items-center justify-between px-10 py-2 relative">
                        {/* Connection Lines */}
                        <div className="absolute top-1/2 left-10 right-10 h-0.5 bg-slate-800 -translate-y-1/2 z-0" />
                        
                        {steps.map((step) => {
                            const isActive = currentStep === step.id;
                            const isCompleted = currentStep > step.id;
                            return (
                                <div key={step.id} className="relative z-10 flex flex-col items-center gap-2 group">
                                    <div 
                                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                                            isActive 
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20 scale-110' 
                                            : isCompleted
                                            ? 'bg-emerald-600 border-emerald-600 text-white'
                                            : 'bg-slate-900 border-slate-700 text-slate-500'
                                        }`}
                                    >
                                        {isCompleted ? <Check className="w-5 h-5" /> : <span className="font-black text-sm">{step.id}</span>}
                                    </div>
                                    <span className={`text-[9px] font-black tracking-widest transition-colors ${
                                        isActive ? 'text-blue-400' : isCompleted ? 'text-emerald-400' : 'text-slate-500'
                                    }`}>
                                        {step.name}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </DialogHeader>

                <div className="h-[600px] relative flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-900/20">
                    <AnimatePresence mode="wait">
                        {currentStep === 1 && (
                            <motion.div 
                                key="step1"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="absolute inset-0 p-6 flex flex-col gap-6"
                            >
                                <div className="flex flex-col gap-6 shrink-0">
                                    <div className="text-center">
                                        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Select Report Type</h2>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Choose a template to begin generating your report</p>
                                    </div>

                                    {/* Primary Categories */}
                                    <div className="flex flex-wrap gap-2 justify-center">
                                        {categories.map((cat) => (
                                            <Button
                                                key={cat}
                                                variant={activeCategory === cat ? "default" : "outline"}
                                                onClick={() => setActiveCategory(cat)}
                                                className={`rounded-full px-6 py-2 h-auto text-[11px] font-black uppercase tracking-wider transition-all duration-200 ${
                                                    activeCategory === cat 
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-blue-400'
                                                }`}
                                            >
                                                {cat} Reports
                                            </Button>
                                        ))}
                                    </div>

                                    <div className="flex flex-col md:flex-row gap-4 items-center">
                                        <div className="relative flex-1 w-full">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <Input 
                                                placeholder="Search by report name or code..." 
                                                className="pl-10 h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                                                value={search}
                                                onChange={(e) => setSearch(e.target.value)}
                                            />
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-between md:justify-end">
                                            {activeCategory === "Inspection" && (
                                                <Tabs value={activeMode} onValueChange={setActiveMode} className="w-full md:w-auto">
                                                    <TabsList className="bg-slate-200/50 dark:bg-slate-800 h-11 p-1 gap-1">
                                                        <TabsTrigger value="ALL" className="px-5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm">All Modes</TabsTrigger>
                                                        <TabsTrigger value="ROV" className="px-5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-blue-600 data-[state=active]:text-white flex gap-1.5">
                                                            <Cpu className="w-3.5 h-3.5" /> ROV
                                                        </TabsTrigger>
                                                        <TabsTrigger value="DIVING" className="px-5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-emerald-600 data-[state=active]:text-white flex gap-1.5">
                                                            <Waves className="w-3.5 h-3.5" /> Diving
                                                        </TabsTrigger>
                                                    </TabsList>
                                                </Tabs>
                                            )}

                                            <Button
                                                type="button"
                                                variant={showAllTemplates ? "secondary" : "outline"}
                                                onClick={() => setShowAllTemplates(prev => !prev)}
                                                className={`h-11 px-3.5 gap-2 text-[10px] font-black uppercase tracking-wider rounded-lg border transition-all ${
                                                    showAllTemplates
                                                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25 shadow-sm"
                                                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 shadow-sm"
                                                }`}
                                                title={showAllTemplates ? "Showing all templates. Click to show only templates with inspection data." : "Currently showing templates with data. Click to show all."}
                                            >
                                                {showAllTemplates ? (
                                                    <>
                                                        <EyeOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                                        <span className="hidden sm:inline">Show Available Only</span>
                                                        <span className="sm:hidden">Available</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                                                        <span className="hidden sm:inline">Show All Templates</span>
                                                        <span className="sm:hidden">Show All</span>
                                                        {hiddenUnavailableCount > 0 && (
                                                            <Badge variant="secondary" className="px-1.5 py-0 text-[9px] font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                                +{hiddenUnavailableCount}
                                                            </Badge>
                                                        )}
                                                    </>
                                                )}
                                            </Button>

                                            <div className="flex items-center gap-1 bg-slate-200/50 dark:bg-slate-800 p-1 rounded-lg h-11">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setViewMode("card")}
                                                    className={`h-9 w-9 p-0 rounded-md transition-all ${
                                                        viewMode === "card"
                                                            ? "bg-white dark:bg-slate-700 shadow-sm text-slate-950 dark:text-white"
                                                            : "text-slate-500 hover:bg-slate-300/30 dark:hover:bg-slate-700/30"
                                                    }`}
                                                >
                                                    <LayoutGrid className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setViewMode("table")}
                                                    className={`h-9 w-9 p-0 rounded-md transition-all ${
                                                        viewMode === "table"
                                                            ? "bg-white dark:bg-slate-700 shadow-sm text-slate-950 dark:text-white"
                                                            : "text-slate-500 hover:bg-slate-300/30 dark:hover:bg-slate-700/30"
                                                    }`}
                                                >
                                                    <List className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <ScrollArea className="flex-1 -mr-2 pr-4 mt-4">
                                    {filteredTemplates.length > 0 ? (
                                        <div className="space-y-6 pb-4">
                                            {!showAllTemplates && hiddenUnavailableCount > 0 && (
                                                <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-[11px]">
                                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                                                        <span>Displaying <strong>{filteredTemplates.length}</strong> active template{filteredTemplates.length === 1 ? '' : 's'} with recorded data</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowAllTemplates(true)}
                                                        className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer flex items-center gap-1 text-[11px]"
                                                    >
                                                        Show {hiddenUnavailableCount} hidden template{hiddenUnavailableCount === 1 ? '' : 's'} without data &rarr;
                                                    </button>
                                                </div>
                                            )}

                                            {groupedTemplates.map((group) => (
                                                <div key={group.label} className="space-y-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800" />
                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${group.colorClass} flex items-center gap-2`}>
                                                            {group.icon} {group.label}
                                                        </span>
                                                        <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800" />
                                                    </div>

                                                    {viewMode === "card" ? (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                            {group.templates.map((template) => (
                                                                <TemplateCard key={template.id} template={template} onSelect={handleTemplateSelect} getIcon={getIcon} />
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
                                                            <Table>
                                                                <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                                                    <TableRow>
                                                                        <TableHead className="w-[80px]">Code</TableHead>
                                                                        <TableHead>Template Name</TableHead>
                                                                        <TableHead className="hidden md:table-cell">Description</TableHead>
                                                                        <TableHead className="w-[120px]">Category</TableHead>
                                                                        <TableHead className="w-[120px] text-right">Status</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {group.templates.map((template) => (
                                                                        <TableRow 
                                                                            key={template.id}
                                                                            className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors ${
                                                                                !template.available ? "opacity-60 grayscale cursor-not-allowed bg-slate-50/50 dark:bg-slate-950" : ""
                                                                            }`}
                                                                            onClick={() => {
                                                                                if (template.available) {
                                                                                    handleTemplateSelect(template);
                                                                                }
                                                                            }}
                                                                        >
                                                                            <TableCell>
                                                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                                                                                    {template.code}
                                                                                </span>
                                                                            </TableCell>
                                                                            <TableCell className="font-bold text-slate-800 dark:text-slate-100">
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className="p-1 rounded bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                                                                                        {getIcon(template.category)}
                                                                                    </div>
                                                                                    {template.name}
                                                                                </div>
                                                                            </TableCell>
                                                                            <TableCell className="text-slate-500 dark:text-slate-400 text-xs hidden md:table-cell">
                                                                                {template.description}
                                                                            </TableCell>
                                                                            <TableCell className="text-slate-500 dark:text-slate-400 text-xs">
                                                                                <Badge variant="outline" className="text-[9px] font-bold tracking-wider uppercase">
                                                                                    {template.category}
                                                                                </Badge>
                                                                            </TableCell>
                                                                            <TableCell className="text-right">
                                                                                {template.available ? (
                                                                                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-250 dark:border-emerald-800 text-[9px] font-black tracking-wide">
                                                                                        Available
                                                                                    </Badge>
                                                                                ) : (
                                                                                    <span className="text-[10px] text-amber-600 dark:text-amber-500 italic font-bold">
                                                                                        No Records
                                                                                    </span>
                                                                                )}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-16 text-center">
                                            <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-900 mb-4">
                                                <Search className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                                            </div>
                                            <h3 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-1">
                                                {search.trim() ? "No matching templates found" : "No templates with inspection data"}
                                            </h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4">
                                                {search.trim()
                                                    ? (searchHiddenCount > 0 
                                                        ? `Found ${searchHiddenCount} hidden template(s) without inspection records matching "${search}".` 
                                                        : `No templates matched your search "${search}".`)
                                                    : `There are currently no recorded inspection data entries for ${activeCategory} templates in this job.`}
                                            </p>
                                            <div className="flex flex-wrap items-center justify-center gap-2">
                                                {hiddenUnavailableCount > 0 && !showAllTemplates && (
                                                    <Button 
                                                        variant="default" 
                                                        size="sm" 
                                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                                                        onClick={() => setShowAllTemplates(true)}
                                                    >
                                                        <Eye className="w-3.5 h-3.5 mr-1.5" />
                                                        Show All {hiddenUnavailableCount} Templates (Including Empty)
                                                    </Button>
                                                )}
                                                {(search.trim() || activeMode !== "ALL" || showAllTemplates) && (
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="text-xs font-bold"
                                                        onClick={() => { setSearch(""); setActiveMode("ALL"); setShowAllTemplates(false); }}
                                                    >
                                                        Clear Filters
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </ScrollArea>
                            </motion.div>
                        )}

                        {currentStep === 2 && (
                            <motion.div 
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="absolute inset-0 p-6 flex flex-col gap-8 items-center justify-center overflow-y-auto"
                            >
                                <div className="max-w-md w-full space-y-6">
                                    <div className="text-center">
                                        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Report Context</h2>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Verify structural and job information</p>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center gap-4">
                                            <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600">
                                                <Grid3X3 className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Structure</Label>
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase">{headerData?.platformName || "No Structure Selected"}</p>
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center gap-4">
                                            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600">
                                                <Layers className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Job Pack Reference</Label>
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{headerData?.jobpackName || "No Job Pack Selected"}</p>
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center gap-4">
                                            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SOW Record Count</Label>
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                                    {selectedTemplate 
                                                        ? `${getMatchingRecordsForTemplate(selectedTemplate, currentRecords).length} / ${currentRecords.length} Matching Records` 
                                                        : `${currentRecords.length} Records Identified`}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 flex gap-3">
                                        <Activity className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-blue-800 dark:text-blue-300 font-medium leading-relaxed">
                                            The system will automatically filter inspection results to match the current structural context and active Job Pack.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {currentStep === 3 && (
                             <motion.div 
                                 key="step3"
                                 initial={{ opacity: 0, x: 20 }}
                                 animate={{ opacity: 1, x: 0 }}
                                 exit={{ opacity: 0, x: -20 }}
                                 className="absolute inset-0 p-6 flex flex-col gap-8 items-center justify-center overflow-y-auto"
                             >
                                 <div className="max-w-lg w-full space-y-6">
                                     <div className="text-center">
                                         <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Configuration</h2>
                                         <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Fine-tune your report output</p>
                                     </div>

                                     {/* General Info / Report Prefix Section */}
                                     <div className="space-y-4">
                                         <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-850">
                                             <span className="text-xs font-black uppercase text-slate-400 tracking-wider">General Info</span>
                                         </div>
                                         <div className="grid grid-cols-3 gap-3 items-center">
                                             <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Report Prefix / No.</Label>
                                             <Input 
                                                 value={config.reportNoPrefix || headerData?.sowReportNo || ""}
                                                 onChange={(e) => setConfig({
                                                     ...config,
                                                     reportNoPrefix: e.target.value
                                                 })}
                                                 placeholder="e.g. SOW-2026-01" 
                                                 className="col-span-2 h-10 bg-white dark:bg-slate-950 text-xs font-bold"
                                             />
                                         </div>
                                     </div>

                                     {/* Signatory Section */}
                                     <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                                         <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-850">
                                             <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Signatory Settings</span>
                                             <div className="flex items-center gap-2">
                                                 <Label htmlFor="print-signatures" className="text-[10px] font-bold text-slate-500 uppercase">Print Signatory Block</Label>
                                                 <Switch 
                                                     id="print-signatures"
                                                     checked={config.showSignatures !== false}
                                                     onCheckedChange={(checked) => setConfig({ ...config, showSignatures: checked })}
                                                 />
                                             </div>
                                         </div>

                                         {config.showSignatures !== false && (
                                             <div className="space-y-4 animate-in fade-in duration-200">
                                                 {/* Prepared By */}
                                                 <div className="grid grid-cols-3 gap-3 items-center">
                                                     <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prepared By</Label>
                                                     <Input 
                                                         value={config.preparedBy?.name || ""}
                                                         onChange={(e) => setConfig({
                                                             ...config,
                                                             preparedBy: { ...(config.preparedBy || {}), name: e.target.value }
                                                         })}
                                                         placeholder="Inspector Name" 
                                                         className="h-10 bg-white dark:bg-slate-950 text-xs font-bold"
                                                     />
                                                     <Input 
                                                         type="date"
                                                         value={config.preparedBy?.date || ""}
                                                         onChange={(e) => setConfig({
                                                             ...config,
                                                             preparedBy: { ...(config.preparedBy || {}), date: e.target.value }
                                                         })}
                                                         className="h-10 bg-white dark:bg-slate-950 text-xs font-bold"
                                                     />
                                                 </div>

                                                 {/* Reviewed By */}
                                                 <div className="grid grid-cols-3 gap-3 items-center">
                                                     <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reviewed By</Label>
                                                     <Input 
                                                         value={config.reviewedBy?.name || ""}
                                                         onChange={(e) => setConfig({
                                                             ...config,
                                                             reviewedBy: { ...(config.reviewedBy || {}), name: e.target.value }
                                                         })}
                                                         placeholder="Reviewer Name" 
                                                         className="h-10 bg-white dark:bg-slate-950 text-xs font-bold"
                                                     />
                                                     <Input 
                                                         type="date"
                                                         value={config.reviewedBy?.date || ""}
                                                         onChange={(e) => setConfig({
                                                             ...config,
                                                             reviewedBy: { ...(config.reviewedBy || {}), date: e.target.value }
                                                         })}
                                                         className="h-10 bg-white dark:bg-slate-950 text-xs font-bold"
                                                     />
                                                 </div>

                                                 {/* Approved By */}
                                                 <div className="grid grid-cols-3 gap-3 items-center">
                                                     <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Approved By</Label>
                                                     <Input 
                                                         value={config.approvedBy?.name || ""}
                                                         onChange={(e) => setConfig({
                                                             ...config,
                                                             approvedBy: { ...(config.approvedBy || {}), name: e.target.value }
                                                         })}
                                                         placeholder="Approver Name" 
                                                         className="h-10 bg-white dark:bg-slate-950 text-xs font-bold"
                                                     />
                                                     <Input 
                                                         type="date"
                                                         value={config.approvedBy?.date || ""}
                                                         onChange={(e) => setConfig({
                                                             ...config,
                                                             approvedBy: { ...(config.approvedBy || {}), date: e.target.value }
                                                         })}
                                                         className="h-10 bg-white dark:bg-slate-950 text-xs font-bold"
                                                     />
                                                 </div>
                                             </div>
                                         )}
                                     </div>

                                     {/* Watermark Section */}
                                     <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                                         <div className="flex items-center justify-between pb-2">
                                             <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Watermark Settings</span>
                                             <div className="flex items-center gap-2">
                                                 <Label htmlFor="print-watermark" className="text-[10px] font-bold text-slate-500 uppercase">Print Watermark</Label>
                                                 <Switch 
                                                     id="print-watermark"
                                                     checked={config.watermark?.enabled || false}
                                                     onCheckedChange={(checked) => setConfig({
                                                         ...config,
                                                         watermark: { ...(config.watermark || {}), enabled: checked }
                                                     })}
                                                 />
                                             </div>
                                         </div>

                                         {config.watermark?.enabled && (
                                             <div className="space-y-4 animate-in fade-in duration-200">
                                                 <div className="grid grid-cols-2 gap-4">
                                                     <div className="space-y-2">
                                                         <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Watermark Text</Label>
                                                         <Input 
                                                             value={config.watermark?.text || ""}
                                                             onChange={(e) => setConfig({
                                                                 ...config,
                                                                 watermark: { ...(config.watermark || {}), text: e.target.value }
                                                             })}
                                                             placeholder="e.g. DRAFT" 
                                                             className="h-10 bg-white dark:bg-slate-950 font-black text-xs uppercase"
                                                         />
                                                     </div>

                                                     <div className="space-y-2">
                                                         <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Watermark Color</Label>
                                                         <Select
                                                             value={config.watermark?.color || "gray"}
                                                             onValueChange={(val) => setConfig({
                                                                 ...config,
                                                                 watermark: { ...(config.watermark || {}), color: val }
                                                             })}
                                                         >
                                                             <SelectTrigger className="h-10 bg-white dark:bg-slate-950 text-xs font-bold">
                                                                 <SelectValue placeholder="Select color" />
                                                             </SelectTrigger>
                                                             <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                                                                 <SelectItem value="gray" className="text-xs font-bold">Transparent Gray</SelectItem>
                                                                 <SelectItem value="red" className="text-xs font-bold text-red-500">Transparent Red</SelectItem>
                                                                 <SelectItem value="blue" className="text-xs font-bold text-blue-500">Transparent Blue</SelectItem>
                                                             </SelectContent>
                                                         </Select>
                                                     </div>
                                                 </div>

                                                 <div className="space-y-2">
                                                     <div className="flex justify-between items-center">
                                                         <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">How dark it appears (transparency)</Label>
                                                         <span className="text-[10px] font-bold text-slate-500">{Math.round((config.watermark?.transparency || 0.15) * 100)}%</span>
                                                     </div>
                                                     <Slider
                                                         value={[(config.watermark?.transparency || 0.15) * 100]}
                                                         onValueChange={(vals) => setConfig({
                                                             ...config,
                                                             watermark: { ...(config.watermark || {}), transparency: vals[0] / 100 }
                                                         })}
                                                         max={80}
                                                         min={5}
                                                         step={5}
                                                     />
                                                 </div>
                                             </div>
                                         )}
                                     </div>
                                 </div>
                             </motion.div>
                        )}

                        {currentStep === 4 && (
                            <motion.div 
                                key="step4"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="absolute inset-0 p-6 flex flex-col gap-8 items-center justify-center overflow-y-auto"
                            >
                                <div className="max-w-lg w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl shrink-0">
                                    <div className="bg-slate-900 p-6 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400">
                                                <Printer className="w-5 h-5" />
                                            </div>
                                            <h3 className="text-white font-black uppercase tracking-widest text-sm">Final Preview</h3>
                                        </div>
                                        <Badge className="bg-blue-600 text-[9px] font-black px-2">READY</Badge>
                                    </div>
                                    
                                    <div className="p-8 space-y-6">
                                        <div className="flex gap-4">
                                            <div className="w-16 h-20 bg-slate-100 dark:bg-slate-900 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800">
                                                <FileText className="w-6 h-6 text-slate-300" />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">{selectedTemplate?.name}</h4>
                                                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">{selectedTemplate?.code} • {selectedTemplate?.category}</p>
                                                <div className="mt-2 flex gap-2">
                                                    <Badge variant="outline" className="text-[8px] bg-blue-50 text-blue-600 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800">{selectedTemplate?.mode}</Badge>
                                                    <Badge variant="outline" className="text-[8px] bg-slate-50 text-slate-600 dark:bg-slate-800 border-slate-200 dark:border-slate-800">PDF FORMAT</Badge>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-y-4 gap-x-8 pt-4 border-t border-slate-100 dark:border-slate-900">
                                             <div>
                                                 <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Filtered Records</Label>
                                                 <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                     {selectedTemplate ? `${getMatchingRecordsForTemplate(selectedTemplate, currentRecords).length} Items` : "0 Items"}
                                                 </p>
                                             </div>
                                             <div>
                                                 <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Watermark</Label>
                                                 <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                     {config.watermark?.enabled ? `${config.watermark.text} (${Math.round((config.watermark.transparency || 0.15) * 100)}% opacity)` : "None"}
                                                 </p>
                                             </div>
                                             <div>
                                                 <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Inspector (Prepared By)</Label>
                                                 <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{config.preparedBy?.name || "Not Specified"}</p>
                                             </div>
                                             <div>
                                                 <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</Label>
                                                 <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                     {(() => {
                                                         const dateStr = config.preparedBy?.date;
                                                         if (!dateStr) return new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
                                                         const parts = dateStr.split("-");
                                                         if (parts.length === 3) {
                                                             return `${parts[2]}-${parts[1]}-${parts[0]}`;
                                                         }
                                                         return dateStr;
                                                     })()}
                                                 </p>
                                             </div>
                                         </div>

                                        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 flex gap-3">
                                            <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                                            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                                                All validations passed. The report will be compiled with active structural filters and anomaly highlights.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-900 bg-slate-50 dark:bg-slate-950 flex justify-between items-center shrink-0">
                    <div className="flex gap-2">
                        {currentStep > 1 && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handlePrevStep}
                                className="text-[10px] font-black uppercase tracking-widest h-9 px-4 rounded-full"
                            >
                                <ChevronLeft className="w-4 h-4 mr-1" /> Back
                            </Button>
                        )}
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                                onOpenChange(false);
                                if (propSetCurrentStep) {
                                    propSetCurrentStep(1);
                                }
                                if (propSetSelectedTemplate) {
                                    propSetSelectedTemplate(null);
                                }
                            }}
                            className="text-[10px] font-black uppercase tracking-widest h-9 px-6 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
                        >
                            Cancel Wizard
                        </Button>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {currentStep < 4 ? (
                            <Button 
                                disabled={!selectedTemplate}
                                onClick={handleNextStep}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest h-9 px-6 rounded-full shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                            >
                                Continue <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        ) : (
                            <Button 
                                onClick={handleGenerate}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest h-9 px-8 rounded-full shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                            >
                                Generate Report <Check className="w-4 h-4 ml-1" />
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
