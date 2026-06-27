"use client";

import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Save,
    Copy,
    Plus,
    Trash2,
    Calendar,
    Settings,
    HelpCircle,
    Check,
    Cpu
} from "lucide-react";
import { toast } from "sonner";

interface ConditionalTemplatesTabProps {
    sectionId: string;
    clientName: string;
    onSaveRules: (rules: any) => Promise<void>;
    existingRules: any;
    customVariables: Record<string, string>;
    onSaveCustomVariables: (vars: Record<string, string>) => Promise<void>;
}

export function ConditionalTemplatesTab({
    sectionId,
    clientName,
    onSaveRules,
    existingRules,
    customVariables,
    onSaveCustomVariables
}: ConditionalTemplatesTabProps) {
    const [rules, setRules] = useState({
        cond_no_inspection: "",
        cond_has_data: "",
        cond_has_anomaly: "",
        cond_not_registered: ""
    });

    const [isSaving, setIsSaving] = useState(false);
    const [focusedTextarea, setFocusedTextarea] = useState<string | null>(null);

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
                cond_not_registered: existingRules.cond_not_registered || ""
            });
        } else {
            setRules({
                cond_no_inspection: "",
                cond_has_data: "",
                cond_has_anomaly: "",
                cond_not_registered: ""
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

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSaveRules(rules);
            toast.success("Conditional templates updated");
        } catch (error: any) {
            toast.error(error.message || "Failed to save rules");
        } finally {
            setIsSaving(false);
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

    // Insert variable at cursor, replacing highlighted text if any exists
    const insertVariableAtCursor = (variable: string) => {
        if (!focusedTextarea) {
            toast.info("Please click inside a template textbox first to focus it, then double-click a variable to insert.");
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

        // Keep focus and select cursor right after the variable
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
                case "cp": return "Cathodic Potential (CP) survey measurements were not collected on {{PLATFORM}} for SOW Report {{REPORT_NO}}.";
                case "fmd": return "Flooded Member Detection (FMD) was not executed on the subsea members of {{PLATFORM}}.";
                case "mgi": return "Marine Growth Inspection (MGI) was not scheduled or carried out during SOW {{REPORT_NO}}.";
                case "scour": return "Base Level scour survey was not conducted on the seabed foundation of {{PLATFORM}}.";
                default: return "No active inspections for this category were performed on {{PLATFORM}} during SOW {{REPORT_NO}}.";
            }
        }
        if (condition === "cond_has_data") {
            switch(sid) {
                case "cp": return "Cathodic Potential (CP) survey was successfully completed on {{PLATFORM}}. All recorded potentials ranged between {{CP_MIN}} and {{CP_MAX}}, confirming compliant cathodic protection levels.";
                case "fmd": return "FMD checks completed on all scheduled members of {{PLATFORM}}, confirming no flooded conditions.";
                case "mgi": return "MGI measurements indicate Marine Growth thickness ranges from {{MGI_MIN}} to {{MGI_MAX}} (average: {{MGI_AVG}}), remaining within design limits.";
                case "scour": return "Scour survey completed on {{PLATFORM}} foundation. The minimum pile burial recorded was {{SCOUR_MIN_BURIAL}}, indicating stable seabed conditions.";
                default: return "The inspection for this category was completed on {{PLATFORM}} with normal results and no active structural defects.";
            }
        }
        if (condition === "cond_has_anomaly") {
            switch(sid) {
                case "cp": return "CP survey completed on {{PLATFORM}} with readings ranging from {{CP_MIN}} to {{CP_MAX}}. Localized low potentials were noted, and {{TOTAL_ANOMALIES}} anomalies are currently active.";
                case "fmd": return "FMD survey detected flooded conditions. A total of {{TOTAL_ANOMALIES}} FMD anomalies are registered for structural review.";
                case "mgi": return "MGI thickness reached a maximum of {{MGI_MAX}}. Excessive growth was noted, resulting in {{MGI_ANOMALIES}} active MGI anomalies.";
                case "scour": return "Scour survey revealed pile exposure. Minimum burial fell to {{SCOUR_MIN_BURIAL}}, and {{TOTAL_ANOMALIES}} scour anomalies were logged.";
                default: return "During the inspection on {{PLATFORM}}, structural defects were identified. A total of {{TOTAL_ANOMALIES}} anomalies are active.";
            }
        }
        return "Note: {{PLATFORM}} does not have any registered components or active scope for this category under SOW {{REPORT_NO}}.";
    };

    // Standard Variables List
    const standardVariables = [
        { key: "{{PLATFORM}}", desc: "Platform Title" },
        { key: "{{JOB_PACK}}", desc: "Job Pack Name" },
        { key: "{{REPORT_NO}}", desc: "SOW Report Number" },
        { key: "{{CLIENT}}", desc: "Client Company" },
        { key: "{{VESSEL_NAME}}", desc: "Vessels Involved" },
        { key: "{{DATE}}", desc: "Current Date" },
        { key: "{{INSP_START_DATE}}", desc: "Inspection Start Date" },
        { key: "{{INSP_END_DATE}}", desc: "Inspection End Date" },
        { key: "{{TOTAL_ANOMALIES}}", desc: "Total Structure Anomalies" },
        { key: "{{OPEN_ANOMALIES}}", desc: "Open Anomalies" },
        { key: "{{CP_MIN}}", desc: "Full Job CP Minimum" },
        { key: "{{CP_MAX}}", desc: "Full Job CP Maximum" },
        { key: "{{MGI_MIN}}", desc: "MGI Minimum Thickness" },
        { key: "{{MGI_MAX}}", desc: "MGI Maximum Thickness" },
        { key: "{{MGI_ANOMALIES}}", desc: "MGI Specific Anomalies" }
    ];

    return (
        <div className="flex-1 flex min-h-0 bg-slate-50/50 dark:bg-slate-900/10">
            {/* Left side: templates edit forms */}
            <div className="flex-1 overflow-y-auto p-6 border-r">
                <div className="space-y-6 max-w-2xl">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Conditional Template Formatting</h3>
                        <p className="text-xs text-slate-500">Preset wordings based on inspection statistics. The system will automatically select the best format on auto-populate.</p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-700 dark:text-slate-350 flex items-center gap-1.5">
                                <Badge className="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold border-none text-[9px] px-1.5">Condition 1</Badge>
                                If No Inspection Was Carried Out
                            </Label>
                            <Textarea
                                ref={refs.cond_no_inspection}
                                value={rules.cond_no_inspection}
                                onChange={e => setRules(prev => ({ ...prev, cond_no_inspection: e.target.value }))}
                                onFocus={() => setFocusedTextarea("cond_no_inspection")}
                                placeholder="e.g. No general visual inspection was conducted on {{PLATFORM}} for this scope..."
                                className="h-20 text-xs focus-visible:ring-blue-500 bg-white dark:bg-slate-950"
                            />
                            <div className="p-2 bg-blue-50/40 dark:bg-blue-950/20 rounded-lg border border-blue-100/50 dark:border-blue-900/30 flex items-start justify-between gap-3 text-[11px] text-slate-600 dark:text-slate-300">
                                <div className="flex items-start gap-1.5 min-w-0">
                                    <Cpu className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <span className="font-semibold text-blue-700 dark:text-blue-400">AI Suggested wording: </span>
                                        <span className="italic">"{getAISuggestion("cond_no_inspection", sectionId)}"</span>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setRules(prev => ({ ...prev, cond_no_inspection: getAISuggestion("cond_no_inspection", sectionId) }));
                                        toast.success("Applied AI suggested wording for Condition 1");
                                    }}
                                    className="h-6 text-[10px] px-2 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900 font-bold"
                                >
                                    Use Suggestion
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-700 dark:text-slate-355 flex items-center gap-1.5">
                                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-450 font-bold border-none text-[9px] px-1.5">Condition 2</Badge>
                                If Inspected with Normal Results (No Anomalies)
                            </Label>
                            <Textarea
                                ref={refs.cond_has_data}
                                value={rules.cond_has_data}
                                onChange={e => setRules(prev => ({ ...prev, cond_has_data: e.target.value }))}
                                onFocus={() => setFocusedTextarea("cond_has_data")}
                                placeholder="e.g. The CP survey was completed with {{CP_MIN}} mV minimum. No anomalies detected..."
                                className="h-20 text-xs focus-visible:ring-blue-500 bg-white dark:bg-slate-950"
                            />
                            <div className="p-2 bg-emerald-50/40 dark:bg-emerald-950/10 rounded-lg border border-emerald-100/50 dark:border-emerald-900/30 flex items-start justify-between gap-3 text-[11px] text-slate-600 dark:text-slate-300">
                                <div className="flex items-start gap-1.5 min-w-0">
                                    <Cpu className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">AI Suggested wording: </span>
                                        <span className="italic">"{getAISuggestion("cond_has_data", sectionId)}"</span>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setRules(prev => ({ ...prev, cond_has_data: getAISuggestion("cond_has_data", sectionId) }));
                                        toast.success("Applied AI suggested wording for Condition 2");
                                    }}
                                    className="h-6 text-[10px] px-2 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-emerald-650 dark:text-emerald-450 border-emerald-200 dark:border-emerald-905/30 font-bold"
                                >
                                    Use Suggestion
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-700 dark:text-slate-355 flex items-center gap-1.5">
                                <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-450 font-bold border-none text-[9px] px-1.5">Condition 3</Badge>
                                If Inspected and Anomalies Were Found
                            </Label>
                            <Textarea
                                ref={refs.cond_has_anomaly}
                                value={rules.cond_has_anomaly}
                                onChange={e => setRules(prev => ({ ...prev, cond_has_anomaly: e.target.value }))}
                                onFocus={() => setFocusedTextarea("cond_has_anomaly")}
                                placeholder="e.g. {{TOTAL_ANOMALIES}} anomalies were reported on {{PLATFORM}}, with CP ranging from {{CP_MIN}} to {{CP_MAX}}..."
                                className="h-20 text-xs focus-visible:ring-blue-500 bg-white dark:bg-slate-950"
                            />
                            <div className="p-2 bg-rose-50/40 dark:bg-rose-950/10 rounded-lg border border-rose-100/50 dark:border-rose-900/30 flex items-start justify-between gap-3 text-[11px] text-slate-600 dark:text-slate-300">
                                <div className="flex items-start gap-1.5 min-w-0">
                                    <Cpu className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <span className="font-semibold text-rose-700 dark:text-rose-400">AI Suggested wording: </span>
                                        <span className="italic">"{getAISuggestion("cond_has_anomaly", sectionId)}"</span>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setRules(prev => ({ ...prev, cond_has_anomaly: getAISuggestion("cond_has_anomaly", sectionId) }));
                                        toast.success("Applied AI suggested wording for Condition 3");
                                    }}
                                    className="h-6 text-[10px] px-2 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-rose-650 dark:text-rose-450 border-rose-200 dark:border-rose-905/30 font-bold"
                                >
                                    Use Suggestion
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-700 dark:text-slate-355 flex items-center gap-1.5">
                                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-450 font-bold border-none text-[9px] px-1.5">Condition 4</Badge>
                                If Component is Not Registered for this Structure
                            </Label>
                            <Textarea
                                ref={refs.cond_not_registered}
                                value={rules.cond_not_registered}
                                onChange={e => setRules(prev => ({ ...prev, cond_not_registered: e.target.value }))}
                                onFocus={() => setFocusedTextarea("cond_not_registered")}
                                placeholder="e.g. Note that no components of this category are registered or active on {{PLATFORM}}..."
                                className="h-20 text-xs focus-visible:ring-blue-500 bg-white dark:bg-slate-950"
                            />
                            <div className="p-2 bg-amber-50/40 dark:bg-amber-950/10 rounded-lg border border-amber-100/50 dark:border-amber-900/30 flex items-start justify-between gap-3 text-[11px] text-slate-600 dark:text-slate-300">
                                <div className="flex items-start gap-1.5 min-w-0">
                                    <Cpu className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <span className="font-semibold text-amber-700 dark:text-amber-400">AI Suggested wording: </span>
                                        <span className="italic">"{getAISuggestion("cond_not_registered", sectionId)}"</span>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setRules(prev => ({ ...prev, cond_not_registered: getAISuggestion("cond_not_registered", sectionId) }));
                                        toast.success("Applied AI suggested wording for Condition 4");
                                    }}
                                    className="h-6 text-[10px] px-2 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-amber-650 dark:text-amber-450 border-amber-200 dark:border-amber-905/30 font-bold"
                                >
                                    Use Suggestion
                                </Button>
                            </div>
                        </div>
                    </div>

                    <Button onClick={handleSave} disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2">
                        <Save className="w-4 h-4" /> Save Conditional Templates
                    </Button>
                </div>
            </div>

            {/* Right side: variables & custom variables */}
            <aside className="w-80 flex flex-col min-h-0 bg-white dark:bg-slate-950 border-l border-slate-100 dark:border-slate-800">
                <div className="flex-grow overflow-y-auto p-4">
                    <div className="space-y-6">
                        {/* Variables databank */}
                        <div>
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1">
                                <Cpu className="w-3.5 h-3.5 text-blue-500" /> Live Variable Databank
                            </h4>
                            <p className="text-[10px] text-slate-500 mb-3">Double-click any variable below to insert it at the active cursor position or replace selected text.</p>
                            
                            <div className="flex flex-col gap-1.5">
                                {standardVariables.map(v => (
                                    <button
                                        key={v.key}
                                        onDoubleClick={() => insertVariableAtCursor(v.key)}
                                        className="flex items-center justify-between text-left p-1.5 rounded border border-slate-100 hover:border-blue-500 hover:bg-blue-50/20 dark:border-slate-800 dark:hover:border-blue-900/30 transition-all group select-none cursor-pointer"
                                        title="Double-click to insert/replace"
                                    >
                                        <code className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">{v.key}</code>
                                        <span className="text-[9px] text-slate-400 group-hover:text-slate-650 truncate max-w-[120px]">{v.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom variables manager */}
                        <div className="border-t pt-4">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Custom Variables Manager</h4>
                            <p className="text-[10px] text-slate-500 mb-3">Add project-specific variables that you can reference in templates.</p>
                            
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
                                <Button size="sm" onClick={handleAddCustomVar} className="w-full h-8 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1 mt-1">
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
                                                className="flex items-center justify-between p-1.5 rounded border bg-slate-50/50 dark:bg-slate-900/20 text-xs"
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
                </div>
            </aside>
        </div>
    );
}
