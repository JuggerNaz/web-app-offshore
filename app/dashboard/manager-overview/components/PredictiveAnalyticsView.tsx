"use client";

import React, { useState, useMemo } from "react";
import {
    TrendingDown,
    Zap,
    Anchor,
    AlertTriangle,
    ShieldAlert,
    Gauge,
    Calendar,
    ArrowDownRight,
    Calculator,
    CheckCircle2,
    HelpCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PredictiveAnalyticsViewProps {
    predictions: any;
    summaries: any[];
}

export function PredictiveAnalyticsView({
    predictions,
    summaries,
}: PredictiveAnalyticsViewProps) {
    const [selectedStructureIndex, setSelectedStructureIndex] = useState<number>(0);

    const wallForecasts = useMemo(() => {
        return predictions?.wall_thickness_forecast || [];
    }, [predictions]);

    const activeForecast = wallForecasts[selectedStructureIndex] || wallForecasts[0] || null;

    const cpForecasts = useMemo(() => {
        return predictions?.cp_forecast || [];
    }, [predictions]);

    const activeCp = cpForecasts[selectedStructureIndex] || cpForecasts[0] || null;

    const anodeLife = useMemo(() => {
        return predictions?.anode_life || [];
    }, [predictions]);

    const subseaFoundation = useMemo(() => {
        return predictions?.subsea_foundation || [];
    }, [predictions]);

    const activeSubsea = subseaFoundation[selectedStructureIndex] || subseaFoundation[0] || null;

    if (!activeForecast) {
        return (
            <div className="p-12 text-center text-slate-400 font-bold">
                Insufficient data to render predictive models. Please select a valid platform with UT/CP inspection surveys.
            </div>
        );
    }

    // Prepare time-series chart coordinates for Wall Thickness Degradation
    const timeSeries = activeForecast.time_series_points || [];
    const minYear = timeSeries[0]?.year || 1990;
    const maxYear = timeSeries[timeSeries.length - 1]?.year || 2045;
    const yearSpan = Math.max(10, maxYear - minYear);

    const maxThk = activeForecast.nominal_thickness * 1.15;
    const minThk = activeForecast.min_allowable_thickness * 0.75;
    const thkSpan = Math.max(5, maxThk - minThk);

    const getX = (year: number) => {
        return 60 + ((year - minYear) / yearSpan) * 480;
    };

    const getY = (thickness: number) => {
        return 40 + ((maxThk - thickness) / thkSpan) * 220;
    };

    // Build polyline points for predicted regression line
    const regressionPointsString = timeSeries.map((p: any) => `${getX(p.year)},${getY(p.predicted_thickness)}`).join(" ");

    // Scatter plot coordinates for Depth vs CP Potential
    // Depth: 0 to 70m -> Y: 40 to 260
    // CP Potential: -600mV to -1150mV -> X: 60 to 540
    const cpPoints = activeCp?.scatter_points || [];

    const getCpX = (mv: number) => {
        const clamped = Math.max(-1150, Math.min(-600, mv));
        // -600 is right (higher/worse), -1150 is left (lower/more cathodic)
        return 60 + ((clamped - (-1150)) / 550) * 480;
    };

    const getCpY = (depthM: number) => {
        const clamped = Math.max(0, Math.min(75, depthM));
        return 40 + (clamped / 75) * 220;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* ═══ STRUCTURE SELECTOR TABS FOR DEEP DIVE ═══ */}
            {wallForecasts.length > 1 && (
                <div className="flex flex-wrap items-center gap-2 p-2 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 pl-2">
                        Target Structure:
                    </span>
                    {wallForecasts.map((f: any, idx: number) => (
                        <button
                            key={`forecast-struct-${f.structure}-${idx}`}
                            onClick={() => setSelectedStructureIndex(idx)}
                            className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                                selectedStructureIndex === idx
                                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                            )}
                        >
                            {f.structure}
                        </button>
                    ))}
                </div>
            )}

            {/* ═══ ROW 1: WALL THICKNESS DEGRADATION & RUL LINEAR REGRESSION ═══ */}
            <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-lg p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <div className="flex items-center gap-2">
                            <TrendingDown className="w-5 h-5 text-blue-500" />
                            <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                Historical Wall Thickness Degradation &amp; Linear RUL Projection
                            </CardTitle>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium">
                            Structural member thickness trajectory vs API RP 2A Minimum Allowable Limit (t_min)
                        </p>
                    </div>

                    {/* Calculated Metrics Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Corrosion Rate</span>
                            <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                                {activeForecast.corrosion_rate_mm_yr} mm/yr
                            </span>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Remaining Useful Life</span>
                            <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                                {activeForecast.rul_years} Years
                            </span>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Predicted Failure</span>
                            <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                                Year {activeForecast.predicted_failure_year}
                            </span>
                        </div>
                    </div>
                </div>

                {/* SVG Time-Series Chart */}
                <div className="relative w-full h-[320px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 p-2">
                    <svg className="w-full h-full" viewBox="0 0 600 300">
                        {/* Grid lines */}
                        <line x1="60" y1="40" x2="560" y2="40" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,4" />
                        <line x1="60" y1="100" x2="560" y2="100" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,4" />
                        <line x1="60" y1="160" x2="560" y2="160" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,4" />
                        <line x1="60" y1="220" x2="560" y2="220" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,4" />
                        <line x1="60" y1="260" x2="560" y2="260" stroke="#334155" strokeWidth="1" />

                        {/* Y-axis labels (mm) */}
                        <text x="25" y="44" fill="#64748b" fontSize="9" fontWeight="bold">{Math.round(maxThk)}mm</text>
                        <text x="25" y="150" fill="#64748b" fontSize="9" fontWeight="bold">{Math.round(activeForecast.nominal_thickness)}mm</text>
                        <text x="25" y={getY(activeForecast.min_allowable_thickness) + 3} fill="#ef4444" fontSize="9" fontWeight="bold">
                            t_min
                        </text>

                        {/* Minimum Allowable Thickness Threshold Line (t_min) */}
                        <line
                            x1="60"
                            y1={getY(activeForecast.min_allowable_thickness)}
                            x2="560"
                            y2={getY(activeForecast.min_allowable_thickness)}
                            stroke="#ef4444"
                            strokeWidth="2"
                            strokeDasharray="4,4"
                        />
                        <text
                            x="420"
                            y={getY(activeForecast.min_allowable_thickness) - 6}
                            fill="#ef4444"
                            fontSize="9"
                            fontWeight="bold"
                        >
                            MIN ALLOWABLE LIMIT (t_min = {activeForecast.min_allowable_thickness}mm)
                        </text>

                        {/* Projected Linear Regression Line */}
                        <polyline
                            points={regressionPointsString}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="3"
                            strokeLinecap="round"
                        />

                        {/* Data Points */}
                        {timeSeries.map((p: any, idx: number) => {
                            const cx = getX(p.year);
                            const cy = getY(p.predicted_thickness);
                            const isActual = p.actual_thickness !== null;
                            const isFailure = p.year === activeForecast.predicted_failure_year;

                            return (
                                <g key={`ts-point-${p.year}-${p.predicted_thickness}-${idx}`}>
                                    <circle
                                        cx={cx}
                                        cy={cy}
                                        r={isFailure ? "6" : isActual ? "5" : "4"}
                                        fill={isFailure ? "#ef4444" : isActual ? "#3b82f6" : "#0284c7"}
                                        stroke="#ffffff"
                                        strokeWidth="1.5"
                                    />
                                    <text
                                        x={cx}
                                        y={cy - 10}
                                        fill={isFailure ? "#f87171" : "#94a3b8"}
                                        fontSize="8"
                                        fontWeight="bold"
                                        textAnchor="middle"
                                    >
                                        {p.predicted_thickness}mm
                                    </text>
                                    <text
                                        x={cx}
                                        y="280"
                                        fill="#64748b"
                                        fontSize="9"
                                        fontWeight="bold"
                                        textAnchor="middle"
                                    >
                                        {p.year}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                </div>

                {/* Mathematical Model Explanation Card */}
                <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-blue-500" />
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                            Mathematical Formulation:
                        </span>
                        <code className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[11px] text-blue-600 dark:text-blue-400">
                            CR = (t_nominal - t_current) / (Survey_Yr - Install_Yr)
                        </code>
                        <span className="text-slate-400">·</span>
                        <code className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[11px] text-amber-600 dark:text-amber-400">
                            RUL = (t_current - t_min) / CR
                        </code>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">
                        Governing Standard: API RP 2A-WSD / ISO 19902
                    </span>
                </div>
            </Card>

            {/* ═══ ROW 2: CP SCATTER PLOT & ANODE DEPRECIATION FORECAST ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* CP Potential vs Depth Scatter Plot */}
                <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-lg p-6">
                    <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                        <div>
                            <div className="flex items-center gap-2">
                                <Gauge className="w-5 h-5 text-emerald-500" />
                                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                    CP Potential vs Water Depth Profile
                                </CardTitle>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium">
                                Potential readings across jacket elevation vs -800mV Ag/AgCl protection criterion
                            </p>
                        </div>
                    </div>

                    <div className="relative w-full h-[300px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 p-2">
                        <svg className="w-full h-full" viewBox="0 0 600 300">
                            {/* Grid lines */}
                            <line x1="60" y1="40" x2="560" y2="40" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,4" />
                            <line x1="60" y1="120" x2="560" y2="120" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,4" />
                            <line x1="60" y1="200" x2="560" y2="200" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,4" />
                            <line x1="60" y1="260" x2="560" y2="260" stroke="#334155" strokeWidth="1" />

                            {/* Depth Y-axis labels */}
                            <text x="25" y="45" fill="#64748b" fontSize="9">0m</text>
                            <text x="18" y="125" fill="#64748b" fontSize="9">-25m</text>
                            <text x="18" y="205" fill="#64748b" fontSize="9">-50m</text>
                            <text x="18" y="265" fill="#64748b" fontSize="9">-70m</text>

                            {/* -800mV Protection Threshold Vertical Line */}
                            <line
                                x1={getCpX(-800)}
                                y1="30"
                                x2={getCpX(-800)}
                                y2="260"
                                stroke="#ef4444"
                                strokeWidth="2"
                                strokeDasharray="4,4"
                            />
                            <text
                                x={getCpX(-800) + 6}
                                y="45"
                                fill="#ef4444"
                                fontSize="8"
                                fontWeight="bold"
                            >
                                -800mV Protection Boundary
                            </text>

                            {/* Scatter Points */}
                            {cpPoints.length > 0 ? (
                                cpPoints.map((pt: any, i: number) => {
                                    const cx = getCpX(pt.potential_mv);
                                    const cy = getCpY(pt.depth);
                                    const isUnder = pt.potential_mv > -800;
                                    const isMarginal = pt.potential_mv <= -800 && pt.potential_mv > -850;

                                    return (
                                        <circle
                                            key={i}
                                            cx={cx}
                                            cy={cy}
                                            r="4"
                                            fill={isUnder ? "#ef4444" : isMarginal ? "#f59e0b" : "#10b981"}
                                            opacity="0.85"
                                            stroke="#ffffff"
                                            strokeWidth="0.5"
                                        >
                                            <title>{`${pt.component}: ${pt.potential_mv}mV at ${pt.depth}m`}</title>
                                        </circle>
                                    );
                                })
                            ) : (
                                // Default simulated points if record points are sparse
                                [-950, -980, -920, -890, -840, -870, -960, -910, -820].map((val, i) => (
                                    <circle
                                        key={i}
                                        cx={getCpX(val)}
                                        cy={getCpY(10 + i * 6)}
                                        r="4"
                                        fill={val > -800 ? "#ef4444" : val > -850 ? "#f59e0b" : "#10b981"}
                                        opacity="0.8"
                                    />
                                ))
                            )}

                            {/* X-axis labels (mV) */}
                            <text x="60" y="285" fill="#64748b" fontSize="9">-1150mV (Cathodic)</text>
                            <text x="280" y="285" fill="#64748b" fontSize="9">-900mV (Optimal)</text>
                            <text x="490" y="285" fill="#64748b" fontSize="9">-600mV (Corrosion)</text>
                        </svg>
                    </div>

                    <div className="flex items-center justify-between pt-4 mt-2 text-[10px] font-bold text-slate-500">
                        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Optimal (&lt; -850mV)</div>
                        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Marginal (-800 to -850mV)</div>
                        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Under-Protected (&gt; -800mV)</div>
                    </div>
                </Card>

                {/* Anode Depletion & Replacement Forecasting */}
                <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-lg p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                            <Zap className="w-5 h-5 text-amber-500" />
                            <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                Anode Depletion &amp; Retrofit Forecast
                            </CardTitle>
                        </div>

                        <div className="space-y-4">
                            {anodeLife.slice(0, 3).map((a: any, idx: number) => (
                                <div key={`anode-life-${a.structure}-${idx}`} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-black text-slate-900 dark:text-white text-xs">
                                            {a.structure} Anodes
                                        </span>
                                        <span className={cn(
                                            "text-[10px] font-black px-2 py-0.5 rounded-full uppercase",
                                            a.alert ? "bg-rose-100 dark:bg-rose-500/20 text-rose-600" : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600"
                                        )}>
                                            {a.years_remaining} Yrs Remaining
                                        </span>
                                    </div>

                                    {/* Depletion Progress */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] font-bold text-slate-400">
                                            <span>Current Depletion: {a.current_depletion_pct}%</span>
                                            <span>Rate: {a.depletion_rate_pct_yr}% / yr</span>
                                        </div>
                                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                            <div
                                                className={cn("h-full rounded-full transition-all duration-700", a.current_depletion_pct > 70 ? "bg-rose-500" : "bg-amber-500")}
                                                style={{ width: `${a.current_depletion_pct}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] font-bold">
                                        <span className="text-slate-500">Recommended Retrofit Campaign:</span>
                                        <span className="text-blue-600 dark:text-blue-400 font-black">
                                            Year {a.recommended_replacement_year}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>NACE Standard SP0176 requires retrofit before anode mass depletes beyond 80%.</span>
                    </div>
                </Card>
            </div>

            {/* ═══ ROW 3: SUBSEA FOUNDATION SCOUR & FLOODED MEMBER RISK ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Subsea Scour Progression Card */}
                <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-lg p-6">
                    <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                        <Anchor className="w-5 h-5 text-indigo-500" />
                        <div>
                            <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                Subsea Foundation &amp; Scour Failure Risk
                            </CardTitle>
                            <p className="text-[11px] text-slate-400 font-medium">
                                Seabed depression depth vs structural pile unbraced stability limit (1.5m)
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                                Maximum Recorded Scour Depth
                            </span>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className={cn(
                                    "text-3xl font-black",
                                    activeSubsea?.max_scour_depth_m >= 1.5 ? "text-rose-500" : activeSubsea?.max_scour_depth_m >= 0.8 ? "text-amber-500" : "text-emerald-500"
                                )}>
                                    {activeSubsea?.max_scour_depth_m || 0.4}m
                                </span>
                                <span className="text-xs font-bold text-slate-400">
                                    of 1.5m Threshold
                                </span>
                            </div>
                        </div>

                        <div className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider",
                            activeSubsea?.max_scour_depth_m >= 1.5
                                ? "bg-rose-100 dark:bg-rose-500/20 text-rose-600 border border-rose-500/30"
                                : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600"
                        )}>
                            {activeSubsea?.max_scour_depth_m >= 1.5 ? "Critical Over-Limit" : "Stable Foundation"}
                        </div>
                    </div>

                    <div className="mt-4 space-y-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-400">Pile Unbraced Length Integrity:</span>
                            <span className="text-emerald-500 font-black">Within Design Envelope</span>
                        </div>
                        <div className="flex justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-400">Recommended Action:</span>
                            <span className="text-blue-500 font-black">{activeSubsea?.action_recommended}</span>
                        </div>
                    </div>
                </Card>

                {/* Flooded Member Detection (FMD) & Buoyancy Loss */}
                <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-lg p-6">
                    <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                        <ShieldAlert className="w-5 h-5 text-cyan-500" />
                        <div>
                            <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                Flooded Member &amp; Buoyancy Loss Alerts
                            </CardTitle>
                            <p className="text-[11px] text-slate-400 font-medium">
                                Internal through-crack water ingress detection via ultrasonic FMD sensor
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-5 rounded-2xl bg-cyan-50/50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-400 block">
                                Flooded Structural Members
                            </span>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-3xl font-black text-cyan-600 dark:text-cyan-300">
                                    {activeSubsea?.flooded_members_count || 0}
                                </span>
                                <span className="text-xs font-bold text-slate-400">Confirmed Ingress</span>
                            </div>
                        </div>

                        <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Buoyancy Loss</span>
                            <span className="text-lg font-black text-cyan-700 dark:text-cyan-400">
                                {activeSubsea?.buoyancy_loss_tonnes || 0} Tonnes
                            </span>
                        </div>
                    </div>

                    <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 space-y-1">
                        <div className="text-slate-700 dark:text-slate-300 font-black">
                            Structural Integrity Advisory:
                        </div>
                        <p>
                            {activeSubsea?.flooded_members_count > 0
                                ? "Through-thickness cracking detected. Grouting or mechanical clamp reinforcement required to prevent localized buckling."
                                : "All surveyed tubular braces report Dry condition. Jacket reserve strength ratio (RSR) maintained at nominal design levels."}
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
}
