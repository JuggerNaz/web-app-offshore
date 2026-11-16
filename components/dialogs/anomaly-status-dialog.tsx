"use client";

import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Search,
    CheckCircle2,
    AlertTriangle,
    RotateCcw,
    FileText,
    Box,
    Layers,
    Check,
    ChevronRight,
    Eye,
    X,
    ShieldAlert,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { cn } from "@/lib/utils";

export function isAnomalyRecordRectified(a: any): boolean {
    if (!a) return false;
    if (a.rectified === true || a.is_rectified === true || a.repaired === true) return true;
    const st = String(a.status || a.anomaly_status || a.raw_status || "").toUpperCase().trim();
    if (st === "RECTIFIED" || st === "CLOSED" || st === "REPAIRED" || st === "RESOLVED") return true;
    if (a.rectified_date || a.rectified_remarks) return true;
    const ref = String(a.display_ref_no || a.anomaly_ref_no || "").trim().toUpperCase();
    if (/\d+R$/i.test(ref)) return true;
    return false;
}

interface Jobpack {
    id: number;
    name: string;
    metadata?: any;
    status?: string;
}

interface AnomalyStatusDialogProps {
    isOpen: boolean;
    onClose: () => void;
    platformId: number;
    platformTitle: string;
    selectedJobpackId: number | null;
    onJobpackChange: (id: number | null) => void;
    selectedSowReportNo?: string | null;
    onSowReportChange?: (reportNo: string | null) => void;
    selectedStatusFilters: string[]; // ["Open", "Rectified"]
    onStatusFiltersChange: (filters: string[]) => void;
    onSelectComponent?: (comp: any) => void;
    onResetColors?: () => void;
}

export function AnomalyStatusDialog({
    isOpen,
    onClose,
    platformId,
    platformTitle,
    selectedJobpackId,
    onJobpackChange,
    selectedSowReportNo = null,
    onSowReportChange,
    selectedStatusFilters,
    onStatusFiltersChange,
    onSelectComponent,
    onResetColors,
}: AnomalyStatusDialogProps) {
    const [jobpackSearchQuery, setJobpackSearchQuery] = useState("");
    const [compSearchQuery, setCompSearchQuery] = useState("");
    const [internalReportFilter, setInternalReportFilter] = useState<string | null>(selectedSowReportNo);

    React.useEffect(() => {
        setInternalReportFilter(selectedSowReportNo);
    }, [selectedSowReportNo]);

    // 1. Fetch Jobpacks for this platform
    const { data: jobpacksData, isLoading: isJobpacksLoading } = useSWR(
        isOpen
            ? `/api/jobpack?has_inspection=true&pageSize=50&structure_id=${platformId}&structure_title=${encodeURIComponent(platformTitle)}`
            : null,
        fetcher
    );
    const jobpacks: Jobpack[] = useMemo(() => jobpacksData?.data || [], [jobpacksData]);

    const filteredJobpacks = useMemo(() => {
        if (!jobpackSearchQuery.trim()) return jobpacks;
        const q = jobpackSearchQuery.toLowerCase();
        return jobpacks.filter(
            (j) => j.name?.toLowerCase().includes(q) || String(j.id).includes(q)
        );
    }, [jobpacks, jobpackSearchQuery]);

    // 2. Fetch SOW for the selected Jobpack to get SOW Report Numbers
    const { data: sowResponse, isLoading: isSowLoading } = useSWR(
        isOpen && selectedJobpackId
            ? `/api/sow?jobpack_id=${selectedJobpackId}&structure_id=${platformId}`
            : null,
        fetcher
    );

    const sow = useMemo(() => {
        if (!sowResponse?.data) return null;
        if (Array.isArray(sowResponse.data)) {
            return sowResponse.data.length > 0 ? sowResponse.data[0] : null;
        }
        return sowResponse.data;
    }, [sowResponse]);

    // 3. Fetch Anomaly Records for the selected Jobpack & Structure
    const { data: anomalyResponse, isLoading: isAnomaliesLoading } = useSWR(
        isOpen && selectedJobpackId
            ? `/api/reports/anomaly-report?jobpack_id=${selectedJobpackId}&structure_id=${platformId}`
            : null,
        fetcher
    );

    const allAnomalies: any[] = useMemo(() => {
        const raw = anomalyResponse?.data;
        if (!Array.isArray(raw)) return [];
        return raw.map((a: any) => {
            const isRect = isAnomalyRecordRectified(a);
            return {
                ...a,
                normalizedStatus: isRect ? "Rectified" : "Open",
            };
        });
    }, [anomalyResponse]);

    // Extract available SOW report numbers from SOW and Anomaly records
    const availableReportNumbers = useMemo(() => {
        const set = new Set<string>();
        if (sow?.report_numbers && Array.isArray(sow.report_numbers)) {
            sow.report_numbers.forEach((r: any) => {
                const num = typeof r === "string" ? r : r?.number;
                if (num && num !== "N/A") set.add(String(num).trim());
            });
        }
        if (sow?.items && Array.isArray(sow.items)) {
            sow.items.forEach((item: any) => {
                if (item.report_number && item.report_number !== "N/A") {
                    set.add(String(item.report_number).trim());
                }
            });
        }
        allAnomalies.forEach((a: any) => {
            if (a.sow_report_no && a.sow_report_no !== "N/A" && a.sow_report_no !== "null") {
                set.add(String(a.sow_report_no).trim());
            }
        });
        return Array.from(set);
    }, [sow, allAnomalies]);

    // Anomalies scoped by the selected SOW Report Number
    const scopedAnomalies = useMemo(() => {
        if (!internalReportFilter) return allAnomalies;
        const cleanFilter = internalReportFilter.replace(/\s+/g, "").toLowerCase();

        // Also build a set of component IDs / QIDs in the selected SOW report scope as fallback when a.sow_report_no is empty
        const sowReportCompIds = new Set<number>();
        const sowReportCompQids = new Set<string>();
        if (sow?.items && Array.isArray(sow.items)) {
            sow.items.forEach((item: any) => {
                const itemRep = String(item.report_number || "").replace(/\s+/g, "").toLowerCase();
                if (itemRep === cleanFilter) {
                    if (item.component_id) sowReportCompIds.add(Number(item.component_id));
                    if (item.component_qid) sowReportCompQids.add(String(item.component_qid).toUpperCase().trim());
                }
            });
        }

        return allAnomalies.filter((a: any) => {
            const cleanRep = String(a.sow_report_no || "").replace(/\s+/g, "").toLowerCase();
            if (cleanRep && cleanRep !== "n/a" && cleanRep !== "null") {
                return cleanRep === cleanFilter;
            }
            const cid = Number(a.component_id);
            const qid = String(a.component_qid || "").toUpperCase().trim();
            return (cid && sowReportCompIds.has(cid)) || (qid && sowReportCompQids.has(qid));
        });
    }, [allAnomalies, internalReportFilter, sow]);

    // Metrics for the selected SOW Report scope
    const metrics = useMemo(() => {
        let openCount = 0;
        let rectifiedCount = 0;
        scopedAnomalies.forEach((a) => {
            if (a.normalizedStatus === "Rectified") rectifiedCount++;
            else openCount++;
        });
        return {
            total: scopedAnomalies.length,
            open: openCount,
            rectified: rectifiedCount,
        };
    }, [scopedAnomalies]);

    // Filtered anomalies for the table
    const filteredAnomalies = useMemo(() => {
        let list = scopedAnomalies;

        // 1. Status filter
        if (selectedStatusFilters.length > 0) {
            list = list.filter((a) => selectedStatusFilters.includes(a.normalizedStatus));
        } else {
            list = [];
        }

        // 2. Search query
        if (compSearchQuery.trim()) {
            const q = compSearchQuery.toLowerCase().trim();
            list = list.filter((a) => {
                const qid = String(a.component_qid || "").toLowerCase();
                const ref = String(a.display_ref_no || a.anomaly_ref_no || "").toLowerCase();
                const defect = String(a.defect_type || a.defect_type_code || "").toLowerCase();
                const cat = String(a.category || a.defect_category_code || "").toLowerCase();
                const prio = String(a.priority || a.priority_code || "").toLowerCase();
                const desc = String(a.description || a.observations || "").toLowerCase();
                const rpt = String(a.sow_report_no || "").toLowerCase();
                return (
                    qid.includes(q) ||
                    ref.includes(q) ||
                    defect.includes(q) ||
                    cat.includes(q) ||
                    prio.includes(q) ||
                    desc.includes(q) ||
                    rpt.includes(q)
                );
            });
        }

        return list;
    }, [scopedAnomalies, selectedStatusFilters, compSearchQuery]);

    const handleToggleStatusFilter = (status: string) => {
        if (selectedStatusFilters.includes(status)) {
            onStatusFiltersChange(selectedStatusFilters.filter((s) => s !== status));
        } else {
            onStatusFiltersChange([...selectedStatusFilters, status]);
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
            if (selectedStatusFilters.length === 0) {
                onStatusFiltersChange(["Open", "Rectified"]);
            }
        }
    };

    const handleSelectReport = (reportNo: string | null) => {
        setInternalReportFilter(reportNo);
        if (onSowReportChange) onSowReportChange(reportNo);
    };

    const handleResetAll = () => {
        onJobpackChange(null);
        handleSelectReport(null);
        onStatusFiltersChange(["Open", "Rectified"]);
        setJobpackSearchQuery("");
        setCompSearchQuery("");
        if (onResetColors) onResetColors();
    };

    const handleFocusComponent = (a: any) => {
        if (onSelectComponent) {
            onSelectComponent({
                id: a.component_id,
                comp_id: a.component_id,
                q_id: a.component_qid || `COMP-${a.component_id}`,
                code: a.component_type || "COMPONENT",
                metadata: {
                    status: a.normalizedStatus,
                    anomaly_ref_no: a.display_ref_no,
                    report_number: a.sow_report_no,
                    last_inspection_date: a.inspection_date,
                },
            });
            onClose();
        }
    };

    const isLoadingData = isSowLoading || isAnomaliesLoading;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[960px] w-[95vw] max-h-[90vh] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-0 overflow-hidden shadow-2xl flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <DialogHeader>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center border border-rose-100 dark:border-rose-800/50 shadow-xs">
                                    <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                                        Platform Anomaly Status
                                    </DialogTitle>
                                    <DialogDescription className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5 flex items-center gap-2">
                                        <span>{platformTitle}</span>
                                        {selectedJobpackId && (
                                            <>
                                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                                <span className="text-rose-600 dark:text-rose-400 font-black">
                                                    Jobpack #{selectedJobpackId}
                                                </span>
                                            </>
                                        )}
                                        {internalReportFilter && (
                                            <>
                                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                                <span className="text-blue-600 dark:text-blue-400 font-black">
                                                    SOW: {internalReportFilter}
                                                </span>
                                            </>
                                        )}
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        {/* Top Action Controls: Open / Rectified Toggles & Reset Colors */}
                        <div className="flex flex-wrap items-center gap-2 mr-8 sm:mr-12">
                            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                                {[
                                    {
                                        id: "Open",
                                        label: "Open",
                                        color: "bg-red-500",
                                        activeBg:
                                            "bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300",
                                    },
                                    {
                                        id: "Rectified",
                                        label: "Rectified",
                                        color: "bg-emerald-500",
                                        activeBg:
                                            "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300",
                                    },
                                ].map((st) => {
                                    const isChecked = selectedStatusFilters.includes(st.id);
                                    return (
                                        <div
                                            key={st.id}
                                            onClick={() => handleToggleStatusFilter(st.id)}
                                            className={cn(
                                                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border select-none cursor-pointer",
                                                isChecked
                                                    ? cn("bg-white dark:bg-slate-900 shadow-2xs", st.activeBg)
                                                    : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 opacity-60"
                                            )}
                                        >
                                            <Checkbox
                                                checked={isChecked}
                                                onCheckedChange={() => handleToggleStatusFilter(st.id)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-3.5 h-3.5 rounded data-[state=checked]:bg-rose-600 data-[state=checked]:border-rose-600"
                                            />
                                            <div className={cn("w-2 h-2 rounded-full", st.color)} />
                                            <span>{st.label}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleResetAll}
                                className="h-9 px-3 gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-xs"
                                title="Reset anomaly filters and restore standard 3D colors"
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
                                <Layers className="w-3.5 h-3.5 text-rose-500" />
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
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5 pr-1 min-h-[240px] max-h-[420px]">
                            {isJobpacksLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="w-8 h-8 border-2 border-slate-200 border-t-rose-500 rounded-full animate-spin mb-2" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        Loading Jobpacks...
                                    </p>
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
                                                    ? "bg-rose-50/80 border-rose-300 dark:bg-rose-950/30 dark:border-rose-700/60 shadow-md ring-2 ring-rose-500/20"
                                                    : "bg-white border-slate-200 hover:border-rose-300 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-rose-800 shadow-2xs"
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2 mb-1.5 relative z-10">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className={cn(
                                                                "text-[9px] font-black uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-md",
                                                                isSelected
                                                                    ? "bg-rose-200/80 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300"
                                                                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                                            )}
                                                        >
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
                                                <div
                                                    className={cn(
                                                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors mt-0.5",
                                                        isSelected
                                                            ? "border-rose-600 bg-rose-600 text-white"
                                                            : "border-slate-300 dark:border-slate-700 group-hover:border-rose-400"
                                                    )}
                                                >
                                                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium relative z-10 mt-2">
                                                <span className="flex items-center gap-1">
                                                    <FileText className="w-3 h-3" />
                                                    <span>Inspection & Anomaly Scope</span>
                                                </span>
                                                <span
                                                    className={cn(
                                                        "text-[10px] font-bold flex items-center gap-0.5",
                                                        isSelected
                                                            ? "text-rose-600 dark:text-rose-400"
                                                            : "text-slate-500"
                                                    )}
                                                >
                                                    {isSelected ? "Active Selection" : "Select Jobpack"}
                                                    <ChevronRight className="w-3 h-3 inline-block" />
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                                    <Layers className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                        No Jobpacks found
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        No inspection jobpacks linked to this platform
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: SOW Report Scope & Anomaly List */}
                    <div className="md:col-span-7 p-5 flex flex-col min-h-0 bg-white dark:bg-slate-900">
                        {selectedJobpackId ? (
                            <div className="flex flex-col h-full min-h-0">
                                {/* SOW Report Scope Tabs */}
                                <div className="mb-3.5 shrink-0">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1.5">
                                            <FileText className="w-3.5 h-3.5 text-blue-500" />
                                            <span>
                                                2. Select SOW Report Scope ({availableReportNumbers.length || "All"})
                                            </span>
                                        </label>
                                    </div>

                                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 max-w-full custom-scrollbar">
                                        <button
                                            type="button"
                                            onClick={() => handleSelectReport(null)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer",
                                                internalReportFilter === null
                                                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700"
                                            )}
                                        >
                                            All SOW Reports ({allAnomalies.length})
                                        </button>
                                        {availableReportNumbers.map((rptNo) => {
                                            const isRptSelected = internalReportFilter === rptNo;
                                            const cleanRpt = rptNo.replace(/\s+/g, "").toLowerCase();
                                            const rptAnomCount = allAnomalies.filter(
                                                (a) =>
                                                    String(a.sow_report_no || "")
                                                        .replace(/\s+/g, "")
                                                        .toLowerCase() === cleanRpt
                                            ).length;
                                            return (
                                                <button
                                                    key={rptNo}
                                                    type="button"
                                                    onClick={() => handleSelectReport(rptNo)}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer flex items-center gap-1.5",
                                                        isRptSelected
                                                            ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                                            : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700"
                                                    )}
                                                >
                                                    <span>{rptNo}</span>
                                                    <span
                                                        className={cn(
                                                            "text-[10px] px-1 rounded",
                                                            isRptSelected
                                                                ? "bg-white/20 text-white"
                                                                : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300"
                                                        )}
                                                    >
                                                        {rptAnomCount}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Anomaly Metrics Bar (Open = Red, Rectified = Green) */}
                                <div className="grid grid-cols-3 gap-2 mb-3.5 shrink-0">
                                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
                                        <span className="text-base font-black text-slate-900 dark:text-white leading-none">
                                            {metrics.total}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                                            Total Anomalies
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleToggleStatusFilter("Open")}
                                        className={cn(
                                            "p-2.5 rounded-xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer",
                                            selectedStatusFilters.includes("Open")
                                                ? "bg-red-50/80 dark:bg-red-950/30 border-red-300 dark:border-red-800/70 ring-1 ring-red-500/30"
                                                : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 opacity-50"
                                        )}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                                            <span className="text-base font-black text-red-600 dark:text-red-400 leading-none">
                                                {metrics.open}
                                            </span>
                                        </div>
                                        <span className="text-[9px] font-bold text-red-600/80 dark:text-red-400/80 uppercase tracking-wider mt-1">
                                            Open (Red)
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleToggleStatusFilter("Rectified")}
                                        className={cn(
                                            "p-2.5 rounded-xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer",
                                            selectedStatusFilters.includes("Rectified")
                                                ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/70 ring-1 ring-emerald-500/30"
                                                : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 opacity-50"
                                        )}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                            <span className="text-base font-black text-emerald-600 dark:text-emerald-400 leading-none">
                                                {metrics.rectified}
                                            </span>
                                        </div>
                                        <span className="text-[9px] font-bold text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-wider mt-1">
                                            Rectified (Green)
                                        </span>
                                    </button>
                                </div>

                                {/* Component Search & Count */}
                                <div className="flex items-center justify-between gap-3 mb-2.5 shrink-0">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                        <Input
                                            placeholder="Search component QID, anomaly ref, defect type..."
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
                                        Showing {filteredAnomalies.length} of {scopedAnomalies.length}
                                    </span>
                                </div>

                                {/* Anomaly Components Table */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-800 rounded-2xl min-h-0 bg-white dark:bg-slate-950">
                                    {isLoadingData ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-center">
                                            <div className="w-8 h-8 border-2 border-slate-200 border-t-rose-500 rounded-full animate-spin mb-2" />
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                Loading Anomaly Data...
                                            </p>
                                        </div>
                                    ) : filteredAnomalies.length > 0 ? (
                                        <table className="w-full text-left border-collapse">
                                            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 z-10">
                                                <tr>
                                                    <th className="py-2.5 px-3 text-[9px] font-black uppercase tracking-wider text-slate-400">
                                                        Component
                                                    </th>
                                                    <th className="py-2.5 px-3 text-[9px] font-black uppercase tracking-wider text-slate-400">
                                                        Anomaly Ref
                                                    </th>
                                                    <th className="py-2.5 px-3 text-[9px] font-black uppercase tracking-wider text-slate-400">
                                                        Defect / Priority
                                                    </th>
                                                    <th className="py-2.5 px-3 text-[9px] font-black uppercase tracking-wider text-slate-400">
                                                        Status
                                                    </th>
                                                    <th className="py-2.5 px-3 text-[9px] font-black uppercase tracking-wider text-slate-400 text-right">
                                                        Action
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                                                {filteredAnomalies.map((item, idx) => {
                                                    const isRect = item.normalizedStatus === "Rectified";
                                                    return (
                                                        <tr
                                                            key={`anom-row-${item.anomaly_id || item.id || idx}`}
                                                            className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors"
                                                        >
                                                            <td className="py-2.5 px-3">
                                                                <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                                                    <Box className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                                    <span>
                                                                        {item.component_qid || `ID #${item.component_id}`}
                                                                    </span>
                                                                </div>
                                                                {item.sow_report_no && (
                                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                                        {item.sow_report_no}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="py-2.5 px-3">
                                                                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold text-[10px]">
                                                                    {item.display_ref_no || item.anomaly_ref_no || "N/A"}
                                                                </span>
                                                            </td>
                                                            <td className="py-2.5 px-3">
                                                                <div className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                                                                    {item.defect_type || item.defect_type_code || "Anomaly"}
                                                                </div>
                                                                {item.priority && (
                                                                    <span className="text-[9px] font-black uppercase text-slate-400">
                                                                        {item.priority}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="py-2.5 px-3">
                                                                <span
                                                                    className={cn(
                                                                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                                                                        isRect
                                                                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
                                                                            : "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800/50"
                                                                    )}
                                                                >
                                                                    {isRect ? (
                                                                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                                    ) : (
                                                                        <AlertTriangle className="w-3 h-3 text-red-500" />
                                                                    )}
                                                                    <span>{isRect ? "Rectified" : "Open"}</span>
                                                                </span>
                                                            </td>
                                                            <td className="py-2.5 px-3 text-right">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleFocusComponent(item)}
                                                                    className="h-7 px-2.5 rounded-lg text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50 gap-1"
                                                                >
                                                                    <Eye className="w-3 h-3" />
                                                                    <span>Focus 3D</span>
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                                            <ShieldAlert className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
                                            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                                No matching anomalies in this scope
                                            </p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                Try switching SOW report tabs or adjusting the Open / Rectified filter toggles
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50/40 dark:bg-slate-950/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 flex items-center justify-center text-rose-500 mb-3">
                                    <ShieldAlert className="w-6 h-6" />
                                </div>
                                <h4 className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">
                                    No Jobpack Selected
                                </h4>
                                <p className="text-xs text-slate-400 max-w-xs mt-1 font-medium">
                                    Select a Jobpack from the left panel, then choose a SOW Report Scope to highlight{" "}
                                    <strong className="text-red-500">Open (Red)</strong> and{" "}
                                    <strong className="text-emerald-500">Rectified (Green)</strong> anomalies on the 3D platform.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500">
                        <span className="uppercase tracking-widest text-slate-400">3D Anomaly Legend:</span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shadow-xs" />
                            <span>Open Anomaly (Red)</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-xs" />
                            <span>Rectified Anomaly (Green)</span>
                        </span>
                        <span className="text-slate-400 italic">
                            • Non-anomaly components keep their default colour
                        </span>
                    </div>

                    <Button
                        onClick={onClose}
                        className="h-9 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-black uppercase tracking-wider"
                    >
                        Apply & View 3D
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
