"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronRight, ChevronDown, MoreVertical, Plus, Search, Filter, Archive, Hash, Calendar, Box, Activity, Trash2, ArrowDown, ArrowUp, ArrowUpDown, Link2, Paperclip, AlertCircle, ChevronsLeft, ChevronLeft, ChevronsRight } from "lucide-react";
import { DeleteConfirmDialog } from "../dialogs/delete-confirm-dialog";
import { cn } from "@/lib/utils";
import { ComponentSpecDialog } from "@/components/dialogs/component-spec-dialog";
import { ComponentEditDialog, EditableComponent } from "@/components/dialogs/component-edit-dialog";
import { InspectionSummaryModal } from "@/components/dialogs/inspection-summary-modal";
import { AnomalySummaryModal } from "@/components/dialogs/anomaly-summary-modal";
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/utils/utils";
import { toast } from "sonner";
import { AnomalyDetailDialog } from "@/components/dialogs/anomaly-detail-dialog";

type Component = {
  id: number;
  comp_id: number;
  structure_id: number;
  q_id: string;
  id_no: string;
  code: string | null;
  metadata: any;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  modified_by: string | null;
  is_deleted?: boolean | null;
  has_attachment?: boolean;
  inspections?: any[];
  anomalies?: any[];
};

type ComponentType = {
  id: number;
  name: string | null;
  code: string | null;
  descrip: string | null;
  is_active: boolean;
  plat: number | null;
  pipe: number | null;
};

export default function ComponentContent() {
  const [structureId] = useAtom(urlId);
  const [pageType] = useAtom(urlType);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("ALL COMPONENTS");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [isListOpen, setIsListOpen] = useState(true);
  const [viewArchived, setViewArchived] = useState(false);
  const [viewFilter, setViewFilter] = useState("default"); // default, show_all, findings, anomaly
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'view' | 'create'>('view');
  const [componentTypes, setComponentTypes] = useState<ComponentType[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<EditableComponent | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Modal states for Inspections and Anomalies
  const [inspectionModalOpen, setInspectionModalOpen] = useState(false);
  const [selectedInspections, setSelectedInspections] = useState<any[]>([]);
  
  const [anomalyModalOpen, setAnomalyModalOpen] = useState(false);
  const [selectedAnomalies, setSelectedAnomalies] = useState<any[]>([]);
  const [anomalyDetailOpen, setAnomalyDetailOpen] = useState(false);
  const [selectedAnomalyForDetail, setSelectedAnomalyForDetail] = useState<any>(null);

  const getHighestPriorityAnomalyColor = (anomalies: any[]) => {
    if (!anomalies || anomalies.length === 0) return null;
    const hasP1 = anomalies.some(a => ["1", "P1", "HIGH", "CRITICAL"].includes((a.priority_code || a.priority || "").toUpperCase()));
    if (hasP1) return "text-red-500 bg-red-500/10 hover:bg-red-500/20";
    
    const hasP2 = anomalies.some(a => ["2", "P2", "MEDIUM", "PRIORITY 2"].includes((a.priority_code || a.priority || "").toUpperCase()));
    if (hasP2) return "text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20";
    
    const hasP3 = anomalies.some(a => ["3", "P3", "LOW", "PRIORITY 3"].includes((a.priority_code || a.priority || "").toUpperCase()));
    if (hasP3) return "text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20";

    const hasObs = anomalies.some(a => ["OBS", "OBSERVATION", "O"].includes((a.priority_code || a.priority || "").toUpperCase()));
    if (hasObs) return "text-orange-500 bg-orange-500/10 hover:bg-orange-500/20";

    return "text-slate-500 bg-slate-500/10 hover:bg-slate-500/20";
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      setSortConfig(null);
      return;
    }
    setSortConfig({ key, direction });
  };

  // Fetch component types
  useEffect(() => {
    const fetchComponentTypes = async () => {
      try {
        const response = await fetch("/api/components");
        if (!response.ok) {
          throw new Error("Failed to fetch component types");
        }
        const result = await response.json();
        setComponentTypes(result.data || []);
      } catch (error) {
        console.error("Error fetching component types:", error);
      } finally {
        setIsLoadingTypes(false);
      }
    };

    fetchComponentTypes();
  }, []);

  // Fetch structure components based on structure_id and selected code
  const apiUrl = structureId
    ? (() => {
      const params = new URLSearchParams();
      if (selectedCode) params.set("code", selectedCode);
      if (viewArchived) params.set("archived", "true");
      if (viewFilter !== "default") params.set("view_filter", viewFilter);
      const query = params.toString();
      return `/api/structure-components/${structureId}${query ? `?${query}` : ""}`;
    })()
    : null;

  const {
    data: componentsData,
    error: componentsError,
    isLoading: isLoadingComponents,
  } = useSWR(apiUrl, fetcher);

  const components = componentsData?.data || [];

  // Full unfiltered component list for resolving associated Q IDs
  const { data: allComponentsData } = useSWR(
    structureId ? `/api/structure-components/${structureId}` : null,
    fetcher
  );
  const allComponentsLookup: Component[] = allComponentsData?.data || [];

  const getLinkedQId = (associated_comp_id: number | null | undefined): string | null => {
    if (!associated_comp_id) return null;
    return allComponentsLookup.find((c) => c.id === associated_comp_id)?.q_id || null;
  };

  // Filter components by search query and type relevancy
  const filteredComponents = components.filter((comp: Component) => {
    const matchesSearch = comp.q_id.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Filter based on component type's pipe/plat if we have the types loaded
    if (componentTypes.length > 0 && (pageType === 'pipeline' || pageType === 'platform')) {
      const typeDef = componentTypes.find((t) => t.code === comp.code);
      if (typeDef) {
        if (pageType === 'pipeline' && typeDef.pipe !== 1) return false;
        if (pageType === 'platform' && typeDef.plat !== 1) return false;
      }
    }
    
    return matchesSearch;
  });

  const sortedComponents = [...filteredComponents].sort((a, b) => {
    if (!sortConfig) return 0;
    
    let valA: any = null;
    let valB: any = null;
    
    switch (sortConfig.key) {
      case 'id_no':
        valA = a.id_no || '';
        valB = b.id_no || '';
        break;
      case 'q_id':
        valA = a.q_id || '';
        valB = b.q_id || '';
        break;
      case 'code':
        valA = a.code || '';
        valB = b.code || '';
        break;
      case 'kp_node':
        valA = pageType === "pipeline" ? (a.code?.toLowerCase() === "pp" ? Number(a.metadata?.start_kp || 0) : Number(a.metadata?.kp || 0)) : (a.metadata?.s_node || '');
        valB = pageType === "pipeline" ? (b.code?.toLowerCase() === "pp" ? Number(b.metadata?.start_kp || 0) : Number(b.metadata?.kp || 0)) : (b.metadata?.s_node || '');
        break;
      case 'depth_leg':
        valA = pageType === "pipeline" ? (a.metadata?.depth || 0) : (a.metadata?.s_leg || '');
        valB = pageType === "pipeline" ? (b.metadata?.depth || 0) : (b.metadata?.s_leg || '');
        break;
      case 'easting_elv':
        valA = pageType === "pipeline" ? (a.metadata?.easting || 0) : (a.metadata?.elv_1 || 0);
        valB = pageType === "pipeline" ? (b.metadata?.easting || 0) : (b.metadata?.elv_1 || 0);
        break;
      case 'created_at':
        valA = a.created_at || '';
        valB = b.created_at || '';
        break;
    }
    
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedComponents.length / pageSize);
  const paginatedComponents = sortedComponents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, viewFilter, selectedCode, pageSize]);

  const getComponentName = (code: string | null) => {
    if (!code) return null;
    const type = componentTypes.find((t) => t.code === code);
    return type?.name || code;
  };

  const handleRowClick = (component: Component) => {
    setSelectedComponent(component);
    setDialogMode('view');
    setDialogOpen(true);
  };

  const handleAddNewComponent = () => {
    setSelectedComponent(null);
    setDialogMode('create');
    setDialogOpen(true);
  };

  const handleEditComponent = (component: Component) => {
    setEditingComponent(component as EditableComponent);
    setEditDialogOpen(true);
  };

  const handleDuplicateComponent = async (comp: Component) => {
    try {
      const duplicateData = {
        id_no: `${comp.id_no} (Copy)`,
        q_id: `${comp.q_id} (Copy)`,
        comp_id: 0,
        structure_id: comp.structure_id,
        code: comp.code,
        metadata: comp.metadata,
      };

      await fetcher(`/api/structure-components/${comp.structure_id}`, {
        method: "POST",
        body: JSON.stringify(duplicateData),
      });

      if (apiUrl) mutate(apiUrl);
      setCurrentPage(1);
      toast.success("Component duplicated successfully");
    } catch (error) {
      console.error("Duplicate failed", error);
      toast.error("Failed to duplicate component");
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteId) return;
    try {
      setDeleteLoading(true);
      await fetcher(`/api/structure-components/item/${deleteId}`, {
        method: "DELETE",
      });
      if (apiUrl) mutate(apiUrl);
      setDeleteId(null);
    } catch (error) {
      console.error("Delete failed", error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDialogOpenChange = (isOpen: boolean) => {
    setDialogOpen(isOpen);
    if (!isOpen) {
      setDialogMode('view');
      setSelectedComponent(null);
    }
  };

  const handleTypeClick = (typeName: string | null, typeCode: string | null) => {
    setViewArchived(false);
    setViewFilter("default");
    setSelectedType(typeName || "ALL COMPONENTS");
    setSelectedCode(typeCode);
    setCurrentPage(1);
  };

  return (
    <div className="flex w-full gap-8 min-h-[70vh]">
      {/* Left Sidebar - Component Types List */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-6 sticky top-0 self-start">
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 flex flex-col gap-6 h-full shadow-sm">
          <div className="space-y-4">
            <h3 className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Component Sections</h3>
            <div className="flex flex-col gap-1">
              <FilterButton
                active={!viewArchived && selectedType === "ALL COMPONENTS"}
                onClick={() => handleTypeClick("ALL COMPONENTS", null)}
                icon={<Box className="h-4 w-4" />}
                label="All Components"
              />
              <FilterButton
                active={viewArchived}
                onClick={() => {
                  setViewArchived(true);
                  setSelectedType("ARCHIVED");
                  setSelectedCode(null);
                }}
                icon={<Archive className="h-4 w-4" />}
                label="Archived Items"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Component Categories</h3>
            <div className="flex flex-col gap-1 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {isLoadingTypes ? (
                <div className="px-2 py-4 space-y-3">
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-full" />)}
                </div>
              ) : (
                componentTypes
                  .filter((type) => {
                    if (pageType === 'pipeline') return type.pipe === 1;
                    if (pageType === 'platform') return type.plat === 1;
                    return true;
                  })
                  .map((type) => (
                    <button
                      key={type.id}
                      onClick={() => handleTypeClick(type.name, type.code)}
                      className={cn(
                        "flex items-center gap-3 w-full text-left text-xs font-bold py-2.5 px-3 rounded-xl transition-all",
                        selectedType === type.name && !viewArchived
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                          : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      <div className={cn(
                        "h-2 w-2 rounded-full",
                        selectedType === type.name && !viewArchived ? "bg-white" : "bg-slate-300 dark:bg-slate-700"
                      )} />
                      <span className="truncate">{type.name}</span>
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-80 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <Input
                placeholder="Search by Q ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 pl-10 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-blue-500/20 shadow-sm"
              />
            </div>
            <div className="flex items-center gap-4 px-2">
              <div className="flex items-center gap-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap">Filter</Label>
                <Select value={viewFilter} onValueChange={(val) => {
                  setViewFilter(val);
                  if (val !== "default" && val !== "show_all") {
                    setViewArchived(false);
                  }
                  if (val === "show_all") {
                    setViewArchived(false);
                  }
                }}>
                  <SelectTrigger className="h-11 w-[160px] rounded-xl border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 font-bold text-xs">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-800 bg-slate-950">
                    <SelectItem value="default" className="text-xs font-bold py-2.5">Default</SelectItem>
                    <SelectItem value="show_all" className="text-xs font-bold py-2.5">Show All</SelectItem>
                    <SelectItem value="findings" className="text-xs font-bold py-2.5">Findings</SelectItem>
                    <SelectItem value="anomaly" className="text-xs font-bold py-2.5">Anomaly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleAddNewComponent}
                className="h-11 px-6 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-lg hover:opacity-90 transition-all gap-2"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Component</span>
              </Button>
            </div>
          </div>
          <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800/50 rounded-full">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {sortedComponents.length} Records
            </span>
          </div>
        </div>

        {/* Data Table Container */}
        <div className="bg-white dark:bg-slate-900/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/20 overflow-hidden relative">
          <div className="overflow-auto h-[60vh] custom-scrollbar relative">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shadow-sm">
                  <TableTh className="w-[200px]" onClick={() => handleSort('id_no')} sortDirection={sortConfig?.key === 'id_no' ? sortConfig.direction : null}>{pageType === "pipeline" ? "ID No" : "System ID No"}</TableTh>
                  <TableTh className="w-[140px]" onClick={() => handleSort('q_id')} sortDirection={sortConfig?.key === 'q_id' ? sortConfig.direction : null}>Q ID</TableTh>
                  <TableTh className="w-[100px]" onClick={() => handleSort('code')} sortDirection={sortConfig?.key === 'code' ? sortConfig.direction : null}>Type</TableTh>
                  <TableTh className="w-[180px]" onClick={() => handleSort('kp_node')} sortDirection={sortConfig?.key === 'kp_node' ? sortConfig.direction : null}>{pageType === "pipeline" ? "KP" : "start node / end node"}</TableTh>
                  <TableTh className="w-[160px]" onClick={() => handleSort('depth_leg')} sortDirection={sortConfig?.key === 'depth_leg' ? sortConfig.direction : null}>{pageType === "pipeline" ? "Depth" : "start leg / end leg"}</TableTh>
                  <TableTh className="w-[160px]" onClick={() => handleSort('easting_elv')} sortDirection={sortConfig?.key === 'easting_elv' ? sortConfig.direction : null}>{pageType === "pipeline" ? "Easting Northing" : "elevation (s/e)"}</TableTh>
                  <TableTh className="w-[80px] text-center">Actions</TableTh>
                </tr>
              </thead>
              <tbody>
                {isLoadingComponents ? (
                  <tr className="animate-pulse">
                    <td colSpan={7} className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest">Initialising Database...</td>
                  </tr>
                ) : paginatedComponents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-20 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Activity className="h-8 w-8 text-slate-200 mb-2" />
                        <p className="font-black text-slate-400 uppercase tracking-widest text-xs">No Records Found</p>
                        <p className="text-slate-400 text-sm">Try adjusting your filters or search query.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedComponents.map((comp: Component) => (
                    <tr
                      key={comp.id}
                      className={cn(
                        "group border-b border-slate-50 dark:border-slate-800 transition-all cursor-pointer",
                        comp.is_deleted
                          ? "bg-red-50/60 hover:bg-red-100/60 dark:bg-rose-950/20 dark:hover:bg-rose-950/30"
                          : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                      )}
                      onClick={() => handleRowClick(comp)}
                    >
                      <td className="px-4 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          {comp.has_attachment ? (
                            <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500 transition-colors" title="Has Attachments">
                              <Paperclip className="h-4 w-4" />
                            </div>
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-500 transition-colors">
                              <Hash className="h-4 w-4" />
                            </div>
                          )}
                          <span className="font-mono text-[11px] font-bold text-slate-500 leading-tight">{comp.id_no}</span>
                          
                          {/* Inspection & Anomaly Icons */}
                          <div className="flex gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                if (comp.inspections && comp.inspections.length > 0) {
                                  setSelectedInspections(comp.inspections || []);
                                  setInspectionModalOpen(true);
                                }
                              }}
                              disabled={!comp.inspections || comp.inspections.length === 0}
                              className={cn(
                                "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
                                comp.inspections && comp.inspections.length > 0
                                  ? "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 cursor-pointer"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                              )}
                              title={comp.inspections && comp.inspections.length > 0 ? "View Inspection Data" : "No Inspection Data"}
                            >
                              <Activity className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (comp.anomalies && comp.anomalies.length > 0) {
                                  setSelectedAnomalies(comp.anomalies || []);
                                  setAnomalyModalOpen(true);
                                }
                              }}
                              disabled={!comp.anomalies || comp.anomalies.length === 0}
                              className={cn(
                                "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
                                comp.anomalies && comp.anomalies.length > 0
                                  ? cn(getHighestPriorityAnomalyColor(comp.anomalies), "cursor-pointer")
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                              )}
                              title={comp.anomalies && comp.anomalies.length > 0 ? "View Anomalies" : "No Anomalies"}
                            >
                              <AlertCircle className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <div className="flex flex-col gap-1.5">
                          <span className="font-black text-slate-900 dark:text-white tracking-tight">{comp.q_id}</span>
                          {comp.metadata?.associated_comp_id && (() => {
                            const linkedQId = getLinkedQId(comp.metadata.associated_comp_id);
                            return (
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-200/70 dark:border-teal-700/50 w-fit">
                                <Link2 className="h-3.5 w-3.5 shrink-0" />
                                {linkedQId || "Linked"}
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                          {comp.code || "---"}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-middle text-slate-500 font-medium">
                        {pageType === "pipeline" ? (
                          <div className="flex items-center gap-2">
                             <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded text-[11px] font-bold">
                               {comp.code?.toLowerCase() === "pp" ? (
                                 `${comp.metadata?.start_kp ?? 0} - ${comp.metadata?.end_kp ?? 0} ${comp.metadata?.start_kp_unit || comp.metadata?.end_kp_unit || comp.metadata?.kp_unit || "km"}`
                               ) : (
                                 `${comp.metadata?.kp || "-"} ${comp.metadata?.kp_unit || "km"}`
                               )}
                             </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span>{comp.metadata?.s_node || "-"}</span>
                            <ChevronRight className="h-3 w-3 text-slate-300" />
                            <span>{comp.metadata?.f_node || "-"}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 align-middle text-slate-500 font-medium whitespace-nowrap">
                        {pageType === "pipeline" ? (
                           <div className="flex items-center gap-2">
                             <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] font-bold">
                               {comp.metadata?.depth || "-"} {comp.metadata?.depth_unit || "m"}
                             </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] font-bold">{comp.metadata?.s_leg || "-"}</span>
                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] font-bold">{comp.metadata?.f_leg || "-"}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 align-middle text-slate-500 font-medium">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            {pageType === "pipeline" && <span className="text-[10px] text-slate-400 uppercase font-bold">Easting</span>}
                            <span className="text-slate-900 dark:text-white font-black">
                              {pageType === "pipeline" ? (comp.metadata?.easting || "0") : (comp.metadata?.elv_1 || "0")}
                            </span>
                          </div>
                          <div className="h-6 w-px bg-slate-100 dark:bg-slate-800" />
                          <div className="flex flex-col">
                            {pageType === "pipeline" && <span className="text-[10px] text-slate-400 uppercase font-bold">Northing</span>}
                            <span className="text-slate-900 dark:text-white font-black">
                              {pageType === "pipeline" ? (comp.metadata?.northing || "0") : (comp.metadata?.elv_2 || "0")}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4 text-slate-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[180px] rounded-[1.2rem] p-2 shadow-2xl">
                            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-2">Management</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="rounded-lg py-2.5 font-bold cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditComponent(comp);
                              }}
                            >
                              Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="rounded-lg py-2.5 font-bold cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateComponent(comp);
                              }}
                            >
                              Duplicate Data
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className={cn(
                                "rounded-lg py-2.5 font-bold cursor-pointer transition-colors",
                                comp.is_deleted ? "text-blue-600 focus:text-blue-600" : "text-red-500 focus:text-red-500"
                              )}
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await fetcher(`/api/structure-components/item/${comp.id}`, {
                                    method: "PATCH",
                                    body: JSON.stringify({ is_deleted: !comp.is_deleted }),
                                  });
                                  if (apiUrl) mutate(apiUrl);
                                } catch (error) {
                                  console.error("Action failed", error);
                                }
                              }}
                            >
                              {comp.is_deleted ? "Unarchive Record" : "Archive Record"}
                            </DropdownMenuItem>
                            {comp.is_deleted && (
                              <DropdownMenuItem
                                className="rounded-lg py-2.5 font-bold cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteId(comp.id);
                                }}
                              >
                                Permanent Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer - Matches reference image style */}
          <div className="px-8 py-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-6">
            {/* Left: Showing info */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Showing <span className="text-blue-500">{paginatedComponents.length}</span> of <span className="text-white">{sortedComponents.length}</span> Records
              </span>
            </div>

            {/* Middle: Rows per page */}
            <div className="flex items-center gap-4">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Rows per page</Label>
              <Select value={pageSize.toString()} onValueChange={(val) => {
                setPageSize(Number(val));
                setCurrentPage(1);
              }}>
                <SelectTrigger className="h-10 w-20 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-black text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-800 bg-slate-950">
                  {[10, 20, 50, 100].map(size => (
                    <SelectItem key={size} value={size.toString()} className="text-xs font-black py-2">
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Right: Page Navigation */}
            <div className="flex items-center gap-6">
              <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Page <span className="text-white">{currentPage}</span> / <span className="text-slate-400">{totalPages || 1}</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <PaginationButton 
                  onClick={() => setCurrentPage(1)} 
                  disabled={currentPage === 1}
                  icon={<ChevronsLeft className="h-4 w-4" />}
                />
                <PaginationButton 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                  disabled={currentPage === 1}
                  icon={<ChevronLeft className="h-4 w-4" />}
                />
                <PaginationButton 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                  disabled={currentPage === totalPages || totalPages === 0}
                  icon={<ChevronRight className="h-4 w-4" />}
                />
                <PaginationButton 
                  onClick={() => setCurrentPage(totalPages)} 
                  disabled={currentPage === totalPages || totalPages === 0}
                  icon={<ChevronsRight className="h-4 w-4" />}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {dialogOpen && (
        <ComponentSpecDialog
          component={selectedComponent}
          open={dialogOpen}
          onOpenChange={handleDialogOpenChange}
          mode={dialogMode}
          defaultCode={selectedCode}
          typeName={dialogMode === 'view' ? (getComponentName(selectedComponent?.code || null) || "Component") : selectedType}
          listKey={apiUrl}
        />
      )}
      {editDialogOpen && (
        <ComponentEditDialog
          component={editingComponent}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          listKey={apiUrl}
          typeName={getComponentName(editingComponent?.code || null) || "Component"}
        />
      )}
      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDeleteItem}
        loading={deleteLoading}
        title="Delete Component"
        description="Are you sure you want to permanently delete this record? This action cannot be undone and will remove the component from the system."
      />
      
      <InspectionSummaryModal
        open={inspectionModalOpen}
        onOpenChange={setInspectionModalOpen}
        inspections={selectedInspections}
        structureId={structureId}
      />
      
      <AnomalySummaryModal
        open={anomalyModalOpen}
        onOpenChange={setAnomalyModalOpen}
        anomalies={selectedAnomalies}
        onAnomalyClick={(anomaly) => {
          setSelectedAnomalyForDetail(anomaly);
          setAnomalyDetailOpen(true);
        }}
      />

      <AnomalyDetailDialog
        open={anomalyDetailOpen}
        onOpenChange={setAnomalyDetailOpen}
        anomaly={selectedAnomalyForDetail}
        onSaveSuccess={() => {
          // Re-fetch component data to reflect changes
          mutate(`/api/structure-components/${structureId}?view_filter=${viewFilter}`);
          // Close summary modal if it was open (optional, but probably better to keep it open or update it)
          // setAnomalyModalOpen(false);
        }}
      />
    </div>
  );
}

function PaginationButton({ onClick, disabled, icon }: { onClick: () => void; disabled: boolean; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 transition-all",
        disabled 
          ? "opacity-30 cursor-not-allowed bg-transparent" 
          : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-blue-500/50 text-slate-600 dark:text-slate-400 hover:text-blue-500 shadow-sm"
      )}
    >
      {icon}
    </button>
  );
}

function FilterButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full text-left text-xs font-bold py-3 px-4 rounded-2xl transition-all",
        active
          ? "bg-slate-900 text-white shadow-xl dark:bg-white dark:text-slate-900 shadow-slate-200 dark:shadow-black/40"
          : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
      )}
    >
      <span className={cn("shrink-0", active ? "text-blue-500" : "text-slate-400")}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function TableTh({ children, className, onClick, sortDirection }: { children: React.ReactNode, className?: string, onClick?: () => void, sortDirection?: 'asc' | 'desc' | null }) {
  return (
    <th 
      className={cn(
        "h-14 px-4 text-left align-middle font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500",
        onClick && "cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors select-none",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        {children}
        {sortDirection !== undefined && (
          <span className="flex-shrink-0">
            {sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : sortDirection === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-50" />}
          </span>
        )}
      </div>
    </th>
  );
}
