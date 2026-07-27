"use client";

import { useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    FileText, 
    Trash2, 
    Copy, 
    Search,
    BookOpen,
    Save,
    Cpu
} from "lucide-react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/utils/utils";
import { ConditionalTemplatesTab } from "./ConditionalTemplatesTab";

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
    onSaveCustomVariables
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
    const [editContent, setEditContent] = useState("");

    const filteredTemplates = templates.filter((t: any) => 
        t.template_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        t.metadata?.template_type !== "conditional"
    );

    const handleSaveAsTemplate = async () => {
        if (!newTemplateName.trim()) {
            toast.error("Please enter a template name");
            return;
        }
        if (!currentContent.trim()) {
            toast.error("Template content cannot be empty");
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch("/api/executive-summary/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    template_name: newTemplateName,
                    section_id: sectionId,
                    content: currentContent,
                    client_name: projectContext.client || "",
                    metadata: { template_type: "standard" }
                })
            });

            if (!res.ok) throw new Error("Failed to save template");

            toast.success("Template saved successfully");
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
            mutate(`/api/executive-summary/templates?section_id=${sectionId}`);
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const injectVariables = (content: string) => {
        let text = content;
        
        const getTodayShort = () => {
            const d = new Date();
            const day = String(d.getDate()).padStart(2, '0');
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
        };

        const clientName = projectContext.client || "[CLIENT]";
        const clientShort = projectContext.clientShort || "[CLIENT_SHORT]";
        const contractorName = projectContext.contractor || "[CONTRACTOR]";
        const contractorShort = projectContext.contractor || "[CONTRACTOR_SHORT]";
        const fieldName = projectContext.fieldName || "[FIELD_NAME]";
        
        const vars: Record<string, string> = {
            "{{PLATFORM}}": projectContext.platform || "[PLATFORM]",
            "{{PLATFORM_TITLE}}": projectContext.platform || "[PLATFORM]",
            "{{PLATFORM_NAME}}": projectContext.platform || "[PLATFORM]",
            "{{JOB_PACK}}": projectContext.jobpack || "[JOB_PACK]",
            "{{JOB_PACK_NAME}}": projectContext.jobpack || "[JOB_PACK]",
            "{{REPORT_NO}}": projectContext.reportNo || "[REPORT_NO]",
            "{{SOW_REPORT_NO}}": projectContext.reportNo || "[REPORT_NO]",
            "{{CLIENT}}": clientName,
            "{{CLIENT_NAME}}": clientName,
            "{{CLIENT_NAME_UPPER}}": clientName.toUpperCase(),
            "{{CLIENT_SHORT}}": clientShort,
            "{{CLIENT_SHORT_UPPER}}": clientShort.toUpperCase(),
            "{{FIELD_NAME}}": fieldName,
            "{{OIL_FIELD}}": fieldName,
            "{{OIL_FIELD_NAME}}": fieldName,
            "{{CONTRACTOR}}": contractorName,
            "{{CONTRACTOR_NAME}}": contractorName,
            "{{CONTRACTOR_NAME_UPPER}}": contractorName.toUpperCase(),
            "{{CONTRACTOR_SHORT}}": contractorShort,
            "{{CONTRACTOR_SHORT_UPPER}}": contractorShort.toUpperCase(),
            "{{VESSEL_NAME}}": projectContext.vessel || "NONE",
            "{{START_DATE}}": projectContext.startDate || "[START_DATE]",
            "{{INSP_START_DATE}}": projectContext.startDate || "[INSP_START_DATE]",
            "{{END_DATE}}": projectContext.endDate || "[END_DATE]",
            "{{INSP_END_DATE}}": projectContext.endDate || "[INSP_END_DATE]",
            "{{DATE}}": new Date().toLocaleDateString("en-GB"),
            "{{TODAY_SHORT}}": getTodayShort()
        };

        Object.entries(vars).forEach(([key, val]) => {
            text = text.replaceAll(key, val);
            text = text.replaceAll(key.toLowerCase(), val);
        });

        return text;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl bg-white dark:bg-slate-950 p-0 overflow-hidden flex flex-col h-[650px] rounded-3xl border-none shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200">
                <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-extrabold tracking-tight">Content Templates Manager</DialogTitle>
                            <DialogDescription className="text-slate-400 text-xs">
                                Configure standard and conditional summaries for <strong>{sectionTitle}</strong>
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-grow flex flex-col min-h-0">
                    <div className="px-6 border-b bg-white dark:bg-slate-950 shrink-0">
                        <TabsList className="flex gap-2 bg-transparent justify-start h-12 p-0 border-b-0">
                            <TabsTrigger value="standard" className="h-10 text-xs font-bold uppercase tracking-wider border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4">
                                Standard Formats
                            </TabsTrigger>
                            <TabsTrigger value="conditional" className="h-10 text-xs font-bold uppercase tracking-wider border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4">
                                Conditional Rules (Auto-Gen)
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Standard Templates Content */}
                    <TabsContent value="standard" className="flex-1 data-[state=active]:flex flex-col min-h-0 m-0">
                        <div className="flex-grow flex min-h-0 bg-slate-50/50 dark:bg-slate-900/20">
                            {/* Left Side: Create/Edit Form */}
                            <div className="flex-1 p-6 border-r space-y-6 overflow-y-auto max-w-xl">
                                <div className="space-y-3 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/20 dark:bg-blue-900/10">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-widest">
                                            {editingTemplateId ? "Edit Stored Template" : "Save Current as New Template"}
                                        </Label>
                                        {editingTemplateId && (
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-5 text-[9px] font-bold text-slate-500 hover:text-slate-700 p-0"
                                                onClick={() => {
                                                    setEditingTemplateId(null);
                                                    setNewTemplateName("");
                                                    setEditContent("");
                                                }}
                                            >
                                                Cancel Edit
                                            </Button>
                                        )}
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <Label className="text-[9px] font-bold text-slate-400 uppercase">Template Name</Label>
                                            <Input 
                                                placeholder="e.g. Detailed Inspection Summary..." 
                                                value={newTemplateName}
                                                onChange={(e) => setNewTemplateName(e.target.value)}
                                                className="h-9 bg-white dark:bg-slate-900"
                                            />
                                        </div>
                                        
                                        <div className="space-y-1.5">
                                            <Label className="text-[9px] font-bold text-slate-400 uppercase">AI Templates Recommendations Wording</Label>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-1 h-9 text-[10px] bg-white hover:bg-slate-50 dark:bg-slate-900 border-blue-200 text-blue-700 font-bold"
                                                    onClick={() => {
                                                        const sec = sectionId.toLowerCase();
                                                        let aiWording = "";
                                                        if (sec === "intro") {
                                                            aiWording = "This Executive Summary report presents the comprehensive findings from the subsea structural integrity GVI, CP, and FMD surveys executed for {{PLATFORM}} during the SOW {{REPORT_NO}} program. All marine operations were conducted aboard {{VESSEL_NAME}} under Job Pack {{JOB_PACK}}.";
                                                        } else if (sec === "cp") {
                                                            aiWording = "Cathodic Potential (CP) measurements were acquired across scheduled structural elevations on {{PLATFORM}}. Readings ranged from a minimum of {{CP_MIN}} to a maximum of {{CP_MAX}}, indicating that cathodic protection levels remain fully active and within standard design tolerances.";
                                                        } else if (sec === "fmd") {
                                                            aiWording = "Flooded Member Detection (FMD) checks were performed on all critical structural members of {{PLATFORM}}. All tested members returned dry readings, indicating no active seawater ingress or member flooding defects.";
                                                        } else if (sec === "mgi") {
                                                            aiWording = "Marine Growth Inspection (MGI) was conducted to measure bio-fouling thickness on {{PLATFORM}}. Thickness ranges from {{MGI_MIN}} to {{MGI_MAX}} (average: {{MGI_AVG}}), with a total of {{MGI_ANOMALIES}} anomalies noted due to localized heavy growth.";
                                                        } else {
                                                            aiWording = "The structural GVI inspection on {{PLATFORM}} was successfully completed under SOW {{REPORT_NO}}. A total of {{TOTAL_ANOMALIES}} anomalies are active, and {{OPEN_ANOMALIES}} remain open for review.";
                                                        }
                                                        if (editingTemplateId) {
                                                            setEditContent(aiWording);
                                                        } else {
                                                            setEditContent(aiWording);
                                                            toast.info("AI Detailed format loaded. You can tweak it below.");
                                                        }
                                                    }}
                                                >
                                                    Detailed Format
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-1 h-9 text-[10px] bg-white hover:bg-slate-50 dark:bg-slate-900 border-blue-200 text-blue-700 font-bold"
                                                    onClick={() => {
                                                        const sec = sectionId.toLowerCase();
                                                        let aiWording = "";
                                                        if (sec === "intro") {
                                                            aiWording = "Inspection services were successfully completed for {{PLATFORM}} under contract {{CLIENT}}. Marine activities were fully executed aboard {{VESSEL_NAME}} on {{DATE}} in strict compliance with Job Pack {{JOB_PACK}} SOW.";
                                                        } else if (sec === "cp") {
                                                            aiWording = "CP data log verification completed. Minimum potentials checked at {{CP_MIN}} and maximum at {{CP_MAX}} on {{PLATFORM}}. Results confirm structural polarization is stable.";
                                                        } else if (sec === "fmd") {
                                                            aiWording = "FMD survey operations completed. Active checks confirm all member integrity is preserved without flooded members or structural compromises.";
                                                        } else {
                                                            aiWording = "Verified scope completion on {{PLATFORM}}. Structural GVI and visual inspection records confirm compliance under Job Pack {{JOB_PACK}}.";
                                                        }
                                                        if (editingTemplateId) {
                                                            setEditContent(aiWording);
                                                        } else {
                                                            setEditContent(aiWording);
                                                            toast.info("AI Executive format loaded. You can tweak it below.");
                                                        }
                                                    }}
                                                >
                                                    Executive Format
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-[9px] font-bold text-slate-400 uppercase">Template Content (Use variables like {"{{PLATFORM}}"}, {"{{VESSEL_NAME}}"})</Label>
                                        <textarea
                                            placeholder="Write template contents..."
                                            value={editingTemplateId ? editContent : (editContent || currentContent)}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            className="w-full h-24 p-2 text-xs border rounded-lg bg-white dark:bg-slate-900 resize-none focus-visible:ring-blue-500 focus-visible:outline-none"
                                        />
                                    </div>

                                    <Button 
                                        onClick={async () => {
                                            if (!newTemplateName.trim()) {
                                                toast.error("Please enter a template name");
                                                return;
                                            }
                                            const contentToSave = editingTemplateId ? editContent : (editContent || currentContent);
                                            if (!contentToSave.trim()) {
                                                toast.error("Template content cannot be empty");
                                                return;
                                            }

                                            setIsSaving(true);
                                            try {
                                                let res;
                                                if (editingTemplateId) {
                                                    res = await fetch("/api/executive-summary/templates", {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({
                                                            template_name: newTemplateName,
                                                            section_id: sectionId,
                                                            content: contentToSave,
                                                            client_name: projectContext.client || "",
                                                            metadata: { template_type: "standard", id: editingTemplateId }
                                                        })
                                                    });
                                                } else {
                                                    res = await fetch("/api/executive-summary/templates", {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({
                                                            template_name: newTemplateName,
                                                            section_id: sectionId,
                                                            content: contentToSave,
                                                            client_name: projectContext.client || "",
                                                            metadata: { template_type: "standard" }
                                                        })
                                                    });
                                                }

                                                if (!res.ok) throw new Error("Failed to save template");

                                                toast.success(editingTemplateId ? "Template updated successfully" : "Template saved successfully");
                                                setNewTemplateName("");
                                                setEditContent("");
                                                setEditingTemplateId(null);
                                                mutate(`/api/executive-summary/templates?section_id=${sectionId}`);
                                            } catch (error: any) {
                                                toast.error(error.message);
                                            } finally {
                                                setIsSaving(false);
                                            }
                                        }} 
                                        disabled={isSaving}
                                        className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white gap-2 font-bold"
                                    >
                                        <Save className="w-4 h-4" /> {editingTemplateId ? "Update Template" : "Save As Template"}
                                    </Button>
                                </div>
                            </div>

                            {/* Right Side: Saved Templates Sidebar */}
                            <aside className="w-[420px] flex flex-col min-h-0 bg-white dark:bg-slate-950 border-l border-slate-100 dark:border-slate-800">
                                <div className="p-4 border-b space-y-3 shrink-0">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                        <Input 
                                            placeholder="Search templates..." 
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9 h-9"
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {isLoading ? (
                                        <div className="flex items-center justify-center py-20 text-slate-500 text-xs">Loading templates...</div>
                                    ) : filteredTemplates.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2 text-center">
                                            <FileText className="w-8 h-8 opacity-20" />
                                            <p className="text-xs font-semibold">No templates found for this section</p>
                                        </div>
                                    ) : (
                                        filteredTemplates.map((t: any) => (
                                            <div 
                                                key={t.id}
                                                className="group p-3 rounded-xl border bg-slate-50/50 dark:bg-slate-900/10 hover:border-blue-500 dark:hover:border-blue-500 transition-all shadow-sm flex flex-col gap-2"
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                                            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate max-w-[180px]">{t.template_name}</h4>
                                                            {t.client_name && (
                                                                <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter h-4 px-1">{t.client_name}</Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-6 w-6 text-blue-600 hover:text-blue-700"
                                                            onClick={() => {
                                                                setEditingTemplateId(t.id);
                                                                setNewTemplateName(t.template_name);
                                                                setEditContent(t.content);
                                                            }}
                                                        >
                                                            <Copy className="w-3 h-3" />
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-6 w-6 text-red-500 hover:text-red-650 hover:bg-red-50"
                                                            onClick={() => handleDelete(t.id)}
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <p className="text-[11px] text-slate-500 line-clamp-3 bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800 italic">
                                                    {t.content}
                                                </p>
                                                <Button 
                                                    variant="secondary" 
                                                    size="sm" 
                                                    className="w-full h-7 text-[10px] font-bold uppercase tracking-wider gap-1.5 bg-white dark:bg-slate-900 hover:bg-blue-600 hover:text-white border"
                                                    onClick={() => {
                                                        const injected = injectVariables(t.content);
                                                        onSelect(injected);
                                                        toast.success("Template applied with variables");
                                                        onOpenChange(false);
                                                    }}
                                                >
                                                    <Copy className="w-3 h-3" /> Load Template
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </aside>
                        </div>

                        <DialogFooter className="p-4 bg-white dark:bg-slate-950 border-t flex items-center justify-between shrink-0">
                            <div className="text-[10px] text-slate-400 font-medium">
                                Supported Variables: <code className="text-blue-500">{"{{PLATFORM}}"}</code>, <code className="text-blue-500">{"{{CLIENT_NAME}}"}</code>, <code className="text-blue-500">{"{{CLIENT_SHORT}}"}</code>, <code className="text-blue-500">{"{{CONTRACTOR_NAME}}"}</code>, <code className="text-blue-500">{"{{OIL_FIELD}}"}</code>, <code className="text-blue-500">{"{{START_DATE}}"}</code>, <code className="text-blue-500">{"{{END_DATE}}"}</code>, <code className="text-blue-500">{"{{TODAY_SHORT}}"}</code>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-[11px] font-bold uppercase">Close</Button>
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
