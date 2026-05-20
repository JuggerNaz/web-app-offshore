"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Printer, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  X, 
  Database, 
  Server, 
  ShieldAlert, 
  UserCheck, 
  CalendarDays, 
  Check, 
  Eye
} from "lucide-react";

interface MigrationReportPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStructureId: string;
  selectedStructure: any; // e.g. { TITLE, PTYPE, DEF_UNIT }
  oracleConfig: {
    host?: string;
    serviceName?: string;
    user?: string;
  };
  migrationReport: Record<string, { 
    status: "success" | "failed" | "skipped"; 
    oracleRows: number; 
    migratedRows: number; 
    errors: string[] 
  }> | null;
  migrationLogs: string[];
  unmappedComponents?: Array<{ code: string; name?: string; rowCount: number }>;
  triggerPrintOnOpen?: boolean;
}

type ReportTheme = "modern" | "classic" | "inksaver";

const COMPONENT_FULL_NAMES: Record<string, string> = {
  // Core System Elements
  "STRUCTURE": "Structure Master",
  "STR_ELV": "Structural Elevations",
  "STR_LEVEL": "Structural Levels",
  "STR_FACES": "Structural Faces",
  "ATTACHMENT": "Attachments & Files",
  "COMMENT": "Comments & Logs",
  "U_ASSOC": "Hierarchy Mappings (User Associations)",
  
  // Offshore Structural Components
  "BO": "Boat Landing",
  "BR": "Bracing",
  "GR": "Guard Rail",
  "ND": "Node",
  "PA": "Pad Eye",
  "PT": "Protection",
  "RL": "Railing",
  "VS": "Vent Stack",
  "WK": "Walkway",
  "AN": "Anode",
  "CL": "Clamp",
  "CS": "Caisson",
  "FA": "Face",
  "FD": "Boat Fender",
  "HD": "Horizontal Diagonal Member",
  "HM": "Horizontal Member",
  "IT": "Item",
  "LA": "Ladder",
  "LG": "Leg",
  "PG": "Pile Guide",
  "PL": "Pile",
  "RS": "Riser",
  "RG": "Riser Guard",
  "SD": "Seabed",
  "VD": "Vertical Diagonal Member",
  "VM": "Vertical Member",
  "WN": "Node Weld",
  "WP": "Support Weld",
  "BB": "Bolts / Bolting",
  "CD": "Conductor",
  "CF": "Conductor Fender",
  "CG": "Conductor Guard"
};

const getComponentFullName = (key: string): string => {
  const upperKey = key.toUpperCase();
  return COMPONENT_FULL_NAMES[upperKey] || "";
};

export default function MigrationReportPreview({
  isOpen,
  onClose,
  selectedStructureId,
  selectedStructure,
  oracleConfig,
  migrationReport,
  migrationLogs,
  unmappedComponents = [],
  triggerPrintOnOpen = false
}: MigrationReportPreviewProps) {
  // Customization States
  const [reportTitle, setReportTitle] = useState("Oracle to PostgreSQL Migration Audit Report");
  const [inspectorName, setInspectorName] = useState("Lead Asset Integrity Engineer");
  const [selectedTheme, setSelectedTheme] = useState<ReportTheme>("modern");
  const [includeLogs, setIncludeLogs] = useState(true);
  const [includeErrors, setIncludeErrors] = useState(true);
  const [includeSignOff, setIncludeSignOff] = useState(true);
  const [generationDate, setGenerationDate] = useState("");

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Set date on mount
  useEffect(() => {
    const now = new Date();
    setGenerationDate(now.toLocaleString("en-US", { 
      dateStyle: "medium", 
      timeStyle: "short" 
    }));
  }, [isOpen]);

  // Handle Print Action
  const handlePrint = () => {
    const prevTitle = document.title;
    document.title = `${reportTitle.replace(/\s+/g, "_")}_${selectedStructureId}`;
    window.print();
    setTimeout(() => {
      document.title = prevTitle;
    }, 1000);
  };

  // Handle auto-print if requested
  useEffect(() => {
    if (isOpen && triggerPrintOnOpen && migrationReport) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isOpen, triggerPrintOnOpen, migrationReport]);

  if (!migrationReport) return null;

  // Calculate Metrics
  const totalOracleRows = Object.values(migrationReport).reduce((acc, curr) => acc + curr.oracleRows, 0);
  const totalPgRows = Object.values(migrationReport).reduce((acc, curr) => acc + curr.migratedRows, 0);
  const overallAccuracy = totalOracleRows === 0 ? 100 : Math.min(100, Math.round((totalPgRows / totalOracleRows) * 100));
  const totalErrorsCount = Object.values(migrationReport).reduce((acc, curr) => acc + curr.errors.length, 0);

  // Determine overall status
  let migrationStatus: "SUCCESSFUL" | "COMPLETED WITH ERRORS" | "FAILED" = "SUCCESSFUL";
  if (totalErrorsCount > 0) {
    migrationStatus = overallAccuracy > 50 ? "COMPLETED WITH ERRORS" : "FAILED";
  } else if (totalPgRows === 0 && totalOracleRows > 0) {
    migrationStatus = "FAILED";
  }

  // Compile detailed copied manifest items dynamically based on counts
  const renderManifestItems = () => {
    const items: string[] = [];
    const structType = selectedStructure?.PTYPE === "PIPE" ? "Pipeline" : "Platform";

    if (migrationReport["STRUCTURE"]?.status === "success") {
      items.push(`${structType} structure master records successfully translated and upserted into PostgreSQL target table.`);
    }
    
    ["STR_ELV", "STR_LEVEL", "STR_FACES"].forEach(key => {
      const rep = migrationReport[key];
      if (rep && rep.status === "success" && rep.migratedRows > 0) {
        const entityLabel = key === "STR_ELV" ? "Elevations" : key === "STR_LEVEL" ? "Levels" : "Faces";
        items.push(`${rep.migratedRows} structural ${entityLabel.toLowerCase()} records processed, linked, and inserted.`);
      }
    });

    // Check components
    Object.entries(migrationReport).forEach(([key, rep]) => {
      const isSystem = ["STRUCTURE", "STR_ELV", "STR_LEVEL", "STR_FACES", "ATTACHMENT", "COMMENT", "U_ASSOC"].includes(key.toUpperCase());
      if (!isSystem && rep.status === "success" && rep.migratedRows > 0) {
        items.push(`${rep.migratedRows} legacy '${key}' (Component) records successfully extracted, transformed, and saved.`);
      }
    });

    if (migrationReport["U_ASSOC"]?.status === "success" && migrationReport["U_ASSOC"].migratedRows > 0) {
      items.push(`${migrationReport["U_ASSOC"].migratedRows} structural components parent/child hierarchy mappings successfully resolved.`);
    }

    if (migrationReport["ATTACHMENT"]?.status === "success" && migrationReport["ATTACHMENT"].migratedRows > 0) {
      items.push(`${migrationReport["ATTACHMENT"].migratedRows} legacy file attachments linked, cataloged, and registered.`);
    }

    if (migrationReport["COMMENT"]?.status === "success" && migrationReport["COMMENT"].migratedRows > 0) {
      items.push(`${migrationReport["COMMENT"].migratedRows} historical comments and field logs migrated successfully.`);
    }

    if (items.length === 0) {
      return [<li key="empty" className="text-slate-400 dark:text-slate-500 italic">No items migrated</li>];
    }

    return items.map((item, idx) => (
      <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 py-1 leading-relaxed">
        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-500 mt-0.5 shrink-0" />
        <span>{item}</span>
      </li>
    ));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent id="migration-dialog-content" className="max-w-[95vw] w-[1300px] h-[90vh] p-0 overflow-hidden flex flex-col bg-slate-900 border-slate-800 text-white rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/80 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                Migration Audit Report Template
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Print Preview</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-0.5">
                Generate, customize, and print high-fidelity migration verification reports.
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Button 
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider text-xs px-5 h-9 rounded-lg shadow-md flex items-center gap-1.5 transition-all"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </Button>
            <Button 
              variant="outline"
              onClick={onClose}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 h-9 px-3 rounded-lg flex items-center gap-1.5 text-xs font-bold uppercase"
            >
              <X className="w-4 h-4" />
              Close
            </Button>
          </div>
        </div>

        {/* Modal Work Area */}
        <div id="migration-dialog-work-area" className="flex-1 flex overflow-hidden">
          
          {/* Left Sidebar: Controls & Customizations */}
          <div className="w-[340px] border-r border-slate-800/80 bg-slate-950/40 p-6 flex flex-col justify-between shrink-0 overflow-y-auto">
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Step 1: Custom Details</span>
                <h4 className="text-sm font-bold text-slate-200">Report Metadata</h4>
              </div>

              {/* Title input */}
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Report Title</Label>
                <Input 
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-xs text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-9"
                  placeholder="e.g. Migration Verification Report"
                />
              </div>

              {/* Inspector input */}
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Verifier / Inspector Title</Label>
                <Input 
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-xs text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-9"
                  placeholder="e.g. Integrity Analyst"
                />
              </div>

              <div className="h-[1px] bg-slate-800" />

              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Step 2: Theme Layout</span>
                <h4 className="text-sm font-bold text-slate-200">Visual Styling</h4>
              </div>

              {/* Theme selectors */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSelectedTheme("modern")}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all ${
                    selectedTheme === "modern" 
                      ? "bg-indigo-600/10 border-indigo-500 text-indigo-300 shadow-lg" 
                      : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="text-[9px] font-black uppercase tracking-wider">Modern</span>
                </button>
                <button
                  onClick={() => setSelectedTheme("classic")}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all ${
                    selectedTheme === "classic" 
                      ? "bg-emerald-600/10 border-emerald-500 text-emerald-300 shadow-lg" 
                      : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span className="text-[9px] font-black uppercase tracking-wider">Classic</span>
                </button>
                <button
                  onClick={() => setSelectedTheme("inksaver")}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all ${
                    selectedTheme === "inksaver" 
                      ? "bg-amber-600/10 border-amber-500 text-amber-300 shadow-lg" 
                      : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                  }`}
                >
                  <Printer className="w-4 h-4" />
                  <span className="text-[9px] font-black uppercase tracking-wider">Minimal</span>
                </button>
              </div>

              <div className="h-[1px] bg-slate-800" />

              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Step 3: Visibility</span>
                <h4 className="text-sm font-bold text-slate-200">Include Sections</h4>
              </div>

              {/* Checkboxes */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer text-slate-300 hover:text-white transition-colors group select-none">
                  <input
                    type="checkbox"
                    checked={includeLogs}
                    onChange={(e) => setIncludeLogs(e.target.checked)}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-900 h-4 w-4"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold group-hover:text-slate-200">Migration Audit Logs</span>
                    <span className="text-[9px] text-slate-500">Include verbose process logs</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-slate-300 hover:text-white transition-colors group select-none">
                  <input
                    type="checkbox"
                    checked={includeErrors}
                    onChange={(e) => setIncludeErrors(e.target.checked)}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-900 h-4 w-4"
                    disabled={totalErrorsCount === 0}
                  />
                  <div className="flex flex-col opacity-90">
                    <span className={`text-xs font-bold group-hover:text-slate-200 ${totalErrorsCount === 0 ? "text-slate-600 group-hover:text-slate-600 cursor-not-allowed" : ""}`}>
                      Error Diagnostics
                    </span>
                    <span className="text-[9px] text-slate-500">List failures & actionable resolutions</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-slate-300 hover:text-white transition-colors group select-none">
                  <input
                    type="checkbox"
                    checked={includeSignOff}
                    onChange={(e) => setIncludeSignOff(e.target.checked)}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-900 h-4 w-4"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold group-hover:text-slate-200">Signature Block</span>
                    <span className="text-[9px] text-slate-500">Physical validation sign-off area</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 text-[10px] text-slate-500 flex flex-col gap-1">
              <span>* Pressing Print opens browser system dialog.</span>
              <span>* Page sizes and margins are calibrated for A4 output.</span>
            </div>
          </div>

          {/* Right Area: Large High-Fidelity Printable Canvas Preview */}
          <div id="migration-report-canvas-container" className="flex-1 bg-slate-950 p-8 overflow-y-auto flex justify-center items-start">
            <div 
              ref={printAreaRef}
              id="migration-printable-report"
              className={`w-[850px] min-h-[1130px] p-[50px] shadow-2xl bg-white text-black transition-all duration-300 rounded-sm relative text-left select-text ${
                selectedTheme === "classic" 
                  ? "font-serif" 
                  : selectedTheme === "inksaver" 
                    ? "font-mono border-2 border-black p-[40px] shadow-none" 
                    : "font-sans"
              }`}
            >
              {/* --- REPORT HEADER SECTION --- */}
              <div className="relative">
                {/* Visual Accent Lines (Modern & Classic only) */}
                {selectedTheme === "modern" && (
                  <div className="absolute top-0 left-0 w-full h-[6px] bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-full" />
                )}
                {selectedTheme === "classic" && (
                  <div className="border-t-[4px] border-b-[1.5px] border-double border-navy-800 py-1" />
                )}

                <div className={`flex justify-between items-start pt-6 pb-4 ${selectedTheme === "classic" ? "border-b-2 border-slate-800" : "border-b border-slate-100"}`}>
                  <div>
                    <h1 className={`font-black uppercase tracking-tight text-slate-900 leading-none ${
                      selectedTheme === "classic" ? "text-2xl font-serif" : "text-xl"
                    }`}>
                      {reportTitle}
                    </h1>
                    <p className={`text-[10px] font-bold text-slate-500 tracking-wider uppercase mt-1.5 ${
                      selectedTheme === "classic" ? "font-serif italic" : ""
                    }`}>
                      Veracity Integrity Audit & Schema Translation Analytics
                    </p>
                  </div>
                  
                  {/* Digital Integrity Seal / Stamp */}
                  <div className={`flex flex-col items-end text-right border px-3 py-1.5 rounded-lg ${
                    selectedTheme === "inksaver" 
                      ? "border-black border-2" 
                      : "bg-slate-50 border-slate-200/80"
                  }`}>
                    <span className="text-[8px] font-black uppercase text-slate-400 leading-none">Report Code</span>
                    <span className="text-[11px] font-bold text-slate-800 leading-none mt-1 font-mono">MIG-{selectedStructureId}-{new Date().getFullYear()}</span>
                    <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase mt-1.5 text-center w-full border ${
                      migrationStatus === "SUCCESSFUL" 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                        : migrationStatus === "COMPLETED WITH ERRORS" 
                          ? "bg-amber-50 text-amber-700 border-amber-200" 
                          : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}>
                      {migrationStatus}
                    </span>
                  </div>
                </div>

                {/* Metadata Details Grid */}
                <div className={`grid grid-cols-2 gap-y-4 gap-x-8 py-6 text-xs ${
                  selectedTheme === "classic" ? "border-b-2 border-slate-800" : "border-b border-slate-100"
                }`}>
                  {/* Left Column */}
                  <div className="space-y-2.5">
                    <div className="flex gap-2">
                      <span className="font-extrabold uppercase text-[9.5px] text-slate-400 w-24 shrink-0">Structure Name:</span>
                      <span className="font-bold text-slate-800">{selectedStructure?.TITLE || "Platform ID " + selectedStructureId}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-extrabold uppercase text-[9.5px] text-slate-400 w-24 shrink-0">Structure ID:</span>
                      <span className="font-mono font-bold text-slate-800">{selectedStructureId}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-extrabold uppercase text-[9.5px] text-slate-400 w-24 shrink-0">Asset Class:</span>
                      <span className="font-bold text-slate-800 uppercase">{selectedStructure?.PTYPE === "PIPE" ? "Pipeline Structure" : "Platform Structure"}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-extrabold uppercase text-[9.5px] text-slate-400 w-24 shrink-0">Unit Standard:</span>
                      <span className="font-bold text-slate-800 uppercase">{selectedStructure?.DEF_UNIT || "METRIC"}</span>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-2.5">
                    <div className="flex gap-2">
                      <span className="font-extrabold uppercase text-[9.5px] text-slate-400 w-24 shrink-0">Source DB:</span>
                      <span className="font-bold text-slate-800 truncate" title={oracleConfig.host}>
                        Oracle DB ({oracleConfig.serviceName || "SID"})
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-extrabold uppercase text-[9.5px] text-slate-400 w-24 shrink-0">Destination DB:</span>
                      <span className="font-bold text-slate-800">PostgreSQL (Supabase)</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-extrabold uppercase text-[9.5px] text-slate-400 w-24 shrink-0">Generated On:</span>
                      <span className="font-bold text-slate-800 font-mono">{generationDate}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-extrabold uppercase text-[9.5px] text-slate-400 w-24 shrink-0">Verified By:</span>
                      <span className="font-bold text-slate-800 italic">{inspectorName || "Asset Engineer"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* --- EXECUTIVE SUMMARY SECTION --- */}
              <div className="py-6 space-y-5">
                <h3 className={`text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 ${
                  selectedTheme === "classic" ? "font-serif border-b border-slate-700 pb-1" : ""
                }`}>
                  <FileText className="w-4 h-4 text-slate-600" />
                  Executive Audit Summary
                </h3>

                {/* Scorecards */}
                <div className="grid grid-cols-4 gap-4">
                  <div className={`p-4 rounded-xl border flex flex-col ${
                    selectedTheme === "inksaver" ? "border-black border-2" : "bg-slate-50 border-slate-100"
                  }`}>
                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Oracle Records</span>
                    <span className="text-xl font-black text-slate-800 mt-1 font-mono">{totalOracleRows}</span>
                  </div>
                  <div className={`p-4 rounded-xl border flex flex-col ${
                    selectedTheme === "inksaver" ? "border-black border-2" : "bg-slate-50 border-slate-100"
                  }`}>
                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Postgres Records</span>
                    <span className="text-xl font-black text-indigo-600 mt-1 font-mono">{totalPgRows}</span>
                  </div>
                  <div className={`p-4 rounded-xl border flex flex-col ${
                    selectedTheme === "inksaver" ? "border-black border-2" : "bg-slate-50 border-slate-100"
                  }`}>
                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Transfer Rate</span>
                    <span className={`text-xl font-black mt-1 font-mono ${
                      overallAccuracy >= 90 ? "text-emerald-600" : overallAccuracy >= 60 ? "text-amber-500" : "text-rose-500"
                    }`}>{overallAccuracy}%</span>
                  </div>
                  <div className={`p-4 rounded-xl border flex flex-col ${
                    selectedTheme === "inksaver" ? "border-black border-2" : "bg-slate-50 border-slate-100"
                  }`}>
                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Failed Records</span>
                    <span className={`text-xl font-black mt-1 font-mono ${
                      totalErrorsCount > 0 ? "text-rose-500" : "text-emerald-600"
                    }`}>{totalErrorsCount}</span>
                  </div>
                </div>

                {/* Overall Accuracy Bar Indicator */}
                <div className={`p-4 rounded-xl border space-y-2.5 ${
                  selectedTheme === "inksaver" ? "border-black border-2" : "bg-slate-50/50 border-slate-100"
                }`}>
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-600">
                    <span>Overall Accuracy & Completeness</span>
                    <span className="font-mono">{overallAccuracy}% SUCCESS RATE</span>
                  </div>
                  <div className={`w-full h-3 rounded-full overflow-hidden border ${
                    selectedTheme === "inksaver" ? "bg-white border-black border-2" : "bg-slate-100 border-slate-200/50"
                  }`}>
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${
                        selectedTheme === "inksaver" 
                          ? "bg-black" 
                          : overallAccuracy >= 95 
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500" 
                            : overallAccuracy >= 75 
                              ? "bg-gradient-to-r from-indigo-500 to-blue-500" 
                              : "bg-gradient-to-r from-rose-500 to-amber-500"
                      }`}
                      style={{ width: `${overallAccuracy}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* --- INDIVIDUAL TABLE / ENTITY BREAKDOWN --- */}
              <div className="py-4 space-y-4">
                <h3 className={`text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 ${
                  selectedTheme === "classic" ? "font-serif border-b border-slate-700 pb-1" : ""
                }`}>
                  <Database className="w-4 h-4 text-slate-600" />
                  Detailed Data Translation Breakdown
                </h3>

                <table className={`w-full border-collapse ${selectedTheme === "inksaver" ? "border-2 border-black" : "border border-slate-100"}`}>
                  <thead>
                    <tr className={`border-b text-[9.5px] font-extrabold uppercase text-slate-500 tracking-wider text-left ${
                      selectedTheme === "inksaver" ? "bg-slate-100 border-b-2 border-black" : "bg-slate-50/50 border-slate-100"
                    }`}>
                      <th className="px-4 py-3">Entity Table Name</th>
                      <th className="px-4 py-3 text-right">Oracle Count</th>
                      <th className="px-4 py-3 text-right">Postgres Count</th>
                      <th className="px-4 py-3 text-right">Accuracy %</th>
                      <th className="px-4 py-3 text-right">Process Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {Object.entries(migrationReport).map(([key, item]) => {
                      const percent = item.oracleRows === 0 ? 100 : Math.min(100, Math.round((item.migratedRows / item.oracleRows) * 100));
                      const isError = item.errors.length > 0;
                      
                      let statusText = "SUCCESSFUL";
                      if (item.status === "skipped") {
                        statusText = "SKIPPED";
                      } else if (isError || item.status === "failed") {
                        statusText = "FAILED";
                      }

                      return (
                        <tr key={key} className={`hover:bg-slate-50/20 transition-colors ${
                          isError && selectedTheme !== "inksaver" ? "bg-rose-50/20" : ""
                        }`}>
                          <td className="px-4 py-3 text-slate-900">
                            <span className="font-mono font-bold">{key}</span>
                            {getComponentFullName(key) && (
                              <span className="text-[10px] text-slate-500 font-bold ml-2 uppercase tracking-wide">
                                ({getComponentFullName(key)})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-500">{item.oracleRows}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-900">{item.migratedRows}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold">
                            <span className={
                              percent >= 95 ? "text-emerald-600" : percent >= 75 ? "text-indigo-600" : "text-rose-500"
                            }>
                              {percent}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-[10px]">
                            <span className={`px-2 py-0.5 rounded uppercase ${
                              statusText === "SUCCESSFUL" 
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                : statusText === "SKIPPED" 
                                  ? "bg-slate-50 text-slate-500 border border-slate-200" 
                                  : "bg-rose-50 text-rose-700 border border-rose-100"
                            }`}>
                              {statusText}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* --- UNMAPPED COMPONENT TYPES (SKIPPED MIGRATION) --- */}
              {unmappedComponents && unmappedComponents.length > 0 && (
                <div className="py-4 space-y-4 page-break-inside-avoid">
                  <h3 className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                    selectedTheme === "classic" 
                      ? "font-serif border-b border-slate-700 pb-1 text-slate-800" 
                      : selectedTheme === "inksaver"
                        ? "text-black"
                        : "text-amber-700"
                  }`}>
                    <AlertTriangle className="w-4 h-4" />
                    Unmapped Component Types (Skipped Migration)
                  </h3>

                  <div className={`p-4 rounded-xl border text-xs space-y-3 ${
                    selectedTheme === "inksaver" 
                      ? "border-2 border-black bg-white text-black" 
                      : "bg-amber-50/20 border-amber-100/70 text-slate-700"
                  }`}>
                    <div className="flex gap-2 items-start leading-relaxed text-[11px]">
                      <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
                        selectedTheme === "inksaver" ? "text-black" : "text-amber-600"
                      }`} />
                      <div>
                        <span className="font-bold text-slate-900">Warning: </span>
                        The following legacy component types contain active data records in the Oracle source database for this structure, but were skipped during migration because no field mapping settings have been configured. To migrate this data, establish a mapping specification in the Mapping tab.
                      </div>
                    </div>

                    <table className={`w-full border-collapse ${selectedTheme === "inksaver" ? "border-2 border-black" : "border border-amber-100/40"}`}>
                      <thead>
                        <tr className={`border-b text-[9px] font-extrabold uppercase tracking-wider text-left ${
                          selectedTheme === "inksaver" 
                            ? "bg-slate-100 border-b-2 border-black text-black" 
                            : "bg-amber-50/40 border-amber-100/30 text-amber-800"
                        }`}>
                          <th className="px-4 py-2">Component Code</th>
                          <th className="px-4 py-2 text-right">Oracle Record Count</th>
                          <th className="px-4 py-2 text-right">Migration Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100/30 text-xs">
                        {unmappedComponents.map((item) => (
                          <tr key={item.code} className="hover:bg-amber-50/10 transition-colors">
                            <td className="px-4 py-2 text-slate-900">
                              <span className="font-mono font-bold">{item.code}</span>
                              {(item.name || getComponentFullName(item.code)) && (
                                <span className="text-[10px] text-slate-500 font-bold ml-1.5 uppercase">
                                  ({item.name || getComponentFullName(item.code)})
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-slate-700">{item.rowCount}</td>
                            <td className="px-4 py-2 text-right font-bold text-[9.5px]">
                              <span className={`px-2 py-0.5 rounded uppercase ${
                                selectedTheme === "inksaver"
                                  ? "border border-black text-black font-black"
                                  : "bg-amber-50 border border-amber-100 text-amber-700"
                              }`}>
                                SKIPPED / UNMAPPED
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* --- MANIFEST OF COPIED ITEMS --- */}
              <div className="py-4 space-y-4 page-break-before-auto">
                <h3 className={`text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 ${
                  selectedTheme === "classic" ? "font-serif border-b border-slate-700 pb-1" : ""
                }`}>
                  <UserCheck className="w-4 h-4 text-slate-600" />
                  Itemized Copied Records Manifest
                </h3>
                <div className={`p-4 rounded-xl border ${
                  selectedTheme === "inksaver" ? "border-black border-2" : "bg-slate-50/40 border-slate-100"
                }`}>
                  <ul className="divide-y divide-slate-100/50 space-y-1.5 list-none pl-0">
                    {renderManifestItems()}
                  </ul>
                </div>
              </div>

              {/* --- EXCEPTION & ERROR DIAGNOSTICS (IF TOGGLED) --- */}
              {includeErrors && totalErrorsCount > 0 && (
                <div className="py-4 space-y-4 page-break-inside-avoid">
                  <h3 className="text-xs font-black uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    Database Exception & Error Diagnostics
                  </h3>
                  
                  <div className={`p-5 rounded-xl border border-rose-100 bg-rose-50/30 text-xs space-y-4 ${
                    selectedTheme === "inksaver" ? "border-2 border-black bg-white" : ""
                  }`}>
                    {Object.entries(migrationReport)
                      .filter(([_, item]) => item.errors && item.errors.length > 0)
                      .map(([tblName, item]) => (
                        <div key={tblName} className="space-y-2 border-b border-rose-100/50 last:border-0 pb-3 last:pb-0">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded font-black font-mono text-[10px] bg-rose-100 text-rose-700 uppercase">
                              {tblName}
                            </span>
                            <span className="font-extrabold text-slate-700">{item.errors.length} Exception(s) Encountered</span>
                          </div>
                          
                          <div className="bg-white/80 dark:bg-slate-900/10 p-3 rounded-lg border border-rose-100/40 font-mono text-[10px] text-rose-600 space-y-1">
                            {item.errors.map((err, idx) => (
                              <div key={idx} className="flex gap-2">
                                <span className="font-bold text-rose-800 shrink-0">&gt; ERROR:</span>
                                <span className="break-all">{err}</span>
                              </div>
                            ))}
                          </div>
                          
                          <div className="text-[10.5px] text-slate-500 leading-relaxed pl-1.5 flex gap-1.5 items-start">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-bold text-slate-600">Recommended Resolution: </span>
                              Verify target schema constraints in public.{tblName.toLowerCase()} on Supabase. Check if any mapped foreign keys (e.g. comp_id or parent association) are missing or violated. Check connection timeout rates on the tunnel service.
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* --- DETAILED backend EXECUTION LOGS (IF TOGGLED) --- */}
              {includeLogs && migrationLogs && migrationLogs.length > 0 && (
                <div className="py-4 space-y-4 page-break-inside-avoid">
                  <h3 className={`text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 ${
                    selectedTheme === "classic" ? "font-serif border-b border-slate-700 pb-1" : ""
                  }`}>
                    <Server className="w-4 h-4 text-slate-600" />
                    Process Step & Log Reports
                  </h3>
                  
                  <div className={`p-4 bg-slate-900 text-emerald-400 font-mono text-[9px] rounded-xl overflow-hidden leading-relaxed space-y-1 ${
                    selectedTheme === "inksaver" ? "border-2 border-black bg-white text-black shadow-none" : ""
                  }`}>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 pb-1.5 border-b border-slate-800 mb-1.5">
                      Process Audit Trail:
                    </div>
                    {migrationLogs.map((log, i) => (
                      <div key={i} className="flex gap-1.5">
                        <span className="select-none text-slate-500">&gt;</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* --- SIGN-OFF & VERIFICATION BLOCK (IF TOGGLED) --- */}
              {includeSignOff && (
                <div className="pt-12 pb-6 space-y-8 page-break-inside-avoid">
                  <div className={`border-t-2 border-dashed border-slate-200 pt-8 ${
                    selectedTheme === "classic" ? "border-slate-800 border-t-2" : ""
                  }`}>
                    <div className="flex justify-between items-start">
                      
                      {/* Left: Sign-off fields */}
                      <div className="space-y-6 w-[280px]">
                        <h4 className="text-xs font-extrabold uppercase text-slate-800 tracking-wider">Lead Inspector Verification</h4>
                        
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <div className="border-b border-slate-900 h-6 w-full" />
                            <div className="flex justify-between text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">
                              <span>Verifier Signature</span>
                              <span>Date Signed</span>
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="font-bold text-xs text-slate-800 font-mono h-6 pt-1">{inspectorName}</div>
                            <div className="flex justify-between text-[9px] text-slate-400 font-extrabold uppercase tracking-wide border-t border-slate-200 pt-1">
                              <span>Authorized Name / Title</span>
                              <span>Veracity Stamp</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Stamp Box / Seal area */}
                      <div className="w-[180px] h-[100px] border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center p-3 text-center bg-slate-50/30 shrink-0">
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest leading-none">Affix Seal Here</span>
                        <span className="text-[7px] text-slate-400 mt-1 leading-normal">Asset Integrity Dept.<br/>Oracle Data Audit Unit</span>
                        <CheckCircle2 className="w-5 h-5 text-indigo-500/20 dark:text-indigo-400/20 mt-2" />
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {/* --- REPORT FOOTER PAGE-LEVEL SUMMARY --- */}
              <div className="absolute bottom-6 left-[50px] right-[50px] border-t border-slate-100 pt-3 flex justify-between items-center text-[8px] text-slate-400 uppercase tracking-widest select-none">
                <span>Migration Verification Audit Manifest • Confidential</span>
                <span>Page 1 of 1</span>
              </div>

            </div>
          </div>

        </div>

        {/* Global Print Layout CSS Injection */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            /* 1. Reset base html/body elements for natural paper pagination */
            html, body {
              background: white !important;
              color: black !important;
              overflow: visible !important;
              height: auto !important;
            }

            /* 2. Hide everything on the screen by default */
            body * {
              visibility: hidden !important;
            }

            /* 3. Unconstrain Radix Dialog/Portal overlays and parents of our report */
            div[data-radix-portal],
            div[role="dialog"],
            #migration-dialog-content,
            #migration-dialog-work-area,
            #migration-report-canvas-container {
              visibility: visible !important;
              overflow: visible !important;
              position: static !important;
              height: auto !important;
              max-height: none !important;
              min-height: 0 !important;
              width: 100% !important;
              max-width: none !important;
              min-width: 0 !important;
              display: block !important;
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
              box-shadow: none !important;
              background: transparent !important;
              transform: none !important;
              left: auto !important;
              top: auto !important;
              right: auto !important;
              bottom: auto !important;
            }

            /* 4. Hide screen-only interactive elements inside the dialog (header, sidebar) */
            #migration-dialog-content > div:first-child,
            #migration-dialog-work-area > div:first-child {
              display: none !important;
            }

            /* 5. Force the printable report to display and flow naturally */
            #migration-printable-report, 
            #migration-printable-report * {
              visibility: visible !important;
            }

            #migration-printable-report {
              position: relative !important;
              display: block !important;
              width: 100% !important;
              max-width: 210mm !important;
              min-height: 297mm !important;
              padding: 15mm !important;
              margin: 0 auto !important;
              border: none !important;
              box-shadow: none !important;
              background: white !important;
              color: black !important;
            }

            /* 6. Page-break settings for elegant text flow */
            .page-break-inside-avoid {
              page-break-inside: avoid !important;
            }
            .page-break-before-auto {
              page-break-before: auto !important;
            }
            
            /* Clean up background colors and inputs for physical ink printers */
            #migration-printable-report select,
            #migration-printable-report input,
            #migration-printable-report textarea {
              color: black !important;
              background: transparent !important;
            }
          }
        `}} />

      </DialogContent>
    </Dialog>
  );
}
