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
  Eye,
  Download,
  Share2,
  Mail,
  FileJson,
  Copy
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
  oracleCompany?: {
    comp_name: string;
    depart_name: string;
    iconfile?: string;
    serial_no?: string;
    version?: string;
  } | null;
  oraclePreference?: {
    def_unit: string;
    def_fp: string;
    def_fpunit: string;
    def_x: string;
    def_y: string;
    def_date?: string;
    workunit?: string;
    def_fpformat?: string;
    def_xyunit?: string;
    appl_mode?: string;
    mgrow_profile?: string;
    def_deptunit?: string;
  } | null;
  migrationReport: Record<string, { 
    status: "success" | "failed" | "skipped"; 
    oracleRows: number; 
    migratedRows: number; 
    errors: string[];
    filesCopied?: number;
  }> | null;
  migrationLogs: string[];
  unmappedComponents?: Array<{ code: string; name?: string; rowCount: number }>;
  triggerPrintOnOpen?: boolean;
  dbComponents?: Record<string, string>;
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

  // Library & Configuration Tables
  "U_LIB_MAST": "Library Masters",
  "U_LIB_LIST": "Library List Items",
  "U_LIB_COMBO": "Library Combo Entries",
  "U_MGI_PROFILE": "MGI Profile Configuration",

  // Inspection & Job Tables
  "JOBPACK": "Job Pack",
  "U_SOW": "Scope of Work",
  "LOGS_JOBS": "Inspection Jobs Log",
  "LOGS_MOVEMENTS": "Inspection Movements Log",
  "VIDEO": "Video Tapes & Logs",
  "INSP_ROV": "ROV Primary Inspections",
  "INSP_DIVING": "Diving Primary Inspections",
  "ANOMALY": "Anomalies & Defects",
  "INSP_ATTACHMENT": "Inspection Attachments",
  "COMP_NOT_INSP": "Incomplete Inspections Details",
  "EXSUM": "Executive Summaries",

  // ROV Inspection Sub-Types
  "INSP_ROV_RGVI": "ROV – General Visual",
  "INSP_ROV_RFMD": "ROV – Flooded Member Detection",
  "INSP_ROV_RSEAB": "ROV – Seabed Survey",
  "INSP_ROV_RRISI": "ROV – Riser Inspection",
  "INSP_ROV_RCOND": "ROV – Condition Assessment",
  "INSP_ROV_RSCOR": "ROV – Marine Growth / Scour",
  "INSP_ROV_RMGI": "ROV – MGI Thickness",
  "INSP_ROV_RCPSU": "ROV – CP Survey",

  // Diving Inspection Sub-Types
  "INSP_DIVING_BSINS": "Diving – Bolt Survey",
  "INSP_DIVING_CLEAN": "Diving – Cleaning",
  "INSP_DIVING_CPCLB": "Diving – CP Calibration",
  "INSP_DIVING_CPSURV": "Diving – CP Survey",
  "INSP_DIVING_SZONE": "Diving – Splash Zone",
  "INSP_DIVING_UTCLB": "Diving – UT Calibration",
  "INSP_DIVING_UTWTK": "Diving – UT Wall Thickness",
  "INSP_DIVING_MGROW": "Diving – MGI / Marine Growth",
  "INSP_DIVING_PL_AN": "Diving – Pipeline Anode",
  "INSP_DIVING_GVINS": "Diving – General Visual",
  "INSP_DIVING_RISER": "Diving – Riser Inspection",
  
  // Offshore Structural Components (Synchronized with components database table)
  "AD": "ADAPTOR",
  "AN": "ANODE",
  "BB": "BOAT BUMPER",
  "BL": "BOATLANDING",
  "BO": "BOLLARD FAIRLEAD",
  "BP": "BOTTOM PLUGS",
  "BR": "BRACKET SUPPORT",
  "BU": "BUOY",
  "CA": "ELECTRICAL CABLE",
  "CD": "CONDUCTOR",
  "CE": "CRATER",
  "CF": "CONDUCTOR GUIDE FRAME",
  "CG": "CONDUCTOR / CAISSON GUIDES",
  "CH": "ANCHOR CHAINS",
  "CL": "CLAMP",
  "CR": "CRANE",
  "CS": "CAISSON",
  "CT": "CABLE TRAY",
  "CU": "CONDUCTOR GUARD",
  "DR": "DRILLING DERRICK",
  "FA": "FACE",
  "FB": "FLARE BOOM",
  "FD": "BOAT FENDER",
  "FH": "FLOATING HOSE",
  "FL": "FLANGE",
  "FV": "FLOOD VALVE",
  "GP": "MARINE GROWTH PREVENTER",
  "GR": "GRATING",
  "GS": "GAS SEEPAGE",
  "HB": "HOSE BREAKAWAY COUPLING",
  "HC": "HATCH OR DOORWAY",
  "HD": "HORIZONTAL DIAGONAL MEMBER",
  "HE": "HELIPAD",
  "HM": "HORIZONTAL MEMBER",
  "HP": "HULL PLATE",
  "HS": "HOSE / FLEXIBLE RISER",
  "HU": "HULL",
  "IA": "IMP. CURRENT ANODE",
  "IT": "ITEM",
  "LA": "LADDER",
  "LD": "LOAD BEARING",
  "LG": "LEG",
  "LV": "LIFE BOAT DAVIT",
  "MH": "MANHOLE",
  "MN": "MOON POOL",
  "MR": "MOORING LINE & HAWSER",
  "ND": "STRUCTURAL NODE",
  "NT": "SAFETY NETS",
  "PA": "PADEYE",
  "PC": "REPAIR CLAMP",
  "PE": "CRANE PEDESTAL",
  "PG": "PILE GUIDE",
  "PL": "PILE",
  "PM": "PIPELINE END MANIFOLD",
  "PN": "PROPELLER NOZZLE",
  "PP": "PIPELINE",
  "PR": "PROPELLER",
  "PT": "DECK PLATE",
  "PV": "PIPELINE TAP VALVE",
  "PW": "WELD / FIELD JOINT",
  "RB": "RISER SUPPORT BEAM",
  "RC": "REPAIR CONNECTOR",
  "RD": "RUDDER",
  "RE": "RIGGING & LIFTING",
  "RG": "RISER GUARD",
  "RL": "RAILING",
  "RP": "ROPE GUARD",
  "RS": "RISER",
  "SB": "CONICAL STUB",
  "SC": "SEACHEST",
  "SD": "SEABED",
  "SG": "CAISSON GUARD",
  "SJ": "SWIVEL JOINT",
  "SK": "SBM SKIRT",
  "SL": "SHOCK CELL",
  "SS": "SUPPORT STRUCTURE",
  "ST": "SUPPORT STRUT",
  "SW": "STRUCTURAL WELD",
  "TK": "TANK",
  "VD": "VERTICAL DIAG. MEMBER",
  "VL": "VALVE",
  "VM": "VERTICAL MEMBER",
  "VS": "VESSEL",
  "WA": "WALL OR FIRE WALL",
  "WB": "BUTT WELD",
  "WC": "CASTELLATION WELD",
  "WD": "WATER DEPTH",
  "WF": "WAVESTAFF",
  "WH": "WELL HEAD OR CONDUCTOR",
  "WK": "WALKWAYS & GANGWAY",
  "WN": "NODE WELD",
  "WP": "SUPPORT WELD",
  "WR": "WIRE ROPE",
  "WS": "SEAM WELD",
  "YO": "YOKOHAMA BUOY",
  "YP": "YOKE PLATE"
};

export const getTableMappingNames = (key: string, structureType: "PLATFORM" | "PIPELINE" = "PLATFORM") => {
  const isPlat = structureType === "PLATFORM";
  const upperKey = key.toUpperCase();
  
  switch (upperKey) {
    case "STRUCTURE":
      return {
        oracle: isPlat ? "PLATFORM" : "U_PIPELINE",
        pg: isPlat ? "platform" : "u_pipeline"
      };
    case "JOBPACK":
      return { oracle: "WORKPL", pg: "jobpack" };
    case "U_SOW":
      return { oracle: "U_SOW", pg: "u_sow" };
    case "EXSUM":
      return { oracle: "EXSUM", pg: "u_executive_summaries" };
    case "LOGS_JOBS":
      return { oracle: "LOGS", pg: isPlat ? "insp_rov_jobs" : "insp_dive_jobs" };
    case "LOGS_MOVEMENTS":
      return { oracle: "LOGS", pg: isPlat ? "insp_rov_movements" : "insp_dive_movements" };
    case "VIDEO":
    case "VIDEO_TAPES":
      return { oracle: isPlat ? "PLATGI / LOGS" : "NAVIG / LOGS", pg: "insp_video_tapes" };
    case "VIDEO_LOGS":
      return { oracle: isPlat ? "PLATGI / LOGS" : "NAVIG / LOGS", pg: "insp_video_logs" };
    case "ANOMALY":
      return { oracle: "U_DEFECT", pg: "insp_anomalies" };
    case "ATTACHMENT":
      return { oracle: "U_ATTACH_1", pg: "attachment" };
    case "COMMENT":
      return { oracle: "THECOMMENTS", pg: "comment" };
    case "U_ASSOC":
      return { oracle: "U_ASSOC", pg: "structure_components" };
    case "STR_ELV":
      return { oracle: "STR_ELV", pg: "str_elv" };
    case "STR_LEVEL":
      return { oracle: "STR_LEVEL", pg: "str_level" };
    case "STR_FACES":
      return { oracle: "STR_FACES", pg: "str_faces" };
    case "INSP_ATTACHMENT":
      return { oracle: "U_ATTACH_1", pg: "insp_attachments" };
    case "U_LIB_MAST":
      return { oracle: "U_LIB_MAST", pg: "u_lib_mast" };
    case "U_LIB_LIST":
      return { oracle: "U_LIB_LIST", pg: "u_lib_list" };
    case "U_LIB_COMBO":
      return { oracle: "U_LIB_COMBO", pg: "u_lib_combo" };
    case "U_MGI_PROFILE":
      return { oracle: "U_MGI_PROFILE", pg: "mgi_profiles" };
    case "COMP_NOT_INSP":
      return { oracle: "COMP_NOT_INSP", pg: "insp_records" };
    default:
      if (upperKey.startsWith("INSP_ROV_")) {
        return { oracle: isPlat ? "PLATGI" : "NAVIG", pg: "insp_records" };
      } else if (upperKey.startsWith("INSP_DIV_")) {
        const divCode = upperKey.replace("INSP_DIV_", "");
        return { oracle: divCode, pg: "insp_records" };
      } else if (upperKey.startsWith("INSP_ROV")) {
        return { oracle: isPlat ? "PLATGI" : "NAVIG", pg: "insp_records" };
      } else if (upperKey.startsWith("INSP_DIVING")) {
        return { oracle: "ALLINSPID", pg: "insp_records" };
      } else {
        // Component types (e.g. AN, PC, RC, MB, etc.)
        let specTable = `${upperKey}_COMP`;
        if (!isPlat) {
          if (upperKey === 'AN') specTable = "AN_COMP_PIPE";
          else if (upperKey === 'PC') specTable = "PC_COMP_PIPE";
          else if (upperKey === 'RC') specTable = "RC_COMP_PIPE";
        } else {
          if (upperKey === 'AN') specTable = "AN_COMP_PLAT";
          else if (upperKey === 'RC') specTable = "RC_COMP_PLAT";
          else if (upperKey === 'IT') specTable = "IT_COMP_PLAT";
        }
        return {
          oracle: `ALLCOMPID + ${specTable}`,
          pg: "structure_components"
        };
      }
  }
};

export default function MigrationReportPreview({
  isOpen,
  onClose,
  selectedStructureId,
  selectedStructure,
  oracleConfig,
  oracleCompany,
  oraclePreference,
  migrationReport,
  migrationLogs,
  unmappedComponents = [],
  triggerPrintOnOpen = false,
  dbComponents = {}
}: MigrationReportPreviewProps) {
  const getComponentFullName = (key: string): string => {
    const upperKey = key.toUpperCase();
    if (dbComponents && dbComponents[upperKey]) {
      return dbComponents[upperKey];
    }
    return COMPONENT_FULL_NAMES[upperKey] || "";
  };
  // Customization States
  const [reportTitle, setReportTitle] = useState("Oracle to PostgreSQL Migration Audit Report");
  const [inspectorName, setInspectorName] = useState("Lead Asset Integrity Engineer");
  const [selectedTheme, setSelectedTheme] = useState<ReportTheme>("modern");
  const [includeLogs, setIncludeLogs] = useState(true);
  const [includeErrors, setIncludeErrors] = useState(true);
  const [includeSignOff, setIncludeSignOff] = useState(true);
  const [generationDate, setGenerationDate] = useState("");

  // Export states
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [copied, setCopied] = useState(false);

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

  // Toggle print-active class on body during print trigger
  useEffect(() => {
    const handleBeforePrint = () => {
      document.body.classList.add("printing-active");
    };
    const handleAfterPrint = () => {
      document.body.classList.remove("printing-active");
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

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

  const libKeys = ["U_LIB_MAST", "U_LIB_LIST", "U_LIB_COMBO", "U_MGI_PROFILE"];
  const systemKeys = ["STRUCTURE", "STR_ELV", "STR_LEVEL", "STR_FACES", "U_ASSOC"];
  const jobInspectionKeys = [
    "JOBPACK", "U_SOW", "JOBPACK_SOW", "LOGS_JOBS", "LOGS_MOVEMENTS", "LOGS_ROV", "LOGS_DIVE",
    "VIDEO", "VIDEO_TAPES", "VIDEO_LOGS", "INSP_ROV", "INSP_DIVING", "ANOMALY", "ATTACHMENT",
    "INSP_ATTACHMENT", "EXSUM", "COMP_NOT_INSP"
  ];

  const isPipeStruct = selectedStructure?.PTYPE === "PIPE" || 
    selectedStructure?.PTYPE === "PIPELINE" || 
    selectedStructure?.STR_TYPE === "PIPE" || 
    selectedStructure?.STR_TYPE === "PIPELINE" || 
    selectedStructure?.type === "PIPELINE" || 
    selectedStructure?.type === "pipeline";

  const groupedReport = (() => {
    const rawEntries = Object.entries(migrationReport);
    const reportEntries = isPipeStruct
      ? rawEntries.filter(([k]) => !["STR_ELV", "STR_LEVEL", "STR_FACES"].includes(k.toUpperCase()))
      : rawEntries;

    const isJobInspKey = (key: string) => {
      const upper = key.toUpperCase();
      return (
        jobInspectionKeys.includes(upper) ||
        upper.startsWith("INSP_") ||
        upper.startsWith("VIDEO_") ||
        upper.startsWith("LOGS_")
      );
    };
    const libItems = reportEntries.filter(([key]) => libKeys.includes(key));
    const pipelineSystemKeys = ["STRUCTURE", "U_PIPEGEO", "PIPE_GEO", "U_ASSOC"];
    const platformSystemKeys = ["STRUCTURE", "STR_ELV", "STR_LEVEL", "STR_FACES", "U_ASSOC"];
    const activeSystemKeys = isPipeStruct ? pipelineSystemKeys : platformSystemKeys;

    const systemItems = reportEntries.filter(([key]) => activeSystemKeys.includes(key));
    const jobInspItems = reportEntries.filter(([key]) => isJobInspKey(key));
    const componentItems = reportEntries.filter(([key]) => 
      !libKeys.includes(key) && !activeSystemKeys.includes(key) && !isJobInspKey(key)
    );

    return [
      { section: "Library Configuration Section", items: libItems },
      { section: isPipeStruct ? "Pipeline Structure & Geodetics" : "Structure & Framework Section", items: systemItems },
      { section: isPipeStruct ? "Pipeline Component Section" : "Offshore Component Section", items: componentItems },
      { section: "Inspection, Jobs & Anomalies Section", items: jobInspItems }
    ].filter(g => g.items.length > 0);
  })();



  // Handler for high-fidelity client-side A4 PDF download
  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      // Accent top border (Indigo 600)
      doc.setFillColor(79, 70, 229);
      doc.rect(15, 15, 180, 1.8, "F");

      // Main Document Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.text(reportTitle.toUpperCase(), 15, 24);

      // Veracity Brand Subtitle
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text("VERACITY INTEGRITY AUDIT & SCHEMA TRANSLATION ANALYTICS", 15, 28.5);

      // Unique Stamp box (Confidential seal code)
      doc.setFillColor(248, 250, 252);
      doc.rect(145, 19, 50, 17, "F");
      doc.setDrawColor(226, 232, 240);
      doc.rect(145, 19, 50, 17, "D");

      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184);
      doc.text("REPORT CODE", 148, 23);
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`MIG-${selectedStructureId}-${new Date().getFullYear()}`, 148, 27.5);

      // Status Badge in Stamp box
      let badgeBg = [240, 253, 250]; // Emerald 50
      let badgeText = [5, 150, 105]; // Emerald 700
      if (migrationStatus === "FAILED") {
        badgeBg = [255, 241, 242]; // Rose 50
        badgeText = [225, 29, 72]; // Rose 700
      } else if (migrationStatus === "COMPLETED WITH ERRORS") {
        badgeBg = [254, 243, 199]; // Amber 50
        badgeText = [217, 119, 6]; // Amber 700
      }
      doc.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2]);
      doc.rect(148, 30.2, 44, 4, "F");
      doc.setFontSize(5.5);
      doc.setTextColor(badgeText[0], badgeText[1], badgeText[2]);
      doc.text(migrationStatus, 150.5, 33.2);

      doc.setDrawColor(241, 245, 249);
      doc.line(15, 39, 195, 39);

      // Metadata card grid
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      doc.text("STRUCTURE NAME:", 15, 45);
      doc.text("STRUCTURE ID:", 15, 50);
      doc.text("ASSET CLASS:", 15, 55);
      doc.text("UNIT STANDARD:", 15, 60);

      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "normal");
      doc.text(selectedStructure?.TITLE || "Platform ID " + selectedStructureId, 48, 45);
      doc.setFont("helvetica", "bold");
      doc.text(selectedStructureId, 48, 50);
      doc.setFont("helvetica", "normal");
      doc.text(selectedStructure?.PTYPE === "PIPE" ? "Pipeline Structure" : "Platform Structure", 48, 55);
      doc.text(selectedStructure?.DEF_UNIT || "METRIC", 48, 60);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      doc.text("SOURCE DB:", 110, 45);
      doc.text("DESTINATION DB:", 110, 50);
      doc.text("GENERATED ON:", 110, 55);
      doc.text("VERIFIED BY:", 110, 60);

      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "normal");
      const hostShort = oracleConfig.host ? (oracleConfig.host.length > 25 ? oracleConfig.host.substring(0, 22) + "..." : oracleConfig.host) : "Local Oracle";
      doc.text(`Oracle DB (${hostShort})`, 140, 45);
      doc.text("PostgreSQL (Supabase)", 140, 50);
      doc.setFont("helvetica", "bold");
      doc.text(generationDate, 140, 55);
      doc.setFont("helvetica", "normal");
      doc.text(inspectorName || "Asset Engineer", 140, 60);

      doc.setDrawColor(241, 245, 249);
      doc.line(15, 65, 195, 65);

      // --- Executive Metrics ---
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text("EXECUTIVE AUDIT SUMMARY", 15, 71);

      const cardWidth = 41;
      const cardHeight = 14;
      const cardGap = 5;
      const cardsData = [
        { label: "ORACLE RECORDS", val: totalOracleRows.toString() },
        { label: "POSTGRES RECORDS", val: totalPgRows.toString(), color: [79, 70, 229] },
        { label: "TRANSFER RATE", val: `${overallAccuracy}%`, color: overallAccuracy >= 90 ? [5, 150, 105] : overallAccuracy >= 60 ? [217, 119, 6] : [225, 29, 72] },
        { label: "FAILED RECORDS", val: totalErrorsCount.toString(), color: totalErrorsCount > 0 ? [225, 29, 72] : [5, 150, 105] }
      ];

      cardsData.forEach((c, idx) => {
        const x = 15 + idx * (cardWidth + cardGap);
        doc.setFillColor(248, 250, 252);
        doc.rect(x, 75, cardWidth, cardHeight, "F");
        doc.setDrawColor(241, 245, 249);
        doc.rect(x, 75, cardWidth, cardHeight, "D");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.5);
        doc.setTextColor(148, 163, 184);
        doc.text(c.label, x + 3, 79);

        doc.setFontSize(10.5);
        if (c.color) {
          doc.setTextColor(c.color[0], c.color[1], c.color[2]);
        } else {
          doc.setTextColor(30, 41, 59);
        }
        doc.text(c.val, x + 3, 86.5);
      });

      // Accuracy bar indicator
      doc.setFillColor(248, 250, 252);
      doc.rect(15, 93, 180, 12, "F");
      doc.setDrawColor(241, 245, 249);
      doc.rect(15, 93, 180, 12, "D");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text("OVERALL ACCURACY & COMPLETENESS SUCCESS RATE", 18, 97.5);
      doc.text(`${overallAccuracy}%`, 185, 97.5, { align: "right" });

      doc.setFillColor(226, 232, 240);
      doc.rect(18, 100.5, 174, 2.2, "F");

      let barColor = [79, 70, 229];
      if (overallAccuracy >= 95) barColor = [16, 185, 129];
      else if (overallAccuracy < 75) barColor = [244, 63, 94];

      doc.setFillColor(barColor[0], barColor[1], barColor[2]);
      doc.rect(18, 100.5, 174 * (overallAccuracy / 100), 2.2, "F");

      // Oracle Company and Preferences info box in PDF
      let companyPreferenceY = 110;
      if (oracleCompany || oraclePreference) {
        doc.setFillColor(248, 250, 252);
        doc.rect(15, companyPreferenceY, 180, 22, "F");
        doc.setDrawColor(226, 232, 240);
        doc.rect(15, companyPreferenceY, 180, 22, "D");

        if (oracleCompany) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.5);
          doc.setTextColor(79, 70, 229);
          doc.text("ORACLE COMPANY DETAILS (U_COMPANY)", 18, companyPreferenceY + 4);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(5.5);
          doc.setTextColor(51, 65, 85);
          doc.text(`Company Name: ${oracleCompany.comp_name}`, 18, companyPreferenceY + 8);
          doc.text(`Department:    ${oracleCompany.depart_name}`, 18, companyPreferenceY + 12);
          doc.text(`Serial Number: ${oracleCompany.serial_no || "N/A"}`, 18, companyPreferenceY + 16);
          doc.text(`DB Version:    ${oracleCompany.version || "N/A"}`, 18, companyPreferenceY + 20);
        }

        if (oraclePreference) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.5);
          doc.setTextColor(5, 150, 105);
          doc.text("ORACLE PREFERENCE DETAILS", 110, companyPreferenceY + 4);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(5.5);
          doc.setTextColor(51, 65, 85);
          doc.text(`Unit standard: ${oraclePreference.def_unit} (${oraclePreference.def_xyunit || "m"})`, 110, companyPreferenceY + 8);
          doc.text(`DB User Name:  ${oracleConfig.user || "N/A"}`, 110, companyPreferenceY + 13);
          doc.text(`App Mode:      ${oraclePreference.appl_mode || "N/A"}`, 110, companyPreferenceY + 18);
        }
        companyPreferenceY += 26;
      }

      // --- Table Breakdown ---
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text("DETAILED DATA TRANSLATION BREAKDOWN", 15, companyPreferenceY);

      const structType = isPipeStruct ? "PIPELINE" : "PLATFORM";
      const rawEntries = Object.entries(migrationReport);
      const filteredEntries = isPipeStruct
        ? rawEntries.filter(([k]) => !["STR_ELV", "STR_LEVEL", "STR_FACES"].includes(k.toUpperCase()))
        : rawEntries;
      const tableRows = filteredEntries.map(([key, item]) => {
        const percent = item.oracleRows === 0 ? 100 : Math.min(100, Math.round((item.migratedRows / item.oracleRows) * 100));
        let statusText = "SUCCESSFUL";
        if (item.status === "skipped") statusText = "SKIPPED";
        else if (item.errors.length > 0 || item.status === "failed") statusText = "FAILED";

        const compName = getComponentFullName(key);
        let nameCell = compName ? `${key} (${compName})` : key;
        if (item.filesCopied !== undefined && item.filesCopied !== null && item.filesCopied > 0) {
          nameCell += ` [${item.filesCopied} Files]`;
        }

        const mapNames = getTableMappingNames(key, structType);

        return [
          nameCell,
          mapNames.oracle,
          mapNames.pg,
          item.oracleRows.toString(),
          item.migratedRows.toString(),
          `${percent}%`,
          statusText
        ];
      });

      autoTable(doc, {
        startY: companyPreferenceY + 4,
        head: [["Entity Table Name", "Oracle Table", "Postgres Table", "Oracle Count", "Postgres Count", "Accuracy", "Process Status"]],
        body: tableRows,
        theme: "striped",
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: 255,
          fontSize: 7,
          fontStyle: "bold"
        },
        bodyStyles: {
          fontSize: 6.5,
          textColor: [51, 65, 85]
        },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 30 },
          2: { cellWidth: 30 },
          3: { halign: "right", cellWidth: 20 },
          4: { halign: "right", cellWidth: 20 },
          5: { halign: "right", cellWidth: 15 },
          6: { halign: "center", cellWidth: 25 }
        },
        margin: { left: 15, right: 15 }
      });

      let finalY = (doc as any).lastAutoTable.finalY + 8;

      // Unmapped warning
      if (unmappedComponents && unmappedComponents.length > 0) {
        if (finalY > 235) {
          doc.addPage();
          finalY = 20;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(180, 83, 9);
        doc.text("UNMAPPED COMPONENT TYPES (SKIPPED MIGRATION)", 15, finalY);

        finalY += 3.5;

        const unmappedRows = unmappedComponents.map(item => {
          const compName = item.name || getComponentFullName(item.code);
          const nameCell = compName ? `${item.code} (${compName})` : item.code;
          return [nameCell, item.rowCount.toString(), "SKIPPED / UNMAPPED"];
        });

        autoTable(doc, {
          startY: finalY,
          head: [["Component Code", "Oracle Record Count", "Migration Status"]],
          body: unmappedRows,
          theme: "striped",
          headStyles: {
            fillColor: [217, 119, 6],
            textColor: 255,
            fontSize: 7,
            fontStyle: "bold"
          },
          bodyStyles: {
            fontSize: 6.5,
            textColor: [51, 65, 85]
          },
          columnStyles: {
            0: { cellWidth: 95 },
            1: { halign: "right", cellWidth: 40 },
            2: { halign: "center", cellWidth: 45 }
          },
          margin: { left: 15, right: 15 }
        });

        finalY = (doc as any).lastAutoTable.finalY + 8;
      }

      // Itemized Copied Records Manifest
      const manifestItems: string[] = [];
      const structureTypeName = selectedStructure?.PTYPE === "PIPE" ? "Pipeline" : "Platform";

      if (migrationReport["STRUCTURE"]?.status === "success") {
        manifestItems.push(`${structureTypeName} structure master records successfully translated and upserted into PostgreSQL target table.`);
      }
      
      ["STR_ELV", "STR_LEVEL", "STR_FACES"].forEach(key => {
        const rep = migrationReport[key];
        if (rep && rep.status === "success" && rep.migratedRows > 0) {
          const entityLabel = key === "STR_ELV" ? "Elevations" : key === "STR_LEVEL" ? "Levels" : "Faces";
          manifestItems.push(`${rep.migratedRows} structural ${entityLabel.toLowerCase()} records processed, linked, and inserted.`);
        }
      });

      Object.entries(migrationReport).forEach(([key, rep]) => {
        const isSystem = ["STRUCTURE", "STR_ELV", "STR_LEVEL", "STR_FACES", "ATTACHMENT", "COMMENT", "U_ASSOC"].includes(key.toUpperCase());
        if (!isSystem && rep.status === "success" && rep.migratedRows > 0) {
          manifestItems.push(`${rep.migratedRows} legacy '${key}' (Component) records successfully extracted, transformed, and saved.`);
        }
      });

      if (migrationReport["U_ASSOC"]?.status === "success" && migrationReport["U_ASSOC"].migratedRows > 0) {
        manifestItems.push(`${migrationReport["U_ASSOC"].migratedRows} structural components parent/child hierarchy mappings successfully resolved.`);
      }

      if (migrationReport["ATTACHMENT"]?.status === "success" && migrationReport["ATTACHMENT"].migratedRows > 0) {
        manifestItems.push(`${migrationReport["ATTACHMENT"].migratedRows} legacy file attachments linked, cataloged, and registered.`);
      }

      if (migrationReport["COMMENT"]?.status === "success" && migrationReport["COMMENT"].migratedRows > 0) {
        manifestItems.push(`${migrationReport["COMMENT"].migratedRows} historical comments and field logs migrated successfully.`);
      }

      if (manifestItems.length > 0) {
        if (finalY > 230) {
          doc.addPage();
          finalY = 20;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text("ITEMIZED COPIED RECORDS MANIFEST", 15, finalY);

        finalY += 5;

        manifestItems.forEach(item => {
          if (finalY > 265) {
            doc.addPage();
            finalY = 20;
          }

          doc.setDrawColor(16, 185, 129);
          doc.setFillColor(240, 253, 250);
          doc.circle(18, finalY - 1, 1.5, "FD");
          
          doc.setDrawColor(5, 150, 105);
          doc.line(17.3, finalY - 1.2, 17.8, finalY - 0.7);
          doc.line(17.8, finalY - 0.7, 18.7, finalY - 1.6);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(51, 65, 85);
          
          const lines = doc.splitTextToSize(item, 165);
          doc.text(lines, 23, finalY);
          
          finalY += (lines.length * 4) + 2.5;
        });
        
        finalY += 3;
      }

      // Errors and Diagnostics
      const failedItems = Object.entries(migrationReport).filter(([_, item]) => item.errors && item.errors.length > 0);
      if (includeErrors && failedItems.length > 0) {
        if (finalY > 220) {
          doc.addPage();
          finalY = 20;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(225, 29, 72);
        doc.text("DATABASE EXCEPTION & ERROR DIAGNOSTICS", 15, finalY);

        finalY += 3.5;

        failedItems.forEach(([tblName, item]) => {
          if (finalY > 250) {
            doc.addPage();
            finalY = 20;
          }

          doc.setFillColor(254, 242, 242);
          doc.rect(15, finalY, 180, 18, "F");
          doc.setDrawColor(254, 226, 226);
          doc.rect(15, finalY, 180, 18, "D");

          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.5);
          doc.setTextColor(225, 29, 72);
          doc.text(`TABLE: ${tblName.toUpperCase()}`, 18, finalY + 4);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(6);
          doc.setTextColor(100, 116, 139);
          const errSnippet = item.errors[0] ? (item.errors[0].length > 105 ? item.errors[0].substring(0, 102) + "..." : item.errors[0]) : "Unknown foreign key constraint violation.";
          doc.text(`ERROR LOG: > ${errSnippet}`, 18, finalY + 9);

          doc.setFont("helvetica", "bold");
          doc.setTextColor(71, 85, 105);
          doc.text(`RESOLUTION: Verify target schema constraints in public.${tblName.toLowerCase()} on PostgreSQL (Supabase).`, 18, finalY + 14);

          finalY += 21;
        });

        finalY += 2;
      }

      // U_ASSOC Rejected Association Details in PDF
      const assocReport = migrationReport["U_ASSOC"] as any;
      if (assocReport?.rejectedDetails && assocReport.rejectedDetails.length > 0) {
        if (finalY > 220) {
          doc.addPage();
          finalY = 20;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(217, 119, 6); // Amber-600
        doc.text("REJECTED COMPONENT ASSOCIATIONS (U_ASSOC)", 15, finalY);

        finalY += 4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`${assocReport.totalRejected || assocReport.rejectedDetails.length} record(s) could not be mapped — component not yet migrated to PostgreSQL.`, 15, finalY);
        finalY += 5;

        // Table header
        doc.setFillColor(255, 251, 235); // Amber-50
        doc.rect(15, finalY, 180, 6, "F");
        doc.setDrawColor(253, 230, 138); // Amber-200
        doc.rect(15, finalY, 180, 6, "D");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.5);
        doc.setTextColor(146, 64, 14); // Amber-800
        doc.text("#", 17, finalY + 4);
        doc.text("ORACLE COMP_ID", 25, finalY + 4);
        doc.text("ORACLE ASSOC_COMPID", 65, finalY + 4);
        doc.text("REASON", 110, finalY + 4);
        finalY += 7;

        // Table rows (limit to fit page)
        const maxRows = Math.min(assocReport.rejectedDetails.length, 50);
        doc.setFont("courier", "normal");
        doc.setFontSize(5.5);

        for (let i = 0; i < maxRows; i++) {
          if (finalY > 265) {
            doc.addPage();
            finalY = 20;
          }
          const rd = assocReport.rejectedDetails[i];
          const bgColor = i % 2 === 0 ? [255, 255, 255] : [255, 251, 235];
          doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          doc.rect(15, finalY - 2.5, 180, 5, "F");

          doc.setTextColor(100, 116, 139);
          doc.text(String(i + 1), 17, finalY);
          doc.setTextColor(30, 41, 59);
          doc.text(String(rd.oracleCompId), 25, finalY);
          doc.text(String(rd.oracleAssocCompId), 65, finalY);
          doc.setTextColor(146, 64, 14);
          const reasonLines = doc.splitTextToSize(rd.reason, 82);
          doc.text(reasonLines[0], 110, finalY);
          finalY += 5;
        }

        if (assocReport.rejectedDetails.length > maxRows) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(6);
          doc.setTextColor(100, 116, 139);
          doc.text(`... and ${assocReport.rejectedDetails.length - maxRows} more rejected records (see dashboard for full list)`, 17, finalY);
          finalY += 5;
        }

        finalY += 3;
      }

      // Process Step & Log Reports
      if (includeLogs && migrationLogs && migrationLogs.length > 0) {
        if (finalY > 220) {
          doc.addPage();
          finalY = 20;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text("PROCESS STEP & LOG REPORTS", 15, finalY);

        finalY += 5;

        const logLines: string[] = [];
        migrationLogs.forEach(log => {
          const splitLogs = doc.splitTextToSize(`> ${log}`, 170);
          logLines.push(...splitLogs);
        });

        let currentBlockY = finalY;
        doc.setFillColor(15, 23, 42); // Slate 900
        
        let spaceRemaining = 270 - currentBlockY;
        let linesThatFit = Math.floor(spaceRemaining / 3.5);
        
        if (linesThatFit < 5) {
          doc.addPage();
          currentBlockY = 20;
          spaceRemaining = 270 - currentBlockY;
          linesThatFit = Math.floor(spaceRemaining / 3.5);
        }

        const blockLines = logLines.slice(0, linesThatFit);
        const rectHeight = (blockLines.length * 3.5) + 6;
        doc.rect(15, currentBlockY, 180, rectHeight, "F");
        
        doc.setFont("courier", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184); // Slate 400
        doc.text("PROCESS AUDIT TRAIL:", 18, currentBlockY + 4.5);
        
        doc.setFont("courier", "normal");
        doc.setTextColor(52, 211, 153); // Emerald 400
        
        let logY = currentBlockY + 8.5;
        blockLines.forEach(line => {
          doc.text(line, 18, logY);
          logY += 3.5;
        });

        let remainingLogLines = logLines.slice(linesThatFit);
        finalY = logY + 4;

        while (remainingLogLines.length > 0) {
          doc.addPage();
          currentBlockY = 20;
          
          spaceRemaining = 270 - currentBlockY;
          linesThatFit = Math.floor(spaceRemaining / 3.5);
          
          const currentBlockLines = remainingLogLines.slice(0, linesThatFit);
          const currentRectHeight = (currentBlockLines.length * 3.5) + 4;
          
          doc.setFillColor(15, 23, 42); // Slate 900
          doc.rect(15, currentBlockY, 180, currentRectHeight, "F");
          
          doc.setFont("courier", "normal");
          doc.setTextColor(52, 211, 153); // Emerald 400
          
          logY = currentBlockY + 3.5;
          currentBlockLines.forEach(line => {
            doc.text(line, 18, logY);
            logY += 3.5;
          });
          
          remainingLogLines = remainingLogLines.slice(linesThatFit);
          finalY = logY + 4;
        }
      }

      // Sign off
      if (includeSignOff) {
        if (finalY > 215) {
          doc.addPage();
          finalY = 20;
        }

        doc.setDrawColor(226, 232, 240);
        doc.line(15, finalY, 195, finalY);

        finalY += 5;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        doc.text("LEAD INSPECTOR VERIFICATION", 15, finalY);

        finalY += 8;

        doc.setDrawColor(30, 41, 59);
        doc.line(15, finalY, 80, finalY);
        doc.line(100, finalY, 135, finalY);

        doc.setFontSize(5.5);
        doc.setTextColor(148, 163, 184);
        doc.text("VERIFIER SIGNATURE", 15, finalY + 3);
        doc.text("DATE SIGNED", 100, finalY + 3);

        finalY += 9;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(30, 41, 59);
        doc.text(inspectorName, 15, finalY);

        doc.setDrawColor(226, 232, 240);
        doc.line(15, finalY + 1.8, 80, finalY + 1.8);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.5);
        doc.setTextColor(148, 163, 184);
        doc.text("AUTHORIZED NAME / TITLE", 15, finalY + 5);
        doc.text("VERACITY STAMP", 100, finalY + 5);

        // Affix Stamp Box
        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(248, 250, 252);
        doc.rect(145, finalY - 20, 50, 22, "F");
        doc.rect(145, finalY - 20, 50, 22, "D");
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5);
        doc.setTextColor(148, 163, 184);
        doc.text("AFFIX SEAL HERE", 149, finalY - 16);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(4.5);
        doc.text("Asset Integrity Dept.\nOracle Data Audit Unit", 149, finalY - 12);
      }

      // Dynamic page footer on all pages
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(241, 245, 249);
        doc.line(15, 285, 195, 285);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.5);
        doc.setTextColor(148, 163, 184);
        doc.text("MIGRATION VERIFICATION AUDIT MANIFEST • CONFIDENTIAL", 15, 289);
        doc.text(`PAGE ${i} OF ${pageCount}`, 195, 289, { align: "right" });
      }

      doc.save(`${reportTitle.replace(/\s+/g, "_")}_${selectedStructureId}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Handler to export structured JSON metrics
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      structureId: selectedStructureId,
      structureTitle: selectedStructure?.TITLE,
      generatedAt: generationDate,
      company: oracleCompany,
      preference: oraclePreference,
      summary: {
        totalOracleRows,
        totalPgRows,
        overallAccuracy,
        totalErrorsCount,
        migrationStatus
      },
      report: migrationReport,
      unmappedComponents,
      logs: migrationLogs
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `migration_report_${selectedStructureId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Handler to copy report summary text
  const handleCopyClipboardText = () => {
    const summaryText = `
MIGRATION VERIFICATION AUDIT SUMMARY
------------------------------------
Report Code: MIG-${selectedStructureId}-${new Date().getFullYear()}
Structure: ${selectedStructure?.TITLE || "Platform ID " + selectedStructureId} (ID: ${selectedStructureId})
Asset Class: ${selectedStructure?.PTYPE === "PIPE" ? "Pipeline Structure" : "Platform Structure"}
Unit Standard: ${selectedStructure?.DEF_UNIT || "METRIC"}
Generated On: ${generationDate}
Verified By: ${inspectorName}

ORACLE SYSTEM SETTINGS:
Company: ${oracleCompany ? `${oracleCompany.comp_name} (${oracleCompany.depart_name})` : "N/A"}
Preferences: ${oraclePreference ? `Unit: ${oraclePreference.def_unit}, DB User: ${oracleConfig.user || "N/A"}, App Mode: ${oraclePreference.appl_mode || "N/A"}` : "N/A"}

EXECUTIVE METRICS:
- Oracle Source Records: ${totalOracleRows}
- Postgres Dest Records: ${totalPgRows}
- Transfer Rate: ${overallAccuracy}%
- Failed Records: ${totalErrorsCount}
- Overall Status: ${migrationStatus}

DETAILED BREAKDOWN:
${Object.entries(migrationReport).map(([key, item]) => {
  const percent = item.oracleRows === 0 ? 100 : Math.min(100, Math.round((item.migratedRows / item.oracleRows) * 100));
  return `- ${key} (${getComponentFullName(key) || "System"}): ${item.oracleRows} -> ${item.migratedRows} (${percent}% - ${item.status.toUpperCase()})`;
}).join("\n")}

${unmappedComponents && unmappedComponents.length > 0 ? `
UNMAPPED COMPONENTS (SKIPPED):
${unmappedComponents.map(item => `- ${item.code} (${getComponentFullName(item.code) || "Unknown"}): ${item.rowCount} records`).join("\n")}
` : ""}
`;
    navigator.clipboard.writeText(summaryText.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handler to share report via pre-filled email
  const handleShareEmail = () => {
    const subject = encodeURIComponent(`Migration Audit Report: ${selectedStructure?.TITLE || selectedStructureId}`);
    const body = encodeURIComponent(`Dear Team,

Please find the Migration Audit Summary for the platform/pipeline structure below:

Report Code: MIG-${selectedStructureId}-${new Date().getFullYear()}
Structure: ${selectedStructure?.TITLE || "Platform ID " + selectedStructureId} (ID: ${selectedStructureId})
Generated On: ${generationDate}
Status: ${migrationStatus}

Oracle System Details:
Company: ${oracleCompany ? `${oracleCompany.comp_name} (${oracleCompany.depart_name})` : "N/A"}
Preferences: ${oraclePreference ? `Unit: ${oraclePreference.def_unit}, DB User: ${oracleConfig.user || "N/A"}, App Mode: ${oraclePreference.appl_mode || "N/A"}` : "N/A"}

Key Metrics:
- Oracle Records: ${totalOracleRows}
- Postgres Records: ${totalPgRows}
- Migration Accuracy: ${overallAccuracy}%
- Errors Encountered: ${totalErrorsCount}

Detailed report tables and execution logs are attached in the system dashboard.

Best regards,
${inspectorName}
`);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

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
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800/50 text-white font-black uppercase tracking-wider text-xs px-5 h-9 rounded-lg shadow-md flex items-center gap-1.5 transition-all"
            >
              {isExportingPDF ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download PDF
                </>
              )}
            </Button>
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

              <div className="h-[1px] bg-slate-800" />

              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Step 4: Export & Share</span>
                <h4 className="text-sm font-bold text-slate-200">Share Report</h4>
              </div>

              <div className="space-y-2">
                <Button 
                  onClick={handleExportJSON}
                  variant="outline"
                  className="w-full justify-start gap-2 border-slate-800 hover:bg-slate-800/80 bg-slate-900/40 text-slate-300 hover:text-white h-9 text-xs font-bold uppercase"
                >
                  <FileJson className="w-4 h-4 text-amber-500" />
                  Download JSON Data
                </Button>
                
                <Button 
                  onClick={handleCopyClipboardText}
                  variant="outline"
                  className="w-full justify-start gap-2 border-slate-800 hover:bg-slate-800/80 bg-slate-900/40 text-slate-300 hover:text-white h-9 text-xs font-bold uppercase relative"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>Copied Summary!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-indigo-400" />
                      <span>Copy Text Summary</span>
                    </>
                  )}
                </Button>

                <Button 
                  onClick={handleShareEmail}
                  variant="outline"
                  className="w-full justify-start gap-2 border-slate-800 hover:bg-slate-800/80 bg-slate-900/40 text-slate-300 hover:text-white h-9 text-xs font-bold uppercase"
                >
                  <Mail className="w-4 h-4 text-emerald-400" />
                  Share via Email
                </Button>
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

                {/* Oracle Company & Database Preferences Section */}
                {(oracleCompany || oraclePreference) && (
                  <div className={`mt-6 p-4 rounded-xl border grid grid-cols-1 md:grid-cols-2 gap-6 ${
                    selectedTheme === "inksaver" ? "border-black border-2" : "bg-slate-50/50 border-slate-100"
                  }`}>
                    {oracleCompany && (
                      <div className="space-y-2">
                        <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block border-b border-slate-200/60 pb-1 flex items-center gap-1.5">
                          <Server className="w-3.5 h-3.5" />
                          Oracle Company Details (u_company)
                        </span>
                        <div className="space-y-1.5 text-xs text-slate-700">
                          <div className="flex gap-1.5"><span className="font-extrabold text-[9.5px] text-slate-400 w-24 shrink-0">Company Name:</span><span className="font-bold text-slate-800">{oracleCompany.comp_name}</span></div>
                          <div className="flex gap-1.5"><span className="font-extrabold text-[9.5px] text-slate-400 w-24 shrink-0">Department:</span><span className="font-medium text-slate-700">{oracleCompany.depart_name}</span></div>
                          <div className="flex gap-1.5"><span className="font-extrabold text-[9.5px] text-slate-400 w-24 shrink-0">Serial No:</span><span className="font-mono text-slate-700 font-bold">{oracleCompany.serial_no || "N/A"}</span></div>
                          <div className="flex gap-1.5"><span className="font-extrabold text-[9.5px] text-slate-400 w-24 shrink-0">Version:</span><span className="font-bold text-slate-800">{oracleCompany.version || "N/A"}</span></div>
                        </div>
                      </div>
                    )}
                    {oraclePreference && (
                      <div className="space-y-2">
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block border-b border-slate-200/60 pb-1 flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5" />
                          Legacy Database Preferences
                        </span>
                        <div className="space-y-1.5 text-xs text-slate-700">
                          <div className="flex gap-1.5"><span className="font-extrabold text-[9.5px] text-slate-400 w-24 shrink-0">Def Unit:</span><span className="font-bold text-slate-800">{oraclePreference.def_unit} ({oraclePreference.def_xyunit || "m"})</span></div>
                          <div className="flex gap-1.5"><span className="font-extrabold text-[9.5px] text-slate-400 w-24 shrink-0">DB User Name:</span><span className="font-bold text-slate-800">{oracleConfig.user || "N/A"}</span></div>
                          <div className="flex gap-1.5"><span className="font-extrabold text-[9.5px] text-slate-400 w-24 shrink-0">App Mode:</span><span className="font-bold text-slate-800 uppercase">{oraclePreference.appl_mode || "N/A"}</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
                      <th className="px-4 py-3">Oracle Source</th>
                      <th className="px-4 py-3">Postgres Target</th>
                      <th className="px-4 py-3 text-right">Oracle Count</th>
                      <th className="px-4 py-3 text-right">Postgres Count</th>
                      <th className="px-4 py-3 text-right">Accuracy %</th>
                      <th className="px-4 py-3 text-right">Process Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {groupedReport.map((group, groupIdx) => {
                      const groupOracle = group.items.reduce((sum, [_, item]) => sum + item.oracleRows, 0);
                      const groupPg = group.items.reduce((sum, [_, item]) => sum + item.migratedRows, 0);
                      const groupPercent = groupOracle === 0 ? 100 : Math.min(100, Math.round((groupPg / groupOracle) * 100));

                      return (
                        <React.Fragment key={groupIdx}>
                          {/* Section Header Row */}
                          <tr className="bg-slate-100/40 dark:bg-slate-800/40 border-y border-slate-200 dark:border-slate-800">
                            <td colSpan={7} className="px-4 py-2 font-black text-[10px] text-indigo-700 dark:text-indigo-400 uppercase tracking-widest">
                              {group.section}
                            </td>
                          </tr>
                          
                          {/* Individual Rows */}
                          {group.items.map(([key, item]) => {
                            const percent = item.oracleRows === 0 ? 100 : Math.min(100, Math.round((item.migratedRows / item.oracleRows) * 100));
                            const isError = item.errors.length > 0;
                            
                            let statusText = "SUCCESSFUL";
                            if (item.status === "skipped") {
                              statusText = "SKIPPED";
                            } else if (isError || item.status === "failed") {
                              statusText = "FAILED";
                            }

                            const isPipeStruct = selectedStructure?.PTYPE === "PIPE" || 
                              selectedStructure?.PTYPE === "PIPELINE" || 
                              selectedStructure?.STR_TYPE === "PIPE" || 
                              selectedStructure?.STR_TYPE === "PIPELINE" || 
                              selectedStructure?.type === "pipeline";
                            const mapNames = getTableMappingNames(key, isPipeStruct ? "PIPELINE" : "PLATFORM");

                            return (
                              <tr key={key} className={`hover:bg-slate-50/20 transition-colors ${
                                isError && selectedTheme !== "inksaver" ? "bg-rose-50/20" : ""
                              }`}>
                                <td className="px-4 py-3 pl-8 text-slate-900">
                                  <span className="font-mono font-bold">{key}</span>
                                  {getComponentFullName(key) && (
                                    <span className="text-[10px] text-slate-500 font-bold ml-2 uppercase tracking-wide">
                                      ({getComponentFullName(key)})
                                    </span>
                                  )}
                                  {item.filesCopied !== undefined && item.filesCopied !== null && item.filesCopied > 0 && (
                                    <span className="text-[8px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded font-black uppercase tracking-wider ml-3 inline-flex items-center gap-1 select-none">
                                      {item.filesCopied} Files Copied
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{mapNames.oracle}</td>
                                <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{mapNames.pg}</td>
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
                          
                          {/* Section Subtotal Row */}
                          <tr className="bg-slate-50/50 dark:bg-slate-900/10 font-bold border-b border-slate-200 dark:border-slate-800 text-[11px]">
                            <td className="px-4 py-2 pl-6 text-slate-600 dark:text-slate-400 italic uppercase">
                              Subtotal ({group.section.replace(" Section", "")})
                            </td>
                            <td colSpan={2} />
                            <td className="px-4 py-2 text-right font-mono text-slate-500">{groupOracle}</td>
                            <td className="px-4 py-2 text-right font-mono text-slate-900">{groupPg}</td>
                            <td className="px-4 py-2 text-right font-mono" colSpan={2}>
                              <span className={groupPercent >= 95 ? "text-emerald-600" : groupPercent >= 75 ? "text-indigo-600" : "text-rose-500"}>
                                {groupPercent}% Accuracy
                              </span>
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                    
                    {/* GRAND TOTAL ROW */}
                    <tr className="bg-indigo-50/30 dark:bg-indigo-950/20 font-black border-t-2 border-slate-300 dark:border-slate-700 text-xs">
                      <td className="px-4 py-3 uppercase tracking-wider text-indigo-800 dark:text-indigo-400">
                        GRAND TOTAL RECORDS SUMMARY
                      </td>
                      <td colSpan={2} />
                      <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">{totalOracleRows}</td>
                      <td className="px-4 py-3 text-right font-mono text-indigo-700 dark:text-indigo-400">{totalPgRows}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-600" colSpan={2}>
                        {overallAccuracy}% Overall Success Rate
                      </td>
                    </tr>
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
              min-height: 0 !important;
            }

            /* 2. Hide the main dashboard page entirely when printing is active */
            body.printing-active > *:not(div[data-radix-portal]) {
              display: none !important;
            }

            /* 3. Completely hide radix portal overlays, close buttons, and non-printable siblings */
            body.printing-active div[class*="bg-black/80"],
            body.printing-active button:has(svg.lucide-x),
            body.printing-active button[class*="absolute"],
            body.printing-active .DialogOverlay {
              display: none !important;
              visibility: hidden !important;
              height: 0 !important;
              width: 0 !important;
              overflow: hidden !important;
            }

            /* 4. Unconstrain every ancestor wrapper of our printable report inside the portal */
            body.printing-active div[data-radix-portal],
            body.printing-active div[data-radix-portal] > div,
            body.printing-active div[role="dialog"],
            body.printing-active #migration-dialog-content,
            body.printing-active #migration-dialog-work-area,
            body.printing-active #migration-report-canvas-container {
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

            /* 5. Hide screen-only interactive elements inside the dialog (header, sidebar) */
            #migration-dialog-content > div:first-child,
            #migration-dialog-work-area > div:first-child {
              display: none !important;
            }

            /* 6. Force the printable report to display and flow naturally */
            #migration-printable-report {
              visibility: visible !important;
              display: block !important;
              position: relative !important;
              width: 100% !important;
              max-width: 210mm !important;
              min-height: 297mm !important;
              height: auto !important;
              overflow: visible !important;
              padding: 15mm !important;
              margin: 0 auto !important;
              border: none !important;
              box-shadow: none !important;
              background: white !important;
              color: black !important;
            }

            #migration-printable-report * {
              visibility: visible !important;
            }

            /* Hide the absolute hardcoded bottom page footer during print */
            #migration-printable-report > div.absolute.bottom-6 {
              display: none !important;
            }

            /* 7. Page-break settings for elegant text flow */
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
