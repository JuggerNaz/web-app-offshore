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
}

interface SelectionState {
    templateId: string;
    category: string;
    structureId: string;
    componentId: string;
    jobPackId: string;
    planningId: string;
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
        { id: "work-scope", name: "Work Scope Report", icon: Wrench, description: "Detailed work scope and requirements", requires: ["jobpack"] },
        { id: "resource-allocation", name: "Resource Allocation", icon: FileBarChart, description: "Resource planning and allocation details", requires: ["jobpack"] },
    ],
    planning: [
        { id: "inspection-schedule", name: "Inspection Schedule", icon: Calendar, description: "Planned inspection timeline and milestones", requires: ["planning"] },
        { id: "planning-overview", name: "Planning Overview", icon: FileText, description: "Complete planning documentation", requires: ["planning"] },
    ],
    inspection: [
        { id: "inspection-report", name: "Inspection Report", icon: CheckSquare, description: "Detailed inspection findings and results", requires: ["jobpack"] },
        { id: "defect-summary", name: "Defect Summary", icon: FileBarChart, description: "Summary of identified defects and issues", requires: ["jobpack"] },
        { id: "compliance-report", name: "Compliance Report", icon: FileText, description: "Regulatory compliance documentation", requires: ["jobpack"] },
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
    });

    // Default Configuration
    const [config, setConfig] = useState<ReportConfig>({
        reportNoPrefix: "RPT",
        reportYear: new Date().getFullYear().toString(),
        preparedBy: { name: "", date: new Date().toISOString().split('T')[0] },
        reviewedBy: { name: "", date: "" },
        approvedBy: { name: "", date: "" },
        watermark: { enabled: true, text: "DRAFT", transparency: 0.1 },
        showContractorLogo: false,
        showPageNumbers: true,
    });

    // Data Fetching
    const { data: structuresData } = useSWR("/api/structures", fetcher);
    const structures = structuresData?.data || [];

    // Mock Data for JobPacks/Planning (replace with actual API calls if available)
    const jobPacks = [
        { id: "1", name: "JP-2024-001 - Annual Inspection" },
        { id: "2", name: "JP-2024-002 - Maintenance Check" },
    ];

    const plannings = [
        { id: "1", name: "Q1 2024 Inspection Plan" },
        { id: "2", name: "Q2 2024 Inspection Plan" },
    ];

    const [availableComponents, setAvailableComponents] = useState<any[]>([]);
    const [isLoadingComponents, setIsLoadingComponents] = useState(false);
    const [componentSearch, setComponentSearch] = useState("");
    const [structureSearch, setStructureSearch] = useState("");

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
        if (!structureSearch) return structures;
        const lower = structureSearch.toLowerCase();
        return structures.filter((s: any) =>
            s.str_name?.toLowerCase().includes(lower) ||
            s.str_type?.toLowerCase().includes(lower)
        );
    }, [structures, structureSearch]);

    // Category Selection State
    const [activeCategory, setActiveCategory] = useState<string>("Structure");

    // Render Steps
    const renderTemplateSelection = () => {
        const categories = {
            "Structure": REPORT_TEMPLATES.structure,
            "Job Pack": REPORT_TEMPLATES.jobpack || [],
            "Planning": REPORT_TEMPLATES.planning || [],
            "Inspection": REPORT_TEMPLATES.inspection || []
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
                            onClick={() => setSelections({ ...selections, category: activeCategory.toLowerCase(), templateId: template.id })}
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

        return (
            <div className="space-y-6 max-w-3xl mx-auto">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Select Data Source</h2>
                    <p className="text-slate-500">Choose the specific items to include in your {template.name}</p>
                </div>

                <div className="space-y-6">
                    {template.requires.includes("structure") && (
                        <div className="space-y-3">
                            <Label>Structure</Label>
                            <Select
                                value={selections.structureId}
                                onValueChange={(val) => setSelections({ ...selections, structureId: val, componentId: "" })}
                            >
                                <SelectTrigger className="h-12 w-full bg-white dark:bg-slate-900">
                                    <SelectValue placeholder="Select a structure..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <div className="p-2 sticky top-0 bg-white dark:bg-slate-900 z-10">
                                        <Input
                                            placeholder="Search structures..."
                                            className="h-8"
                                            value={structureSearch}
                                            onChange={(e) => setStructureSearch(e.target.value)}
                                            onKeyDown={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                    {filteredStructures.length === 0 ? (
                                        <div className="p-2 text-sm text-muted-foreground text-center">No structures found</div>
                                    ) : filteredStructures.map((s: any) => (
                                        <SelectItem key={s.id} value={s.id.toString()}>
                                            <span className="font-medium">{s.str_name}</span>
                                            <span className="ml-2 text-xs text-muted-foreground">{s.str_type}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {template.requires.includes("component") && selections.structureId && (
                        <div className="space-y-3">
                            <Label>Component</Label>
                            <div className="border rounded-lg bg-white dark:bg-slate-900 p-4 h-[300px] flex flex-col">
                                <div className="mb-4 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Search components..."
                                        className="pl-9"
                                        value={componentSearch}
                                        onChange={(e) => setComponentSearch(e.target.value)}
                                    />
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-2">
                                    {isLoadingComponents ? (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">Loading components...</div>
                                    ) : filteredComponents.length === 0 ? (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">No components found</div>
                                    ) : (
                                        filteredComponents.map((comp) => (
                                            <div
                                                key={comp.id}
                                                onClick={() => setSelections({ ...selections, componentId: comp.id })}
                                                className={`
                                                    p-3 rounded-md border cursor-pointer transition-all flex items-center justify-between
                                                    ${selections.componentId === comp.id
                                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                                        : "border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"}
                                                `}
                                            >
                                                <div>
                                                    <div className="font-medium text-sm">{comp.name}</div>
                                                    <div className="text-xs text-slate-500">{comp.q_id}</div>
                                                </div>
                                                {selections.componentId === comp.id && <Check className="h-4 w-4 text-blue-500" />}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {template.requires.includes("jobpack") && (
                        <div className="space-y-3">
                            <Label>Job Pack</Label>
                            <Select
                                value={selections.jobPackId}
                                onValueChange={(val) => setSelections({ ...selections, jobPackId: val })}
                            >
                                <SelectTrigger className="h-12 w-full bg-white dark:bg-slate-900">
                                    <SelectValue placeholder="Select a job pack..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {jobPacks.map((jp) => (
                                        <SelectItem key={jp.id} value={jp.id}>{jp.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {template.requires.includes("planning") && (
                        <div className="space-y-3">
                            <Label>Inspection Planning</Label>
                            <Select
                                value={selections.planningId}
                                onValueChange={(val) => setSelections({ ...selections, planningId: val })}
                            >
                                <SelectTrigger className="h-12 w-full bg-white dark:bg-slate-900">
                                    <SelectValue placeholder="Select a planning..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {plannings.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
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
                                <Label className="cursor-pointer" htmlFor="page-numbers">Show Page Numbers</Label>
                                <Switch
                                    id="page-numbers"
                                    checked={config.showPageNumbers}
                                    onCheckedChange={(c: boolean) => setConfig({ ...config, showPageNumbers: c })}
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

                    {selections.jobPackId && (
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <Label className="text-base">Contractor Logo</Label>
                                        <p className="text-xs text-muted-foreground">Show contractor logo on report cover</p>
                                    </div>
                                    <Switch
                                        checked={config.showContractorLogo}
                                        onCheckedChange={(c: boolean) => setConfig({ ...config, showContractorLogo: c })}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right Column: Signatures */}
                <div className="space-y-6">
                    <Card>
                        <CardContent className="pt-6 space-y-6">
                            <div className="flex items-center gap-2 mb-2 text-slate-800 font-semibold">
                                <User className="w-5 h-5 text-green-500" />
                                <h3>Signatures</h3>
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

    // Auto-generate preview when entering preview step
    useEffect(() => {
        if (step === "preview" && selections.structureId && !previewUrl) {
            generatePreview();
        }
    }, [step, selections.structureId]);

    const fetchStructureData = async () => {
        if (!selections.structureId) return null;
        try {
            const res = await fetch(`/api/structures/${selections.structureId}`);
            const data = await res.json();
            return data.success ? data.data : null;
        } catch (e) {
            console.error("Error fetching structure:", e);
            return null;
        }
    };

    const fetchComponentTypes = async () => {
        try {
            const res = await fetch("/api/components/types");
            const json = await res.json();
            const map: Record<string, string> = {};
            if (json.data) {
                json.data.forEach((t: any) => {
                    if (t.code) map[t.code] = t.name || t.code;
                });
            }
            return map;
        } catch (e) {
            console.error("Error fetching component types", e);
            return {};
        }
    };

    const generateReportAction = async (returnBlob: boolean = false) => {
        const {
            generateStructureReport,
            generateComponentSummaryReport,
            generateComponentSpecReport,
            generateTechnicalSpecsReport
        } = await import("@/utils/pdf-generator");

        const data = await fetchStructureData();
        if (!data) return null;

        const companySettings = { company_name: "NasQuest Resources Sdn Bhd" }; // In real app, fetch from API
        const typeMap = await fetchComponentTypes();
        const reportConfig = { ...config, returnBlob };

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

                        return (
                            <div key={s} className="relative z-10 flex flex-col items-center gap-2">
                                <div className={`
                                    w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                                    ${isActive ? "bg-blue-600 border-blue-600 text-white" : "bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-400"}
                                    ${isCurrent ? "ring-4 ring-blue-100 dark:ring-blue-900/40" : ""}
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
                        <Button variant="secondary" className="gap-2" onClick={handlePrint}>
                            <Printer className="w-4 h-4" /> Print
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
