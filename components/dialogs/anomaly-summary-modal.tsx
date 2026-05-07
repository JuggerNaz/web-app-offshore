"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AnomalySummaryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anomalies: any[];
};

export function AnomalySummaryModal({
  open,
  onOpenChange,
  anomalies,
}: AnomalySummaryModalProps) {
  const getPriorityBadgeColor = (priority: string | null) => {
    if (!priority) return "bg-slate-700 text-slate-300";
    const p = priority.toUpperCase();
    if (p === "PRIORITY 1" || p === "1" || p === "P1" || p === "HIGH" || p === "CRITICAL")
      return "bg-red-500/20 text-red-500 border border-red-500/30";
    if (p === "PRIORITY 2" || p === "2" || p === "P2" || p === "MEDIUM")
      return "bg-yellow-500/20 text-yellow-500 border border-yellow-500/30";
    if (p === "PRIORITY 3" || p === "3" || p === "P3" || p === "LOW")
      return "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30";
    if (p === "OBS" || p === "OBSERVATION" || p === "O")
      return "bg-orange-500/20 text-orange-500 border border-orange-500/30";
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

  // Group anomalies by jobpack_name — mirrors the anomalies & findings page grouping
  const grouped = anomalies.reduce((acc: Record<string, any[]>, anomaly: any) => {
    const key = anomaly.jobpack_name || "Unassigned";
    if (!acc[key]) acc[key] = [];
    acc[key].push(anomaly);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-slate-950 border-slate-800 text-slate-200">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white mb-2">
            Anomaly Summaries
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-8">
          {anomalies.length === 0 ? (
            <div className="text-slate-400">No anomalies found.</div>
          ) : (
            Object.entries(grouped).map(([jobpackName, items]) => (
              <div key={jobpackName}>
                {/* Jobpack name header — matches the anomalies & findings page layout */}
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-800 pb-2 mb-4">
                  {jobpackName}
                </h3>

                <div className="space-y-4">
                  {(items as any[]).map((anomaly: any, idx: number) => {
                    const priorityVal = anomaly.priority_code || anomaly.priority;
                    return (
                      <div key={idx} className="bg-slate-900 border border-slate-800 rounded-lg p-5 relative overflow-hidden">
                        {/* Coloured left accent border */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${getPriorityLeftBorderColor(priorityVal)}`} />

                        <div className="flex flex-col gap-2 w-full pl-1">
                          {/* Ref number + priority badge */}
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-sm font-semibold text-white px-3 py-1 bg-slate-800 rounded-full border border-slate-700 font-mono">
                              {anomaly.display_ref_no || "N/A"}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getPriorityBadgeColor(priorityVal)}`}>
                              {priorityVal || "N/A"}
                            </span>
                          </div>

                          {/* Defect type as title */}
                          <div className="text-base font-bold text-white mt-1">
                            {anomaly.defect_type_code || anomaly.defect_type || "Unknown Defect Type"}
                          </div>

                          {/* Category in italics */}
                          <div className="text-sm text-slate-300 italic">
                            &quot;{anomaly.defect_category_code || anomaly.category || "N/A"}&quot;
                          </div>
                        </div>

                        {/* Description */}
                        {anomaly.description && (
                          <div className="mt-4 pt-4 border-t border-slate-800">
                            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Description</div>
                            <div className="text-sm text-slate-300 whitespace-pre-wrap">{anomaly.description}</div>
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
