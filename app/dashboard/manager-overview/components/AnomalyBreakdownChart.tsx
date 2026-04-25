"use client";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const PRIORITY_COLORS: Record<string, string> = { P1: "#ef4444", P2: "#f97316", P3: "#eab308", P4: "#3b82f6", P5: "#6b7280" };
const PIE_COLORS = ["#10b981", "#ef4444"];

interface AnomalyData {
    total: number; rectified: number; open: number;
    byPriority: Record<string, number>;
    byDefectType: Record<string, number>;
}

const priorityConfig: ChartConfig = {
    P1: { label: "P1 - Critical", color: "#ef4444" },
    P2: { label: "P2 - High", color: "#f97316" },
    P3: { label: "P3 - Medium", color: "#eab308" },
    P4: { label: "P4 - Low", color: "#3b82f6" },
    P5: { label: "P5 - Info", color: "#6b7280" },
};

const statusConfig: ChartConfig = {
    open: { label: "Open", color: "#ef4444" },
    rectified: { label: "Rectified", color: "#10b981" },
};

export function AnomalyBreakdownChart({ data, findings }: { data: AnomalyData; findings?: { total: number; byPriority: Record<string, number> } }) {
    const priorityData = Object.entries(data.byPriority).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ priority: k, count: v, fill: PRIORITY_COLORS[k] || "#6b7280" }));
    const statusData = [{ name: "Open", value: data.open, fill: "#ef4444" }, { name: "Rectified", value: data.rectified, fill: "#10b981" }].filter(d => d.value > 0);
    const defectData = Object.entries(data.byDefectType).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ type: k, count: v }));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Priority Bar Chart */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">By Priority</CardTitle>
                </CardHeader>
                <CardContent>
                    {priorityData.length > 0 ? (
                        <ChartContainer config={priorityConfig} className="h-[200px] w-full">
                            <BarChart data={priorityData} layout="vertical" margin={{ left: 10 }}>
                                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
                                <XAxis type="number" tickLine={false} axisLine={false} />
                                <YAxis dataKey="priority" type="category" tickLine={false} axisLine={false} width={30} />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                                    {priorityData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                                </Bar>
                            </BarChart>
                        </ChartContainer>
                    ) : <div className="h-[200px] flex items-center justify-center text-slate-400 text-xs font-bold">No anomalies</div>}
                </CardContent>
            </Card>

            {/* Open vs Rectified Donut */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Open vs Rectified</CardTitle>
                </CardHeader>
                <CardContent>
                    {statusData.length > 0 ? (
                        <ChartContainer config={statusConfig} className="h-[200px] w-full mx-auto aspect-square max-w-[200px]">
                            <PieChart>
                                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={50} strokeWidth={3}>
                                    {statusData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                                </Pie>
                                <text x="50%" y="45%" textAnchor="middle" className="fill-foreground text-2xl font-black">{data.total}</text>
                                <text x="50%" y="58%" textAnchor="middle" className="fill-muted-foreground text-[10px] font-bold uppercase">Total</text>
                            </PieChart>
                        </ChartContainer>
                    ) : <div className="h-[200px] flex items-center justify-center text-slate-400 text-xs font-bold">No data</div>}
                </CardContent>
            </Card>

            {/* Defect Type Bar */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">By Defect Type</CardTitle>
                </CardHeader>
                <CardContent>
                    {defectData.length > 0 ? (
                        <div className="space-y-2 h-[200px] overflow-y-auto pr-1">
                            {defectData.map((d, i) => {
                                const maxV = defectData[0].count;
                                const pct = maxV > 0 ? (d.count / maxV) * 100 : 0;
                                return (
                                    <div key={d.type} className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 w-20 truncate text-right">{d.type}</span>
                                        <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-700 dark:text-white w-6 text-right">{d.count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : <div className="h-[200px] flex items-center justify-center text-slate-400 text-xs font-bold">No defect data</div>}
                </CardContent>
            </Card>
        </div>
    );
}
