"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronRight,
    ChevronLeft,
    Check,
    FileText,
    Layers,
    Printer,
    Download,
    Share2,
    Eye,
    Settings,
    User,
    FileCheck,
    Search,
    X,
    LayoutGrid,
    List,
    CheckSquare,
    Square,
    CheckCircle2,
    RotateCcw,
    ChevronDown,
    ChevronUp,
    Sparkles,
    Filter,
    CheckCheck
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMGIProfileForJobpack } from "@/utils/mgi-profile-helper";
import { isBLRecord, isSGRecord, isCURecord, isRGRecord } from "@/app/dashboard/inspection-v2/workspace/components/ReportWizardDialog";
import { REPORT_TEMPLATES, TOC_SECTIONS } from "./report-template-catalog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { jsPDF } from "jspdf";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { generateWorkScopeReport } from "@/utils/report-generators/work-scope-report";
import { generateSeabedSurveyReport } from "@/utils/report-generators/seabed-survey-report";
import { generateROVAnodeReport } from "@/utils/report-generators/rov-anode-report";
import { generateROVAnodeRSANIReport } from "@/utils/report-generators/rov-anode-rsani-report";
import { generateROVCasnReport } from "@/utils/report-generators/rov-rcasn-report";
import { generateROVCasnSketchReport } from "@/utils/report-generators/rov-rcasn-sketch-report";
import { generateROVPhotographyReport } from "@/utils/report-generators/rov-photography-report";
import { generateROVPhotographyLogReport } from "@/utils/report-generators/rov-photography-log-report";
import { generateDivingSZONEReport } from "@/utils/report-generators/diving-szone-report";
import { generateDivingCPCLBReport } from "@/utils/report-generators/diving-cpclb-report";
import { generateDivingUTCLBReport } from "@/utils/report-generators/diving-utclb-report";
import { generateDivingAnodeReport } from "@/utils/report-generators/diving-anode-report";
import { generateDivingMGIReport } from "@/utils/report-generators/diving-mgi-report";
import { generateROVRICMIReport } from "@/utils/report-generators/rov-ricmi-report";
import { generateDivingANMAINReport } from "@/utils/report-generators/diving-anmain-report";
import { generateDivingItemReport } from "@/utils/report-generators/diving-item-report";
import { generateDivingITMAINReport } from "@/utils/report-generators/diving-itmain-report";
import { generatePipelineDefectSummaryReport } from "@/utils/report-generators/defect-summary-pipeline-report";

// Types
type WizardStep = "template" | "context" | "toc" | "configuration" | "preview";

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
    printBlankReport?: boolean;
}

export { REPORT_TEMPLATES, TOC_SECTIONS } from "./report-template-catalog";

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

export function ReportWizard({ onClose }: ReportWizardProps) {
    const [step, setStep] = useState<WizardStep>("template");
    const [templateSearch, setTemplateSearch] = useState("");
    const [viewMode, setViewMode] = useState<"card" | "list">("card");
    const [selections, setSelections] = useState<SelectionState>({
        templateId: "",
        category: "",
        structureId: "",
        componentId: "",
        jobPackId: "",
        planningId: "",
        procedureId: "",
        sowReportNo: "",
        printBlankReport: false,
    });

    const [selectedTemplates, setSelectedTemplates] = useState<string[]>(() => {
        const allIds: string[] = [];
        TOC_SECTIONS.forEach(sec => sec.templates.forEach(t => allIds.push(t.id)));
        return allIds;
    });
    const [activePreviewTemplate, setActivePreviewTemplate] = useState<string>("");
    const [previewMode, setPreviewMode] = useState<"all" | "individual">("all");
    const [tocSearch, setTocSearch] = useState("");
    const [tocModeFilter, setTocModeFilter] = useState<"all" | "ROV" | "Diving" | "General" | "selected">("all");
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

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

    useEffect(() => {
        if (typeof window !== "undefined") {
            (window as any).__reportConfig = config;
        }
    }, [config]);

    // Data Fetching
    const { data: structuresData } = useSWR("/api/structures", fetcher);
    const structures = structuresData?.data || [];

    // Inspection-specific categories that should only show jobpacks with inspection data
    const INSPECTION_CATEGORIES = ["inspection", "final_report"];
    const isInspectionTemplate = INSPECTION_CATEGORIES.includes(selections.category);

    // Data Fetching for JobPacks - load all jobpacks so all relevant job packs are available
    const { data: allJobPacksData } = useSWR("/api/jobpack?limit=1000", fetcher);
    const { data: inspJobPacksData } = useSWR("/api/jobpack?limit=1000&has_inspection=true", fetcher);

    // Show all jobpacks (prefer allJobPacksData, fallback to inspJobPacksData)
    const jobPacks = (allJobPacksData?.data && allJobPacksData.data.length > 0)
        ? allJobPacksData.data
        : (inspJobPacksData?.data || []);

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

    // Filter state for inspection records (distinct jobpack_id, structure_id, sow_report_no)
    const [structureInspectionFilters, setStructureInspectionFilters] = useState<{ jobpack_id: number; structure_id: number; sow_report_no: string }[]>([]);
    const [isLoadingJobPacksForStructure, setIsLoadingJobPacksForStructure] = useState(false);
    const [inspectionFilters, setInspectionFilters] = useState<{ structure_id: number; sow_report_no: string }[]>([]);

    // Fetch inspection filters for the selected structure to determine inspected jobpacks
    useEffect(() => {
        if (!selections.structureId || selections.structureId === "all") {
            setStructureInspectionFilters([]);
            setIsLoadingJobPacksForStructure(false);
            return;
        }

        let isCurrent = true;
        setIsLoadingJobPacksForStructure(true);
        const rawId = selections.structureId.replace(/^(platform|pipeline)-/, "");

        fetch(`/api/reports/inspection-filters?structure_id=${rawId}`)
            .then(res => res.json())
            .then(data => {
                if (!isCurrent) return;
                if (data.success && Array.isArray(data.data)) {
                    setStructureInspectionFilters(data.data);
                } else {
                    setStructureInspectionFilters([]);
                }
            })
            .catch(err => {
                if (!isCurrent) return;
                console.error("Error fetching inspection filters for structure:", err);
                setStructureInspectionFilters([]);
            })
            .finally(() => {
                if (isCurrent) setIsLoadingJobPacksForStructure(false);
            });

        return () => {
            isCurrent = false;
        };
    }, [selections.structureId]);

    // Fetch inspection filters when jobpack is selected and it's an inspection template (for structure badges)
    useEffect(() => {
        if (selections.jobPackId && isInspectionTemplate) {
            const rawId = selections.structureId ? selections.structureId.replace(/^(platform|pipeline)-/, "") : "";
            const queryUrl = rawId
                ? `/api/reports/inspection-filters?jobpack_id=${selections.jobPackId}&structure_id=${rawId}`
                : `/api/reports/inspection-filters?jobpack_id=${selections.jobPackId}`;

            fetch(queryUrl)
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
    }, [selections.jobPackId, selections.structureId, isInspectionTemplate]);

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
        if (!selections.jobPackId || !selections.structureId || selections.structureId === "all" || !getCurrentTemplate()?.requires.includes("sow_report")) {
            setAvailableSowReports([]);
            setIsLoadingSowReports(false);
            return;
        }

        let isCurrent = true;
        setAvailableSowReports([]);
        setIsLoadingSowReports(true);

        const rawStructureId = selections.structureId.replace(/^(platform|pipeline)-/, "");

        if (isInspectionTemplate) {
            // Check if structureInspectionFilters already contains the distinct SOW report numbers for this jobpack
            const matchingFilters = structureInspectionFilters.filter(
                (f: any) => f.jobpack_id?.toString() === selections.jobPackId && f.structure_id?.toString() === rawStructureId && f.sow_report_no
            );

            if (matchingFilters.length > 0) {
                const uniqueSows = Array.from(new Set(matchingFilters.map((f: any) => f.sow_report_no).filter(Boolean))) as string[];
                setAvailableSowReports(uniqueSows);
                setIsLoadingSowReports(false);
                if (uniqueSows.length > 0) {
                    setSelections(prev => ({ ...prev, sowReportNo: prev.sowReportNo && uniqueSows.includes(prev.sowReportNo) ? prev.sowReportNo : uniqueSows[0] }));
                } else {
                    setSelections(prev => ({ ...prev, sowReportNo: "" }));
                }
                return;
            }

            fetch(`/api/reports/inspection-filters?jobpack_id=${selections.jobPackId}&structure_id=${rawStructureId}`)
                .then(res => res.json())
                .then(data => {
                    if (!isCurrent) return;
                    if (data.success && data.data) {
                        const filters = data.data;
                        const validSows = filters
                            .filter((f: any) => f.sow_report_no)
                            .map((f: any) => f.sow_report_no);
                        const uniqueSows = Array.from(new Set(validSows.filter(Boolean))) as string[];
                        setAvailableSowReports(uniqueSows);
                        if (uniqueSows.length > 0) {
                            setSelections(prev => ({ ...prev, sowReportNo: prev.sowReportNo && uniqueSows.includes(prev.sowReportNo) ? prev.sowReportNo : uniqueSows[0] }));
                        } else {
                            setSelections(prev => ({ ...prev, sowReportNo: "" }));
                        }
                    } else {
                        setAvailableSowReports([]);
                        setSelections(prev => ({ ...prev, sowReportNo: "" }));
                    }
                })
                .catch(err => {
                    if (!isCurrent) return;
                    console.error("Error fetching inspection filters:", err);
                    setAvailableSowReports([]);
                    setSelections(prev => ({ ...prev, sowReportNo: "" }));
                })
                .finally(() => {
                    if (isCurrent) setIsLoadingSowReports(false);
                });
        } else {
            fetch(`/api/sow?jobpack_id=${selections.jobPackId}&structure_id=${rawStructureId}`)
                .then(res => res.json())
                .then(data => {
                    if (!isCurrent) return;
                    if (data.data) {
                        const numbers = data.data.report_numbers?.map((r: any) => r.number || r) || [];
                        const validNumbers = numbers.filter(Boolean);
                        setAvailableSowReports(validNumbers);
                        if (validNumbers.length > 0) {
                            setSelections(prev => ({ ...prev, sowReportNo: prev.sowReportNo && validNumbers.includes(prev.sowReportNo) ? prev.sowReportNo : validNumbers[0] }));
                        } else {
                            setSelections(prev => ({ ...prev, sowReportNo: "" }));
                        }
                    } else {
                        setAvailableSowReports([]);
                        setSelections(prev => ({ ...prev, sowReportNo: "" }));
                    }
                })
                .catch(err => {
                    if (!isCurrent) return;
                    console.error("Error fetching SOW reports:", err);
                    setAvailableSowReports([]);
                    setSelections(prev => ({ ...prev, sowReportNo: "" }));
                })
                .finally(() => {
                    if (isCurrent) setIsLoadingSowReports(false);
                });
        }

        return () => {
            isCurrent = false;
        };
    }, [selections.jobPackId, selections.structureId, selections.templateId, isInspectionTemplate, structureInspectionFilters]);

    // Update Report Prefix in General Info when SOW Report No changes (or when switching templates)
    useEffect(() => {
        if (selections.sowReportNo && getCurrentTemplate()?.requires.includes("sow_report")) {
            setConfig(prev => ({ ...prev, reportNoPrefix: selections.sowReportNo }));
        }
    }, [selections.sowReportNo, selections.templateId]);

    const getCurrentTemplate = () => {
        if (!selections.category || !selections.templateId) return null;
        return (REPORT_TEMPLATES as any)[selections.category]?.find((t: any) => t.id === selections.templateId);
    };

    // Consolidated preview generation logic is handled below near line 1170.


    const handleNext = () => {
        if (step === "template") setStep("context");
        else if (step === "context") {
            if (selections.templateId === "final-inspection-datasheet") {
                setStep("toc");
            } else {
                setStep("configuration");
            }
        }
        else if (step === "toc") setStep("configuration");
        else if (step === "configuration") setStep("preview");
    };

    const handleBack = () => {
        if (step === "preview") {
            setStep("configuration");
            setPreviewUrl(null);
        }
        else if (step === "configuration") {
            if (selections.templateId === "final-inspection-datasheet") {
                setStep("toc");
            } else {
                setStep("context");
            }
        }
        else if (step === "toc") setStep("context");
        else if (step === "context") setStep("template");
    };

    const isStepValid = () => {
        if (step === "template") return !!selections.templateId;
        if (step === "context") {
            if (selections.printBlankReport) return true;
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
        if (step === "toc") return selectedTemplates.length > 0;
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
        let result = Array.isArray(structures) ? [...structures] : [];

        if (structureSearch) {
            const lower = structureSearch.toLowerCase();
            result = result.filter((s: any) =>
                s.str_name?.toLowerCase().includes(lower) ||
                s.str_type?.toLowerCase().includes(lower)
            );
        }

        // Natural alphabetical sorting by structure name A-Z
        result.sort((a: any, b: any) => 
            (a.str_name || "").localeCompare(b.str_name || "", undefined, { numeric: true, sensitivity: 'base' })
        );

        return result;
    }, [structures, structureSearch]);

    // Helper to check if a job pack is associated with a given structure
    const checkJobPackMatchesStructure = useCallback((jp: any, targetStructureId: string) => {
        if (!targetStructureId || targetStructureId === "all") return true;

        const selStruct = structures.find((s: any) => s.id?.toString() === targetStructureId || s.str_id?.toString() === targetStructureId || s.str_name === targetStructureId);
        const selStructName = (selStruct?.str_name || selStruct?.title || selStruct?.name || "").toLowerCase().trim();
        const selStructId = targetStructureId.toString().trim();

        // 1. Direct structure columns on jobpack
        if (jp.structure_id !== undefined && jp.structure_id !== null && jp.structure_id.toString() === selStructId) return true;
        if (Array.isArray(jp.structure_ids) && jp.structure_ids.some((id: any) => id?.toString() === selStructId)) return true;

        const meta = jp.metadata || {};

        // 2. Direct structure IDs in metadata
        if (meta.structure_id !== undefined && meta.structure_id !== null && meta.structure_id.toString() === selStructId) return true;
        if (meta.platform_id !== undefined && meta.platform_id !== null && meta.platform_id.toString() === selStructId) return true;
        if (Array.isArray(meta.structure_ids) && meta.structure_ids.some((id: any) => id?.toString() === selStructId)) return true;

        // 3. Structures list in metadata (structures or structure_list)
        const structuresList = Array.isArray(meta.structures) 
            ? meta.structures 
            : Array.isArray(meta.structure_list) 
            ? meta.structure_list 
            : meta.structures 
            ? [meta.structures] 
            : [];

        if (structuresList.length > 0) {
            for (const s of structuresList) {
                if (!s) continue;
                if (typeof s === 'string' || typeof s === 'number') {
                    if (s.toString() === selStructId) return true;
                    if (selStructName && s.toString().toLowerCase().trim() === selStructName) return true;
                } else if (typeof s === 'object') {
                    const sid = s.id ?? s.str_id ?? s.structure_id ?? s.plat_id;
                    if (sid !== undefined && sid !== null && sid.toString() === selStructId) return true;
                    const sName = s.name ?? s.title ?? s.str_name ?? s.platform_name;
                    if (selStructName && sName && sName.toString().toLowerCase().trim() === selStructName) return true;
                }
            }
        }

        // 4. Platform / Structure name in metadata strings
        const metaPlatform = meta.platform || meta.platform_name || meta.structure_name || meta.platformName;
        if (selStructName && metaPlatform && metaPlatform.toString().toLowerCase().trim() === selStructName) return true;

        // 5. Check if jobpack name or description mentions the structure
        if (selStructName && jp.name && jp.name.toLowerCase().includes(selStructName)) return true;

        // 6. If inspectionFilters exist for this jobpack, check if it matches
        if (inspectionFilters.length > 0 && inspectionFilters.some(f => f.structure_id?.toString() === selStructId)) {
            return true;
        }

        return false;
    }, [structures, inspectionFilters]);

    const inspectedJobPackIdsForStructure = useMemo(() => {
        if (structureInspectionFilters.length === 0) return [];
        return Array.from(new Set(structureInspectionFilters.map(f => f.jobpack_id.toString())));
    }, [structureInspectionFilters]);

    // Filtered Job Packs
    const filteredJobPacks = useMemo(() => {
        let result = jobPacks;

        // Filter by selected structure
        if (selections.structureId && selections.structureId !== "all" && getCurrentTemplate()?.requires.includes("structure")) {
            if (isInspectionTemplate || getCurrentTemplate()?.requires.includes("sow_report")) {
                // Strictly filter to job packs that have inspection records for this structure
                if (structureInspectionFilters.length > 0) {
                    result = result.filter((jp: any) => inspectedJobPackIdsForStructure.includes(jp.id.toString()));
                } else if (isLoadingJobPacksForStructure) {
                    result = [];
                } else {
                    result = [];
                }
            } else {
                result = result.filter((jp: any) => checkJobPackMatchesStructure(jp, selections.structureId));
            }
        }

        if (jobPackSearch) {
            const lower = jobPackSearch.toLowerCase();
            result = result.filter((jp: any) =>
                String(jp.id).includes(lower) ||
                jp.name?.toLowerCase().includes(lower) ||
                jp.status?.toLowerCase().includes(lower)
            );
        }
        return result;
    }, [jobPacks, jobPackSearch, selections.structureId, selections.templateId, isInspectionTemplate, inspectedJobPackIdsForStructure, structureInspectionFilters, isLoadingJobPacksForStructure, checkJobPackMatchesStructure]);

    // Category Selection State
    const [activeCategory, setActiveCategory] = useState<string>("Structure");

    const selectedJobPack = useMemo(() => {
        if (!selections.jobPackId) return null;
        return jobPacks.find((jp: any) => jp.id.toString() === selections.jobPackId);
    }, [jobPacks, selections.jobPackId]);

    const jobPackStructureIds = useMemo(() => {
        if (!selections.jobPackId) return [];
        if (isInspectionTemplate && inspectionFilters.length > 0) {
            return Array.from(new Set(inspectionFilters.map(f => f.structure_id.toString())));
        }
        if (selectedJobPack && selectedJobPack.metadata?.structures) {
            const list = Array.isArray(selectedJobPack.metadata.structures) ? selectedJobPack.metadata.structures : [selectedJobPack.metadata.structures];
            return list.map((s: any) => (s?.id ?? s?.str_id ?? s?.structure_id ?? s)?.toString()).filter(Boolean);
        }
        return [];
    }, [selections.jobPackId, selectedJobPack, isInspectionTemplate, inspectionFilters]);

    const handleStructureSelect = (structureId: string) => {
        setAvailableSowReports([]);
        setSelections(prev => ({
            ...prev,
            structureId,
            jobPackId: "",
            componentId: "",
            sowReportNo: ""
        }));
    };

    // Render Steps
    const renderTemplateSelection = () => {
        const filterTemplates = (templates: any[]) => {
            let list = templates || [];
            if (templateSearch.trim()) {
                const term = templateSearch.toLowerCase();
                list = list.filter(t => 
                    (t.name || "").toLowerCase().includes(term) || 
                    (t.description || "").toLowerCase().includes(term)
                );
            }
            return [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        };

        const categories = {
            "Structure": filterTemplates(REPORT_TEMPLATES.structure),
            "Job Pack": filterTemplates(REPORT_TEMPLATES.jobpack || []),
            "Planning": filterTemplates(REPORT_TEMPLATES.planning || []),
            "Inspection": filterTemplates(REPORT_TEMPLATES.inspection || []),
            "Final Report": filterTemplates((REPORT_TEMPLATES as any).final_report || []),
            "Others": filterTemplates((REPORT_TEMPLATES as any).others || [])
        };

        return (
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                                {cat} {cat === "Final Report" ? "" : "Reports"}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Search Input */}
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search templates..."
                                className="pl-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-9 text-sm rounded-lg"
                                value={templateSearch}
                                onChange={(e) => setTemplateSearch(e.target.value)}
                            />
                            {templateSearch && (
                                <button
                                    onClick={() => setTemplateSearch("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>

                        {/* View Switcher */}
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 h-9">
                            <button
                                onClick={() => setViewMode("card")}
                                className={`px-2.5 rounded-md flex items-center justify-center transition-all ${
                                    viewMode === "card"
                                        ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-sm"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                                title="Card View"
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={`px-2.5 rounded-md flex items-center justify-center transition-all ${
                                    viewMode === "list"
                                        ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-sm"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                                title="List View"
                            >
                                <List className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {viewMode === "card" ? (
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
                                        "Final Report": "final_report",
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
                ) : (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                        {(categories[activeCategory as keyof typeof categories] || []).map((template: any) => {
                            const isSelected = selections.templateId === template.id;
                            return (
                                <div
                                    key={template.id}
                                    onClick={() => {
                                        const categoryMap: Record<string, string> = {
                                            "Structure": "structure",
                                            "Job Pack": "jobpack",
                                            "Planning": "planning",
                                            "Inspection": "inspection",
                                            "Final Report": "final_report",
                                            "Others": "others"
                                        };
                                        setSelections({ ...selections, category: categoryMap[activeCategory] || "structure", templateId: template.id });
                                    }}
                                    className={`
                                        cursor-pointer p-4 transition-all flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50
                                        ${isSelected ? "bg-blue-50/50 dark:bg-blue-950/10" : ""}
                                    `}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`
                                            rounded-lg p-2 transition-colors
                                            ${isSelected ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}
                                        `}>
                                            <template.icon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className={`font-semibold text-sm ${isSelected ? "text-blue-600 dark:text-blue-400" : "text-slate-900 dark:text-slate-100"}`}>{template.name}</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{template.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isSelected && (
                                            <Check className="h-4 w-4 text-blue-600 shrink-0 ml-2" />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    const renderContextSelection = () => {
        const template = getCurrentTemplate();
        if (!template) return null;

        const reqs = template.requires;
        // Determine grid columns based on requirements to make it side-by-side
        const cols = Math.min(reqs.length, 3);

        let stepCounter = 1;

        return (
            <div className="space-y-6 max-w-6xl mx-auto w-full">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Select Data Source</h2>
                    <p className="text-slate-500">Choose the specific items to include in your {template.name}</p>
                </div>

                {/* Print Blank Report Option Banner */}
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500 text-white rounded-lg">
                            <Printer className="h-5 w-5" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Print Blank Inspection Report</h4>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                Generate a single blank page containing template fields & layout (no data required). Structure, Job Pack, and SOW Report selection will be bypassed.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Label htmlFor="print-blank-toggle" className="text-xs font-semibold cursor-pointer text-slate-700 dark:text-slate-300">
                            {selections.printBlankReport ? "Blank Page Enabled" : "Print Blank"}
                        </Label>
                        <Switch
                            id="print-blank-toggle"
                            checked={selections.printBlankReport || false}
                            onCheckedChange={(checked: boolean) => setSelections(prev => ({
                                ...prev,
                                printBlankReport: checked,
                                ...(checked ? {
                                    structureId: "",
                                    jobPackId: "",
                                    componentId: "",
                                    sowReportNo: ""
                                } : {})
                            }))}
                        />
                    </div>
                </div>

                {selections.printBlankReport && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-center text-sm text-blue-700 dark:text-blue-300 font-medium">
                        ✓ Blank report mode active. Click <strong>Next</strong> to customize report settings or preview the blank template.
                    </div>
                )}

                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${cols} gap-6 ${selections.printBlankReport ? "opacity-40 pointer-events-none" : ""}`}>

                    {reqs.includes("structure") && (
                        <PanelContainer
                            title="Structure"
                            stepNum={stepCounter++}
                            disabled={false}
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
                                {/* Optional ALL STRUCTURES selection depending on template */}
                                {["work-scope-report", "work-scope-status", "work-scope-incomplete"].includes(selections.templateId) && (
                                    <div
                                        onClick={() => setSelections({ ...selections, structureId: "all", jobPackId: "", componentId: "", sowReportNo: "" })}
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
                                    (() => {
                                        const jobPackStructures = filteredStructures.filter((s: any) => jobPackStructureIds.includes(s.id.toString()));
                                        const otherStructures = filteredStructures.filter((s: any) => !jobPackStructureIds.includes(s.id.toString()));

                                        const renderStructureItem = (s: any) => {
                                            const isSelected = selections.structureId === s.id.toString();
                                            return (
                                                <div
                                                    key={s.id}
                                                    ref={isSelected ? (el) => { if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" }); } : undefined}
                                                    onClick={() => handleStructureSelect(s.id.toString())}
                                                    className={`
                                                        p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between group
                                                        ${isSelected
                                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm ring-1 ring-blue-500"
                                                            : "border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/50"}
                                                    `}
                                                >
                                                    <div className="overflow-hidden">
                                                        <div className={`font-medium text-sm truncate ${isSelected ? "text-blue-700 dark:text-blue-300 font-semibold" : "text-slate-700 dark:text-slate-300"}`}>{s.str_name}</div>
                                                        <div className="text-xs text-slate-500 truncate mt-0.5">{s.str_type}</div>
                                                    </div>
                                                    {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0 ml-2" />}
                                                </div>
                                            );
                                        };

                                        return (
                                            <div className="space-y-3">
                                                {jobPackStructures.length > 0 && (
                                                    <div className="space-y-1">
                                                        <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider px-2 py-1 bg-blue-50/50 dark:bg-blue-950/30 rounded">
                                                            Involved in Selected Job Pack ({selectedJobPack?.name})
                                                        </div>
                                                        {jobPackStructures.map(renderStructureItem)}
                                                    </div>
                                                )}
                                                {otherStructures.length > 0 && (
                                                    <div className="space-y-1">
                                                        {jobPackStructures.length > 0 && (
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                                                                Other Structures
                                                            </div>
                                                        )}
                                                        {otherStructures.map(renderStructureItem)}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()
                                )}
                            </div>
                        </PanelContainer>
                    )}

                    {reqs.includes("jobpack") && (
                        <PanelContainer
                            title="Job Pack"
                            stepNum={stepCounter++}
                            disabled={reqs.includes("structure") && !selections.structureId}
                        >
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
                                {reqs.includes("structure") && !selections.structureId ? (
                                    <div className="p-4 text-sm text-center text-muted-foreground mt-10">Select a structure first</div>
                                ) : isLoadingJobPacksForStructure ? (
                                    <div className="p-4 text-sm text-center text-muted-foreground mt-10 flex flex-col items-center justify-center gap-2">
                                        <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-xs">Finding inspected job packs...</span>
                                    </div>
                                ) : filteredJobPacks.length === 0 ? (
                                    <div className="p-4 text-sm text-center text-muted-foreground mt-10">
                                        No job packs with inspection records found for this structure
                                    </div>
                                ) : (
                                        filteredJobPacks.map((jp: any) => {
                                            const isSelected = selections.jobPackId === jp.id.toString();
                                            return (
                                                <div
                                                    key={jp.id}
                                                    ref={isSelected ? (el) => { if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" }); } : undefined}
                                                    onClick={() => {
                                                        setAvailableSowReports([]);
                                                        setIsLoadingSowReports(true);
                                                        setSelections({ ...selections, jobPackId: jp.id.toString(), componentId: "", sowReportNo: "" });
                                                    }}
                                                    className={`
                                                        p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between group
                                                        ${isSelected
                                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm ring-1 ring-blue-500"
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

                    {reqs.includes("sow_report") && (
                        <PanelContainer
                            title="SOW Report"
                            stepNum={stepCounter++}
                            disabled={!selections.jobPackId || !selections.structureId || selections.structureId === "all"}
                        >
                            <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 min-h-[57px] flex items-center">
                                <span className="text-xs text-slate-500">Available reports for selected structure</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/30 dark:bg-slate-900/20">
                                {!selections.jobPackId ? (
                                    <div className="p-4 text-sm text-center text-muted-foreground mt-10">Select a job pack first</div>
                                ) : isLoadingSowReports ? (
                                    <div className="p-4 text-sm text-center text-muted-foreground mt-10 flex flex-col items-center justify-center gap-2">
                                        <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-xs">Loading report numbers...</span>
                                    </div>
                                ) : availableSowReports.length === 0 ? (
                                    <div className="p-4 text-sm text-center text-muted-foreground mt-10">No report numbers found</div>
                                ) : (
                                    availableSowReports.map((reportNo, idx) => {
                                        const isSelected = selections.sowReportNo === reportNo;
                                        return (
                                            <div
                                                key={`${reportNo}-${idx}`}
                                                ref={isSelected ? (el) => { if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" }); } : undefined}
                                                onClick={() => setSelections({ ...selections, sowReportNo: reportNo })}
                                                className={`
                                                    p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between
                                                    ${isSelected
                                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm ring-1 ring-blue-500"
                                                        : "border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/50"}
                                                `}
                                            >
                                                <div className={`font-medium text-sm ${isSelected ? "text-blue-700 dark:text-blue-300 font-semibold" : "text-slate-700 dark:text-slate-300"}`}>{reportNo}</div>
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
                                                ref={isSelected ? (el) => { if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" }); } : undefined}
                                                onClick={() => setSelections({ ...selections, componentId: comp.id })}
                                                className={`
                                                    p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between
                                                    ${isSelected
                                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm ring-1 ring-blue-500"
                                                        : "border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/50"}
                                                `}
                                            >
                                                <div className="overflow-hidden">
                                                    <div className={`font-medium text-sm truncate ${isSelected ? "text-blue-700 dark:text-blue-300 font-semibold" : "text-slate-700 dark:text-slate-300"}`}>{comp.name}</div>
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

    const allTocTemplates = useMemo(() => {
        return TOC_SECTIONS.flatMap(sec => sec.templates);
    }, []);

    const toggleTemplate = (id: string) => {
        setSelectedTemplates(prev => 
            prev.includes(id) ? prev.filter(tId => tId !== id) : [...prev, id]
        );
    };

    const toggleSectionAll = (sectionIndex: number, checked: boolean) => {
        const secTemplates = TOC_SECTIONS[sectionIndex].templates.map(t => t.id);
        if (checked) {
            setSelectedTemplates(prev => Array.from(new Set([...prev, ...secTemplates])));
        } else {
            setSelectedTemplates(prev => prev.filter(id => !secTemplates.includes(id)));
        }
    };

    const selectAllTemplates = () => {
        setSelectedTemplates(allTocTemplates.map(t => t.id));
    };

    const deselectAllTemplates = () => {
        setSelectedTemplates([]);
    };

    const selectTemplatesByMode = (mode: string) => {
        const modeTemplateIds = allTocTemplates
            .filter(t => t.mode?.toLowerCase() === mode.toLowerCase())
            .map(t => t.id);
        setSelectedTemplates(prev => Array.from(new Set([...prev, ...modeTemplateIds])));
    };

    const toggleCollapseSection = (secId: string | number) => {
        const key = String(secId);
        setCollapsedSections(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const expandAllSections = () => {
        setCollapsedSections({});
    };

    const collapseAllSections = () => {
        const allCollapsed: Record<string, boolean> = {};
        TOC_SECTIONS.forEach(s => {
            allCollapsed[String(s.id)] = true;
        });
        setCollapsedSections(allCollapsed);
    };

    const renderTocSelection = () => {
        const totalCount = allTocTemplates.length;
        const selectedCount = selectedTemplates.length;
        const selectionPercent = totalCount > 0 ? Math.round((selectedCount / totalCount) * 100) : 0;

        const rovCount = allTocTemplates.filter(t => t.mode?.toLowerCase() === "rov").length;
        const divingCount = allTocTemplates.filter(t => t.mode?.toLowerCase() === "diving").length;
        const generalCount = allTocTemplates.filter(t => t.mode?.toLowerCase() === "general").length;

        const selectedRovCount = allTocTemplates.filter(t => t.mode?.toLowerCase() === "rov" && selectedTemplates.includes(t.id)).length;
        const selectedDivingCount = allTocTemplates.filter(t => t.mode?.toLowerCase() === "diving" && selectedTemplates.includes(t.id)).length;

        // Filter sections and templates based on search & mode filter
        const filteredSections = TOC_SECTIONS.map((sec, secIdx) => {
            const matchesSearch = (text: string) => 
                !tocSearch.trim() || text.toLowerCase().includes(tocSearch.trim().toLowerCase());

            const matchingTemplates = sec.templates.filter(t => {
                const matchesText = matchesSearch(t.name) || matchesSearch(t.mode) || matchesSearch(sec.name) || matchesSearch(t.id);
                if (!matchesText) return false;

                if (tocModeFilter === "all") return true;
                if (tocModeFilter === "selected") return selectedTemplates.includes(t.id);
                return t.mode?.toLowerCase() === tocModeFilter.toLowerCase();
            });

            return {
                ...sec,
                originalIndex: secIdx,
                filteredTemplates: matchingTemplates,
                hasMatches: matchingTemplates.length > 0 || (sec.templates.length === 0 && matchesSearch(sec.name))
            };
        }).filter(sec => sec.hasMatches);

        const totalVisibleTemplates = filteredSections.reduce((sum, sec) => sum + sec.filteredTemplates.length, 0);

        return (
            <div className="space-y-6 max-w-5xl mx-auto pb-6">
                {/* Header Section */}
                <div className="text-center space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-1">
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>Step 3: Document Sequencing</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                        Table of Contents Checklist
                    </h2>
                    <p className="text-sm text-slate-500 max-w-lg mx-auto">
                        Select which inspection report sections and datasheets should be compiled into the final document.
                    </p>
                </div>

                {/* Top Control Dashboard */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-4">
                    {/* Top Row: Search Bar & Selection Progress */}
                    <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                        {/* Search Bar */}
                        <div className="relative flex-1 min-w-[260px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Search report name, mode, or section (e.g., 'CP', 'FMD', 'ROV')..."
                                value={tocSearch}
                                onChange={(e) => setTocSearch(e.target.value)}
                                className="pl-9 pr-9 h-10 text-sm bg-slate-50/50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl"
                            />
                            {tocSearch && (
                                <button
                                    onClick={() => setTocSearch("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Progress / Selected Stats */}
                        <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/80 dark:border-slate-800 self-stretch md:self-auto justify-between md:justify-start">
                            <div className="flex flex-col">
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Selected Items
                                </span>
                                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                    <span className="text-blue-600 dark:text-blue-400">{selectedCount}</span>
                                    <span className="text-slate-400 font-normal">/</span>
                                    <span>{totalCount}</span>
                                    <span className="text-xs text-slate-400 font-normal">({selectionPercent}%)</span>
                                </span>
                            </div>
                            <div className="w-24 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shrink-0">
                                <div
                                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                                    style={{ width: `${selectionPercent}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Middle Row: Mode Filters & Global Select Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                        {/* Filter Tabs */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-medium text-slate-500 mr-1 flex items-center gap-1">
                                <Filter className="w-3.5 h-3.5" /> Filter:
                            </span>

                            <button
                                onClick={() => setTocModeFilter("all")}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                    tocModeFilter === "all"
                                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                                }`}
                            >
                                All ({totalCount})
                            </button>

                            <button
                                onClick={() => setTocModeFilter("ROV")}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                                    tocModeFilter === "ROV"
                                        ? "bg-amber-600 text-white shadow-sm"
                                        : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/50 hover:bg-amber-100"
                                }`}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                ROV ({rovCount})
                            </button>

                            <button
                                onClick={() => setTocModeFilter("Diving")}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                                    tocModeFilter === "Diving"
                                        ? "bg-indigo-600 text-white shadow-sm"
                                        : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-900/50 hover:bg-indigo-100"
                                }`}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                Diving ({divingCount})
                            </button>

                            <button
                                onClick={() => setTocModeFilter("General")}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                                    tocModeFilter === "General"
                                        ? "bg-slate-700 text-white shadow-sm"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                                }`}
                            >
                                General ({generalCount})
                            </button>

                            <button
                                onClick={() => setTocModeFilter("selected")}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                                    tocModeFilter === "selected"
                                        ? "bg-blue-600 text-white shadow-sm"
                                        : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/50 hover:bg-blue-100"
                                }`}
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                                Selected Only ({selectedCount})
                            </button>
                        </div>

                        {/* Batch Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={selectAllTemplates}
                                className="h-8 text-xs gap-1.5 font-medium border-slate-200 dark:border-slate-800 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                            >
                                <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                                Select All
                            </Button>

                            <Button
                                size="sm"
                                variant="outline"
                                onClick={deselectAllTemplates}
                                disabled={selectedCount === 0}
                                className="h-8 text-xs gap-1.5 font-medium border-slate-200 dark:border-slate-800 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Clear All
                            </Button>

                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                    const anyCollapsed = Object.values(collapsedSections).some(Boolean);
                                    if (anyCollapsed) {
                                        expandAllSections();
                                    } else {
                                        collapseAllSections();
                                    }
                                }}
                                className="h-8 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                            >
                                {Object.values(collapsedSections).some(Boolean) ? (
                                    <>
                                        <ChevronDown className="w-3.5 h-3.5 mr-1" /> Expand All
                                    </>
                                ) : (
                                    <>
                                        <ChevronUp className="w-3.5 h-3.5 mr-1" /> Collapse All
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Quick Selection Presets Bar */}
                <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Quick Select:</span>
                    <button
                        onClick={() => selectTemplatesByMode("rov")}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100/70 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-medium transition-colors"
                    >
                        + All ROV Reports ({rovCount})
                    </button>
                    <button
                        onClick={() => selectTemplatesByMode("diving")}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100/70 hover:bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 font-medium transition-colors"
                    >
                        + All Diving Reports ({divingCount})
                    </button>
                    <button
                        onClick={() => selectTemplatesByMode("general")}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium transition-colors"
                    >
                        + All General Reports ({generalCount})
                    </button>
                </div>

                {/* Main List of Sections and Items */}
                {filteredSections.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3 shadow-sm">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                            <Search className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                            No report templates found
                        </h3>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                            No reports match your current search query <b>"{tocSearch}"</b> or mode filter.
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setTocSearch("");
                                setTocModeFilter("all");
                            }}
                            className="mt-2 text-xs"
                        >
                            Reset Search & Filters
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredSections.map((sec) => {
                            const secTemplates = sec.templates.map(t => t.id);
                            const secSelectedTemplates = sec.templates.filter(t => selectedTemplates.includes(t.id));
                            const allSelected = secTemplates.length > 0 && secSelectedTemplates.length === secTemplates.length;
                            const someSelected = secSelectedTemplates.length > 0 && !allSelected;
                            const isCollapsed = !!collapsedSections[sec.id];

                            return (
                                <div
                                    key={sec.id}
                                    className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-700"
                                >
                                    {/* Section Header */}
                                    <div className="p-4 bg-slate-50/70 dark:bg-slate-900/90 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 select-none">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <input
                                                type="checkbox"
                                                id={`sec-${sec.id}`}
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                checked={allSelected}
                                                ref={el => {
                                                    if (el) el.indeterminate = someSelected;
                                                }}
                                                onChange={(e) => toggleSectionAll(sec.originalIndex, e.target.checked)}
                                                disabled={sec.templates.length === 0}
                                            />
                                            <label
                                                htmlFor={`sec-${sec.id}`}
                                                className="font-bold text-slate-900 dark:text-slate-100 text-sm md:text-base cursor-pointer hover:text-blue-600 transition-colors flex items-center gap-2 truncate"
                                            >
                                                <span>{sec.name}</span>
                                            </label>
                                            <Badge
                                                variant="secondary"
                                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                                    allSelected
                                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                                        : someSelected
                                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                                        : "bg-slate-200/70 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                                }`}
                                            >
                                                {secSelectedTemplates.length}/{sec.templates.length} selected
                                            </Badge>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {sec.templates.length > 0 && (
                                                <button
                                                    onClick={() => toggleSectionAll(sec.originalIndex, !allSelected)}
                                                    className="text-xs text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 font-medium px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden sm:inline-block"
                                                >
                                                    {allSelected ? "Clear Section" : "Select All in Section"}
                                                </button>
                                            )}

                                            <button
                                                onClick={() => toggleCollapseSection(sec.id)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                                                title={isCollapsed ? "Expand section" : "Collapse section"}
                                            >
                                                {isCollapsed ? (
                                                    <ChevronDown className="w-4 h-4" />
                                                ) : (
                                                    <ChevronUp className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Section Item Cards */}
                                    {!isCollapsed && (
                                        <div className="p-4">
                                            {sec.templates.length === 0 ? (
                                                <p className="text-xs text-muted-foreground italic py-2">
                                                    No templates configured for this section yet.
                                                </p>
                                            ) : sec.filteredTemplates.length === 0 ? (
                                                <p className="text-xs text-muted-foreground italic py-2">
                                                    No reports in this section match the current search or filter.
                                                </p>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {sec.filteredTemplates.map((t) => {
                                                        const isSelected = selectedTemplates.includes(t.id);
                                                        const isROV = t.mode?.toLowerCase() === "rov";
                                                        const isDiving = t.mode?.toLowerCase() === "diving";

                                                        return (
                                                            <div
                                                                key={t.id}
                                                                onClick={() => toggleTemplate(t.id)}
                                                                className={`group relative flex items-start gap-3 p-3.5 rounded-xl cursor-pointer border transition-all duration-200 select-none ${
                                                                    isSelected
                                                                        ? "border-blue-500/80 bg-blue-50/70 dark:bg-blue-950/40 shadow-sm ring-1 ring-blue-500/20"
                                                                        : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/60 hover:bg-slate-50/50"
                                                                }`}
                                                            >
                                                                {/* Custom Checkbox */}
                                                                <div className="pt-0.5 shrink-0">
                                                                    <div
                                                                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                                                            isSelected
                                                                                ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                                                                : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 group-hover:border-blue-400"
                                                                        }`}
                                                                    >
                                                                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                                                    </div>
                                                                </div>

                                                                {/* Item Info */}
                                                                <div className="flex-1 min-w-0 space-y-1">
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <span className={`text-sm font-semibold leading-tight line-clamp-2 ${
                                                                            isSelected ? "text-slate-900 dark:text-white" : "text-slate-800 dark:text-slate-200"
                                                                        }`}>
                                                                            {t.name}
                                                                        </span>
                                                                        <span
                                                                            className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md shrink-0 ${
                                                                                isROV
                                                                                    ? "bg-amber-100 text-amber-800 border border-amber-200/70 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-900/50"
                                                                                    : isDiving
                                                                                    ? "bg-indigo-100 text-indigo-800 border border-indigo-200/70 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-900/50"
                                                                                    : "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                                                                            }`}
                                                                        >
                                                                            {t.mode}
                                                                        </span>
                                                                    </div>

                                                                    {t.id && (
                                                                        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 block truncate">
                                                                            ID: {t.id}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
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
    const [generationProgress, setGenerationProgress] = useState<number>(0);
    const [currentGeneratingTemplate, setCurrentGeneratingTemplate] = useState<string>("");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Invalidate preview when selections or config change
    useEffect(() => {
        setPreviewUrl(null);
    }, [selections, config]);

    // Auto-generate preview when entering preview step or key dependencies change
    useEffect(() => {
        if (step === "preview") {
            const isDefectReport = selections.templateId === "defect-criteria-report";
            const isJobPackReport = selections.templateId === "jobpack-summary";
            if (selections.printBlankReport || selections.structureId || isDefectReport || (isJobPackReport && selections.jobPackId)) {
                generatePreview();
            }
        }
    }, [
        step,
        previewMode,
        activePreviewTemplate,
        selectedTemplates,
        selections.structureId,
        selections.templateId,
        selections.jobPackId,
        selections.componentId,
        selections.planningId,
        selections.procedureId,
        selections.printBlankReport
    ]);

    const fetchStructureData = async () => {
        if (!selections.structureId) {
            console.log("[fetchStructureData] No structureId selected");
            return null;
        }
        const cleanId = String(selections.structureId).replace(/^(platform|pipeline)-/, "").trim();
        console.log(`[fetchStructureData] Fetching data for structure ID: ${cleanId}`);
        try {
            const res = await fetch(`/api/structures/${cleanId}`);
            const data = await res.json();
            if (!data.success && !data.data) {
                console.warn("[fetchStructureData] API returned success=false");
                return null;
            }

            const structureData = data.data || data;
            console.log(`[fetchStructureData] Success. Structure name: ${structureData.str_name}`);

            // Fetch discussion/comment records for this structure
            try {
                const strType = structureData.str_type?.toLowerCase() || "platform";
                console.log(`[fetchStructureData] Fetching comments for ${strType} structure ID: ${cleanId}`);
                const commentRes = await fetch(`/api/comment/${strType}/${cleanId}`);
                const commentText = await commentRes.text();
                if (commentText.trim()) {
                    const commentJson = JSON.parse(commentText);
                    if (commentJson.data && Array.isArray(commentJson.data)) {
                        structureData.discussions = commentJson.data;
                        console.log(`[fetchStructureData] Loaded ${commentJson.data.length} comments`);
                    }
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
        if (!selections.jobPackId) {
            console.log("[fetchJobPackData] No jobPackId selected");
            return null;
        }
        console.log(`[fetchJobPackData] Fetching data for job pack ID: ${selections.jobPackId}`);
        try {
            const res = await fetch(`/api/jobpack/${selections.jobPackId}`);
            const data = await res.json();
            if (data.data) {
                console.log(`[fetchJobPackData] Success. Jobpack name: ${data.data.name || data.data.title}`);
                return data.data;
            }
            console.warn("[fetchJobPackData] No data field in API response");
            return data;
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

    const generateCoverPage = async (templateName: string): Promise<Blob> => {
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const width = doc.internal.pageSize.getWidth();
        const height = doc.internal.pageSize.getHeight();

        // Background / Border
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(1);
        doc.rect(10, 10, width - 20, height - 20);
        
        doc.setDrawColor(37, 99, 235); // blue-600
        doc.setLineWidth(2);
        doc.rect(15, 15, width - 30, height - 30);

        // Main Title (Centered vertically and horizontally)
        doc.setTextColor(30, 41, 59); // slate-800
        const fontSize = 26;
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", "bold");
        
        // Wrap text if too long
        const splitTitle = doc.splitTextToSize(templateName.toUpperCase(), width - 60);
        const numLines = Array.isArray(splitTitle) ? splitTitle.length : 1;
        const lineHeightMm = 11.5;
        const startY = (height / 2) - ((numLines - 1) * lineHeightMm / 2) + 3.5;
        doc.text(splitTitle, width / 2, startY, { align: "center" });

        return doc.output('blob');
    };

    const generateReportAction = async (returnBlob: boolean = false, templateIdOverride?: string): Promise<any> => {
        const currentTemplateId = templateIdOverride || selections.templateId;
        const originalTemplateId = selections.templateId;

        try {
            const {
                generateStructureReport,
                generateComponentSummaryReport,
                generateComponentSpecReport,
                generateTechnicalSpecsReport
            } = await import("@/utils/pdf-generator");

            // Dynamic import for new generators
            const { generateDefectCriteriaReport } = await import("@/utils/report-generators/defect-criteria-report");
            const { generateJobPackSummaryReport } = await import("@/utils/report-generators/jobpack-summary-report");
            const { generateWorkScopeStatusReport } = await import("@/utils/report-generators/work-scope-status-report");
            const { generateWorkScopeIncompleteReport } = await import("@/utils/report-generators/work-scope-incomplete-report");
            const { generateDefectAnomalyReport } = await import("@/utils/report-generators/defect-anomaly-report");
            const { generateDiverLogReport } = await import("@/utils/report-generators/diver-log-report");
            const { generateVideoLogReport } = await import("@/utils/report-generators/video-log-report");
            const { generateDefectSummaryReport } = await import("@/utils/report-generators/defect-summary-report");
            const { generateROVMGIGraphReport } = await import("@/utils/report-generators/rov-mgi-report");
            const { generateROVRMGIReport } = await import("@/utils/report-generators/rov-rmgi-report");
            const { generateROVFMDReport } = await import("@/utils/report-generators/rov-fmd-report");
            const { generateROVSZCIReport } = await import("@/utils/report-generators/rov-szci-report");
            const { generateROVUTWTReport } = await import("@/utils/report-generators/rov-utwt-report");
            const { generateROVRRISIReport } = await import("@/utils/report-generators/rov-rrisi-report");
            const { generateROVRRISIDetailReport } = await import("@/utils/report-generators/rov-rrisi-detail-report");
            const { generateROVRRISIJTubeDetailReport } = await import("@/utils/report-generators/rov-jtisi-detail-report");
            const { generateROVRRISIITubeDetailReport } = await import("@/utils/report-generators/rov-itisi-detail-report");
            const { generateROVRSEABDetailReport } = await import("@/utils/report-generators/rov-rseab-detail-report");
            const { generateROVRSEABGasDetailReport } = await import("@/utils/report-generators/rov-rseab-gas-detail-report");
            const { generateROVRSEABCraterDetailReport } = await import("@/utils/report-generators/rov-rseab-crater-detail-report");
            const { generateROVRSCORReport } = await import("@/utils/report-generators/rov-rscor-report");
            const { generateROVRSCORSurveyReport } = await import("@/utils/report-generators/rov-rscor-survey-report");
            const { generateROVCPReport, isROVRecord, hasCPReading } = await import("@/utils/report-generators/rov-cp-report");
            const { generateROVRGVIReport }  = await import("@/utils/report-generators/rov-rgvi-report");
            const { generateROVCondReport }  = await import("@/utils/report-generators/rov-rcond-report");
            const { generateROVCondSketchReport } = await import("@/utils/report-generators/rov-rcond-sketch-report");
            const { generatePipelineEventSketchReport } = await import("@/utils/report-generators/pipeline-event-sketch-report");
            const { generateROVNavigReport } = await import("@/utils/report-generators/rov-navig-report");
            const { generateROVBoatlandingReport } = await import("@/utils/report-generators/rov-boatlanding-report");
            const { generateROVRiserGuardReport } = await import("@/utils/report-generators/rov-riser-guard-report");
            const { generateROVCaissonGuardReport } = await import("@/utils/report-generators/rov-caisson-guard-report");
            const { generateROVConductorGuardReport } = await import("@/utils/report-generators/rov-conductor-guard-report");
            const { generateDivingGVINSReport } = await import("@/utils/report-generators/diving-gvins-report");
            const { generateDivingBSINSReport } = await import("@/utils/report-generators/diving-bsins-report");
            const { generateDivingMPINSReport } = await import("@/utils/report-generators/diving-mpins-report");
            const { generateDivingCVINSReport } = await import("@/utils/report-generators/diving-cvins-report");
            const { generateDivingCLEANReport } = await import("@/utils/report-generators/diving-clean-report");
            const { generateDivingUTWTKReport } = await import("@/utils/report-generators/diving-utwtk-report");
            const { generateDivingACFMCReport } = await import("@/utils/report-generators/diving-acfmc-report");
            const { generateDivingPLCOReport } = await import("@/utils/report-generators/diving-plco-report");
            const { generateROVRWDIReport } = await import("@/utils/report-generators/rov-rwdi-report");
            const { generateDivingDCASNUWReport } = await import("@/utils/report-generators/diving-dcasn-uw-report");
            const { generateDivingDCASNTSReport } = await import("@/utils/report-generators/diving-dcasn-ts-report");
            const { generateDivingDCASNReport } = await import("@/utils/report-generators/diving-dcasn-report");
            const { generateDivingDCONDUWReport } = await import("@/utils/report-generators/diving-dcond-uw-report");
            const { generateDivingDCONDTSReport } = await import("@/utils/report-generators/diving-dcond-ts-report");
            const { generateDivingDCONDReport } = await import("@/utils/report-generators/diving-dcond-report");
            const { generateDivingFMDReport } = await import("@/utils/report-generators/diving-fmd-report");
            const { generateDivingMEASUReport } = await import("@/utils/report-generators/diving-measu-report");
            const { generateDivingRRISIReport } = await import("@/utils/report-generators/diving-rrisi-report");
            const { generateDivingRRISIDetailReport } = await import("@/utils/report-generators/diving-rrisi-detail-report");


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

        const cleanStructureId = selections.structureId ? String(selections.structureId).replace(/^(platform|pipeline)-/, "").trim() : "";
        const structId = cleanStructureId ? Number(cleanStructureId) : NaN;
        const cleanJobPackId = selections.jobPackId ? String(selections.jobPackId).trim() : "";
        const jobPackIdNum = cleanJobPackId ? Number(cleanJobPackId) : NaN;

        const isFinalDatasheet = selections.templateId === "final-inspection-datasheet";

        const reportConfig = { 
            ...config, 
            returnBlob,
            isBlankReport: selections.printBlankReport ?? false,
            jobPackId: isNaN(jobPackIdNum) ? selections.jobPackId : jobPackIdNum,
            structureId: isNaN(structId) ? selections.structureId : structId,
            sowReportNo: selections.sowReportNo,
            ...(isFinalDatasheet ? { showPageNumbers: false, showSignatures: false, isFinalDatasheet: true } : {})
        };

        // Universal Blank Report Interceptor — guarantees ALL report templates produce an authentic blank report
        if (selections.printBlankReport) {
            const { generateBlankInspectionReport } = await import("@/utils/report-generators/blank-inspection-report");
            const targetT = getCurrentTemplate() || TOC_SECTIONS.flatMap(s => s.templates).find(t => t.id === currentTemplateId);
            const templateTitle = targetT?.name || currentTemplateId;
            return await generateBlankInspectionReport(currentTemplateId, templateTitle, companySettings, reportConfig as any);
        }



        // Final Inspection Datasheet Interceptor
        if (currentTemplateId === "final-inspection-datasheet") {
            const selectedTOC = TOC_SECTIONS.flatMap(s => s.templates).filter(t => selectedTemplates.includes(t.id));

            if (previewMode === "individual") {
                const targetId = activePreviewTemplate || (selectedTOC[0]?.id || "");
                if (!targetId) return null;

                try {
                    const result = await generateReportAction(returnBlob, targetId);
                    return result;
                } catch (err) {
                    console.error("Error executing dynamic sub-template generation:", err);
                    return null;
                }
            } else {
                // All-in-One: Combine all selected templates with cover sheets!
                if (selectedTOC.length === 0) return null;

                const originalAlert = window.alert;
                window.alert = () => {}; 
                try {
                    const mergedPdf = await PDFDocument.create();

                    let count = 0;
                    for (const s of TOC_SECTIONS) {
                        const sectionTemplates = s.templates.filter(t => selectedTemplates.includes(t.id));
                        if (sectionTemplates.length === 0) continue;

                        const sectionReportBlobs: Blob[] = [];

                        for (const t of sectionTemplates) {
                            count++;
                            setCurrentGeneratingTemplate(t.name);
                            setGenerationProgress(Math.min(95, 5 + Math.round(((count - 1) / selectedTOC.length) * 90)));
                            await new Promise(resolve => setTimeout(resolve, 400));

                            try {
                                let sectionResult = await generateReportAction(true, t.id); // Must ask for Blob
                                if (sectionResult && !(sectionResult instanceof Blob) && (sectionResult as any).output) {
                                    sectionResult = (sectionResult as any).output('blob');
                                }
                                if (sectionResult instanceof Blob) {
                                    sectionReportBlobs.push(sectionResult);
                                } else {
                                    console.warn(`Skipping template ${t.name} as it yielded no records.`);
                                }
                            } catch (err) {
                                console.error(`Error generating template report for ${t.name}:`, err);
                            }
                        }

                        if (sectionReportBlobs.length > 0) {
                            try {
                                // Section generated! NOW add cover page for the entire SECTION
                                const coverBlob = await generateCoverPage(s.name);
                                const coverArrayBuffer = await coverBlob.arrayBuffer();
                                const donorCoverPdf = await PDFDocument.load(coverArrayBuffer);
                                const copiedCoverPages = await mergedPdf.copyPages(donorCoverPdf, donorCoverPdf.getPageIndices());
                                copiedCoverPages.forEach((page) => mergedPdf.addPage(page));

                                // Add section pages
                                for (const blob of sectionReportBlobs) {
                                    const sectionArrayBuffer = await blob.arrayBuffer();
                                    const donorSectionPdf = await PDFDocument.load(sectionArrayBuffer);
                                    const copiedSectionPages = await mergedPdf.copyPages(donorSectionPdf, donorSectionPdf.getPageIndices());
                                    copiedSectionPages.forEach((page) => mergedPdf.addPage(page));
                                }
                            } catch (coverErr) {
                                console.error(`Error appending section ${s.name} cover and pages:`, coverErr);
                            }
                        }
                    }

                    // Stamp global continuous page numbers on all merged pages
                    const totalPagesCount = mergedPdf.getPageCount();
                    const font = await mergedPdf.embedFont(StandardFonts.Helvetica);

                    for (let idx = 0; idx < totalPagesCount; idx++) {
                        const p = mergedPdf.getPage(idx);
                        const { width } = p.getSize();
                        const pageStr = `Page ${idx + 1} of ${totalPagesCount}`;
                        const fontSize = 8;
                        const textWidth = font.widthOfTextAtSize(pageStr, fontSize);

                        p.drawText(pageStr, {
                            x: width - 12 - textWidth,
                            y: 6,
                            size: fontSize,
                            font,
                            color: rgb(0.12, 0.16, 0.23), // slate-800
                        });
                    }

                    setGenerationProgress(100);
                    setCurrentGeneratingTemplate("Finalizing combined PDF package...");
                    await new Promise(resolve => setTimeout(resolve, 500));
                    const mergedPdfBytes = await mergedPdf.save();
                    const finalBlob = new Blob([mergedPdfBytes], { type: 'application/pdf' });

                    if (returnBlob) {
                        return finalBlob;
                    } else {
                        // Trigger standard save
                        const downloadUrl = URL.createObjectURL(finalBlob);
                        const a = document.createElement('a');
                        a.href = downloadUrl;
                        a.download = `Final_Inspection_Datasheet_All_In_One.pdf`;
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
                        return null;
                    }
                } catch (err) {
                    console.error("Error creating All-In-One merged dataset:", err);
                    return null;
                } finally {
                    window.alert = originalAlert;
                }
            }
        }

        // Defect Criteria Report (No Structure Data Required)
        if (currentTemplateId === "defect-criteria-report") {
            return await generateDefectCriteriaReport(companySettings, { ...reportConfig, procedureId: selections.procedureId, sowReportNo: selections.sowReportNo || reportConfig?.reportNoPrefix, reportNoPrefix: reportConfig?.reportNoPrefix || selections.sowReportNo } as any);
        }

        // Defect Summary Report / Findings Summary Report
        if (currentTemplateId === "defect-summary" || currentTemplateId === "findings-summary") {
            const jobPack = selections.printBlankReport ? { name: ". . . . . . . . . . . . . . . . . . . .", metadata: {} } : await fetchJobPackData();
            const structure = selections.printBlankReport ? { str_name: ". . . . . . . . . . . . . . . . . . . ." } : (selections.structureId ? await fetchStructureData() : null);
            if (!jobPack && !selections.printBlankReport) return null;

            const isFindingsReport = currentTemplateId === "findings-summary";
            const extendedConfig = { ...reportConfig, prefix: isFindingsReport ? "F-" : "A-", isFindingsReport };

            return await generateDefectSummaryReport(jobPack || {}, structure || {}, selections.sowReportNo, companySettings, extendedConfig as any);
        }

        // Defect Summary Report (Pipeline) & Finding Summary Report (Pipeline)
        if (currentTemplateId === "defect-summary-pipeline" || currentTemplateId === "defect-summary-pipeline-report" || currentTemplateId === "findings-summary-pipeline" || currentTemplateId === "findings-summary-pipeline-report") {
            const jobPack = selections.printBlankReport ? { name: ". . . . . . . . . . . . . . . . . . . .", metadata: {} } : await fetchJobPackData();
            const structure = selections.printBlankReport ? { str_name: ". . . . . . . . . . . . . . . . . . . ." } : (selections.structureId ? await fetchStructureData() : null);
            if (!jobPack && !selections.printBlankReport) return null;

            const isFindingsReport = currentTemplateId.includes("findings");
            const extendedConfig = {
                ...reportConfig,
                isFindingsReport,
                prefix: isFindingsReport ? "F-" : ((reportConfig as any)?.prefix || "DSR-PL")
            };

            return await generatePipelineDefectSummaryReport(jobPack || {}, structure || {}, selections.sowReportNo, companySettings, extendedConfig as any);
        }

        // Defect / Anomaly Report / Findings Report
        if (currentTemplateId === "defect-anomaly-report" || currentTemplateId === "findings-report") {
            const jobPack = selections.printBlankReport ? { name: ". . . . . . . . . . . . . . . . . . . .", metadata: {} } : await fetchJobPackData();
            const structure = selections.printBlankReport ? { str_name: ". . . . . . . . . . . . . . . . . . . ." } : await fetchStructureData();
            if ((!jobPack || !structure) && !selections.printBlankReport) return null;

            const isFindingsReport = currentTemplateId === "findings-report";
            const extendedConfig = { ...reportConfig, prefix: isFindingsReport ? "F-" : "A-", isFindingsReport };

            return await generateDefectAnomalyReport(jobPack || {}, structure || {}, selections.sowReportNo, companySettings, extendedConfig as any);
        }

        // Diver Log Report
        if (currentTemplateId === "diver-log-report") {
            const jobPack = selections.printBlankReport ? { name: ". . . . . . . . . . . . . . . . . . . .", metadata: {} } : await fetchJobPackData();
            const structure = selections.printBlankReport ? { str_name: ". . . . . . . . . . . . . . . . . . . ." } : await fetchStructureData();
            if ((!jobPack || !structure) && !selections.printBlankReport) return null;

            return await generateDiverLogReport(jobPack || {}, structure || {}, selections.sowReportNo, companySettings, reportConfig);
        }

        // Video Log Report
        if (currentTemplateId === "video-log-report") {
            const jobPack = selections.printBlankReport ? { name: ". . . . . . . . . . . . . . . . . . . .", metadata: {} } : await fetchJobPackData();
            const structure = selections.printBlankReport ? { str_name: ". . . . . . . . . . . . . . . . . . . ." } : await fetchStructureData();
            if ((!jobPack || !structure) && !selections.printBlankReport) return null;

            return await generateVideoLogReport(jobPack || {}, structure || {}, selections.sowReportNo, companySettings, reportConfig);
        }

        // Pipeline Event List Sketch Report
        if (currentTemplateId === "pipeline-event-sketch-report" || currentTemplateId === "pipeline_event_sketch_report") {
            const jobPack = selections.printBlankReport ? { name: ". . . . . . . . . . . . . . . . . . . .", metadata: {} } : await fetchJobPackData();
            const structure = selections.printBlankReport ? { str_name: ". . . . . . . . . . . . . . . . . . . ." } : await fetchStructureData();
            if ((!jobPack || !structure) && !selections.printBlankReport) return null;

            let records: any[] = [];
            if (!selections.printBlankReport && selections.structureId) {
                try {
                    const supabase = (await import("@/utils/supabase/client")).createClient();
                    // structId in scope
                    let q = supabase
                        .from('insp_records')
                        .select(`
                            *,
                            structure_components:component_id(id, q_id, code, metadata)
                        `)
                        .eq('structure_id', structId)
                        .order('insp_id', { ascending: true });

                    if (selections.sowReportNo && selections.sowReportNo !== "all" && selections.sowReportNo !== "N/A") {
                        q = q.eq('sow_report_no', selections.sowReportNo);
                    }

                    const { data } = await q;
                    if (data && data.length > 0) {
                        records = data;
                    } else {
                        // Fallback query without sow_report_no filter
                        const { data: allStrRecords } = await supabase
                            .from('insp_records')
                            .select(`
                                *,
                                structure_components:component_id(id, q_id, code, metadata)
                            `)
                            .eq('structure_id', structId)
                            .order('insp_id', { ascending: true });
                        if (allStrRecords) records = allStrRecords;
                    }
                } catch (err) {
                    console.error("Error fetching records for pipeline event sketch report", err);
                }
            }

            let contractorLogoUrl = "";
            if (jobPack?.metadata?.contrac) {
                try {
                    const supabase = (await import("@/utils/supabase/client")).createClient();
                    const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack.metadata.contrac).maybeSingle();
                    contractorLogoUrl = contrData?.logo_url || "";
                } catch (e) {}
            }
            const headerData = {
                date: format(new Date(), "dd/MM/yyyy"),
                jobpackName: jobPack?.name || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure?.str_name || structure?.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            return await generatePipelineEventSketchReport(
                jobPack || {},
                structure || {},
                selections.sowReportNo || "N/A",
                companySettings,
                { ...reportConfig, returnBlob, structureId: structId, sowReportNo: selections.sowReportNo, headerData } as any,
                records
            );
        }

        // Pipeline Visual Inspection Report (ROV) - NAVIG
        if (currentTemplateId === "rov-navig-report" || currentTemplateId === "rov_navig_report" || currentTemplateId === "pipeline-visual-inspection-report") {
            const jobPack = selections.printBlankReport ? { name: ". . . . . . . . . . . . . . . . . . . .", metadata: {} } : await fetchJobPackData();
            const structure = selections.printBlankReport ? { str_name: ". . . . . . . . . . . . . . . . . . . ." } : await fetchStructureData();
            if ((!jobPack || !structure) && !selections.printBlankReport) return null;

            let records: any[] = [];
            if (!selections.printBlankReport && selections.structureId) {
                try {
                    const supabase = (await import("@/utils/supabase/client")).createClient();
                    // structId in scope
                    let q = supabase
                        .from('insp_records')
                        .select(`
                            *,
                            structure_components:component_id(id, q_id, code, metadata)
                        `)
                        .eq('structure_id', structId)
                        .order('insp_id', { ascending: true });

                    if (selections.sowReportNo && selections.sowReportNo !== "all" && selections.sowReportNo !== "N/A") {
                        q = q.eq('sow_report_no', selections.sowReportNo);
                    }

                    const { data } = await q;
                    if (data && data.length > 0) records = data;
                } catch (err) {
                    console.error("Error fetching records for NAVIG report", err);
                }
            }

            let contractorLogoUrl = "";
            if (jobPack?.metadata?.contrac) {
                try {
                    const supabase = (await import("@/utils/supabase/client")).createClient();
                    const { data: contrData } = await supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack.metadata.contrac).maybeSingle();
                    contractorLogoUrl = contrData?.logo_url || "";
                } catch (e) {}
            }
            const headerData = {
                date: format(new Date(), "dd/MM/yyyy"),
                jobpackName: jobPack?.name || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure?.str_name || structure?.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            return await generateROVNavigReport(
                jobPack || {},
                structure || {},
                selections.sowReportNo || "N/A",
                companySettings,
                { ...reportConfig, returnBlob, structureId: structId, sowReportNo: selections.sowReportNo, printBlankReport: selections.printBlankReport, isBlankReport: selections.printBlankReport, headerData } as any,
                records
            );
        }

        // Seabed Survey Reports
        if (currentTemplateId === "rov-seabed-report" || currentTemplateId === "seabed-survey-debris" || currentTemplateId === "seabed-survey-gas" || currentTemplateId === "seabed-survey-crater") {
            const jobPack = selections.printBlankReport ? { name: ". . . . . . . . . . . . . . . . . . . .", metadata: {} } : await fetchJobPackData();
            const structure = selections.printBlankReport ? { str_name: ". . . . . . . . . . . . . . . . . . . ." } : await fetchStructureData();
            if ((!jobPack || !structure) && !selections.printBlankReport) return null;
            
            const filterMap: Record<string, string> = {
                "rov-seabed-report": "",
                "seabed-survey-debris": "Debris",
                "seabed-survey-gas": "Gas Seepage",
                "seabed-survey-crater": "Crater"
            };

            let contractorLogoUrl = "";
            if (jobPack?.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Error fetching contractor logo", e); }
            }

            const headerData = {
                jobpackName: jobPack?.name || jobPack?.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure?.str_name || structure?.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };
            
            return await generateSeabedSurveyReport(jobPack || {}, structure || {}, selections.sowReportNo, companySettings, { ...reportConfig, headerData, contractorLogoUrl }, filterMap[currentTemplateId]);
        }

        // Detailed Seabed Survey Report
        if (currentTemplateId === "rov-rseab-detail-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            // structId in scope
            if (isNaN(structId)) {
                alert("Please select a specific structure for this inspection report.");
                return null;
            }
            const { data: records, error } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId)
                .eq('sow_report_no', selections.sowReportNo);

            if (error) throw error;

            const filteredRecords = (records || []).filter(r => {
                const typeCode = (r.inspection_type?.code || r.inspection_type_code || "").toUpperCase();
                return typeCode === 'RSEAB' || typeCode === 'SEABED';
            });

            if (filteredRecords.length === 0) {
                alert("No Seabed Survey Debris records found in this SOW.");
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

            return await generateROVRSEABDetailReport(
                filteredRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                headerData,
                companySettings,
                { ...reportConfig, returnBlob, structureId: structId, sowReportNo: selections.sowReportNo } as any
            );
        }

        // Detailed Seabed Survey Gas Seepage Report
        if (currentTemplateId === "rov-rseab-gas-detail-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            // structId in scope
            if (isNaN(structId)) {
                alert("Please select a specific structure for this inspection report.");
                return null;
            }
            const { data: records, error } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId)
                .eq('sow_report_no', selections.sowReportNo);

            if (error) throw error;

            const filteredRecords = (records || []).filter(r => {
                const typeCode = (r.inspection_type?.code || r.inspection_type_code || "").toUpperCase();
                return typeCode === 'RSEAB' || typeCode === 'SEABED';
            });

            if (filteredRecords.length === 0) {
                alert("No Seabed Survey Gas Seepage records found in this SOW.");
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

            return await generateROVRSEABGasDetailReport(
                filteredRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                headerData,
                companySettings,
                { ...reportConfig, returnBlob, structureId: structId, sowReportNo: selections.sowReportNo } as any
            );
        }

        // Detailed Seabed Survey Crater Report
        if (currentTemplateId === "rov-rseab-crater-detail-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            // structId in scope
            if (isNaN(structId)) {
                alert("Please select a specific structure for this inspection report.");
                return null;
            }
            const { data: records, error } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId)
                .eq('sow_report_no', selections.sowReportNo);

            if (error) throw error;

            const filteredRecords = (records || []).filter(r => {
                const typeCode = (r.inspection_type?.code || r.inspection_type_code || "").toUpperCase();
                return typeCode === 'RSEAB' || typeCode === 'SEABED';
            });

            if (filteredRecords.length === 0) {
                alert("No Seabed Survey Crater records found in this SOW.");
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

            return await generateROVRSEABCraterDetailReport(
                filteredRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                headerData,
                companySettings,
                { ...reportConfig, returnBlob, structureId: structId, sowReportNo: selections.sowReportNo } as any
            );
        }

        // Job Pack Summary Report
        if (currentTemplateId === "jobpack-summary") {
            const jobPack = await fetchJobPackData();
            if (!jobPack) return null;
            // Map returnBlob to config if needed or pass directly. The generator expects config.returnBlob
            return await generateJobPackSummaryReport(jobPack, companySettings, reportConfig);
        }

        // ROV MGI Graph Report
        if (currentTemplateId === "mgi-report") {
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

            // structId in scope
            if (isNaN(structId)) {
                alert("Please select a specific structure for this report.");
                return null;
            }

            // 2. Fetch records for the structure
            const { data: records, error: fetchError } = await supabase
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
                    String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'RMGI';

                return sowMatches && jobPackMatches && isRMGI;
            });

            if (!mgiRecords || mgiRecords.length === 0) {
                console.warn("Records found for structure but didn't match filters:", records?.length);
                alert(`Found ${records?.length || 0} records for this structure, but none matched SOW: "${selections.sowReportNo}" and Type: "RMGI". Please check your selection.`);
                return null;
            }

            // Fetch MGI Profile
            const profileId = mgiRecords.find(r => r.inspection_data?._mgi_profile_id || r.inspection_dat?._mgi_profile_id)?.inspection_data?._mgi_profile_id;
            const profile = await getMGIProfileForJobpack(supabase, selections.jobPackId, profileId);

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
                return await generateROVMGIGraphReport(
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

        // ROV RMGI Portrait Report
        if (currentTemplateId === "rov-rmgi-report") {
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

            const rmgiTypeId = typeData?.id || 79; // Fallback to 79

            // structId in scope
            if (isNaN(structId)) {
                alert("Please select a specific structure for this report.");
                return null;
            }

            // 2. Fetch records for the structure
            const { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(id:dive_job_id, job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
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
                const isRMGI = 
                    r.inspection_type_id === rmgiTypeId ||
                    String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'RMGI';

                return sowMatches && jobPackMatches && isRMGI;
            });

            if (!mgiRecords || mgiRecords.length === 0) {
                console.warn("Records found for structure but didn't match filters:", records?.length);
                alert(`Found ${records?.length || 0} records for this structure, but none matched SOW: "${selections.sowReportNo}" and Type: "RMGI". Please check your selection.`);
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
                waterDepth: Math.abs(structure.water_depth || structure.depth || structure.lowest_elevation || 0),
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateROVRMGIReport(
                    mgiRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
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
        if (currentTemplateId === "fmd-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            // 1. Fetch records with all necessary joins for FMD
            const { data: records, error: fetchError } = await supabase
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
                .eq('structure_id', structId);

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

        // Diving FMD Survey Report
        if (currentTemplateId === "diving-fmd-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const fmdRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const codeUpper = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase();
                const isDFMD = ['FLOOD', 'FMD', 'DFMD'].includes(codeUpper);
                return sowMatches && jobPackMatches && isDFMD;
            });

            if (!fmdRecords || fmdRecords.length === 0) {
                alert(`No Diving FMD records found for structure "${structure.str_name}" in this SOW.`);
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
                return await generateDivingFMDReport(
                    fmdRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("Diving FMD Generator Error:", error);
                throw error;
            }
        }

        // Diving MEASU Survey Report
        if (currentTemplateId === "diving-measu-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const measuRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const codeUpper = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase();
                const isMEASU = ['MEASU', 'DMSR', 'MEASUREMENT', 'DMEAS'].includes(codeUpper);
                return sowMatches && jobPackMatches && isMEASU;
            });

            if (!measuRecords || measuRecords.length === 0) {
                alert(`No Diving Measurement Dimensional records found for structure "${structure.str_name}" in this SOW.`);
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
                return await generateDivingMEASUReport(
                    measuRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("Diving MEASU Generator Error:", error);
                throw error;
            }
        }

        // Diving Riser / J-Tube / I-Tube Survey Report with Sketch
        if (["diving-rrisi-report", "diving-jtisi-report", "diving-itisi-report"].includes(currentTemplateId)) {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            let reportType: 'R' | 'J' | 'I' = 'R';
            if (currentTemplateId === "diving-jtisi-report") reportType = 'J';
            if (currentTemplateId === "diving-itisi-report") reportType = 'I';

            const { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const prefixChar = reportType;
            const rrisiRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const qid = (r.structure_components?.q_id || r.q_id || '').toUpperCase();
                const codeUpper = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase();
                const compCode = (r.structure_components?.code || '').toUpperCase();
                const isTypeMatch = ['DRRISI', 'DRISI', 'RSURV', 'RISER', 'DRSER', 'DRSI', 'RRISI', 'JTISI', 'ITISI'].includes(codeUpper);
                const isQidPrefix = qid.startsWith(prefixChar);
                const isCompMatch = ['RS', 'CL', 'WELD', 'FLANGE'].includes(compCode) || compCode === '' || !compCode;

                return sowMatches && jobPackMatches && (isQidPrefix || isTypeMatch || isCompMatch);
            });

            if (!rrisiRecords || rrisiRecords.length === 0) {
                const label = reportType === 'J' ? 'J-Tube' : (reportType === 'I' ? 'I-Tube' : 'Riser');
                alert(`No Diving ${label} Survey records found for structure "${structure.str_name}" in this SOW.`);
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
                return await generateDivingRRISIReport(
                    rrisiRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob, structureId: structId, reportType } as any
                );
            } catch (error) {
                console.error("Diving Riser/J-Tube/I-Tube Sketch Generator Error:", error);
                throw error;
            }
        }

        // Diving Riser / J-Tube / I-Tube Survey Summary Report without Sketch
        if (["diving-rrisi-detail-report", "diving-jtisi-detail-report", "diving-itisi-detail-report"].includes(currentTemplateId)) {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            let reportType: 'R' | 'J' | 'I' = 'R';
            if (currentTemplateId === "diving-jtisi-detail-report") reportType = 'J';
            if (currentTemplateId === "diving-itisi-detail-report") reportType = 'I';

            const { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const prefixChar = reportType;
            const rrisiRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const qid = (r.structure_components?.q_id || r.q_id || '').toUpperCase();
                const codeUpper = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase();
                const compCode = (r.structure_components?.code || '').toUpperCase();
                const isTypeMatch = ['DRRISI', 'DRISI', 'RSURV', 'RISER', 'DRSER', 'DRSI', 'RRISI', 'JTISI', 'ITISI'].includes(codeUpper);
                const isQidPrefix = qid.startsWith(prefixChar);
                const isCompMatch = ['RS', 'CL', 'WELD', 'FLANGE'].includes(compCode) || compCode === '' || !compCode;

                return sowMatches && jobPackMatches && (isQidPrefix || isTypeMatch || isCompMatch);
            });

            if (!rrisiRecords || rrisiRecords.length === 0) {
                const label = reportType === 'J' ? 'J-Tube' : (reportType === 'I' ? 'I-Tube' : 'Riser');
                alert(`No Diving ${label} Survey records found for structure "${structure.str_name}" in this SOW.`);
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
                return await generateDivingRRISIDetailReport(
                    rrisiRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob, structureId: structId, reportType } as any
                );
            } catch (error) {
                console.error("Diving Riser/J-Tube/I-Tube Detail Generator Error:", error);
                throw error;
            }
        }

        // ROV SZCI Survey Report (New)
        if (currentTemplateId === "szci-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            // 1. Fetch records with all necessary joins for SZCI
            const { data: records, error: fetchError } = await supabase
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
                .eq('structure_id', structId);

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
        if (currentTemplateId === "utwt-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            // 1. Fetch records with all necessary joins for UTWT
            const { data: records, error: fetchError } = await supabase
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
                .eq('structure_id', structId);

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
        if (["rrisi-report", "rrisi-detail-report", "rov-rrisi-report", "rov-rrisi-detail-report", "rov-jtisi-report", "rov-jtisi-detail-report", "rov-itisi-report", "rov-itisi-detail-report"].includes(currentTemplateId)) {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            if (isNaN(structId)) {
                alert("Please select a specific structure for this inspection report.");
                return null;
            }
            let q = supabase
                .from('insp_records')
                .select(`
                    *,
                    structure_components:component_id(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id(job_no:deployment_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (selections.sowReportNo && selections.sowReportNo !== "all" && selections.sowReportNo !== "N/A") {
                q = q.eq('sow_report_no', selections.sowReportNo);
            }

            const { data: records, error } = await q;

            if (error) throw error;
            // Determine Report Type based on Template ID
            let reportType: 'R' | 'J' | 'I' = 'R';
            if (currentTemplateId === "rov-jtisi-report" || currentTemplateId === "rov-jtisi-detail-report") reportType = 'J';
            else if (currentTemplateId === "rov-itisi-report" || currentTemplateId === "rov-itisi-detail-report") reportType = 'I';

            const filteredTubeRecords = (records || []).filter(r => {
                const qid = (r.structure_components?.q_id || "").toUpperCase();
                const typeCode = (r.inspection_type?.code || r.inspection_type_code || "").toUpperCase();
                const compCode = (r.structure_components?.code || "").toUpperCase();
                
                if (currentTemplateId === "rov-jtisi-detail-report") {
                    return typeCode === 'RRISI' && qid.startsWith('J') && (compCode === 'RS' || compCode === 'CL' || compCode === 'WELD');
                }
                if (currentTemplateId === "rov-itisi-detail-report") {
                    return typeCode === 'RRISI' && qid.startsWith('I') && (compCode === 'RS' || compCode === 'CL' || compCode === 'WELD');
                }
                
                if (reportType === 'R') {
                    // Riser: Must be RRISI AND start with R AND NOT RISG
                    return typeCode === 'RRISI' && qid.startsWith('R') && !qid.startsWith('RISG') && (compCode === 'RS' || compCode === 'CL' || compCode === 'WELD');
                } else if (reportType === 'J') {
                    return qid.startsWith('J');
                } else {
                    return qid.startsWith('I');
                }
            });

            if (filteredTubeRecords.length === 0) {
                if (!returnBlob && !isFinalDatasheet) {
                    alert(`No records found for ${reportType === 'R' ? 'Riser' : reportType === 'J' ? 'J-Tube' : 'I-Tube'} in this SOW.`);
                }
                return null;
            }

            const tubeRecords = filteredTubeRecords;

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
                if (currentTemplateId === "rrisi-detail-report" || currentTemplateId === "rov-rrisi-detail-report") {
                    return await generateROVRRISIDetailReport(
                        tubeRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                        headerData,
                        companySettings,
                        { ...reportConfig, returnBlob, structureId: structId, sowReportNo: selections.sowReportNo } as any
                    );
                }
                if (currentTemplateId === "rov-jtisi-detail-report") {
                    return await generateROVRRISIJTubeDetailReport(
                        tubeRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                        headerData,
                        companySettings,
                        { ...reportConfig, returnBlob, structureId: structId, sowReportNo: selections.sowReportNo } as any
                    );
                }
                if (currentTemplateId === "rov-itisi-detail-report") {
                    return await generateROVRRISIITubeDetailReport(
                        tubeRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                        headerData,
                        companySettings,
                        { ...reportConfig, returnBlob, structureId: structId, sowReportNo: selections.sowReportNo } as any
                    );
                }
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

        // ROV Scour Survey Report (Portrait Standard)
        if (currentTemplateId === "rov-rscor-survey-report" || currentTemplateId === "rscor-survey") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = selections.printBlankReport ? { str_name: ". . . . . . . . . . . . . . . . . . . ." } : await fetchStructureData();
            const jobPack   = selections.printBlankReport ? { name: ". . . . . . . . . . . . . . . . . . . .", metadata: {} } : await fetchJobPackData();
            if (!selections.printBlankReport && (!structure || !jobPack)) return null;

            let scourRecords: any[] = [];
            if (!selections.printBlankReport) {
                // structId in scope
                if (isNaN(structId)) {
                    alert("Invalid Structure selection. Please ensure a structure is selected.");
                    return null;
                }

                const { data: records, error: fetchError } = await supabase
                    .from('insp_records')
                    .select(`
                        *,
                        inspection_type:inspection_type_id!left(id, code, name),
                        structure_components:component_id!left(id, q_id, code, metadata),
                        insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                        insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                        insp_video_tapes:tape_id!left(tape_no),
                        insp_anomalies(*)
                    `)
                    .eq('structure_id', structId);

                if (fetchError) {
                    console.error("Fetch Error:", fetchError);
                    alert(`Database error: ${fetchError.message || 'Unknown fetching error'}`);
                    return null;
                }

                scourRecords = records?.filter(r => {
                    const sowMatches = !selections.sowReportNo || 
                        String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                    const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                    const code = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase();
                    const isRSCOR = code === 'RSCOR' || code === 'SCOUR';
                    return sowMatches && jobPackMatches && isRSCOR;
                }) || [];

                if (scourRecords.length === 0) {
                    alert(`No ROV Scour records (RSCOR) found for structure "${structure.str_name}" in this SOW.`);
                    return null;
                }
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
                return await generateROVRSCORSurveyReport(
                    scourRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, isBlankReport: selections.printBlankReport, returnBlob } as any
                );
            } catch (error) {
                console.error("RSCOR Survey Generator Error:", error);
                throw error;
            }
        }

        // ROV Scour Survey Sketch Report
        if (currentTemplateId === "rov-scour-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            // structId in scope
            if (isNaN(structId)) {
                alert("Invalid Structure selection. Please ensure a structure is selected.");
                return null;
            }

            // 1. Fetch records with all necessary joins for RSCOR
            const { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id!left(tape_no),
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
        if (currentTemplateId === "rov-anode-report") {
            const structure = selections.printBlankReport ? { str_name: ". . . . . . . . . . . . . . . . . . . ." } : await fetchStructureData();
            const jobPack   = selections.printBlankReport ? { name: ". . . . . . . . . . . . . . . . . . . .", metadata: {} } : await fetchJobPackData();
            if (!selections.printBlankReport && (!structure || !jobPack)) return null;

            let anodeRecords: any[] = [];
            if (selections.printBlankReport) {
                anodeRecords = Array.from({ length: 12 }, (_, i) => ({
                    id: i + 1,
                    elevation: "",
                    inspection_data: { cp_rdg: "", depletion_pct: "", dim_l: "", dim_w: "", dim_h: "" },
                    structure_components: { q_id: "" },
                    description: "",
                    insp_rov_jobs: { job_no: "" }
                }));
            } else {
                const supabase = (await import("@/utils/supabase/client")).createClient();
                // structId in scope
                if (isNaN(structId)) {
                    alert("Invalid Structure selection. Please ensure a structure is selected.");
                    return null;
                }

                const { data: records, error: fetchError } = await supabase
                    .from('insp_records')
                    .select(`
                        *,
                        inspection_type:inspection_type_id!left(id, code, name),
                        structure_components:component_id!left(id, q_id, code, metadata),
                        insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                        insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                        insp_video_tapes:tape_id!left(tape_no),
                        insp_anomalies(*)
                    `)
                    .eq('structure_id', structId);

                if (fetchError) {
                    console.error("Fetch Error:", fetchError);
                    alert(`Database error: ${fetchError.message || 'Unknown fetching error'}`);
                    return null;
                }

                anodeRecords = (records || []).filter(r => {
                    const sowMatches = !selections.sowReportNo || 
                        String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                    const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                    const typeCode = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase();
                    const isRGVI = typeCode === 'RGVI' || typeCode === 'ANODE' || typeCode === 'ANOD';
                    const isAN = String(r.structure_components?.code || '').toUpperCase() === 'AN' || 
                                 String(r.structure_components?.metadata?.type || '').toUpperCase() === 'ANODE';
                    return sowMatches && jobPackMatches && isRGVI && isAN;
                });

                if (!anodeRecords || anodeRecords.length === 0) {
                    alert(`No ROV Anode records (RGVI + component_type: AN) found for structure "${structure.str_name}" in this SOW.`);
                    return null;
                }
            }

            let contractorLogoUrl = "";
            if (jobPack?.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Error fetching contractor logo", e); }
            }

            const headerData = {
                jobpackName: jobPack?.name || ". . . . . . . . . . . . . . . . . . . .",
                sowReportNo: selections.sowReportNo || (selections.printBlankReport ? (config.reportNoPrefix || "____________________") : "N/A"),
                platformName: structure?.str_name || ". . . . . . . . . . . . . . . . . . . .",
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

        // ROV Selected Anode Report (SANI)
        if (currentTemplateId === "rov-anode-rsani-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            // structId in scope
            if (isNaN(structId)) {
                alert("Invalid Structure selection. Please ensure a structure is selected.");
                return null;
            }

            const { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message || 'Unknown fetching error'}`);
                return null;
            }

            // FILTER: RSANI + Component Type AN
            const anodeRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isRSANI = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'RSANI';
                const isAN = String(r.structure_components?.code || '').toUpperCase() === 'AN' || 
                             String(r.structure_components?.metadata?.type || '').toUpperCase() === 'ANODE';
                return sowMatches && jobPackMatches && isRSANI && isAN;
            });

            if (!anodeRecords || anodeRecords.length === 0) {
                alert(`No ROV Selected Anode records (RSANI + component_type: AN) found for structure "${structure.str_name}" in this SOW.`);
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
                return await generateROVAnodeRSANIReport(
                    anodeRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("Anode RSANI Generator Error:", error);
                throw error;
            }
        }

        // ROV Selected Node Report
        if (currentTemplateId === "rov-selected-node-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack   = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            // structId in scope
            const { data: records, error } = await supabase
                .from("insp_records")
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (error) throw error;

            // Filter to records that belong to RSWNI + optional SOW/jobpack scoping
            const swniRecords = records?.filter((r: any) => {
                const sowMatches = !selections.sowReportNo ||
                    String(r.sow_report_no || "").toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                
                const typeCode = (r.inspection_type?.code || r.inspection_type_code || "").toUpperCase();
                const isRSWNI = typeCode === 'RSWNI' || typeCode === 'SWNI';
                return sowMatches && jobPackMatches && isRSWNI;
            });

            if (!swniRecords || swniRecords.length === 0) {
                alert(`No RSWNI node records found for structure "${structure.str_name}" in this SOW.`);
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
                const { generateROVSelectedNodeReport } = await import("@/utils/report-generators/rov-selected-node-report");
                return await generateROVSelectedNodeReport(
                    swniRecords.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("Selected Node Report Generator Error:", error);
                throw error;
            }
        }

        // ROV CP Survey Report
        if (currentTemplateId === "rov-cp-report") {
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
                .eq("structure_id", structId);

            if (fetchError) {
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            // Filter to records that have CP data + inspected by ROV + optional SOW/jobpack scoping
            const cpRecords = records?.filter((r: any) => {
                const sowMatches = !selections.sowReportNo ||
                    String(r.sow_report_no || "").toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isROV = isROVRecord(r);
                const hasCP = hasCPReading(r);
                return sowMatches && jobPackMatches && hasCP && isROV;
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

        // ROV RICMI Inclinometer Report
        if (currentTemplateId === "rov-ricmi-report") {
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
                .eq("structure_id", structId);

            if (fetchError) {
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const ricmiRecords = records?.filter((r: any) => {
                const sowMatches = !selections.sowReportNo ||
                    String(r.sow_report_no || "").toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isRICMI = String(r.inspection_type?.code || r.inspection_type_code || "").toUpperCase() === "RICMI";
                return sowMatches && jobPackMatches && isRICMI;
            });

            if (!ricmiRecords || ricmiRecords.length === 0) {
                alert(`No Inclinometer readings found for structure "${structure.str_name}" in this SOW.`);
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
                return await generateROVRICMIReport(
                    ricmiRecords.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("RICMI Report Generator Error:", error);
                throw error;
            }
        }

        // Diving ANMAIN Anode Maintenance Report
        if (currentTemplateId === "diving-anmain-report") {
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
                .eq("structure_id", structId);

            if (fetchError) {
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const anmainRecords = records?.filter((r: any) => {
                const sowMatches = !selections.sowReportNo ||
                    String(r.sow_report_no || "").toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isANMAIN = String(r.inspection_type?.code || r.inspection_type_code || "").toUpperCase() === "ANMAIN";
                return sowMatches && jobPackMatches && isANMAIN;
            });

            if (!anmainRecords || anmainRecords.length === 0) {
                alert(`No Anode Maintenance records found for structure "${structure.str_name}" in this SOW.`);
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
                return await generateDivingANMAINReport(
                    anmainRecords.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("ANMAIN Report Generator Error:", error);
                throw error;
            }
        }

        // ROV GVI Report (RGVI)
        if (currentTemplateId === "rov-rgvi-report") {
            const structure = selections.printBlankReport ? { str_name: ". . . . . . . . . . . . . . . . . . . ." } : await fetchStructureData();
            const jobPack   = selections.printBlankReport ? { name: ". . . . . . . . . . . . . . . . . . . .", metadata: {} } : await fetchJobPackData();
            if (!selections.printBlankReport && (!structure || !jobPack)) return null;

            let rgviRecords: any[] = [];
            if (selections.printBlankReport) {
                rgviRecords = Array.from({ length: 12 }, (_, i) => ({
                    id: i + 1,
                    elevation: "",
                    inspection_data: { cp_rdg: "", marine_growth: "", component_condition: "" },
                    structure_components: { q_id: "" },
                    description: "",
                    insp_rov_jobs: { job_no: "" }
                }));
            } else {
                const supabase = (await import("@/utils/supabase/client")).createClient();
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
                    .eq("structure_id", structId);

                if (fetchError) {
                    alert(`Database error: ${fetchError.message}`);
                    return null;
                }

                const { isExcludedFromRGVI } = await import("@/utils/report-generators/rov-rgvi-report");
                rgviRecords = (records || []).filter((r: any) => {
                    const sowMatches = !selections.sowReportNo ||
                        String(r.sow_report_no || "").toLowerCase().includes(selections.sowReportNo.toLowerCase());
                    const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                    const isRGVI = String(r.inspection_type?.code || r.inspection_type_code || "").toUpperCase() === "RGVI";
                    return sowMatches && jobPackMatches && isRGVI && !isExcludedFromRGVI(r);
                });

                if (!rgviRecords || rgviRecords.length === 0) {
                    alert(`No RGVI records found for structure "${structure.str_name}" in this SOW.`);
                    return null;
                }
            }

            let contractorLogoUrl = "";
            if (jobPack?.metadata?.contrac) {
                try {
                    const cRes  = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Contractor logo error", e); }
            }

            const headerData = {
                jobpackName:      jobPack?.name || ". . . . . . . . . . . . . . . . . . . .",
                sowReportNo:      selections.sowReportNo || selections.printBlankReport ? (config.reportNoPrefix || "____________________") : "N/A",
                platformName:     structure?.str_name || ". . . . . . . . . . . . . . . . . . . .",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack),
            };

            try {
                const { generateROVRGVIReport } = await import("@/utils/report-generators/rov-rgvi-report");
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

        // Diving General Visual Inspection (GVINS)
        if (currentTemplateId === "diving-gvins-report") {
            const structure = selections.printBlankReport ? { str_name: ". . . . . . . . . . . . . . . . . . . ." } : await fetchStructureData();
            const jobPack   = selections.printBlankReport ? { name: ". . . . . . . . . . . . . . . . . . . .", metadata: {} } : await fetchJobPackData();
            if (!selections.printBlankReport && (!structure || !jobPack)) return null;

            let gvinsRecords: any[] = [];
            if (selections.printBlankReport) {
                gvinsRecords = Array.from({ length: 12 }, (_, i) => ({
                    id: i + 1,
                    elevation: "",
                    inspection_data: { cp_rdg: "", marine_growth: "", component_condition: "" },
                    structure_components: { q_id: "" },
                    description: "",
                    insp_dive_jobs: { dive_no: "" }
                }));
            } else {
                const supabase = (await import("@/utils/supabase/client")).createClient();
                const { data: records, error: fetchError } = await supabase
                    .from('insp_records')
                    .select(`
                        *,
                        inspection_type:inspection_type_id!left(id, code, name),
                        structure_components:component_id!left(id, q_id, code, metadata),
                        insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                        insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                        insp_anomalies(*)
                    `)
                    .eq('structure_id', structId);

                if (fetchError) {
                    console.error("Fetch Error:", fetchError);
                    alert(`Database error: ${fetchError.message}`);
                    return null;
                }

                gvinsRecords = (records || []).filter(r => {
                    const sowMatches = !selections.sowReportNo || 
                        String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                    const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                    const isGVINS = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'GVINS';
                    return sowMatches && jobPackMatches && isGVINS;
                });

                if (!gvinsRecords || gvinsRecords.length === 0) {
                    alert(`No Diving GVINS records found for structure "${structure.str_name}" in this SOW.`);
                    return null;
                }
            }

            let contractorLogoUrl = "";
            if (jobPack?.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Logo fetch error", e); }
            }

            const headerData = {
                jobpackName: jobPack?.name || ". . . . . . . . . . . . . . . . . . . .",
                sowReportNo: selections.sowReportNo || (selections.printBlankReport ? (config.reportNoPrefix || "____________________") : "N/A"),
                platformName: structure?.str_name || ". . . . . . . . . . . . . . . . . . . .",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateDivingGVINSReport(
                    gvinsRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("GVINS Generator Error:", error);
                throw error;
            }
        }

        // Diving ACFMC Inspection Report (ACFMC)
        if (currentTemplateId === "diving-acfmc-report") {
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const supabase = (await import("@/utils/supabase/client")).createClient();
            const { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const acfmcRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isACFMC = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'ACFMC';
                return sowMatches && jobPackMatches && isACFMC;
            });

            if (!acfmcRecords || acfmcRecords.length === 0) {
                alert(`No Diving ACFMC records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Logo fetch error", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateDivingACFMCReport(
                    acfmcRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("ACFMC Generator Error:", error);
                throw error;
            }
        }

        // Diving Coating Damage Inspection Report (PL_CO)
        if (currentTemplateId === "diving-plco-report") {
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const supabase = (await import("@/utils/supabase/client")).createClient();
            const { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const plcoRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isPLCO = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'PL_CO';
                return sowMatches && jobPackMatches && isPLCO;
            });

            if (!plcoRecords || plcoRecords.length === 0) {
                alert(`No Diving Coating Damage records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Logo fetch error", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateDivingPLCOReport(
                    plcoRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("PLCO Generator Error:", error);
                throw error;
            }
        }

        // ROV Water Depth Inspection Report (RWDI)
        if (currentTemplateId === "rov-rwdi-report") {
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const supabase = (await import("@/utils/supabase/client")).createClient();
            const { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const rwdiRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isRWDI = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'RWDI';
                return sowMatches && jobPackMatches && isRWDI;
            });

            if (!rwdiRecords || rwdiRecords.length === 0) {
                alert(`No ROV Water Depth records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Logo fetch error", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateROVRWDIReport(
                    rwdiRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("RWDI Generator Error:", error);
                throw error;
            }
        }

        // Diving Bolted Support Inspection Report (BSINS)
        if (currentTemplateId === "diving-bsins-report") {
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const supabase = (await import("@/utils/supabase/client")).createClient();
            const { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const bsinsRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isBSINS = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'BSINS';
                return sowMatches && jobPackMatches && isBSINS;
            });

            if (!bsinsRecords || bsinsRecords.length === 0) {
                alert(`No Diving BSINS records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Logo fetch error", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateDivingBSINSReport(
                    bsinsRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("BSINS Generator Error:", error);
                throw error;
            }
        }
        
        // Diving Close Visual Inspection Report (CVINS)
        if (currentTemplateId === "diving-cvins-report") {
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const supabase = (await import("@/utils/supabase/client")).createClient();
            const { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(q_id, code),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                return null;
            }

            const cvinsRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isCVINS = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'CVINS';
                return sowMatches && jobPackMatches && isCVINS;
            });

            if (!cvinsRecords || cvinsRecords.length === 0) {
                alert(`No Diving CVINS records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Logo fetch error", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateDivingCVINSReport(
                    cvinsRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("CVINS Generator Error:", error);
                throw error;
            }
        }
        
        // Diving Cleaning Inspection Report (CLEAN)
        if (currentTemplateId === "diving-clean-report") {
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const supabase = (await import("@/utils/supabase/client")).createClient();
            const { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(q_id, code),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                return null;
            }

            const cleanRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isCLEAN = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'CLEAN';
                return sowMatches && jobPackMatches && isCLEAN;
            });

            if (!cleanRecords || cleanRecords.length === 0) {
                alert(`No Diving CLEAN records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Logo fetch error", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateDivingCLEANReport(
                    cleanRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("CLEAN Generator Error:", error);
                throw error;
            }
        }
        
        // Diving Magnetic Particle Inspection Report (MPINS)
        if (currentTemplateId === "diving-mpins-report") {
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const supabase = (await import("@/utils/supabase/client")).createClient();
            const { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const mpinsRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isMPINS = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'MPINS';
                return sowMatches && jobPackMatches && isMPINS;
            });

            if (!mpinsRecords || mpinsRecords.length === 0) {
                alert(`No Diving MPINS records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Logo fetch error", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateDivingMPINSReport(
                    mpinsRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("MPINS Generator Error:", error);
                throw error;
            }
        }

        // Diving UT Wall Thickness Inspection Report (UTWTK)
        if (currentTemplateId === "diving-utwtk-report") {
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const supabase = (await import("@/utils/supabase/client")).createClient();
            const { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const utwtkRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isUTWTK = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'UTWTK';
                return sowMatches && jobPackMatches && isUTWTK;
            });

            if (!utwtkRecords || utwtkRecords.length === 0) {
                alert(`No Diving UTWTK records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Logo fetch error", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateDivingUTWTKReport(
                    utwtkRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob } as any
                );
            } catch (error) {
                console.error("UTWTK Generator Error:", error);
                throw error;
            }
        }

        // Diving Splashzone Inspection Report (SZONE)
        if (currentTemplateId === "diving-szone-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const szoneRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isSZONE = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'SZONE';
                return sowMatches && jobPackMatches && isSZONE;
            });

            if (!szoneRecords || szoneRecords.length === 0) {
                alert(`No Diving SZONE records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Logo fetch error", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateDivingSZONEReport(
                    szoneRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob, structureId: structId, jobPackId: jobPackIdNum } as any,
                    supabase
                );
            } catch (error) {
                console.error("SZONE Generator Error:", error);
                throw error;
            }
        }

        // Diving CP Survey Report (CPSURV)
        if (currentTemplateId === "diving-cpsurv-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const { generateDivingCPSURVReport, isDivingCPSURVRecord } = await import("@/utils/report-generators/diving-cpsurv-report");
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const cpsurvRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                return sowMatches && jobPackMatches && isDivingCPSURVRecord(r);
            });

            if (!cpsurvRecords || cpsurvRecords.length === 0) {
                alert(`No Diving CPSURV records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Logo fetch error", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack),
                structureId: structure.id,
                jobPackId: jobPack.id
            };

            try {
                return await generateDivingCPSURVReport(
                    cpsurvRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    reportConfig
                );
            } catch (error) {
                console.error("Diving CPSURV Generator Error:", error);
                throw error;
            }
        }

        // Diving CP Calibration Report (CPCLB)
        if (currentTemplateId === "diving-cpclb-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const cpclbRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isCPCLB = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'CPCLB';
                return sowMatches && jobPackMatches && isCPCLB;
            });

            if (!cpclbRecords || cpclbRecords.length === 0) {
                alert(`No Diving CPCLB records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            cpclbRecords.sort((a: any, b: any) => {
                const diveA = String(a.insp_dive_jobs?.job_no || a.insp_dive_jobs?.name || a.dive_job_id || '');
                const diveB = String(b.insp_dive_jobs?.job_no || b.insp_dive_jobs?.name || b.dive_job_id || '');
                return diveA.localeCompare(diveB, undefined, { numeric: true });
            });

            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Logo fetch error", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateDivingCPCLBReport(
                    cpclbRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob, structureId: structId, jobPackId: jobPackIdNum } as any
                );
            } catch (error) {
                console.error("CPCLB Generator Error:", error);
                throw error;
            }
        }

        // Diving UT Calibration Report (UTCLB)
        if (currentTemplateId === "diving-utclb-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const utclbRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isUTCLB = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'UTCLB';
                return sowMatches && jobPackMatches && isUTCLB;
            });

            if (!utclbRecords || utclbRecords.length === 0) {
                alert(`No Diving UTCLB records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            utclbRecords.sort((a: any, b: any) => {
                const diveA = String(a.insp_dive_jobs?.job_no || a.insp_dive_jobs?.name || a.dive_job_id || '');
                const diveB = String(b.insp_dive_jobs?.job_no || b.insp_dive_jobs?.name || b.dive_job_id || '');
                return diveA.localeCompare(diveB, undefined, { numeric: true });
            });

            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Logo fetch error", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateDivingUTCLBReport(
                    utclbRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob, structureId: structId, jobPackId: jobPackIdNum } as any
                );
            } catch (error) {
                console.error("UTCLB Generator Error:", error);
                throw error;
            }
        }

        // Diving Selected Anode Report
        if (currentTemplateId === "diving-anode-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const anodeRecords = records?.filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isPL_AN = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'PL_AN';
                return sowMatches && jobPackMatches && isPL_AN;
            });

            if (!anodeRecords || anodeRecords.length === 0) {
                alert(`No Diving Selected Anode records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            anodeRecords.sort((a: any, b: any) => {
                const diveA = String(a.insp_dive_jobs?.job_no || a.insp_dive_jobs?.name || a.dive_job_id || '');
                const diveB = String(b.insp_dive_jobs?.job_no || b.insp_dive_jobs?.name || b.dive_job_id || '');
                return diveA.localeCompare(diveB, undefined, { numeric: true });
            });

            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) { console.error("Logo fetch error", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            try {
                return await generateDivingAnodeReport(
                    anodeRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob, structureId: structId, jobPackId: jobPackIdNum } as any,
                    supabase
                );
            } catch (error) {
                console.error("Diving Anode Generator Error:", error);
                throw error;
            }
        }

        // Diving Marine Growth Inspection Graph Report (MGROW)
        if (currentTemplateId === "diving-mgi-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            const { data: records, error: fetchError } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (fetchError) {
                console.error("Fetch Error:", fetchError);
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const mgiRecords = (records || []).filter(r => {
                const sowMatches = !selections.sowReportNo || 
                    String(r.sow_report_no || '').toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isMGROW = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'MGROW';
                return sowMatches && jobPackMatches && isMGROW;
            }).map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat || {} }));

            if (mgiRecords.length === 0) {
                alert(`No Diving MGROW records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            mgiRecords.sort((a: any, b: any) => {
                const elevA = parseFloat(a.elevation || a.inspection_data?.elevation || 0);
                const elevB = parseFloat(b.elevation || b.inspection_data?.elevation || 0);
                return elevB - elevA;
            });

            // Fetch MGI Profile
            let activeMGIProfile: any = null;
            try {
                const profileId = mgiRecords.find(r => r.inspection_data?._mgi_profile_id)?.inspection_data?._mgi_profile_id 
                                || jobPack.mgi_profile_id;
                activeMGIProfile = await getMGIProfileForJobpack(supabase, selections.jobPackId, profileId);
            } catch (e) { console.error("Profile fetch error", e); }

            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) {
                        contractorLogoUrl = found.logo_url;
                        // Handle potential relative paths if Supabase URL is not full
                    }
                } catch (e) { console.error("Logo fetch error", e); }
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack),
                waterDepth: structure.depth || structure.metadata?.water_depth || 0
            };

            try {
                return await generateDivingMGIReport(
                    mgiRecords,
                    activeMGIProfile,
                    headerData,
                    companySettings,
                    { ...reportConfig, returnBlob, structureId: structId, jobPackId: jobPackIdNum } as any,
                    supabase
                );
            } catch (error) {
                console.error("Diving MGI Generator Error:", error);
                throw error;
            }
        }

        // ROV Caisson Survey Report
        if (currentTemplateId === "rov-rcasn-report") {
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
                .eq("structure_id", structId);

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
        if (currentTemplateId === "rov-rcond-report") {
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
                .eq("structure_id", structId);

            if (fetchError) {
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const rcondRecords = (records || []).filter((r: any) => {
                const sowMatches = !selections.sowReportNo ||
                    String(r.sow_report_no || "").toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isRCOND = ['RCOND', 'RCON'].includes(String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase());
                
                return sowMatches && jobPackMatches && isRCOND;
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
                        structureId: structId,
                        jobPackId: jobPackIdNum
                    } as any
                );
            } catch (error) {
                console.error("RCOND Generator Error:", error);
                throw error;
            }
        }

        // Caisson Inspection Underwater Diving
        if (currentTemplateId === "diving-dcasn-uw-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            if (isNaN(structId)) {
                alert("Please select a specific structure for this inspection report.");
                return null;
            }

            let q = supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (selections.sowReportNo && selections.sowReportNo !== "all" && selections.sowReportNo !== "N/A") {
                q = q.eq('sow_report_no', selections.sowReportNo);
            }

            const { data: records, error } = await q;

            if (error) throw error;
            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) {}
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            return await generateDivingDCASNUWReport(
                records || [],
                headerData,
                companySettings,
                { ...reportConfig, returnBlob, structureId: structId, sowReportNo: selections.sowReportNo } as any
            );
        }

        // Caisson Inspection Above Water Diving
        if (currentTemplateId === "diving-dcasn-ts-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            if (isNaN(structId)) {
                alert("Please select a specific structure for this inspection report.");
                return null;
            }

            let q = supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (selections.sowReportNo && selections.sowReportNo !== "all" && selections.sowReportNo !== "N/A") {
                q = q.eq('sow_report_no', selections.sowReportNo);
            }

            const { data: records, error } = await q;

            if (error) throw error;
            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) {}
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            return await generateDivingDCASNTSReport(
                records || [],
                headerData,
                companySettings,
                { ...reportConfig, returnBlob, structureId: structId, sowReportNo: selections.sowReportNo } as any
            );
        }

        // Conductor Inspection Underwater Diving
        if (currentTemplateId === "diving-dcond-uw-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            if (isNaN(structId)) {
                alert("Please select a specific structure for this inspection report.");
                return null;
            }

            let q = supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (selections.sowReportNo && selections.sowReportNo !== "all" && selections.sowReportNo !== "N/A") {
                q = q.eq('sow_report_no', selections.sowReportNo);
            }

            const { data: records, error } = await q;

            if (error) throw error;
            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) {}
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            return await generateDivingDCONDUWReport(
                records || [],
                headerData,
                companySettings,
                { ...reportConfig, returnBlob, structureId: structId, sowReportNo: selections.sowReportNo } as any
            );
        }

        // Conductor Inspection Above Water Diving
        if (currentTemplateId === "diving-dcond-ts-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            if (isNaN(structId)) {
                alert("Please select a specific structure for this inspection report.");
                return null;
            }

            let q = supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (selections.sowReportNo && selections.sowReportNo !== "all" && selections.sowReportNo !== "N/A") {
                q = q.eq('sow_report_no', selections.sowReportNo);
            }

            const { data: records, error } = await q;

            if (error) throw error;
            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) {}
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            return await generateDivingDCONDTSReport(
                records || [],
                headerData,
                companySettings,
                { ...reportConfig, returnBlob, structureId: structId, sowReportNo: selections.sowReportNo } as any
            );
        }

        // Caisson Inspection Diving (Combined Above Water & Underwater)
        if (currentTemplateId === "diving-dcasn-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            if (isNaN(structId)) {
                alert("Please select a specific structure for this inspection report.");
                return null;
            }

            let q = supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (selections.sowReportNo && selections.sowReportNo !== "all" && selections.sowReportNo !== "N/A") {
                q = q.eq('sow_report_no', selections.sowReportNo);
            }

            const { data: records, error } = await q;

            if (error) throw error;
            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) {}
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            return await generateDivingDCASNReport(
                records || [],
                headerData,
                companySettings,
                { ...reportConfig, returnBlob, structureId: structId, sowReportNo: selections.sowReportNo } as any
            );
        }

        // Conductor Inspection Diving (Combined Above Water & Underwater)
        if (currentTemplateId === "diving-dcond-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            if (isNaN(structId)) {
                alert("Please select a specific structure for this inspection report.");
                return null;
            }

            let q = supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (selections.sowReportNo && selections.sowReportNo !== "all" && selections.sowReportNo !== "N/A") {
                q = q.eq('sow_report_no', selections.sowReportNo);
            }

            const { data: records, error } = await q;

            if (error) throw error;
            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) {}
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            return await generateDivingDCONDReport(
                records || [],
                headerData,
                companySettings,
                { ...reportConfig, returnBlob, structureId: structId, sowReportNo: selections.sowReportNo } as any
            );
        }

        // Item Inspection (Diving) Report
        if (currentTemplateId === "diving-item-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            if (isNaN(structId)) {
                alert("Please select a specific structure for this inspection report.");
                return null;
            }

            let q = supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (selections.sowReportNo && selections.sowReportNo !== "all" && selections.sowReportNo !== "N/A") {
                q = q.eq('sow_report_no', selections.sowReportNo);
            }

            const { data: records, error } = await q;

            if (error) throw error;
            const itemRecords = (records || []).filter((r: any) => {
                const code = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase();
                return code === 'PL_IC' || code === 'ITEM';
            });

            const targetRecords = itemRecords.length > 0 ? itemRecords : (records || []);

            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) {}
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            return await generateDivingItemReport(
                targetRecords,
                headerData,
                companySettings,
                { ...reportConfig, returnBlob, structureId: structId, sowReportNo: selections.sowReportNo } as any
            );
        }

        // Item Maintenance Inspection (Diving) Report
        if (currentTemplateId === "diving-itmain-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            if (isNaN(structId)) {
                alert("Please select a specific structure for this inspection report.");
                return null;
            }

            let q = supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                    insp_video_tapes:tape_id!left(tape_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId);

            if (selections.sowReportNo && selections.sowReportNo !== "all" && selections.sowReportNo !== "N/A") {
                q = q.eq('sow_report_no', selections.sowReportNo);
            }

            const { data: records, error } = await q;

            if (error) throw error;
            const itemRecords = (records || []).filter((r: any) => {
                const code = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase();
                return code === 'ITMAIN';
            });

            const targetRecords = itemRecords.length > 0 ? itemRecords : (records || []);

            let contractorLogoUrl = "";
            if (jobPack.metadata?.contrac) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    const cJson = await cRes.json();
                    const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack.metadata.contrac));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                } catch (e) {}
            }

            const headerData = {
                jobpackName: jobPack.name || jobPack.title || "N/A",
                sowReportNo: selections.sowReportNo || "N/A",
                platformName: structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel(jobPack)
            };

            return await generateDivingITMAINReport(
                targetRecords,
                headerData,
                companySettings,
                { ...reportConfig, returnBlob, structureId: structId, sowReportNo: selections.sowReportNo } as any
            );
        }

        // ROV Boatlanding Survey Report (New)
        if (currentTemplateId === "rov-bl-report") {
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
                .eq("structure_id", structId);

            if (fetchError) {
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const blRecords = (records || []).filter((r: any) => {
                const sowMatches = !selections.sowReportNo ||
                    String(r.sow_report_no || "").toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isBL = isBLRecord(r);
                return sowMatches && jobPackMatches && isBL;
            });

            if (!blRecords || blRecords.length === 0) {
                alert(`No records found for structure "${structure.str_name}" in this SOW.`);
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
                return await generateROVBoatlandingReport(
                    blRecords.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { 
                        ...reportConfig, 
                        returnBlob,
                        structureId: structId,
                        jobPackId: jobPackIdNum
                    } as any
                );
            } catch (error) {
                console.error("Boatlanding Generator Error:", error);
                throw error;
            }
        }

        // ROV Riser Guard Survey Report (New)
        if (currentTemplateId === "rov-rg-report") {
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
                .eq("structure_id", structId);

            if (fetchError) {
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const rgRecords = (records || []).filter((r: any) => {
                const sowMatches = !selections.sowReportNo ||
                    String(r.sow_report_no || "").toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isRG = isRGRecord(r);
                return sowMatches && jobPackMatches && isRG;
            });

            if (!rgRecords || rgRecords.length === 0) {
                alert(`No records found for structure "${structure.str_name}" in this SOW.`);
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
                return await generateROVRiserGuardReport(
                    rgRecords.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { 
                        ...reportConfig, 
                        returnBlob,
                        structureId: structId,
                        jobPackId: jobPackIdNum
                    } as any
                );
            } catch (error) {
                console.error("Riser Guard Generator Error:", error);
                throw error;
            }
        }

        // ROV Caisson Guard Survey Report (New)
        if (currentTemplateId === "rov-sg-report") {
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
                .eq("structure_id", structId);

            if (fetchError) {
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const sgRecords = (records || []).filter((r: any) => {
                const sowMatches = !selections.sowReportNo ||
                    String(r.sow_report_no || "").toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isSG = isSGRecord(r);
                return sowMatches && jobPackMatches && isSG;
            });

            if (!sgRecords || sgRecords.length === 0) {
                alert(`No records found for structure "${structure.str_name}" in this SOW.`);
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
                return await generateROVCaissonGuardReport(
                    sgRecords.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { 
                        ...reportConfig, 
                        returnBlob,
                        structureId: structId,
                        jobPackId: jobPackIdNum
                    } as any
                );
            } catch (error) {
                console.error("Caisson Guard Generator Error:", error);
                throw error;
            }
        }

        // ROV Conductor Guard Survey Report (New)
        if (currentTemplateId === "rov-cu-report") {
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
                .eq("structure_id", structId);

            if (fetchError) {
                alert(`Database error: ${fetchError.message}`);
                return null;
            }

            const cuRecords = (records || []).filter((r: any) => {
                const sowMatches = !selections.sowReportNo ||
                    String(r.sow_report_no || "").toLowerCase().includes(selections.sowReportNo.toLowerCase());
                const jobPackMatches = !selections.jobPackId || String(r.jobpack_id) === String(selections.jobPackId);
                const isCU = isCURecord(r);
                return sowMatches && jobPackMatches && isCU;
            });

            if (!cuRecords || cuRecords.length === 0) {
                alert(`No records found for structure "${structure.str_name}" in this SOW.`);
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
                return await generateROVConductorGuardReport(
                    cuRecords.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                    headerData,
                    companySettings,
                    { 
                        ...reportConfig, 
                        returnBlob,
                        structureId: structId,
                        jobPackId: jobPackIdNum
                    } as any
                );
            } catch (error) {
                console.error("Conductor Guard Generator Error:", error);
                throw error;
            }
        }

        // ROV Photography Report
        if (currentTemplateId === "rov-photo-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack   = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            let targetSowNo = selections.sowReportNo;
            if (targetSowNo && targetSowNo.includes('=')) {
                targetSowNo = targetSowNo.split('=').pop() || targetSowNo;
            }

            let contractorLogoUrl = "";
            const contrId = jobPack.metadata?.contrac || jobPack.metadata?.contractor || jobPack.metadata?.contractor_id || (jobPack as any).contractor_id || (jobPack as any).contrac;
            if (contrId) {
                try {
                    const cid = String(contrId);
                    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid);
                    let q = supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM');
                    if (isUUID) {
                        q = q.or(`id.eq.${cid},lib_id.eq.${cid}`);
                    } else {
                        q = q.or(`lib_id.eq.${cid},code.eq.${cid}`);
                    }
                    const { data: contrData } = await q.maybeSingle();
                    if (contrData?.logo_url) contractorLogoUrl = contrData.logo_url;
                } catch (e) {}

                if (!contractorLogoUrl) {
                    try {
                        const cRes  = await fetch(`/api/library/CONTR_NAM`);
                        const cJson = await cRes.json();
                        const found = cJson.data?.find((c: any) => 
                            String(c.lib_id) === String(contrId) || 
                            String(c.id) === String(contrId) || 
                            String(c.code) === String(contrId) ||
                            String(c.lib_desc).toLowerCase() === String(contrId).toLowerCase()
                        );
                        if (found?.logo_url) contractorLogoUrl = found.logo_url;
                    } catch (e) {}
                }
            }

            if (!contractorLogoUrl) {
                try {
                    const { data: anyContr } = await supabase
                        .from('u_lib_list')
                        .select('logo_url')
                        .eq('lib_code', 'CONTR_NAM')
                        .not('logo_url', 'is', null)
                        .limit(1)
                        .maybeSingle();
                    if (anyContr?.logo_url) contractorLogoUrl = anyContr.logo_url;
                } catch (e) {}
            }

            const headerData = {
                jobpackName:      jobPack.name || jobPack.title || "N/A",
                sowReportNo:      targetSowNo || "N/A",
                platformName:     structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel ? resolveVessel(jobPack) : (jobPack.metadata?.vessel || "N/A")
            };

            const { data: records } = await supabase
                .from("insp_records")
                .select(`insp_id, sow_report_no, jobpack_id, structure_id, insp_anomalies(anomaly_ref_no)`)
                .eq("structure_id", structId)
                .eq("jobpack_id", jobPackIdNum)
                .eq("sow_report_no", targetSowNo);

            if (!records || records.length === 0) {
                alert(`No records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            const recordIds = records.map(r => r.insp_id);

            const { data: attachments } = await supabase
                .from("attachment")
                .select("*")
                .in("source_id", recordIds)
                .order("created_at", { ascending: true });

            let allAttachments = attachments || [];
            if (allAttachments.length === 0) {
                const { data: media } = await supabase
                    .from("insp_media" as any)
                    .select("*")
                    .in("inspection_id", recordIds);
                if (media && media.length > 0) {
                    allAttachments = media.map((m: any) => ({
                        id: m.media_id,
                        path: m.file_path,
                        file_path: m.file_path,
                        name: m.file_name || `Media ${m.media_id}`,
                        source_id: m.inspection_id,
                        source_type: "inspection",
                        meta: m.meta,
                        bucket: (m.meta as any)?.bucket || "inspection-media"
                    }));
                }
            }

            const isImageAttachment = (a: any) => {
                const p = a.path || a.file_path || a.url || a.file_url || a.storage_path || "";
                return p.match(/\.(jpg|jpeg|png|webp|gif|bmp)$/i) || p.startsWith("data:image/") || (a.file_type && a.file_type.startsWith("image/"));
            };

            const photoData = allAttachments.filter(isImageAttachment).map(a => {
                const record = records?.find(r => r.insp_id === a.source_id);
                return {
                    ...a,
                    anomaly_ref: record?.insp_anomalies?.[0]?.anomaly_ref_no || a.anomaly_ref || null
                };
            });

            if (photoData.length === 0) {
                alert(`No photo attachments found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            return await generateROVPhotographyReport(
                photoData,
                headerData,
                companySettings,
                { ...reportConfig, returnBlob } as any
            );
        }
        
        // ROV Photography Log Report
        if (currentTemplateId === "rov-photo-log-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack   = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            let targetSowNo = selections.sowReportNo;
            if (targetSowNo && targetSowNo.includes('=')) {
                targetSowNo = targetSowNo.split('=').pop() || targetSowNo;
            }

            let contractorLogoUrl = "";
            const contrId = jobPack.metadata?.contrac || jobPack.metadata?.contractor || jobPack.metadata?.contractor_id || (jobPack as any).contractor_id || (jobPack as any).contrac;
            if (contrId) {
                try {
                    const cid = String(contrId);
                    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid);
                    let q = supabase.from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM');
                    if (isUUID) {
                        q = q.or(`id.eq.${cid},lib_id.eq.${cid}`);
                    } else {
                        q = q.or(`lib_id.eq.${cid},code.eq.${cid}`);
                    }
                    const { data: contrData } = await q.maybeSingle();
                    if (contrData?.logo_url) contractorLogoUrl = contrData.logo_url;
                } catch (e) {}

                if (!contractorLogoUrl) {
                    try {
                        const cRes  = await fetch(`/api/library/CONTR_NAM`);
                        const cJson = await cRes.json();
                        const found = cJson.data?.find((c: any) => 
                            String(c.lib_id) === String(contrId) || 
                            String(c.id) === String(contrId) || 
                            String(c.code) === String(contrId) ||
                            String(c.lib_desc).toLowerCase() === String(contrId).toLowerCase()
                        );
                        if (found?.logo_url) contractorLogoUrl = found.logo_url;
                    } catch (e) {}
                }
            }

            if (!contractorLogoUrl) {
                try {
                    const { data: anyContr } = await supabase
                        .from('u_lib_list')
                        .select('logo_url')
                        .eq('lib_code', 'CONTR_NAM')
                        .not('logo_url', 'is', null)
                        .limit(1)
                        .maybeSingle();
                    if (anyContr?.logo_url) contractorLogoUrl = anyContr.logo_url;
                } catch (e) {}
            }

            const headerData = {
                jobpackName:      jobPack.name || jobPack.title || "N/A",
                sowReportNo:      targetSowNo || "N/A",
                platformName:     structure.str_name || structure.title || "N/A",
                contractorLogoUrl,
                vessel: resolveVessel ? resolveVessel(jobPack) : (jobPack.metadata?.vessel || "N/A")
            };

            const { data: records } = await supabase
                .from("insp_records")
                .select(`insp_id, sow_report_no, jobpack_id, structure_id, insp_anomalies(anomaly_ref_no)`)
                .eq("structure_id", structId)
                .eq("jobpack_id", jobPackIdNum)
                .eq("sow_report_no", targetSowNo);

            if (!records || records.length === 0) {
                alert(`No records found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            const recordIds = records.map(r => r.insp_id);

            const { data: attachments } = await supabase
                .from("attachment")
                .select("*")
                .in("source_id", recordIds)
                .order("created_at", { ascending: true });

            let allAttachments = attachments || [];
            if (allAttachments.length === 0) {
                const { data: media } = await supabase
                    .from("insp_media" as any)
                    .select("*")
                    .in("inspection_id", recordIds);
                if (media && media.length > 0) {
                    allAttachments = media.map((m: any) => ({
                        id: m.media_id,
                        path: m.file_path,
                        file_path: m.file_path,
                        name: m.file_name || `Media ${m.media_id}`,
                        source_id: m.inspection_id,
                        source_type: "inspection",
                        meta: m.meta,
                        bucket: (m.meta as any)?.bucket || "inspection-media"
                    }));
                }
            }

            const isImageAttachment = (a: any) => {
                const p = a.path || a.file_path || a.url || a.file_url || a.storage_path || "";
                return p.match(/\.(jpg|jpeg|png|webp|gif|bmp)$/i) || p.startsWith("data:image/") || (a.file_type && a.file_type.startsWith("image/"));
            };

            const photoData = allAttachments.filter(isImageAttachment).map(a => {
                const record = records?.find(r => r.insp_id === a.source_id);
                return {
                    ...a,
                    anomaly_ref: record?.insp_anomalies?.[0]?.anomaly_ref_no || a.anomaly_ref || null
                };
            });

            if (photoData.length === 0) {
                alert(`No photo attachments found for structure "${structure.str_name}" in this SOW.`);
                return null;
            }

            return await generateROVPhotographyLogReport(
                photoData,
                headerData,
                companySettings,
                { ...reportConfig, returnBlob } as any
            );
        }

        // ROV Caisson Survey (Sketch) Report
        if (currentTemplateId === "rov-rcasn-sketch-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            // structId in scope
            if (isNaN(structId)) {
                alert("Please select a specific structure for this inspection report.");
                return null;
            }

            const { data: records, error } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId)
                .eq('sow_report_no', selections.sowReportNo);

            if (error) throw error;
            const caissonRecords = (records || []).filter((r: any) => {
                const typeCode = (r.inspection_type?.code || r.inspection_type_code || '').toUpperCase();
                const compCode = (r.structure_components?.code || '').toUpperCase();
                return typeCode === 'RCASN' || compCode === 'CS';
            });

            if (caissonRecords.length === 0) {
                if (!reportConfig.isBlankReport) {
                    if (!isFinalDatasheet && !returnBlob) {
                        alert(`No Caisson inspection records found for structure "${structure.str_name}" in this SOW.`);
                    }
                    return null;
                }
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
        if (currentTemplateId === "rov-rcond-sketch-report") {
            const supabase = (await import("@/utils/supabase/client")).createClient();
            const structure = await fetchStructureData();
            const jobPack = await fetchJobPackData();
            if (!structure || !jobPack) return null;

            // structId in scope
            if (isNaN(structId)) {
                alert("Please select a specific structure for this inspection report.");
                return null;
            }

            const { data: records, error } = await supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    structure_components:component_id!left(id, q_id, code, metadata),
                    insp_rov_jobs:rov_job_id!left(job_no:deployment_no),
                    insp_anomalies(*)
                `)
                .eq('structure_id', structId)
                .eq('sow_report_no', selections.sowReportNo);

            if (error) throw error;
            const condRecords = (records || []).filter((r: any) => {
                const typeCode = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase();
                const compCode = String(r.structure_components?.code || '').toUpperCase();
                return ['RCOND', 'RCON'].includes(typeCode) || ['CD', 'CON'].includes(compCode);
            });

            if (condRecords.length === 0) {
                if (!reportConfig.isBlankReport) {
                    if (!isFinalDatasheet && !returnBlob) {
                        alert(`No Conductor inspection records found for structure "${structure.str_name}" in this SOW.`);
                    }
                    return null;
                }
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
        if (currentTemplateId === "work-scope-status") {
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
        if (currentTemplateId === "work-scope-incomplete") {
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
        if (currentTemplateId === "work-scope-report") {
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

        switch (currentTemplateId) {
            case "structure-summary":
                return await generateStructureReport(data, companySettings, { ...reportConfig, sowReportNo: selections.sowReportNo || reportConfig?.reportNoPrefix, reportNoPrefix: reportConfig?.reportNoPrefix || selections.sowReportNo } as any);

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
                return null;
        }
    } finally {
        // selections.templateId = originalTemplateId;
    }
};

    const generatePreview = async () => {
        setIsGenerating(true);
        setPreviewUrl(null);
        setGenerationProgress(5);
        setCurrentGeneratingTemplate("Assembling report preview layout...");
        console.log(`[generatePreview] Starting preview generation for template: ${selections.templateId}, structure: ${selections.structureId}, SOW: ${selections.sowReportNo}`);
        try {
            console.log("[generatePreview] Calling generateReportAction(true)...");
            const result = await generateReportAction(true); // Return Blob
            console.log("[generatePreview] generateReportAction completed, result type:", result ? (result instanceof Blob ? "Blob" : typeof result) : "null/undefined");

            if (result instanceof Blob) {
                const url = URL.createObjectURL(result);
                console.log("[generatePreview] Created object URL for Blob:", url);
                setPreviewUrl(url);
            } else if (result && (result as any).output) {
                // Handle jsPDF object if returned
                const blob = (result as any).output('blob');
                const url = URL.createObjectURL(blob);
                console.log("[generatePreview] Created object URL from jsPDF output('blob'):", url);
                setPreviewUrl(url);
            } else {
                console.warn("Generator did not return a blob. It might have saved directly or failed.");
                // If it failed to return a blob, we can't show preview.
            }
        } catch (error) {
            console.error("Preview generation failed", error);
        } finally {
            console.log("[generatePreview] Finished preview generation, setting isGenerating to false");
            setIsGenerating(false);
        }
    };

    const handleDownload = async () => {
        if (previewUrl) {
            const a = document.createElement('a');
            a.href = previewUrl;
            a.download = `${selections.templateId}_${selections.structureId}.pdf`;
            a.click();
        } else {
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

    const renderPreview = () => {
        const isFinalDatasheet = selections.templateId === "final-inspection-datasheet";
        const selectedTOC = TOC_SECTIONS.flatMap(s => s.templates).filter(t => selectedTemplates.includes(t.id));

        return (
            <div className="h-full flex flex-col space-y-4">
                <div className="text-center space-y-1 mb-2">
                    <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Report Preview</h2>
                    <p className="text-sm text-slate-500">
                        {isFinalDatasheet 
                            ? "Review compiled tech sheets or individual templates."
                            : <>Review your <strong>{getCurrentTemplate()?.name}</strong> before downloading.</>
                        }
                    </p>
                </div>

                {/* All-in-one preview only for final datasheet */}

                <div className="flex-1 w-full bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden border shadow-inner relative min-h-[400px]">
                    {isGenerating ? (
                        <div className="absolute inset-0 flex items-center justify-center flex-col gap-5 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-sm z-50">
                            <div className="relative flex items-center justify-center">
                                <div className="w-14 h-14 rounded-full border-2 border-dashed border-blue-500 animate-[spin_6s_linear_infinite]"></div>
                                <span className="absolute text-2xl animate-bounce">⏳</span>
                            </div>

                            <div className="w-72 bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden shadow-inner border border-slate-300/20">
                                <div 
                                    className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out shadow-md shadow-blue-500/20" 
                                    style={{ width: `${generationProgress > 0 ? generationProgress : 12}%` }}
                                ></div>
                            </div>
                            
                            <div className="flex flex-col items-center gap-1.5 text-center px-6">
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-wide">
                                    {currentGeneratingTemplate || "Generating report package..."}
                                </p>
                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/40">
                                    {generationProgress > 0 ? `${generationProgress}% Complete` : 'Processing...'}
                                </span>
                            </div>
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
    };

    const wizardSteps: WizardStep[] = selections.templateId === "final-inspection-datasheet"
        ? ["template", "context", "toc", "configuration", "preview"]
        : ["template", "context", "configuration", "preview"];

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
                            width: `${wizardSteps.indexOf(step) / (wizardSteps.length - 1) * 100}%`
                        }}
                    ></div>

                    {/* Steps */}
                    {wizardSteps.map((s, i) => {
                        const isActive = wizardSteps.indexOf(step) >= i;
                        const isCurrent = step === s;

                        const currentIndex = wizardSteps.indexOf(step);
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
                        {step === "toc" && renderTocSelection()}
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
