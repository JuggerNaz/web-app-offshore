"use client";

import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    BarChart3,
    Activity,
    ShieldAlert,
    Waves,
    PlaneTakeoff,
    Percent,
    Gauge,
    AlertTriangle,
    Eye,
    TrendingDown,
    Calendar,
    Compass
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InspectionAnalyticsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    insightData: any;
    projectContext: {
        platform?: string;
        jobpack?: string;
        reportNo?: string;
        vessel?: string;
    };
}

export function InspectionAnalyticsDialog({
    open,
    onOpenChange,
    insightData,
    projectContext
}: InspectionAnalyticsDialogProps) {
    const [activeTab, setActiveTab] = useState("cp");

    if (!insightData || !insightData.data) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-md bg-white dark:bg-slate-950 text-center p-8">
                    <p className="text-slate-500 text-sm">No live inspection data loaded yet.</p>
                </DialogContent>
            </Dialog>
        );
    }

    const d = insightData.data;

    // Helper to format CP reading value
    const formatCp = (val: any) => {
        if (val === null || val === undefined) return "N/A";
        const num = Number(val);
        return isNaN(num) ? "N/A" : `${num.toFixed(0)} mV`;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl bg-white dark:bg-slate-950 p-0 overflow-hidden flex flex-col h-[80vh] rounded-3xl border-none shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200">
                <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-blue-600 shadow-lg shadow-blue-500/20 text-white">
                                <BarChart3 className="w-5 h-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-extrabold tracking-tight">Live Inspection Analytics</DialogTitle>
                                <DialogDescription className="text-slate-400 text-xs">
                                    Overall structural readings & split details for <strong>{projectContext.platform}</strong>
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-right">
                            <Badge variant="secondary" className="bg-slate-800 text-slate-200 border-slate-700 font-bold uppercase tracking-wider text-[9px] px-2.5 py-1">
                                Vessel: {projectContext.vessel || "N/A"}
                            </Badge>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-900/10">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                        <div className="px-6 border-b bg-white dark:bg-slate-950 shrink-0">
                            <TabsList className="flex gap-2 bg-transparent justify-start h-12 p-0 border-b-0 overflow-x-auto scrollbar-hide">
                                <TabsTrigger value="cp" className="h-10 text-xs font-bold uppercase tracking-wider border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4">CP Survey</TabsTrigger>
                                <TabsTrigger value="fmd" className="h-10 text-xs font-bold uppercase tracking-wider border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4">FMD</TabsTrigger>
                                <TabsTrigger value="anode" className="h-10 text-xs font-bold uppercase tracking-wider border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4">Anodes</TabsTrigger>
                                <TabsTrigger value="mgi" className="h-10 text-xs font-bold uppercase tracking-wider border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4">MGI & Scour</TabsTrigger>
                                <TabsTrigger value="anomalies" className="h-10 text-xs font-bold uppercase tracking-wider border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-4">Anomalies ({d.anomalies?.total || 0})</TabsTrigger>
                            </TabsList>
                        </div>

                        <ScrollArea className="flex-1 p-6">
                            {/* CP SURVEY TAB */}
                            <TabsContent value="cp" className="m-0 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Card className="shadow-sm border-slate-100 dark:border-slate-800">
                                        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                                            <CardTitle className="text-xs text-slate-400 font-bold uppercase">CP Grand Min</CardTitle>
                                            <TrendingDown className="h-4 w-4 text-rose-500" />
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0">
                                            <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{formatCp(d.cp?.minVal)}</p>
                                            <p className="text-[10px] text-slate-400 mt-1">Lowest protection level recorded</p>
                                        </CardContent>
                                    </Card>

                                    <Card className="shadow-sm border-slate-100 dark:border-slate-800">
                                        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                                            <CardTitle className="text-xs text-slate-400 font-bold uppercase">CP Grand Max</CardTitle>
                                            <Gauge className="h-4 w-4 text-emerald-500" />
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0">
                                            <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{formatCp(d.cp?.maxVal)}</p>
                                            <p className="text-[10px] text-slate-400 mt-1">Highest protection level recorded</p>
                                        </CardContent>
                                    </Card>

                                    <Card className="shadow-sm border-slate-100 dark:border-slate-800">
                                        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                                            <CardTitle className="text-xs text-slate-400 font-bold uppercase">Total CP Readings</CardTitle>
                                            <Activity className="h-4 w-4 text-blue-500" />
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0">
                                            <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{d.cp?.totalCount || 0}</p>
                                            <p className="text-[10px] text-slate-400 mt-1">
                                                {d.cp?.primaryCount || 0} primary + {d.cp?.additionalCount || 0} additional
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">CP Readings split by Inspection & Component</h3>
                                    <div className="border rounded-xl bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-900 border-b text-[10px] uppercase font-bold text-slate-500">
                                                    <th className="p-3">Inspection Type</th>
                                                    <th className="p-3">Component QID</th>
                                                    <th className="p-3 text-center">Readings Count</th>
                                                    <th className="p-3">Min Value</th>
                                                    <th className="p-3">Max Value</th>
                                                    <th className="p-3">Mode Split</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y text-xs text-slate-700 dark:text-slate-350">
                                                {d.cp?.cpDetails && Object.keys(d.cp.cpDetails).length > 0 ? (
                                                    Object.entries(d.cp.cpDetails).flatMap(([inspName, componentsObj]: any) => 
                                                        Object.entries(componentsObj).map(([qid, readings]: any) => {
                                                            const vals = readings.map((r: any) => r.val);
                                                            const min = Math.min(...vals);
                                                            const max = Math.max(...vals);
                                                            const rovCount = readings.filter((r: any) => r.mode === "ROV").length;
                                                            const diveCount = readings.filter((r: any) => r.mode === "DIVE").length;

                                                            return (
                                                                <tr key={`${inspName}-${qid}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                                                    <td className="p-3 font-semibold">{inspName}</td>
                                                                    <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">{qid}</td>
                                                                    <td className="p-3 text-center font-bold">{readings.length}</td>
                                                                    <td className="p-3 font-semibold text-rose-600">{min} mV</td>
                                                                    <td className="p-3 font-semibold text-emerald-600">{max} mV</td>
                                                                    <td className="p-3 flex items-center gap-1.5 pt-4">
                                                                        {rovCount > 0 && (
                                                                            <Badge variant="outline" className="text-[9px] border-sky-100 bg-sky-50 text-sky-700 dark:bg-sky-950/20 dark:text-sky-400 flex items-center gap-0.5">
                                                                                <PlaneTakeoff className="h-2 w-2" /> ROV: {rovCount}
                                                                            </Badge>
                                                                        )}
                                                                        {diveCount > 0 && (
                                                                            <Badge variant="outline" className="text-[9px] border-emerald-100 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 flex items-center gap-0.5">
                                                                                <Waves className="h-2 w-2" /> Dive: {diveCount}
                                                                            </Badge>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )
                                                ) : (
                                                    <tr>
                                                        <td colSpan={6} className="p-8 text-center text-slate-400 italic">No detailed CP split data available.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* FMD TAB */}
                            <TabsContent value="fmd" className="m-0 space-y-6">
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm text-center">
                                        <p className="text-xs text-slate-400 font-bold uppercase">Total Checked</p>
                                        <p className="text-2xl font-black mt-1 text-slate-800 dark:text-slate-100">{d.fmd?.total || 0}</p>
                                    </div>
                                    <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-xl border border-red-100 dark:border-red-900/30 text-center">
                                        <p className="text-xs text-red-500 font-bold uppercase">Flooded</p>
                                        <p className="text-2xl font-black mt-1 text-red-600 dark:text-red-400">{d.fmd?.conditions?.flooded || 0}</p>
                                    </div>
                                    <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-center">
                                        <p className="text-xs text-emerald-500 font-bold uppercase">Dry</p>
                                        <p className="text-2xl font-black mt-1 text-emerald-600 dark:text-emerald-400">{d.fmd?.conditions?.dry || 0}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border text-center">
                                        <p className="text-xs text-slate-400 font-bold uppercase">Inconclusive</p>
                                        <p className="text-2xl font-black mt-1 text-slate-600 dark:text-slate-400">{d.fmd?.conditions?.inconclusive || 0}</p>
                                    </div>
                                    <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-xl border border-orange-100 dark:border-orange-900/30 text-center">
                                        <p className="text-xs text-orange-500 font-bold uppercase">Incomplete</p>
                                        <p className="text-2xl font-black mt-1 text-orange-600 dark:text-orange-400">{d.fmd?.conditions?.incomplete || 0}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">FMD Details by Member QID</h3>
                                    <div className="border rounded-xl bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-900 border-b text-[10px] uppercase font-bold text-slate-500">
                                                    <th className="p-3">Member QID</th>
                                                    <th className="p-3">FMD Condition Status</th>
                                                    <th className="p-3">Method / Mode</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y text-xs text-slate-700 dark:text-slate-350">
                                                {d.fmd_items && d.fmd_items.length > 0 ? (
                                                    d.fmd_items.map((item: any, idx: number) => (
                                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                                            <td className="p-3 font-mono font-bold">{item.component}</td>
                                                            <td className="p-3">
                                                                <Badge className={cn(
                                                                    "text-[10px] font-bold uppercase px-2 py-0.5 border-none",
                                                                    item.status?.toLowerCase() === "flooded" ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400" :
                                                                    item.status?.toLowerCase() === "dry" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" :
                                                                    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-350"
                                                                )}>
                                                                    {item.status}
                                                                </Badge>
                                                            </td>
                                                            <td className="p-3 flex items-center gap-1">
                                                                {item.mode === "ROV" ? (
                                                                    <Badge variant="secondary" className="bg-sky-50 text-sky-700 dark:bg-sky-950/20 dark:text-sky-400 flex items-center gap-0.5 text-[9px] border-none">
                                                                        <PlaneTakeoff className="h-2.5 w-2.5" /> ROV Mode
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 flex items-center gap-0.5 text-[9px] border-none">
                                                                        <Waves className="h-2.5 w-2.5" /> Dive Mode
                                                                    </Badge>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={3} className="p-8 text-center text-slate-400 italic">No FMD records found.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* ANODES TAB */}
                            <TabsContent value="anode" className="m-0 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Card className="shadow-sm border-slate-100 dark:border-slate-800">
                                        <CardHeader className="p-4 pb-2">
                                            <CardTitle className="text-xs text-slate-400 font-bold uppercase">Anode Depletion Distribution</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0 space-y-3">
                                            {d.anodeGvi?.depletionBuckets && Object.keys(d.anodeGvi.depletionBuckets).length > 0 ? (
                                                Object.entries(d.anodeGvi.depletionBuckets).map(([bucket, count]: any) => (
                                                    <div key={bucket} className="flex items-center justify-between text-xs">
                                                        <span className="font-semibold text-slate-600 dark:text-slate-355">{bucket}</span>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-32 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                                                <div 
                                                                    className="bg-blue-600 h-2 rounded-full" 
                                                                    style={{ width: `${(count / (d.anodeGvi.total || 1)) * 100}%` }}
                                                                />
                                                            </div>
                                                            <span className="font-bold w-6 text-right">{count}</span>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-xs text-slate-400 italic">No depletion stats recorded.</p>
                                            )}
                                        </CardContent>
                                    </Card>

                                    <Card className="shadow-sm border-slate-100 dark:border-slate-800">
                                        <CardHeader className="p-4 pb-2">
                                            <CardTitle className="text-xs text-slate-400 font-bold uppercase">Anode Condition Breakdown</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0 space-y-3">
                                            {d.anodeGvi?.conditionCounts && Object.keys(d.anodeGvi.conditionCounts).length > 0 ? (
                                                Object.entries(d.anodeGvi.conditionCounts).map(([cond, count]: any) => (
                                                    <div key={cond} className="flex items-center justify-between text-xs">
                                                        <span className="font-semibold text-slate-600 dark:text-slate-355">{cond}</span>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-32 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                                                <div 
                                                                    className="bg-emerald-50 h-2 rounded-full" 
                                                                    style={{ width: `${(count / (d.anodeGvi.total || 1)) * 100}%` }}
                                                                />
                                                            </div>
                                                            <span className="font-bold w-6 text-right">{count}</span>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-xs text-slate-400 italic">No anode condition records found.</p>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </TabsContent>

                            {/* MGI & SCOUR TAB */}
                            <TabsContent value="mgi" className="m-0 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* MGI card */}
                                    <Card className="shadow-sm border-slate-100 dark:border-slate-800">
                                        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                                            <CardTitle className="text-xs text-slate-400 font-bold uppercase">Marine Growth (MGI)</CardTitle>
                                            <Badge variant="outline" className="border-blue-100 bg-blue-50 text-blue-700 border-none">RMGI</Badge>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0 space-y-4">
                                            {/* Thickness Stats */}
                                            <div className="space-y-2">
                                                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Thickness</h4>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg text-center border flex flex-col justify-between min-h-[76px]">
                                                        <div>
                                                            <p className="text-[9px] text-slate-450 uppercase font-bold">Max Thickness</p>
                                                            <p className="text-lg font-black text-blue-600 mt-0.5">{d.mgi?.max || 0} mm</p>
                                                        </div>
                                                        <p className="text-[8px] text-slate-500 font-medium truncate mt-0.5" title={d.mgi?.maxComp}>{d.mgi?.maxComp || "N/A"}</p>
                                                    </div>
                                                    <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg text-center border flex flex-col justify-between min-h-[76px]">
                                                        <div>
                                                            <p className="text-[9px] text-slate-455 uppercase font-bold">Min Thickness</p>
                                                            <p className="text-lg font-black text-blue-500 mt-0.5">{d.mgi?.min || 0} mm</p>
                                                        </div>
                                                        <p className="text-[8px] text-slate-500 font-medium truncate mt-0.5" title={d.mgi?.minComp}>{d.mgi?.minComp || "N/A"}</p>
                                                    </div>
                                                    <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg text-center border flex flex-col justify-between min-h-[76px]">
                                                        <div>
                                                            <p className="text-[9px] text-slate-455 uppercase font-bold">Avg Thickness</p>
                                                            <p className="text-lg font-black text-slate-700 dark:text-slate-300 mt-0.5">{Math.round(d.mgi?.avg || 0)} mm</p>
                                                        </div>
                                                        <p className="text-[8px] text-slate-400">Average</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Coverage Stats (Hard vs Soft Split) */}
                                            <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                                                <div className="space-y-2">
                                                    <h4 className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Hard Marine Growth Coverage</h4>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg text-center border flex flex-col justify-between min-h-[76px]">
                                                            <div>
                                                                <p className="text-[9px] text-slate-455 uppercase font-bold">Hard Max Coverage</p>
                                                                <p className="text-lg font-black text-amber-600 mt-0.5">{d.mgi?.hardMaxPct !== undefined ? `${d.mgi.hardMaxPct}%` : "0%"}</p>
                                                            </div>
                                                            <p className="text-[8px] text-slate-500 font-medium truncate mt-0.5" title={d.mgi?.hardMaxPctComp}>{d.mgi?.hardMaxPctComp || "N/A"}</p>
                                                        </div>
                                                        <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg text-center border flex flex-col justify-between min-h-[76px]">
                                                            <div>
                                                                <p className="text-[9px] text-slate-455 uppercase font-bold">Hard Min Coverage</p>
                                                                <p className="text-lg font-black text-amber-500 mt-0.5">{d.mgi?.hardMinPct !== undefined ? `${d.mgi.hardMinPct}%` : "0%"}</p>
                                                            </div>
                                                            <p className="text-[8px] text-slate-500 font-medium truncate mt-0.5" title={d.mgi?.hardMinPctComp}>{d.mgi?.hardMinPctComp || "N/A"}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <h4 className="text-[11px] font-bold text-teal-600 uppercase tracking-wider">Soft Marine Growth Coverage</h4>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg text-center border flex flex-col justify-between min-h-[76px]">
                                                            <div>
                                                                <p className="text-[9px] text-slate-455 uppercase font-bold">Soft Max Coverage</p>
                                                                <p className="text-lg font-black text-teal-600 mt-0.5">{d.mgi?.softMaxPct !== undefined ? `${d.mgi.softMaxPct}%` : "0%"}</p>
                                                            </div>
                                                            <p className="text-[8px] text-slate-500 font-medium truncate mt-0.5" title={d.mgi?.softMaxPctComp}>{d.mgi?.softMaxPctComp || "N/A"}</p>
                                                        </div>
                                                        <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg text-center border flex flex-col justify-between min-h-[76px]">
                                                            <div>
                                                                <p className="text-[9px] text-slate-455 uppercase font-bold">Soft Min Coverage</p>
                                                                <p className="text-lg font-black text-teal-500 mt-0.5">{d.mgi?.softMinPct !== undefined ? `${d.mgi.softMinPct}%` : "0%"}</p>
                                                            </div>
                                                            <p className="text-[8px] text-slate-500 font-medium truncate mt-0.5" title={d.mgi?.softMinPctComp}>{d.mgi?.softMinPctComp || "N/A"}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <p className="text-[10px] text-slate-400 leading-normal">
                                                Based on a total of {d.mgi?.total || 0} measurements carried out across components.
                                            </p>
                                        </CardContent>
                                    </Card>

                                    {/* Scour card */}
                                    <Card className="shadow-sm border-slate-100 dark:border-slate-800">
                                        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                                            <CardTitle className="text-xs text-slate-400 font-bold uppercase">Base Level & Scour</CardTitle>
                                            <Badge variant="outline" className="border-amber-100 bg-amber-50 text-amber-700 border-none">RSCOR</Badge>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0 space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg text-center border">
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Exposed Piles</p>
                                                    <p className="text-2xl font-black text-rose-500 mt-1">{d.scour?.exposed || 0}</p>
                                                </div>
                                                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg text-center border">
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Min Burial</p>
                                                    <p className="text-2xl font-black text-emerald-600 mt-1">{d.scour?.minBurial || 0}%</p>
                                                </div>
                                            </div>

                                            {/* Exposed Pile Details */}
                                            {d.scour?.exposed > 0 && d.scour?.exposedComponents && d.scour.exposedComponents.length > 0 && (
                                                <div className="space-y-1">
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Exposed Pile Locations</p>
                                                    <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border text-[10px] space-y-1.5 max-h-[88px] overflow-y-auto">
                                                        {d.scour.exposedComponents.map((item: any, idx: number) => (
                                                            <div key={idx} className="flex justify-between font-medium">
                                                                <span className="font-mono text-rose-500">{item.qid}</span>
                                                                <span className="text-slate-500">{item.location}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Max Scour Height Details */}
                                            <div className="space-y-2">
                                                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Maximum Scour Height</h4>
                                                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] text-slate-400 font-medium">Max Scour Depth:</span>
                                                        <span className="text-sm font-black text-amber-600">{d.scour?.maxDepth || 0} m</span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 pt-1 border-t text-[10px]">
                                                        <div>
                                                            <p className="text-[8px] text-slate-400 uppercase font-bold">Location</p>
                                                            <p className="font-bold text-slate-700 dark:text-slate-355">{d.scour?.maxDepthLocation || d.scour?.maxDepthLeg || "N/A"}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[8px] text-slate-400 uppercase font-bold">Face</p>
                                                            <p className="font-bold text-slate-700 dark:text-slate-355">{d.scour?.maxDepthFace || "N/A"}</p>
                                                        </div>
                                                        <div className="truncate">
                                                            <p className="text-[8px] text-slate-400 uppercase font-bold">Component QID</p>
                                                            <p className="font-bold text-slate-700 dark:text-slate-355 truncate" title={d.scour?.maxDepthQid}>{d.scour?.maxDepthQid || "N/A"}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <p className="text-[10px] text-slate-400 leading-normal">
                                                Total scour survey records: {d.scour?.total || 0} components surveyed.
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* MGI Exceeded Thickness Anomaly Table */}
                                <div className="space-y-4 pt-4 border-t">
                                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">MGI Thickness Exceeding Effective Limit (Reported as Anomaly)</h3>
                                    <div className="border rounded-xl bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-900 border-b text-[10px] uppercase font-bold text-slate-500">
                                                    <th className="p-3">Component QID</th>
                                                    <th className="p-3">Measured Thickness</th>
                                                    <th className="p-3">Effective Thickness</th>
                                                    <th className="p-3">Elevation</th>
                                                    <th className="p-3">Date</th>
                                                    <th className="p-3 text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y text-xs text-slate-700 dark:text-slate-350">
                                                {d.mgi?.exceeded && d.mgi.exceeded.length > 0 ? (
                                                    d.mgi.exceeded.map((item: any, idx: number) => (
                                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                                            <td className="p-3 font-mono font-bold">{item.qid}</td>
                                                            <td className="p-3 text-rose-600 font-bold">{item.thickness} mm</td>
                                                            <td className="p-3 font-semibold text-slate-500">{item.effectiveThickness} mm</td>
                                                            <td className="p-3">{item.elevation}</td>
                                                            <td className="p-3">{item.date}</td>
                                                            <td className="p-3 text-center">
                                                                <Badge className="bg-red-100 text-red-700 border-none text-[9px] font-black uppercase px-2 py-0.5">
                                                                    ANOMALY
                                                                </Badge>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={6} className="p-8 text-center text-slate-400 italic">No MGI records exceeded the effective thickness threshold as an anomaly.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* ANOMALIES TAB */}
                            <TabsContent value="anomalies" className="m-0 space-y-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm text-center">
                                        <p className="text-xs text-slate-400 font-bold uppercase">Total Anomalies</p>
                                        <p className="text-2xl font-black mt-1 text-slate-800 dark:text-slate-100">{d.anomalies?.total || 0}</p>
                                    </div>
                                    <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-xl border border-red-100 dark:border-red-900/30 text-center">
                                        <p className="text-xs text-red-500 font-bold uppercase">Open / Active</p>
                                        <p className="text-2xl font-black mt-1 text-red-600 dark:text-red-400">{d.anomalies?.open || 0}</p>
                                    </div>
                                    <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-center">
                                        <p className="text-xs text-emerald-500 font-bold uppercase">Rectified</p>
                                        <p className="text-2xl font-black mt-1 text-emerald-600 dark:text-emerald-400">{d.anomalies?.rectified || 0}</p>
                                    </div>
                                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 text-center">
                                        <p className="text-xs text-blue-500 font-bold uppercase">Findings (P4)</p>
                                        <p className="text-2xl font-black mt-1 text-blue-600 dark:text-blue-400">{d.findings?.total || 0}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Detailed Anomalies List</h3>
                                    <div className="border rounded-xl bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-900 border-b text-[10px] uppercase font-bold text-slate-500">
                                                    <th className="p-3 text-center w-12">No.</th>
                                                    <th className="p-3">Anomaly Ref No</th>
                                                    <th className="p-3">Component QID</th>
                                                    <th className="p-3">Inspection Type</th>
                                                    <th className="p-3">Defect Code / Type</th>
                                                    <th className="p-3">Defect Description</th>
                                                    <th className="p-3 text-center">Priority</th>
                                                    <th className="p-3">Status</th>
                                                    <th className="p-3">Rectification / Follow-up</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y text-xs text-slate-700 dark:text-slate-350">
                                                {d.anomalies?.items && d.anomalies.items.length > 0 ? (
                                                    d.anomalies.items.map((item: any, idx: number) => (
                                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                                            <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                                                            <td className="p-3 font-mono font-bold text-red-600">{item.ref}</td>
                                                            <td className="p-3 font-mono font-bold text-slate-650">{item.qid || "N/A"}</td>
                                                            <td className="p-3 font-semibold text-slate-500">{item.inspectionType || "N/A"}</td>
                                                            <td className="p-3 font-semibold text-slate-500">{item.defectCode || "N/A"}</td>
                                                            <td className="p-3 max-w-xs truncate">{item.description}</td>
                                                            <td className="p-3 text-center">
                                                                <Badge className={cn(
                                                                    "text-[9px] font-black uppercase px-2 py-0.5 border-none text-white",
                                                                    item.priority === "P1" ? "bg-red-600" :
                                                                    item.priority === "P2" ? "bg-orange-500" :
                                                                    "bg-amber-400 text-slate-900"
                                                                )}>
                                                                    {item.priority}
                                                                </Badge>
                                                            </td>
                                                            <td className="p-3 font-bold uppercase">{item.status}</td>
                                                            <td className="p-3 text-slate-500">{item.rectification}</td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={9} className="p-8 text-center text-slate-400 italic">No anomalies recorded for this report.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </TabsContent>
                        </ScrollArea>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}
