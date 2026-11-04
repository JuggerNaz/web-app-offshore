"use client";

import { useState, useEffect } from "react";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
    FileText, 
    Trash2, 
    Copy, 
    Search, 
    BookOpen, 
    Save, 
    Sparkles, 
    Edit2, 
    Table as TableIcon,
    ArrowRight,
    RefreshCw,
    X,
    CheckCircle2,
    Code,
    Zap,
    ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/utils/utils";
import { ConditionalTemplatesTab } from "./ConditionalTemplatesTab";
import { ExecutiveRichEditor } from "./ExecutiveRichEditor";
import { 
    interpolateAllVariables,
    getAnomalyZonePriorityTableTemplate,
    getIncompleteScopeTableTemplate,
    getCompletedScopeTableTemplate,
    getAnodeDepletionTableTemplate,
    getAnomalyDefectTypeTableTemplate
} from "./template-utils";

interface SummaryTemplatesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sectionId: string;
    sectionTitle: string;
    currentContent: string;
    onSelect: (content: string) => void;
    projectContext: {
        platform?: string;
        jobpack?: string;
        reportNo?: string;
        client?: string;
        clientShort?: string;
        contractor?: string;
        vessel?: string;
        fieldName?: string;
        startDate?: string;
        endDate?: string;
    };
    existingRules: any;
    onSaveRules: (rules: any) => Promise<void>;
    customVariables: Record<string, string>;
    onSaveCustomVariables: (vars: Record<string, string>) => Promise<void>;
    statsContext?: any;
}

export function SummaryTemplatesDialog({
    open,
    onOpenChange,
    sectionId,
    sectionTitle,
    currentContent,
    onSelect,
    projectContext,
    existingRules,
    onSaveRules,
    customVariables,
    onSaveCustomVariables,
    statsContext,
}: SummaryTemplatesDialogProps) {
    const { data: templatesRes, isLoading } = useSWR(
        open ? `/api/executive-summary/templates?section_id=${sectionId}` : null,
        fetcher
    );
    const templates = templatesRes?.data || [];

    const [isSaving, setIsSaving] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("standard");
    const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
    const [designerContent, setDesignerContent] = useState("");

    // Synchronize initial content when dialog opens or section changes
    useEffect(() => {
        if (open && !editingTemplateId) {
            setDesignerContent(currentContent || "");
        }
    }, [open, sectionId]);

    const filteredTemplates = templates.filter((t: any) => 
        t.template_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        t.metadata?.template_type !== "conditional"
    );

    const handleSaveTemplate = async () => {
        if (!newTemplateName.trim()) {
            toast.error("Please enter a template name");
            return;
        }
        if (!designerContent.trim() || designerContent === "<p></p>") {
            toast.error("Template content cannot be empty");
            return;
        }

        setIsSaving(true);
        try {
            const body: any = {
                template_name: newTemplateName.trim(),
                section_id: sectionId,
                content: designerContent,
                client_name: projectContext.client || "",
                metadata: {
                    template_type: "standard",
                    ...(editingTemplateId ? { id: editingTemplateId } : {})
                }
            };

            const res = await fetch("/api/executive-summary/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (!res.ok) throw new Error("Failed to save template");

            toast.success(editingTemplateId ? "Template updated successfully" : "Template saved successfully");
            setEditingTemplateId(null);
            setNewTemplateName("");
            mutate(`/api/executive-summary/templates?section_id=${sectionId}`);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this template?")) return;

        try {
            const res = await fetch(`/api/executive-summary/templates?id=${id}`, {
                method: "DELETE"
            });
            if (!res.ok) throw new Error("Failed to delete template");

            toast.success("Template deleted");
            if (editingTemplateId === id) {
                setEditingTemplateId(null);
                setNewTemplateName("");
                setDesignerContent("");
            }
            mutate(`/api/executive-summary/templates?section_id=${sectionId}`);
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleStartEdit = (t: any) => {
        setEditingTemplateId(t.id);
        setNewTemplateName(t.template_name);
        setDesignerContent(t.content);
        toast.info(`Loaded "${t.template_name}" into the designer for modification.`);
    };

    const handleCancelEdit = () => {
        setEditingTemplateId(null);
        setNewTemplateName("");
        setDesignerContent(currentContent || "");
    };

    // When applying/loading a template into the summary editor, ALL tags are replaced with live data!
    const handleApplyTemplate = (rawContent: string) => {
        const resolved = interpolateAllVariables(rawContent, statsContext);
        onSelect(resolved);
        toast.success("Template inserted into summary with all live data replaced!");
        onOpenChange(false);
    };

    // Quick assign a saved template to a conditional rule
    const handleAssignTemplateToRule = async (template: any, conditionKey: string, conditionTitle: string) => {
        const currentRules = templates.find((t: any) => t.metadata?.template_type === "conditional")?.metadata || {};
        const updated = {
            ...currentRules,
            [conditionKey]: template.content,
            [`${conditionKey}_template_name`]: template.template_name
        };

        try {
            await onSaveRules(updated);
            mutate(`/api/executive-summary/templates?section_id=${sectionId}`);
            toast.success(`Assigned "${template.template_name}" to ${conditionTitle}!`);
        } catch (e: any) {
            toast.error("Failed to assign rule: " + (e.message || "Unknown error"));
        }
    };

    const loadAiTemplate = (format: "detailed" | "executive") => {
        const sec = sectionId.toLowerCase();
        let templateHtml = "";

        if (format === "detailed") {
            if (sec === "intro" || sec === "introduction") {
                templateHtml = `
<p>This Executive Summary report presents the comprehensive findings from the subsea structural integrity GVI, CP, and FMD surveys executed for <strong>{{PLATFORM_NAME}}</strong> located in <strong>{{FIELD_NAME}}</strong> during the SOW <strong>{{REPORT_NO}}</strong> campaign.</p>
<p>All offshore marine operations were conducted aboard <strong>{{VESSEL_NAME}}</strong> under Job Pack <strong>{{JOB_PACK_NAME}}</strong> in strict accordance with contract <strong>{{CONTRACT_NO}}</strong> for <strong>{{CLIENT_NAME}}</strong>.</p>
<p><strong>Primary Scope of Inspection:</strong></p>
<ul>
    <li>Submerged sections of the platform jacket, riser guards, caissons, and conductors</li>
    <li>Cathodic Protection (CP) polarization levels and sacrificial anode depletion</li>
    <li>Flooded Member Detection (FMD) structural integrity survey</li>
    <li>Marine Growth Fouling (MGI) thickness and elevation profiling</li>
    <li>Seabed scour bathymetry and exposed pile foundation survey</li>
</ul>
<table data-width="100%" data-align="center" style="width: 100% !important; margin: 1em auto !important;">
    <tbody>
        <tr>
            <th style="background-color: #f1f5f9; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px 10px;">Inspection Scope</th>
            <th style="background-color: #f1f5f9; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px 10px;">Standard / Design Criteria</th>
            <th style="background-color: #f1f5f9; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px 10px;">Findings Summary</th>
        </tr>
        <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">General Visual Inspection (GVI)</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">100% Structural Coverage</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">{{TOTAL_ANOMALIES}} Anomalies recorded ({{OPEN_ANOMALIES}} open)</td>
        </tr>
        <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Cathodic Protection (CP)</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">-800 mV to -1050 mV (Ag/AgCl)</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">{{CP_MIN}} mV (min) to {{CP_MAX}} mV (max)</td>
        </tr>
        <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Marine Growth Inspection (MGI)</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Design limit 100 mm</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Max {{MGI_MAX}} mm (Avg: {{MGI_AVG}} mm)</td>
        </tr>
    </tbody>
</table>
                `.trim();
            } else if (sec === "cp") {
                templateHtml = `
<p>Cathodic Protection (CP) potential measurements were acquired across scheduled structural elevations on <strong>{{PLATFORM_NAME}}</strong> utilizing a calibrated contact probe deployed from <strong>{{VESSEL_NAME}}</strong>.</p>
<p>Readings ranged from a minimum of <strong>{{CP_MIN}} mV</strong> to a maximum of <strong>{{CP_MAX}} mV</strong> (referenced to Ag/AgCl seawater half-cell), confirming all structural elevations remain within protective criteria (-800 mV to -1050 mV).</p>
<table data-width="100%" data-align="center" style="width: 100% !important; margin: 1em auto !important;">
    <tbody>
        <tr>
            <th style="background-color: #f1f5f9; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px 10px;">Metric</th>
            <th style="background-color: #f1f5f9; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px 10px;">Recorded Value</th>
            <th style="background-color: #f1f5f9; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px 10px;">Evaluation</th>
        </tr>
        <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Minimum Potential</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">{{CP_MIN}} mV</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Adequate Polarization</td>
        </tr>
        <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Maximum Potential</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">{{CP_MAX}} mV</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Healthy Protection Range</td>
        </tr>
    </tbody>
</table>
                `.trim();
            } else if (sec === "fmd") {
                templateHtml = `
<p>Flooded Member Detection (FMD) testing was performed across all designated submerged structural members of <strong>{{PLATFORM_NAME}}</strong> to assess internal flooding integrity.</p>
<p>A total of all targeted tubular members were tested; <strong>zero flooded members</strong> were detected. All ultrasonic / radiometric response curves indicated dry internal status, confirming no through-wall breaches or fatigue cracking.</p>
<table data-width="100%" data-align="center" style="width: 100% !important; margin: 1em auto !important;">
    <tbody>
        <tr>
            <th style="background-color: #f1f5f9; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px 10px;">Target Members</th>
            <th style="background-color: #f1f5f9; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px 10px;">Flooded Members</th>
            <th style="background-color: #f1f5f9; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px 10px;">Structural Integrity Status</th>
        </tr>
        <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Subsea Bracings & Horizontals</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">0 Detected</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Dry / Intact Integrity Confirmed</td>
        </tr>
    </tbody>
</table>
                `.trim();
            } else if (sec === "mgi") {
                templateHtml = `
<p>Marine Growth Inspection (MGI) was conducted across depth elevations on <strong>{{PLATFORM_NAME}}</strong> to establish bio-fouling distribution and hard/soft marine growth thickness.</p>
<p>Thickness measurements ranged from a minimum to a maximum of <strong>{{MGI_MAX}} mm</strong>, with an overall structure average of <strong>{{MGI_AVG}} mm</strong>.</p>
<table data-width="100%" data-align="center" style="width: 100% !important; margin: 1em auto !important;">
    <tbody>
        <tr>
            <th style="background-color: #f1f5f9; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px 10px;">Marine Growth Parameter</th>
            <th style="background-color: #f1f5f9; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px 10px;">Recorded Metric</th>
            <th style="background-color: #f1f5f9; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px 10px;">Allowance / Limit</th>
        </tr>
        <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Maximum Thickness</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">{{MGI_MAX}} mm</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Within hydrodynamic design allowance</td>
        </tr>
        <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Average Thickness</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">{{MGI_AVG}} mm</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Nominal fouling level</td>
        </tr>
    </tbody>
</table>
                `.trim();
            } else {
                templateHtml = `
<p>Inspection scope on <strong>{{PLATFORM_NAME}}</strong> under SOW <strong>{{REPORT_NO}}</strong> was completed aboard <strong>{{VESSEL_NAME}}</strong>.</p>
<p>A total of <strong>{{TOTAL_ANOMALIES}}</strong> anomalies were identified during the survey program:</p>
<ul>
    <li>Priority 1 (Critical): <strong>{{P1_ANOMALIES}}</strong></li>
    <li>Priority 2 (Major): <strong>{{P2_ANOMALIES}}</strong></li>
    <li>Priority 3 (Moderate): <strong>{{P3_ANOMALIES}}</strong></li>
    <li>Outstanding / Open Anomalies: <strong>{{OPEN_ANOMALIES}}</strong></li>
</ul>
                `.trim();
            }
        } else {
            // Executive format
            if (sec === "intro" || sec === "introduction") {
                templateHtml = `
<p>Subsea structural inspection services were successfully executed on <strong>{{PLATFORM_NAME}}</strong> in <strong>{{FIELD_NAME}}</strong> for <strong>{{CLIENT_NAME}}</strong>. All marine operations commenced on <strong>{{START_DATE}}</strong> and concluded on <strong>{{END_DATE}}</strong> aboard <strong>{{VESSEL_NAME}}</strong> in strict accordance with Job Pack <strong>{{JOB_PACK_NAME}}</strong>.</p>
<p>Overall structural integrity is sound. A total of <strong>{{TOTAL_ANOMALIES}}</strong> anomalies were recorded, with <strong>{{OPEN_ANOMALIES}}</strong> remaining open for ongoing integrity management.</p>
                `.trim();
            } else if (sec === "cp") {
                templateHtml = `
<p>Cathodic Protection logging on <strong>{{PLATFORM_NAME}}</strong> confirms stable polarization across all inspected jacket nodes, with readings between <strong>{{CP_MIN}} mV</strong> and <strong>{{CP_MAX}} mV</strong>. The sacrificial anode system provides full active corrosion protection.</p>
                `.trim();
            } else if (sec === "fmd") {
                templateHtml = `
<p>All targeted structural members of <strong>{{PLATFORM_NAME}}</strong> were verified dry during the Flooded Member Detection (FMD) campaign. No through-wall cracking or seawater ingress defects were detected.</p>
                `.trim();
            } else {
                templateHtml = `
<p>Survey operations for <strong>{{PLATFORM_NAME}}</strong> under SOW <strong>{{REPORT_NO}}</strong> have achieved 100% scope completion. Comprehensive records have been logged in accordance with <strong>{{CLIENT_NAME}}</strong> specifications.</p>
                `.trim();
            }
        }

        setDesignerContent(templateHtml);
        if (!newTemplateName) {
            setNewTemplateName(`${sectionTitle} - ${format === "detailed" ? "Detailed Format" : "Executive Format"}`);
        }
        toast.success(`Loaded ${format === "detailed" ? "Detailed" : "Executive"} template with formatting & dynamic fields.`);
    };

    const handleInsertSmartTable = (tableHtml: string, tableName: string) => {
        setDesignerContent((prev) => {
            if (!prev || prev === "<p></p>" || prev.trim() === "") {
                return tableHtml;
            }
            return `${prev}<p></p>${tableHtml}<p></p>`;
        });
        toast.success(`Inserted ${tableName} into template designer!`);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl w-[96vw] h-[88vh] max-h-[920px] bg-white dark:bg-slate-950 p-0 overflow-hidden flex flex-col rounded-3xl border-none shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200">
                {/* Modal Header */}
                <DialogHeader className="p-5 px-6 bg-slate-900 text-white shrink-0 border-b border-slate-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/20">
                                <BookOpen className="w-5 h-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                                    <span>Content Templates Manager</span>
                                    <Badge className="bg-blue-600/30 text-blue-300 hover:bg-blue-600/40 border-blue-500/30 font-medium text-[11px]">
                                        Rich Text & Tables
                                    </Badge>
                                </DialogTitle>
                                <DialogDescription className="text-slate-400 text-xs mt-0.5">
                                    Create templates and assign them to conditional rules. All tags auto-replace with real data on insert.
                                </DialogDescription>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-grow flex flex-col min-h-0">
                    <div className="px-6 border-b bg-white dark:bg-slate-950 shrink-0">
                        <TabsList className="flex gap-2 bg-transparent justify-start h-12 p-0 border-b-0">
                            <TabsTrigger 
                                value="standard" 
                                className="h-10 text-xs font-bold uppercase tracking-wider border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4"
                            >
                                Standard Formats & Rich Templates
                            </TabsTrigger>
                            <TabsTrigger 
                                value="conditional" 
                                className="h-10 text-xs font-bold uppercase tracking-wider border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4"
                            >
                                Conditional Rules (Auto-Gen)
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Standard Templates Content */}
                    <TabsContent value="standard" className="flex-1 data-[state=active]:flex flex-col min-h-0 m-0 overflow-hidden">
                        <div className="flex-grow flex min-h-0 bg-slate-50/50 dark:bg-slate-900/20">
                            {/* Left Pane: Spacious Template Designer Canvas */}
                            <div className="flex-1 flex flex-col min-h-0 p-5 overflow-hidden gap-3">
                                {/* Top Controls: Template Name & Quick Recommendations */}
                                <div className="space-y-2 shrink-0 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                            <Badge 
                                                variant="outline" 
                                                className={`text-[10px] font-bold uppercase px-2 py-0.5 ${
                                                    editingTemplateId 
                                                        ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30" 
                                                        : "border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30"
                                                }`}
                                            >
                                                {editingTemplateId ? `Editing Template #${editingTemplateId}` : "Create Reusable Template"}
                                            </Badge>
                                            {editingTemplateId && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={handleCancelEdit}
                                                    className="h-6 text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 gap-1 px-2"
                                                >
                                                    <X className="w-3 h-3" /> Cancel Edit (New)
                                                </Button>
                                            )}
                                        </div>

                                        {/* AI Format Presets & Smart Tables */}
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 font-bold gap-1 shadow-2xs"
                                                        title="Insert standard smart inspection tables into the template"
                                                    >
                                                        <TableIcon className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> 
                                                        + Insert Smart Table 
                                                        <ChevronDown className="w-3 h-3 opacity-60" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start" className="w-80 p-1.5 text-xs shadow-2xl z-[150] border-slate-200 dark:border-slate-800">
                                                    <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2.5 py-1">
                                                        Smart Inspection Tables (5 Presets)
                                                    </DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem 
                                                        onClick={() => handleInsertSmartTable(getAnomalyZonePriorityTableTemplate(), "Anomaly Breakdown (Zone & Priority)")}
                                                        className="flex flex-col items-start gap-0.5 cursor-pointer py-2 px-2.5 rounded-lg focus:bg-emerald-50 dark:focus:bg-emerald-950/30"
                                                    >
                                                        <span className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                            1. Anomaly Breakdown (Zone & Priority)
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 pl-3.5">
                                                            Component type, Above/Below water, P1/P2/P3 & counts
                                                        </span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem 
                                                        onClick={() => handleInsertSmartTable(getIncompleteScopeTableTemplate(), "Incomplete Scope Status")}
                                                        className="flex flex-col items-start gap-0.5 cursor-pointer py-2 px-2.5 rounded-lg focus:bg-rose-50 dark:focus:bg-rose-950/30"
                                                    >
                                                        <span className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                                                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                                            2. Incomplete Scope Status
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 pl-3.5">
                                                            Inspection types, uninspected counts & pending reasons
                                                        </span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem 
                                                        onClick={() => handleInsertSmartTable(getCompletedScopeTableTemplate(), "Completed Scope Status")}
                                                        className="flex flex-col items-start gap-0.5 cursor-pointer py-2 px-2.5 rounded-lg focus:bg-emerald-50 dark:focus:bg-emerald-950/30"
                                                    >
                                                        <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                            3. Completed Scope Status
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 pl-3.5">
                                                            Completed inspection types, task counts & 100% status
                                                        </span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem 
                                                        onClick={() => handleInsertSmartTable(getAnodeDepletionTableTemplate(), "Anode Depletion Status")}
                                                        className="flex flex-col items-start gap-0.5 cursor-pointer py-2 px-2.5 rounded-lg focus:bg-amber-50 dark:focus:bg-amber-950/30"
                                                    >
                                                        <span className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                                            4. Anode Depletion Status
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 pl-3.5">
                                                            Depletion brackets (&lt;25%, 26-50%, 51-75%, &gt;75%) & integrity action
                                                        </span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem 
                                                        onClick={() => handleInsertSmartTable(getAnomalyDefectTypeTableTemplate(), "Anomaly Defect Matrix")}
                                                        className="flex flex-col items-start gap-0.5 cursor-pointer py-2 px-2.5 rounded-lg focus:bg-indigo-50 dark:focus:bg-indigo-950/30"
                                                    >
                                                        <span className="font-semibold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                                                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                                            5. Anomaly Defect Type Matrix
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 pl-3.5">
                                                            Defect classification vs components, counts & priorities
                                                        </span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>

                                            <span className="text-[10px] font-bold uppercase text-slate-400 mx-1 hidden sm:inline">
                                                AI Presets:
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-[11px] bg-slate-50 hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium gap-1"
                                                onClick={() => loadAiTemplate("detailed")}
                                                title="Load detailed format with table and dynamic tags"
                                            >
                                                <TableIcon className="w-3 h-3 text-blue-500" /> Detailed + Table
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-[11px] bg-slate-50 hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium gap-1"
                                                onClick={() => loadAiTemplate("executive")}
                                                title="Load compact executive summary"
                                            >
                                                <Sparkles className="w-3 h-3 text-indigo-500" /> Executive Format
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-[11px] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 gap-1"
                                                onClick={() => {
                                                    setDesignerContent(currentContent || "");
                                                    if (!newTemplateName) {
                                                        setNewTemplateName(`${sectionTitle} - Current Section`);
                                                    }
                                                    toast.info("Copied current section text into template designer.");
                                                }}
                                                title="Copy the text currently on the screen into this template"
                                            >
                                                <RefreshCw className="w-3 h-3" /> Use Current Text
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Template Name Input */}
                                    <div className="flex items-center gap-2 pt-1">
                                        <div className="flex-1">
                                            <Input 
                                                placeholder="Template Name (e.g. Detailed Inspection Summary with Scope Table...)" 
                                                value={newTemplateName}
                                                onChange={(e) => setNewTemplateName(e.target.value)}
                                                className="h-9 bg-white dark:bg-slate-950 font-medium text-xs placeholder:text-slate-400"
                                            />
                                        </div>
                                        <Button 
                                            onClick={handleSaveTemplate} 
                                            disabled={isSaving}
                                            className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white gap-2 font-bold shrink-0 shadow-xs"
                                        >
                                            <Save className="w-4 h-4" /> 
                                            {editingTemplateId ? "Update Template" : "Save As Template"}
                                        </Button>
                                    </div>
                                </div>

                                {/* Rich Text Editor with Tables & Dynamic Variables */}
                                <div className="flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden shadow-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                                    <ExecutiveRichEditor
                                        value={designerContent}
                                        onChange={(val) => setDesignerContent(val)}
                                        placeholder="Design template content... Insert tables, format text colors and fonts, and add auto-updating dynamic fields..."
                                        sectionTitle={sectionTitle}
                                        showDynamicFields={true}
                                        minHeight="340px"
                                        statsContext={statsContext}
                                    />
                                </div>
                            </div>

                            {/* Right Pane: Saved Templates Sidebar */}
                            <aside className="w-[380px] shrink-0 flex flex-col min-h-0 bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800">
                                <div className="p-4 border-b space-y-2 shrink-0 bg-slate-50/50 dark:bg-slate-900/20">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                            Saved Templates
                                        </span>
                                        <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                                            {filteredTemplates.length}
                                        </Badge>
                                    </div>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                        <Input 
                                            placeholder="Search templates..." 
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-8 h-8 text-xs bg-white dark:bg-slate-900"
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                                    {isLoading ? (
                                        <div className="flex items-center justify-center py-20 text-slate-500 text-xs">
                                            Loading templates...
                                        </div>
                                    ) : filteredTemplates.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2 text-center p-4">
                                            <FileText className="w-8 h-8 opacity-20" />
                                            <p className="text-xs font-semibold">No templates found for this section</p>
                                            <p className="text-[11px] text-slate-400">
                                                Use the template designer on the left to create and save your first template.
                                            </p>
                                        </div>
                                    ) : (
                                        filteredTemplates.map((t: any) => {
                                            const hasTable = t.content?.includes("<table");
                                            const hasTags = t.content?.includes("{{");

                                            return (
                                                <div 
                                                    key={t.id}
                                                    className={`group p-3 rounded-2xl border transition-all shadow-2xs flex flex-col gap-2 ${
                                                        editingTemplateId === t.id
                                                            ? "bg-amber-50/30 dark:bg-amber-950/20 border-amber-400/80 ring-1 ring-amber-400/30"
                                                            : "bg-slate-50/60 dark:bg-slate-900/40 hover:border-blue-400 dark:hover:border-blue-600 border-slate-200/80 dark:border-slate-800"
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-start gap-2">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                                                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate max-w-[200px]" title={t.template_name}>
                                                                    {t.template_name}
                                                                </h4>
                                                            </div>
                                                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                                                                {t.client_name && (
                                                                    <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter h-4 px-1 bg-white dark:bg-slate-900">
                                                                        {t.client_name}
                                                                    </Badge>
                                                                )}
                                                                {hasTable && (
                                                                    <Badge variant="secondary" className="text-[8px] font-semibold h-4 px-1 gap-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                                                        <TableIcon className="w-2.5 h-2.5" /> Table
                                                                    </Badge>
                                                                )}
                                                                {hasTags && (
                                                                    <Badge variant="secondary" className="text-[8px] font-mono h-4 px-1 gap-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                                                        <Code className="w-2.5 h-2.5" /> Dynamic Tags
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-6 w-6 text-slate-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40"
                                                                onClick={() => handleStartEdit(t)}
                                                                title="Edit this template in designer"
                                                            >
                                                                <Edit2 className="w-3 h-3" />
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                                                                onClick={() => handleDelete(t.id)}
                                                                title="Delete template"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    {/* Clean Snippet Preview */}
                                                    <div className="text-[11px] text-slate-500 line-clamp-3 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/60 dark:border-slate-800/80 leading-relaxed max-h-16 overflow-hidden">
                                                        {t.content?.replace(/<[^>]+>/g, " ") || ""}
                                                    </div>

                                                    {/* Action Buttons: Load Template (with real data) & Assign to Rule */}
                                                    <div className="flex items-center gap-1.5 pt-0.5">
                                                        <Button 
                                                            variant="default" 
                                                            size="sm" 
                                                            className="flex-1 h-7 text-[10px] font-bold uppercase tracking-wider gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-all"
                                                            onClick={() => handleApplyTemplate(t.content)}
                                                            title="Insert this template into the active summary section with all variables substituted with actual live data"
                                                        >
                                                            <Copy className="w-3 h-3" /> Insert (Real Data)
                                                        </Button>

                                                        {/* Quick Assign to Conditional Rule Dropdown */}
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-7 text-[10px] font-bold uppercase tracking-wider px-2 gap-1 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100"
                                                                    title="Assign this template to one of the 4 auto-insert conditional rules"
                                                                >
                                                                    <Zap className="w-3 h-3 text-amber-500" />
                                                                    <span>Assign Rule</span>
                                                                    <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-64">
                                                                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-400">
                                                                    Assign to Conditional Rule
                                                                </DropdownMenuLabel>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    onClick={() => handleAssignTemplateToRule(t, "cond_no_inspection", "Condition 1 (No Inspection)")}
                                                                    className="text-xs cursor-pointer"
                                                                >
                                                                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                                                                        Condition 1: No Inspection Carried Out
                                                                    </span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() => handleAssignTemplateToRule(t, "cond_has_data", "Condition 2 (Normal / No Anomalies)")}
                                                                    className="text-xs cursor-pointer"
                                                                >
                                                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                                        Condition 2: Inspected Normal (No Defects)
                                                                    </span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() => handleAssignTemplateToRule(t, "cond_has_anomaly", "Condition 3 (Has Anomalies)")}
                                                                    className="text-xs cursor-pointer"
                                                                >
                                                                    <span className="font-semibold text-rose-600 dark:text-rose-400">
                                                                        Condition 3: Inspected & Anomalies Found
                                                                    </span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() => handleAssignTemplateToRule(t, "cond_not_registered", "Condition 4 (Not Registered)")}
                                                                    className="text-xs cursor-pointer"
                                                                >
                                                                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                                                                        Condition 4: Component Not Registered
                                                                    </span>
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </aside>
                        </div>

                        {/* Standard Tab Footer */}
                        <DialogFooter className="p-3.5 px-6 bg-white dark:bg-slate-950 border-t flex flex-row items-center justify-between shrink-0 gap-3">
                            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                <span className="flex items-center gap-1.5 font-medium">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>
                                        When inserting into report or auto-populating, <strong>all tags are automatically replaced with real campaign data</strong>.
                                    </span>
                                </span>
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => onOpenChange(false)} 
                                className="h-8 text-xs font-semibold px-4"
                            >
                                Close
                            </Button>
                        </DialogFooter>
                    </TabsContent>

                    {/* Conditional Templates Content */}
                    <TabsContent value="conditional" className="flex-1 data-[state=active]:flex flex-col min-h-0 m-0">
                        <ConditionalTemplatesTab
                            sectionId={sectionId}
                            clientName={projectContext.client || ""}
                            onSaveRules={async (rules) => {
                                await onSaveRules(rules);
                                mutate(`/api/executive-summary/templates?section_id=${sectionId}`);
                            }}
                            existingRules={templates.find((t: any) => t.metadata?.template_type === "conditional")?.metadata || null}
                            customVariables={customVariables}
                            onSaveCustomVariables={onSaveCustomVariables}
                            savedTemplates={filteredTemplates}
                            statsContext={statsContext}
                            onApplyContent={(content) => {
                                onSelect(content);
                                onOpenChange(false);
                            }}
                        />
                        <DialogFooter className="p-4 bg-white dark:bg-slate-950 border-t flex items-center justify-end shrink-0">
                            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-[11px] font-bold uppercase">Close</Button>
                        </DialogFooter>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
