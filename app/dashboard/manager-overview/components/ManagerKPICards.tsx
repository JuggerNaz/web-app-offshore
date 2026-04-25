"use client";
import { Target, Activity, AlertTriangle, Gauge, Zap, Eye } from "lucide-react";

interface KPIData {
    sowPct: number;
    totalInspections: number;
    totalAnomalies: number;
    openAnomalies: number;
    cpAvg: number | null;
    cpMin: number | null;
    cpMax: number | null;
    anodeAvgDepletion: number | null;
    anodeTotal: number;
    fmdTotal: number;
    fmdFlooded: number;
}

function RingMini({ pct, color, size = 48 }: { pct: number; color: string; size?: number }) {
    const r = (size - 6) / 2;
    const circ = 2 * Math.PI * r;
    const filled = (Math.min(pct, 100) / 100) * circ;
    return (
        <svg width={size} height={size} className="rotate-[-90deg]">
            <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={5} fill="none" />
            <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={5} fill="none"
                strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
                className="transition-all duration-1000 ease-out" />
        </svg>
    );
}

function KPICard({ icon: Icon, label, value, sub, color, accent, children }: {
    icon: React.ElementType; label: string; value: string | number; sub?: string;
    color: string; accent: string; children?: React.ReactNode;
}) {
    return (
        <div className={`relative overflow-hidden rounded-2xl border p-5 flex flex-col gap-3 transition-all hover:scale-[1.02] hover:shadow-lg ${color}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
                        <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 dark:text-slate-400">{label}</span>
                </div>
                {children}
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white leading-none tracking-tight">{value}</div>
            {sub && <div className="text-[10px] font-medium text-slate-500 dark:text-slate-500 leading-tight">{sub}</div>}
        </div>
    );
}

export function ManagerKPICards({ data }: { data: KPIData }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <KPICard icon={Target} label="SOW Progress" value={`${data.sowPct}%`}
                sub={`Scope completion`}
                color="bg-white dark:bg-blue-500/10 border-slate-200 dark:border-blue-500/20"
                accent="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <RingMini pct={data.sowPct} color="#3b82f6" />
            </KPICard>

            <KPICard icon={Activity} label="Inspections" value={data.totalInspections}
                sub="Total records"
                color="bg-white dark:bg-cyan-500/10 border-slate-200 dark:border-cyan-500/20"
                accent="bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400" />

            <KPICard icon={AlertTriangle} label="Anomalies" value={data.totalAnomalies}
                sub={`${data.openAnomalies} open · ${data.totalAnomalies - data.openAnomalies} rectified`}
                color={`bg-white dark:bg-red-500/10 border-slate-200 dark:border-red-500/20 ${data.openAnomalies > 0 ? "ring-1 ring-red-500/20" : ""}`}
                accent="bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400" />

            <KPICard icon={Gauge} label="CP Readings" value={data.cpAvg !== null ? `${data.cpAvg}mV` : "N/A"}
                sub={data.cpMin !== null ? `Range: ${data.cpMin} to ${data.cpMax} mV` : "No readings"}
                color="bg-white dark:bg-emerald-500/10 border-slate-200 dark:border-emerald-500/20"
                accent="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" />

            <KPICard icon={Zap} label="Anode Health" value={data.anodeAvgDepletion !== null ? `${data.anodeAvgDepletion}%` : "N/A"}
                sub={`${data.anodeTotal} anodes inspected`}
                color="bg-white dark:bg-amber-500/10 border-slate-200 dark:border-amber-500/20"
                accent="bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400" />

            <KPICard icon={Eye} label="FMD Status" value={`${data.fmdFlooded}/${data.fmdTotal}`}
                sub={data.fmdFlooded > 0 ? `⚠ ${data.fmdFlooded} flooded` : "All clear"}
                color={`bg-white dark:bg-teal-500/10 border-slate-200 dark:border-teal-500/20 ${data.fmdFlooded > 0 ? "ring-1 ring-red-500/20" : ""}`}
                accent="bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400" />
        </div>
    );
}
