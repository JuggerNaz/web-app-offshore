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
import { motion, AnimatePresence } from "framer-motion";
import SeabedDebrisPlot from "@/components/inspection/seabed-debris-plot";

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
    onChangeTaskClick?: () => void;
    onChangeComponentClick?: () => void;
    isEditing?: boolean;
    dynamicProps?: any;
    handleDynamicPropChange?: (name: string, value: any) => void;
    activeMGIProfile?: any;
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
    vidState,
    onChangeTaskClick,
    onChangeComponentClick,
    isEditing = false,
    dynamicProps = {},
    handleDynamicPropChange,
    activeMGIProfile
}) => {
    const isAnomaly = findingType === 'Anomaly';
    const ringClass = isAnomaly ? "focus:ring-red-500" : "focus:ring-blue-500";
    const categoryLabel = isAnomaly ? 'Anomaly' : 'Finding';

    const savedTapeCount = dynamicProps?.tape_count_no;
    const getCounterAsSeconds = (val: any) => {
        // If we have a value (string or number), parse It
        if (val !== undefined && val !== "" && val !== null) {
            if (typeof val === 'number') return val;
            const pts = String(val).split(':').map(Number);
            if (pts.length === 3) return (pts[0] || 0) * 3600 + (pts[1] || 0) * 60 + (pts[2] || 0);
            if (pts.length === 2) return (pts[0] || 0) * 60 + (pts[1] || 0);
            const n = Number(val);
            if (!isNaN(n)) return n;
        }
        
        // If no value and not editing, we can use the live timer
        // If editing, we should ideally have a value, but if not, fallback to 0 or vidTimer
        return vidTimer;
    };
    const currentDisplayCount = getCounterAsSeconds(savedTapeCount);

    // MGI Threshold Validation Logic
    const [lastFlaggedThreshold, setLastFlaggedThreshold] = React.useState<number | null>(null);

    // Helper: Calculate interpolated MGI threshold
    const getInterpolatedThreshold = (vDepth: any, vUnit: string, wDepth: number, thresholds: any[]) => {
        if (!thresholds || thresholds.length === 0) return null;

        // Clean depth input
        const vDepthStr = String(vDepth).replace(/[^\d.-]/g, '');
        let currentDepth = Math.abs(parseFloat(vDepthStr) || 0);
        
        // Resolve Effective Water Depth (Use Platform Depth or Leg Fallback)
        let waterDepth = Math.abs(wDepth || 0);
        if (waterDepth === 0 && selectedComp) {
            // If global depth is missing and this is a LEG, use component's lowest elevation
            const type = (selectedComp.raw?.type || String(selectedComp.name || '')).toUpperCase();
            if (type.includes('LEG')) {
                const lElev = parseFloat(String(selectedComp.lowestElev || '0').replace(/[^\d.-]/g, ''));
                if (!isNaN(lElev)) waterDepth = Math.abs(lElev);
            }
        }

        // Convert to meters for calculation
        if (vUnit === 'ft') currentDepth *= 0.3048;
        else if (vUnit === 'in') currentDepth *= 0.0254;
        else if (vUnit === 'mm') currentDepth /= 1000;
        else if (vUnit === 'cm') currentDepth /= 100;

        // 1. Resolve labels to absolute depths
        const resolved = thresholds.map(t => {
            let d = 0;
            const from = String(t.from_elevation).toUpperCase().trim();
            if (from === 'MSL') d = 0;
            else if (from === 'MUDLINE') d = waterDepth;
            else if (from.includes('WD')) {
                const m = from.match(/(\d+)\/(\d+)\s*WD/i);
                if (m && parseInt(m[2]) !== 0) d = (parseInt(m[1]) / parseInt(m[2])) * waterDepth;
                else d = waterDepth;
            } else d = Math.abs(parseFloat(from) || 0);
            return { depth: d, max: t.max_thickness };
        }).sort((a, b) => a.depth - b.depth);

        // 2. Interpolation
        if (currentDepth <= resolved[0].depth) return resolved[0].max;
        if (currentDepth >= resolved[resolved.length - 1].depth) return resolved[resolved.length - 1].max;

        for (let i = 0; i < resolved.length - 1; i++) {
            const p1 = resolved[i];
            const p2 = resolved[i+1];
            if (currentDepth >= p1.depth && currentDepth <= p2.depth) {
                const ratio = (currentDepth - p1.depth) / (p2.depth - p1.depth);
                return p1.max + (p2.max - p1.max) * ratio;
            }
        }
        return resolved[resolved.length - 1].max;
    };

    // Auto-match thresholds and trigger anomalies
    React.useEffect(() => {
        if (!activeMGIProfile || !activeMGIProfile.thresholds || activeMGIProfile.thresholds.length === 0) return;
        if (!activeSpec || (activeSpec.toUpperCase() !== 'MGI' && activeSpec.toUpperCase() !== 'RMGI')) return;

        const vDepthRaw = dynamicProps?.verification_depth || (selectedComp.lowestElev && selectedComp.lowestElev !== '-' ? selectedComp.lowestElev : selectedComp.depth) || '0';
        const vDepthUnit = dynamicProps?.verification_depth_unit || 'm';
        const waterDepth = Math.abs(headerData.waterDepth || 0);

        const applicableMax = getInterpolatedThreshold(vDepthRaw, vDepthUnit, waterDepth, activeMGIProfile.thresholds);
        if (applicableMax === null) return;

        // Auto-persist threshold to mgi_profile field for reports
        const formattedThreshold = `${applicableMax.toFixed(1)}mm`;
        if (dynamicProps?.mgi_profile !== formattedThreshold && handleDynamicPropChange) {
            handleDynamicPropChange('mgi_profile', formattedThreshold);
        }

        // 4. Check thickness values across all 8 clock positions
        const thicknessFields = [
            'mgi_hard_thickness_at_12', 'mgi_hard_thickness_at_3', 'mgi_hard_thickness_at_6', 'mgi_hard_thickness_at_9',
            'mgi_soft_thickness_at_12', 'mgi_soft_thickness_at_3', 'mgi_soft_thickness_at_6', 'mgi_soft_thickness_at_9'
        ];
        const currentMaxT = Math.max(...thicknessFields.map(f => parseFloat(dynamicProps?.[f]) || 0));

        if (currentMaxT > applicableMax) {
            // Threshold breached!
            if (lastFlaggedThreshold !== applicableMax && findingType !== 'Anomaly') {
                setFindingType('Anomaly');
                setLastFlaggedThreshold(applicableMax);
                setAnomalyData((prev: any) => ({
                    ...prev,
                    defectCode: 'Marine Growth',
                    description: `MGI Thickness threshold breached. Depth: ${vDepthRaw}${vDepthUnit}. Threshold: ${applicableMax.toFixed(1)}mm. Measured: ${currentMaxT}mm.`,
                    priority: 'Anomalous'
                }));
                toast.warning(`MGI Threshold Breached (${applicableMax.toFixed(1)}mm)! Switch to Anomaly detected.`, {
                    description: `Measured ${currentMaxT}mm at ${vDepthRaw}${vDepthUnit} depth.`
                });
            }
        } else if (lastFlaggedThreshold === applicableMax && findingType === 'Anomaly' && anomalyData.defectCode === 'Marine Growth') {
            // If it was corrected back, we reset our tracker to allow future triggers
            setLastFlaggedThreshold(null);
        }

    }, [
        dynamicProps?.mgi_hard_thickness_at_12, dynamicProps?.mgi_hard_thickness_at_3, dynamicProps?.mgi_hard_thickness_at_6, dynamicProps?.mgi_hard_thickness_at_9,
        dynamicProps?.mgi_soft_thickness_at_12, dynamicProps?.mgi_soft_thickness_at_3, dynamicProps?.mgi_soft_thickness_at_6, dynamicProps?.mgi_soft_thickness_at_9,
        dynamicProps?.verification_depth, dynamicProps?.verification_depth_unit, activeMGIProfile, headerData.waterDepth, activeSpec, selectedComp.depth, selectedComp.lowestElev
    ]);

    return (
        <Card className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-[5%] bg-white z-10">
            <div className="p-3 bg-blue-600 text-white flex justify-between items-center shrink-0 shadow-sm border-b border-blue-700">
                <span className="font-black tracking-wide text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-200" />
                    <span className="text-blue-100 opacity-90 font-bold">{selectedComp.name}</span>
                    {onChangeComponentClick && (
                        <button onClick={onChangeComponentClick} className="ml-1.5 px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold bg-white/20 hover:bg-white/30 rounded transition-colors text-white border border-white/10">
                            Change
                        </button>
                    )}
                    <span className="text-blue-100/40 mx-1.5">/</span> Spec: {(() => {
                        const specObj = allInspectionTypes.find(t => (t.code || '').trim() === (activeSpec || '').trim()) || 
                                       allInspectionTypes.find(t => (t.name || '').trim() === (activeSpec || '').trim());
                        return specObj ? specObj.name : activeSpec;
                    })()}
                    {onChangeTaskClick && (
                        <button onClick={onChangeTaskClick} className="ml-1.5 px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold bg-white/20 hover:bg-white/30 rounded transition-colors text-white border border-white/10">
                            Change
                        </button>
                    )}
                </span>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-black/20 px-2 py-1 rounded border border-white/10">
                        <Video className="w-3.5 h-3.5 text-blue-200" />
                        <div className="flex flex-col">
                            <span className="text-[7px] font-black uppercase text-blue-200/50 leading-none">Timer</span>
                            <span className="font-mono text-xs font-bold leading-none mt-0.5">{formatTime(currentDisplayCount)}</span>
                        </div>
                    </div>
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
                            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><MapPinIcon className="w-3 h-3" /> Verification Depth / Elevation</label>
                            <div className="flex items-center gap-1">
                                <Input 
                                    type="number"
                                    value={dynamicProps?.verification_depth || (selectedComp.lowestElev && selectedComp.lowestElev !== '-' ? selectedComp.lowestElev : selectedComp.depth) || ''} 
                                    onChange={(e) => {
                                        let val = e.target.value;
                                        const isUnderwater = headerData.inspMethod === 'ROV' || headerData.inspMethod === 'DIVING';
                                        if (isUnderwater && val && val !== '-') {
                                            const num = parseFloat(val);
                                            if (!isNaN(num) && num > 0) {
                                                val = String(-num);
                                            }
                                        }
                                        handleDynamicPropChange?.('verification_depth', val);
                                    }}
                                    placeholder="Enter depth"
                                    className="h-10 text-sm font-bold bg-slate-50 focus-visible:ring-blue-500 flex-1" 
                                />
                                <select
                                    className="h-10 px-2 text-xs font-bold border border-slate-200 rounded-md bg-slate-50 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-[55px]"
                                    value={dynamicProps?.verification_depth_unit || 'm'}
                                    onChange={(e) => handleDynamicPropChange?.('verification_depth_unit', e.target.value)}
                                >
                                    <option value="mm">mm</option>
                                    <option value="cm">cm</option>
                                    <option value="m">m</option>
                                    <option value="ft">ft</option>
                                    <option value="in">in</option>
                                </select>
                            </div>
                        </div>
                        {(selectedComp.startElev !== '-' || selectedComp.endElev !== '-') && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">Elevation Range</label>
                                <div className="h-10 px-3 flex items-center text-sm font-bold bg-slate-50 border border-slate-200 rounded-md text-slate-600">
                                    {selectedComp.startElev} → {selectedComp.endElev} {dynamicProps?.verification_depth_unit || 'm'}
                                </div>
                            </div>
                        )}
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div 
                            key={activeSpec}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="p-4 border-2 border-slate-200 bg-slate-50/50 rounded-lg space-y-3"
                        >
                            <div className="border-b border-slate-200 pb-2 space-y-3">
                                <div className="text-[10px] font-black uppercase text-slate-800 tracking-widest">Inspection Specification</div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">Insp. Date</span>
                                        {renderInspectionField({ 
                                            name: 'inspection_date', 
                                            label: 'Date', 
                                            type: 'date'
                                        }, 'primary')}
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">Insp. Time</span>
                                        {renderInspectionField({ 
                                            name: 'inspection_time', 
                                            label: 'Time', 
                                            type: 'text'
                                        }, 'primary')}
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">Counter Override</span>
                                        {renderInspectionField({ 
                                            name: 'tape_count_no', 
                                            label: `Live: ${formatTime(vidTimer)}`, 
                                            type: 'text'
                                        }, 'primary')}
                                    </div>
                                </div>
                            </div>
                            
                            {activeSpec?.toUpperCase() === 'RSEAB' && (
                                <div className="col-span-full space-y-3 mb-4">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">Graphical Seabed Plot <span className="text-[9px] font-normal text-muted-foreground ml-2">(Drag to persist X/Y)</span></label>
                                    <div className="w-full max-w-xl mx-auto">
                                        <SeabedDebrisPlot
                                            layoutType={headerData?.structureName?.includes('8') ? 'rectangular' : 'rectangular'} 
                                            legCount={headerData?.structureName?.includes('8') ? 8 : 4} 
                                            gridDistances={[3, 6, 9, 12, 15, 18, 21]}
                                            debrisItems={dynamicProps?.x && dynamicProps?.y ? [{
                                                id: 'current',
                                                x: parseFloat(dynamicProps.x),
                                                y: parseFloat(dynamicProps.y),
                                                label: '1',
                                                isMetallic: dynamicProps?.debris_material?.toLowerCase().includes('metal') || false
                                            }] : []}
                                            manualEntry={{
                                                leg: dynamicProps?.reference_leg || dynamicProps?.associated_leg || dynamicProps?.leg,
                                                distance: dynamicProps?.distance_from_leg ? parseFloat(dynamicProps.distance_from_leg) : undefined,
                                                face: dynamicProps?.face || dynamicProps?.orientation
                                            }}
                                            onDebrisMove={(id, x, y, geometry) => {
                                                if (handleDynamicPropChange) {
                                                    handleDynamicPropChange('x', x.toFixed(2));
                                                    handleDynamicPropChange('y', y.toFixed(2));
                                                    handleDynamicPropChange('distance_from_leg', geometry.distance.toFixed(1));
                                                }
                                            }}
                                            onAddDebris={(x, y, geometry) => {
                                                if (handleDynamicPropChange) {
                                                    handleDynamicPropChange('x', x.toFixed(2));
                                                    handleDynamicPropChange('y', y.toFixed(2));
                                                    handleDynamicPropChange('distance_from_leg', geometry.distance.toFixed(1));
                                                }
                                                toast.info(`Point added at ${geometry.distance.toFixed(1)}m on ${geometry.face} face`);
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* MGI Thickness Group - rendered specially when present */}
                            {(() => {
                                const mgiFields = activeFormProps.filter((p: any) => p.group === 'mgi_thickness');
                                const otherFields = activeFormProps.filter((p: any) => p.group !== 'mgi_thickness');
                                const hardFields = mgiFields.filter((p: any) => p.groupRow === 'hard');
                                const softFields = mgiFields.filter((p: any) => p.groupRow === 'soft');
                                const profileField = mgiFields.find((p: any) => p.type === 'mgi_profile_display');

                                // Resolve the applicable threshold for the current depth
                                const resolveApplicableMax = () => {
                                    const vDepthRaw = dynamicProps?.verification_depth || (selectedComp.lowestElev && selectedComp.lowestElev !== '-' ? selectedComp.lowestElev : selectedComp.depth) || '0';
                                    const vDepthUnit = dynamicProps?.verification_depth_unit || 'm';
                                    const waterDepth = Math.abs(headerData.waterDepth || 0);
                                    
                                    return getInterpolatedThreshold(vDepthRaw, vDepthUnit, waterDepth, activeMGIProfile?.thresholds);
                                };

                                return (
                                    <>
                                        {mgiFields.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="col-span-2 border-2 border-teal-200 bg-gradient-to-br from-teal-50/60 to-white rounded-xl p-4 space-y-3 shadow-sm"
                                            >
                                                {/* Group Header */}
                                                <div className="flex items-center justify-between border-b border-teal-200 pb-2">
                                                     <div className="flex items-center gap-2">
                                                         <div className="w-6 h-6 bg-teal-600 rounded-lg flex items-center justify-center">
                                                             <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                                                         </div>
                                                         <div className="flex flex-col">
                                                            <span className="text-[11px] font-black text-teal-800 uppercase tracking-widest leading-none">MGI Thickness</span>
                                                            <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">
                                                                Ref: {(() => {
                                                                    const wDepth = Math.abs(headerData.waterDepth || 0);
                                                                    if (wDepth > 0) return `${wDepth}m`;
                                                                    const type = (selectedComp.raw?.type || String(selectedComp.name || '')).toUpperCase();
                                                                    if (type.includes('LEG')) {
                                                                        const lElev = Math.abs(parseFloat(String(selectedComp.lowestElev || '0').replace(/[^\d.-]/g, '')));
                                                                        return lElev > 0 ? `${lElev}m (Leg)` : "0m";
                                                                    }
                                                                    return "0m";
                                                                })()}
                                                            </span>
                                                         </div>
                                                     </div>
                                                     {activeMGIProfile && (
                                                         <div className="flex flex-col items-end">
                                                            <span className="text-[10px] font-black text-teal-600 bg-teal-100/50 px-2 py-0.5 rounded border border-teal-200">
                                                                MAX: {resolveApplicableMax()?.toFixed(1) ?? '—'}mm
                                                            </span>
                                                         </div>
                                                     )}
                                                </div>

                                                {profileField && !activeMGIProfile && (
                                                    <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                                                        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                                        <span className="text-[10px] font-bold text-amber-700">No active MGI Profile found. Configure one in Settings → MGI Profiler.</span>
                                                    </div>
                                                )}

                                                {/* Clock Position Headers */}
                                                <div className="grid grid-cols-[80px_1fr_1fr_1fr_1fr] gap-2 items-end">
                                                    <div></div>
                                                    {['12 o\'clk', '3 o\'clk', '6 o\'clk', '9 o\'clk'].map(pos => (
                                                        <div key={pos} className="text-center">
                                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{pos}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Hard Thickness Row */}
                                                {hardFields.length > 0 && (
                                                    <div className="grid grid-cols-[80px_1fr_1fr_1fr_1fr] gap-2 items-center">
                                                        <span className="text-[10px] font-black text-rose-700 uppercase tracking-wider bg-rose-50 border border-rose-200 rounded-md px-2 py-1.5 text-center">Hard</span>
                                                        {hardFields.map((p: any) => (
                                                            <div key={p.name}>
                                                                {renderInspectionField(p, 'primary')}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Soft Thickness Row */}
                                                {softFields.length > 0 && (
                                                    <div className="grid grid-cols-[80px_1fr_1fr_1fr_1fr] gap-2 items-center">
                                                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5 text-center">Soft</span>
                                                        {softFields.map((p: any) => (
                                                            <div key={p.name}>
                                                                {renderInspectionField(p, 'primary')}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Unit indicator */}
                                                <div className="text-right">
                                                    <span className="text-[9px] font-bold text-slate-400 italic">All values in mm</span>
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Other (non-MGI) fields in normal 2-col grid */}
                                        <div className="grid grid-cols-2 gap-4">
                                            {otherFields.map((p: any, idx: number) => {
                                                if (isAnomaly && (p.name === 'has_anomaly' || p.name === 'anomalydata')) return null;

                                                return (
                                                    <motion.div 
                                                        layout
                                                        key={`${p.name || p.label}-${idx}`} 
                                                        className={p.name === 'cp_readings' || p.type === 'repeater' || p.type === 'textarea' ? 'col-span-2' : ''}
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        transition={{ delay: idx * 0.05 }}
                                                    >
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">
                                                            {p.label || p.name}
                                                            {p.isLegacy && <span className="ml-2 text-amber-500 lowercase">(legacy)</span>}
                                                        </label>
                                                        {renderInspectionField(p, 'primary')}
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </>
                                );
                            })()}
                            {activeFormProps.length === 0 && (
                                <div className="py-6 text-center">
                                    <p className="text-xs text-slate-400 italic">No additional specialized fields for this type.</p>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

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
                            const canCommit = (isDepActive && isAtWorksite && hasTape && isRecording) || isManualOverride || isEditing;

                            const issues: string[] = [];
                            if (!isDepActive) issues.push('Deployment record not active');
                            if (!isAtWorksite) issues.push('Not at worksite yet');
                            if (!hasTape) issues.push('No tape selected');
                            if (!isRecording) issues.push('Video not recording');

                            return (
                                <>
                                    {!canCommit && !isEditing && (
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
