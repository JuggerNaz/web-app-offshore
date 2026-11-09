"use client";

import React, { useMemo, useState } from "react";
import {
    ExternalLink,
    X,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Layers,
    FileText,
    Activity,
    Briefcase,
    Video,
    Image as ImageIcon,
    ClipboardList,
    ShieldAlert,
    ChevronDown,
    ChevronUp,
    Loader2,
    FolderOpen,
    Film,
} from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { cn } from "@/lib/utils";
import { isAnomalyRecordRectified } from "@/components/dialogs/anomaly-status-dialog";

interface InspectionStatusOverlayProps {
    platformId: number;
    platformTitle: string;
    component: {
        id: number;
        comp_id?: number;
        q_id: string;
        code?: string | null;
        metadata?: any;
        inspections?: any[];
        anomalies?: any[];
    };
    jobpackId: number | null;
    jobpackName?: string | null;
    sowReportNo?: string | null;
    sowItems: any[];
    onClose: () => void;
}

type QidTabKey = "ALL" | "JOBPACKS" | "REPORTS" | "INSPECTIONS" | "ANOMALIES" | "VIDEOS" | "PHOTOS";

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
    const [activeTab, setActiveTab] = useState<QidTabKey>("ALL");
    const [isExpanded, setIsExpanded] = useState(true);

    const compId = component.id || component.comp_id;
    const compQId = (component.q_id || "").trim();
    const compCode = (component.code || "COMPONENT").trim().toUpperCase();

    // Fetch all related QID details from our dedicated endpoint
    const { data: qidDetailsRes, isLoading: isQidDetailsLoading } = useSWR(
        platformId && (compId || compQId)
            ? `/api/structure-components/qid-details?structure_id=${platformId}&component_id=${compId || ""}&q_id=${encodeURIComponent(compQId)}`
            : null,
        fetcher
    );

    const qidData = qidDetailsRes?.data;

    // 1. Match SOW items from active filter prop (if any)
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

    const primarySowItem = matchedSowItems.length > 0 ? matchedSowItems[0] : null;

    // 2. Consolidated Related Lists
    const jobpacks = useMemo(() => {
        const list: any[] = qidData?.jobpacks ? [...qidData.jobpacks] : [];
        if (jobpackId && !list.some((j) => Number(j.id) === Number(jobpackId))) {
            list.unshift({
                id: jobpackId,
                name: jobpackName || `Jobpack #${jobpackId}`,
                status: "ACTIVE",
            });
        }
        return list;
    }, [qidData?.jobpacks, jobpackId, jobpackName]);

    const reports = useMemo(() => {
        const list: any[] = qidData?.reports ? [...qidData.reports] : [];
        matchedSowItems.forEach((s) => {
            const repNo = s.report_number || sowReportNo;
            if (repNo && !list.some((r) => r.report_number === repNo)) {
                list.unshift({
                    id: `sow-${repNo}`,
                    report_number: repNo,
                    jobpack_id: jobpackId,
                    jobpack_name: jobpackName || (jobpackId ? `Jobpack #${jobpackId}` : "Active Scope"),
                    inspection_code: s.inspection_code,
                    inspection_name: s.inspection_name,
                    status: s.status || "Pending",
                });
            }
        });
        return list;
    }, [qidData?.reports, matchedSowItems, sowReportNo, jobpackId, jobpackName]);

    const inspections = useMemo(() => {
        if (qidData?.inspections && qidData.inspections.length > 0) {
            return qidData.inspections;
        }
        return Array.isArray(component.inspections) ? component.inspections : [];
    }, [qidData?.inspections, component.inspections]);

    const anomalies = useMemo(() => {
        const rawList =
            qidData?.anomalies && qidData.anomalies.length > 0
                ? qidData.anomalies
                : Array.isArray(component.anomalies)
                ? component.anomalies
                : [];
        return rawList.map((a: any) => ({
            ...a,
            isRectified: isAnomalyRecordRectified(a),
        }));
    }, [qidData?.anomalies, component.anomalies]);

    const videos = useMemo(() => {
        return Array.isArray(qidData?.videos) ? qidData.videos : [];
    }, [qidData?.videos]);

    const photos = useMemo(() => {
        return Array.isArray(qidData?.photos) ? qidData.photos : [];
    }, [qidData?.photos]);

    const totalRelatedCount =
        jobpacks.length +
        reports.length +
        inspections.length +
        anomalies.length +
        videos.length +
        photos.length;

    // 3. Determine Normalized Inspection Status for the header indicator
    const normalizedStatus = useMemo(() => {
        if (anomalies.some((a: any) => !a.isRectified)) {
            return "Open Anomaly";
        }
        if (anomalies.length > 0 && anomalies.every((a: any) => a.isRectified)) {
            return "Rectified";
        }
        const latestInsp = inspections[0];
        const rawStatus = (
            primarySowItem?.status ||
            latestInsp?.status ||
            component.metadata?.status ||
            (latestInsp?.has_anomaly ? "Incomplete" : latestInsp ? "Completed" : "Pending")
        )
            .toString()
            .toLowerCase()
            .trim();

        if (rawStatus === "completed" || rawStatus === "complete" || rawStatus === "done") {
            return "Completed";
        }
        if (rawStatus === "incomplete" || rawStatus === "anomaly" || rawStatus === "anomalies" || rawStatus === "defect") {
            return "Incomplete";
        }
        return "Pending";
    }, [anomalies, inspections, primarySowItem, component.metadata]);

    // Navigation helper — always opens in a new tab
    const openInNewTab = (url: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        window.open(url, "_blank", "noopener,noreferrer");
    };

    const getJobpackUrl = (jp: any) => {
        return jp?.id ? `/dashboard/jobpack/${jp.id}` : `/dashboard/jobpack`;
    };

    const getReportUrl = (rpt?: any) => {
        const params = new URLSearchParams();
        if (platformId) params.set("structureId", String(platformId));
        const jpId = rpt?.jobpack_id || jobpackId;
        if (jpId) params.set("jobpackId", String(jpId));
        const repNo = rpt?.report_number || sowReportNo;
        if (repNo && repNo !== "ALL SOW" && repNo !== "all") {
            params.set("sowReportNo", String(repNo));
        }
        if (compId) params.set("componentId", String(compId));
        if (compQId) params.set("qId", compQId);
        return `/dashboard/reports?${params.toString()}`;
    };

    const getInspectionWorkspaceUrl = (insp?: any, tapeId?: number | string) => {
        const params = new URLSearchParams();
        const jpId = insp?.jobpack_id || jobpackId || jobpacks[0]?.id;
        if (jpId) params.set("jobpack", String(jpId));
        if (platformId) params.set("structure", String(platformId));
        if (insp?.jobpack_name || jobpackName) {
            params.set("jpName", String(insp?.jobpack_name || jobpackName));
        }
        const repNo = insp?.sow_report_no || primarySowItem?.report_number || sowReportNo;
        if (repNo && repNo !== "ALL SOW" && repNo !== "all") {
            params.set("sowReport", String(repNo));
        }
        if (compId) params.set("compId", String(compId));
        const recId = insp?.insp_id || insp?.id;
        if (recId) params.set("recordId", String(recId));
        if (tapeId) params.set("tapeId", String(tapeId));
        return `/dashboard/inspection-v2/workspace?${params.toString()}`;
    };

    const getAnomalyUrl = (anom?: any) => {
        const params = new URLSearchParams();
        const aid = anom?.anomaly_id || anom?.id;
        if (aid) params.set("id", String(aid));
        if (platformId) params.set("structure_id", String(platformId));
        if (compQId) params.set("q", compQId);
        return `/dashboard/utilities/anomalies-findings?${params.toString()}`;
    };

    const getAttachmentsUrl = () => {
        const params = new URLSearchParams();
        if (platformId) params.set("platformId", String(platformId));
        if (compQId) params.set("q", compQId);
        return `/dashboard/utilities/attachments?${params.toString()}`;
    };

    const tabs: { key: QidTabKey; label: string; count: number; icon: any; accent: string }[] = [
        { key: "ALL", label: "All Related", count: totalRelatedCount, icon: Layers, accent: "text-blue-400" },
        { key: "JOBPACKS", label: "Jobpacks", count: jobpacks.length, icon: Briefcase, accent: "text-purple-400" },
        { key: "REPORTS", label: "Reports", count: reports.length, icon: FileText, accent: "text-sky-400" },
        { key: "INSPECTIONS", label: "Inspection Data", count: inspections.length, icon: ClipboardList, accent: "text-emerald-400" },
        { key: "ANOMALIES", label: "Anomalies", count: anomalies.length, icon: ShieldAlert, accent: "text-red-400" },
        { key: "VIDEOS", label: "Videos", count: videos.length, icon: Video, accent: "text-amber-400" },
        { key: "PHOTOS", label: "Photos", count: photos.length, icon: ImageIcon, accent: "text-pink-400" },
    ];

    return (
        <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-3 left-4 right-4 max-w-5xl mx-auto z-40 bg-slate-900/80 dark:bg-slate-950/85 backdrop-blur-xl border border-slate-700/75 rounded-2xl shadow-2xl text-slate-100 animate-in slide-in-from-bottom-3 fade-in duration-200 transition-all pointer-events-auto overflow-hidden"
            style={{
                boxShadow: "0 20px 45px -15px rgba(0, 0, 0, 0.75), 0 0 25px -5px rgba(37, 99, 235, 0.2)",
            }}
        >
            {/* Top Header Bar */}
            <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950/40">
                <div className="flex items-center gap-3 min-w-0">
                    <div
                        className={cn(
                            "w-2.5 h-2.5 rounded-full shrink-0 animate-pulse",
                            normalizedStatus === "Open Anomaly" && "bg-red-500 shadow-[0_0_8px_#ef4444]",
                            normalizedStatus === "Rectified" && "bg-emerald-500 shadow-[0_0_8px_#22c55e]",
                            normalizedStatus === "Completed" && "bg-emerald-500 shadow-[0_0_8px_#22c55e]",
                            normalizedStatus === "Incomplete" && "bg-amber-500 shadow-[0_0_8px_#f59e0b]",
                            normalizedStatus === "Pending" && "bg-blue-400 shadow-[0_0_8px_#60a5fa]"
                        )}
                    />
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-black uppercase tracking-wider text-blue-400 shrink-0">
                            QID Details:
                        </span>
                        <span
                            className="text-sm font-black uppercase tracking-wider text-white truncate max-w-[220px]"
                            title={compQId}
                        >
                            {compQId || `COMP-${compId}`}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-blue-950/90 text-blue-300 border border-blue-800/80 shrink-0">
                            {compCode}
                        </span>
                        <span className="hidden md:inline-block text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[180px]">
                            · {platformTitle}
                        </span>
                    </div>

                    {isQidDetailsLoading && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-blue-300">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Loading related items...</span>
                        </div>
                    )}
                </div>

                {/* Status Badge & Quick Module Links + Window Controls */}
                <div className="flex items-center gap-2 shrink-0">
                    {normalizedStatus === "Open Anomaly" && (
                        <span className="px-2 py-0.5 rounded-lg bg-red-950/90 border border-red-500/60 text-red-300 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider">
                            <AlertTriangle className="w-3 h-3 text-red-400" />
                            Open Anomaly
                        </span>
                    )}
                    {normalizedStatus === "Rectified" && (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Rectified
                        </span>
                    )}
                    {normalizedStatus === "Completed" && (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Inspected
                        </span>
                    )}
                    {normalizedStatus === "Incomplete" && (
                        <span className="px-2 py-0.5 rounded-lg bg-amber-950/80 border border-amber-500/50 text-amber-300 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            Incomplete
                        </span>
                    )}
                    {normalizedStatus === "Pending" && (
                        <span className="px-2 py-0.5 rounded-lg bg-slate-800/80 border border-slate-600/50 text-slate-300 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider">
                            <Clock className="w-3 h-3 text-slate-400" />
                            Pending
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={(e) => openInNewTab(getInspectionWorkspaceUrl(inspections[0]), e)}
                        className="h-7 px-2.5 rounded-lg bg-blue-600/90 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                        title={`Open Inspection Workspace for ${compQId} in a new tab`}
                    >
                        <span>Workspace</span>
                        <ExternalLink className="w-3 h-3" />
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsExpanded((prev) => !prev)}
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-700/60 transition-colors cursor-pointer"
                        title={isExpanded ? "Minimize window" : "Expand window"}
                    >
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                    </button>

                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-red-950/60 border border-transparent hover:border-red-800/60 transition-colors cursor-pointer"
                        title="Close QID Details"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {isExpanded && (
                <>
                    {/* Category Tabs Bar */}
                    <div className="px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto border-b border-slate-800/70 bg-slate-900/50 no-scrollbar">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActiveTab(tab.key)}
                                    className={cn(
                                        "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 cursor-pointer border",
                                        isActive
                                            ? "bg-blue-600/25 border-blue-500/70 text-white shadow-sm"
                                            : "bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                                    )}
                                >
                                    <Icon className={cn("w-3 h-3 shrink-0", isActive ? "text-blue-400" : tab.accent)} />
                                    <span>{tab.label}</span>
                                    <span
                                        className={cn(
                                            "px-1.5 py-0.2 rounded-full text-[9px] font-black",
                                            isActive
                                                ? "bg-blue-500 text-white"
                                                : tab.count > 0
                                                ? "bg-slate-800 text-slate-200"
                                                : "bg-slate-900 text-slate-500"
                                        )}
                                    >
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Scrollable Related Items Content (Compact Bottom Window) */}
                    <div className="p-3 max-h-[185px] overflow-y-auto space-y-2">
                        {totalRelatedCount === 0 && !isQidDetailsLoading && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-4 rounded-xl bg-slate-950/50 border border-slate-800/80">
                                <div className="text-xs text-slate-400 font-medium">
                                    No historical jobpack, report, media, or inspection records linked directly to{" "}
                                    <strong className="text-white">{compQId}</strong> yet. Click any module below to open it in a new tab:
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                    <button
                                        type="button"
                                        onClick={(e) => openInNewTab(`/dashboard/jobpack`, e)}
                                        className="px-2.5 py-1 rounded-lg bg-purple-950/70 hover:bg-purple-900 border border-purple-700/60 text-purple-200 text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer"
                                    >
                                        <Briefcase className="w-3 h-3" /> Jobpacks <ExternalLink className="w-2.5 h-2.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => openInNewTab(getReportUrl(), e)}
                                        className="px-2.5 py-1 rounded-lg bg-sky-950/70 hover:bg-sky-900 border border-sky-700/60 text-sky-200 text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer"
                                    >
                                        <FileText className="w-3 h-3" /> Reports <ExternalLink className="w-2.5 h-2.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => openInNewTab(getInspectionWorkspaceUrl(), e)}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-200 text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer"
                                    >
                                        <ClipboardList className="w-3 h-3" /> Inspection <ExternalLink className="w-2.5 h-2.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => openInNewTab(getAttachmentsUrl(), e)}
                                        className="px-2.5 py-1 rounded-lg bg-pink-950/70 hover:bg-pink-900 border border-pink-700/60 text-pink-200 text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer"
                                    >
                                        <FolderOpen className="w-3 h-3" /> Attachments <ExternalLink className="w-2.5 h-2.5" />
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {/* JOBPACKS */}
                            {(activeTab === "ALL" || activeTab === "JOBPACKS") &&
                                jobpacks.map((jp: any, idx: number) => (
                                    <button
                                        key={`jp-${jp.id || idx}`}
                                        type="button"
                                        onClick={(e) => openInNewTab(getJobpackUrl(jp), e)}
                                        className="group text-left p-2.5 rounded-xl bg-slate-950/60 hover:bg-purple-950/40 border border-slate-800/90 hover:border-purple-500/60 transition-all flex items-center justify-between gap-2 cursor-pointer"
                                        title={`Click to open Jobpack "${jp.name}" in Jobpack Module (New Tab)`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-7 h-7 rounded-lg bg-purple-950/80 border border-purple-700/50 flex items-center justify-center shrink-0">
                                                <Briefcase className="w-3.5 h-3.5 text-purple-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[9px] font-black uppercase tracking-wider text-purple-400">
                                                        Jobpack
                                                    </span>
                                                    {jp.status && (
                                                        <span className="px-1 py-0.2 rounded text-[8px] font-bold uppercase bg-slate-800 text-slate-300">
                                                            {jp.status}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs font-black text-white truncate">
                                                    {jp.name || `Jobpack #${jp.id}`}
                                                </div>
                                                {jp.task_count ? (
                                                    <div className="text-[10px] text-slate-400 truncate">
                                                        {jp.task_count} SOW task(s) · {jp.report_numbers?.join(", ") || "All Scope"}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                        <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-300 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                                    </button>
                                ))}

                            {/* REPORTS */}
                            {(activeTab === "ALL" || activeTab === "REPORTS") &&
                                reports.map((rpt: any, idx: number) => (
                                    <button
                                        key={`rpt-${rpt.id || rpt.report_number || idx}`}
                                        type="button"
                                        onClick={(e) => openInNewTab(getReportUrl(rpt), e)}
                                        className="group text-left p-2.5 rounded-xl bg-slate-950/60 hover:bg-sky-950/40 border border-slate-800/90 hover:border-sky-500/60 transition-all flex items-center justify-between gap-2 cursor-pointer"
                                        title={`Click to open Report "${rpt.report_number}" in Reports Module (New Tab)`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-7 h-7 rounded-lg bg-sky-950/80 border border-sky-700/50 flex items-center justify-center shrink-0">
                                                <FileText className="w-3.5 h-3.5 text-sky-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[9px] font-black uppercase tracking-wider text-sky-400">
                                                        SOW Report
                                                    </span>
                                                    {rpt.inspection_code && (
                                                        <span className="px-1 py-0.2 rounded text-[8px] font-black uppercase bg-sky-950 text-sky-300 border border-sky-800">
                                                            {rpt.inspection_code}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs font-black text-white truncate">
                                                    {rpt.report_number}
                                                </div>
                                                <div className="text-[10px] text-slate-400 truncate">
                                                    {rpt.jobpack_name || "Report Module"}
                                                </div>
                                            </div>
                                        </div>
                                        <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-300 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                                    </button>
                                ))}

                            {/* ANOMALIES */}
                            {(activeTab === "ALL" || activeTab === "ANOMALIES") &&
                                anomalies.map((anom: any, idx: number) => {
                                    const isRect = anom.isRectified;
                                    const refNo = anom.display_ref_no || anom.anomaly_ref_no || `ANOM-${anom.anomaly_id || anom.id || idx + 1}`;
                                    return (
                                        <button
                                            key={`anom-${anom.anomaly_id || anom.id || idx}`}
                                            type="button"
                                            onClick={(e) => openInNewTab(getAnomalyUrl(anom), e)}
                                            className={cn(
                                                "group text-left p-2.5 rounded-xl bg-slate-950/60 border transition-all flex items-center justify-between gap-2 cursor-pointer",
                                                isRect
                                                    ? "border-emerald-800/60 hover:bg-emerald-950/40 hover:border-emerald-500/70"
                                                    : "border-red-800/60 hover:bg-red-950/40 hover:border-red-500/70"
                                            )}
                                            title={`Click to open Anomaly "${refNo}" in Anomalies Module (New Tab)`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div
                                                    className={cn(
                                                        "w-7 h-7 rounded-lg border flex items-center justify-center shrink-0",
                                                        isRect
                                                            ? "bg-emerald-950/80 border-emerald-700/60"
                                                            : "bg-red-950/80 border-red-700/60"
                                                    )}
                                                >
                                                    <ShieldAlert
                                                        className={cn(
                                                            "w-3.5 h-3.5",
                                                            isRect ? "text-emerald-400" : "text-red-400"
                                                        )}
                                                    />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span
                                                            className={cn(
                                                                "px-1.5 py-0.2 rounded text-[8px] font-black uppercase",
                                                                isRect
                                                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                                                    : "bg-red-500/20 text-red-300 border border-red-500/40"
                                                            )}
                                                        >
                                                            {isRect ? "Rectified" : "Open Anomaly"}
                                                        </span>
                                                        {(anom.priority || anom.priority_code) && (
                                                            <span className="text-[9px] font-black uppercase text-amber-300">
                                                                {anom.priority || anom.priority_code}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs font-black text-white truncate">
                                                        {refNo}{" "}
                                                        {anom.defect_type || anom.defect_type_code
                                                            ? `· ${anom.defect_type || anom.defect_type_code}`
                                                            : ""}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 truncate">
                                                        {anom.description ||
                                                            anom.rectified_remarks ||
                                                            anom.sow_report_no ||
                                                            "View in Anomaly Module"}
                                                    </div>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-white shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                                        </button>
                                    );
                                })}

                            {/* INSPECTIONS */}
                            {(activeTab === "ALL" || activeTab === "INSPECTIONS") &&
                                inspections.map((insp: any, idx: number) => {
                                    const inspCode = insp.inspection_type_code || insp.inspection_code || "INSP";
                                    const inspDate = insp.inspection_date
                                        ? new Date(insp.inspection_date).toLocaleDateString()
                                        : null;
                                    return (
                                        <button
                                            key={`insp-${insp.insp_id || insp.id || idx}`}
                                            type="button"
                                            onClick={(e) => openInNewTab(getInspectionWorkspaceUrl(insp), e)}
                                            className="group text-left p-2.5 rounded-xl bg-slate-950/60 hover:bg-emerald-950/40 border border-slate-800/90 hover:border-emerald-500/60 transition-all flex items-center justify-between gap-2 cursor-pointer"
                                            title={`Click to open Inspection Record #${insp.insp_id || insp.id} in Inspection Workspace (New Tab)`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-700/50 flex items-center justify-center shrink-0">
                                                    <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400">
                                                            {inspCode}
                                                        </span>
                                                        {inspDate && (
                                                            <span className="text-[9px] text-slate-400 font-mono">
                                                                {inspDate}
                                                            </span>
                                                        )}
                                                        {insp.has_anomaly && (
                                                            <span className="px-1 py-0.2 rounded text-[8px] font-black uppercase bg-red-950 text-red-300 border border-red-800">
                                                                Defect
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs font-black text-white truncate">
                                                        {insp.jobpack_name || `Record #${insp.insp_id || insp.id}`}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 truncate">
                                                        {insp.sow_report_no
                                                            ? `SOW: ${insp.sow_report_no}`
                                                            : insp.description || `Status: ${insp.status || "Recorded"}`}
                                                    </div>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-300 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                                        </button>
                                    );
                                })}

                            {/* VIDEOS */}
                            {(activeTab === "ALL" || activeTab === "VIDEOS") &&
                                videos.map((vid: any, idx: number) => (
                                    <button
                                        key={`vid-${vid.id || idx}`}
                                        type="button"
                                        onClick={(e) => {
                                            if (vid.file_url) {
                                                openInNewTab(vid.file_url, e);
                                            } else {
                                                openInNewTab(getInspectionWorkspaceUrl(vid, vid.tape_id), e);
                                            }
                                        }}
                                        className="group text-left p-2.5 rounded-xl bg-slate-950/60 hover:bg-amber-950/40 border border-slate-800/90 hover:border-amber-500/60 transition-all flex items-center justify-between gap-2 cursor-pointer"
                                        title={`Click to open Video / Tape "${vid.tape_no || vid.title}" in New Tab`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-7 h-7 rounded-lg bg-amber-950/80 border border-amber-700/50 flex items-center justify-center shrink-0">
                                                <Film className="w-3.5 h-3.5 text-amber-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[9px] font-black uppercase tracking-wider text-amber-400">
                                                        Video Log
                                                    </span>
                                                    {vid.timecode && (
                                                        <span className="px-1 py-0.2 rounded text-[8px] font-mono bg-slate-800 text-amber-200">
                                                            TC {vid.timecode}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs font-black text-white truncate">
                                                    {vid.tape_no || vid.title || `Video #${vid.id}`}
                                                </div>
                                                <div className="text-[10px] text-slate-400 truncate">
                                                    {vid.jobpack_name || vid.remarks || "Open in Workspace"}
                                                </div>
                                            </div>
                                        </div>
                                        <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-300 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                                    </button>
                                ))}

                            {/* PHOTOS */}
                            {(activeTab === "ALL" || activeTab === "PHOTOS") &&
                                photos.map((photo: any, idx: number) => (
                                    <div
                                        key={`photo-${photo.id || idx}`}
                                        onClick={(e) => openInNewTab(getAttachmentsUrl(), e)}
                                        className="group text-left p-2 rounded-xl bg-slate-950/60 hover:bg-pink-950/40 border border-slate-800/90 hover:border-pink-500/60 transition-all flex items-center justify-between gap-2 cursor-pointer"
                                        title={`Click to open Photo "${photo.title || photo.file_name}" in Attachments Module (New Tab)`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            {photo.file_url ? (
                                                <img
                                                    src={photo.file_url}
                                                    alt={photo.title || "Photo"}
                                                    className="w-8 h-8 rounded-lg object-cover border border-pink-700/50 shrink-0 bg-slate-900"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openInNewTab(photo.file_url, e);
                                                    }}
                                                    title="Click thumbnail to view full photo in new tab"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 rounded-lg bg-pink-950/80 border border-pink-700/50 flex items-center justify-center shrink-0">
                                                    <ImageIcon className="w-3.5 h-3.5 text-pink-400" />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[9px] font-black uppercase tracking-wider text-pink-400">
                                                        Photo
                                                    </span>
                                                    {photo.source === "INSPECTION_PHOTO" && (
                                                        <span className="px-1 py-0.2 rounded text-[8px] font-bold uppercase bg-slate-800 text-slate-300">
                                                            Inspection
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs font-black text-white truncate">
                                                    {photo.title || photo.file_name || `Photo #${idx + 1}`}
                                                </div>
                                                <div className="text-[10px] text-slate-400 truncate">
                                                    {photo.description || photo.jobpack_name || "Open Attachments Module"}
                                                </div>
                                            </div>
                                        </div>
                                        <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-pink-300 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                                    </div>
                                ))}
                        </div>

                        {/* Empty state for specific selected tab */}
                        {activeTab !== "ALL" && (
                            <>
                                {activeTab === "JOBPACKS" && jobpacks.length === 0 && (
                                    <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-950/40 border border-slate-800/70 text-xs text-slate-400">
                                        <span>No jobpacks linked to {compQId}.</span>
                                        <button
                                            type="button"
                                            onClick={(e) => openInNewTab("/dashboard/jobpack", e)}
                                            className="text-purple-400 hover:text-purple-300 font-black uppercase text-[10px] flex items-center gap-1 cursor-pointer"
                                        >
                                            Open Jobpack Module <ExternalLink className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                                {activeTab === "REPORTS" && reports.length === 0 && (
                                    <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-950/40 border border-slate-800/70 text-xs text-slate-400">
                                        <span>No SOW reports linked to {compQId}.</span>
                                        <button
                                            type="button"
                                            onClick={(e) => openInNewTab(getReportUrl(), e)}
                                            className="text-sky-400 hover:text-sky-300 font-black uppercase text-[10px] flex items-center gap-1 cursor-pointer"
                                        >
                                            Open Reports Module <ExternalLink className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                                {activeTab === "INSPECTIONS" && inspections.length === 0 && (
                                    <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-950/40 border border-slate-800/70 text-xs text-slate-400">
                                        <span>No inspection records recorded for {compQId} yet.</span>
                                        <button
                                            type="button"
                                            onClick={(e) => openInNewTab(getInspectionWorkspaceUrl(), e)}
                                            className="text-emerald-400 hover:text-emerald-300 font-black uppercase text-[10px] flex items-center gap-1 cursor-pointer"
                                        >
                                            Open Inspection Workspace <ExternalLink className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                                {activeTab === "ANOMALIES" && anomalies.length === 0 && (
                                    <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-950/40 border border-slate-800/70 text-xs text-slate-400">
                                        <span>No anomalies recorded for {compQId}.</span>
                                        <button
                                            type="button"
                                            onClick={(e) => openInNewTab(getAnomalyUrl(), e)}
                                            className="text-red-400 hover:text-red-300 font-black uppercase text-[10px] flex items-center gap-1 cursor-pointer"
                                        >
                                            Open Anomalies Module <ExternalLink className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                                {activeTab === "VIDEOS" && videos.length === 0 && (
                                    <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-950/40 border border-slate-800/70 text-xs text-slate-400">
                                        <span>No video tape logs linked to {compQId}.</span>
                                        <button
                                            type="button"
                                            onClick={(e) => openInNewTab(getInspectionWorkspaceUrl(), e)}
                                            className="text-amber-400 hover:text-amber-300 font-black uppercase text-[10px] flex items-center gap-1 cursor-pointer"
                                        >
                                            Open Video Workspace <ExternalLink className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                                {activeTab === "PHOTOS" && photos.length === 0 && (
                                    <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-950/40 border border-slate-800/70 text-xs text-slate-400">
                                        <span>No photo attachments linked to {compQId}.</span>
                                        <button
                                            type="button"
                                            onClick={(e) => openInNewTab(getAttachmentsUrl(), e)}
                                            className="text-pink-400 hover:text-pink-300 font-black uppercase text-[10px] flex items-center gap-1 cursor-pointer"
                                        >
                                            Open Attachments Module <ExternalLink className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
