"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { 
  History, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  FileClock, 
  Eye, 
  Printer, 
  Download, 
  X, 
  Tag, 
  Layers, 
  Ruler, 
  ShieldAlert,
  Calendar,
  User,
  Sliders,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { generateDefectAnomalyReport } from "@/utils/report-generators/defect-anomaly-report";
import { cn } from "@/lib/utils";

interface HistoryDataPanelProps {
  selectedComp?: any;
  historicalRecords: any[];
  historyLoading: boolean;
  handleEditRecord: (rec: any) => void;
  allInspectionTypes?: any[];
  jobPackId?: string | number | null;
  structureId?: string | number | null;
}

export function HistoryDataPanel({
  selectedComp,
  historicalRecords = [],
  historyLoading,
  handleEditRecord,
  allInspectionTypes = [],
  jobPackId,
  structureId
}: HistoryDataPanelProps) {
  const [previewRecord, setPreviewRecord] = useState<any | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Extract component metadata for display
  const compQId = selectedComp?.q_id || selectedComp?.name || selectedComp?.code || "Unassigned";
  const compType = selectedComp?.type || selectedComp?.code || "Component";
  const compElev = selectedComp?.elevation || selectedComp?.metadata?.elevation || "N/A";
  const compGroup = selectedComp?.structure_group || selectedComp?.metadata?.structure_group || "N/A";
  const compWT = selectedComp?.wall_thickness || selectedComp?.metadata?.wall_thickness || selectedComp?.wt || "N/A";

  const handleDownloadPdf = async (record: any) => {
    try {
      setIsGeneratingPdf(true);
      toast.info("Generating Anomaly Report PDF...");

      const fullConfig: any = {
        reportTitle: "DEFECT / ANOMALY REPORT",
        reportYear: new Date().getFullYear().toString(),
        preparedBy: "Offshore Inspector",
        watermark: { enabled: false, text: "", transparency: 0.1 },
        showContractorLogo: true,
        showPageNumbers: true,
        inspectionId: record.insp_id || record.id,
        anomalyId: record.insp_anomalies?.[0]?.anomaly_id || record.anomaly_id,
        returnBlob: false,
        printFriendly: false,
        showSignatures: true
      };

      const doc: any = await generateDefectAnomalyReport(
        { id: record.jobpack_id || jobPackId || "0", jobpack_name: record.jobpack_name || record.campaign_name || "Historical Campaign" },
        { id: record.structure_id || structureId || "0" },
        record.sow_report_no || "",
        {} as any,
        fullConfig
      );

      const refNo = record.insp_anomalies?.[0]?.anomaly_ref_no || record.anomaly_ref_no || `REC_${record.insp_id || 'HIST'}`;
      if (doc && typeof doc.save === "function") {
        doc.save(`Anomaly_Report_${refNo}.pdf`);
      }
      toast.success("Anomaly Report PDF generated successfully!");
    } catch (err) {
      console.error("PDF Generation error:", err);
      toast.error("Failed to generate PDF report.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrintReport = (record: any) => {
    setPreviewRecord(record);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <Card className="flex flex-col h-full border-none shadow-none rounded-none bg-white dark:bg-slate-900 overflow-hidden relative">
      {/* PANEL HEADER */}
      <div className="bg-slate-800 text-white px-3 py-2.5 text-[10px] font-black uppercase tracking-widest flex items-center justify-between shrink-0 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-cyan-400" />
          <span>HISTORICAL INSPECTION DATA</span>
        </div>
        {historicalRecords.length > 0 && (
          <span className="bg-cyan-950 text-cyan-300 border border-cyan-700/50 px-2 py-0.5 rounded text-[8px] font-black">
            {historicalRecords.length} {historicalRecords.length === 1 ? "Record" : "Records"}
          </span>
        )}
      </div>

      {/* SELECTED COMPONENT HEADER BANNER */}
      {selectedComp && (
        <div className="bg-slate-950/80 border-b border-slate-800 p-2.5 flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-100">
                {compQId}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                {compType}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[9px] font-bold text-slate-400 bg-slate-900/90 p-1.5 rounded-lg border border-slate-800">
            <div>
              <span className="text-slate-500 block text-[7.5px] uppercase">Group:</span>
              <span className="text-slate-200 truncate block">{compGroup}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[7.5px] uppercase">Elevation:</span>
              <span className="text-slate-200 block">{compElev !== "N/A" ? `${compElev} m` : "N/A"}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[7.5px] uppercase">Wall Thickness:</span>
              <span className="text-slate-200 block">{compWT !== "N/A" ? `${compWT} mm` : "N/A"}</span>
            </div>
          </div>
        </div>
      )}

      {/* HISTORICAL RECORDS LIST */}
      <ScrollArea className="flex-1 bg-slate-950/40 p-2">
        {historyLoading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-cyan-500 border-t-transparent mb-3" />
            <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Fetching Component History...</div>
          </div>
        ) : !selectedComp ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3 text-slate-500">
            <Layers className="w-10 h-10 text-slate-600 animate-bounce" />
            <div className="text-xs font-black uppercase tracking-wider text-slate-300">No Component Selected</div>
            <p className="text-[10px] text-slate-400 max-w-[220px] leading-relaxed">
              Select a component from the 3D viewer or component list to inspect its historical data & anomaly records.
            </p>
          </div>
        ) : historicalRecords.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-2 opacity-50">
            <FileText className="w-10 h-10 text-slate-500" />
            <div className="text-xs font-black uppercase tracking-widest text-slate-400">No History Found</div>
            <p className="text-[9.5px] text-slate-500 max-w-[200px]">
              No previous inspection records recorded for <strong className="text-slate-300">{compQId}</strong>.
            </p>
          </div>
        ) : (
          <div className="space-y-3 p-1">
            {historicalRecords.map((r, i) => {
              const tCode = r.inspection_type_code || r.inspection_type?.code || r.task_code || "";
              const matchedType = (allInspectionTypes || []).find((t: any) => t.code === tCode || t.name === tCode);
              const taskName = matchedType?.name || r.inspection_type?.name || tCode || "Inspection Task";

              const isAnomaly = Boolean(r.has_anomaly || (r.insp_anomalies && r.insp_anomalies.length > 0));
              const anomalyObj = r.insp_anomalies?.[0] || r.anomaly || {};
              const anomalyRef = anomalyObj.anomaly_ref_no || r.anomaly_ref_no;
              const anomalyPriority = anomalyObj.priority || anomalyObj.severity || r.priority || "Observation";
              const anomalyDefect = anomalyObj.defect_code || anomalyObj.category || r.defect_code || "General Finding";
              const anomalyDesc = anomalyObj.description || anomalyObj.remarks || r.anomaly_desc;

              const jobpackName = r.jobpack_name || r.campaign_name || r.jobpack_no || (r.jobpack_id ? `Jobpack #${r.jobpack_id}` : "Historical Campaign");
              const dateFormatted = r.inspection_date ? r.inspection_date : r.cr_date ? format(new Date(r.cr_date), "dd/MM/yyyy") : "Date N/A";
              const modeLabel = (r.mode || r.campaign_mode || r.jobpack_mode || "ROV").toUpperCase();

              const dataMap = r.inspection_data || {};
              const remarksText = dataMap.observation || dataMap.findings || r.notes || r.remarks || "No remarks recorded.";

              return (
                <div
                  key={r.insp_id || i}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg hover:border-slate-700 transition-all flex flex-col gap-2.5"
                >
                  {/* CARD HEADER: Jobpack & Date */}
                  <div className="flex items-start justify-between border-b border-slate-800/80 pb-2 gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-black uppercase text-cyan-300 tracking-wider flex items-center gap-1">
                        <Tag className="w-3 h-3 text-cyan-400 shrink-0" />
                        {jobpackName}
                      </span>
                      <span className="text-[8.5px] font-bold text-slate-400 font-mono">
                        📅 {dateFormatted} {r.sow_report_no ? `• Report #${r.sow_report_no}` : ""}
                      </span>
                    </div>

                    <span className={cn(
                      "px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider border shrink-0",
                      isAnomaly ? "bg-rose-500/20 text-rose-300 border-rose-500/40" :
                      r.status === "COMPLETED" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" :
                      "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    )}>
                      {isAnomaly ? "Anomaly" : r.status === "COMPLETED" ? "Completed" : "Incomplete"}
                    </span>
                  </div>

                  {/* TASK NAME & METHOD */}
                  <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                    <span className="truncate pr-2">{taskName}</span>
                    <span className={cn(
                      "px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-widest shrink-0 border",
                      modeLabel.includes("DIV") ? "bg-purple-950 text-purple-300 border-purple-800" : "bg-cyan-950 text-cyan-300 border-cyan-800"
                    )}>
                      {modeLabel}
                    </span>
                  </div>

                  {/* REMARKS & MEASUREMENTS */}
                  <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-850 text-[9.5px] text-slate-300 space-y-1">
                    <p className="line-clamp-2 italic text-slate-400 leading-relaxed">
                      "{remarksText}"
                    </p>

                    {/* Key Measurements Checklist if present */}
                    {(dataMap.scour_depth || dataMap.cp_fg || dataMap.wall_thickness || dataMap.exposure_length) && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/60 text-[8.5px] font-mono text-slate-300">
                        {dataMap.scour_depth && (
                          <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            Scour: <strong className="text-cyan-300">{dataMap.scour_depth} mm</strong>
                          </span>
                        )}
                        {dataMap.cp_fg && (
                          <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            CP: <strong className="text-emerald-300">{dataMap.cp_fg} mV</strong>
                          </span>
                        )}
                        {dataMap.wall_thickness && (
                          <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            WT: <strong className="text-amber-300">{dataMap.wall_thickness} mm</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ANOMALY DETAILS BOX (IF ANOMALY EXISTS) */}
                  {isAnomaly && (
                    <div className="bg-rose-950/30 border border-rose-800/60 rounded-lg p-2.5 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider">
                        <span className="text-rose-400 flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          {anomalyRef || "Recorded Anomaly"}
                        </span>
                        <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1.5 py-0.2 rounded">
                          {anomalyPriority}
                        </span>
                      </div>

                      <div className="text-[9.5px] font-bold text-rose-200">
                        Category: <span className="text-white font-normal">{anomalyDefect}</span>
                      </div>

                      {anomalyDesc && (
                        <p className="text-[9px] text-rose-200/90 leading-normal line-clamp-2">
                          {anomalyDesc}
                        </p>
                      )}
                    </div>
                  )}

                  {/* ACTION BUTTONS TOOLBAR */}
                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditRecord(r)}
                      className="h-6 px-2 text-[9px] font-bold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800"
                    >
                      <Eye className="w-3 h-3 mr-1 text-blue-400" />
                      Edit Form
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewRecord(r)}
                      className="h-6 px-2 text-[9px] font-bold uppercase tracking-wider text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900 border-cyan-800/60"
                    >
                      <FileText className="w-3 h-3 mr-1 text-cyan-400" />
                      Preview Report
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleDownloadPdf(r)}
                      disabled={isGeneratingPdf}
                      className="h-6 px-2 text-[9px] font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      PDF
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* REPORT PREVIEW & PRINT MODAL */}
      {previewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden text-slate-100">
            {/* MODAL HEADER */}
            <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  Historical Inspection & Anomaly Report Preview
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePrintReport(previewRecord)}
                  className="h-7 text-[10px] font-bold bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                >
                  <Printer className="w-3.5 h-3.5 mr-1 text-amber-400" />
                  Print
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleDownloadPdf(previewRecord)}
                  disabled={isGeneratingPdf}
                  className="h-7 text-[10px] font-bold bg-rose-600 hover:bg-rose-500 text-white"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Save PDF
                </Button>
                <button
                  onClick={() => setPreviewRecord(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* PRINTABLE REPORT CONTENT BODY */}
            <ScrollArea className="flex-1 p-6 bg-slate-950/50 print:bg-white print:text-black">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 print:border-none print:shadow-none print:p-0">
                {/* REPORT HEADER BRANDING */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-cyan-400">
                      OFFSHORE INSPECTION REPORT
                    </h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">
                      Component Historical Inspection Summary
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-black uppercase bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded">
                      Report #: {previewRecord.sow_report_no || "N/A"}
                    </span>
                  </div>
                </div>

                {/* COMPONENT & CAMPAIGN GRID */}
                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/90 p-3 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase block">Component QID:</span>
                    <strong className="text-white text-sm">{compQId}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase block">Campaign / Jobpack:</span>
                    <strong className="text-cyan-300">
                      {previewRecord.jobpack_name || previewRecord.campaign_name || previewRecord.jobpack_no || "Historical Campaign"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase block">Structure Group / Elevation:</span>
                    <span className="text-slate-300 font-medium">{compGroup} • Elev {compElev} m</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase block">Inspection Date & Mode:</span>
                    <span className="text-slate-300 font-medium">{previewRecord.inspection_date || "N/A"} ({previewRecord.mode || "ROV"})</span>
                  </div>
                </div>

                {/* INSPECTION TASK SPECIFICATION */}
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1">
                    Task Specification
                  </h4>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-200 bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                    <span>
                      {(allInspectionTypes || []).find((t: any) => t.code === (previewRecord.inspection_type_code || previewRecord.task_code))?.name || previewRecord.task_code || "General Inspection"}
                    </span>
                    <span className="text-emerald-400 text-[10px] font-black uppercase">
                      Status: {previewRecord.status || "COMPLETED"}
                    </span>
                  </div>
                </div>

                {/* ANOMALY REPORT SECTION */}
                {(previewRecord.has_anomaly || previewRecord.insp_anomalies?.length > 0) && (
                  <div className="space-y-2 pt-2">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-rose-400 flex items-center gap-1 border-b border-slate-800 pb-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                      Recorded Anomaly Details
                    </h4>
                    <div className="bg-rose-950/20 border border-rose-800/70 rounded-xl p-3.5 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-rose-300 font-black">
                          Ref #: {previewRecord.insp_anomalies?.[0]?.anomaly_ref_no || previewRecord.anomaly_ref_no || "N/A"}
                        </span>
                        <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                          {previewRecord.insp_anomalies?.[0]?.priority || previewRecord.priority || "Observation"}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300">
                        <strong className="text-rose-200">Category / Defect: </strong>
                        {previewRecord.insp_anomalies?.[0]?.defect_code || previewRecord.defect_code || "General Defect"}
                      </div>
                      {previewRecord.insp_anomalies?.[0]?.description && (
                        <div className="text-xs text-slate-300 bg-slate-950/80 p-2.5 rounded-lg border border-slate-850 leading-relaxed">
                          {previewRecord.insp_anomalies[0].description}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* OBSERVATIONS & REMARKS */}
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1">
                    Inspection Findings & Remarks
                  </h4>
                  <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-850 leading-relaxed italic">
                    "{previewRecord.inspection_data?.observation || previewRecord.inspection_data?.findings || previewRecord.notes || previewRecord.remarks || "No remarks provided."}"
                  </p>
                </div>

                {/* SIGNATURE / VERIFICATION BLOCK */}
                <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-6 text-[10px]">
                  <div className="border border-slate-800 p-2.5 rounded-lg flex flex-col gap-4">
                    <span className="font-bold text-slate-400 uppercase">Inspected By:</span>
                    <div className="h-6 border-b border-dashed border-slate-700"></div>
                    <span className="text-slate-500 font-mono text-[9px]">Inspector Signature & Date</span>
                  </div>
                  <div className="border border-slate-800 p-2.5 rounded-lg flex flex-col gap-4">
                    <span className="font-bold text-slate-400 uppercase">Reviewed By:</span>
                    <div className="h-6 border-b border-dashed border-slate-700"></div>
                    <span className="text-slate-500 font-mono text-[9px]">Senior Engineer Sign-off</span>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </Card>
  );
}
