"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Database, Server, RefreshCw, ArrowRight, Play, Settings2, FileText, CheckCircle2, Plus, Trash2, Save, Sparkles, Printer, AlertTriangle, ChevronUp, ChevronDown, Eye, FolderOpen, Cloud, Network, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import MigrationReportPreview, { getTableMappingNames } from "@/components/migration/migration-report-preview";

export default function MigrationDashboard() {
  const [config, setConfig] = useState({
    host: "",
    port: 1521,
    serviceName: "",
    connectString: "",
    user: "",
    password: "",
    useThickMode: false,
    libDir: "C:\\instantclient_12_2",
    legacyAttachmentPath: "",
    legacyAttachmentType: "local"
  });
  const [useConnectString, setUseConnectString] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const [structures, setStructures] = useState<any[]>([]);
  const [isLoadingStructures, setIsLoadingStructures] = useState(false);
  const [selectedStructureId, setSelectedStructureId] = useState<string>("");
  
  const [summary, setSummary] = useState<any[]>([]);
  const [libraries, setLibraries] = useState<any[]>([]);
  const [framework, setFramework] = useState<any[]>([]);
  const [inspectionJobs, setInspectionJobs] = useState<any[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [jobpacks, setJobpacks] = useState<any[]>([]);
  const [isLoadingJobpacks, setIsLoadingJobpacks] = useState(false);
  const [selectedJobpack, setSelectedJobpack] = useState<any | null>(null);
  const [componentsOnly, setComponentsOnly] = useState(false);
  const [inspectionSummary, setInspectionSummary] = useState<any | null>(null);
  const [isLoadingInspectionSummary, setIsLoadingInspectionSummary] = useState(false);
  const [oracleCompany, setOracleCompany] = useState<any | null>(null);
  const [oraclePreference, setOraclePreference] = useState<any | null>(null);

  const [activeTab, setActiveTab] = useState("connection");
  const [mappingStructureType, setMappingStructureType] = useState<"PLATFORM" | "PIPELINE">("PLATFORM");
  
  const [oracleColumnsCache, setOracleColumnsCache] = useState<Record<string, string[]>>({});

  const [missingModalData, setMissingModalData] = useState<{
    tableName: string;
    missingInPostgres: { key: string; label: string }[];
    missingInOracle: { key: string; label: string }[];
    isLoading: boolean;
  } | null>(null);

  const fetchMissingItems = async (code: string) => {
    if (!selectedStructureId) {
      toast.error("Please select a structure first.");
      return;
    }
    setMissingModalData({
      tableName: code,
      missingInPostgres: [],
      missingInOracle: [],
      isLoading: true
    });

    try {
      const res = await fetch(`/api/migration/summary/${selectedStructureId}/missing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          code, 
          inspno: selectedJobpack?.INSPNO || selectedJobpack?.inspno,
          structureType: mappingStructureType,
          ...config 
        })
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        setMissingModalData({
          tableName: code,
          missingInPostgres: data.missingInPostgres || [],
          missingInOracle: data.missingInOracle || [],
          isLoading: false
        });
      } else {
        toast.error(data.error || "Failed to fetch missing items list");
        setMissingModalData(null);
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred fetching missing items");
      setMissingModalData(null);
    }
  };

  const safeParseJson = async (res: Response) => {
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await res.text();
      const titleMatch = text.match(/<title>([\s\S]*?)<\/title>/i);
      const titleText = titleMatch ? titleMatch[1].trim() : "";
      throw new Error(`Server returned HTML error (${res.status}): ${titleText || "Check server terminal console logs."}`);
    }
    return res.json();
  };
  
  const fetchOracleColumns = async (tableName: string) => {
    if (oracleColumnsCache[tableName]) return oracleColumnsCache[tableName];
    
    try {
      const res = await fetch("/api/migration/oracle-columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, tableName })
      });
      const data = await safeParseJson(res);
      if (res.ok && data.success) {
        setOracleColumnsCache(prev => ({ ...prev, [tableName]: data.data.columns }));
        return data.data.columns;
      }
    } catch (err) {
      console.error("Failed to fetch oracle columns for", tableName, err);
    }
    return [];
  };

  // Mapping State
  const [selectedMappingEntity, setSelectedMappingEntity] = useState<string>("STRUCTURE");
  const activeMappingKey = selectedMappingEntity === "STRUCTURE" 
    ? `STRUCTURE_${mappingStructureType}` 
    : selectedMappingEntity;

  const [mappings, setMappings] = useState<Record<string, { oracleCol: string; pgCol: string }[]>>({
    "STRUCTURE_PLATFORM": [
      { oracleCol: "PLAT_ID", pgCol: "plat_id" },
      { oracleCol: "TITLE", pgCol: "title" },
      { oracleCol: "PFIELD", pgCol: "pfield" },
      { oracleCol: "PDESC", pgCol: "pdesc" },
      { oracleCol: "PTYPE", pgCol: "ptype" },
      { oracleCol: "INST_DATE", pgCol: "inst_date" },
      { oracleCol: "DESG_LIFE", pgCol: "desg_life" },
      { oracleCol: "ST_NORTH", pgCol: "st_north" },
      { oracleCol: "ST_EAST", pgCol: "st_east" },
      { oracleCol: "DEPTH", pgCol: "depth" },
      { oracleCol: "AN_QTY", pgCol: "an_qty" },
      { oracleCol: "AN_TYPE", pgCol: "an_type" },
      { oracleCol: "INST_CTR", pgCol: "inst_ctr" },
      { oracleCol: "WALL_THK", pgCol: "wall_thk" },
      { oracleCol: "PROCESS", pgCol: "process" },
      { oracleCol: "PLEGS", pgCol: "plegs" },
      { oracleCol: "CR_USER", pgCol: "cr_user" },
      { oracleCol: "CR_DATE", pgCol: "cr_date" },
      { oracleCol: "DEF_UNIT", pgCol: "def_unit" },
      { oracleCol: "WORKUNIT", pgCol: "workunit" },
      { oracleCol: "DLEG", pgCol: "dleg" },
      { oracleCol: "CONDUCT", pgCol: "conduct" },
      { oracleCol: "CSLOT", pgCol: "cslot" },
      { oracleCol: "PILEINT", pgCol: "pileint" },
      { oracleCol: "PILESKT", pgCol: "pileskt" },
      { oracleCol: "RISER", pgCol: "riser" },
      { oracleCol: "FENDER", pgCol: "fender" },
      { oracleCol: "SUMP", pgCol: "sump" },
      { oracleCol: "CAISSON", pgCol: "caisson" },
      { oracleCol: "CRANE", pgCol: "crane" },
      { oracleCol: "HELIPAD", pgCol: "helipad" },
      { oracleCol: "MANNED", pgCol: "manned" },
      { oracleCol: "LEG_T1", pgCol: "leg_t1" },
      { oracleCol: "LEG_T2", pgCol: "leg_t2" },
      { oracleCol: "LEG_T3", pgCol: "leg_t3" },
      { oracleCol: "LEG_T4", pgCol: "leg_t4" },
      { oracleCol: "LEG_T5", pgCol: "leg_t5" },
      { oracleCol: "LEG_T6", pgCol: "leg_t6" },
      { oracleCol: "LEG_T7", pgCol: "leg_t7" },
      { oracleCol: "LEG_T8", pgCol: "leg_t8" },
      { oracleCol: "LEG_T9", pgCol: "leg_t9" },
      { oracleCol: "LEG_T10", pgCol: "leg_t10" },
      { oracleCol: "LEG_T11", pgCol: "leg_t11" },
      { oracleCol: "LEG_T12", pgCol: "leg_t12" },
      { oracleCol: "LEG_T13", pgCol: "leg_t13" },
      { oracleCol: "LEG_T14", pgCol: "leg_t14" },
      { oracleCol: "LEG_T15", pgCol: "leg_t15" },
      { oracleCol: "LEG_T16", pgCol: "leg_t16" },
      { oracleCol: "LEG_T17", pgCol: "leg_t17" },
      { oracleCol: "LEG_T18", pgCol: "leg_t18" },
      { oracleCol: "LEG_T19", pgCol: "leg_t19" },
      { oracleCol: "LEG_T20", pgCol: "leg_t20" },
      { oracleCol: "SENT", pgCol: "sent" },
      { oracleCol: "MATERIAL", pgCol: "material" },
      { oracleCol: "CP_SYSTEM", pgCol: "cp_system" },
      { oracleCol: "CORR_CTG", pgCol: "corr_ctg" },
      { oracleCol: "NORTH_ANGLE", pgCol: "north_angle" },
      { oracleCol: "NORTH_SIDE", pgCol: "north_side" },
      { oracleCol: "NLEG_T1", pgCol: "nleg_t1" },
      { oracleCol: "NLEG_T2", pgCol: "nleg_t2" }
    ],
    "STRUCTURE_PIPELINE": [
      { oracleCol: "PIPE_ID", pgCol: "pipe_id" },
      { oracleCol: "TITLE", pgCol: "title" },
      { oracleCol: "PFIELD", pgCol: "pfield" },
      { oracleCol: "PDESC", pgCol: "pdesc" },
      { oracleCol: "PTYPE", pgCol: "ptype" },
      { oracleCol: "INST_DATE", pgCol: "inst_date" },
      { oracleCol: "DESG_LIFE", pgCol: "desg_life" },
      { oracleCol: "ST_NORTH", pgCol: "st_north" },
      { oracleCol: "ST_EAST", pgCol: "st_east" },
      { oracleCol: "DEPTH", pgCol: "depth" },
      { oracleCol: "AN_QTY", pgCol: "an_qty" },
      { oracleCol: "AN_TYPE", pgCol: "an_type" },
      { oracleCol: "INST_CTR", pgCol: "inst_ctr" },
      { oracleCol: "WALL_THK", pgCol: "wall_thk" },
      { oracleCol: "PROCESS", pgCol: "process" },
      { oracleCol: "PLEGS", pgCol: "plegs" },
      { oracleCol: "CR_USER", pgCol: "cr_user" },
      { oracleCol: "CR_DATE", pgCol: "cr_date" },
      { oracleCol: "LINE_DIAM", pgCol: "line_diam" },
      { oracleCol: "PLENGTH", pgCol: "plength" },
      { oracleCol: "BURIAL", pgCol: "burial" },
      { oracleCol: "CONC_CTG", pgCol: "conc_ctg" },
      { oracleCol: "OPER_PRESS", pgCol: "oper_press" }
    ],
    "JOBPACK_SOW": [
      { oracleCol: "INSPNO", pgCol: "jobpack_id" },
      { oracleCol: "JOBNAME", pgCol: "title" },
      { oracleCol: "ISTART", pgCol: "start_date" },
      { oracleCol: "CONTRAC", pgCol: "contractor" },
      { oracleCol: "JOB_TYPE", pgCol: "job_type" },
      { oracleCol: "V_NAME", pgCol: "vessel_name" },
      { oracleCol: "START_DATE", pgCol: "vessel_date_of_start" },
      { oracleCol: "REP_PREFIX", pgCol: "sow_report_no" }
    ],
    "LOGS_ROV": [
      { oracleCol: "DIVE_NO", pgCol: "job.deployment_no" },
      { oracleCol: "DIVER", pgCol: "job.rov_operator" },
      { oracleCol: "SUPERVISOR", pgCol: "job.rov_supervisor" },
      { oracleCol: "REP_CO", pgCol: "job.report_coordinator" },
      { oracleCol: "LOG_DATE", pgCol: "job.deployment_date" },
      { oracleCol: "LOG_DETAIL", pgCol: "movement.remarks" }
    ],
    "LOGS_DIVE": [
      { oracleCol: "DIVE_NO", pgCol: "job.dive_no" },
      { oracleCol: "DIVER", pgCol: "job.diver_name" },
      { oracleCol: "SUPERVISOR", pgCol: "job.dive_supervisor" },
      { oracleCol: "REP_CO", pgCol: "job.report_coordinator" },
      { oracleCol: "LOG_DATE", pgCol: "job.dive_date" },
      { oracleCol: "LOG_DETAIL", pgCol: "movement.remarks" }
    ]
  });

  // Load saved state from localStorage on mount & setup auto-disconnect on navigation
  useEffect(() => {
    try {
      // 1. Load connection settings
      const savedConfig = localStorage.getItem("migration_db_config");
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (parsed && typeof parsed === "object") {
          setConfig(prev => ({
            ...prev,
            ...parsed
          }));
        }
      }

      // 2. Load field mappings
      const savedMappings = localStorage.getItem("migration_mappings");
      if (savedMappings) {
        const parsed = JSON.parse(savedMappings);
        if (parsed && typeof parsed === "object") {
          // Backward compatibility: Migration of legacy mappings
          if (parsed.STRUCTURE && !parsed.STRUCTURE_PLATFORM) {
            parsed.STRUCTURE_PLATFORM = parsed.STRUCTURE;
          }
          if (parsed.STRUCTURE && !parsed.STRUCTURE_PIPELINE) {
            parsed.STRUCTURE_PIPELINE = parsed.STRUCTURE;
          }
          setMappings(prev => ({
            ...prev,
            ...parsed
          }));
        }
      }
    } catch (err) {
      console.error("Failed to load saved state from localStorage:", err);
    }

    // 3. Auto-disconnect when user navigates away from this page
    return () => {
      fetch("/api/migration/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      }).catch(err => console.warn("Auto disconnect call failed:", err));
    };
  }, []);

  // Auto-save database configuration locally when it changes
  useEffect(() => {
    if (config.host || config.user || config.serviceName || config.connectString) {
      localStorage.setItem("migration_db_config", JSON.stringify(config));
    }
  }, [config]);

  // Copy mappings to clipboard and state
  const handleSelectInspectionMapping = async (type: "ROV" | "DIVING", code: string, tableName: string) => {
    const key = `INSP_${type}_${code}`;
    setSelectedMappingEntity(key);
    
    // Fetch columns for the table (non-blocking for UI)
    fetchOracleColumns(tableName);

    setMappings(prev => {
      if (prev[key] && prev[key].length > 0) return prev;
      
      // Auto-populate default shared fields
      const defaults = [
        { oracleCol: "INSP_ID", pgCol: "oracle_insp_id" },
        { oracleCol: "COMP_ID", pgCol: "component_id" },
        { oracleCol: "INSPNO", pgCol: "jobpack_id" },
        { oracleCol: "TAPE_NO", pgCol: "tape_id" },
        { oracleCol: "DIVE_NO", pgCol: type === "ROV" ? "rov_job_id" : "dive_job_id" },
        { oracleCol: "INSP_DATE", pgCol: "inspection_date" },
        { oracleCol: "INSP_TIME", pgCol: "inspection_time" }
      ];
      
      return { ...prev, [key]: defaults };
    });
  };

  const handleCopyMappings = () => {
    try {
      const activeMappings = mappings[activeMappingKey] || [];
      if (activeMappings.length === 0) {
        toast.error(`No mappings found to copy for target "${selectedMappingEntity}"`);
        return;
      }
      localStorage.setItem("migration_copied_mappings", JSON.stringify(activeMappings));
      if (navigator.clipboard) {
        navigator.clipboard.writeText(JSON.stringify(activeMappings))
          .catch(e => console.warn("Clipboard API write failed:", e));
      }
      toast.success(`Copied ${activeMappings.length} field mappings for "${selectedMappingEntity}"! Ready to paste into another target.`);
    } catch (err: any) {
      toast.error("Failed to copy mappings: " + err.message);
    }
  };

  // Paste mappings from state/clipboard
  const handlePasteMappings = () => {
    try {
      const saved = localStorage.getItem("migration_copied_mappings");
      if (!saved) {
        toast.error("No copied mappings found. Please copy mappings first!");
        return;
      }
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) {
        toast.error("Invalid copied mappings format.");
        return;
      }
      
      setMappings(prev => ({
        ...prev,
        [activeMappingKey]: parsed
      }));
      toast.success(`Successfully pasted ${parsed.length} field mappings to "${selectedMappingEntity}"! Click "Save Mappings" to persist.`);
    } catch (err: any) {
      toast.error("Failed to paste mappings: " + err.message);
    }
  };

  const handleSaveMappings = () => {
    try {
      localStorage.setItem("migration_mappings", JSON.stringify(mappings));
      toast.success("Data mapping configuration saved successfully!");
    } catch (err: any) {
      toast.error("Failed to save mappings: " + err.message);
    }
  };

  const handleAddMapping = () => {
    setMappings(prev => {
      const entityMappings = prev[activeMappingKey] || [];
      return {
        ...prev,
        [activeMappingKey]: [...entityMappings, { oracleCol: "", pgCol: "" }]
      };
    });
  };

  const handleUpdateMapping = (index: number, field: "oracleCol" | "pgCol", value: string) => {
    setMappings(prev => {
      const entityMappings = [...(prev[activeMappingKey] || [])];
      entityMappings[index][field] = value;
      return { ...prev, [activeMappingKey]: entityMappings };
    });
  };

  const handleRemoveMapping = (index: number) => {
    setMappings(prev => {
      const entityMappings = [...(prev[activeMappingKey] || [])];
      entityMappings.splice(index, 1);
      return { ...prev, [activeMappingKey]: entityMappings };
    });
  };

  const handleMoveMapping = (index: number, direction: "up" | "down") => {
    setMappings(prev => {
      const entityMappings = [...(prev[activeMappingKey] || [])];
      if (direction === "up" && index > 0) {
        const temp = entityMappings[index];
        entityMappings[index] = entityMappings[index - 1];
        entityMappings[index - 1] = temp;
      } else if (direction === "down" && index < entityMappings.length - 1) {
        const temp = entityMappings[index];
        entityMappings[index] = entityMappings[index + 1];
        entityMappings[index + 1] = temp;
      }
      return { ...prev, [activeMappingKey]: entityMappings };
    });
  };

  const [migrationLogs, setMigrationLogs] = useState<string[]>([]);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationReport, setMigrationReport] = useState<Record<string, { status: "success" | "failed" | "skipped"; oracleRows: number; migratedRows: number; errors: string[]; filesCopied?: number }> | null>(null);
  const [migrationProgress, setMigrationProgress] = useState<{ current: number; total: number; label: string; percent: number } | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [shouldAutoPrintReport, setShouldAutoPrintReport] = useState(false);
  const [expandedRecords, setExpandedRecords] = useState<Record<string, boolean>>({});

  const toggleRecordExpansion = (key: string) => {
    setExpandedRecords(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getFriendlyErrorDetails = (errStr: string) => {
    const err = String(errStr).toLowerCase();
    
    if (err.includes("violates row-level security") || err.includes("rls") || err.includes("42501")) {
      return {
        title: "Row-Level Security (RLS) Permission Denied",
        why: "The database blocked the write because the connection lacks sufficient permissions.",
        rectify: "Check the RLS policies in Supabase for this table. Ensure that inserts are allowed for authenticated/service_role roles, or verify your auth session is active.",
        severity: "high"
      };
    }
    
    if (err.includes("invalid input syntax for type time") || err.includes("22007") || err.includes("invalid input syntax for type date")) {
      return {
        title: "Date / Time Format Type Mismatch",
        why: "A date or time value from Oracle does not match Postgres DATE or TIME data type formatting rules.",
        rectify: "Verify date/time format matches exactly: 'YYYY-MM-DD' for date and 'HH:MM:SS' for time. Remove any ISO timezone prefixes/suffixes.",
        severity: "medium"
      };
    }

    if (err.includes("violates unique constraint") || err.includes("duplicate key") || err.includes("23505")) {
      return {
        title: "Unique Constraint Violation (Duplicate Record)",
        why: "A record with the exact same unique key already exists in the destination Postgres table.",
        rectify: "De-duplicate your source Oracle rows, clear existing rows from Postgres before re-migrating, or make unique column prefixes safer.",
        severity: "medium"
      };
    }

    if (err.includes("violates foreign key constraint") || err.includes("23503")) {
      return {
        title: "Foreign Key Referential Violation",
        why: "The record references a parent record ID that has not yet been migrated to Postgres.",
        rectify: "Make sure you migrate parent entities like Structure or Jobpack *before* running this migration block.",
        severity: "high"
      };
    }

    if (err.includes("violates not-null constraint") || err.includes("null value in column") || err.includes("23502")) {
      const colMatch = err.match(/column "([^"]+)"/);
      const colName = colMatch ? colMatch[1] : "required column";
      return {
        title: "Missing Required Value (Not-Null Constraint)",
        why: `Column "${colName}" is mandatory in Postgres, but the incoming Oracle record was blank or missing this field.`,
        rectify: `Provide a default mapping fallback for "${colName}" or ensure that the Oracle source field contains valid data.`,
        severity: "medium"
      };
    }

    if (err.includes("check constraint") || err.includes("chk_") || err.includes("23514")) {
      return {
        title: "Database Check Constraint Violated",
        why: "The record contains a value that violates a defined Postgres CHECK column constraint.",
        rectify: "Ensure that values like status or type codes map exactly to the uppercase allowed list (e.g. status in 'IN_PROGRESS', 'COMPLETED', etc.).",
        severity: "medium"
      };
    }

    return {
      title: "General Migration/Database Error",
      why: errStr,
      rectify: "Inspect the schema mappings and check server-side logs for detailed database transaction traces.",
      severity: "low"
    };
  };

  const handleExecuteMigration = async () => {
    if (!selectedStructureId) return;
    if (!componentsOnly && !selectedJobpack) {
      toast.error("Please select an Active Job Pack from the sidebar or select the 'Migrate Components Only' option.");
      return;
    }
    
    setMigrationReport(null);
    setMigrationLogs(["Starting migration process..."]);
    setMigrationProgress({
      current: 1,
      total: 9,
      label: "Establishing tunnels & initializing Oracle client...",
      percent: 5
    });
    
    try {
      setIsMigrating(true);
      
      // Adapt payload with dynamically populated STRUCTURE mapping
      const payloadMappings = {
        ...mappings,
        STRUCTURE: mappings[`STRUCTURE_${mappingStructureType}`] || mappings.STRUCTURE || []
      };

      const res = await fetch("/api/migration/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config,
          structureId: selectedStructureId,
          mappings: payloadMappings,
          selectedInspNo: componentsOnly ? undefined : (selectedJobpack?.INSPNO || selectedJobpack?.inspno),
          legacyAttachmentPath: config.legacyAttachmentPath,
          componentsOnly
        })
      });

      if (!res.ok) {
        let errText = "Migration execution failed";
        try {
          const errData = await res.json();
          errText = errData.error || errText;
        } catch {}
        throw new Error(errText);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);
              if (event.type === "log") {
                setMigrationLogs(prev => [...prev, event.message]);
              } else if (event.type === "progress") {
                setMigrationProgress({
                  current: event.current,
                  total: event.total,
                  label: event.label,
                  percent: event.percent
                });
              } else if (event.type === "table_report") {
                setMigrationReport(prev => ({
                  ...prev,
                  [event.table]: {
                    status: event.status,
                    oracleRows: event.oracleRows,
                    migratedRows: event.migratedRows,
                    errors: event.errors,
                    filesCopied: event.filesCopied
                  }
                }));
              } else if (event.type === "complete") {
                setMigrationProgress({
                  current: 9,
                  total: 9,
                  label: "Migration completed successfully!",
                  percent: 100
                });
                toast.success(event.message || "Migration completed!");
                setMigrationReport(event.report);
              } else if (event.type === "error") {
                toast.error(event.message || "Migration failed");
              }
            } catch (e) {
              console.error("Failed to parse streaming line:", line, e);
            }
          }
        }
      }
    } catch (err: any) {
      setMigrationProgress(null);
      toast.error(err.message || "An error occurred during migration");
      setMigrationLogs(prev => [...prev, `ERROR: ${err.message}`]);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const res = await fetch("/api/migration/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      const data = await safeParseJson(res);
      
      if (res.ok) {
        toast.success(data.message || "Connected successfully!");
        setIsConnected(true);
        fetchStructures();
        setActiveTab("migration");
      } else {
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-bold">{data.error || "Failed to connect"}</span>
            {data.details && <span className="text-xs opacity-90 font-mono break-all">{data.details}</span>}
          </div>, 
          { duration: 8000 }
        );
      }
    } catch (err: any) {
      toast.error(
        <div className="flex flex-col gap-1">
          <span className="font-bold">An error occurred</span>
          <span className="text-xs opacity-90 font-mono break-all">{err.message}</span>
        </div>
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const fetchStructures = async () => {
    try {
      setIsLoadingStructures(true);
      const res = await fetch("/api/migration/structures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        setStructures(data.data || []);
      } else {
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-bold">{data.error || "Failed to fetch structures"}</span>
            {data.details && <span className="text-xs opacity-90 font-mono break-all">{data.details}</span>}
          </div>
        );
      }
    } catch (err: any) {
      toast.error(
        <div className="flex flex-col gap-1">
          <span className="font-bold">An error occurred</span>
          <span className="text-xs opacity-90 font-mono break-all">{err.message}</span>
        </div>
      );
    } finally {
      setIsLoadingStructures(false);
    }
  };

  const handlePrintReport = () => {
    setShouldAutoPrintReport(false);
    setIsReportOpen(true);
  };

  const handleStructureSelect = async (strId: string) => {
    // If active migration report, logs, or progress are displayed, ask user to confirm clearing them!
    if (migrationLogs.length > 0 || migrationReport || migrationProgress) {
      const confirmSwitch = window.confirm("Are you sure you want to change the selected structure? This will clear all current migration progress, logs, and report data.");
      if (!confirmSwitch) {
        return; // stay there, do not switch
      }
    }

    // Switch confirmed: clear all previous migration runs & progress
    setMigrationLogs([]);
    setMigrationReport(null);
    setMigrationProgress(null);
    setJobpacks([]);
    setLibraries([]);
    setFramework([]);
    setInspectionJobs([]);
    setSelectedJobpack(null);
    setInspectionSummary(null);
    setOracleCompany(null);
    setOraclePreference(null);

    setSelectedStructureId(strId);
    
    // Fetch summary
    try {
      setIsLoadingSummary(true);
      const res = await fetch(`/api/migration/summary/${strId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        setSummary(data.data || []);
        setLibraries(data.libraries || []);
        setFramework(data.framework || []);
        setOracleCompany(data.company || null);
        setOraclePreference(data.preference || null);
      } else {
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-bold">{data.error || "Failed to fetch summary"}</span>
            {data.details && <span className="text-xs opacity-90 font-mono break-all">{data.details}</span>}
          </div>
        );
      }
    } catch (err: any) {
      toast.error(
        <div className="flex flex-col gap-1">
          <span className="font-bold">An error occurred</span>
          <span className="text-xs opacity-90 font-mono break-all">{err.message}</span>
        </div>
      );
    } finally {
      setIsLoadingSummary(false);
    }

    // Fetch jobpacks with inspection data for this structure from Oracle
    try {
      setIsLoadingJobpacks(true);
      const res = await fetch(`/api/migration/jobpacks/${strId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        setJobpacks(data.data || []);
      } else {
        setJobpacks([]);
        console.error("Failed to fetch jobpacks:", data.error);
      }
    } catch (err) {
      setJobpacks([]);
      console.error("Error fetching jobpacks:", err);
    } finally {
      setIsLoadingJobpacks(false);
    }
  };

  const handleJobpackSelect = async (jp: any) => {
    setSelectedJobpack(jp);
    setInspectionSummary(null);
    
    const inspNoVal = jp.INSPNO || jp.inspno;
    if (!selectedStructureId || !inspNoVal) return;

    try {
      setIsLoadingInspectionSummary(true);
      const res = await fetch("/api/migration/inspection-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config,
          str_id: selectedStructureId,
          inspno: inspNoVal,
          structureType: mappingStructureType
        })
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        setInspectionSummary(data.data);
        setInspectionJobs(data.jobs || []);
      } else {
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-bold">{data.error || "Failed to fetch inspection summary"}</span>
            {data.details && <span className="text-xs opacity-90 font-mono break-all">{data.details}</span>}
          </div>
        );
      }
    } catch (err: any) {
      toast.error(
        <div className="flex flex-col gap-1">
          <span className="font-bold">An error occurred</span>
          <span className="text-xs opacity-90 font-mono break-all">{err.message}</span>
        </div>
      );
    } finally {
      setIsLoadingInspectionSummary(false);
    }
  };

  return (
    <div className="flex h-full bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden">
      <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Oracle Migration Module</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Phase 1: Structure & Component Migration</p>
          </div>
          <div className="flex items-center gap-3">
            {isConnected ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Connected to Oracle</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-full border border-rose-200 dark:border-rose-800">
                <Database className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Disconnected</span>
              </div>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-12 p-1 rounded-xl">
            <TabsTrigger value="connection" className="rounded-lg font-bold text-xs uppercase tracking-wider data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm transition-all"><Server className="w-4 h-4 mr-2" /> Connection</TabsTrigger>
            <TabsTrigger value="migration" disabled={!isConnected} className="rounded-lg font-bold text-xs uppercase tracking-wider data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-sm transition-all"><ArrowRight className="w-4 h-4 mr-2" /> Migration</TabsTrigger>
            <TabsTrigger value="mapping" disabled={!isConnected} className="rounded-lg font-bold text-xs uppercase tracking-wider data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-teal-600 dark:data-[state=active]:text-teal-400 data-[state=active]:shadow-sm transition-all"><Settings2 className="w-4 h-4 mr-2" /> Mapping</TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="connection" className="m-0 border-none outline-none">
              <Card className="max-w-3xl border-slate-200 dark:border-slate-800 shadow-sm">
                <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <CardTitle className="text-sm font-black uppercase text-slate-800 dark:text-slate-200">Oracle Database Credentials</CardTitle>
                  <CardDescription className="text-xs">Enter the legacy Oracle database connection details to begin.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="flex items-center gap-4 mb-2">
                    <Button variant={useConnectString ? "outline" : "default"} onClick={() => setUseConnectString(false)} className="h-8 text-xs font-bold uppercase tracking-wider rounded-md">Host / Service Name</Button>
                    <Button variant={!useConnectString ? "outline" : "default"} onClick={() => setUseConnectString(true)} className="h-8 text-xs font-bold uppercase tracking-wider rounded-md">TNS / Connect String</Button>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {useConnectString ? (
                      <div className="col-span-2 space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-500">Connect String (TNS)</Label>
                        <Input value={config.connectString} onChange={e => setConfig({...config, connectString: e.target.value})} placeholder="e.g. (DESCRIPTION=(ADDRESS=...))" className="font-mono text-xs bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800" />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-500">Host</Label>
                          <Input value={config.host} onChange={e => setConfig({...config, host: e.target.value})} placeholder="e.g. 192.168.1.100" className="font-mono text-xs bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-500">Port</Label>
                          <Input type="number" value={config.port} onChange={e => setConfig({...config, port: parseInt(e.target.value) || 1521})} className="font-mono text-xs bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800" />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-500">Service Name / SID</Label>
                          <Input value={config.serviceName} onChange={e => setConfig({...config, serviceName: e.target.value})} placeholder="e.g. ORCL" className="font-mono text-xs bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800" />
                        </div>
                      </>
                    )}
                    
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-500">Username</Label>
                      <Input value={config.user} onChange={e => setConfig({...config, user: e.target.value})} className="font-mono text-xs bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-500">Password</Label>
                      <Input type="password" value={config.password} onChange={e => setConfig({...config, password: e.target.value})} className="font-mono text-xs bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800" />
                    </div>

                    <div className="col-span-2 flex items-center space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <input
                        type="checkbox"
                        id="useThickMode"
                        checked={config.useThickMode || false}
                        onChange={e => setConfig({...config, useThickMode: e.target.checked})}
                        className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <Label htmlFor="useThickMode" className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 cursor-pointer">
                        Enable Oracle Thick Mode (for legacy databases like 10g/11g)
                      </Label>
                    </div>

                    {config.useThickMode && (
                      <div className="col-span-2 space-y-1.5 transition-all">
                        <Label className="text-[10px] font-black uppercase text-slate-500">Oracle Client Library Path (Instant Client Directory)</Label>
                        <Input
                          value={config.libDir}
                          onChange={e => setConfig({...config, libDir: e.target.value})}
                          placeholder="e.g. C:\instantclient_12_2"
                          className="font-mono text-xs bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
                        />
                        <p className="text-[10px] text-slate-400">Specifies the absolute directory of your Oracle Instant Client (required for legacy thick connection).</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button onClick={handleConnect} disabled={isConnecting} className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-wider text-xs rounded-lg shadow-md px-6">
                      {isConnecting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Server className="w-4 h-4 mr-2" />}
                      Test & Connect
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="max-w-3xl mt-6 border-slate-200 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/30 dark:from-slate-900 dark:to-slate-950/20">
                <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-black uppercase text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-indigo-500" />
                        Legacy Attachments Source Setting
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Configure where legacy media files are downloaded or copied from during Phase 6 attachment migration.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                      Source Drive / Storage Selection
                    </Label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setConfig({
                          ...config,
                          legacyAttachmentType: "local",
                          legacyAttachmentPath: config.legacyAttachmentPath || "C:\\LegacyAttachments\\"
                        })}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 ${
                          config.legacyAttachmentType === "local"
                            ? "border-indigo-500 bg-indigo-50/30 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/20 dark:text-indigo-400 ring-2 ring-indigo-500/20"
                            : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${
                          config.legacyAttachmentType === "local" ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                        }`}>
                          <FolderOpen className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider">Local Drive</p>
                          <p className="text-[10px] opacity-80 font-medium">Local server folders</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfig({
                          ...config,
                          legacyAttachmentType: "network",
                          legacyAttachmentPath: config.legacyAttachmentPath || "\\\\192.168.1.100\\shared\\attachments\\"
                        })}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 ${
                          config.legacyAttachmentType === "network"
                            ? "border-indigo-500 bg-indigo-50/30 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/20 dark:text-indigo-400 ring-2 ring-indigo-500/20"
                            : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${
                          config.legacyAttachmentType === "network" ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                        }`}>
                          <Network className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider">Network Drive</p>
                          <p className="text-[10px] opacity-80 font-medium">UNC shared drives</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfig({
                          ...config,
                          legacyAttachmentType: "cloud",
                          legacyAttachmentPath: config.legacyAttachmentPath || "https://cloud-drive.com/attachments/"
                        })}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 ${
                          config.legacyAttachmentType === "cloud"
                            ? "border-indigo-500 bg-indigo-50/30 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/20 dark:text-indigo-400 ring-2 ring-indigo-500/20"
                            : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${
                          config.legacyAttachmentType === "cloud" ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                        }`}>
                          <Cloud className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider">Cloud HTTP/S</p>
                          <p className="text-[10px] opacity-80 font-medium">Web/Cloud hosting</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="legacyAttachmentPath" className="text-[10px] font-black uppercase text-slate-500">
                      {config.legacyAttachmentType === "local" && "Local Directory Path"}
                      {config.legacyAttachmentType === "network" && "Network Drive UNC Path"}
                      {config.legacyAttachmentType === "cloud" && "Cloud Drive / Web Base URL"}
                    </Label>
                    <Input
                      id="legacyAttachmentPath"
                      value={config.legacyAttachmentPath}
                      onChange={e => setConfig({...config, legacyAttachmentPath: e.target.value})}
                      placeholder={
                        config.legacyAttachmentType === "local" ? "e.g. C:\\LegacyAttachments\\" :
                        config.legacyAttachmentType === "network" ? "e.g. \\\\server\\share\\attachments\\" :
                        "e.g. https://cloud-drive.com/attachments/"
                      }
                      className="font-mono text-xs bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 h-10"
                    />

                    {config.legacyAttachmentType === "local" && (
                      <p className="text-[10px] text-slate-400 leading-normal">
                        Specifies the local filesystem path on the host. Make sure backslashes are escaped correctly if needed, or simply write them natively (e.g. <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-500">C:\LegacyAttachments\</code>).
                      </p>
                    )}
                    {config.legacyAttachmentType === "network" && (
                      <p className="text-[10px] text-slate-400 leading-normal">
                        Specifies a remote network folder via standard Windows UNC naming conventions (e.g. <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-500">\\192.168.1.100\attachments\</code>).
                      </p>
                    )}
                    {config.legacyAttachmentType === "cloud" && (
                      <p className="text-[10px] text-slate-400 leading-normal">
                        Downloads legacy attachments on-the-fly via HTTP/S GET requests, combining this base URL with the filename (e.g. <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-500">https://my-server.com/files/</code>).
                      </p>
                    )}

                    <div className="mt-4 p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/80 space-y-2">
                      <div className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                        <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200 block uppercase tracking-wider text-[9px]">How file copying works:</span>
                          <span className="leading-relaxed">
                            During Phase 6, the system reads each attachment. If a path is configured here, it downloads or reads the file, then physically copies it to the active destination storage provider configured under Company Preferences (e.g., Supabase bucket or custom S3).
                          </span>
                        </div>
                      </div>
                      <div className="pl-6 text-[10px] text-slate-400/80">
                        <span className="font-semibold text-slate-500 block uppercase tracking-wider text-[8px] mt-1.5">Fallback Search Strategy:</span>
                        If the file isn't found in your configured drive setting, the migration pipeline automatically falls back to searching at the original Oracle database path (<code className="bg-slate-100/60 dark:bg-slate-800/60 px-1 py-0.2 rounded font-mono text-[9px]">A_PATH + A_FILENAME</code>). If still not found, it logs a warning but registers the metadata record gracefully.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="migration" className="m-0 border-none outline-none">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="col-span-1 lg:col-span-1 border-slate-200 dark:border-slate-800 shadow-sm h-fit">
                  <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <CardTitle className="text-sm font-black uppercase text-slate-800 dark:text-slate-200 flex items-center justify-between">
                      Select Structure
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-blue-500" onClick={fetchStructures} disabled={isLoadingStructures}><RefreshCw className={`w-3.5 h-3.5 ${isLoadingStructures ? 'animate-spin' : ''}`} /></Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500">Available Oracle Structures ({structures.length})</Label>
                      <Select value={selectedStructureId} onValueChange={handleStructureSelect}>
                        <SelectTrigger className="w-full bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                          <SelectValue placeholder="Select a structure..." />
                        </SelectTrigger>
                        <SelectContent>
                          <ScrollArea className="h-64">
                            {structures.map((s: any) => (
                              <SelectItem key={s.STR_ID} value={String(s.STR_ID)}>
                                <span className="font-bold">{s.TITLE}</span> <span className="text-[10px] text-slate-500 uppercase">({s.PTYPE})</span>
                              </SelectItem>
                            ))}
                          </ScrollArea>
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedStructureId && (() => {
                      const structObj = structures.find((s: any) => String(s.STR_ID) === selectedStructureId);
                      const defUnitVal = structObj?.DEF_UNIT || structObj?.def_unit || "METRIC";
                      return (
                        <div className="space-y-4 mt-6">
                          <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl space-y-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">
                                  {structObj?.TITLE}
                                </div>
                                <div className="flex items-center justify-between mt-1 text-[10px] font-bold text-slate-500 uppercase">
                                  <span>ID: {selectedStructureId}</span>
                                  <span className={`px-2 py-0.5 text-[9px] font-extrabold tracking-widest rounded-md uppercase border ${
                                    defUnitVal === "IMPERIAL" 
                                      ? "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/30" 
                                      : "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/30"
                                  }`}>
                                    {defUnitVal}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800/80 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <Database className="w-3.5 h-3.5 text-indigo-500" />
                                Active Job Packs
                              </Label>
                              <span className="text-[9px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/30 px-1.5 py-0.5 rounded-md uppercase">
                                With Inspection Data
                              </span>
                            </div>

                            {isLoadingJobpacks ? (
                              <div className="flex items-center justify-center py-6 gap-2 text-xs font-semibold text-slate-400">
                                <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                                Loading associated job packs...
                              </div>
                            ) : jobpacks.length > 0 ? (
                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {jobpacks.map((jp: any, index: number) => {
                                  const jobName = jp.JOBNAME || jp.jobname || jp.JOB_NAME || jp.job_name || "Unnamed Job Pack";
                                  const startDateVal = jp.START_DATE || jp.start_date || jp.ISTART || jp.istart;
                                  const formattedDate = startDateVal 
                                    ? new Date(startDateVal).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) 
                                    : "No Start Date";
                                  const jobType = jp.JOB_TYPE || jp.job_type || jp.JOBTYPE || jp.jobtype;
                                  const hasRov = jp.HAS_ROV || jp.has_rov || jp.hasRov || false;
                                  const hasDiving = jp.HAS_DIVING || jp.has_diving || jp.hasDiving || false;
                                  
                                  const isSelected = selectedJobpack && (selectedJobpack.INSPNO === jp.INSPNO || selectedJobpack.inspno === jp.INSPNO || selectedJobpack.INSPNO === jp.inspno);
                                  
                                  return (
                                    <div 
                                      key={`${jobName}-${index}`} 
                                      onClick={() => handleJobpackSelect(jp)}
                                      className={`flex items-center justify-between gap-2 p-2 rounded-lg transition-all duration-200 shadow-sm group cursor-pointer border ${
                                        isSelected 
                                          ? "border-indigo-500 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20" 
                                          : "bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800/60 hover:border-slate-200 dark:hover:border-slate-700/60"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <div className="w-5 h-5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100/50 dark:border-indigo-900/35 flex items-center justify-center text-indigo-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                          <FileText className="w-3 h-3" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                            {jobName}
                                          </div>
                                          <div className="text-[9px] font-medium text-slate-400 uppercase flex flex-wrap items-center gap-1.5 mt-0.5">
                                            <span>Start: {formattedDate}</span>
                                            {hasRov && (
                                              <span className="inline-flex items-center px-1 py-0.2 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 text-[8px] font-extrabold uppercase rounded tracking-wider border border-cyan-200/40 dark:border-cyan-800/20 shrink-0">
                                                ROV Data
                                              </span>
                                            )}
                                            {hasDiving && (
                                              <span className="inline-flex items-center px-1 py-0.2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-[8px] font-extrabold uppercase rounded tracking-wider border border-emerald-200/40 dark:border-emerald-800/20 shrink-0">
                                                Diving Data
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      {jobType && (
                                        <span className={`text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${
                                          jobType.toUpperCase().includes('ROV')
                                            ? 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-900/30'
                                            : jobType.toUpperCase().includes('DIVING')
                                            ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/30'
                                            : 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/30'
                                        }`}>
                                          {jobType}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-6 text-xs font-semibold text-slate-400 bg-white dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                                No job packs with inspection data found for this structure.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                <div className="col-span-1 lg:col-span-2 space-y-6">
                  {/* Premium Migration Active Loader */}
                  {isMigrating && migrationProgress && (
                    <Card className="border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-br from-white via-indigo-50/10 to-indigo-50/20 dark:from-slate-900 dark:to-indigo-950/20 shadow-md">
                      <CardContent className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Database Migration Active</span>
                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{migrationProgress.label}</h4>
                          </div>
                          <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{migrationProgress.percent}%</span>
                        </div>
                        
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-2.5 rounded-full transition-all duration-500 ease-out animate-pulse" 
                            style={{ width: `${migrationProgress.percent}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                          <span>Step {migrationProgress.current} of {migrationProgress.total}</span>
                          <span className="flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" />
                            Transferring legacy rows...
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Premium Migration Detailed Summary Report */}
                  {migrationReport && (
                    <Card id="migration-dashboard-summary-card" className="border-emerald-100 dark:border-emerald-950/50 bg-gradient-to-br from-white via-emerald-50/5 to-emerald-50/15 dark:from-slate-900 dark:to-emerald-950/10 shadow-md">
                      <CardHeader className="border-b border-emerald-50 dark:border-emerald-950/30 pb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-sm font-black uppercase text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                              Data Migration Summary Report
                            </CardTitle>
                            <CardDescription className="text-[10px] uppercase font-bold text-slate-500 mt-0.5">
                              Veracity Audit & Schema Translation Analytics
                            </CardDescription>
                          </div>
                           <div className="flex items-center gap-2">
                             <Button 
                               variant="outline"
                               size="sm"
                               onClick={handlePrintReport}
                               className="text-indigo-600 border-indigo-200 hover:bg-indigo-50/50 dark:text-indigo-400 dark:border-indigo-900/50 dark:hover:bg-indigo-950/30 h-7 text-[10px] font-extrabold uppercase flex items-center gap-1"
                             >
                               <Eye className="w-3.5 h-3.5" />
                               Print Preview
                             </Button>
                             <Button 
                               size="sm"
                               onClick={() => {
                                 setShouldAutoPrintReport(true);
                                 setIsReportOpen(true);
                               }}
                               className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold uppercase tracking-wide h-7 text-[10px] flex items-center gap-1 shadow-sm rounded"
                             >
                               <Printer className="w-3.5 h-3.5" />
                               Print to PDF
                             </Button>
                             <Button 
                               variant="outline"
                               size="sm"
                               onClick={() => {
                                 setMigrationReport(null);
                                 setMigrationLogs([]);
                                 setMigrationProgress(null);
                               }}
                               className="text-slate-500 hover:text-slate-700 h-7 text-[10px] font-bold uppercase"
                             >
                               Clear Report
                             </Button>
                           </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 space-y-6">
                        {/* Metrics Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl flex flex-col">
                            <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">Oracle Records</span>
                            <span className="text-lg font-black text-slate-800 dark:text-slate-200">
                              {Object.values(migrationReport).reduce((acc, curr) => acc + curr.oracleRows, 0)}
                            </span>
                          </div>
                          <div className="bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl flex flex-col">
                            <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">Postgres Copied</span>
                            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                              {Object.values(migrationReport).reduce((acc, curr) => acc + curr.migratedRows, 0)}
                            </span>
                          </div>
                          <div className="bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl flex flex-col">
                            <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">Copy Accuracy</span>
                            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                              {(() => {
                                const oracle = Object.values(migrationReport).reduce((acc, curr) => acc + curr.oracleRows, 0);
                                const pg = Object.values(migrationReport).reduce((acc, curr) => acc + curr.migratedRows, 0);
                                if (oracle === 0) return "100%";
                                return `${Math.min(100, Math.round((pg / oracle) * 100))}%`;
                              })()}
                            </span>
                          </div>
                          <div className="bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl flex flex-col">
                            <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">Total Errors</span>
                            <span className={`text-lg font-black ${Object.values(migrationReport).reduce((acc, curr) => acc + curr.errors.length, 0) > 0 ? "text-rose-500" : "text-emerald-600"}`}>
                              {Object.values(migrationReport).reduce((acc, curr) => acc + curr.errors.length, 0)}
                            </span>
                          </div>
                        </div>

                        {/* Overall Copy Progress Gauge */}
                        {(() => {
                          const totalOracle = Object.values(migrationReport).reduce((acc, curr) => acc + curr.oracleRows, 0);
                          const totalPg = Object.values(migrationReport).reduce((acc, curr) => acc + curr.migratedRows, 0);
                          const percent = totalOracle === 0 ? 100 : Math.min(100, Math.round((totalPg / totalOracle) * 100));
                          
                          // Dynamic Color Codes
                          let barColorClass = "from-rose-500 to-red-500 animate-pulse";
                          let textBorderClass = "text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/30";
                          let bgBadgeClass = "bg-rose-50 dark:bg-rose-950/40";
                          
                          if (percent >= 90) {
                            barColorClass = "from-emerald-500 to-teal-500";
                            textBorderClass = "text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30";
                            bgBadgeClass = "bg-emerald-50 dark:bg-emerald-950/40";
                          } else if (percent >= 60) {
                            barColorClass = "from-indigo-500 to-blue-500";
                            textBorderClass = "text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/30";
                            bgBadgeClass = "bg-indigo-50 dark:bg-indigo-950/40";
                          } else if (percent >= 30) {
                            barColorClass = "from-amber-500 to-orange-500 animate-pulse";
                            textBorderClass = "text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/30";
                            bgBadgeClass = "bg-amber-50 dark:bg-amber-950/40";
                          }

                          return (
                            <div className="p-4 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl space-y-3">
                              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                <span className="flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                                  Overall Copy Progress
                                </span>
                                <span className={`px-2.5 py-0.5 rounded-full border font-black tracking-widest ${bgBadgeClass} ${textBorderClass}`}>
                                  {percent}% ACCURACY
                                </span>
                              </div>
                              
                              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-200/50 dark:border-slate-800">
                                <div 
                                  className={`bg-gradient-to-r ${barColorClass} h-3 rounded-full transition-all duration-1000 ease-out`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                              
                              <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                <span>{totalPg} POSTGRES RECORDS COPIED</span>
                                <span>{totalOracle} ORACLE RECORDS FOUND</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Breakdown List grouped by Section */}
                        <div className="space-y-4">
                          {(() => {
                            const libKeys = ["U_LIB_MAST", "U_LIB_LIST", "U_LIB_COMBO"];
                            const systemKeys = ["STRUCTURE", "STR_ELV", "STR_LEVEL", "STR_FACES", "U_ASSOC"];
                            const jobInspectionKeys = [
                              "JOBPACK", "U_SOW", "LOGS_JOBS", "LOGS_MOVEMENTS", "VIDEO", 
                              "INSP_ROV", "INSP_DIVING", "ANOMALY", "ATTACHMENT", "INSP_ATTACHMENT"
                            ];

                            const reportEntries = Object.entries(migrationReport);
                            const libItems = reportEntries.filter(([key]) => libKeys.includes(key));
                            const systemItems = reportEntries.filter(([key]) => systemKeys.includes(key));
                            const jobInspItems = reportEntries.filter(([key]) => jobInspectionKeys.includes(key));
                            const componentItems = reportEntries.filter(([key]) => 
                              !libKeys.includes(key) && !systemKeys.includes(key) && !jobInspectionKeys.includes(key)
                            );

                            const sections = [
                              { title: "1. Reference Libraries", items: libItems },
                              { title: "2. Structural Framework & Levels", items: systemItems },
                              { title: "3. Offshore Assets & Components", items: componentItems },
                              { title: "4. Relational SOW, Jobs & Logs", items: jobInspItems }
                            ].filter(s => s.items.length > 0);

                            return sections.map((section, secIdx) => (
                              <div key={secIdx} className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 px-4 py-2.5 flex justify-between items-center">
                                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                    {section.title}
                                  </span>
                                  <div className="flex gap-12 mr-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    <span className="w-14 text-right">Oracle</span>
                                    <span className="w-14 text-right">Postgres</span>
                                    <span className="w-24 text-right">Accuracy</span>
<span className="w-16 text-right">Status</span>
                                  </div>
                                </div>
                                <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-60 overflow-y-auto">
                                  {section.items.map(([key, item]) => {
                                    const hasErrors = item.errors && item.errors.length > 0;
                                    const rejectedRecords = item.oracleRows - item.migratedRows;
                                    const itemPercent = item.oracleRows === 0 ? 100 : Math.min(100, Math.round((item.migratedRows / item.oracleRows) * 100));
                                    
                                    const selectedStructure = structures.find((s: any) => String(s.STR_ID) === selectedStructureId);
                                    const structType = selectedStructure?.PTYPE === "PIPE" ? "PIPELINE" : "PLATFORM";
                                    const mapNames = getTableMappingNames(key, structType);
                                    
                                    return (
                                      <div 
                                        key={key} 
                                        onClick={() => (hasErrors || rejectedRecords > 0) && toggleRecordExpansion(key)}
                                        className={`p-4 flex flex-col gap-2 transition-colors ${
                                          (hasErrors || rejectedRecords > 0)
                                            ? "cursor-pointer hover:bg-rose-50/10 dark:hover:bg-rose-950/5" 
                                            : "hover:bg-slate-50/20 dark:hover:bg-slate-900/20"
                                        }`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                               {(() => {
                                                 const isComp = !["STRUCTURE", "STR_ELV", "STR_LEVEL", "STR_FACES", "U_ASSOC", "ATTACHMENT", "COMMENT", "JOBPACK", "LOGS_JOBS", "LOGS_MOVEMENTS", "VIDEO", "ANOMALY", "INSP_ATTACHMENT"].includes(key.toUpperCase());
                                                 if (isComp) {
                                                   let colorClass = "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200/40 dark:border-indigo-900/30";
                                                   let label = "Component";
                                                   
                                                   if (item.status === "success" && itemPercent === 100) {
                                                     colorClass = "bg-emerald-50 dark:bg-emerald-950/35 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30";
                                                     label = "Migrated";
                                                   } else if (hasErrors || item.status === "failed") {
                                                     colorClass = "bg-rose-50 dark:bg-rose-950/35 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/30";
                                                     label = "Error";
                                                   } else if (item.status === "skipped") {
                                                     colorClass = "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700";
                                                     label = "Skipped";
                                                   } else if (itemPercent > 0 && itemPercent < 100) {
                                                     colorClass = "bg-amber-50 dark:bg-amber-950/35 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/30 animate-pulse";
                                                     label = "Partial";
                                                   }
                                                   
                                                   return (
                                                     <div className="flex items-center gap-1.5">
                                                       <span className={`text-[10px] font-black border px-2 py-0.5 rounded-md uppercase tracking-wider ${colorClass}`}>
                                                         {key}
                                                       </span>
                                                       <span className={`text-[8px] font-black uppercase tracking-widest px-1 rounded ${
                                                         item.status === "success" && itemPercent === 100 ? "bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400" :
                                                         hasErrors || item.status === "failed" ? "bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400" :
                                                         item.status === "skipped" ? "bg-slate-100/50 dark:bg-slate-800/40 text-slate-500" :
                                                         "bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400"
                                                       }`}>
                                                         {label}
                                                       </span>
                                                     </div>
                                                   );
                                                 } else {
                                                   return (
                                                     <div className="flex items-center gap-1.5">
                                                       <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                                         {key}
                                                       </span>
                                                       <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-100/50 dark:bg-slate-800/40 px-1 rounded">
                                                         System
                                                       </span>
                                                     </div>
                                                   );
                                                 }
                                               })()}
                                            {item.filesCopied !== undefined && item.filesCopied !== null && (
                                              <span className="text-[8px] bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 px-1.5 py-0.5 rounded font-black uppercase select-none flex items-center gap-1">
                                                <FolderOpen className="w-2.5 h-2.5" />
                                                {item.filesCopied} File{item.filesCopied !== 1 ? 's' : ''} Copied
                                              </span>
                                            )}
                                            {rejectedRecords > 0 && (
                                              <span 
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  fetchMissingItems(key);
                                                }}
                                                className="text-[8px] bg-amber-50 dark:bg-amber-950/35 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-1 select-none animate-pulse cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40"
                                              >
                                                <AlertTriangle className="w-2.5 h-2.5" />
                                                {rejectedRecords} Rejected Record{rejectedRecords > 1 ? 's' : ''}
                                              </span>
                                            )}
                                            {hasErrors && (
                                              <span className="text-[8px] bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-1 select-none">
                                                {item.errors.length} Exception{item.errors.length > 1 ? 's' : ''}
                                                {expandedRecords[key] ? <ChevronUp className="w-2.5 h-2.5 ml-0.5 shrink-0" /> : <ChevronDown className="w-2.5 h-2.5 ml-0.5 shrink-0" />}
                                              </span>
                                            )}
                                          </div>
                                          
                                          <div className="text-[9px] text-slate-400 dark:text-slate-500 font-mono select-none flex items-center gap-1">
                                            <span>Oracle:</span>
                                            <span className="font-bold text-slate-500 dark:text-slate-400 bg-slate-100/60 dark:bg-slate-800/40 px-1 rounded">{mapNames.oracle}</span>
                                            <ArrowRight className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                            <span>Postgres:</span>
                                            <span className="font-bold text-slate-500 dark:text-slate-400 bg-slate-100/60 dark:bg-slate-800/40 px-1 rounded">{mapNames.pg}</span>
                                          </div>
                                          </div>
                                          <div className="flex items-center gap-12 mr-4 text-xs font-bold">
                                            <span className="w-14 text-right font-mono text-slate-500">{item.oracleRows}</span>
                                            <span className="w-14 text-right font-mono text-indigo-600 dark:text-indigo-400">{item.migratedRows}</span>
                                            <div className="w-24 flex flex-col items-end gap-1.5">
                                              <span className={`font-mono font-black text-[10px] ${
                                                itemPercent >= 90 ? "text-emerald-600 dark:text-emerald-500" :
                                                itemPercent >= 60 ? "text-indigo-600 dark:text-indigo-500" :
                                                itemPercent >= 30 ? "text-amber-500 dark:text-amber-400" : "text-rose-500 dark:text-rose-400"
                                              }`}>{itemPercent}%</span>
                                              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1 overflow-hidden border border-slate-200/20 dark:border-slate-800/40">
                                                <div 
                                                  className={`h-1 rounded-full bg-gradient-to-r ${
                                                    itemPercent >= 90 ? "from-emerald-500 to-teal-500" :
                                                    itemPercent >= 60 ? "from-indigo-500 to-blue-500" :
                                                    itemPercent >= 30 ? "from-amber-500 to-orange-500 animate-pulse" : "from-rose-500 to-red-500 animate-pulse"
                                                  }`}
                                                  style={{ width: `${itemPercent}%` }}
                                                />
                                              </div>
                                            </div>
                                            <span className="w-16 flex justify-end">
                                              {item.status === "success" && (
                                                <span className="text-[8px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 px-2 py-0.5 rounded font-black uppercase">
                                                  Success
                                                </span>
                                              )}
                                              {item.status === "failed" && (
                                                <span className="text-[8px] bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40 px-2 py-0.5 rounded font-black uppercase">
                                                  Failed
                                                </span>
                                              )}
                                              {item.status === "skipped" && (
                                                <span className="text-[8px] bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded font-black uppercase">
                                                  Skipped
                                                </span>
                                              )}
                                            </span>
                                          </div>
                                        </div>
                                        {expandedRecords[key] && (
                                          <div className="mt-2 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200" onClick={(e) => e.stopPropagation()}>
                                            {rejectedRecords > 0 && (
                                              <>
                                              <div className="p-3 bg-amber-50/40 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/20 rounded-xl space-y-1">
                                                <div className="flex items-center gap-1.5">
                                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />
                                                  <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400">Rejected Records Alert</span>
                                                </div>
                                                <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed pl-5 font-medium">
                                                  Database integrity filters rejected <strong>{rejectedRecords} record{rejectedRecords > 1 ? 's' : ''}</strong> from being translated. 
                                                  This commonly occurs due to foreign key integrity checks (e.g. referencing component type which is unmapped) or duplicate row keys in Oracle. 
                                                  Review the exceptions below to resolve.
                                                </p>
                                                <div className="pt-1.5 pl-5">
                                                  <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    onClick={() => fetchMissingItems(key)}
                                                    className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-400 dark:border-amber-900/50 dark:hover:bg-amber-950/30 text-[9px] font-black uppercase py-1 h-6 flex items-center gap-1"
                                                  >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    View Rejected Records Detail
                                                  </Button>
                                                </div>
                                              </div>
                                              {(item as any).rejectedDetails && (item as any).rejectedDetails.length > 0 && (
                                                <div className="p-3 bg-amber-50/20 dark:bg-amber-950/5 border border-amber-200/30 dark:border-amber-900/15 rounded-xl space-y-2">
                                                  <div className="flex items-center justify-between">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                                                      Unmapped Association Details ({(item as any).totalRejected || (item as any).rejectedDetails.length} total{(item as any).totalRejected > 200 ? ', showing first 200' : ''})
                                                    </span>
                                                  </div>
                                                  <div className="max-h-52 overflow-y-auto border border-amber-200/30 dark:border-amber-900/20 rounded-lg">
                                                    <table className="w-full text-[9px]">
                                                      <thead className="sticky top-0 bg-amber-100/70 dark:bg-amber-950/30 border-b border-amber-200/40 dark:border-amber-900/25">
                                                        <tr>
                                                          <th className="text-left py-1.5 px-2 font-black uppercase tracking-widest text-amber-800 dark:text-amber-400">#</th>
                                                          <th className="text-left py-1.5 px-2 font-black uppercase tracking-widest text-amber-800 dark:text-amber-400">Oracle COMP_ID</th>
                                                          <th className="text-left py-1.5 px-2 font-black uppercase tracking-widest text-amber-800 dark:text-amber-400">Oracle ASSOC_COMPID</th>
                                                          <th className="text-left py-1.5 px-2 font-black uppercase tracking-widest text-amber-800 dark:text-amber-400">Reason</th>
                                                        </tr>
                                                      </thead>
                                                      <tbody className="divide-y divide-amber-100/30 dark:divide-amber-900/15">
                                                        {((item as any).rejectedDetails as { oracleCompId: number; oracleAssocCompId: number; reason: string }[]).map((rd, rdIdx) => (
                                                          <tr key={rdIdx} className="hover:bg-amber-50/40 dark:hover:bg-amber-950/10 transition-colors">
                                                            <td className="py-1 px-2 font-mono text-slate-400">{rdIdx + 1}</td>
                                                            <td className="py-1 px-2 font-mono font-bold text-slate-700 dark:text-slate-300">{rd.oracleCompId}</td>
                                                            <td className="py-1 px-2 font-mono font-bold text-slate-700 dark:text-slate-300">{rd.oracleAssocCompId}</td>
                                                            <td className="py-1 px-2 text-amber-700 dark:text-amber-400 font-medium break-words">{rd.reason}</td>
                                                          </tr>
                                                        ))}
                                                      </tbody>
                                                    </table>
                                                  </div>
                                                </div>
                                              )}
                                              </>
                                            )}
                                            {hasErrors && item.errors.map((err, idx) => {
                                              const diag = getFriendlyErrorDetails(err);
                                              return (
                                                <div key={idx} className="p-3.5 bg-rose-50/30 dark:bg-rose-950/10 border border-rose-100/40 dark:border-rose-950/30 rounded-xl space-y-2.5 shadow-sm text-left">
                                                  <div className="flex items-center gap-1.5">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${diag.severity === 'high' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'}`} />
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">
                                                      {diag.title}
                                                    </span>
                                                  </div>
                                                  
                                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px] pl-3 border-l border-rose-200 dark:border-rose-900/35">
                                                    <div className="space-y-0.5">
                                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Failure Reason</span>
                                                      <p className="text-slate-700 dark:text-slate-300 font-bold leading-relaxed break-words">{diag.why}</p>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                      <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">Rectification Action</span>
                                                      <p className="text-emerald-700 dark:text-emerald-400 font-bold leading-relaxed">{diag.rectify}</p>
                                                    </div>
                                                  </div>
                                                  
                                                  <div className="pt-2 pl-3 border-t border-rose-100/30 dark:border-rose-950/30">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Raw Database Error Log</span>
                                                    <p className="font-mono text-[9px] text-slate-500 dark:text-slate-400 break-all select-all leading-tight mt-1 bg-slate-900/5 dark:bg-slate-900/30 p-2 rounded border border-slate-200/40 dark:border-slate-800/40">{err}</p>
                                                  </div>
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
                            ));
                          })()}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="border-slate-200 dark:border-slate-800 shadow-sm min-h-[300px]">
                    <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-black uppercase text-slate-800 dark:text-slate-200">Component Summary</CardTitle>
                        <CardDescription className="text-[10px] uppercase font-bold text-slate-500 mt-0.5">FROM ORACLE allcompid VIEW</CardDescription>
                      </div>
                      {summary.length > 0 && (
                        <div className="flex items-center gap-4">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="componentsOnly"
                              checked={componentsOnly}
                              onChange={e => setComponentsOnly(e.target.checked)}
                              className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                            />
                            <Label htmlFor="componentsOnly" className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                              Migrate Components Only
                            </Label>
                          </div>
                          <Button 
                            onClick={handleExecuteMigration}
                            disabled={isMigrating}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider text-xs rounded-lg shadow-md h-8 px-4 transition-all"
                          >
                            {isMigrating ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-1.5" />}
                            {isMigrating ? "Migrating..." : "Start Migration"}
                          </Button>
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="p-0">
                      {migrationLogs.length > 0 && (
                        <div className="p-4 bg-slate-900 text-emerald-400 font-mono text-[10px] max-h-48 overflow-y-auto rounded-b-lg border-b-4 border-slate-800 space-y-1">
                          <div className="text-slate-500 mb-2 uppercase tracking-widest font-black">Migration Logs:</div>
                          {migrationLogs.map((log, i) => (
                            <div key={i}>&gt; {log}</div>
                          ))}
                        </div>
                      )}
                      {isLoadingSummary ? (
                        <div className="p-12 flex flex-col items-center justify-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mb-2" />
                          <span className="text-xs font-bold uppercase tracking-widest">Loading Summary...</span>
                        </div>
                      ) : summary.length > 0 ? (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 p-6 bg-slate-50/30 dark:bg-slate-900/10">
                          
                          {/* 1. Reference Libraries Preflight */}
                          {libraries.length > 0 && (
                            <Card className="border-slate-200 dark:border-slate-800 shadow-sm col-span-1 overflow-hidden">
                              <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 py-3">
                                <div>
                                  <CardTitle className="text-xs font-black uppercase text-indigo-700 dark:text-indigo-400">1. Reference Libraries Preflight</CardTitle>
                                  <CardDescription className="text-[9px] uppercase font-bold text-slate-500 mt-0.5">Global lookups and casing configurations</CardDescription>
                                </div>
                              </CardHeader>
                              <CardContent className="p-0">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="bg-slate-100/50 dark:bg-slate-900/10 border-b border-slate-200 dark:border-slate-800">
                                      <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-wider">Table</th>
                                      <th className="px-2 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-wider text-right">Oracle</th>
                                      <th className="px-2 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-wider text-right">Postgres</th>
                                      <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-wider text-right">Sync Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
                                    {libraries.map((lib: any) => {
                                      const isSynced = lib.row_count === lib.pg_row_count;
                                      return (
                                        <tr key={lib.code} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/20 transition-colors">
                                          <td className="px-4 py-2.5">
                                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{lib.code}</span>
                                          </td>
                                          <td className="px-2 py-2.5 text-right font-mono font-bold text-slate-500">{lib.row_count}</td>
                                          <td className="px-2 py-2.5 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">{lib.pg_row_count}</td>
                                          <td className="px-4 py-2.5 text-right font-bold text-[8px]">
                                            <span 
                                              onClick={() => !isSynced && fetchMissingItems(lib.code)}
                                              className={`px-2 py-0.5 border rounded uppercase tracking-wider transition-colors ${
                                                isSynced
                                                  ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400"
                                                  : "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40"
                                              }`}
                                            >
                                              {isSynced ? "100% Synced" : `${lib.row_count - lib.pg_row_count} Missing`}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </CardContent>
                            </Card>
                          )}

                          {/* 2. System Framework & Structure Preflight */}
                          {framework.length > 0 && (
                            <Card className="border-slate-200 dark:border-slate-800 shadow-sm col-span-1 overflow-hidden">
                              <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 py-3">
                                <div>
                                  <CardTitle className="text-xs font-black uppercase text-indigo-700 dark:text-indigo-400">2. System Framework Preflight</CardTitle>
                                  <CardDescription className="text-[9px] uppercase font-bold text-slate-500 mt-0.5">Asset hierarchies and coordinate elevations</CardDescription>
                                </div>
                              </CardHeader>
                              <CardContent className="p-0">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="bg-slate-100/50 dark:bg-slate-900/10 border-b border-slate-200 dark:border-slate-800">
                                      <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-wider">Framework Table</th>
                                      <th className="px-2 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-wider text-right">Oracle</th>
                                      <th className="px-2 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-wider text-right">Postgres</th>
                                      <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-wider text-right">Sync Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
                                    {framework.map((fw: any) => {
                                      const isSynced = fw.row_count === fw.pg_row_count;
                                      return (
                                        <tr key={fw.code} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/20 transition-colors">
                                          <td className="px-4 py-2.5">
                                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{fw.code}</span>
                                            <span className="text-[8px] text-slate-500 ml-1.5 font-bold">({fw.name})</span>
                                          </td>
                                          <td className="px-2 py-2.5 text-right font-mono font-bold text-slate-500">{fw.row_count}</td>
                                          <td className="px-2 py-2.5 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">{fw.pg_row_count}</td>
                                          <td className="px-4 py-2.5 text-right font-bold text-[8px]">
                                            <span 
                                              onClick={() => !isSynced && fw.row_count > 0 && fetchMissingItems(fw.code)}
                                              className={`px-2 py-0.5 border rounded uppercase tracking-wider transition-colors ${
                                                isSynced
                                                  ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400"
                                                  : fw.row_count === 0 ? "text-slate-400 bg-slate-50 border-slate-200 dark:bg-slate-900/30 dark:border-slate-800" : "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40"
                                              }`}
                                            >
                                              {isSynced ? "100% Synced" : fw.row_count === 0 ? "No Data" : `${fw.row_count - fw.pg_row_count} Missing`}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </CardContent>
                            </Card>
                          )}

                          {/* 3. Mapped Component List Preflight */}
                          {(() => {
                            const mappedRows = summary.filter((r: any) => !!mappings[r.CODE]);
                            const totalOracleMappedCount = mappedRows.reduce((sum, r) => sum + Number(r.ROW_COUNT), 0);
                            const totalPgMappedCount = mappedRows.reduce((sum, r) => sum + Number(r.PG_ROW_COUNT || 0), 0);
                            return (
                              <Card className="border-indigo-100 dark:border-indigo-900/40 shadow-sm bg-indigo-50/5 dark:bg-slate-950/20 col-span-1 overflow-hidden">
                                <CardHeader className="bg-indigo-50/20 dark:bg-indigo-950/10 border-b border-indigo-100/50 dark:border-indigo-900/20 py-3 flex flex-row items-center justify-between">
                                  <div>
                                    <CardTitle className="text-xs font-black uppercase text-indigo-700 dark:text-indigo-400">3. Mapped Components Preflight</CardTitle>
                                    <CardDescription className="text-[9px] uppercase font-bold text-slate-500 mt-0.5">Asset component types to be transferred</CardDescription>
                                  </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                  {mappedRows.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs italic">
                                      No mapped components. Configure mappings in the tab above.
                                    </div>
                                  ) : (
                                    <table className="w-full text-left border-collapse">
                                      <thead>
                                        <tr className="bg-slate-100/30 dark:bg-slate-900/5 border-b border-slate-200 dark:border-slate-800">
                                          <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-wider">Component Code</th>
                                          <th className="px-2 py-2 text-[9px] font-black text-slate-500 uppercase tracking-wider text-right">Oracle</th>
                                          <th className="px-2 py-2 text-[9px] font-black text-slate-500 uppercase tracking-wider text-right">Postgres</th>
                                          <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-wider text-right">Sync Status</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
                                        {mappedRows.map((row: any, idx) => {
                                          const isSynced = row.ROW_COUNT === row.PG_ROW_COUNT;
                                          return (
                                            <tr key={idx} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/20 transition-colors">
                                              <td className="px-4 py-2.5 flex items-center gap-2">
                                                <span className="text-[10px] font-black border px-2 py-0.5 rounded-md uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200/40 dark:border-indigo-900/30 shrink-0">
                                                  {row.CODE}
                                                </span>
                                              </td>
                                              <td className="px-2 py-2.5 text-right font-mono font-bold text-slate-500">{row.ROW_COUNT}</td>
                                              <td className="px-2 py-2.5 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">{row.PG_ROW_COUNT || 0}</td>
                                              <td className="px-4 py-2.5 text-right font-bold text-[8px]">
                                                <span 
                                                  onClick={() => !isSynced && fetchMissingItems(row.CODE)}
                                                  className={`px-2 py-0.5 border rounded uppercase tracking-wider transition-colors ${
                                                    isSynced
                                                      ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400"
                                                      : "text-indigo-700 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900/30 dark:text-indigo-500 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                                                  }`}
                                                >
                                                  {isSynced ? "100% Synced" : `${row.ROW_COUNT - (row.PG_ROW_COUNT || 0)} Missing`}
                                                </span>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                      <tfoot className="bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800">
                                        <tr>
                                          <td className="px-4 py-2.5 text-[9px] font-black uppercase text-slate-600 dark:text-slate-400">Total Components</td>
                                          <td className="px-2 py-2.5 text-right font-mono font-black text-slate-500">{totalOracleMappedCount}</td>
                                          <td className="px-2 py-2.5 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">{totalPgMappedCount}</td>
                                          <td className="px-4 py-2.5 text-right font-mono font-black text-indigo-700 dark:text-indigo-400">
                                            {totalOracleMappedCount === totalPgMappedCount ? "100%" : `${Math.round((totalPgMappedCount / totalOracleMappedCount) * 100)}%`}
                                          </td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })()}

                          {/* 4. Scope of Work & Inspections Preflight */}
                          <Card className="border-slate-200 dark:border-slate-800 shadow-sm col-span-1 overflow-hidden">
                            <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 py-3">
                              <div>
                                <CardTitle className="text-xs font-black uppercase text-indigo-700 dark:text-indigo-400">4. SOW & Inspections Preflight</CardTitle>
                                  <CardDescription className="text-[9px] uppercase font-bold text-slate-500 mt-0.5">Scope of work, logs, and anomaly sheets</CardDescription>
                              </div>
                            </CardHeader>
                            <CardContent className="p-0">
                              {!selectedJobpack ? (
                                <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs italic space-y-2">
                                  <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto opacity-70" />
                                  <p>Select an active Job Pack from the sidebar to populate inspections baseline counts.</p>
                                </div>
                              ) : inspectionJobs.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs italic">
                                  No inspection tables mapped for this Job Pack.
                                </div>
                              ) : (
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="bg-slate-100/50 dark:bg-slate-900/10 border-b border-slate-200 dark:border-slate-800">
                                      <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-wider">Job / SOW Table</th>
                                      <th className="px-2 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-wider text-right">Oracle</th>
                                      <th className="px-2 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-wider text-right">Postgres</th>
                                      <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-wider text-right">Sync Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
                                    {inspectionJobs.map((job: any) => {
                                      const isSynced = job.row_count === job.pg_row_count;
                                      return (
                                        <tr key={job.code} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/20 transition-colors">
                                          <td className="px-4 py-2.5">
                                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{job.code}</span>
                                            <span className="text-[8px] text-slate-500 ml-1.5 font-bold">({job.name})</span>
                                          </td>
                                          <td className="px-2 py-2.5 text-right font-mono font-bold text-slate-500">{job.row_count}</td>
                                          <td className="px-2 py-2.5 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">{job.pg_row_count}</td>
                                          <td className="px-4 py-2.5 text-right font-bold text-[8px]">
                                            <span 
                                              onClick={() => !isSynced && job.row_count > 0 && fetchMissingItems(job.code)}
                                              className={`px-2 py-0.5 border rounded uppercase tracking-wider transition-colors ${
                                                isSynced
                                                  ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400"
                                                  : job.row_count === 0 ? "text-slate-400 bg-slate-50 border-slate-200 dark:bg-slate-900/30 dark:border-slate-800" : "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40"
                                              }`}
                                            >
                                              {isSynced ? "100% Synced" : job.row_count === 0 ? "No Data" : `${job.row_count - job.pg_row_count} Missing`}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </CardContent>
                          </Card>

                          {/* Unmapped Component List Preflight */}
                          {(() => {
                            const unmappedRows = summary.filter((r: any) => !mappings[r.CODE]);
                            const totalUnmappedCount = unmappedRows.reduce((sum, r) => sum + Number(r.ROW_COUNT), 0);
                            return (
                              <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-slate-50/5 col-span-1 xl:col-span-2 overflow-hidden">
                                <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 py-3 flex flex-row items-center justify-between">
                                  <div>
                                    <CardTitle className="text-xs font-black uppercase text-slate-600 dark:text-slate-400">Skipped / Unmapped Component Types Preflight</CardTitle>
                                    <CardDescription className="text-[9px] uppercase font-bold text-slate-500 mt-0.5">Asset component types skipped during transfer (No field mappings)</CardDescription>
                                  </div>
                                  <div className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase px-2.5 py-1 rounded-md tracking-wider shrink-0">
                                    {totalUnmappedCount} rows skipped
                                  </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                  {unmappedRows.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs italic">
                                      No unmapped components. All component types are fully mapped!
                                    </div>
                                  ) : (
                                    <table className="w-full text-left border-collapse">
                                      <thead>
                                        <tr className="bg-slate-100/30 dark:bg-slate-900/5 border-b border-slate-200 dark:border-slate-800">
                                          <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-wider">Component Code</th>
                                          <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-wider text-right">Row Count</th>
                                          <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-wider text-right">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
                                        {unmappedRows.map((row: any, idx) => (
                                          <tr key={idx} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/20 transition-colors">
                                            <td className="px-4 py-2.5 flex items-center gap-2">
                                              <span className="text-[10px] font-black border px-2 py-0.5 rounded-md uppercase tracking-wider bg-slate-50 dark:bg-slate-900/40 text-slate-550 dark:text-slate-400 border-slate-200 dark:border-slate-800 shrink-0">
                                                {row.CODE}
                                              </span>
                                              {row.NAME && (
                                                <span className="text-[9px] font-bold text-slate-500 uppercase truncate max-w-[200px]" title={row.NAME}>
                                                  ({row.NAME})
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-500">{row.ROW_COUNT}</td>
                                            <td className="px-4 py-2.5 text-right font-bold text-[9px]">
                                              <span className="px-2 py-0.5 border border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/40 text-slate-500 uppercase tracking-wider rounded">
                                                Skipped
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="p-12 flex flex-col items-center justify-center text-slate-400 text-center">
                          <Database className="w-8 h-8 opacity-20 mb-3" />
                          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Select a structure to view summary</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Section B: Inspection Data, Anomaly & Attachments */}
                  <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div>
                        <CardTitle className="text-sm font-black uppercase text-slate-800 dark:text-slate-200">
                          Inspection Data, Anomaly & Attachments
                        </CardTitle>
                        <CardDescription className="text-[10px] uppercase font-bold text-slate-500 mt-0.5">
                          Phase 2: Target Job Pack Analysis
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      {!selectedJobpack ? (
                        <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-center">
                          <Sparkles className="w-8 h-8 opacity-20 mb-3 text-indigo-500 animate-pulse" />
                          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                            Select an Active Job Pack from the sidebar to view Inspection Data Summary
                          </span>
                        </div>
                      ) : isLoadingInspectionSummary ? (
                        <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mb-2 text-indigo-500" />
                          <span className="text-xs font-bold uppercase tracking-widest">
                            Loading Phase 2 Summary Details...
                          </span>
                        </div>
                      ) : inspectionSummary ? (
                        <div className="space-y-6">
                          {/* Jobpack Header Details */}
                          <div className="p-4 bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/35 rounded-xl flex items-center justify-between flex-wrap gap-4">
                            <div className="space-y-1">
                              <span className="text-[9px] font-black uppercase tracking-wider text-indigo-500">
                                Active Selection
                              </span>
                              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                {selectedJobpack.JOBNAME || selectedJobpack.jobname || selectedJobpack.JOB_NAME || selectedJobpack.job_name || "Selected Job Pack"}
                              </h4>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/30 px-2 py-0.5 rounded-md">
                                INSPNO: {selectedJobpack.INSPNO || selectedJobpack.inspno}
                              </span>
                              <span className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/30 px-2 py-0.5 rounded-md">
                                STR_ID: {selectedStructureId}
                              </span>
                            </div>
                          </div>

                          {/* ROV vs Diving Split Lists */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* ROV Inspections */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
                                  ROV Platform Inspections
                                </h5>
                                <span className="text-[9px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200/40 dark:border-cyan-800/20 px-2 py-0.5 rounded">
                                  {(inspectionSummary.rovInspections || []).length} Types
                                </span>
                              </div>
                              
                              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                                {(inspectionSummary.rovInspections || []).length > 0 ? (
                                  (inspectionSummary.rovInspections || []).map((rov: any, idx: number) => (
                                    <div key={idx} className="p-3 bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 hover:border-slate-200 dark:hover:border-slate-700 rounded-xl shadow-sm flex items-center justify-between gap-3 group transition-all duration-200">
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-7 h-7 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-100/50 dark:border-cyan-900/30 flex items-center justify-center text-cyan-500 shrink-0">
                                          <span className="text-[9px] font-extrabold">{rov.code}</span>
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                                            {rov.name}
                                          </p>
                                          <p className="text-[9px] text-slate-400 font-medium uppercase mt-0.5">
                                            Oracle Table: {mappingStructureType === "PLATFORM" ? "PLATGI" : "allinspid"}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <span className="text-xs font-black text-slate-800 dark:text-slate-200">{rov.count}</span>
                                        <span className="text-[8px] text-slate-400 block font-bold mt-0.5">Rows</span>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-center py-8 text-xs font-semibold text-slate-400 bg-white dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                                    No ROV inspection data records found.
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Diving Inspections */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                  Diving Inspections
                                </h5>
                                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/40 dark:border-emerald-800/20 px-2 py-0.5 rounded">
                                  {(inspectionSummary.divingInspections || []).length} Types
                                </span>
                              </div>
                              
                              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                                {(inspectionSummary.divingInspections || []).length > 0 ? (
                                  (inspectionSummary.divingInspections || []).map((div: any, idx: number) => (
                                    <div key={idx} className="p-3 bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 hover:border-slate-200 dark:hover:border-slate-700 rounded-xl shadow-sm flex items-center justify-between gap-3 group transition-all duration-200">
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100/50 dark:border-emerald-900/30 flex items-center justify-center text-emerald-500 shrink-0">
                                          <span className="text-[9px] font-extrabold">{div.code}</span>
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                            {div.name}
                                          </p>
                                          <p className="text-[9px] text-slate-400 font-medium uppercase mt-0.5">
                                            Oracle Table: allinspid
                                          </p>
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <span className="text-xs font-black text-slate-800 dark:text-slate-200">{div.count}</span>
                                        <span className="text-[8px] text-slate-400 block font-bold mt-0.5">Rows</span>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-center py-8 text-xs font-semibold text-slate-400 bg-white dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                                    No Diving inspection data records found.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* General Data Storage Audits & Log Summary */}
                          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80">
                            <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                              <Database className="w-3.5 h-3.5 text-indigo-500" />
                              General Media & Log Verification Audit
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              {/* Diver Logs Card */}
                              <div className="p-4 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl space-y-1 group hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                                <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">Diver Logs (LOGS Table)</span>
                                <div className="flex items-center justify-between">
                                  <span className="text-lg font-black text-slate-800 dark:text-slate-200">{inspectionSummary.logsCount || 0}</span>
                                  <span className="text-[8px] px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded uppercase font-bold border border-indigo-100/50 dark:border-indigo-900/20">
                                    Diver & ROV
                                  </span>
                                </div>
                                <p className="text-[8px] text-slate-400">All diver logs reside centrally in the LOGS table.</p>
                              </div>

                              {/* ROV Video Logs Card */}
                              <div className="p-4 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl space-y-1 group hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                                <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">ROV Video (PLATG/PLATGI)</span>
                                <div className="flex items-center justify-between">
                                  <span className="text-lg font-black text-cyan-600 dark:text-cyan-400">{inspectionSummary.platgVideoCount || 0}</span>
                                  <span className="text-[8px] px-1.5 py-0.5 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 rounded uppercase font-bold border border-cyan-100/50 dark:border-cyan-900/20">
                                    ROV Video
                                  </span>
                                </div>
                                <p className="text-[8px] text-slate-400">ROV video logs are embedded directly in the PLATG/PLATGI tables.</p>
                              </div>

                              {/* Diving Video Logs Card */}
                              <div className="p-4 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl space-y-1 group hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                                <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">Diving Video (video)</span>
                                <div className="flex items-center justify-between">
                                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{inspectionSummary.videoCount || 0}</span>
                                  <span className="text-[8px] px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded uppercase font-bold border border-emerald-100/50 dark:border-emerald-900/20">
                                    Diving Video
                                  </span>
                                </div>
                                <p className="text-[8px] text-slate-400">Diving video references reside in the dedicated video table.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-center">
                          <Database className="w-8 h-8 opacity-20 mb-3" />
                          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                            Failed to load summary metadata.
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="mapping" className="m-0 border-none outline-none">
              <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-4 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-black uppercase text-slate-800 dark:text-slate-200">Data Mapping Configuration</CardTitle>
                    <CardDescription className="text-xs">Define how Oracle legacy columns map to PostgreSQL fields.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      onClick={handleCopyMappings}
                      variant="outline" 
                      className="h-8 text-xs font-bold uppercase tracking-wider text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-900/25 dark:hover:bg-indigo-900/20"
                    >
                      Copy Configuration
                    </Button>
                    <Button 
                      onClick={handlePasteMappings}
                      variant="outline" 
                      className="h-8 text-xs font-bold uppercase tracking-wider text-violet-600 border-violet-200 hover:bg-violet-50 dark:border-violet-900/25 dark:hover:bg-violet-900/20"
                    >
                      Paste Configuration
                    </Button>
                    <Button 
                      onClick={handleSaveMappings}
                      variant="outline" 
                      className="h-8 text-xs font-bold uppercase tracking-wider text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-900 dark:hover:bg-emerald-900/20"
                    >
                      <Save className="w-3.5 h-3.5 mr-1.5" /> Save Mappings
                    </Button>
                  </div>
                </CardHeader>
                
                {/* Structure Type Differentiator Switcher */}
                <div className="flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/20 px-6 py-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Active Structure Schema View</span>
                    <span className="text-[10px] text-slate-500">Filters and differentiates Oracle source tables and destination tables in real-time.</span>
                  </div>
                  <div className="flex bg-slate-200/50 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700">
                    <button
                      onClick={() => setMappingStructureType("PLATFORM")}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${mappingStructureType === "PLATFORM" ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-400" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"}`}
                    >
                      Platform View
                    </button>
                    <button
                      onClick={() => setMappingStructureType("PIPELINE")}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${mappingStructureType === "PIPELINE" ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-400" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"}`}
                    >
                      Pipeline View
                    </button>
                  </div>
                </div>

                <CardContent className="p-6">
                  <div className="flex gap-6">
                    {/* Entity Sidebar */}
                    <div className="w-64 space-y-4 border-r border-slate-100 dark:border-slate-800 pr-6">
                      <Label className="text-[10px] font-black uppercase text-slate-500">Mapping Targets</Label>
                      <div className="space-y-1">
                        <button
                          onClick={() => setSelectedMappingEntity("STRUCTURE")}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase rounded-md transition-colors ${selectedMappingEntity === "STRUCTURE" ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50"}`}
                        >
                          <span className="flex flex-col items-start gap-0.5">
                            <span>Structure</span>
                            <span className="text-[8px] opacity-75 font-mono lowercase">
                              {mappingStructureType === "PLATFORM" ? "PLATFORM → platform" : "U_PIPELINE → u_pipeline"}
                            </span>
                          </span>
                          <span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">{(mappings[activeMappingKey] || []).length}</span>
                        </button>
                        <button
                          onClick={() => setSelectedMappingEntity("ATTACHMENT")}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase rounded-md transition-colors ${selectedMappingEntity === "ATTACHMENT" ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50"}`}
                        >
                          <span className="flex flex-col items-start gap-0.5">
                            <span>Attachments</span>
                            <span className="text-[8px] opacity-75 font-mono lowercase">U_ATTACH_1 → attachment</span>
                          </span>
                          <span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">{(mappings["ATTACHMENT"] || []).length}</span>
                        </button>
                        <button
                          onClick={() => setSelectedMappingEntity("COMMENT")}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase rounded-md transition-colors ${selectedMappingEntity === "COMMENT" ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50"}`}
                        >
                          <span className="flex flex-col items-start gap-0.5">
                            <span>Comments</span>
                            <span className="text-[8px] opacity-75 font-mono lowercase">THECOMMENTS → comment</span>
                          </span>
                          <span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">{(mappings["COMMENT"] || []).length}</span>
                        </button>
                        <button
                          onClick={() => setSelectedMappingEntity("STR_ELV")}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase rounded-md transition-colors ${selectedMappingEntity === "STR_ELV" ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50"}`}
                        >
                          <span className="flex flex-col items-start gap-0.5">
                            <span>Str_Elv</span>
                            <span className="text-[8px] opacity-75 font-mono lowercase">STR_ELV → str_elv</span>
                          </span>
                          <span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">{(mappings["STR_ELV"] || []).length}</span>
                        </button>
                        <button
                          onClick={() => setSelectedMappingEntity("STR_LEVEL")}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase rounded-md transition-colors ${selectedMappingEntity === "STR_LEVEL" ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50"}`}
                        >
                          <span className="flex flex-col items-start gap-0.5">
                            <span>Str_Level</span>
                            <span className="text-[8px] opacity-75 font-mono lowercase">STR_LEVEL → str_level</span>
                          </span>
                          <span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">{(mappings["STR_LEVEL"] || []).length}</span>
                        </button>
                        <button
                          onClick={() => setSelectedMappingEntity("STR_FACES")}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase rounded-md transition-colors ${selectedMappingEntity === "STR_FACES" ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50"}`}
                        >
                          <span className="flex flex-col items-start gap-0.5">
                            <span>Str_Faces</span>
                            <span className="text-[8px] opacity-75 font-mono lowercase">STR_FACES → str_faces</span>
                          </span>
                          <span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">{(mappings["STR_FACES"] || []).length}</span>
                        </button>
                        <button
                          onClick={() => setSelectedMappingEntity("JOBPACK_SOW")}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase rounded-md transition-colors ${selectedMappingEntity === "JOBPACK_SOW" ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50"}`}
                        >
                          <span className="flex flex-col items-start gap-0.5">
                            <span>Jobpack & SOW</span>
                            <span className="text-[8px] opacity-75 font-mono lowercase">WORKPL → jobpack/u_sow</span>
                          </span>
                          <span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">{(mappings["JOBPACK_SOW"] || []).length}</span>
                        </button>

                        <div className="pt-4 pb-1">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Components</Label>
                        </div>
                        {summary.map(s => {
                          let resolvedCompSpec = `${s.CODE}_COMP`;
                          if (s.CODE.toLowerCase() === 'an') {
                            resolvedCompSpec = mappingStructureType === "PLATFORM" ? "AN_COMP_PLAT" : "AN_COMP_PIPE";
                          }
                          return (
                            <button
                              key={s.CODE}
                              onClick={() => setSelectedMappingEntity(s.CODE)}
                              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase rounded-md transition-colors ${selectedMappingEntity === s.CODE ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50"}`}
                            >
                              <span className="flex flex-col items-start gap-0.5">
                                <span className="truncate max-w-[210px] text-left">{s.CODE} {s.NAME ? `- ${s.NAME}` : "Component"}</span>
                                <span className="text-[8px] opacity-75 font-mono lowercase">
                                  {resolvedCompSpec} → component
                                </span>
                              </span>
                              <span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">{(mappings[s.CODE] || []).length}</span>
                            </button>
                          );
                        })}
                        
                        <div className="pt-4 pb-1">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Inspections</Label>
                        </div>
                        {inspectionSummary && (inspectionSummary.rovInspections || []).map((rov: any) => {
                          const key = `INSP_ROV_${rov.code}`;
                          return (
                            <button
                              key={key}
                              onClick={() => handleSelectInspectionMapping("ROV", rov.code, "PLATGI")}
                              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase rounded-md transition-colors ${selectedMappingEntity === key ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50"}`}
                            >
                              <span className="flex flex-col items-start gap-0.5 max-w-[210px] overflow-hidden">
                                <span className="truncate w-full text-left">ROV: {rov.code} {rov.name ? `- ${rov.name}` : ""}</span>
                                <span className="text-[8px] opacity-75 font-mono lowercase truncate w-full text-left">
                                  PLATGI (SCODE='{rov.code}') → inspection_data
                                </span>
                              </span>
                              <span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 shrink-0">{(mappings[key] || []).length}</span>
                            </button>
                          );
                        })}
                        {inspectionSummary && (inspectionSummary.divingInspections || []).map((div: any) => {
                          const key = `INSP_DIV_${div.code}`;
                          return (
                            <button
                              key={key}
                              onClick={() => handleSelectInspectionMapping("DIVING", div.code, div.code)}
                              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase rounded-md transition-colors ${selectedMappingEntity === key ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50"}`}
                            >
                              <span className="flex flex-col items-start gap-0.5 max-w-[210px] overflow-hidden">
                                <span className="truncate w-full text-left">DIVING: {div.code} {div.name ? `- ${div.name}` : ""}</span>
                                <span className="text-[8px] opacity-75 font-mono lowercase truncate w-full text-left">
                                  {div.code} → inspection_data
                                </span>
                              </span>
                              <span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 shrink-0">{(mappings[key] || []).length}</span>
                            </button>
                          );
                        })}

                        <div className="pt-4 pb-1">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Logs & Movements</Label>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedMappingEntity("LOGS_ROV");
                            fetchOracleColumns("LOGS");
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase rounded-md transition-colors ${selectedMappingEntity === "LOGS_ROV" ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50"}`}
                        >
                          <span className="flex flex-col items-start gap-0.5">
                            <span>ROV Logs Mapping</span>
                            <span className="text-[8px] opacity-75 font-mono lowercase">LOGS (ROV) → jobs/movements</span>
                          </span>
                          <span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 shrink-0">{(mappings["LOGS_ROV"] || []).length}</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedMappingEntity("LOGS_DIVE");
                            fetchOracleColumns("LOGS");
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase rounded-md transition-colors ${selectedMappingEntity === "LOGS_DIVE" ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50"}`}
                        >
                          <span className="flex flex-col items-start gap-0.5">
                            <span>Diving Logs Mapping</span>
                            <span className="text-[8px] opacity-75 font-mono lowercase">LOGS (Diving) → jobs/movements</span>
                          </span>
                          <span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 shrink-0">{(mappings["LOGS_DIVE"] || []).length}</span>
                        </button>
                      </div>
                    </div>

                    {/* Mapping Editor */}
                    <div className="flex-1 space-y-4">
                      {/* Dynamic Schema Banner */}
                      {(() => {
                        const isPlat = mappingStructureType === "PLATFORM";
                        let oracleTable = "";
                        let oracleDesc = "";
                        let pgTable = "";
                        let pgDesc = "";
                        let pkCol = "";

                        switch (selectedMappingEntity) {
                          case "STRUCTURE":
                            oracleTable = isPlat ? "PLATFORM" : "U_PIPELINE";
                            oracleDesc = isPlat ? "Legacy Platform Master Table" : "Legacy Pipeline Master Table";
                            pgTable = isPlat ? "platform" : "u_pipeline";
                            pgDesc = isPlat ? "PostgreSQL Platform Entity" : "PostgreSQL Pipeline Entity";
                            pkCol = isPlat ? "PLAT_ID" : "PIPE_ID";
                            break;
                          case "JOBPACK_SOW":
                            oracleTable = "WORKPL + TASKSTR + U_SOW + JOB_VESSEL";
                            oracleDesc = "Combined Jobpack and Scope of Work details";
                            pgTable = "jobpack & u_sow";
                            pgDesc = "Normalized Jobpack and Scope of Work tables";
                            pkCol = "INSPNO";
                            break;
                          case "LOGS_ROV":
                            oracleTable = "LOGS";
                            oracleDesc = "Legacy Log Table (Filtered: LOG_TYPE = 'ROV LOG')";
                            pgTable = "insp_rov_jobs & insp_rov_movements";
                            pgDesc = "PostgreSQL ROV Jobs master and Movement logs";
                            pkCol = "STR_ID, INSPNO, DIVE_NO";
                            break;
                          case "LOGS_DIVE":
                            oracleTable = "LOGS";
                            oracleDesc = "Legacy Log Table (Filtered: LOG_TYPE in DIVER/BELL LOG)";
                            pgTable = "insp_dive_jobs & insp_dive_movements";
                            pgDesc = "PostgreSQL Diving Jobs master and Movement logs";
                            pkCol = "STR_ID, INSPNO, DIVE_NO";
                            break;
                          case "ATTACHMENT":
                            oracleTable = "U_ATTACH_1";
                            oracleDesc = "Legacy Multimedia Attachments Reference Table";
                            pgTable = "attachment";
                            pgDesc = "Normalized cloud attachment references";
                            pkCol = "STR_ID (Linked to Structure or Component)";
                            break;
                          case "COMMENT":
                            oracleTable = "THECOMMENTS";
                            oracleDesc = "Legacy Comments Reference Table";
                            pgTable = "comment";
                            pgDesc = "Normalized structural comment records";
                            pkCol = "STR_ID (Linked to Structure or Component)";
                            break;
                          case "STR_ELV":
                          case "STR_LEVEL":
                          case "STR_FACES":
                            oracleTable = selectedMappingEntity;
                            oracleDesc = `Legacy structural child table: ${selectedMappingEntity}`;
                            pgTable = selectedMappingEntity.toLowerCase();
                            pgDesc = `Normalized structural child table: ${selectedMappingEntity.toLowerCase()}`;
                            pkCol = "PLAT_ID";
                            break;
                          default:
                            if (selectedMappingEntity.startsWith("INSP_ROV_")) {
                              oracleTable = "PLATGI";
                              const scode = selectedMappingEntity.replace("INSP_ROV_", "");
                              oracleDesc = `Legacy ROV Inspection Type: ${scode}`;
                              pgTable = "insp_records";
                              pgDesc = "Normalized inspection records (inspection_data JSONB)";
                              pkCol = "INSP_ID";
                            } else if (selectedMappingEntity.startsWith("INSP_DIV_")) {
                              const typeCode = selectedMappingEntity.replace("INSP_DIV_", "");
                              oracleTable = typeCode;
                              oracleDesc = `Legacy Diving Inspection Spec Table: ${typeCode}`;
                              pgTable = "insp_records";
                              pgDesc = "Normalized inspection records (inspection_data JSONB)";
                              pkCol = "INSP_ID";
                            } else {
                              let specTable = `${selectedMappingEntity}_COMP`;
                              if (selectedMappingEntity.toLowerCase() === 'an') {
                                specTable = isPlat ? "AN_COMP_PLAT" : "AN_COMP_PIPE";
                              }
                              oracleTable = `ALLCOMPID + ${specTable}`;
                              oracleDesc = `Legacy detailed spec view joined with ${specTable}`;
                              pgTable = "structure_components";
                              pgDesc = "Centralized polymorphic components registry";
                              pkCol = "COMP_ID";
                            }
                        }

                        return (
                          <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] animate-in fade-in duration-200">
                            <div className="space-y-1">
                              <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider block">Source Oracle Schema</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">{oracleTable}</span>
                              </div>
                              <p className="text-slate-500 text-[10px]">{oracleDesc}</p>
                              <span className="text-[9px] text-slate-400 block pt-1">
                                Primary Key: <span className="font-mono font-bold text-slate-500">{pkCol}</span>
                              </span>
                            </div>
                            <div className="space-y-1 border-l border-slate-100 dark:border-slate-800/80 pl-4">
                              <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider block">Destination PostgreSQL Target</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-800">{pgTable}</span>
                              </div>
                              <p className="text-slate-500 text-[10px]">{pgDesc}</p>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/30 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                          {selectedMappingEntity} Field Rules
                        </div>
                        <Button size="sm" onClick={handleAddMapping} className="h-7 text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900">
                          <Plus className="w-3 h-3 mr-1" /> Add Rule
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <div className="grid grid-cols-12 gap-4 px-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-500">
                          <div className="col-span-4">Oracle Source Column</div>
                          <div className="col-span-1 text-center"></div>
                          <div className="col-span-5">PostgreSQL Target Column</div>
                          <div className="col-span-2 text-right pr-4">Actions</div>
                        </div>
                        
                        {(mappings[activeMappingKey] || []).length === 0 ? (
                          <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                            No mapping rules defined. Unmapped fields will be ignored or dumped to JSON data.
                          </div>
                        ) : (
                          <>
                            {(() => {
                              if (selectedMappingEntity === "JOBPACK_SOW") {
                                return (
                                  <datalist id="oracle-columns-list">
                                    <option value="INSPNO" />
                                    <option value="JOBNAME" />
                                    <option value="ISTART" />
                                    <option value="CONTRAC" />
                                    <option value="JOB_TYPE" />
                                    <option value="VESSEL_NAME" />
                                    <option value="DATE_START" />
                                    <option value="REP_PREFIX" />
                                  </datalist>
                                );
                              }
                              let tableKey = "";
                              if (selectedMappingEntity.startsWith("INSP_ROV_")) tableKey = "PLATGI";
                              else if (selectedMappingEntity.startsWith("INSP_DIV_")) tableKey = selectedMappingEntity.replace("INSP_DIV_", "");
                              
                              return tableKey && oracleColumnsCache[tableKey] && oracleColumnsCache[tableKey].length > 0 ? (
                                <datalist id="oracle-columns-list">
                                  {oracleColumnsCache[tableKey].map((col: string) => (
                                    <option key={col} value={col} />
                                  ))}
                                </datalist>
                              ) : null;
                            })()}
                            {(mappings[activeMappingKey] || []).map((mapRule, idx) => (
                              <div key={idx} className="grid grid-cols-12 gap-4 items-center animate-in fade-in slide-in-from-bottom-2">
                              <div className="col-span-4">
                                <Input 
                                  list="oracle-columns-list"
                                  value={mapRule.oracleCol} 
                                  onChange={(e) => handleUpdateMapping(idx, "oracleCol", e.target.value)}
                                  placeholder="e.g. STR_ID" 
                                  className="font-mono text-xs h-9 uppercase" 
                                />
                              </div>
                              <div className="col-span-1 flex justify-center text-slate-300">
                                <ArrowRight className="w-4 h-4" />
                              </div>
                              <div className="col-span-5">
                                <Input 
                                  value={mapRule.pgCol} 
                                  onChange={(e) => handleUpdateMapping(idx, "pgCol", e.target.value)}
                                  placeholder="e.g. id" 
                                  className="font-mono text-xs h-9" 
                                />
                              </div>
                              <div className="col-span-2 flex justify-end items-center gap-1.5 pr-2">
                                <Button 
                                  type="button"
                                  variant="ghost" 
                                  size="icon" 
                                  disabled={idx === 0}
                                  onClick={() => handleMoveMapping(idx, "up")}
                                  className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </Button>
                                <Button 
                                  type="button"
                                  variant="ghost" 
                                  size="icon" 
                                  disabled={idx === (mappings[activeMappingKey] || []).length - 1}
                                  onClick={() => handleMoveMapping(idx, "down")}
                                  className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </Button>
                                <Button 
                                  type="button"
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleRemoveMapping(idx)} 
                                  className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
        
        {missingModalData && (
          <Dialog open={true} onOpenChange={() => setMissingModalData(null)}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-950">
              <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
                <DialogTitle className="text-sm font-black uppercase text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Missing Records Detail: {missingModalData.tableName}
                </DialogTitle>
                <DialogDescription className="text-[10px] uppercase font-bold text-slate-500 mt-1">
                  Comparing rows between Oracle and Postgres databases
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto py-4 space-y-4">
                {missingModalData.isLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    <span className="text-xs font-bold uppercase tracking-wider">Fetching comparison diff...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Missing in Postgres (Oracle has it, Postgres does not) */}
                    <div className="border border-slate-100 dark:border-slate-800/80 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/10 flex flex-col h-80">
                      <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 pb-2 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                        <span>Missing in Postgres</span>
                        <span className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200/50 dark:border-rose-900/30 px-1.5 py-0.5 rounded text-[8px] font-bold">
                          {missingModalData.missingInPostgres.length} Total
                        </span>
                      </span>
                      <div className="flex-1 overflow-y-auto pt-2 space-y-1.5 text-xs">
                        {missingModalData.missingInPostgres.length === 0 ? (
                          <div className="text-center py-12 text-slate-400 italic">No missing records</div>
                        ) : (
                          missingModalData.missingInPostgres.map((item, idx) => (
                            <div key={idx} className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800/60 font-mono text-[10px] break-all">
                              {item.label}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Missing in Oracle (Postgres has it, Oracle does not) */}
                    <div className="border border-slate-100 dark:border-slate-800/80 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/10 flex flex-col h-80">
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 pb-2 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                        <span>Extra in Postgres (Not in Oracle)</span>
                        <span className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-900/30 px-1.5 py-0.5 rounded text-[8px] font-bold">
                          {missingModalData.missingInOracle.length} Total
                        </span>
                      </span>
                      <div className="flex-1 overflow-y-auto pt-2 space-y-1.5 text-xs">
                        {missingModalData.missingInOracle.length === 0 ? (
                          <div className="text-center py-12 text-slate-400 italic">No extra records</div>
                        ) : (
                          missingModalData.missingInOracle.map((item, idx) => (
                            <div key={idx} className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800/60 font-mono text-[10px] break-all">
                              {item.label}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-end shrink-0">
                <Button size="sm" variant="outline" onClick={() => setMissingModalData(null)}>
                  Close
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        <MigrationReportPreview
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          selectedStructureId={selectedStructureId}
          selectedStructure={structures.find((s: any) => String(s.STR_ID) === selectedStructureId)}
          oracleConfig={{
            host: config.host || config.connectString,
            serviceName: config.serviceName,
            user: config.user
          }}
          oracleCompany={oracleCompany}
          oraclePreference={oraclePreference}
          migrationReport={migrationReport}
          migrationLogs={migrationLogs}
          triggerPrintOnOpen={shouldAutoPrintReport}
          unmappedComponents={
            summary
              .filter(item => {
                const hasMapping = mappings[item.CODE] && mappings[item.CODE].length > 0;
                return !hasMapping && Number(item.ROW_COUNT) > 0;
              })
              .map(item => ({
                code: item.CODE,
                name: item.NAME,
                rowCount: Number(item.ROW_COUNT)
              }))
          }
        />
      </div>
    </div>
  );
}
