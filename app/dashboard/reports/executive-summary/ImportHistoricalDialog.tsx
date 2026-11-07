"use client";

import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Calendar, FileText, ArrowRight, CheckCircle2, Copy } from "lucide-react";
import { format } from "date-fns";

interface HistoricalRecord {
    id: number | string;
    jobpack_id?: number | string;
    structure_id?: number | string;
    sow_report_no: string;
    updated_at: string;
    sections_count?: number;
    sections?: any;
    metadata?: any;
}

interface ImportHistoricalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    records: HistoricalRecord[];
    currentSectionId: string;
    currentSectionTitle?: string;
    currentSowReportNo?: string;
    onImportAll: (record: HistoricalRecord) => void;
    onImportSection: (record: HistoricalRecord, sectionId: string) => void;
}

export function ImportHistoricalDialog({
    open,
    onOpenChange,
    records = [],
    currentSectionId,
    currentSectionTitle = "",
    currentSowReportNo = "",
    onImportAll,
    onImportSection,
}: ImportHistoricalDialogProps) {
    if (!open) return null;
    const [selectedRecordId, setSelectedRecordId] = useState<number | string | null>(null);

    const selectedRecord = records.find(r => r.id === selectedRecordId) || records[0];

    // Helper to get section content from record
    const getSectionContent = (rec: HistoricalRecord, secId: string): string => {
        if (!rec?.sections) return "";
        let parsed = rec.sections;
        if (typeof parsed === "string") {
            try { parsed = JSON.parse(parsed); } catch {}
        }
        if (Array.isArray(parsed)) {
            const found = parsed.find((s: any) => s && s.id === secId);
            return found?.content || found?.findings || found?.text || "";
        }
        if (parsed && typeof parsed === "object") {
            const val = parsed[secId];
            return typeof val === "string" ? val : val?.content || val?.text || "";
        }
        return "";
    };

    const previewContent = selectedRecord ? getSectionContent(selectedRecord, currentSectionId) : "";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-6">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <History className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold">Import Previous Executive Summary Data</DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                Select a previously saved or migrated executive summary to import its findings into your current report.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {records.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                        <FileText className="h-10 w-10 text-muted-foreground/40" />
                        <div>
                            <h4 className="font-semibold text-sm">No Previous Saved Records Found</h4>
                            <p className="text-xs text-muted-foreground max-w-sm mt-1">
                                No earlier executive summary records were found in the database for this structure.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 my-2 grow overflow-hidden">
                        {/* Left: Records list */}
                        <div className="md:col-span-5 border rounded-xl overflow-hidden flex flex-col bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="p-2.5 border-b bg-muted/40 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                                Saved Versions ({records.length})
                            </div>
                            <ScrollArea className="grow max-h-[360px]">
                                <div className="p-2 space-y-1.5">
                                    {records.map((rec) => {
                                        const isSelected = (selectedRecord?.id === rec.id);
                                        const isCurrent = rec.sow_report_no === currentSowReportNo;
                                        let dateLabel = rec.updated_at;
                                        try {
                                            dateLabel = format(new Date(rec.updated_at), "dd MMM yyyy, HH:mm");
                                        } catch {}

                                        return (
                                            <div
                                                key={rec.id}
                                                onClick={() => setSelectedRecordId(rec.id)}
                                                className={`
                                                    p-2.5 rounded-lg border text-xs cursor-pointer transition-all
                                                    ${isSelected 
                                                        ? "bg-white dark:bg-slate-800 border-indigo-500 shadow-sm ring-1 ring-indigo-500/30" 
                                                        : "bg-white dark:bg-slate-900 border-border hover:bg-slate-100 dark:hover:bg-slate-800/60"}
                                                `}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                                                        SOW: {rec.sow_report_no || "Unnamed"}
                                                    </span>
                                                    {isCurrent && (
                                                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950/60 border-blue-200">
                                                            Current SOW
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                                                    <Calendar className="h-3 w-3" />
                                                    <span>{dateLabel}</span>
                                                </div>
                                                {rec.sections_count !== undefined && (
                                                    <div className="mt-1 text-[11px] text-slate-500 font-medium">
                                                        {rec.sections_count} section{rec.sections_count === 1 ? "" : "s"} populated
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        </div>

                        {/* Right: Section preview */}
                        <div className="md:col-span-7 border rounded-xl overflow-hidden flex flex-col bg-white dark:bg-slate-950">
                            <div className="p-2.5 border-b bg-muted/40 flex items-center justify-between text-xs">
                                <span className="font-semibold text-muted-foreground uppercase tracking-wider">
                                    Preview: {currentSectionTitle || currentSectionId}
                                </span>
                                <Badge variant="secondary" className="text-[10px]">
                                    SOW {selectedRecord?.sow_report_no || "N/A"}
                                </Badge>
                            </div>

                            <ScrollArea className="grow p-4 max-h-[300px]">
                                {previewContent ? (
                                    <div 
                                        className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                                        dangerouslySetInnerHTML={{ __html: previewContent }}
                                    />
                                ) : (
                                    <div className="py-8 text-center text-xs text-muted-foreground">
                                        No text saved in this version for section &ldquo;{currentSectionTitle || currentSectionId}&rdquo;.
                                    </div>
                                )}
                            </ScrollArea>

                            {selectedRecord && (
                                <div className="p-3 border-t bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={!previewContent}
                                        onClick={() => selectedRecord && onImportSection(selectedRecord, currentSectionId)}
                                        className="text-xs gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800"
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                        Import Current Section Only
                                    </Button>

                                    <Button
                                        size="sm"
                                        onClick={() => selectedRecord && onImportAll(selectedRecord)}
                                        className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm"
                                    >
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Import All Sections
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <DialogFooter className="mt-2 flex items-center justify-end">
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

