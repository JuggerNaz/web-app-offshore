"use client";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart, Pie, PieChart, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const DEPL_COLORS = ["#10b981", "#f59e0b", "#f97316", "#ef4444"];
const COND_COLORS: Record<string, string> = { Intact: "#10b981", Wasted: "#f59e0b", Missing: "#ef4444", Disconnected: "#8b5cf6" };

interface AnodeCPData {
    anode: { total: number; depletionBuckets: Record<string, number>; avgDepletion: number | null };
    cp: { count: number; min: number | null; max: number | null; avg: number | null };
    cpTrend?: { date: string; value: number }[];
}

const deplConfig: ChartConfig = { count: { label: "Count", color: "#f59e0b" } };
const cpConfig: ChartConfig = { value: { label: "CP (mV)", color: "#10b981" } };

export function AnodeCPSection({ data }: { data: AnodeCPData }) {
    const bucketData = ["0–25%", "25–50%", "50–75%", "75–100%"].map((k, i) => ({
        range: k, count: data.anode.depletionBuckets[k] || 0, fill: DEPL_COLORS[i],
    }));

    const cpRange = data.cp.min !== null && data.cp.max !== null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Anode Depletion */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        Anode Depletion Distribution
                        <span className="ml-2 text-amber-500">{data.anode.total} inspected</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {data.anode.total > 0 ? (
                        <ChartContainer config={deplConfig} className="h-[220px] w-full">
                            <BarChart data={bucketData}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
                                <XAxis dataKey="range" tickLine={false} axisLine={false} className="text-[10px]" />
                                <YAxis tickLine={false} axisLine={false} width={30} />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                                    {bucketData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                                </Bar>
                            </BarChart>
                        </ChartContainer>
                    ) : <div className="h-[220px] flex items-center justify-center text-slate-400 text-xs font-bold">No anode data</div>}
                    {data.anode.avgDepletion !== null && (
                        <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                            <div className="text-2xl font-black text-amber-500">{data.anode.avgDepletion}%</div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Average Depletion</div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* CP Readings */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        CP Readings
                        <span className="ml-2 text-emerald-500">{data.cp.count} readings</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {cpRange ? (
                        <div className="space-y-4">
                            {/* Range gauge */}
                            <div className="p-4 rounded-xl bg-gradient-to-r from-red-500/10 via-amber-500/10 to-emerald-500/10 border border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2">
                                    <span>Min: {data.cp.min}mV</span>
                                    <span>Avg: {data.cp.avg}mV</span>
                                    <span>Max: {data.cp.max}mV</span>
                                </div>
                                <div className="h-4 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 relative overflow-hidden">
                                    {data.cp.avg !== null && (
                                        <div className="absolute top-0 bottom-0 w-1 bg-white shadow-lg rounded-full"
                                            style={{ left: `${Math.min(100, Math.max(0, ((data.cp.avg - (data.cp.min! - 50)) / ((data.cp.max! + 50) - (data.cp.min! - 50))) * 100))}%` }} />
                                    )}
                                </div>
                                <div className="flex justify-between mt-1 text-[8px] text-slate-400">
                                    <span>⚠ Below Protection</span>
                                    <span>-800mV Threshold</span>
                                    <span>✓ Protected</span>
                                </div>
                            </div>

                            {/* CP Trend */}
                            {data.cpTrend && data.cpTrend.length > 1 && (
                                <ChartContainer config={cpConfig} className="h-[140px] w-full">
                                    <LineChart data={data.cpTrend} margin={{ left: 10, right: 10 }}>
                                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
                                        <XAxis dataKey="date" tickLine={false} axisLine={false} className="text-[10px]" />
                                        <YAxis tickLine={false} axisLine={false} width={50} />
                                        <ChartTooltip content={<ChartTooltipContent />} />
                                        <Line dataKey="value" type="monotone" stroke="#10b981" strokeWidth={2}
                                            dot={{ fill: "#10b981", r: 4 }} activeDot={{ r: 6 }} />
                                    </LineChart>
                                </ChartContainer>
                            )}
                        </div>
                    ) : <div className="h-[220px] flex items-center justify-center text-slate-400 text-xs font-bold">No CP data</div>}
                </CardContent>
            </Card>
        </div>
    );
}
