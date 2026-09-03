"use client";

import React from "react";
import { createPortal } from "react-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { 
  Search, 
  Settings2, 
  SlidersHorizontal,
  Maximize2, 
  ChevronUp, 
  ChevronDown, 
  GripVertical, 
  AlertCircle, 
  CheckCircle2, 
  FileClock, 
  Paperclip,
  Loader2,
  X,
  Check
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EventsTablePanelProps {
  syncLoading: boolean;
  recordSearchQuery: string;
  setRecordSearchQuery: (val: string) => void;
  searchMode?: "ANY" | "ALL" | "EXACT";
  setSearchMode?: (mode: "ANY" | "ALL" | "EXACT") => void;
  displayRecords: any[];
  sortedRecords: any[];
  capturedEventsPipWindow: any;
  handlePopoutCapturedEvents: () => void;
  activeTableColumns: any[];
  columnSettings: any[];
  handleMoveColumn: (idx: number, dir: "up" | "down") => void;
  toggleColumnVisibility: (id: string) => void;
  handleSort: (key: string) => void;
  sortConfig: { key: string; direction: "asc" | "desc" };
  handleEditRecord: (rec: any) => void;
  handlePrintAnomaly: (rec: any) => void;
  handleDeleteRecord: (id: number) => void;
  setViewingRecordAttachments: (val: any) => void;
  editingRecordId?: number | null;
  supabase: any;
  recordsOffset: number;
  setRecordsOffset: (val: number) => void;
  recordsLimit: number;
  setRecordsLimit: (val: number) => void;
  totalRecords: number;
  isPipe?: boolean;
}

export function EventsTablePanel({
  syncLoading,
  recordSearchQuery,
  setRecordSearchQuery,
  searchMode = "ALL",
  setSearchMode,
  displayRecords,
  sortedRecords,
  capturedEventsPipWindow,
  handlePopoutCapturedEvents,
  activeTableColumns,
  columnSettings,
  handleMoveColumn,
  toggleColumnVisibility,
  handleSort,
  sortConfig,
  handleEditRecord,
  handlePrintAnomaly,
  handleDeleteRecord,
  setViewingRecordAttachments,
  supabase,
  recordsOffset,
  setRecordsOffset,
  recordsLimit,
  setRecordsLimit,
  totalRecords,
  editingRecordId,
  isPipe = false,
}: EventsTablePanelProps) {
  function formatCounter(seconds: number | string): string {
    if (seconds === undefined || seconds === null || seconds === "") return "00:00:00";
    const str = String(seconds).trim();
    if (str.includes(":")) {
      const parts = str.split(":").map((p) => p.trim());
      if (parts.length === 3) {
        return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:${parts[2].padStart(2, "0")}`;
      }
      if (parts.length === 2) {
        return `00:${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
      }
    }
    const totalSeconds = typeof seconds === "string" ? parseFloat(seconds) : seconds;
    if (isNaN(totalSeconds)) return "00:00:00";
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  const [selectedRowId, setSelectedRowId] = React.useState<number | null>(null);
  const rowRefs = React.useRef<Record<number, HTMLTableRowElement | null>>({});

  React.useEffect(() => {
    if (editingRecordId !== undefined && editingRecordId !== null) {
      setSelectedRowId(editingRecordId);
    }
  }, [editingRecordId]);

  React.useEffect(() => {
    if (selectedRowId && rowRefs.current[selectedRowId]) {
      rowRefs.current[selectedRowId]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedRowId, sortConfig, displayRecords]);

  const [isInPip, setIsInPip] = React.useState(false);
  React.useEffect(() => {
    const handlePipChange = () => {
      setIsInPip(window !== window.parent);
    };
    handlePipChange();
    window.addEventListener("resize", handlePipChange);
    return () => window.removeEventListener("resize", handlePipChange);
  }, []);

  const renderHeaderToolbar = (isInPip: boolean) => (
    <div className="bg-slate-800 dark:bg-slate-900/90 text-white px-3 py-1.5 flex justify-between items-center h-[38px] shrink-0 border-b border-slate-700 select-none">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-200">
          {isInPip ? "CAPTURED EVENTS (FLOATING)" : "CAPTURED EVENTS"}
        </span>
        <Badge className="bg-blue-600 text-white border-none text-[9px] h-4 leading-none font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
          {syncLoading && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
          {recordSearchQuery ? `${displayRecords.length} / ${totalRecords || sortedRecords.length}` : (totalRecords || sortedRecords.length)} Total
        </Badge>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="relative flex items-center">
          <Input
            placeholder={isPipe ? "Search events, KP, anom, P1..." : "Search terms (e.g. Anode, P1, 0.050)..."}
            className="h-6 w-36 sm:w-48 text-[10px] bg-slate-900/80 border-slate-700 text-white placeholder:text-slate-500 rounded-l focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:ring-offset-0 border-r-0 pl-2 pr-5"
            value={recordSearchQuery}
            onChange={(e) => setRecordSearchQuery(e.target.value)}
          />
          {recordSearchQuery && (
            <button onClick={() => setRecordSearchQuery("")} className="absolute right-1 text-slate-400 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {setSearchMode && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-1.5 text-[9px] font-extrabold uppercase tracking-wider bg-slate-900/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 rounded-r rounded-l-none border-l-0 shrink-0 flex items-center gap-1"
                title="Search matching logic"
              >
                <span>{searchMode === "EXACT" ? "EXACT" : searchMode === "ANY" ? "ANY" : "MATCH..."}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-48 p-1.5 bg-slate-900 border-slate-700 text-slate-200 shadow-xl"
              align="end"
              container={isInPip ? capturedEventsPipWindow?.document.body : undefined}
            >
              <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 px-2 py-1 border-b border-slate-800 mb-1">
                Keyword Matching Mode
              </div>
              <button
                onClick={() => setSearchMode("ALL")}
                className={`w-full text-left px-2 py-1 rounded text-[10px] font-medium flex items-center justify-between hover:bg-slate-800 ${searchMode === "ALL" ? "text-blue-400 font-bold bg-blue-500/10" : "text-slate-300"}`}
              >
                <span>Match ALL (AND)</span>
                {searchMode === "ALL" && <Check className="w-3 h-3 text-blue-400" />}
              </button>
              <button
                onClick={() => setSearchMode("ANY")}
                className={`w-full text-left px-2 py-1 rounded text-[10px] font-medium flex items-center justify-between hover:bg-slate-800 ${searchMode === "ANY" ? "text-blue-400 font-bold bg-blue-500/10" : "text-slate-300"}`}
              >
                <span>Match ANY (OR)</span>
                {searchMode === "ANY" && <Check className="w-3 h-3 text-blue-400" />}
              </button>
              <button
                onClick={() => setSearchMode("EXACT")}
                className={`w-full text-left px-2 py-1 rounded text-[10px] font-medium flex items-center justify-between hover:bg-slate-800 ${searchMode === "EXACT" ? "text-blue-400 font-bold bg-blue-500/10" : "text-slate-300"}`}
              >
                <span>Exact Phrase</span>
                {searchMode === "EXACT" && <Check className="w-3 h-3 text-blue-400" />}
              </button>
            </PopoverContent>
          </Popover>
        )}

        <div className="h-4 w-px bg-slate-700 mx-0.5" />
        
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-1.5 text-[9px] font-bold bg-slate-900/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 rounded shrink-0 flex items-center gap-1"
                title="Records per page"
              >
                <span>{recordsLimit}..</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-32 p-1 bg-slate-900 border-slate-700 text-slate-200 shadow-xl"
              align="end"
              container={isInPip ? capturedEventsPipWindow?.document.body : undefined}
            >
              <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 px-2 py-1 border-b border-slate-800 mb-1">
                Page Size
              </div>
              {[25, 50, 100].map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    setRecordsLimit(size);
                    setRecordsOffset(0);
                  }}
                  className={`w-full text-left px-2 py-1 rounded text-[10px] font-medium flex items-center justify-between hover:bg-slate-800 ${recordsLimit === size ? "text-blue-400 font-bold bg-blue-500/10" : "text-slate-300"}`}
                >
                  <span>{size} records</span>
                  {recordsLimit === size && <Check className="w-3 h-3 text-blue-400" />}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-1.5 text-[9px] font-bold text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30"
            onClick={() => setRecordsOffset(Math.max(0, recordsOffset - recordsLimit))}
            disabled={recordsOffset === 0 || syncLoading}
            title="Previous page"
          >
            Prev
          </Button>
          <span className="text-[9px] font-mono text-slate-400 px-0.5">
            {totalRecords > 0 ? `${recordsOffset + 1}-${Math.min(recordsOffset + recordsLimit, totalRecords)}` : '0-0'}
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-1.5 text-[9px] font-bold text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30"
            onClick={() => setRecordsOffset(recordsOffset + recordsLimit)}
            disabled={recordsOffset + recordsLimit >= totalRecords || syncLoading}
            title="Next page"
          >
            Next
          </Button>
        </div>

        <div className="h-4 w-px bg-slate-700 mx-0.5" />
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-slate-700" title="Manage Columns">
              <SlidersHorizontal className="w-3 h-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-64 p-0 shadow-2xl border-slate-700 bg-slate-900 text-slate-200" 
            align="end"
            container={isInPip ? capturedEventsPipWindow?.document.body : undefined}
          >
            <div className="p-3 border-b border-slate-800 bg-slate-950/50">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Table Configuration</h3>
            </div>
            <ScrollArea className="h-[300px]">
              <div className="p-2 space-y-1">
                {columnSettings.map((col, idx) => {
                  const displayLabel = col.id === "elev" ? (isPipe ? "KP / FP" : "Elevation") : col.label;
                  return (
                    <div key={col.id} className="flex items-center gap-3 p-2 hover:bg-slate-800/50 rounded-md group/col transition-colors">
                      <div className="flex flex-col gap-1">
                        <button onClick={() => handleMoveColumn(idx, "up")} className="p-0.5 hover:text-blue-400 opacity-0 group-hover/col:opacity-100"><ChevronUp className="w-3 h-3" /></button>
                        <button onClick={() => handleMoveColumn(idx, "down")} className="p-0.5 hover:text-blue-400 opacity-0 group-hover/col:opacity-100"><ChevronDown className="w-3 h-3" /></button>
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <Checkbox checked={col.visible} onCheckedChange={() => toggleColumnVisibility(col.id)} />
                        <span className="text-[10px] font-bold uppercase tracking-tight">{displayLabel}</span>
                      </div>
                      <GripVertical className="w-3 h-3 text-slate-600 cursor-grab" />
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
        <Button 
          variant="ghost" 
          size="sm" 
          className={`h-6 ${isInPip ? "px-2 text-[9px] font-bold uppercase tracking-wider text-blue-400 hover:text-white bg-blue-500/20 hover:bg-blue-600 border border-blue-500/30" : "w-6 p-0 text-slate-400 hover:text-white hover:bg-slate-700"}`} 
          onClick={handlePopoutCapturedEvents}
          title={isInPip ? "Dock back to workspace" : "Pop out to floating window"}
        >
          {isInPip ? "Dock Back" : <Maximize2 className="w-3 h-3" />}
        </Button>
      </div>
    </div>
  );

  const renderTableContent = () => (
    <ScrollArea className="flex-1 w-full relative bg-white dark:bg-slate-950 overflow-auto custom-scrollbar">
      <div className="min-w-max inline-block align-middle">
        <table className="min-w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <tr>
              {activeTableColumns.map((col) => {
                const displayLabel = col.id === "elev" ? (isPipe ? "KP / FP" : "Elev") : col.label;
                return (
                  <th key={col.id} className="px-3 py-2 text-left text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] whitespace-nowrap cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => col.id !== "actions" && col.id !== "status" && handleSort(col.id)}>
                    <div className="flex items-center gap-1.5">
                      {displayLabel}
                      {sortConfig.key === col.id && (sortConfig.direction === "asc" ? <ChevronUp className="w-3 h-3 text-blue-500" /> : <ChevronDown className="w-3 h-3 text-blue-500" />)}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {displayRecords.map((r) => (
              <tr 
                key={r.insp_id} 
                ref={(el) => { rowRefs.current[r.insp_id] = el; }}
                className={`group cursor-pointer border-b border-slate-100 dark:border-slate-800/50 last:border-0 transition-colors ${selectedRowId === r.insp_id ? "bg-blue-50/80 dark:bg-blue-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-900"}`} 
                onDoubleClick={() => {
                  setSelectedRowId(r.insp_id);
                  handleEditRecord(r);
                }}
                onClick={() => setSelectedRowId(r.insp_id)}
              >
                {activeTableColumns.map((col) => {
                  switch (col.id) {

                    case "status":
                      return (
                        <td key={col.id} className="px-3 py-3 align-top text-center">
                          <div className="flex flex-col items-center gap-1.5 mt-0.5">
                            {r.has_anomaly ? (
                              <div title="Anomaly/Finding Found" className="flex items-center justify-center h-6 w-6 rounded-full bg-red-100"><AlertCircle className="w-3.5 h-3.5 text-red-600" /></div>
                            ) : r.status === "COMPLETED" ? (
                              <div title="Completed Inspection" className="flex items-center justify-center h-6 w-6 rounded-full bg-green-100"><CheckCircle2 className="w-3.5 h-3.5 text-green-600" /></div>
                            ) : (
                              <div title="Incomplete / Draft" className="flex items-center justify-center h-6 w-6 rounded-full bg-amber-100"><FileClock className="w-3.5 h-3.5 text-amber-600" /></div>
                            )}
                            {(r.attachment_count > 0 || (r.insp_media && r.insp_media[0]?.count > 0)) && (
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full hover:bg-blue-50 text-blue-500" onClick={async () => {
                                const { data } = await supabase.from("attachment").select("*").eq("source_id", r.insp_id).in("source_type", ["inspection", "INSPECTION"]);
                                if (data) setViewingRecordAttachments(data);
                              }}><Paperclip className="w-3 h-3" /></Button>
                            )}
                          </div>
                        </td>
                      );
                    case "inspection_date":
                      return (
                        <td key={col.id} className="px-3 py-3 text-slate-600 dark:text-slate-300 align-top">
                          <div className="text-sm font-medium">
                            {(() => {
                              if (!r.inspection_date) return "-";
                              const dStr = String(r.inspection_date).trim().split('T')[0];
                              const match = dStr.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
                              if (match) {
                                const year = match[1];
                                const monthIdx = parseInt(match[2], 10) - 1;
                                const day = match[3].padStart(2, '0');
                                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                                return `${day} ${monthNames[monthIdx] || match[2]} ${year}`;
                              }
                              const dateObj = new Date(r.inspection_date);
                              return !isNaN(dateObj.getTime()) ? format(dateObj, "dd MMM yyyy") : r.inspection_date;
                            })()}
                          </div>
                          <div className="text-[10px] opacity-70 mt-0.5">
                            {r.inspection_time ? r.inspection_time.slice(0, 5) : "-"}
                          </div>
                        </td>
                      );
                    case "event_name":
                      return (
                        <td key={col.id} className="px-3 py-3 align-top font-bold text-slate-800 dark:text-slate-100">
                          <span className="text-xs">{r.inspection_data?.event_name || r.inspection_data?.actionName || "-"}</span>
                        </td>
                      );
                    case "event_type":
                      return (
                        <td key={col.id} className="px-3 py-3 align-top text-slate-700 dark:text-slate-200">
                          <span className="text-xs font-semibold">{r.inspection_data?.event_type || r.inspection_type?.name || r.inspection_type_code || "-"}</span>
                        </td>
                      );
                    case "event_position":
                      return (
                        <td key={col.id} className="px-3 py-3 align-top text-slate-700 dark:text-slate-200">
                          <span className="text-xs">{r.inspection_data?.event_position || r.inspection_data?.eventCategory || "-"}</span>
                        </td>
                      );
                    case "event_description":
                      return (
                        <td key={col.id} className="px-3 py-3 align-top text-slate-600 dark:text-slate-300">
                          <span className="text-xs line-clamp-2 max-w-[280px]" title={r.inspection_data?.event_description || r.description || r.inspection_data?.findings}>
                            {r.inspection_data?.event_description || r.description || r.inspection_data?.findings || "-"}
                          </span>
                        </td>
                      );
                    case "type":
                      return (
                        <td key={col.id} className="px-3 py-3 font-bold text-slate-800 dark:text-slate-100 align-top">
                          <div className="truncate max-w-[200px] text-sm" title={r.inspection_type?.name}>{r.inspection_type?.name || "UNK"}</div>
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-medium w-fit uppercase text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-800 shadow-none mt-1">{r.inspection_type_code || r.inspection_type?.code || "UNK"}</Badge>
                        </td>
                      );
                    case "component":
                      return (
                        <td key={col.id} className="px-3 py-3 align-top text-slate-700 dark:text-slate-200">
                          <div className="font-bold text-sm">{r.structure_components?.q_id || "-"}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-400 font-bold uppercase tracking-tight mt-0.5">{r.component_type || r.structure_components?.code || "-"}</div>
                        </td>
                      );
                    case "elev": {
                      const kpVal = r.fp_kp ?? r.kp ?? r.inspection_data?.fp_kp ?? r.inspection_data?.kp ?? r.inspection_data?.kp_value ?? r.inspection_data?.kp_fp;
                      const elevVal = r.elevation ?? r.inspection_data?.elevation;
                      if (isPipe) {
                        return (
                          <td key={col.id} className="px-3 py-3 text-center text-sm font-medium text-slate-600 dark:text-slate-300 align-top">
                            {kpVal !== undefined && kpVal !== null && kpVal !== "" ? (
                              <span className="font-mono text-xs font-semibold">{kpVal}</span>
                            ) : elevVal ? (
                              <span>{elevVal}m</span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">-</span>
                            )}
                          </td>
                        );
                      }
                      return (
                        <td key={col.id} className="px-3 py-3 text-center text-sm font-medium text-slate-600 dark:text-slate-300 align-top">
                          {elevVal !== undefined && elevVal !== null && elevVal !== "" ? (
                            <span>{elevVal}m</span>
                          ) : kpVal !== undefined && kpVal !== null && kpVal !== "" ? (
                            <span className="font-mono text-xs font-semibold">{kpVal}</span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">-</span>
                          )}
                        </td>
                      );
                    }
                    case "anomaly_ref":
                      return (
                        <td key={col.id} className="px-3 py-3 align-top text-slate-700 dark:text-slate-300">
                          {r.insp_anomalies?.[0]?.anomaly_ref_no ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950/20 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-900/50 w-fit">{r.insp_anomalies[0].anomaly_ref_no}</span>
                              {r.insp_anomalies[0].priority_code && (
                                <span className={`text-[10px] font-black text-white px-1.5 py-0.5 rounded shadow-sm w-fit uppercase tracking-wider ${r.insp_anomalies[0].priority_code.includes("1") ? "bg-red-600" : r.insp_anomalies[0].priority_code.includes("2") ? "bg-orange-500" : r.insp_anomalies[0].priority_code.includes("3") ? "bg-yellow-500 text-black" : r.insp_anomalies[0].priority_code.includes("4") ? "bg-blue-500" : r.insp_anomalies[0].priority_code.includes("5") ? "bg-slate-500" : "bg-slate-900"}`}>{r.insp_anomalies[0].priority_code}</span>
                              )}
                            </div>
                          ) : <span className="text-slate-300 dark:text-slate-600">-</span>}
                        </td>
                      );
                    case "cp_reading":
                      return <td key={col.id} className="px-3 py-3 text-center text-sm font-medium text-slate-600 dark:text-slate-300 align-top">{(() => { const cp = r.inspection_data?.cp_rdg ?? r.inspection_data?.cp_reading_mv ?? r.inspection_data?.cp; return cp ? <span className="font-mono text-xs">{cp}</span> : <span className="text-slate-300 dark:text-slate-600">-</span>; })()}</td>;
                    case "dive_no":
                      return <td key={col.id} className="px-3 py-3 align-top text-slate-700 dark:text-slate-200"><span className="text-xs font-medium">{r.insp_dive_jobs?.job_no || r.insp_rov_jobs?.job_no || <span className="text-slate-300 dark:text-slate-600">-</span>}</span></td>;
                    case "tape_no": {
                      const counterDisplay = r.inspection_data?._meta_timecode || r.inspection_data?.counter_no || r.inspection_data?.counter || r.inspection_data?.timecode || r.tape_count_no;
                      return (
                        <td key={col.id} className="px-3 py-3 align-top text-slate-700 dark:text-slate-200">
                          <span className="text-xs font-medium">{r.insp_video_tapes?.tape_no || <span className="text-slate-300 dark:text-slate-600">-</span>}</span>
                          {counterDisplay && <div className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" />{formatCounter(counterDisplay)}</div>}
                        </td>
                      );
                    }
                    default: return null;
                  }
                })}
              </tr>
            ))}
            {displayRecords.length === 0 && (
              <tr><td colSpan={activeTableColumns.length} className="px-3 py-12 text-center bg-white/50">{syncLoading ? <div className="flex flex-col items-center gap-3 animate-in fade-in duration-500"><div className="relative"><div className="absolute inset-0 blur-sm bg-blue-400/20 rounded-full animate-pulse" /><Loader2 className="w-8 h-8 animate-spin text-blue-600 relative" /></div><div className="flex flex-col gap-1"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Synchronizing</span><span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Fetching live workspace data...</span></div></div> : <div className="flex flex-col items-center gap-2 text-slate-300"><Search className="w-8 h-8 opacity-20" /><div className="flex flex-col gap-1"><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inventory Empty</span><p className="text-[9px] font-bold text-slate-400/60 uppercase tracking-tighter">No events match your current filter or session</p></div></div>}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );

  return (
    <Card className="flex flex-col h-full border-none shadow-none rounded-none bg-white dark:bg-slate-900/60 overflow-hidden shrink-0">
      {capturedEventsPipWindow ? (
        <>
          <div className="bg-slate-800 dark:bg-slate-900/80 text-white px-3 py-2 text-[10px] font-black uppercase tracking-widest flex justify-between items-center h-[36px] shrink-0 border-b dark:border-slate-700 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span>CAPTURED EVENTS</span>
              <Badge className="bg-blue-600 text-white border-none text-[9px] h-4 leading-none font-bold uppercase tracking-wider flex items-center gap-1.5">
                {syncLoading && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                {recordSearchQuery ? `${displayRecords.length} / ${totalRecords || sortedRecords.length}` : (totalRecords || sortedRecords.length)} Total
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[9px] font-bold text-amber-400 border-amber-500/30 bg-amber-500/10">
                FLOATING WINDOW ACTIVE
              </Badge>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[9px] font-bold text-blue-400 hover:text-blue-300 hover:bg-blue-500/20" onClick={handlePopoutCapturedEvents}>
                Dock Back
              </Button>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400">
            <div className="p-3 rounded-full bg-blue-500/10 text-blue-500 mb-3 border border-blue-500/20 animate-pulse">
              <Maximize2 className="w-6 h-6" />
            </div>
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">
              Captured Events Popped Out
            </h4>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1 max-w-xs leading-relaxed">
              The Captured Events table is active in an extended floating window. Updates to records refresh automatically.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4 text-[10px] font-bold uppercase tracking-wider bg-blue-600/10 hover:bg-blue-600 text-blue-600 dark:text-blue-400 hover:text-white border-blue-500/30 transition-all"
              onClick={handlePopoutCapturedEvents}
            >
              Dock Back To Workspace
            </Button>
          </div>
          {createPortal(
            <div className="w-full h-full flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans select-none">
              {renderHeaderToolbar(true)}
              {renderTableContent()}
            </div>,
            capturedEventsPipWindow.document.body
          )}
        </>
      ) : (
        <>
          {renderHeaderToolbar(false)}
          {renderTableContent()}
        </>
      )}
    </Card>
  );
}
