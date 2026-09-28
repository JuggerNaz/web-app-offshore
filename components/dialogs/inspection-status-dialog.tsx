"use client";

import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
    Search, 
    Activity, 
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
    Filter
} from "lucide-react";
import { Input } from "@/components/ui/input";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { cn } from "@/lib/utils";

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

interface InspectionStatusDialogProps {
    isOpen: boolean;
    onClose: () => void;
    platformId: number;
    platformTitle: string;
    selectedFilters: string[];
    onFiltersChange: (filters: string[]) => void;
    selectedJobpackId: number | null;
    onJobpackChange: (id: number | null) => void;
    selectedSowReportNo?: string | null;
    onSowReportChange?: (reportNo: string | null) => void;
    onSelectComponent?: (comp: any) => void;
}

export function InspectionStatusDialog({
    isOpen,
    onClose,
    platformId,
    platformTitle,
    selectedFilters,
    onFiltersChange,
    selectedJobpackId,
    onJobpackChange,
    selectedSowReportNo = null,
    onSowReportChange,
    onSelectComponent
}: InspectionStatusDialogProps) {
    const [jobpackSearchQuery, setJobpackSearchQuery] = useState("");
    const [compSearchQuery, setCompSearchQuery] = useState("");
    const [internalReportFilter, setInternalReportFilter] = useState<string | null>(selectedSowReportNo);

    // Synchronize internal report filter when prop changes
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

    // Normalized status helper
    const getNormalizedStatus = (rawStatus?: string): "Completed" | "Incomplete" | "Pending" => {
        if (!rawStatus) return "Pending";
        const s = rawStatus.toLowerCase().trim();
        if (s === "completed" || s === "complete" || s === "done") return "Completed";
        if (s === "incomplete" || s === "anomaly" || s === "anomalies" || s === "defect") return "Incomplete";
        return "Pending";
    };

    // Calculate SOW metrics
    const metrics = useMemo(() => {
        let total = sowItems.length;
        let completed = 0;
        let incomplete = 0;
        let pending = 0;

        sowItems.forEach((item) => {
            const st = getNormalizedStatus(item.status);
            if (st === "Completed") completed++;
            else if (st === "Incomplete") incomplete++;
            else pending++;
        });

        const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;
        const incompletePct = total > 0 ? Math.round((incomplete / total) * 100) : 0;
        const pendingPct = total > 0 ? Math.round((pending / total) * 100) : 0;

        return {
            total,
            completed,
            incomplete,
            pending,
            completedPct,
            incompletePct,
            pendingPct
        };
    }, [sowItems]);

    // Filter components by selected SOW report, search query, and status filters
    const filteredComponents = useMemo(() => {
        let list = sowItems;

        // 1. SOW Report Number filter
        if (internalReportFilter) {
            list = list.filter((item) => item.report_number === internalReportFilter);
        }

        // 2. Status Filters (Completed, Incomplete, Pending)
        if (selectedFilters.length > 0) {
            list = list.filter((item) => selectedFilters.includes(getNormalizedStatus(item.status)));
        } else {
            return []; // No filter selected -> empty
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
    }, [sowItems, internalReportFilter, selectedFilters, compSearchQuery]);

    const toggleFilter = (filter: string) => {
        if (selectedFilters.includes(filter)) {
            onFiltersChange(selectedFilters.filter(f => f !== filter));
        } else {
            onFiltersChange([...selectedFilters, filter]);
        }
    };

    const handleSelectJobpack = (jpId: number) => {
        if (selectedJobpackId === jpId) {
            onJobpackChange(null);
            setInternalReportFilter(null);
            if (onSowReportChange) onSowReportChange(null);
        } else {
            onJobpackChange(jpId);
            setInternalReportFilter(null);
            if (onSowReportChange) onSowReportChange(null);
        }
    };

    const handleSelectReport = (reportNo: string | null) => {
        setInternalReportFilter(reportNo);
        if (onSowReportChange) onSowReportChange(reportNo);
    };

    const handleReset = () => {
        onFiltersChange(["Completed", "Incomplete", "Pending"]);
        onJobpackChange(null);
        handleSelectReport(null);
        setJobpackSearchQuery("");
        setCompSearchQuery("");
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

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[960px] w-[95vw] max-h-[90vh] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-0 overflow-hidden shadow-2xl flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <DialogHeader>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center border border-purple-100 dark:border-purple-800/50 shadow-xs">
                                    <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                                        Platform Inspection Status
                                    </DialogTitle>
                                    <DialogDescription className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5 flex items-center gap-2">
                                        <span>{platformTitle}</span>
                                        {selectedJobpackId && (
                                            <>
                                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                                <span className="text-purple-600 dark:text-purple-400 font-black">Jobpack #{selectedJobpackId}</span>
                                            </>
                                        )}
                                        {internalReportFilter && (
                                            <>
                                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                                <span className="text-blue-600 dark:text-blue-400 font-black">SOW: {internalReportFilter}</span>
                                            </>
                                        )}
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        {/* Status Filter Toggles in Header (offset from dialog close button) */}
                        <div className="flex items-center gap-2 mr-8 sm:mr-12">
                            <button
                                type="button"
                                onClick={() => toggleFilter("Completed")}
                                className={cn(
                                    "flex items-center gap-1.5 py-1.5 px-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                                    selectedFilters.includes("Completed")
                                        ? "bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400 shadow-xs"
                                        : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800/50 opacity-60"
                                )}
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Completed</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => toggleFilter("Incomplete")}
                                className={cn(
                                    "flex items-center gap-1.5 py-1.5 px-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                                    selectedFilters.includes("Incomplete")
                                        ? "bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400 shadow-xs"
                                        : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800/50 opacity-60"
                                )}
                            >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Incomplete</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => toggleFilter("Pending")}
                                className={cn(
                                    "flex items-center gap-1.5 py-1.5 px-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                                    selectedFilters.includes("Pending")
                                        ? "bg-slate-100 border-slate-300 text-slate-800 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 shadow-xs"
                                        : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800/50 opacity-60"
                                )}
                            >
                                <Clock className="w-3.5 h-3.5" />
                                <span>Pending</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content Area (Split Grid) */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
                    {/* Left Column: Jobpack Selection */}
                    <div className="md:col-span-5 p-5 flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-950/50">
                        <div className="flex items-center justify-between mb-3 shrink-0">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-purple-500" />
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
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5 pr-1 min-h-[260px] max-h-[460px]">
                            {isJobpacksLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="w-8 h-8 border-2 border-slate-200 border-t-purple-500 rounded-full animate-spin mb-2" />
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
                                                    ? "bg-purple-50/80 border-purple-300 dark:bg-purple-950/30 dark:border-purple-700/60 shadow-md ring-2 ring-purple-500/20"
                                                    : "bg-white border-slate-200 hover:border-purple-300 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-purple-800 shadow-2xs"
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2 mb-1.5 relative z-10">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn(
                                                            "text-[9px] font-black uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-md",
                                                            isSelected 
                                                                ? "bg-purple-200/80 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300" 
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
                                                        ? "border-purple-600 bg-purple-600 text-white"
                                                        : "border-slate-300 dark:border-slate-700 group-hover:border-purple-400"
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
                                                    isSelected ? "text-purple-600 dark:text-purple-400" : "text-slate-500"
                                                )}>
                                                    {isSelected ? "Active Selection" : "Click to view SOW"}
                                                    <ChevronRight className="w-3 h-3 inline-block" />
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-900/50">
                                    <AlertCircle className="w-6 h-6 text-slate-400 mb-1.5" />
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">No jobpacks found</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">No matching inspection jobpacks for this platform.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: SOW & Component Status Explorer */}
                    <div className="md:col-span-7 p-5 flex flex-col min-h-0 bg-white dark:bg-slate-900">
                        {!selectedJobpackId ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                                <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 border border-purple-100 dark:border-purple-800/40 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-3 shadow-xs">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                    Select a Jobpack
                                </h3>
                                <p className="text-xs text-slate-400 max-w-sm mt-1">
                                    Choose a jobpack from the list on the left to view its configured Scope of Work (SOW), SOW reports, and real-time component statuses.
                                </p>
                            </div>
                        ) : isSowLoading ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                                <div className="w-8 h-8 border-2 border-slate-200 border-t-purple-600 rounded-full animate-spin mb-2" />
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading SOW and Component Statuses...</p>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col min-h-0">
                                {/* SOW Report Selector Tabs */}
                                <div className="mb-3.5 shrink-0">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1.5">
                                            <FileText className="w-3.5 h-3.5 text-blue-500" />
                                            <span>2. Select SOW Report Scope</span>
                                        </label>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                                            {sowItems.length} Total Components
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-1.5 max-h-[72px] overflow-y-auto custom-scrollbar p-1 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl">
                                        <button
                                            type="button"
                                            onClick={() => handleSelectReport(null)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                                                internalReportFilter === null
                                                    ? "bg-blue-600 text-white shadow-xs"
                                                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
                                            )}
                                        >
                                            <span>All SOW Reports</span>
                                            <span className={cn(
                                                "px-1.5 py-0.2 rounded-full text-[9px]",
                                                internalReportFilter === null ? "bg-blue-700 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                            )}>
                                                {sowItems.length}
                                            </span>
                                        </button>

                                        {availableReportNumbers.map((rpt) => {
                                            const isSelected = internalReportFilter === rpt;
                                            const rptCount = sowItems.filter(i => i.report_number === rpt).length;
                                            return (
                                                <button
                                                    key={rpt}
                                                    type="button"
                                                    onClick={() => handleSelectReport(rpt)}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                                                        isSelected
                                                            ? "bg-blue-600 text-white shadow-xs"
                                                            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
                                                    )}
                                                >
                                                    <span>{rpt}</span>
                                                    <span className={cn(
                                                        "px-1.5 py-0.2 rounded-full text-[9px]",
                                                        isSelected ? "bg-blue-700 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                                    )}>
                                                        {rptCount}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* SOW Metrics Bar */}
                                <div className="mb-3.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 shrink-0">
                                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider mb-2">
                                        <span className="text-slate-500">SOW Completion Overview</span>
                                        <span className="text-purple-600 dark:text-purple-400">{metrics.completedPct}% Complete</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex mb-2">
                                        <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${metrics.completedPct}%` }} title={`Completed: ${metrics.completed}`} />
                                        <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${metrics.incompletePct}%` }} title={`Incomplete: ${metrics.incomplete}`} />
                                        <div className="h-full bg-slate-400 dark:bg-slate-600 transition-all duration-500" style={{ width: `${metrics.pendingPct}%` }} title={`Pending: ${metrics.pending}`} />
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            {metrics.completed} Completed
                                        </span>
                                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                            {metrics.incomplete} Incomplete
                                        </span>
                                        <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                            {metrics.pending} Pending
                                        </span>
                                    </div>
                                </div>

                                {/* Component Search Header */}
                                <div className="flex items-center gap-2 mb-2 shrink-0">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                        <Input
                                            placeholder="Search component QID, code, or task..."
                                            value={compSearchQuery}
                                            onChange={(e) => setCompSearchQuery(e.target.value)}
                                            className="pl-9 h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-xs shadow-xs"
                                        />
                                        {compSearchQuery && (
                                            <button
                                                onClick={() => setCompSearchQuery("")}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Component Status List */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-800 rounded-2xl p-1 bg-slate-50/40 dark:bg-slate-950/30 min-h-[180px] max-h-[260px] space-y-1.5">
                                    {filteredComponents.length > 0 ? (
                                        filteredComponents.map((item, idx) => {
                                            const status = getNormalizedStatus(item.status);
                                            return (
                                                <div
                                                    key={`comp-sow-item-${item.id || idx}`}
                                                    className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl hover:border-purple-200 dark:hover:border-purple-900/60 transition-all shadow-2xs group"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                                                            <Box className="w-4 h-4 text-slate-500" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                                                    {item.component_qid || `COMP-${item.component_id}`}
                                                                </span>
                                                                {item.inspection_code && (
                                                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50">
                                                                        {item.inspection_code}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 font-medium flex items-center gap-2 mt-0.5">
                                                                <span>{item.component_type || "Component"}</span>
                                                                {item.report_number && (
                                                                    <>
                                                                        <span>•</span>
                                                                        <span className="text-slate-500">{item.report_number}</span>
                                                                    </>
                                                                )}
                                                                {item.last_inspection_date && (
                                                                    <>
                                                                        <span>•</span>
                                                                        <span>{item.last_inspection_date}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {/* Status Badge */}
                                                        {status === "Completed" && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400">
                                                                <CheckCircle2 className="w-3 h-3" />
                                                                <span>Completed</span>
                                                            </span>
                                                        )}
                                                        {status === "Incomplete" && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400">
                                                                <AlertTriangle className="w-3 h-3" />
                                                                <span>Incomplete</span>
                                                            </span>
                                                        )}
                                                        {status === "Pending" && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                                                                <Clock className="w-3 h-3" />
                                                                <span>Pending</span>
                                                            </span>
                                                        )}

                                                        {/* Focus in 3D Button */}
                                                        {onSelectComponent && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleFocusComponent(item)}
                                                                className="h-8 px-2 rounded-lg text-[10px] font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 flex items-center gap-1"
                                                                title="Locate and focus component in 3D Explorer"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                                <span className="hidden sm:inline">Focus 3D</span>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                                            <AlertCircle className="w-6 h-6 text-slate-400 mb-1" />
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">No matching components</p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">
                                                {sowItems.length === 0 
                                                    ? "No SOW items configured for this Jobpack." 
                                                    : "Try adjusting your search query or status filter."}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-100 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleReset}
                            className="rounded-xl px-4 h-10 text-xs font-bold border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all gap-2 cursor-pointer shadow-xs"
                            title="Clear all inspection status filters and restore standard 3D view"
                        >
                            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                            <span>Reset Filter</span>
                        </Button>
                        {selectedJobpackId && (
                            <span className="text-xs font-medium text-slate-500 hidden sm:inline">
                                Filtering 3D model by Jobpack #{selectedJobpackId} {internalReportFilter ? `(${internalReportFilter})` : ""}
                            </span>
                        )}
                    </div>

                    <Button 
                        onClick={onClose} 
                        className="rounded-xl px-8 h-10 font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 shadow-md cursor-pointer"
                    >
                        Done
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
