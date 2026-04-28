"use client";
import { Pie, PieChart, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const FMD_COLORS: Record<string, string> = { dry: "#10b981", flooded: "#ef4444", grouted: "#8b5cf6", inconclusive: "#f59e0b" };

interface FMDMGIData {
    fmd: { total: number; conditions: Record<string, number> };
    attachmentGroups?: Record<string, number>;
}

const fmdConfig: ChartConfig = {
    dry: { label: "Dry", color: "#10b981" },
    flooded: { label: "Flooded", color: "#ef4444" },
    grouted: { label: "Grouted", color: "#8b5cf6" },
    inconclusive: { label: "Inconclusive", color: "#f59e0b" },
};

export function FMDMGISection({ data }: { data: FMDMGIData }) {
    const fmdData = Object.entries(data.fmd.conditions).filter(([, v]) => v > 0).map(([k, v]) => ({
        name: k.charAt(0).toUpperCase() + k.slice(1), value: v, fill: FMD_COLORS[k] || "#6b7280",
    }));

    const attGroups = data.attachmentGroups || {};
    const attData = Object.entries(attGroups).filter(([, v]) => v > 0);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* FMD Status */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        FMD Member Status
                        <span className="ml-2 text-teal-500">{data.fmd.total} inspected</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {fmdData.length > 0 ? (
                        <div className="flex items-center gap-6">
                            <ChartContainer config={fmdConfig} className="h-[180px] w-[180px] mx-auto aspect-square">
                                <PieChart>
                                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                                    <Pie data={fmdData} dataKey="value" nameKey="name" innerRadius={45} strokeWidth={3}>
                                        {fmdData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                                    </Pie>
                                    <text x="50%" y="45%" textAnchor="middle" className="fill-foreground text-xl font-black">{data.fmd.total}</text>
                                    <text x="50%" y="58%" textAnchor="middle" className="fill-muted-foreground text-[9px] font-bold uppercase">Members</text>
                                </PieChart>
                            </ChartContainer>
                            <div className="flex-1 space-y-2">
                                {[
                                    { key: "dry", label: "Dry", color: "emerald" },
                                    { key: "flooded", label: "Flooded", color: "red" },
                                    { key: "grouted", label: "Grouted", color: "violet" },
                                    { key: "inconclusive", label: "Inconclusive", color: "amber" },
                                ].map(({ key, label, color }) => {
                                    const val = data.fmd.conditions[key] || 0;
                                    return (
                                        <div key={key} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${val > 0 ? `bg-${color}-50 dark:bg-${color}-500/10 border-${color}-200 dark:border-${color}-500/20` : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/30"}`}>
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${val > 0 ? `text-${color}-600 dark:text-${color}-400` : "text-slate-400"}`}>{label}</span>
                                            <span className={`text-sm font-black ${val > 0 ? `text-${color}-700 dark:text-${color}-300` : "text-slate-400"}`}>{val}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : <div className="h-[180px] flex items-center justify-center text-slate-400 text-xs font-bold">No FMD data</div>}
                </CardContent>
            </Card>

            {/* Attachment Groups */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        Attachment Groups
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {attData.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                            {attData.map(([name, count]) => (
                                <div key={name} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center transition-all hover:scale-[1.02]">
                                    <div className="text-2xl font-black text-slate-800 dark:text-white">{count}</div>
                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">{name}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-[180px] flex items-center justify-center text-slate-400 text-xs font-bold">No attachment group data</div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
