"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Box, AlertTriangle, Plus, X, ChevronRight, CheckCircle2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import inspectionSpecs from "@/utils/types/inspection-types.json";
import { InspectionForm } from "../../components/InspectionForm";

interface InspectionFormPanelProps {
  inspMethod?: "DIVING" | "ROV";
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
  jobTapes?: any[];
  originalRecordContext?: any;
  tapeNo?: string;
  activeChapter?: number;
  deployments?: any[];
  vidState: string;
  handleTaskChange: (code: string) => void;
  setShowTaskSelector: (val: boolean) => void;
  setShowCompSelector: (val: boolean) => void;
  libOptionsMap: any;
  handleDeleteRecord: (id: number) => void;
  handleDeleteTaskFromScope: (code: string, compId: number) => void;
  currentRecords: any[];
  handlePrintAnomaly: (rec: any) => void;
  validateAnomalyRef: (ref: string) => Promise<boolean>;
  setPrevRefNo: (val: string) => void;
  criteriaRules?: any[];
  onVoiceActionCommand?: (actionIntent: any) => void;
  calculateAutoCounter?: (targetDate?: string, targetTime?: string, targetTapeId?: number | null, targetChapterNo?: number | string | null, targetTapeNo?: string | null) => number | null;
}

export function InspectionFormPanel({
  inspMethod,
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
  jobTapes = [],
  originalRecordContext,
  tapeNo,
  activeChapter = 1,
  deployments = [],
  vidState,
  handleTaskChange,
  handleDeleteTaskFromScope,
  setShowTaskSelector,
  setShowCompSelector,
  libOptionsMap,
  handleDeleteRecord,
  currentRecords,
  handlePrintAnomaly,
  validateAnomalyRef,
  setPrevRefNo,
  criteriaRules = [],
  onVoiceActionCommand,
  calculateAutoCounter,
}: InspectionFormPanelProps) {
  const isEditing = Boolean(editingRecordId);

  const displayDiveNo = (() => {
    if (dynamicProps?.dive_no) return String(dynamicProps.dive_no);
    if (isEditing && originalRecordContext) {
      return (
        originalRecordContext.dive_no ||
        originalRecordContext.deployment_no ||
        originalRecordContext.raw?.insp_dive_jobs?.job_no ||
        originalRecordContext.raw?.insp_dive_jobs?.dive_no ||
        originalRecordContext.raw?.insp_rov_jobs?.job_no ||
        originalRecordContext.raw?.insp_rov_jobs?.deployment_no ||
        deployments?.find((d: any) => String(d.id) === String(originalRecordContext.dive_job_id || originalRecordContext.rov_job_id))?.deployment_no ||
        deployments?.find((d: any) => String(d.id) === String(originalRecordContext.dive_job_id || originalRecordContext.rov_job_id))?.dive_no ||
        activeDep?.deployment_no ||
        activeDep?.dive_no ||
        activeDep?.job_no ||
        "-"
      );
    }
    return activeDep?.deployment_no || activeDep?.dive_no || activeDep?.job_no || "-";
  })();

  const displayTapeNo = (() => {
    if (dynamicProps?.tape_no) return String(dynamicProps.tape_no);
    if (isEditing && originalRecordContext) {
      return (
        originalRecordContext.tape_no ||
        originalRecordContext.raw?.insp_video_tapes?.tape_no ||
        jobTapes?.find((t: any) => t.tape_id === originalRecordContext.tape_id)?.tape_no ||
        tapeNo ||
        "-"
      );
    }
    return tapeNo || jobTapes?.find((t: any) => t.tape_id === tapeId)?.tape_no || "-";
  })();

  const displayChapter = (() => {
    if (dynamicProps?.chapter_no !== undefined && dynamicProps?.chapter_no !== null && dynamicProps?.chapter_no !== "") {
      return String(dynamicProps.chapter_no);
    }
    if (isEditing && originalRecordContext) {
      const ch = (
        originalRecordContext.chapter_no ??
        originalRecordContext.raw?.insp_video_tapes?.chapter_no ??
        originalRecordContext.raw?.chapter_no ??
        originalRecordContext.raw?.inspection_data?.chapter_no ??
        originalRecordContext.raw?.inspection_data?.chapter ??
        jobTapes?.find((t: any) => t.tape_id === originalRecordContext.tape_id)?.chapter_no
      );
      return ch !== undefined && ch !== null ? String(ch) : "1";
    }
    return activeChapter !== undefined && activeChapter !== null ? String(activeChapter) : "1";
  })();

  return (
    <Card className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-none rounded-none shadow-none overflow-hidden">
      {!selectedComp ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-6 shadow-sm border border-blue-100 dark:border-blue-800/50">
            <Box className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 mb-2">No Component Selected</h3>
          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter max-w-[240px] leading-relaxed">
            Select a structural component from the list or 3D model to begin or review an inspection.
          </p>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
          <div className="bg-slate-900 text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider flex justify-between items-center shrink-0 border-b border-slate-800 shadow-sm z-10 gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="bg-blue-600 w-2 h-2 rounded-full animate-pulse shrink-0" />
              <span className="truncate font-black tracking-widest text-slate-200">
                {editingRecordId ? "EDITING RECORD" : "NEW INSPECTION"}: {selectedComp.q_id || selectedComp.name}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-[9px] h-4 px-2 font-black uppercase border-blue-500 text-blue-400 bg-blue-500/10 tracking-widest">
                {(() => {
                  if (!activeSpec) return "NO SPEC";
                  const codeClean = activeSpec.toUpperCase().trim();
                  const jsonSpec = (inspectionSpecs?.inspectionTypes || []).find((t: any) => (t.code || '').toUpperCase().trim() === codeClean);
                  let rawName = jsonSpec?.name;
                  if (!rawName) {
                    const specObj = (allInspectionTypes || []).find((t: any) => (t.code || '').toUpperCase().trim() === codeClean);
                    rawName = specObj?.name || activeSpec;
                  }
                  return (rawName || '').replace(/^ROV\s+/i, '');
                })()}
              </Badge>
              <button onClick={resetForm} className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white" title="Close / Reset">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div id={FORM_AREA_ID} className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950 p-3 @container">
            {!activeSpec ? (
              <div className="flex flex-col items-center py-10 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
                <div className="text-center mb-8">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-1">
                    Select Scope to Inspect ({selectedComp.name})
                  </h2>
                </div>

                <div className="w-full max-w-lg space-y-3">
                  {(selectedComp.taskStatuses || []).map((ts: any) => {
                    const isCompleted = ts.status === 'completed';
                    const rawSpecName = allInspectionTypes?.find(t => t.code === ts.code)?.name || ts.code;
                    const specName = (rawSpecName || '').replace(/^ROV\s+/i, '');

                    return (
                      <div key={ts.code} className="flex items-center gap-3 group">
                        <button 
                          onClick={() => handleTaskChange(ts.code)}
                          className={`flex-1 flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                            isCompleted 
                            ? 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30 hover:border-emerald-200 dark:hover:border-emerald-800/50' 
                            : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                              {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />}
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className={`font-black text-xs uppercase tracking-tight ${isCompleted ? 'text-emerald-700 dark:text-emerald-400' : 'text-blue-700 dark:text-blue-400'}`}>
                                  {specName}
                                </span>
                                <Badge variant="outline" className="text-[9px] font-black bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:bg-blue-300 border-blue-200 dark:border-blue-800/50 px-1.5 h-4">
                                  {ts.code}
                                </Badge>
                              </div>
                              <span className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${isCompleted ? 'text-emerald-500' : 'text-slate-400'}`}>
                                {ts.status || 'PENDING'}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className={`w-5 h-5 transition-transform group-hover:translate-x-1 ${isCompleted ? 'text-emerald-400' : 'text-slate-300'}`} />
                        </button>
                        <button 
                          onClick={() => handleDeleteTaskFromScope(ts.code, selectedComp.id)}
                          className="p-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-300 hover:text-red-500 hover:border-red-200 hover:bg-red-50/50 transition-all"
                          title="Remove from component scope"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}

                  <div className="pt-6">
                    <button 
                      onClick={() => setShowTaskSelector(true)}
                      className="w-full py-5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center gap-3 text-slate-400 dark:text-slate-500 hover:border-blue-300 hover:bg-blue-50/30 hover:text-blue-600 transition-all group"
                    >
                      <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-black uppercase tracking-widest">Add Additional Inspection Type</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <InspectionForm
                inspMethod={inspMethod}
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
                jobTapes={jobTapes}
                originalRecordContext={originalRecordContext}
                tapeNo={tapeNo}
                activeChapter={activeChapter}
                deployments={deployments}
                vidState={vidState}
                onChangeTaskClick={() => setShowTaskSelector(true)}
                onChangeComponentClick={() => setShowCompSelector(true)}
                libOptionsMap={libOptionsMap}
                onDeleteRecord={() => editingRecordId && handleDeleteRecord(editingRecordId)}
                onPrintReport={() => {
                  const r = currentRecords.find((rec: any) => rec.insp_id === editingRecordId);
                  if (r) handlePrintAnomaly(r);
                }}
                validateAnomalyRef={validateAnomalyRef}
                setPrevRefNo={setPrevRefNo}
                criteriaRules={criteriaRules}
                onVoiceActionCommand={onVoiceActionCommand}
                calculateAutoCounter={calculateAutoCounter}
              />
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
