import * as React from 'react';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    MapPin, 
    CheckCircle2, 
    FileText, 
    AlertCircle, 
    Clock, 
    Save, 
    Trash2,
    X,
    Settings,
    Video, 
    Info, 
    MapPin as MapPinIcon, 
    Paperclip, 
    Camera, 
    CloudUpload
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface InspectionFormProps {
    selectedComp: any;
    activeSpec: string | null;
    allInspectionTypes: any[];
    activeFormProps: any[];
    findingType: 'Pass' | 'Finding' | 'Anomaly' | 'Incomplete';
    setFindingType: (t: 'Pass' | 'Finding' | 'Anomaly' | 'Incomplete') => void;
    renderInspectionField: (p: any, type: 'primary' | 'secondary') => React.ReactNode;
    anomalyData: any;
    setAnomalyData: (data: any | ((prev: any) => any)) => void;
    defectCodes: any[];
    allDefectTypes: any[];
    availableDefectTypes: any[];
    priorities: any[];
    headerData: any;
    isManualOverride: boolean;
    setIsManualOverride: (val: boolean) => void;
    setLastAutoMatchedRuleId: (val: string | null) => void;
    handleCommitRecord: () => void;
    onClose: () => void;
    onCapturePhoto?: () => void;
    isCommitting: boolean;
    vidTimer: number;
    formatTime: (s: number) => string;
    setCompSpecDialogOpen: (b: boolean) => void;
    resetForm: () => void;
    incompleteReason: string;
    setIncompleteReason: (s: string) => void;
    recordNotes: string;
    setRecordNotes: (s: string) => void;
    pendingAttachments: any[];
    setPendingAttachments: (atts: any[] | ((prev: any[]) => any[])) => void;
    setIsAttachmentManagerOpen: (b: boolean) => void;
    recordedFiles: any[];
    activeDep: any;
    currentMovement: string;
    tapeId: any;
    vidState: string;
}

export const InspectionForm: React.FC<InspectionFormProps> = ({
    selectedComp,
    activeSpec,
    allInspectionTypes,
    activeFormProps,
    findingType,
    setFindingType,
    renderInspectionField,
    anomalyData,
    setAnomalyData,
    defectCodes,
    allDefectTypes,
    availableDefectTypes,
    priorities,
    headerData,
    isManualOverride,
    setIsManualOverride,
    setLastAutoMatchedRuleId,
    handleCommitRecord,
    onClose,
    onCapturePhoto,
    isCommitting,
    vidTimer,
    formatTime,
    setCompSpecDialogOpen,
    resetForm,
    incompleteReason,
    setIncompleteReason,
    recordNotes,
    setRecordNotes,
    pendingAttachments,
    setPendingAttachments,
    setIsAttachmentManagerOpen,
    recordedFiles,
    activeDep,
    currentMovement,
    tapeId,
    vidState
}) => {
    const isAnomaly = findingType === 'Anomaly';
    const ringClass = isAnomaly ? "focus:ring-red-500" : "focus:ring-blue-500";
    const categoryLabel = isAnomaly ? 'Anomaly' : 'Finding';

    return (
        <Card className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-[5%] bg-white z-10">
            <div className="p-3 bg-blue-600 text-white flex justify-between items-center shrink-0 shadow-sm border-b border-blue-700">
                <span className="font-black tracking-wide text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-200" />
                    <span className="text-blue-100 opacity-60 font-medium">{selectedComp.name} /</span> Spec: {(() => {
                        const specObj = allInspectionTypes.find(t => (t.code || '').trim() === (activeSpec || '').trim()) || 
                                       allInspectionTypes.find(t => (t.name || '').trim() === (activeSpec || '').trim());
                        return specObj ? specObj.name : activeSpec;
                    })()}
                </span>
                <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold bg-black/20 px-2 py-1 rounded border border-white/10 flex items-center gap-1.5"><Video className="w-3 h-3 text-blue-200" /> {formatTime(vidTimer)}</span>
                    <button onClick={() => setCompSpecDialogOpen(true)} className="p-1.5 hover:bg-white/10 bg-black/10 rounded transition text-blue-100 hover:text-white" title="Component Specifications">
                        <Info className="w-4 h-4" />
                    </button>
                    <button onClick={() => resetForm()} className="p-1.5 hover:bg-white/10 bg-black/10 rounded transition text-blue-100 hover:text-white" title="Cancel/Close"><X className="w-4 h-4" /></button>
                </div>
            </div>

            <ScrollArea className="flex-1 p-5">
                <div className="space-y-5 max-w-2xl mx-auto">
                    <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><MapPinIcon className="w-3 h-3" /> Verification Depth</label>
                            <Input defaultValue={selectedComp.lowestElev && selectedComp.lowestElev !== '-' ? `${selectedComp.lowestElev}m` : selectedComp.depth} className="h-10 text-sm font-bold bg-slate-50 focus-visible:ring-blue-500" />
                        </div>
                        {(selectedComp.startElev !== '-' || selectedComp.endElev !== '-') && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">Elevation Range</label>
                                <div className="h-10 px-3 flex items-center text-sm font-bold bg-slate-50 border border-slate-200 rounded-md text-slate-600">
                                    {selectedComp.startElev}m → {selectedComp.endElev}m
                                </div>
                            </div>
                        )}
                    </div>

                    {activeFormProps.length > 0 && (
                        <div className="p-4 border-2 border-slate-200 bg-slate-50/50 rounded-lg space-y-3">
                            <div className="text-[10px] font-black uppercase text-slate-800 tracking-widest border-b border-slate-200 pb-2">Inspection Specification</div>
                            <div className="grid grid-cols-2 gap-4">
                                {activeFormProps.map((p: any, idx: number) => {
                                    if (isAnomaly && (p.name === 'has_anomaly' || p.name === 'anomalydata')) return null;

                                    return (
                                        <div key={`${p.name || p.label}-${idx}`} className={p.name === 'cp_readings' || p.type === 'repeater' || p.type === 'textarea' ? 'col-span-2' : ''}>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">{p.label || p.name}</label>
                                            {renderInspectionField(p, 'primary')}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="space-y-3 p-4 border-2 border-slate-200 rounded-lg bg-white shadow-sm animate-in fade-in slide-in-from-top-2">
                        <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest block border-b border-slate-100 pb-2">Inspection Result</label>
                        <div className="grid grid-cols-4 gap-2">
                            <Button
                                variant={findingType === 'Pass' ? 'default' : 'outline'}
                                onClick={() => {
                                    if (findingType === 'Anomaly' || findingType === 'Finding') {
                                        if (anomalyData.defectCode || anomalyData.description) {
                                            if (!confirm('Switching to Pass will clear the defect/finding details. Continue?')) return;
                                        }
                                        setAnomalyData({defectCode: '', priority: '', defectType: '', description: '', recommendedAction: '',
                                            rectify: false, rectifiedDate: '', rectifiedRemarks: '', severity: 'Minor', referenceNo: '' });
                                        setLastAutoMatchedRuleId(null);
                                        setIsManualOverride(false);
                                    }
                                    setFindingType('Pass');
                                }}
                                className={`h-11 text-xs font-bold transition-all ${findingType === 'Pass' ? 'bg-green-600 hover:bg-green-700 text-white shadow-md' : 'text-slate-600 border-slate-300 hover:bg-green-50'}`}
                            >
                                <CheckCircle2 className="w-4 h-4 mr-1" /> Pass
                            </Button>
                            <Button
                                variant={findingType === 'Finding' ? 'default' : 'outline'}
                                onClick={() => {
                                    if (findingType !== 'Finding') setAnomalyData((prev: any) => ({ ...prev, referenceNo: '' }));
                                    setFindingType('Finding');
                                    setIsManualOverride(true);
                                }}
                                className={`h-11 text-xs font-bold transition-all ${findingType === 'Finding' ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' : 'text-slate-600 border-slate-300 hover:bg-blue-50'}`}
                            >
                                <FileText className="w-4 h-4 mr-1" /> Finding
                            </Button>
                            <Button
                                variant={findingType === 'Anomaly' ? 'default' : 'outline'}
                                onClick={() => {
                                    if (findingType !== 'Anomaly') setAnomalyData((prev: any) => ({ ...prev, referenceNo: '' }));
                                    setFindingType('Anomaly');
                                    setIsManualOverride(true);
                                }}
                                className={`h-11 text-xs font-bold transition-all ${findingType === 'Anomaly' ? 'bg-red-600 hover:bg-red-700 text-white shadow-md' : 'text-slate-600 border-slate-300 hover:bg-red-50'}`}
                            >
                                <AlertCircle className="w-4 h-4 mr-1" /> Anomaly
                            </Button>
                            <Button
                                variant={findingType === 'Incomplete' ? 'default' : 'outline'}
                                onClick={() => {
                                    if (findingType === 'Anomaly' || findingType === 'Finding') {
                                        if (anomalyData.defectCode || anomalyData.description) {
                                            if (!confirm('Switching to Incomplete will clear the defect/finding details. Continue?')) return;
                                        }
                                        setAnomalyData({defectCode: '', priority: '', defectType: '', description: '', recommendedAction: '',
                                            rectify: false, rectifiedDate: '', rectifiedRemarks: '', severity: 'Minor', referenceNo: '' });
                                    }
                                    setFindingType('Incomplete');
                                    setIsManualOverride(true);
                                }}
                                className={`h-11 text-xs font-bold transition-all ${findingType === 'Incomplete' ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md' : 'text-slate-600 border-slate-300 hover:bg-amber-50'}`}
                            >
                                <Clock className="w-4 h-4 mr-1" /> Incomplete
                            </Button>
                        </div>
                    </div>

                    {(findingType === 'Anomaly' || findingType === 'Finding') && (() => {
                        const isAnomaly = findingType === 'Anomaly';
                        const categoryLabel = isAnomaly ? 'Anomaly' : 'Finding';
                        const ringClass = isAnomaly ? "focus:ring-red-500" : "focus:ring-blue-500";
                        return (
                            <div className={`mt-3 p-3 rounded-lg border-2 space-y-3 animate-in fade-in slide-in-from-top-2 ${isAnomaly ? 'border-red-200 bg-red-50/30' : 'border-blue-200 bg-blue-50/30'}`}>
                                <div className={`text-[10px] font-black uppercase tracking-widest border-b pb-2 ${isAnomaly ? 'text-red-700 border-red-200' : 'text-blue-700 border-blue-200'}`}>
                                    {isAnomaly ? '⚠ Anomaly / Defect Details' : '📋 Finding Details'}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">{isAnomaly ? 'Defect Code' : 'Finding Code'} *</label>
                                        <select
                                            value={anomalyData.defectCode}
                                            onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, defectCode: e.target.value }))}
                                            className={`flex h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold ${ringClass}`}
                                        >
                                            <option value="">Select Code</option>
                                            {defectCodes.map(c => (
                                                <option key={c.lib_id} value={c.lib_desc}>{c.lib_desc}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">{isAnomaly ? 'Defect Type' : 'Finding Type'}</label>
                                        <select
                                            value={anomalyData.defectType}
                                            onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, defectType: e.target.value }))}
                                            className={`flex h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold ${ringClass}`}
                                        >
                                            <option value="">Select Type</option>
                                            {availableDefectTypes.map(t => (
                                                <option key={t.lib_id} value={t.lib_desc}>{t.lib_desc}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Priority *</label>
                                        <select
                                            value={anomalyData.priority}
                                            onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, priority: e.target.value }))}
                                            className={`flex h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold ${ringClass}`}
                                        >
                                            <option value="">Select Priority</option>
                                            {priorities.map(p => (
                                                <option key={p.lib_id} value={p.lib_desc}>{p.lib_desc}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Reference No</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                readOnly
                                                value={anomalyData.referenceNo}
                                                placeholder="Auto-generated on Save..."
                                                className={`flex h-9 w-full rounded-md border border-slate-200 bg-slate-50/50 px-2.5 text-xs font-mono font-bold text-slate-500 cursor-not-allowed`}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">{categoryLabel} Description</label>
                                    <textarea
                                        value={anomalyData.description}
                                        onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, description: e.target.value }))}
                                        placeholder={`Detailed description of the ${categoryLabel.toLowerCase()}...`}
                                        className={`w-full min-h-[60px] rounded border border-slate-300 p-2 text-xs bg-white ${ringClass}`}
                                    ></textarea>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Recommended Action</label>
                                    <textarea
                                        value={anomalyData.recommendedAction}
                                        onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, recommendedAction: e.target.value }))}
                                        placeholder="Recommended remedial action..."
                                        className={`w-full min-h-[60px] rounded border border-slate-300 p-2 text-xs bg-white ${ringClass}`}
                                    ></textarea>
                                </div>

                                <div className="p-3 border border-green-100 bg-green-50/80 rounded-lg space-y-3">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="rectifyCheck"
                                            checked={anomalyData.rectify}
                                            onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, rectify: e.target.checked }))}
                                            className="w-4 h-4 rounded text-green-600 focus:ring-green-500 border-green-300 cursor-pointer"
                                        />
                                        <label htmlFor="rectifyCheck" className="text-xs font-bold text-green-800 cursor-pointer">Rectify {categoryLabel}</label>
                                    </div>
                                    {anomalyData.rectify && (
                                        <div className="space-y-3 animate-in fade-in zoom-in-95">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-green-700 uppercase">Rectified Date</label>
                                                <Input
                                                    type="date"
                                                    value={anomalyData.rectifiedDate}
                                                    onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, rectifiedDate: e.target.value }))}
                                                    className="h-8 text-xs bg-white border-green-200"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-green-700 uppercase">Rectification Remarks</label>
                                                <textarea
                                                    value={anomalyData.rectifiedRemarks}
                                                    onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, rectifiedRemarks: e.target.value }))}
                                                    placeholder="How was it rectified?"
                                                    className="w-full min-h-[50px] rounded border border-green-200 p-2 text-xs bg-white focus:ring-green-500"
                                                ></textarea>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })()}

                    {findingType === 'Incomplete' && (
                        <div className="pt-3 animate-in fade-in slide-in-from-top-2">
                            <label className="text-[10px] font-bold text-amber-600 uppercase mb-1.5 block">Reason for Incomplete Task *</label>
                            <textarea
                                value={incompleteReason}
                                onChange={(e) => setIncompleteReason(e.target.value)}
                                placeholder="e.g. Visibility issues, limited access, dive time limit..."
                                className="w-full min-h-[80px] rounded border border-amber-200 p-2 text-xs bg-amber-50/30 focus:ring-amber-500"
                            ></textarea>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><FileText className="w-3 h-3" /> Findings</label>
                        <textarea value={recordNotes} onChange={(e) => setRecordNotes(e.target.value)} placeholder="Observation specifics, dimensions, characteristics..." className="w-full min-h-[100px] rounded-lg border border-slate-300 p-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none bg-slate-50/50"></textarea>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Paperclip className="w-3.5 h-3.5" /> Attachments ({pendingAttachments.length})
                            </label>
                            <div className="flex gap-1.5">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-7 text-[10px] font-bold border-slate-300 hover:bg-slate-100"
                                    onClick={() => {
                                        const snaps = recordedFiles.filter(f => f.type === 'photo');
                                        if (snaps.length > 0) {
                                            setIsAttachmentManagerOpen(true);
                                        } else {
                                            toast.info("No screen captures available. Grab frames from the stream first.");
                                        }
                                    }}
                                >
                                    <Camera className="w-3.5 h-3.5 mr-1 text-blue-500" /> From Grabs
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-7 text-[10px] font-bold border-slate-300 hover:bg-slate-100"
                                    onClick={() => {
                                        const input = document.createElement('input');
                                        input.type = 'file';
                                        input.multiple = true;
                                        input.onchange = (e) => {
                                            const files = (e.target as HTMLInputElement).files;
                                            if (files) {
                                                const newAtts = Array.from(files).map(f => {
                                                    const isAnomaly = findingType === 'Anomaly';
                                                    const isFinding = findingType === 'Finding';
                                                    const prefix = isAnomaly ? 'Anomaly - ' : (isFinding ? 'Findings - ' : '');
                                                    const refNo = anomalyData.referenceNo || 'Pending';
                                                    
                                                    return {
                                                        id: Math.random().toString(36).substr(2, 9),
                                                        file: f,
                                                        name: f.name,
                                                        type: f.type.startsWith('video') ? 'VIDEO' as const : (f.type.startsWith('image') ? 'PHOTO' as const : 'DOCUMENT' as const),
                                                        title: prefix ? `${prefix}${refNo}` : f.name,
                                                        description: '',
                                                        source: 'UPLOAD',
                                                        previewUrl: URL.createObjectURL(f)
                                                    };
                                                });
                                                setPendingAttachments((prev: any[]) => [...prev, ...newAtts]);
                                            }
                                        };
                                        input.click();
                                    }}
                                >
                                    <CloudUpload className="w-3.5 h-3.5 mr-1 text-green-500" /> Upload
                                </Button>
                            </div>
                        </div>

                        {pendingAttachments.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto p-1 bg-slate-50/50 rounded-lg border border-slate-100">
                                {pendingAttachments.map(att => (
                                    <div key={att.id} className="relative group bg-white border border-slate-200 rounded-md p-1.5 flex gap-2 overflow-hidden shadow-sm hover:border-blue-300 transition-all">
                                        <div className="w-12 h-12 bg-slate-100 rounded overflow-hidden flex-shrink-0 relative">
                                            {att.previewUrl ? (
                                                <img src={att.previewUrl} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-slate-200">
                                                    {att.type === 'VIDEO' ? <Video className="w-5 h-5 opacity-40" /> : <FileText className="w-5 h-5 opacity-40" />}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 pr-6 flex flex-col gap-0.5">
                                            <Input 
                                                value={att.title} 
                                                onChange={(e) => setPendingAttachments((prev: any[]) => prev.map(a => a.id === att.id ? { ...a, title: e.target.value } : a))}
                                                className="h-5 text-[10px] font-black border-none bg-slate-50/50 rounded-sm px-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-slate-800"
                                                placeholder="Title..."
                                            />
                                            <Input 
                                                value={att.description} 
                                                onChange={(e) => setPendingAttachments((prev: any[]) => prev.map(a => a.id === att.id ? { ...a, description: e.target.value } : a))}
                                                className="h-4 text-[9px] font-medium italic border-none bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-slate-500"
                                                placeholder="Remark..."
                                            />
                                        </div>
                                        <button 
                                            onClick={() => setPendingAttachments((prev: any[]) => prev.filter(a => a.id !== att.id))}
                                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 rounded bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {pendingAttachments.length === 0 && (
                            <div className="py-6 border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center bg-slate-50 opacity-60">
                                <Paperclip className="w-6 h-6 text-slate-300 mb-1" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No Attachments Picked</span>
                            </div>
                        )}
                    </div>

                    <div className="pt-2 pb-6">
                        {(() => {
                            const isDepActive = !!activeDep && activeDep.raw?.status !== 'COMPLETED';
                            const isAtWorksite = ["Arrived Bottom", "Diver at Worksite", "Bell at Working Depth", "Diver Locked Out", "AT_WORKSITE", "At Worksite", "Rov at the Worksite"].some(ws => currentMovement?.toUpperCase().includes(ws.toUpperCase()));
                            const hasTape = !!tapeId;
                            const isRecording = vidState === 'RECORDING';
                            const canCommit = (isDepActive && isAtWorksite && hasTape && isRecording) || isManualOverride;

                            const issues: string[] = [];
                            if (!isDepActive) issues.push('Deployment record not active');
                            if (!isAtWorksite) issues.push('Not at worksite yet');
                            if (!hasTape) issues.push('No tape selected');
                            if (!isRecording) issues.push('Video not recording');

                            return (
                                <>
                                    {!canCommit && (
                                        <div className="mb-2 p-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-[10px] font-semibold flex items-start gap-2">
                                            <span className="text-amber-500 text-sm leading-none mt-0.5">⚠</span>
                                            <div>
                                                <span className="font-black uppercase text-[9px] tracking-wider block mb-0.5">Checklist incomplete</span>
                                                {issues.map((issue, i) => (
                                                    <span key={i} className="block text-amber-700">• {issue}</span>
                                                ))}
                                                <span className="block mt-1 text-[9px] text-amber-500">Enable <b>Manual Entry</b> mode in the header to bypass.</span>
                                            </div>
                                        </div>
                                    )}
                                    <Button disabled={isCommitting || !canCommit} onClick={handleCommitRecord} className={`w-full h-14 font-black shadow-lg text-white text-base tracking-wide rounded-xl transition-all ${canCommit ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-300 cursor-not-allowed'}`}>
                                        <Save className="w-5 h-5 mr-2" /> {isCommitting ? "Committing..." : "Commit Record & Reset"}
                                    </Button>
                                </>
                            );
                        })()}
                    </div>
                </div>
            </ScrollArea>
        </Card>
    );
};
