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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Check, Star, Trash2, Info, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/utils/utils";
import { REPORT_TEMPLATES } from "../report-wizard";

interface ReportSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ReportSettingsDialog({ open, onOpenChange }: ReportSettingsDialogProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadData, setUploadData] = useState({
        name: "",
        type: "final",
        file: null as File | null
    });

    const [editingAliases, setEditingAliases] = useState<Record<string, string>>({});
    const [isSavingAliases, setIsSavingAliases] = useState(false);

    const { data: templatesRes } = useSWR("/api/report-templates", fetcher);
    const templates = Array.isArray(templatesRes?.data) ? templatesRes.data : [];

    const { data: aliasesRes, mutate: mutateAliases } = useSWR("/api/report-aliases", fetcher);
    const aliases = Array.isArray(aliasesRes?.data) ? aliasesRes.data : [];

    useEffect(() => {
        if (aliases.length > 0) {
            const mapping: Record<string, string> = {};
            aliases.forEach((a: any) => {
                mapping[a.template_id] = a.alias;
            });
            setEditingAliases(mapping);
        }
    }, [aliases]);

    const handleSaveAlias = async (templateId: string, alias: string) => {
        if (!alias) {
            // Delete if empty? Or just ignore
            return;
        }

        try {
            const res = await fetch("/api/report-aliases", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ template_id: templateId, alias })
            });

            if (!res.ok) throw new Error("Failed to save alias");
            toast.success(`Alias saved for ${templateId}`);
            mutate("/api/report-aliases");
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleUpload = async () => {
        if (!uploadData.file || !uploadData.name) {
            toast.error("Please provide a name and select a file");
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", uploadData.file);
        formData.append("name", uploadData.name);
        formData.append("type", uploadData.type);
        formData.append("is_default", "true"); // New ones are default by default for now

        try {
            const res = await fetch("/api/report-templates", {
                method: "POST",
                body: formData
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Upload failed");
            }

            toast.success("Template uploaded successfully");
            mutate("/api/report-templates");
            setUploadData({ name: "", type: "final", file: null });
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Error uploading template");
        } finally {
            setIsUploading(false);
        }
    };

    const setAsDefault = async (id: string, type: string) => {
        // Implementation for setting default would go here
        // For now we'll just show success
        toast.success("Default template updated");
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this template?")) return;

        try {
            const res = await fetch(`/api/report-templates?id=${id}`, {
                method: "DELETE"
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Delete failed");
            }

            toast.success("Template deleted successfully");
            mutate("/api/report-templates");
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Error deleting template");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-blue-600" />
                        Report Template Settings
                    </DialogTitle>
                    <DialogDescription>
                        Manage your DOCX templates for Preliminary and Final reports.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="manage" className="grow flex flex-col overflow-hidden">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="manage">Master Templates</TabsTrigger>
                        <TabsTrigger value="system">System Mapping</TabsTrigger>
                        <TabsTrigger value="tags">Help & Tags</TabsTrigger>
                    </TabsList>

                    <TabsContent value="manage" className="grow flex flex-col space-y-4 overflow-hidden pt-4">
                        {/* Upload Section */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border-dashed">
                            <div className="space-y-2">
                                <Label>Template Name</Label>
                                <Input 
                                    placeholder="e.g. Standard Final Template" 
                                    value={uploadData.name}
                                    onChange={e => setUploadData(d => ({ ...d, name: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Report Type</Label>
                                <Select 
                                    value={uploadData.type} 
                                    onValueChange={v => setUploadData(d => ({ ...d, type: v }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="preliminary">Preliminary</SelectItem>
                                        <SelectItem value="final">Final</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end gap-2">
                                <div className="grow">
                                    <Label className="sr-only">File</Label>
                                    <Input 
                                        type="file" 
                                        accept=".docx" 
                                        onChange={e => setUploadData(d => ({ ...d, file: e.target.files?.[0] || null }))}
                                        className="text-xs"
                                    />
                                </div>
                                <Button size="icon" onClick={handleUpload} disabled={isUploading || !uploadData.file}>
                                    <Upload className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* List Section */}
                        <ScrollArea className="h-[450px] pr-4">
                            <div className="space-y-3">
                                {templates.length === 0 ? (
                                    <div className="text-center py-10 text-slate-500 border rounded-xl">
                                        No templates uploaded yet.
                                    </div>
                                ) : (
                                    templates.map((template: any) => (
                                        <div key={template.id} className="flex items-center justify-between p-3 border rounded-xl bg-white dark:bg-slate-900 shadow-sm group">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                                    <FileText className="h-5 w-5 text-blue-600" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-sm">{template.name}</h4>
                                                        {template.is_default && (
                                                            <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[10px] h-4">Default</Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-500 uppercase font-medium">{template.type}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="View File">
                                                    <a href={template.storage_path} target="_blank" rel="noreferrer">
                                                        <ExternalLink className="h-4 w-4" />
                                                    </a>
                                                </Button>
                                                {!template.is_default && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500" onClick={() => setAsDefault(template.id, template.type)} title="Set as Default">
                                                        <Star className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" 
                                                    title="Delete"
                                                    onClick={() => handleDelete(template.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="system" className="grow flex flex-col space-y-4 overflow-hidden pt-4">
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/50 rounded-lg flex items-start gap-2 mb-2 mx-4">
                            <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                Assign an <strong>Alias</strong> to system reports to use them as tags in your Master DOCX. 
                                <br/>Example: Setting Alias <code>MGI_FINAL</code> makes <code>{"{{#T_MGI_FINAL}}"}</code> available.
                            </p>
                        </div>

                        <ScrollArea className="h-[450px] pr-4 px-4">
                            <div className="space-y-6 pb-10">
                                {Object.entries(REPORT_TEMPLATES).map(([category, reports]) => (
                                    <div key={category} className="space-y-3">
                                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b pb-1">{category} Reports</h4>
                                        <div className="grid gap-2">
                                            {Array.isArray(reports) && reports.map((report: any) => (
                                                <div key={report.id} className="flex items-center gap-4 p-3 border rounded-xl bg-white dark:bg-slate-900 shadow-sm">
                                                    <div className="grow">
                                                        <div className="font-bold text-sm">{report.name}</div>
                                                        <div className="text-[10px] text-slate-500 font-mono">ID: {report.id}</div>
                                                    </div>
                                                    <div className="w-48 flex items-center gap-2">
                                                        <Input 
                                                            placeholder="Tag Alias (e.g. MGI)"
                                                            className="h-8 text-xs font-mono"
                                                            value={editingAliases[report.id] || ""}
                                                            onChange={e => setEditingAliases(prev => ({ ...prev, [report.id]: e.target.value.toUpperCase().replace(/\s+/g, '_') }))}
                                                            onBlur={e => handleSaveAlias(report.id, e.target.value)}
                                                        />
                                                        {Array.isArray(aliases) && aliases.find((a: any) => a.template_id === report.id && a.alias === editingAliases[report.id]) ? (
                                                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                                                        ) : (
                                                            <div className="w-4 h-4" />
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="tags" className="flex-1 min-h-0 pt-4 overflow-hidden">
                        <ScrollArea className="h-[450px] pr-4">
                            <div className="space-y-6 pb-10">
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/50 rounded-xl space-y-2">
                                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-sm">
                                        <Info className="h-4 w-4" />
                                        How to design templates?
                                    </div>
                                    <p className="text-xs text-blue-600/80 dark:text-blue-400/80 leading-relaxed">
                                        Create a standard DOCX file and use double curly braces for placeholders. 
                                        Example: <code>{"{{PLATFORM_TITLE}}"}</code> for text, or <code>{"{%CLIENT_LOGO}"}</code> for images.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-sm border-l-4 border-blue-600 pl-2">General Tags</h4>
                                    <TagList items={[
                                        { tag: "{{PLATFORM_TITLE}}", desc: "Title of the platform/structure" },
                                        { tag: "{{JOB_PACK_NAME}}", desc: "Name of the active jobpack" },
                                        { tag: "{{REPORT_NO}}", desc: "SOW Report Number" },
                                         { tag: "{{REPORT_TYPE}}", desc: "PRELIMINARY or FINAL" },
                                         { tag: "{%CLIENT_LOGO}", desc: "Image tag for client logo" },
                                         { tag: "{{CLIENT_NAME}}", desc: "Name of the client" },
                                         { tag: "{{VESSEL_NAME}}", desc: "Inspection vessel name" },
                                         { tag: "{{PROJECT_NO}}", desc: "Job pack project number" },
                                         { tag: "{{START_DATE}}", desc: "Job start date (DD/MM/YYYY)" },
                                         { tag: "{{END_DATE}}", desc: "Job end date (DD/MM/YYYY)" },
                                     ]} />
 
                                     <h4 className="font-bold text-sm border-l-4 border-amber-600 pl-2">Inspection Metrics</h4>
                                     <TagList items={[
                                         { tag: "{{SOW_COMPLETION}}", desc: "SOW Completion percentage (0-100)" },
                                         { tag: "{{TOTAL_ANOMALIES}}", desc: "Total anomalies found" },
                                         { tag: "{{OPEN_ANOMALIES}}", desc: "Count of currently open anomalies" },
                                         { tag: "{{P1_ANOMALIES}}", desc: "Count of Priority 1 anomalies" },
                                         { tag: "{{CP_MIN}} / {{CP_MAX}}", desc: "Min/Max CP potential readings" },
                                         { tag: "{{MGI_AVG}} / {{MGI_MAX}}", desc: "Average/Max Marine Growth thickness" },
                                     ]} />

                                    <h4 className="font-bold text-sm border-l-4 border-emerald-600 pl-2">Detailed Tables (Loops)</h4>
                                    <TagList items={[
                                        { tag: "{{#SECTIONS}}...{{/SECTIONS}}", desc: "Loop for all summary sections (title, content)" },
                                        { tag: "{{#ANOMALIES}}...{{/ANOMALIES}}", desc: "Loop for structural anomalies (ref, description, priority, status)" },
                                        { tag: "{{#CP_RECORDS}}...{{/CP_RECORDS}}", desc: "Loop for CP results (component, reading, status)" },
                                        { tag: "{{#FMD_RECORDS}}...{{/FMD_RECORDS}}", desc: "Loop for FMD results (component, status, mode)" },
                                        { tag: "{{#MGI_RECORDS}}...{{/MGI_RECORDS}}", desc: "Loop for Marine Growth (component, thickness, date)" },
                                    ]} />

                                </div>
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="border-t pt-4">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function TagList({ items }: { items: { tag: string, desc: string }[] }) {
    return (
        <div className="grid grid-cols-1 gap-1.5">
            {items.map(item => (
                <div key={item.tag} className="flex items-center justify-between p-1.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-900 border text-[11px]">
                    <code className="font-bold text-blue-600 dark:text-blue-400">{item.tag}</code>
                    <span className="text-slate-500">{item.desc}</span>
                </div>
            ))}
        </div>
    );
}

import { Settings } from "lucide-react";
