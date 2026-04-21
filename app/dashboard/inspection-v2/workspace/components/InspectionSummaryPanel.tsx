"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    X,
    RefreshCw,
    Activity,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Zap,
    Shield,
    BarChart3,
    Anchor,
    Waves,
    Target,
    AlertCircle,
    Info,
    TrendingUp,
    Layers,
    Hash,
    ChevronRight,
    Gauge,
    Eye,
    Wrench,
    FileSearch,
    Ship,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SummaryData {
    sow: {
        total: number;
        completed: number;
        incomplete: number;
        pending: number;
        completionPct: number;
        completedPct: number;
        incompletePct: number;
        pendingPct: number;
    };
    records: {
        total: number;
        completed: number;
        incomplete: number;
        anomaly: number;
        finding: number;
        rovCount: number;
        diveCount: number;
        hasBothModes: boolean;
        uniqueRovJobs: number;
        uniqueDiveJobs: number;
        inspTypeBreakdown: Record<string, { name: string; count: number; rov: number; dive: number; anomaly: number; finding: number }>;
    };
    fmd: {
        total: number;
        rov: number;
        dive: number;
        conditions: { dry: number; flooded: number; grouted: number; inconclusive: number; incomplete: number };
    };
    anodeGvi: {
        total: number;
        rov: number;
        dive: number;
        depletionBuckets: Record<string, number>;
        conditionCounts: Record<string, number>;
    };
    sani: { total: number; rov: number; dive: number };
    cp: {
        primaryCount: number;
        primaryRov: number;
        primaryDive: number;
        additionalCount: number;
        additionalRov: number;
        additionalDive: number;
        totalCount: number;
        minVal: number | null;
        maxVal: number | null;
    };
    anomalies: {
        total: number;
        rectified: number;
        open: number;
        byPriority: Record<string, number>;
        byDefectType: Record<string, number>;
    };
    findings: {
        total: number;
        rectified: number;
        open: number;
        byPriority: Record<string, number>;
    };
    attachmentGroups: Record<string, number>;
}

interface InspectionSummaryPanelProps {
    open: boolean;
    onClose: () => void;
    sowId?: string | null;
    structureId?: string | null;
    jobpackId?: string | null;
    sowReportNo?: string | null;
    headerData: {
        jobpackName: string;
        platformName: string;
        sowReportNo: string;
        jobType: string;
    };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
    icon: Icon,
    label,
    value,
    sub,
    color = "blue",
    pulse = false,
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    sub?: string;
    color?: "blue" | "green" | "amber" | "red" | "teal" | "violet" | "cyan" | "slate";
    pulse?: boolean;
}) {
    const colors: Record<string, string> = {
        blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
        green: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
        amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
        red: "bg-red-500/10 border-red-500/20 text-red-400",
        teal: "bg-teal-500/10 border-teal-500/20 text-teal-400",
        violet: "bg-violet-500/10 border-violet-500/20 text-violet-400",
        cyan: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
        slate: "bg-slate-500/10 border-slate-500/20 text-slate-400",
    };
    const iconColors: Record<string, string> = {
        blue: "text-blue-400",
        green: "text-emerald-400",
        amber: "text-amber-400",
        red: "text-red-400",
        teal: "text-teal-400",
        violet: "text-violet-400",
        cyan: "text-cyan-400",
        slate: "text-slate-400",
    };

    return (
        <div className={`rounded-xl border p-4 flex flex-col gap-2 ${colors[color]} transition-all hover:scale-[1.02]`}>
            <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${iconColors[color]} ${pulse ? "animate-pulse" : ""}`} />
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</span>
            </div>
            <div className="text-3xl font-black text-white leading-none">{value}</div>
            {sub && <div className="text-[10px] font-medium text-slate-500 leading-tight">{sub}</div>}
        </div>
    );
}

function SectionHeader({ icon: Icon, title, count, color = "slate" }: { icon: React.ElementType; title: string; count?: number; color?: string }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <Icon className={`w-4 h-4 text-${color}-400`} />
            <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-300">{title}</h3>
            {count !== undefined && (
                <Badge className="bg-slate-700/80 text-slate-300 border-none text-[9px] h-4 px-1.5 font-black ml-auto">
                    {count}
                </Badge>
            )}
        </div>
    );
}

function RingChart({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
    const r = (size - 10) / 2;
    const circ = 2 * Math.PI * r;
    const filled = (pct / 100) * circ;

    return (
        <svg width={size} height={size} className="rotate-[-90deg]">
            <circle cx={size / 2} cy={size / 2} r={r} stroke="#1e293b" strokeWidth={8} fill="none" />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={color}
                strokeWidth={8}
                fill="none"
                strokeDasharray={`${filled} ${circ}`}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
            />
        </svg>
    );
}

function MultiSegmentBar({ segments }: { segments: { label: string; value: number; pct: number; color: string }[] }) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex h-3 rounded-full overflow-hidden bg-slate-800 gap-0.5">
                {segments.map((s, i) => (
                    <div
                        key={i}
                        className="transition-all duration-700 ease-out h-full first:rounded-l-full last:rounded-r-full"
                        style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                        title={`${s.label}: ${s.value}`}
                    />
                ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
                {segments.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</span>
                        <span className="text-[9px] font-black text-white">{s.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Per-inspection-type accent colour palette (cycles through 10 hues)
const TYPE_ACCENT_PALETTE = [
    { bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.30)",  text: "#60a5fa",  codeBg: "rgba(59,130,246,0.20)" },  // blue
    { bg: "rgba(20,184,166,0.12)",  border: "rgba(20,184,166,0.30)",  text: "#2dd4bf",  codeBg: "rgba(20,184,166,0.20)" },  // teal
    { bg: "rgba(168,85,247,0.12)",  border: "rgba(168,85,247,0.30)",  text: "#c084fc",  codeBg: "rgba(168,85,247,0.20)" },  // violet
    { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.30)",   text: "#4ade80",  codeBg: "rgba(34,197,94,0.20)" },   // green
    { bg: "rgba(249,115,22,0.12)",  border: "rgba(249,115,22,0.30)",  text: "#fb923c",  codeBg: "rgba(249,115,22,0.20)" },  // orange
    { bg: "rgba(234,179,8,0.12)",   border: "rgba(234,179,8,0.30)",   text: "#facc15",  codeBg: "rgba(234,179,8,0.20)" },   // yellow
    { bg: "rgba(236,72,153,0.12)",  border: "rgba(236,72,153,0.30)",  text: "#f472b6",  codeBg: "rgba(236,72,153,0.20)" },  // pink
    { bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.30)",  text: "#818cf8",  codeBg: "rgba(99,102,241,0.20)" },  // indigo
    { bg: "rgba(6,182,212,0.12)",   border: "rgba(6,182,212,0.30)",   text: "#22d3ee",  codeBg: "rgba(6,182,212,0.20)" },   // cyan
    { bg: "rgba(132,204,22,0.12)",  border: "rgba(132,204,22,0.30)",  text: "#a3e635",  codeBg: "rgba(132,204,22,0.20)" },  // lime
];

function InspTypeCard({
    code, name, count, rov, dive, anomaly, finding, colorIndex
}: {
    code: string; name: string; count: number;
    rov: number; dive: number;
    anomaly: number; finding: number;
    colorIndex: number;
}) {
    const accent = TYPE_ACCENT_PALETTE[colorIndex % TYPE_ACCENT_PALETTE.length];
    const hasAlert = anomaly > 0 || finding > 0;

    return (
        <div
            className="rounded-lg border px-3 py-2.5 flex items-center gap-2.5 transition-all hover:scale-[1.005]"
            style={{
                background: accent.bg,
                borderColor: hasAlert ? "rgba(239,68,68,0.45)" : accent.border,
                boxShadow: hasAlert ? "0 0 0 1px rgba(239,68,68,0.12)" : undefined,
            }}
        >
            {/* Code badge */}
            <span
                className="text-[11px] font-black px-2 py-0.5 rounded font-mono flex-shrink-0 tracking-wider"
                style={{ background: accent.codeBg, color: accent.text }}
            >
                {code}
            </span>

            {/* Name */}
            <span className="text-[13px] font-semibold text-slate-200 flex-1 truncate">{name}</span>

            {/* ROV pill — only when rov > 0 */}
            {rov > 0 && (
                <span
                    className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded flex-shrink-0"
                    style={{
                        background: "rgba(59,130,246,0.22)",
                        color: "#93c5fd",
                        border: "1px solid rgba(59,130,246,0.35)"
                    }}
                >
                    <span className="font-mono">ROV</span>
                    <span>{rov}</span>
                </span>
            )}

            {/* DIVE pill — only when dive > 0 */}
            {dive > 0 && (
                <span
                    className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded flex-shrink-0"
                    style={{
                        background: "rgba(6,182,212,0.18)",
                        color: "#67e8f9",
                        border: "1px solid rgba(6,182,212,0.35)"
                    }}
                >
                    <span className="font-mono">DIVE</span>
                    <span>{dive}</span>
                </span>
            )}

            {/* Anomaly badge — only when > 0 */}
            {anomaly > 0 && (
                <span
                    className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded flex-shrink-0"
                    style={{
                        background: "rgba(239,68,68,0.18)",
                        color: "#f87171",
                        border: "1px solid rgba(239,68,68,0.40)"
                    }}
                >
                    <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 flex-shrink-0" fill="currentColor">
                        <path d="M6 1L11 10H1L6 1z" />
                    </svg>
                    {anomaly} {anomaly === 1 ? "Anomaly" : "Anomalies"}
                </span>
            )}

            {/* Finding badge — only when > 0 */}
            {finding > 0 && (
                <span
                    className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded flex-shrink-0"
                    style={{
                        background: "rgba(168,85,247,0.18)",
                        color: "#c084fc",
                        border: "1px solid rgba(168,85,247,0.40)"
                    }}
                >
                    <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 flex-shrink-0" fill="currentColor">
                        <circle cx="6" cy="6" r="5" />
                    </svg>
                    {finding} {finding === 1 ? "Finding" : "Findings"}
                </span>
            )}

            {/* Total count */}
            <span
                className="text-lg font-black flex-shrink-0 min-w-[20px] text-right"
                style={{ color: accent.text }}
            >
                {count}
            </span>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function InspectionSummaryPanel({
    open,
    onClose,
    sowId,
    structureId,
    jobpackId,
    sowReportNo,
    headerData,
}: InspectionSummaryPanelProps) {
    const [data, setData] = useState<SummaryData | null>(null);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const supabase = createClient();

    const fetchSummary = useCallback(async () => {
        if (!structureId && !sowId) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (sowId) params.set("sow_id", sowId);
            if (structureId) params.set("structure_id", structureId);
            if (jobpackId) params.set("jobpack_id", jobpackId);
            if (sowReportNo && sowReportNo !== "N/A") params.set("sow_report_no", sowReportNo);

            const res = await fetch(`/api/inspection-summary?${params.toString()}`);
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setData(json.data);
            setLastUpdated(new Date());
        } catch (e: any) {
            setError(e.message || "Failed to load summary");
        } finally {
            setLoading(false);
        }
    }, [sowId, structureId, jobpackId, sowReportNo]);

    // Initial + periodic refresh
    useEffect(() => {
        if (!open) return;
        fetchSummary();
        intervalRef.current = setInterval(fetchSummary, 30000); // refresh every 30s
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [open, fetchSummary]);

    // Supabase realtime subscription
    useEffect(() => {
        if (!open) return;
        const channel = supabase
            .channel("inspection-summary-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "insp_records" }, () => {
                fetchSummary();
            })
            .on("postgres_changes", { event: "*", schema: "public", table: "u_sow_items" }, () => {
                fetchSummary();
            })
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [open, fetchSummary, supabase]);

    if (!open) return null;

    const sow = data?.sow;
    const records = data?.records;
    const fmd = data?.fmd;
    const anodeGvi = data?.anodeGvi;
    const sani = data?.sani;
    const cp = data?.cp;
    const anomalies = data?.anomalies;
    const findings = data?.findings;
    const attachmentGroups = data?.attachmentGroups;

    const sowSegments = sow
        ? [
              { label: "Complete", value: sow.completed, pct: sow.completedPct, color: "#10b981" },
              { label: "Incomplete", value: sow.incomplete, pct: sow.incompletePct, color: "#f59e0b" },
              { label: "Pending", value: sow.pending, pct: sow.pendingPct, color: "#334155" },
          ]
        : [];

    const hasBoth = records?.hasBothModes ?? false;

    return (
        // Overlay backdrop
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-end"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            {/* Panel */}
            <div
                className="h-full w-full max-w-3xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-l border-slate-700/50 shadow-2xl flex flex-col overflow-hidden"
                style={{ animation: "slideInRight 0.25s cubic-bezier(0.16,1,0.3,1)" }}
            >
                {/* ── Header ── */}
                <div className="bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 border-b border-slate-700/50 px-6 py-4 flex items-center justify-between shrink-0">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                                <BarChart3 className="w-4 h-4 text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-sm font-black uppercase tracking-[0.15em] text-white">Inspection Summary</h2>
                                <div className="text-[10px] font-bold text-slate-400 tracking-wider">
                                    {headerData.platformName} · {headerData.sowReportNo}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {lastUpdated && (
                            <div className="text-[9px] font-bold text-slate-500 hidden sm:block">
                                Updated {lastUpdated.toLocaleTimeString()}
                            </div>
                        )}
                        <button
                            onClick={fetchSummary}
                            disabled={loading}
                            className="p-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
                            title="Refresh"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-all"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* ── Live Indicator ── */}
                <div className="px-6 py-1.5 bg-slate-900/70 border-b border-slate-800/50 flex items-center gap-2 shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-500">Live Dashboard</span>
                    <span className="text-[9px] text-slate-600 mx-1">·</span>
                    <span className="text-[9px] text-slate-500">Auto-refreshes every 30s · Realtime sync active</span>
                    {loading && (
                        <>
                            <span className="text-[9px] text-slate-600 mx-1">·</span>
                            <span className="text-[9px] text-blue-400 font-bold animate-pulse">Refreshing...</span>
                        </>
                    )}
                </div>

                {/* ── Error ── */}
                {error && (
                    <div className="mx-6 mt-4 p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-red-400 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {/* ── Scrollable Content ── */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7 custom-scrollbar">

                    {/* ═══ SECTION 1: SOW COMPLETION ═══════════════════════════════════════ */}
                    <section>
                        <SectionHeader icon={Target} title="Scope of Work Completion" color="blue" />

                        {/* Big completion ring + stats */}
                        <div className="bg-slate-800/30 border border-slate-700/40 rounded-2xl p-5">
                            <div className="flex items-center gap-6 mb-5">
                                {/* Ring */}
                                <div className="relative flex-shrink-0">
                                    <RingChart
                                        pct={sow?.completionPct ?? 0}
                                        color="#3b82f6"
                                        size={100}
                                    />
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-2xl font-black text-white leading-none">{sow?.completionPct ?? 0}%</span>
                                        <span className="text-[8px] font-bold text-blue-400 uppercase tracking-wider">Progress</span>
                                    </div>
                                </div>

                                {/* Stats grid */}
                                <div className="flex-1 grid grid-cols-3 gap-3">
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                                        <div className="text-2xl font-black text-emerald-400">{sow?.completed ?? 0}</div>
                                        <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider mt-0.5">Complete</div>
                                    </div>
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                                        <div className="text-2xl font-black text-amber-400">{sow?.incomplete ?? 0}</div>
                                        <div className="text-[9px] font-bold text-amber-500 uppercase tracking-wider mt-0.5">Incomplete</div>
                                    </div>
                                    <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-3 text-center">
                                        <div className="text-2xl font-black text-slate-400">{sow?.pending ?? 0}</div>
                                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Pending</div>
                                    </div>
                                </div>
                            </div>

                            {/* Multi-segment bar */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Overall Progress</span>
                                    <span className="text-[9px] font-black text-white">{sow?.total ?? 0} Total Items</span>
                                </div>
                                <MultiSegmentBar segments={sowSegments} />
                            </div>

                            {/* Overall percentage breakdown */}
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className="bg-slate-900/60 rounded-xl p-3 flex items-center gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
                                    <div>
                                        <div className="text-[10px] text-slate-500 font-bold">Complete + Incomplete</div>
                                        <div className="text-lg font-black text-white">{sow?.completionPct ?? 0}%</div>
                                        <div className="text-[9px] text-slate-600">vs Pending SOW Items</div>
                                    </div>
                                </div>
                                <div className="bg-slate-900/60 rounded-xl p-3 flex items-center gap-3">
                                    <Clock className="w-5 h-5 text-slate-400 flex-shrink-0" />
                                    <div>
                                        <div className="text-[10px] text-slate-500 font-bold">Pending (Not Started)</div>
                                        <div className="text-lg font-black text-slate-300">{sow?.pendingPct ?? 0}%</div>
                                        <div className="text-[9px] text-slate-600">{sow?.pending ?? 0} items remaining</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ═══ SECTION 2: INSPECTION OVERVIEW ════════════════════════════════ */}
                    <section>
                        <SectionHeader icon={Activity} title="Inspection Overview" color="cyan" count={records?.total} />
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                            <StatCard icon={CheckCircle2} label="Pass Records" value={records?.completed ?? 0} color="green" />
                            <StatCard icon={Clock} label="Incomplete" value={records?.incomplete ?? 0} color="amber" />
                            <StatCard icon={AlertTriangle} label="Anomalies" value={records?.anomaly ?? 0} color="red" pulse={!!(records?.anomaly && records.anomaly > 0)} />
                            <StatCard icon={Info} label="Findings" value={records?.finding ?? 0} color="violet" />
                        </div>

                        {/* Mode breakdown */}
                        {hasBoth ? (
                            <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-4 grid grid-cols-3 gap-3">
                                <div className="text-center">
                                    <div className="text-[9px] font-black uppercase text-blue-400 tracking-wider mb-1">ROV</div>
                                    <div className="text-2xl font-black text-blue-300">{records?.rovCount ?? 0}</div>
                                    <div className="text-[9px] text-slate-500">{records?.uniqueRovJobs ?? 0} Deployments</div>
                                </div>
                                <div className="flex items-center justify-center">
                                    <div className="text-[9px] font-black text-slate-500 tracking-wider">+</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[9px] font-black uppercase text-cyan-400 tracking-wider mb-1">DIVING</div>
                                    <div className="text-2xl font-black text-cyan-300">{records?.diveCount ?? 0}</div>
                                    <div className="text-[9px] text-slate-500">{records?.uniqueDiveJobs ?? 0} Dives</div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-3 flex items-center gap-3">
                                <Shield className="w-4 h-4 text-slate-400" />
                                <span className="text-[10px] font-bold text-slate-400">
                                    {(records?.rovCount ?? 0) > 0 ? "ROV Only" : "Diving Only"} ·{" "}
                                    {(records?.rovCount ?? 0) > 0 ? records?.uniqueRovJobs : records?.uniqueDiveJobs} Deployments
                                </span>
                            </div>
                        )}

                        {/* Inspection type breakdown */}
                        {records && Object.keys(records.inspTypeBreakdown).length > 0 && (
                            <div className="mt-3 bg-slate-800/20 border border-slate-700/30 rounded-xl overflow-hidden">
                                <div className="px-4 py-2.5 bg-slate-800/40 border-b border-slate-700/30 flex items-center gap-2">
                                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">By Inspection Type</span>
                                    <div className="ml-auto flex items-center gap-2">
                                        <span className="inline-flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
                                            <svg viewBox="0 0 12 12" className="w-2 h-2" fill="currentColor"><path d="M6 1L11 10H1L6 1z" /></svg>
                                            Anomaly
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded" style={{ background: "rgba(168,85,247,0.15)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.3)" }}>
                                            <svg viewBox="0 0 12 12" className="w-2 h-2" fill="currentColor"><circle cx="6" cy="6" r="5" /></svg>
                                            Finding
                                        </span>
                                    </div>
                                </div>
                                <div className="p-3 grid grid-cols-1 gap-2">
                                    {Object.entries(records.inspTypeBreakdown)
                                        .sort((a, b) => b[1].count - a[1].count)
                                        .map(([code, info], idx) => (
                                            <InspTypeCard
                                                key={code}
                                                code={code}
                                                name={info.name}
                                                count={info.count}
                                                rov={info.rov}
                                                dive={info.dive}
                                                anomaly={info.anomaly}
                                                finding={info.finding}
                                                colorIndex={idx}
                                            />
                                        ))}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* ═══ SECTION 3: FMD ═════════════════════════════════════════════════ */}
                    {fmd && fmd.total > 0 && (
                        <section>
                            <SectionHeader icon={Eye} title="Flooded Member Detection (FMD)" color="teal" count={fmd.total} />
                            <div className="bg-slate-800/30 border border-teal-500/20 rounded-2xl p-4 space-y-4">
                                {hasBoth ? (
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                                            <div className="text-xl font-black text-blue-400">{fmd.rov}</div>
                                            <div className="text-[9px] font-bold text-blue-500 uppercase tracking-wider mt-0.5">ROV</div>
                                        </div>
                                        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 text-center">
                                            <div className="text-xl font-black text-cyan-400">{fmd.dive}</div>
                                            <div className="text-[9px] font-bold text-cyan-500 uppercase tracking-wider mt-0.5">Diving</div>
                                        </div>
                                        <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-3 text-center">
                                            <div className="text-xl font-black text-teal-400">{fmd.total}</div>
                                            <div className="text-[9px] font-bold text-teal-500 uppercase tracking-wider mt-0.5">Total</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-2">
                                        <div className="text-4xl font-black text-teal-400">{fmd.total}</div>
                                        <div className="text-[10px] font-bold text-teal-500 uppercase tracking-wider mt-1">FMD Inspected</div>
                                    </div>
                                )}

                                {/* Condition Breakdown — members_status field values */}
                                <div className="border-t border-slate-700/40 pt-3">
                                    <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2">Member Status Breakdown</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {([
                                            { key: "dry",          label: "Dry",            color: "emerald" },
                                            { key: "flooded",      label: "Flooded",        color: "red" },
                                            { key: "grouted",      label: "Grouted",        color: "violet" },
                                            { key: "inconclusive", label: "Inconclusive",   color: "amber" },
                                            { key: "incomplete",   label: "Not Recorded",  color: "slate" },
                                        ] as { key: keyof typeof fmd.conditions; label: string; color: string }[]).map(({ key, label, color }) => {
                                            const val = fmd.conditions?.[key] ?? 0;
                                            return (
                                                <div
                                                    key={key}
                                                    className={`flex items-center justify-between rounded-lg px-3 py-2.5 border ${
                                                        val > 0
                                                            ? `bg-${color}-500/15 border-${color}-500/30`
                                                            : "bg-slate-800/40 border-slate-700/30"
                                                    }`}
                                                >
                                                    <span className={`text-[9px] font-bold uppercase tracking-wider ${
                                                        val > 0 ? `text-${color}-400` : "text-slate-600"
                                                    }`}>{label}</span>
                                                    <span className={`text-base font-black ${
                                                        val > 0 ? `text-${color}-300` : "text-slate-600"
                                                    }`}>{val}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* ═══ SECTION 4: ANODE GVI ═══════════════════════════════════════════*/}
                    {anodeGvi && anodeGvi.total > 0 && (
                        <section>
                            <SectionHeader icon={Zap} title="Anode Inspection (GVI)" color="amber" count={anodeGvi.total} />
                            <div className="bg-slate-800/30 border border-amber-500/20 rounded-2xl p-4 space-y-4">
                                {/* ROV / Dive / Total counts */}
                                {hasBoth ? (
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                                            <div className="text-xl font-black text-blue-400">{anodeGvi.rov}</div>
                                            <div className="text-[9px] font-bold text-blue-500 uppercase tracking-wider mt-0.5">ROV</div>
                                        </div>
                                        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 text-center">
                                            <div className="text-xl font-black text-cyan-400">{anodeGvi.dive}</div>
                                            <div className="text-[9px] font-bold text-cyan-500 uppercase tracking-wider mt-0.5">Diving</div>
                                        </div>
                                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                                            <div className="text-xl font-black text-amber-400">{anodeGvi.total}</div>
                                            <div className="text-[9px] font-bold text-amber-500 uppercase tracking-wider mt-0.5">Total</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-1">
                                        <div className="text-4xl font-black text-amber-400">{anodeGvi.total}</div>
                                        <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mt-1">Anodes Inspected</div>
                                    </div>
                                )}

                                {/* Depletion % Breakdown */}
                                {anodeGvi.depletionBuckets && Object.keys(anodeGvi.depletionBuckets).length > 0 && (
                                    <div className="border-t border-slate-700/40 pt-3">
                                        <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2">Depletion % Breakdown</div>
                                        <div className="space-y-1.5">
                                            {([
                                                { key: "0–25%",   color: "#10b981" },
                                                { key: "25–50%",  color: "#f59e0b" },
                                                { key: "50–75%",  color: "#f97316" },
                                                { key: "75–100%", color: "#ef4444" },
                                            ] as { key: string; color: string }[]).map(({ key, color }) => {
                                                const cnt = anodeGvi.depletionBuckets[key] ?? 0;
                                                const pct = anodeGvi.total > 0 ? Math.round((cnt / anodeGvi.total) * 100) : 0;
                                                return (
                                                    <div key={key} className="flex items-center gap-2">
                                                        <div className="w-14 text-[9px] font-black text-slate-400 shrink-0 text-right">{key}</div>
                                                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full transition-all duration-700"
                                                                style={{ width: `${pct}%`, backgroundColor: color }}
                                                            />
                                                        </div>
                                                        <div className="w-6 text-[10px] font-black text-white shrink-0 text-right">{cnt}</div>
                                                    </div>
                                                );
                                            })}
                                            {/* Any extra non-standard keys */}
                                            {Object.entries(anodeGvi.depletionBuckets)
                                                .filter(([k]) => !["0–25%","25–50%","50–75%","75–100%"].includes(k))
                                                .map(([k, cnt]) => (
                                                    <div key={k} className="flex items-center gap-2">
                                                        <div className="w-14 text-[9px] font-black text-slate-400 shrink-0 text-right">{k}</div>
                                                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full bg-slate-500" style={{ width: `${anodeGvi.total > 0 ? Math.round((cnt / anodeGvi.total) * 100) : 0}%` }} />
                                                        </div>
                                                        <div className="w-6 text-[10px] font-black text-white shrink-0 text-right">{cnt}</div>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    </div>
                                )}

                                {/* Anode Condition Breakdown */}
                                {anodeGvi.conditionCounts && Object.keys(anodeGvi.conditionCounts).length > 0 && (
                                    <div className="border-t border-slate-700/40 pt-3">
                                        <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2">Anode Condition</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.entries(anodeGvi.conditionCounts)
                                                .sort((a, b) => b[1] - a[1])
                                                .map(([cond, cnt]) => {
                                                    const condColor: Record<string,string> = {
                                                        Intact: "emerald",
                                                        Wasted: "amber",
                                                        Missing: "red",
                                                        Disconnected: "violet",
                                                    };
                                                    const col = condColor[cond] || "slate";
                                                    return (
                                                        <div key={cond} className={`flex items-center justify-between rounded-lg px-3 py-2 bg-${col}-500/10 border border-${col}-500/20`}>
                                                            <span className={`text-[9px] font-bold text-${col}-400 uppercase tracking-wider`}>{cond}</span>
                                                            <span className={`text-base font-black text-${col}-300`}>{cnt}</span>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}
                                {/* Selected Anode Inspection (SANI / RSANI) — shown inside anode card when data exists */}
                                {sani && sani.total > 0 && (
                                    <div className="border-t border-slate-700/40 pt-3">
                                        <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2 flex items-center gap-2">
                                            Selected Anode Inspection
                                            <span className="text-[8px] font-black text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded">SANI / RSANI</span>
                                        </div>
                                        {hasBoth ? (
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-2.5 text-center">
                                                    <div className="text-lg font-black text-blue-400">{sani.rov}</div>
                                                    <div className="text-[9px] font-bold text-blue-500 uppercase tracking-wider mt-0.5">ROV</div>
                                                </div>
                                                <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-2.5 text-center">
                                                    <div className="text-lg font-black text-cyan-400">{sani.dive}</div>
                                                    <div className="text-[9px] font-bold text-cyan-500 uppercase tracking-wider mt-0.5">Diving</div>
                                                </div>
                                                <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-2.5 text-center">
                                                    <div className="text-lg font-black text-violet-400">{sani.total}</div>
                                                    <div className="text-[9px] font-bold text-violet-500 uppercase tracking-wider mt-0.5">Total</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3">
                                                <div>
                                                    <div className="text-[10px] font-bold text-violet-400">Selected Anodes Inspected</div>
                                                    <div className="text-[9px] text-slate-500">{sani.rov > 0 ? "ROV" : "Diving"} mode</div>
                                                </div>
                                                <div className="text-2xl font-black text-violet-300">{sani.total}</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* ═══ SECTION 6: CP READINGS ═════════════════════════════════════════ */}
                    {cp && (cp.primaryCount > 0 || cp.additionalCount > 0) && (
                        <section>
                            <SectionHeader icon={Gauge} title="Cathodic Protection (CP)" color="cyan" count={cp.totalCount} />
                            <div className="bg-slate-800/30 border border-cyan-500/20 rounded-2xl p-4 space-y-4">

                                {/* ── Primary CP Readings ── */}
                                <div>
                                    <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2">Primary CP Readings</div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                                            <div className="text-xl font-black text-blue-400">{cp.primaryRov}</div>
                                            <div className="text-[9px] font-bold text-blue-500 uppercase tracking-wider mt-0.5">ROV</div>
                                        </div>
                                        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 text-center">
                                            <div className="text-xl font-black text-cyan-400">{cp.primaryDive}</div>
                                            <div className="text-[9px] font-bold text-cyan-500 uppercase tracking-wider mt-0.5">Diving</div>
                                        </div>
                                        <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-3 text-center">
                                            <div className="text-xl font-black text-teal-400">{cp.primaryCount}</div>
                                            <div className="text-[9px] font-bold text-teal-500 uppercase tracking-wider mt-0.5">Total</div>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Additional CP Readings ── */}
                                {cp.additionalCount > 0 && (
                                    <div className="border-t border-slate-700/40 pt-3">
                                        <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2">Additional CP Readings</div>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                                                <div className="text-xl font-black text-blue-400">{cp.additionalRov}</div>
                                                <div className="text-[9px] font-bold text-blue-500 uppercase tracking-wider mt-0.5">ROV</div>
                                            </div>
                                            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 text-center">
                                                <div className="text-xl font-black text-cyan-400">{cp.additionalDive}</div>
                                                <div className="text-[9px] font-bold text-cyan-500 uppercase tracking-wider mt-0.5">Diving</div>
                                            </div>
                                            <div className="bg-slate-600/20 border border-slate-600/30 rounded-xl p-3 text-center">
                                                <div className="text-xl font-black text-slate-300">{cp.additionalCount}</div>
                                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Total</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ── Grand Total ── */}
                                <div className="border-t border-slate-700/40 pt-3 flex items-center justify-between bg-slate-900/50 rounded-xl px-4 py-3">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Grand Total CP Readings</span>
                                    <span className="text-2xl font-black text-white">{cp.totalCount}</span>
                                </div>

                                {/* ── Min / Max ── */}
                                {(cp.minVal !== null || cp.maxVal !== null) && (
                                    <div className="border-t border-slate-700/40 pt-3 grid grid-cols-2 gap-3">
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3">
                                            <TrendingUp className="w-5 h-5 text-emerald-400 rotate-180 flex-shrink-0" />
                                            <div>
                                                <div className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider">Min CP Reading</div>
                                                <div className="text-lg font-black text-emerald-300">
                                                    {cp.minVal !== null ? `${cp.minVal.toFixed(3)} V` : "—"}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-center gap-3">
                                            <TrendingUp className="w-5 h-5 text-blue-400 flex-shrink-0" />
                                            <div>
                                                <div className="text-[9px] text-blue-500 font-bold uppercase tracking-wider">Max CP Reading</div>
                                                <div className="text-lg font-black text-blue-300">
                                                    {cp.maxVal !== null ? `${cp.maxVal.toFixed(3)} V` : "—"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* ═══ SECTION 7: ANOMALIES ═══════════════════════════════════════════ */}
                    {anomalies && anomalies.total > 0 && (
                        <section>
                            <SectionHeader icon={AlertTriangle} title="Anomaly Count" color="red" count={anomalies.total} />
                            <div className="bg-slate-800/30 border border-red-500/20 rounded-2xl p-4 space-y-4">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                                        <div className="text-2xl font-black text-red-400">{anomalies.total}</div>
                                        <div className="text-[9px] font-bold text-red-500 uppercase tracking-wider mt-0.5">Total</div>
                                    </div>
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                                        <div className="text-2xl font-black text-amber-400">{anomalies.open}</div>
                                        <div className="text-[9px] font-bold text-amber-500 uppercase tracking-wider mt-0.5">Open</div>
                                    </div>
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                                        <div className="text-2xl font-black text-emerald-400">{anomalies.rectified}</div>
                                        <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider mt-0.5">Rectified</div>
                                    </div>
                                </div>

                                {/* By Priority (P1, P2, P3 etc.) */}
                                {anomalies.byPriority && Object.keys(anomalies.byPriority).length > 0 && (
                                    <div className="border-t border-slate-700/40 pt-3">
                                        <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2">By Priority</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.entries(anomalies.byPriority)
                                                .sort((a, b) => a[0].localeCompare(b[0]))
                                                .map(([priority, cnt]) => {
                                                    const priorityColors: Record<string, { bg: string; border: string; text: string; val: string }> = {
                                                        P1: { bg: "bg-red-500/15",     border: "border-red-500/30",     text: "text-red-400",     val: "text-red-300" },
                                                        P2: { bg: "bg-orange-500/15",  border: "border-orange-500/30",  text: "text-orange-400",  val: "text-orange-300" },
                                                        P3: { bg: "bg-amber-500/15",   border: "border-amber-500/30",   text: "text-amber-400",   val: "text-amber-300" },
                                                        P4: { bg: "bg-yellow-500/15",  border: "border-yellow-500/30",  text: "text-yellow-400",  val: "text-yellow-300" },
                                                        NONE: { bg: "bg-slate-700/30", border: "border-slate-600/30",   text: "text-slate-400",   val: "text-slate-300" },
                                                    };
                                                    const c = priorityColors[priority] || { bg: "bg-violet-500/15", border: "border-violet-500/30", text: "text-violet-400", val: "text-violet-300" };
                                                    return (
                                                        <div key={priority} className={`flex items-center justify-between rounded-lg px-3 py-2.5 border ${c.bg} ${c.border}`}>
                                                            <span className={`text-[10px] font-black uppercase tracking-widest ${c.text}`}>{priority}</span>
                                                            <span className={`text-xl font-black ${c.val}`}>{cnt}</span>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}

                                {/* By Defect Type — secondary detail */}
                                {anomalies.byDefectType && Object.keys(anomalies.byDefectType).length > 0 && (
                                    <div className="border-t border-slate-700/40 pt-3">
                                        <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2">By Defect Type</div>
                                        <div className="space-y-1">
                                            {Object.entries(anomalies.byDefectType)
                                                .sort((a, b) => b[1] - a[1])
                                                .map(([type, cnt]) => (
                                                    <div key={type} className="flex items-center gap-2 py-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                                                        <span className="text-[10px] text-slate-400 flex-1 truncate">{type}</span>
                                                        <span className="text-[10px] font-black text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">{cnt}</span>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* ═══ SECTION 8: FINDINGS ════════════════════════════════════════════ */}
                    {findings && findings.total > 0 && (
                        <section>
                            <SectionHeader icon={FileSearch} title="Findings Count" color="violet" count={findings.total} />
                            <div className="bg-slate-800/30 border border-violet-500/20 rounded-2xl p-4 space-y-4">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 text-center">
                                        <div className="text-2xl font-black text-violet-400">{findings.total}</div>
                                        <div className="text-[9px] font-bold text-violet-500 uppercase tracking-wider mt-0.5">Total</div>
                                    </div>
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                                        <div className="text-2xl font-black text-amber-400">{findings.open}</div>
                                        <div className="text-[9px] font-bold text-amber-500 uppercase tracking-wider mt-0.5">Open</div>
                                    </div>
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                                        <div className="text-2xl font-black text-emerald-400">{findings.rectified}</div>
                                        <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider mt-0.5">Resolved</div>
                                    </div>
                                </div>

                                {/* By Priority */}
                                {findings.byPriority && Object.keys(findings.byPriority).length > 0 && (
                                    <div className="border-t border-slate-700/40 pt-3">
                                        <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2">By Priority</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.entries(findings.byPriority)
                                                .sort((a, b) => a[0].localeCompare(b[0]))
                                                .map(([priority, cnt]) => {
                                                    const priorityColors: Record<string, { bg: string; border: string; text: string; val: string }> = {
                                                        P1: { bg: "bg-red-500/15",     border: "border-red-500/30",     text: "text-red-400",     val: "text-red-300" },
                                                        P2: { bg: "bg-orange-500/15",  border: "border-orange-500/30",  text: "text-orange-400",  val: "text-orange-300" },
                                                        P3: { bg: "bg-amber-500/15",   border: "border-amber-500/30",   text: "text-amber-400",   val: "text-amber-300" },
                                                        P4: { bg: "bg-yellow-500/15",  border: "border-yellow-500/30",  text: "text-yellow-400",  val: "text-yellow-300" },
                                                        NONE: { bg: "bg-slate-700/30", border: "border-slate-600/30",   text: "text-slate-400",   val: "text-slate-300" },
                                                    };
                                                    const c = priorityColors[priority] || { bg: "bg-violet-500/15", border: "border-violet-500/30", text: "text-violet-400", val: "text-violet-300" };
                                                    return (
                                                        <div key={priority} className={`flex items-center justify-between rounded-lg px-3 py-2.5 border ${c.bg} ${c.border}`}>
                                                            <span className={`text-[10px] font-black uppercase tracking-widest ${c.text}`}>{priority}</span>
                                                            <span className={`text-xl font-black ${c.val}`}>{cnt}</span>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* ═══ SECTION 9: ATTACHMENT GROUPS ══════════════════════════════════ */}
                    {attachmentGroups && (
                        <section>
                            <SectionHeader icon={Anchor} title="Attachment Group Inspections" color="blue" />
                            <div className="bg-slate-800/30 border border-slate-700/40 rounded-2xl overflow-hidden">
                                {[
                                    { key: "Riser", icon: Waves, color: "blue" },
                                    { key: "Conductor", icon: Hash, color: "slate" },
                                    { key: "Caisson", icon: Anchor, color: "cyan" },
                                    { key: "Riser Guard", icon: Shield, color: "green" },
                                    { key: "Boat Landing", icon: Ship, color: "amber" },
                                ].map(({ key, icon: Icon, color }, idx) => {
                                    const count = attachmentGroups[key] ?? 0;
                                    return (
                                        <div
                                            key={key}
                                            className={`flex items-center gap-3 px-4 py-3 ${idx !== 0 ? "border-t border-slate-800/60" : ""} hover:bg-slate-700/20 transition-colors`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg bg-${color}-500/10 border border-${color}-500/20 flex items-center justify-center flex-shrink-0`}>
                                                <Icon className={`w-4 h-4 text-${color}-400`} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-xs font-bold text-slate-300">{key} Inspection</div>
                                                <div className="text-[9px] text-slate-500">Attachment group</div>
                                            </div>
                                            <div className={`text-xl font-black ${count > 0 ? `text-${color}-400` : "text-slate-600"}`}>
                                                {count}
                                            </div>
                                            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* Loading skeleton */}
                    {loading && !data && (
                        <div className="space-y-4 animate-pulse">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-32 bg-slate-800/40 rounded-2xl" />
                            ))}
                        </div>
                    )}

                    {/* Bottom padding */}
                    <div className="h-6" />
                </div>
            </div>

            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
            `}</style>
        </div>
    );
}
