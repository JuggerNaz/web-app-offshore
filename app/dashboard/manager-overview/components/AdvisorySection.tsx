"use client";
import { AlertTriangle, Shield, Zap, Gauge, TrendingUp, Clock, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Predictions {
    corrosion_risk: { structure: string; score: number; level: string; factors: any }[];
    anode_life: { structure: string; current_depletion: number; rate_per_year: number; estimated_years_remaining: number; alert: boolean }[];
    cp_forecast: { structure: string; current_avg: number; trend_per_year: number; direction: string; years_to_threshold: number; alert: boolean }[];
    anomaly_recurrence: { structure: string; campaigns_with_anomalies: number; total_campaigns: number; latest_anomaly_count: number; trend: string; chronic: boolean }[];
    inspection_priority: { structure: string; urgency_score: number; classification: string; years_since_last: number; last_inspection: string }[];
    integrity_scores: { structure: string; score: number; grade: string; sow_completion: number }[];
}

const RISK_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    CRITICAL: { bg: "bg-red-50 dark:bg-red-500/10", border: "border-red-200 dark:border-red-500/30", text: "text-red-700 dark:text-red-400", icon: "text-red-500" },
    HIGH: { bg: "bg-orange-50 dark:bg-orange-500/10", border: "border-orange-200 dark:border-orange-500/30", text: "text-orange-700 dark:text-orange-400", icon: "text-orange-500" },
    MODERATE: { bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-200 dark:border-amber-500/30", text: "text-amber-700 dark:text-amber-400", icon: "text-amber-500" },
    LOW: { bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/30", text: "text-emerald-700 dark:text-emerald-400", icon: "text-emerald-500" },
};

const GRADE_COLORS: Record<string, string> = { A: "text-emerald-500", B: "text-blue-500", C: "text-amber-500", D: "text-orange-500", F: "text-red-500" };
const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
    "INSPECT FIRST": { bg: "bg-red-100 dark:bg-red-500/20", text: "text-red-700 dark:text-red-400" },
    "MONITOR": { bg: "bg-amber-100 dark:bg-amber-500/20", text: "text-amber-700 dark:text-amber-400" },
    "LOW PRIORITY": { bg: "bg-emerald-100 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400" },
};

export function AdvisorySection({ predictions }: { predictions: Predictions | null }) {
    if (!predictions) return (
        <div className="flex items-center justify-center h-48 text-slate-400 text-xs font-bold">
            Insufficient data for predictions. Need at least 2 inspection campaigns.
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Structural Integrity Scores */}
            {predictions.integrity_scores.length > 0 && (
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
                    <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 dark:from-blue-500/5 to-transparent">
                        <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-blue-500" /> Structural Integrity Scores
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {predictions.integrity_scores.map(s => (
                            <div key={s.structure} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center transition-all hover:scale-[1.02]">
                                <div className={cn("text-3xl font-black", GRADE_COLORS[s.grade] || "text-slate-500")}>{s.grade}</div>
                                <div className="text-lg font-black text-slate-700 dark:text-white">{s.score}/100</div>
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1 truncate">{s.structure}</div>
                                <div className="text-[8px] text-slate-400 mt-0.5">SOW: {s.sow_completion}%</div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Corrosion Risk */}
            {predictions.corrosion_risk.length > 0 && (
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
                    <CardHeader className="pb-3 bg-gradient-to-r from-red-50 dark:from-red-500/5 to-transparent">
                        <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500" /> Corrosion Risk Assessment
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {predictions.corrosion_risk.map(r => {
                            const colors = RISK_COLORS[r.level] || RISK_COLORS.LOW;
                            return (
                                <div key={r.structure} className={cn("flex items-center gap-4 p-3 rounded-xl border transition-all hover:scale-[1.005]", colors.bg, colors.border)}>
                                    <div className="flex-shrink-0 w-12 text-center">
                                        <div className={cn("text-xl font-black", colors.text)}>{r.score}</div>
                                        <div className="text-[8px] font-bold text-slate-400 uppercase">/100</div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-slate-800 dark:text-white truncate">{r.structure}</div>
                                        <div className={cn("text-[9px] font-black uppercase tracking-wider", colors.text)}>{r.level} RISK</div>
                                    </div>
                                    <div className="flex-1 h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div className={cn("h-full rounded-full transition-all duration-1000",
                                            r.level === "CRITICAL" ? "bg-red-500" : r.level === "HIGH" ? "bg-orange-500" : r.level === "MODERATE" ? "bg-amber-500" : "bg-emerald-500"
                                        )} style={{ width: `${r.score}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Anode Life */}
                {predictions.anode_life.length > 0 && (
                    <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
                        <CardHeader className="pb-3 bg-gradient-to-r from-amber-50 dark:from-amber-500/5 to-transparent">
                            <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-amber-500" /> Anode Remaining Life
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {predictions.anode_life.map(a => (
                                <div key={a.structure} className={cn("p-3 rounded-xl border transition-all",
                                    a.alert ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30" : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700")}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-slate-800 dark:text-white truncate">{a.structure}</span>
                                        <span className={cn("text-lg font-black", a.alert ? "text-red-500" : "text-emerald-500")}>
                                            {a.estimated_years_remaining}y
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[9px] text-slate-500">
                                        <span>Depletion: {a.current_depletion}%</span>
                                        <span>·</span>
                                        <span>Rate: {a.rate_per_year}%/yr</span>
                                        {a.alert && <AlertCircle className="w-3 h-3 text-red-500 ml-auto" />}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {/* CP Forecast */}
                {predictions.cp_forecast.length > 0 && (
                    <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
                        <CardHeader className="pb-3 bg-gradient-to-r from-emerald-50 dark:from-emerald-500/5 to-transparent">
                            <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                <Gauge className="w-4 h-4 text-emerald-500" /> CP Degradation Forecast
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {predictions.cp_forecast.map(c => (
                                <div key={c.structure} className={cn("p-3 rounded-xl border transition-all",
                                    c.alert ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30" : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700")}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-slate-800 dark:text-white truncate">{c.structure}</span>
                                        <span className={cn("text-xs font-black px-2 py-0.5 rounded",
                                            c.direction === "DEGRADING" ? "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400" : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                        )}>{c.direction}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[9px] text-slate-500">
                                        <span>Current: {c.current_avg}mV</span>
                                        <span>Trend: {c.trend_per_year}mV/yr</span>
                                        {c.direction === "DEGRADING" && <span className="font-bold text-amber-600">{c.years_to_threshold}yr to threshold</span>}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Inspection Priority Ranking */}
            {predictions.inspection_priority.length > 0 && (
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
                    <CardHeader className="pb-3 bg-gradient-to-r from-violet-50 dark:from-violet-500/5 to-transparent">
                        <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-violet-500" /> Next Inspection Priority
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {predictions.inspection_priority.map((p, i) => {
                                const colors = PRIORITY_COLORS[p.classification] || PRIORITY_COLORS["LOW PRIORITY"];
                                return (
                                    <div key={p.structure} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 transition-all hover:scale-[1.005]">
                                        <span className="text-lg font-black text-slate-300 dark:text-slate-600 w-6 text-center">#{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold text-slate-800 dark:text-white truncate">{p.structure}</div>
                                            <div className="text-[9px] text-slate-500">Last: {p.last_inspection || "Unknown"} · {p.years_since_last}yr ago</div>
                                        </div>
                                        <span className={cn("text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg", colors.bg, colors.text)}>
                                            {p.classification}
                                        </span>
                                        <div className="w-10 text-right text-sm font-black text-slate-600 dark:text-slate-300">{p.urgency_score}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Anomaly Recurrence */}
            {predictions.anomaly_recurrence.length > 0 && (
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
                    <CardHeader className="pb-3 bg-gradient-to-r from-pink-50 dark:from-pink-500/5 to-transparent">
                        <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-pink-500" /> Anomaly Recurrence Analysis
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {predictions.anomaly_recurrence.map(r => (
                            <div key={r.structure} className={cn("p-3 rounded-xl border transition-all",
                                r.chronic ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30" : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700")}>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-800 dark:text-white">{r.structure}</span>
                                    <div className="flex items-center gap-2">
                                        {r.chronic && <span className="text-[8px] font-black bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded uppercase">Chronic</span>}
                                        <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded",
                                            r.trend === "INCREASING" ? "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400" : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                        )}>↕ {r.trend}</span>
                                    </div>
                                </div>
                                <div className="text-[9px] text-slate-500 mt-1">
                                    {r.campaigns_with_anomalies}/{r.total_campaigns} campaigns had anomalies · Latest: {r.latest_anomaly_count}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
