"use client";

import React, { useState, useEffect } from "react";
import { 
  ClipboardCheck, 
  Search, 
  Filter, 
  AlertCircle, 
  CheckCircle2, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Zap, 
  FileText,
  AlertTriangle,
  Waves,
  SpellCheck,
  ChevronRight,
  Database,
  Check,
  ChevronsUpDown,
  Building2
} from "lucide-react";
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// --- Components for Sections ---
import SpellCheckSection from "./sections/SpellCheck";
import AttachmentSection from "./sections/AttachmentMissing";
import AssociationSection from "./sections/AssociationMissing";
import CPReadingSection from "./sections/CPReading";
import EmptyFindingsSection from "./sections/EmptyFindings";
import SeabedSurveySection from "./sections/SeabedSurvey";

export default function QAQCPage() {
  const [loading, setLoading] = useState(true);

  // Raw data from Supabase
  const [rawSows, setRawSows] = useState<any[]>([]);
  const [rawJobpacks, setRawJobpacks] = useState<any[]>([]);
  const [allStructures, setAllStructures] = useState<any[]>([]);

  // Selection states
  const [selectedStructure, setSelectedStructure] = useState<string>("");
  const [selectedJobpack, setSelectedJobpack] = useState<string>("");
  const [selectedReportId, setSelectedReportId] = useState<string>(""); // Format: sowId:reportNumber

  // Search & Popover states
  const [structSearch, setStructSearch] = useState("");
  const [structOpen, setStructOpen] = useState(false);

  const [jpSearch, setJpSearch] = useState("");
  const [jpOpen, setJpOpen] = useState(false);

  // Derived arrays
  const [jobpacks, setJobpacks] = useState<any[]>([]);
  const [reportItems, setReportItems] = useState<any[]>([]);

  // Global state sync
  const [, setGlobalStructureId] = useAtom(urlId);
  const [, setGlobalStructureType] = useAtom(urlType);

  const supabase = createClient();

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch SOWs
      const { data: sows, error: sowErr } = await supabase
        .from("u_sow")
        .select("id, jobpack_id, structure_id, structure_title, structure_type, report_numbers");

      if (sowErr) throw sowErr;
      setRawSows(sows || []);

      // 2. Fetch Jobpacks
      const { data: jps, error: jpErr } = await supabase
        .from("jobpack")
        .select("id, name, metadata, created_at");

      if (jpErr) throw jpErr;
      setRawJobpacks(jps || []);

      // 3. Extract unique structures
      const structMap = new Map<string, { id: string; name: string; type: string }>();
      (sows || []).forEach(sow => {
        if (sow.structure_id) {
          const idStr = sow.structure_id.toString();
          if (!structMap.has(idStr)) {
            const rawType = (sow.structure_type || "Platform").trim();
            const typeNorm = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();
            structMap.set(idStr, {
              id: idStr,
              name: sow.structure_title || `Structure ${idStr}`,
              type: typeNorm
            });
          }
        }
      });

      const list = Array.from(structMap.values());
      setAllStructures(list);
    } catch (err: any) {
      toast.error("Failed to load QA-QC data");
    } finally {
      setLoading(false);
    }
  };

  // 1. Grouped & Sorted Structures (Grouped by Type, Sorted Name Alphabetically Ascending)
  const filteredStructures = allStructures.filter(s =>
    s.name.toLowerCase().includes(structSearch.toLowerCase()) ||
    s.type.toLowerCase().includes(structSearch.toLowerCase())
  );

  const groupedStructureTypes = React.useMemo(() => {
    const map = new Map<string, typeof allStructures>();

    filteredStructures.forEach(s => {
      const t = s.type || "Platform";
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(s);
    });

    // Sort structure names inside each group alphabetically ascending
    map.forEach(items => {
      items.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));
    });

    // Sort group type keys alphabetically
    const sortedTypes = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));

    return sortedTypes.map(type => ({
      type,
      items: map.get(type)!
    }));
  }, [filteredStructures]);

  const selectedStructureName = allStructures.find(s => s.id === selectedStructure)?.name || "Select Structure";

  // 2. When Structure is selected -> populate assigned jobpacks
  useEffect(() => {
    if (selectedStructure) {
      setSelectedJobpack("");
      setSelectedReportId("");
      setGlobalStructureId(parseInt(selectedStructure));

      const struct = allStructures.find(s => s.id === selectedStructure);
      if (struct) {
        setGlobalStructureType(struct.type || "platform");
      }

      // Filter assigned SOWs for selectedStructure
      const assignedSows = rawSows.filter(s => s.structure_id?.toString() === selectedStructure);
      const assignedJpIds = new Set(assignedSows.map(s => s.jobpack_id?.toString()).filter(Boolean));

      const assignedJps = rawJobpacks
        .filter(jp => assignedJpIds.has(jp.id.toString()))
        .map((jp: any) => {
          const meta = jp.metadata || {};
          const start_date = meta.istart || meta.start_date || jp.start_date;
          let year = "Unknown Year";
          if (start_date) {
            const match = String(start_date).match(/^(\d{4})/);
            if (match) year = match[1];
          }
          if (year === "Unknown Year" && jp.year) year = String(jp.year);
          if (year === "Unknown Year" && jp.name) {
            const match = String(jp.name).match(/\b(19\d{2}|20\d{2})\b/);
            if (match) year = match[1];
          }
          if (year === "Unknown Year" && jp.created_at) {
            const match = String(jp.created_at).match(/^(\d{4})/);
            if (match) year = match[1];
          }

          return {
            ...jp,
            year,
            rawDate: start_date || jp.created_at || ""
          };
        });

      // Sort jobpacks descending (latest date/id first)
      assignedJps.sort((a: any, b: any) => {
        if (a.rawDate && b.rawDate) {
          return b.rawDate.localeCompare(a.rawDate);
        }
        return Number(b.id) - Number(a.id);
      });

      setJobpacks(assignedJps);

      // Auto-select single jobpack if only 1 exists
      if (assignedJps.length === 1) {
        setSelectedJobpack(assignedJps[0].id.toString());
      }
    } else {
      setJobpacks([]);
      setSelectedJobpack("");
      setSelectedReportId("");
      setGlobalStructureId(0);
      setGlobalStructureType("");
    }
  }, [selectedStructure, rawSows, rawJobpacks, allStructures]);

  // 3. Grouped & Sorted Jobpacks (Grouped by Year, Latest Year & Latest Jobpack First)
  const filteredJobpacks = jobpacks.filter(jp =>
    jp.name.toLowerCase().includes(jpSearch.toLowerCase()) ||
    jp.year.toLowerCase().includes(jpSearch.toLowerCase())
  );

  const groupedYears = React.useMemo(() => {
    const map = new Map<string, any[]>();

    filteredJobpacks.forEach(jp => {
      const y = jp.year || "Unknown Year";
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(jp);
    });

    // Sort years descending
    const sortedYears = Array.from(map.keys()).sort((a, b) => {
      if (a === "Unknown Year") return 1;
      if (b === "Unknown Year") return -1;
      return b.localeCompare(a, undefined, { numeric: true });
    });

    return sortedYears.map(year => ({
      year,
      items: map.get(year)!
    }));
  }, [filteredJobpacks]);

  const selectedJobpackName = jobpacks.find(jp => jp.id.toString() === selectedJobpack)?.name || "Select Jobpack";

  // 4. When Jobpack is selected -> populate SOW report numbers
  useEffect(() => {
    if (selectedStructure && selectedJobpack) {
      setSelectedReportId("");

      const matchedSows = rawSows.filter(
        s => s.structure_id?.toString() === selectedStructure && s.jobpack_id?.toString() === selectedJobpack
      );

      const exploded: any[] = [];
      matchedSows.forEach(sow => {
        if (Array.isArray(sow.report_numbers)) {
          sow.report_numbers.forEach((r: any) => {
            exploded.push({
              sowId: sow.id,
              reportNumber: r.number || r.date,
              label: r.number || r.date,
              fullId: `${sow.id}:${r.number || r.date}`
            });
          });
        } else if (typeof sow.report_numbers === 'string' && sow.report_numbers) {
          exploded.push({
            sowId: sow.id,
            reportNumber: sow.report_numbers,
            label: sow.report_numbers,
            fullId: `${sow.id}:${sow.report_numbers}`
          });
        }
      });

      setReportItems(exploded);
      if (exploded.length === 1) {
        setSelectedReportId(exploded[0].fullId);
      }
    } else {
      setReportItems([]);
      setSelectedReportId("");
    }
  }, [selectedStructure, selectedJobpack, rawSows]);

  // Extract SOW and Report parts for sections
  const [currentSowId, currentReportNo] = selectedReportId ? selectedReportId.split(':') : ["", ""];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50 dark:bg-slate-950/50">
      {/* Header */}
      <header className="sticky top-0 z-30 w-full border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-600/20">
              <ClipboardCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">QA-QC Tool</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Quality Testing & Data Integrity Validation</p>
            </div>
          </div>

          {/* Context Selectors in Sequence: Structure -> Jobpack -> SOW Report No */}
          <div className="flex flex-wrap items-center gap-3">
            {/* 1. Structure Popover (Grouped by Structure Type, Sorted Alphabetically) */}
            <Popover open={structOpen} onOpenChange={setStructOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={structOpen}
                  className="w-[260px] justify-between bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200"
                >
                  <span className="truncate flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <span>{selectedStructureName}</span>
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <div className="flex items-center border-b px-3 py-2 bg-slate-50 dark:bg-slate-900">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-slate-500" />
                  <input
                    placeholder="Search structure..."
                    className="flex h-8 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    value={structSearch}
                    onChange={(e) => setStructSearch(e.target.value)}
                  />
                  {structSearch && (
                    <button 
                      onClick={() => setStructSearch("")}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold px-1"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="max-h-[350px] overflow-y-auto p-1.5 custom-scrollbar">
                  {groupedStructureTypes.length === 0 ? (
                    <p className="p-4 text-center text-sm text-muted-foreground">No structure found.</p>
                  ) : (
                    groupedStructureTypes.map(({ type, items }) => (
                      <div key={type} className="mb-2 last:mb-0">
                        <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-md mb-1 flex justify-between items-center">
                          <span>{type}</span>
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-3.5 font-bold">
                            {items.length}
                          </Badge>
                        </div>
                        {items.map((s) => {
                          const isSelected = selectedStructure === s.id;
                          return (
                            <div
                              key={s.id}
                              className={cn(
                                "relative flex cursor-pointer select-none items-center justify-between rounded-md px-2.5 py-2 text-sm outline-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors my-0.5",
                                isSelected && "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold"
                              )}
                              onClick={() => {
                                setSelectedStructure(s.id);
                                setStructOpen(false);
                                setStructSearch("");
                              }}
                            >
                              <div className="flex items-center min-w-0 pr-2">
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 shrink-0",
                                    isSelected ? "opacity-100 text-blue-600 dark:text-blue-400" : "opacity-0"
                                  )}
                                />
                                <span className="truncate">{s.name}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* 2. Jobpack Popover (Grouped by Year, Latest First, Filtered by Structure) */}
            <Popover open={jpOpen} onOpenChange={setJpOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={jpOpen}
                  disabled={!selectedStructure}
                  className="w-[260px] justify-between bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 disabled:opacity-50"
                >
                  <span className="truncate">{selectedJobpackName}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <div className="flex items-center border-b px-3 py-2 bg-slate-50 dark:bg-slate-900">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-slate-500" />
                  <input
                    placeholder="Search jobpack or year..."
                    className="flex h-8 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    value={jpSearch}
                    onChange={(e) => setJpSearch(e.target.value)}
                  />
                  {jpSearch && (
                    <button 
                      onClick={() => setJpSearch("")}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold px-1"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="max-h-[350px] overflow-y-auto p-1.5 custom-scrollbar">
                  {groupedYears.length === 0 ? (
                    <p className="p-4 text-center text-sm text-muted-foreground">No jobpacks assigned to this structure.</p>
                  ) : (
                    groupedYears.map(({ year, items }) => (
                      <div key={year} className="mb-2 last:mb-0">
                        <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-md mb-1 flex justify-between items-center">
                          <span>{year === "Unknown Year" ? year : `Year ${year}`}</span>
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-3.5 font-bold">
                            {items.length}
                          </Badge>
                        </div>
                        {items.map((jp) => {
                          const isSelected = selectedJobpack === jp.id.toString();
                          return (
                            <div
                              key={jp.id}
                              className={cn(
                                "relative flex cursor-pointer select-none items-center justify-between rounded-md px-2.5 py-2 text-sm outline-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors my-0.5",
                                isSelected && "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold"
                              )}
                              onClick={() => {
                                setSelectedJobpack(jp.id.toString());
                                setJpOpen(false);
                                setJpSearch("");
                              }}
                            >
                              <div className="flex items-center min-w-0 pr-2">
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 shrink-0",
                                    isSelected ? "opacity-100 text-blue-600 dark:text-blue-400" : "opacity-0"
                                  )}
                                />
                                <span className="truncate">{jp.name}</span>
                              </div>
                              {jp.rawDate && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal shrink-0 font-mono">
                                  {jp.rawDate.substring(0, 10)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* 3. SOW Report No Select (Filtered by Structure + Jobpack) */}
            <div className="w-[200px]">
              <Select 
                value={selectedReportId} 
                onValueChange={setSelectedReportId}
                disabled={!selectedJobpack}
              >
                <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 disabled:opacity-50">
                  <SelectValue placeholder="Select Report No" />
                </SelectTrigger>
                <SelectContent>
                  {reportItems.map((item) => (
                    <SelectItem key={item.fullId} value={item.fullId}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6">
        {!selectedStructure || !selectedJobpack || !selectedReportId ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse">
              <Database className="h-12 w-12 text-slate-400 dark:text-slate-500" />
            </div>
            <div className="max-w-md">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Awaiting Context Selection</h3>
              <p className="text-slate-500 dark:text-slate-400 mt-2">
                Please select a Structure, Jobpack, and specific Report No to begin quality assurance testing.
              </p>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="spellcheck" className="w-full space-y-6">
            <div className="overflow-x-auto pb-2">
              <TabsList className="bg-white/50 dark:bg-slate-900/50 p-1 border border-slate-200 dark:border-slate-800 inline-flex min-w-full lg:min-w-0">
                <TabsTrigger value="spellcheck" className="gap-2">
                  <SpellCheck className="h-4 w-4" /> Spell Check
                </TabsTrigger>
                <TabsTrigger value="attachments" className="gap-2">
                  <ImageIcon className="h-4 w-4" /> Attachments
                </TabsTrigger>
                <TabsTrigger value="association" className="gap-2">
                  <LinkIcon className="h-4 w-4" /> Component Association
                </TabsTrigger>
                <TabsTrigger value="cp" className="gap-2">
                  <Zap className="h-4 w-4" /> CP Readings
                </TabsTrigger>
                <TabsTrigger value="findings" className="gap-2">
                  <AlertCircle className="h-4 w-4" /> Empty Findings
                </TabsTrigger>
                <TabsTrigger value="seabed" className="gap-2">
                  <Waves className="h-4 w-4" /> Seabed Survey
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Sections Content */}
            <TabsContent value="spellcheck">
              <SpellCheckSection jobpackId={selectedJobpack} structureId={selectedStructure} sowId={currentSowId} reportNo={currentReportNo} />
            </TabsContent>
            <TabsContent value="attachments">
              <AttachmentSection jobpackId={selectedJobpack} structureId={selectedStructure} sowId={currentSowId} reportNo={currentReportNo} />
            </TabsContent>
            <TabsContent value="association">
              <AssociationSection jobpackId={selectedJobpack} structureId={selectedStructure} sowId={currentSowId} reportNo={currentReportNo} />
            </TabsContent>
            <TabsContent value="cp">
              <CPReadingSection jobpackId={selectedJobpack} structureId={selectedStructure} sowId={currentSowId} reportNo={currentReportNo} />
            </TabsContent>
            <TabsContent value="findings">
              <EmptyFindingsSection jobpackId={selectedJobpack} structureId={selectedStructure} sowId={currentSowId} reportNo={currentReportNo} />
            </TabsContent>
            <TabsContent value="seabed">
              <SeabedSurveySection jobpackId={selectedJobpack} structureId={selectedStructure} sowId={currentSowId} reportNo={currentReportNo} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
