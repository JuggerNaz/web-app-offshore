"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { History, FileText, AlertCircle, CheckCircle2, FileClock } from "lucide-react";

interface HistoryDataPanelProps {
  historicalRecords: any[];
  historyLoading: boolean;
  handleEditRecord: (rec: any) => void;
}

export function HistoryDataPanel({
  historicalRecords,
  historyLoading,
  handleEditRecord
}: HistoryDataPanelProps) {
  return (
    <Card className="flex flex-col h-full border-none shadow-none rounded-none bg-white dark:bg-slate-900/60 overflow-hidden">
      <div className="bg-slate-800 text-white px-3 py-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shrink-0">
        <History className="w-3.5 h-3.5 text-slate-400" />
        <span>HISTORICAL DATA</span>
        {historicalRecords.length > 0 && (
          <span className="ml-auto bg-slate-700 px-1.5 py-0.5 rounded text-[8px]">
            {historicalRecords.length} Records
          </span>
        )}
      </div>

      <ScrollArea className="flex-1 bg-slate-50/50 dark:bg-slate-950/20">
        {historyLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent mb-2" />
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading History...</div>
          </div>
        ) : historicalRecords.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-2 opacity-30">
            <FileText className="w-8 h-8 text-slate-400" />
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">No History Found</div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter max-w-[150px]">
              No previous inspection records for this component
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {historicalRecords.map((r, i) => (
              <div
                key={r.insp_id || i}
                onClick={() => handleEditRecord(r)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer group shadow-sm"
              >
                <div className="flex justify-between items-start mb-1.5">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase truncate max-w-[180px]">
                      {r.inspection_type?.name || "Unknown Inspection"}
                    </span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                      {r.sow_report_no || "N/A"} • {r.cr_date ? format(new Date(r.cr_date), "dd MMM yyyy") : "No Date"}
                    </span>
                  </div>
                  {r.has_anomaly ? (
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                  ) : r.status === "COMPLETED" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <FileClock className="w-3.5 h-3.5 text-amber-500" />
                  )}
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-1.5 text-[9px] text-slate-600 dark:text-slate-400 font-medium line-clamp-2 italic">
                  {r.inspection_data?.observation || r.inspection_data?.findings || "No remarks provided."}
                </div>
                
                {r.insp_anomalies?.[0]?.anomaly_ref_no && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[8px] font-black bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 uppercase">
                      {r.insp_anomalies[0].anomaly_ref_no}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}
