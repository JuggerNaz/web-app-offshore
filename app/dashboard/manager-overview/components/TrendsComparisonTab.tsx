"use client";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const COMPARE_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981"];

interface SummaryItem {
    jobpack_id: number; jobpack_name: string; structure_name: string;
    date_start?: string;
    sow: { completionPct: number; completed: number; incomplete: number; pending: number; total: number };
    anomalies: { total: number; open: number; rectified: number; byPriority: Record<string, number> };
    cp: { avg: number | null; min: number | null; max: number | null; count: number };
    anode: { total: number; avgDepletion: number | null; depletionBuckets: Record<string, number> };
    fmd: { total: number; conditions: Record<string, number> };
}

const compConfig: ChartConfig = {
    job1: { label: "Job 1", color: COMPARE_COLORS[0] },
    job2: { label: "Job 2", color: COMPARE_COLORS[1] },
    job3: { label: "Job 3", color: COMPARE_COLORS[2] },
    job4: { label: "Job 4", color: COMPARE_COLORS[3] },
};

export function TrendsComparisonTab({ 
    summaries, 
    compareMode,
    labelMode = "jobpack"
}: { 
    summaries: SummaryItem[]; 
    compareMode: boolean;
    labelMode?: "jobpack" | "structure";
}) {
    if (summaries.length === 0) return (
        <div className="flex items-center justify-center h-48 text-slate-400 text-xs font-bold">No data for trending</div>
    );

    // Single mode — show summary charts for the selected jobpack(s)
    if (!compareMode || summaries.length === 1) {
        const s = summaries[0];
        return (
            <div className="space-y-4 animate-in fade-in duration-700">
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-lg">
                    <CardHeader><CardTitle className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Current Campaign Summary — {s.jobpack_name}</CardTitle></CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: "SOW Completion", value: `${s.sow.completionPct}%`, color: "blue" },
                                { label: "Anomalies", value: s.anomalies.total, color: "red" },
                                { label: "CP Avg", value: s.cp.avg !== null ? `${s.cp.avg}mV` : "N/A", color: "emerald" },
                                { label: "Anode Depletion", value: s.anode.avgDepletion !== null ? `${s.anode.avgDepletion}%` : "N/A", color: "amber" },
                            ].map(m => (
                                <div key={m.label} className={`p-4 rounded-xl bg-${m.color}-50 dark:bg-${m.color}-500/10 border border-${m.color}-200 dark:border-${m.color}-500/20 text-center`}>
                                    <div className={`text-2xl font-black text-${m.color}-600 dark:text-${m.color}-400`}>{m.value}</div>
                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">{m.label}</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Compare mode — multi-jobpack overlays
    const sowCompare = summaries.map((s, i) => {
        const year = s.date_start ? new Date(s.date_start).getFullYear() : "";
        const jpSuffix = s.jobpack_name?.split("/").pop() || "";
        const label = labelMode === "structure" 
            ? (year ? `${s.structure_name} (${year}${jpSuffix ? ` - ${jpSuffix}` : ""})` : s.structure_name) 
            : (jpSuffix || `Job ${i + 1}`);
        return {
            name: label,
            completed: s.sow.completed, incomplete: s.sow.incomplete, pending: s.sow.pending,
            completionPct: s.sow.completionPct, fill: COMPARE_COLORS[i],
        };
    });

    const anomalyCompare = summaries.map((s, i) => {
        const year = s.date_start ? new Date(s.date_start).getFullYear() : "";
        const jpSuffix = s.jobpack_name?.split("/").pop() || "";
        const label = labelMode === "structure" 
            ? (year ? `${s.structure_name} (${year}${jpSuffix ? ` - ${jpSuffix}` : ""})` : s.structure_name) 
            : (jpSuffix || `Job ${i + 1}`);
        return {
            name: label,
            P1: s.anomalies.byPriority["P1"] || 0,
            P2: s.anomalies.byPriority["P2"] || 0,
            P3: s.anomalies.byPriority["P3"] || 0,
            P4: s.anomalies.byPriority["P4"] || 0,
            P5: s.anomalies.byPriority["P5"] || 0,
        };
    });

    // Radar data for overall health
    const radarData = [
        { metric: "SOW", ...Object.fromEntries(summaries.map((s, i) => [`job${i + 1}`, s.sow.completionPct])) },
        { metric: "CP Health", ...Object.fromEntries(summaries.map((s, i) => [`job${i + 1}`, s.cp.avg !== null ? Math.min(100, Math.abs(s.cp.avg) / 12) : 0])) },
        { metric: "Anode", ...Object.fromEntries(summaries.map((s, i) => [`job${i + 1}`, s.anode.avgDepletion !== null ? 100 - s.anode.avgDepletion : 100])) },
        { metric: "FMD", ...Object.fromEntries(summaries.map((s, i) => [`job${i + 1}`, s.fmd.total > 0 ? Math.round(((s.fmd.conditions.dry || 0) / s.fmd.total) * 100) : 100])) },
        { metric: "No Anomaly", ...Object.fromEntries(summaries.map((s, i) => [`job${i + 1}`, s.anomalies.total > 0 ? Math.max(0, 100 - s.anomalies.total * 5) : 100])) },
    ];

    const anomalyConfig: ChartConfig = {
        P1: { label: "P1", color: "#ef4444" }, P2: { label: "P2", color: "#f97316" },
        P3: { label: "P3", color: "#eab308" }, P4: { label: "P4", color: "#3b82f6" }, P5: { label: "P5", color: "#6b7280" },
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-700">
            {/* SOW Comparison */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader><CardTitle className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">SOW Completion Comparison</CardTitle></CardHeader>
                <CardContent>
                    <ChartContainer config={compConfig} className="h-[240px] w-full">
                        <BarChart data={sowCompare}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
                            <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-[10px]" />
                            <YAxis tickLine={false} axisLine={false} width={40} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="completed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name="Completed" />
                            <Bar dataKey="incomplete" stackId="a" fill="#f59e0b" name="Incomplete" />
                            <Bar dataKey="pending" stackId="a" fill="#334155" radius={[4, 4, 0, 0]} name="Pending" />
                        </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Anomaly Evolution */}
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-lg">
                    <CardHeader><CardTitle className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Anomaly Priority Evolution</CardTitle></CardHeader>
                    <CardContent>
                        <ChartContainer config={anomalyConfig} className="h-[220px] w-full">
                            <BarChart data={anomalyCompare}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
                                <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-[10px]" />
                                <YAxis tickLine={false} axisLine={false} width={30} />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="P1" stackId="a" fill="#ef4444" />
                                <Bar dataKey="P2" stackId="a" fill="#f97316" />
                                <Bar dataKey="P3" stackId="a" fill="#eab308" />
                                <Bar dataKey="P4" stackId="a" fill="#3b82f6" />
                                <Bar dataKey="P5" stackId="a" fill="#6b7280" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* Health Radar */}
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-lg">
                    <CardHeader><CardTitle className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Overall Health Comparison</CardTitle></CardHeader>
                    <CardContent>
                        <ChartContainer config={compConfig} className="h-[220px] w-full mx-auto aspect-square max-w-[260px]">
                            <RadarChart data={radarData}>
                                <PolarGrid stroke="rgba(100,116,139,0.2)" />
                                <PolarAngleAxis dataKey="metric" className="text-[9px]" />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
                                {summaries.map((s, i) => {
                                    const year = s.date_start ? new Date(s.date_start).getFullYear() : "";
                                    const jpSuffix = s.jobpack_name?.split("/").pop() || "";
                                    const label = labelMode === "structure" 
                                        ? (year ? `${s.structure_name} (${year}${jpSuffix ? ` - ${jpSuffix}` : ""})` : s.structure_name) 
                                        : (jpSuffix || `Job ${i + 1}`);
                                    return (
                                        <Radar key={`${s.jobpack_id}-${s.structure_name}-${i}`} dataKey={`job${i + 1}`} 
                                            name={label}
                                            stroke={COMPARE_COLORS[i]} fill={COMPARE_COLORS[i]} fillOpacity={0.15} strokeWidth={2} />
                                    );
                                })}
                                <ChartTooltip content={<ChartTooltipContent />} />
                            </RadarChart>
                        </ChartContainer>
                        <div className="flex items-center justify-center gap-3 mt-2 flex-wrap">
                            {summaries.map((s, i) => {
                                const year = s.date_start ? new Date(s.date_start).getFullYear() : "";
                                const jpSuffix = s.jobpack_name?.split("/").pop() || "";
                                const label = labelMode === "structure" 
                                    ? (year ? `${s.structure_name} (${year}${jpSuffix ? ` - ${jpSuffix}` : ""})` : s.structure_name) 
                                    : (jpSuffix || `Job ${i + 1}`);
                                return (
                                    <div key={`${s.jobpack_id}-${s.structure_name}-${i}`} className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COMPARE_COLORS[i] }} />
                                        <span className="text-[9px] font-bold text-slate-500">{label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
