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
    Globe
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

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

interface ReportWizardDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    inspMethod: "ROV" | "DIVING";
    currentRecords: any[];
    allInspectionTypes: any[];
    headerData?: any;
    handlers: {
        generateRGVIReport: () => void;
        generateGVINSReport: () => void;
        generateBSINSReport: () => void;
        generateMPINSReport: () => void;
        generateSZONEReport: () => void;
        generateCPCLBReport: () => void;
        generateCPReport: () => void;
        generateUTCLBReport: () => void;
        generateAnodeReport: () => void;
        generateDivingAnodeReport: () => void;
        generatePhotographyReport: () => void;
        generatePhotographyLogReport: () => void;
        generateFMDReport: () => void;
        generateUTWTReport: () => void;
        generateMGIReport: () => void;
        generateSZCIReport: () => void;
        generateRSCORReport: () => void;
        generateRRISIReport: () => void;
        generateJTISIReport: () => void;
        generateITISIReport: () => void;
        generateRCASNReport: () => void;
        generateRCASNSketchReport: () => void;
        generateRCONDReport: () => void;
        generateRCONDSketchReport: () => void;
        generateBLReport: () => void;
        generateRGReport: () => void;
        generateSGReport: () => void;
        generateCUReport: () => void;
        generateSeabedReport: (templateId: string) => void;
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
    handlers
}: ReportWizardDialogProps) {
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState<string>("Inspection");
    const [activeMode, setActiveMode] = useState<string>("ALL");
    
    // Configuration State
    const [config, setConfig] = useState({
        preparedBy: "",
        reviewedBy: "",
        watermark: "DRAFT",
        includeImages: true,
        includeAnomalies: true
    });

    const templates: ReportTemplate[] = useMemo(() => {
        const hasRecords = (codes: string[]) => 
            currentRecords.some(r => codes.includes((r.inspection_type_code || r.inspection_type?.code || "").toUpperCase()));

        const baseTemplates: ReportTemplate[] = [
            // ── INSPECTION REPORTS (ROV) ───────────────────────────────────────────
            { id: 'rgvi', code: 'RGVI', name: 'General Visual (GVI)', description: 'Full visual assessment of structural integrity and coatings.', mode: 'ROV', category: 'Inspection', handler: handlers.generateRGVIReport, available: hasRecords(['RGVI']) },
            { id: 'cp_rov', code: 'CP', name: 'CP Survey Report', description: 'Cathodic protection potential readings and anode depletion.', mode: 'ROV', category: 'Inspection', handler: handlers.generateCPReport, available: currentRecords.some(r => r.inspection_data?.cp_rdg !== undefined || r.inspection_data?.cp_reading_mv !== undefined) },
            { id: 'anode_rov', code: 'ANODE', name: 'Anode Survey', description: 'Detailed depletion measurements and attachment status.', mode: 'ROV', category: 'Inspection', handler: handlers.generateAnodeReport, available: currentRecords.some(r => (r.structure_components?.code || '').toUpperCase() === 'AN' || (r.structure_components?.metadata?.type || '').toUpperCase() === 'ANODE') },
            { id: 'video_log', code: 'VIDLOG', name: 'Video Log Report', description: 'Chronological log of video events with timecodes.', mode: 'ROV', category: 'Inspection', handler: handlers.generatePhotographyLogReport, available: true },
            { id: 'fmd_rov', code: 'RFMD', name: 'FMD Survey', description: 'Flooded Member Detection using ultrasonic or gamma methods.', mode: 'ROV', category: 'Inspection', handler: handlers.generateFMDReport, available: hasRecords(['RFMD']) },
            { id: 'utwt_rov', code: 'RUTWT', name: 'UTWT Survey', description: 'Ultrasonic Wall Thickness measurements of members.', mode: 'ROV', category: 'Inspection', handler: handlers.generateUTWTReport, available: hasRecords(['RUTWT']) },
            { id: 'seabed_rov', code: 'RSEAB', name: 'ROV Seabed Survey', description: 'Debris, gas seepage, and crater survey of the seabed.', mode: 'ROV', category: 'Inspection', handler: () => handlers.generateSeabedReport('seabed-survey-debris'), available: hasRecords(['RSEAB']) },

            // ── INSPECTION REPORTS (DIVING) ────────────────────────────────────────
            { id: 'dgvi', code: 'DGVI', name: 'Diver GVI', description: 'Diver visual assessment of structural integrity.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateRGVIReport, available: hasRecords(['DGVI']) },
            { id: 'gvins', code: 'GVINS', name: 'Diving GVI (GVINS)', description: 'General visual inspection report.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateGVINSReport, available: hasRecords(['GVINS']) },
            { id: 'bsins', code: 'BSINS', name: 'Diving Bolted Support (BSINS)', description: 'Detailed bolted support inspection.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateBSINSReport, available: hasRecords(['BSINS']) },
            { id: 'mpins', code: 'MPINS', name: 'Diving Magnetic Particle (MPINS)', description: 'Detailed magnetic particle inspection.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateMPINSReport, available: hasRecords(['MPINS']) },
            { id: 'szone', code: 'SZONE', name: 'Diving Splash Zone (SZONE)', description: 'Splash zone wall thickness and CP inspection summary with grouped clock positions', mode: 'DIVING', category: 'Inspection', handler: handlers.generateSZONEReport, available: hasRecords(['SZONE']) },
            { id: 'diver_log', code: 'DIVLOG', name: 'Diver Log Report', description: 'Chronological diver activities and findings per dive.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateFullInspectionReport, available: true },
            { id: 'cp_div', code: 'CP', name: 'Diving CP Survey', description: 'Diver-held CP probe measurements and potential readings.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateCPReport, available: currentRecords.some(r => r.inspection_data?.cp_rdg !== undefined || r.inspection_data?.cp_reading_mv !== undefined) },
            { id: 'cpclb', code: 'CPCLB', name: 'CP Calibration', description: 'Pre-dive and post-dive calibration records for CP probes.', mode: 'DIVING', category: 'Inspection', handler: handlers.generateCPCLBReport, available: hasRecords(['CPCLB']) },
            
            // ── INSPECTION REPORTS (BOTH / GENERAL) ────────────────────────────────
            { id: 'insp_report', code: 'INSP', name: 'Inspection Report', description: 'Detailed inspection findings, observations and results.', mode: 'BOTH', category: 'Inspection', handler: handlers.generateFullInspectionReport, available: currentRecords.length > 0 },
            { id: 'defect_summary', code: 'DEFECT', name: 'Defect Summary Report', description: 'Priority-ordered summary of all anomalies with status.', mode: 'BOTH', category: 'Inspection', handler: handlers.generateFullInspectionReport, available: currentRecords.some(r => r.has_anomaly) },
            { id: 'findings', code: 'FINDINGS', name: 'Findings Summary Report', description: 'Consolidated summary of all findings across the SOW.', mode: 'BOTH', category: 'Inspection', handler: handlers.generateFullInspectionReport, available: currentRecords.length > 0 },
            { id: 'anomaly', code: 'ANOM', name: 'Defect / Anomaly Report', description: 'Detailed defect and anomaly report including images.', mode: 'BOTH', category: 'Inspection', handler: handlers.generateFullInspectionReport, available: currentRecords.some(r => r.has_anomaly) },
            { id: 'photo', code: 'PHOTO', name: 'Photography Report', description: 'Visual documentation of all inspection points.', mode: 'BOTH', category: 'Inspection', handler: handlers.generatePhotographyReport, available: true },
            { id: 'compliance', code: 'COMP', name: 'Compliance Report', description: 'Regulatory compliance and standards documentation.', mode: 'BOTH', category: 'Inspection', handler: handlers.generateFullInspectionReport, available: true },

            // ── JOB PACK & STRUCTURE REPORTS ──────────────────────────────────────
            { id: 'jp_summary', code: 'JP_SUM', name: 'Job Pack Summary', description: 'Aggregated progress and status of the entire job pack.', mode: 'BOTH', category: 'Job Pack', handler: handlers.generateFullInspectionReport, available: true },
            { id: 'sow_report', code: 'SOW_REP', name: 'Scope of Work Report', description: 'Detailed tracking of SOW items and completion status.', mode: 'BOTH', category: 'Job Pack', handler: handlers.generateFullInspectionReport, available: true },
            { id: 'struct_over', code: 'STR_OVR', name: 'Structure Overview', description: 'Summary of all inspection work performed on this structure.', mode: 'BOTH', category: 'Structure', handler: handlers.generateFullInspectionReport, available: true },
            
            // ── FINAL REPORTS ──────────────────────────────────────────────────────
            { id: 'exec_sum', code: 'EXEC', name: 'Executive Summary', description: 'High-level management summary of the entire operation.', mode: 'BOTH', category: 'Final', handler: handlers.generateFullInspectionReport, available: true },
        ];

        // Add dynamic reports
        const dynamicReports: ReportTemplate[] = allInspectionTypes.filter(t => 
            !['RGVI', 'DGVI', 'GVINS', 'BSINS', 'SZONE', 'RSEAB', 'RMGI', 'DMGI', 'RFMD', 'DFMD', 'RSZCI', 'DSZCI', 'RUTWT', 'DUTWT', 'RSCOR', 'DSCOR', 'RRISI', 'DRISI', 'RCOND', 'DCOND', 'RCON', 'DCON', 'RG', 'SG', 'CU', 'BL', 'RISERGUARD', 'CAISSONGUARD', 'CONDUCTORGUARD'].includes(t.code) &&
            currentRecords.some(r => (r.inspection_type_id === t.id || r.inspection_type_code === t.code))
        ).map(t => ({
            id: t.id,
            code: t.code,
            name: t.name,
            description: `Dynamic report for ${t.name} records.`,
            mode: (t.code.startsWith('R') && t.code.length > 2) ? 'ROV' : (t.code.startsWith('D') && t.code.length > 2) ? 'DIVING' : 'BOTH',
            category: 'Inspection',
            handler: () => handlers.generateInspectionReportByType(t.id),
            available: true
        }));

        return [...baseTemplates, ...dynamicReports];
    }, [currentRecords, allInspectionTypes, handlers]);

    const filteredTemplates = useMemo(() => {
        return templates.filter(t => {
            const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || t.code.toLowerCase().includes(search.toLowerCase());
            const matchesCategory = t.category === activeCategory;
            const matchesMode = activeCategory !== "Inspection" || activeMode === "ALL" || t.mode === "BOTH" || t.mode === activeMode;
            return matchesSearch && matchesCategory && matchesMode;
        });
    }, [templates, search, activeCategory, activeMode]);

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
            // Reset wizard for next time
            setCurrentStep(1);
            setSelectedTemplate(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            onOpenChange(val);
            if (!val) {
                // Reset step when closed
                setTimeout(() => {
                    setCurrentStep(1);
                    setSelectedTemplate(null);
                }, 300);
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

                                        {activeCategory === "Inspection" && (
                                            <Tabs value={activeMode} onValueChange={setActiveMode} className="w-full md:w-auto">
                                                <TabsList className="bg-slate-200/50 dark:bg-slate-800 h-11 p-1 gap-1">
                                                    <TabsTrigger value="ALL" className="px-6 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm">All Modes</TabsTrigger>
                                                    <TabsTrigger value="ROV" className="px-6 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-blue-600 data-[state=active]:text-white flex gap-2">
                                                        <Cpu className="w-3.5 h-3.5" /> ROV
                                                    </TabsTrigger>
                                                    <TabsTrigger value="DIVING" className="px-6 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-emerald-600 data-[state=active]:text-white flex gap-2">
                                                        <Waves className="w-3.5 h-3.5" /> Diving
                                                    </TabsTrigger>
                                                </TabsList>
                                            </Tabs>
                                        )}
                                    </div>
                                </div>

                                <ScrollArea className="flex-1 -mr-2 pr-4 mt-4">
                                    {filteredTemplates.length > 0 ? (
                                        <div className="space-y-8 pb-4">
                                            {activeCategory === "Inspection" && activeMode === "ALL" ? (
                                                <>
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800" />
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 flex items-center gap-2">
                                                                <Cpu className="w-3.5 h-3.5" /> ROV Operations
                                                            </span>
                                                            <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800" />
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                            {filteredTemplates.filter(t => t.mode === 'ROV' || t.mode === 'BOTH').map((template) => (
                                                                <TemplateCard key={template.id} template={template} onSelect={handleTemplateSelect} getIcon={getIcon} />
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800" />
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                                                                <Waves className="w-3.5 h-3.5" /> Diving Operations
                                                            </span>
                                                            <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800" />
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                            {filteredTemplates.filter(t => t.mode === 'DIVING').map((template) => (
                                                                <TemplateCard key={template.id} template={template} onSelect={handleTemplateSelect} getIcon={getIcon} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {filteredTemplates.map((template) => (
                                                        <TemplateCard key={template.id} template={template} onSelect={handleTemplateSelect} getIcon={getIcon} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20 text-center">
                                            <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-900 mb-4">
                                                <Search className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                                            </div>
                                            <h3 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-1">No templates found</h3>
                                            <Button 
                                                variant="link" 
                                                className="mt-4 text-blue-600 dark:text-blue-400 font-bold"
                                                onClick={() => { setSearch(""); setActiveMode("ALL"); setActiveCategory("Inspection"); }}
                                            >
                                                Clear all filters
                                            </Button>
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
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{currentRecords.length} Records Identified</p>
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

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prepared By</Label>
                                            <Input 
                                                value={config.preparedBy}
                                                onChange={(e) => setConfig({...config, preparedBy: e.target.value})}
                                                placeholder="Inspector Name" 
                                                className="h-10 bg-white dark:bg-slate-950"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reviewed By</Label>
                                            <Input 
                                                value={config.reviewedBy}
                                                onChange={(e) => setConfig({...config, reviewedBy: e.target.value})}
                                                placeholder="Reviewer Name" 
                                                className="h-10 bg-white dark:bg-slate-950"
                                            />
                                        </div>
                                        <div className="space-y-2 col-span-2">
                                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Watermark Text</Label>
                                            <Input 
                                                value={config.watermark}
                                                onChange={(e) => setConfig({...config, watermark: e.target.value})}
                                                placeholder="DRAFT, CONFIDENTIAL, etc." 
                                                className="h-10 bg-white dark:bg-slate-950 font-black"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-2">
                                        <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                                            <div className="flex items-center gap-3">
                                                <Camera className="w-4 h-4 text-slate-400" />
                                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Include High-Res Images</span>
                                            </div>
                                            <div className="w-10 h-5 bg-blue-600 rounded-full relative">
                                                <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                                            <div className="flex items-center gap-3">
                                                <Activity className="w-4 h-4 text-slate-400" />
                                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Prioritize Anomaly Summary</span>
                                            </div>
                                            <div className="w-10 h-5 bg-blue-600 rounded-full relative">
                                                <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                                            </div>
                                        </div>
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
                                                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Records</Label>
                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{currentRecords.length} Items</p>
                                            </div>
                                            <div>
                                                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Watermark</Label>
                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{config.watermark || "None"}</p>
                                            </div>
                                            <div>
                                                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Inspector</Label>
                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{config.preparedBy || "Not Specified"}</p>
                                            </div>
                                            <div>
                                                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</Label>
                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{new Date().toLocaleDateString()}</p>
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
                        {currentStep === 1 ? (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => onOpenChange(false)}
                                className="text-[10px] font-black uppercase tracking-widest h-9 px-6 rounded-full border-slate-200 hover:bg-slate-100"
                            >
                                Cancel Wizard
                            </Button>
                        ) : (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handlePrevStep}
                                className="text-[10px] font-black uppercase tracking-widest h-9 px-4 rounded-full"
                            >
                                <ChevronLeft className="w-4 h-4 mr-1" /> Back
                            </Button>
                        )}
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
