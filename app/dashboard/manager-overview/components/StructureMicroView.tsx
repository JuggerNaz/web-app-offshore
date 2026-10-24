"use client";

import React, { useState, useMemo } from "react";
import {
    Activity,
    Layers,
    Shield,
    AlertCircle,
    CheckCircle2,
    Anchor,
    Eye,
    TrendingDown,
    Zap,
    LifeBuoy
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Live2DStructureViewer } from "./Live2DStructureViewer";

interface StructureMicroViewProps {
    structure: any;
    predictions: any;
    summaries: any[];
}

export function StructureMicroView({
    structure,
    predictions,
    summaries,
}: StructureMicroViewProps) {
    const [selectedRiskCell, setSelectedRiskCell] = useState<{ p: number; c: number } | null>(null);
    const [selectedComponentNode, setSelectedComponentNode] = useState<string | null>("LG");
    const [is2DExpanded, setIs2DExpanded] = useState(false);

    // Get active structure summary or first summary
    const activeSummary = useMemo(() => {
        if (!structure) return summaries[0] || null;
        return summaries.find(s => String(s.structure_id) === String(structure.plat_id || structure.id)) || summaries[0] || null;
    }, [structure, summaries]);

    // Component health scores from predictions
    const healthData = useMemo(() => {
        if (!predictions?.component_health_scores || predictions.component_health_scores.length === 0) {
            return {
                overall_score: 82,
                grade: "B",
                components: {
                    jacket: { score: 85, label: "Jacket Legs & Braces", status: "NORMAL" },
                    boatlanding: { score: 42, label: "Boatlanding & Fenders", status: "ATTENTION" },
                    caisson: { score: 78, label: "Caissons & Sumps", status: "NORMAL" },
                    riser: { score: 89, label: "Risers & Clamps", status: "NORMAL" },
                    anode: { score: 74, label: "Cathodic Protection", status: "NORMAL" },
                    foundation: { score: 91, label: "Seabed & Piles", status: "NORMAL" },
                }
            };
        }
        const match = predictions.component_health_scores.find((h: any) =>
            h.structure === activeSummary?.structure_name
        );
        return match || predictions.component_health_scores[0];
    }, [predictions, activeSummary]);

    // Risk Matrix 5x5 data
    const matrixCells = useMemo(() => {
        return predictions?.risk_matrix_5x5 || [];
    }, [predictions]);

    // Filtered components when clicking a cell in the 5x5 matrix
    const selectedCellComponents = useMemo(() => {
        if (!selectedRiskCell) return [];
        const cell = matrixCells.find((c: any) => c.p === selectedRiskCell.p && c.c === selectedRiskCell.c);
        return cell ? cell.components : [];
    }, [matrixCells, selectedRiskCell]);

    if (!activeSummary) {
        return (
            <div className="p-12 text-center text-slate-400 font-bold">
                No platform selected. Please select a platform from the filter bar above.
            </div>
        );
    }

    const comps = healthData.components;

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* ═══ PLATFORM HEADER BAR ═══ */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-lg">
                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-500/20">
                        {activeSummary.structure_name.slice(0, 3)}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                            <span>Field: {activeSummary.field_name}</span>
                            <span>·</span>
                            <span>Water Depth: {activeSummary.platform_info?.water_depth || 55}m</span>
                            <span>·</span>
                            <span>Installed: {activeSummary.platform_info?.install_year || 1990}</span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                            {activeSummary.structure_name} Digital Twin
                        </h2>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                            Asset Integrity Index
                        </span>
                        <div className="flex items-center gap-2 justify-end">
                            <span className="text-3xl font-black text-blue-600 dark:text-blue-400">
                                {healthData.overall_score}%
                            </span>
                            <span className="text-sm font-black px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                                Grade {healthData.grade}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ COMPONENT HEALTH GAUGES ═══ */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    { key: "jacket", label: "Jacket Legs & Braces", score: comps?.jacket?.score ?? 85, icon: Layers, alert: (comps?.jacket?.score ?? 85) < 60 },
                    { key: "boatlanding", label: "Boatlanding / Fenders", score: comps?.boatlanding?.score ?? 42, icon: LifeBuoy, alert: (comps?.boatlanding?.score ?? 42) < 50 },
                    { key: "caisson", label: "Caissons & Sumps", score: comps?.caisson?.score ?? 78, icon: Activity, alert: (comps?.caisson?.score ?? 78) < 65 },
                    { key: "riser", label: "Risers & Clamps", score: comps?.riser?.score ?? 89, icon: Anchor, alert: (comps?.riser?.score ?? 89) < 70 },
                    { key: "anode", label: "Cathodic Protection", score: comps?.anode?.score ?? 74, icon: Zap, alert: (comps?.anode?.score ?? 74) < 60 },
                    { key: "foundation", label: "Seabed Foundation", score: comps?.foundation?.score ?? 91, icon: Shield, alert: (comps?.foundation?.score ?? 91) < 70 },
                ].map((item) => {
                    const Icon = item.icon;
                    return (
                        <div
                            key={item.key}
                            onClick={() => setSelectedComponentNode(item.key)}
                            className={cn(
                                "p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group hover:scale-[1.02]",
                                selectedComponentNode === item.key
                                    ? "bg-blue-50/80 dark:bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/20"
                                    : "bg-white/70 dark:bg-slate-900/70 border-slate-200/80 dark:border-slate-800"
                            )}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <Icon className={cn("w-4 h-4", item.alert ? "text-rose-500" : "text-blue-500")} />
                                <span className={cn(
                                    "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                                    item.alert ? "bg-rose-100 dark:bg-rose-500/20 text-rose-600" : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600"
                                )}>
                                    {item.alert ? "Alert" : "OK"}
                                </span>
                            </div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white">
                                {item.score}%
                            </div>
                            <div className="text-[10px] font-bold text-slate-500 truncate mt-1">
                                {item.label}
                            </div>
                            {/* Tiny progress bar */}
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                                <div
                                    className={cn("h-full rounded-full transition-all duration-700", item.alert ? "bg-rose-500" : "bg-blue-500")}
                                    style={{ width: `${item.score}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ═══ 2D SCHEMATIC DIGITAL TWIN & 5x5 RISK MATRIX ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* 2D Elevation Schematic / Digital Twin */}
                <div className={cn("transition-all duration-500", is2DExpanded ? "lg:col-span-12" : "lg:col-span-7")}>
                    <Live2DStructureViewer
                        structure={structure}
                        activeSummary={activeSummary}
                        isExpanded={is2DExpanded}
                        onToggleExpand={() => setIs2DExpanded(prev => !prev)}
                    />
                </div>

                {/* 5x5 Risk Matrix Heatmap */}
                <Card className={cn("rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-lg p-6 flex flex-col justify-between transition-all duration-500", is2DExpanded ? "lg:col-span-12" : "lg:col-span-5")}>
                    <div>
                        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-rose-500" />
                                    5x5 Risk Matrix Heatmap
                                </CardTitle>
                                <p className="text-[11px] text-slate-400 font-medium">
                                    Probability of Failure (PoF) vs Consequence (CoF)
                                </p>
                            </div>
                        </div>

                        {/* The 5x5 Grid */}
                        <div className="space-y-1">
                            <div className="text-[9px] font-black uppercase text-slate-400 text-center tracking-widest mb-1">
                                ▲ PROBABILITY OF FAILURE (1 = RARE ➔ 5 = CERTAIN)
                            </div>

                            <div className="flex">
                                {/* Y-axis labels */}
                                <div className="flex flex-col justify-between pr-2 text-[9px] font-black text-slate-400 py-1">
                                    <span>P5</span>
                                    <span>P4</span>
                                    <span>P3</span>
                                    <span>P2</span>
                                    <span>P1</span>
                                </div>

                                {/* Matrix body */}
                                <div className="grid grid-cols-5 gap-1.5 flex-1">
                                    {[5, 4, 3, 2, 1].map((p) =>
                                        [1, 2, 3, 4, 5].map((c) => {
                                            const score = p * c;
                                            const cell = matrixCells.find((m: any) => m.p === p && m.c === c);
                                            const count = cell?.count || 0;
                                            const isSelected = selectedRiskCell?.p === p && selectedRiskCell?.c === c;

                                            // Determine color by risk severity
                                            const bgColor =
                                                score >= 15
                                                    ? "bg-rose-500 hover:bg-rose-600 text-white"
                                                    : score >= 10
                                                        ? "bg-orange-500 hover:bg-orange-600 text-white"
                                                        : score >= 5
                                                            ? "bg-amber-400 hover:bg-amber-500 text-slate-900"
                                                            : "bg-emerald-500 hover:bg-emerald-600 text-white";

                                            return (
                                                <button
                                                    key={`${p}-${c}`}
                                                    onClick={() => setSelectedRiskCell({ p, c })}
                                                    className={cn(
                                                        "h-11 rounded-xl flex flex-col items-center justify-center font-black transition-all cursor-pointer relative",
                                                        bgColor,
                                                        isSelected ? "ring-4 ring-blue-500 scale-105 z-10" : "opacity-90 hover:opacity-100"
                                                    )}
                                                >
                                                    <span className="text-xs">{count > 0 ? count : ""}</span>
                                                    <span className="text-[7px] opacity-75">{p}x{c}</span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            <div className="text-[9px] font-black uppercase text-slate-400 text-center tracking-widest pt-2">
                                CONSEQUENCE OF FAILURE (1 = NEGLIGIBLE ➔ 5 = CATASTROPHIC) ►
                            </div>
                        </div>

                        {/* Selected cell details */}
                        {selectedRiskCell && (
                            <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 animate-in fade-in duration-300">
                                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-700 text-xs font-black">
                                    <span>Selected Cell: P{selectedRiskCell.p} x C{selectedRiskCell.c}</span>
                                    <span className="text-blue-600 dark:text-blue-400 font-extrabold">
                                        {selectedCellComponents.length} Affected Elements
                                    </span>
                                </div>
                                {selectedCellComponents.length > 0 ? (
                                    <ul className="space-y-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                        {selectedCellComponents.map((comp: string, i: number) => (
                                            <li key={i} className="flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                                <span>{comp}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-[10px] text-slate-400 italic">
                                        No active components in this risk cell.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400">
                        <span>Red: Immediate Work Order</span>
                        <span>Amber: Schedule Q3</span>
                        <span>Green: Routine</span>
                    </div>
                </Card>
            </div>
        </div>
    );
}
