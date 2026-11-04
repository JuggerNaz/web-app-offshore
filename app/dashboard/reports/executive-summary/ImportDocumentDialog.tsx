"use client";

import React, { useState, useRef, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { 
    FileUp, 
    FileText, 
    CheckCircle2, 
    AlertCircle, 
    ArrowRight, 
    RefreshCw, 
    Upload, 
    Layers, 
    Search, 
    Sparkles, 
    Table as TableIcon,
    Edit3,
    Eye,
    X,
    Filter,
    HelpCircle
} from "lucide-react";
import { toast } from "sonner";
import { EXECUTIVE_SUMMARY_TOC } from "./constants";

interface DetectedSection {
    sectionId: string;
    sectionTitle: string;
    matchedHeading: string;
    confidence: number;
    extractedHtml: string;
    rawText: string;
    blockCount: number;
    hasTable: boolean;
}

interface ImportDocumentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentSectionsData: Record<string, string>;
    onApplyToSummary: (newSections: Record<string, string>, count: number) => void;
}

type SectionImportAction = "replace" | "append" | "skip";

export function ImportDocumentDialog({
    open,
    onOpenChange,
    currentSectionsData = {},
    onApplyToSummary
}: ImportDocumentDialogProps) {
    // File upload state
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number; type: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Detected sections from backend
    const [detectedSections, setDetectedSections] = useState<Record<string, DetectedSection>>({});
    
    // Per-section action map: { [sectionId]: "replace" | "append" | "skip" }
    const [sectionActions, setSectionActions] = useState<Record<string, SectionImportAction>>({});
    
    // User-editable overrides for extracted HTML before applying
    const [editableExtractedContent, setEditableExtractedContent] = useState<Record<string, string>>({});
    
    // Active section selected in side-by-side comparison
    const [selectedSectionId, setSelectedSectionId] = useState<string>("intro");
    
    // Filters & view modes
    const [searchTerm, setSearchTerm] = useState("");
    const [filterMode, setFilterMode] = useState<"all" | "detected" | "with_existing">("detected");
    const [isEditingExtracted, setIsEditingExtracted] = useState(false);

    // Reset when dialog opens/closes
    const handleReset = () => {
        setUploadedFile(null);
        setDetectedSections({});
        setSectionActions({});
        setEditableExtractedContent({});
        setSelectedSectionId("intro");
        setIsEditingExtracted(false);
    };

    // File Drop & Selection Handlers
    const handleFileSelected = async (file: File) => {
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (!["pdf", "docx", "doc", "txt"].includes(ext || "")) {
            toast.error("Please upload a PDF (.pdf), Word document (.docx, .doc), or text file.");
            return;
        }

        setIsUploading(true);
        setUploadedFile({
            name: file.name,
            size: file.size,
            type: ext?.toUpperCase() || "DOC"
        });

        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/executive-summary/import-document", {
                method: "POST",
                body: formData
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to process document");
            }

            const data = await res.json();
            
            const detectedMap: Record<string, DetectedSection> = {};
            const initialActions: Record<string, SectionImportAction> = {};
            const initialContent: Record<string, string> = {};

            (data.detectedSections || []).forEach((sec: DetectedSection) => {
                detectedMap[sec.sectionId] = sec;
                initialContent[sec.sectionId] = sec.extractedHtml;

                // Smart default action:
                // If existing section is empty -> "replace"
                // If existing section has content -> default to "append" or "replace"
                const hasExisting = Boolean(currentSectionsData[sec.sectionId]?.trim());
                initialActions[sec.sectionId] = hasExisting ? "append" : "replace";
            });

            setDetectedSections(detectedMap);
            setSectionActions(initialActions);
            setEditableExtractedContent(initialContent);

            // Set the active section to the first detected section, or fallback to 'intro'
            if (data.detectedSections?.length > 0) {
                setSelectedSectionId(data.detectedSections[0].sectionId);
                toast.success(`Successfully detected ${data.detectedSections.length} sections from ${file.name}!`);
            } else {
                setSelectedSectionId("intro");
                toast.info(`Uploaded ${file.name}, but no standard executive summary headings were auto-detected. You can review all sections.`);
            }

        } catch (error: any) {
            console.error("Upload error:", error);
            toast.error(error.message || "Error importing document");
            setUploadedFile(null);
        } finally {
            setIsUploading(false);
        }
    };

    // Drag-and-drop
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelected(e.dataTransfer.files[0]);
        }
    };

    // Bulk action handlers
    const setAllDetectedActions = (action: SectionImportAction) => {
        setSectionActions(prev => {
            const next = { ...prev };
            Object.keys(detectedSections).forEach(id => {
                next[id] = action;
            });
            return next;
        });
        toast.info(`Set all detected sections to: ${action.toUpperCase()}`);
    };

    const handleMoveContent = (fromSecId: string, toSecId: string) => {
        if (fromSecId === toSecId) return;
        const content = (editableExtractedContent[fromSecId] || detectedSections[fromSecId]?.extractedHtml || "").trim();
        if (!content) {
            toast.info("No content to move.");
            return;
        }
        const targetExisting = (editableExtractedContent[toSecId] || detectedSections[toSecId]?.extractedHtml || "").trim();
        const newTargetContent = targetExisting ? `${targetExisting}<p></p>${content}` : content;

        setEditableExtractedContent(prev => ({
            ...prev,
            [fromSecId]: "",
            [toSecId]: newTargetContent
        }));

        setSectionActions(prev => ({
            ...prev,
            [fromSecId]: "skip",
            [toSecId]: currentSectionsData[toSecId]?.trim() ? "append" : "replace"
        }));

        const targetTitle = EXECUTIVE_SUMMARY_TOC.find(s => s.id === toSecId)?.title || toSecId;
        toast.success(`Moved content to ${targetTitle}!`);
        setSelectedSectionId(toSecId);
    };

    // Filtered list of TOC sections
    const filteredSections = useMemo(() => {
        return EXECUTIVE_SUMMARY_TOC.filter(sec => {
            const matchesSearch = sec.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  sec.id.toLowerCase().includes(searchTerm.toLowerCase());
            if (!matchesSearch) return false;

            const isDetected = Boolean(detectedSections[sec.id]);
            const hasExisting = Boolean(currentSectionsData[sec.id]?.trim());

            if (filterMode === "detected") return isDetected;
            if (filterMode === "with_existing") return hasExisting;
            return true;
        });
    }, [searchTerm, filterMode, detectedSections, currentSectionsData]);

    // Active Section Context
    const activeSectionInfo = useMemo(() => {
        return EXECUTIVE_SUMMARY_TOC.find(s => s.id === selectedSectionId) || EXECUTIVE_SUMMARY_TOC[0];
    }, [selectedSectionId]);

    const activeDetected = detectedSections[selectedSectionId];
    const activeExistingContent = currentSectionsData[selectedSectionId] || "";
    const activeExtractedContent = editableExtractedContent[selectedSectionId] ?? (activeDetected?.extractedHtml || "");
    const activeAction = sectionActions[selectedSectionId] || (activeDetected ? "replace" : "skip");

    // Count statistics
    const stats = useMemo(() => {
        let replaceCount = 0;
        let appendCount = 0;
        let skipCount = 0;

        Object.keys(detectedSections).forEach(id => {
            const act = sectionActions[id];
            if (act === "replace") replaceCount++;
            else if (act === "append") appendCount++;
            else skipCount++;
        });

        const activeTotal = replaceCount + appendCount;
        return { replaceCount, appendCount, skipCount, activeTotal, totalDetected: Object.keys(detectedSections).length };
    }, [detectedSections, sectionActions]);

    // Apply changes to Executive Summary
    const handleApply = () => {
        const updated: Record<string, string> = { ...currentSectionsData };
        let appliedCount = 0;

        Object.entries(sectionActions).forEach(([secId, action]) => {
            const docContent = (editableExtractedContent[secId] || detectedSections[secId]?.extractedHtml || "").trim();
            if (!docContent || action === "skip") return;

            const existing = (currentSectionsData[secId] || "").trim();

            if (action === "replace") {
                updated[secId] = docContent;
                appliedCount++;
            } else if (action === "append") {
                if (existing) {
                    updated[secId] = `${existing}<p></p><hr/><p></p>${docContent}`;
                } else {
                    updated[secId] = docContent;
                }
                appliedCount++;
            }
        });

        if (appliedCount === 0) {
            toast.info("No sections were marked for import (all set to Skip).");
            return;
        }

        onApplyToSummary(updated, appliedCount);
        onOpenChange(false);
        handleReset();
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) handleReset();
            onOpenChange(val);
        }}>
            <DialogContent className="max-w-6xl w-[96vw] h-[90vh] max-h-[940px] bg-white dark:bg-slate-950 p-0 overflow-hidden flex flex-col rounded-3xl border-none shadow-2xl">
                {/* ══════════ MODAL HEADER ══════════ */}
                <DialogHeader className="p-5 px-6 bg-slate-900 text-white shrink-0 border-b border-slate-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/20">
                                <FileUp className="w-5 h-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                                    <span>Import Executive Summary Document</span>
                                    <Badge className="bg-emerald-600/30 text-emerald-300 border-emerald-500/30 text-[11px] font-semibold">
                                        PDF & Word (DOCX)
                                    </Badge>
                                </DialogTitle>
                                <DialogDescription className="text-slate-400 text-xs mt-0.5">
                                    Auto-detect inspection sections from existing client or contractor reports and compare side-by-side prior to copy.
                                </DialogDescription>
                            </div>
                        </div>

                        {uploadedFile && (
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-slate-300 border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs gap-1.5 font-mono">
                                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="max-w-[200px] truncate">{uploadedFile.name}</span>
                                    <span className="text-[10px] text-slate-400">({(uploadedFile.size / 1024).toFixed(0)} KB)</span>
                                </Badge>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-800 gap-1"
                                >
                                    <RefreshCw className="w-3 h-3" /> Change File
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogHeader>

                {/* Hidden File Input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    accept=".pdf,.docx,.doc,.txt"
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                            handleFileSelected(e.target.files[0]);
                        }
                    }}
                />

                {/* ══════════ MAIN WORKSPACE ══════════ */}
                {!uploadedFile ? (
                    /* Initial Upload Dropzone View */
                    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-slate-900/20">
                        <div
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`
                                max-w-xl w-full border-2 border-dashed rounded-3xl p-10 flex flex-col items-center text-center cursor-pointer transition-all
                                ${isUploading 
                                    ? "border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 pointer-events-none" 
                                    : "border-slate-300 hover:border-emerald-500 hover:bg-white dark:border-slate-700 dark:hover:border-emerald-500 dark:hover:bg-slate-900/60 shadow-sm hover:shadow-md"
                                }
                            `}
                        >
                            <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-4 ring-8 ring-emerald-500/5">
                                {isUploading ? (
                                    <RefreshCw className="w-10 h-10 animate-spin text-emerald-600" />
                                ) : (
                                    <Upload className="w-10 h-10" />
                                )}
                            </div>

                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                                {isUploading ? "Reading and analyzing document sections..." : "Upload Executive Summary PDF or Word Document"}
                            </h3>
                            <p className="text-xs text-slate-500 max-w-md mt-1 mb-5">
                                Drag & drop your final report file here or click to browse. Automatically detects <strong>30 Executive Summary sections</strong> (GVI, CP, MGI, FMD, Anodes, Caissons, Risers, Anomalies, etc.) including styled tables.
                            </p>

                            <div className="flex items-center gap-2">
                                <Button 
                                    disabled={isUploading} 
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-5 gap-2 shadow-xs"
                                >
                                    <FileUp className="w-3.5 h-3.5" /> Select PDF or DOCX File
                                </Button>
                            </div>

                            <div className="flex items-center gap-4 mt-6 text-[11px] text-slate-400">
                                <span className="flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> PDF (.pdf)
                                </span>
                                <span className="flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Word (.docx, .doc)
                                </span>
                                <span className="flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Smart Table Extraction
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Side-by-Side Comparison & Review Interface */
                    <div className="flex-1 min-h-0 flex overflow-hidden">
                        {/* ─────── LEFT SIDEBAR: SECTION NAVIGATION ─────── */}
                        <div className="w-80 shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/60 dark:bg-slate-900/40">
                            {/* Search & Filter Toolbar */}
                            <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
                                <div className="relative">
                                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                                    <Input
                                        placeholder="Search sections..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="h-8 pl-8 text-xs bg-white dark:bg-slate-950 font-medium"
                                    />
                                    {searchTerm && (
                                        <button 
                                            onClick={() => setSearchTerm("")} 
                                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>

                                {/* Filter Tabs */}
                                <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-800 p-0.5 rounded-lg text-[10px] font-semibold">
                                    <button
                                        onClick={() => setFilterMode("detected")}
                                        className={`flex-1 py-1 rounded-md transition-all ${
                                            filterMode === "detected" 
                                                ? "bg-white dark:bg-slate-950 text-emerald-700 dark:text-emerald-300 shadow-2xs font-bold" 
                                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                        }`}
                                    >
                                        Detected ({stats.totalDetected})
                                    </button>
                                    <button
                                        onClick={() => setFilterMode("all")}
                                        className={`flex-1 py-1 rounded-md transition-all ${
                                            filterMode === "all" 
                                                ? "bg-white dark:bg-slate-950 text-blue-700 dark:text-blue-300 shadow-2xs font-bold" 
                                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                        }`}
                                    >
                                        All ({EXECUTIVE_SUMMARY_TOC.length})
                                    </button>
                                    <button
                                        onClick={() => setFilterMode("with_existing")}
                                        className={`flex-1 py-1 rounded-md transition-all ${
                                            filterMode === "with_existing" 
                                                ? "bg-white dark:bg-slate-950 text-indigo-700 dark:text-indigo-300 shadow-2xs font-bold" 
                                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                        }`}
                                    >
                                        Existing ({Object.values(currentSectionsData).filter(v => v?.trim()).length})
                                    </button>
                                </div>

                                {/* Bulk Action Buttons */}
                                <div className="flex items-center justify-between text-[11px] pt-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        Bulk Action:
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setAllDetectedActions("replace")}
                                            className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800"
                                            title="Set all detected sections to Replace"
                                        >
                                            Replace All
                                        </button>
                                        <button
                                            onClick={() => setAllDetectedActions("append")}
                                            className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 text-[10px] font-bold border border-blue-200 dark:border-blue-800"
                                            title="Set all detected sections to Append"
                                        >
                                            Append All
                                        </button>
                                        <button
                                            onClick={() => setAllDetectedActions("skip")}
                                            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 text-[10px] font-medium"
                                            title="Set all detected sections to Skip"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Section Items List */}
                            <ScrollArea className="flex-1">
                                <div className="p-2 space-y-1">
                                    {filteredSections.map(sec => {
                                        const isSelected = sec.id === selectedSectionId;
                                        const detected = detectedSections[sec.id];
                                        const hasExisting = Boolean(currentSectionsData[sec.id]?.trim());
                                        const action = sectionActions[sec.id] || (detected ? "replace" : "skip");

                                        return (
                                            <div
                                                key={sec.id}
                                                onClick={() => setSelectedSectionId(sec.id)}
                                                className={`
                                                    p-2.5 rounded-xl cursor-pointer transition-all border text-left
                                                    ${isSelected 
                                                        ? "bg-white dark:bg-slate-900 border-emerald-500 shadow-xs ring-1 ring-emerald-500/20" 
                                                        : "bg-transparent border-transparent hover:bg-slate-100/80 dark:hover:bg-slate-850"
                                                    }
                                                `}
                                            >
                                                <div className="flex items-center justify-between gap-1 mb-1">
                                                    <span className={`text-xs font-bold truncate ${isSelected ? "text-emerald-700 dark:text-emerald-400" : "text-slate-800 dark:text-slate-200"}`}>
                                                        {sec.title}
                                                    </span>
                                                    {detected && (
                                                        <span className="shrink-0 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800/60">
                                                            {detected.confidence}%
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-between text-[10px]">
                                                    <div className="flex items-center gap-1.5">
                                                        {hasExisting ? (
                                                            <span className="text-slate-500 flex items-center gap-0.5">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Has Data
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400">Empty</span>
                                                        )}
                                                        {detected?.hasTable && (
                                                            <span className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-0.5">
                                                                <TableIcon className="w-2.5 h-2.5" /> Table
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Action Badge */}
                                                    {detected && (
                                                        <span className={`
                                                            font-bold uppercase text-[9px] px-1.5 py-0.2 rounded
                                                            ${action === "replace" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : ""}
                                                            ${action === "append" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" : ""}
                                                            ${action === "skip" ? "bg-slate-100 text-slate-500 dark:bg-slate-800" : ""}
                                                        `}>
                                                            {action}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {filteredSections.length === 0 && (
                                        <div className="p-6 text-center text-xs text-slate-400">
                                            No sections match your filter.
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>

                        {/* ─────── RIGHT MAIN PANEL: SIDE-BY-SIDE COMPARISON WORKSPACE ─────── */}
                        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-950">
                            {/* Section Header & Action Controller Bar */}
                            <div className="p-4 px-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 flex items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                                            {activeSectionInfo.title}
                                        </h3>
                                        {activeDetected ? (
                                            <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-[10px] font-bold gap-1">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                Found in Document ({activeDetected.confidence}% match)
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-slate-400 text-[10px]">
                                                Not detected in document
                                            </Badge>
                                        )}
                                    </div>
                                    {activeDetected?.matchedHeading && (
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            Matched Document Heading: <strong className="text-slate-700 dark:text-slate-300 font-mono">"{activeDetected.matchedHeading}"</strong>
                                        </p>
                                    )}
                                </div>

                                {/* Section Action Selector (Replace / Append / Skip) */}
                                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                                    <span className="text-[11px] font-bold text-slate-400 px-2 uppercase tracking-wider hidden sm:inline">
                                        Import Mode:
                                    </span>
                                    <button
                                        onClick={() => setSectionActions(prev => ({ ...prev, [selectedSectionId]: "replace" }))}
                                        className={`
                                            px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5
                                            ${activeAction === "replace" 
                                                ? "bg-emerald-600 text-white shadow-xs" 
                                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            }
                                        `}
                                    >
                                        Replace Existing
                                    </button>
                                    <button
                                        onClick={() => setSectionActions(prev => ({ ...prev, [selectedSectionId]: "append" }))}
                                        className={`
                                            px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5
                                            ${activeAction === "append" 
                                                ? "bg-blue-600 text-white shadow-xs" 
                                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            }
                                        `}
                                    >
                                        Append to Existing
                                    </button>
                                    <button
                                        onClick={() => setSectionActions(prev => ({ ...prev, [selectedSectionId]: "skip" }))}
                                        className={`
                                            px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                            ${activeAction === "skip" 
                                                ? "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold" 
                                                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            }
                                        `}
                                    >
                                        Skip
                                    </button>
                                </div>
                            </div>

                            {/* Two-Panel Comparison Split */}
                            <div className="flex-1 min-h-0 grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-800">
                                {/* ─── PANEL 1: CURRENT / EXISTING APPLICATION DATA ─── */}
                                <div className="flex flex-col min-h-0 bg-slate-50/30 dark:bg-slate-900/20">
                                    <div className="p-3 px-5 border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/60 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                                Current Section Data in App
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            {activeExistingContent.trim() ? `${activeExistingContent.length} chars` : "Empty"}
                                        </span>
                                    </div>

                                    <ScrollArea className="flex-1 p-5">
                                        {activeExistingContent.trim() ? (
                                            <div 
                                                className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed text-slate-800 dark:text-slate-200"
                                                dangerouslySetInnerHTML={{ __html: activeExistingContent }}
                                            />
                                        ) : (
                                            <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-slate-400 border border-dashed rounded-2xl border-slate-300 dark:border-slate-800 my-6">
                                                <Layers className="w-8 h-8 opacity-40 mb-2" />
                                                <p className="font-semibold text-xs text-slate-500">Section is currently empty</p>
                                                <p className="text-[11px] max-w-xs mt-0.5">
                                                    No existing text or tables saved in this section. Imported document data will become the initial content.
                                                </p>
                                            </div>
                                        )}
                                    </ScrollArea>
                                </div>

                                {/* ─── PANEL 2: EXTRACTED DOCUMENT DATA TO IMPORT ─── */}
                                <div className="flex flex-col min-h-0 bg-white dark:bg-slate-950">
                                    <div className="p-3 px-5 border-b border-slate-200 dark:border-slate-800 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                                                Extracted Document Data
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {activeExtractedContent.trim() && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-6 text-[10px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 px-2 gap-1 font-semibold border-slate-300 dark:border-slate-700 shadow-2xs"
                                                            title="Move this extracted content to a different section"
                                                        >
                                                            <ArrowRight className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                                            Move to Section ▾
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-64 max-h-72 overflow-y-auto text-xs z-[200]">
                                                        <DropdownMenuLabel className="text-[10px] uppercase font-bold text-slate-400">
                                                            Reassign Content to Section:
                                                        </DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        {EXECUTIVE_SUMMARY_TOC.map(toc => (
                                                            <DropdownMenuItem
                                                                key={toc.id}
                                                                disabled={toc.id === selectedSectionId}
                                                                onClick={() => handleMoveContent(selectedSectionId, toc.id)}
                                                                className="text-xs cursor-pointer py-1.5"
                                                            >
                                                                {toc.title}
                                                            </DropdownMenuItem>
                                                        ))}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setIsEditingExtracted(!isEditingExtracted)}
                                                className="h-6 text-[10px] text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 px-2 gap-1 font-semibold"
                                            >
                                                <Edit3 className="w-3 h-3" />
                                                {isEditingExtracted ? "Preview HTML" : "Edit Extracted Text"}
                                            </Button>
                                        </div>
                                    </div>

                                    <ScrollArea className="flex-1 p-5">
                                        {activeExtractedContent.trim() ? (
                                            isEditingExtracted ? (
                                                <div className="space-y-2">
                                                    <div className="text-[10px] text-slate-500 font-medium">
                                                        Edit the extracted HTML or text prior to copying:
                                                    </div>
                                                    <textarea
                                                        value={activeExtractedContent}
                                                        onChange={(e) => setEditableExtractedContent(prev => ({
                                                            ...prev,
                                                            [selectedSectionId]: e.target.value
                                                        }))}
                                                        className="w-full h-80 p-3 text-xs font-mono bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                    />
                                                </div>
                                            ) : (
                                                <div 
                                                    className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed text-slate-800 dark:text-slate-200"
                                                    dangerouslySetInnerHTML={{ __html: activeExtractedContent }}
                                                />
                                            )
                                        ) : (
                                            <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-slate-400 border border-dashed rounded-2xl border-slate-200 dark:border-slate-800 my-6">
                                                <FileText className="w-8 h-8 opacity-40 mb-2" />
                                                <p className="font-semibold text-xs text-slate-500">No content extracted for this section</p>
                                                <p className="text-[11px] max-w-xs mt-0.5">
                                                    The document did not contain a heading matching this section. You can type or paste text manually using the "Edit Extracted Text" button above.
                                                </p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setIsEditingExtracted(true)}
                                                    className="mt-3 text-xs h-7 gap-1"
                                                >
                                                    <Edit3 className="w-3 h-3" /> Add Text for this Section
                                                </Button>
                                            </div>
                                        )}
                                    </ScrollArea>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ══════════ FOOTER ACTION BAR ══════════ */}
                <DialogFooter className="p-4 px-6 bg-slate-100/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs">
                        {uploadedFile && (
                            <div className="flex items-center gap-2">
                                <Badge className="bg-emerald-600 text-white font-bold text-xs px-2.5 py-0.5">
                                    {stats.activeTotal} Section{stats.activeTotal === 1 ? "" : "s"} Ready
                                </Badge>
                                <span className="text-slate-500 text-[11px]">
                                    ({stats.replaceCount} Replace, {stats.appendCount} Append, {stats.skipCount} Skip)
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                handleReset();
                                onOpenChange(false);
                            }}
                            className="h-9 px-4 text-xs font-semibold"
                        >
                            Cancel
                        </Button>

                        {uploadedFile && (
                            <Button
                                onClick={handleApply}
                                disabled={stats.activeTotal === 0}
                                className="h-9 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2 shadow-xs"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                Apply to Executive Summary ({stats.activeTotal} Sections)
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

