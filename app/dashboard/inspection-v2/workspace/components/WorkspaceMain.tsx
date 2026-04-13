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
    Trash2 
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
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
    setFindingType: (type: "Pass" | "Anomaly" | "Finding" | "Incomplete") => void;
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
    
    // Event Table Props
    capturedEventsPipWindow: Window | null;
    handlePopoutCapturedEvents: () => void;
    sortedRecords: any[];
    sortConfig: { key: string; direction: 'asc' | 'desc' };
    handleSort: (key: string) => void;
    handleEditRecord: (record: any) => void;
    handleDeleteRecord: (id: number) => void;
    setViewingRecordAttachments: (atts: any[]) => void;
    handlePrintAnomaly: (record: any) => void;
    allComps: any[];
    setSelectedComp: (comp: any) => void;
    
    // Helpers
    renderInspectionField: (field: any, type: 'primary' | 'secondary') => React.ReactNode;
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
    findingType: "Pass" | "Anomaly" | "Finding" | "Incomplete";
}

export function WorkspaceMain(props: WorkspaceMainProps) {
    const {
        selectedComp, activeSpec, allInspectionTypes, currentRecords,
        headerData, inspMethod, vidState, vidTimer, tapeId, jobTapes,
        setActiveSpec, setDynamicProps, handleDynamicPropChange, setFindingType, setRecordNotes,
        setAnomalyData, setIsManualOverride, setIsUserInteraction,
        handleAddNewInspectionSpec, handleCommitRecord, resetForm,
        handleGrabPhoto, isCommitting, formatTime, setCompSpecDialogOpen,
        incompleteReason, setIncompleteReason, recordNotes,
        pendingAttachments, setPendingAttachments, setIsAttachmentManagerOpen,
        recordedFiles, activeDep, currentMovement, setShowTaskSelector,
        setShowCompSelector, editingRecordId, capturedEventsPipWindow,
        handlePopoutCapturedEvents, sortedRecords, sortConfig, handleSort,
        handleEditRecord, handleDeleteRecord, setViewingRecordAttachments,
        handlePrintAnomaly, allComps, setSelectedComp, renderInspectionField,
        anomalyData, defectCodes, allDefectTypes, availableDefectTypes,
        priorities, manualOverride, setManualOverride, setLastAutoMatchedRuleId,
        isAddInspOpen, setIsAddInspOpen, inspectionTypeSearch, setInspectionTypeSearch,
        findingType
    } = props;

    const FORM_AREA_ID = "workspace-form-area";

    return (
        <div className="flex-1 flex flex-col gap-3 min-w-[500px] overflow-hidden">
            <Card className="flex flex-col flex-1 border-slate-200 shadow-sm rounded-md bg-white overflow-hidden relative">
                {!selectedComp ? (
                    <div className="flex-1 flex items-center justify-center flex-col text-slate-400 p-10 text-center">
                        <Activity className="w-12 h-12 mb-4 opacity-30 text-blue-500" />
                        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2">Awaiting Target Selection</h2>
                        <p className="text-xs max-w-[280px]">Please select a component from the right column (List or 3D view) to review history and begin logging inspection scopes.</p>
                    </div>
                ) : (
                    <div id={FORM_AREA_ID} className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
                        {!activeSpec ? (
                            <div className="p-5 flex flex-col items-center justify-center text-center h-full">
                                <div className="w-full max-w-2xl flex flex-col items-center">
                                    <div className="text-[11px] font-bold uppercase text-slate-400 tracking-widest mb-4">Select Scope to Inspect ({selectedComp.name})</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                                        {selectedComp.tasks && selectedComp.tasks.map((t: string) => {
                                            const taskStatus = selectedComp.taskStatuses?.find((ts: any) => ts.code === t);
                                            const status = taskStatus?.status || 'pending';
                                            const isCompleted = status === 'completed';
                                            const isIncomplete = status === 'incomplete';
                                            
                                            const taskRecords = currentRecords.filter((r: any) => 
                                                (r.inspection_type?.code === t || r.inspection_type_code === t) && 
                                                r.component_id === selectedComp.id
                                            );

                                            const hasAnomaly = taskRecords.some((r: any) => r.has_anomaly && r.inspection_data?._meta_status !== 'Finding');
                                            const hasFinding = taskRecords.some((r: any) => r.has_anomaly && r.inspection_data?._meta_status === 'Finding');
                                            const isRectified = taskRecords.some((r: any) => r.has_anomaly && r.insp_anomalies?.[0]?.status === 'CLOSED');
                                            const it = allInspectionTypes.find(type => type.code === t || type.name === t);
                                            
                                            const statusColor = hasAnomaly && !isRectified ? 'red' :
                                                               hasFinding ? 'orange' :
                                                               isRectified ? 'teal' :
                                                               isCompleted ? 'green' :
                                                               isIncomplete ? 'amber' : 'blue';

                                            const statusLabel = hasAnomaly && !isRectified ? 'Anomaly Registered' :
                                                               hasFinding ? 'Finding Registered' :
                                                               isRectified ? 'Rectified' :
                                                               isCompleted ? 'Completed' :
                                                               isIncomplete ? 'Incomplete' : 'Pending';
                                            
                                            return (
                                                <Button key={t} onClick={() => {
                                                    setActiveSpec(t);
                                                    const newProps: Record<string, any> = {};
                                                    if (selectedComp.nominalThk && selectedComp.nominalThk !== '-') {
                                                        const specProps = it?.default_properties || [];
                                                        let propsList: any[] = [];
                                                        if (typeof specProps === 'string') {
                                                            try {
                                                                const parsed = JSON.parse(specProps);
                                                                propsList = Array.isArray(parsed) ? parsed : (parsed.properties || []);
                                                            } catch (e) { }
                                                        } else if (Array.isArray(specProps)) {
                                                            propsList = specProps;
                                                        }

                                                        const ntField = propsList.find((p: any) => 
                                                            String(p.label || p.name || '').toLowerCase().includes('nominal thickness') ||
                                                            String(p.label || p.name || '').toLowerCase() === 'nt'
                                                        );
                                                        if (ntField) {
                                                            newProps[ntField.name || ntField.label] = selectedComp.nominalThk;
                                                        }
                                                    }
                                                    setDynamicProps(newProps);
                                                    setFindingType("Pass");
                                                    setRecordNotes("");
                                                    setAnomalyData({defectCode: '', priority: '', defectType: '', description: '', recommendedAction: '',
                                                        rectify: false, rectifiedDate: '', rectifiedRemarks: '', severity: 'Minor', referenceNo: '' });
                                                    setManualOverride(false);
                                                    setIsUserInteraction(false);
                                                }} className={`w-full h-14 bg-white border font-bold shadow-sm flex justify-between items-center group transition-all ${
                                                    statusColor === 'green' ? 'border-green-200 hover:bg-green-50/50' :
                                                    statusColor === 'red' ? 'border-red-200 hover:bg-red-50/30' :
                                                    statusColor === 'orange' ? 'border-orange-200 hover:bg-orange-50/30' :
                                                    statusColor === 'teal' ? 'border-teal-200 hover:bg-teal-50/30' :
                                                    statusColor === 'amber' ? 'border-amber-200 hover:bg-amber-50/30' :
                                                    'border-blue-200 hover:bg-blue-50'
                                                }`}>
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`w-3 h-3 rounded-full flex items-center justify-center shrink-0 ${
                                                            statusColor === 'green' ? 'bg-green-500' :
                                                            statusColor === 'red' ? 'bg-red-500 animate-pulse' :
                                                            statusColor === 'orange' ? 'bg-orange-500' :
                                                            statusColor === 'teal' ? 'bg-teal-500' :
                                                            statusColor === 'amber' ? 'bg-amber-500' :
                                                            'bg-slate-300'
                                                        }`}>
                                                            {statusColor === 'green' && <Check className="w-2 h-2 text-white" />}
                                                            {(statusColor === 'red' || statusColor === 'orange') && <AlertTriangle className="w-2 h-2 text-white" />}
                                                        </div>
                                                        <div className="flex flex-col items-start overflow-hidden flex-1 max-w-[170px]">
                                                            <div className="flex items-baseline gap-1.5 w-full text-left truncate">
                                                                <span className={`text-sm font-bold truncate ${
                                                                    statusColor === 'green' ? 'text-green-700' :
                                                                    statusColor === 'red' ? 'text-red-700' :
                                                                    statusColor === 'orange' ? 'text-orange-700' :
                                                                    statusColor === 'teal' ? 'text-teal-700' :
                                                                    statusColor === 'amber' ? 'text-amber-700' :
                                                                    'text-blue-700'
                                                                }`} title={it?.name || t}>
                                                                    {it?.name || t}
                                                                </span>
                                                                <span className={`text-[9px] font-mono px-1 py-0.5 rounded-md shrink-0 border ${
                                                                    statusColor === 'green' ? 'bg-green-50 border-green-200 text-green-700' :
                                                                    statusColor === 'red' ? 'bg-red-50 border-red-200 text-red-700' :
                                                                    statusColor === 'orange' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                                                                    statusColor === 'teal' ? 'bg-teal-50 border-teal-200 text-teal-700' :
                                                                    statusColor === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                                                    'bg-blue-50 border-blue-200 text-blue-700'
                                                                }`}>
                                                                    {it?.code || t}
                                                                </span>
                                                            </div>
                                                            <span className={`text-[9px] mt-0.5 font-medium uppercase tracking-wider ${
                                                                statusColor === 'green' ? 'text-green-500' :
                                                                statusColor === 'red' ? 'text-red-500' :
                                                                statusColor === 'orange' ? 'text-orange-500' :
                                                                statusColor === 'teal' ? 'text-teal-500' :
                                                                statusColor === 'amber' ? 'text-amber-500' :
                                                                'text-slate-400'
                                                            }`}>
                                                                {statusLabel}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <ArrowRight className={`w-4 h-4 ${
                                                        statusColor === 'green' ? 'text-green-300' :
                                                        statusColor === 'red' ? 'text-red-300' :
                                                        statusColor === 'orange' ? 'text-orange-300' :
                                                        statusColor === 'amber' ? 'text-amber-300' :
                                                        'text-blue-300'
                                                    }`} />
                                                </Button>
                                            );
                                        })}
                                    </div>
                                    <div className="w-full max-w-[350px] space-y-3 mt-4">
                                        <div className="py-2"><Separator /></div>
                                        <Popover open={isAddInspOpen} onOpenChange={setIsAddInspOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className="w-full h-12 border-dashed border-2 text-slate-500 font-bold hover:border-blue-400 hover:bg-blue-50/30 flex items-center justify-center gap-2"
                                                >
                                                    <Plus className="w-4 h-4" /> Add Additional Inspection Type
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[350px] p-0 shadow-2xl border-slate-200" align="center" side="top">
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
                                                                .filter(it => {
                                                                    const isRov = it.metadata?.rov === 1 || it.metadata?.rov === "1" || it.metadata?.rov === true || it.metadata?.job_type?.includes('ROV');
                                                                    const isDiving = it.metadata?.diving === 1 || it.metadata?.diving === "1" || it.metadata?.diving === true || it.metadata?.job_type?.includes('DIVING');
                                                                    if (inspMethod === 'DIVING' && !isDiving) return false;
                                                                    if (inspMethod === 'ROV' && !isRov) return false;
                                                                    if (inspectionTypeSearch) {
                                                                        const q = inspectionTypeSearch.toLowerCase();
                                                                        return (it.name || '').toLowerCase().includes(q) || (it.code || '').toLowerCase().includes(q);
                                                                    }
                                                                    return true;
                                                                })
                                                                .map(it => (
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
                                                                            <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700">{it.name}</span>
                                                                            <span className="text-[10px] font-mono font-medium text-slate-400 group-hover:text-blue-500">{it.code}</span>
                                                                        </div>
                                                                    </button>
                                                                ))
                                                            }
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
                            />
                        )}
                    </div>
                )}
            </Card>

            <Card className={`flex flex-col ${capturedEventsPipWindow ? 'h-[40px]' : 'h-[280px]'} border-slate-200 shadow-sm rounded-md bg-white overflow-hidden shrink-0 transition-all duration-500 ease-in-out`}>
                <div className="bg-slate-800 text-white px-3 py-2 text-[11px] font-bold uppercase tracking-widest flex justify-between items-center h-[40px] shrink-0">
                    <div className="flex items-center gap-2">
                        <span>CAPTURED EVENTS</span>
                        <Badge className="bg-blue-600 text-white border-none text-[9px] h-4 leading-none font-bold uppercase tracking-wider">{currentRecords.length} Captured</Badge>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-slate-300 hover:text-white hover:bg-slate-700" onClick={handlePopoutCapturedEvents}>
                        {capturedEventsPipWindow ? <X className="w-3.5 h-3.5 mr-1" /> : <Maximize2 className="w-3.5 h-3.5 mr-1" />}
                        {capturedEventsPipWindow ? "Dock" : "Float"}
                    </Button>
                </div>
                
                {!capturedEventsPipWindow && (
                    <ScrollArea className="flex-1 w-full relative">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-3 py-3 w-20 cursor-pointer" onClick={() => handleSort('cr_date')}>Date</th>
                                    <th className="px-3 py-3 cursor-pointer" onClick={() => handleSort('type')}>Type</th>
                                    <th className="px-3 py-3 cursor-pointer" onClick={() => handleSort('component')}>Component</th>
                                    <th className="px-3 py-3 text-center cursor-pointer" onClick={() => handleSort('elev')}>Elev/KP</th>
                                    <th className="px-3 py-3 text-center cursor-pointer" onClick={() => handleSort('status')}>Status</th>
                                    <th className="px-3 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sortedRecords.map((r: any) => (
                                    <tr key={r.insp_id} className="hover:bg-slate-50 group">
                                        <td className="px-3 py-3 text-slate-600 align-top">
                                            <div className="text-sm font-medium">{r.cr_date ? format(new Date(r.cr_date), 'dd MMM') : '-'}</div>
                                        </td>
                                        <td className="px-3 py-3 font-bold text-slate-800 align-top">
                                            <div className="truncate max-w-[200px] text-sm">{r.inspection_type?.name}</div>
                                        </td>
                                        <td className="px-3 py-3 align-top text-slate-700">
                                            <div className="font-bold text-sm">{r.structure_components?.q_id || '-'}</div>
                                        </td>
                                        <td className="px-3 py-3 text-center text-sm font-medium align-top">{r.elevation || '-'}</td>
                                        <td className="px-3 py-3 align-top text-center">
                                            <div className="flex flex-col items-center gap-1.5 mt-0.5">
                                                {r.has_anomaly ? <AlertCircle className="w-3.5 h-3.5 text-red-600" /> : <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-right align-top">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button className="p-1.5 px-2 bg-slate-100 rounded text-[10px] font-bold">Actions</button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleEditRecord(r)}>Edit</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDeleteRecord(r.insp_id)}>Delete</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </ScrollArea>
                )}
            </Card>

            {capturedEventsPipWindow && createPortal(
                <div className="h-screen w-screen flex flex-col bg-white overflow-hidden">
                    <div className="bg-slate-800 text-white px-3 py-2 text-[11px] font-bold uppercase tracking-widest flex justify-between items-center shrink-0">
                        <span>CAPTURED EVENTS (FLOATING)</span>
                        <button onClick={() => capturedEventsPipWindow.close()}><X className="w-4 h-4" /></button>
                    </div>
                </div>,
                capturedEventsPipWindow.document.body
            )}
        </div>
    );
}
