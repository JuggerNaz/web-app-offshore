"use client";

import React, { useState } from "react";
import {
    MapPin,
    AlertTriangle,
    ShieldCheck,
    Clock,
    DollarSign,
    Layers,
    ChevronRight,
    TrendingUp,
    Anchor,
    Compass,
    Waves
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RegionalMacroViewProps {
    gisFields: any[];
    kpiData: any;
    predictions: any;
    summaries: any[];
    onSelectField: (fieldId: string) => void;
    onSelectPlatform: (structureId: string) => void;
}

export function RegionalMacroView({
    gisFields,
    kpiData,
    predictions,
    summaries,
    onSelectField,
    onSelectPlatform,
}: RegionalMacroViewProps) {
    const [hoveredField, setHoveredField] = useState<any | null>(null);
    const [selectedBasin, setSelectedBasin] = useState<string>("ALL");

    // Filter fields by basin if selected
    const displayedFields = gisFields.filter(f => {
        if (selectedBasin === "ALL") return true;
        return f.basin === selectedBasin;
    });

    const capex5yr = predictions?.capex_forecast_5yr || [];
    const maxCapex = Math.max(...capex5yr.map((c: any) => c.total_m || 1), 5);

    // Fleet RUL average
    const avgRul = Math.round(
        summaries.reduce((a, s) => a + (s.wall_thickness?.rul_years || 15), 0) / Math.max(1, summaries.length)
    );

    // Overall Fleet Health Score
    const fleetHealthScore = Math.round(
        gisFields.reduce((a, f) => a + (f.health_score || 80), 0) / Math.max(1, gisFields.length)
    );
    const fleetGrade = fleetHealthScore >= 85 ? "A" : fleetHealthScore >= 70 ? "B" : fleetHealthScore >= 50 ? "C" : "D";

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* ═══ TOP-LEVEL EXECUTIVE MACRO KPIS ═══ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Fleet Health Index */}
                <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-blue-500/50 transition-all">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Fleet Asset Health
                            </span>
                            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                <ShieldCheck className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-3">
                            <span className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                                {fleetHealthScore}%
                            </span>
                            <span className="text-sm font-black px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                                Grade {fleetGrade}
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2 font-medium">
                            Aggregated across {gisFields.length} offshore fields & {summaries.length} platforms
                        </p>
                    </CardContent>
                </Card>

                {/* 2. Total Active Anomalies */}
                <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-rose-500/50 transition-all">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all" />
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Active Anomalies
                            </span>
                            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                <AlertTriangle className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-3">
                            <span className="text-4xl font-black tracking-tight text-rose-600 dark:text-rose-400">
                                {kpiData.openAnomalies || kpiData.totalAnomalies || 0}
                            </span>
                            <span className="text-xs font-bold text-slate-400">
                                of {kpiData.totalAnomalies || 0} logged
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                            <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold">
                                {summaries.reduce((a, s) => a + (s.anomalies?.byPriority?.["P1"] || 0), 0)} Critical P1 Anomalies
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Fleet-Wide Average RUL */}
                <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-amber-500/50 transition-all">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Fleet Average RUL
                            </span>
                            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                <Clock className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                                {avgRul}
                            </span>
                            <span className="text-base font-black text-slate-400">Years</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2 font-medium">
                            Linear regression to API RP 2A minimum thickness limit
                        </p>
                    </CardContent>
                </Card>

                {/* 4. SOW Compliance Percentage */}
                <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-emerald-500/50 transition-all">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Inspection SOW Compliance
                            </span>
                            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                <TrendingUp className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                                {kpiData.sowPct}%
                            </span>
                            <span className="text-xs font-bold text-slate-400">Complete</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
                            <div
                                className="bg-emerald-500 h-full rounded-full transition-all duration-1000"
                                style={{ width: `${kpiData.sowPct}%` }}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ═══ INTERACTIVE GIS REGIONAL OFFSHORE MAP ═══ */}
            <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-xl overflow-hidden">
                <CardHeader className="p-6 pb-2 border-b border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <Compass className="w-5 h-5 text-blue-500" />
                            <CardTitle className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white">
                                Offshore Regional Asset Map (South China Sea Basin)
                            </CardTitle>
                        </div>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                            Real-time Red / Amber / Green asset health status pins across regional offshore fields
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Map Basin selector */}
                        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider">
                            {["ALL", "SKO", "PMO"].map(b => (
                                <button
                                    key={b}
                                    onClick={() => setSelectedBasin(b)}
                                    className={cn(
                                        "px-2.5 py-1 rounded-lg transition-all",
                                        selectedBasin === b
                                            ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                                            : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                    )}
                                >
                                    {b === "ALL" ? "All Basins" : b}
                                </button>
                            ))}
                        </div>

                        {/* Legend */}
                        <div className="hidden sm:flex items-center gap-3 text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                                <span>Optimal (&gt;75%)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
                                <span>Medium (50-75%)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50 animate-pulse" />
                                <span>Critical (&lt;50%)</span>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-6 relative">
                    {/* SVG Marine Chart */}
                    <div className="relative w-full h-[460px] bg-gradient-to-b from-slate-950 via-[#071329] to-[#040c1a] rounded-2xl overflow-hidden border border-slate-800/80 shadow-inner">
                        {/* Sea Grid & Bathymetry Lines */}
                        <svg className="w-full h-full" viewBox="0 0 1000 600">
                            <defs>
                                <pattern id="gisGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.4" />
                                </pattern>
                                <radialGradient id="depthGradient" cx="60%" cy="40%" r="60%">
                                    <stop offset="0%" stopColor="#0f172a" stopOpacity="0.1" />
                                    <stop offset="100%" stopColor="#020617" stopOpacity="0.8" />
                                </radialGradient>
                                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                                    <feMerge>
                                        <feMergeNode in="coloredBlur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                            </defs>

                            {/* Background Ocean Fill */}
                            <rect width="1000" height="600" fill="url(#gisGrid)" />
                            <rect width="1000" height="600" fill="url(#depthGradient)" />

                            {/* Contours (Bathymetric Curves representing -20m, -50m, -100m, -200m depth) */}
                            <path d="M 0,220 Q 250,260 500,210 T 1000,180" fill="none" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="3,6" opacity="0.25" />
                            <path d="M 0,340 Q 300,380 600,320 T 1000,280" fill="none" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="4,8" opacity="0.35" />
                            <path d="M 0,460 Q 350,520 700,430 T 1000,380" fill="none" stroke="#0ea5e9" strokeWidth="1.2" strokeDasharray="2,6" opacity="0.4" />

                            {/* Stylized Coastline of Sarawak / Peninsular */}
                            <path
                                d="M 50,600 C 120,540 180,480 280,510 C 380,540 450,580 520,530 C 600,480 700,520 850,510 C 920,505 970,550 1000,580 L 1000,600 Z"
                                fill="#0f172a"
                                stroke="#334155"
                                strokeWidth="1.5"
                                opacity="0.6"
                            />
                            <text x="350" y="570" fill="#475569" fontSize="11" fontWeight="800" letterSpacing="0.2em">
                                SARAWAK COASTLINE (BINTULU / MIRI)
                            </text>

                            {/* Depth markers */}
                            <text x="60" y="210" fill="#38bdf8" fontSize="9" opacity="0.5">-200m Continental Shelf</text>
                            <text x="60" y="330" fill="#38bdf8" fontSize="9" opacity="0.5">-80m Water Depth</text>
                            <text x="60" y="450" fill="#38bdf8" fontSize="9" opacity="0.5">-40m Nearshore Shallow</text>

                            {/* Coordinates labels */}
                            <text x="890" y="40" fill="#475569" fontSize="9" fontFamily="monospace">LAT 04°45'N</text>
                            <text x="890" y="55" fill="#475569" fontSize="9" fontFamily="monospace">LNG 113°55'E</text>

                            {/* Render Field Pins */}
                            {displayedFields.map((field, idx) => {
                                const isCritical = field.pin_color === "RED";
                                const isAmber = field.pin_color === "AMBER";
                                const pinColor = isCritical ? "#f43f5e" : isAmber ? "#f59e0b" : "#10b981";

                                return (
                                    <g
                                        key={`gis-field-pin-${field.field_name || field.id || idx}-${idx}`}
                                        className="cursor-pointer transition-transform hover:scale-125"
                                        onClick={() => onSelectField(field.field_name)}
                                        onMouseEnter={() => setHoveredField(field)}
                                        onMouseLeave={() => setHoveredField(null)}
                                    >
                                        {/* Outer pulse wave */}
                                        <circle
                                            cx={field.map_x}
                                            cy={field.map_y}
                                            r={isCritical ? "18" : "14"}
                                            fill={pinColor}
                                            opacity="0.2"
                                            className={isCritical ? "animate-ping" : ""}
                                        />

                                        {/* Glow circle */}
                                        <circle
                                            cx={field.map_x}
                                            cy={field.map_y}
                                            r="10"
                                            fill={pinColor}
                                            filter="url(#glow)"
                                            opacity="0.8"
                                        />

                                        {/* Core Pin */}
                                        <circle
                                            cx={field.map_x}
                                            cy={field.map_y}
                                            r="5"
                                            fill="#ffffff"
                                        />

                                        {/* Field Label */}
                                        <text
                                            x={field.map_x + 12}
                                            y={field.map_y + 4}
                                            fill="#f8fafc"
                                            fontSize="10"
                                            fontWeight="800"
                                            letterSpacing="0.05em"
                                            className="drop-shadow-md select-none"
                                        >
                                            {field.field_name}
                                        </text>
                                    </g>
                                );
                            })}
                        </svg>

                        {/* Interactive Tooltip Card overlay when hovering on a field */}
                        {hoveredField && (
                            <div
                                className="absolute pointer-events-none z-30 p-4 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-md w-64 text-white animate-in fade-in zoom-in-95 duration-200"
                                style={{
                                    left: `${Math.min(80, Math.max(5, (hoveredField.map_x / 1000) * 100 - 10))}%`,
                                    top: `${Math.min(70, Math.max(5, (hoveredField.map_y / 600) * 100 - 5))}%`,
                                }}
                            >
                                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                                    <span className="text-xs font-black uppercase text-blue-400">
                                        {hoveredField.field_name} Field
                                    </span>
                                    <span
                                        className={cn(
                                            "text-[9px] font-black px-2 py-0.5 rounded-full uppercase",
                                            hoveredField.pin_color === "RED"
                                                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                                : hoveredField.pin_color === "AMBER"
                                                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                        )}
                                    >
                                        Health {hoveredField.health_score}%
                                    </span>
                                </div>
                                <div className="space-y-1.5 text-[11px] font-bold">
                                    <div className="flex justify-between text-slate-400">
                                        <span>Platforms:</span>
                                        <span className="text-white">{hoveredField.platform_count} Assets</span>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                        <span>Open Anomalies:</span>
                                        <span className={hoveredField.open_anomalies > 0 ? "text-rose-400" : "text-emerald-400"}>
                                            {hoveredField.open_anomalies}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                        <span>Average RUL:</span>
                                        <span className="text-amber-400">{hoveredField.avg_rul_years} Years</span>
                                    </div>
                                </div>
                                <div className="mt-3 pt-2 border-t border-slate-800 text-[9px] text-blue-300 font-extrabold text-center uppercase tracking-wider">
                                    Click pin to filter this field
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ═══ 5-YEAR MAINTENANCE CAPEX FORECAST & ANOMALY SEVERITY DONUT ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 5-Year Maintenance CAPEX Forecast Bar Chart */}
                <Card className="lg:col-span-2 rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-lg p-6">
                    <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                        <div>
                            <div className="flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-emerald-500" />
                                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                    5-Year Maintenance CAPEX Forecast ($M USD)
                                </CardTitle>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium">
                                Projected intervention budget based on defect criticality, anode depletion, and scour risk
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {capex5yr.map((c: any) => {
                            const pct = Math.min(100, Math.round((c.total_m / maxCapex) * 100));
                            return (
                                <div key={c.year} className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs font-bold">
                                        <span className="text-slate-700 dark:text-slate-300 font-black">
                                            {c.year} Forecast
                                        </span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] text-slate-400">
                                                Repairs: ${c.critical_repairs}M · Retrofits: ${c.anode_retrofits}M
                                            </span>
                                            <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                                                ${c.total_m}M
                                            </span>
                                        </div>
                                    </div>
                                    {/* Multi-tier progress bar */}
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-xl overflow-hidden flex">
                                        <div
                                            className="bg-rose-500 h-full transition-all duration-1000"
                                            style={{ width: `${(c.critical_repairs / maxCapex) * 100}%` }}
                                            title="Critical Repairs"
                                        />
                                        <div
                                            className="bg-amber-500 h-full transition-all duration-1000"
                                            style={{ width: `${(c.anode_retrofits / maxCapex) * 100}%` }}
                                            title="Anode Retrofits"
                                        />
                                        <div
                                            className="bg-blue-500 h-full transition-all duration-1000"
                                            style={{ width: `${(c.routine_inspections / maxCapex) * 100}%` }}
                                            title="Routine Class Inspections"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex items-center justify-center gap-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-500">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                            <span>Critical P1/P2 Repairs</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                            <span>Anode Fleet Retrofits</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                            <span>Routine SOW Surveys</span>
                        </div>
                    </div>
                </Card>

                {/* Anomaly Severity Breakdown */}
                <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-lg p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                            <AlertTriangle className="w-5 h-5 text-rose-500" />
                            <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                Anomalies by Severity
                            </CardTitle>
                        </div>

                        {/* Visual breakdown bars */}
                        <div className="space-y-3">
                            {[
                                {
                                    level: "Critical (P1)",
                                    count: summaries.reduce((a, s) => a + (s.anomalies?.byPriority?.["P1"] || 0), 0),
                                    color: "bg-rose-500",
                                    textColor: "text-rose-500",
                                },
                                {
                                    level: "High (P2)",
                                    count: summaries.reduce((a, s) => a + (s.anomalies?.byPriority?.["P2"] || 0), 0),
                                    color: "bg-orange-500",
                                    textColor: "text-orange-500",
                                },
                                {
                                    level: "Medium (P3)",
                                    count: summaries.reduce((a, s) => a + (s.anomalies?.byPriority?.["P3"] || 0), 0),
                                    color: "bg-amber-500",
                                    textColor: "text-amber-500",
                                },
                                {
                                    level: "Low / Observation",
                                    count: Math.max(0, (kpiData.totalAnomalies || 0) -
                                        summaries.reduce((a, s) => a + (s.anomalies?.byPriority?.["P1"] || 0) + (s.anomalies?.byPriority?.["P2"] || 0) + (s.anomalies?.byPriority?.["P3"] || 0), 0)
                                    ),
                                    color: "bg-emerald-500",
                                    textColor: "text-emerald-500",
                                },
                            ].map(item => {
                                const total = Math.max(1, kpiData.totalAnomalies || 1);
                                const pct = Math.round((item.count / total) * 100);
                                return (
                                    <div key={item.level} className="space-y-1">
                                        <div className="flex items-center justify-between text-xs font-bold">
                                            <span className="text-slate-600 dark:text-slate-400">{item.level}</span>
                                            <span className={cn("font-black", item.textColor)}>
                                                {item.count} ({pct}%)
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                            <div
                                                className={cn("h-full rounded-full transition-all duration-1000", item.color)}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
                        <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Rectification Rate
                                </span>
                                <span className="text-xl font-black text-blue-600 dark:text-blue-400">
                                    {Math.round(((summaries.reduce((a, s) => a + (s.anomalies?.rectified || 0), 0)) / Math.max(1, kpiData.totalAnomalies || 1)) * 100)}%
                                </span>
                            </div>
                            <span className="text-xs text-slate-400 font-bold">
                                {summaries.reduce((a, s) => a + (s.anomalies?.rectified || 0), 0)} Closed
                            </span>
                        </div>
                    </div>
                </Card>
            </div>

            {/* ═══ REGIONAL ASSET FLEET DRILL-DOWN TABLE ═══ */}
            <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-lg overflow-hidden">
                <CardHeader className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                            Fleet Platforms Health Ranking
                        </CardTitle>
                        <p className="text-[11px] text-slate-400 font-medium">
                            Click any structure to drill down directly into the Micro Digital Twin View
                        </p>
                    </div>
                </CardHeader>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                <th className="p-4 pl-6">Platform / Structure</th>
                                <th className="p-4">Oil Field</th>
                                <th className="p-4 text-center">Health Grade</th>
                                <th className="p-4">Corrosion Rate</th>
                                <th className="p-4">Predicted RUL</th>
                                <th className="p-4">Open Anomalies</th>
                                <th className="p-4">CP Average</th>
                                <th className="p-4 pr-6 text-right">Drill-Down</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                            {summaries.map((s: any, idx: number) => {
                                const rul = s.wall_thickness?.rul_years || 15;
                                const isCritical = rul < 5 || (s.anomalies?.byPriority?.["P1"] || 0) > 0;
                                return (
                                    <tr
                                        key={`fleet-platform-row-${s.structure_id || 'sid'}-${s.jobpack_id || 'jpid'}-${idx}`}
                                        className="hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-colors cursor-pointer group"
                                        onClick={() => onSelectPlatform(s.structure_id)}
                                    >
                                        <td className="p-4 pl-6 font-black text-slate-900 dark:text-white flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                                            <span>{s.structure_name}</span>
                                        </td>
                                        <td className="p-4 text-slate-500">{s.field_name}</td>
                                        <td className="p-4 text-center">
                                            <span className={cn(
                                                "px-2.5 py-0.5 rounded-full text-[10px] font-black",
                                                isCritical
                                                    ? "bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400"
                                                    : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                            )}>
                                                {isCritical ? "Grade D" : "Grade A"}
                                            </span>
                                        </td>
                                        <td className="p-4">{s.wall_thickness?.corrosion_rate_mm_yr || 0.12} mm/yr</td>
                                        <td className="p-4 font-black">
                                            <span className={rul < 5 ? "text-rose-500" : rul < 10 ? "text-amber-500" : "text-emerald-500"}>
                                                {rul} Years (Exp {s.wall_thickness?.failure_year || 2043})
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className={s.anomalies.open > 0 ? "text-rose-500 font-black" : "text-slate-400"}>
                                                {s.anomalies.open} open
                                            </span>
                                        </td>
                                        <td className="p-4">{s.cp.avg ? `${s.cp.avg} mV` : "N/A"}</td>
                                        <td className="p-4 pr-6 text-right">
                                            <button className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/20 transition-all">
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
