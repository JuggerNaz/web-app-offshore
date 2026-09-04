"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";

type AnomalySummaryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anomalies: any[];
  onAnomalyClick?: (anomaly: any) => void;
};

// Natural alphanumeric sorting helper (e.g., 15/SKOPL381/A-004 before 15/SKOPL381/A-005)
function naturalCompare(aStr: string, bStr: string): number {
  return aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: "base" });
}

export function AnomalySummaryModal({
  open,
  onOpenChange,
  anomalies,
  onAnomalyClick,
}: AnomalySummaryModalProps) {
  const getPriorityBadgeColor = (priority: string | null) => {
    if (!priority) return "bg-slate-700 text-slate-300";
    const p = priority.toUpperCase();
    if (p === "PRIORITY 1" || p === "1" || p === "P1" || p === "HIGH" || p === "CRITICAL")
      return "bg-red-500/20 text-red-400 border border-red-500/30";
    if (p === "PRIORITY 2" || p === "2" || p === "P2" || p === "MEDIUM")
      return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
    if (p === "PRIORITY 3" || p === "3" || p === "P3" || p === "LOW")
      return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    if (p === "OBS" || p === "OBSERVATION" || p === "O")
      return "bg-orange-500/20 text-orange-400 border border-orange-500/30";
    return "bg-slate-700 text-slate-300 border border-slate-600";
  };

  const getPriorityLeftBorderColor = (priority: string | null) => {
    if (!priority) return "bg-slate-600";
    const p = priority.toUpperCase();
    if (p === "PRIORITY 1" || p === "1" || p === "P1" || p === "HIGH" || p === "CRITICAL") return "bg-red-500";
    if (p === "PRIORITY 2" || p === "2" || p === "P2" || p === "MEDIUM") return "bg-yellow-500";
    if (p === "PRIORITY 3" || p === "3" || p === "P3" || p === "LOW") return "bg-emerald-500";
    if (p === "OBS" || p === "OBSERVATION" || p === "O") return "bg-orange-500";
    return "bg-slate-600";
  };

  // 1. Deduplicate anomalies by anomaly_id or display_ref_no
  // 2. Group by jobpack_name
  // 3. Sort each group ascending by defect reference number (display_ref_no)
  const groupedAndSorted = useMemo(() => {
    const seen = new Set<string>();
    const uniqueAnomalies: any[] = [];

    (anomalies || []).forEach((a) => {
      const key = a.anomaly_id 
        ? `id_${a.anomaly_id}` 
        : `${a.display_ref_no || ''}_${a.defect_type || a.defect_type_code || ''}_${a.description || ''}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        uniqueAnomalies.push(a);
      }
    });

    const groups = uniqueAnomalies.reduce((acc: Record<string, any[]>, anomaly: any) => {
      const key = anomaly.jobpack_name || "Unassigned Job Pack";
      if (!acc[key]) acc[key] = [];
      acc[key].push(anomaly);
      return acc;
    }, {});

    // Sort items within each jobpack group by defect reference number
    Object.keys(groups).forEach((jobpackKey) => {
      groups[jobpackKey].sort((a: any, b: any) => {
        const refA = String(a.display_ref_no || a.anomaly_ref_no || "");
        const refB = String(b.display_ref_no || b.anomaly_ref_no || "");
        if (refA && refB) {
          return naturalCompare(refA, refB);
        }
        return (Number(a.anomaly_id) || 0) - (Number(b.anomaly_id) || 0);
      });
    });

    return groups;
  }, [anomalies]);

  const totalUniqueCount = useMemo(() => {
    return Object.values(groupedAndSorted).reduce((sum, items) => sum + items.length, 0);
  }, [groupedAndSorted]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-slate-950 border-slate-800 text-slate-200 p-0 rounded-[1.5rem] shadow-2xl">
        <DialogHeader className="px-6 py-5 border-b border-slate-800/80 bg-slate-900/50 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              Anomaly Summaries
            </DialogTitle>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              {totalUniqueCount} unique recorded defect(s)
            </p>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-8">
          {totalUniqueCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <AlertTriangle className="h-8 w-8 text-slate-700 mb-2 stroke-[1.5]" />
              <p className="font-black uppercase tracking-widest text-xs">No Anomalies Found</p>
            </div>
          ) : (
            Object.entries(groupedAndSorted).map(([jobpackName, items]) => (
              <div key={jobpackName}>
                {/* Jobpack name header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 font-mono">
                    {jobpackName}
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
                    {items.length} {items.length === 1 ? "Defect" : "Defects"}
                  </span>
                </div>

                <div className="space-y-4">
                  {(items as any[]).map((anomaly: any, idx: number) => {
                    const priorityVal = anomaly.priority_code || anomaly.priority;
                    return (
                      <div 
                        key={anomaly.anomaly_id || idx} 
                        onClick={() => onAnomalyClick?.(anomaly)}
                        className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 relative overflow-hidden cursor-pointer hover:border-slate-600 transition-all hover:shadow-lg active:scale-[0.99]"
                      >
                        {/* Coloured left accent border */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${getPriorityLeftBorderColor(priorityVal)}`} />

                        <div className="flex flex-col gap-2 w-full pl-1.5">
                          {/* Ref number + priority badge */}
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-xs font-bold text-white px-3 py-1 bg-slate-800 rounded-lg border border-slate-700 font-mono">
                              {anomaly.display_ref_no || anomaly.anomaly_ref_no || "N/A"}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${getPriorityBadgeColor(priorityVal)}`}>
                              {priorityVal || "N/A"}
                            </span>
                          </div>

                          {/* Defect type as title */}
                          <div className="text-base font-black text-white mt-1">
                            {anomaly.defect_type_code || anomaly.defect_type || "Unknown Defect Type"}
                          </div>

                          {/* Category in italics */}
                          {(anomaly.defect_category_code || anomaly.category) && (
                            <div className="text-xs text-slate-300 italic">
                              &quot;{anomaly.defect_category_code || anomaly.category}&quot;
                            </div>
                          )}
                        </div>

                        {/* Description */}
                        {anomaly.description && (
                          <div className="mt-3.5 pt-3.5 border-t border-slate-800/80">
                            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1">Description</div>
                            <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{anomaly.description}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
