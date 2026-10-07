"use client";

import React, { useMemo } from "react";
import { 
    ExternalLink, 
    X, 
    CheckCircle2, 
    AlertTriangle, 
    Clock, 
    Layers, 
    FileText, 
    Activity, 
    Calendar,
    Sparkles,
    ShieldCheck,
    ClipboardCheck
} from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { cn } from "@/lib/utils";

interface InspectionStatusOverlayProps {
    platformId: number;
    platformTitle: string;
    component: {
        id: number;
        comp_id?: number;
        q_id: string;
        code?: string | null;
        metadata?: any;
    };
    jobpackId: number | null;
    jobpackName?: string | null;
    sowReportNo?: string | null;
    sowItems: any[];
    onClose: () => void;
}

export function InspectionStatusOverlay({
    platformId,
    platformTitle,
    component,
    jobpackId,
    jobpackName,
    sowReportNo,
    sowItems = [],
    onClose,
}: InspectionStatusOverlayProps) {
    const compId = component.id || component.comp_id;
    const compQId = (component.q_id || "").trim();
    const compCode = (component.code || "COMPONENT").trim().toUpperCase();

    // 1. Match SOW items for this component
    const matchedSowItems = useMemo(() => {
        if (!sowItems || sowItems.length === 0) return [];
        return sowItems.filter((item: any) => {
            const matchesId = item.component_id && compId && Number(item.component_id) === Number(compId);
            const itemQId = (item.component_qid || "").toUpperCase().trim();
            const targetQId = compQId.toUpperCase().trim();
            const matchesQId = itemQId && targetQId && itemQId === targetQId;
            return matchesId || matchesQId;
        });
    }, [sowItems, compId, compQId]);

    // Primary matched SOW item
    const primarySowItem = matchedSowItems.length > 0 ? matchedSowItems[0] : null;

    // 2. Fetch existing inspection record (insp_records) for this component + jobpack to get insp_id
    const { data: recordsData } = useSWR(
        jobpackId && platformId 
            ? `/api/inspection-records?jobpack_id=${jobpackId}&structure_id=${platformId}${sowReportNo ? `&sow_report_no=${encodeURIComponent(sowReportNo)}` : ""}`
            : null,
        fetcher
    );

    const matchedRecord = useMemo(() => {
        const records = recordsData?.data || [];
        if (!Array.isArray(records) || records.length === 0) return null;
        return records.find((r: any) => {
            const rCompId = r.structure_components?.id || r.component_id;
            const rCompQId = (r.structure_components?.q_id || r.component_qid || "").toUpperCase().trim();
            const matchesId = rCompId && compId && Number(rCompId) === Number(compId);
            const matchesQId = rCompQId && compQId && rCompQId === compQId.toUpperCase().trim();
            return matchesId || matchesQId;
        }) || null;
    }, [recordsData, compId, compQId]);

    // 3. Determine Normalized Inspection Status
    const normalizedStatus = useMemo(() => {
        const rawStatus = (
            primarySowItem?.status || 
            matchedRecord?.status || 
            component.metadata?.status || 
            (matchedRecord?.has_anomaly ? "Incomplete" : matchedRecord ? "Completed" : "Pending")
        ).toString().toLowerCase().trim();

        if (rawStatus === "completed" || rawStatus === "complete" || rawStatus === "done") {
            return "Completed";
        }
        if (rawStatus === "incomplete" || rawStatus === "anomaly" || rawStatus === "anomalies" || rawStatus === "defect") {
            return "Incomplete";
        }
        return "Pending";
    }, [primarySowItem, matchedRecord, component]);

    // Detected SOW Report
    const effectiveSowReport = sowReportNo || primarySowItem?.report_number || "ALL SOW";

    // Build Workspace Edit Redirect URL (opens in new tab)
    const handleRedirectToWorkspace = (e: React.MouseEvent) => {
        e.stopPropagation();

        const params = new URLSearchParams();
        if (jobpackId) params.set("jobpack", String(jobpackId));
        if (platformId) params.set("structure", String(platformId));
        if (primarySowItem?.sow_id) params.set("sow", String(primarySowItem.sow_id));
        if (primarySowItem?.report_number || (sowReportNo && sowReportNo !== "all")) {
            params.set("sowReport", primarySowItem?.report_number || sowReportNo || "");
        }
        if (compId) params.set("compId", String(compId));
        if (matchedRecord?.insp_id) {
            params.set("recordId", String(matchedRecord.insp_id));
        }

        const workspaceUrl = `/dashboard/inspection-v2/workspace?${params.toString()}`;
        window.open(workspaceUrl, "_blank", "noopener,noreferrer");
    };

    return (
        <div 
            className="absolute bottom-4 left-6 right-6 max-w-4xl mx-auto z-40 bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-xl border border-slate-700/80 dark:border-slate-800/90 rounded-2xl p-3.5 sm:p-4 shadow-2xl text-slate-100 animate-in slide-in-from-bottom-3 fade-in duration-200 transition-all pointer-events-auto"
            style={{
                boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 25px -5px rgba(37, 99, 235, 0.15)"
            }}
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
                {/* Left Section: QID, Type, Jobpack & SOW badges */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4 min-w-0">
                    {/* Component Info */}
                    <div className="flex items-center gap-2.5 shrink-0">
                        <div className={cn(
                            "w-3 h-3 rounded-full shrink-0 animate-pulse shadow-sm",
                            normalizedStatus === "Completed" && "bg-emerald-500 shadow-emerald-500/50",
                            normalizedStatus === "Incomplete" && "bg-amber-500 shadow-amber-500/50",
                            normalizedStatus === "Pending" && "bg-blue-500 shadow-blue-500/50"
                        )} />
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-black uppercase tracking-wider text-white truncate max-w-[200px]" title={compQId}>
                                    {compQId || `COMP-${compId}`}
                                </span>
                                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-blue-950/80 text-blue-300 border border-blue-800/80 shrink-0">
                                    {compCode}
                                </span>
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate max-w-[220px]">
                                {platformTitle}
                            </div>
                        </div>
                    </div>

                    <div className="hidden sm:block h-7 w-[1px] bg-slate-700/60 shrink-0" />

                    {/* Detected Jobpack & SOW Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        {jobpackId && (
                            <div className="px-2 py-1 rounded-lg bg-purple-950/70 border border-purple-800/70 text-[10px] font-black uppercase text-purple-300 flex items-center gap-1.5 shadow-xs shrink-0" title={`Active Jobpack ID: ${jobpackId}`}>
                                <Activity className="w-3 h-3 text-purple-400 shrink-0" />
                                <span className="truncate max-w-[130px]">{jobpackName || `Jobpack #${jobpackId}`}</span>
                            </div>
                        )}

                        <div className="px-2 py-1 rounded-lg bg-blue-950/70 border border-blue-800/70 text-[10px] font-black uppercase text-blue-300 flex items-center gap-1.5 shadow-xs shrink-0" title={`SOW Report: ${effectiveSowReport}`}>
                            <FileText className="w-3 h-3 text-blue-400 shrink-0" />
                            <span className="truncate max-w-[140px]">SOW: {effectiveSowReport}</span>
                        </div>

                        {/* Task badges if available */}
                        {matchedSowItems.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                                {matchedSowItems.slice(0, 2).map((item: any, idx: number) => {
                                    const code = item.inspection_code || item.inspection_name || "TASK";
                                    return (
                                        <span 
                                            key={`task-badge-${item.id || idx}`}
                                            className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-teal-950/80 text-teal-300 border border-teal-800/70"
                                            title={item.inspection_name || code}
                                        >
                                            {code}
                                        </span>
                                    );
                                })}
                                {matchedSowItems.length > 2 && (
                                    <span className="text-[9px] font-bold text-slate-400">
                                        +{matchedSowItems.length - 2} more
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Section: Status Indicator & Action Buttons */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                    {/* Basic Inspection Status Badge */}
                    <div className="flex items-center gap-2">
                        {normalizedStatus === "Completed" && (
                            <div className="px-2.5 py-1 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider shadow-sm">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>Inspected</span>
                            </div>
                        )}

                        {normalizedStatus === "Incomplete" && (
                            <div className="px-2.5 py-1 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-300 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider shadow-sm">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span>Anomaly / Incomplete</span>
                            </div>
                        )}

                        {normalizedStatus === "Pending" && (
                            <div className="px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-600/50 text-slate-300 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider shadow-sm">
                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>Not Inspected</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5">
                        {/* Custom Redirect Button (Styled matching the user's provided picture) */}
                        <button
                            type="button"
                            onClick={handleRedirectToWorkspace}
                            className="group relative h-9 w-9 flex items-center justify-center rounded-xl bg-blue-950/80 hover:bg-blue-600 border border-blue-500/50 hover:border-blue-400 text-blue-400 hover:text-white transition-all duration-200 shadow-md shadow-blue-950/60 hover:scale-105 active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            title={
                                matchedRecord?.insp_id
                                    ? `Open Edit Page for Inspection Record #${matchedRecord.insp_id} in Workspace (New Tab)`
                                    : `Open Inspection Workspace for ${compQId} (New Tab)`
                            }
                        >
                            <ExternalLink className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                            <span className="sr-only">Open Edit Page in Inspection Workspace</span>
                        </button>

                        {/* Close / Dismiss Button */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                            }}
                            className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent hover:border-slate-700 transition-colors cursor-pointer"
                            title="Dismiss overlay"
                        >
                            <X className="w-4 h-4" />
                            <span className="sr-only">Close</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
