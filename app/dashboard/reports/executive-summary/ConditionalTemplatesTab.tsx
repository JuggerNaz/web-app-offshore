"use client";

import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Save,
    Copy,
    Plus,
    Trash2,
    Calendar,
    Settings,
    HelpCircle,
    Check,
    Cpu,
    Table as TableIcon,
    Sparkles,
    Eye,
    Code,
    CheckCircle2,
    ArrowRight,
    Zap,
    RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { 
    interpolateAllVariables, 
    evaluateActiveCondition, 
    ConditionEvaluationResult 
} from "./template-utils";

interface ConditionalTemplatesTabProps {
    sectionId: string;
    clientName: string;
    onSaveRules: (rules: any) => Promise<void>;
    existingRules: any;
    customVariables: Record<string, string>;
    onSaveCustomVariables: (vars: Record<string, string>) => Promise<void>;
    savedTemplates?: any[];
    statsContext?: any;
    onApplyContent?: (content: string) => void;
}

export function ConditionalTemplatesTab({
    sectionId,
    clientName,
    onSaveRules,
    existingRules,
    customVariables,
    onSaveCustomVariables,
    savedTemplates = [],
    statsContext = {},
    onApplyContent
}: ConditionalTemplatesTabProps) {
    const [rules, setRules] = useState<Record<string, string>>({
        cond_no_inspection: "",
        cond_has_data: "",
        cond_has_anomaly: "",
        cond_not_registered: "",
        cond_no_inspection_template_name: "",
        cond_has_data_template_name: "",
        cond_has_anomaly_template_name: "",
        cond_not_registered_template_name: ""
    });

    const [isSaving, setIsSaving] = useState(false);
    const [focusedTextarea, setFocusedTextarea] = useState<string | null>(null);
    const [previewMode, setPreviewMode] = useState<Record<string, boolean>>({});

    // Textarea Refs to allow precise cursor insertion/highlight replacement
    const refs = {
        cond_no_inspection: React.useRef<HTMLTextAreaElement>(null),
        cond_has_data: React.useRef<HTMLTextAreaElement>(null),
        cond_has_anomaly: React.useRef<HTMLTextAreaElement>(null),
        cond_not_registered: React.useRef<HTMLTextAreaElement>(null)
    };

    // Custom variables state
    const [customVars, setCustomVars] = useState<Array<{ key: string; value: string }>>([]);
    const [newKey, setNewKey] = useState("");
    const [newValue, setNewValue] = useState("");

    useEffect(() => {
        if (existingRules) {
            setRules({
                cond_no_inspection: existingRules.cond_no_inspection || "",
                cond_has_data: existingRules.cond_has_data || "",
                cond_has_anomaly: existingRules.cond_has_anomaly || "",
                cond_not_registered: existingRules.cond_not_registered || "",
                cond_no_inspection_template_name: existingRules.cond_no_inspection_template_name || "",
                cond_has_data_template_name: existingRules.cond_has_data_template_name || "",
                cond_has_anomaly_template_name: existingRules.cond_has_anomaly_template_name || "",
                cond_not_registered_template_name: existingRules.cond_not_registered_template_name || ""
            });
        } else {
            setRules({
                cond_no_inspection: "",
                cond_has_data: "",
                cond_has_anomaly: "",
                cond_not_registered: "",
                cond_no_inspection_template_name: "",
                cond_has_data_template_name: "",
                cond_has_anomaly_template_name: "",
                cond_not_registered_template_name: ""
            });
        }
    }, [existingRules, sectionId]);

    useEffect(() => {
        if (customVariables) {
            const list = Object.entries(customVariables).map(([k, v]) => ({
                key: k.startsWith("{{") ? k : `{{${k}}}`,
                value: v
            }));
            setCustomVars(list);
        } else {
            setCustomVars([]);
        }
    }, [customVariables]);

    const activeEvaluation: ConditionEvaluationResult = evaluateActiveCondition(
        sectionId,
        statsContext?.insightData || {}
    );

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSaveRules(rules);
            toast.success("Conditional template rules saved successfully!");
        } catch (error: any) {
            toast.error(error.message || "Failed to save rules");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAssignTemplate = (conditionKey: string, templateIdStr: string) => {
        if (!templateIdStr) {
            setRules(prev => ({
                ...prev,
                [conditionKey]: "",
                [`${conditionKey}_template_name`]: ""
            }));
            return;
        }

        const template = savedTemplates.find((t: any) => String(t.id) === templateIdStr);
        if (!template) return;

        setRules(prev => ({
            ...prev,
            [conditionKey]: template.content,
            [`${conditionKey}_template_name`]: template.template_name
        }));

        toast.success(`Assigned template "${template.template_name}" to this condition.`);
    };

    const handleAutoInsertActiveCondition = () => {
        const rawTemplate = rules[activeEvaluation.conditionKey] || getAISuggestion(activeEvaluation.conditionKey, sectionId);
        if (!rawTemplate) {
            toast.error("No template defined for the active condition");
            return;
        }

        // Interpolate ALL variables with real live data
        const interpolated = interpolateAllVariables(rawTemplate, statsContext);
        if (onApplyContent) {
            onApplyContent(interpolated);
            toast.success(`Auto-inserted ${activeEvaluation.conditionLabel} with all live data replaced!`);
        }
    };

    const handleAddCustomVar = async () => {
        if (!newKey.trim() || !newValue.trim()) {
            toast.error("Please enter both key and value");
            return;
        }

        let formattedKey = newKey.trim().toUpperCase();
        if (!formattedKey.startsWith("{{")) formattedKey = `{{${formattedKey}`;
        if (!formattedKey.endsWith("}}")) formattedKey = `${formattedKey}}`;

        if (customVars.some(v => v.key === formattedKey)) {
            toast.error("Variable key already exists");
            return;
        }

        const updatedList = [...customVars, { key: formattedKey, value: newValue.trim() }];
        setCustomVars(updatedList);

        const record: Record<string, string> = {};
        updatedList.forEach(item => {
            const cleanKey = item.key.replace("{{", "").replace("}}", "");
            record[cleanKey] = item.value;
        });

        try {
            await onSaveCustomVariables(record);
            toast.success(`Custom variable ${formattedKey} saved`);
            setNewKey("");
            setNewValue("");
        } catch (e: any) {
            toast.error("Failed to save custom variables");
        }
    };

    const handleDeleteCustomVar = async (keyToDelete: string) => {
        const updatedList = customVars.filter(v => v.key !== keyToDelete);
        setCustomVars(updatedList);

        const record: Record<string, string> = {};
        updatedList.forEach(item => {
            const cleanKey = item.key.replace("{{", "").replace("}}", "");
            record[cleanKey] = item.value;
        });

        try {
            await onSaveCustomVariables(record);
            toast.success(`Deleted custom variable`);
        } catch (e: any) {
            toast.error("Failed to delete custom variable");
        }
    };

    const insertVariableAtCursor = (variable: string) => {
        if (!focusedTextarea) {
            toast.info("Click inside a condition template textbox to focus it, then double-click a variable.");
            return;
        }

        const textarea = refs[focusedTextarea as keyof typeof refs]?.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const val = textarea.value;

        const newVal = val.substring(0, start) + variable + val.substring(end);

        setRules(prev => ({
            ...prev,
            [focusedTextarea]: newVal
        }));

        setTimeout(() => {
            textarea.focus();
            const newPos = start + variable.length;
            textarea.setSelectionRange(newPos, newPos);
        }, 0);

        toast.success(`Inserted ${variable}`);
    };

    // AI Suggestions Generator for each condition
    const getAISuggestion = (condition: string, secId: string) => {
        const sid = secId.toLowerCase();
        if (condition === "cond_no_inspection") {
            switch(sid) {
                case "cp": return "<p>Cathodic Potential (CP) survey measurements were not collected on <strong>{{PLATFORM_NAME}}</strong> for SOW Report <strong>{{REPORT_NO}}</strong>.</p>";
                case "fmd": return "<p>Flooded Member Detection (FMD) was not executed on the subsea members of <strong>{{PLATFORM_NAME}}</strong>.</p>";
                case "mgi": return "<p>Marine Growth Inspection (MGI) was not scheduled or carried out during SOW <strong>{{REPORT_NO}}</strong>.</p>";
                case "scour": return "<p>Base Level scour survey was not conducted on the seabed foundation of <strong>{{PLATFORM_NAME}}</strong>.</p>";
                default: return "<p>No active inspections for this category were performed on <strong>{{PLATFORM_NAME}}</strong> during SOW <strong>{{REPORT_NO}}</strong>.</p>";
            }
        }
        if (condition === "cond_has_data") {
            switch(sid) {
                case "cp": return "<p>Cathodic Potential (CP) survey was successfully completed on <strong>{{PLATFORM_NAME}}</strong>. All recorded potentials ranged between <strong>{{CP_MIN}} mV</strong> and <strong>{{CP_MAX}} mV</strong>, confirming compliant cathodic protection levels.</p>";
                case "fmd": return "<p>FMD checks completed on all scheduled members of <strong>{{PLATFORM_NAME}}</strong>, confirming no flooded conditions.</p>";
                case "mgi": return "<p>MGI measurements indicate Marine Growth thickness ranges from <strong>{{MGI_MIN}} mm</strong> to <strong>{{MGI_MAX}} mm</strong> (average: <strong>{{MGI_AVG}} mm</strong>), remaining within design limits.</p>";
                case "scour": return "<p>Scour survey completed on <strong>{{PLATFORM_NAME}}</strong> foundation. The minimum pile burial recorded was <strong>{{SCOUR_MIN_BURIAL}}</strong>, indicating stable seabed conditions.</p>";
                default: return "<p>The inspection for this category was completed on <strong>{{PLATFORM_NAME}}</strong> with normal results and no active structural defects.</p>";
            }
        }
        if (condition === "cond_has_anomaly") {
            switch(sid) {
                case "cp": return "<p>CP survey completed on <strong>{{PLATFORM_NAME}}</strong> with readings ranging from <strong>{{CP_MIN}} mV</strong> to <strong>{{CP_MAX}} mV</strong>. Localized low potentials were noted, and <strong>{{TOTAL_ANOMALIES}}</strong> anomalies are currently active.</p>";
                case "fmd": return "<p>FMD survey detected flooded conditions. A total of <strong>{{TOTAL_ANOMALIES}}</strong> FMD anomalies are registered for structural review.</p>";
                case "mgi": return "<p>MGI thickness reached a maximum of <strong>{{MGI_MAX}} mm</strong>. Excessive growth was noted, resulting in <strong>{{MGI_ANOMALIES}}</strong> active MGI anomalies.</p>";
                case "scour": return "<p>Scour survey revealed pile exposure. Minimum burial fell to <strong>{{SCOUR_MIN_BURIAL}}</strong>, and <strong>{{TOTAL_ANOMALIES}}</strong> scour anomalies were logged.</p>";
                default: return "<p>During the inspection on <strong>{{PLATFORM_NAME}}</strong>, structural defects were identified. A total of <strong>{{TOTAL_ANOMALIES}}</strong> anomalies are active.</p>";
            }
        }
        return "<p>Note: <strong>{{PLATFORM_NAME}}</strong> does not have any registered components or active scope for this category under SOW <strong>{{REPORT_NO}}</strong>.</p>";
    };

    const standardVariables = [
        { key: "{{PLATFORM_NAME}}", desc: "Platform Title" },
        { key: "{{JOB_PACK_NAME}}", desc: "Job Pack Name" },
        { key: "{{REPORT_NO}}", desc: "SOW Report Number" },
        { key: "{{CONTRACT_NO}}", desc: "Contract Ref Number" },
        { key: "{{CLIENT_NAME}}", desc: "Client Full Name" },
        { key: "{{CLIENT_SHORT}}", desc: "Client Short Code" },
        { key: "{{CONTRACTOR_NAME}}", desc: "Contractor Name" },
        { key: "{{FIELD_NAME}}", desc: "Oil Field Name" },
        { key: "{{VESSEL_NAME}}", desc: "Vessel Name" },
        { key: "{{TODAY_SHORT}}", desc: "Date (dd-Mon-yyyy)" },
        { key: "{{START_DATE}}", desc: "Campaign Start Date" },
        { key: "{{END_DATE}}", desc: "Campaign End Date" },
        { key: "{{TOTAL_ANOMALIES}}", desc: "Total Anomalies" },
        { key: "{{OPEN_ANOMALIES}}", desc: "Open Anomalies" },
        { key: "{{P1_ANOMALIES}}", desc: "Priority 1 Count" },
        { key: "{{CP_MIN}}", desc: "CP Minimum (mV)" },
        { key: "{{CP_MAX}}", desc: "CP Maximum (mV)" },
        { key: "{{MGI_MIN}}", desc: "MGI Minimum (mm)" },
        { key: "{{MGI_MAX}}", desc: "MGI Maximum (mm)" },
        { key: "{{MGI_AVG}}", desc: "MGI Average (mm)" },
        { key: "{{MGI_ANOMALIES}}", desc: "MGI Anomalies Count" },
        { key: "{{TABLE_ANOMALY_ZONE_PRIORITY}}", desc: "Table: Anomaly Zone & Priority Breakdown" },
        { key: "{{TABLE_INCOMPLETE_SCOPE}}", desc: "Table: Incomplete Scope & Tasks Status" },
        { key: "{{TABLE_COMPLETED_SCOPE}}", desc: "Table: Completed Scope & Tasks Status" },
        { key: "{{TABLE_ANODE_DEPLETION}}", desc: "Table: Anode Depletion Breakdown" },
        { key: "{{TABLE_ANOMALY_BY_DEFECT_TYPE}}", desc: "Table: Anomaly Defect Type Matrix" }
    ];

    const conditionsConfig = [
        {
            key: "cond_no_inspection",
            number: 1,
            title: "Condition 1: No Inspection Was Carried Out",
            subtitle: "Triggered when 0 records are logged for this scope in the campaign.",
            badgeColor: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
            borderColor: "border-slate-200 dark:border-slate-800"
        },
        {
            key: "cond_has_data",
            number: 2,
            title: "Condition 2: Inspected Normal (No Anomalies)",
            subtitle: "Triggered when inspection was performed with compliant results & zero anomalies.",
            badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
            borderColor: "border-emerald-200 dark:border-emerald-900/40"
        },
        {
            key: "cond_has_anomaly",
            number: 3,
            title: "Condition 3: Inspected & Anomalies Were Found",
            subtitle: "Triggered when active anomalies or defects are recorded in this section.",
            badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
            borderColor: "border-rose-200 dark:border-rose-900/40"
        },
        {
            key: "cond_not_registered",
            number: 4,
            title: "Condition 4: Component Not Registered for Structure",
            subtitle: "Triggered when the component type does not exist on this platform.",
            badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
            borderColor: "border-amber-200 dark:border-amber-900/40"
        }
    ];

    return (
        <div className="flex-1 flex min-h-0 bg-slate-50/50 dark:bg-slate-900/10">
            {/* Left side: conditional rules edit forms */}
            <div className="flex-1 overflow-y-auto p-6 border-r space-y-6">
                {/* Active Campaign Condition Banner */}
                <div className="p-4 rounded-2xl border bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-slate-50/80 dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900 border-blue-200/80 dark:border-blue-900/40 shadow-xs flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs shrink-0 mt-0.5">
                            <Zap className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                    Current Campaign Active Condition
                                </span>
                                <Badge className="bg-blue-600 text-white text-[10px] font-bold">
                                    Condition {activeEvaluation.conditionNumber} Active
                                </Badge>
                            </div>
                            <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">
                                {activeEvaluation.conditionLabel}
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {activeEvaluation.reason}
                            </p>
                        </div>
                    </div>

                    {onApplyContent && (
                        <Button
                            onClick={handleAutoInsertActiveCondition}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5 shrink-0 shadow-xs h-9 px-4"
                            title="Auto-insert this condition's template into the summary section with all variables substituted"
                        >
                            <Sparkles className="w-3.5 h-3.5" /> Auto-Insert with Real Data
                        </Button>
                    )}
                </div>

                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                Assign Saved Templates to Conditions
                            </h3>
                            <p className="text-xs text-slate-500">
                                Assign your rich templates (with tables and formatting) to each condition. When auto-populating, tags will be replaced with real data.
                            </p>
                        </div>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-2 shadow-xs h-8 px-4"
                        >
                            <Save className="w-3.5 h-3.5" /> Save Conditional Rules
                        </Button>
                    </div>

                    {/* Condition Cards */}
                    <div className="space-y-5">
                        {conditionsConfig.map((cond) => {
                            const isCurrentlyActive = activeEvaluation.conditionKey === cond.key;
                            const assignedName = rules[`${cond.key}_template_name`];
                            const content = rules[cond.key] || "";
                            const hasTable = content.includes("<table");
                            const isPreview = previewMode[cond.key];

                            return (
                                <div 
                                    key={cond.key}
                                    className={`p-4 rounded-2xl border transition-all ${
                                        isCurrentlyActive 
                                            ? "border-blue-400 dark:border-blue-600 bg-white dark:bg-slate-900/90 shadow-sm ring-1 ring-blue-400/20" 
                                            : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3 mb-2.5">
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge className={`text-[10px] font-bold border-none px-2 py-0.5 ${cond.badgeColor}`}>
                                                    Condition {cond.number}
                                                </Badge>
                                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                                    {cond.title}
                                                </h4>
                                                {isCurrentlyActive && (
                                                    <Badge variant="outline" className="text-[9px] font-bold text-blue-600 border-blue-400 bg-blue-50 dark:bg-blue-950/40">
                                                        Active for current SOW
                                                    </Badge>
                                                )}
                                                {assignedName && (
                                                    <Badge variant="secondary" className="text-[9px] font-medium gap-1 text-slate-700 bg-slate-100 dark:bg-slate-800">
                                                        Assigned: <strong>{assignedName}</strong>
                                                        {hasTable && <TableIcon className="w-2.5 h-2.5 text-blue-500" />}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-slate-500 mt-0.5">{cond.subtitle}</p>
                                        </div>

                                        {/* Template Assign Selector */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold uppercase text-slate-400">
                                                    Assign Saved:
                                                </span>
                                                <select
                                                    value={savedTemplates.find((t: any) => t.template_name === assignedName)?.id || ""}
                                                    onChange={(e) => handleAssignTemplate(cond.key, e.target.value)}
                                                    className="h-7 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[180px]"
                                                >
                                                    <option value="">-- Choose Template --</option>
                                                    {savedTemplates.map((t: any) => (
                                                        <option key={t.id} value={t.id}>
                                                            {t.template_name} {t.content?.includes("<table") ? "(Table)" : ""}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Bar (Preview Toggle, AI Suggestion, Clear) */}
                                    <div className="flex items-center justify-between gap-2 mb-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                                        <div className="flex items-center gap-1.5">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setPreviewMode(prev => ({ ...prev, [cond.key]: !prev[cond.key] }))}
                                                className={`h-6 text-[10px] font-semibold gap-1 px-2 ${
                                                    isPreview 
                                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" 
                                                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                                                }`}
                                            >
                                                <Eye className="w-3 h-3" />
                                                {isPreview ? "Edit Raw Template" : "Preview with Real Data"}
                                            </Button>

                                            {hasTable && (
                                                <Badge variant="outline" className="text-[9px] text-blue-600 border-blue-200 gap-1 h-5">
                                                    <TableIcon className="w-2.5 h-2.5" /> Contains Formatted Table
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    const suggestion = getAISuggestion(cond.key, sectionId);
                                                    setRules(prev => ({
                                                        ...prev,
                                                        [cond.key]: suggestion,
                                                        [`${cond.key}_template_name`]: `AI Default - Condition ${cond.number}`
                                                    }));
                                                    toast.info(`Loaded AI suggestion for Condition ${cond.number}`);
                                                }}
                                                className="h-6 text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 gap-1 px-2"
                                            >
                                                <Sparkles className="w-3 h-3" /> Use AI Suggestion
                                            </Button>

                                            {content && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setRules(prev => ({
                                                            ...prev,
                                                            [cond.key]: "",
                                                            [`${cond.key}_template_name`]: ""
                                                        }));
                                                    }}
                                                    className="h-6 text-[10px] font-medium text-slate-400 hover:text-red-600 px-2"
                                                >
                                                    Clear
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Preview Mode vs Editor Mode */}
                                    {isPreview ? (
                                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 leading-relaxed max-h-56 overflow-y-auto">
                                            <div className="flex items-center justify-between mb-2 pb-1.5 border-b text-[10px] text-slate-400">
                                                <span className="font-bold uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3" /> Live Interpolated Preview (All Tags Replaced)
                                                </span>
                                                <span>What will be pasted into summary</span>
                                            </div>
                                            <div 
                                                dangerouslySetInnerHTML={{ 
                                                    __html: interpolateAllVariables(content || getAISuggestion(cond.key, sectionId), statsContext) 
                                                }} 
                                            />
                                        </div>
                                    ) : (
                                        <Textarea
                                            ref={refs[cond.key as keyof typeof refs]}
                                            value={content}
                                            onChange={e => setRules(prev => ({ ...prev, [cond.key]: e.target.value }))}
                                            onFocus={() => setFocusedTextarea(cond.key)}
                                            placeholder={`Template content or HTML for Condition ${cond.number}... Assign a saved template above or type here.`}
                                            className="h-24 text-xs font-mono focus-visible:ring-blue-500 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl"
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <Button 
                        onClick={handleSave} 
                        disabled={isSaving} 
                        className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 rounded-xl shadow-xs"
                    >
                        <Save className="w-4 h-4" /> Save Conditional Templates
                    </Button>
                </div>
            </div>

            {/* Right side: Live Variable Databank & Custom Variables */}
            <aside className="w-80 flex flex-col min-h-0 bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex-grow overflow-y-auto p-4 space-y-6">
                    {/* Live Variable Databank */}
                    <div>
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1 flex items-center gap-1">
                            <Cpu className="w-3.5 h-3.5 text-blue-500" /> Live Variable Databank
                        </h4>
                        <p className="text-[10px] text-slate-500 mb-3">
                            Double-click any tag to insert it at your cursor. When auto-inserting into summary, all tags are replaced with live data.
                        </p>
                        
                        <div className="flex flex-col gap-1.5">
                            {standardVariables.map(v => (
                                <button
                                    key={v.key}
                                    onDoubleClick={() => insertVariableAtCursor(v.key)}
                                    className="flex items-center justify-between text-left p-1.5 rounded-lg border border-slate-100 hover:border-blue-500 hover:bg-blue-50/20 dark:border-slate-800 dark:hover:border-blue-900/30 transition-all group select-none cursor-pointer"
                                    title="Double-click to insert/replace"
                                >
                                    <code className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">{v.key}</code>
                                    <span className="text-[9px] text-slate-400 group-hover:text-slate-600 truncate max-w-[120px]">{v.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom variables manager */}
                    <div className="border-t pt-4">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                            Custom Variables Manager
                        </h4>
                        <p className="text-[10px] text-slate-500 mb-3">
                            Add project-specific custom variables to reference in your templates.
                        </p>
                        
                        <div className="space-y-2 mb-4 bg-slate-50 dark:bg-slate-900/30 p-2.5 rounded-xl border border-dashed">
                            <div className="space-y-1">
                                <Label className="text-[9px] font-bold text-slate-500 uppercase">Variable Key</Label>
                                <Input 
                                    placeholder="e.g. VESSEL_CO_1" 
                                    value={newKey} 
                                    onChange={e => setNewKey(e.target.value)}
                                    className="h-8 text-xs bg-white dark:bg-slate-950 font-mono"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[9px] font-bold text-slate-500 uppercase">Value</Label>
                                <Input 
                                    placeholder="e.g. MV Offshore Star" 
                                    value={newValue} 
                                    onChange={e => setNewValue(e.target.value)}
                                    className="h-8 text-xs bg-white dark:bg-slate-950"
                                />
                            </div>
                            <Button 
                                size="sm" 
                                onClick={handleAddCustomVar} 
                                className="w-full h-8 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1 mt-1"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add Variable
                            </Button>
                        </div>

                        {customVars.length > 0 && (
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-bold text-slate-500 uppercase">Your Custom Variables</Label>
                                <div className="flex flex-col gap-1.5">
                                    {customVars.map(v => (
                                        <div 
                                            key={v.key}
                                            className="flex items-center justify-between p-1.5 rounded-lg border bg-slate-50/50 dark:bg-slate-900/20 text-xs"
                                        >
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <button 
                                                    onDoubleClick={() => insertVariableAtCursor(v.key)}
                                                    className="text-left font-mono font-bold text-blue-500 hover:underline truncate select-none cursor-pointer"
                                                    title="Double-click to insert/replace"
                                                >
                                                    {v.key}
                                                </button>
                                                <span className="text-[10px] text-slate-500 truncate">{v.value}</span>
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => handleDeleteCustomVar(v.key)}
                                                className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </aside>
        </div>
    );
}
