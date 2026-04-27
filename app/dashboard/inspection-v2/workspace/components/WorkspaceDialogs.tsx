import * as React from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { 
    Clock, 
    Activity, 
    X, 
    AlertTriangle, 
    Search, 
    Plus, 
    Check, 
    ChevronRight, 
    Layers, 
    Info, 
    Camera, 
    Trash2, 
    CloudUpload, 
    Paperclip, 
    FileText, 
    Video,
    History
} from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComponentSpecDialog } from "@/components/dialogs/component-spec-dialog";
import { ReportPreviewDialog } from "@/components/ReportPreviewDialog";
import { SeabedSurveyGuiInline } from "@/app/dashboard/inspection/rov/components/SeabedSurveyGuiDialog";

import DiveJobSetupDialog from "@/app/dashboard/inspection/dive/components/DiveJobSetupDialog";
import DiveMovementLog from "@/app/dashboard/inspection/dive/components/DiveMovementLog";
import ROVJobSetupDialog from "@/app/dashboard/inspection/rov/components/ROVJobSetupDialog";
import ROVMovementLog from "@/app/dashboard/inspection/rov/components/ROVMovementLog";

import { getReportHeaderData } from "@/utils/company-settings";
import { generateROVRSCORReport } from "@/utils/report-generators/rov-rscor-report";
import { generateROVAnodeReport } from "@/utils/report-generators/rov-anode-report";
import { generateROVCPReport } from "@/utils/report-generators/rov-cp-report";
import { generateROVRGVIReport } from "@/utils/report-generators/rov-rgvi-report";
import { generateROVCondSketchReport } from "@/utils/report-generators/rov-rcond-sketch-report";
import { generateROVRRISIReport } from "@/utils/report-generators/rov-rrisi-report";

interface WorkspaceDialogsProps {
    supabase: any;
    jobPackId: string | null | undefined;
    structureId: string | null | undefined;
    sowId: string | null | undefined;
    sowIdFull: string | null | undefined;
    headerData: any;
    inspMethod: "DIVING" | "ROV";
    currentRecords: any[];
    recordedFiles: any[];
    pendingAttachments: any[];
    setPendingAttachments: React.Dispatch<React.SetStateAction<any[]>>;
    
    // States
    states: {
        isDiveSetupOpen: boolean;
        isDiveSetupForNew: boolean;
        activeDep: any;
        editingEvent: any;
        lastStartEventForEdit: any;
        isMovementLogOpen: boolean;
        isEditTapeOpen: boolean;
        editTapeNo: string;
        editTapeChapter: string;
        editTapeStatus: string;
        editTapeRemarks: string;
        isNewTapeOpen: boolean;
        newTapeNo: string;
        newTapeChapter: string;
        newTapeRemarks: string;
        isCommitting: boolean;
        specDialogOpen: boolean;
        compSpecDialogOpen: boolean;
        selectedComp: any;
        previewOpen: boolean;
        previewRecord: any;
        mPreviewOpen: boolean;
        fmdPreviewOpen: boolean;
        utwtPreviewOpen: boolean;
        szciPreviewOpen: boolean;
        isGalleryOpen: boolean;
        viewingRecordAttachments: any[] | null;
        isAttachmentManagerOpen: boolean;
        findingType: string;
        anomalyData: any;
        showCriteriaConfirm: boolean;
        pendingRule: any;
        rscorPreviewOpen: boolean;
        anodePreviewOpen: boolean;
        cpPreviewOpen: boolean;
        rgviPreviewOpen: boolean;
        rcondSketchPreviewOpen: boolean;
        showRemovalConfirm: boolean;
        editingRecordId: number | null;
        pendingReclass: any;
        showTaskSelector: boolean;
        activeSpec: string | null;
        allInspectionTypes: any[];
        addTaskSearch: string;
        showCompSelector: boolean;
        compSelectorSearch: string;
        componentsSow: any[];
        allComps: any[];
        selectorShowAll: boolean;
        isSeabedGuiOpen: boolean;
        tapeId: number | null;
        vidTimer: number;
        dataAcqFields: any;
        manualOverride: boolean;
        vidState: string;
        blPreviewOpen: boolean;
        photographyPreviewOpen: boolean;
        photographyLogPreviewOpen: boolean;
        seabedPreviewOpen: boolean;
        rcondPreviewOpen: boolean;
        rcasnPreviewOpen: boolean;
        rcasnSketchPreviewOpen: boolean;
        rrisiPreviewOpen: boolean;
        jtisiPreviewOpen: boolean;
        itisiPreviewOpen: boolean;
    };
    
    // Setters
    setters: {
        setIsDiveSetupOpen: (open: boolean) => void;
        setEditingEvent: (event: any) => void;
        setLastStartEventForEdit: (event: any) => void;
        setIsMovementLogOpen: (open: boolean) => void;
        setIsEditTapeOpen: (open: boolean) => void;
        setEditTapeNo: (val: string) => void;
        setEditTapeChapter: (val: string) => void;
        setEditTapeStatus: (val: string) => void;
        setEditTapeRemarks: (val: string) => void;
        setIsNewTapeOpen: (open: boolean) => void;
        setNewTapeNo: (val: string) => void;
        setNewTapeChapter: (val: string) => void;
        setNewTapeRemarks: (val: string) => void;
        setCompSpecDialogOpen: (open: boolean) => void;
        setPreviewOpen: (open: boolean) => void;
        setMPreviewOpen: (open: boolean) => void;
        setFmdPreviewOpen: (open: boolean) => void;
        setUtwtPreviewOpen: (open: boolean) => void;
        setSzciPreviewOpen: (open: boolean) => void;
        setIsGalleryOpen: (open: boolean) => void;
        setViewingRecordAttachments: (atts: any[] | null) => void;
        setIsAttachmentManagerOpen: (open: boolean) => void;
        setShowCriteriaConfirm: (open: boolean) => void;
        setRscorPreviewOpen: (open: boolean) => void;
        setAnodePreviewOpen: (open: boolean) => void;
        setCpPreviewOpen: (open: boolean) => void;
        setRgviPreviewOpen: (open: boolean) => void;
        setRcondSketchPreviewOpen: (open: boolean) => void;
        setShowRemovalConfirm: (open: boolean) => void;
        setPendingReclass: (val: any) => void;
        setShowTaskSelector: (open: boolean) => void;
        setAddTaskSearch: (val: string) => void;
        setShowCompSelector: (open: boolean) => void;
        setCompSelectorSearch: (val: string) => void;
        setSelectorShowAll: (open: boolean) => void;
        setIsSeabedGuiOpen: (open: boolean) => void;
        setBlPreviewOpen: (open: boolean) => void;
        setPhotographyPreviewOpen: (open: boolean) => void;
        setPhotographyLogPreviewOpen: (open: boolean) => void;
        setSeabedPreviewOpen: (open: boolean) => void;
        setRcondPreviewOpen: (open: boolean) => void;
        setRcasnPreviewOpen: (open: boolean) => void;
        setRcasnSketchPreviewOpen: (open: boolean) => void;
        setRrisiPreviewOpen: (open: boolean) => void;
        setJtisiPreviewOpen: (open: boolean) => void;
        setItisiPreviewOpen: (open: boolean) => void;
    };
    
    // Handlers
    handlers: {
        handleEditEventSave: (time: string, action: string, eventTime: string) => void;
        handleSaveTapeEdit: () => void;
        handleRegisterAnomaly: () => void;
        handleConfirmRemoval: () => void;
        confirmReclassification: () => void;
        handleTaskChange: (code: string) => void;
        handleComponentSelection: (comp: any) => void;
        handleExternalFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
        handleLinkToRecord: (file: any) => void;
        syncDeploymentState: () => void;
        queryClient: any;
        generateAnomalyReportBlob: (printFriendly?: boolean) => Promise<Blob | void>;
        generateMGIReportBlob: () => Promise<Blob | void>;
        generateFMDReportBlob: () => Promise<Blob | void>;
        generateUTWTReportBlob: () => Promise<Blob | void>;
        generateSZCIReportBlob: () => Promise<Blob | void>;
    };
    
    refs: {
        fileInputRef: React.RefObject<HTMLInputElement | null>;
    };
}

export function WorkspaceDialogs({
    supabase,
    jobPackId,
    structureId,
    sowId,
    sowIdFull,
    headerData,
    inspMethod,
    currentRecords,
    recordedFiles,
    pendingAttachments,
    setPendingAttachments,
    states,
    setters,
    handlers,
    refs
}: WorkspaceDialogsProps) {
    
    const {
        isDiveSetupOpen,
        isDiveSetupForNew,
        activeDep,
        editingEvent,
        lastStartEventForEdit,
        isMovementLogOpen,
        isEditTapeOpen,
        editTapeNo,
        editTapeChapter,
        editTapeStatus,
        editTapeRemarks,
        isNewTapeOpen,
        newTapeNo,
        newTapeChapter,
        newTapeRemarks,
        isCommitting,
        compSpecDialogOpen,
        selectedComp,
        previewOpen,
        previewRecord,
        mPreviewOpen,
        fmdPreviewOpen,
        utwtPreviewOpen,
        szciPreviewOpen,
        isGalleryOpen,
        viewingRecordAttachments,
        isAttachmentManagerOpen,
        findingType,
        anomalyData,
        showCriteriaConfirm,
        pendingRule,
        rscorPreviewOpen,
        anodePreviewOpen,
        cpPreviewOpen,
        rgviPreviewOpen,
        rcondSketchPreviewOpen,
        showRemovalConfirm,
        editingRecordId,
        pendingReclass,
        showTaskSelector,
        activeSpec,
        allInspectionTypes,
        addTaskSearch,
        showCompSelector,
        compSelectorSearch,
        componentsSow,
        allComps,
        selectorShowAll,
        isSeabedGuiOpen,
        tapeId,
        vidTimer,
        dataAcqFields,
        manualOverride,
        vidState,
        blPreviewOpen,
        photographyPreviewOpen,
        photographyLogPreviewOpen,
        seabedPreviewOpen,
        rcondPreviewOpen,
        rcasnPreviewOpen,
        rcasnSketchPreviewOpen,
        rrisiPreviewOpen,
        jtisiPreviewOpen,
        itisiPreviewOpen
    } = states;

    const {
        setIsDiveSetupOpen,
        setEditingEvent,
        setLastStartEventForEdit,
        setIsMovementLogOpen,
        setIsEditTapeOpen,
        setEditTapeNo,
        setEditTapeChapter,
        setEditTapeStatus,
        setEditTapeRemarks,
        setIsNewTapeOpen,
        setNewTapeNo,
        setNewTapeChapter,
        setNewTapeRemarks,
        setCompSpecDialogOpen,
        setPreviewOpen,
        setMPreviewOpen,
        setFmdPreviewOpen,
        setUtwtPreviewOpen,
        setSzciPreviewOpen,
        setIsGalleryOpen,
        setViewingRecordAttachments,
        setIsAttachmentManagerOpen,
        setShowCriteriaConfirm,
        setRscorPreviewOpen,
        setAnodePreviewOpen,
        setCpPreviewOpen,
        setRgviPreviewOpen,
        setRcondSketchPreviewOpen,
        setShowRemovalConfirm,
        setPendingReclass,
        setShowTaskSelector,
        setAddTaskSearch,
        setShowCompSelector,
        setCompSelectorSearch,
        setSelectorShowAll,
        setIsSeabedGuiOpen,
        setBlPreviewOpen,
        setPhotographyPreviewOpen,
        setPhotographyLogPreviewOpen,
        setSeabedPreviewOpen,
        setRcondPreviewOpen,
        setRcasnPreviewOpen,
        setRcasnSketchPreviewOpen,
        setRrisiPreviewOpen,
        setJtisiPreviewOpen,
        setItisiPreviewOpen
    } = setters;

    const {
        handleEditEventSave,
        handleSaveTapeEdit,
        handleRegisterAnomaly,
        handleConfirmRemoval,
        confirmReclassification,
        handleTaskChange,
        handleComponentSelection,
        handleExternalFileUpload,
        handleLinkToRecord,
        syncDeploymentState,
        queryClient,
        generateAnomalyReportBlob,
        generateMGIReportBlob,
        generateFMDReportBlob,
        generateUTWTReportBlob,
        generateSZCIReportBlob
    } = handlers;

    const { fileInputRef } = refs;

    const parseDbDate = (dateString?: string | null): Date => {
        if (!dateString) return new Date();
        try {
            const t = dateString.replace(' ', 'T');
            const d = new Date(t);
            return isNaN(d.getTime()) ? new Date() : d;
        } catch (e) {
            return new Date();
        }
    };

    const formatTime = (secs: number) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        return [h, m, s].map(v => v < 10 ? "0" + v : v).join(":");
    };

    return (
        <>
            {isDiveSetupOpen && (
                inspMethod === "DIVING" ? (
                    <DiveJobSetupDialog
                        jobpackId={jobPackId || ""}
                        structureId={structureId || ""}
                        sowId={headerData.sowReportNo || sowIdFull || sowId || ""}
                        existingJob={isDiveSetupForNew ? null : (activeDep as any)?.raw}
                        open={isDiveSetupOpen}
                        onOpenChange={setIsDiveSetupOpen}
                        onJobCreated={(job: any) => {
                            setIsDiveSetupOpen(false);
                            window.location.reload();
                        }}
                    />
                ) : (
                    <ROVJobSetupDialog
                        jobpackId={jobPackId || ""}
                        structureId={structureId || ""}
                        sowId={headerData.sowReportNo || sowIdFull || sowId || ""}
                        existingJob={isDiveSetupForNew ? null : (activeDep as any)?.raw}
                        open={isDiveSetupOpen}
                        onOpenChange={setIsDiveSetupOpen}
                        onJobCreated={(job: any) => {
                            setIsDiveSetupOpen(false);
                            window.location.reload();
                        }}
                    />
                )
            )}

            {editingEvent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 w-[400px] border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <Clock className="w-5 h-5 text-blue-600" /> Edit Video Log
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <span className="block text-[10px] text-slate-500 uppercase font-black mb-1.5 tracking-widest">1. Wall Clock (Local Date & Time)</span>
                                <Input
                                    type="datetime-local"
                                    value={editingEvent.eventTime ? new Date(new Date(editingEvent.eventTime).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 19) : ""}
                                    onChange={e => {
                                        const localVal = e.target.value;
                                        if (!localVal) return;

                                        const d = new Date(localVal);
                                        const newIso = d.toISOString();

                                        let updatedTime = editingEvent.time;

                                        if (lastStartEventForEdit) {
                                            const startAt = parseDbDate(lastStartEventForEdit.event_time).getTime();
                                            const nowAt = d.getTime();
                                            const diffSecs = Math.max(0, Math.floor((nowAt - startAt) / 1000));
                                            updatedTime = formatTime((lastStartEventForEdit.tape_counter_start || 0) + diffSecs);
                                        }

                                        setEditingEvent({ ...editingEvent, eventTime: newIso, time: updatedTime, referenceNo: '' });
                                    }}
                                    className="font-mono font-bold bg-blue-50/30 border-blue-100 focus:ring-blue-500"
                                />
                                <p className="text-[10px] text-blue-500 mt-1.5 italic font-medium">Counter auto-calculates as you change the time.</p>
                            </div>
                            <div>
                                <span className="block text-[10px] text-slate-500 uppercase font-black mb-1.5 tracking-widest">2. Video Counter (Timecode)</span>
                                <Input
                                    value={editingEvent.time}
                                    onChange={e => setEditingEvent({ ...editingEvent, time: e.target.value })}
                                    className="font-mono font-black text-blue-700 bg-slate-50 border-slate-200"
                                />
                            </div>
                            <div>
                                <span className="block text-[10px] text-slate-500 uppercase font-black mb-1.5 tracking-widest">3. Action / Status Event</span>
                                <Input
                                    value={editingEvent.action}
                                    onChange={e => setEditingEvent({ ...editingEvent, action: e.target.value })}
                                    className="font-bold uppercase bg-slate-50 border-slate-200"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-8 justify-end">
                            <Button variant="outline" onClick={() => { setEditingEvent(null); setLastStartEventForEdit(null); }} className="font-bold h-11 px-6">Cancel</Button>
                            <Button className="bg-blue-600 text-white hover:bg-blue-700 font-bold h-11 px-6 shadow-lg shadow-blue-500/20" onClick={() => {
                                handleEditEventSave(editingEvent.time, editingEvent.action, editingEvent.eventTime);
                                setEditingEvent(null);
                                setLastStartEventForEdit(null);
                            }}>Update Event</Button>
                        </div>
                    </div>
                </div>
            )}

            {isMovementLogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-auto py-10">
                    <div className="bg-white rounded-lg w-[800px] shadow-2xl animate-in zoom-in-95 my-auto shrink-0 relative">
                        <div className="flex justify-between items-center px-6 py-4 border-b pb-4">
                            <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-blue-600" /> {inspMethod === "DIVING" ? "Dive Movements & Checklists" : "ROV Movements & Log"}
                            </h2>
                            <button onClick={() => {
                                setIsMovementLogOpen(false);
                                if (activeDep) {
                                    setEditingEvent(null); // Just to trigger a re-render if needed
                                }
                            }} className="rounded-full p-1.5 hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
                        </div>
                        <div className="p-6">
                            {inspMethod === "DIVING" ? (
                                <DiveMovementLog diveJob={(activeDep as any)?.raw} />
                            ) : (
                                <ROVMovementLog diveJob={(activeDep as any)?.raw} />
                            )}
                        </div>
                    </div>
                </div>
            )}

            <Dialog open={isEditTapeOpen} onOpenChange={setIsEditTapeOpen}>
                <DialogContent className="max-w-md bg-white border-2 border-blue-100 shadow-2xl p-0 overflow-hidden">
                    <DialogHeader className="p-4 bg-slate-900 text-white space-y-1">
                        <DialogTitle className="text-xs font-bold uppercase tracking-widest opacity-80 mb-0">Tape Management</DialogTitle>
                        <DialogDescription className="text-sm font-black text-white/90">Edit Tape Details</DialogDescription>
                    </DialogHeader>
                    <div className="p-5 space-y-5 bg-white">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Video Tape Number / Name</Label>
                                <Input 
                                    value={editTapeNo} 
                                    onChange={(e) => setEditTapeNo(e.target.value.toUpperCase())}
                                    placeholder="Enter tape reference..."
                                    className="h-11 text-sm font-bold bg-slate-50 border-slate-200 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Chapter No.</Label>
                                    <Input 
                                        type="number"
                                        value={editTapeChapter} 
                                        onChange={(e) => setEditTapeChapter(e.target.value)}
                                        className="h-11 text-sm font-bold bg-slate-50 border-slate-200 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all"
                                    />
                                    <p className="text-[9px] text-amber-600 font-bold italic mt-1 leading-tight">
                                        Note: Adjust this if you want to maintain a previous numbering sequence.
                                    </p>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Status</Label>
                                    <Select value={editTapeStatus} onValueChange={setEditTapeStatus}>
                                        <SelectTrigger className="h-11 text-sm font-bold bg-slate-50 border-slate-200">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ACTIVE" className="font-bold text-xs">ACTIVE</SelectItem>
                                            <SelectItem value="COMPLETED" className="font-bold text-xs">COMPLETED</SelectItem>
                                            <SelectItem value="ARCHIVED" className="font-bold text-xs">ARCHIVED</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Tape Remarks</Label>
                                <Input 
                                    value={editTapeRemarks} 
                                    onChange={(e) => setEditTapeRemarks(e.target.value)}
                                    placeholder="Optional notes..."
                                    className="h-11 text-sm font-bold bg-slate-50 border-slate-200 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="outline"
                                className="flex-1 h-11 text-[11px] font-black uppercase tracking-widest border-slate-200 hover:bg-slate-50 text-slate-500"
                                onClick={() => setIsEditTapeOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 h-11 text-[11px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20"
                                onClick={handleSaveTapeEdit}
                                disabled={isCommitting || !editTapeNo}
                            >
                                {isCommitting ? <X className="w-4 h-4 animate-spin" /> : "Save Changes"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isNewTapeOpen} onOpenChange={setIsNewTapeOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Create New Tape</DialogTitle>
                        <DialogDescription>
                            Create a new video tape sequence for the current {inspMethod === 'DIVING' ? 'dive' : 'ROV'} deployment.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="ws_new_tape_no" className="text-right text-sm font-semibold">Tape No</Label>
                            <Input
                                id="ws_new_tape_no"
                                value={newTapeNo}
                                onChange={(e) => setNewTapeNo(e.target.value)}
                                className="col-span-3 font-mono"
                                placeholder="e.g. RPT-001 / PLAT-C / V001D"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="ws_new_tape_chapter" className="text-right text-sm font-semibold">Chapter</Label>
                            <Input
                                id="ws_new_tape_chapter"
                                value={newTapeChapter}
                                onChange={(e) => setNewTapeChapter(e.target.value)}
                                className="col-span-3"
                                placeholder="e.g. 1"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="ws_new_tape_remarks" className="text-right text-sm font-semibold">Remarks</Label>
                            <Input
                                id="ws_new_tape_remarks"
                                value={newTapeRemarks}
                                onChange={(e) => setNewTapeRemarks(e.target.value)}
                                className="col-span-3"
                                placeholder="Optional notes"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsNewTapeOpen(false)}>Cancel</Button>
                        <Button
                            onClick={async () => {
                                if (!newTapeNo) { toast.error("Tape number is required"); return; }
                                if (!activeDep?.id) { toast.error("No active deployment selected"); return; }
                                try {
                                    const { data: { user } } = await supabase.auth.getUser();
                                    const depCol = inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id';
                                    const payload: any = {
                                        tape_no: newTapeNo,
                                        status: 'ACTIVE',
                                        tape_type: 'DIGITAL - PRIMARY',
                                        cr_user: user?.id || 'system',
                                        chapter_no: parseInt(newTapeChapter) || 1,
                                        remarks: newTapeRemarks || null,
                                        [depCol]: Number(activeDep.id),
                                    };
                                    const { data: createdTape, error } = await supabase
                                        .from('insp_video_tapes')
                                        .insert(payload)
                                        .select('*')
                                        .single();
                                    if (error) throw error;
                                    toast.success(`Tape "${newTapeNo}" created successfully`);
                                    setIsNewTapeOpen(false);
                                    window.location.reload(); // Hard refresh to update parent state safely
                                } catch (err: any) {
                                    console.error("Failed to create tape:", err);
                                    toast.error("Failed to create tape: " + (err.message || "Unknown error"));
                                }
                            }}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            Create Tape
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!viewingRecordAttachments} onOpenChange={(open) => !open && setViewingRecordAttachments(null)}>
                <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Paperclip className="w-5 h-5 text-blue-600" />
                            Record Attachments
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto mt-4 pr-2">
                        {viewingRecordAttachments && viewingRecordAttachments.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {viewingRecordAttachments.map((att: any) => {
                                    const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(att.path);
                                    return (
                                        <Card key={att.id} className="overflow-hidden border-slate-200 group flex flex-col bg-slate-50">
                                            <div className="aspect-video bg-slate-900 flex items-center justify-center text-white relative">
                                                {(!att.meta?.type || att.meta.type === 'PHOTO') ? (
                                                    <img src={publicUrl} className="w-full h-full object-contain cursor-pointer" onClick={() => window.open(publicUrl, '_blank')} title={att.name} />
                                                ) : (
                                                    <div className="flex flex-col items-center gap-2 opacity-60">
                                                        {att.meta.type === 'VIDEO' ? <Video className="w-10 h-10" /> : <FileText className="w-10 h-10" />}
                                                        <span className="text-[10px] uppercase font-bold tracking-widest">{att.meta.type}</span>
                                                    </div>
                                                )}
                                                <div className="absolute inset-x-0 bottom-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                                                    <Button size="sm" variant="secondary" className="w-full text-[10px] h-7 font-black uppercase tracking-wider" onClick={() => window.open(publicUrl, '_blank')}>Open Fullsize</Button>
                                                </div>
                                            </div>
                                            <div className="p-3 flex-1 flex flex-col gap-1 bg-white">
                                                <div className="text-[10px] font-black text-slate-800 uppercase tracking-tight line-clamp-2 leading-[1.3]">{att.name}</div>
                                                {att.meta?.description && <div className="text-[9px] text-slate-500 font-medium italic border-l-2 border-slate-200 pl-2 mt-0.5">{att.meta.description}</div>}
                                                <div className="mt-auto pt-2 text-[8px] text-slate-400 font-black uppercase tracking-widest flex items-center justify-between border-t border-slate-50">
                                                    <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">SOURCE: {att.source_type}</span>
                                                    {att.created_at && <span>{new Date(att.created_at).toLocaleDateString()}</span>}
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="h-40 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                                <Paperclip className="w-8 h-8 mb-2 opacity-20" />
                                <span className="text-[10px] font-black uppercase tracking-widest">No attachments found</span>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isAttachmentManagerOpen} onOpenChange={setIsAttachmentManagerOpen}>
                <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-6 bg-white overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                             <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-500/20">
                                <Camera className="w-4 h-4 text-white" />
                             </div>
                            <span className="font-black uppercase tracking-widest text-slate-800">Media Management</span>
                        </DialogTitle>
                        <DialogDescription className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Session Attachments & External Uploads</DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex-1 min-h-0 mt-6 flex flex-col gap-5 overflow-hidden">
                        {pendingAttachments.length > 0 && (
                            <div className="flex-shrink-0 bg-blue-50/30 border border-blue-100 rounded-xl p-3">
                                <h4 className="text-[10px] font-black uppercase text-blue-700 tracking-widest mb-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Paperclip className="w-3 h-3" /> {pendingAttachments.length} Pending Attachments
                                    </div>
                                    <span className="text-[8px] bg-blue-100 px-2 py-0.5 rounded-full">Final Review</span>
                                </h4>
                                <ScrollArea className="h-40">
                                    <div className="flex gap-4 pb-4 px-1">
                                        {pendingAttachments.map((att) => (
                                            <div key={att.id} className="w-56 flex-shrink-0 bg-white border border-slate-200 rounded-xl p-2 relative group shadow-sm hover:shadow-md transition-all">
                                                <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden mb-3 border border-slate-50">
                                                    {att.previewUrl ? (
                                                        <img src={att.previewUrl} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="h-full flex items-center justify-center bg-slate-50">
                                                            <FileText className="w-6 h-6 text-slate-300" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="space-y-2.5">
                                                    <div>
                                                        <Label className="text-[8px] font-black uppercase text-blue-600 tracking-widest ml-1 mb-1 block">Attachment Title</Label>
                                                        <Input 
                                                            value={att.title} 
                                                            onChange={(e) => setPendingAttachments(prev => prev.map(a => a.id === att.id ? { ...a, title: e.target.value } : a))}
                                                            className="h-8 text-[11px] font-black border-slate-100 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/5 transition-all shadow-none placeholder:text-slate-300"
                                                            placeholder="Enter Title..."
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[8px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-1 block">Remark / Observation</Label>
                                                        <Input 
                                                            value={att.description} 
                                                            onChange={(e) => setPendingAttachments(prev => prev.map(a => a.id === att.id ? { ...a, description: e.target.value } : a))}
                                                            className="h-8 text-[10px] font-medium border-slate-100 bg-slate-50 focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-500/5 transition-all italic shadow-none placeholder:text-slate-300"
                                                            placeholder="Add detail..."
                                                        />
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => setPendingAttachments(prev => prev.filter(a => a.id !== att.id))} 
                                                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl hover:bg-black transition-all hover:scale-110 active:scale-90 border-2 border-white"
                                                    title="Remove Attachment"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>
                        )}

                        <div className="flex-1 grid grid-cols-4 gap-6 overflow-hidden min-h-0">
                            <div className="col-span-1 flex flex-col gap-3">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest pl-1">External Media</Label>
                                <Button 
                                    variant="outline" 
                                    className="flex-1 border-dashed border-2 flex flex-col items-center justify-center gap-3 hover:bg-blue-50/50 hover:border-blue-300 transition-all border-slate-200 bg-slate-50/50 rounded-2xl group"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
                                        <CloudUpload className="w-6 h-6 text-blue-500" />
                                    </div>
                                    <div className="text-center">
                                        <div className="text-[10px] font-black uppercase text-slate-700">Upload Files</div>
                                        <div className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Images or Videos</div>
                                    </div>
                                    <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleExternalFileUpload} accept="image/*,video/*" />
                                </Button>
                            </div>

                            <div className="col-span-3 flex flex-col gap-3 overflow-hidden min-h-0">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center justify-between pl-1">
                                    <span>Stream Session Grabs</span>
                                    <span className="bg-slate-100 px-2 py-0.5 rounded-full text-[9px] text-slate-400 font-bold">{recordedFiles.filter(f => f.type === 'photo').length} Found</span>
                                </Label>
                                <ScrollArea className="flex-1 border border-slate-100 rounded-2xl bg-slate-50/20 p-4">
                                    <div className="grid grid-cols-3 gap-4 pb-4">
                                        {recordedFiles.filter(f => f.type === 'photo').length === 0 ? (
                                            <div className="col-span-3 h-48 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-xl space-y-2">
                                                <Camera className="w-8 h-8 opacity-20" />
                                                <span className="text-[10px] font-black uppercase tracking-widest italic opacity-50">No stream snapshots captured yet</span>
                                            </div>
                                        ) : recordedFiles.filter(f => f.type === 'photo').map((file) => {
                                            const isSelected = pendingAttachments.some(a => a.previewUrl === file.url);
                                            return (
                                                <div 
                                                    key={file.id} 
                                                    onClick={() => {
                                                        if (isSelected) setPendingAttachments(prev => prev.filter(a => a.previewUrl !== file.url));
                                                        else {
                                                            const isAnomaly = findingType === 'Anomaly';
                                                            const isFinding = findingType === 'Finding';
                                                            const prefix = isAnomaly ? 'Anomaly - ' : (isFinding ? 'Findings - ' : '');
                                                            const refNo = anomalyData.referenceNo || 'Draft';
                                                            setPendingAttachments(prev => [...prev, {
                                                                id: Math.random().toString(36).substr(2, 9),
                                                                file: file.blob,
                                                                name: file.name,
                                                                type: 'PHOTO',
                                                                title: prefix ? `${prefix}${refNo}` : file.name,
                                                                description: '',
                                                                source: 'LIVE_SNAPSHOT',
                                                                previewUrl: file.url,
                                                                isFromRecording: true
                                                            }]);
                                                        }
                                                    }}
                                                    className={`relative aspect-video rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${isSelected ? 'border-blue-600 ring-4 ring-blue-500/10 shadow-xl shadow-blue-500/10 scale-[0.98]' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                                                >
                                                    <img src={file.url} className="w-full h-full object-cover" />
                                                    {isSelected && (
                                                        <div className="absolute inset-0 bg-blue-600/10 flex items-center justify-center">
                                                            <div className="bg-blue-600 text-white rounded-full p-1 shadow-lg border-2 border-white scale-125">
                                                                <Check className="w-3.5 h-3.5" />
                                                            </div>
                                                        </div>
                                                    )}
                                                    {!isSelected && (
                                                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur-sm border border-white/20">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 mt-6 flex justify-between items-center border-t border-slate-100">
                         <div className="flex items-center gap-3">
                            <div className="bg-slate-100 rounded-full px-4 py-2 border border-slate-200">
                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{pendingAttachments.length} Selected</span>
                            </div>
                            {pendingAttachments.length > 0 && <span className="text-[10px] font-bold text-amber-500 animate-pulse">Set titles & descriptions above â†‘</span>}
                         </div>
                        <Button 
                            className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-[0.15em] px-12 h-12 rounded-full shadow-2xl shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] text-[11px]" 
                            onClick={() => setIsAttachmentManagerOpen(false)}
                        >
                            Sync with Record
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <ComponentSpecDialog
                open={compSpecDialogOpen}
                onOpenChange={setCompSpecDialogOpen}
                component={selectedComp?.raw}
                mode="view"
            />

            <Dialog open={showCriteriaConfirm} onOpenChange={setShowCriteriaConfirm}>
                <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Defect Criteria Alert</DialogTitle>
                        <DialogDescription>Confirm if the current observation matches defect criteria.</DialogDescription>
                    </DialogHeader>
                    <div className="bg-red-600 p-4 flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-sm">Automated Defect Alert</h3>
                            <p className="text-white/80 text-[10px] uppercase tracking-wider font-medium">Verification Required</p>
                        </div>
                    </div>
                    <div className="p-5 space-y-4 bg-white">
                        <div className="bg-red-50 p-3 rounded-md border border-red-100 mb-4 space-y-2">
                            <div className="text-xs font-bold text-red-800 uppercase tracking-widest flex items-center justify-between">
                                <span>Defect Alert</span>
                                {pendingRule?.referenceNo && <span className="bg-red-100 px-1.5 py-0.5 rounded">Ref: {pendingRule.referenceNo}</span>}
                            </div>
                            <div className="text-xs font-medium text-red-700 leading-relaxed">
                                {pendingRule?.alertMessage || "Defect criteria exceeded."}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="outline"
                                className="flex-1 h-10 text-xs font-bold border-slate-200 hover:bg-slate-50 transition-all text-slate-600 uppercase tracking-wide"
                                onClick={() => {
                                    setShowCriteriaConfirm(false);
                                }}
                            >
                                Dismiss Alert
                            </Button>
                            <Button
                                className="flex-1 h-10 text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-100 transition-all uppercase tracking-wide"
                                onClick={handleRegisterAnomaly}
                            >
                                Register Anomaly
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <ReportPreviewDialog 
                open={rscorPreviewOpen} 
                onOpenChange={setRscorPreviewOpen} 
                generateReport={async (isPrintFriendly, showSignatures) => {
                    const scourRecords = currentRecords.filter(r => r.inspection_type_code === 'RSCOR' || r.inspection_type?.code === 'RSCOR');
                    const settings = await getReportHeaderData();
                    const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
                    let contractorLogoUrl = '';
                    if (jobPack?.metadata?.contrac) {
                        const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
                        contractorLogoUrl = contrData?.lib_path || '';
                    }

                    return await generateROVRSCORReport(
                        scourRecords,
                        { 
                            ...headerData, 
                            contractorLogoUrl,
                            vessel: headerData.vessel
                        },
                        { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
                        {
                            jobPackId: Number(jobPackId),
                            structureId: Number(structureId),
                            sowReportNo: headerData.sowReportNo,
                            preparedBy: { name: "Inspector", date: new Date().toLocaleDateString() },
                            returnBlob: true,
                            printFriendly: isPrintFriendly,
                            showSignatures
                        }
                    );
                }}
                title="ROV Scour Survey Report (RSCOR)"
                fileName={`ROV_Scour_Survey_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}`}
            />

            <ReportPreviewDialog 
                open={anodePreviewOpen} 
                onOpenChange={setAnodePreviewOpen} 
                generateReport={async (isPrintFriendly, showSignatures) => {
                    const settings = await getReportHeaderData();
                    const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
                    
                    const { data: allRecords } = await supabase
                        .from('insp_records')
                        .select(`
                            *,
                            inspection_type:inspection_type_id!left(id, code, name),
                            structure_components:component_id!left(id, q_id, code, metadata),
                            insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                            insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                            insp_anomalies(*)
                        `)
                        .eq('structure_id', Number(structureId))
                        .eq('sow_report_no', headerData.sowReportNo);

                    const anodeRecords = (allRecords || []).filter((r: any) => {
                        const isRGVI = (r.inspection_type?.code || '').toUpperCase() === 'RGVI';
                        const isAN = (r.structure_components?.code || '').toUpperCase() === 'AN' || 
                                     (r.structure_components?.metadata?.type || '').toUpperCase() === 'ANODE';
                        return isRGVI && isAN;
                    });

                    let contractorLogoUrl = '';
                    if (jobPack?.metadata?.contrac) {
                        try {
                            const cRes = await fetch(`/api/library/CONTR_NAM`);
                            const cJson = await cRes.json();
                            const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack?.metadata?.contrac));
                            if (found?.logo_url) contractorLogoUrl = found.logo_url;
                        } catch (e) { console.error("Logo fetch error", e); }
                    }

                    const headerDataObj = {
                        ...headerData,
                        vessel: headerData.vessel,
                        contractorLogoUrl
                    };

                    return await generateROVAnodeReport(
                        anodeRecords,
                        headerDataObj,
                        { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
                        { printFriendly: isPrintFriendly, returnBlob: true, showSignatures }
                    );
                }}
                title="ROV Anode Inspection Report"
                fileName={`ROV_Anode_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}`}
            />

            <ReportPreviewDialog
                open={cpPreviewOpen}
                onOpenChange={setCpPreviewOpen}
                generateReport={async (isPrintFriendly, showSignatures) => {
                    const settings = await getReportHeaderData();
                    const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
                    
                    const { data: allRecords } = await supabase
                        .from('insp_records')
                        .select(`
                            *,
                            inspection_type:inspection_type_id!left(id, code, name),
                            structure_components:component_id!left(id, q_id, code, metadata),
                            insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                            insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                            insp_anomalies(*)
                        `)
                        .eq('structure_id', Number(structureId))
                        .eq('sow_report_no', headerData.sowReportNo);

                    const cpRecords = (allRecords || []).filter((r: any) => {
                        const d = r.inspection_data || {};
                        return d.cp_rdg !== undefined || d.cp_reading_mv !== undefined || d.cp !== undefined;
                    });

                    let contractorLogoUrl = '';
                    if (jobPack?.metadata?.contrac) {
                        try {
                            const cRes = await fetch(`/api/library/CONTR_NAM`);
                            const cJson = await cRes.json();
                            const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack?.metadata?.contrac));
                            if (found?.logo_url) contractorLogoUrl = found.logo_url;
                        } catch (e) { console.error("Logo fetch error", e); }
                    }

                    return await generateROVCPReport(
                        cpRecords,
                        {
                            ...headerData,
                            contractorLogoUrl,
                            vessel: headerData.vessel
                        },
                        { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
                        {
                            jobPackId: Number(jobPackId),
                            structureId: Number(structureId),
                            sowReportNo: headerData.sowReportNo,
                            preparedBy: { name: 'Inspector', date: format(new Date(), 'dd MMM yyyy') },
                            returnBlob: true,
                            printFriendly: isPrintFriendly,
                            showPageNumbers: true,
                            showSignatures
                        }
                    );
                }}
                title="ROV CP Survey Report"
                fileName={`ROV_CP_Survey_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}`}
            />

            <ReportPreviewDialog
                open={rgviPreviewOpen}
                onOpenChange={setRgviPreviewOpen}
                generateReport={async (isPrintFriendly, showSignatures) => {
                    const settings = await getReportHeaderData();
                    const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
                    
                    const { data: allRecords } = await supabase
                        .from('insp_records')
                        .select(`
                            *,
                            inspection_type:inspection_type_id!left(id, code, name),
                            structure_components:component_id!left(id, q_id, code, metadata),
                            insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                            insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                            insp_anomalies(*)
                        `)
                        .eq('structure_id', Number(structureId))
                        .eq('sow_report_no', headerData.sowReportNo);

                    const rgviRecords = (allRecords || []).filter((r: any) =>
                        (r.inspection_type?.code || '').toUpperCase() === 'RGVI'
                    );

                    let contractorLogoUrl = '';
                    if (jobPack?.metadata?.contrac) {
                        try {
                            const cRes = await fetch(`/api/library/CONTR_NAM`);
                            const cJson = await cRes.json();
                            const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack?.metadata?.contrac));
                            if (found?.logo_url) contractorLogoUrl = found.logo_url;
                        } catch (e) { console.error("Logo fetch error", e); }
                    }

                    return await generateROVRGVIReport(
                        rgviRecords,
                        {
                            ...headerData,
                            contractorLogoUrl,
                            vessel: headerData.vessel
                        },
                        { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
                        {
                            jobPackId: Number(jobPackId),
                            structureId: Number(structureId),
                            sowReportNo: headerData.sowReportNo,
                            preparedBy: { name: 'Inspector', date: format(new Date(), 'dd MMM yyyy') },
                            returnBlob: true,
                            printFriendly: isPrintFriendly,
                            showPageNumbers: true,
                            showSignatures
                        }
                    );
                }}
                title="ROV GVI Report (RGVI)"
                fileName={`ROV_GVI_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}`}
            />

            <ReportPreviewDialog
                open={rcondSketchPreviewOpen}
                onOpenChange={setRcondSketchPreviewOpen}
                generateReport={async (isPrintFriendly, showSignatures) => {
                    const settings = await getReportHeaderData();
                    const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
                    
                    const { data: allRecords } = await supabase
                        .from('insp_records')
                        .select(`
                            *,
                            inspection_type:inspection_type_id(id, code, name),
                            structure_components:component_id(id, q_id, code, metadata),
                            insp_rov_jobs:rov_job_id(job_no:deployment_no),
                            insp_anomalies(*)
                        `)
                        .eq('structure_id', Number(structureId))
                        .eq('sow_report_no', headerData.sowReportNo);

                    const condRecords = (allRecords || []); 

                    let contractorLogoUrl = '';
                    if (jobPack?.metadata?.contrac) {
                        try {
                            const cRes = await fetch(`/api/library/CONTR_NAM`);
                            const cJson = await cRes.json();
                            const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack?.metadata?.contrac));
                            if (found?.logo_url) contractorLogoUrl = found.logo_url;
                        } catch (e) { console.error("Logo fetch error", e); }
                    }

                    const headerDataObj = {
                        ...headerData,
                        vessel: headerData.vessel,
                        contractorLogoUrl
                    };

                    return await generateROVCondSketchReport(
                        condRecords.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                        headerDataObj,
                        { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
                        {
                            jobPackId: Number(jobPackId),
                            structureId: Number(structureId),
                            sowReportNo: headerData.sowReportNo,
                            preparedBy: { name: 'Inspector', date: new Date().toLocaleDateString() },
                            returnBlob: true,
                            printFriendly: isPrintFriendly,
                            showSignatures
                        }
                    );
                }}
                title="ROV Conductor Survey (Sketch) Report"
                fileName={`ROV_Conductor_Sketch_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}`}
            />

            <Dialog open={showRemovalConfirm} onOpenChange={setShowRemovalConfirm}>
                <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden border-none shadow-2xl">
                    <DialogHeader className="bg-amber-500 p-4 flex-row items-center gap-3 space-y-0">
                        <div className="bg-white/20 p-2 rounded-lg shrink-0">
                            <AlertTriangle className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                            <DialogTitle className="text-white font-bold text-sm">Value No Longer Meets Criteria</DialogTitle>
                            <DialogDescription className="text-white/80 text-[10px] uppercase tracking-wider font-medium">Anomaly / Finding Review Required</DialogDescription>
                        </div>
                    </DialogHeader>
                    <div className="p-5 space-y-4 bg-white">
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                            The entered value has been corrected and no longer triggers the defect criteria. What would you like to do with the registered {findingType === 'Finding' ? 'finding' : 'anomaly'}?
                        </p>
                        {(() => {
                            const recordRow = editingRecordId ? currentRecords.find(r => r.insp_id === editingRecordId) : null;
                            const hasNewerAnomalies = recordRow ? currentRecords.some(r =>
                                r.has_anomaly &&
                                r.insp_id !== editingRecordId &&
                                (new Date(r.inspection_date) > new Date(recordRow.inspection_date) ||
                                    (r.inspection_date === recordRow.inspection_date && r.inspection_time > recordRow.inspection_time))
                            ) : false;
                            const isNewRecord = !editingRecordId;

                            return (
                                <>
                                    {!isNewRecord && hasNewerAnomalies && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-[10px] text-amber-800 font-medium">
                                            <strong className="uppercase tracking-wider">âš  Cannot Delete:</strong> Subsequent anomalies exist after this record. The anomaly will be <strong>rectified</strong> with priority set to <strong>NONE</strong> to preserve event sequence numbering.
                                        </div>
                                    )}
                                    {(isNewRecord || !hasNewerAnomalies) && (
                                        <div className="bg-green-50 border border-green-200 rounded-md p-3 text-[10px] text-green-800 font-medium">
                                            <strong className="uppercase tracking-wider">âœ“ Safe to Remove:</strong> {isNewRecord ? 'This is a new record â€” the anomaly data will be cleared.' : 'This is the latest anomaly â€” it can be safely deleted.'}
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="outline"
                                className="flex-1 h-10 text-xs font-bold border-slate-200 hover:bg-slate-50 transition-all text-slate-600 uppercase tracking-wide"
                                onClick={() => {
                                    setShowRemovalConfirm(false);
                                }}
                            >
                                Keep As-Is
                            </Button>
                            <Button
                                className="flex-1 h-10 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-100 transition-all uppercase tracking-wide"
                                onClick={handleConfirmRemoval}
                            >
                                {(() => {
                                    const recordRow = editingRecordId ? currentRecords.find(r => r.insp_id === editingRecordId) : null;
                                    const hasNewerAnomalies = recordRow ? currentRecords.some(r =>
                                        r.has_anomaly &&
                                        r.insp_id !== editingRecordId &&
                                        (new Date(r.inspection_date) > new Date(recordRow.inspection_date) ||
                                            (r.inspection_date === recordRow.inspection_date && r.inspection_time > recordRow.inspection_time))
                                    ) : false;
                                    return (!editingRecordId || !hasNewerAnomalies) ? 'Remove & Reset' : 'Rectify (Priority: NONE)';
                                })()}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!pendingReclass} onOpenChange={() => setPendingReclass(null)}>
                <DialogContent className="max-w-md bg-white border-2 border-amber-200">
                    <DialogHeader>
                        <div className="flex items-center gap-2 text-amber-600 mb-2">
                            <AlertTriangle className="w-6 h-6" />
                            <DialogTitle className="text-lg font-bold uppercase tracking-tight">Warning: Data Impact</DialogTitle>
                        </div>
                        <DialogDescription className="text-slate-600 font-medium">
                            Changing the {pendingReclass?.type === 'COMPONENT' ? 'Component' : 'Task Type'} while editing an existing record will hide fields not present in the new specification.
                        </DialogDescription>
                    </DialogHeader>

                    {pendingReclass?.orphanedFields && pendingReclass.orphanedFields.length > 0 && (
                        <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-100">
                            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-2">Impacted Fields (Will be archived):</p>
                            <div className="flex flex-wrap gap-2">
                                {pendingReclass.orphanedFields.map((f: string) => (
                                    <span key={f} className="px-2 py-1 bg-white border border-amber-200 text-amber-800 text-[10px] font-bold rounded shadow-sm">
                                        {f.replace(/_/g, ' ').toUpperCase()}
                                    </span>
                                ))}
                            </div>
                            <p className="mt-3 text-[10px] text-amber-600 leading-relaxed italic">
                                Note: These fields are not lost. They are moved to an archive column and will be restored automatically if you switch back to the original specification.
                            </p>
                        </div>
                    )}

                    <div className="mt-6 flex gap-3">
                        <Button variant="outline" className="flex-1 font-bold text-slate-500 border-slate-200" onClick={() => setPendingReclass(null)}>
                            CANCEL
                        </Button>
                        <Button className="flex-1 font-bold bg-amber-600 hover:bg-amber-700 text-white" onClick={confirmReclassification}>
                            CONFIRM CHANGE
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showTaskSelector} onOpenChange={(open) => {
                setShowTaskSelector(open);
            }}>
                <DialogContent className="max-w-sm bg-white p-0 overflow-hidden border-2 border-blue-100 shadow-2xl">
                    <DialogHeader className="p-4 bg-blue-600 text-white space-y-1">
                        <DialogTitle className="text-xs font-bold uppercase tracking-widest opacity-80 mb-0">Re-classify Task</DialogTitle>
                        <DialogDescription className="text-sm font-black text-white/90">Change Specification for {selectedComp?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto bg-slate-50">
                        <div>
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">SOW Tasks</h3>
                            <div className="space-y-1.5">
                                {selectedComp?.taskStatuses
                                    ?.filter((ts: any) => {
                                        const it = allInspectionTypes.find(type => type.code === ts.code);
                                        if (!it) return true;
                                        if (inspMethod === 'DIVING') return it.metadata?.diving === 1;
                                        if (inspMethod === 'ROV') return it.metadata?.rov === 1;
                                        return true;
                                    })
                                    .map((ts: any) => (
                                        <button 
                                            key={ts.code} 
                                            onClick={() => handleTaskChange(ts.code)}
                                            className={`w-full text-left p-3 rounded-lg border flex justify-between items-center transition-all ${
                                                activeSpec === ts.code 
                                                ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-sm' 
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50/30'
                                            }`}
                                        >
                                            <span className="font-bold text-xs uppercase tracking-wide">{ts.code}</span>
                                            {activeSpec === ts.code && <Check className="w-4 h-4" />}
                                        </button>
                                    ))}
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Add Selection from Library</h3>
                            <div className="relative mb-2">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <Input 
                                    placeholder="Search library..." 
                                    className="pl-8 h-8 text-[11px] font-bold bg-white border-slate-200"
                                    value={addTaskSearch}
                                    onChange={(e) => setters.setAddTaskSearch(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                {allInspectionTypes
                                    .filter(it => {
                                        const isInSow = selectedComp?.tasks?.includes(it.code);
                                        if (isInSow) return false;
                                        const matchesSearch = it.name.toLowerCase().includes(addTaskSearch.toLowerCase()) || 
                                                            it.code.toLowerCase().includes(addTaskSearch.toLowerCase());
                                        if (!matchesSearch) return false;
                                        if (inspMethod === 'DIVING') return it.metadata?.diving === 1;
                                        if (inspMethod === 'ROV') return it.metadata?.rov === 1;
                                        return true;
                                    })
                                    .slice(0, 10)
                                    .map((it: any) => (
                                        <button 
                                            key={it.id} 
                                            onClick={() => {
                                                handleTaskChange(it.code);
                                                setters.setAddTaskSearch("");
                                            }}
                                            className="w-full text-left p-2.5 rounded border border-dashed border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 text-slate-500 hover:text-blue-600 transition-all group"
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-[11px] uppercase tracking-wide">{it.name}</span>
                                                <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                            <p className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter leading-none mt-0.5">{it.code}</p>
                                        </button>
                                    ))}
                            </div>
                        </div>
                    </div>
                    <div className="p-3 bg-white border-t border-slate-100 flex justify-end">
                        <Button variant="ghost" className="text-xs font-bold text-slate-400" onClick={() => {
                            setShowTaskSelector(false);
                        }}>CLOSE</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog 
                open={showCompSelector} 
                onOpenChange={(open) => {
                    setShowCompSelector(open);
                    if (!open) {
                        setters.setSelectorShowAll(false);
                    }
                }}
            >
                <DialogContent className="max-w-md bg-white p-0 overflow-hidden border-2 border-blue-100 shadow-2xl">
                    <DialogHeader className="p-4 bg-blue-600 text-white space-y-1">
                        <DialogTitle className="text-xs font-bold uppercase tracking-widest opacity-80">Re-classify Component</DialogTitle>
                        <DialogDescription className="text-sm font-black text-white p-0 m-0">Transfer Record to Another Component</DialogDescription>
                    </DialogHeader>
                    <div className="p-3 bg-slate-50 border-b border-slate-200">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input 
                                placeholder="Search Component Name..." 
                                className="pl-9 h-10 bg-white border-slate-200 text-sm font-bold focus-visible:ring-blue-500"
                                value={compSelectorSearch}
                                onChange={(e) => setters.setCompSelectorSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="p-2 space-y-1 max-h-[50vh] overflow-y-auto bg-white">
                        <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 mb-1 rounded">SOW Items</div>
                        {componentsSow
                            .filter(c => {
                                let tasksToFilter = c.taskStatuses?.map((ts: any) => ts.code) || c.tasks || [];
                                const hasValidTask = tasksToFilter.some((tCode: string) => {
                                    const it = (allInspectionTypes || []).find((type: any) => type.code === tCode || type.name === tCode);
                                    if (!it) return true;
                                    const isRov = it.metadata?.rov === 1 || it.metadata?.rov === "1" || it.metadata?.rov === true || (it.metadata?.job_type && it.metadata.job_type.includes("ROV"));
                                    const isDiving = it.metadata?.diving === 1 || it.metadata?.diving === "1" || it.metadata?.diving === true || (it.metadata?.job_type && it.metadata.job_type.includes("DIVING"));
                                    if (inspMethod === "DIVING" && isDiving) return true;
                                    if (inspMethod === "ROV" && isRov) return true;
                                    return false;
                                });
                                if (!hasValidTask) return false;
                                return JSON.stringify(c).toLowerCase().includes(compSelectorSearch.toLowerCase());
                            })
                            .map((c: any) => (
                                <button 
                                    key={c.id} 
                                    onClick={() => {
                                        handleComponentSelection(c);
                                        setShowCompSelector(false);
                                        setters.setCompSelectorSearch("");
                                    }}
                                    className={`w-full text-left px-4 py-3 rounded-md flex justify-between items-center transition-all ${
                                        selectedComp?.id === c.id 
                                        ? 'bg-blue-50 border border-blue-200 text-blue-700' 
                                        : 'hover:bg-slate-50 text-slate-600'
                                    }`}
                                >
                                    <div>
                                        <p className="font-black text-xs uppercase tracking-wide">{c.name}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase leading-tight mt-0.5">{c.type || 'Structure Item'}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-blue-50 text-blue-600 border-blue-100 font-bold">SOW</Badge>
                                        {selectedComp?.id === c.id ? <Check className="w-4 h-4" /> : <ChevronRight className="w-4 h-4 text-slate-300" />}
                                    </div>
                                </button>
                            ))}

                        {selectorShowAll ? (
                            <>
                                <div className="mt-4 px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 mb-1 rounded">Platform Library (Non-SOW)</div>
                                {allComps
                                    .filter(c => {
                                        const isInSow = componentsSow.some(sc => sc.id === c.id);
                                        return !isInSow && JSON.stringify(c).toLowerCase().includes(compSelectorSearch.toLowerCase());
                                    })
                                    .map((c: any) => (
                                        <button 
                                            key={c.id} 
                                            onClick={() => {
                                                handleComponentSelection(c);
                                                setShowCompSelector(false);
                                                setters.setCompSelectorSearch("");
                                            }}
                                            className="w-full text-left px-4 py-3 rounded-md flex justify-between items-center hover:bg-slate-50 text-slate-600 transition-all"
                                        >
                                            <div>
                                                <p className="font-black text-xs uppercase tracking-wide">{c.name}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase leading-tight mt-0.5">{c.type || 'Structure Item'}</p>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-slate-300" />
                                        </button>
                                    ))}
                            </>
                        ) : (
                            <div className="mt-4 p-4 text-center">
                                <p className="text-[11px] text-slate-400 font-bold mb-2">Cant find the QID? Show all platform components.</p>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 text-[10px] font-black border-dashed border-slate-300 text-slate-500 hover:text-blue-600 hover:border-blue-300"
                                    onClick={() => setters.setSelectorShowAll(true)}
                                >
                                    <Layers className="w-3.5 h-3.5 mr-1.5" /> SHOW ALL COMPONENTS
                                </Button>
                            </div>
                        )}
                    </div>
                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                        <div className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            {selectorShowAll ? "Showing full platform library" : "Showing SOW components only"}
                        </div>
                        <Button variant="ghost" className="text-xs font-bold text-slate-400" onClick={() => { 
                            setShowCompSelector(false); 
                            setters.setCompSelectorSearch(""); 
                            setters.setSelectorShowAll(false); 
                        }}>CANCEL</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {isSeabedGuiOpen && (
                <div className="fixed inset-0 z-[100] bg-black/60 p-6 flex flex-col items-center justify-center backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-[1400px] h-full max-h-[92vh] flex flex-col bg-slate-50 shadow-2xl rounded-xl overflow-hidden ring-1 ring-slate-900/10 relative">
                        <SeabedSurveyGuiInline 
                            open={isSeabedGuiOpen}
                            onClose={() => setIsSeabedGuiOpen(false)}
                            jobpackId={jobPackId || "0"}
                            structureId={structureId || "0"}
                            sowRecordId={sowId ? Number(sowId) : null}
                            sowReportNo={headerData?.sowReportNo}
                            rovJob={activeDep || undefined}
                            tapeId={tapeId?.toString()}
                            tapeCounter={vidTimer?.toString()} 
                            telemetryData={dataAcqFields}
                            isStreamRecording={manualOverride || vidState !== "IDLE"}
                            isStreamPaused={!manualOverride && vidState === "PAUSED"}
                            onRefreshInspection={() => {
                                syncDeploymentState();
                                queryClient.invalidateQueries({ queryKey: ['inspection-records'] });
                            }}
                        />
                    </div>
                </div>
            )}

            <ReportPreviewDialog 
                open={previewOpen} 
                onOpenChange={setPreviewOpen} 
                title="Anomaly Report Preview" 
                fileName={`Anomaly_Report_${previewRecord?.anomaly_ref_no || 'Draft'}`} 
                generateReport={generateAnomalyReportBlob} 
            />
            <ReportPreviewDialog 
                open={mPreviewOpen} 
                onOpenChange={setMPreviewOpen} 
                title="ROV MGI Survey Report Preview" 
                fileName={`ROV_MGI_Report_${headerData.sowReportNo}`} 
                generateReport={handlers.generateMGIReportBlob} 
            />
            <ReportPreviewDialog 
                open={fmdPreviewOpen} 
                onOpenChange={setFmdPreviewOpen} 
                title="ROV FMD Survey Report Preview" 
                fileName={`ROV_FMD_Report_${headerData.sowReportNo}`} 
                generateReport={handlers.generateFMDReportBlob} 
            />
            <ReportPreviewDialog 
                open={utwtPreviewOpen} 
                onOpenChange={setUtwtPreviewOpen} 
                title="ROV UTWT Survey Report Preview" 
                fileName={`ROV_UTWT_Report_${headerData.sowReportNo}`} 
                generateReport={handlers.generateUTWTReportBlob} 
            />
            <ReportPreviewDialog 
                open={szciPreviewOpen} 
                onOpenChange={setSzciPreviewOpen} 
                title="ROV SZCI Survey Report Preview" 
                fileName={`ROV_SZCI_Report_${headerData.sowReportNo}`} 
                generateReport={handlers.generateSZCIReportBlob} 
            />

            <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
                <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col p-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="w-5 h-5 text-blue-600" />
                            Session Media Gallery
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 min-h-0">
                        {recordedFiles.length === 0 ? (
                            <div className="h-40 flex items-center justify-center text-slate-400 font-medium italic border-2 border-dashed border-slate-100 rounded-xl">
                                No media captured in this session yet...
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto p-1 pr-4">
                                {recordedFiles.map((file) => (
                                    <Card key={file.id} className="overflow-hidden border-slate-200 group relative">
                                        <div className="aspect-video bg-slate-900 flex items-center justify-center text-white relative">
                                            {file.type === 'video' ? (
                                                <video src={file.url} className="w-full h-full object-cover" />
                                            ) : (
                                                <img src={file.url} className="w-full h-full object-cover" />
                                            )}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <Button size="sm" variant="secondary" onClick={() => window.open(file.url)} className="h-8 text-xs font-bold">Open</Button>
                                                <Button size="sm" className="h-8 text-xs font-bold bg-blue-600" onClick={() => handleLinkToRecord(file)}>Link to Session</Button>
                                            </div>
                                            <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 rounded text-[9px] font-bold uppercase tracking-wider">
                                                {file.type}
                                            </div>
                                        </div>
                                        <div className="p-2 border-t border-slate-100">
                                            <p className="text-[10px] font-bold truncate text-slate-700">{file.name}</p>
                                            <p className="text-[9px] text-slate-400 mt-0.5">{new Date(file.timestamp).toLocaleTimeString()}</p>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <ReportPreviewDialog 
                open={states.blPreviewOpen} 
                onOpenChange={setters.setBlPreviewOpen} 
                title="ROV Boatlanding Report Preview" 
                fileName={`ROV_Boatlanding_Report_${headerData.sowReportNo}`} 
                generateReport={async () => {
                    // Placeholder or actual generator
                }} 
            />

            <ReportPreviewDialog 
                open={states.photographyPreviewOpen} 
                onOpenChange={setters.setPhotographyPreviewOpen} 
                title="ROV Photography Report Preview" 
                fileName={`ROV_Photography_Report_${headerData.sowReportNo}`} 
                generateReport={async () => {
                    // Placeholder or actual generator
                }} 
            />

            <ReportPreviewDialog 
                open={states.photographyLogPreviewOpen} 
                onOpenChange={setters.setPhotographyLogPreviewOpen} 
                title="ROV Photography Log Preview" 
                fileName={`ROV_Photography_Log_${headerData.sowReportNo}`} 
                generateReport={async () => {
                    // Placeholder or actual generator
                }} 
            />

            <ReportPreviewDialog 
                open={states.seabedPreviewOpen} 
                onOpenChange={setters.setSeabedPreviewOpen} 
                title="Seabed Survey Report Preview" 
                fileName={`Seabed_Survey_Report_${headerData.sowReportNo}`} 
                generateReport={async () => {
                    // Placeholder or actual generator
                }} 
            />

            <ReportPreviewDialog 
                open={states.rcondPreviewOpen} 
                onOpenChange={setters.setRcondPreviewOpen} 
                title="ROV Conductor Survey Report" 
                fileName={`ROV_Conductor_Report_${headerData.sowReportNo}`} 
                generateReport={async () => {
                    // Placeholder or actual generator
                }} 
            />

            <ReportPreviewDialog 
                open={states.rcasnPreviewOpen} 
                onOpenChange={setters.setRcasnPreviewOpen} 
                title="ROV Caisson Survey Report" 
                fileName={`ROV_Caisson_Report_${headerData.sowReportNo}`} 
                generateReport={async () => {
                    // Placeholder or actual generator
                }} 
            />

            <ReportPreviewDialog 
                open={states.rcasnSketchPreviewOpen} 
                onOpenChange={setters.setRcasnSketchPreviewOpen} 
                title="ROV Caisson Survey (Sketch) Report" 
                fileName={`ROV_Caisson_Sketch_Report_${headerData.sowReportNo}`} 
                generateReport={async () => {
                    // Placeholder or actual generator
                }} 
            />

            <ReportPreviewDialog 
                open={states.rrisiPreviewOpen} 
                onOpenChange={setters.setRrisiPreviewOpen} 
                title="ROV Riser Inspection Report" 
                fileName={`ROV_Riser_Report_${headerData.sowReportNo}`} 
                generateReport={async () => {
                    // Placeholder or actual generator
                }} 
            />

            <ReportPreviewDialog 
                open={states.jtisiPreviewOpen} 
                onOpenChange={setters.setJtisiPreviewOpen} 
                title="ROV J-Tube Inspection Report" 
                fileName={`ROV_JTube_Report_${headerData.sowReportNo}`} 
                generateReport={async () => {
                    // Placeholder or actual generator
                }} 
            />

            <ReportPreviewDialog 
                open={states.itisiPreviewOpen} 
                onOpenChange={setters.setItisiPreviewOpen} 
                title="ROV I-Tube Inspection Report" 
                fileName={`ROV_ITube_Report_${headerData.sowReportNo}`} 
                generateReport={async () => {
                    // Placeholder or actual generator
                }} 
            />
        </>
    );
}
