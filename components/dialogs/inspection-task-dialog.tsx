"use client";

import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
    Search, 
    ClipboardCheck, 
    CheckCircle2, 
    AlertTriangle, 
    Clock, 
    RotateCcw, 
    AlertCircle, 
    FileText, 
    Box, 
    Layers, 
    Check, 
    ChevronRight,
    Eye,
    SlidersHorizontal,
    X,
    Filter,
    ListFilter,
    Sparkles
} from "lucide-react";
import { Input } from "@/components/ui/input";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { cn } from "@/lib/utils";

export interface TaskDefinition {
    code: string;
    label: string;
    shortName: string;
    color: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
}

export const INSPECTION_TASK_DEFINITIONS: Record<string, TaskDefinition> = {
    GVI: {
        code: "GVI",
        label: "General Visual Inspection (GVI)",
        shortName: "GVI",
        color: "#10b981", // Emerald
        bgClass: "bg-emerald-50 dark:bg-emerald-950/40",
        textClass: "text-emerald-700 dark:text-emerald-300",
        borderClass: "border-emerald-200 dark:border-emerald-800/60"
    },
    CVI: {
        code: "CVI",
        label: "Close Visual Inspection (CVI)",
        shortName: "CVI",
        color: "#06b6d4", // Cyan
        bgClass: "bg-cyan-50 dark:bg-cyan-950/40",
        textClass: "text-cyan-700 dark:text-cyan-300",
        borderClass: "border-cyan-200 dark:border-cyan-800/60"
    },
    UT: {
        code: "UT",
        label: "Ultrasonic Thickness (UT)",
        shortName: "UT",
        color: "#0284c7", // Sky Blue
        bgClass: "bg-sky-50 dark:bg-sky-950/40",
        textClass: "text-sky-700 dark:text-sky-300",
        borderClass: "border-sky-200 dark:border-sky-800/60"
    },
    MPI: {
        code: "MPI",
        label: "Magnetic Particle Inspection (MPI)",
        shortName: "MPI",
        color: "#f59e0b", // Amber
        bgClass: "bg-amber-50 dark:bg-amber-950/40",
        textClass: "text-amber-700 dark:text-amber-300",
        borderClass: "border-amber-200 dark:border-amber-800/60"
    },
    CP: {
        code: "CP",
        label: "Cathodic Protection Potential (CP)",
        shortName: "CP",
        color: "#6366f1", // Indigo
        bgClass: "bg-indigo-50 dark:bg-indigo-950/40",
        textClass: "text-indigo-700 dark:text-indigo-300",
        borderClass: "border-indigo-200 dark:border-indigo-800/60"
    },
    FMD: {
        code: "FMD",
        label: "Flooded Member Detection (FMD)",
        shortName: "FMD",
        color: "#a855f7", // Violet / Purple
        bgClass: "bg-purple-50 dark:bg-purple-950/40",
        textClass: "text-purple-700 dark:text-purple-300",
        borderClass: "border-purple-200 dark:border-purple-800/60"
    },
    CONDUCTOR: {
        code: "CONDUCTOR",
        label: "Conductor Inspection (CD)",
        shortName: "Conductor",
        color: "#f43f5e", // Rose / Coral
        bgClass: "bg-rose-50 dark:bg-rose-950/40",
        textClass: "text-rose-700 dark:text-rose-300",
        borderClass: "border-rose-200 dark:border-rose-800/60"
    },
    ANODE: {
        code: "ANODE",
        label: "Anode Inspection (AN)",
        shortName: "Anode",
        color: "#14b8a6", // Teal
        bgClass: "bg-teal-50 dark:bg-teal-950/40",
        textClass: "text-teal-700 dark:text-teal-300",
        borderClass: "border-teal-200 dark:border-teal-800/60"
    },
    ACFM: {
        code: "ACFM",
        label: "ACFM / Eddy Current (EC)",
        shortName: "ACFM/EC",
        color: "#ea580c", // Orange
        bgClass: "bg-orange-50 dark:bg-orange-950/40",
        textClass: "text-orange-700 dark:text-orange-300",
        borderClass: "border-orange-200 dark:border-orange-800/60"
    },
    FENDER: {
        code: "FENDER",
        label: "Fender & Boat Landing",
        shortName: "Fender/BL",
        color: "#eab308", // Yellow
        bgClass: "bg-yellow-50 dark:bg-yellow-950/40",
        textClass: "text-yellow-700 dark:text-yellow-300",
        borderClass: "border-yellow-200 dark:border-yellow-800/60"
    },
    OTHER: {
        code: "OTHER",
        label: "Other Inspection Task",
        shortName: "Other",
        color: "#64748b", // Slate
        bgClass: "bg-slate-50 dark:bg-slate-900/60",
        textClass: "text-slate-700 dark:text-slate-300",
        borderClass: "border-slate-200 dark:border-slate-800"
    }
};

/**
 * Normalizes any raw inspection task code or name into a canonical task key.
 */
export function normalizeInspectionTaskCode(rawCode?: string, rawName?: string): string {
    const code = (rawCode || "").toUpperCase().trim();
    const name = (rawName || "").toUpperCase().trim();
    const combined = `${code} ${name}`;

    if (code === "GVINS" || code === "GVI" || combined.includes("GVINS") || (combined.includes("GENERAL VISUAL") && !combined.includes("CLOSE"))) {
        return "GVI";
    }
    if (code === "CVINS" || code === "CVI" || combined.includes("CVINS") || combined.includes("CLOSE VISUAL")) {
        return "CVI";
    }
    if (code === "UTWTK" || code === "DUTWT" || code === "UT" || code === "UTT" || combined.includes("UTWTK") || combined.includes("ULTRASONIC") || combined.includes("THICKNESS")) {
        return "UT";
    }
    if (code === "DMPI" || code === "MPI" || code === "MT" || combined.includes("MPI") || combined.includes("MAGNETIC")) {
        return "MPI";
    }
    if (code === "CPSURV" || code === "DUTCP" || code === "CP" || combined.includes("CPSURV") || combined.includes("CATHODIC") || combined.includes("POTENTIAL")) {
        return "CP";
    }
    if (code === "DFMD" || code === "FMD" || combined.includes("FMD") || combined.includes("FLOODED")) {
        return "FMD";
    }
    if (code === "DCOND" || code === "COND" || code === "CD" || combined.includes("DCOND") || combined.includes("CONDUCTOR")) {
        return "CONDUCTOR";
    }
    if (code === "DANOD" || code === "ANOD" || code === "ANODE" || code === "AN" || combined.includes("DANOD") || combined.includes("ANODE")) {
        return "ANODE";
    }
    if (code === "ACFM" || code === "EC" || combined.includes("ACFM") || combined.includes("EDDY")) {
        return "ACFM";
    }
    if (code === "DFEND" || code === "FEND" || code === "BL" || combined.includes("DFEND") || combined.includes("FENDER") || combined.includes("BOAT LANDING")) {
        return "FENDER";
    }
    if (!code && !name) {
        return "OTHER";
    }
    return "OTHER";
}

export function getTaskDefinition(rawCode?: string, rawName?: string): TaskDefinition {
    const key = normalizeInspectionTaskCode(rawCode, rawName);
    return INSPECTION_TASK_DEFINITIONS[key] || INSPECTION_TASK_DEFINITIONS.OTHER;
}

interface Jobpack {
    id: number;
    name: string;
    metadata?: any;
    status?: string;
}

interface SOWItem {
    id: number;
    sow_id: number;
    component_id: number;
    component_qid?: string;
    component_type?: string;
    inspection_code?: string;
    inspection_name?: string;
    status?: string;
    report_number?: string;
    last_inspection_date?: string;
    notes?: string;
    elevation_data?: any;
}

interface SOWData {
    id: number;
    jobpack_id: number;
    structure_id: number;
    structure_title?: string;
    report_numbers?: any[];
    items?: SOWItem[];
    total_items?: number;
    completed_items?: number;
    incomplete_items?: number;
    pending_items?: number;
}

interface InspectionTaskDialogProps {
    isOpen: boolean;
    onClose: () => void;
    platformId: number;
    platformTitle: string;
    selectedJobpackId: number | null;
    onJobpackChange: (id: number | null) => void;
    selectedSowReportNo?: string | null;
    onSowReportChange?: (reportNo: string | null) => void;
    selectedTaskCode: string | null; // e.g. "ALL", "GVI", "UT", "CONDUCTOR", or null
    onTaskCodeChange: (taskCode: string | null) => void;
    onSelectComponent?: (comp: any) => void;
    onResetColors?: () => void;
}

export function InspectionTaskDialog({
    isOpen,
    onClose,
    platformId,
    platformTitle,
    selectedJobpackId,
    onJobpackChange,
    selectedSowReportNo = null,
    onSowReportChange,
    selectedTaskCode = "ALL",
    onTaskCodeChange,
    onSelectComponent,
    onResetColors
}: InspectionTaskDialogProps) {
    const [jobpackSearchQuery, setJobpackSearchQuery] = useState("");
    const [compSearchQuery, setCompSearchQuery] = useState("");
    const [internalReportFilter, setInternalReportFilter] = useState<string | null>(selectedSowReportNo);

    React.useEffect(() => {
        setInternalReportFilter(selectedSowReportNo);
    }, [selectedSowReportNo]);

    // 1. Fetch Jobpacks for this platform
    const { data: jobpacksData, isLoading: isJobpacksLoading } = useSWR(
        isOpen ? `/api/jobpack?has_inspection=true&pageSize=50&structure_id=${platformId}&structure_title=${encodeURIComponent(platformTitle)}` : null, 
        fetcher
    );
    const jobpacks: Jobpack[] = useMemo(() => jobpacksData?.data || [], [jobpacksData]);

    const filteredJobpacks = useMemo(() => {
        if (!jobpackSearchQuery.trim()) return jobpacks;
        const q = jobpackSearchQuery.toLowerCase();
        return jobpacks.filter(j => 
            j.name?.toLowerCase().includes(q) || 
            String(j.id).includes(q)
        );
    }, [jobpacks, jobpackSearchQuery]);

    // 2. Fetch SOW & SOW items for the selected Jobpack
    const { data: sowResponse, isLoading: isSowLoading } = useSWR(
        isOpen && selectedJobpackId ? `/api/sow?jobpack_id=${selectedJobpackId}&structure_id=${platformId}` : null,
        fetcher
    );

    const sow: SOWData | null = useMemo(() => {
        if (!sowResponse?.data) return null;
        if (Array.isArray(sowResponse.data)) {
            return sowResponse.data.length > 0 ? sowResponse.data[0] : null;
        }
        return sowResponse.data;
    }, [sowResponse]);

    const sowItems: SOWItem[] = useMemo(() => {
        return sow?.items || [];
    }, [sow]);

    // Extract available SOW report numbers
    const availableReportNumbers = useMemo(() => {
        const set = new Set<string>();
        if (sow?.report_numbers && Array.isArray(sow.report_numbers)) {
            sow.report_numbers.forEach((r: any) => {
                const num = typeof r === "string" ? r : r?.number;
                if (num) set.add(num);
            });
        }
        if (sow?.items && Array.isArray(sow.items)) {
            sow.items.forEach((item: any) => {
                if (item.report_number) set.add(item.report_number);
            });
        }
        return Array.from(set);
    }, [sow]);

    // Calculate unique inspection tasks present in current SOW dataset with counts
    const taskBreakdown = useMemo(() => {
        const counts: Record<string, { count: number; def: TaskDefinition }> = {};
        
        let targetItems = sowItems;
        if (internalReportFilter) {
            targetItems = targetItems.filter(item => item.report_number === internalReportFilter);
        }

        targetItems.forEach((item) => {
            const taskKey = normalizeInspectionTaskCode(item.inspection_code, item.inspection_name);
            const def = INSPECTION_TASK_DEFINITIONS[taskKey] || INSPECTION_TASK_DEFINITIONS.OTHER;
            if (!counts[taskKey]) {
                counts[taskKey] = { count: 0, def };
            }
            counts[taskKey].count++;
        });

        return counts;
    }, [sowItems, internalReportFilter]);

    // Filter components based on report filter, task code filter, and search text
    const filteredComponents = useMemo(() => {
        let list = sowItems;

        // 1. Report filter
        if (internalReportFilter) {
            list = list.filter((item) => item.report_number === internalReportFilter);
        }

        // 2. Inspection Task filter (if not "ALL" and not null)
        if (selectedTaskCode && selectedTaskCode !== "ALL") {
            list = list.filter((item) => {
                const itemTaskKey = normalizeInspectionTaskCode(item.inspection_code, item.inspection_name);
                return itemTaskKey === selectedTaskCode;
            });
        }

        // 3. Search query
        if (compSearchQuery.trim()) {
            const q = compSearchQuery.toLowerCase().trim();
            list = list.filter((item) => {
                const qid = (item.component_qid || "").toLowerCase();
                const type = (item.component_type || "").toLowerCase();
                const code = (item.inspection_code || "").toLowerCase();
                const name = (item.inspection_name || "").toLowerCase();
                const notes = (item.notes || "").toLowerCase();
                const rpt = (item.report_number || "").toLowerCase();
                return qid.includes(q) || type.includes(q) || code.includes(q) || name.includes(q) || notes.includes(q) || rpt.includes(q);
            });
        }

        return list;
    }, [sowItems, internalReportFilter, selectedTaskCode, compSearchQuery]);

    const handleSelectJobpack = (jpId: number) => {
        if (selectedJobpackId === jpId) {
            onJobpackChange(null);
            setInternalReportFilter(null);
            if (onSowReportChange) onSowReportChange(null);
            onTaskCodeChange("ALL");
        } else {
            onJobpackChange(jpId);
            setInternalReportFilter(null);
            if (onSowReportChange) onSowReportChange(null);
            onTaskCodeChange("ALL");
        }
    };

    const handleSelectReport = (reportNo: string | null) => {
        setInternalReportFilter(reportNo);
        if (onSowReportChange) onSowReportChange(reportNo);
    };

    const handleResetAll = () => {
        onJobpackChange(null);
        handleSelectReport(null);
        onTaskCodeChange("ALL");
        setJobpackSearchQuery("");
        setCompSearchQuery("");
        if (onResetColors) onResetColors();
    };

    const handleFocusComponent = (item: SOWItem) => {
        if (onSelectComponent) {
            onSelectComponent({
                id: item.component_id,
                comp_id: item.component_id,
                q_id: item.component_qid || `COMP-${item.component_id}`,
                code: item.component_type || item.inspection_code || "COMPONENT",
                metadata: {
                    status: item.status,
                    inspection_code: item.inspection_code,
                    report_number: item.report_number,
                    last_inspection_date: item.last_inspection_date
                }
            });
            onClose();
        }
    };

    const activeTaskDef = selectedTaskCode && selectedTaskCode !== "ALL" 
        ? (INSPECTION_TASK_DEFINITIONS[selectedTaskCode] || null) 
        : null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[1020px] w-[95vw] max-h-[92vh] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-0 overflow-hidden shadow-2xl flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <DialogHeader>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center border border-teal-100 dark:border-teal-800/50 shadow-xs">
                                    <ClipboardCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                                        Platform Inspection Task
                                    </DialogTitle>
                                    <DialogDescription className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5 flex items-center gap-2">
                                        <span>{platformTitle}</span>
                                        {selectedJobpackId && (
                                            <>
                                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                                <span className="text-teal-600 dark:text-teal-400 font-black">Jobpack #{selectedJobpackId}</span>
                                            </>
                                        )}
                                        {internalReportFilter && (
                                            <>
                                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                                <span className="text-blue-600 dark:text-blue-400 font-black">SOW: {internalReportFilter}</span>
                                            </>
                                        )}
                                        {activeTaskDef && (
                                            <>
                                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                                <span className={cn("font-black px-1.5 py-0.5 rounded text-[10px]", activeTaskDef.bgClass, activeTaskDef.textClass)}>
                                                    Highlighting: {activeTaskDef.shortName}
                                                </span>
                                            </>
                                        )}
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        {/* Top Action Buttons (offset from dialog close X button) */}
                        <div className="flex items-center gap-2 mr-8 sm:mr-12">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleResetAll}
                                className="h-9 px-3 gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-xs"
                                title="Reset all task selections and restore standard 3D colors"
                            >
                                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                                <span>Reset Colors</span>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Main Content Area (Split Grid) */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
                    {/* Left Column: Jobpack Selection */}
                    <div className="md:col-span-5 p-5 flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-950/50">
                        <div className="flex items-center justify-between mb-3 shrink-0">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-teal-500" />
                                <span>1. Select Jobpack ({filteredJobpacks.length})</span>
                            </label>
                        </div>

                        {/* Search Jobpacks */}
                        <div className="relative mb-3 shrink-0">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Search Jobpack ID or Title..."
                                value={jobpackSearchQuery}
                                onChange={(e) => setJobpackSearchQuery(e.target.value)}
                                className="pl-10 h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl font-medium text-xs shadow-xs"
                            />
                            {jobpackSearchQuery && (
                                <button
                                    onClick={() => setJobpackSearchQuery("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Jobpack List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5 pr-1 min-h-[260px] max-h-[480px]">
                            {isJobpacksLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="w-8 h-8 border-2 border-slate-200 border-t-teal-500 rounded-full animate-spin mb-2" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading Jobpacks...</p>
                                </div>
                            ) : filteredJobpacks.length > 0 ? (
                                filteredJobpacks.map((jobpack) => {
                                    const isSelected = selectedJobpackId === jobpack.id;
                                    return (
                                        <button
                                            key={jobpack.id}
                                            type="button"
                                            onClick={() => handleSelectJobpack(jobpack.id)}
                                            className={cn(
                                                "w-full text-left p-3.5 rounded-2xl border transition-all duration-200 group relative overflow-hidden cursor-pointer",
                                                isSelected
                                                    ? "bg-teal-50/80 border-teal-300 dark:bg-teal-950/30 dark:border-teal-700/60 shadow-md ring-2 ring-teal-500/20"
                                                    : "bg-white border-slate-200 hover:border-teal-300 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-teal-800 shadow-2xs"
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2 mb-1.5 relative z-10">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn(
                                                            "text-[9px] font-black uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-md",
                                                            isSelected 
                                                                ? "bg-teal-200/80 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300" 
                                                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                                        )}>
                                                            ID: {jobpack.id}
                                                        </span>
                                                        {jobpack.status && (
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase">
                                                                {jobpack.status}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 mt-1">
                                                        {jobpack.name}
                                                    </div>
                                                </div>
                                                <div className={cn(
                                                    "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors mt-0.5",
                                                    isSelected
                                                        ? "border-teal-600 bg-teal-600 text-white"
                                                        : "border-slate-300 dark:border-slate-700 group-hover:border-teal-400"
                                                )}>
                                                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium relative z-10 mt-2">
                                                <span className="flex items-center gap-1">
                                                    <FileText className="w-3 h-3" />
                                                    <span>Scope of Work</span>
                                                </span>
                                                <span className={cn(
                                                    "text-[10px] font-bold flex items-center gap-0.5",
                                                    isSelected ? "text-teal-600 dark:text-teal-400" : "text-slate-500"
                                                )}>
                                                    {isSelected ? "Active Selection" : "Click to view SOW"}
                                                    <ChevronRight className="w-3 h-3 inline-block" />
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                                    <Layers className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400">No Jobpacks found</p>
                                    <p className="text-[10px] text-slate-400 mt-1">No inspection jobpacks linked to this platform</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: SOW Selection & Inspection Task Distinction & Legend */}
                    <div className="md:col-span-7 p-5 flex flex-col min-h-0 bg-white dark:bg-slate-900">
                        {selectedJobpackId ? (
                            <div className="flex flex-col h-full min-h-0">
                                {/* SOW Report Navigation Tabs */}
                                <div className="mb-3 shrink-0">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1.5">
                                            <FileText className="w-3.5 h-3.5 text-teal-500" />
                                            <span>2. SOW Report Number ({availableReportNumbers.length || "1"})</span>
                                        </label>
                                    </div>

                                    {/* SOW Report Pill Buttons */}
                                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full custom-scrollbar">
                                        <button
                                            type="button"
                                            onClick={() => handleSelectReport(null)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer",
                                                internalReportFilter === null
                                                    ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                                                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700"
                                            )}
                                        >
                                            All SOW ({sowItems.length})
                                        </button>
                                        {availableReportNumbers.map((rptNo) => {
                                            const isRptSelected = internalReportFilter === rptNo;
                                            const rptCount = sowItems.filter((i) => i.report_number === rptNo).length;
                                            return (
                                                <button
                                                    key={rptNo}
                                                    type="button"
                                                    onClick={() => handleSelectReport(rptNo)}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer flex items-center gap-1.5",
                                                        isRptSelected
                                                            ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                                                            : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700"
                                                    )}
                                                >
                                                    <span>{rptNo}</span>
                                                    <span className={cn(
                                                        "text-[10px] px-1 rounded",
                                                        isRptSelected ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300"
                                                    )}>
                                                        {rptCount}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Task Types Color Reference Legend & Spotlight Selector */}
                                <div className="mb-4 shrink-0 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                            <Sparkles className="w-3.5 h-3.5 text-teal-500" />
                                            <span>3. Task Color Reference & Spotlight Highlight</span>
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {selectedTaskCode && selectedTaskCode !== "ALL" 
                                                ? "Click to Spotlight Singular Task" 
                                                : "Showing All Tasks"}
                                        </span>
                                    </div>

                                    {/* Task Reference Pills */}
                                    <div className="flex flex-wrap gap-1.5 items-center">
                                        {/* All Tasks Pill */}
                                        <button
                                            type="button"
                                            onClick={() => onTaskCodeChange("ALL")}
                                            className={cn(
                                                "px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5",
                                                selectedTaskCode === "ALL" || !selectedTaskCode
                                                    ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white shadow-xs font-black"
                                                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            )}
                                        >
                                            <div className="w-2 h-2 rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-purple-400" />
                                            <span>All Tasks</span>
                                            <span className="text-[9px] opacity-70">({sowItems.length})</span>
                                        </button>

                                        {/* Dynamic Task Pills from SOW Data */}
                                        {Object.entries(taskBreakdown).map(([taskKey, { count, def }]) => {
                                            const isCurrentSelected = selectedTaskCode === taskKey;
                                            return (
                                                <button
                                                    key={taskKey}
                                                    type="button"
                                                    onClick={() => onTaskCodeChange(isCurrentSelected ? "ALL" : taskKey)}
                                                    className={cn(
                                                        "px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5",
                                                        isCurrentSelected
                                                            ? cn(def.bgClass, def.textClass, def.borderClass, "ring-2 shadow-xs font-black scale-105")
                                                            : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                    )}
                                                    title={`Highlight only ${def.label} in 3D`}
                                                >
                                                    <div 
                                                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" 
                                                        style={{ backgroundColor: def.color }}
                                                    />
                                                    <span>{def.shortName}</span>
                                                    <span className="text-[9px] px-1 rounded bg-black/5 dark:bg-white/10 opacity-80">
                                                        {count}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Component List Header & Search */}
                                <div className="flex items-center justify-between gap-3 mb-2.5 shrink-0">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                        <Input
                                            placeholder="Search component QID, type, or task..."
                                            value={compSearchQuery}
                                            onChange={(e) => setCompSearchQuery(e.target.value)}
                                            className="pl-9 h-8 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl font-medium text-xs shadow-2xs"
                                        />
                                        {compSearchQuery && (
                                            <button
                                                onClick={() => setCompSearchQuery("")}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-black uppercase text-slate-400 shrink-0">
                                        Showing {filteredComponents.length} of {sowItems.length}
                                    </span>
                                </div>

                                {/* Components Table */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-800 rounded-2xl min-h-0 bg-white dark:bg-slate-950">
                                    {isSowLoading ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-center">
                                            <div className="w-8 h-8 border-2 border-slate-200 border-t-teal-500 rounded-full animate-spin mb-2" />
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading SOW Tasks...</p>
                                        </div>
                                    ) : filteredComponents.length > 0 ? (
                                        <table className="w-full text-left border-collapse">
                                            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 z-10">
                                                <tr>
                                                    <th className="py-2.5 px-3 text-[9px] font-black uppercase tracking-wider text-slate-400">Component</th>
                                                    <th className="py-2.5 px-3 text-[9px] font-black uppercase tracking-wider text-slate-400">Inspection Task</th>
                                                    <th className="py-2.5 px-3 text-[9px] font-black uppercase tracking-wider text-slate-400">Report No</th>
                                                    <th className="py-2.5 px-3 text-[9px] font-black uppercase tracking-wider text-slate-400">Status</th>
                                                    <th className="py-2.5 px-3 text-[9px] font-black uppercase tracking-wider text-slate-400 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                                                {filteredComponents.map((item, idx) => {
                                                    const taskDef = getTaskDefinition(item.inspection_code, item.inspection_name);
                                                    const rawStatus = (item.status || "Pending").toLowerCase();
                                                    const isCompleted = rawStatus === "completed" || rawStatus === "complete" || rawStatus === "done";
                                                    const isIncomplete = rawStatus === "incomplete" || rawStatus === "anomaly" || rawStatus === "defect";

                                                    return (
                                                        <tr key={`sow-task-row-${item.id || idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors">
                                                            <td className="py-2.5 px-3">
                                                                <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                                                    <Box className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                                    <span>{item.component_qid || `COMP-${item.component_id}`}</span>
                                                                </div>
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-5">
                                                                    {item.component_type || "STRUCTURAL"}
                                                                </div>
                                                            </td>
                                                            <td className="py-2.5 px-3">
                                                                <span className={cn(
                                                                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-black border",
                                                                    taskDef.bgClass,
                                                                    taskDef.textClass,
                                                                    taskDef.borderClass
                                                                )}>
                                                                    <div 
                                                                        className="w-2 h-2 rounded-full shrink-0" 
                                                                        style={{ backgroundColor: taskDef.color }}
                                                                    />
                                                                    <span>{item.inspection_name || taskDef.label || item.inspection_code || "Inspection"}</span>
                                                                </span>
                                                            </td>
                                                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                                                                {item.report_number || "-"}
                                                            </td>
                                                            <td className="py-2.5 px-3">
                                                                {isCompleted ? (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                                                        <CheckCircle2 className="w-3 h-3" />
                                                                        <span>Done</span>
                                                                    </span>
                                                                ) : isIncomplete ? (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                                                        <AlertTriangle className="w-3 h-3" />
                                                                        <span>Anomaly</span>
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                                                        <Clock className="w-3 h-3" />
                                                                        <span>Pending</span>
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-right">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleFocusComponent(item)}
                                                                    className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 text-[10px] font-bold inline-flex items-center gap-1 transition-all cursor-pointer hover:scale-105"
                                                                    title="Focus and view component specifications in 3D"
                                                                >
                                                                    <Eye className="w-3 h-3" />
                                                                    <span>Focus 3D</span>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="p-8 text-center">
                                            <ClipboardCheck className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                                            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">No components match the selected task filter</p>
                                            <p className="text-[10px] text-slate-400 mt-1">Try selecting "All Tasks" or clearing your search</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-slate-50/50 dark:bg-slate-950/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800/40 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-3 shadow-xs">
                                    <ClipboardCheck className="w-6 h-6" />
                                </div>
                                <h4 className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">
                                    No Jobpack Selected
                                </h4>
                                <p className="text-xs text-slate-400 max-w-sm mt-1">
                                    Select a platform Jobpack from the left panel to inspect scope of work tasks (GVI, Conductor Inspection, UT, MPI, CP, etc.) and highlight them in 3D.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 bg-slate-100/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                    <div className="text-[11px] text-slate-500 font-medium">
                        {selectedJobpackId ? (
                            <span>Active Jobpack: <strong className="text-slate-800 dark:text-slate-200">#{selectedJobpackId}</strong></span>
                        ) : (
                            <span>Select a Jobpack to activate 3D inspection task rendering</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="default" 
                            size="sm" 
                            onClick={onClose}
                            className="h-8 px-4 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-xs"
                        >
                            Done
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
