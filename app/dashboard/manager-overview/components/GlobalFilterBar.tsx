"use client";

import React, { useMemo } from "react";
import {
    MapPin,
    Layers,
    Building2,
    Wrench,
    Calendar,
    RotateCcw,
    SlidersHorizontal,
    Globe2,
    CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface GlobalFilterState {
    region: string;
    fieldId: string | null;
    structureId: string | null;
    componentType: string;
    timeRange: string;
    dateFrom?: string;
    dateTo?: string;
    scope: string;
}

interface GlobalFilterBarProps {
    filters: GlobalFilterState;
    onChange: (filters: Partial<GlobalFilterState>) => void;
    fields: any[];
    platforms: any[];
    onReset: () => void;
}

const REGIONS = [
    { id: "ALL", label: "All Offshore Regions" },
    { id: "SKO", label: "Sarawak Operations (SKO)" },
    { id: "SBO", label: "Sabah Operations (SBO)" },
    { id: "PMO", label: "Peninsular Malaysia (PMO)" },
];

const COMPONENT_TYPES = [
    { id: "ALL", label: "All Components" },
    { id: "LG", label: "Jacket Legs (LG)" },
    { id: "HM", label: "Horizontal Braces (HM)" },
    { id: "VM", label: "Vertical Members (VM)" },
    { id: "HD", label: "Horizontal Diagonals (HD)" },
    { id: "VD", label: "Vertical Diagonals (VD)" },
    { id: "RS", label: "Risers & Clamps (RS)" },
    { id: "CS", label: "Caissons & Sumps (CS)" },
    { id: "CD", label: "Conductors (CD)" },
    { id: "AN", label: "Cathodic Anodes (AN)" },
    { id: "BL", label: "Boatlanding & Fenders (BL)" },
    { id: "SZ", label: "Splash Zone (SZ)" },
    { id: "PL", label: "Foundation & Piles (PL)" },
];

const TIME_PRESETS = [
    { id: "ALL", label: "All Campaigns" },
    { id: "5Y", label: "Last 5 Years" },
    { id: "3Y", label: "Last 3 Years" },
    { id: "2025", label: "2025 Campaign" },
    { id: "2024", label: "2024 Campaign" },
];

export function GlobalFilterBar({
    filters,
    onChange,
    fields,
    platforms,
    onReset,
}: GlobalFilterBarProps) {
    // Cascading filter for oil fields based on region
    const filteredFields = useMemo(() => {
        const fieldMap = new Map<string, { id: string; name: string; basin: string }>();

        // 1. First gather from platforms so every platform's pfield is guaranteed available
        (platforms || []).forEach((p: any) => {
            if (p.pfield) {
                const clean = String(p.pfield).trim().replace(/\.$/, "");
                if (clean) {
                    const key = clean.toUpperCase();
                    if (!fieldMap.has(key)) {
                        fieldMap.set(key, {
                            id: clean,
                            name: clean,
                            basin: key.includes("BEKOK") ? "PMO" : "SKO",
                        });
                    }
                }
            }
        });

        // 2. Also gather from fields prop (which may be gisFields or library fields)
        (fields || []).forEach((f: any) => {
            if (!f) return;
            const strName = f.field_name != null
                ? String(f.field_name).trim().replace(/\.$/, "")
                : f.lib_desc != null
                    ? String(f.lib_desc).trim().replace(/\.$/, "")
                    : f.name != null
                        ? String(f.name).trim().replace(/\.$/, "")
                        : f.title != null
                            ? String(f.title).trim().replace(/\.$/, "")
                            : typeof f === "string"
                                ? f.trim().replace(/\.$/, "")
                                : "";

            const strId = (f.id != null && typeof f.id !== "object")
                ? String(f.id).trim()
                : (f.lib_id != null && typeof f.lib_id !== "object")
                    ? String(f.lib_id).trim()
                    : (f.field_id != null && typeof f.field_id !== "object")
                        ? String(f.field_id).trim()
                        : strName;

            if (strName || strId) {
                const finalId = strId || strName;
                const finalName = strName || strId;
                const key = finalName.toUpperCase();
                fieldMap.set(key, {
                    id: finalId,
                    name: finalName,
                    basin: f.basin || (key.includes("BEKOK") ? "PMO" : "SKO"),
                });
            }
        });

        const list = Array.from(fieldMap.values());

        return list.filter(f => {
            if (filters.region === "ALL") return true;
            if (filters.region === "SKO") return f.basin === "SKO" || !f.name.toUpperCase().includes("BEKOK");
            if (filters.region === "PMO") return f.basin === "PMO" || f.name.toUpperCase().includes("BEKOK");
            return true;
        });
    }, [fields, platforms, filters.region]);

    // Cascading filter for structures based on field
    const filteredPlatforms = useMemo(() => {
        if (!platforms || platforms.length === 0) return [];
        const seen = new Set<string>();
        const list: any[] = [];

        platforms.forEach((p: any) => {
            const sid = String(p.plat_id || p.id || "");
            if (!sid || seen.has(sid)) return;

            if (filters.fieldId) {
                const pField = String(p.pfield || "").toUpperCase().replace(/\.$/, "").trim();
                const selField = String(filters.fieldId).toUpperCase().replace(/\.$/, "").trim();
                if (!pField.includes(selField) && !selField.includes(pField)) {
                    return;
                }
            }

            seen.add(sid);
            list.push(p);
        });

        return list;
    }, [platforms, filters.fieldId]);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.region !== "ALL") count++;
        if (filters.fieldId) count++;
        if (filters.structureId) count++;
        if (filters.componentType !== "ALL") count++;
        if (filters.timeRange !== "ALL") count++;
        return count;
    }, [filters]);

    return (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-4 transition-all">
            {/* Top row: Scope Pills & Status */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                        <SlidersHorizontal className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                                Global Predictive Filter
                            </span>
                            {activeFilterCount > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-600 text-white">
                                    {activeFilterCount} active
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                            Cascading drill-down: Region ➔ Oil Field ➔ Structure ➔ Component
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Scope Switcher */}
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                        {[
                            { id: "global", label: "Fleet / Global", icon: Globe2 },
                            { id: "field", label: "Field Level", icon: Layers },
                            { id: "platform", label: "Platform", icon: Building2 },
                        ].map(s => {
                            const Icon = s.icon;
                            const active = filters.scope === s.id;
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => {
                                        onChange({ scope: s.id });
                                    }}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                                        active
                                            ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                                    )}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    <span>{s.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {activeFilterCount > 0 && (
                        <button
                            onClick={onReset}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 transition-all"
                            title="Reset all filters to Fleet Global"
                        >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Cascading Dropdowns Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Region */}
                <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <MapPin className="w-3 h-3 text-blue-500" />
                        <span>1. Region</span>
                    </label>
                    <select
                        value={filters.region}
                        onChange={(e) => {
                            onChange({
                                region: e.target.value,
                                fieldId: null,
                                structureId: null,
                                scope: e.target.value === "ALL" ? "global" : filters.scope,
                            });
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    >
                        {REGIONS.map(r => (
                            <option key={r.id} value={r.id}>{r.label}</option>
                        ))}
                    </select>
                </div>

                {/* 2. Oil Field */}
                <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <Layers className="w-3 h-3 text-indigo-500" />
                        <span>2. Oil Field</span>
                    </label>
                    <select
                        value={filters.fieldId || ""}
                        onChange={(e) => {
                            const val = e.target.value || null;
                            onChange({
                                fieldId: val,
                                structureId: null,
                                scope: val ? "field" : "global",
                            });
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    >
                        <option value="">All Oil Fields ({filteredFields.length})</option>
                        {filteredFields.map((f, idx) => (
                            <option key={`field-${f.id}-${idx}`} value={f.id}>{f.name}</option>
                        ))}
                    </select>
                </div>

                {/* 3. Structure */}
                <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <Building2 className="w-3 h-3 text-violet-500" />
                        <span>3. Structure</span>
                    </label>
                    <select
                        value={filters.structureId || ""}
                        onChange={(e) => {
                            const val = e.target.value || null;
                            onChange({
                                structureId: val,
                                scope: val ? "platform" : filters.fieldId ? "field" : "global",
                            });
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    >
                        <option value="">
                            {filters.fieldId
                                ? `All Platforms in Field (${filteredPlatforms.length})`
                                : `All Platforms (${platforms.length})`}
                        </option>
                        {filteredPlatforms.map((p: any, idx: number) => {
                            const pId = String(p.plat_id || p.id || idx);
                            const pName = p.title || p.plat_name || `Platform ${pId}`;
                            return (
                                <option key={`plat-${pId}-${idx}`} value={pId}>
                                    {pName}
                                </option>
                            );
                        })}
                    </select>
                </div>

                {/* 4. Component Type */}
                <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <Wrench className="w-3 h-3 text-amber-500" />
                        <span>4. Component Type</span>
                    </label>
                    <select
                        value={filters.componentType}
                        onChange={(e) => {
                            onChange({ componentType: e.target.value });
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    >
                        {COMPONENT_TYPES.map(c => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Time Filter Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Time Horizon:</span>
                    <div className="flex flex-wrap gap-1">
                        {TIME_PRESETS.map(t => {
                            const isSelected = filters.timeRange === t.id;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => {
                                        let dateFrom: string | undefined = undefined;
                                        const now = new Date();
                                        if (t.id === "3Y") {
                                            dateFrom = `${now.getFullYear() - 3}-01-01`;
                                        } else if (t.id === "5Y") {
                                            dateFrom = `${now.getFullYear() - 5}-01-01`;
                                        } else if (t.id === "2025") {
                                            dateFrom = "2025-01-01";
                                        } else if (t.id === "2024") {
                                            dateFrom = "2024-01-01";
                                        }
                                        onChange({ timeRange: t.id, dateFrom });
                                    }}
                                    className={cn(
                                        "px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-tight transition-all",
                                        isSelected
                                            ? "bg-blue-600 text-white shadow-sm"
                                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                    )}
                                >
                                    {t.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Filter Breadcrumbs Chip */}
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span>Active Target:</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white font-extrabold">
                        {filters.structureId
                            ? (platforms.find(p => String(p.plat_id) === String(filters.structureId))?.title || `Platform #${filters.structureId}`)
                            : filters.fieldId
                                ? (filteredFields.find(f => f.id === filters.fieldId)?.name || filters.fieldId)
                                : filters.region !== "ALL"
                                    ? filters.region
                                    : "All Fleet Assets"}
                    </span>
                </div>
            </div>
        </div>
    );
}
