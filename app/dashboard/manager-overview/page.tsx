"use client";

import { useState, useMemo, useCallback } from "react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import {
    Crown,
    RefreshCw,
    Download,
    Share2,
    BarChart3,
    Compass,
    Building2,
    TrendingUp,
    Layers,
    FileSpreadsheet,
    Activity,
    SlidersHorizontal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlobalFilterBar, GlobalFilterState } from "./components/GlobalFilterBar";
import { RegionalMacroView } from "./components/RegionalMacroView";
import { StructureMicroView } from "./components/StructureMicroView";
import { PredictiveAnalyticsView } from "./components/PredictiveAnalyticsView";
import { PowerBIModal } from "./components/PowerBIModal";
import { ManagerKPICards } from "./components/ManagerKPICards";
import { AnomalyBreakdownChart } from "./components/AnomalyBreakdownChart";
import { AnodeCPSection } from "./components/AnodeCPSection";
import { FMDMGISection } from "./components/FMDMGISection";
import { TrendsComparisonTab } from "./components/TrendsComparisonTab";
import { AdvisorySection } from "./components/AdvisorySection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ManagerOverviewPage() {
    // ─── Global Filter State ─────────────────────────────────────────────────
    const [filterState, setFilterState] = useState<GlobalFilterState>({
        region: "ALL",
        fieldId: null,
        structureId: null,
        componentType: "ALL",
        timeRange: "ALL",
        dateFrom: undefined,
        dateTo: undefined,
        scope: "global",
    });

    // ─── Progressive Disclosure View State ──────────────────────────────────
    // "macro" = Executive Regional View
    // "micro" = Structure Digital Twin & 5x5 Risk Matrix
    // "predictive" = Deep Dive Degradation & CP Profiles
    // "tabular" = Traditional Inspection Breakdown Tabs
    const [progressiveView, setProgressiveView] = useState<"macro" | "micro" | "predictive" | "tabular">("macro");
    const [activeTab, setActiveTab] = useState("overview");
    const [isPowerBiOpen, setIsPowerBiOpen] = useState(false);
    const [selectedJobpackIds, setSelectedJobpackIds] = useState<number[]>([]);
    const [selectedSowReportNo, setSelectedSowReportNo] = useState<string | null>(null);

    // ─── SWR Data Fetching ──────────────────────────────────────────────────
    const { data: fieldsData } = useSWR("/api/library/fields-stats", fetcher);
    const fields = fieldsData?.data || [];

    const platformUrl = filterState.fieldId
        ? `/api/platform?field=${filterState.fieldId}&pageSize=200`
        : "/api/platform?pageSize=200";
    const { data: platformsData } = useSWR(platformUrl, fetcher);
    const platforms = platformsData?.data || [];

    // Build manager-summary API URL with cascading filters
    const summaryUrl = useMemo(() => {
        const params = new URLSearchParams({ scope: filterState.scope });
        if (filterState.region && filterState.region !== "ALL") params.set("region", filterState.region);
        if (filterState.fieldId) params.set("field_id", filterState.fieldId);
        if (filterState.structureId) params.set("structure_id", filterState.structureId);
        if (filterState.componentType && filterState.componentType !== "ALL") params.set("component_type", filterState.componentType);
        if (filterState.dateFrom) params.set("date_from", filterState.dateFrom);
        if (filterState.dateTo) params.set("date_to", filterState.dateTo);
        if (selectedJobpackIds.length > 0) params.set("jobpack_ids", selectedJobpackIds.join(","));
        if (selectedSowReportNo) params.set("sow_report_no", selectedSowReportNo);
        return `/api/manager-summary?${params.toString()}`;
    }, [filterState, selectedJobpackIds, selectedSowReportNo]);

    const { data: summaryData, isLoading, mutate } = useSWR(summaryUrl, fetcher, {
        refreshInterval: 300000,
        revalidateOnFocus: false,
    });

    const summaries = summaryData?.data?.summaries || [];
    const predictions = summaryData?.data?.predictions || null;
    const gisFields = summaryData?.data?.context?.gis_fields || [];

    // Selected structure object for Micro View
    const selectedPlatformObj = useMemo(() => {
        if (!filterState.structureId) return platforms[0] || null;
        return platforms.find((p: any) => String(p.plat_id) === String(filterState.structureId)) || platforms[0] || null;
    }, [platforms, filterState.structureId]);

    // Aggregate KPIs
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

    // Anomaly breakdown aggregation
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

    // Anode/CP aggregation
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

    // FMD aggregation
    const fmdAgg = useMemo(() => {
        const conds: Record<string, number> = { dry: 0, flooded: 0, grouted: 0, inconclusive: 0 };
        summaries.forEach((s: any) => {
            Object.entries(s.fmd.conditions || {}).forEach(([k, v]) => { conds[k] = (conds[k] || 0) + (v as number); });
        });
        return { fmd: { total: kpiData.fmdTotal, conditions: conds } };
    }, [summaries, kpiData]);

    // Handlers for interactive field/structure clicks from map or table
    const handleSelectFieldFromMap = useCallback((fieldId: string) => {
        setFilterState(prev => ({
            ...prev,
            fieldId: fieldId,
            structureId: null,
            scope: "field",
        }));
    }, []);

    const handleSelectPlatformFromTable = useCallback((structureId: string) => {
        setFilterState(prev => ({
            ...prev,
            structureId: String(structureId),
            scope: "platform",
        }));
        setProgressiveView("micro");
    }, []);

    const handleResetFilters = useCallback(() => {
        setFilterState({
            region: "ALL",
            fieldId: null,
            structureId: null,
            componentType: "ALL",
            timeRange: "ALL",
            dateFrom: undefined,
            dateTo: undefined,
            scope: "global",
        });
    }, []);

    // Traditional Tab definitions
    const TABS = useMemo(() => [
        { id: "overview", label: "Executive Summary" },
        { id: "execution", label: "Progress & Execution" },
        { id: "anomalies", label: "Anomalies & Findings" },
        { id: "anode-cp", label: "Anode & CP Survey" },
        { id: "fmd", label: "FMD & Marine Growth" },
        { id: "trends", label: "Multi-Campaign Compare" },
        { id: "advisory", label: "Advisory Predictions" },
    ], []);

    return (
        <div className="flex-1 w-full flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 animate-in fade-in duration-700">
            <div className="max-w-[1680px] mx-auto w-full p-6 lg:p-8 space-y-6">

                {/* ═══ HEADER ═══ */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-3xl bg-gradient-to-br from-violet-600 via-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-xl shadow-blue-500/20 shrink-0">
                            <Crown className="h-7 w-7" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                                <span className="opacity-60">Offshore Integrity</span>
                                <div className="h-1 w-1 rounded-full bg-blue-500" />
                                <span className="text-blue-600 dark:text-blue-400 font-extrabold">Executive Manager Overview</span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">
                                Predictive Analytics &amp; Integrity Dashboard
                            </h1>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Power BI & Data Hub Modal Trigger */}
                        <button
                            onClick={() => setIsPowerBiOpen(true)}
                            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs font-black uppercase tracking-wider transition-all shadow-sm shadow-amber-500/10 cursor-pointer"
                        >
                            <BarChart3 className="w-4 h-4 text-amber-500" />
                            <span>Power BI &amp; SQL Hub</span>
                        </button>

                        {/* Live Status Badge */}
                        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                Supabase Live
                            </span>
                        </div>

                        {/* Refresh Button */}
                        <button
                            onClick={() => mutate()}
                            disabled={isLoading}
                            className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all shadow-sm"
                            title="Refresh Dashboard Data"
                        >
                            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                        </button>
                    </div>
                </div>

                {/* ═══ GLOBAL PERSISTENT FILTER BAR ═══ */}
                <GlobalFilterBar
                    filters={filterState}
                    onChange={(updated) => setFilterState(prev => ({ ...prev, ...updated }))}
                    fields={gisFields.length > 0 ? gisFields : fields}
                    platforms={platforms}
                    onReset={handleResetFilters}
                />

                {/* ═══ PROGRESSIVE DISCLOSURE VIEW SWITCHER ═══ */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-lg">
                    <div className="flex flex-wrap gap-1">
                        {[
                            {
                                id: "macro",
                                label: "View 1: Regional Macro Dashboard",
                                icon: Compass,
                                badge: "GIS Map & CAPEX",
                            },
                            {
                                id: "micro",
                                label: "View 2: Structure Micro Dashboard",
                                icon: Building2,
                                badge: "Digital Twin & 5x5 Matrix",
                            },
                            {
                                id: "predictive",
                                label: "View 3: Predictive Analytics & Trends",
                                icon: TrendingUp,
                                badge: "RUL & CP Depth Profile",
                            },
                            {
                                id: "tabular",
                                label: "Detailed Inspection Tabs",
                                icon: Layers,
                                badge: "Anomalies & Execution",
                            },
                        ].map((view) => {
                            const Icon = view.icon;
                            const isActive = progressiveView === view.id;
                            return (
                                <button
                                    key={view.id}
                                    onClick={() => setProgressiveView(view.id as any)}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all",
                                        isActive
                                            ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                                            : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span>{view.label}</span>
                                    <span className={cn(
                                        "text-[9px] px-2 py-0.5 rounded-full font-bold ml-1",
                                        isActive ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                                    )}>
                                        {view.badge}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="hidden lg:flex items-center gap-2 pr-4 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <span>Progressive Model: Macro ➔ Micro ➔ Deep Dive</span>
                    </div>
                </div>

                {/* ═══ LOADING STATE ═══ */}
                {isLoading && summaries.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 space-y-4 animate-in fade-in">
                        <div className="w-16 h-16 border-4 border-slate-200 dark:border-slate-800 border-t-blue-600 rounded-full animate-spin" />
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                            Calculating Fleet Predictive Analytics...
                        </p>
                    </div>
                )}

                {/* ═══ PROGRESSIVE DISCLOSURE VIEW CONTENT ═══ */}
                {!isLoading && (
                    <div className="min-h-[400px]">
                        {/* VIEW 1: EXECUTIVE REGIONAL MACRO VIEW */}
                        {progressiveView === "macro" && (
                            <RegionalMacroView
                                gisFields={gisFields}
                                kpiData={kpiData}
                                predictions={predictions}
                                summaries={summaries}
                                onSelectField={handleSelectFieldFromMap}
                                onSelectPlatform={handleSelectPlatformFromTable}
                            />
                        )}

                        {/* VIEW 2: STRUCTURE-SPECIFIC MICRO VIEW */}
                        {progressiveView === "micro" && (
                            <StructureMicroView
                                structure={selectedPlatformObj}
                                predictions={predictions}
                                summaries={summaries}
                            />
                        )}

                        {/* VIEW 3: PREDICTIVE ANALYTICS & TRENDS (DEEP DIVE) */}
                        {progressiveView === "predictive" && (
                            <PredictiveAnalyticsView
                                predictions={predictions}
                                summaries={summaries}
                            />
                        )}

                        {/* VIEW 4: TABULAR INSPECTION BREAKDOWN */}
                        {progressiveView === "tabular" && (
                            <div className="space-y-6 animate-in fade-in duration-500">
                                {/* Standard KPI Cards */}
                                <ManagerKPICards data={kpiData} />

                                {/* Tabs Bar */}
                                <div className="flex flex-wrap gap-1 p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                                    {TABS.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => setActiveTab(t.id)}
                                            className={cn(
                                                "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                                                activeTab === t.id
                                                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                            )}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Tab Contents */}
                                <div className="min-h-[300px]">
                                    {activeTab === "overview" && (
                                        <div className="space-y-4">
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
                                            compareMode={summaries.length > 1}
                                            labelMode="structure"
                                        />
                                    )}
                                    {activeTab === "execution" && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-lg">
                                                <CardHeader><CardTitle className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">SOW Completion</CardTitle></CardHeader>
                                                <CardContent>
                                                    <div className="p-6 bg-blue-50 dark:bg-blue-500/10 rounded-2xl border border-blue-200 dark:border-blue-500/20">
                                                        <div className="text-3xl font-black text-blue-600 dark:text-blue-400">{kpiData.sowPct}%</div>
                                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Total SOW Scope Completion</div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-lg">
                                                <CardHeader><CardTitle className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Platform SOW Breakdown</CardTitle></CardHeader>
                                                <CardContent>
                                                    <div className="space-y-3">
                                                        {summaries.map((s: any, idx: number) => (
                                                            <div key={`sow-structure-${s.jobpack_id || 'jp'}-${s.structure_id || s.structure_name || 'str'}-${idx}`} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
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
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ═══ POWER BI INTEGRATION & EXPORT MODAL ═══ */}
            <PowerBIModal
                isOpen={isPowerBiOpen}
                onClose={() => setIsPowerBiOpen(false)}
                summaries={summaries}
                predictions={predictions}
                currentFilter={filterState}
            />
        </div>
    );
}
