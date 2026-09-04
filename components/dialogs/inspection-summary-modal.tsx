"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { 
  ChevronRight, 
  ExternalLink, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Compass, 
  Layers, 
  ChevronLeft
} from "lucide-react";
import { useState, useMemo } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import inspectionTypesData from "@/utils/types/inspection-types.json";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// Build a code -> name map from the bundled JSON
const inspTypeMap: Record<string, string> = {
  "NAVIG": "Pipeline Navigation Inspection",
  "RGVI": "ROV General Visual Inspection",
  "RFMD": "Flooded Member Detection",
  "RSEAB": "Seabed Survey",
  "RRISI": "Riser Inspection",
  "RCOND": "Condition Assessment",
  "RSCOR": "Scour / Marine Growth Survey",
  "RMGI": "MGI Wall Thickness Survey",
  "RCPSU": "Cathodic Protection Survey",
  "BSINS": "Bolt Survey",
  "CLEAN": "Cleaning Survey",
  "CPCLB": "CP Calibration",
  "CPSURV": "CP Survey",
  "SZONE": "Splash Zone Survey",
  "UTCLB": "UT Calibration",
  "UTWTK": "UT Wall Thickness",
  "MGROW": "Marine Growth Survey",
  "PL_AN": "Pipeline Anode Inspection",
  "GVINS": "General Visual Inspection",
  "RISER": "Riser Inspection",
};

if ((inspectionTypesData as any).inspectionTypes) {
  (inspectionTypesData as any).inspectionTypes.forEach((t: any) => {
    if (t.code && t.name) {
      inspTypeMap[t.code] = t.name;
    }
  });
}

function resolveInspTypeName(code?: string, rawName?: string): string {
  if (rawName && rawName.trim() && rawName !== "N/A") return rawName;
  if (code && inspTypeMap[code.toUpperCase()]) return inspTypeMap[code.toUpperCase()];
  if (code && inspTypeMap[code]) return inspTypeMap[code];
  return code || "Inspection";
}

type InspectionSummaryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspections: any[];
  structureId?: string | number;
  isPipeline?: boolean;
  structureType?: string;
};

export function InspectionSummaryModal({
  open,
  onOpenChange,
  inspections,
  structureId,
  isPipeline = false,
  structureType,
}: InspectionSummaryModalProps) {
  const isPipe = isPipeline || structureType?.toLowerCase() === "pipeline";
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "anomalies" | "findings">("all");
  const [pageSize, setPageSize] = useState<number>(500);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Group inspections by jobpack name
  const groupedByJobpack = useMemo(() => {
    return (inspections || []).reduce((acc: Record<string, any[]>, insp: any) => {
      const key = insp.jobpack?.name || "Unassigned Job Pack";
      if (!acc[key]) acc[key] = [];
      acc[key].push(insp);
      return acc;
    }, {});
  }, [inspections]);

  // Overall anomaly and findings stats
  const totalAnomalies = useMemo(() => {
    return (inspections || []).filter(i => {
      const d = i.inspection_data || {};
      return i.has_anomaly || d.has_anomaly || String(d.finding_type || d.findingType || '').toLowerCase() === 'anomaly';
    }).length;
  }, [inspections]);

  const totalFindings = useMemo(() => {
    return (inspections || []).filter(i => {
      const d = i.inspection_data || {};
      const f = d.findings || d.comments || d.remarks || i.description;
      return f && f !== "-" && f.trim() !== "";
    }).length;
  }, [inspections]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col bg-slate-950 border-slate-800 text-slate-200 p-0 rounded-[1.5rem] shadow-2xl">
        <DialogHeader className="px-6 py-5 border-b border-slate-800/80 bg-slate-900/50 flex flex-row items-center justify-between gap-4">
          <div>
            <DialogTitle className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2.5">
              <div className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
              Inspection Records
              {isPipe && (
                <Badge variant="outline" className="ml-2 bg-cyan-950/60 border-cyan-800/80 text-cyan-400 font-mono text-[10px] tracking-wider uppercase">
                  Pipeline Telemetry
                </Badge>
              )}
            </DialogTitle>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Total <strong className="text-white font-bold">{inspections.length.toLocaleString()}</strong> record(s) logged across active survey campaigns
            </p>
          </div>

          {/* Quick Summary Pill Counters */}
          <div className="flex items-center gap-2">
            {totalAnomalies > 0 && (
              <Badge className="bg-rose-950/80 text-rose-300 border border-rose-800/60 text-[11px] font-black gap-1.5 px-3 py-1">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                {totalAnomalies} Anomalies
              </Badge>
            )}
            {totalFindings > 0 && (
              <Badge className="bg-amber-950/80 text-amber-300 border border-amber-800/60 text-[11px] font-black gap-1.5 px-3 py-1">
                <Layers className="h-3.5 w-3.5 text-amber-400" />
                {totalFindings} Findings
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Global Toolbar: Search & Record Limits */}
        <div className="px-6 py-3.5 bg-slate-900/40 border-b border-slate-800/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-[280px] max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={isPipe ? "Search by KP, Event (CP, Joint, Scour), Timecode, Remarks..." : "Search by Date, Type, Findings..."}
                className="h-8.5 pl-9 pr-4 bg-slate-950/70 border-slate-800 text-xs rounded-xl focus-visible:ring-blue-500/50 text-slate-200 placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter mode */}
            <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => { setFilterMode("all"); setCurrentPage(1); }}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all",
                  filterMode === "all" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                )}
              >
                All ({inspections.length})
              </button>
              <button
                onClick={() => { setFilterMode("anomalies"); setCurrentPage(1); }}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all",
                  filterMode === "anomalies" ? "bg-rose-600 text-white shadow-sm" : "text-slate-400 hover:text-rose-300"
                )}
              >
                Anomalies ({totalAnomalies})
              </button>
              <button
                onClick={() => { setFilterMode("findings"); setCurrentPage(1); }}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all",
                  filterMode === "findings" ? "bg-amber-600 text-white shadow-sm" : "text-slate-400 hover:text-amber-300"
                )}
              >
                Findings ({totalFindings})
              </button>
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Show:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-7 bg-slate-950 border border-slate-800 text-[11px] font-bold text-slate-300 rounded-lg px-2 focus:outline-none focus:border-blue-500"
              >
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
                <option value={1000}>1,000</option>
                <option value={5000}>All ({inspections.length})</option>
              </select>
            </div>
          </div>
        </div>

        {/* Scrollable Jobpack Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {inspections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Layers className="h-10 w-10 text-slate-700 mb-2 stroke-[1.5]" />
              <p className="font-black uppercase tracking-widest text-xs">No Inspection Records Logged</p>
            </div>
          ) : (
            Object.entries(groupedByJobpack).map(([jobpackName, items]) => (
              <CollapsibleJobPackSection
                key={jobpackName}
                name={jobpackName}
                items={items as any[]}
                structureId={structureId}
                isPipeline={isPipe}
                searchQuery={searchQuery}
                filterMode={filterMode}
                pageSize={pageSize}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Jobpack Section with Sub-Grouping by Inspection Type ─────────────────────
function CollapsibleJobPackSection({
  name,
  items,
  structureId,
  isPipeline,
  searchQuery,
  filterMode,
  pageSize,
  currentPage,
  onPageChange,
}: {
  name: string;
  items: any[];
  structureId?: string | number;
  isPipeline: boolean;
  searchQuery: string;
  filterMode: "all" | "anomalies" | "findings";
  pageSize: number;
  currentPage: number;
  onPageChange: (p: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  // Filter items according to search and filter criteria
  const filteredItems = useMemo(() => {
    let result = items || [];

    if (filterMode === "anomalies") {
      result = result.filter(i => {
        const d = i.inspection_data || {};
        return i.has_anomaly || d.has_anomaly || String(d.finding_type || d.findingType || '').toLowerCase() === 'anomaly';
      });
    } else if (filterMode === "findings") {
      result = result.filter(i => {
        const d = i.inspection_data || {};
        const f = d.findings || d.comments || d.remarks || i.description;
        return f && f !== "-" && f.trim() !== "";
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(i => {
        const d = i.inspection_data || {};
        const kp = String(i.fp_kp || d.kp || d.fp || d.fp_kp || '');
        const evt = `${d.event_name || d.eventName || ''} ${d.event_type || d.eventType || ''} ${d.event_position || d.eventPosition || ''}`;
        const desc = `${i.description || ''} ${d.event_description || ''} ${d.comments || ''} ${d.remarks || ''} ${d.findings || ''}`;
        const timecode = `${d.timecode || ''} ${d.counter || ''} ${i.inspection_time || ''}`;
        const date = i.inspection_date ? format(new Date(i.inspection_date), "dd MMM yyyy").toLowerCase() : '';
        return (
          kp.toLowerCase().includes(q) ||
          evt.toLowerCase().includes(q) ||
          desc.toLowerCase().includes(q) ||
          timecode.toLowerCase().includes(q) ||
          date.includes(q)
        );
      });
    }

    return result;
  }, [items, filterMode, searchQuery]);

  // Group by Inspection Type
  const groupedByType = useMemo(() => {
    return filteredItems.reduce((acc: Record<string, any[]>, insp: any) => {
      const code = String(insp.inspection_type_code || insp.inspection_type?.code || "GENERAL").toUpperCase().trim();
      if (!acc[code]) acc[code] = [];
      acc[code].push(insp);
      return acc;
    }, {});
  }, [filteredItems]);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="group bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden transition-all duration-200"
    >
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/40 transition-colors bg-slate-900/60 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center justify-center h-8 w-8 rounded-xl border border-slate-700 bg-slate-800 transition-all duration-300",
              isOpen ? "rotate-90 border-blue-500/50 bg-blue-500/10 text-blue-400 shadow-sm" : "text-slate-500"
            )}>
              <ChevronRight className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                {name}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[11px] font-black text-slate-300 bg-slate-800/90 border-slate-700 px-2.5 py-0.5 rounded-lg font-mono">
              {filteredItems.length.toLocaleString()} {filteredItems.length === 1 ? 'Record' : 'Records'}
            </Badge>
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
        {filteredItems.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">
            No records matched the active search filters
          </div>
        ) : (
          Object.entries(groupedByType).map(([typeCode, typeRecords]) => (
            <InspectionTypeSection
              key={typeCode}
              typeCode={typeCode}
              records={typeRecords}
              structureId={structureId}
              isPipeline={isPipeline}
              pageSize={pageSize}
              currentPage={currentPage}
              onPageChange={onPageChange}
            />
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Individual Grouped Inspection Type Card ──────────────────────────────────
function InspectionTypeSection({
  typeCode,
  records,
  structureId,
  isPipeline,
  pageSize,
  currentPage,
  onPageChange,
}: {
  typeCode: string;
  records: any[];
  structureId?: string | number;
  isPipeline: boolean;
  pageSize: number;
  currentPage: number;
  onPageChange: (p: number) => void;
}) {
  const fullTypeName = resolveInspTypeName(typeCode);
  const totalPages = Math.ceil(records.length / pageSize);
  const paginatedRecords = useMemo(() => {
    if (pageSize >= records.length) return records;
    const start = (currentPage - 1) * pageSize;
    return records.slice(start, start + pageSize);
  }, [records, currentPage, pageSize]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden shadow-sm">
      {/* Group Header Banner (Eliminating redundant Code column from every row) */}
      <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full bg-cyan-400" />
          <h4 className="text-xs font-black uppercase tracking-wide text-cyan-300">
            {fullTypeName}
          </h4>
          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
            {typeCode}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 font-mono">
            {records.length.toLocaleString()} Events
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg">
              <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="hover:text-white disabled:opacity-30"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>
              <span>{currentPage} / {totalPages}</span>
              <button
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="hover:text-white disabled:opacity-30"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Responsive High-Density Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/70 border-b border-slate-800/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <th className="px-4 py-2.5 whitespace-nowrap">Date & Time</th>
              {isPipeline && <th className="px-4 py-2.5 whitespace-nowrap">KP / FP</th>}
              <th className="px-4 py-2.5">Event Telemetry</th>
              <th className="px-4 py-2.5">Findings & Condition Notes</th>
              {!isPipeline && <th className="px-4 py-2.5">Code</th>}
              <th className="px-4 py-2.5 whitespace-nowrap">Status</th>
              <th className="px-4 py-2.5 text-center whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {paginatedRecords.map((insp, idx) => {
              const d = insp.inspection_data || {};
              const hasAnomaly = Boolean(
                insp.has_anomaly ||
                d.has_anomaly ||
                String(d.finding_type || d.findingType || '').toLowerCase() === 'anomaly' ||
                (d.anomaly_no && d.anomaly_no !== "0" && d.anomaly_no !== "-")
              );

              const rawFindings = d.findings || d.comments || d.remarks || insp.description || "";
              const hasFindings = Boolean(rawFindings && rawFindings !== "-" && rawFindings.trim() !== "");

              // Event Telemetry
              const eventName = d.event_name || d.eventName || d.actionName || "";
              const eventType = d.event_type || d.eventType || d.eventCategory || "";
              const eventPos = d.event_position || d.eventPosition || "";
              const eventTelemetry = [eventName, eventType, eventPos].filter(Boolean).join(" • ") || insp.description || "Survey Log Entry";

              // Numeric KP
              const kpVal = insp.fp_kp || d.kp || d.fp || d.fp_kp || null;
              const formattedKp = kpVal !== null && !isNaN(Number(kpVal)) ? `KP ${Number(kpVal).toFixed(3)}` : (kpVal || "—");

              // Timecode / Time
              const timeDisplay = d.timecode || d.counter || insp.inspection_time || null;

              // Priority / Anomaly Ref
              const anomRef = d.anomaly_no || (hasAnomaly ? "ANOMALY" : null);
              const priority = d.priority || d.severity || null;

              return (
                <tr
                  key={insp.insp_id || idx}
                  className={cn(
                    "text-xs transition-colors group/row",
                    hasAnomaly
                      ? "bg-rose-950/20 hover:bg-rose-950/30 border-l-4 border-l-rose-500"
                      : hasFindings
                        ? "bg-amber-950/10 hover:bg-amber-950/20 border-l-4 border-l-amber-500/60"
                        : "hover:bg-slate-900/40 border-l-4 border-l-transparent"
                  )}
                >
                  {/* Date & Time */}
                  <td className="px-4 py-3 whitespace-nowrap align-top">
                    <div className="font-bold text-slate-200 text-[11px]">
                      {insp.inspection_date ? format(new Date(insp.inspection_date), "dd MMM yyyy") : "—"}
                    </div>
                    {timeDisplay && (
                      <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="h-2.5 w-2.5 text-slate-500" />
                        {timeDisplay}
                      </div>
                    )}
                  </td>

                  {/* KP / FP (Pipeline Specific) */}
                  {isPipeline && (
                    <td className="px-4 py-3 whitespace-nowrap align-top">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[11px] font-black bg-slate-900 border border-slate-800 text-cyan-300">
                        <Compass className="h-3 w-3 text-cyan-400 shrink-0" />
                        {formattedKp}
                      </span>
                    </td>
                  )}

                  {/* Event Telemetry */}
                  <td className="px-4 py-3 align-top min-w-[200px]">
                    <div className="font-black text-[11px] text-white tracking-tight">
                      {eventTelemetry}
                    </div>
                    {(d.event_description || d.length !== undefined || d.height !== undefined) && (
                      <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">
                        {d.event_description || (
                          d.length !== null && d.height !== null 
                            ? `Length: ${d.length_primary || d.length} | Height: ${d.height_primary || d.height}` 
                            : ""
                        )}
                      </div>
                    )}
                  </td>

                  {/* Findings & Condition Notes (Color-Coded) */}
                  <td className="px-4 py-3 align-top min-w-[220px]">
                    {hasAnomaly ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge className="bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-black px-1.5 py-0 uppercase tracking-wider">
                            ⚠️ {anomRef}
                          </Badge>
                          {priority && (
                            <Badge variant="outline" className="text-[9px] font-mono font-bold text-rose-300 border-rose-800">
                              {priority}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] font-semibold text-rose-200 line-clamp-2 leading-tight">
                          {rawFindings}
                        </p>
                      </div>
                    ) : hasFindings ? (
                      <div className="space-y-0.5">
                        <Badge variant="outline" className="bg-amber-950/40 text-amber-300 border-amber-800/60 text-[9px] font-black px-1.5 py-0 uppercase">
                          Finding Note
                        </Badge>
                        <p className="text-[11px] text-amber-100/90 line-clamp-2 leading-tight">
                          {rawFindings}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-medium italic">
                        No condition defects noted
                      </span>
                    )}
                  </td>

                  {/* Standard Platform Code Column */}
                  {!isPipeline && (
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {typeCode}
                      </span>
                    </td>
                  )}

                  {/* Status Badge */}
                  <td className="px-4 py-3 whitespace-nowrap align-top">
                    <span className={cn(
                      "text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1",
                      insp.status === "COMPLETED" || insp.status === "DONE"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                    )}>
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      {insp.status || "COMPLETED"}
                    </span>
                  </td>

                  {/* Action Link to Workspace */}
                  <td className="px-4 py-3 text-center whitespace-nowrap align-top">
                    <button
                      onClick={() => {
                        const jpId = insp.jobpack?.id || insp.jobpack_id;
                        const jpName = encodeURIComponent(insp.jobpack?.name || `JP-${jpId}`);
                        const sowReport = encodeURIComponent(insp.sow_report_no || '');
                        
                        let mode = insp.rov_job_id ? 'ROV' : 'DIVING';
                        const code = (typeCode || '').toUpperCase();
                        if (code.startsWith('R') || code === 'NAVIG') {
                          mode = 'ROV';
                        } else if (code.startsWith('D')) {
                          mode = 'DIVING';
                        }

                        if (jpId && structureId) {
                          const url = `/dashboard/inspection-v2/workspace?jobpack=${jpId}&structure=${structureId}&jpName=${jpName}&sowReport=${sowReport}&compId=${insp.component_id}&recordId=${insp.insp_id}&mode=${mode}`;
                          window.open(url, '_blank');
                        }
                      }}
                      disabled={!(insp.jobpack?.id || insp.jobpack_id) || !structureId}
                      className={cn(
                        "h-7 w-7 inline-flex items-center justify-center rounded-lg transition-all shadow-sm",
                        (insp.jobpack?.id || insp.jobpack_id) && structureId
                          ? "bg-slate-900 border border-slate-700 text-slate-300 hover:bg-blue-600 hover:text-white hover:border-blue-500"
                          : "bg-slate-900/50 text-slate-600 border border-slate-800 cursor-not-allowed"
                      )}
                      title="Open Record in Inspection Workspace"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

