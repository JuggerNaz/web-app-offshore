"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Box, AlertTriangle, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InspectionForm } from "../../components/InspectionForm";

interface InspectionFormPanelProps {
  selectedComp: any;
  editingRecordId: number | null;
  activeSpec: string | null;
  resetForm: () => void;
  FORM_AREA_ID: string;
  setIsAddInspOpen: (val: boolean) => void;
  activeMGIProfile: any;
  allInspectionTypes: any[];
  activeFormProps: any;
  findingType: "Incomplete" | "Finding" | "Anomaly" | "Complete";
  setFindingType: (val: "Incomplete" | "Finding" | "Anomaly" | "Complete") => void;
  renderInspectionField: (p: any, type: "primary" | "secondary") => React.ReactNode;
  dynamicProps: any;
  handleDynamicPropChange: (name: string, value: any) => void;
  anomalyData: any;
  setAnomalyData: (val: any) => void;
  defectCodes: any[];
  allDefectTypes: any[];
  availableDefectTypes: any[];
  priorities: any[];
  headerData: any;
  manualOverride: boolean;
  setManualOverride: (val: boolean) => void;
  setLastAutoMatchedRuleId: (val: string | null) => void;
  handleCommitRecord: () => void;
  handleGrabPhoto: () => void;
  isCommitting: boolean;
  vidTimer: number;
  formatTime: (sec: number) => string;
  setCompSpecDialogOpen: (val: boolean) => void;
  incompleteReason: string;
  setIncompleteReason: (val: string) => void;
  recordNotes: string;
  setRecordNotes: (val: string) => void;
  pendingAttachments: any[];
  setPendingAttachments: (atts: any[] | ((prev: any[]) => any[])) => void;
  deletedAttachmentIds: string[];
  setDeletedAttachmentIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  setEditingAttachment: (val: any) => void;
  setIsAttachmentManagerOpen: (val: boolean) => void;
  recordedFiles: any[];
  activeDep: any;
  currentMovement: string;
  tapeId: number | null;
  vidState: string;
  setShowTaskSelector: (val: boolean) => void;
  setShowCompSelector: (val: boolean) => void;
  libOptionsMap: any;
  handleDeleteRecord: (id: number) => void;
  currentRecords: any[];
  handlePrintAnomaly: (rec: any) => void;
}

export function InspectionFormPanel({
  selectedComp,
  editingRecordId,
  activeSpec,
  resetForm,
  FORM_AREA_ID,
  setIsAddInspOpen,
  activeMGIProfile,
  allInspectionTypes,
  activeFormProps,
  findingType,
  setFindingType,
  renderInspectionField,
  dynamicProps,
  handleDynamicPropChange,
  anomalyData,
  setAnomalyData,
  defectCodes,
  allDefectTypes,
  availableDefectTypes,
  priorities,
  headerData,
  manualOverride,
  setManualOverride,
  setLastAutoMatchedRuleId,
  handleCommitRecord,
  handleGrabPhoto,
  isCommitting,
  vidTimer,
  formatTime,
  setCompSpecDialogOpen,
  incompleteReason,
  setIncompleteReason,
  recordNotes,
  setRecordNotes,
  pendingAttachments,
  setPendingAttachments,
  deletedAttachmentIds,
  setDeletedAttachmentIds,
  setEditingAttachment,
  setIsAttachmentManagerOpen,
  recordedFiles,
  activeDep,
  currentMovement,
  tapeId,
  vidState,
  setShowTaskSelector,
  setShowCompSelector,
  libOptionsMap,
  handleDeleteRecord,
  currentRecords,
  handlePrintAnomaly,
}: InspectionFormPanelProps) {
  return (
    <Card className="flex flex-col h-full border-none shadow-none rounded-none bg-white dark:bg-slate-900/60 backdrop-blur-md overflow-hidden relative">
      {!selectedComp ? (
        <div className="flex-1 flex items-center justify-center flex-col text-slate-400 p-10 text-center animate-in fade-in zoom-in duration-500">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 shadow-inner">
            <Box className="w-8 h-8 opacity-20" />
          </div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">
            No Component Targeted
          </h3>
          <p className="text-[10px] font-bold text-slate-400/60 uppercase tracking-tighter max-w-[200px]">
            Please select a component from the inventory on the right to start inspection
          </p>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
          <div className="bg-slate-900 text-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] flex justify-between items-center shrink-0 border-b border-slate-800 shadow-sm z-10">
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 w-2 h-2 rounded-full animate-pulse" />
              <span>
                {editingRecordId ? "EDITING RECORD" : "NEW INSPECTION"}: {selectedComp.q_id || selectedComp.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[9px] h-4 px-2 font-black uppercase border-blue-500 text-blue-400 bg-blue-500/10 tracking-widest">
                {activeSpec || "NO SPEC"}
              </Badge>
              <button onClick={resetForm} className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white" title="Close / Reset">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div id={FORM_AREA_ID} className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950 p-3 @container">
            {!activeSpec ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center mb-3">
                    <AlertTriangle className="w-6 h-6 text-amber-500" />
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 mb-1">
                    Undefined Task
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter max-w-[220px]">
                    This component has no assigned inspection types in the current scope
                  </p>
                </div>

                <div className="flex flex-col gap-2 w-full max-w-[280px]">
                  <Button variant="outline" size="sm" onClick={() => setIsAddInspOpen(true)} className="w-full text-[10px] font-black uppercase tracking-widest h-9 bg-white dark:bg-slate-900 border-2 hover:bg-slate-50 transition-all">
                    <Plus className="w-3.5 h-3.5 mr-2" /> Add Manual Inspection
                  </Button>
                </div>
              </div>
            ) : (
              <InspectionForm
                activeMGIProfile={activeMGIProfile}
                selectedComp={selectedComp}
                activeSpec={activeSpec}
                allInspectionTypes={allInspectionTypes}
                activeFormProps={activeFormProps}
                findingType={findingType}
                setFindingType={setFindingType}
                renderInspectionField={renderInspectionField}
                dynamicProps={dynamicProps}
                handleDynamicPropChange={handleDynamicPropChange}
                isEditing={!!editingRecordId}
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
                deletedAttachmentIds={deletedAttachmentIds}
                setDeletedAttachmentIds={setDeletedAttachmentIds}
                setEditingAttachment={setEditingAttachment}
                setIsAttachmentManagerOpen={setIsAttachmentManagerOpen}
                recordedFiles={recordedFiles}
                activeDep={activeDep}
                currentMovement={currentMovement}
                tapeId={tapeId}
                vidState={vidState}
                onChangeTaskClick={() => setShowTaskSelector(true)}
                onChangeComponentClick={() => setShowCompSelector(true)}
                libOptionsMap={libOptionsMap}
                onDeleteRecord={() => editingRecordId && handleDeleteRecord(editingRecordId)}
                onPrintReport={() => {
                  const r = currentRecords.find((rec: any) => rec.insp_id === editingRecordId);
                  if (r) handlePrintAnomaly(r);
                }}
              />
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
