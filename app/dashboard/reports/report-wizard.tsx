"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronRight,
    ChevronLeft,
    Check,
    FileText,
    Building2,
    Layers,
    Package,
    Calendar,
    CheckSquare,
    Wrench,
    FileBarChart,
    Printer,
    Download,
    Share2,
    Eye,
    Settings,
    User,
    FileCheck,
    Search,
    X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { generateWorkScopeReport } from "@/utils/report-generators/work-scope-report";
import { generateSeabedSurveyReport } from "@/utils/report-generators/seabed-survey-report";
import { generateROVAnodeReport } from "@/utils/report-generators/rov-anode-report";
import { generateROVCasnReport } from "@/utils/report-generators/rov-rcasn-report";
import { generateROVCasnSketchReport } from "@/utils/report-generators/rov-rcasn-sketch-report";

// Types
type WizardStep = "template" | "context" | "configuration" | "preview";

interface ReportWizardProps {
    onClose: () => void;
}

interface ReportConfig {
    reportNoPrefix: string;
    reportYear: string;
    preparedBy: { name: string; date: string };
    reviewedBy: { name: string; date: string };
    approvedBy: { name: string; date: string };
    watermark: { enabled: boolean; text: string; transparency: number };
    showContractorLogo: boolean;
    showPageNumbers: boolean;
    printFriendly: boolean;
    showSignatures: boolean;
}

interface SelectionState {
    templateId: string;
    category: string;
    structureId: string;
    componentId: string;
    jobPackId: string;
    planningId: string;
    procedureId: string;
    sowReportNo: string;
}

// Report Templates Definition
const REPORT_TEMPLATES = {
    structure: [
        { id: "structure-summary", name: "Structure Summary Report", icon: Building2, description: "Complete overview of structure details and specifications", requires: ["structure"] },
        { id: "component-catalog", name: "Component Catalogue", icon: Layers, description: "Detailed list of all components with specifications", requires: ["structure"] },
        { id: "technical-specs", name: "Technical Specifications", icon: FileBarChart, description: "Technical data and engineering specifications", requires: ["structure"] },
        { id: "component-spec", name: "Component Data Sheet", icon: FileText, description: "Individual technical data sheet for specific components", requires: ["structure", "component"] },
    ],
    jobpack: [
        { id: "jobpack-summary", name: "Job Pack Summary", icon: Package, description: "Overview of job pack details and assignments", requires: ["jobpack"] },
        { id: "work-scope-report", name: "Work Scope Report", icon: Wrench, description: "Detailed work scope for a specific platform", requires: ["jobpack", "structure"] },
        { id: "work-scope-status", name: "Work Scope Status Summary", icon: FileBarChart, description: "Status completion summary with charts", requires: ["jobpack", "structure"] },
        { id: "work-scope-incomplete", name: "Work Scope Incomplete Status", icon: FileBarChart, description: "Incomplete status breakdown with charts", requires: ["jobpack", "structure"] },

    ],
    planning: [
        { id: "inspection-schedule", name: "Inspection Schedule", icon: Calendar, description: "Planned inspection timeline and milestones", requires: ["planning"] },
        { id: "planning-overview", name: "Planning Overview", icon: FileText, description: "Complete planning documentation", requires: ["planning"] },
    ],
    inspection: [
        { id: "inspection-report", name: "Inspection Report", icon: CheckSquare, description: "Detailed inspection findings and results", requires: ["jobpack"] },
        { id: "defect-summary", name: "Defect Summary Report", icon: FileBarChart, description: "Priority-ordered summary of all anomalies with colour coding and rectification status", requires: ["jobpack", "structure", "sow_report"] },
        { id: "findings-summary", name: "Findings Summary Report", icon: FileBarChart, description: "Priority-ordered summary of all findings with colour coding and rectification status", requires: ["jobpack", "structure", "sow_report"] },
        { id: "compliance-report", name: "Compliance Report", icon: FileText, description: "Regulatory compliance documentation", requires: ["jobpack"] },
        { id: "defect-anomaly-report", name: "Defect / Anomaly Report", icon: FileCheck, description: "Detailed defect and anomaly report with images", requires: ["jobpack", "structure", "sow_report"] },
        { id: "findings-report", name: "Findings Report", icon: FileCheck, description: "Detailed findings report with images", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diver-log-report", name: "Diver Log Report", icon: FileText, description: "Chronological diver log grouped by dive number with inspection findings", requires: ["jobpack", "structure", "sow_report"] },
        { id: "video-log-report", name: "Video Log Report", icon: FileText, description: "Video log entries grouped by tape number with timecodes and dive references", requires: ["jobpack", "structure", "sow_report"] },
        { id: "seabed-survey-debris", name: "Seabed Survey For Debris", icon: FileCheck, description: "Filtered Seabed GUI maps with debris items marked", requires: ["jobpack", "structure", "sow_report"] },
        { id: "seabed-survey-gas", name: "Seabed Survey For Gas Seepage", icon: FileCheck, description: "Filtered Seabed GUI maps with gas seepages marked", requires: ["jobpack", "structure", "sow_report"] },
        { id: "seabed-survey-crater", name: "Seabed Survey For Crater", icon: FileCheck, description: "Filtered Seabed GUI maps with craters marked", requires: ["jobpack", "structure", "sow_report"] },
        { id: "mgi-report", name: "ROV MGI Survey Report", icon: FileBarChart, description: "Vertical profile of marine growth thickness vs allowable thresholds", requires: ["jobpack", "structure", "sow_report"] },
        { id: "fmd-report", name: "ROV FMD Survey Report", icon: FileText, description: "Flooded Member Detection summary report with QID, Elevation, Dive and Tape details", requires: ["jobpack", "structure", "sow_report"] },
        { id: "szci-report", name: "ROV Splash Zone Inspection", icon: FileBarChart, description: "Splash zone wall thickness and CP inspection summary with clock positions", requires: ["jobpack", "structure", "sow_report"] },
        { id: "utwt-report", name: "ROV UT Thickness Report", icon: FileText, description: "Detailed ROV UT wall thickness report with 4 clock positions and elevation reference", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rrisi-report", name: "ROV Riser Survey Report", icon: FileBarChart, description: "Detailed ROV riser structural integrity inspection with graphical elevation profiles", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-jtisi-report", name: "ROV J-Tube Inspection Report", icon: FileBarChart, description: "Detailed ROV J-Tube structural integrity inspection with graphical elevation profiles", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-itisi-report", name: "ROV I-Tube Inspection Report", icon: FileBarChart, description: "Detailed ROV I-Tube structural integrity inspection with graphical elevation profiles", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-scour-report", name: "ROV Scour Survey Report", icon: FileBarChart, description: "Detailed ROV scour survey of horizontal members with graphical mudline profiles", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-anode-report", name: "ROV Anode Inspection Report", icon: FileBarChart, description: "Detailed ROV anode inspection summary with CP, depletion, and structural references", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-cp-report",    name: "ROV CP Survey Report",         icon: FileBarChart, description: "Portrait CP survey report with primary + additional CP readings, anomaly refs and rectification remarks", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-rgvi-report",  name: "ROV GVI Report (RGVI)",        icon: FileBarChart, description: "Portrait General Visual Inspection report — marine growth, condition, CP, debris and anomaly findings", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-rcasn-report", name: "ROV Caisson Survey Report",    icon: FileBarChart, description: "Portrait Caisson Survey report — grouped by Caisson with CP, condition, and findings", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-rcond-report", name: "ROV Conductor Survey Report",  icon: FileBarChart, description: "Portrait Conductor Survey report — grouped by Conductor (CD) with CP, condition, and findings", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-rcasn-sketch-report", name: "ROV Caisson Survey (Sketch) Report", icon: FileBarChart, description: "Detailed ROV Caisson inspection with graphical elevation profiles and terminator sketch", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-rcond-sketch-report", name: "ROV Conductor Survey (Sketch) Report", icon: FileBarChart, description: "Detailed ROV Conductor inspection with graphical elevation profiles", requires: ["jobpack", "structure", "sow_report"] },
    ],
    others: [
        { id: "defect-criteria-report", name: "Defect Criteria Report", icon: FileCheck, description: "Complete specification of all defect criteria rules by procedure", requires: ["procedure"] },
    ],
};

export function ReportWizard({ onClose }: ReportWizardProps) {
    const [step, setStep] = useState<WizardStep>("template");
    const [selections, setSelections] = useState<SelectionState>({
        templateId: "",
        category: "",
        structureId: "",
        componentId: "",
        jobPackId: "",
        planningId: "",
        procedureId: "",
        sowReportNo: "",
    });

    // Default Configuration
    const [config, setConfig] = useState<ReportConfig>({
        reportNoPrefix: "RPT",
        reportYear: new Date().getFullYear().toString(),
        preparedBy: { name: "", date: new Date().toISOString().split('T')[0] },
        reviewedBy: { name: "", date: "" },
        approvedBy: { name: "", date: "" },
        watermark: { enabled: true, text: "DRAFT", transparency: 0.1 },
        showContractorLogo: true,
        showPageNumbers: true,
        printFriendly: false,
        showSignatures: true,
    });

    // Data Fetching
    const { data: structuresData } = useSWR("/api/structures", fetcher);
    const structures = structuresData?.data || [];

    // Inspection-specific categories that should only show jobpacks with inspection data
    const INSPECTION_CATEGORIES = ["inspection"];
    const isInspectionTemplate = INSPECTION_CATEGORIES.includes(selections.category);

    // Data Fetching for JobPacks - two variants
    const { data: allJobPacksData } = useSWR("/api/jobpack?limit=1000", fetcher);
    const { data: inspJobPacksData } = useSWR("/api/jobpack?limit=1000&has_inspection=true", fetcher);

    // Show only jobpacks with inspection data for inspection report templates
    const jobPacks = isInspectionTemplate
        ? (inspJobPacksData?.data || [])
        : (allJobPacksData?.data || []);

    const plannings = [
        { id: "1", name: "Q1 2024 Inspection Plan" },
        { id: "2", name: "Q2 2024 Inspection Plan" },
    ];

    const [availableComponents, setAvailableComponents] = useState<any[]>([]);
    const [isLoadingComponents, setIsLoadingComponents] = useState(false);
    const [componentSearch, setComponentSearch] = useState("");
    const [structureSearch, setStructureSearch] = useState("");
    const [jobPackSearch, setJobPackSearch] = useState("");
    const [availableSowReports, setAvailableSowReports] = useState<string[]>([]);
    const [isLoadingSowReports, setIsLoadingSowReports] = useState(false);

    // Filter state for inspection reports
    const [inspectionFilters, setInspectionFilters] = useState<{ structure_id: number; sow_report_no: string }[]>([]);

    // Fetch inspection filters when jobpack is selected and it's an inspection template
    useEffect(() => {
        if (selections.jobPackId && isInspectionTemplate) {
            fetch(`/api/reports/inspection-filters?jobpack_id=${selections.jobPackId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.data) {
                        setInspectionFilters(data.data);
                    } else {
                        setInspectionFilters([]);
                    }
                })
                .catch(err => {
                    console.error("Error fetching inspection filters:", err);
                    setInspectionFilters([]);
                });
        } else {
            setInspectionFilters([]);
        }
    }, [selections.jobPackId, isInspectionTemplate]);

    // Fetch procedures for Defect Criteria
    const { data: proceduresData } = useSWR("/api/defect-criteria/procedures", fetcher);
    // Sort logic for procedures could be here or rely on API sort
    const defectProcedures = proceduresData || [];

    // Fetch components when structure changes if needed
    useEffect(() => {
        if (selections.structureId && getCurrentTemplate()?.requires.includes("component")) {
            setIsLoadingComponents(true);
            fetch(`/api/structure-components/${selections.structureId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.data) setAvailableComponents(data.data);
                })
                .catch(err => console.error(err))
                .finally(() => setIsLoadingComponents(false));
        }
    }, [selections.structureId, selections.templateId]);

    // Fetch SOW Reports when JobPack and Structure are selected
    useEffect(() => {
        if (selections.jobPackId && selections.structureId && getCurrentTemplate()?.requires.includes("sow_report")) {
            if (isInspectionTemplate) {
                // If inspection template, ONLY show SOW reports that have actual inspection data for this structure
                const validSows = inspectionFilters
                    .filter(f => f.structure_id.toString() === selections.structureId && f.sow_report_no)
                    .map(f => f.sow_report_no);
                setAvailableSowReports(Array.from(new Set(validSows)));
                setIsLoadingSowReports(false);
            } else {
                setIsLoadingSowReports(true);
                fetch(`/api/sow?jobpack_id=${selections.jobPackId}&structure_id=${selections.structureId}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.data) {
                            // Assuming data.data.report_numbers is array of { number: string } or similar
                            // Fallback to empty array if not present
                            const numbers = data.data.report_numbers?.map((r: any) => r.number || r) || [];
                            setAvailableSowReports(numbers);
                        } else {
                            setAvailableSowReports([]);
                        }
                    })
                    .catch(err => {
                        console.error("Error fetching SOW reports:", err);
                        setAvailableSowReports([]);
                    })
                    .finally(() => setIsLoadingSowReports(false));
            }
        }
    }, [selections.jobPackId, selections.structureId, selections.templateId, isInspectionTemplate, inspectionFilters]);

    const getCurrentTemplate = () => {
        if (!selections.category || !selections.templateId) return null;
        return (REPORT_TEMPLATES as any)[selections.category]?.find((t: any) => t.id === selections.templateId);
    };

    const handleNext = () => {
        if (step === "template") setStep("context");
        else if (step === "context") setStep("configuration");
        else if (step === "configuration") setStep("preview");
    };

    const handleBack = () => {
        if (step === "preview") {
            setStep("configuration");
            setPreviewUrl(null);
        }
        else if (step === "configuration") setStep("context");
        else if (step === "context") setStep("template");
    };

    const isStepValid = () => {
        if (step === "template") return !!selections.templateId;
        if (step === "context") {
            const template = getCurrentTemplate();
            if (!template) return false;

            let valid = true;
            if (template.requires.includes("structure") && !selections.structureId) valid = false;
            if (template.requires.includes("component") && !selections.componentId) valid = false;
            if (template.requires.includes("jobpack") && !selections.jobPackId) valid = false;
            if (template.requires.includes("planning") && !selections.planningId) valid = false;
            if (template.requires.includes("sow_report") && !selections.sowReportNo) valid = false;
            return valid;
        }
        return true;
    };

    // Filtered Components for Selection
    const filteredComponents = useMemo(() => {
        if (!componentSearch) return availableComponents;
        const lower = componentSearch.toLowerCase();
        return availableComponents.filter((c: any) =>
            c.name?.toLowerCase().includes(lower) ||
            c.q_id?.toLowerCase().includes(lower) ||
            c.type?.toLowerCase().includes(lower)
        );
    }, [availableComponents, componentSearch]);

    // Filtered Structures for Selection
    const filteredStructures = useMemo(() => {
        let result = structures;

        // Filter by JobPack if selected and template requires both
        if (selections.jobPackId && getCurrentTemplate()?.requires.includes("jobpack")) {
            const jp = jobPacks.find((j: any) => j.id.toString() === selections.jobPackId);
            if (jp && jp.metadata?.structures) {
                const structIds = jp.metadata.structures.map((s: any) => s.id);
                result = result.filter((s: any) => structIds.includes(s.id));
            }
        }

        // Apply inspection data filters if active
        if (isInspectionTemplate && inspectionFilters.length > 0) {
            const validStructureIds = Array.from(new Set(inspectionFilters.map(f => f.structure_id)));
            result = result.filter((s: any) => validStructureIds.includes(s.id));
        } else if (isInspectionTemplate && inspectionFilters.length === 0 && selections.jobPackId) {
            // If it's an inspection template and no inspection data exists, return empty
            result = [];
        }

        if (structureSearch) {
            const lower = structureSearch.toLowerCase();
            result = result.filter((s: any) =>
                s.str_name?.toLowerCase().includes(lower) ||
                s.str_type?.toLowerCase().includes(lower)
            );
        }
        return result;
    }, [structures, structureSearch, selections.jobPackId, jobPacks, isInspectionTemplate, inspectionFilters]);

    // Filtered Job Packs
    const filteredJobPacks = useMemo(() => {
        if (!jobPackSearch) return jobPacks;
        const lower = jobPackSearch.toLowerCase();
        return jobPacks.filter((jp: any) =>
            jp.name?.toLowerCase().includes(lower) ||
            jp.status?.toLowerCase().includes(lower)
        );
    }, [jobPacks, jobPackSearch]);

    // Category Selection State
    const [activeCategory, setActiveCategory] = useState<string>("Structure");

    // Render Steps
    const renderTemplateSelection = () => {
        const categories = {
            "Structure": REPORT_TEMPLATES.structure,
            "Job Pack": REPORT_TEMPLATES.jobpack || [],
            "Planning": REPORT_TEMPLATES.planning || [],
            "Inspection": REPORT_TEMPLATES.inspection || [],
            "Others": (REPORT_TEMPLATES as any).others || []
        };

        return (
            <div className="space-y-6">
                <div className="flex flex-col gap-4">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Select Report Type</h2>

                    {/* Category Tabs */}
                    <div className="flex flex-wrap gap-2">
                        {Object.keys(categories).map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`
                                    px-4 py-2 rounded-full text-sm font-medium transition-all
                                    ${activeCategory === cat
                                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"}
                                `}
                            >
                                {cat} Reports
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(categories[activeCategory as keyof typeof categories] || []).map((template: any) => (
                        <div
                            key={template.id}
                            onClick={() => {
                                const categoryMap: Record<string, string> = {
                                    "Structure": "structure",
                                    "Job Pack": "jobpack",
                                    "Planning": "planning",
                                    "Inspection": "inspection",
                                    "Others": "others"
                                };
                                setSelections({ ...selections, category: categoryMap[activeCategory] || "structure", templateId: template.id });
                            }}
                            className={`
                                cursor-pointer group relative overflow-hidden rounded-xl border-2 p-4 transition-all hover:shadow-lg
                                ${selections.templateId === template.id
                                    ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 shadow-md ring-1 ring-blue-500"
                                    : "border-slate-200 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800 bg-white dark:bg-slate-900"}
                            `}
                        >
                            <div className={`
                                mb-3 inline-flex rounded-lg p-2 transition-colors
                                ${selections.templateId === template.id ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900 group-hover:text-blue-600"}
                            `}>
                                <template.icon className="h-6 w-6" />
                            </div>
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">{template.name}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug">{template.description}</p>

                            {selections.templateId === template.id && (
                                <div className="absolute top-2 right-2 rounded-full bg-blue-500 p-1 text-white shadow-sm">
                                    <Check className="h-3 w-3" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderContextSelection = () => {
        const template = getCurrentTemplate();
        if (!template) return null;

        const reqs = template.requires;
        // Determine grid columns based on requirements to make it side-by-side
        const cols = Math.min(reqs.length, 3);

        const PanelContainer = ({ children, title, stepNum, disabled }: any) => (
            <div className={`flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 overflow-hidden h-[450px] transition-opacity ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="p-4 border-b bg-slate-50/50 dark:bg-slate-900/50">
                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 w-5 h-5 flex items-center justify-center rounded-full text-xs">{stepNum}</span>
                        {title}
                    </Label>
                </div>
                {children}
            </div>
        );

        let stepCounter = 1;

        return (
            <div className="space-y-6 max-w-6xl mx-auto w-full">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Select Data Source</h2>
                    <p className="text-slate-500">Choose the specific items to include in your {template.name}</p>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${cols} gap-6`}>

                    {reqs.includes("jobpack") && (
                        <PanelContainer title="Job Pack" stepNum={stepCounter++} disabled={false}>
                            <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Search job packs..."
                                        className="pl-9 bg-slate-50 dark:bg-slate-900 border-none"
                                        value={jobPackSearch}
                                        onChange={(e) => setJobPackSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/30 dark:bg-slate-900/20">
                                {filteredJobPacks.length === 0 ? (
                                    <div className="p-4 text-sm text-center text-muted-foreground mt-10">No job packs found</div>
                                ) : (
                                    filteredJobPacks.map((jp: any) => {
                                        const isSelected = selections.jobPackId === jp.id.toString();
                                        return (
                                            <div
                                                key={jp.id}
                                                onClick={() => setSelections({ ...selections, jobPackId: jp.id.toString(), structureId: "", componentId: "", sowReportNo: "" })}
                                                className={`
                                                    p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between group
                                                    ${isSelected
                                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm"
                                                        : "border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/50"}
                                                `}
                                            >
                                                <div className="overflow-hidden">
                                                    <div className={`font-medium text-sm truncate ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-300"}`}>{jp.name}</div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-white dark:bg-slate-900">{jp.status || "OPEN"}</Badge>
                                                    </div>
                                                </div>
                                                {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0 ml-2" />}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </PanelContainer>
                    )}

                    {reqs.includes("structure") && (
                        <PanelContainer
                            title="Structure"
                            stepNum={stepCounter++}
                            disabled={reqs.includes("jobpack") && !selections.jobPackId}
                        >
                            <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Search structures..."
                                        className="pl-9 bg-slate-50 dark:bg-slate-900 border-none"
                                        value={structureSearch}
                                        onChange={(e) => setStructureSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/30 dark:bg-slate-900/20">
                                {reqs.includes("jobpack") && !selections.jobPackId ? (
                                    <div className="p-4 text-sm text-center text-muted-foreground mt-10">Select a job pack first</div>
                                ) : (
                                    <>
                                        {/* Optional ALL STRUCTURES selection depending on template */}
                                        {["work-scope-report", "work-scope-status", "work-scope-incomplete"].includes(selections.templateId) && (
                                            <div
                                                onClick={() => setSelections({ ...selections, structureId: "all", componentId: "", sowReportNo: "" })}
                                                className={`
                                                    p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between mb-2
                                                    ${selections.structureId === "all"
                                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm"
                                                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-300"}
                                                `}
                                            >
                                                <div className="font-bold text-sm">ALL STRUCTURES</div>
                                                {selections.structureId === "all" && <Check className="h-4 w-4 text-blue-600 shrink-0 ml-2" />}
                                            </div>
                                        )}
                                        {filteredStructures.length === 0 ? (
                                            <div className="p-4 text-sm text-center text-muted-foreground mt-4">No structures found</div>
                                        ) : (
                                            filteredStructures.map((s: any) => {
                                                const isSelected = selections.structureId === s.id.toString();
                                                return (
                                                    <div
                                                        key={s.id}
                                                        onClick={() => setSelections({ ...selections, structureId: s.id.toString(), componentId: "", sowReportNo: "" })}
                                                        className={`
                                                            p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between group
                                                            ${isSelected
                                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm"
                                                                : "border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/50"}
                                                        `}
                                                    >
                                                        <div className="overflow-hidden">
                                                            <div className={`font-medium text-sm truncate ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-300"}`}>{s.str_name}</div>
                                                            <div className="text-xs text-slate-500 truncate mt-0.5">{s.str_type}</div>
                                                        </div>
                                                        {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0 ml-2" />}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </>
                                )}
                            </div>
                        </PanelContainer>
                    )}

                    {reqs.includes("sow_report") && (
                        <PanelContainer
                            title="SOW Report"
                            stepNum={stepCounter++}
                            disabled={!selections.structureId || selections.structureId === "all"}
                        >
                            <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 min-h-[57px] flex items-center">
                                <span className="text-xs text-slate-500">Available reports for selected structure</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/30 dark:bg-slate-900/20">
                                {!selections.structureId ? (
                                    <div className="p-4 text-sm text-center text-muted-foreground mt-10">Select a structure first</div>
                                ) : isLoadingSowReports ? (
                                    <div className="p-4 text-sm text-center text-muted-foreground mt-10">Loading reports...</div>
                                ) : availableSowReports.length === 0 ? (
                                    <div className="p-4 text-sm text-center text-muted-foreground mt-10">No report numbers found</div>
                                ) : (
                                    availableSowReports.map((reportNo, idx) => {
                                        const isSelected = selections.sowReportNo === reportNo;
                                        return (
                                            <div
                                                key={`${reportNo}-${idx}`}
                                                onClick={() => setSelections({ ...selections, sowReportNo: reportNo })}
                                                className={`
                                                    p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between
                                                    ${isSelected
                                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm"
                                                        : "border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/50"}
                                                `}
                                            >
                                                <div className={`font-medium text-sm ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-300"}`}>{reportNo}</div>
                                                {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </PanelContainer>
                    )}

                    {reqs.includes("component") && (
                        <PanelContainer
                            title="Component"
                            stepNum={stepCounter++}
                            disabled={!selections.structureId || selections.structureId === "all"}
                        >
                            <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Search components..."
                                        className="pl-9 bg-slate-50 dark:bg-slate-900 border-none"
                                        value={componentSearch}
                                        onChange={(e) => setComponentSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/30 dark:bg-slate-900/20">
                                {!selections.structureId ? (
                                    <div className="p-4 text-sm text-center text-muted-foreground mt-10">Select a structure first</div>
                                ) : isLoadingComponents ? (
                                    <div className="p-4 text-sm text-center text-muted-foreground mt-10">Loading components...</div>
                                ) : filteredComponents.length === 0 ? (
                                    <div className="p-4 text-sm text-center text-muted-foreground mt-10">No components found</div>
                                ) : (
                                    filteredComponents.map((comp) => {
                                        const isSelected = selections.componentId === comp.id;
                                        return (
                                            <div
                                                key={comp.id}
                                                onClick={() => setSelections({ ...selections, componentId: comp.id })}
                                                className={`
                                                    p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between
                                                    ${isSelected
                                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm"
                                                        : "border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/50"}
                                                `}
                                            >
                                                <div className="overflow-hidden">
                                                    <div className={`font-medium text-sm truncate ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-300"}`}>{comp.name}</div>
                                                    <div className="text-xs text-slate-500 truncate">{comp.q_id}</div>
                                                </div>
                                                {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0 ml-2" />}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </PanelContainer>
                    )}

                    {/* Simpler ones can stay as dropdowns or also be panels if preferred. Making them panels for consistency */}
                    {reqs.includes("planning") && (
                        <PanelContainer title="Planning" stepNum={stepCounter++}>
                            <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 min-h-[57px] flex items-center">
                                <span className="text-xs text-slate-500">Select an inspection plan</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/30 dark:bg-slate-900/20">
                                {plannings.map((p) => {
                                    const isSelected = selections.planningId === p.id;
                                    return (
                                        <div
                                            key={p.id}
                                            onClick={() => setSelections({ ...selections, planningId: p.id })}
                                            className={`
                                                p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between
                                                ${isSelected
                                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm"
                                                    : "border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/50"}
                                            `}
                                        >
                                            <div className={`font-medium text-sm ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-300"}`}>{p.name}</div>
                                            {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                                        </div>
                                    )
                                })}
                            </div>
                        </PanelContainer>
                    )}

                    {reqs.includes("procedure") && (
                        <PanelContainer title="Procedure" stepNum={stepCounter++}>
                            <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 min-h-[57px] flex items-center">
                                <span className="text-xs text-slate-500">Defect Criteria Procedure</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/30 dark:bg-slate-900/20">
                                <div
                                    onClick={() => setSelections({ ...selections, procedureId: "ALL" })}
                                    className={`
                                        p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between mb-2
                                        ${selections.procedureId === "ALL"
                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm"
                                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-300"}
                                    `}
                                >
                                    <div className="font-bold text-sm">ALL PROCEDURES</div>
                                    {selections.procedureId === "ALL" && <Check className="h-4 w-4 text-blue-600 shrink-0 ml-2" />}
                                </div>
                                {defectProcedures.map((p: any) => {
                                    const isSelected = selections.procedureId === p.id;
                                    return (
                                        <div
                                            key={p.id}
                                            onClick={() => setSelections({ ...selections, procedureId: p.id })}
                                            className={`
                                                p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between
                                                ${isSelected
                                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm"
                                                    : "border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/50"}
                                            `}
                                        >
                                            <div className="overflow-hidden">
                                                <div className={`font-medium text-sm truncate ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-300"}`}>{p.procedureNumber}</div>
                                                <div className="text-xs text-slate-500 truncate mt-0.5">{p.procedureName} (v{p.version})</div>
                                            </div>
                                            {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0 ml-2" />}
                                        </div>
                                    )
                                })}
                            </div>
                        </PanelContainer>
                    )}
                </div>
            </div>
        );
    };

    const renderConfiguration = () => (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div className="text-center mb-4">
                <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Report Settings</h2>
                <p className="text-slate-500">Customize the appearance and details of your report</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: General & Watermark */}
                <div className="space-y-6">
                    <Card>
                        <CardContent className="pt-6 space-y-4">
                            <div className="flex items-center gap-2 mb-2 text-slate-800 font-semibold">
                                <FileCheck className="w-5 h-5 text-blue-500" />
                                <h3>General Info</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Report Prefix</Label>
                                    <Input
                                        value={config.reportNoPrefix}
                                        onChange={(e) => setConfig({ ...config, reportNoPrefix: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Year</Label>
                                    <Select
                                        value={config.reportYear}
                                        onValueChange={(val) => setConfig({ ...config, reportYear: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[0, 1, 2, 3, 4].map(i => {
                                                const y = (new Date().getFullYear() - i).toString();
                                                return <SelectItem key={y} value={y}>{y}</SelectItem>
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2">
                                <Label className="cursor-pointer" htmlFor="contractor-logo">Show Contractor Logo</Label>
                                <Switch
                                    id="contractor-logo"
                                    checked={config.showContractorLogo}
                                    onCheckedChange={(c: boolean) => setConfig({ ...config, showContractorLogo: c })}
                                />
                            </div>
                            <div className="flex items-center justify-between pt-2">
                                <Label className="cursor-pointer" htmlFor="page-numbers">Show Page Numbers</Label>
                                <Switch
                                    id="page-numbers"
                                    checked={config.showPageNumbers}
                                    onCheckedChange={(c: boolean) => setConfig({ ...config, showPageNumbers: c })}
                                />
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                                <div className="space-y-0.5">
                                    <Label className="cursor-pointer" htmlFor="print-friendly">Print Friendly (Save Ink)</Label>
                                    <p className="text-[10px] text-muted-foreground">Remove dark backgrounds for hard copy printing</p>
                                </div>
                                <Switch
                                    id="print-friendly"
                                    checked={config.printFriendly}
                                    onCheckedChange={(c: boolean) => setConfig({ ...config, printFriendly: c })}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6 space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-slate-800 font-semibold">
                                    <Layers className="w-5 h-5 text-purple-500" />
                                    <h3>Watermark</h3>
                                </div>
                                <Switch
                                    checked={config.watermark.enabled}
                                    onCheckedChange={(c: boolean) => setConfig({ ...config, watermark: { ...config.watermark, enabled: c } })}
                                />
                            </div>

                            {config.watermark.enabled && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="space-y-2">
                                        <Label>Watermark Text</Label>
                                        <Input
                                            value={config.watermark.text}
                                            onChange={(e) => setConfig({ ...config, watermark: { ...config.watermark, text: e.target.value } })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <Label>Transparency</Label>
                                            <span className="text-xs text-muted-foreground">{Math.round(config.watermark.transparency * 100)}%</span>
                                        </div>
                                        <Slider
                                            value={[100 - (config.watermark.transparency * 100)]}
                                            onValueChange={(vals: number[]) => setConfig({ ...config, watermark: { ...config.watermark, transparency: (100 - vals[0]) / 100 } })}
                                            max={100}
                                            step={1}
                                        />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                </div>

                {/* Right Column: Signatures */}
                <div className="space-y-6">
                    <Card>
                        <CardContent className="pt-6 space-y-6">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-slate-800 font-semibold">
                                    <User className="w-5 h-5 text-green-500" />
                                    <h3>Signatures</h3>
                                </div>
                                <Switch
                                    checked={config.showSignatures}
                                    onCheckedChange={(c: boolean) => setConfig({ ...config, showSignatures: c })}
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-3">
                                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Prepared By</Label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <Input
                                            className="col-span-2"
                                            placeholder="Name"
                                            value={config.preparedBy.name}
                                            onChange={(e) => setConfig({ ...config, preparedBy: { ...config.preparedBy, name: e.target.value } })}
                                        />
                                        <Input
                                            type="date"
                                            value={config.preparedBy.date}
                                            onChange={(e) => setConfig({ ...config, preparedBy: { ...config.preparedBy, date: e.target.value } })}
                                        />
                                    </div>
                                </div>

                                <Separator />

                                <div className="space-y-3">
                                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Reviewed By</Label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <Input
                                            className="col-span-2"
                                            placeholder="Name"
                                            value={config.reviewedBy.name}
                                            onChange={(e) => setConfig({ ...config, reviewedBy: { ...config.reviewedBy, name: e.target.value } })}
                                        />
                                        <Input
                                            type="date"
                                            value={config.reviewedBy.date}
                                            onChange={(e) => setConfig({ ...config, reviewedBy: { ...config.reviewedBy, date: e.target.value } })}
                                        />
                                    </div>
                                </div>

                                <Separator />

                                <div className="space-y-3">
                                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Approved By</Label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <Input
                                            className="col-span-2"
                                            placeholder="Name"
                                            value={config.approvedBy.name}
                                            onChange={(e) => setConfig({ ...config, approvedBy: { ...config.approvedBy, name: e.target.value } })}
                                        />
                                        <Input
                                            type="date"
                                            value={config.approvedBy.date}
                                            onChange={(e) => setConfig({ ...config, approvedBy: { ...config.approvedBy, date: e.target.value } })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );

    const [isGenerating, setIsGenerating] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Invalidate preview when selections or config change
    useEffect(() => {
        setPreviewUrl(null);
    }, [selections, config]);

    // Auto-generate preview when entering preview step
    useEffect(() => {
        if (step === "preview" && !previewUrl) {
            const isDefectReport = selections.templateId === "defect-criteria-report";
            const isJobPackReport = selections.templateId === "jobpack-summary";
            if (selections.structureId || isDefectReport || (isJobPackReport && selections.jobPackId)) {
                generatePreview();
            }
        }
    }, [step, selections.structureId, selections.templateId, selections.jobPackId, selections.componentId, selections.planningId, selections.procedureId]);

    const fetchStructureData = async () => {
        if (!selections.structureId) return null;
        try {
            const res = await fetch(`/api/structures/${selections.structureId}`);
            const data = await res.json();
            if (!data.success) return null;

            const structureData = data.data;

            // Fetch discussion/comment records for this structure
            try {
                const strType = structureData.str_type?.toLowerCase() || "platform";
                const commentRes = await fetch(`/api/comment/${strType}/${selections.structureId}`);
                const commentJson = await commentRes.json();
                if (commentJson.data && Array.isArray(commentJson.data)) {
                    structureData.discussions = commentJson.data;
                }
            } catch (commentErr) {
                console.error("Error fetching structure comments for report:", commentErr);
            }

            return structureData;
        } catch (e) {
            console.error("Error fetching structure:", e);
            return null;
        }
    };

    const fetchJobPackData = async () => {
        if (!selections.jobPackId) return null;
        try {
            const res = await fetch(`/api/jobpack/${selections.jobPackId}`);
            const data = await res.json();
            return data.data;
        } catch (e) {
            console.error("Error fetching jobpack:", e);
            return null;
        }
    };

    const fetchComponentTypes = async () => {
        // Component types mapping - using hardcoded values since API doesn't exist yet
        // TODO: Create /api/components/types endpoint if needed
        return {
            'LEG': 'Leg',
            'PILE': 'Pile',
            'NODE': 'Node',
            'MEMBER': 'Member',
            'DECK': 'Deck',
            'JACKET': 'Jacket'
        };
    };

    const resolveVessel = (jobPack: any) => {
        if (!jobPack?.metadata) return "N/A";
        const history = jobPack.metadata.vessel_history;
        if (Array.isArray(history) && history.length > 0) {
            return history.map((v: any) => v.name || v).join(", ");
        }
        return jobPack.metadata.vessel || "N/A";
    };

    const generateReportAction = async (returnBlob: boolean = false) => {
        const {
            generateStructureReport,
            generateComponentSummaryReport,
            generateComponentSpecReport,
            generateTechnicalSpecsReport
        } = await import("@/utils/pdf-generator");

        // Dynamic import for new generators
        // Dynamic import for new generators
        const { generateDefectCriteriaReport } = await import("@/utils/report-generators/defect-criteria-report");
        const { generateJobPackSummaryReport } = await import("@/utils/report-generators/jobpack-summary-report");
        const { generateWorkScopeStatusReport } = await import("@/utils/report-generators/work-scope-status-report");
        const { generateWorkScopeIncompleteReport } = await import("@/utils/report-generators/work-scope-incomplete-report");
        const { generateDefectAnomalyReport } = await import("@/utils/report-generators/defect-anomaly-report");
        const { generateDiverLogReport } = await import("@/utils/report-generators/diver-log-report");
        const { generateVideoLogReport } = await import("@/utils/report-generators/video-log-report");
        const { generateDefectSummaryReport } = await import("@/utils/report-generators/defect-summary-report");
        const { generateROVMGIReport } = await import("@/utils/report-generators/rov-mgi-report");
        const { generateROVFMDReport } = await import("@/utils/report-generators/rov-fmd-report");
        const { generateROVSZCIReport } = await import("@/utils/report-generators/rov-szci-report");
        const { generateROVUTWTReport } = await import("@/utils/report-generators/rov-utwt-report");
        const { generateROVRRISIReport } = await import("@/utils/report-generators/rov-rrisi-report");
        const { generateROVRSCORReport } = await import("@/utils/report-generators/rov-rscor-report");
        const { generateROVCPReport }    = await import("@/utils/report-generators/rov-cp-report");
        const { generateROVRGVIReport }  = await import("@/utils/report-generators/rov-rgvi-report");
        const { generateROVCondReport }  = await import("@/utils/report-generators/rov-rcond-report");
        const { generateROVCondSketchReport } = await import("@/utils/report-generators/rov-rcond-sketch-report");





        // Fetch real company settings from API
        let companySettings: any = { company_name: "NasQuest Resources Sdn Bhd" };
        try {
            const response = await fetch("/api/company-settings");
            if (response.ok) {
                const result = await response.json();
                if (result.data) {
                    companySettings = {
                        company_name: result.data.company_name || "NasQuest Resources Sdn Bhd",
                        department_name: result.data.department_name,
                        serial_no: result.data.serial_no,
                        logo_url: result.data.logo_url
                    };
                }
            }
        } catch (error) {
            console.error("Error fetching company settings for report:", error);
        }

        const reportConfig = { ...config, returnBlob };

        // Defect Criteria Report (No Structure Data Required)
        if (selections.templateId === "defect-criteria-report") {
            return await generateDefectCriteriaReport(companySettings, { ...reportConfig, procedureId: selections.procedureId } as any);
        }

        // Defect Summary Report / Findings Summary Report
        if (selections.templateId === "defect-summary" || selections.templateId === "findings-summary") {
            const jobPack = await fetchJobPackData();
            const structure = selections.structureId ? await fetchStructureData() : null;
            if (!jobPack) return null;

            const isFindingsReport = selections.templateId === "findings-summary";
            const extendedConfig = { ...reportConfig, prefix: isFindingsReport ? "F-" : "A-", isFindingsReport };

            return await generateDefectSummaryReport(jobPack, structure, selections.sowReportNo, companySettings, extendedConfig as any);
        }

        // Defect / Anomaly Report / Findings Report
        if (selections.templateId === "defect-anomaly-report" || selections.templateId === "findings-report") {
            const jobPack = await fetchJobPackData();
            const structure = await fetchStructureData();
            if (!jobPack || !structure) return null;

            const isFindingsReport = selections.templateId === "findings-report";
            const extendedConfig = { ...reportConfig, prefix: isFindingsReport ? "F-" : "A-", isFindingsReport };

            return await generateDefectAnomalyReport(jobPack, structure, selections.sowReportNo, companySettings, extendedConfig as any);
        }

        // Diver Log Report
        if (selections.templateId === "diver-log-report") {
            const jobPack = await fetchJobPackData();
            const structure = await fetchStructureData();
            if (!jobPack || !structure) return null;

            return await generateDiverLogReport(jobPack, structure, selections.sowReportNo, companySettings, reportConfig);
        }

        // Video Log Report
        if (selections.templateId === "video-log-report") {
            const jobPack = await fetchJobPackData();
            const structure = await fetchStructureData();
            if (!jobPack || !structure) return null;

            return await generateVideoLogReport(jobPack, structure, selections.sowReportNo, companySettings, reportConfig);
        }

        // Seabed Survey Reports
        if (selections.templateId === "seabed-survey-debris" || selections.templateId === "seabed-survey-gas" || selections.templateId === "seabed-survey-crater") {
            const jobPack = await fetchJobPackData();
            const structure = await fetchStructureData();
            if (!jobPack || !structure) return null;
            
            const filterMap: Record<string, string> = {
                "seabed-survey-debris": "Debris",
                "seabed-survey-gas": "Gas Seepage",
                "seabed-survey-crater": "Crater"
            };
            
            return await generateSeabedSurveyReport(jobPack, structure, selections.sowReportNo, companySettings, reportConfig, filterMap[selections.templateId]);
        }

        // Job Pack Summary Report
        if (selections.templateId === "jobpack-summary") {
            const jobPack = await fetchJobPackData();
            if (!jobPack) return null;
            // Map returnBlob to config if needed or pass directly. The generator expects config.returnBlob
            return await generateJobPackSummaryReport(jobPack, companySettings, reportConfig);
        }

        // ROV MGI Report
        if (selections.templateId === "mgi-report") {
            const jobPack = await fetchJobPackData();
            const structure = await fetchStructureData();
            if (!jobPack || !structure) return null;

            // Fetch RMGI records
            const supabase = (await import("@/utils/supabase/client")).createClient();
            // 1. Find the RMGI type ID first
            const { data: typeData } = await supabase
                .from('inspection_type')
                .select('id, code')
                .eq('code', 'RMGI')
                .maybeSingle();

            const rmgiTypeId = typeData?.id || 79; // Fallback to 79 from screenshot if not found

            const structId = Number(selections.structureId);
            if (isNaN(structId)) {
                alert("Please select a specific structure for this report.");
                return null;
            }

            // 2. Fetch records for the structure
            let { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(q_id, code)
                `)
                .eq('structure_id', structId);

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            // FILTER MANUALLY
            const mgiRecords = records?.filter(r => {
                // 1. SOW check (partial match, case insensitive)
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase()) ||
                    selections.sowReportNo.toLowerCase().includes(String(r.sow_report_no || '').toLowerCase());
                
                // 2. JobPack check
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);

                // 3. RMGI check
                const recordData = r.inspection_data || r.inspection_dat;
                const isRMGI = 
                    r.inspection_type_id === rmgiTypeId ||
                    String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'RMGI' ||
                    String(r.inspection_type?.name || '').toLowerCase().includes('marine growth') ||
                    (recordData && (
                        recordData.mgi_hard_thickness_at_12 !== undefined || 
                        recordData.mgi_hard_thickness !== undefined || 
                        recordData._mgi_profile_id !== undefined
                    ));

                return sowMatches && jobPackMatches && isRMGI;
            });

            if (!mgiRecords || mgiRecords.length === 0) {
                console.warn("Records found for structure but didn't match filters:", records?.length);
                alert(`Found ${records?.length || 0} records for this structure, but none matched SOW: "${selections.sowReportNo}" and Type: "RMGI". Please check your selection.`);
                return null;
            }

            // Fetch MGI Profile
            let profile = null;
            const recordData = mgiRecords[0]?.inspection_data || mgiRecords[0]?.inspection_dat;
            const profileId = recordData?._mgi_profile_id;
            if (profileId) {
                const { data } = await supabase.from('mgi_profiles').select('*').eq('id', profileId).maybeSingle();
                profile = data;
            }

            // Fetch Contractor Logo if available
            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Error fetching contractor logo", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                waterDepth: Math.abs(structure.water_depth || structure.depth || structure.lowest_elevation || 0),
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateROVMGIReport(
                    mgiRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    profile,
                    headerData,
                    companySettings,
                    reportConfig as any
                );
            } catch (error) {
                console.error("Generator threw error:", error);
                throw error;
            }
        }

        // ROV FMD Survey Report (New)
        if (selections.templateId === "fmd-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            // 1. Fetch records with all necessary joins for FMD
            let { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(q_id, code),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', Number(selections.structureId));

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            // FILTER MANUALLY
            const fmdRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isRFMD = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'RFMD';
                return sowMatches && jobPackMatches && isRFMD;
            });

            if (!fmdRecords || fmdRecords.length === 0) {
                alert(`No ROV FMD records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            // Fetch Contractor Logo if available
            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Error fetching contractor logo", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateROVFMDReport(
                    fmdRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("FMD Generator Error:", error);
                throw error;
            }
        }

        // ROV SZCI Survey Report (New)
        if (selections.templateId === "szci-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            // 1. Fetch records with all necessary joins for SZCI
            let { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(q_id, code),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', Number(selections.structureId));

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            // FILTER MANUALLY
            const szciRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isRSZCI = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'RSZCI';
                return sowMatches && jobPackMatches && isRSZCI;
            });

            if (!szciRecords || szciRecords.length === 0) {
                alert(`No ROV Splash Zone records (RSZCI) found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            // Fetch Contractor Logo if available
            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Error fetching contractor logo", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateROVSZCIReport(
                    szciRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("SZCI Generator Error:", error);
                throw error;
            }
        }

        // ROV UTWT Survey Report (New)
        if (selections.templateId === "utwt-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            // 1. Fetch records with all necessary joins for UTWT
            let { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(q_id, code),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', Number(selections.structureId));

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            // FILTER MANUALLY
            const utwtRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isRUTWT = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'RUTWT';
                return sowMatches && jobPackMatches && isRUTWT;
            });

            if (!utwtRecords || utwtRecords.length === 0) {
                alert(`No ROV UT Wall Thickness records (RUTWT) found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            // Fetch Contractor Logo if available
            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Error fetching contractor logo", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateROVUTWTReport(
                    utwtRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("UTWT Generator Error:", error);
                throw error;
            }
        }


        // ROV RRISI/JTISI/ITISI Survey Report (Unified)
        if (["rrisi-report", "rov-jtisi-report", "rov-itisi-report"].includes(selections.templateId)) {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const structId = Number(selections.structureId);
            if (isNaN(structId)) {
                alert("Please select a specific structure for this inspection report.");
                return null;
            }
            const { data: records, error } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    structure_components:component_id(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id(job_no:deployment_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId)
                .eq('sow_report_no', selections.sowReportNo);

            if (error) throw error;
            const tubeRecords = records || [];

            if (tubeRecords.length === 0) {
                alert(`No records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            // Determine Report Type based on Template ID
            let reportType: 'R' | 'J' | 'I' = 'R';
            if (selections.templateId === "rov-jtisi-report") reportType = 'J';
            else if (selections.templateId === "rov-itisi-report") reportType = 'I';

            // Fetch Contractor Logo if available
            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Error fetching contractor logo", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateROVRRISIReport(
                    tubeRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob, reportType, structureId: structId, sowReportNo: selections.sowReportNo } as any
                );
            } catch (error) {
                console.error("RRISI Generator Error:", error);
                throw error;
            }
        }

        // ROV Scour Survey Report (New)
        if (selections.templateId === "rov-scour-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const structId = Number(selections.structureId);
            if (isNaN(structId)) {
                alert("Invalid Structure selection. Please ensure a structure is selected.");
                return null;
            }

            // 1. Fetch records with all necessary joins for RSCOR
            let { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id(id, code, name),
                    structure_components:component_id(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id(tape_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message || 'Unknown fetching error'}`);
                return null;
            }

            // FILTER MANUALLY
            const scourRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isRSCOR = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'RSCOR';
                return sowMatches && jobPackMatches && isRSCOR;
            });

            if (!scourRecords || scourRecords.length === 0) {
                alert(`No ROV Scour records (RSCOR) found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            // Fetch Contractor Logo if available
            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Error fetching contractor logo", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateROVRSCORReport(
                    scourRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("RSCOR Generator Error:", error);
                throw error;
            }
        }

        // ROV Anode Inspection Report (New)
        if (selections.templateId === "rov-anode-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const structId = Number(selections.structureId);
            if (isNaN(structId)) {
                alert("Invalid Structure selection. Please ensure a structure is selected.");
                return null;
            }

            let { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id(id, code, name),
                    structure_components:component_id(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id(tape_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message || 'Unknown fetching error'}`);
                return null;
            }

            // FILTER: RGVI + Component Type AN
            const anodeRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isRGVI = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'RGVI';
                const isAN = String(r.structure_components?.code || '').toUpperCase() === 'AN' || 
                             String(r.structure_components?.metadata?.type || '').toUpperCase() === 'ANODE';
                return sowMatches && jobPackMatches && isRGVI && isAN;
            });

            if (!anodeRecords || anodeRecords.length === 0) {
                alert(`No ROV Anode records (RGVI + component_type: AN) found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Error fetching contractor logo", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateROVAnodeReport(
                    anodeRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("Anode Generator Error:", error);
                throw error;
            }
        }

        // ROV CP Survey Report
        if (selections.templateId === "rov-cp-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack  = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const { data: records, error: fetchError } = await supabase
                .from("insp_records")
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(q_id, code),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq("structure_id", Number(selections.structureId));

            if (fetchError) {
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            // Filter to records that have CP data + optional SOW/jobpack scoping
            const cpRecords = records?.filter((r: any) => {
                const sowMatches = !selections.sowReportNo ||
                    String(r.sow_report_no || "").toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const d = r.inspection_data || r.inspection_dat || {};
                const hasCP = d.cp_rdg !== undefined || d.cp_reading_mv !== undefined || d.cp !== undefined;
                return sowMatches && jobPackMatches && hasCP;
            });

            if (!cpRecords || cpRecords.length === 0) {
                alert(`No CP readings found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            // Contractor logo
            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes  = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Contractor logo error", e); }
            }

            const headerData = {
                jobpackName:      jobPack.name || jobPack.title || "N/A",
                sowReportNo:      selections.sowReportNo || "N/A",
                platformName:     structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack),
            };

            try {
                return await generateROVCPReport(
                    cpRecords.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("CP Report Generator Error:", error);
                throw error;
            }
        }

        // ROV GVI Report (RGVI)
        if (selections.templateId === "rov-rgvi-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack   = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const { data: records, error: fetchError } = await supabase
                .from("insp_records")
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(q_id, code),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq("structure_id", Number(selections.structureId));

            if (fetchError) {
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const rgviRecords = records?.filter((r: any) => {
                const sowMatches = !selections.sowReportNo ||
                    String(r.sow_report_no || "").toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isRGVI = String(r.inspection_type?.code || r.inspection_type_code || "").toUpperCase() === "RGVI";
                return sowMatches && jobPackMatches && isRGVI;
            });

            if (!rgviRecords || rgviRecords.length === 0) {
                alert(`No RGVI records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes  = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Contractor logo error", e); }
            }

            const headerData = {
                jobpackName:      jobPack.name || jobPack.title || "N/A",
                sowReportNo:      selections.sowReportNo || "N/A",
                platformName:     structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack),
            };

            try {
                return await generateROVRGVIReport(
                    rgviRecords.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("RGVI Report Generator Error:", error);
                throw error;
            }
        }

        // ROV Caisson Survey Report
        if (selections.templateId === "rov-rcasn-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack   = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const { data: records, error: fetchError } = await supabase
                .from("insp_records")
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(
                        id,
                        q_id, 
                        code,
                        metadata
                    ),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq("structure_id", Number(selections.structureId));

            if (fetchError) {
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const rcasnRecords = (records || []).filter((r: any) => {
                const sowMatches = !selections.sowReportNo ||
                    String(r.sow_report_no || "").toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isRCASN = String(r.inspection_type?.code || r.inspection_type_code || "").toUpperCase() === "RCASN";
                return sowMatches && jobPackMatches && isRCASN;
            });

            if (!rcasnRecords || rcasnRecords.length === 0) {
                alert(`No RCASN records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes  = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Contractor logo error", e); }
            }

            const headerData = {
                jobpackName:      jobPack.name || jobPack.title || "N/A",
                sowReportNo:      selections.sowReportNo || "N/A",
                platformName:     structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack),
            };

            try {
                return await generateROVCasnReport(
                    rcasnRecords.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("RCASN Report Generator Error:", error);
                throw error;
            }
        }

        // ROV Conductor Survey Report (RCOND)
        if (selections.templateId === "rov-rcond-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack   = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const { data: records, error: fetchError } = await supabase
                .from("insp_records")
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(
                        id,
                        q_id, 
                        code,
                        metadata
                    ),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq("structure_id", Number(selections.structureId));

            if (fetchError) {
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const rcondRecords = (records || []).filter((r: any) => {
                const sowMatches = !selections.sowReportNo ||
                    String(r.sow_report_no || "").toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                
                // For Conductor report, we fetch all records for this SOW/Structure 
                // and let the generator's hierarchy logic group them by CD.
                // This ensures associated items (Anodes, Clamps) are included.
                return sowMatches && jobPackMatches;
            });

            if (!rcondRecords || rcondRecords.length === 0) {
                alert(`No RCOND records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes  = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Contractor logo error", e); }
            }

            const headerData = {
                jobpackName:      jobPack.name || jobPack.title || "N/A",
                sowReportNo:      selections.sowReportNo || "N/A",
                platformName:     structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateROVCondReport(
                    rcondRecords.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { 
                        ...reportConfig, 
                        returnBlob,
                        structureId: Number(selections.structureId),
                        jobPackId: Number(selections.jobPackId)
                    } as any
                );
            } catch (error) {
                console.error("RCOND Generator Error:", error);
                throw error;
            }
        }

        // ROV Caisson Survey (Sketch) Report
        if (selections.templateId === "rov-rcasn-sketch-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const structId = Number(selections.structureId);
            if (isNaN(structId)) {
                alert("Please select a specific structure for this inspection report.");
                return null;
            }

            const { data: records, error } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id(id, code, name),
                    structure_components:component_id(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id(job_no:deployment_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId)
                .eq('sow_report_no', selections.sowReportNo);

            if (error) throw error;
            const caissonRecords = records || [];

            if (caissonRecords.length === 0) {
                alert(`No records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Contractor logo error", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateROVCasnSketchReport(
                    caissonRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob, structureId: structId, sowReportNo: selections.sowReportNo } as any
                );
            } catch (error) {
                console.error("RCASN Sketch Generator Error:", error);
                throw error;
            }
        }

        // ROV Conductor Survey (Sketch) Report
        if (selections.templateId === "rov-rcond-sketch-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const structId = Number(selections.structureId);
            if (isNaN(structId)) {
                alert("Please select a specific structure for this inspection report.");
                return null;
            }

            const { data: records, error } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id(id, code, name),
                    structure_components:component_id(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id(job_no:deployment_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId)
                .eq('sow_report_no', selections.sowReportNo);

            if (error) throw error;
            const condRecords = records || [];

            if (condRecords.length === 0) {
                alert(`No records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Contractor logo error", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateROVCondSketchReport(
                    condRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob, structureId: structId, sowReportNo: selections.sowReportNo } as any
                );
            } catch (error) {
                console.error("RCOND Sketch Generator Error:", error);
                throw error;
            }
        }

        // Work Scope Status Summary (New)
        if (selections.templateId === "work-scope-status") {
            const jobPack = await fetchJobPackData();
            if (!jobPack) return null;

            let structure: any = null;
            let sowData: any = { items: [], report_numbers: [] };

            if (selections.structureId === "all") {
                structure = { str_name: "ALL STRUCTURES", id: "all", str_type: "COMBINED" };
                try {
                    const res = await fetch(`/api/sow?jobpack_id=${selections.jobPackId}`);
                    const json = await res.json();
                    if (json.data && Array.isArray(json.data)) {
                        const sows = json.data;
                        const allItems: any[] = [];
                        for (const sow of sows) {
                            const itemRes = await fetch(`/api/sow?sow_id=${sow.id}`);
                            const itemJson = await itemRes.json();
                            if (itemJson.data && itemJson.data.items) {
                                const enrichedItems = itemJson.data.items.map((i: any) => ({
                                    ...i,
                                    structure_title: sow.structure_title,
                                    structure_id: sow.structure_id
                                }));
                                allItems.push(...enrichedItems);
                            }
                        }
                        sowData = { items: allItems, report_numbers: [] };
                    }
                } catch (e) { console.error(e); }
            } else {
                structure = await fetchStructureData();
                if (!structure) return null;
                try {
                    const res = await fetch(`/api/sow?jobpack_id=${selections.jobPackId}&structure_id=${selections.structureId}`);
                    const json = await res.json();
                    sowData = json.data;
                } catch (e) { console.error(e); }
            }

            if (!sowData) sowData = { items: [], report_numbers: [] };
            return await generateWorkScopeStatusReport(jobPack, structure, sowData, companySettings, reportConfig as any);
        }

        // Work Scope Incomplete Status (New)
        if (selections.templateId === "work-scope-incomplete") {
            const jobPack = await fetchJobPackData();
            if (!jobPack) return null;

            let structure: any = null;
            let sowData: any = { items: [], report_numbers: [] };

            if (selections.structureId === "all") {
                structure = { str_name: "ALL STRUCTURES", id: "all", str_type: "COMBINED" };
                try {
                    const res = await fetch(`/api/sow?jobpack_id=${selections.jobPackId}`);
                    const json = await res.json();
                    if (json.data && Array.isArray(json.data)) {
                        const sows = json.data;
                        const allItems: any[] = [];
                        for (const sow of sows) {
                            const itemRes = await fetch(`/api/sow?sow_id=${sow.id}`);
                            const itemJson = await itemRes.json();
                            if (itemJson.data && itemJson.data.items) {
                                const enrichedItems = itemJson.data.items.map((i: any) => ({
                                    ...i,
                                    structure_title: sow.structure_title,
                                    structure_id: sow.structure_id
                                }));
                                allItems.push(...enrichedItems);
                            }
                        }
                        sowData = { items: allItems, report_numbers: [] };
                    }
                } catch (e) { console.error(e); }
            } else {
                structure = await fetchStructureData();
                if (!structure) return null;
                try {
                    const res = await fetch(`/api/sow?jobpack_id=${selections.jobPackId}&structure_id=${selections.structureId}`);
                    const json = await res.json();
                    sowData = json.data;
                } catch (e) { console.error(e); }
            }
            if (!sowData) sowData = { items: [], report_numbers: [] };
            return await generateWorkScopeIncompleteReport(jobPack, structure, sowData, companySettings, { ...reportConfig, showSignatures: reportConfig.showSignatures } as any);
        }

        // Work Scope Report (Job Pack + Structure)
        if (selections.templateId === "work-scope-report") {
            const jobPack = await fetchJobPackData();
            if (!jobPack) return null;

            let structure: any = null;
            let sowData: any = { items: [], report_numbers: [] };

            if (selections.structureId === "all") {
                structure = { str_name: "ALL STRUCTURES", id: "all", str_type: "COMBINED" };

                try {
                    // Fetch all SOWs for this job pack
                    const res = await fetch(`/api/sow?jobpack_id=${selections.jobPackId}`);
                    const json = await res.json();

                    if (json.data && Array.isArray(json.data)) {
                        // We need to fetch items for EACH SOW because the list endpoint might only return headers?
                        // Let's check API. API "If only jobpack_id is provided, fetch all SOWs... select('*')"
                        // It does NOT join items by default in that block.
                        // We need to fetch items for each SOW found.

                        const sows = json.data;
                        const allItems: any[] = [];
                        const allReportNumbers: any[] = [];

                        // Parallel fetch for items of each SOW
                        // Actually, simpler to just modify API? No, stick to frontend aggregation for safety.
                        // Or, use the loop.
                        for (const sow of sows) {
                            const itemRes = await fetch(`/api/sow?sow_id=${sow.id}`);
                            const itemJson = await itemRes.json();
                            if (itemJson.data) {
                                if (itemJson.data.items) {
                                    const enrichedItems = itemJson.data.items.map((i: any) => ({
                                        ...i,
                                        structure_title: sow.structure_title,
                                        structure_id: sow.structure_id
                                    }));
                                    allItems.push(...enrichedItems);
                                }
                                if (itemJson.data.report_numbers) allReportNumbers.push(...itemJson.data.report_numbers);
                            }
                        }

                        sowData = { items: allItems, report_numbers: allReportNumbers };
                    }
                } catch (e) { console.error("Error fetching multi-sow data", e); }

            } else {
                structure = await fetchStructureData();
                if (!structure) return null;

                try {
                    const res = await fetch(`/api/sow?jobpack_id=${selections.jobPackId}&structure_id=${selections.structureId}`);
                    const json = await res.json();
                    sowData = json.data;
                } catch (e) { console.error(e); }
            }

            if (!sowData) sowData = { items: [], report_numbers: [] };

            return await generateWorkScopeReport(jobPack, structure, sowData as any, companySettings, reportConfig);
        }

        const data = await fetchStructureData();
        if (!data) return null;

        const typeMap = await fetchComponentTypes();
        // const reportConfig = { ...config, returnBlob }; // Already declared above

        switch (selections.templateId) {
            case "structure-summary":
                return await generateStructureReport(data, companySettings, reportConfig);

            case "component-catalog":
                // Note: generateComponentSummaryReport currently doesn't support full config object in signature based on previous view
                // We pass it anyway if it gets updated, or just rely on standard params
                // Check if we can intercept the blob return. 
                // Using 'as any' to bypass signature mismatch if distinct
                return await generateComponentSummaryReport(data, companySettings, typeMap, reportConfig);

            case "technical-specs":
                return await generateTechnicalSpecsReport(data, companySettings, reportConfig);

            case "component-spec":
                if (!selections.componentId) return null;
                // Find component
                const component = availableComponents.find((c: any) => c.id === selections.componentId || c.comp_id === selections.componentId);
                if (!component) return null;
                return await generateComponentSpecReport(data, component, companySettings, typeMap, reportConfig);

            default:
                // Fallback to structure report
                return await generateStructureReport(data, companySettings, reportConfig);
        }
    };

    const generatePreview = async () => {
        setIsGenerating(true);
        try {
            const result = await generateReportAction(true); // Return Blob

            // The generators other than structure-summary might not return a Blob yet (they might save directly).
            // We need to verify if they return a blob. 
            // If they return undefined (void), it means they saved it or didn't return.
            // For now, let's assume valid return. If not, we might need to update those generators too.

            if (result instanceof Blob) {
                const url = URL.createObjectURL(result);
                setPreviewUrl(url);
            } else if (result && (result as any).output) {
                // Handle jsPDF object if returned
                const blob = (result as any).output('blob');
                const url = URL.createObjectURL(blob);
                setPreviewUrl(url);
            } else {
                console.warn("Generator did not return a blob. It might have saved directly or failed.");
                // If it failed to return a blob, we can't show preview.
            }
        } catch (error) {
            console.error("Preview generation failed", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = async () => {
        // For download, we can either re-generate asking for save, or just save the blob we have.
        // If we have a previewUrl, we can download it.
        if (previewUrl) {
            const a = document.createElement('a');
            a.href = previewUrl;
            a.download = `${selections.templateId}_${selections.structureId}.pdf`;
            a.click();
        } else {
            // Fallback generate
            await generateReportAction(false);
        }
    };

    const handlePreview = async () => {
        if (previewUrl) {
            window.open(previewUrl, '_blank');
        } else {
            await generatePreview();
        }
    };

    const handlePrint = async () => {
        // Print via iframe if possible or open new tab
        if (previewUrl) {
            const iframe = document.querySelector('iframe[title="Report Preview"]') as HTMLIFrameElement;
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.print();
            } else {
                window.open(previewUrl, '_blank');
            }
        }
    };

    const handleShare = async () => {
        if (!previewUrl) {
            alert("Please wait for the preview to generate before sharing.");
            return;
        }

        // Check if Web Share API is supported
        if (!navigator.share) {
            alert("Sharing is not supported in this browser. Please use the Download button instead.");
            return;
        }

        try {
            // Fetch the blob from the preview URL
            const response = await fetch(previewUrl);
            const blob = await response.blob();

            // Create a descriptive filename
            const template = getCurrentTemplate();
            const structure = structures.find((s: any) => s.id.toString() === selections.structureId);
            const filename = `${template?.name.replace(/\s+/g, '_')}_${structure?.str_name?.replace(/\s+/g, '_') || 'Report'}.pdf`;

            // Convert blob to File object
            const file = new File([blob], filename, { type: 'application/pdf' });

            // Use Web Share API
            await navigator.share({
                title: template?.name || 'Report',
                text: `${template?.name} - ${structure?.str_name || 'Structure Report'}`,
                files: [file]
            });
        } catch (error: any) {
            // User cancelled the share or an error occurred
            if (error.name !== 'AbortError') {
                console.error('Error sharing:', error);
                alert('Failed to share the report. Please try downloading instead.');
            }
        }
    };

    const renderPreview = () => (
        <div className="h-full flex flex-col space-y-4">
            <div className="text-center space-y-1 mb-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Report Preview</h2>
                <p className="text-sm text-slate-500">
                    Review your <strong>{getCurrentTemplate()?.name}</strong> before downloading.
                </p>
            </div>

            <div className="flex-1 w-full bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden border shadow-inner relative min-h-[400px]">
                {isGenerating ? (
                    <div className="absolute inset-0 flex items-center justify-center flex-col gap-3">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm text-muted-foreground animate-pulse">Generating preview...</p>
                    </div>
                ) : previewUrl ? (
                    <iframe
                        src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                        className="w-full h-full"
                        title="Report Preview"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                        Preview not available (Check if generator supports blob)
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm px-4">
                <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded border">
                    <span className="text-muted-foreground">Format</span>
                    <span className="font-medium">PDF Document</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded border">
                    <span className="text-muted-foreground">Watermark</span>
                    <span className="font-medium">{config.watermark.enabled ? config.watermark.text : "None"}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded border">
                    <span className="text-muted-foreground">Signatures</span>
                    <span className="font-medium">{[config.preparedBy.name, config.reviewedBy.name, config.approvedBy.name].filter(Boolean).length} / 3</span>
                </div>
            </div>
        </div>
    );

    return (
        <div className="w-full h-full flex flex-col bg-white dark:bg-slate-950 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="p-1.5 bg-blue-600 rounded-lg text-white"><FileText className="w-4 h-4" /></span>
                        Report Wizard
                        {selections.templateId && getCurrentTemplate() && (
                            <>
                                <span className="text-slate-300 dark:text-slate-700 mx-1">/</span>
                                <span className="text-blue-600 dark:text-blue-400 font-medium">{getCurrentTemplate()?.name}</span>
                            </>
                        )}
                    </h1>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="px-6 py-3 bg-white dark:bg-slate-950 border-b">
                <div className="flex justify-between items-center relative max-w-3xl mx-auto">
                    {/* Line */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 dark:bg-slate-800 z-0"></div>
                    <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-blue-600 transition-all duration-500 z-0"
                        style={{
                            width: step === "template" ? "16%" :
                                step === "context" ? "50%" :
                                    step === "configuration" ? "82%" : "100%"
                        }}
                    ></div>

                    {/* Steps */}
                    {(["template", "context", "configuration", "preview"] as WizardStep[]).map((s, i) => {
                        const isActive = (
                            (step === "template" && i === 0) ||
                            (step === "context" && i <= 1) ||
                            (step === "configuration" && i <= 2) ||
                            (step === "preview" && i <= 3)
                        );
                        const isCurrent = step === s;

                        const currentIndex = ["template", "context", "configuration", "preview"].indexOf(step);
                        const isClickable = i < currentIndex;

                        return (
                            <div
                                key={s}
                                className={`relative z-10 flex flex-col items-center gap-2 ${isClickable ? "cursor-pointer group" : "cursor-default"}`}
                                onClick={() => {
                                    if (isClickable) setStep(s);
                                }}
                            >
                                <div className={`
                                    w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                                    ${isActive ? "bg-blue-600 border-blue-600 text-white" : "bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-400"}
                                    ${isCurrent ? "ring-4 ring-blue-100 dark:ring-blue-900/40" : ""}
                                    ${isClickable ? "group-hover:bg-blue-700 group-hover:border-blue-700" : ""}
                                `}>
                                    {i + 1}
                                </div>
                                <span className={`text-[10px] uppercase font-bold tracking-wider ${isActive ? "text-blue-600" : "text-slate-400"}`}>
                                    {s}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/20">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="h-full max-w-5xl mx-auto"
                    >
                        {step === "template" && renderTemplateSelection()}
                        {step === "context" && renderContextSelection()}
                        {step === "configuration" && renderConfiguration()}
                        {step === "preview" && renderPreview()}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Footer Controls */}
            <div className="px-6 py-4 border-t bg-white dark:bg-slate-950 flex justify-between items-center">
                <Button
                    variant="ghost"
                    onClick={handleBack}
                    disabled={step === "template"}
                    className="gap-2"
                >
                    <ChevronLeft className="w-4 h-4" /> Back
                </Button>

                {step !== "preview" ? (
                    <Button
                        onClick={handleNext}
                        disabled={!isStepValid()}
                        className="bg-blue-600 hover:bg-blue-700 gap-2 shadow-lg shadow-blue-500/20"
                    >
                        Next <ChevronRight className="w-4 h-4" />
                    </Button>
                ) : (
                    <div className="flex gap-2">
                        <Button variant="outline" className="gap-2" onClick={handlePreview}>
                            <Eye className="w-4 h-4" /> Open PDF
                        </Button>
                        <Button className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20" onClick={handleDownload}>
                            <Download className="w-4 h-4" /> Download
                        </Button>
                        <Button variant="outline" className="gap-2" onClick={handleShare}>
                            <Share2 className="w-4 h-4" /> Share
                        </Button>
                        <Button variant="secondary" className="gap-2" onClick={handlePrint}>
                            <Printer className="w-4 h-4" /> Print
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
