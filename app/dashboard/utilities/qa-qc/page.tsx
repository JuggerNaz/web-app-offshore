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
  ChevronsUpDown
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
  const [jobpacks, setJobpacks] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [reportItems, setReportItems] = useState<any[]>([]);

  // Selection state
  const [selectedJobpack, setSelectedJobpack] = useState<string>("");
  const [selectedStructure, setSelectedStructure] = useState<string>("");
  const [selectedReportId, setSelectedReportId] = useState<string>(""); // Format: sowId:reportNumber

  // Search state for Jobpack
  const [jpSearch, setJpSearch] = useState("");
  const [jpOpen, setJpOpen] = useState(false);

  // Global state sync
  const [, setGlobalStructureId] = useAtom(urlId);
  const [, setGlobalStructureType] = useAtom(urlType);

  const supabase = createClient();

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedJobpack) {
      fetchStructures(selectedJobpack);
      setSelectedStructure("");
      setSelectedReportId("");
      setGlobalStructureId(0);
      setGlobalStructureType("");
    }
  }, [selectedJobpack]);

  useEffect(() => {
    if (selectedJobpack && selectedStructure) {
      fetchReportItems(selectedJobpack, selectedStructure);
      setSelectedReportId("");
      
      // Sync global structure context for shared dialogs
      setGlobalStructureId(parseInt(selectedStructure));
      const struct = structures.find(s => s.id.toString() === selectedStructure);
      if (struct) {
        setGlobalStructureType(struct.type || "platform");
      }
    }
  }, [selectedJobpack, selectedStructure, structures]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Get only jobpacks that HAVE inspection records
      const { data: records, error: rError } = await supabase
        .from("insp_records")
        .select("jobpack_id");
      
      if (rError) throw rError;
      
      const activeJpIds = Array.from(new Set(records.map(r => r.jobpack_id)));
      
      if (activeJpIds.length === 0) {
        setJobpacks([]);
        return;
      }

      const { data: jps, error: jError } = await supabase
        .from("jobpack")
        .select("id, name")
        .in("id", activeJpIds)
        .order("name");
      
      if (jError) throw jError;
      setJobpacks(jps || []);
    } catch (err: any) {
      toast.error("Failed to load jobpacks");
    } finally {
      setLoading(false);
    }
  };

  const fetchStructures = async (jpId: string) => {
    try {
      const { data, error } = await supabase
        .from("u_sow")
        .select("structure_id, structure_title, structure_type")
        .eq("jobpack_id", jpId);
      
      if (error) throw error;
      
      const uniqueStructs = Array.from(new Set(data.map(s => s.structure_id)))
        .map(id => {
          const item = data.find(s => s.structure_id === id);
          return {
            id,
            title: item?.structure_title || `Structure ${id}`,
            type: item?.structure_type || "platform"
          };
        });
      
      setStructures(uniqueStructs);
    } catch (err) {
      toast.error("Failed to load structures");
    }
  };

  const fetchReportItems = async (jpId: string, structId: string) => {
    try {
      const { data, error } = await supabase
        .from("u_sow")
        .select("id, report_numbers")
        .eq("jobpack_id", jpId)
        .eq("structure_id", structId);
      
      if (error) throw error;
      
      // Explode SOWs by individual report numbers
      const exploded: any[] = [];
      data.forEach(sow => {
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
    } catch (err) {
      toast.error("Failed to load report numbers");
    }
  };

  const filteredJobpacks = jobpacks.filter(jp => 
    jp.name.toLowerCase().includes(jpSearch.toLowerCase())
  );

  const selectedJobpackName = jobpacks.find(jp => jp.id.toString() === selectedJobpack)?.name || "Select Jobpack";

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

          {/* Context Selectors */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Searchable Jobpack Popover */}
            <Popover open={jpOpen} onOpenChange={setJpOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={jpOpen}
                  className="w-[250px] justify-between bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                >
                  <span className="truncate">{selectedJobpackName}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0" align="start">
                <div className="flex items-center border-b px-3 py-2">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <input
                    placeholder="Search jobpack..."
                    className="flex h-8 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    value={jpSearch}
                    onChange={(e) => setJpSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-[300px] overflow-y-auto p-1">
                  {filteredJobpacks.length === 0 ? (
                    <p className="p-4 text-center text-sm text-muted-foreground">No jobpack found.</p>
                  ) : (
                    filteredJobpacks.map((jp) => (
                      <div
                        key={jp.id}
                        className={cn(
                          "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100 dark:hover:bg-slate-800",
                          selectedJobpack === jp.id.toString() && "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                        )}
                        onClick={() => {
                          setSelectedJobpack(jp.id.toString());
                          setJpOpen(false);
                          setJpSearch("");
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedJobpack === jp.id.toString() ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {jp.name}
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <div className="w-[200px]">
              <Select 
                value={selectedStructure} 
                onValueChange={setSelectedStructure}
                disabled={!selectedJobpack}
              >
                <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="Select Structure" />
                </SelectTrigger>
                <SelectContent>
                  {structures.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[200px]">
              <Select 
                value={selectedReportId} 
                onValueChange={setSelectedReportId}
                disabled={!selectedStructure}
              >
                <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
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
        {!selectedJobpack || !selectedStructure || !selectedReportId ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse">
              <Database className="h-12 w-12 text-slate-400 dark:text-slate-500" />
            </div>
            <div className="max-w-md">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Awaiting Context Selection</h3>
              <p className="text-slate-500 dark:text-slate-400 mt-2">
                Please select a Jobpack (with records), Structure, and specific Report No to begin quality assurance testing.
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
