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
  LayoutGrid,
  Printer,
  Compass,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    inspTypeBreakdown: Record<
      string,
      { name: string; count: number; rov: number; dive: number; anomaly: number; finding: number }
    >;
  };
  fmd: {
    total: number;
    rov: number;
    dive: number;
    conditions: {
      dry: number;
      flooded: number;
      grouted: number;
      inconclusive: number;
      incomplete: number;
    };
  };
  anodeGvi: {
    total: number;
    rov: number;
    dive: number;
    depletionBuckets: Record<string, number>;
    conditionCounts: Record<string, number>;
  };
  anodeMaintenance?: {
    total: number;
    replaced: number;
    installed: number;
    maintenanceCount: number;
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
    cpDetails?: Record<string, Record<string, Array<{ val: number; type: "primary" | "additional"; mode: string }>>>;
  };
  anomalies: {
    total: number;
    rectified: number;
    open: number;
    byPriority: Record<string, number>;
    byDefectType: Record<string, number>;
    defectTypeDetails?: Record<string, Array<{ qid: string; inspectionTypeName: string }>>;
  };
  findings: {
    total: number;
    rectified: number;
    open: number;
    byPriority: Record<string, number>;
  };
  attachmentGroups: Record<string, { count: number; total: number }>;
  componentSummary?: Record<string, Record<string, {
    totalRecords: number;
    inspectionTypes: Record<string, {
        completed: number;
        incomplete: number;
        anomaly: number;
        pending: number;
    }>;
  }>>;
  inspectionTypeSummary?: Record<string, Record<string, Record<string, {
    completed: number;
    incomplete: number;
    anomaly: number;
    pending: number;
    total: number;
  }>>>;
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
  isPipeline?: boolean;
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
  icon: React.ElementType<any>;
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
  } as Record<string, string>;
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
    <div
      className={`rounded-xl border p-4 flex flex-col gap-2 ${colors[color] ?? ""} transition-all hover:scale-[1.02]`}
    >
      <div className="flex items-center gap-2">
        {(React.createElement as any)(Icon, {
          className: ["w-4 h-4", iconColors[color] ?? "", pulse ? "animate-pulse" : ""].join(" "),
        })}
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">
          {label}
        </span>
      </div>
      <div className="text-3xl font-black text-white leading-none">{value}</div>
      {sub && <div className="text-[10px] font-medium text-slate-400 leading-tight">{sub}</div>}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  color = "slate",
}: {
  icon: React.ElementType<any>;
  title: string;
  count?: number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {(React.createElement as any)(Icon, { className: `w-4 h-4 text-${color}-400` })}
      <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-200">{title}</h3>
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

function MultiSegmentBar({
  segments,
}: {
  segments: { label: string; value: number; pct: number; color: string }[];
}) {
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
            <div
              className="w-2 h-2 rounded-sm flex-shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">
              {s.label}
            </span>
            <span className="text-[9px] font-black text-white">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Per-inspection-type accent colour palette (cycles through 10 hues)
const COMPONENT_TYPE_FULL_NAMES: Record<string, string> = {
  "RS": "Riser",
  "CD": "Conductor",
  "CA": "Caisson",
  "RG": "Riser Guard",
  "BL": "Boat Landing",
  "BO": "Boat Landing",
  "AN": "Anode",
  "SD": "Seabed Debris",
  "LG": "Leg",
  "LEG": "Leg",
  "MB": "Member",
  "PL": "Pipeline",
  "SH": "Sheave",
  "CP": "Cathodic Protection",
  "CL": "Clamp",
  "CS": "Conductor Support",
  "CF": "Conductor Guide Frame",
  "FD": "Fender",
  "HD": "Horizontal Diagonal Member",
  "HM": "Horizontal Member",
  "VM": "Vertical Member",
  "VD": "Vertical Diagonal Member",
  "IT": "Item / Appurtenance",
  "WN": "Weld Node",
  "WP": "Support Weld",
  "CU": "Conductor Guide",
  "SG": "Safety Gate",
  "BB": "Boat Bumper",
  "BR": "Bracing",
  "DK": "Deck",
  "FW": "Fairlead",
  "FWD": "Fairlead",
  "JK": "Jacket",
  "ST": "Stiffener",
  "TR": "Truss",
  "WB": "Wellhead"
};

function formatComponentTypeName(code: string): string {
  if (!code) return "Other";
  const uc = code.toUpperCase().trim();
  return COMPONENT_TYPE_FULL_NAMES[uc] || code;
}

const INSPECTION_TYPE_NAMES: Record<string, string> = {
  "BSINS": "Bolted Support Inspection (Diving)",
  "CLEAN": "Cleaning Inspection",
  "CPSURV": "CP Survey / Cathodic Protection",
  "CVINS": "Close Visual Inspection (Diving)",
  "RCASN": "Caisson Inspection (ROV)",
  "DCASN": "Caisson Inspection (Diving)",
  "RGVI": "General Visual Inspection (ROV)",
  "DGVI": "General Visual Inspection (Diving)",
  "RRISI": "Riser Inspection (ROV)",
  "DRISI": "Riser Inspection (Diving)",
  "UTWTK": "UT Wall Thickness Inspection",
  "DUTWT": "UT Wall Thickness Inspection (Diving)",
  "RUTWT": "UT Wall Thickness Inspection (ROV)",
  "RSZCI": "Splash Zone Close Visual Inspection (ROV)",
  "DSZCI": "Splash Zone Close Visual Inspection (Diving)",
  "SZONE": "Splash Zone Inspection",
  "RCOND": "Conductor Inspection (ROV)",
  "DCOND": "Conductor Inspection (Diving)",
  "RMGI": "Marine Growth Inspection (ROV)",
  "DMGI": "Marine Growth Inspection (Diving)",
  "RFMD": "Flooded Member Detection (ROV)",
  "DFMD": "Flooded Member Detection (Diving)",
  "RSCOR": "Scour Inspection (ROV)",
  "DSCOR": "Scour Inspection (Diving)",
  "RSWNI": "Structural Weld & Node Inspection (ROV)",
  "DSWNI": "Structural Weld & Node Inspection (Diving)",
  "RSANI": "Anode Inspection (ROV)",
  "ANMAIN": "Anode Maintenance Inspection",
  "CPCLB": "CP Contact / Stab Calibration",
  "UTCLB": "UT Thickness Calibration",
  "ACFMC": "ACFM Crack Inspection (Diving)",
  "PLCO": "Pipeline Crossing Inspection",
  "GVINS": "General Visual Inspection (Diving)",
  "MPINS": "Magnetic Particle Inspection (Diving)"
};

function formatInspectionTypeName(name: string | null | undefined): string {
  if (!name) return "";
  const uc = name.toUpperCase().trim();
  if (INSPECTION_TYPE_NAMES[uc]) return INSPECTION_TYPE_NAMES[uc];
  
  // 1. Fix common mislabeled UT names (casing)
  let formatted = name.replace(/\bUt\b/g, "UT");
  
  // 2. Normalize "UT Thickness" to "UT Wall Thickness"
  if (formatted === "UT Thickness") return "UT Wall Thickness";
  
  // 3. Remove "ROV " or "DIVING " prefixes if it's for UT Wall Thickness
  if (formatted.includes("UT Wall Thickness")) {
    formatted = formatted.replace(/^(ROV|DIVING)\s+/, "");
  }
  
  return formatted;
}

const TYPE_ACCENT_PALETTE = [
  {
    bg: "rgba(59,130,246,0.12)",
    border: "rgba(59,130,246,0.30)",
    text: "#60a5fa",
    codeBg: "rgba(59,130,246,0.20)",
  }, // blue
  {
    bg: "rgba(20,184,166,0.12)",
    border: "rgba(20,184,166,0.30)",
    text: "#2dd4bf",
    codeBg: "rgba(20,184,166,0.20)",
  }, // teal
  {
    bg: "rgba(168,85,247,0.12)",
    border: "rgba(168,85,247,0.30)",
    text: "#c084fc",
    codeBg: "rgba(168,85,247,0.20)",
  }, // violet
  {
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.30)",
    text: "#4ade80",
    codeBg: "rgba(34,197,94,0.20)",
  }, // green
  {
    bg: "rgba(249,115,22,0.12)",
    border: "rgba(249,115,22,0.30)",
    text: "#fb923c",
    codeBg: "rgba(249,115,22,0.20)",
  }, // orange
  {
    bg: "rgba(234,179,8,0.12)",
    border: "rgba(234,179,8,0.30)",
    text: "#facc15",
    codeBg: "rgba(234,179,8,0.20)",
  }, // yellow
  {
    bg: "rgba(236,72,153,0.12)",
    border: "rgba(236,72,153,0.30)",
    text: "#f472b6",
    codeBg: "rgba(236,72,153,0.20)",
  }, // pink
  {
    bg: "rgba(99,102,241,0.12)",
    border: "rgba(99,102,241,0.30)",
    text: "#818cf8",
    codeBg: "rgba(99,102,241,0.20)",
  }, // indigo
  {
    bg: "rgba(6,182,212,0.12)",
    border: "rgba(6,182,212,0.30)",
    text: "#22d3ee",
    codeBg: "rgba(6,182,212,0.20)",
  }, // cyan
  {
    bg: "rgba(132,204,22,0.12)",
    border: "rgba(132,204,22,0.30)",
    text: "#a3e635",
    codeBg: "rgba(132,204,22,0.20)",
  }, // lime
];

function InspTypeCard({
  code,
  name,
  count,
  rov,
  dive,
  anomaly,
  finding,
  colorIndex,
  componentsData,
}: {
  code: string;
  name: string;
  count: number;
  rov: number;
  dive: number;
  anomaly: number;
  finding: number;
  colorIndex: number;
  componentsData?: Record<string, Record<string, {
    completed: number;
    incomplete: number;
    anomaly: number;
    pending: number;
    total: number;
  }>>;
}) {
  const accent = TYPE_ACCENT_PALETTE[colorIndex % TYPE_ACCENT_PALETTE.length];
  const hasAlert = anomaly > 0 || finding > 0;
  const modeStr = [rov > 0 && "ROV", dive > 0 && "Diving"].filter(Boolean).join(" & ");

  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedCompTypes, setExpandedCompTypes] = useState<Record<string, boolean>>({});

  return (
    <div
      className="rounded-lg border transition-all overflow-hidden"
      style={{
        background: accent.bg,
        borderColor: hasAlert ? "rgba(239,68,68,0.45)" : accent.border,
        boxShadow: hasAlert ? "0 0 0 1px rgba(239,68,68,0.12)" : undefined,
      }}
    >
      {/* Level 1 Header (Inspection Type) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-slate-900/40 transition-colors text-left"
      >
        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
        <span className="text-[13px] font-semibold text-slate-200 flex-1 truncate">
          {formatInspectionTypeName(name)}{" "}
          <span className="text-slate-300 font-medium ml-1">({modeStr})</span>
        </span>

        {/* Anomaly badge — only when > 0 */}
        {anomaly > 0 && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded flex-shrink-0"
            style={{
              background: "rgba(239,68,68,0.18)",
              color: "#f87171",
              border: "1px solid rgba(239,68,68,0.40)",
            }}
          >
            <svg viewBox="0 0 12 12" className="w-2 h-2 flex-shrink-0" fill="currentColor">
              <path d="M6 1L11 10H1L6 1z" />
            </svg>
            {anomaly}
          </span>
        )}

        {/* Finding badge — only when > 0 */}
        {finding > 0 && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded flex-shrink-0"
            style={{
              background: "rgba(168,85,247,0.18)",
              color: "#c084fc",
              border: "1px solid rgba(168,85,247,0.40)",
            }}
          >
            <svg viewBox="0 0 12 12" className="w-2 h-2 flex-shrink-0" fill="currentColor">
              <circle cx="6" cy="6" r="5" />
            </svg>
            {finding}
          </span>
        )}

        {/* Total count */}
        <span
          className="text-lg font-black flex-shrink-0 min-w-[20px] text-right ml-2"
          style={{ color: accent.text }}
        >
          {count}
        </span>
      </button>

      {/* Level 2 (Component Types under Inspection Type) */}
      {isExpanded && componentsData && Object.keys(componentsData).length > 0 && (
        <div className="border-t border-slate-800/60 bg-slate-950/40 p-2.5 space-y-2">
          {Object.entries(componentsData).map(([compType, qids]) => {
            const isCompExpanded = !!expandedCompTypes[compType];

            // Calculate split counts for component type level
            let compCompleted = 0;
            let compIncomplete = 0;
            let compAnomaly = 0;
            let compPending = 0;
            let compTotal = 0;

            Object.values(qids).forEach(q => {
              compCompleted += q.completed;
              compIncomplete += q.incomplete;
              compAnomaly += q.anomaly;
              compPending += q.pending;
              compTotal += q.total;
            });

            return (
              <div key={compType} className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/30">
                <button
                  onClick={() => setExpandedCompTypes(prev => ({ ...prev, [compType]: !prev[compType] }))}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-800/40 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isCompExpanded ? "rotate-90" : ""}`} />
                    <span className="text-[11px] font-black uppercase text-slate-300">
                      {formatComponentTypeName(compType)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {compCompleted > 0 && (
                      <span className="text-[8px] font-bold bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded">
                        ✓ {compCompleted}
                      </span>
                    )}
                    {compIncomplete > 0 && (
                      <span className="text-[8px] font-bold bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded">
                        ⚠ {compIncomplete}
                      </span>
                    )}
                    {compAnomaly > 0 && (
                      <span className="text-[8px] font-bold bg-red-500/10 text-red-400 px-1 py-0.5 rounded">
                        ▲ {compAnomaly}
                      </span>
                    )}
                    {compPending > 0 && (
                      <span className="text-[8px] font-bold bg-slate-700/30 text-slate-400 px-1 py-0.5 rounded">
                        … {compPending}
                      </span>
                    )}
                    <Badge variant="secondary" className="text-[9px] font-black h-4 px-1 bg-slate-800 text-slate-400">
                      {compTotal}
                    </Badge>
                  </div>
                </button>

                {/* Level 3 (QIDs under Component Type) */}
                {isCompExpanded && (
                  <div className="border-t border-slate-800/40 bg-slate-950/60 divide-y divide-slate-900/40 px-2.5 py-1.5 space-y-1.5">
                    {Object.entries(qids).map(([qid, qidData]) => (
                      <div key={qid} className="flex flex-col sm:flex-row sm:items-center justify-between py-1.5 gap-2.5">
                        <span className="text-[10.5px] font-bold text-slate-200 font-mono pl-5">
                          {qid}
                        </span>

                        <div className="flex flex-wrap gap-1 pl-5 sm:pl-0">
                          {qidData.completed > 0 && (
                            <Badge className="text-[8.5px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                              Complete: {qidData.completed}
                            </Badge>
                          )}
                          {qidData.incomplete > 0 && (
                            <Badge className="text-[8.5px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded">
                              Incomplete: {qidData.incomplete}
                            </Badge>
                          )}
                          {qidData.anomaly > 0 && (
                            <Badge className="text-[8.5px] font-black bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded">
                              Anomaly: {qidData.anomaly}
                            </Badge>
                          )}
                          {qidData.pending > 0 && (
                            <Badge className="text-[8.5px] font-black bg-slate-700/30 text-slate-400 border border-slate-700/30 px-1.5 py-0.5 rounded">
                              Pending: {qidData.pending}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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
  isPipeline = false,
}: InspectionSummaryPanelProps) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("all");
  const [expandedCompTypes, setExpandedCompTypes] = useState<Record<string, boolean>>({});
  const [expandedQIDs, setExpandedQIDs] = useState<Record<string, boolean>>({});
  const [expandedCpTypes, setExpandedCpTypes] = useState<Record<string, boolean>>({});
  const [expandedCpQIDs, setExpandedCpQIDs] = useState<Record<string, boolean>>({});
  const [expandedDefectTypes, setExpandedDefectTypes] = useState<Record<string, boolean>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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
    setActiveSection("all");
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
  const pipelineSummary = (data as any)?.pipelineSummary;
  const isPipelineMode =
    isPipeline ||
    !!pipelineSummary?.isPipeline ||
    headerData.jobType?.toLowerCase().includes("pipeline") ||
    headerData.platformName?.toLowerCase().includes("pipe");

  const handlePrintPipelineSummary = () => {
    const ps = pipelineSummary || {};
    const printWin = window.open("", "_blank");
    if (!printWin) return;

    const fromLoc = ps.fromLocation !== "N/A" ? ps.fromLocation : (headerData.platformName.includes("-") ? headerData.platformName.split("-")[0] : "N/A");
    const toLoc = ps.toLocation !== "N/A" ? ps.toLocation : (headerData.platformName.includes("-") ? headerData.platformName.split("-")[1] : "N/A");

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>PIPELINE INSPECTION SUMMARY REPORT - ${ps.pipelineName || headerData.platformName}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 15mm 15mm 15mm;
            }
            body {
              font-family: "Segoe UI", Arial, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 0;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
            }
            .report-container {
              width: 100%;
              max-width: 800px;
              margin: 0 auto;
              padding: 0;
            }
            
            /* Executive Corporate Header */
            .doc-header {
              border-bottom: 3px solid #0284c7;
              padding-bottom: 12px;
              margin-bottom: 16px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .doc-title {
              font-size: 20px;
              font-weight: 800;
              color: #0369a1;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin: 0;
            }
            .doc-subtitle {
              font-size: 11px;
              font-weight: 600;
              color: #475569;
              margin-top: 4px;
            }
            .meta-block {
              text-align: right;
              font-size: 10px;
              color: #64748b;
              line-height: 1.4;
            }
            .meta-block b { color: #0f172a; }

            /* Spec & Progress Summary Grid */
            .section-title {
              font-size: 12px;
              font-weight: 800;
              text-transform: uppercase;
              color: #0f172a;
              border-bottom: 1.5px solid #cbd5e1;
              padding-bottom: 4px;
              margin: 16px 0 10px 0;
              letter-spacing: 0.5px;
            }
            
            .spec-banner {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-left: 4px solid #0284c7;
              border-radius: 6px;
              padding: 10px 14px;
              margin-bottom: 14px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 11px;
            }
            .spec-banner .pipe-name { font-size: 16px; font-weight: 800; color: #0284c7; }
            .spec-banner .pipe-locs { color: #475569; font-weight: 600; }

            .summary-grid {
              display: grid;
              grid-template-cols: 1fr 1fr;
              gap: 14px;
              margin-bottom: 16px;
            }
            .summary-card {
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              background: #ffffff;
              overflow: hidden;
            }
            .summary-card-header {
              background: #f1f5f9;
              padding: 6px 12px;
              font-size: 11px;
              font-weight: 700;
              color: #1e293b;
              border-bottom: 1px solid #e2e8f0;
              text-transform: uppercase;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              font-size: 10.5px;
              padding: 5px 12px;
              border-bottom: 1px dashed #f1f5f9;
            }
            .summary-row:last-child { border-bottom: none; }
            .summary-label { color: #475569; }
            .summary-val { font-weight: 700; color: #0f172a; font-family: monospace; }

            /* Detailed Tables */
            table.report-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
              font-size: 10px;
            }
            table.report-table th {
              background: #0f172a;
              color: #ffffff;
              text-transform: uppercase;
              padding: 7px 8px;
              text-align: left;
              font-size: 9px;
              font-weight: 700;
              border: 1px solid #0f172a;
            }
            table.report-table td {
              border: 1px solid #e2e8f0;
              padding: 6px 8px;
              color: #334155;
            }
            table.report-table tr:nth-child(even) td {
              background: #f8fafc;
            }

            /* Priority Badges */
            .prio-badge {
              display: inline-block;
              padding: 2px 6px;
              border-radius: 4px;
              font-weight: 800;
              font-size: 9px;
              text-align: center;
            }
            .prio-p1 { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
            .prio-p2 { background: #ffedd5; color: #9a3412; border: 1px solid #fdba74; }
            .prio-p3 { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }

            /* Footer Section */
            .doc-footer {
              margin-top: 30px;
              padding-top: 12px;
              border-top: 1.5px solid #cbd5e1;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 9px;
              color: #64748b;
            }
            .signatures {
              margin-top: 40px;
              display: grid;
              grid-template-cols: 1fr 1fr 1fr;
              gap: 20px;
              text-align: center;
              font-size: 10px;
            }
            .sig-line {
              border-top: 1px solid #94a3b8;
              margin-top: 35px;
              padding-top: 4px;
              font-weight: 600;
              color: #334155;
            }

            @media print {
              .no-print { display: none !important; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="report-container">
            <!-- Action Toolbar (Hidden during print) -->
            <div class="no-print" style="margin-bottom: 16px; text-align: right;">
              <button onclick="window.print()" style="padding: 8px 18px; background: #0284c7; color: white; border: none; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; shadow: 0 2px 4px rgba(0,0,0,0.1);">
                🖨️ Print Inspection Report
              </button>
            </div>

            <!-- Corporate Header Block -->
            <div class="doc-header">
              <div>
                <h1 class="doc-title">Pipeline Inspection Summary Report</h1>
                <div class="doc-subtitle">Subsea Structural & Pipeline Integrity Engineering</div>
              </div>
              <div class="meta-block">
                <div><b>Jobpack / Asset:</b> ${headerData.jobpackName || "OFFSHORE PIPELINE"}</div>
                <div><b>Report No:</b> ${headerData.sowReportNo || "N/A"}</div>
                <div><b>Date Generated:</b> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</div>
              </div>
            </div>

            <!-- Pipeline Specification Banner -->
            <div class="spec-banner">
              <div>
                <div class="pipe-name">${ps.pipelineName || headerData.platformName} (${ps.pipelineCode || "PL"})</div>
                <div class="pipe-locs">From Location: <b>${fromLoc}</b> &nbsp;|&nbsp; To Location: <b>${toLoc}</b></div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Spec Length</div>
                <div style="font-size: 15px; font-weight: 800; color: #0284c7; font-family: monospace;">${(ps.totalLength || 0).toFixed(3)} km</div>
              </div>
            </div>

            <!-- Inspection Progress Overview -->
            <div class="section-title">1. Survey Progress & Execution Metrics</div>
            <div class="summary-grid">
              <div class="summary-card">
                <div class="summary-card-header">Progress & Distance Metrics</div>
                <div class="summary-row"><span class="summary-label">Survey Flow Direction:</span><span class="summary-val">${ps.isDecreaseFlow ? "Reverse (Decrease KP)" : "Forward (Increase KP)"}</span></div>
                <div class="summary-row"><span class="summary-label">Gross Inspected KP:</span><span class="summary-val">${(ps.surveyedLengthKm || 0).toFixed(3)} km</span></div>
                <div class="summary-row"><span class="summary-label">Total Skipped Length:</span><span class="summary-val">${(ps.totalSkippedKm || 0).toFixed(3)} km</span></div>
                <div class="summary-row"><span class="summary-label">Net Completed Length:</span><span class="summary-val">${(ps.netCompletedLengthKm || 0).toFixed(3)} km</span></div>
                <div class="summary-row"><span class="summary-label">Overall Completion:</span><span class="summary-val" style="color:#0284c7;">${Math.round(ps.completionPct || 0)}%</span></div>
              </div>

              <div class="summary-card">
                <div class="summary-card-header">Seabed Profile & Coverage</div>
                <div class="summary-row"><span class="summary-label">Line Start KP:</span><span class="summary-val">${(ps.lineStartKp || 0).toFixed(3)} km</span></div>
                <div class="summary-row"><span class="summary-label">Line End KP:</span><span class="summary-val">${(ps.lineEndKp || 0).toFixed(3)} km</span></div>
                <div class="summary-row"><span class="summary-label">Total Span Distance:</span><span class="summary-val">${(ps.totalSpanKm || 0).toFixed(4)} km (${(ps.totalPctSpan || 0).toFixed(2)}%)</span></div>
                <div class="summary-row"><span class="summary-label">Total Burial Distance:</span><span class="summary-val">${(ps.totalBurialKm || 0).toFixed(4)} km (${(ps.totalPctBurial || 0).toFixed(2)}%)</span></div>
                <div class="summary-row"><span class="summary-label">Burial Depth Avg:</span><span class="summary-val">${ps.burialDepth || 0}</span></div>
              </div>
            </div>

            <!-- Pipeline Features Counter Grid -->
            <div class="section-title">2. Subsea Survey Features Counter</div>
            <div class="summary-grid">
              <div class="summary-card">
                <div class="summary-card-header">Features Breakdown</div>
                <div class="summary-row"><span class="summary-label">Total Anodes:</span><span class="summary-val">${ps.totalAnodes || 0}</span></div>
                <div class="summary-row"><span class="summary-label">Total Field Joints:</span><span class="summary-val">${ps.totalFieldJoints || 0}</span></div>
                <div class="summary-row"><span class="summary-label">Total Free Spans #:</span><span class="summary-val">${ps.totalSpanCount || 0}</span></div>
                <div class="summary-row"><span class="summary-label">Total Burial Events #:</span><span class="summary-val">${ps.totalBurialCount || 0}</span></div>
                <div class="summary-row"><span class="summary-label">Total Pipeline Crossings:</span><span class="summary-val">${ps.totalLineCrossing || 0}</span></div>
                <div class="summary-row"><span class="summary-label">Total Debris Items:</span><span class="summary-val">${ps.totalDebris || 0}</span></div>
              </div>

              <div class="summary-card">
                <div class="summary-card-header">CP Stab Distribution</div>
                <div class="summary-row"><span class="summary-label">Total CP Stabs:</span><span class="summary-val">${ps.totalCpStab || 0}</span></div>
                <div class="summary-row"><span class="summary-label">Anode CP Stabs:</span><span class="summary-val">${ps.totalAnodeCpStab || 0}</span></div>
                <div class="summary-row"><span class="summary-label">Field Joint CP Stabs:</span><span class="summary-val">${ps.totalFjCpStab || 0}</span></div>
                <div class="summary-row"><span class="summary-label">Line CP Stabs:</span><span class="summary-val">${ps.totalLineCpStab || 0}</span></div>
                <div class="summary-row"><span class="summary-label">Flange CP Stabs:</span><span class="summary-val">${ps.totalFlangeCpStab || 0}</span></div>
                <div class="summary-row"><span class="summary-label">Other CP Stabs:</span><span class="summary-val">${ps.totalOtherCpStab || 0}</span></div>
              </div>
            </div>

            <!-- Anomalies & Findings Section -->
            <div class="section-title">3. Recorded Anomalies & Findings Log (${ps.totalAnomaly || anomalies?.total || 0})</div>
            <table class="report-table">
              <thead>
                <tr>
                  <th style="width: 25px;">#</th>
                  <th style="width: 100px;">Defect Category</th>
                  <th>Component QID</th>
                  <th>Inspection Type</th>
                </tr>
              </thead>
              <tbody>
                ${
                  (() => {
                    const defectDetails = anomalies?.defectTypeDetails || {};
                    const rows: string[] = [];
                    let idx = 1;
                    Object.entries(defectDetails).forEach(([code, list]) => {
                      (list || []).forEach((item) => {
                        rows.push(`
                          <tr>
                            <td>${idx++}</td>
                            <td><b>${code}</b></td>
                            <td>${item.qid || 'N/A'}</td>
                            <td>${item.inspectionTypeName || 'N/A'}</td>
                          </tr>
                        `);
                      });
                    });
                    return rows.length > 0
                      ? rows.join('')
                      : '<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 12px;">No structural anomalies recorded for this pipeline survey.</td></tr>';
                  })()
                }
              </tbody>
            </table>

            <!-- Signatures Block -->
            <div class="signatures">
              <div>
                <div class="sig-line">Inspected By (ROV / Diver Lead)</div>
              </div>
              <div>
                <div class="sig-line">Reviewed By (Senior Inspector)</div>
              </div>
              <div>
                <div class="sig-line">Approved By (Client Representative)</div>
              </div>
            </div>

            <!-- Report Footer -->
            <div class="doc-footer">
              <div>Offshore Subsea Asset Management System &nbsp;|&nbsp; Confidential</div>
              <div>Page 1 of 1</div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  const navSections = [
    { id: "all", label: "All Summary" },
    { id: "pipeline", label: "Pipeline Structure Summary", show: isPipelineMode },
    { id: "pipeline-anomalies", label: "Pipeline Anomalies & Findings", show: isPipelineMode },
    { id: "sow", label: "Scope of Work", show: !isPipelineMode && !!sow },
    { id: "components", label: "Component Breakdown", show: !isPipelineMode && !!data?.componentSummary },
    { id: "overview", label: "Inspection Overview", show: !isPipelineMode && !!records },
    { id: "fmd", label: "FMD Details", show: !isPipelineMode && !!(fmd && fmd.total > 0) },
    { id: "anode", label: "Anode Inspection", show: !isPipelineMode && !!(anodeGvi && anodeGvi.total > 0) },
    {
      id: "cp",
      label: "CP Readings",
      show: !isPipelineMode && !!(cp && (cp.primaryCount > 0 || cp.additionalCount > 0)),
    },
    { id: "anomalies", label: "Anomaly Breakdown", show: !isPipelineMode && !!(anomalies && anomalies.total > 0) },
    { id: "findings", label: "Findings Breakdown", show: !isPipelineMode && !!(findings && findings.total > 0) },
    { id: "attachments", label: "Attachment Groups", show: !isPipelineMode && !!attachmentGroups },
  ].filter((s) => s.show !== false);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    if (id === "all") {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = document.getElementById(`summary-sec-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

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
                <h2 className="text-sm font-black uppercase tracking-[0.15em] text-white">
                  Inspection Summary
                </h2>
                <div className="text-[10px] font-bold text-slate-300 tracking-wider">
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
              onClick={() => {
                if (isPipelineMode) {
                  handlePrintPipelineSummary();
                } else {
                  window.dispatchEvent(new CustomEvent("open-platform-summary-report"));
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 border border-cyan-500/50 text-white hover:from-cyan-500 hover:to-blue-500 transition-all text-xs font-black shadow-md shadow-cyan-900/40"
              title="Print Platform Summary Report (Preview & Export PDF)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Report</span>
            </button>
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
        <div className="px-6 py-1.5 bg-slate-900/70 border-b border-slate-800/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-500">
              Live Dashboard
            </span>
            <span className="text-[9px] text-slate-500 mx-1">·</span>
            <span className="text-[9px] text-slate-400 hidden sm:inline">Auto-refreshes 30s</span>
          </div>
          {loading && (
            <span className="text-[9px] text-blue-400 font-bold animate-pulse">Refreshing...</span>
          )}
        </div>

        {/* ── Navigation List Box ── */}
        <div className="px-6 py-3 bg-slate-900/40 border-b border-slate-800/50 flex items-center justify-between shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
              Go to Section
            </span>
          </div>
          <Select value={activeSection} onValueChange={scrollToSection}>
            <SelectTrigger className="w-[180px] h-8 bg-slate-800/50 border-slate-700/50 text-[11px] font-bold text-slate-200 rounded-lg focus:ring-0 focus:ring-offset-0">
              <SelectValue placeholder="Select Section" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
              {navSections.map((s) => (
                <SelectItem
                  key={s.id}
                  value={s.id}
                  className="text-[11px] font-bold focus:bg-blue-600/20 focus:text-blue-400"
                >
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── Scrollable Content ── */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-7 custom-scrollbar"
        >
          {/* ═══ PIPELINE STRUCTURE SUMMARY SECTION (MATCHING PIC-2 & PIC-1) ═════ */}
          {isPipelineMode && (
            <section id="summary-sec-pipeline" className="space-y-4">
              <SectionHeader icon={Compass} title="Pipeline Structure Inspection Summary" color="cyan" />

              {/* Pipeline Header Banner (Pic-2 Style: SKGPL426 Length: 8.11 From: AJJT-A To: KAKG-A) */}
              <div className="bg-[#0b1829] border border-cyan-500/30 rounded-xl p-4 shadow-lg flex flex-wrap justify-between items-center gap-3">
                <div>
                  <div className="text-xl font-black text-white tracking-wide flex items-center gap-2">
                    <span>{pipelineSummary?.pipelineName || headerData.platformName}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-700/50 font-mono">
                      {pipelineSummary?.pipelineCode || "PL"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 font-medium mt-1 flex items-center gap-4">
                    <span>
                      <b>From:</b>{" "}
                      {pipelineSummary?.fromLocation && pipelineSummary.fromLocation !== "N/A"
                        ? pipelineSummary.fromLocation
                        : headerData.platformName.includes("-")
                        ? headerData.platformName.split("-")[0]
                        : "N/A"}
                    </span>
                    <span>
                      <b>To:</b>{" "}
                      {pipelineSummary?.toLocation && pipelineSummary.toLocation !== "N/A"
                        ? pipelineSummary.toLocation
                        : headerData.platformName.includes("-")
                        ? headerData.platformName.split("-")[1]
                        : "N/A"}
                    </span>
                  </div>
                </div>
                <div className="text-right bg-cyan-950/60 border border-cyan-500/20 px-3.5 py-1.5 rounded-lg">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Pipeline Length</div>
                  <div className="text-lg font-black text-cyan-400 font-mono">
                    {loading && !pipelineSummary
                      ? "..."
                      : `${(pipelineSummary?.totalLength || 0).toFixed(3)} km`}
                  </div>
                </div>
              </div>

              {/* PIPELINE INSPECTION PROGRESS CARD */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 shadow-md">
                <div className="flex items-center gap-6 mb-4">
                  <div className="relative flex-shrink-0">
                    <RingChart pct={Math.round(pipelineSummary?.completionPct || 0)} color="#06b6d4" size={100} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-white leading-none">
                        {loading && !pipelineSummary ? "..." : `${Math.round(pipelineSummary?.completionPct || 0)}%`}
                      </span>
                      <span className="text-[8px] font-bold text-cyan-400 uppercase tracking-wider">
                        Progress
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 text-center">
                      <div className="text-xl font-black text-cyan-400 font-mono">
                        {loading && !pipelineSummary ? "..." : `${(pipelineSummary?.netCompletedLengthKm || 0).toFixed(3)} km`}
                      </div>
                      <div className="text-[9px] font-bold text-cyan-500 uppercase tracking-wider mt-0.5">
                        Net Completed
                      </div>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                      <div className="text-xl font-black text-amber-400 font-mono">
                        {loading && !pipelineSummary ? "..." : `${(pipelineSummary?.totalSkippedKm || 0).toFixed(3)} km`}
                      </div>
                      <div className="text-[9px] font-bold text-amber-500 uppercase tracking-wider mt-0.5">
                        Skipped (Incomplete)
                      </div>
                    </div>

                    <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-3 text-center">
                      <div className="text-xl font-black text-slate-300 font-mono">
                        {loading && !pipelineSummary
                          ? "..."
                          : `${Math.max(
                              0,
                              (pipelineSummary?.totalLength || 0) - (pipelineSummary?.surveyedLengthKm || 0)
                            ).toFixed(3)} km`}
                      </div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                        Remaining
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-700/40">
                  <span>
                    Flow Direction:{" "}
                    <b className="text-cyan-300">
                      {pipelineSummary?.isDecreaseFlow ? "Reverse (Decrease KP)" : "Forward (Increase KP)"}
                    </b>
                  </span>
                  <span>
                    Gross Surveyed:{" "}
                    <b className="text-slate-200">
                      {loading && !pipelineSummary ? "..." : `${(pipelineSummary?.surveyedLengthKm || 0).toFixed(3)} km`}
                    </b>
                  </span>
                </div>
              </div>

              {/* Inspection Summary List Card (Exact pic-2 specifications) */}
              <div className="bg-[#0a1320] border border-slate-700/60 rounded-xl p-4 font-mono text-xs text-slate-200 space-y-1.5 shadow-inner">
                <div className="text-sm font-bold text-sky-400 font-sans border-b border-slate-700/80 pb-1.5 mb-2 flex justify-between items-center">
                  <span>Inspection Summary</span>
                  <span className="text-[10px] text-slate-400 font-normal">Real-Time Survey Counters</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total Anodes:</span>
                    <span className="font-bold text-cyan-400">{pipelineSummary?.totalAnodes || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total Field Joints:</span>
                    <span className="font-bold text-cyan-400">{pipelineSummary?.totalFieldJoints || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total Span#:</span>
                    <span className="font-bold text-cyan-400">{pipelineSummary?.totalSpanCount || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total Burial#:</span>
                    <span className="font-bold text-cyan-400">{pipelineSummary?.totalBurialCount || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Burial Depth:</span>
                    <span className="font-bold text-slate-400">{pipelineSummary?.burialDepth || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total CP Stab:</span>
                    <span className="font-bold text-cyan-400">{pipelineSummary?.totalCpStab || 0} (0)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total Anode CP Stab:</span>
                    <span className="font-bold text-cyan-400">{pipelineSummary?.totalAnodeCpStab || 0} (0)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total FJ CP Stab:</span>
                    <span className="font-bold text-slate-400">{pipelineSummary?.totalFjCpStab || 0} (0)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total Line CP Stab:</span>
                    <span className="font-bold text-cyan-400">{pipelineSummary?.totalLineCpStab || 0} (0)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total Flange CP Stab:</span>
                    <span className="font-bold text-slate-400">{pipelineSummary?.totalFlangeCpStab || 0} (0)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total Other CP Stab:</span>
                    <span className="font-bold text-cyan-400">{pipelineSummary?.totalOtherCpStab || 0} (0)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total Line Crossing:</span>
                    <span className="font-bold text-cyan-400">{pipelineSummary?.totalLineCrossing || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total Debris:</span>
                    <span className="font-bold text-cyan-400">{pipelineSummary?.totalDebris || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total Anomaly:</span>
                    <span className="font-bold text-red-400">{pipelineSummary?.totalAnomaly || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total Rectified:</span>
                    <span className="font-bold text-emerald-400">{pipelineSummary?.totalRectified || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Line Start@:</span>
                    <span className="font-bold text-cyan-400">{(pipelineSummary?.lineStartKp || 0).toFixed(3)}km</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Line End@:</span>
                    <span className="font-bold text-cyan-400">{(pipelineSummary?.lineEndKp || 0).toFixed(3)}km</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Line Skipped#:</span>
                    <span className="font-bold text-slate-400">{pipelineSummary?.lineSkippedCount || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total Skipped (Km):</span>
                    <span className="font-bold text-slate-400">{(pipelineSummary?.totalSkippedKm || 0).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total Span@0-5KM:</span>
                    <span className="font-bold text-cyan-400">{pipelineSummary?.span0_5 || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total Span@5-10KM:</span>
                    <span className="font-bold text-cyan-400">{pipelineSummary?.span5_10 || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total Span@10-20KM:</span>
                    <span className="font-bold text-slate-400">{pipelineSummary?.span10_20 || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total Span@20-30KM:</span>
                    <span className="font-bold text-slate-400">{pipelineSummary?.span20_30 || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total Span@30-40KM:</span>
                    <span className="font-bold text-slate-400">{pipelineSummary?.span30_40 || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total Span@40---KM:</span>
                    <span className="font-bold text-slate-400">{pipelineSummary?.span40_plus || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total Span (Km):</span>
                    <span className="font-bold text-cyan-400">{(pipelineSummary?.totalSpanKm || 0).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total % Span:</span>
                    <span className="font-bold text-cyan-400">{(pipelineSummary?.totalPctSpan || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total Burial (Km):</span>
                    <span className="font-bold text-cyan-400">{(pipelineSummary?.totalBurialKm || 0).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Total % Burial:</span>
                    <span className="font-bold text-cyan-400">{(pipelineSummary?.totalPctBurial || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </section>
          )}
          {/* ═══ SECTION 1: SOW COMPLETION ═══════════════════════════════════════ */}
          {!isPipelineMode && (
            <section id="summary-sec-sow">
              <SectionHeader icon={Target} title="Scope of Work Completion" color="blue" />

            {/* Big completion ring + stats */}
            <div className="bg-slate-800/30 border border-slate-700/40 rounded-2xl p-5">
              <div className="flex items-center gap-6 mb-5">
                {/* Ring */}
                <div className="relative flex-shrink-0">
                  <RingChart pct={sow?.completionPct ?? 0} color="#3b82f6" size={100} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-white leading-none">
                      {sow?.completionPct ?? 0}%
                    </span>
                    <span className="text-[8px] font-bold text-blue-400 uppercase tracking-wider">
                      Progress
                    </span>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                    <div className="text-2xl font-black text-emerald-400">
                      {sow?.completed ?? 0}
                    </div>
                    <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider mt-0.5">
                      Complete
                    </div>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                    <div className="text-2xl font-black text-amber-400">{sow?.incomplete ?? 0}</div>
                    <div className="text-[9px] font-bold text-amber-500 uppercase tracking-wider mt-0.5">
                      Incomplete
                    </div>
                  </div>
                  <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-3 text-center">
                    <div className="text-2xl font-black text-slate-400">{sow?.pending ?? 0}</div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                      Pending
                    </div>
                  </div>
                </div>
              </div>

              {/* Multi-segment bar */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                    Overall Progress
                  </span>
                  <span className="text-[9px] font-black text-white">
                    {sow?.total ?? 0} Total Items
                  </span>
                </div>
                <MultiSegmentBar segments={sowSegments} />
              </div>

              {/* Overall percentage breakdown */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-slate-900/60 rounded-xl p-3 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold">
                      Complete + Incomplete
                    </div>
                    <div className="text-lg font-black text-white">{sow?.completionPct ?? 0}%</div>
                    <div className="text-[9px] text-slate-600">vs Pending SOW Items</div>
                  </div>
                </div>
                <div className="bg-slate-900/60 rounded-xl p-3 flex items-center gap-3">
                  <Clock className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold">
                      Pending (Not Started)
                    </div>
                    <div className="text-lg font-black text-slate-200">{sow?.pendingPct ?? 0}%</div>
                    <div className="text-[9px] text-slate-600">
                      {sow?.pending ?? 0} items remaining
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
          )}

          {/* ═══ SECTION: COMPONENT BREAKDOWN ═══════════════════════════════════ */}
          {!isPipelineMode && data?.componentSummary && Object.keys(data.componentSummary).length > 0 && (
            <section id="summary-sec-components">
              <SectionHeader icon={Layers} title="Component Breakdown" color="blue" />
              <div className="bg-slate-800/30 border border-slate-700/40 rounded-2xl p-4 space-y-3">
                {Object.entries(data.componentSummary).map(([compType, qids]) => {
                  const isCompExpanded = !!expandedCompTypes[compType];
                  const qidCount = Object.keys(qids).length;
                  const totalInspectionsForType = Object.values(qids).reduce((acc, q) => acc + q.totalRecords, 0);

                  return (
                    <div key={compType} className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
                      {/* Component Type Header (Level 1) */}
                      <button
                        onClick={() => setExpandedCompTypes(prev => ({ ...prev, [compType]: !prev[compType] }))}
                        className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/80 hover:bg-slate-800/60 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isCompExpanded ? "rotate-90" : ""}`} />
                          <span className="text-[12px] font-black uppercase tracking-wider text-white">
                            {formatComponentTypeName(compType)}
                          </span>
                          <Badge variant="secondary" className="text-[9px] font-bold h-4 px-1.5 bg-slate-800 text-slate-300">
                            {qidCount} QID{qidCount !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <div className="text-[11px] font-black text-blue-400">
                          {totalInspectionsForType} Inspection{totalInspectionsForType !== 1 ? "s" : ""}
                        </div>
                      </button>

                      {/* Pivot Table Format for Component QIDs */}
                      {isCompExpanded && (() => {
                        // Gather all unique inspection types present across QIDs for this component group
                        const allInspTypes = Array.from(new Set(
                          Object.values(qids).flatMap(q => Object.keys(q.inspectionTypes))
                        )).sort();

                        return (
                          <div className="border-t border-slate-800/80 bg-slate-950/60 overflow-x-auto p-3">
                            <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                              <thead>
                                <tr className="border-b border-slate-800 bg-slate-900/90 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                  <th className="py-2.5 px-3 rounded-tl-lg">Component QID</th>
                                  {allInspTypes.map(it => (
                                    <th
                                      key={it}
                                      className="py-2.5 px-3 text-center cursor-help transition-colors hover:text-cyan-300"
                                      title={`${it}: ${formatInspectionTypeName(it)}`}
                                    >
                                      {it}
                                    </th>
                                  ))}
                                  <th className="py-2.5 px-3 text-right rounded-tr-lg">Total Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/40">
                                {Object.entries(qids).map(([qid, qidData]) => {
                                  const totalCompl = Object.values(qidData.inspectionTypes).reduce((a, b) => a + b.completed, 0);
                                  const totalIncompl = Object.values(qidData.inspectionTypes).reduce((a, b) => a + b.incomplete, 0);
                                  const totalAnom = Object.values(qidData.inspectionTypes).reduce((a, b) => a + b.anomaly, 0);
                                  const totalPend = Object.values(qidData.inspectionTypes).reduce((a, b) => a + b.pending, 0);

                                  return (
                                    <tr key={qid} className="hover:bg-slate-900/50 transition-colors">
                                      {/* QID */}
                                      <td className="py-2 px-3 font-mono font-bold text-slate-200 text-[11px] whitespace-nowrap">
                                        {qid}
                                      </td>

                                      {/* Inspection Type Columns (Pivot Cells) */}
                                      {allInspTypes.map(it => {
                                        const counts = qidData.inspectionTypes[it];
                                        if (!counts) {
                                          return (
                                            <td key={it} className="py-2 px-3 text-center text-[10px] text-slate-600">
                                              -
                                            </td>
                                          );
                                        }

                                        const fullName = formatInspectionTypeName(it);

                                        return (
                                          <td key={it} className="py-2 px-3 text-center">
                                            <div className="flex items-center justify-center gap-1 flex-wrap">
                                              {counts.completed > 0 && (
                                                <Badge
                                                  title={`${fullName}: ${counts.completed} Completed Inspection(s)`}
                                                  className="text-[8.5px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0 cursor-help"
                                                >
                                                  ✓ {counts.completed}
                                                </Badge>
                                              )}
                                              {counts.incomplete > 0 && (
                                                <Badge
                                                  title={`${fullName}: ${counts.incomplete} Incomplete Inspection(s)`}
                                                  className="text-[8.5px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1.5 py-0 cursor-help"
                                                >
                                                  ⚠ {counts.incomplete}
                                                </Badge>
                                              )}
                                              {counts.anomaly > 0 && (
                                                <Badge
                                                  title={`${fullName}: ${counts.anomaly} Anomaly/Defect(s) Reported`}
                                                  className="text-[8.5px] font-bold bg-red-500/15 text-red-400 border border-red-500/30 px-1.5 py-0 cursor-help"
                                                >
                                                  ▲ {counts.anomaly}
                                                </Badge>
                                              )}
                                              {counts.pending > 0 && (
                                                <Badge
                                                  title={`${fullName}: ${counts.pending} Pending Task(s)`}
                                                  className="text-[8.5px] font-bold bg-slate-800 text-slate-400 border border-slate-700/50 px-1.5 py-0 cursor-help"
                                                >
                                                  … {counts.pending}
                                                </Badge>
                                              )}
                                              {counts.completed === 0 && counts.incomplete === 0 && counts.anomaly === 0 && counts.pending === 0 && (
                                                <span className="text-[10px] text-slate-600">-</span>
                                              )}
                                            </div>
                                          </td>
                                        );
                                      })}

                                      {/* Total Status Summary */}
                                      <td className="py-2 px-3 text-right whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-1">
                                          {qidData.totalRecords > 0 ? (
                                            <Badge className="text-[9px] font-black bg-blue-500/10 text-cyan-300 border border-blue-500/20 px-2 py-0.5">
                                              {qidData.totalRecords} Inspected
                                            </Badge>
                                          ) : (
                                            <Badge className="text-[9px] font-medium bg-slate-800/80 text-slate-400 border-none px-2 py-0.5">
                                              Pending
                                            </Badge>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ═══ SECTION 2: INSPECTION OVERVIEW ════════════════════════════════ */}
          {!isPipelineMode && (
            <section id="summary-sec-overview">
            <SectionHeader
              icon={Activity}
              title="Inspection Overview"
              color="cyan"
              count={records?.total}
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <StatCard
                icon={CheckCircle2}
                label="Complete Records"
                value={records?.completed ?? 0}
                color="green"
              />
              <StatCard
                icon={Clock}
                label="Incomplete"
                value={records?.incomplete ?? 0}
                color="amber"
              />
              <StatCard
                icon={AlertTriangle}
                label="Anomalies"
                value={records?.anomaly ?? 0}
                color="red"
                pulse={!!(records?.anomaly && records.anomaly > 0)}
              />
              <StatCard icon={Info} label="Findings" value={records?.finding ?? 0} color="violet" />
            </div>

            {/* Mode breakdown */}
            {hasBoth ? (
              <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-4 grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-[9px] font-black uppercase text-blue-400 tracking-wider mb-1">
                    ROV
                  </div>
                  <div className="text-2xl font-black text-blue-300">{records?.rovCount ?? 0}</div>
                  <div className="text-[9px] text-slate-500">
                    {records?.uniqueRovJobs ?? 0} Deployments
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <div className="text-[9px] font-black text-slate-500 tracking-wider">+</div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] font-black uppercase text-cyan-400 tracking-wider mb-1">
                    DIVING
                  </div>
                  <div className="text-2xl font-black text-cyan-300">{records?.diveCount ?? 0}</div>
                  <div className="text-[9px] text-slate-500">
                    {records?.uniqueDiveJobs ?? 0} Dives
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-3 flex items-center gap-3">
                <Shield className="w-4 h-4 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400">
                  {(records?.rovCount ?? 0) > 0 ? "ROV Only" : "Diving Only"} ·{" "}
                  {(records?.rovCount ?? 0) > 0 ? records?.uniqueRovJobs : records?.uniqueDiveJobs}{" "}
                  Deployments
                </span>
              </div>
            )}

            {/* Inspection type breakdown */}
            {records && Object.keys(records.inspTypeBreakdown).length > 0 && (
              <div className="mt-3 bg-slate-800/20 border border-slate-700/30 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-800/40 border-b border-slate-700/30 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-slate-300" />
                  <span className="text-[9px] font-black uppercase text-slate-300 tracking-wider">
                    By Inspection Type
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded"
                      style={{
                        background: "rgba(239,68,68,0.15)",
                        color: "#f87171",
                        border: "1px solid rgba(239,68,68,0.3)",
                      }}
                    >
                      <svg viewBox="0 0 12 12" className="w-2 h-2" fill="currentColor">
                        <path d="M6 1L11 10H1L6 1z" />
                      </svg>
                      Anomaly
                    </span>
                    <span
                      className="inline-flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded"
                      style={{
                        background: "rgba(168,85,247,0.15)",
                        color: "#c084fc",
                        border: "1px solid rgba(168,85,247,0.3)",
                      }}
                    >
                      <svg viewBox="0 0 12 12" className="w-2 h-2" fill="currentColor">
                        <circle cx="6" cy="6" r="5" />
                      </svg>
                      Finding
                    </span>
                  </div>
                </div>
                <div className="p-3 grid grid-cols-1 gap-2">
                  {Object.entries(records.inspTypeBreakdown)
                    .sort((a, b) => a[1].name.localeCompare(b[1].name))
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
                        componentsData={data?.inspectionTypeSummary?.[code]}
                      />
                    ))}
                </div>
              </div>
            )}
          </section>
          )}

          {/* ═══ SECTION 3: FMD ═════════════════════════════════════════════════ */}
          {fmd && fmd.total > 0 && (
            <section id="summary-sec-fmd">
              <SectionHeader
                icon={Eye}
                title="Flooded Member Detection (FMD)"
                color="teal"
                count={fmd.total}
              />
              <div className="bg-slate-800/30 border border-teal-500/20 rounded-2xl p-4 space-y-4">
                {hasBoth ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                      <div className="text-xl font-black text-blue-400">{fmd.rov}</div>
                      <div className="text-[9px] font-bold text-blue-500 uppercase tracking-wider mt-0.5">
                        ROV
                      </div>
                    </div>
                    <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 text-center">
                      <div className="text-xl font-black text-cyan-400">{fmd.dive}</div>
                      <div className="text-[9px] font-bold text-cyan-500 uppercase tracking-wider mt-0.5">
                        Diving
                      </div>
                    </div>
                    <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-3 text-center">
                      <div className="text-xl font-black text-teal-400">{fmd.total}</div>
                      <div className="text-[9px] font-bold text-teal-500 uppercase tracking-wider mt-0.5">
                        Total
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <div className="text-4xl font-black text-teal-400">{fmd.total}</div>
                    <div className="text-[10px] font-bold text-teal-500 uppercase tracking-wider mt-1">
                      FMD Inspected
                    </div>
                  </div>
                )}

                {/* Condition Breakdown — members_status field values */}
                <div className="border-t border-slate-700/40 pt-3">
                  <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-2">
                    Member Status Breakdown
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { key: "dry", label: "Dry", color: "emerald" },
                        { key: "flooded", label: "Flooded", color: "red" },
                        { key: "grouted", label: "Grouted", color: "violet" },
                        { key: "inconclusive", label: "Inconclusive", color: "amber" },
                        { key: "incomplete", label: "Not Recorded", color: "slate" },
                      ] as { key: keyof typeof fmd.conditions; label: string; color: string }[]
                    ).map(({ key, label, color }) => {
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
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider ${
                              val > 0 ? `text-${color}-400` : "text-slate-600"
                            }`}
                          >
                            {label}
                          </span>
                          <span
                            className={`text-base font-black ${
                              val > 0 ? `text-${color}-300` : "text-slate-600"
                            }`}
                          >
                            {val}
                          </span>
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
            <section id="summary-sec-anode">
              <SectionHeader
                icon={Zap}
                title="Anode Inspection (GVI)"
                color="amber"
                count={anodeGvi.total}
              />
              <div className="bg-slate-800/30 border border-amber-500/20 rounded-2xl p-4 space-y-4">
                {/* ROV / Dive / Total counts */}
                {hasBoth ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                      <div className="text-xl font-black text-blue-400">{anodeGvi.rov}</div>
                      <div className="text-[9px] font-bold text-blue-500 uppercase tracking-wider mt-0.5">
                        ROV
                      </div>
                    </div>
                    <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 text-center">
                      <div className="text-xl font-black text-cyan-400">{anodeGvi.dive}</div>
                      <div className="text-[9px] font-bold text-cyan-500 uppercase tracking-wider mt-0.5">
                        Diving
                      </div>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                      <div className="text-xl font-black text-amber-400">{anodeGvi.total}</div>
                      <div className="text-[9px] font-bold text-amber-500 uppercase tracking-wider mt-0.5">
                        Total
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-1">
                    <div className="text-4xl font-black text-amber-400">{anodeGvi.total}</div>
                    <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mt-1">
                      Anodes Inspected
                    </div>
                  </div>
                )}

                {/* Depletion % Breakdown */}
                {anodeGvi.depletionBuckets && Object.keys(anodeGvi.depletionBuckets).length > 0 && (
                  <div className="border-t border-slate-700/40 pt-3">
                    <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-2">
                      Depletion % Breakdown
                    </div>
                    <div className="space-y-1.5">
                      {(
                        [
                          { key: "0–25%", color: "#10b981" },
                          { key: "25–50%", color: "#f59e0b" },
                          { key: "50–75%", color: "#f97316" },
                          { key: "75–100%", color: "#ef4444" },
                        ] as { key: string; color: string }[]
                      ).map(({ key, color }) => {
                        const cnt = anodeGvi.depletionBuckets[key] ?? 0;
                        const pct =
                          anodeGvi.total > 0 ? Math.round((cnt / anodeGvi.total) * 100) : 0;
                        return (
                          <div key={key} className="flex items-center gap-2">
                            <div className="w-14 text-[9px] font-black text-slate-400 shrink-0 text-right">
                              {key}
                            </div>
                            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${pct}%`, backgroundColor: color }}
                              />
                            </div>
                            <div className="w-6 text-[10px] font-black text-white shrink-0 text-right">
                              {cnt}
                            </div>
                          </div>
                        );
                      })}
                      {/* Any extra non-standard keys */}
                      {Object.entries(anodeGvi.depletionBuckets)
                        .filter(([k]) => !["0–25%", "25–50%", "50–75%", "75–100%"].includes(k))
                        .map(([k, cnt]) => (
                          <div key={k} className="flex items-center gap-2">
                            <div className="w-14 text-[9px] font-black text-slate-400 shrink-0 text-right">
                              {k}
                            </div>
                            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-slate-500"
                                style={{
                                  width: `${anodeGvi.total > 0 ? Math.round((cnt / anodeGvi.total) * 100) : 0}%`,
                                }}
                              />
                            </div>
                            <div className="w-6 text-[10px] font-black text-white shrink-0 text-right">
                              {cnt}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Anode Condition Breakdown */}
                {anodeGvi.conditionCounts && Object.keys(anodeGvi.conditionCounts).length > 0 && (
                  <div className="border-t border-slate-700/40 pt-3">
                    <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2">
                      Anode Condition
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(anodeGvi.conditionCounts)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cond, cnt]) => {
                          const condColor: Record<string, string> = {
                            Intact: "emerald",
                            Wasted: "amber",
                            Missing: "red",
                            Disconnected: "violet",
                          };
                          const col = condColor[cond] || "slate";
                          return (
                            <div
                              key={cond}
                              className={`flex items-center justify-between rounded-lg px-3 py-2 bg-${col}-500/10 border border-${col}-500/20`}
                            >
                              <span
                                className={`text-[9px] font-bold text-${col}-400 uppercase tracking-wider`}
                              >
                                {cond}
                              </span>
                              <span className={`text-base font-black text-${col}-300`}>{cnt}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
                {/* Anode Maintenance Details (ANMAIN) — 2 Options: Replaced & Maintenance Counts */}
                {data?.anodeMaintenance && data.anodeMaintenance.total > 0 && (
                  <div className="border-t border-slate-700/40 pt-3">
                    <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>Anode Maintenance</span>
                        <span className="text-[8px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                          ANMAIN
                        </span>
                      </div>
                      <span className="text-[10px] font-black text-slate-300">
                        Total: {data.anodeMaintenance.total}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                        <div className="text-xl font-black text-emerald-400">
                          {data.anodeMaintenance.replaced}
                        </div>
                        <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider mt-0.5">
                          Replaced Count
                        </div>
                      </div>

                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                        <div className="text-xl font-black text-amber-400">
                          {data.anodeMaintenance.maintenanceCount}
                        </div>
                        <div className="text-[9px] font-bold text-amber-500 uppercase tracking-wider mt-0.5">
                          Maintenance Count
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Selected Anode Inspection (SANI / RSANI) — shown inside anode card when data exists */}
                {sani && sani.total > 0 && (
                  <div className="border-t border-slate-700/40 pt-3">
                    <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2 flex items-center gap-2">
                      Selected Anode Inspection
                      <span className="text-[8px] font-black text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded">
                        SANI / RSANI
                      </span>
                    </div>
                    {hasBoth ? (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-2.5 text-center">
                          <div className="text-lg font-black text-blue-400">{sani.rov}</div>
                          <div className="text-[9px] font-bold text-blue-500 uppercase tracking-wider mt-0.5">
                            ROV
                          </div>
                        </div>
                        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-2.5 text-center">
                          <div className="text-lg font-black text-cyan-400">{sani.dive}</div>
                          <div className="text-[9px] font-bold text-cyan-500 uppercase tracking-wider mt-0.5">
                            Diving
                          </div>
                        </div>
                        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-2.5 text-center">
                          <div className="text-lg font-black text-violet-400">{sani.total}</div>
                          <div className="text-[9px] font-bold text-violet-500 uppercase tracking-wider mt-0.5">
                            Total
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3">
                        <div>
                          <div className="text-[10px] font-bold text-violet-400">
                            Selected Anodes Inspected
                          </div>
                          <div className="text-[9px] text-slate-500">
                            {sani.rov > 0 ? "ROV" : "Diving"} mode
                          </div>
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
            <section id="summary-sec-cp">
              <SectionHeader
                icon={Gauge}
                title="Cathodic Protection (CP)"
                color="cyan"
                count={cp.totalCount}
              />
              <div className="bg-slate-800/30 border border-cyan-500/20 rounded-2xl p-4 space-y-4">
                {/* ── Primary CP Readings ── */}
                <div>
                  <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2">
                    Primary CP Readings
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                      <div className="text-xl font-black text-blue-400">{cp.primaryRov}</div>
                      <div className="text-[9px] font-bold text-blue-500 uppercase tracking-wider mt-0.5">
                        ROV
                      </div>
                    </div>
                    <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 text-center">
                      <div className="text-xl font-black text-cyan-400">{cp.primaryDive}</div>
                      <div className="text-[9px] font-bold text-cyan-500 uppercase tracking-wider mt-0.5">
                        Diving
                      </div>
                    </div>
                    <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-3 text-center">
                      <div className="text-xl font-black text-teal-400">{cp.primaryCount}</div>
                      <div className="text-[9px] font-bold text-teal-500 uppercase tracking-wider mt-0.5">
                        Total
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Additional CP Readings ── */}
                {cp.additionalCount > 0 && (
                  <div className="border-t border-slate-700/40 pt-3">
                    <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2">
                      Additional CP Readings
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                        <div className="text-xl font-black text-blue-400">{cp.additionalRov}</div>
                        <div className="text-[9px] font-bold text-blue-500 uppercase tracking-wider mt-0.5">
                          ROV
                        </div>
                      </div>
                      <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 text-center">
                        <div className="text-xl font-black text-cyan-400">{cp.additionalDive}</div>
                        <div className="text-[9px] font-bold text-cyan-500 uppercase tracking-wider mt-0.5">
                          Diving
                        </div>
                      </div>
                      <div className="bg-slate-600/20 border border-slate-600/30 rounded-xl p-3 text-center">
                        <div className="text-xl font-black text-slate-300">
                          {cp.additionalCount}
                        </div>
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                          Total
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Grand Total ── */}
                <div className="border-t border-slate-700/40 pt-3 flex items-center justify-between bg-slate-900/50 rounded-xl px-4 py-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Grand Total CP Readings
                  </span>
                  <span className="text-2xl font-black text-white">{cp.totalCount}</span>
                </div>

                {/* ── CP Stab Details Drill-Down ── */}
                {cp.cpDetails && Object.keys(cp.cpDetails).length > 0 && (
                  <div className="border-t border-slate-700/40 pt-3">
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                      <LayoutGrid className="w-3.5 h-3.5 text-cyan-400" />
                      CP Readings Drill Down
                    </div>
                    <div className="space-y-2.5">
                      {Object.entries(cp.cpDetails).map(([inspType, qids]) => {
                        const isCpTypeExpanded = !!expandedCpTypes[inspType];
                        const readingsCount = Object.values(qids).reduce((acc, r) => acc + r.length, 0);

                        return (
                          <div key={inspType} className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/40">
                            {/* Inspection Type Header (Level 1) */}
                            <button
                              onClick={() => setExpandedCpTypes(prev => ({ ...prev, [inspType]: !prev[inspType] }))}
                              className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/80 hover:bg-slate-800/60 transition-colors text-left"
                            >
                              <div className="flex items-center gap-2">
                                <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isCpTypeExpanded ? "rotate-90" : ""}`} />
                                <span className="text-[11px] font-black uppercase text-slate-300">
                                  {inspType}
                                </span>
                              </div>
                              <Badge variant="secondary" className="text-[9px] font-black h-4 px-1.5 bg-slate-800 text-cyan-400">
                                {readingsCount} Reading{readingsCount !== 1 ? "s" : ""}
                              </Badge>
                            </button>

                            {/* QIDs List under Inspection Type (Level 2) */}
                            {isCpTypeExpanded && (
                              <div className="border-t border-slate-800/60 divide-y divide-slate-800/40 bg-slate-950/20 px-2.5 py-1.5 space-y-1.5">
                                {Object.entries(qids).map(([qid, readings]) => {
                                  const qidKey = `${inspType}_${qid}`;
                                  const isQidExpanded = !!expandedCpQIDs[qidKey];

                                  return (
                                    <div key={qid} className="border border-slate-800/50 rounded overflow-hidden bg-slate-900/10">
                                      {/* QID Header */}
                                      <button
                                        onClick={() => setExpandedCpQIDs(prev => ({ ...prev, [qidKey]: !prev[qidKey] }))}
                                        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-800/40 transition-colors text-left"
                                      >
                                        <div className="flex items-center gap-2">
                                          <ChevronRight className={`w-3 h-3 text-slate-500 transition-transform ${isQidExpanded ? "rotate-90" : ""}`} />
                                          <span className="text-[10px] font-bold text-slate-200 font-mono">
                                            {qid}
                                          </span>
                                        </div>
                                        <Badge className="text-[8.5px] font-black bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 h-4 px-1.5">
                                          {readings.length} reading{readings.length !== 1 ? "s" : ""}
                                        </Badge>
                                      </button>

                                      {/* Readings list showing values (Level 3) */}
                                      {isQidExpanded && (
                                        <div className="px-3 py-2 border-t border-slate-800/50 bg-slate-950/40 flex flex-wrap gap-2">
                                          {readings.map((r, rIdx) => (
                                            <div key={rIdx} className="inline-flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] font-bold">
                                              <span className="text-slate-400 font-mono">
                                                {r.val.toFixed(3)} V
                                              </span>
                                              <span className={`text-[8px] font-black px-1 rounded uppercase tracking-wider ${
                                                r.mode === "ROV" 
                                                  ? "bg-blue-500/10 text-blue-400" 
                                                  : "bg-cyan-500/10 text-cyan-400"
                                              }`}>
                                                {r.mode}
                                              </span>
                                              <span className="text-[8px] text-slate-500 uppercase">
                                                {r.type}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Min / Max ── */}
                {(cp.minVal !== null || cp.maxVal !== null) && (
                  <div className="border-t border-slate-700/40 pt-3 grid grid-cols-2 gap-3">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-emerald-400 rotate-180 flex-shrink-0" />
                      <div>
                        <div className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider">
                          Min CP Reading
                        </div>
                        <div className="text-lg font-black text-emerald-300">
                          {cp.minVal !== null ? `${cp.minVal.toFixed(3)} V` : "—"}
                        </div>
                      </div>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      <div>
                        <div className="text-[9px] text-blue-500 font-bold uppercase tracking-wider">
                          Max CP Reading
                        </div>
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

          {/* ═══ PIPELINE ANOMALIES & FINDINGS BREAKDOWN SECTION ═══════════════ */}
          {isPipelineMode && (
            <section id="summary-sec-pipeline-anomalies" className="space-y-4">
              <SectionHeader icon={AlertTriangle} title="Pipeline Anomalies & Findings Details" color="red" />

              <div className="bg-slate-800/30 border border-red-500/20 rounded-2xl p-5 space-y-5">
                {/* Stats Header */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                    <div className="text-2xl font-black text-red-400">
                      {anomalies?.total || pipelineSummary?.totalAnomaly || 0}
                    </div>
                    <div className="text-[9px] font-bold text-red-500 uppercase tracking-wider mt-0.5">
                      Total Anomalies
                    </div>
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                    <div className="text-2xl font-black text-emerald-400">
                      {anomalies?.rectified || pipelineSummary?.totalRectified || 0}
                    </div>
                    <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider mt-0.5">
                      Rectified
                    </div>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                    <div className="text-2xl font-black text-amber-400">
                      {anomalies?.open ?? Math.max(0, (anomalies?.total || pipelineSummary?.totalAnomaly || 0) - (anomalies?.rectified || pipelineSummary?.totalRectified || 0))}
                    </div>
                    <div className="text-[9px] font-bold text-amber-500 uppercase tracking-wider mt-0.5">
                      Open Anomalies
                    </div>
                  </div>

                  <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 text-center">
                    <div className="text-2xl font-black text-violet-400">
                      {findings?.total || 0}
                    </div>
                    <div className="text-[9px] font-bold text-violet-500 uppercase tracking-wider mt-0.5">
                      Total Findings
                    </div>
                  </div>
                </div>

                {/* Priority Breakdown (P1, P2, P3) */}
                {anomalies?.byPriority && Object.keys(anomalies.byPriority).length > 0 && (
                  <div className="border-t border-slate-700/40 pt-4">
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2.5">
                      Anomalies By Priority
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {Object.entries(anomalies.byPriority).map(([prio, cnt]) => (
                        <div key={prio} className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-300 uppercase">{prio}</span>
                          <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-mono font-bold">
                            {cnt as number}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Defect Code Categories & Counts */}
                {anomalies?.byDefectType && Object.keys(anomalies.byDefectType).length > 0 ? (
                  <div className="border-t border-slate-700/40 pt-4 space-y-3">
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      Defect Code Categories & Counts
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(anomalies.byDefectType).map(([defectCode, cnt]) => {
                        const details = anomalies.defectTypeDetails?.[defectCode] || [];
                        return (
                          <div key={defectCode} className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
                            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2">
                              <span className="text-xs font-black text-sky-400 font-mono">{defectCode}</span>
                              <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-mono font-bold">
                                {cnt as number} Event{(cnt as number) !== 1 ? "s" : ""}
                              </Badge>
                            </div>
                            {details.length > 0 ? (
                              <div className="space-y-1.5 text-[10px] font-mono">
                                {details.map((d, i) => (
                                  <div key={i} className="flex justify-between items-center text-slate-300 bg-slate-950/40 p-1.5 rounded border border-slate-900">
                                    <span>QID: <b>{d.qid}</b></span>
                                    <span className="text-slate-400">{d.inspectionTypeName}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-500 italic">No specific QIDs attached</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-slate-700/40 pt-4 text-center py-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400/60 mx-auto mb-2" />
                    <div className="text-xs font-bold text-slate-300">No Defect Anomalies Reported</div>
                    <div className="text-[10px] text-slate-500">Pipeline inspection running clear of anomalies</div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ═══ SECTION 7: ANOMALIES ═══════════════════════════════════════════ */}
          {!isPipelineMode && anomalies && anomalies.total > 0 && (
            <section id="summary-sec-anomalies">
              <SectionHeader
                icon={AlertTriangle}
                title="Anomaly Count"
                color="red"
                count={anomalies.total}
              />
              <div className="bg-slate-800/30 border border-red-500/20 rounded-2xl p-4 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                    <div className="text-2xl font-black text-red-400">{anomalies.total}</div>
                    <div className="text-[9px] font-bold text-red-500 uppercase tracking-wider mt-0.5">
                      Total
                    </div>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                    <div className="text-2xl font-black text-amber-400">{anomalies.open}</div>
                    <div className="text-[9px] font-bold text-amber-500 uppercase tracking-wider mt-0.5">
                      Open
                    </div>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                    <div className="text-2xl font-black text-emerald-400">
                      {anomalies.rectified}
                    </div>
                    <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider mt-0.5">
                      Rectified
                    </div>
                  </div>
                </div>

                {/* By Priority (P1, P2, P3 etc.) */}
                {anomalies.byPriority && Object.keys(anomalies.byPriority).length > 0 && (
                  <div className="border-t border-slate-700/40 pt-3">
                    <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2">
                      By Priority
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(anomalies.byPriority)
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(([priority, cnt]) => {
                          const priorityColors: Record<
                            string,
                            { bg: string; border: string; text: string; val: string }
                          > = {
                            P1: {
                              bg: "bg-red-500/15",
                              border: "border-red-500/30",
                              text: "text-red-400",
                              val: "text-red-300",
                            },
                            P2: {
                              bg: "bg-orange-500/15",
                              border: "border-orange-500/30",
                              text: "text-orange-400",
                              val: "text-orange-300",
                            },
                            P3: {
                              bg: "bg-amber-500/15",
                              border: "border-amber-500/30",
                              text: "text-amber-400",
                              val: "text-amber-300",
                            },
                            P4: {
                              bg: "bg-yellow-500/15",
                              border: "border-yellow-500/30",
                              text: "text-yellow-400",
                              val: "text-yellow-300",
                            },
                            NONE: {
                              bg: "bg-slate-700/30",
                              border: "border-slate-600/30",
                              text: "text-slate-400",
                              val: "text-slate-300",
                            },
                          };
                          const c = priorityColors[priority] || {
                            bg: "bg-violet-500/15",
                            border: "border-violet-500/30",
                            text: "text-violet-400",
                            val: "text-violet-300",
                          };
                          return (
                            <div
                              key={priority}
                              className={`flex items-center justify-between rounded-lg px-3 py-2.5 border ${c.bg} ${c.border}`}
                            >
                              <span
                                className={`text-[10px] font-black uppercase tracking-widest ${c.text}`}
                              >
                                {priority}
                              </span>
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
                    <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2">
                      By Defect Type
                    </div>
                    <div className="space-y-2">
                      {Object.entries(anomalies.byDefectType)
                        .sort((a, b) => b[1] - a[1])
                        .map(([type, cnt]) => {
                          const isExpanded = !!expandedDefectTypes[type];
                          const details = anomalies.defectTypeDetails?.[type] || [];
                          return (
                            <div key={type} className="border border-slate-800/40 rounded-lg overflow-hidden bg-slate-900/20">
                              <button
                                onClick={() => setExpandedDefectTypes(prev => ({ ...prev, [type]: !prev[type] }))}
                                className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-800/40 transition-colors text-left"
                              >
                                <div className="flex items-center gap-2">
                                  <ChevronRight className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                  <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
                                    {type}
                                  </span>
                                </div>
                                <span className="text-[10px] font-black text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                                  {cnt}
                                </span>
                              </button>
                              
                              {isExpanded && (
                                <div className="px-3 pb-2 pt-1 border-t border-slate-800/40 bg-slate-950/40 divide-y divide-slate-900/20">
                                  {details.length > 0 ? (
                                    details.map((item, idx) => (
                                      <div key={idx} className="flex items-center justify-between py-1.5 text-[10px]">
                                        <span className="font-mono font-bold text-slate-200 pl-4">
                                          {item.qid}
                                        </span>
                                        <span className="text-slate-500 italic">
                                          ({item.inspectionTypeName})
                                        </span>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-[9px] text-slate-500 italic pl-4 py-1.5">No QID details available</div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ═══ SECTION 8: FINDINGS ════════════════════════════════════════════ */}
          {findings && findings.total > 0 && (
            <section id="summary-sec-findings">
              <SectionHeader
                icon={FileSearch}
                title="Findings Count"
                color="violet"
                count={findings.total}
              />
              <div className="bg-slate-800/30 border border-violet-500/20 rounded-2xl p-4 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 text-center">
                    <div className="text-2xl font-black text-violet-400">{findings.total}</div>
                    <div className="text-[9px] font-bold text-violet-500 uppercase tracking-wider mt-0.5">
                      Total
                    </div>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                    <div className="text-2xl font-black text-amber-400">{findings.open}</div>
                    <div className="text-[9px] font-bold text-amber-500 uppercase tracking-wider mt-0.5">
                      Open
                    </div>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                    <div className="text-2xl font-black text-emerald-400">{findings.rectified}</div>
                    <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider mt-0.5">
                      Resolved
                    </div>
                  </div>
                </div>

                {/* By Priority */}
                {findings.byPriority && Object.keys(findings.byPriority).length > 0 && (
                  <div className="border-t border-slate-700/40 pt-3">
                    <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2">
                      By Priority
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(findings.byPriority)
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(([priority, cnt]) => {
                          const priorityColors: Record<
                            string,
                            { bg: string; border: string; text: string; val: string }
                          > = {
                            P1: {
                              bg: "bg-red-500/15",
                              border: "border-red-500/30",
                              text: "text-red-400",
                              val: "text-red-300",
                            },
                            P2: {
                              bg: "bg-orange-500/15",
                              border: "border-orange-500/30",
                              text: "text-orange-400",
                              val: "text-orange-300",
                            },
                            P3: {
                              bg: "bg-amber-500/15",
                              border: "border-amber-500/30",
                              text: "text-amber-400",
                              val: "text-amber-300",
                            },
                            P4: {
                              bg: "bg-yellow-500/15",
                              border: "border-yellow-500/30",
                              text: "text-yellow-400",
                              val: "text-yellow-300",
                            },
                            NONE: {
                              bg: "bg-slate-700/30",
                              border: "border-slate-600/30",
                              text: "text-slate-400",
                              val: "text-slate-300",
                            },
                          };
                          const c = priorityColors[priority] || {
                            bg: "bg-violet-500/15",
                            border: "border-violet-500/30",
                            text: "text-violet-400",
                            val: "text-violet-300",
                          };
                          return (
                            <div
                              key={priority}
                              className={`flex items-center justify-between rounded-lg px-3 py-2.5 border ${c.bg} ${c.border}`}
                            >
                              <span
                                className={`text-[10px] font-black uppercase tracking-widest ${c.text}`}
                              >
                                {priority}
                              </span>
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
          {!isPipelineMode && attachmentGroups && (
            <section id="summary-sec-attachments">
              <SectionHeader icon={Anchor} title="Attachment Group Inspections" color="blue" />
              <div className="bg-slate-800/30 border border-slate-700/40 rounded-2xl overflow-hidden">
                {[
                  { key: "Riser", icon: Waves, color: "blue" },
                  { key: "Conductor", icon: Hash, color: "slate" },
                  { key: "Caisson", icon: Anchor, color: "cyan" },
                  { key: "Riser Guard", icon: Shield, color: "green" },
                  { key: "Boat Landing", icon: Ship, color: "amber" },
                ].map(({ key, icon: Icon, color }, idx) => {
                  const groupData = attachmentGroups[key];
                  const count = groupData?.count ?? 0;
                  const total = groupData?.total ?? 0;
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-3 px-4 py-3 ${idx !== 0 ? "border-t border-slate-800/60" : ""} hover:bg-slate-700/20 transition-colors`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg bg-${color}-500/10 border border-${color}-500/20 flex items-center justify-center flex-shrink-0`}
                      >
                        {(React.createElement as any)(Icon, {
                          className: `w-4 h-4 text-${color}-400`,
                        })}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-slate-300">{key} Inspection</div>
                        <div className="text-[9px] text-slate-500">Attachment group</div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <div
                          className={`text-lg font-black ${count > 0 ? `text-${color}-400` : "text-slate-600"}`}
                        >
                          {count}
                          <span className="text-[10px] text-slate-500 font-bold ml-1">
                            / {total}
                          </span>
                        </div>
                        <div className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter mt-0.5">
                          Inspected of SOW
                        </div>
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
              {[1, 2, 3].map((i) => (
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
