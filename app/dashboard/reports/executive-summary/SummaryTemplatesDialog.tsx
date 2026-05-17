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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
    FileText, 
    Plus, 
    Trash2, 
    Copy, 
    Search,
    BookOpen,
    Save
} from "lucide-react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/utils/utils";

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
    };
}

export function SummaryTemplatesDialog({
    open,
    onOpenChange,
    sectionId,
    sectionTitle,
    currentContent,
    onSelect,
    projectContext
}: SummaryTemplatesDialogProps) {
    const { data: templatesRes, isLoading } = useSWR(
        open ? `/api/executive-summary/templates?section_id=${sectionId}` : null,
        fetcher
    );
    const templates = templatesRes?.data || [];

    const [isSaving, setIsSaving] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    const filteredTemplates = templates.filter((t: any) => 
        t.template_name.toLowerCase().includes(searchQuery.toLowerCase())
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
                    client_name: projectContext.client || ""
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
        const vars: Record<string, string> = {
            "{{PLATFORM}}": projectContext.platform || "[PLATFORM]",
            "{{JOB_PACK}}": projectContext.jobpack || "[JOB_PACK]",
            "{{REPORT_NO}}": projectContext.reportNo || "[REPORT_NO]",
            "{{CLIENT}}": projectContext.client || "[CLIENT]",
            "{{DATE}}": new Date().toLocaleDateString("en-GB")
        };

        Object.entries(vars).forEach(([key, val]) => {
            text = text.replaceAll(key, val);
        });

        return text;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl bg-white dark:bg-slate-950 p-0 overflow-hidden flex flex-col h-[600px]">
                <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold">Content Templates</DialogTitle>
                            <DialogDescription className="text-slate-400">
                                Reuse standard messages for <strong>{sectionTitle}</strong>
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-900/20">
                    <div className="p-4 border-b space-y-4 bg-white dark:bg-slate-950">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input 
                                    placeholder="Search templates..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        <div className="flex items-end gap-3 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30 bg-blue-50/20 dark:bg-blue-900/10">
                            <div className="flex-1 space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-widest">Save Current as New Template</Label>
                                <Input 
                                    placeholder="Enter template name..." 
                                    value={newTemplateName}
                                    onChange={(e) => setNewTemplateName(e.target.value)}
                                    className="h-9 bg-white dark:bg-slate-900"
                                />
                            </div>
                            <Button 
                                onClick={handleSaveAsTemplate} 
                                disabled={isSaving || !currentContent}
                                className="h-9 bg-blue-600 hover:bg-blue-700 text-white gap-2"
                            >
                                <Save className="w-4 h-4" /> Save
                            </Button>
                        </div>
                    </div>

                    <ScrollArea className="flex-1 p-4">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-20 text-slate-500">Loading templates...</div>
                        ) : filteredTemplates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
                                <FileText className="w-10 h-10 opacity-20" />
                                <p className="text-sm font-medium">No templates found for this section</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {filteredTemplates.map((t: any) => (
                                    <div 
                                        key={t.id}
                                        className="group p-4 rounded-xl border bg-white dark:bg-slate-950 hover:border-blue-500 dark:hover:border-blue-500 transition-all shadow-sm"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-blue-500" />
                                                <h4 className="font-bold text-slate-800 dark:text-slate-200">{t.template_name}</h4>
                                                {t.client_name && (
                                                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter h-4 px-1.5">{t.client_name}</Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => handleDelete(t.id)}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 line-clamp-2 mb-3 bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-800 italic">
                                            {t.content}
                                        </p>
                                        <Button 
                                            variant="secondary" 
                                            size="sm" 
                                            className="w-full h-8 text-[11px] font-bold uppercase tracking-wider gap-2 bg-slate-100 dark:bg-slate-900 hover:bg-blue-600 hover:text-white"
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
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <DialogFooter className="p-4 bg-white dark:bg-slate-950 border-t flex items-center justify-between">
                    <div className="text-[10px] text-slate-400 font-medium">
                        Supported Variables: <code className="text-blue-500">{"{{PLATFORM}}"}</code>, <code className="text-blue-500">{"{{JOB_PACK}}"}</code>, <code className="text-blue-500">{"{{REPORT_NO}}"}</code>, <code className="text-blue-500">{"{{DATE}}"}</code>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-[11px] font-bold uppercase">Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
