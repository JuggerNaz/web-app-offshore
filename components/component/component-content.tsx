import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Plus,
  Search,
  Filter,
  Archive,
  Hash,
  Calendar,
  Box,
  Activity,
  Trash2,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Link2,
  Paperclip,
  AlertCircle,
  ChevronsLeft,
  ChevronLeft,
  ChevronsRight,
  ShieldAlert,
  AlertTriangle,
  SlidersHorizontal,
  X,
  RotateCcw,
  Check,
  Sparkles,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { DeleteConfirmDialog } from "../dialogs/delete-confirm-dialog";
import { cn } from "@/lib/utils";
import { ComponentSpecDialog } from "@/components/dialogs/component-spec-dialog";
import { ComponentEditDialog, EditableComponent } from "@/components/dialogs/component-edit-dialog";
import { InspectionSummaryModal } from "@/components/dialogs/inspection-summary-modal";
import { AnomalySummaryModal } from "@/components/dialogs/anomaly-summary-modal";
import { ComponentIntegrityModal, getMissingIntegrityFields } from "@/components/dialogs/component-integrity-modal";
import { AttachmentSummaryModal } from "@/components/dialogs/attachment-summary-modal";
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
import { useSearchParams } from "next/navigation";
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
  const [categorySearch, setCategorySearch] = useState("");
  const [isListOpen, setIsListOpen] = useState(true);
  const [viewArchived, setViewArchived] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
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
  const searchParams = useSearchParams();

  // Advanced Filters State
  const [advFilters, setAdvFilters] = useState({
    node: "",
    leg: "",
    minElv: "",
    maxElv: "",
    kpMin: "",
    kpMax: "",
    depthMin: "",
    depthMax: "",
    associationStatus: "all", // all, linked, unlinked, missing
    inspectionStatus: "all", // all, has_inspections, no_inspections
    anomalyStatus: "all", // all, has_anomalies, p1_critical, no_anomalies
    integrityStatus: "all", // all, incomplete, complete
    typeCode: "all", // all or specific code
  });

  // Modal states for Inspections, Anomalies, Attachments, and Component Integrity
  const [inspectionModalOpen, setInspectionModalOpen] = useState(false);
  const [selectedInspections, setSelectedInspections] = useState<any[]>([]);
  
  const [anomalyModalOpen, setAnomalyModalOpen] = useState(false);
  const [selectedAnomalies, setSelectedAnomalies] = useState<any[]>([]);
  const [anomalyDetailOpen, setAnomalyDetailOpen] = useState(false);
  const [selectedAnomalyForDetail, setSelectedAnomalyForDetail] = useState<any>(null);

  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [selectedComponentForAttachment, setSelectedComponentForAttachment] = useState<Component | null>(null);

  const [integrityModalOpen, setIntegrityModalOpen] = useState(false);

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

  // Fetch structure components based on structure_id, selected code, and archived preference
  const apiUrl = structureId
    ? (() => {
      const params = new URLSearchParams();
      if (selectedCode) params.set("code", selectedCode);
      if (viewArchived) {
        params.set("archived", "true");
      } else if (includeArchived || viewFilter === "show_all") {
        params.set("show_all", "true");
      }
      if (viewFilter !== "default" && viewFilter !== "show_all") {
        params.set("view_filter", viewFilter);
      }
      const query = params.toString();
      return `/api/structure-components/${structureId}${query ? `?${query}` : ""}`;
    })()
    : null;

  const {
    data: componentsData,
    error: componentsError,
    isLoading: isLoadingComponents,
    mutate: mutateComponents,
  } = useSWR(apiUrl, fetcher, { revalidateOnFocus: true, revalidateIfStale: true });

  const components = componentsData?.data || [];
  const processedCompIdRef = useRef<string | null>(null);

  // Auto-open component spec if compId is in URL
  useEffect(() => {
    const compId = searchParams.get("compId");
    if (compId && components.length > 0 && !selectedComponent && processedCompIdRef.current !== compId) {
      const comp = components.find((c: Component) => String(c.id) === compId);
      if (comp) {
        processedCompIdRef.current = compId;
        setSelectedComponent(comp);
        setDialogMode('view');
        setDialogOpen(true);
      }
    } else if (!compId) {
      processedCompIdRef.current = null;
    }
  }, [searchParams, components, selectedComponent]);

  // Full unfiltered component list for resolving associated Q IDs
  const { data: allComponentsData } = useSWR(
    structureId ? `/api/structure-components/${structureId}?show_all=true` : null,
    fetcher
  );
  const allComponentsLookup: Component[] = allComponentsData?.data || [];

  const getLinkedQId = (associated_comp_id: number | string | null | undefined): string | null => {
    if (!associated_comp_id) return null;
    const num = Number(associated_comp_id);
    const str = String(associated_comp_id);
    const match = allComponentsLookup.find(
      (c) =>
        (!isNaN(num) && c.id === num) ||
        (!isNaN(num) && (c as any).comp_id === num) ||
        String(c.id) === str ||
        c.q_id === str
    );
    return match?.q_id || null;
  };

  const incompleteComponentsCount = useMemo(() => {
    const isPipe = pageType === "pipeline";
    return components.filter((comp: Component) => getMissingIntegrityFields(comp, isPipe).length > 0).length;
  }, [components, pageType]);

  // Count active advanced filters
  const activeAdvFilterCount = useMemo(() => {
    let count = 0;
    if (advFilters.node.trim()) count++;
    if (advFilters.leg.trim()) count++;
    if (advFilters.minElv.trim()) count++;
    if (advFilters.maxElv.trim()) count++;
    if (advFilters.kpMin.trim()) count++;
    if (advFilters.kpMax.trim()) count++;
    if (advFilters.depthMin.trim()) count++;
    if (advFilters.depthMax.trim()) count++;
    if (advFilters.associationStatus !== "all") count++;
    if (advFilters.inspectionStatus !== "all") count++;
    if (advFilters.anomalyStatus !== "all") count++;
    if (advFilters.integrityStatus !== "all") count++;
    if (advFilters.typeCode !== "all") count++;
    return count;
  }, [advFilters]);

  const resetAllFilters = () => {
    setSearchQuery("");
    setAdvFilters({
      node: "",
      leg: "",
      minElv: "",
      maxElv: "",
      kpMin: "",
      kpMax: "",
      depthMin: "",
      depthMax: "",
      associationStatus: "all",
      inspectionStatus: "all",
      anomalyStatus: "all",
      integrityStatus: "all",
      typeCode: "all",
    });
    setIncludeArchived(false);
    setViewFilter("default");
  };

  // Smart Multi-Field Search & Advanced Filtering
  const filteredComponents = useMemo(() => {
    return components.filter((comp: Component) => {
      // 1. Text Search Query (Global Search across multiple fields)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const m = comp.metadata || {};
        const linkedQId = m.associated_comp_id ? (getLinkedQId(m.associated_comp_id) || "") : "";
        
        const searchableText = [
          comp.q_id,
          comp.id_no,
          comp.code,
          m.description,
          m.s_node,
          m.f_node,
          m.s_leg,
          m.f_leg,
          m.elv_1 !== undefined ? String(m.elv_1) : null,
          m.elv_2 !== undefined ? String(m.elv_2) : null,
          m.face,
          m.level,
          m.comp_group,
          m.kp !== undefined ? String(m.kp) : null,
          m.start_kp !== undefined ? String(m.start_kp) : null,
          m.end_kp !== undefined ? String(m.end_kp) : null,
          m.depth !== undefined ? String(m.depth) : null,
          m.easting !== undefined ? String(m.easting) : null,
          m.northing !== undefined ? String(m.northing) : null,
          linkedQId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(query)) {
          return false;
        }
      }

      // 2. Component Type / Code filter from advanced filters
      if (advFilters.typeCode !== "all" && comp.code !== advFilters.typeCode) {
        return false;
      }

      // 3. Node Filter
      if (advFilters.node.trim()) {
        const nQ = advFilters.node.trim().toLowerCase();
        const sNode = String(comp.metadata?.s_node || "").toLowerCase();
        const fNode = String(comp.metadata?.f_node || "").toLowerCase();
        if (!sNode.includes(nQ) && !fNode.includes(nQ)) {
          return false;
        }
      }

      // 4. Leg Filter
      if (advFilters.leg.trim()) {
        const lQ = advFilters.leg.trim().toLowerCase();
        const sLeg = String(comp.metadata?.s_leg || "").toLowerCase();
        const fLeg = String(comp.metadata?.f_leg || "").toLowerCase();
        if (!sLeg.includes(lQ) && !fLeg.includes(lQ)) {
          return false;
        }
      }

      // 5. Elevation Range Filter
      if (advFilters.minElv.trim()) {
        const min = Number(advFilters.minElv);
        const elv1 = comp.metadata?.elv_1 !== undefined && comp.metadata?.elv_1 !== null ? Number(comp.metadata.elv_1) : NaN;
        const elv2 = comp.metadata?.elv_2 !== undefined && comp.metadata?.elv_2 !== null ? Number(comp.metadata.elv_2) : NaN;
        if (!isNaN(min)) {
          const maxVal = Math.max(isNaN(elv1) ? -Infinity : elv1, isNaN(elv2) ? -Infinity : elv2);
          if (maxVal < min) return false;
        }
      }
      if (advFilters.maxElv.trim()) {
        const max = Number(advFilters.maxElv);
        const elv1 = comp.metadata?.elv_1 !== undefined && comp.metadata?.elv_1 !== null ? Number(comp.metadata.elv_1) : NaN;
        const elv2 = comp.metadata?.elv_2 !== undefined && comp.metadata?.elv_2 !== null ? Number(comp.metadata.elv_2) : NaN;
        if (!isNaN(max)) {
          const minVal = Math.min(isNaN(elv1) ? Infinity : elv1, isNaN(elv2) ? Infinity : elv2);
          if (minVal > max) return false;
        }
      }

      // 6. Pipeline KP Range
      if (advFilters.kpMin.trim()) {
        const kpMin = Number(advFilters.kpMin);
        const kp = Number(comp.metadata?.kp ?? comp.metadata?.start_kp ?? NaN);
        if (!isNaN(kpMin) && !isNaN(kp) && kp < kpMin) return false;
      }
      if (advFilters.kpMax.trim()) {
        const kpMax = Number(advFilters.kpMax);
        const kp = Number(comp.metadata?.kp ?? comp.metadata?.end_kp ?? NaN);
        if (!isNaN(kpMax) && !isNaN(kp) && kp > kpMax) return false;
      }

      // 7. Depth Range
      if (advFilters.depthMin.trim()) {
        const dMin = Number(advFilters.depthMin);
        const depth = Number(comp.metadata?.depth ?? NaN);
        if (!isNaN(dMin) && !isNaN(depth) && depth < dMin) return false;
      }
      if (advFilters.depthMax.trim()) {
        const dMax = Number(advFilters.depthMax);
        const depth = Number(comp.metadata?.depth ?? NaN);
        if (!isNaN(dMax) && !isNaN(depth) && depth > dMax) return false;
      }

      // 8. Association Status Filter
      if (advFilters.associationStatus !== "all") {
        const assocId = comp.metadata?.associated_comp_id;
        const linkedQId = assocId ? getLinkedQId(assocId) : null;
        if (advFilters.associationStatus === "linked") {
          if (!assocId || !linkedQId) return false;
        } else if (advFilters.associationStatus === "unlinked") {
          if (assocId) return false;
        } else if (advFilters.associationStatus === "missing") {
          if (!assocId || linkedQId) return false; // only show broken links
        }
      }

      // 9. Inspection Status Filter
      if (advFilters.inspectionStatus !== "all") {
        const hasInspections = Boolean(comp.inspections && comp.inspections.length > 0);
        if (advFilters.inspectionStatus === "has_inspections" && !hasInspections) return false;
        if (advFilters.inspectionStatus === "no_inspections" && hasInspections) return false;
      }

      // 10. Anomaly Status Filter
      if (advFilters.anomalyStatus !== "all") {
        const anomalies = comp.anomalies || [];
        const hasAnomalies = anomalies.length > 0;
        if (advFilters.anomalyStatus === "has_anomalies" && !hasAnomalies) return false;
        if (advFilters.anomalyStatus === "no_anomalies" && hasAnomalies) return false;
        if (advFilters.anomalyStatus === "p1_critical") {
          const hasP1 = anomalies.some(a => ["1", "P1", "HIGH", "CRITICAL"].includes((a.priority_code || a.priority || "").toUpperCase()));
          if (!hasP1) return false;
        }
      }

      // 11. Integrity Status Filter
      if (advFilters.integrityStatus !== "all") {
        const isPipe = pageType === "pipeline";
        const missingFields = getMissingIntegrityFields(comp, isPipe);
        if (advFilters.integrityStatus === "incomplete" && missingFields.length === 0) return false;
        if (advFilters.integrityStatus === "complete" && missingFields.length > 0) return false;
      }

      // 12. Plat / Pipe compatibility check
      if (componentTypes.length > 0 && (pageType === 'pipeline' || pageType === 'platform')) {
        const typeDef = componentTypes.find((t) => t.code === comp.code);
        if (typeDef) {
          if (pageType === 'pipeline' && typeDef.pipe !== 1) return false;
          if (pageType === 'platform' && typeDef.plat !== 1) return false;
        }
      }

      return true;
    });
  }, [components, searchQuery, advFilters, allComponentsLookup, componentTypes, pageType]);

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
  }, [searchQuery, viewFilter, selectedCode, pageSize, includeArchived, advFilters, viewArchived]);

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
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Component Sections</h3>
              {viewArchived && (
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
                  Archived Mode
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <FilterButton
                active={!viewArchived && selectedType === "ALL COMPONENTS"}
                onClick={() => {
                  setViewArchived(false);
                  setSelectedType("ALL COMPONENTS");
                  setSelectedCode(null);
                  setCurrentPage(1);
                }}
                icon={<Box className="h-4 w-4" />}
                label="All Components"
              />
              <FilterButton
                active={viewArchived && selectedType === "ARCHIVED"}
                onClick={() => {
                  setViewArchived(true);
                  setSelectedType("ARCHIVED");
                  setSelectedCode(null);
                  setCurrentPage(1);
                }}
                icon={<Archive className="h-4 w-4 text-rose-500" />}
                label="Archived Items (All)"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                {viewArchived ? "Archived Categories" : "Component Categories"}
              </h3>
              {selectedCode && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCode(null);
                    setSelectedType(viewArchived ? "ARCHIVED" : "ALL COMPONENTS");
                  }}
                  className="text-[10px] font-bold text-blue-500 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category Search Input */}
            <div className="relative group px-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                placeholder="Search type (e.g. AN, CL)..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="w-full h-8 pl-8 pr-7 text-xs font-medium bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
              />
              {categorySearch && (
                <button
                  type="button"
                  onClick={() => setCategorySearch("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Clear filter"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1 max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar">
              {isLoadingTypes ? (
                <div className="px-2 py-4 space-y-3">
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-full" />)}
                </div>
              ) : (() => {
                const filteredTypes = componentTypes
                  .filter((type) => {
                    if (pageType === 'pipeline') return type.pipe === 1;
                    if (pageType === 'platform') return type.plat === 1;
                    return true;
                  })
                  .filter((type) => {
                    if (!categorySearch.trim()) return true;
                    const q = categorySearch.trim().toLowerCase();
                    const nameMatch = (type.name || "").toLowerCase().includes(q);
                    const codeMatch = (type.code || "").toLowerCase().includes(q);
                    const descMatch = (type.descrip || "").toLowerCase().includes(q);
                    return nameMatch || codeMatch || descMatch;
                  });

                if (filteredTypes.length === 0) {
                  return (
                    <div className="px-3 py-6 text-center text-xs text-slate-400">
                      No types match "{categorySearch}"
                    </div>
                  );
                }

                return filteredTypes.map((type) => {
                  const isSelected = selectedCode === type.code;
                  return (
                    <button
                      key={type.id}
                      onClick={() => handleTypeClick(type.name, type.code)}
                      className={cn(
                        "flex items-center justify-between gap-3 w-full text-left text-xs font-bold py-2.5 px-3 rounded-xl transition-all",
                        isSelected
                          ? viewArchived
                            ? "bg-rose-600 text-white shadow-lg shadow-rose-500/20"
                            : "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                          : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          isSelected ? "bg-white" : "bg-slate-300 dark:bg-slate-700"
                        )} />
                        <span className="truncate">{type.name}</span>
                      </div>
                      <span className={cn(
                        "text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0",
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-slate-200/60 dark:bg-slate-800 text-slate-400"
                      )}>
                        {type.code}
                      </span>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-5 min-w-0">
        {/* Header & Controls */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left Controls: Global Search + Include Archived + Advanced Filter Toggle */}
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[300px]">
              {/* Smart Global Search Bar */}
              <div className="relative flex-1 min-w-[200px] max-w-md group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <Input
                  placeholder="Smart search (Q ID, System ID, node, leg, elv, desc)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 pl-10 pr-9 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-blue-500/20 shadow-sm text-xs font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Include Archived Checkbox Toggle (Visible when browsing categories or live mode) */}
              {!viewArchived && (
                <label
                  className={cn(
                    "flex items-center gap-2 px-3.5 h-11 rounded-xl border transition-all cursor-pointer select-none shrink-0 shadow-sm",
                    includeArchived
                      ? "bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-300"
                      : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
                  )}
                  title="Show both active and archived components across categories"
                >
                  <Checkbox
                    checked={includeArchived}
                    onCheckedChange={(checked) => setIncludeArchived(Boolean(checked))}
                    className="h-4 w-4 rounded-md border-slate-400 data-[state=checked]:bg-rose-600 data-[state=checked]:border-rose-600 data-[state=checked]:text-white"
                  />
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <Archive className={cn("h-3.5 w-3.5 shrink-0", includeArchived ? "text-rose-500" : "text-slate-400")} />
                    <span className="whitespace-nowrap">Include Archived</span>
                  </div>
                </label>
              )}

              {/* Advanced Filters Button */}
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={cn(
                  "h-11 px-3.5 rounded-xl text-xs font-bold gap-2 transition-all shadow-sm border shrink-0",
                  showAdvancedFilters || activeAdvFilterCount > 0
                    ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:text-white"
                    : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
                )}
              >
                <SlidersHorizontal className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Advanced Filters</span>
                {activeAdvFilterCount > 0 && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-black",
                    showAdvancedFilters || activeAdvFilterCount > 0 ? "bg-white text-blue-600" : "bg-blue-600 text-white"
                  )}>
                    {activeAdvFilterCount}
                  </span>
                )}
              </Button>
            </div>

            {/* Right Controls: Filter preset, Add button, Integrity audit, Records count */}
            <div className="flex items-center gap-3 shrink-0">
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
                  <SelectTrigger className="h-11 w-[140px] rounded-xl border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 font-bold text-xs">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-800 bg-slate-950">
                    <SelectItem value="default" className="text-xs font-bold py-2">Default</SelectItem>
                    <SelectItem value="show_all" className="text-xs font-bold py-2">Show All</SelectItem>
                    <SelectItem value="findings" className="text-xs font-bold py-2">Findings</SelectItem>
                    <SelectItem value="anomaly" className="text-xs font-bold py-2">Anomaly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleAddNewComponent}
                className="h-11 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-lg hover:opacity-90 transition-all gap-2"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden md:inline">Add Component</span>
              </Button>

              <Button
                onClick={() => setIntegrityModalOpen(true)}
                variant="outline"
                title="Component Integrity Audit"
                className={cn(
                  "h-11 px-3.5 rounded-xl font-bold text-xs gap-2 transition-all shadow-sm border shrink-0",
                  incompleteComponentsCount > 0
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
                )}
              >
                <AlertTriangle className={cn("h-4 w-4 shrink-0", incompleteComponentsCount > 0 ? "text-amber-500 animate-pulse" : "text-slate-400")} />
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-black",
                    incompleteComponentsCount > 0
                      ? "bg-amber-500 text-slate-950"
                      : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  )}
                >
                  {incompleteComponentsCount}
                </span>
              </Button>

              <div className={cn(
                "px-3 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wider whitespace-nowrap",
                viewArchived
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
                  : "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
              )}>
                {sortedComponents.length} {viewArchived ? "Archived" : "Records"}
              </div>
            </div>
          </div>

          {/* Advanced Filter Drawer / Panel */}
          {showAdvancedFilters && (
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-lg space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    Smart & Advanced Filters
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {activeAdvFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setAdvFilters({
                        node: "",
                        leg: "",
                        minElv: "",
                        maxElv: "",
                        kpMin: "",
                        kpMax: "",
                        depthMin: "",
                        depthMax: "",
                        associationStatus: "all",
                        inspectionStatus: "all",
                        anomalyStatus: "all",
                        integrityStatus: "all",
                        typeCode: "all",
                      })}
                      className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset Fields
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowAdvancedFilters(false)}
                    className="h-7 w-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* Type Code */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Component Type</Label>
                  <Select
                    value={advFilters.typeCode}
                    onValueChange={(val) => setAdvFilters((prev) => ({ ...prev, typeCode: val }))}
                  >
                    <SelectTrigger className="h-9 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-800 bg-slate-950">
                      <SelectItem value="all" className="text-xs font-bold">All Types</SelectItem>
                      {componentTypes.map((t) => (
                        <SelectItem key={t.id} value={t.code || ""} className="text-xs font-bold">
                          {t.name} ({t.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Nodes */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Node (Start or End)</Label>
                  <Input
                    placeholder="e.g. 1205, 2110..."
                    value={advFilters.node}
                    onChange={(e) => setAdvFilters((prev) => ({ ...prev, node: e.target.value }))}
                    className="h-9 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium"
                  />
                </div>

                {/* Legs */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Leg (Start or End)</Label>
                  <Input
                    placeholder="e.g. A2, B2..."
                    value={advFilters.leg}
                    onChange={(e) => setAdvFilters((prev) => ({ ...prev, leg: e.target.value }))}
                    className="h-9 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium"
                  />
                </div>

                {/* Elevation Range */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Elevation Range (m)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Min (e.g. -30)"
                      value={advFilters.minElv}
                      onChange={(e) => setAdvFilters((prev) => ({ ...prev, minElv: e.target.value }))}
                      className="h-9 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium"
                    />
                    <span className="text-slate-400 text-xs">to</span>
                    <Input
                      placeholder="Max (e.g. 0)"
                      value={advFilters.maxElv}
                      onChange={(e) => setAdvFilters((prev) => ({ ...prev, maxElv: e.target.value }))}
                      className="h-9 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium"
                    />
                  </div>
                </div>

                {/* Association Status */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Association / Parent Link</Label>
                  <Select
                    value={advFilters.associationStatus}
                    onValueChange={(val) => setAdvFilters((prev) => ({ ...prev, associationStatus: val }))}
                  >
                    <SelectTrigger className="h-9 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-800 bg-slate-950">
                      <SelectItem value="all" className="text-xs font-bold">All Items</SelectItem>
                      <SelectItem value="linked" className="text-xs font-bold">Linked to Parent</SelectItem>
                      <SelectItem value="unlinked" className="text-xs font-bold">Unlinked (No Parent)</SelectItem>
                      <SelectItem value="missing" className="text-xs font-bold">Broken Link (Target Missing)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Inspection Status */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inspections</Label>
                  <Select
                    value={advFilters.inspectionStatus}
                    onValueChange={(val) => setAdvFilters((prev) => ({ ...prev, inspectionStatus: val }))}
                  >
                    <SelectTrigger className="h-9 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-800 bg-slate-950">
                      <SelectItem value="all" className="text-xs font-bold">All Inspections</SelectItem>
                      <SelectItem value="has_inspections" className="text-xs font-bold">Has Inspection Records</SelectItem>
                      <SelectItem value="no_inspections" className="text-xs font-bold">No Inspection Data</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Anomaly Status */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Anomalies</Label>
                  <Select
                    value={advFilters.anomalyStatus}
                    onValueChange={(val) => setAdvFilters((prev) => ({ ...prev, anomalyStatus: val }))}
                  >
                    <SelectTrigger className="h-9 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-800 bg-slate-950">
                      <SelectItem value="all" className="text-xs font-bold">All Items</SelectItem>
                      <SelectItem value="has_anomalies" className="text-xs font-bold">Has Anomalies</SelectItem>
                      <SelectItem value="p1_critical" className="text-xs font-bold">P1 Critical Anomalies</SelectItem>
                      <SelectItem value="no_anomalies" className="text-xs font-bold">No Anomalies</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Integrity Status */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Specification Integrity</Label>
                  <Select
                    value={advFilters.integrityStatus}
                    onValueChange={(val) => setAdvFilters((prev) => ({ ...prev, integrityStatus: val }))}
                  >
                    <SelectTrigger className="h-9 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-800 bg-slate-950">
                      <SelectItem value="all" className="text-xs font-bold">All Items</SelectItem>
                      <SelectItem value="incomplete" className="text-xs font-bold text-amber-500">Incomplete Specs (Missing Fields)</SelectItem>
                      <SelectItem value="complete" className="text-xs font-bold text-emerald-500">Complete Specs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Active Filter Chips Row */}
          {(searchQuery || activeAdvFilterCount > 0 || includeArchived || viewFilter !== "default") && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Active Filters:</span>
              
              {searchQuery && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Search: "{searchQuery}"
                  <button type="button" onClick={() => setSearchQuery("")} className="hover:text-blue-900 dark:hover:text-white">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {includeArchived && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  <Archive className="h-3 w-3" />
                  Including Archived Items
                  <button type="button" onClick={() => setIncludeArchived(false)} className="hover:text-rose-900 dark:hover:text-white">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {advFilters.typeCode !== "all" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Type: {advFilters.typeCode}
                  <button type="button" onClick={() => setAdvFilters(p => ({ ...p, typeCode: "all" }))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {advFilters.node && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Node: {advFilters.node}
                  <button type="button" onClick={() => setAdvFilters(p => ({ ...p, node: "" }))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {advFilters.leg && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Leg: {advFilters.leg}
                  <button type="button" onClick={() => setAdvFilters(p => ({ ...p, leg: "" }))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {(advFilters.minElv || advFilters.maxElv) && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Elv: {advFilters.minElv || "∞"} to {advFilters.maxElv || "∞"} m
                  <button type="button" onClick={() => setAdvFilters(p => ({ ...p, minElv: "", maxElv: "" }))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {advFilters.associationStatus !== "all" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  Assoc: {advFilters.associationStatus}
                  <button type="button" onClick={() => setAdvFilters(p => ({ ...p, associationStatus: "all" }))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {advFilters.anomalyStatus !== "all" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  Anomaly: {advFilters.anomalyStatus}
                  <button type="button" onClick={() => setAdvFilters(p => ({ ...p, anomalyStatus: "all" }))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {advFilters.integrityStatus !== "all" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  Integrity: {advFilters.integrityStatus}
                  <button type="button" onClick={() => setAdvFilters(p => ({ ...p, integrityStatus: "all" }))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={resetAllFilters}
                className="text-xs font-bold text-red-500 hover:text-red-600 dark:hover:text-red-400 underline ml-2 cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Viewing Archived Notification Banner */}
        {viewArchived && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300">
            <div className="flex items-center gap-2.5">
              <Archive className="h-4 w-4 text-rose-500 shrink-0" />
              <span className="text-xs font-bold">
                Viewing Archived Components {selectedCode ? `for Category: ${selectedType}` : "(All Categories)"} ({sortedComponents.length} items)
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setViewArchived(false);
                setSelectedType("ALL COMPONENTS");
                setSelectedCode(null);
              }}
              className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline shrink-0"
            >
              Switch to Live Components
            </button>
          </div>
        )}

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
                          ? "bg-rose-50/50 hover:bg-rose-100/60 dark:bg-rose-950/25 dark:hover:bg-rose-950/40 border-l-4 border-l-rose-500"
                          : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                      )}
                      onClick={() => handleRowClick(comp)}
                    >
                      <td className="px-4 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          {comp.is_deleted ? (
                            <div
                              className="h-8 w-8 rounded-lg bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400 border border-rose-300/80 dark:border-rose-800/80 shadow-sm shrink-0"
                              title="Archived Component"
                            >
                              <Archive className="h-4 w-4" />
                            </div>
                          ) : comp.has_attachment ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedComponentForAttachment(comp);
                                setAttachmentModalOpen(true);
                              }}
                              className="h-8 w-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 flex items-center justify-center text-emerald-500 hover:text-emerald-400 transition-all cursor-pointer shadow-sm border border-emerald-500/30 shrink-0"
                              title="View Component & Inspection Attachments"
                            >
                              <Paperclip className="h-4 w-4" />
                            </button>
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-500 transition-colors shrink-0">
                              <Hash className="h-4 w-4" />
                            </div>
                          )}
                          <span className={cn(
                            "font-mono text-[11px] font-bold leading-tight",
                            comp.is_deleted ? "text-rose-700/90 dark:text-rose-300/90" : "text-slate-500"
                          )}>
                            {comp.id_no}
                          </span>
                          
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              "font-black tracking-tight",
                              comp.is_deleted ? "text-rose-950 dark:text-rose-200" : "text-slate-900 dark:text-white"
                            )}>
                              {comp.q_id}
                            </span>
                            {comp.is_deleted && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300/80 dark:border-rose-700 shadow-sm">
                                <Archive className="h-3 w-3 shrink-0" />
                                Archived
                              </span>
                            )}
                          </div>
                          {comp.metadata?.associated_comp_id && (() => {
                            const linkedQId = getLinkedQId(comp.metadata.associated_comp_id);
                            if (linkedQId) {
                              return (
                                <span
                                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-200/70 dark:border-teal-700/50 w-fit"
                                  title={`Linked to parent component: ${linkedQId}`}
                                >
                                  <Link2 className="h-3.5 w-3.5 shrink-0" />
                                  {linkedQId}
                                </span>
                              );
                            }
                            return (
                              <span
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-700/50 w-fit"
                                title={`Linked ID #${comp.metadata.associated_comp_id} was not found on this platform`}
                              >
                                <Link2 className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                                Link Missing (#{comp.metadata.associated_comp_id})
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                          comp.is_deleted
                            ? "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/40"
                            : "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                        )}>
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
                <SelectTrigger className="h-10 w-20 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-black text-xs text-slate-900 dark:text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
                  {[10, 20, 50, 100].map(size => (
                    <SelectItem key={size} value={size.toString()} className="text-xs font-black py-2 cursor-pointer focus:bg-slate-100 dark:focus:bg-slate-800 focus:text-slate-900 dark:focus:text-slate-100">
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

      <ComponentIntegrityModal
        open={integrityModalOpen}
        onOpenChange={setIntegrityModalOpen}
        components={components}
        isPipeline={pageType === "pipeline"}
        structureType={pageType}
        onEditComponent={(comp) => {
          handleEditComponent(comp as Component);
        }}
        onDuplicateComponent={(comp) => {
          handleDuplicateComponent(comp as Component);
        }}
        onArchiveComponent={async (comp) => {
          try {
            await fetcher(`/api/structure-components/item/${comp.id}`, {
              method: "PATCH",
              body: JSON.stringify({ is_deleted: !comp.is_deleted }),
            });
            if (apiUrl) mutate(apiUrl);
            toast.success(comp.is_deleted ? "Component restored" : "Component archived");
          } catch (error) {
            console.error("Action failed", error);
            toast.error("Failed to update component status");
          }
        }}
      />
      
      <InspectionSummaryModal
        open={inspectionModalOpen}
        onOpenChange={setInspectionModalOpen}
        inspections={selectedInspections}
        structureId={structureId}
        isPipeline={pageType === "pipeline"}
        structureType={pageType}
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

      <AttachmentSummaryModal
        open={attachmentModalOpen}
        onOpenChange={setAttachmentModalOpen}
        component={selectedComponentForAttachment}
        structureId={structureId}
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
