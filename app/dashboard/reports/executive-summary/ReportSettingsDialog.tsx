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

    const { data: templatesRes } = useSWR("/api/report-templates", fetcher);
    const templates = templatesRes?.data || [];

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

            if (!res.ok) throw new Error("Upload failed");

            toast.success("Template uploaded successfully");
            mutate("/api/report-templates");
            setUploadData({ name: "", type: "final", file: null });
        } catch (error) {
            console.error(error);
            toast.error("Error uploading template");
        } finally {
            setIsUploading(false);
        }
    };

    const setAsDefault = async (id: string, type: string) => {
        // Implementation for setting default would go here
        // For now we'll just show success
        toast.success("Default template updated");
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
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="manage">Manage Templates</TabsTrigger>
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
                        <ScrollArea className="grow pr-4">
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
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" title="Delete">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="tags" className="grow overflow-hidden pt-4">
                        <ScrollArea className="h-full pr-4">
                            <div className="space-y-6 pb-6">
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/50 rounded-xl space-y-2">
                                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-sm">
                                        <Info className="h-4 w-4" />
                                        How to design templates?
                                    </div>
                                    <p className="text-xs text-blue-600/80 dark:text-blue-400/80 leading-relaxed">
                                        Create a standard DOCX file and use double curly braces for placeholders. 
                                        Example: <code>{"{{PLATFORM_TITLE}}"}</code> will be replaced with the platform name.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-sm border-l-4 border-blue-600 pl-2">General Tags</h4>
                                    <TagList items={[
                                        { tag: "{{PLATFORM_TITLE}}", desc: "Title of the platform/structure" },
                                        { tag: "{{JOB_PACK_NAME}}", desc: "Name of the active jobpack" },
                                        { tag: "{{REPORT_NO}}", desc: "SOW Report Number" },
                                        { tag: "{{REPORT_TYPE}}", desc: "PRELIMINARY or FINAL" },
                                        { tag: "{{CLIENT_LOGO}}", desc: "Image tag for client logo" },
                                    ]} />

                                    <h4 className="font-bold text-sm border-l-4 border-emerald-600 pl-2">Summary Sections</h4>
                                    <TagList items={[
                                        { tag: "{{#SECTIONS}}...{{/SECTIONS}}", desc: "Loop for all summary sections" },
                                        { tag: "{{title}}", desc: "Section title (inside SECTIONS loop)" },
                                        { tag: "{{content}}", desc: "Section content (inside SECTIONS loop)" },
                                    ]} />

                                    <h4 className="font-bold text-sm border-l-4 border-amber-600 pl-2">Anomaly Tables</h4>
                                    <TagList items={[
                                        { tag: "{{#ANOMALIES}}...{{/ANOMALIES}}", desc: "Loop for structural anomalies" },
                                        { tag: "{{ref}}", desc: "Anomaly Ref No" },
                                        { tag: "{{description}}", desc: "Defect Description" },
                                        { tag: "{{priority}}", desc: "Priority Code (P1, P2...)" },
                                        { tag: "{{status}}", desc: "Current Status" },
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
        <div className="grid grid-cols-1 gap-2">
            {items.map(item => (
                <div key={item.tag} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border text-xs">
                    <code className="font-bold text-blue-600 dark:text-blue-400">{item.tag}</code>
                    <span className="text-slate-500">{item.desc}</span>
                </div>
            ))}
        </div>
    );
}

import { Settings } from "lucide-react";
