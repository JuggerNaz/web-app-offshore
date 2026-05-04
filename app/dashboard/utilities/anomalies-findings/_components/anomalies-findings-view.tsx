"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import inspectionTypesData from "@/utils/types/inspection-types.json";

import { createClient } from "@/utils/supabase/client";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, 
  ClipboardCheck, 
  Search, 
  CheckCircle, 
  Paperclip, 
  Info,
  Loader2,
  ExternalLink,
  LayoutGrid,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Save,
  RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import { AttachmentSection } from "./attachment-section";
import { ComponentSpecDialog } from "@/components/dialogs/component-spec-dialog";


interface ComponentSpec {
  id: number;
  q_id: string;
  id_no: string;
  code: string;
  structure_id: number;
  metadata: any;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());


export function AnomaliesFindingsView() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [structures, setStructures] = useState<any[]>([]);
  const [jobpacks, setJobpacks] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [components, setComponents] = useState<Record<number, ComponentSpec>>({});
  
  const { data: priorityColorsData } = useSWR('/api/library/combo/ANMLYCLR', fetcher);

  const priorityColors = useMemo(() => {
    const map: Record<string, string> = {};
    if (priorityColorsData?.data) {
      priorityColorsData.data.forEach((item: any) => {
        map[item.code_1] = item.code_2;
      });
    }
    // Fallbacks
    if (!map["PRIORITY 1"]) map["PRIORITY 1"] = "#ef4444";
    if (!map["PRIORITY 2"]) map["PRIORITY 2"] = "#f97316";
    if (!map["PRIORITY 3"]) map["PRIORITY 3"] = "#eab308";
    if (!map["PRIORITY 4"]) map["PRIORITY 4"] = "#3b82f6";
    return map;
  }, [priorityColorsData]);

  const { data: apiInspectionTypes } = useSWR('/api/inspection-type?pageSize=1000', fetcher);

  const inspectionTypeMap = useMemo(() => {
    const map: Record<string, { name: string, mode: string }> = {};
    
    // Populate from JSON
    if (inspectionTypesData && (inspectionTypesData as any).inspectionTypes) {
      (inspectionTypesData as any).inspectionTypes.forEach((type: any) => {
        const mode = type.methods?.includes("ROV") ? "ROV" : (type.methods?.includes("DIVING") ? "Diving" : "");
        map[type.code] = {
          name: type.name,
          mode: mode
        };
      });
    }

    // Populate from API
    if (apiInspectionTypes?.data) {
      apiInspectionTypes.data.forEach((type: any) => {
        const isDiving = type.metadata?.diving === 1 || type.metadata?.diving === "1" || type.metadata?.diving === true;
        const isRov = type.metadata?.rov === 1 || type.metadata?.rov === "1" || type.metadata?.rov === true || type.code?.toUpperCase().startsWith("R");
        
        let mode = "";
        if (isDiving && isRov) mode = "Diving/ROV";
        else if (isDiving) mode = "Diving";
        else if (isRov) mode = "ROV";
        
        map[type.code] = {
          name: type.name || type.code,
          mode: mode
        };
      });
    }
    
    return map;
  }, [apiInspectionTypes]);

  
  // Filter State
  const [selectedStructureId, setSelectedStructureId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"anomalies" | "findings">("anomalies");
  const [viewType, setViewType] = useState<"card" | "list">("card");
  const [structureSearchQuery, setStructureSearchQuery] = useState("");
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  
  // Sorting State
  const [sortColumn, setSortColumn] = useState<string>("reference");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  // Interaction State
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isSpecOpen, setIsSpecOpen] = useState(false);
  const [selectedCompForSpec, setSelectedCompForSpec] = useState<ComponentSpec | null>(null);
  const [rectificationNotes, setRectificationNotes] = useState("");
  const [rectifiedDate, setRectifiedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [approvedBy, setApprovedBy] = useState("");
  const [evaluatedBy, setEvaluatedBy] = useState("");
  const [isRectifying, setIsRectifying] = useState(false);
  const handleSaveChanges = async () => {
    if (!selectedItem) return;

    try {
      if (viewMode === "anomalies") {
        const codeChanged = editDefectCode !== selectedItem.defect_type_code;
        const typeChanged = editDefectType !== selectedItem.defect_category_code;
        const priorityChanged = editPriority !== selectedItem.priority_code;
        
        const isModified = codeChanged || typeChanged || priorityChanged;

        let newRefNo = selectedItem.anomaly_ref_no || "";

        if (isModified) {
          if (selectedItem.status !== 'CLOSED') {
            if (!newRefNo.endsWith('A')) {
              if (newRefNo.endsWith('R')) {
                newRefNo = newRefNo.slice(0, -1) + 'A';
              } else {
                newRefNo = newRefNo + 'A';
              }
            }
          }
        }

        const payload: any = {
          defect_type_code: editDefectCode,
          defect_category_code: editDefectType,
          priority_code: editPriority,
          anomaly_ref_no: newRefNo
        };

        const { error } = await supabase
          .from('insp_anomalies')
          .update(payload)
          .eq('anomaly_id', selectedItem.anomaly_id);

        if (error) {
          toast.error(`Failed to save changes: ${error.message}`);
        } else {
          toast.success(`Changes saved successfully.`);
          setAnomalies((prev: any[]) => prev.map(a => a.anomaly_id === selectedItem.anomaly_id ? { ...a, ...payload } : a));
          setSelectedItem((prev: any) => ({ ...prev, ...payload }));
        }
      } else {
        // For findings
        const updatedData = {
          ...selectedItem.inspection_data,
          priority: editPriority
        };
        const { error } = await supabase
          .from('insp_records')
          .update({ inspection_data: updatedData })
          .eq('insp_id', selectedItem.insp_id);

        if (error) {
          toast.error(`Failed to save changes: ${error.message}`);
        } else {
          toast.success(`Changes saved successfully.`);
          setFindings((prev: any[]) => prev.map(f => f.insp_id === selectedItem.insp_id ? { ...f, inspection_data: updatedData } : f));
          setSelectedItem((prev: any) => ({ ...prev, inspection_data: updatedData }));
        }
      }
    } catch (e: any) {
      toast.error(`Error saving changes: ${e.message}`);
    }
  };
  const [editDefectCode, setEditDefectCode] = useState("");
  const [editDefectType, setEditDefectType] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [defectCodes, setDefectCodes] = useState<any[]>([]);
  const [priorities, setPriorities] = useState<any[]>([]);
  const [allDefectTypes, setAllDefectTypes] = useState<any[]>([]);
  const [availableDefectTypes, setAvailableDefectTypes] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [
          platformsRes, pipelinesRes, jobpacksRes, componentsRes, anomaliesRes, findingsRes,
          codesRes, priosRes, fndsRes
        ] = await Promise.all([
          supabase.from("platform").select("plat_id, title"),
          supabase.from("u_pipeline").select("pipe_id, title"),
          supabase.from("jobpack").select("id, name, metadata"),
          supabase.from("structure_components").select("id, q_id, id_no, code, structure_id, metadata"),
          supabase.from("insp_anomalies").select(`
            *,
            inspection:insp_records(
              insp_id, 
              structure_id, 
              component_id, 
              jobpack_id,
              sow_report_no,
              inspection_type_code,
              inspection_date,
              inspection_data,
              has_anomaly,
              tape_count_no,
              tape_id,
              dive_job_id,
              rov_job_id,
              structure_components:component_id!left(q_id, code),
              insp_rov_jobs:rov_job_id!left(job_no:deployment_no),
              insp_dive_jobs:dive_job_id!left(job_no:dive_no),
              insp_video_tapes:tape_id!left(tape_no)
            )
          `),
          supabase.from("insp_records").select(`
            *,
            structure_components:component_id!left(q_id, code),
            insp_rov_jobs:rov_job_id!left(job_no:deployment_no),
            insp_dive_jobs:dive_job_id!left(job_no:dive_no),
            insp_video_tapes:tape_id!left(tape_no)
          `),
          supabase.from("u_lib_list").select("lib_id, lib_desc").eq("lib_code", "AMLY_COD").order("lib_desc"),
          supabase.from("u_lib_list").select("lib_id, lib_desc").eq("lib_code", "AMLY_TYP").order("lib_desc"),
          supabase.from("u_lib_list").select("lib_id, lib_desc").eq("lib_code", "AMLY_FND").order("lib_desc")
        ]);

        const combinedStructures = [
          ...(platformsRes.data || []).map(p => ({ id: p.plat_id, title: p.title, type: "platform" })),
          ...(pipelinesRes.data || []).map(p => ({ id: p.pipe_id, title: p.title, type: "pipeline" }))
        ];
        
        setStructures(combinedStructures);
        setJobpacks(jobpacksRes.data || []);

        if (codesRes.data) setDefectCodes(codesRes.data);
        if (priosRes.data) setPriorities(priosRes.data);
        if (fndsRes.data) {
          setAllDefectTypes(fndsRes.data);
          setAvailableDefectTypes(fndsRes.data);
        }
        
        const anomaliesFiltered = (anomaliesRes.data || []).filter((a: any) => {
          const metaStatus = (a.inspection?.inspection_data?._meta_status || "").toLowerCase();
          return metaStatus !== "finding";
        });
        setAnomalies(anomaliesFiltered);

        const findingsFiltered = (findingsRes.data || []).filter((f: any) => {
          if (!f.has_anomaly) return false;
          const metaStatus = (f.inspection_data?._meta_status || "").toLowerCase();
          return metaStatus === "finding";
        });
        setFindings(findingsFiltered);
        
        const compMap: Record<number, ComponentSpec> = {};
        (componentsRes.data || []).forEach((c: any) => {
          compMap[c.id] = c;
        });
        setComponents(compMap);

        const initialStr = combinedStructures.find(str => {
          return anomaliesFiltered.some(a => String(a.inspection?.structure_id) === String(str.id)) ||
                 findingsFiltered.some(f => String(f.structure_id) === String(str.id));
        });
        
        if (initialStr) {
          setSelectedStructureId(String(initialStr.id));
        } else if (combinedStructures.length > 0) {
          setSelectedStructureId(String(combinedStructures[0].id));
        }

      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);
  // Filter Defect Types by selected Defect Code via u_lib_combo
  useEffect(() => {
    async function filterDefectTypes() {
      const currentDefectCode = editDefectCode;

      if (!currentDefectCode) {
        setAvailableDefectTypes(allDefectTypes);
        return;
      }
      
      const selectedCodeItem = defectCodes.find(c => c.lib_desc === currentDefectCode);
      if (!selectedCodeItem) {
        setAvailableDefectTypes(allDefectTypes);
        return;
      }
      
      const { data: combos } = await supabase
        .from('u_lib_combo')
        .select('code_2')
        .eq('code_1', selectedCodeItem.lib_id);
        
      if (combos && combos.length > 0) {
        const validTypeIds = combos.map((c: any) => c.code_2);
        const filtered = allDefectTypes.filter(t => validTypeIds.includes(t.lib_id));
        setAvailableDefectTypes(filtered.length > 0 ? filtered : allDefectTypes);
      } else {
        setAvailableDefectTypes(allDefectTypes);
      }
    }
    filterDefectTypes();
  }, [editDefectCode, defectCodes, allDefectTypes, viewMode, supabase]);

  // Filtered Structures (Only those with items)
  const filteredStructures = useMemo(() => {
    return structures.filter(str => {
      const hasItems = viewMode === "anomalies" 
        ? anomalies.some(anom => String(anom.inspection?.structure_id) === String(str.id))
        : findings.some(find => String(find.structure_id) === String(str.id));
        
      const matchesSearch = str.title?.toLowerCase().includes(structureSearchQuery.toLowerCase());
      
      return hasItems && matchesSearch;
    });
  }, [structures, anomalies, findings, viewMode, structureSearchQuery]);

  // Grouped and Sorted Items by Jobpack
  const groupedItems = useMemo(() => {
    if (!selectedStructureId) return {};

    const items = viewMode === "anomalies" 
      ? anomalies.filter(anom => String(anom.inspection?.structure_id) === selectedStructureId)
      : findings.filter(find => String(find.structure_id) === selectedStructureId);

    const filtered = items.filter(item => {
      const compId = viewMode === "anomalies" ? item.inspection?.component_id : item.component_id;
      const comp = components[compId];
      const qid = comp?.q_id?.toLowerCase() || "";
      const refNo = (viewMode === "anomalies" ? item.anomaly_ref_no : `INSP-${item.insp_id}`)?.toLowerCase() || "";
      const desc = (viewMode === "anomalies" ? item.defect_description : (item.description || item.observation))?.toLowerCase() || "";
      
      return qid.includes(itemSearchQuery.toLowerCase()) || 
             refNo.includes(itemSearchQuery.toLowerCase()) || 
             desc.includes(itemSearchQuery.toLowerCase());
    });

    // Apply Sorting
    const sorted = [...filtered].sort((a, b) => {
      let valA = "";
      let valB = "";
      
      const compA = components[viewMode === "anomalies" ? a.inspection?.component_id : a.component_id];
      const compB = components[viewMode === "anomalies" ? b.inspection?.component_id : b.component_id];

      if (sortColumn === "reference") {
        valA = viewMode === "anomalies" ? a.anomaly_ref_no : `INSP-${a.insp_id}`;
        valB = viewMode === "anomalies" ? b.anomaly_ref_no : `INSP-${b.insp_id}`;
      } else if (sortColumn === "type") {
        const typeCodeA = viewMode === "anomalies" ? a.inspection?.inspection_type_code : a.inspection_type_code;
        const typeCodeB = viewMode === "anomalies" ? b.inspection?.inspection_type_code : b.inspection_type_code;
        
        const infoA = inspectionTypeMap[typeCodeA];
        const infoB = inspectionTypeMap[typeCodeB];
        
        valA = infoA ? `${infoA.name}${infoA.mode ? ` (${infoA.mode})` : ''}` : (typeCodeA || (viewMode === "anomalies" ? a.defect_type_code : ""));
        valB = infoB ? `${infoB.name}${infoB.mode ? ` (${infoB.mode})` : ''}` : (typeCodeB || (viewMode === "anomalies" ? b.defect_type_code : ""));
      } else if (sortColumn === "description") {
        valA = viewMode === "anomalies" ? a.defect_description : (a.description || a.observation);
        valB = viewMode === "anomalies" ? b.defect_description : (b.description || b.observation);
      } else if (sortColumn === "qid") {
        valA = compA?.q_id || "";
        valB = compB?.q_id || "";
      } else if (sortColumn === "status") {
        valA = viewMode === "anomalies" ? (a.status === 'CLOSED' ? 'CLOSED' : a.priority_code) : a.status;
        valB = viewMode === "anomalies" ? (b.status === 'CLOSED' ? 'CLOSED' : b.priority_code) : b.status;
      }

      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();

      if (sortColumn === "reference") {
        return sortDirection === "asc" 
          ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" })
          : valB.localeCompare(valA, undefined, { numeric: true, sensitivity: "base" });
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    const groups: Record<string, { jobpack: any, items: any[] }> = {};
    
    groups["unassigned"] = {
      jobpack: { id: "unassigned", name: "Unassigned Jobpack" },
      items: []
    };

    jobpacks.forEach(jp => {
      groups[String(jp.id)] = { jobpack: jp, items: [] };
    });

    sorted.forEach(item => {
      const jpId = viewMode === "anomalies" ? item.inspection?.jobpack_id : item.jobpack_id;
      const key = jpId ? String(jpId) : "unassigned";
      if (groups[key]) {
        groups[key].items.push(item);
      } else {
        groups["unassigned"].items.push(item);
      }
    });

    return Object.fromEntries(
      Object.entries(groups).filter(([key, group]) => group.items.length > 0)
    );
  }, [selectedStructureId, viewMode, anomalies, findings, itemSearchQuery, jobpacks, components, sortColumn, sortDirection]);

  const selectedItemComp = useMemo(() => {
    if (!selectedItem) return null;
    const compId = viewMode === "anomalies" ? selectedItem.inspection?.component_id : selectedItem.component_id;
    return components[compId];
  }, [selectedItem, viewMode, components]);


  const handleRectify = async () => {
    if (!selectedItem) return;
    setIsRectifying(true);
    
    try {
      if (viewMode === "anomalies") {
        let currentRef = selectedItem.anomaly_ref_no || "";
        if (currentRef.endsWith("A")) {
          currentRef = currentRef.slice(0, -1) + "R";
        } else if (!currentRef.endsWith("R")) {
          currentRef = `${currentRef}R`;
        }

        const payload: any = { 
          status: "CLOSED", 
          anomaly_ref_no: currentRef,
          follow_up_notes: rectificationNotes,
          rectified_date: rectifiedDate,
          approved_by: approvedBy,
          reviewed_by: evaluatedBy,
          is_rectified: true,
          rectified_by: approvedBy
        };

        const { error } = await supabase
          .from("insp_anomalies")
          .update(payload)
          .eq("anomaly_id", selectedItem.anomaly_id);

        if (error) throw error;
        
        toast.success("Anomaly Rectified & Closed");
        setAnomalies((prev: any[]) => prev.map(a => 
          a.anomaly_id === selectedItem.anomaly_id ? { ...a, ...payload } : a
        ));
        setSelectedItem((prev: any) => ({ ...prev, ...payload }));
      } else {
        const payload: any = { 
          status: "COMPLETED",
          description: rectificationNotes || selectedItem.description,
          approved_date: rectifiedDate,
          approved_by: approvedBy,
          reviewed_by: evaluatedBy
        };

        const { error } = await supabase
          .from("insp_records")
          .update(payload)
          .eq("insp_id", selectedItem.insp_id);

        if (error) throw error;
        
        toast.success("Finding Rectified & Completed");
        setFindings((prev: any[]) => prev.map(f => 
          f.insp_id === selectedItem.insp_id ? { ...f, ...payload } : f
        ));
        setSelectedItem((prev: any) => ({ ...prev, ...payload }));
      }
    } catch (e: any) {
      toast.error(`Error rectifying: ${e.message}`);
    } finally {
      setIsRectifying(false);
    }
  };

  const handleRollbackRectify = async () => {
    if (!selectedItem) return;
    setIsRectifying(true);
    
    try {
      if (viewMode === "anomalies") {
        let currentRef = selectedItem.anomaly_ref_no || "";
        if (currentRef.endsWith("R")) {
          currentRef = currentRef.slice(0, -1);
        }
        if (!currentRef.endsWith("A")) {
          currentRef = `${currentRef}A`;
        }

        const payload: any = { 
          status: "OPEN", 
          anomaly_ref_no: currentRef,
          rectified_date: null,
          is_rectified: false,
          rectified_by: null
        };

        const { error } = await supabase
          .from("insp_anomalies")
          .update(payload)
          .eq("anomaly_id", selectedItem.anomaly_id);

        if (error) throw error;
        
        toast.success("Anomaly Re-opened");
        setAnomalies((prev: any[]) => prev.map(a => 
          a.anomaly_id === selectedItem.anomaly_id 
            ? { 
                ...a, 
                ...payload
              } 
            : a
        ));
        setSelectedItem((prev: any) => ({ ...prev, ...payload }));
      } else {
        const payload: any = { 
          status: "INCOMPLETE",
          approved_date: null
        };

        const { error } = await supabase
          .from("insp_records")
          .update(payload)
          .eq("insp_id", selectedItem.insp_id);

        if (error) throw error;
        
        toast.success("Finding Re-opened");
        setFindings((prev: any[]) => prev.map(f => 
          f.insp_id === selectedItem.insp_id ? { ...f, ...payload } : f
        ));
        setSelectedItem((prev: any) => ({ ...prev, ...payload }));
      }
    } catch (e: any) {
      toast.error(`Error rolling back: ${e.message}`);
    } finally {
      setIsRectifying(false);
    }
  };

  const openSpecDialog = (compId: number) => {
    const comp = components[compId];
    if (comp) {
      setSelectedCompForSpec(comp);
      setIsSpecOpen(true);
    } else {
      toast.error("Component details not found");
    }
  };

  const renderSortHeader = (label: string, column: string) => {
    const isSorted = sortColumn === column;
    return (
      <th 
        className="px-4 py-3 cursor-pointer hover:bg-muted/80 transition-colors"
        onClick={() => {
          if (sortColumn === column) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
          } else {
            setSortColumn(column);
            setSortDirection("asc");
          }
        }}
      >
        <div className="flex items-center gap-1 select-none">
          {label}
          {isSorted ? (
            sortDirection === "asc" ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
          ) : (
            <ArrowUpDown className="h-3 w-3 text-muted-foreground/30" />
          )}
        </div>
      </th>
    );
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Module Header */}
      <div className="p-4 border-b border-border bg-card/50 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Anomaly / Findings Management
        </h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Structures */}
        <div className="w-80 border-r border-border bg-muted/20 flex flex-col">
          <div className="p-4 border-b border-border space-y-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              Structures
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search structures..." 
                value={structureSearchQuery}
                onChange={(e) => setStructureSearchQuery(e.target.value)}
                className="pl-9 bg-background border-border"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredStructures.map(str => {
                const count = viewMode === "anomalies"
                  ? anomalies.filter(a => String(a.inspection?.structure_id) === String(str.id)).length
                  : findings.filter(f => String(f.structure_id) === String(str.id)).length;

                return (
                  <button
                    key={`${str.type}-${str.id}`}
                    onClick={() => setSelectedStructureId(String(str.id))}
                    className={`w-full text-left px-4 py-2 rounded-md transition-all flex justify-between items-center text-sm ${
                      selectedStructureId === String(str.id)
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="truncate">{str.title}</span>
                    <Badge variant="secondary" className="bg-muted text-muted-foreground">
                      {count}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Main Area */}
        <div className="flex-1 flex flex-col bg-background">
          {/* Top bar */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-muted/10">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "anomalies" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("anomalies")}
                style={viewMode === "anomalies" ? { backgroundColor: priorityColors["PRIORITY 1"] || '#ef4444', color: '#ffffff' } : {}}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Anomalies
              </Button>
              <Button
                variant={viewMode === "findings" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("findings")}
                style={viewMode === "findings" ? { backgroundColor: '#059669', color: '#ffffff' } : {}}
              >
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Findings
              </Button>

            </div>

            <div className="flex items-center gap-4 w-1/2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search items..." 
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  className="pl-9 bg-background border-border h-9"
                />
              </div>
              
              <div className="flex border border-border rounded-md p-1 bg-muted/50">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewType("card")}
                  className={`px-2 h-7 ${viewType === "card" ? "bg-background shadow-sm text-primary" : "text-muted-foreground"}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewType("list")}
                  className={`px-2 h-7 ${viewType === "list" ? "bg-background shadow-sm text-primary" : "text-muted-foreground"}`}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 p-6">
            {Object.keys(groupedItems).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No items found for this selection.</div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedItems).map(([jpId, group]: any) => (
                  <div key={jpId} className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
                      {group.jobpack.name}
                    </h3>
                    
                    {viewType === "card" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {group.items.map((item: any) => {
                          const compId = viewMode === "anomalies" ? item.inspection?.component_id : item.component_id;
                          const comp = components[compId];
                          const refNo = viewMode === "anomalies" ? item.anomaly_ref_no : `INSP-${item.insp_id}`;
                          const desc = viewMode === "anomalies" ? (item.defect_category_code || "N/A") : (item.description || item.observation);
                          const qid = viewMode === "anomalies"
                            ? (item.inspection?.structure_components?.q_id || comp?.q_id || "N/A")
                            : (item.structure_components?.q_id || comp?.q_id || "N/A");

                          return (
                            <Card 
                              key={viewMode === "anomalies" ? item.anomaly_id : item.insp_id} 
                              className="bg-card border-border hover:border-primary/30 transition-all cursor-pointer shadow-sm hover:shadow-md"
                              onDoubleClick={() => {
                                setSelectedItem(item);
                                setEditDefectCode(viewMode === "anomalies" ? (item.defect_type_code || "") : (item.inspection_type_code || ""));
                                setEditDefectType(viewMode === "anomalies" ? (item.defect_category_code || "") : (item.inspection_type_code || ""));
                                setEditPriority(viewMode === "anomalies" ? (item.priority_code || "") : (item.inspection_data?.priority || ""));
                                setRectificationNotes(viewMode === "anomalies" ? (item.follow_up_notes || "") : (item.description || ""));
                                setRectifiedDate(viewMode === "anomalies" 
                                  ? (item.rectified_date ? new Date(item.rectified_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
                                  : (item.approved_date ? new Date(item.approved_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]));
                                setApprovedBy(item.approved_by || "");
                                setEvaluatedBy(item.reviewed_by || "");
                                setIsDetailOpen(true);
                              }}
                            >
                              <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                  <Badge variant="outline" className="font-mono">
                                    {refNo}
                                  </Badge>
                                  {viewMode === "anomalies" && (
                                    <Badge 
                                      style={{ 
                                        backgroundColor: item.status === 'CLOSED' ? '#6b7280' : (priorityColors[item.priority_code] || '#ef4444'),
                                        color: '#ffffff'
                                      }}
                                      className="border-none"
                                    >
                                      {item.status === 'CLOSED' ? 'CLOSED' : item.priority_code}
                                    </Badge>
                                  )}

                                </div>
                                <CardTitle className="text-base font-semibold mt-2">
                                  {(() => {
                                    const typeCode = viewMode === "anomalies" ? item.inspection?.inspection_type_code : item.inspection_type_code;
                                    const typeInfo = inspectionTypeMap[typeCode];
                                    return typeInfo 
                                      ? `${typeInfo.name}${typeInfo.mode ? ` (${typeInfo.mode})` : ''}` 
                                      : (typeCode || (viewMode === "anomalies" ? item.defect_type_code : "N/A"));
                                  })()}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3 text-sm text-muted-foreground">
                                <p className="line-clamp-2 italic text-foreground/80">"{desc}"</p>
                                
                                <div className="pt-2 border-t border-border flex justify-between items-center text-xs">
                                  <span>QID:</span>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openSpecDialog(compId);
                                    }}
                                    className="text-primary hover:underline flex items-center gap-1 font-mono"
                                  >
                                    {qid}
                                    <ExternalLink className="h-3 w-3" />
                                  </button>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    ) : (
                      /* List View */
                      <div className="border border-border rounded-md overflow-hidden bg-card">
                        <table className="w-full text-sm text-left text-muted-foreground">
                          <thead className="text-xs uppercase bg-muted text-muted-foreground border-b border-border">
                            <tr>
                              {renderSortHeader("Reference", "reference")}
                              {renderSortHeader("Type", "type")}
                              {renderSortHeader(viewMode === "anomalies" ? "Defect Type" : "Description", "description")}
                              {renderSortHeader("QID", "qid")}
                              {viewMode === "anomalies" && renderSortHeader("Status", "status")}
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map((item: any) => {
                              const compId = viewMode === "anomalies" ? item.inspection?.component_id : item.component_id;
                              const comp = components[compId];
                              const refNo = viewMode === "anomalies" ? item.anomaly_ref_no : `INSP-${item.insp_id}`;
                              const desc = viewMode === "anomalies" ? (item.defect_category_code || "N/A") : (item.description || item.observation);
                              const qid = viewMode === "anomalies"
                                ? (item.inspection?.structure_components?.q_id || comp?.q_id || "N/A")
                                : (item.structure_components?.q_id || comp?.q_id || "N/A");

                              return (
                                <tr 
                                  key={viewMode === "anomalies" ? item.anomaly_id : item.insp_id}
                                  onDoubleClick={() => {
                                    setSelectedItem(item);
                                    setEditDefectCode(viewMode === "anomalies" ? (item.defect_type_code || "") : (item.inspection_type_code || ""));
                                    setEditDefectType(viewMode === "anomalies" ? (item.defect_category_code || "") : (item.inspection_type_code || ""));
                                    setEditPriority(viewMode === "anomalies" ? (item.priority_code || "") : (item.inspection_data?.priority || ""));
                                    setRectificationNotes(viewMode === "anomalies" ? (item.follow_up_notes || "") : (item.description || ""));
                                    setRectifiedDate(viewMode === "anomalies" 
                                      ? (item.rectified_date ? new Date(item.rectified_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
                                      : (item.approved_date ? new Date(item.approved_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]));
                                    setApprovedBy(item.approved_by || "");
                                    setEvaluatedBy(item.reviewed_by || "");
                                    setIsDetailOpen(true);
                                  }}
                                  className="border-b border-border hover:bg-muted/50 cursor-pointer transition-colors"
                                >
                                  <td className="px-4 py-3 font-mono text-foreground font-medium">{refNo}</td>
                                  <td className="px-4 py-3 text-foreground">
                                    {(() => {
                                      const typeCode = viewMode === "anomalies" ? item.inspection?.inspection_type_code : item.inspection_type_code;
                                      const typeInfo = inspectionTypeMap[typeCode];
                                      return typeInfo 
                                        ? `${typeInfo.name}${typeInfo.mode ? ` (${typeInfo.mode})` : ''}` 
                                        : (typeCode || (viewMode === "anomalies" ? item.defect_type_code : "N/A"));
                                    })()}
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground truncate max-w-xs">{desc}</td>
                                  <td className="px-4 py-3">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openSpecDialog(compId);
                                      }}
                                      className="text-primary hover:underline flex items-center gap-1 font-mono"
                                    >
                                      {qid}
                                      <ExternalLink className="h-3 w-3" />
                                    </button>
                                  </td>
                                  {viewMode === "anomalies" && (
                                    <td className="px-4 py-3">
                                      <Badge 
                                        style={{ 
                                          backgroundColor: item.status === 'CLOSED' ? '#6b7280' : (priorityColors[item.priority_code] || '#ef4444'),
                                          color: '#ffffff'
                                        }}
                                        className="border-none"
                                      >
                                        {item.status === 'CLOSED' ? 'CLOSED' : item.priority_code}
                                      </Badge>
                                    </td>
                                  )}

                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="bg-card text-foreground border-border max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              {viewMode === "anomalies" ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <ClipboardCheck className="h-5 w-5 text-emerald-600" />}
              {viewMode === "anomalies" ? "Anomaly Details" : "Finding Details"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Review information and rectify.
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-6 py-4">
              <div className="space-y-4 p-4 rounded-md border border-destructive/20 bg-destructive/5">
                <div className="flex items-center justify-between border-b border-destructive/20 pb-2">
                  <div className="flex items-center gap-2 text-destructive font-bold text-sm uppercase tracking-wider">
                    <AlertTriangle className="h-4 w-4" />
                    Anomaly / Defect Details
                  </div>
                  {selectedItemComp && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openSpecDialog(selectedItemComp.id)}
                      className="text-primary hover:underline font-mono text-xs h-6 px-2 flex items-center gap-1 select-none"
                    >
                      QID: {selectedItemComp.q_id}
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground font-semibold">Defect Code *</Label>
                    {viewMode === "anomalies" ? (
                      <select
                        value={editDefectCode}
                        onChange={(e) => setEditDefectCode(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs font-semibold focus-visible:ring-red-500"
                      >
                        <option value="">Select Code</option>
                        {defectCodes.map(c => (
                          <option key={c.lib_id} value={c.lib_desc}>{c.lib_desc}</option>
                        ))}
                      </select>
                    ) : (
                      <Input 
                        value={selectedItem.inspection_type_code} 
                        readOnly 
                        className="bg-background border-border h-9"
                      />
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground font-semibold">Defect Type</Label>
                    {viewMode === "anomalies" ? (
                      <select
                        value={editDefectType}
                        onChange={(e) => setEditDefectType(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs font-semibold focus-visible:ring-red-500"
                      >
                        <option value="">Select Type</option>
                        {availableDefectTypes.map(t => (
                          <option key={t.lib_id} value={t.lib_desc}>{t.lib_desc}</option>
                        ))}
                      </select>
                    ) : (
                      <Input 
                        value={selectedItem.inspection_type_code} 
                        readOnly 
                        className="bg-background border-border h-9"
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground font-semibold">Priority *</Label>
                    {viewMode === "anomalies" ? (
                      <select
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs font-semibold focus-visible:ring-red-500"
                      >
                        <option value="">Select Priority</option>
                        {priorities.map(p => (
                          <option key={p.lib_id} value={p.lib_desc}>{p.lib_desc}</option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs font-semibold focus-visible:ring-blue-500"
                      >
                        <option value="">Select Priority</option>
                        {priorities.map(p => (
                          <option key={p.lib_id} value={p.lib_desc}>{p.lib_desc}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground font-semibold">Reference No</Label>
                    <Input 
                      value={viewMode === "anomalies" ? selectedItem.anomaly_ref_no : `INSP-${selectedItem.insp_id}`} 
                      readOnly 
                      className="bg-background border-border h-9"
                    />
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button 
                      size="sm"
                      onClick={handleSaveChanges}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs h-8"
                    >
                      <Save className="h-3.5 w-3.5 mr-1" />
                      Save Changes
                    </Button>
                  </div>
                </div>

              </div>

              {(() => {
                const typeCode = viewMode === "anomalies" ? selectedItem.inspection?.inspection_type_code : selectedItem.inspection_type_code;
                const typeInfo = inspectionTypeMap[typeCode];
                const boxTitle = typeInfo 
                  ? `${typeInfo.name}${typeInfo.mode ? ` (${typeInfo.mode})` : ''}` 
                  : (typeCode || "Inspection Details");
                  
                const jpId = viewMode === "anomalies" ? selectedItem.inspection?.jobpack_id : selectedItem.jobpack_id;
                const jobpack = jobpacks.find(jp => String(jp.id) === String(jpId));
                
                const sowNo = viewMode === "anomalies" ? selectedItem.inspection?.sow_report_no : selectedItem.sow_report_no;
                
                const inspData = viewMode === "anomalies" ? selectedItem.inspection?.inspection_data : selectedItem.inspection_data;
                
                                const diveNo = viewMode === "anomalies" 
                  ? (selectedItem.inspection?.insp_dive_jobs?.job_no || selectedItem.inspection?.insp_rov_jobs?.job_no || "N/A")
                  : (selectedItem.insp_dive_jobs?.job_no || selectedItem.insp_rov_jobs?.job_no || "N/A");
                const tapeNo = viewMode === "anomalies"
                  ? (selectedItem.inspection?.insp_video_tapes?.tape_no || "N/A")
                  : (selectedItem.insp_video_tapes?.tape_no || "N/A");
                const tapeCounter = viewMode === "anomalies"
                  ? (selectedItem.inspection?.tape_count_no || "N/A")
                  : (selectedItem.tape_count_no || "N/A");
                const qid = viewMode === "anomalies"
                  ? (selectedItem.inspection?.structure_components?.q_id || "N/A")
                  : (selectedItem.structure_components?.q_id || "N/A");
                const findings = viewMode === "anomalies" ? selectedItem.defect_description : (selectedItem.description || selectedItem.observation);

                return (
                  <div className="p-4 rounded-md border border-border bg-muted/10 space-y-3 mt-4">
                    <div className="text-sm font-bold uppercase tracking-wider text-primary border-b border-border pb-1">
                      {boxTitle}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="flex justify-between border-b border-border/50 pb-1">
                        <span className="text-muted-foreground font-medium">Jobpack:</span>
                        <span className="text-foreground font-semibold truncate max-w-[150px]">{jobpack?.name || "N/A"}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/50 pb-1">
                        <span className="text-muted-foreground font-medium">SOW Report No:</span>
                        <span className="text-foreground font-semibold">{sowNo || "N/A"}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/50 pb-1">
                        <span className="text-muted-foreground font-medium">Component QID:</span>
                        <span className="text-foreground font-semibold">{qid}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/50 pb-1">
                        <span className="text-muted-foreground font-medium">Dive No:</span>
                        <span className="text-foreground font-semibold">{diveNo}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/50 pb-1">
                        <span className="text-muted-foreground font-medium">Tape No:</span>
                        <span className="text-foreground font-semibold">{tapeNo}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/50 pb-1">
                        <span className="text-muted-foreground font-medium">Tape Counter:</span>
                        <span className="text-foreground font-semibold">{tapeCounter}</span>
                      </div>
                    </div>
                    <div className="pt-2 text-sm">
                      <span className="text-muted-foreground font-medium block pb-1">Inspection Findings:</span>
                      <div className="p-2 bg-background border border-border rounded-md text-foreground italic">
                        "{findings}"
                      </div>
                    </div>
                  </div>
                );
              })()}

              {(selectedItem.status === 'CLOSED' || selectedItem.status === 'COMPLETED') && (
                <div className="p-4 rounded-md bg-emerald-500/10 border border-emerald-500/30 space-y-3 mt-4">
                  <div className="text-sm font-bold uppercase tracking-wider text-emerald-600 border-b border-emerald-500/20 pb-1 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" /> Rectification Details
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="flex justify-between border-b border-border/50 pb-1">
                      <span className="text-muted-foreground font-medium">Rectified Date:</span>
                      <span className="text-foreground font-semibold">
                        {viewMode === "anomalies" 
                          ? (selectedItem.rectified_date ? new Date(selectedItem.rectified_date).toLocaleDateString() : "N/A")
                          : (selectedItem.approved_date ? new Date(selectedItem.approved_date).toLocaleDateString() : "N/A")}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/50 pb-1">
                      <span className="text-muted-foreground font-medium">Evaluated By:</span>
                      <span className="text-foreground font-semibold">
                        {selectedItem.reviewed_by || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/50 pb-1 md:col-span-2">
                      <span className="text-muted-foreground font-medium">Approved By:</span>
                      <span className="text-foreground font-semibold">
                        {selectedItem.approved_by || "N/A"}
                      </span>
                    </div>
                  </div>
                  {viewMode === "anomalies" && selectedItem.follow_up_notes && (
                    <div className="pt-2 text-sm">
                      <span className="text-muted-foreground font-medium block pb-1">Resolution Notes:</span>
                      <div className="p-2 bg-background border border-border rounded-md text-foreground italic">
                        "{selectedItem.follow_up_notes}"
                      </div>
                    </div>
                  )}
                  {viewMode === "findings" && selectedItem.description && (
                    <div className="pt-2 text-sm">
                      <span className="text-muted-foreground font-medium block pb-1">Resolution Notes:</span>
                      <div className="p-2 bg-background border border-border rounded-md text-foreground italic">
                        "{selectedItem.description}"
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end pt-2">
                    <Button 
                      size="sm"
                      variant="outline"
                      onClick={handleRollbackRectify}
                      disabled={isRectifying}
                      className="border-destructive/30 hover:bg-destructive/10 text-destructive font-semibold text-xs h-8"
                    >
                      {isRectifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
                      Rollback Rectification
                    </Button>
                  </div>
                </div>
              )}

              {selectedItem.status !== 'CLOSED' && selectedItem.status !== 'COMPLETED' && (
                <div className="p-4 rounded-md bg-muted/20 border border-border space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Action: Rectify</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rect-date">Rectified Date</Label>
                      <Input 
                        id="rect-date" 
                        type="date"
                        value={rectifiedDate}
                        onChange={(e) => setRectifiedDate(e.target.value)}
                        className="bg-background border-border text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="eval-by">Evaluated By</Label>
                      <Input 
                        id="eval-by" 
                        placeholder="Name of evaluator..." 
                        value={evaluatedBy}
                        onChange={(e) => setEvaluatedBy(e.target.value)}
                        className="bg-background border-border text-xs"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="app-by">Approved By</Label>
                      <Input 
                        id="app-by" 
                        placeholder="Name of approver..." 
                        value={approvedBy}
                        onChange={(e) => setApprovedBy(e.target.value)}
                        className="bg-background border-border text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rect-notes">Notes / Resolution</Label>
                    <Input 
                      id="rect-notes" 
                      placeholder="Enter rectification details..." 
                      value={rectificationNotes}
                      onChange={(e) => setRectificationNotes(e.target.value)}
                      className="bg-background border-border text-xs"
                    />
                  </div>
                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    onClick={handleRectify}
                    disabled={isRectifying}
                  >
                    {isRectifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                    Mark as Rectified ({viewMode === "anomalies" ? "CLOSED" : "COMPLETED"})
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
                  <Paperclip className="h-4 w-4" /> Attachments
                </h3>
                <AttachmentSection 
                  sourceId={viewMode === "anomalies" ? selectedItem.anomaly_id : selectedItem.insp_id} 
                  sourceType={viewMode === "anomalies" ? "anomaly" : "inspection"} 
                  inspectionId={viewMode === "anomalies" ? (selectedItem.inspection?.insp_id || selectedItem.insp_id) : selectedItem.insp_id}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Component Spec Dialog */}
      <ComponentSpecDialog 
        open={isSpecOpen}
        onOpenChange={setIsSpecOpen}
        component={selectedCompForSpec as any}
        mode="view"
      />

    </div>
  );
}
