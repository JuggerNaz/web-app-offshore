"use client";
import { useState, useMemo, useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { Globe, MapPin, Building2, Package, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScopeSelectorProps {
    fields: { lib_id: string; lib_desc: string; platform_count: number; pipeline_count: number }[];
    platforms: { plat_id: number; title: string; pfield: string; field_name?: string }[];
    jobpacks: { task_id: number; name: string; status: string; metadata: any; created_at: string }[];
    scope: string;
    selectedFieldId: string | null;
    selectedStructureId: string | null;
    selectedJobpackIds: number[];
    selectedSowReportNo?: string | null;
    compareMode: boolean;
    onScopeChange: (scope: string) => void;
    onFieldChange: (id: string | null) => void;
    onStructureChange: (id: string | null) => void;
    onJobpackChange: (ids: number[]) => void;
    onSowReportNoChange?: (no: string | null) => void;
    onCompareModeChange: (v: boolean) => void;
}

export function ScopeSelector(props: ScopeSelectorProps) {
    const {
        fields, platforms, jobpacks, scope,
        selectedFieldId, selectedStructureId, selectedJobpackIds, selectedSowReportNo,
        compareMode, onScopeChange, onFieldChange, onStructureChange, onJobpackChange, onSowReportNoChange, onCompareModeChange,
    } = props;

    // Fetch SOW Reports
    const { data: sowData } = useSWR(
        !compareMode && selectedJobpackIds.length === 1 && selectedStructureId
            ? `/api/sow?jobpack_id=${selectedJobpackIds[0]}&structure_id=${selectedStructureId}`
            : null,
        fetcher
    );

    const availableSowReports = useMemo(() => {
        if (!sowData?.data) return [];
        const list = sowData.data.report_numbers || sowData.data;
        if (!Array.isArray(list)) return [];
        return list.map((r: any) => r.number || r.report_no || r);
    }, [sowData]);

    // Auto-select if only 1 SOW report available
    useEffect(() => {
        if (availableSowReports.length === 1 && onSowReportNoChange && selectedSowReportNo !== availableSowReports[0]) {
            onSowReportNoChange(availableSowReports[0]);
        }
    }, [availableSowReports, selectedSowReportNo, onSowReportNoChange]);

    const filteredPlatforms = useMemo(() => {
        if (!selectedFieldId) return platforms;
        return platforms.filter(p => String(p.pfield) === selectedFieldId);
    }, [platforms, selectedFieldId]);

    const filteredJobpacks = useMemo(() => {
        if (!selectedStructureId) return jobpacks;
        return jobpacks.filter(jp => {
            const structs: any[] = [];
            const strMeta = jp.metadata?.structures;
            if (Array.isArray(strMeta)) structs.push(...strMeta);
            else if (strMeta) {
                if (Array.isArray(strMeta.cs)) structs.push(...strMeta.cs);
                if (Array.isArray(strMeta.pl)) structs.push(...strMeta.pl);
            }
            return structs.some((s: any) => String(s.id) === selectedStructureId || String(s.title) === selectedStructureId);
        });
    }, [jobpacks, selectedStructureId]);

    const breadcrumbs = useMemo(() => {
        const crumbs: { label: string; scope: string }[] = [{ label: "All Assets", scope: "global" }];
        if (selectedFieldId) {
            const f = fields.find(f => f.lib_id === selectedFieldId);
            crumbs.push({ label: f?.lib_desc || selectedFieldId, scope: "field" });
        }
        if (selectedStructureId) {
            const p = platforms.find(p => String(p.plat_id) === selectedStructureId);
            crumbs.push({ label: p?.title || selectedStructureId, scope: "platform" });
        }
        if (selectedJobpackIds.length === 1) {
            const jp = jobpacks.find(j => j.task_id === selectedJobpackIds[0]);
            crumbs.push({ label: jp?.name || String(selectedJobpackIds[0]), scope: "jobpack" });
            if (selectedSowReportNo) {
                crumbs.push({ label: selectedSowReportNo, scope: "sow" });
            }
        }
        return crumbs;
    }, [fields, platforms, jobpacks, selectedFieldId, selectedStructureId, selectedJobpackIds, selectedSowReportNo]);

    const handleBreadcrumbClick = (s: string) => {
        if (s === "global") { onFieldChange(null); onStructureChange(null); onJobpackChange([]); if (onSowReportNoChange) onSowReportNoChange(null); onScopeChange("global"); }
        else if (s === "field") { onStructureChange(null); onJobpackChange([]); if (onSowReportNoChange) onSowReportNoChange(null); onScopeChange("field"); }
        else if (s === "platform") { onJobpackChange([]); if (onSowReportNoChange) onSowReportNoChange(null); onScopeChange("platform"); }
        else if (s === "jobpack") { if (onSowReportNoChange) onSowReportNoChange(null); onScopeChange("jobpack"); }
    };

    const toggleJobpack = (id: number) => {
        if (compareMode) {
            const exists = selectedJobpackIds.includes(id);
            if (exists) onJobpackChange(selectedJobpackIds.filter(i => i !== id));
            else if (selectedJobpackIds.length < 4) onJobpackChange([...selectedJobpackIds, id]);
        } else {
            onJobpackChange([id]);
            onScopeChange("jobpack");
        }
    };

    return (
        <div className="space-y-3 animate-in fade-in duration-500">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-1 flex-wrap">
                {breadcrumbs.map((c, i) => (
                    <div key={c.scope} className="flex items-center gap-1">
                        {i > 0 && <ChevronRight className="w-3 h-3 text-slate-400" />}
                        <button onClick={() => handleBreadcrumbClick(c.scope)}
                            className={cn("text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md transition-all",
                                i === breadcrumbs.length - 1
                                    ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10"
                                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            )}>
                            {c.label}
                        </button>
                    </div>
                ))}
            </div>

            {/* Selectors Row */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-sm">
                    {[
                        { id: "global", icon: Globe, label: "All" },
                        { id: "field", icon: MapPin, label: "Field" },
                        { id: "platform", icon: Building2, label: "Structure" },
                        { id: "jobpack", icon: Package, label: "Jobpack" },
                    ].map(s => (
                        <button key={s.id} onClick={() => {
                            onScopeChange(s.id);
                            if (s.id === "global") { onFieldChange(null); onStructureChange(null); onJobpackChange([]); }
                        }}
                            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                                scope === s.id
                                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                    : "text-slate-400 hover:text-slate-600 dark:hover:text-white"
                            )}>
                            <s.icon className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{s.label}</span>
                        </button>
                    ))}
                </div>

                {/* Field dropdown */}
                {(scope === "field" || scope === "platform" || scope === "jobpack") && (
                    <select value={selectedFieldId || ""} onChange={e => {
                        onFieldChange(e.target.value || null);
                        onStructureChange(null); onJobpackChange([]);
                        if (onSowReportNoChange) onSowReportNoChange(null);
                    }}
                        className="h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm">
                        <option value="">All Fields</option>
                        {fields.map(f => <option key={f.lib_id} value={f.lib_id}>{f.lib_desc} ({f.platform_count})</option>)}
                    </select>
                )}

                {/* Platform dropdown */}
                {(scope === "platform" || scope === "jobpack") && (
                    <select value={selectedStructureId || ""} onChange={e => {
                        onStructureChange(e.target.value || null);
                        onJobpackChange([]);
                        if (onSowReportNoChange) onSowReportNoChange(null);
                    }}
                        className="h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm">
                        <option value="">All Structures</option>
                        {filteredPlatforms.map(p => <option key={p.plat_id} value={p.plat_id}>{p.title}</option>)}
                    </select>
                )}

                {/* Jobpack selector */}
                {scope === "jobpack" && selectedStructureId && (
                    <select value={compareMode ? "" : (selectedJobpackIds[0] || "")}
                        onChange={e => { 
                            if (!compareMode) {
                                if (e.target.value) {
                                    toggleJobpack(Number(e.target.value));
                                } else {
                                    onJobpackChange([]);
                                }
                                if (onSowReportNoChange) onSowReportNoChange(null);
                            }
                        }}
                        className="h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm"
                        disabled={compareMode}>
                        <option value="">Select Jobpack</option>
                        {filteredJobpacks.map(j => (
                            <option key={j.task_id} value={j.task_id}>
                                {j.name} ({j.status})
                            </option>
                        ))}
                    </select>
                )}

                {/* SOW Report selector */}
                {scope === "jobpack" && !compareMode && selectedJobpackIds.length === 1 && availableSowReports.length > 0 && (
                    <select value={selectedSowReportNo || ""}
                        onChange={e => { if(onSowReportNoChange) onSowReportNoChange(e.target.value || null); }}
                        className="h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm">
                        <option value="">Select Report No</option>
                        {availableSowReports.map((r: string) => (
                            <option key={r} value={r}>{r}</option>
                        ))}
                    </select>
                )}

                {/* Compare toggle */}
                <button onClick={() => onCompareModeChange(!compareMode)}
                    className={cn("flex items-center gap-1.5 h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all",
                        compareMode
                            ? "bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-500/20"
                            : "bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800 hover:text-violet-600 hover:border-violet-300"
                    )}>
                    {compareMode ? "✓ Compare Mode" : "Compare"}
                </button>

                {/* Compare chips */}
                {compareMode && selectedJobpackIds.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                        {selectedJobpackIds.map(id => {
                            const jp = jobpacks.find(j => j.task_id === id);
                            return (
                                <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-[10px] font-bold">
                                    {jp?.name || id}
                                    <button onClick={() => onJobpackChange(selectedJobpackIds.filter(i => i !== id))}>
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            );
                        })}
                    </div>
                )}

                {/* Compare jobpack list */}
                {compareMode && selectedStructureId && (
                    <div className="w-full flex flex-wrap gap-2 mt-1">
                        {filteredJobpacks.map(j => (
                            <button key={j.task_id} onClick={() => toggleJobpack(j.task_id)}
                                className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all",
                                    selectedJobpackIds.includes(j.task_id)
                                        ? "bg-violet-600 text-white border-violet-600"
                                        : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-violet-400"
                                )}>
                                {j.name} · {j.status}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
