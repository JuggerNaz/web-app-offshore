"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowRightLeft,
  Building2,
  FileSpreadsheet,
  Package,
  Layers,
  Sparkles,
  Download,
  FolderDown,
  CheckCircle2,
  AlertCircle,
  Copy,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Eye,
  Settings2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Check,
  Zap,
  HardDrive,
  FileText,
  Activity,
  BarChart3,
  HelpCircle,
  Plus,
  Edit3,
  Trash2,
  Save,
  Database,
  Sliders,
  FolderSync,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  INITIAL_CLIENT_PROFILES,
  ClientProfile,
  ClientInterfaceDef,
  TemplateSheet,
  TemplateColumn,
  StructureScopeType,
  InterfaceFileFormat,
} from "@/utils/interface-templates";

export default function InterfaceModulePage() {
  // ─── State Management ───────────────────────────────────────────────────────
  const [clients, setClients] = useState<ClientProfile[]>(INITIAL_CLIENT_PROFILES);
  const [selectedClientId, setSelectedClientId] = useState<string>("pcsb");
  const [selectedInterfaceId, setSelectedInterfaceId] = useState<string>("pcsb-sic");

  // Selection Scoping
  const [structureTypeFilter, setStructureTypeFilter] = useState<StructureScopeType>("PLATFORM");
  const [selectedStructureIds, setSelectedStructureIds] = useState<number[]>([]);
  const [jobpackMode, setJobpackMode] = useState<"ALL" | "SELECTED">("ALL");
  const [selectedJobpackIds, setSelectedJobpackIds] = useState<number[]>([]);
  const [selectedInspectionTypes, setSelectedInspectionTypes] = useState<string[]>(["ALL"]);
  const [exportFormat, setExportFormat] = useState<InterfaceFileFormat>("individual_xlsx");
  const [destinationFolder, setDestinationFolder] = useState<string>("C:\\Offshore_Transfers\\PCSB\\SICS_Platform_Deliverables\\");
  const [customFileName, setCustomFileName] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("configure");

  // Data fetching state
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [structuresList, setStructuresList] = useState<any[]>([]);
  const [jobpacksList, setJobpacksList] = useState<any[]>([]);
  const [searchStructureQuery, setSearchStructureQuery] = useState<string>("");
  const [searchJobpackQuery, setSearchJobpackQuery] = useState<string>("");
  const [selectedPreviewSheetId, setSelectedPreviewSheetId] = useState<string>("sics-ans");
  const [searchSheetQuery, setSearchSheetQuery] = useState<string>("");

  // Modals for Registering / Editing
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState<boolean>(false);
  const [newClientCode, setNewClientCode] = useState<string>("");
  const [newClientName, setNewClientName] = useState<string>("");
  const [newClientDesc, setNewClientDesc] = useState<string>("");

  const [isNewInterfaceModalOpen, setIsNewInterfaceModalOpen] = useState<boolean>(false);
  const [newInterfaceName, setNewInterfaceName] = useState<string>("");
  const [newInterfaceCode, setNewInterfaceCode] = useState<string>("");
  const [newInterfaceSystemTitle, setNewInterfaceSystemTitle] = useState<string>("");
  const [newInterfaceScope, setNewInterfaceScope] = useState<StructureScopeType>("PLATFORM");
  const [newInterfaceFormat, setNewInterfaceFormat] = useState<InterfaceFileFormat>("individual_xlsx");
  const [newInterfacePattern, setNewInterfacePattern] = useState<string>("yymmdd-01-{XXX}.txt");

  // Schema Editor State
  const [isEditSchemaModalOpen, setIsEditSchemaModalOpen] = useState<boolean>(false);
  const [editingSheetIndex, setEditingSheetIndex] = useState<number>(0);
  const [newColHeader, setNewColHeader] = useState<string>("");
  const [newColKey, setNewColKey] = useState<string>("");
  const [newColType, setNewColType] = useState<"string" | "number" | "date" | "boolean">("string");
  const [newColWidth, setNewColWidth] = useState<number>(18);
  const [newColRequired, setNewColRequired] = useState<boolean>(false);

  // Transfer history
  const [exportHistory, setExportHistory] = useState<any[]>([
    {
      id: "exp-101",
      timestamp: "2026-09-08 14:32:10",
      clientCode: "PCSB",
      interfaceName: "SICS Interface (24 Tables)",
      targetType: "PLATFORM",
      structureNames: "B11 (Platform), F23-A",
      recordsCount: 384,
      fileName: "PCSB_SICS_PACKAGE_260908.zip",
      destinationFolder: "C:\\Offshore_Transfers\\PCSB\\SICS_Platform_Deliverables\\",
      format: "individual_txt",
      status: "SUCCESS",
    },
    {
      id: "exp-100",
      timestamp: "2026-09-07 09:15:44",
      clientCode: "PCSB",
      interfaceName: "iPIMS Interface",
      targetType: "PIPELINE",
      structureNames: "PL-01 18\" Gas Pipeline",
      recordsCount: 142,
      fileName: "PCSB_iPIMS_PL01_20260907.xlsx",
      destinationFolder: "C:\\Offshore_Transfers\\PCSB\\iPIMS_Pipeline_Deliverables\\",
      format: "xlsx",
      status: "SUCCESS",
    },
  ]);

  // ─── Initial Load ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      setIsLoadingData(true);
      try {
        const strRes = await fetch("/api/structures");
        if (strRes.ok) {
          const strJson = await strRes.json();
          const list = strJson.data || [];
          setStructuresList(list);
          const platIds = list
            .filter((s: any) => String(s.str_type).toUpperCase() === "PLATFORM")
            .map((s: any) => s.str_id || s.id);
          setSelectedStructureIds(platIds.length > 0 ? platIds : list.map((s: any) => s.str_id || s.id));
        }

        const jpRes = await fetch("/api/jobpack");
        if (jpRes.ok) {
          const jpJson = await jpRes.json();
          setJobpacksList(jpJson.data || []);
        }
      } catch (err) {
        console.warn("[Interface] Load error:", err);
      } finally {
        setIsLoadingData(false);
      }
    }
    loadData();
  }, []);

  // Active Client & Active Interface
  const activeClient = useMemo(() => {
    return clients.find((c) => c.id === selectedClientId) || clients[0];
  }, [clients, selectedClientId]);

  const activeInterface = useMemo(() => {
    return (
      activeClient.interfaces.find((i) => i.id === selectedInterfaceId) ||
      activeClient.interfaces[0]
    );
  }, [activeClient, selectedInterfaceId]);

  // Handle switching Interface
  const handleSelectInterface = (iface: ClientInterfaceDef) => {
    setSelectedInterfaceId(iface.id);
    setStructureTypeFilter(iface.targetStructureType);
    setExportFormat(iface.defaultFileFormat);
    setDestinationFolder(iface.destinationFolder);

    if (iface.targetStructureType === "ALL") {
      setSelectedStructureIds(structuresList.map((s) => s.str_id || s.id));
    } else {
      const matched = structuresList
        .filter((s) => String(s.str_type).toUpperCase() === iface.targetStructureType)
        .map((s) => s.str_id || s.id);
      setSelectedStructureIds(matched);
    }

    if (iface.templates.length > 0) {
      setSelectedPreviewSheetId(iface.templates[0].id);
    }
  };

  // Filtered structures based on interface filter
  const filteredStructures = useMemo(() => {
    return structuresList.filter((s) => {
      const typeMatch =
        structureTypeFilter === "ALL" ||
        String(s.str_type).toUpperCase() === structureTypeFilter;
      const searchMatch =
        !searchStructureQuery ||
        String(s.str_name || s.title || "")
          .toLowerCase()
          .includes(searchStructureQuery.toLowerCase()) ||
        String(s.str_id || "").includes(searchStructureQuery);
      return typeMatch && searchMatch;
    });
  }, [structuresList, structureTypeFilter, searchStructureQuery]);

  // Filtered jobpacks
  const filteredJobpacks = useMemo(() => {
    return jobpacksList.filter((jp) => {
      return (
        !searchJobpackQuery ||
        String(jp.name || "").toLowerCase().includes(searchJobpackQuery.toLowerCase())
      );
    });
  }, [jobpacksList, searchJobpackQuery]);

  // Dynamic file name preview
  const generatedFileName = useMemo(() => {
    if (customFileName.trim()) return customFileName.trim();
    const dateFormattedYymmdd = new Date().toISOString().split("T")[0].replace(/-/g, "").substring(2);

    if (exportFormat === "individual_xlsx") {
      return `${activeClient.code}_${activeInterface.code}_INDIVIDUAL_XLSX_${dateFormattedYymmdd}.zip`;
    }
    if (exportFormat === "individual_csv") {
      return `${activeClient.code}_${activeInterface.code}_INDIVIDUAL_CSV_${dateFormattedYymmdd}.zip`;
    }
    if (exportFormat === "single_xlsx") {
      return `${activeClient.code}_${activeInterface.code}_PACKAGE_${dateFormattedYymmdd}.xlsx`;
    }
    return `${activeClient.code}_${activeInterface.code}_INDIVIDUAL_TXT_${dateFormattedYymmdd}.zip`;
  }, [customFileName, activeClient, activeInterface, exportFormat]);

  // Filtered templates list for sheet search
  const filteredSheets = useMemo(() => {
    if (!searchSheetQuery.trim()) return activeInterface.templates;
    return activeInterface.templates.filter((t) =>
      t.sheetName.toLowerCase().includes(searchSheetQuery.toLowerCase()) ||
      t.identifierCode.toLowerCase().includes(searchSheetQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchSheetQuery.toLowerCase())
    );
  }, [activeInterface, searchSheetQuery]);

  // ─── Action Handlers ────────────────────────────────────────────────────────
  const handleSelectAllStructures = () => {
    setSelectedStructureIds(filteredStructures.map((s) => s.str_id || s.id));
  };

  const handleClearStructures = () => {
    setSelectedStructureIds([]);
  };

  const handleToggleStructure = (id: number) => {
    setSelectedStructureIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleJobpack = (id: number) => {
    setSelectedJobpackIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleInspectionType = (code: string) => {
    if (code === "ALL") {
      setSelectedInspectionTypes(["ALL"]);
      return;
    }
    let next = selectedInspectionTypes.filter((t) => t !== "ALL");
    if (next.includes(code)) {
      next = next.filter((t) => t !== code);
      if (next.length === 0) next = ["ALL"];
    } else {
      next.push(code);
    }
    setSelectedInspectionTypes(next);
  };

  // Single Table Export Trigger
  const handleExportSingleTable = async (
    tableCode: string,
    fileFormat: InterfaceFileFormat = "individual_xlsx"
  ) => {
    if (selectedStructureIds.length === 0) {
      toast.error("Please select at least one structure first.");
      return;
    }

    const dateFormatted = new Date().toISOString().split("T")[0].replace(/-/g, "").substring(2);
    const ext = fileFormat === "individual_xlsx" || fileFormat === "single_xlsx" ? "xlsx" : fileFormat === "individual_csv" ? "csv" : "txt";
    const singleFileName = `${dateFormatted}-01-${tableCode}.${ext}`;

    const toastId = toast.loading(`Generating individual file: ${singleFileName}...`);
    try {
      const response = await fetch("/api/interface/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: activeClient.id,
          interfaceId: activeInterface.id,
          customInterface: activeInterface,
          structureIds: selectedStructureIds,
          structureType: structureTypeFilter,
          jobpackMode,
          jobpackIds: selectedJobpackIds,
          inspectionTypes: selectedInspectionTypes,
          format: fileFormat,
          destinationFolder,
          fileName: singleFileName,
          singleTableCode: tableCode,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Failed to generate interface table file");
      }

      const serverSavedFolder = response.headers.get("X-Destination-Folder") || destinationFolder;
      const filesSavedDirectly = response.headers.get("X-Files-Saved-Directly") === "true";

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = singleFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success(
        <div className="space-y-1">
          <p className="font-bold text-sm">Table File Exported: {singleFileName}</p>
          {filesSavedDirectly && (
            <div className="p-2 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[11px] border border-emerald-500/30">
              <span className="text-white font-bold block">📁 Saved directly to local folder:</span>
              <span className="break-all">{serverSavedFolder}</span>
            </div>
          )}
        </div>,
        { id: toastId, duration: 6000 }
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to export table file", { id: toastId });
    }
  };

  // Full Package Export Pipeline Trigger
  const handleExportInterface = async () => {
    if (selectedStructureIds.length === 0) {
      toast.error("Please select at least one structure for the interface file.");
      return;
    }

    setIsExporting(true);
    const toastId = toast.loading(
      `Compiling ${activeClient.code} - ${activeInterface.name} interface deliverable...`
    );

    try {
      const response = await fetch("/api/interface/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: activeClient.id,
          interfaceId: activeInterface.id,
          customInterface: activeInterface,
          structureIds: selectedStructureIds,
          structureType: structureTypeFilter,
          jobpackMode,
          jobpackIds: selectedJobpackIds,
          inspectionTypes: selectedInspectionTypes,
          format: exportFormat,
          destinationFolder,
          fileName: generatedFileName,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Failed to generate interface file");
      }

      const serverSavedFolder = response.headers.get("X-Destination-Folder") || destinationFolder;
      const filesSavedDirectly = response.headers.get("X-Files-Saved-Directly") === "true";

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = generatedFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      // Add to audit trail
      const newAudit = {
        id: `exp-${Date.now()}`,
        timestamp: new Date().toLocaleString(),
        clientCode: activeClient.code,
        interfaceName: `${activeInterface.name} (${activeInterface.templates.length} Tables)`,
        targetType: activeInterface.targetStructureType,
        structureNames:
          selectedStructureIds.length > 3
            ? `${selectedStructureIds.length} Assets Selected`
            : selectedStructureIds
                .map(
                  (id) =>
                    structuresList.find((s) => s.str_id === id || s.id === id)?.str_name ||
                    `Asset ${id}`
                )
                .join(", "),
        recordsCount: selectedStructureIds.length * 45,
        fileName: generatedFileName,
        destinationFolder: serverSavedFolder || "Browser Download Folder",
        format: exportFormat,
        status: "SUCCESS",
      };

      setExportHistory((prev) => [newAudit, ...prev]);

      const formatLabel =
        exportFormat === "individual_xlsx"
          ? "24 Individual .XLSX Excel Files"
          : exportFormat === "individual_csv"
          ? "24 Individual .CSV Files"
          : exportFormat === "single_xlsx"
          ? "Single Consolidated .XLSX Workbook"
          : "24 Individual Tab-Delimited .TXT Files";

      toast.success(
        <div className="space-y-1">
          <p className="font-bold text-sm">{formatLabel} Generated!</p>
          {filesSavedDirectly && (
            <div className="p-2 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[11px] border border-emerald-500/30">
              <span className="text-white font-bold block">📁 Saved directly to local folder:</span>
              <span className="break-all">{serverSavedFolder}</span>
            </div>
          )}
          <p className="text-xs opacity-90">
            📦 Downloaded as <span className="font-mono font-bold">{generatedFileName}</span>.
          </p>
        </div>,
        { id: toastId, duration: 9000 }
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to generate interface file", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const copyFolderLocation = () => {
    navigator.clipboard.writeText(destinationFolder);
    toast.success("Destination folder path copied to clipboard!");
  };

  return (
    <div className="flex-1 w-full flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/20 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950/20 animate-in fade-in duration-500">
      <div className="max-w-[1440px] mx-auto w-full p-6 md:p-8 space-y-6 flex flex-col min-h-[calc(100vh-4rem)]">
        {/* ─── Hero Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 relative group">
              <ArrowRightLeft className="h-8 w-8 transition-transform group-hover:rotate-180 duration-500" />
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                <span>Utilities</span>
                <div className="h-1 w-1 rounded-full bg-cyan-500" />
                <span className="bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-400 bg-clip-text text-transparent">
                  Data Interface Engine
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                Client Interface Hub
                <Badge
                  variant="outline"
                  className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20 text-xs font-bold py-0.5"
                >
                  PCSB SICS 24 Tables Ready
                </Badge>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                Produce official PCSB SICS tab-delimited text packages (<code className="font-mono text-[11px]">yymmdd-nn-XXX.txt</code>) and multi-sheet Excel files across all 24 structural inspection disciplines, auto-scoped to platforms, pipelines, and jobpacks.
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3 self-start md:self-auto overflow-x-auto pb-1">
            <div className="px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3">
              <Building2 className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Structures
                </p>
                <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {structuresList.length} Assets
                </p>
              </div>
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3">
              <FileSpreadsheet className="h-4 w-4 text-indigo-500" />
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  SICS Tables
                </p>
                <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {activeInterface.templates.length} Tables
                </p>
              </div>
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3">
              <Archive className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Delivery
                </p>
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 uppercase">
                  TXT (Tab) / XLSX
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Main Tabs Navigation ─────────────────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-2 md:grid-cols-4 h-auto gap-1">
            <TabsTrigger
              value="configure"
              className="rounded-xl py-2.5 text-xs font-bold data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all gap-2"
            >
              <Filter className="h-3.5 w-3.5" />
              1. Setup & Scope
            </TabsTrigger>
            <TabsTrigger
              value="columns"
              className="rounded-xl py-2.5 text-xs font-bold data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all gap-2"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              2. 24 SICS Table Specs
            </TabsTrigger>
            <TabsTrigger
              value="preview"
              className="rounded-xl py-2.5 text-xs font-bold data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all gap-2"
            >
              <Download className="h-3.5 w-3.5" />
              3. Generate & Transfer
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded-xl py-2.5 text-xs font-bold data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all gap-2"
            >
              <Clock className="h-3.5 w-3.5" />
              4. Transfer Logs ({exportHistory.length})
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════════════════════════════════════════════════════════
              TAB 1: SETUP & SCOPE
          ═══════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="configure" className="space-y-6 focus:outline-none">
            {/* Step 1: Select Client */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-3xl shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-sm">
                      1
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                        Client Selection
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Currently configured for PCSB (PETRONAS Carigali)
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsNewClientModalOpen(true)}
                      className="rounded-xl text-xs h-8 gap-1.5 border-dashed"
                    >
                      <Plus className="h-3.5 w-3.5 text-blue-500" />
                      Register New Client
                    </Button>
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800"
                    >
                      Active: {activeClient.code}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {clients.map((client) => {
                    const isSelected = selectedClientId === client.id;
                    return (
                      <div
                        key={client.id}
                        onClick={() => {
                          setSelectedClientId(client.id);
                          if (client.interfaces.length > 0) {
                            handleSelectInterface(client.interfaces[0]);
                          }
                        }}
                        className={cn(
                          "relative p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 group hover:shadow-md",
                          isSelected
                            ? "bg-emerald-500/10 border-emerald-500/60 shadow-lg shadow-emerald-500/10 ring-2 ring-emerald-500/30"
                            : "bg-white/90 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-emerald-400/50"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div
                            className={cn(
                              "h-10 w-10 rounded-xl bg-gradient-to-tr text-white font-black text-xs flex items-center justify-center shadow-md",
                              client.logoColor
                            )}
                          >
                            {client.code}
                          </div>
                          {isSelected && (
                            <div className="h-5 w-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                              <Check className="h-3 w-3 stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                            {client.name}
                          </p>
                          <p className="text-[10px] text-slate-400 line-clamp-2 mt-1">
                            {client.description}
                          </p>
                        </div>
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
                          <span>{client.interfaces.length} Interface System(s)</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            {client.country}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Client Interface Selection (e.g. SICS vs iPIMS) */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-3xl shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-sm">
                      2
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                        {activeClient.code} Interface Formats
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Select SICS (Platform 24-table deliverable) or iPIMS (Pipeline interface)
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsNewInterfaceModalOpen(true)}
                      className="rounded-xl text-xs h-8 gap-1.5 border-dashed"
                    >
                      <Plus className="h-3.5 w-3.5 text-indigo-500" />
                      Register New Interface
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeClient.interfaces.map((iface) => {
                    const isSelected = selectedInterfaceId === iface.id;
                    const isPlatform = iface.targetStructureType === "PLATFORM";
                    const isPipeline = iface.targetStructureType === "PIPELINE";

                    return (
                      <div
                        key={iface.id}
                        onClick={() => handleSelectInterface(iface)}
                        className={cn(
                          "p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-4 group hover:shadow-lg relative overflow-hidden",
                          isSelected
                            ? "bg-gradient-to-br from-indigo-500/15 via-blue-500/10 to-transparent border-indigo-500/70 shadow-indigo-500/10 ring-2 ring-indigo-500/30"
                            : "bg-white/90 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-indigo-400/50"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "h-12 w-12 rounded-2xl flex items-center justify-center font-black text-base shadow-md",
                                isPlatform
                                  ? "bg-blue-600 text-white shadow-blue-500/20"
                                  : isPipeline
                                  ? "bg-emerald-600 text-white shadow-emerald-500/20"
                                  : "bg-purple-600 text-white shadow-purple-500/20"
                              )}
                            >
                              {isPlatform ? (
                                <Building2 className="h-6 w-6" />
                              ) : isPipeline ? (
                                <Activity className="h-6 w-6" />
                              ) : (
                                <Layers className="h-6 w-6" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-black text-slate-900 dark:text-white">
                                  {iface.name}
                                </h3>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] font-bold uppercase",
                                    isPlatform
                                      ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                      : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                  )}
                                >
                                  {iface.targetStructureType} ONLY
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                {iface.systemTitle}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge className="font-mono text-[10px] uppercase bg-slate-900 text-white dark:bg-slate-700">
                              {iface.templates.length} Tables
                            </Badge>
                            {isSelected && (
                              <div className="h-6 w-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
                                <Check className="h-3.5 w-3.5 stroke-[3]" />
                              </div>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {iface.description}
                        </p>

                        <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <div className="flex items-center gap-2 text-slate-500">
                            <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-500" />
                            <span className="font-semibold">{iface.templates.length} Tables:</span>
                            <span className="text-slate-400">
                              {iface.templates.map((t) => t.identifierCode).slice(0, 7).join(", ")}
                              {iface.templates.length > 7 ? ` +${iface.templates.length - 7} more` : ""}
                            </span>
                          </div>

                          <Badge variant="secondary" className="font-mono text-[10px]">
                            {iface.defaultFileFormat === "individual_txt" ? "yymmdd-nn-XXX.txt" : iface.fileNamePattern}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Step 3: Structure Scope (Auto-Filtered by Interface Target) */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-3xl shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black text-sm">
                      3
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                        Asset Selection (Scoped to {activeInterface.name})
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Targeting {activeInterface.targetStructureType} assets for the {activeInterface.code} interface package
                      </CardDescription>
                    </div>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => setStructureTypeFilter("ALL")}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                        structureTypeFilter === "ALL"
                          ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                    >
                      All ({structuresList.length})
                    </button>
                    <button
                      onClick={() => setStructureTypeFilter("PLATFORM")}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                        structureTypeFilter === "PLATFORM"
                          ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                    >
                      Platforms
                    </button>
                    <button
                      onClick={() => setStructureTypeFilter("PIPELINE")}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                        structureTypeFilter === "PIPELINE"
                          ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                    >
                      Pipelines
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search structure name, pipeline code, or ID..."
                      value={searchStructureQuery}
                      onChange={(e) => setSearchStructureQuery(e.target.value)}
                      className="pl-9 h-9 text-xs rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAllStructures}
                      className="rounded-xl text-xs h-8"
                    >
                      Select All Filtered ({filteredStructures.length})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearStructures}
                      className="rounded-xl text-xs h-8 text-slate-500"
                    >
                      Clear Selection
                    </Button>
                    <Badge
                      variant="secondary"
                      className="font-mono text-xs h-8 px-2.5 flex items-center"
                    >
                      {selectedStructureIds.length} Selected
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-60 overflow-y-auto custom-scrollbar p-1">
                  {filteredStructures.map((str) => {
                    const strId = str.str_id || str.id;
                    const isSelected = selectedStructureIds.includes(strId);
                    const isPlat = str.str_type === "PLATFORM";

                    return (
                      <div
                        key={strId}
                        onClick={() => handleToggleStructure(strId)}
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 group",
                          isSelected
                            ? "bg-indigo-500/10 border-indigo-500/60 shadow-sm"
                            : "bg-white/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-slate-400"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] px-1.5 py-0 font-bold",
                              isPlat
                                ? "text-blue-500 border-blue-400/40"
                                : "text-emerald-500 border-emerald-400/40"
                            )}
                          >
                            {str.str_type || "PLATFORM"}
                          </Badge>
                          <div
                            className={cn(
                              "h-4 w-4 rounded-full border flex items-center justify-center",
                              isSelected
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "border-slate-300 dark:border-slate-600"
                            )}
                          >
                            {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                          </div>
                        </div>
                        <p
                          className="font-bold text-xs text-slate-900 dark:text-white truncate"
                          title={str.str_name || str.title}
                        >
                          {str.str_name || str.title || `Asset ${strId}`}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {str.field_name || str.pfield || "Offshore"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Step 4: Jobpack Scope */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-3xl shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-black text-sm">
                      4
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                        Jobpack & SOW Retrieval Filter
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Per SICS specs: automatically retrieves OPEN jobpacks (or closed within 1 day of export)
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setJobpackMode("ALL")}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all text-center",
                      jobpackMode === "ALL"
                        ? "bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    )}
                  >
                    All Active Jobpacks ({jobpacksList.length})
                  </button>
                  <button
                    onClick={() => setJobpackMode("SELECTED")}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all text-center",
                      jobpackMode === "SELECTED"
                        ? "bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    )}
                  >
                    Specific Selected Jobpacks ({selectedJobpackIds.length})
                  </button>
                </div>

                {jobpackMode === "SELECTED" && (
                  <div className="space-y-2 animate-in fade-in duration-300">
                    <Input
                      placeholder="Search jobpack..."
                      value={searchJobpackQuery}
                      onChange={(e) => setSearchJobpackQuery(e.target.value)}
                      className="h-8 text-xs rounded-xl"
                    />
                    <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1 p-1">
                      {filteredJobpacks.map((jp) => {
                        const isSel = selectedJobpackIds.includes(jp.id);
                        return (
                          <div
                            key={jp.id}
                            onClick={() => handleToggleJobpack(jp.id)}
                            className={cn(
                              "p-2 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all",
                              isSel
                                ? "bg-teal-500/10 border-teal-500/50 font-bold text-teal-700 dark:text-teal-300"
                                : "bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                            )}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Package className="h-3.5 w-3.5 shrink-0 opacity-60" />
                              <span className="truncate">{jp.name}</span>
                            </div>
                            <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                              {jp.status || "OPEN"}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bottom Callout & Proceed */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-600 text-white shadow-xl shadow-blue-500/20">
              <div className="space-y-1">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  Ready to Export: {activeClient.code} - {activeInterface.name}
                </h3>
                <p className="text-xs text-blue-100">
                  {selectedStructureIds.length} assets selected across all {activeInterface.templates.length} SICS table structures.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  onClick={() => setActiveTab("columns")}
                  variant="outline"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl text-xs flex-1 sm:flex-none"
                >
                  Inspect 24 Table Columns
                </Button>
                <Button
                  onClick={() => setActiveTab("preview")}
                  className="bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-xl text-xs flex-1 sm:flex-none shadow-lg gap-2"
                >
                  Proceed to Export
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════════════
              TAB 2: 24 SICS TABLE SCHEMAS & COLUMN DEFINITIONS
          ═══════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="columns" className="space-y-6 focus:outline-none">
            <Card className="border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-3xl shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-mono text-xs">
                        PCSB SICS INTERFACE SPECIFICATION
                      </Badge>
                      <Badge variant="outline" className="font-mono text-xs">
                        {activeInterface.templates.length} Official Tables
                      </Badge>
                    </div>
                    <CardTitle className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                      {activeInterface.name} Table Schemas & Definitions
                    </CardTitle>
                    <CardDescription className="text-xs">
                      All columns, Oracle data types, sizes, decimal places, and descriptions extracted from the official IDAMS–SICS documentation:
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setActiveTab("preview")}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs"
                    >
                      Export Files Now
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Search Table & Pills */}
                <div className="space-y-3">
                  <div className="relative max-w-sm">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search table by code (e.g. ANS, CPS, UTS, CMS)..."
                      value={searchSheetQuery}
                      onChange={(e) => setSearchSheetQuery(e.target.value)}
                      className="pl-9 h-8 text-xs rounded-xl"
                    />
                  </div>

                  {/* 24 Table Badges */}
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-1 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                    {filteredSheets.map((sheet, index) => {
                      const isSelected = selectedPreviewSheetId === sheet.id;
                      return (
                        <button
                          key={sheet.id}
                          onClick={() => setSelectedPreviewSheetId(sheet.id)}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0",
                            isSelected
                              ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/30"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                          )}
                        >
                          <span className="font-mono text-[11px] font-black">{sheet.identifierCode}</span>
                          <span className="text-[11px] opacity-90 hidden sm:inline">{sheet.sheetName.replace(`${sheet.identifierCode}_`, "")}</span>
                          <Badge
                            variant="outline"
                            className={cn("text-[9px] px-1 py-0 font-mono", isSelected ? "border-white/40 text-white" : "text-slate-400")}
                          >
                            {sheet.columns.length}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Display Columns of Selected Sheet */}
                {(() => {
                  const currentSheet =
                    activeInterface.templates.find((s) => s.id === selectedPreviewSheetId) ||
                    activeInterface.templates[0];
                  if (!currentSheet) return null;

                  return (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800/70 dark:to-indigo-950/30 border border-blue-200/60 dark:border-slate-700/60 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-black text-blue-700 dark:text-blue-400">
                              [{currentSheet.identifierCode}]
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                              {currentSheet.description}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Standard SICS Code: <span className="font-bold text-slate-700 dark:text-slate-300">{currentSheet.identifierCode}</span> • Table Name: <span className="font-bold">{currentSheet.sheetName}</span>
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleExportSingleTable(currentSheet.identifierCode, "individual_xlsx")}
                            className="h-7 text-[11px] font-bold rounded-lg border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 gap-1.5 shadow-sm"
                          >
                            <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
                            Download .XLSX
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleExportSingleTable(currentSheet.identifierCode, "individual_txt")}
                            className="h-7 text-[11px] font-bold rounded-lg border-blue-500/40 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 gap-1.5 shadow-sm"
                          >
                            <FileText className="h-3 w-3 text-blue-600" />
                            Download .TXT
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleExportSingleTable(currentSheet.identifierCode, "individual_csv")}
                            className="h-7 text-[11px] font-bold rounded-lg border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 gap-1.5 shadow-sm"
                          >
                            <Database className="h-3 w-3 text-purple-600" />
                            Download .CSV
                          </Button>
                          <Badge className="font-mono text-[10px] bg-blue-600 text-white ml-1">
                            {currentSheet.columns.length} Cols
                          </Badge>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                        <div className="overflow-x-auto max-h-[480px] custom-scrollbar">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-200 sticky top-0 z-10 backdrop-blur-sm">
                              <tr>
                                <th className="p-3 w-14">#</th>
                                <th className="p-3">Field Name</th>
                                <th className="p-3">Data Type</th>
                                <th className="p-3">Data Size</th>
                                <th className="p-3">Dec Size</th>
                                <th className="p-3">Description</th>
                                <th className="p-3">Req</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {currentSheet.columns.map((col, idx) => (
                                <tr
                                  key={col.key + idx}
                                  className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                                >
                                  <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                                  <td className="p-3 font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <span className="font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md text-xs font-bold">
                                      {col.header}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] uppercase font-mono"
                                    >
                                      {col.dataType === "string" ? "Varchar2" : col.dataType === "number" ? "Number" : "Date"}
                                    </Badge>
                                  </td>
                                  <td className="p-3 font-mono text-slate-600 dark:text-slate-300">
                                    {col.dataSize || col.width}
                                  </td>
                                  <td className="p-3 font-mono text-slate-400">
                                    {col.decSize != null ? col.decSize : "—"}
                                  </td>
                                  <td className="p-3 text-slate-700 dark:text-slate-300">
                                    {col.description || col.header}
                                  </td>
                                  <td className="p-3">
                                    {col.required ? (
                                      <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px]">
                                        YES
                                      </Badge>
                                    ) : (
                                      <span className="text-slate-400 text-[11px]">Optional</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════════════
              TAB 3: GENERATE & TRANSFER DESTINATION
          ═══════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="preview" className="space-y-6 focus:outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Export Controls */}
              <div className="lg:col-span-1 space-y-6">
                <Card className="border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-3xl shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Settings2 className="h-4 w-4 text-blue-500" />
                      SICS Delivery Settings
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Select delivery package format and staging directory for client transfer
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Delivery Format Choice - 4 Options */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Delivery Package Format
                      </label>
                      <div className="grid grid-cols-1 gap-2">
                        {/* 1. Individual XLSX */}
                        <button
                          type="button"
                          onClick={() => setExportFormat("individual_xlsx")}
                          className={cn(
                            "p-3 rounded-2xl border text-xs font-bold text-left transition-all flex items-center justify-between gap-2",
                            exportFormat === "individual_xlsx"
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/30"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center shrink-0", exportFormat === "individual_xlsx" ? "bg-white/20 text-white" : "bg-emerald-500/10 text-emerald-600")}>
                              <FileSpreadsheet className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-mono uppercase font-black text-xs">Individual .XLSX Files</p>
                              <p className={cn("text-[10px]", exportFormat === "individual_xlsx" ? "text-emerald-100" : "text-slate-400")}>
                                24 separate Excel files (1 workbook per table/discipline)
                              </p>
                            </div>
                          </div>
                          {exportFormat === "individual_xlsx" && <Check className="h-4 w-4 shrink-0 text-white" />}
                        </button>

                        {/* 2. Individual TXT (Oracle Standard) */}
                        <button
                          type="button"
                          onClick={() => setExportFormat("individual_txt")}
                          className={cn(
                            "p-3 rounded-2xl border text-xs font-bold text-left transition-all flex items-center justify-between gap-2",
                            exportFormat === "individual_txt"
                              ? "bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-500/30"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center shrink-0", exportFormat === "individual_txt" ? "bg-white/20 text-white" : "bg-blue-500/10 text-blue-600")}>
                              <FileText className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-mono uppercase font-black text-xs">Individual .TXT Files (Official SICS)</p>
                              <p className={cn("text-[10px]", exportFormat === "individual_txt" ? "text-blue-100" : "text-slate-400")}>
                                24 tab-delimited text files per IDAMS–SICS specification
                              </p>
                            </div>
                          </div>
                          {exportFormat === "individual_txt" && <Check className="h-4 w-4 shrink-0 text-white" />}
                        </button>

                        {/* 3. Individual CSV */}
                        <button
                          type="button"
                          onClick={() => setExportFormat("individual_csv")}
                          className={cn(
                            "p-3 rounded-2xl border text-xs font-bold text-left transition-all flex items-center justify-between gap-2",
                            exportFormat === "individual_csv"
                              ? "bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-500/30"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center shrink-0", exportFormat === "individual_csv" ? "bg-white/20 text-white" : "bg-purple-500/10 text-purple-600")}>
                              <Database className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-mono uppercase font-black text-xs">Individual .CSV Files</p>
                              <p className={cn("text-[10px]", exportFormat === "individual_csv" ? "text-purple-100" : "text-slate-400")}>
                                24 comma-delimited CSV files with RFC-4180 escaping
                              </p>
                            </div>
                          </div>
                          {exportFormat === "individual_csv" && <Check className="h-4 w-4 shrink-0 text-white" />}
                        </button>

                        {/* 4. Single Consolidated XLSX */}
                        <button
                          type="button"
                          onClick={() => setExportFormat("single_xlsx")}
                          className={cn(
                            "p-3 rounded-2xl border text-xs font-bold text-left transition-all flex items-center justify-between gap-2",
                            exportFormat === "single_xlsx"
                              ? "bg-slate-800 text-white border-slate-800 shadow-md ring-2 ring-slate-600/30"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center shrink-0", exportFormat === "single_xlsx" ? "bg-white/20 text-white" : "bg-slate-500/10 text-slate-600")}>
                              <Layers className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-mono uppercase font-black text-xs">Single Consolidated .XLSX</p>
                              <p className={cn("text-[10px]", exportFormat === "single_xlsx" ? "text-slate-300" : "text-slate-400")}>
                                1 workbook with all 24 sheets combined into tabs
                              </p>
                            </div>
                          </div>
                          {exportFormat === "single_xlsx" && <Check className="h-4 w-4 shrink-0 text-white" />}
                        </button>
                      </div>
                    </div>

                    {/* Destination Folder */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>Target Destination Folder</span>
                        <button
                          onClick={copyFolderLocation}
                          className="text-[10px] text-blue-500 hover:underline flex items-center gap-1"
                        >
                          <Copy className="h-2.5 w-2.5" /> Copy
                        </button>
                      </label>
                      <Input
                        placeholder="e.g. C:\Transfers\PCSB\SICS_Deliverables\"
                        value={destinationFolder}
                        onChange={(e) => setDestinationFolder(e.target.value)}
                        className="text-xs font-mono rounded-xl bg-white dark:bg-slate-800"
                      />
                      <p className="text-[10px] text-slate-400">
                        All individual files will be saved directly into this folder on your machine.
                      </p>
                    </div>

                    {/* Custom File Name */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Custom Archive / Workbook Name
                      </label>
                      <Input
                        placeholder={generatedFileName}
                        value={customFileName}
                        onChange={(e) => setCustomFileName(e.target.value)}
                        className="text-xs font-mono rounded-xl bg-white dark:bg-slate-800"
                      />
                    </div>

                    {/* Output File Result */}
                    <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Deliverable Package Name
                      </p>
                      <p className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 break-all">
                        {generatedFileName}
                      </p>
                    </div>

                    {/* Primary Action Button */}
                    <Button
                      onClick={handleExportInterface}
                      disabled={isExporting || selectedStructureIds.length === 0}
                      className="w-full py-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-600 text-white font-bold text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all gap-2"
                    >
                      {isExporting ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Generating 24 Individual Files...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          Generate & Export All 24 Files
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Pre-Export Manifest & Scope Summary */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-3xl shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-emerald-500" />
                        Pre-Export Manifest & SICS Output Package
                      </span>
                      <Badge className="bg-emerald-500 text-white text-[10px]">
                        24 Tables Ready
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      All 24 individual interface files to be generated and written directly to disk:
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Summary Matrix Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50">
                        <p className="text-[10px] font-bold text-blue-500 uppercase">
                          Target Client
                        </p>
                        <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                          {activeClient.code}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">PETRONAS Carigali</p>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50">
                        <p className="text-[10px] font-bold text-indigo-500 uppercase">
                          Interface Spec
                        </p>
                        <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5 truncate">
                          SICS Interface
                        </p>
                        <p className="text-[10px] text-indigo-400 font-bold uppercase">
                          Platforms (24 Tables)
                        </p>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50">
                        <p className="text-[10px] font-bold text-purple-500 uppercase">
                          Assets Included
                        </p>
                        <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                          {selectedStructureIds.length}
                        </p>
                        <p className="text-[10px] text-slate-400">Platforms Scoped</p>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50">
                        <p className="text-[10px] font-bold text-emerald-500 uppercase">
                          Files in Package
                        </p>
                        <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {exportFormat === "single_xlsx" ? "1 Combined File" : `${activeInterface.templates.length} Individual Files`}
                        </p>
                        <p className="text-[10px] text-slate-400 uppercase font-mono">
                          {exportFormat === "individual_xlsx" ? ".XLSX Workbooks" : exportFormat === "individual_csv" ? ".CSV Files" : exportFormat === "single_xlsx" ? "24 Sheet Tabs" : "Tab-Delimited .TXT"}
                        </p>
                      </div>
                    </div>

                    {/* 24 Files Grid */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>24 Interface Deliverable Files:</span>
                        <span className="text-[11px] font-normal text-slate-400">
                          Click download icon on any file for instant single-file export
                        </span>
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-80 overflow-y-auto custom-scrollbar p-1">
                        {activeInterface.templates.map((sheet, i) => {
                          const dateFormatted = new Date().toISOString().split("T")[0].replace(/-/g, "").substring(2);
                          const ext = exportFormat === "individual_xlsx" || exportFormat === "single_xlsx" ? "xlsx" : exportFormat === "individual_csv" ? "csv" : "txt";
                          const computedFileName = `${dateFormatted}-01-${sheet.identifierCode}.${ext}`;

                          return (
                            <div
                              key={sheet.id}
                              className="p-2.5 rounded-2xl bg-white/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs hover:border-blue-400 transition-colors group"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="h-6 w-6 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-bold flex items-center justify-center text-[10px] shrink-0">
                                  {sheet.identifierCode}
                                </span>
                                <div className="truncate">
                                  <p className="font-bold text-slate-800 dark:text-slate-100 font-mono truncate text-[11px]">
                                    {computedFileName}
                                  </p>
                                  <p className="text-[9px] text-slate-400 truncate">{sheet.sheetName}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                title={`Download individual ${computedFileName}`}
                                onClick={() => handleExportSingleTable(sheet.identifierCode, exportFormat)}
                                className="h-6 w-6 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-blue-600 hover:text-white flex items-center justify-center text-slate-500 transition-all shrink-0 ml-1"
                              >
                                <Download className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════════════
              TAB 4: AUDIT & EXPORT LOGS
          ═══════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="history" className="space-y-6 focus:outline-none">
            <Card className="border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-3xl shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      SICS Interface Export Logs
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Audit trail of generated SICS deliverable packages
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {exportHistory.length} Deliverables Logged
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-200">
                        <tr>
                          <th className="p-3">Timestamp</th>
                          <th className="p-3">Client</th>
                          <th className="p-3">Interface Specification</th>
                          <th className="p-3">Scope</th>
                          <th className="p-3">Assets Included</th>
                          <th className="p-3">Generated File</th>
                          <th className="p-3">Destination Path</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {exportHistory.map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="p-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {item.timestamp}
                            </td>
                            <td className="p-3 font-bold text-slate-800 dark:text-slate-100">
                              <Badge
                                variant="outline"
                                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold text-[10px]"
                              >
                                {item.clientCode}
                              </Badge>
                            </td>
                            <td className="p-3 text-slate-700 dark:text-slate-300 font-bold">
                              {item.interfaceName}
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-[10px] font-mono">
                                {item.targetType}
                              </Badge>
                            </td>
                            <td className="p-3 text-slate-700 dark:text-slate-300">
                              {item.structureNames}
                            </td>
                            <td className="p-3 font-mono text-blue-600 dark:text-blue-400 font-bold">
                              {item.fileName}
                            </td>
                            <td
                              className="p-3 font-mono text-slate-400 truncate max-w-xs"
                              title={item.destinationFolder}
                            >
                              {item.destinationFolder}
                            </td>
                            <td className="p-3">
                              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                                {item.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
