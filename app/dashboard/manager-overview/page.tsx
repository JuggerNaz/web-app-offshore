"use client";

import { useState, useMemo, useCallback } from "react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { Crown, RefreshCw, Download, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScopeSelector } from "./components/ScopeSelector";
import { ManagerKPICards } from "./components/ManagerKPICards";
import { AnomalyBreakdownChart } from "./components/AnomalyBreakdownChart";
import { AnodeCPSection } from "./components/AnodeCPSection";
import { FMDMGISection } from "./components/FMDMGISection";
import { TrendsComparisonTab } from "./components/TrendsComparisonTab";
import { AdvisorySection } from "./components/AdvisorySection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const TABS = [
    { id: "overview", label: "Overview" },
    { id: "execution", label: "Progress & Execution" },
    { id: "anomalies", label: "Anomalies & Findings" },
    { id: "anode-cp", label: "Anode & CP" },
    { id: "fmd", label: "FMD & MGI" },
    { id: "trends", label: "Trends & Compare" },
    { id: "advisory", label: "Advisory & Predictions" },
];

export default function ManagerOverviewPage() {
    const [scope, setScope] = useState("global");
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
    const [selectedStructureId, setSelectedStructureId] = useState<string | null>(null);
    const [selectedJobpackIds, setSelectedJobpackIds] = useState<number[]>([]);
    const [selectedSowReportNo, setSelectedSowReportNo] = useState<string | null>(null);
    const [compareMode, setCompareMode] = useState(false);
    const [activeTab, setActiveTab] = useState("overview");

    // Fetch fields
    const { data: fieldsData } = useSWR("/api/library/fields-stats", fetcher);
    const fields = fieldsData?.data || [];

    // Fetch platforms
    const platformUrl = selectedFieldId ? `/api/platform?field=${selectedFieldId}&pageSize=200` : "/api/platform?pageSize=200";
    const { data: platformsData } = useSWR(platformUrl, fetcher);
    const platforms = platformsData?.data || [];

    // Fetch jobpacks
    const { data: jobpacksData } = useSWR("/api/jobpack?limit=1000", fetcher);
    const jobpacks = (jobpacksData?.data || []).map((j: any) => ({
        task_id: j.id, name: j.name, status: j.status,
        metadata: j.metadata || {}, created_at: j.created_at,
    }));

    // Build summary API URL
    const summaryUrl = useMemo(() => {
        const params = new URLSearchParams({ scope });
        if (selectedFieldId) params.set("field_id", selectedFieldId);
        if (selectedStructureId) params.set("structure_id", selectedStructureId);
        if (selectedJobpackIds.length > 0) params.set("jobpack_ids", selectedJobpackIds.join(","));
        if (selectedSowReportNo) params.set("sow_report_no", selectedSowReportNo);
        return `/api/manager-summary?${params.toString()}`;
    }, [scope, selectedFieldId, selectedStructureId, selectedJobpackIds, selectedSowReportNo]);

    const { data: summaryData, isLoading, mutate } = useSWR(summaryUrl, fetcher, {
        refreshInterval: 60000, revalidateOnFocus: false,
    });

    const summaries = summaryData?.data?.summaries || [];
    const predictions = summaryData?.data?.predictions || null;

    // Aggregate KPIs from all summaries
    const kpiData = useMemo(() => {
        if (summaries.length === 0) return {
            sowPct: 0, totalInspections: 0, totalAnomalies: 0, openAnomalies: 0,
            cpAvg: null, cpMin: null, cpMax: null, anodeAvgDepletion: null, anodeTotal: 0,
            fmdTotal: 0, fmdFlooded: 0,
        };

        const totalSow = summaries.reduce((a: number, s: any) => a + s.sow.total, 0);
        const completedSow = summaries.reduce((a: number, s: any) => a + s.sow.completed + s.sow.incomplete, 0);

        let cpSum = 0, cpCount = 0, cpMin: number | null = null, cpMax: number | null = null;
        let anodeSum = 0, anodeCount = 0;
        summaries.forEach((s: any) => {
            if (s.cp.avg !== null) { cpSum += s.cp.avg * s.cp.count; cpCount += s.cp.count; }
            if (s.cp.min !== null && (cpMin === null || s.cp.min < cpMin)) cpMin = s.cp.min;
            if (s.cp.max !== null && (cpMax === null || s.cp.max > cpMax)) cpMax = s.cp.max;
            if (s.anode.avgDepletion !== null) { anodeSum += s.anode.avgDepletion * s.anode.total; anodeCount += s.anode.total; }
        });

        return {
            sowPct: totalSow > 0 ? Math.round((completedSow / totalSow) * 100) : 0,
            totalInspections: summaries.reduce((a: number, s: any) => a + s.records.total, 0),
            totalAnomalies: summaries.reduce((a: number, s: any) => a + s.anomalies.total, 0),
            openAnomalies: summaries.reduce((a: number, s: any) => a + s.anomalies.open, 0),
            cpAvg: cpCount > 0 ? Math.round((cpSum / cpCount) * 100) / 100 : null,
            cpMin, cpMax,
            anodeAvgDepletion: anodeCount > 0 ? Math.round(anodeSum / anodeCount) : null,
            anodeTotal: summaries.reduce((a: number, s: any) => a + s.anode.total, 0),
            fmdTotal: summaries.reduce((a: number, s: any) => a + s.fmd.total, 0),
            fmdFlooded: summaries.reduce((a: number, s: any) => a + (s.fmd.conditions?.flooded || 0), 0),
        };
    }, [summaries]);

    // Aggregate anomaly data
    const anomalyAgg = useMemo(() => {
        const byP: Record<string, number> = {};
        const byD: Record<string, number> = {};
        let total = 0, rect = 0, open = 0;
        summaries.forEach((s: any) => {
            total += s.anomalies.total; rect += s.anomalies.rectified; open += s.anomalies.open;
            Object.entries(s.anomalies.byPriority || {}).forEach(([k, v]) => { byP[k] = (byP[k] || 0) + (v as number); });
            Object.entries(s.anomalies.byDefectType || {}).forEach(([k, v]) => { byD[k] = (byD[k] || 0) + (v as number); });
        });
        return { total, rectified: rect, open, byPriority: byP, byDefectType: byD };
    }, [summaries]);

    // Aggregate anode/CP
    const anodeCPAgg = useMemo(() => {
        const buckets: Record<string, number> = { "0–25%": 0, "25–50%": 0, "50–75%": 0, "75–100%": 0 };
        summaries.forEach((s: any) => {
            Object.entries(s.anode.depletionBuckets || {}).forEach(([k, v]) => { buckets[k] = (buckets[k] || 0) + (v as number); });
        });
        const cpTrend = summaries.filter((s: any) => s.cp.avg !== null).map((s: any) => ({
            date: s.jobpack_name?.split("/").pop() || s.jobpack_id, value: s.cp.avg,
        }));
        return {
            anode: { total: kpiData.anodeTotal, depletionBuckets: buckets, avgDepletion: kpiData.anodeAvgDepletion },
            cp: { count: summaries.reduce((a: number, s: any) => a + s.cp.count, 0), min: kpiData.cpMin, max: kpiData.cpMax, avg: kpiData.cpAvg },
            cpTrend,
        };
    }, [summaries, kpiData]);

    // Aggregate FMD
    const fmdAgg = useMemo(() => {
        const conds: Record<string, number> = { dry: 0, flooded: 0, grouted: 0, inconclusive: 0 };
        summaries.forEach((s: any) => {
            Object.entries(s.fmd.conditions || {}).forEach(([k, v]) => { conds[k] = (conds[k] || 0) + (v as number); });
        });
        return { fmd: { total: kpiData.fmdTotal, conditions: conds } };
    }, [summaries, kpiData]);

    // Context bar info
    const contextItems = useMemo(() => {
        if (summaries.length === 0) return [];
        const first = summaries[0];

        if (scope === "global") {
            return [
                { label: "Dashboard", value: "Global Overview" },
                { label: "Assets", value: "All Fields & Structures" },
                { label: "Metrics", value: "Aggregate Insights" }
            ];
        }

        if (scope === "field") {
            return [
                { label: "Field", value: first.field_name || "Unknown Field" },
                { label: "Structures", value: `${summaries.length} Available` },
                { label: "Metrics", value: "Aggregate Field Insights" }
            ];
        }

        if (scope === "platform") {
            return [
                { label: "Structure", value: first.structure_name || "Unknown Structure" },
                { label: "Field", value: first.field_name || "Unknown Field" },
                { label: "Mode", value: "Historical Analysis" }
            ];
        }

        // Default to Jobpack scope
        return [
            { label: "Jobpack", value: first.jobpack_name || "Unknown" },
            { label: "Structure", value: first.structure_name || "Unknown Structure" },
            { label: "SOW Report No.", value: selectedSowReportNo || "All" },
            { label: "Contractor", value: first.contractor || "NQ" },
            { label: "Vessel", value: first.vessel || "Vessel 01" },
            { label: "Mode", value: first.inspection_mode || "ROV, AIR DIVING" }
        ].filter(item => item.value);
    }, [scope, summaries, selectedSowReportNo]);

    // Dynamic tabs based on scope
    const TABS = useMemo(() => {
        const base = [
            { id: "overview", label: "Overview" },
            { id: "anomalies", label: "Anomalies & Findings" },
            { id: "anode-cp", label: "Anode & CP" },
            { id: "fmd", label: "FMD & MGI" },
        ];
        
        if (scope === "platform") {
            base.push({ id: "trends", label: "Historical Analysis" });
        } else if (scope === "jobpack") {
            base.push({ id: "execution", label: "Execution Progress" });
            base.push({ id: "trends", label: "Compare" });
        } else {
            base.push({ id: "trends", label: "Trends & Compare" });
        }
        
        base.push({ id: "advisory", label: "Advisory & Predictions" });
        return base;
    }, [scope]);

    return (
        <div className="flex-1 w-full flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50/30 dark:bg-transparent animate-in fade-in duration-700">
            <div className="max-w-[1600px] mx-auto w-full p-6 lg:p-8 space-y-6">

                {/* ═══ HEADER ═══ */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/20 shrink-0">
                            <Crown className="h-7 w-7" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                                <span className="opacity-50">Management</span>
                                <div className="h-1 w-1 rounded-full bg-violet-500" />
                                <span className="text-slate-900 dark:text-white/80">Executive Dashboard</span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">
                                Manager Overview
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Live</span>
                        </div>
                        <button onClick={() => mutate()} disabled={isLoading}
                            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all shadow-sm">
                            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                        </button>
                    </div>
                </div>

                {/* ═══ SCOPE SELECTOR ═══ */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-lg">
                    <ScopeSelector
                        fields={fields} platforms={platforms} jobpacks={jobpacks}
                        scope={scope} selectedFieldId={selectedFieldId}
                        selectedStructureId={selectedStructureId} selectedJobpackIds={selectedJobpackIds}
                        selectedSowReportNo={selectedSowReportNo}
                        compareMode={compareMode} onScopeChange={setScope} onFieldChange={setSelectedFieldId}
                        onStructureChange={setSelectedStructureId} onJobpackChange={setSelectedJobpackIds}
                        onSowReportNoChange={setSelectedSowReportNo}
                        onCompareModeChange={setCompareMode}
                    />
                </div>

                {/* ═══ CONTEXT BAR ═══ */}
                {contextItems.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3 px-5 py-3 rounded-xl bg-gradient-to-r from-slate-100 dark:from-slate-800/50 to-transparent border border-slate-200 dark:border-slate-800 animate-in fade-in duration-500">
                        {contextItems.map((item: any, i, arr) => (
                            <div key={i} className="flex items-center gap-1.5">
                                <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">{item.label}:</span>
                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{item.value}</span>
                                {i < arr.length - 1 && <span className="text-slate-300 dark:text-slate-700 mx-1">·</span>}
                            </div>
                        ))}
                    </div>
                )}

                {/* ═══ KPI CARDS ═══ */}
                <ManagerKPICards data={kpiData} />

                {/* ═══ LOADING STATE ═══ */}
                {isLoading && summaries.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-in fade-in">
                        <div className="w-16 h-16 border-4 border-slate-200 dark:border-slate-700 border-t-blue-600 rounded-full animate-spin" />
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Dashboard Data...</p>
                    </div>
                )}

                {/* ═══ TABS ═══ */}
                {summaries.length > 0 && (
                    <>
                        <div className="flex flex-wrap gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                            {TABS.map(t => (
                                <button key={t.id} onClick={() => setActiveTab(t.id)}
                                    className={cn("px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                                        activeTab === t.id
                                            ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                    )}>
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {/* ═══ TAB CONTENT ═══ */}
                        <div className="min-h-[300px]">
                            {activeTab === "overview" && (
                                <div className="space-y-4 animate-in fade-in duration-500">
                                    <AnomalyBreakdownChart data={anomalyAgg} />
                                    <AnodeCPSection data={anodeCPAgg} />
                                </div>
                            )}
                            {activeTab === "anomalies" && <AnomalyBreakdownChart data={anomalyAgg} />}
                            {activeTab === "anode-cp" && <AnodeCPSection data={anodeCPAgg} />}
                            {activeTab === "fmd" && <FMDMGISection data={fmdAgg} />}
                            {activeTab === "trends" && (
                                <TrendsComparisonTab 
                                    summaries={summaries} 
                                    compareMode={(scope === "global" || scope === "field") ? true : (compareMode && summaries.length > 1)} 
                                    labelMode={(scope === "global" || scope === "field") ? "structure" : "jobpack"}
                                />
                            )}
                            {activeTab === "execution" && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-500">
                                    <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-lg">
                                        <CardHeader><CardTitle className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Jobpack Overall Progress</CardTitle></CardHeader>
                                        <CardContent>
                                            <div className="flex items-center justify-between p-6 bg-blue-50 dark:bg-blue-500/10 rounded-2xl border border-blue-200 dark:border-blue-500/20">
                                                <div>
                                                    <div className="text-3xl font-black text-blue-600 dark:text-blue-400">{kpiData.sowPct}%</div>
                                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Total Scope Completion</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs font-bold text-slate-600 dark:text-slate-400">{summaries.length} Structures Involved</div>
                                                    <div className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider">Across all reports</div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-lg">
                                        <CardHeader><CardTitle className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Individual Structure Breakdown</CardTitle></CardHeader>
                                        <CardContent>
                                            <div className="space-y-3">
                                                {summaries.map((s: any) => (
                                                    <div key={s.jobpack_id + s.structure_name} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                                        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{s.structure_name}</div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                <div className="h-full bg-blue-500" style={{ width: `${s.sow.completionPct}%` }} />
                                                            </div>
                                                            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400">{s.sow.completionPct}%</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                            {activeTab === "advisory" && <AdvisorySection predictions={predictions} />}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
