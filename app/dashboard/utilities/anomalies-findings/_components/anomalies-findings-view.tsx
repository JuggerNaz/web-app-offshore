"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";

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
  ArrowDown
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
  const [isRectifying, setIsRectifying] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [platformsRes, pipelinesRes, jobpacksRes, componentsRes, anomaliesRes, findingsRes] = await Promise.all([
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
              inspection_type_code,
              inspection_date,
              inspection_data,
              has_anomaly
            )
          `),
          supabase.from("insp_records").select("*")
        ]);

        const combinedStructures = [
          ...(platformsRes.data || []).map(p => ({ id: p.plat_id, title: p.title, type: "platform" })),
          ...(pipelinesRes.data || []).map(p => ({ id: p.pipe_id, title: p.title, type: "pipeline" }))
        ];
        
        setStructures(combinedStructures);
        setJobpacks(jobpacksRes.data || []);
        
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
        valA = viewMode === "anomalies" ? a.defect_type_code : a.inspection_type_code;
        valB = viewMode === "anomalies" ? b.defect_type_code : b.inspection_type_code;
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
        if (!currentRef.endsWith("R")) {
          currentRef = `${currentRef}R`;
        }

        const { error } = await supabase
          .from("insp_anomalies")
          .update({ 
            status: "CLOSED", 
            anomaly_ref_no: currentRef,
            follow_up_notes: rectificationNotes 
          })
          .eq("anomaly_id", selectedItem.anomaly_id);

        if (error) throw error;
        
        toast.success("Anomaly Rectified & Closed");
        setAnomalies(prev => prev.map(a => 
          a.anomaly_id === selectedItem.anomaly_id 
            ? { ...a, status: "CLOSED", anomaly_ref_no: currentRef, follow_up_notes: rectificationNotes } 
            : a
        ));
      } else {
        const { error } = await supabase
          .from("insp_records")
          .update({ 
            status: "COMPLETED",
            description: rectificationNotes || selectedItem.description 
          })
          .eq("insp_id", selectedItem.insp_id);

        if (error) throw error;
        
        toast.success("Finding Rectified & Completed");
        setFindings(prev => prev.map(f => 
          f.insp_id === selectedItem.insp_id 
            ? { ...f, status: "COMPLETED", description: rectificationNotes || f.description } 
            : f
        ));
      }
      
      setIsDetailOpen(false);
      setRectificationNotes("");
    } catch (error) {
      console.error("Rectification error:", error);
      toast.error("Failed to rectify item");
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
                          const desc = viewMode === "anomalies" ? item.defect_description : (item.description || item.observation);

                          return (
                            <Card 
                              key={viewMode === "anomalies" ? item.anomaly_id : item.insp_id} 
                              className="bg-card border-border hover:border-primary/30 transition-all cursor-pointer shadow-sm hover:shadow-md"
                              onDoubleClick={() => {
                                setSelectedItem(item);
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
                                  {viewMode === "anomalies" ? item.defect_type_code : item.inspection_type_code}
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
                                    {comp?.q_id || "N/A"}
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
                              {renderSortHeader("Description", "description")}
                              {renderSortHeader("QID", "qid")}
                              {viewMode === "anomalies" && renderSortHeader("Status", "status")}
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map((item: any) => {
                              const compId = viewMode === "anomalies" ? item.inspection?.component_id : item.component_id;
                              const comp = components[compId];
                              const refNo = viewMode === "anomalies" ? item.anomaly_ref_no : `INSP-${item.insp_id}`;
                              const desc = viewMode === "anomalies" ? item.defect_description : (item.description || item.observation);

                              return (
                                <tr 
                                  key={viewMode === "anomalies" ? item.anomaly_id : item.insp_id}
                                  onDoubleClick={() => {
                                    setSelectedItem(item);
                                    setIsDetailOpen(true);
                                  }}
                                  className="border-b border-border hover:bg-muted/50 cursor-pointer transition-colors"
                                >
                                  <td className="px-4 py-3 font-mono text-foreground font-medium">{refNo}</td>
                                  <td className="px-4 py-3 text-foreground">
                                    {viewMode === "anomalies" ? item.defect_type_code : item.inspection_type_code}
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
                                      {comp?.q_id || "N/A"}
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
              Item Details
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
                    <Input 
                      value={viewMode === "anomalies" ? selectedItem.defect_type_code : selectedItem.inspection_type_code} 
                      readOnly 
                      className="bg-background border-border h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground font-semibold">Defect Type</Label>
                    <Input 
                      value={viewMode === "anomalies" ? (selectedItem.defect_category_code || "N/A") : selectedItem.inspection_type_code} 
                      readOnly 
                      className="bg-background border-border h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground font-semibold">Priority *</Label>
                    <Input 
                      value={viewMode === "anomalies" ? selectedItem.priority_code : (selectedItem.inspection_data?.priority || "N/A")} 
                      readOnly 
                      className="bg-background border-border h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground font-semibold">Reference No</Label>
                    <Input 
                      value={viewMode === "anomalies" ? selectedItem.anomaly_ref_no : `INSP-${selectedItem.insp_id}`} 
                      readOnly 
                      className="bg-background border-border h-9"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground font-semibold">Anomaly Description</Label>
                  <textarea 
                    value={viewMode === "anomalies" ? selectedItem.defect_description : (selectedItem.description || selectedItem.observation)} 
                    readOnly 
                    className="w-full min-h-[80px] p-2 bg-background border border-border rounded-md text-sm text-foreground resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground font-semibold">Recommended Action</Label>
                  <textarea 
                    value={viewMode === "anomalies" ? (selectedItem.recommended_action || "N/A") : (selectedItem.inspection_data?.recommended_action || "N/A")} 
                    readOnly 
                    className="w-full min-h-[80px] p-2 bg-background border border-border rounded-md text-sm text-foreground resize-none"
                  />
                </div>
              </div>

              {selectedItem.status !== 'CLOSED' && selectedItem.status !== 'COMPLETED' && (
                <div className="p-4 rounded-md bg-muted/20 border border-border space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Action: Rectify</h3>
                  <div className="space-y-2">
                    <Label htmlFor="rect-notes">Notes / Resolution</Label>
                    <Input 
                      id="rect-notes" 
                      placeholder="Enter rectification details..." 
                      value={rectificationNotes}
                      onChange={(e) => setRectificationNotes(e.target.value)}
                      className="bg-background border-border"
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
