"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { createClient } from "@/utils/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  ClipboardCheck, 
  CheckCircle, 
  Paperclip, 
  ExternalLink,
  Save,
  RotateCcw,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { AttachmentSection } from "@/components/component/attachment-section";
import { ComponentSpecDialog } from "@/components/dialogs/component-spec-dialog";
import inspectionTypesData from "@/utils/types/inspection-types.json";

interface AnomalyDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anomaly: any;
  onSaveSuccess?: (updatedAnomaly: any) => void;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function AnomalyDetailDialog({
  open,
  onOpenChange,
  anomaly,
  onSaveSuccess
}: AnomalyDetailDialogProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [isRectifying, setIsRectifying] = useState(false);

  // Form State
  const [editDefectCode, setEditDefectCode] = useState("");
  const [editDefectType, setEditDefectType] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [rectificationNotes, setRectificationNotes] = useState("");
  const [rectifiedDate, setRectifiedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [approvedBy, setApprovedBy] = useState("");
  const [evaluatedBy, setEvaluatedBy] = useState("");

  // Library Data
  const [defectCodes, setDefectCodes] = useState<any[]>([]);
  const [priorities, setPriorities] = useState<any[]>([]);
  const [allDefectTypes, setAllDefectTypes] = useState<any[]>([]);
  const [availableDefectTypes, setAvailableDefectTypes] = useState<any[]>([]);
  
  const { data: priorityColorsData } = useSWR('/api/library/combo/ANMLYCLR', fetcher);
  const { data: apiInspectionTypes } = useSWR('/api/inspection-type?pageSize=1000', fetcher);

  // Spec Dialog State
  const [isSpecOpen, setIsSpecOpen] = useState(false);
  const [componentForSpec, setComponentForSpec] = useState<any>(null);

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

  const inspectionTypeMap = useMemo(() => {
    const map: Record<string, { name: string, mode: string }> = {};
    if (inspectionTypesData && (inspectionTypesData as any).inspectionTypes) {
      (inspectionTypesData as any).inspectionTypes.forEach((type: any) => {
        const mode = type.methods?.includes("ROV") ? "ROV" : (type.methods?.includes("DIVING") ? "Diving" : "");
        map[type.code] = { name: type.name, mode };
      });
    }
    if (apiInspectionTypes?.data) {
      apiInspectionTypes.data.forEach((type: any) => {
        const isDiving = type.metadata?.diving === 1 || type.metadata?.diving === "1" || type.metadata?.diving === true;
        const isRov = type.metadata?.rov === 1 || type.metadata?.rov === "1" || type.metadata?.rov === true || type.code?.toUpperCase().startsWith("R");
        let mode = "";
        if (isDiving && isRov) mode = "Diving/ROV";
        else if (isDiving) mode = "Diving";
        else if (isRov) mode = "ROV";
        map[type.code] = { name: type.name || type.code, mode };
      });
    }
    return map;
  }, [apiInspectionTypes]);

  useEffect(() => {
    if (open && anomaly) {
      const fetchFullData = async () => {
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from("insp_anomalies")
            .select(`
              *,
              inspection:insp_records(
                *,
                structure_components:component_id(q_id, code),
                insp_rov_jobs:rov_job_id(job_no:deployment_no),
                insp_dive_jobs:dive_job_id(job_no:dive_no),
                insp_video_tapes:tape_id(tape_no)
              )
            `)
            .eq("anomaly_id", anomaly.anomaly_id)
            .single();

          if (error) throw error;
          
          const fullAnomaly = { ...anomaly, ...data };
          
          // Initialize form fields
          setEditDefectCode(fullAnomaly.defect_type_code || "");
          setEditDefectType(fullAnomaly.defect_category_code || "");
          setEditPriority(fullAnomaly.priority_code || fullAnomaly.priority || "");
          setRectificationNotes(fullAnomaly.follow_up_notes || "");
          setRectifiedDate(fullAnomaly.rectified_date ? new Date(fullAnomaly.rectified_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
          setApprovedBy(fullAnomaly.approved_by || "");
          setEvaluatedBy(fullAnomaly.reviewed_by || "");
          
          // Update the local anomaly state with full data
          // Note: We might want to keep the original anomaly but use the full data for the UI
          setFullAnomalyState(fullAnomaly);
        } catch (e: any) {
          console.error("Error fetching full anomaly data:", e);
          toast.error("Failed to load full anomaly details");
        } finally {
          setLoading(false);
        }
      };

      fetchFullData();

      // Fetch library data if not already fetched
      const fetchLib = async () => {
        const [codesRes, priosRes, typesRes] = await Promise.all([
          supabase.from("u_lib_list").select("lib_id, lib_desc").eq("lib_code", "AMLY_COD").order("lib_desc"),
          supabase.from("u_lib_list").select("lib_id, lib_desc").eq("lib_code", "AMLY_TYP").order("lib_desc"),
          supabase.from("u_lib_list").select("lib_id, lib_desc").eq("lib_code", "AMLY_FND").order("lib_desc")
        ]);
        if (codesRes.data) setDefectCodes(codesRes.data);
        if (priosRes.data) setPriorities(priosRes.data);
        if (typesRes.data) {
          setAllDefectTypes(typesRes.data);
          setAvailableDefectTypes(typesRes.data);
        }
      };
      fetchLib();
    }
  }, [open, anomaly]);

  const [fullAnomalyState, setFullAnomalyState] = useState<any>(null);
  const currentAnomaly = fullAnomalyState || anomaly;

  // Filter Defect Types by selected Defect Code
  useEffect(() => {
    async function filterDefectTypes() {
      if (!editDefectCode) {
        setAvailableDefectTypes(allDefectTypes);
        return;
      }
      const selectedCodeItem = defectCodes.find(c => c.lib_desc === editDefectCode);
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
    if (allDefectTypes.length > 0) filterDefectTypes();
  }, [editDefectCode, defectCodes, allDefectTypes]);

  const handleSaveChanges = async () => {
    if (!anomaly) return;
    setLoading(true);
    try {
      const isModified = editDefectCode !== anomaly.defect_type_code || 
                        editDefectType !== anomaly.defect_category_code || 
                        editPriority !== (anomaly.priority_code || anomaly.priority);

      let newRefNo = anomaly.anomaly_ref_no || anomaly.display_ref_no || "";
      if (isModified && anomaly.status !== 'CLOSED') {
        if (!newRefNo.endsWith('A')) {
          if (newRefNo.endsWith('R')) newRefNo = newRefNo.slice(0, -1) + 'A';
          else newRefNo = newRefNo + 'A';
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
        .eq('anomaly_id', anomaly.anomaly_id);

      if (error) throw error;
      
      toast.success("Changes saved successfully.");
      if (onSaveSuccess) onSaveSuccess({ ...anomaly, ...payload });
    } catch (e: any) {
      toast.error(`Failed to save changes: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRectify = async () => {
    if (!anomaly) return;
    setIsRectifying(true);
    try {
      let currentRef = anomaly.anomaly_ref_no || anomaly.display_ref_no || "";
      if (currentRef.endsWith("A")) currentRef = currentRef.slice(0, -1) + "R";
      else if (!currentRef.endsWith("R")) currentRef = `${currentRef}R`;

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
        .eq("anomaly_id", anomaly.anomaly_id);

      if (error) throw error;
      
      toast.success("Anomaly Rectified & Closed");
      if (onSaveSuccess) onSaveSuccess({ ...anomaly, ...payload });
    } catch (e: any) {
      toast.error(`Error rectifying: ${e.message}`);
    } finally {
      setIsRectifying(false);
    }
  };

  const handleRollbackRectify = async () => {
    if (!anomaly) return;
    setIsRectifying(true);
    try {
      let currentRef = anomaly.anomaly_ref_no || anomaly.display_ref_no || "";
      if (currentRef.endsWith("R")) currentRef = currentRef.slice(0, -1);
      if (!currentRef.endsWith("A")) currentRef = `${currentRef}A`;

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
        .eq("anomaly_id", anomaly.anomaly_id);

      if (error) throw error;
      
      toast.success("Anomaly Re-opened");
      if (onSaveSuccess) onSaveSuccess({ ...anomaly, ...payload });
    } catch (e: any) {
      toast.error(`Error rolling back: ${e.message}`);
    } finally {
      setIsRectifying(false);
    }
  };

  const openSpecDialog = async (compId: number) => {
    try {
      const { data, error } = await supabase
        .from("structure_components")
        .select("*")
        .eq("id", compId)
        .single();
      if (error) throw error;
      setComponentForSpec(data);
      setIsSpecOpen(true);
    } catch (e: any) {
      toast.error("Failed to fetch component details");
    }
  };

  if (!currentAnomaly) return null;

  const typeCode = currentAnomaly.inspection?.inspection_type_code;
  const typeInfo = typeCode ? inspectionTypeMap[typeCode] : null;
  const boxTitle = typeInfo 
    ? `${typeInfo.name}${typeInfo.mode ? ` (${typeInfo.mode})` : ''}` 
    : (typeCode || "Inspection Details");

  const findings = currentAnomaly.defect_description || currentAnomaly.description;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card text-foreground border-border max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Anomaly Details
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Review information and rectify.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading full anomaly details...</p>
              </div>
            ) : (
              <>
                <div className="space-y-4 p-4 rounded-md border border-destructive/20 bg-destructive/5">
                  <div className="flex items-center justify-between border-b border-destructive/20 pb-2">
                    <div className="flex items-center gap-2 text-destructive font-bold text-sm uppercase tracking-wider">
                      <AlertTriangle className="h-4 w-4" />
                      Anomaly / Defect Details
                    </div>
                    {currentAnomaly.component_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openSpecDialog(currentAnomaly.component_id)}
                        className="text-primary hover:underline font-mono text-xs h-6 px-2 flex items-center gap-1 select-none"
                      >
                        QID: {currentAnomaly.component_qid || currentAnomaly.q_id || currentAnomaly.inspection?.structure_components?.q_id || "View"}
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs uppercase text-muted-foreground font-semibold">Defect Code *</Label>
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
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs uppercase text-muted-foreground font-semibold">Defect Type</Label>
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
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs uppercase text-muted-foreground font-semibold">Priority *</Label>
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
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs uppercase text-muted-foreground font-semibold">Reference No</Label>
                      <Input 
                        value={currentAnomaly.anomaly_ref_no || currentAnomaly.display_ref_no || "N/A"} 
                        readOnly 
                        className="bg-background border-border h-9"
                      />
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button 
                        size="sm"
                        onClick={handleSaveChanges}
                        disabled={loading}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs h-8"
                      >
                        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-md border border-border bg-muted/10 space-y-3 mt-4">
                  <div className="text-sm font-bold uppercase tracking-wider text-primary border-b border-border pb-1">
                    {boxTitle}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="flex justify-between border-b border-border/50 pb-1">
                      <span className="text-muted-foreground font-medium">Jobpack:</span>
                      <span className="text-foreground font-semibold truncate max-w-[150px]">{currentAnomaly.jobpack_name || currentAnomaly.inspection?.jobpack?.name || "N/A"}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/50 pb-1">
                      <span className="text-muted-foreground font-medium">SOW Report No:</span>
                      <span className="text-foreground font-semibold">{currentAnomaly.inspection?.sow_report_no || "N/A"}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/50 pb-1">
                      <span className="text-muted-foreground font-medium">Component QID:</span>
                      <span className="text-foreground font-semibold">{currentAnomaly.component_qid || currentAnomaly.q_id || currentAnomaly.inspection?.structure_components?.q_id || "N/A"}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/50 pb-1">
                      <span className="text-muted-foreground font-medium">Dive/ROV No:</span>
                      <span className="text-foreground font-semibold">
                        {currentAnomaly.inspection?.insp_dive_jobs?.job_no || currentAnomaly.inspection?.insp_rov_jobs?.job_no || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/50 pb-1">
                      <span className="text-muted-foreground font-medium">Tape No:</span>
                      <span className="text-foreground font-semibold">
                        {currentAnomaly.inspection?.insp_video_tapes?.tape_no || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/50 pb-1">
                      <span className="text-muted-foreground font-medium">Tape Counter:</span>
                      <span className="text-foreground font-semibold">
                        {currentAnomaly.inspection?.tape_count_no || "N/A"}
                      </span>
                    </div>
                  </div>
                  <div className="pt-2 text-sm">
                    <span className="text-muted-foreground font-medium block pb-1">Inspection Findings:</span>
                    <div className="p-2 bg-background border border-border rounded-md text-foreground italic">
                      "{findings || "No description provided."}"
                    </div>
                  </div>
                </div>

                {currentAnomaly.status === 'CLOSED' && (
                  <div className="p-4 rounded-md bg-emerald-500/10 border border-emerald-500/30 space-y-3 mt-4">
                    <div className="text-sm font-bold uppercase tracking-wider text-emerald-600 border-b border-emerald-500/20 pb-1 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" /> Rectification Details
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="flex justify-between border-b border-border/50 pb-1">
                        <span className="text-muted-foreground font-medium">Rectified Date:</span>
                        <span className="text-foreground font-semibold">
                          {currentAnomaly.rectified_date ? new Date(currentAnomaly.rectified_date).toLocaleDateString() : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-border/50 pb-1">
                        <span className="text-muted-foreground font-medium">Evaluated By:</span>
                        <span className="text-foreground font-semibold">{currentAnomaly.reviewed_by || "N/A"}</span>
                      </div>
                    </div>
                    {currentAnomaly.follow_up_notes && (
                      <div className="pt-2 text-sm">
                        <span className="text-muted-foreground font-medium block pb-1">Resolution Notes:</span>
                        <div className="p-2 bg-background border border-border rounded-md text-foreground italic">
                          "{currentAnomaly.follow_up_notes}"
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

                {currentAnomaly.status !== 'CLOSED' && (
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
                      Mark as Rectified (CLOSED)
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
                    <Paperclip className="h-4 w-4" /> Attachments
                  </h3>
                  <AttachmentSection 
                    sourceId={currentAnomaly.anomaly_id} 
                    sourceType="anomaly" 
                    inspectionId={currentAnomaly.inspection?.insp_id || currentAnomaly.insp_id}
                  />
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Component Spec Dialog */}
      <ComponentSpecDialog 
        open={isSpecOpen}
        onOpenChange={setIsSpecOpen}
        component={componentForSpec}
        mode="view"
      />
    </>
  );
}
