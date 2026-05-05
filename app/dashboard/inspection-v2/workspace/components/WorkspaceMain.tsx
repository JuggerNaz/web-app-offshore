"use client";

import React from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  Plus,
  Search,
  Maximize2,
  Minimize2,
  X,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  AlertCircle,
  CheckCircle2,
  FileClock,
  Paperclip,
  FileText,
  ClipboardCheck,
  Info,
  Edit,
  Trash2,
  Settings2,
  GripVertical,
  Eye,
  EyeOff,
} from "lucide-react";
import inspectionRegistry from "@/utils/types/inspection-types.json";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { InspectionForm } from "./InspectionForm";

interface WorkspaceMainProps {
  selectedComp: any;
  activeSpec: string | null;
  allInspectionTypes: any[];
  currentRecords: any[];
  headerData: any;
  inspMethod: "DIVING" | "ROV";
  vidState: "IDLE" | "RECORDING" | "PAUSED";
  vidTimer: number;
  tapeId: number | null;
  jobTapes: any[];

  // State Handlers
  setActiveSpec: (spec: string | null) => void;
  setDynamicProps: (props: any) => void;
  handleDynamicPropChange: (e: any, name: string) => void;
  dynamicProps: any;
  setFindingType: (type: "Complete" | "Anomaly" | "Finding" | "Incomplete") => void;
  setRecordNotes: (notes: string) => void;
  setAnomalyData: (data: any) => void;
  setIsManualOverride: (val: boolean) => void;
  setIsUserInteraction: (val: boolean) => void;
  handleAddNewInspectionSpec: (id: string) => Promise<void>;
  handleCommitRecord: () => Promise<void>;
  resetForm: () => void;
  handleGrabPhoto: () => void;
  isCommitting: boolean;
  formatTime: (sec: number) => string;
  setCompSpecDialogOpen: (val: boolean) => void;
  incompleteReason: string;
  setIncompleteReason: (val: string) => void;
  recordNotes: string;
  pendingAttachments: any[];
  setPendingAttachments: (atts: any[] | ((prev: any[]) => any[])) => void;
  setIsAttachmentManagerOpen: (val: boolean) => void;
  recordedFiles: any[];
  activeDep: any;
  currentMovement: string;
  setShowTaskSelector: (val: boolean) => void;
  setShowCompSelector: (val: boolean) => void;
  editingRecordId: number | null;
  supabase: any; // Added supabase to props

  // Event Table Props
  capturedEventsPipWindow: Window | null;
  handlePopoutCapturedEvents: () => void;
  sortedRecords: any[];
  sortConfig: { key: string; direction: "asc" | "desc" };
  handleSort: (key: string) => void;
  handleEditRecord: (record: any) => void;
  handleDeleteRecord: (id: number) => void;
  setViewingRecordAttachments: (atts: any[]) => void;
  handlePrintAnomaly: (record: any) => void;
  allComps: any[];
  setSelectedComp: (comp: any) => void;

  // Helpers
  renderInspectionField: (field: any, type: "primary" | "secondary") => React.ReactNode;
  anomalyData: any;
  defectCodes: any[];
  allDefectTypes: any[];
  availableDefectTypes: any[];
  priorities: any[];
  manualOverride: boolean;
  setManualOverride: (val: boolean) => void;
  setLastAutoMatchedRuleId: (id: string | null) => void;

  // UI Local State
  isAddInspOpen: boolean;
  setIsAddInspOpen: (val: boolean) => void;
  inspectionTypeSearch: string;
  setInspectionTypeSearch: (val: string) => void;
  findingType: "Complete" | "Anomaly" | "Finding" | "Incomplete";
  activeMGIProfile?: any;
}

export function WorkspaceMain(props: WorkspaceMainProps) {
  const {
    selectedComp,
    activeSpec,
    allInspectionTypes,
    currentRecords,
    headerData,
    inspMethod,
    vidState,
    vidTimer,
    tapeId,
    jobTapes,
    setActiveSpec,
    setDynamicProps,
    handleDynamicPropChange,
    setFindingType,
    setRecordNotes,
    setAnomalyData,
    setIsManualOverride,
    setIsUserInteraction,
    handleAddNewInspectionSpec,
    handleCommitRecord,
    resetForm,
    handleGrabPhoto,
    isCommitting,
    formatTime,
    setCompSpecDialogOpen,
    incompleteReason,
    setIncompleteReason,
    recordNotes,
    pendingAttachments,
    setPendingAttachments,
    setIsAttachmentManagerOpen,
    recordedFiles,
    activeDep,
    currentMovement,
    setShowTaskSelector,
    setShowCompSelector,
    editingRecordId,
    capturedEventsPipWindow,
    handlePopoutCapturedEvents,
    sortedRecords,
    sortConfig,
    handleSort,
    handleEditRecord,
    handleDeleteRecord,
    setViewingRecordAttachments,
    handlePrintAnomaly,
    allComps,
    setSelectedComp,
    renderInspectionField,
    anomalyData,
    defectCodes,
    allDefectTypes,
    availableDefectTypes,
    priorities,
    manualOverride,
    setManualOverride,
    setLastAutoMatchedRuleId,
    isAddInspOpen,
    setIsAddInspOpen,
    inspectionTypeSearch,
    setInspectionTypeSearch,
    findingType,
    supabase,
    activeMGIProfile,
  } = props;

  const FORM_AREA_ID = "workspace-form-area";
  const [recordSearchQuery, setRecordSearchQuery] = React.useState("");

  // Column Settings for Captured Events (Synced with localStorage)
  const [columnSettings, setColumnSettings] = React.useState(() => {
    const defaultCols = [
      { id: 'cr_date', label: 'Date', visible: true },
      { id: 'type', label: 'Type', visible: true },
      { id: 'component', label: 'Component', visible: true },
      { id: 'elev', label: 'Elev/KP', visible: true },
      { id: 'anomaly_ref', label: 'Anom. Ref', visible: true },
      { id: 'cp_reading', label: 'CP (mV)', visible: true },
      { id: 'dive_no', label: 'Dive No', visible: true },
      { id: 'tape_no', label: 'Tape No', visible: true },
    ];
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('capturedEventsColumns');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return defaultCols.map(dc => {
            const s = parsed.find((p: any) => p.id === dc.id);
            return s ? { ...dc, ...s } : dc;
          });
        } catch (e) { console.error("Error parsing columns", e); }
      }
    }
    return defaultCols;
  });

  React.useEffect(() => {
    localStorage.setItem('capturedEventsColumns', JSON.stringify(columnSettings));
  }, [columnSettings]);

  const handleMoveColumn = (index: number, direction: 'up' | 'down') => {
    const newCols = [...columnSettings];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newCols.length) return;
    [newCols[index], newCols[targetIndex]] = [newCols[targetIndex], newCols[index]];
    setColumnSettings(newCols);
  };

  const toggleColumnVisibility = (id: string) => {
    setColumnSettings(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  };

  const activeTableColumns = React.useMemo(() => {
    return [
      { id: 'actions', label: 'Actions', fixed: true },
      { id: 'status', label: 'Status', fixed: true },
      ...columnSettings.filter(c => c.visible)
    ];
  }, [columnSettings]);

  const displayRecords = React.useMemo(() => {
    if (!recordSearchQuery) return sortedRecords;
    const q = recordSearchQuery.toLowerCase();
    return sortedRecords.filter((r: any) => {
      const typeName = (r.inspection_type?.name || "").toLowerCase();
      const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toLowerCase();
      const componentId = (r.structure_components?.q_id || "").toLowerCase();
      const elev = (r.elevation || "").toString().toLowerCase();
      const status = r.has_anomaly ? "anomaly" : (r.status === 'COMPLETED' ? "complete" : "incomplete");
      const remarks = (r.inspection_data?.observation || r.inspection_data?.findings || "").toLowerCase();
      const refNo = (r.insp_anomalies?.[0]?.anomaly_ref_no || "").toLowerCase();
      const cpReading = (r.inspection_data?.cp_rdg ?? r.inspection_data?.cp_reading_mv ?? r.inspection_data?.cp ?? "").toString().toLowerCase();
      const diveNo = (r.insp_dive_jobs?.job_no || r.insp_rov_jobs?.job_no || "").toLowerCase();
      const tapeNo = (r.insp_video_tapes?.tape_no || "").toLowerCase();

      // Add date and timecode for completeness
      const crDateStr = r.cr_date ? new Date(r.cr_date).toLocaleDateString() + " " + new Date(r.cr_date).toLocaleTimeString() : "";
      const timecode = (r.inspection_data?._meta_timecode || r.tape_count_no || "").toString().toLowerCase();

      return (
        typeName.includes(q) ||
        typeCode.includes(q) ||
        componentId.includes(q) ||
        elev.includes(q) ||
        status.includes(q) ||
        remarks.includes(q) ||
        refNo.includes(q) ||
        cpReading.includes(q) ||
        diveNo.includes(q) ||
        tapeNo.includes(q) ||
        crDateStr.toLowerCase().includes(q) ||
        timecode.includes(q)
      );
    });
  }, [sortedRecords, recordSearchQuery]);

  return (
    <div className="flex-1 flex flex-col gap-3 min-w-[500px] overflow-hidden">
      <Card className="flex flex-col flex-1 border-slate-200 shadow-sm rounded-md bg-white overflow-hidden relative">
        {!selectedComp ? (
          <div className="flex-1 flex items-center justify-center flex-col text-slate-400 p-10 text-center">
            <Activity className="w-12 h-12 mb-4 opacity-30 text-blue-500" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2">
              Awaiting Target Selection
            </h2>
            <p className="text-xs max-w-[280px]">
              Please select a component from the right column (List or 3D view) to review history
              and begin logging inspection scopes.
            </p>
          </div>
        ) : (
          <div id={FORM_AREA_ID} className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
            {!activeSpec ? (
              <div className="p-5 flex flex-col items-center justify-center text-center h-full">
                <div className="w-full max-w-2xl flex flex-col items-center">
                  <div className="text-[11px] font-bold uppercase text-slate-400 tracking-widest mb-4">
                    Select Scope to Inspect ({selectedComp.name})
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                    {selectedComp.tasks &&
                      selectedComp.tasks.filter((t: string) => {
                        const it = (allInspectionTypes || []).find((type: any) => type.code === t || type.name === t);
                        const localIt = (inspectionRegistry as any).inspectionTypes?.find((type: any) => type.code === t || type.name === t);
                        
                        const methods = it?.default_properties?.methods || it?.methods || localIt?.methods || [];
                        const isRov = methods.includes("ROV") || it?.metadata?.rov === 1 || it?.metadata?.rov === "1" || it?.metadata?.rov === true || (it?.metadata?.job_type && it.metadata.job_type.includes("ROV"));
                        const isDiving = methods.includes("DIVING") || it?.metadata?.diving === 1 || it?.metadata?.diving === "1" || it?.metadata?.diving === true || (it?.metadata?.job_type && it.metadata.job_type.includes("DIVING"));

                        if (!it && !localIt) {
                          const isCodeRov = String(t).startsWith("R") || String(t).startsWith("ROV") || String(t).toLowerCase().includes("rov");
                          if (inspMethod === "DIVING" && isCodeRov) return false;
                          if (inspMethod === "ROV" && !isCodeRov) return false;
                          return true;
                        }

                        if (inspMethod === "DIVING" && !isDiving) return false;
                        if (inspMethod === "ROV" && !isRov) return false;
                        return true;
                      }).map((t: string) => {
                        const taskStatus = selectedComp.taskStatuses?.find(
                          (ts: any) => ts.code === t
                        );
                        const status = taskStatus?.status || "pending";
                        const isCompleted = status === "completed";
                        const isIncomplete = status === "incomplete";

                        const taskRecords = currentRecords.filter(
                          (r: any) =>
                            (r.inspection_type?.code === t || r.inspection_type_code === t) &&
                            r.component_id === selectedComp.id
                        );

                        const hasAnomaly = taskRecords.some(
                          (r: any) => r.has_anomaly && r.inspection_data?._meta_status !== "Finding"
                        );
                        const hasFinding = taskRecords.some(
                          (r: any) => r.has_anomaly && r.inspection_data?._meta_status === "Finding"
                        );
                        const isRectified = taskRecords.some(
                          (r: any) => r.has_anomaly && r.insp_anomalies?.[0]?.status === "CLOSED"
                        );
                        const it = allInspectionTypes.find(
                          (type) => type.code === t || type.name === t
                        );

                        const statusColor =
                          hasAnomaly && !isRectified
                            ? "red"
                            : hasFinding
                              ? "orange"
                              : isRectified
                                ? "teal"
                                : isCompleted
                                  ? "green"
                                  : isIncomplete
                                    ? "amber"
                                    : "blue";

                        const statusLabel =
                          hasAnomaly && !isRectified
                            ? "Anomaly Registered"
                            : hasFinding
                              ? "Finding Registered"
                              : isRectified
                                ? "Rectified"
                                : isCompleted
                                  ? "Completed"
                                  : isIncomplete
                                    ? "Incomplete"
                                    : "Pending";

                        return (
                          <Button
                            key={t}
                            onClick={() => {
                              setActiveSpec(t);
                              const newProps: Record<string, any> = {};
                              const compNT = selectedComp.nominalThk && selectedComp.nominalThk !== "-" ? selectedComp.nominalThk : 
                                             (selectedComp.wallThickness && selectedComp.wallThickness !== "-" ? selectedComp.wallThickness : null);
                              if (compNT) {
                                const specProps = it?.default_properties || [];
                                let propsList: any[] = [];
                                if (typeof specProps === "string") {
                                  try {
                                    const parsed = JSON.parse(specProps);
                                    propsList = Array.isArray(parsed)
                                      ? parsed
                                      : parsed.properties || [];
                                  } catch (e) {}
                                } else if (Array.isArray(specProps)) {
                                  propsList = specProps;
                                }

                                const ntField = propsList.find(
                                  (p: any) =>
                                    String(p.label || p.name || "")
                                      .toLowerCase()
                                      .includes("nominal thickness") ||
                                    String(p.label || p.name || "").toLowerCase() === "nt"
                                );
                                if (ntField) {
                                  newProps[ntField.name || ntField.label] = compNT;
                                }
                              }
                              setDynamicProps(newProps);
                              setFindingType("Complete");
                              setRecordNotes("");
                              setAnomalyData({
                                defectCode: "",
                                priority: "",
                                defectType: "",
                                description: "",
                                recommendedAction: "",
                                rectify: false,
                                rectifiedDate: "",
                                rectifiedRemarks: "",
                                severity: "Minor",
                                referenceNo: "",
                              });
                              setManualOverride(false);
                              setIsUserInteraction(false);
                            }}
                            className={`w-full h-14 bg-white border font-bold shadow-sm flex justify-between items-center group transition-all ${
                              statusColor === "green"
                                ? "border-green-200 hover:bg-green-50/50"
                                : statusColor === "red"
                                  ? "border-red-200 hover:bg-red-50/30"
                                  : statusColor === "orange"
                                    ? "border-orange-200 hover:bg-orange-50/30"
                                    : statusColor === "teal"
                                      ? "border-teal-200 hover:bg-teal-50/30"
                                      : statusColor === "amber"
                                        ? "border-amber-200 hover:bg-amber-50/30"
                                        : "border-blue-200 hover:bg-blue-50"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-3 h-3 rounded-full flex items-center justify-center shrink-0 ${
                                  statusColor === "green"
                                    ? "bg-green-500"
                                    : statusColor === "red"
                                      ? "bg-red-500 animate-pulse"
                                      : statusColor === "orange"
                                        ? "bg-orange-500"
                                        : statusColor === "teal"
                                          ? "bg-teal-500"
                                          : statusColor === "amber"
                                            ? "bg-amber-500"
                                            : "bg-slate-300"
                                }`}
                              >
                                {statusColor === "green" && (
                                  <Check className="w-2 h-2 text-white" />
                                )}
                                {(statusColor === "red" || statusColor === "orange") && (
                                  <AlertTriangle className="w-2 h-2 text-white" />
                                )}
                              </div>
                              <div className="flex flex-col items-start overflow-hidden flex-1 max-w-[170px]">
                                <div className="flex items-baseline gap-1.5 w-full text-left truncate">
                                  <span
                                    className={`text-sm font-bold truncate ${
                                      statusColor === "green"
                                        ? "text-green-700"
                                        : statusColor === "red"
                                          ? "text-red-700"
                                          : statusColor === "orange"
                                            ? "text-orange-700"
                                            : statusColor === "teal"
                                              ? "text-teal-700"
                                              : statusColor === "amber"
                                                ? "text-amber-700"
                                                : "text-blue-700"
                                    }`}
                                    title={it?.name || t}
                                  >
                                    {it?.name || t}
                                  </span>
                                  <span
                                    className={`text-[9px] font-mono px-1 py-0.5 rounded-md shrink-0 border ${
                                      statusColor === "green"
                                        ? "bg-green-50 border-green-200 text-green-700"
                                        : statusColor === "red"
                                          ? "bg-red-50 border-red-200 text-red-700"
                                          : statusColor === "orange"
                                            ? "bg-orange-50 border-orange-200 text-orange-700"
                                            : statusColor === "teal"
                                              ? "bg-teal-50 border-teal-200 text-teal-700"
                                              : statusColor === "amber"
                                                ? "bg-amber-50 border-amber-200 text-amber-700"
                                                : "bg-blue-50 border-blue-200 text-blue-700"
                                    }`}
                                  >
                                    {it?.code || t}
                                  </span>
                                </div>
                                <span
                                  className={`text-[9px] mt-0.5 font-medium uppercase tracking-wider ${
                                    statusColor === "green"
                                      ? "text-green-500"
                                      : statusColor === "red"
                                        ? "text-red-500"
                                        : statusColor === "orange"
                                          ? "text-orange-500"
                                          : statusColor === "teal"
                                            ? "text-teal-500"
                                            : statusColor === "amber"
                                              ? "text-amber-500"
                                              : "text-slate-400"
                                  }`}
                                >
                                  {statusLabel}
                                </span>
                              </div>
                            </div>
                            <ArrowRight
                              className={`w-4 h-4 ${
                                statusColor === "green"
                                  ? "text-green-300"
                                  : statusColor === "red"
                                    ? "text-red-300"
                                    : statusColor === "orange"
                                      ? "text-orange-300"
                                      : statusColor === "amber"
                                        ? "text-amber-300"
                                        : "text-blue-300"
                              }`}
                            />
                          </Button>
                        );
                      })}
                  </div>
                  <div className="w-full max-w-[350px] space-y-3 mt-4">
                    <div className="py-2">
                      <Separator />
                    </div>
                    <Popover open={isAddInspOpen} onOpenChange={setIsAddInspOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full h-12 border-dashed border-2 text-slate-500 font-bold hover:border-blue-400 hover:bg-blue-50/30 flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" /> Add Additional Inspection Type
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[350px] p-0 shadow-2xl border-slate-200"
                        align="center"
                        side="top"
                      >
                        <div className="flex flex-col">
                          <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                              <Input
                                placeholder="Search type name or code..."
                                className="pl-9 h-9 text-xs bg-white border-slate-200 focus-visible:ring-blue-500"
                                value={inspectionTypeSearch}
                                onChange={(e) => setInspectionTypeSearch(e.target.value)}
                                autoFocus
                              />
                            </div>
                          </div>
                          <ScrollArea className="h-[300px]">
                            <div className="p-1.5 space-y-1">
                              {allInspectionTypes
                                .filter((it) => {
                                  const methods = it.default_properties?.methods || it.methods || [];
                                  const isRov =
                                    methods.includes("ROV") ||
                                    it.metadata?.rov === 1 ||
                                    it.metadata?.rov === "1" ||
                                    it.metadata?.rov === true ||
                                    it.metadata?.job_type?.includes("ROV");
                                  const isDiving =
                                    methods.includes("DIVING") ||
                                    it.metadata?.diving === 1 ||
                                    it.metadata?.diving === "1" ||
                                    it.metadata?.diving === true ||
                                    it.metadata?.job_type?.includes("DIVING");
                                  if (inspMethod === "DIVING" && !isDiving) return false;
                                  if (inspMethod === "ROV" && !isRov) return false;
                                  if (inspectionTypeSearch) {
                                    const q = inspectionTypeSearch.toLowerCase();
                                    return (
                                      (it.name || "").toLowerCase().includes(q) ||
                                      (it.code || "").toLowerCase().includes(q)
                                    );
                                  }
                                  return true;
                                })
                                .map((it) => (
                                  <button
                                    key={it.id}
                                    onClick={async () => {
                                      await handleAddNewInspectionSpec(it.id.toString());
                                      setIsAddInspOpen(false);
                                      setInspectionTypeSearch("");
                                    }}
                                    className="w-full text-left px-3 py-2.5 rounded-md hover:bg-blue-50 transition-colors group"
                                  >
                                    <div className="flex flex-col">
                                      <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700">
                                        {it.name}
                                      </span>
                                      <span className="text-[10px] font-mono font-medium text-slate-400 group-hover:text-blue-500">
                                        {it.code}
                                      </span>
                                    </div>
                                  </button>
                                ))}
                            </div>
                          </ScrollArea>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            ) : (
              <InspectionForm
                selectedComp={selectedComp}
                activeSpec={activeSpec}
                allInspectionTypes={allInspectionTypes}
                activeFormProps={[]}
                findingType={findingType}
                setFindingType={setFindingType}
                renderInspectionField={renderInspectionField}
                dynamicProps={props.dynamicProps}
                handleDynamicPropChange={handleDynamicPropChange}
                anomalyData={anomalyData}
                setAnomalyData={setAnomalyData}
                defectCodes={defectCodes}
                allDefectTypes={allDefectTypes}
                availableDefectTypes={availableDefectTypes}
                priorities={priorities}
                headerData={headerData}
                isManualOverride={manualOverride}
                setIsManualOverride={setManualOverride}
                setLastAutoMatchedRuleId={setLastAutoMatchedRuleId}
                handleCommitRecord={handleCommitRecord}
                onClose={resetForm}
                onCapturePhoto={handleGrabPhoto}
                isCommitting={isCommitting}
                vidTimer={vidTimer}
                formatTime={formatTime}
                setCompSpecDialogOpen={setCompSpecDialogOpen}
                resetForm={resetForm}
                incompleteReason={incompleteReason}
                setIncompleteReason={setIncompleteReason}
                recordNotes={recordNotes}
                setRecordNotes={setRecordNotes}
                pendingAttachments={pendingAttachments}
                setPendingAttachments={setPendingAttachments}
                setIsAttachmentManagerOpen={setIsAttachmentManagerOpen}
                recordedFiles={recordedFiles}
                activeDep={activeDep}
                currentMovement={currentMovement}
                tapeId={tapeId}
                vidState={vidState}
                onChangeTaskClick={() => setShowTaskSelector(true)}
                onChangeComponentClick={() => setShowCompSelector(true)}
                isEditing={!!editingRecordId}
                supabase={supabase}
                activeMGIProfile={props.activeMGIProfile}
              />
            )}
          </div>
        )}
      </Card>

      <Card
        className={`flex flex-col ${capturedEventsPipWindow ? "h-[40px]" : "h-[280px]"} border-slate-200 shadow-sm rounded-md bg-white overflow-hidden shrink-0 transition-all duration-500 ease-in-out`}
      >
        <div className="bg-slate-800 text-white px-3 py-2 text-[11px] font-bold uppercase tracking-widest flex justify-between items-center h-[40px] shrink-0">
          <div className="flex items-center gap-2">
            <span>CAPTURED EVENTS</span>
            <Badge className="bg-blue-600 text-white border-none text-[9px] h-4 leading-none font-bold uppercase tracking-wider">
              {recordSearchQuery ? `${displayRecords.length} / ${sortedRecords.length}` : sortedRecords.length} Captured
            </Badge>
          </div>

          <div className="flex-1 max-w-sm mx-4 relative hidden md:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
            <Input 
              placeholder="Smart Filter (Record, Component, Type, Status)..."
              className="h-7 text-[10px] pl-8 bg-slate-900/50 border-slate-700 text-slate-200 placeholder:text-slate-500 focus-visible:ring-blue-500/30 font-bold tracking-tight"
              value={recordSearchQuery}
              onChange={(e) => setRecordSearchQuery(e.target.value)}
            />
            {recordSearchQuery && (
              <button 
                onClick={() => setRecordSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-800 rounded transition-colors"
              >
                <X className="w-2.5 h-2.5 text-slate-500" />
              </button>
            )}
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-slate-300 hover:text-white hover:bg-slate-700 mr-1"
              >
                <Settings2 className="w-3.5 h-3.5 mr-1" />
                Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0 bg-white border-slate-200 shadow-xl" align="end">
              <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <Settings2 className="w-3 h-3" /> Column Configuration
                </h4>
              </div>
              <div className="p-1 max-h-[300px] overflow-y-auto">
                {columnSettings.map((col, idx) => (
                  <div key={col.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded group">
                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleMoveColumn(idx, 'up')}
                        disabled={idx === 0}
                        className="p-0.5 hover:bg-slate-200 rounded disabled:opacity-30"
                      >
                        <ChevronUp className="w-2.5 h-2.5" />
                      </button>
                      <button 
                        onClick={() => handleMoveColumn(idx, 'down')}
                        disabled={idx === columnSettings.length - 1}
                        className="p-0.5 hover:bg-slate-200 rounded disabled:opacity-30"
                      >
                        <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    <GripVertical className="w-3 h-3 text-slate-300 cursor-grab" />
                    <button 
                      onClick={() => toggleColumnVisibility(col.id)}
                      className={`flex-1 text-left text-[11px] font-bold ${col.visible ? 'text-slate-700' : 'text-slate-400 line-through'}`}
                    >
                      {col.label}
                    </button>
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${col.visible ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}>
                      {col.visible && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-2 bg-slate-50 border-t border-slate-100">
                <p className="text-[9px] text-slate-400 font-medium italic">First two columns (Actions, Status) are fixed.</p>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] text-slate-300 hover:text-white hover:bg-slate-700"
            onClick={handlePopoutCapturedEvents}
          >
            {capturedEventsPipWindow ? (
              <X className="w-3.5 h-3.5 mr-1" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 mr-1" />
            )}
            {capturedEventsPipWindow ? "Dock" : "Float"}
          </Button>
        </div>

        {!capturedEventsPipWindow && (
          <ScrollArea className="flex-1 w-full relative">
            <div className="min-w-full inline-block align-middle overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap table-auto">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider z-20">
                <tr>
                  {activeTableColumns.map(col => (
                    <th 
                      key={col.id} 
                      className={`px-3 py-3 transition-colors group ${
                        col.id !== 'actions' && col.id !== 'status' ? 'cursor-pointer hover:bg-slate-100' : ''
                      } ${
                        col.id === 'cr_date' ? 'w-20' : ''
                      } ${
                        ['elev', 'cp_reading', 'status'].includes(col.id) ? 'text-center' : ''
                      }`}
                      onClick={() => col.id !== 'actions' && col.id !== 'status' && handleSort(col.id)}
                    >
                      <div className={`flex items-center gap-1.5 ${['elev', 'cp_reading', 'status'].includes(col.id) ? 'justify-center' : ''}`}>
                        {col.label} 
                        {sortConfig.key === col.id ? (
                          sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />
                        ) : (
                          col.id !== 'actions' && col.id !== 'status' && <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayRecords.map((r: any) => {
                  const formatCounter = (val: any) => {
                    if (!val) return null;
                    if (typeof val === "string" && val.includes(":")) return val;
                    const sec = Number(val);
                    if (!isNaN(sec)) {
                      const h = Math.floor(sec / 3600).toString().padStart(2, "0");
                      const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
                      const s = Math.floor(sec % 60).toString().padStart(2, "0");
                      return `${h}:${m}:${s}`;
                    }
                    return val;
                  };

                  return (
                    <tr key={r.insp_id} className="hover:bg-slate-50 group">
                      {activeTableColumns.map(col => {
                        switch (col.id) {
                          case 'actions':
                            return (
                              <td key={col.id} className="px-3 py-3 text-right align-top">
                                <div className="flex items-center justify-start gap-1 group-hover:opacity-100 opacity-60 transition-opacity mt-0.5">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className="p-1.5 px-2 bg-slate-100 hover:bg-blue-600 hover:text-white rounded flex items-center gap-1.5 transition-colors text-[10px] font-bold uppercase tracking-wider text-slate-600" title="Report Options">
                                        <FileText className="w-3.5 h-3.5" /> Actions
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-48">
                                      {r.has_anomaly && (
                                        <>
                                          <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1">Reports</div>
                                          {r.inspection_data?._meta_status === 'Finding' ? (
                                            <DropdownMenuItem onClick={() => handlePrintAnomaly(r)} className="text-xs py-2 cursor-pointer text-blue-600 focus:text-blue-700">
                                              <ClipboardCheck className="w-3.5 h-3.5 mr-2" /> Print Finding Report
                                            </DropdownMenuItem>
                                          ) : (
                                            <DropdownMenuItem onClick={() => handlePrintAnomaly(r)} className="text-xs py-2 cursor-pointer text-red-600 focus:text-red-700">
                                              <AlertTriangle className="w-3.5 h-3.5 mr-2" /> Print {r.inspection_data?._meta_status || 'Defect'} Report
                                            </DropdownMenuItem>
                                          )}
                                          <div className="border-t border-slate-50 my-1"></div>
                                        </>
                                      )}
                                      <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Details</div>
                                      <DropdownMenuItem onClick={() => {
                                        const comp = (allComps || []).find((c: any) => c.id === r.component_id);
                                        if (comp) {
                                          setSelectedComp(comp);
                                          setCompSpecDialogOpen(true);
                                        }
                                      }} className="text-xs py-2 cursor-pointer">
                                        <Info className="w-3.5 h-3.5 mr-2 text-indigo-600" /> View Component Spec
                                      </DropdownMenuItem>
                                      <div className="border-t border-slate-50 my-1"></div>
                                      <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Modify</div>
                                      <DropdownMenuItem onClick={() => handleEditRecord(r)} className="text-xs py-2 cursor-pointer">
                                        <Edit className="w-3.5 h-3.5 mr-2 text-blue-600" /> Edit Record
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleDeleteRecord(r.insp_id)} className="text-xs py-2 cursor-pointer text-red-600 focus:text-red-700">
                                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Record
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </td>
                            );
                          case 'status':
                            return (
                              <td key={col.id} className="px-3 py-3 align-top text-center">
                                <div className="flex flex-col items-center gap-1.5 mt-0.5">
                                  {r.has_anomaly ? (
                                    <div title="Anomaly/Finding Found" className="flex items-center justify-center h-6 w-6 rounded-full bg-red-100">
                                      <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                                    </div>
                                  ) : r.status === 'COMPLETED' ? (
                                    <div title="Completed Inspection" className="flex items-center justify-center h-6 w-6 rounded-full bg-green-100">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                    </div>
                                  ) : (
                                    <div title="Incomplete / Draft" className="flex items-center justify-center h-6 w-6 rounded-full bg-amber-100">
                                      <FileClock className="w-3.5 h-3.5 text-amber-600" />
                                    </div>
                                  )}
                                  {(r.attachment_count > 0 || (r.insp_media && r.insp_media[0]?.count > 0)) && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 w-6 p-0 rounded-full hover:bg-blue-50 text-blue-500"
                                      onClick={async () => {
                                        const { data } = await supabase.from('attachment').select('*').eq('source_id', r.insp_id).eq('source_type', 'INSPECTION');
                                        if (data) setViewingRecordAttachments(data);
                                      }}
                                    >
                                      <Paperclip className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            );
                          case 'cr_date':
                            return (
                              <td key={col.id} className="px-3 py-3 text-slate-600 align-top">
                                <div className="text-sm font-medium">{r.cr_date ? format(new Date(r.cr_date), 'dd MMM') : '-'}</div>
                                <div className="text-[10px] opacity-70 mt-0.5">{r.cr_date ? format(new Date(r.cr_date), 'HH:mm') : '-'}</div>
                              </td>
                            );
                          case 'type':
                            return (
                              <td key={col.id} className="px-3 py-3 font-bold text-slate-800 align-top">
                                <div className="truncate max-w-[200px] text-sm" title={r.inspection_type?.name}>{r.inspection_type?.name || "UNK"}</div>
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-medium w-fit uppercase text-muted-foreground border-slate-200 shadow-none mt-1">
                                  {r.inspection_type_code || r.inspection_type?.code || 'UNK'}
                                </Badge>
                              </td>
                            );
                          case 'component':
                            return (
                              <td key={col.id} className="px-3 py-3 align-top text-slate-700">
                                <div className="font-bold text-sm">{r.structure_components?.q_id || '-'}</div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">{r.component_type || r.structure_components?.code || '-'}</div>
                              </td>
                            );
                          case 'elev':
                            return (
                              <td key={col.id} className="px-3 py-3 text-center text-sm font-medium text-slate-600 align-top">
                                {r.elevation ? `${r.elevation}m` : (r.fp_kp || '-')}
                              </td>
                            );
                          case 'anomaly_ref':
                            return (
                              <td key={col.id} className="px-3 py-3 align-top text-slate-700">
                                {r.insp_anomalies?.[0]?.anomaly_ref_no ? (
                                  <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">{r.insp_anomalies[0].anomaly_ref_no}</span>
                                ) : <span className="text-slate-300">-</span>}
                              </td>
                            );
                          case 'cp_reading':
                            return (
                              <td key={col.id} className="px-3 py-3 text-center text-sm font-medium text-slate-600 align-top">
                                {(() => {
                                  const cp = r.inspection_data?.cp_rdg ?? r.inspection_data?.cp_reading_mv ?? r.inspection_data?.cp;
                                  return cp ? <span className="font-mono text-xs">{cp}</span> : <span className="text-slate-300">-</span>;
                                })()}
                              </td>
                            );
                          case 'dive_no':
                            return (
                              <td key={col.id} className="px-3 py-3 align-top text-slate-700">
                                <span className="text-xs font-medium">{r.insp_dive_jobs?.job_no || r.insp_rov_jobs?.job_no || <span className="text-slate-300">-</span>}</span>
                              </td>
                            );
                          case 'tape_no':
                            return (
                              <td key={col.id} className="px-3 py-3 align-top text-slate-700">
                                <span className="text-xs font-medium">{r.insp_video_tapes?.tape_no || <span className="text-slate-300">-</span>}</span>
                                {(r.inspection_data?._meta_timecode || r.tape_count_no) && (
                                  <div className="text-[11px] font-mono font-medium text-slate-500 flex items-center gap-1.5 mt-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                    {formatCounter(r.inspection_data?._meta_timecode || r.tape_count_no)}
                                  </div>
                                )}
                              </td>
                            );
                          default: return null;
                        }
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </Card>

      {capturedEventsPipWindow && (
        <>
          {createPortal(
            <div className="h-screen w-screen flex flex-col bg-white overflow-hidden">
              <div className="bg-slate-800 text-white px-3 py-2 text-[11px] font-bold uppercase tracking-widest flex justify-between items-center h-[40px] shrink-0">
                <div className="flex items-center gap-2">
                  <span>CAPTURED EVENTS (FLOATING)</span>
                  <Badge className="bg-blue-600 text-white border-none text-[9px] h-4 leading-none font-bold uppercase tracking-wider">
                    {recordSearchQuery ? `${displayRecords.length} / ${sortedRecords.length}` : sortedRecords.length} Captured
                  </Badge>
                </div>

                <div className="flex-1 max-w-sm mx-4 relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  <Input 
                    placeholder="Smart Filter..."
                    className="h-7 text-[10px] pl-8 bg-slate-900/50 border-slate-700 text-slate-200 placeholder:text-slate-500 focus-visible:ring-blue-500/30 font-bold tracking-tight"
                    value={recordSearchQuery}
                    onChange={(e) => setRecordSearchQuery(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-700">
                        <Settings2 className="w-3.5 h-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0 shadow-2xl border-slate-700 bg-slate-900 text-slate-200" align="end" container={capturedEventsPipWindow?.document.body}>
                      <div className="p-3 border-b border-slate-800 bg-slate-950/50">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Table Configuration</h3>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-5 text-[9px] uppercase font-bold text-blue-400 hover:text-blue-300 p-0"
                            onClick={() => {
                              const defaultCols = [
                                { id: 'cr_date', label: 'Date', visible: true },
                                { id: 'type', label: 'Type', visible: true },
                                { id: 'component', label: 'Component', visible: true },
                                { id: 'elev', label: 'Elev/KP', visible: true },
                                { id: 'anomaly_ref', label: 'Anom. Ref', visible: true },
                                { id: 'cp_reading', label: 'CP (mV)', visible: true },
                                { id: 'dive_no', label: 'Dive No', visible: true },
                                { id: 'tape_no', label: 'Tape No', visible: true },
                              ];
                              setColumnSettings(defaultCols);
                            }}
                          >
                            Reset
                          </Button>
                        </div>
                      </div>
                      <ScrollArea className="h-72">
                        <div className="p-1.5 space-y-0.5">
                          {columnSettings.map((col, idx) => (
                            <div key={col.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-800 group">
                              <GripVertical className="w-3 h-3 text-slate-600 shrink-0" />
                              <button 
                                onClick={() => toggleColumnVisibility(col.id)}
                                className={`flex-1 flex items-center gap-2 text-left transition-opacity ${col.visible ? 'opacity-100' : 'opacity-40'}`}
                              >
                                {col.visible ? <Eye className="w-3.5 h-3.5 text-blue-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                                <span className="text-[11px] font-bold tracking-tight">{col.label}</span>
                              </button>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-5 w-5 p-0 hover:bg-slate-700"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveColumn(idx, 'up')}
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-5 w-5 p-0 hover:bg-slate-700"
                                  disabled={idx === columnSettings.length - 1}
                                  onClick={() => handleMoveColumn(idx, 'down')}
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      <div className="p-2 border-t border-slate-800 bg-slate-950/30">
                        <p className="text-[9px] text-slate-500 italic text-center">Actions & Status columns are fixed at start.</p>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <button onClick={() => capturedEventsPipWindow.close()} className="text-white/50 hover:text-white p-1 hover:bg-white/10 rounded-full transition-all" title="Close">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <ScrollArea className="flex-1 w-full relative">
                <div className="min-w-full inline-block align-middle overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap table-auto">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider z-20">
                    <tr>
                      {activeTableColumns.map(col => (
                        <th 
                          key={col.id} 
                          className={`px-3 py-3 transition-colors group ${
                            col.id !== 'actions' && col.id !== 'status' ? 'cursor-pointer hover:bg-slate-100' : ''
                          } ${
                            col.id === 'cr_date' ? 'w-20' : ''
                          } ${
                            ['elev', 'cp_reading', 'status'].includes(col.id) ? 'text-center' : ''
                          }`}
                          onClick={() => col.id !== 'actions' && col.id !== 'status' && handleSort(col.id)}
                        >
                          <div className={`flex items-center gap-1.5 ${['elev', 'cp_reading', 'status'].includes(col.id) ? 'justify-center' : ''}`}>
                            {col.label} 
                            {sortConfig.key === col.id ? (
                              sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />
                            ) : (
                              col.id !== 'actions' && col.id !== 'status' && <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayRecords.map((r: any) => {
                      const formatCounter = (val: any) => {
                        if (!val) return null;
                        if (typeof val === "string" && val.includes(":")) return val;
                        const sec = Number(val);
                        if (!isNaN(sec)) {
                          const h = Math.floor(sec / 3600).toString().padStart(2, "0");
                          const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
                          const s = Math.floor(sec % 60).toString().padStart(2, "0");
                          return `${h}:${m}:${s}`;
                        }
                        return val;
                      };

                      return (
                        <tr key={r.insp_id} className="hover:bg-slate-50 group">
                          {activeTableColumns.map(col => {
                            switch (col.id) {
                              case 'actions':
                                return (
                                  <td key={col.id} className="px-3 py-3 text-right align-top">
                                    <div className="flex items-center justify-start gap-1 group-hover:opacity-100 opacity-60 transition-opacity mt-0.5">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <button className="p-1.5 px-2 bg-slate-100 hover:bg-blue-600 hover:text-white rounded flex items-center gap-1.5 transition-colors text-[10px] font-bold uppercase tracking-wider text-slate-600" title="Report Options">
                                            <FileText className="w-3.5 h-3.5" /> Actions
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="w-48" container={capturedEventsPipWindow?.document.body}>
                                          {r.has_anomaly && (
                                            <>
                                              <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1">Reports</div>
                                              {r.inspection_data?._meta_status === 'Finding' ? (
                                                <DropdownMenuItem onClick={() => handlePrintAnomaly(r)} className="text-xs py-2 cursor-pointer text-blue-600 focus:text-blue-700">
                                                  <ClipboardCheck className="w-3.5 h-3.5 mr-2" /> Print Finding Report
                                                </DropdownMenuItem>
                                              ) : (
                                                <DropdownMenuItem onClick={() => handlePrintAnomaly(r)} className="text-xs py-2 cursor-pointer text-red-600 focus:text-red-700">
                                                  <AlertTriangle className="w-3.5 h-3.5 mr-2" /> Print {r.inspection_data?._meta_status || 'Defect'} Report
                                                </DropdownMenuItem>
                                              )}
                                              <div className="border-t border-slate-50 my-1"></div>
                                            </>
                                          )}
                                          <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Details</div>
                                          <DropdownMenuItem onClick={() => {
                                            const comp = (allComps || []).find((c: any) => c.id === r.component_id);
                                            if (comp) {
                                              setSelectedComp(comp);
                                              setCompSpecDialogOpen(true);
                                            }
                                          }} className="text-xs py-2 cursor-pointer">
                                            <Info className="w-3.5 h-3.5 mr-2 text-indigo-600" /> View Component Spec
                                          </DropdownMenuItem>
                                          <div className="border-t border-slate-50 my-1"></div>
                                          <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Modify</div>
                                          <DropdownMenuItem onClick={() => handleEditRecord(r)} className="text-xs py-2 cursor-pointer">
                                            <Edit className="w-3.5 h-3.5 mr-2 text-blue-600" /> Edit Record
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => handleDeleteRecord(r.insp_id)} className="text-xs py-2 cursor-pointer text-red-600 focus:text-red-700">
                                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Record
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </td>
                                );
                              case 'status':
                                return (
                                  <td key={col.id} className="px-3 py-3 align-top text-center">
                                    <div className="flex flex-col items-center gap-1.5 mt-0.5">
                                      {r.has_anomaly ? (
                                        <div title="Anomaly/Finding Found" className="flex items-center justify-center h-6 w-6 rounded-full bg-red-100">
                                          <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                                        </div>
                                      ) : r.status === 'COMPLETED' ? (
                                        <div title="Completed Inspection" className="flex items-center justify-center h-6 w-6 rounded-full bg-green-100">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                        </div>
                                      ) : (
                                        <div title="Incomplete / Draft" className="flex items-center justify-center h-6 w-6 rounded-full bg-amber-100">
                                          <FileClock className="w-3.5 h-3.5 text-amber-600" />
                                        </div>
                                      )}
                                      {(r.attachment_count > 0 || (r.insp_media && r.insp_media[0]?.count > 0)) && (
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-6 w-6 p-0 rounded-full hover:bg-blue-50 text-blue-500"
                                          onClick={async () => {
                                            const { data } = await supabase.from('attachment').select('*').eq('source_id', r.insp_id).eq('source_type', 'INSPECTION');
                                            if (data) setViewingRecordAttachments(data);
                                          }}
                                        >
                                          <Paperclip className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                );
                              case 'cr_date':
                                return (
                                  <td key={col.id} className="px-3 py-3 text-slate-600 align-top">
                                    <div className="text-sm font-medium">{r.cr_date ? format(new Date(r.cr_date), 'dd MMM') : '-'}</div>
                                    <div className="text-[10px] opacity-70 mt-0.5">{r.cr_date ? format(new Date(r.cr_date), 'HH:mm') : '-'}</div>
                                  </td>
                                );
                              case 'type':
                                return (
                                  <td key={col.id} className="px-3 py-3 font-bold text-slate-800 align-top">
                                    <div className="truncate max-w-[200px] text-sm" title={r.inspection_type?.name}>{r.inspection_type?.name || "UNK"}</div>
                                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-medium w-fit uppercase text-muted-foreground border-slate-200 shadow-none mt-1">
                                      {r.inspection_type_code || r.inspection_type?.code || 'UNK'}
                                    </Badge>
                                  </td>
                                );
                              case 'component':
                                return (
                                  <td key={col.id} className="px-3 py-3 align-top text-slate-700">
                                    <div className="font-bold text-sm">{r.structure_components?.q_id || '-'}</div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">{r.component_type || r.structure_components?.code || '-'}</div>
                                  </td>
                                );
                              case 'elev':
                                return (
                                  <td key={col.id} className="px-3 py-3 text-center text-sm font-medium text-slate-600 align-top">
                                    {r.elevation ? `${r.elevation}m` : (r.fp_kp || '-')}
                                  </td>
                                );
                              case 'anomaly_ref':
                                return (
                                  <td key={col.id} className="px-3 py-3 align-top text-slate-700">
                                    {r.insp_anomalies?.[0]?.anomaly_ref_no ? (
                                      <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">{r.insp_anomalies[0].anomaly_ref_no}</span>
                                    ) : <span className="text-slate-300">-</span>}
                                  </td>
                                );
                              case 'cp_reading':
                                return (
                                  <td key={col.id} className="px-3 py-3 text-center text-sm font-medium text-slate-600 align-top">
                                    {(() => {
                                      const cp = r.inspection_data?.cp_rdg ?? r.inspection_data?.cp_reading_mv ?? r.inspection_data?.cp;
                                      return cp ? <span className="font-mono text-xs">{cp}</span> : <span className="text-slate-300">-</span>;
                                    })()}
                                  </td>
                                );
                              case 'dive_no':
                                return (
                                  <td key={col.id} className="px-3 py-3 align-top text-slate-700">
                                    <span className="text-xs font-medium">{r.insp_dive_jobs?.job_no || r.insp_rov_jobs?.job_no || <span className="text-slate-300">-</span>}</span>
                                  </td>
                                );
                              case 'tape_no':
                                return (
                                  <td key={col.id} className="px-3 py-3 align-top text-slate-700">
                                    <span className="text-xs font-medium">{r.insp_video_tapes?.tape_no || <span className="text-slate-300">-</span>}</span>
                                    {(r.inspection_data?._meta_timecode || r.tape_count_no) && (
                                      <div className="text-[11px] font-mono font-medium text-slate-500 flex items-center gap-1.5 mt-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        {formatCounter(r.inspection_data?._meta_timecode || r.tape_count_no)}
                                      </div>
                                    )}
                                  </td>
                                );
                              default: return null;
                            }
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>,
            capturedEventsPipWindow.document.body
          )}
        </>
      )}
    </div>
  );
}
