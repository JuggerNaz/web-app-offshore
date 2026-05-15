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
    Printer,
    X,
    Settings,
    Video, 
    Info, 
    MapPin as MapPinIcon, 
    Paperclip, 
    Camera, 
    CloudUpload,
    Search,
    Loader2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import SeabedDebrisPlot from "@/components/inspection/seabed-debris-plot";
import { FindingsSuggestionEngine } from "./FindingsSuggestionEngine";

interface InspectionFormProps {
    selectedComp: any;
    activeSpec: string | null;
    allInspectionTypes: any[];
    activeFormProps: any[];
    findingType: 'Complete' | 'Finding' | 'Anomaly' | 'Incomplete';
    setFindingType: (t: 'Complete' | 'Finding' | 'Anomaly' | 'Incomplete') => void;
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
    deletedAttachmentIds: string[];
    setDeletedAttachmentIds: (ids: string[] | ((prev: string[]) => string[])) => void;
    setEditingAttachment: (att: any) => void;
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
    supabase?: any;
    libOptionsMap?: Record<string, any[]>;
    onDeleteRecord?: () => void;
    onPrintReport?: () => void;
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
    deletedAttachmentIds,
    setDeletedAttachmentIds,
    setEditingAttachment,
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
    activeMGIProfile,
    supabase,
    libOptionsMap,
    onDeleteRecord,
    onPrintReport
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

    const shouldShowField = (p: any) => {
        if (!p.condition) return true;
        const { field, value } = p.condition;
        // Check dynamicProps for the condition field value
        const actualValue = dynamicProps[field];
        return actualValue === value;
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
            'mgi_hard_thickness_at_12', 'mgi_hard_thickness_at_3', 'mgi_hard_thickness_at_6', 'mgi_hard_thickness_at_9'
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
        dynamicProps?.verification_depth, dynamicProps?.verification_depth_unit, activeMGIProfile, headerData.waterDepth, activeSpec, selectedComp.depth, selectedComp.lowestElev
    ]);

    // UT Thickness Auto-Calculations
    React.useEffect(() => {
        if (!activeSpec || activeSpec.toUpperCase() !== 'UTWTK') return;
        
        const readings: number[] = [];
        
        const r3 = parseFloat(dynamicProps?.ut_3_o_clock);
        if (!isNaN(r3)) readings.push(r3);
        
        const r6 = parseFloat(dynamicProps?.ut_6_o_clock);
        if (!isNaN(r6)) readings.push(r6);
        
        const r9 = parseFloat(dynamicProps?.ut_9_o_clock);
        if (!isNaN(r9)) readings.push(r9);
        
        const r12 = parseFloat(dynamicProps?.ut_12_o_clock);
        if (!isNaN(r12)) readings.push(r12);
        
        if (Array.isArray(dynamicProps?.ut_readings_additional)) {
            dynamicProps.ut_readings_additional.forEach((item: any) => {
                const addR = parseFloat(item.reading);
                if (!isNaN(addR)) readings.push(addR);
            });
        }
        
        if (readings.length === 0) return;
        
        const sum = readings.reduce((a, b) => a + b, 0);
        const avg = sum / readings.length;
        const min = Math.min(...readings);
        const max = Math.max(...readings);
        
        const nt = parseFloat(dynamicProps?.nominal_thickness);
        let loss: number | null = null;
        let pctLoss: number | null = null;
        if (!isNaN(nt) && nt > 0) {
            loss = nt - min;
            pctLoss = (loss / nt) * 100;
        }
        
        if (handleDynamicPropChange) {
            const currentAvg = parseFloat(dynamicProps?.avg_reading);
            const currentMin = parseFloat(dynamicProps?.min_reading);
            const currentMax = parseFloat(dynamicProps?.max_reading);
            const currentLoss = parseFloat(dynamicProps?.wall_thickness_loss);
            const currentPctLoss = parseFloat(dynamicProps?.['%_wall_thickness_loss']);
            
            const fmtAvg = parseFloat(avg.toFixed(2));
            const fmtMin = parseFloat(min.toFixed(2));
            const fmtMax = parseFloat(max.toFixed(2));
            const fmtLoss = loss !== null ? parseFloat(loss.toFixed(2)) : null;
            const fmtPctLoss = pctLoss !== null ? parseFloat(pctLoss.toFixed(2)) : null;
            
            if (currentAvg !== fmtAvg) handleDynamicPropChange('avg_reading', fmtAvg);
            if (currentMin !== fmtMin) handleDynamicPropChange('min_reading', fmtMin);
            if (currentMax !== fmtMax) handleDynamicPropChange('max_reading', fmtMax);
            
            if (fmtLoss !== null && currentLoss !== fmtLoss) {
                handleDynamicPropChange('wall_thickness_loss', fmtLoss);
            }
            if (fmtPctLoss !== null && currentPctLoss !== fmtPctLoss) {
                handleDynamicPropChange('%_wall_thickness_loss', fmtPctLoss);
            }
        }
        
    }, [
        dynamicProps?.ut_3_o_clock,
        dynamicProps?.ut_6_o_clock,
        dynamicProps?.ut_9_o_clock,
        dynamicProps?.ut_12_o_clock,
        dynamicProps?.nominal_thickness,
        dynamicProps?.ut_readings_additional,
        activeSpec
    ]);

    // Marine Growth (MGROW/RMGI) ET Auto-Calculation
    const lastCalculatedETRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        const specStr = String(activeSpec || '').toUpperCase();
        const specName = (allInspectionTypes?.find(t => t.code === activeSpec)?.name || '').toUpperCase();
        const keys = Object.keys(dynamicProps || {});
        
        // Broad detection for MG scope
        const isMG = specStr.includes('MGROW') || 
                     specStr.includes('RMGI') || 
                     specStr.includes('MARINE GROWTH') || 
                     specName.includes('MARINE GROWTH') ||
                     keys.some(k => k.toLowerCase().includes('circumferential')) ||
                     keys.some(k => k.toLowerCase().replace(/[\s_]/g, '') === 'effectivethickness');
        
        if (!isMG) return;

        // Try to get values from various possible keys (snake_case, Title Case, etc.)
        const getVal = (baseName: string) => {
            if (!dynamicProps) return 0;
            const target = baseName.toLowerCase().replace(/[\s_]/g, '');
            const keys = Object.keys(dynamicProps);
            
            // Find all matching keys
            const matchingKeys = keys.filter(k => k.toLowerCase().replace(/[\s_]/g, '') === target);
            
            if (matchingKeys.length === 0) return 0;
            
            // If multiple matches (e.g. 'nominal_diameter' and 'Nominal Diameter'), 
            // prefer the one that is NOT the baseName if it exists, as it's likely the user-edited one.
            const preferredKey = matchingKeys.find(k => k !== baseName) || matchingKeys[0];
            return parseFloat(dynamicProps[preferredKey]) || 0;
        };

        const c1 = getVal('circumferential_measurement_5m_above');
        const c2 = getVal('circumferential_measurement_0m');
        const c3 = getVal('circumferential_measurement_5m_below');
        const nominalDia = getVal('nominal_diameter');
        
        const avgC = (c1 + c2 + c3) / 3;
        
        // Formula: ET = ((AvgC / 3.142) - NominalDia) / 2
        const etValue = avgC > 0 ? ((avgC / 3.142) - nominalDia) / 2 : 0;
        const roundedET = parseFloat(etValue.toFixed(2));

        // DEBUG: Log all values to console for verification
        console.log(`[ET DEBUG] Inputs: C1=${c1}, C2=${c2}, C3=${c3}, AvgC=${avgC.toFixed(2)}, NomDia=${nominalDia} | Result: ${roundedET}`);

        // Determine which key to use for setting the ET (must match the existing key in dynamicProps)
        const targetET = 'effectivethickness';
        const existingETKey = Object.keys(dynamicProps || {}).find(k => k.toLowerCase().replace(/[\s_]/g, '') === targetET);
        const etKey = existingETKey || 'effective_thickness';

        const currentETVal = parseFloat(dynamicProps?.[etKey]);
        const isDifferent = isNaN(currentETVal) || Math.abs(currentETVal - roundedET) > 0.01;

        if (handleDynamicPropChange && isDifferent) {
            handleDynamicPropChange(etKey, roundedET);
        }
    }, [dynamicProps, activeSpec, allInspectionTypes]);

    // Pre-fill Nominal Diameter and Nominal Wall Thickness from assigned component if empty
    React.useEffect(() => {
        if (!isEditing && selectedComp && handleDynamicPropChange && Array.isArray(activeFormProps)) {
            const hasNominalDiameter = activeFormProps.some((p: any) => {
                const nameStr = String(p.name || p.label || '').toLowerCase().replace(/[\s_]+/g, '');
                return nameStr.includes('nominaldiameter');
            });
            const hasNominalThickness = activeFormProps.some((p: any) => {
                const nameStr = String(p.name || p.label || '').toLowerCase().replace(/[\s_]+/g, '');
                return nameStr.includes('nominalwallthickness') || nameStr.includes('nominalthickness');
            });

            if (hasNominalDiameter && (dynamicProps?.nominal_diameter === undefined || dynamicProps?.nominal_diameter === null || dynamicProps?.nominal_diameter === "")) {
                const compDia = selectedComp?.nominal_diameter || selectedComp?.raw?.nominal_diameter || selectedComp?.diameter || selectedComp?.raw?.diameter;
                if (compDia !== undefined && compDia !== null && compDia !== "" && compDia !== "-") {
                    handleDynamicPropChange('nominal_diameter', compDia);
                }
            }

            if (hasNominalThickness) {
                const compThk = selectedComp?.nominal_thickness || selectedComp?.nominal_wall_thickness || selectedComp?.raw?.nominal_thickness || selectedComp?.raw?.nominal_wall_thickness || selectedComp?.wall_thickness || selectedComp?.raw?.wall_thickness || selectedComp?.thickness;
                if (compThk !== undefined && compThk !== null && compThk !== "" && compThk !== "-") {
                    if (dynamicProps?.nominal_thickness === undefined || dynamicProps?.nominal_thickness === null || dynamicProps?.nominal_thickness === "") {
                        handleDynamicPropChange('nominal_thickness', compThk);
                    }
                    if (dynamicProps?.nominal_wall_thickness === undefined || dynamicProps?.nominal_wall_thickness === null || dynamicProps?.nominal_wall_thickness === "") {
                        handleDynamicPropChange('nominal_wall_thickness', compThk);
                    }
                }
            }
        }
    }, [selectedComp, activeSpec, activeFormProps, isEditing]);

    // Default Seabed Survey elevation to bottom elevation
    React.useEffect(() => {
        if (!isEditing && activeSpec?.toUpperCase() === 'RSEAB' && handleDynamicPropChange) {
            const currentDepth = dynamicProps?.verification_depth;
            const targetDepth = (selectedComp.lowestElev && selectedComp.lowestElev !== '-') ? selectedComp.lowestElev : 
                              ((selectedComp.endElev && selectedComp.endElev !== '-') ? selectedComp.endElev : 
                              (selectedComp.depth ? selectedComp.depth.replace(/[^\d.-]/g, '') : null));
            
            if ((currentDepth === undefined || currentDepth === null || currentDepth === "" || currentDepth === 0 || currentDepth === "0" || currentDepth === "-0.0" || currentDepth === -0.0) && targetDepth) {
                handleDynamicPropChange('verification_depth', targetDepth);
            }
        }
    }, [activeSpec, selectedComp, isEditing, dynamicProps]);

    return (
        <Card className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-[5%] bg-white dark:bg-slate-950 z-10 border-none rounded-none shadow-none text-slate-800 dark:text-slate-200">
            <div className="px-3 py-1.5 bg-blue-600 dark:bg-blue-700 text-white flex justify-between items-center shrink-0 shadow-sm border-b border-blue-700 dark:border-blue-800">
                <span className="font-black tracking-tight text-xs flex items-center gap-1.5 overflow-hidden">
                    <FileText className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                    <span className="text-blue-50 opacity-90 font-bold truncate">{selectedComp.name}</span>
                    {onChangeComponentClick && (
                        <button onClick={onChangeComponentClick} className="px-1.5 py-0.5 text-[8px] uppercase tracking-tighter font-bold bg-white/20 hover:bg-white/30 rounded transition-colors text-white border border-white/5 whitespace-nowrap">
                            Change
                        </button>
                    )}
                    <span className="text-blue-100/40 shrink-0">/</span>
                    <span className="truncate max-w-[150px] opacity-90">
                        {(() => {
                            const specObj = allInspectionTypes.find(t => (t.code || '').trim() === (activeSpec || '').trim()) || 
                                           allInspectionTypes.find(t => (t.name || '').trim() === (activeSpec || '').trim());
                            return specObj ? specObj.name : activeSpec;
                        })()}
                    </span>
                    {onChangeTaskClick && (
                        <button onClick={onChangeTaskClick} className="px-1.5 py-0.5 text-[8px] uppercase tracking-tighter font-bold bg-white/20 hover:bg-white/30 rounded transition-colors text-white border border-white/5 whitespace-nowrap">
                            Change
                        </button>
                    )}
                </span>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-black/20 px-1.5 py-0.5 rounded border border-white/10 shrink-0">
                        <Video className="w-3 h-3 text-blue-200" />
                        <div className="flex flex-col">
                            <span className="text-[6px] font-black uppercase text-blue-200/50 leading-none">Timer</span>
                            <span className="font-mono text-[10px] font-bold leading-none mt-0.5">{formatTime(currentDisplayCount)}</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                        {onPrintReport && (findingType === 'Anomaly' || findingType === 'Finding') && (
                            <button 
                                onClick={onPrintReport} 
                                className="p-1 hover:bg-white/10 bg-black/10 rounded transition text-blue-100 hover:text-white" 
                                title="Print Report"
                            >
                                <Printer className="w-3.5 h-3.5" />
                            </button>
                        )}

                        {isEditing && onDeleteRecord && (
                            <button 
                                onClick={onDeleteRecord} 
                                className="p-1 hover:bg-red-500/20 bg-black/10 rounded transition text-red-200 hover:text-red-100" 
                                title="Delete Record"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}

                        <button onClick={() => setCompSpecDialogOpen(true)} className="p-1 hover:bg-white/10 bg-black/10 rounded transition text-blue-100 hover:text-white" title="Component Specifications">
                            <Info className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => resetForm()} className="p-1 hover:bg-white/10 bg-black/10 rounded transition text-blue-100 hover:text-white" title="Cancel/Close"><X className="w-3.5 h-3.5" /></button>
                    </div>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-2">
                <div className="space-y-2">
                    <AnimatePresence mode="wait">
                        <motion.div 
                            key={activeSpec}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.2 }}
                            className="p-1.5 border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/30 rounded-lg space-y-1.5"
                        >
                            <div className="border-b border-slate-200 dark:border-slate-800 pb-1.5 space-y-1">
                                <div className="text-[9px] font-black uppercase text-slate-800 dark:text-slate-400 tracking-widest opacity-70">Inspection Metadata & Coordinates</div>
                                <div className="flex flex-wrap gap-x-2 gap-y-1.5 items-end">
                                    <div className="space-y-0.5 flex-grow min-w-[120px] max-w-[180px]">
                                        <label className="text-[8px] font-black text-slate-800 dark:text-slate-400 uppercase flex items-center gap-1"><MapPinIcon className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" /> Verification Depth / Elevation</label>
                                        <div className="flex items-center gap-1">
                                            <Input 
                                                type="text"
                                                value={dynamicProps?.verification_depth || (selectedComp.lowestElev && selectedComp.lowestElev !== '-' ? selectedComp.lowestElev : (selectedComp.endElev && selectedComp.endElev !== '-' ? selectedComp.endElev : (selectedComp.depth ? selectedComp.depth.replace(/[^\d.-]/g, '') : '')))} 
                                                onChange={(e) => {
                                                    handleDynamicPropChange?.('verification_depth', e.target.value);
                                                }}
                                                placeholder="Enter depth"
                                                className="h-8 text-[11px] font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 flex-1 dark:text-slate-200" 
                                            />
                                            <select
                                                className="h-8 px-1 text-[10px] font-bold border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-[45px]"
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
                                        <div className="space-y-0.5 flex-grow min-w-[80px] max-w-[120px]">
                                            <label className="text-[8px] font-black text-slate-800 dark:text-slate-400 uppercase">Range</label>
                                            <div className="h-8 px-1.5 flex items-center text-[10px] font-bold bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 rounded-md text-slate-500 dark:text-slate-400 truncate">
                                                {selectedComp.startElev}→{selectedComp.endElev}
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-0.5 flex-grow min-w-[100px] max-w-[130px]">
                                        <span className="text-[8px] font-black text-slate-800 dark:text-slate-400 uppercase">Insp. Date</span>
                                        {renderInspectionField({ 
                                            name: 'inspection_date', 
                                            label: 'Date', 
                                            type: 'date'
                                        }, 'primary')}
                                    </div>
                                    <div className="space-y-0.5 flex-grow min-w-[80px] max-w-[110px]">
                                        <span className="text-[8px] font-black text-slate-800 dark:text-slate-400 uppercase">Insp. Time</span>
                                        {renderInspectionField({ 
                                            name: 'inspection_time', 
                                            label: 'Time', 
                                            type: 'text'
                                        }, 'primary')}
                                    </div>
                                    {(() => {
                                        const northingField = activeFormProps?.find((p: any) => p.name === 'northing');
                                        return northingField ? (
                                            <div className="space-y-0.5 flex-grow min-w-[100px] max-w-[140px]">
                                                <span className="text-[8px] font-black text-slate-800 dark:text-slate-400 uppercase">Northing</span>
                                                {renderInspectionField(northingField, 'primary')}
                                            </div>
                                        ) : null;
                                    })()}
                                    {(() => {
                                        const eastingField = activeFormProps?.find((p: any) => p.name === 'easting');
                                        return eastingField ? (
                                            <div className="space-y-0.5 flex-grow min-w-[100px] max-w-[140px]">
                                                <span className="text-[8px] font-black text-slate-800 dark:text-slate-400 uppercase">Easting</span>
                                                {renderInspectionField(eastingField, 'primary')}
                                            </div>
                                        ) : null;
                                    })()}
                                    <div className="space-y-0.5 flex-grow min-w-[80px] max-w-[110px]">
                                        <span className="text-[8px] font-black text-slate-800 dark:text-slate-400 uppercase">Counter</span>
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
                                        {(() => {
                                            const qid = selectedComp?.name || "";
                                            const distMatch = qid.toUpperCase().match(/-(\d+)M$/);
                                            const dist = distMatch ? parseInt(distMatch[1]) : 0;
                                            const page = Math.floor((Math.max(0, dist - 0.1)) / 21);
                                            const offset = page * 21;
                                            const grid = [...Array(7)].map((_, i) => offset + (i + 1) * 3);

                                            return (
                                                <SeabedDebrisPlot
                                                    layoutType={headerData?.structureName?.includes('8') ? 'rectangular' : 'rectangular'} 
                                                    legCount={headerData?.structureName?.includes('8') ? 8 : 4} 
                                                    gridDistances={grid}
                                                    distanceOffset={offset}
                                                    highlightQid={qid}
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
                                                    registeredQids={[qid]}
                                                    onDebrisMove={(id, x, y, geometry) => {
                                                        if (handleDynamicPropChange) {
                                                            // Spatial Validation based on QID (e.g. S/BED(A1-A2)-18M)
                                                            const distMatch = qid.match(/-(\d+)M$/i);
                                                            const faceMatch = qid.match(/\(([^)]+)\)/);
                                                            const targetDist = distMatch ? parseInt(distMatch[1]) : null;
                                                            const targetFace = faceMatch ? faceMatch[1] : null;

                                                            const currentDist = Math.round(geometry.distance);
                                                            const currentFace = `${geometry.startLeg}-${geometry.endLeg}`;
                                                            const currentInterval = geometry.nearestDistance;

                                                            if (targetDist !== null && currentInterval !== targetDist) {
                                                                if (window.confirm(`You are flagging in the ${currentInterval}m range, but this task is for ${targetDist}m. Change current task?`)) {
                                                                    onChangeTaskClick?.();
                                                                }
                                                                return;
                                                            }
                                                            if (targetFace && currentFace !== targetFace) {
                                                                if (window.confirm(`You are flagging on ${currentFace} face, but this task is for ${targetFace}. Change current task?`)) {
                                                                    onChangeTaskClick?.();
                                                                }
                                                                return;
                                                            }

                                                            handleDynamicPropChange('x', x.toFixed(2));
                                                            handleDynamicPropChange('y', y.toFixed(2));
                                                            handleDynamicPropChange('distance_from_leg', geometry.distance.toFixed(1));
                                                            
                                                            if (geometry.nearestLeg) {
                                                                handleDynamicPropChange('nearest_leg', geometry.nearestLeg);
                                                            }
                                                            if (geometry.distToNearestLeg !== undefined) {
                                                                handleDynamicPropChange('dist_to_nearest_leg', geometry.distToNearestLeg.toFixed(1));
                                                            }
                                                            if (geometry.face) {
                                                                handleDynamicPropChange('face', geometry.face);
                                                            }
                                                        }
                                                    }}
                                                    onAddDebris={(x, y, geometry) => {
                                                        if (handleDynamicPropChange) {
                                                            // Spatial Validation based on QID (e.g. S/BED(A1-A2)-18M)
                                                            const distMatch = qid.match(/-(\d+)M$/i);
                                                            const faceMatch = qid.match(/\(([^)]+)\)/);
                                                            const targetDist = distMatch ? parseInt(distMatch[1]) : null;
                                                            const targetFace = faceMatch ? faceMatch[1] : null;

                                                            const currentDist = Math.round(geometry.distance);
                                                            const currentFace = `${geometry.startLeg}-${geometry.endLeg}`;
                                                            const currentInterval = geometry.nearestDistance;

                                                            if (targetDist !== null && currentInterval !== targetDist) {
                                                                if (window.confirm(`You are flagging in the ${currentInterval}m range, but this task is for ${targetDist}m. Change current task?`)) {
                                                                    onChangeTaskClick?.();
                                                                }
                                                                return;
                                                            }
                                                            if (targetFace && currentFace !== targetFace) {
                                                                if (window.confirm(`You are flagging on ${currentFace} face, but this task is for ${targetFace}. Change current task?`)) {
                                                                    onChangeTaskClick?.();
                                                                }
                                                                return;
                                                            }

                                                            handleDynamicPropChange('x', x.toFixed(2));
                                                            handleDynamicPropChange('y', y.toFixed(2));
                                                            handleDynamicPropChange('distance_from_leg', geometry.distance.toFixed(1));

                                                            if (geometry.nearestLeg) {
                                                                handleDynamicPropChange('nearest_leg', geometry.nearestLeg);
                                                            }
                                                            if (geometry.distToNearestLeg !== undefined) {
                                                                handleDynamicPropChange('dist_to_nearest_leg', geometry.distToNearestLeg.toFixed(1));
                                                            }
                                                            if (geometry.face) {
                                                                handleDynamicPropChange('face', geometry.face);
                                                            }
                                                        }
                                                        toast.info(`Point added at ${geometry.distance.toFixed(1)}m on ${geometry.face} face`);
                                                    }}
                                                />
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* MGI & UT Thickness Groups - rendered specially when present */}
                            {(() => {
                                const mgiFields = activeFormProps.filter((p: any) => p.group === 'mgi_thickness');
                                const utFields = activeFormProps.filter((p: any) => p.group === 'ut_thickness');
                                const otherFields = activeFormProps.filter((p: any) => 
                                    p.group !== 'mgi_thickness' && 
                                    p.group !== 'ut_thickness' &&
                                    p.name !== 'verification_depth' &&
                                    p.name !== 'inspection_date' &&
                                    p.name !== 'inspection_time' &&
                                    p.name !== 'tape_count_no' &&
                                    p.name !== 'northing' &&
                                    p.name !== 'easting'
                                );
                                
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
                                                className="col-span-2 border border-teal-200/50 dark:border-teal-800/60 bg-teal-50/20 dark:bg-teal-900/10 rounded-lg p-1.5 space-y-1.5 shadow-sm"
                                            >
                                                {/* Group Header */}
                                                <div className="flex items-center justify-between border-b border-teal-200 dark:border-teal-800 pb-1.5">
                                                     <div className="flex items-center gap-2">
                                                         <div className="w-6 h-6 bg-teal-600 rounded-lg flex items-center justify-center">
                                                             <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                                                         </div>
                                                         <div className="flex flex-col">
                                                            <span className="text-[11px] font-black text-teal-800 dark:text-teal-400 uppercase tracking-widest leading-none">MGI Thickness</span>
                                                            <span className="text-[8px] font-black text-slate-800 dark:text-slate-200 uppercase mt-0.5">
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
                                                            <span className="text-[10px] font-black text-teal-600 dark:text-teal-400 bg-teal-100/50 dark:bg-teal-900/30 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                                                                MAX: {resolveApplicableMax()?.toFixed(1) ?? '—'}mm
                                                            </span>
                                                         </div>
                                                     )}
                                                </div>

                                                {profileField && !activeMGIProfile && (
                                                    <div className="flex items-center gap-2 p-2.5 bg-amber-50/50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/40 rounded-lg">
                                                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                                        <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300">No active MGI Profile found. Configure one in Settings → MGI Profiler.</span>
                                                    </div>
                                                )}

                                                {/* Clock Position Headers */}
                                                <div className="grid grid-cols-[70px_1fr_1fr_1fr_1fr] gap-1.5 items-end">
                                                    <div></div>
                                                    {['12 o\'clk', '3 o\'clk', '6 o\'clk', '9 o\'clk'].map(pos => (
                                                        <div key={pos} className="text-center">
                                                            <span className="text-[8px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">{pos}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Hard Thickness Row */}
                                                {hardFields.length > 0 && (
                                                    <div className="grid grid-cols-[70px_1fr_1fr_1fr_1fr] gap-1.5 items-center">
                                                        <span className="text-[9px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-wider bg-rose-50/50 dark:bg-rose-900/30 border border-rose-200/50 dark:border-rose-800/40 rounded-md px-1.5 py-1 text-center">Hard</span>
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
                                                        <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider bg-emerald-50/50 dark:bg-emerald-900/30 border border-emerald-200/50 dark:border-emerald-800/40 rounded-md px-2 py-1.5 text-center">Soft</span>
                                                        {softFields.map((p: any) => (
                                                            <div key={p.name}>
                                                                {renderInspectionField(p, 'primary')}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Unit indicator */}
                                                <div className="text-right">
                                                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 italic">All values in mm</span>
                                                </div>
                                            </motion.div>
                                        )}

                                        {utFields.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="col-span-2 border border-blue-200/50 dark:border-blue-800/60 bg-blue-50/20 dark:bg-blue-900/10 rounded-lg p-1.5 space-y-1.5 shadow-sm mb-2"
                                            >
                                                <div className="flex items-center gap-2 border-b border-blue-200 dark:border-blue-800 pb-1">
                                                     <div className="w-6 h-6 bg-blue-600 dark:bg-blue-700 rounded-lg flex items-center justify-center">
                                                         <Search className="w-3.5 h-3.5 text-white" />
                                                     </div>
                                                     <span className="text-[10px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest leading-none">UT Thickness Readings</span>
                                                </div>

                                                <div className="flex flex-wrap gap-2">
                                                    {utFields.filter((f: any) => f.name !== 'nominal_thickness').map((p: any) => (
                                                        <div key={p.name} className="space-y-0.5 flex-grow min-w-[100px] max-w-[150px]">
                                                            <label className="text-[9px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-center block w-full">{p.label}</label>
                                                            {renderInspectionField(p, 'primary')}
                                                        </div>
                                                    ))}
                                                </div>

                                                {utFields.find((f: any) => f.name === 'nominal_thickness') && (
                                                    <div className="pt-1.5 border-t border-blue-100/50 dark:border-blue-900/30">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="space-y-0.5">
                                                                <label className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">Nominal Thickness</label>
                                                                {renderInspectionField(utFields.find((f: any) => f.name === 'nominal_thickness'), 'primary')}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}

                                        {/* Other (non-specialized) fields in normal 2-col grid */}
                                        {activeSpec?.toUpperCase() === 'MGROW' ? (() => {
                                            const circFields = otherFields.filter((p: any) => 
                                                p.name === 'circumferential_measurement_5m_above' || 
                                                p.name === 'circumferential_measurement_0m' || 
                                                p.name === 'circumferential_measurement_5m_below'
                                            );
                                            const boolFields = otherFields.filter((p: any) => p.type === 'boolean');
                                            const restFields = otherFields.filter((p: any) => 
                                                !circFields.includes(p) && !boolFields.includes(p)
                                            );

                                            return (
                                                <div className="space-y-4">
                                                    {circFields.length > 0 && (
                                                        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-lg p-1.5 space-y-1 shadow-sm">
                                                            <label className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest block border-b border-slate-100 dark:border-slate-800 pb-1">
                                                                Circumference
                                                            </label>
                                                            <div className="flex flex-wrap gap-2">
                                                                {['circumferential_measurement_5m_above', 'circumferential_measurement_0m', 'circumferential_measurement_5m_below'].map((name) => {
                                                                    const p = circFields.find(f => f.name === name);
                                                                    if (!p) return null;
                                                                    const customLabel = name === 'circumferential_measurement_5m_above' ? '-5m' : 
                                                                                        name === 'circumferential_measurement_0m' ? '0m' : '+5m';
                                                                    return (
                                                                        <div key={name} className="space-y-1 flex-grow min-w-[80px] max-w-[120px]">
                                                                            <label className="text-[9px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block text-center">
                                                                                {customLabel}
                                                                            </label>
                                                                            {renderInspectionField({...p, label: customLabel}, 'primary')}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {restFields.length > 0 && (
                                                        <div className="flex flex-wrap gap-x-3 gap-y-2">
                                                            {restFields.map((p: any) => {
                                                                const isFullWidth = p.name === 'cp_readings' || p.type === 'repeater' || p.type === 'textarea';
                                                                const isNumber = p.type === 'number' || p.name?.toLowerCase().includes('rdg') || p.name?.toLowerCase().includes('value');
                                                                
                                                                return (
                                                                    <div key={p.name} className={`space-y-0.5 flex-grow ${isFullWidth ? 'min-w-full' : (isNumber ? 'min-w-[90px] max-w-[140px]' : 'min-w-[130px] max-w-[200px]')}`}>
                                                                        <label className="text-[9px] font-black text-slate-800 dark:text-slate-200 uppercase truncate block">
                                                                            {p.label || p.name}
                                                                        </label>
                                                                        {renderInspectionField(p, 'primary')}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}


                                                    {boolFields.length > 0 && (
                                                        <div className="grid grid-cols-3 gap-3">
                                                            {boolFields.map((p: any) => (
                                                                <div key={p.name} className="space-y-1.5">
                                                                    <label className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase mb-1 block">
                                                                        {p.label || p.name}
                                                                    </label>
                                                                    {renderInspectionField(p, 'primary')}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })() : activeSpec?.toUpperCase() === 'MPINS' ? (() => {
                                            const mpiSetupFields = otherFields.filter((p: any) => 
                                                p.name === 'magnetic_ink' || 
                                                p.name === 'magnetic_method' || 
                                                p.name === 'background_condition' || 
                                                p.name === 'lighting_method' || 
                                                p.name === 'calib_block' || 
                                                p.name === 'magnetic_lifting_power' || 
                                                p.name === 'orientation' || 
                                                p.name === 'indication' || 
                                                p.name === 'probe' || 
                                                p.name === 'burmah_c_strip' ||
                                                p.name === 'probe_size' ||
                                                p.name === 'current_in_coil_magnet' ||
                                                p.name === 'voltage_in_coil_magnet' ||
                                                p.name === 'current_pole_spacing'
                                            );
                                            const cpFields = otherFields.filter((p: any) => 
                                                p.name === 'cp_at_12clk' || 
                                                p.name === 'cp_at_3clk' || 
                                                p.name === 'cp_at_6clk' || 
                                                p.name === 'cp_at_9clk'
                                            );
                                            const thicknessFields = otherFields.filter((p: any) => 
                                                p.name === 'nominal_thickness' ||
                                                p.name === 'brace_thick_12clk' || 
                                                p.name === 'brace_thick_3clk' || 
                                                p.name === 'brace_thick_6clk' || 
                                                p.name === 'brace_thick_9clk' ||
                                                p.name === 'chord_thick_12clk' || 
                                                p.name === 'chord_thick_3clk' || 
                                                p.name === 'chord_thick_6clk' || 
                                                p.name === 'chord_thick_9clk'
                                            );
                                            const locationFields = otherFields.filter((p: any) => 
                                                p.name && (p.name.startsWith('toe_') || p.name.startsWith('weld_'))
                                            );
                                            const restFields = otherFields.filter((p: any) => 
                                                !mpiSetupFields.includes(p) && 
                                                !cpFields.includes(p) && 
                                                !thicknessFields.includes(p) && 
                                                !locationFields.includes(p)
                                            );

                                            return (
                                                <div className="space-y-4">
                                                    {mpiSetupFields.length > 0 && (
                                                        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-lg p-1.5 space-y-1.5 shadow-sm">
                                                            <label className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest block border-b border-slate-100 dark:border-slate-800 pb-1">
                                                                MPI Equipment & Setup
                                                            </label>
                                                            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                                                                {mpiSetupFields.map((p: any, idx: number) => {
                                                                    const isNumber = p.type === 'number' || p.name?.toLowerCase().includes('spacing') || p.name?.toLowerCase().includes('power');
                                                                    return (
                                                                        <div key={p.name || `setup-${idx}`} className={`space-y-0.5 flex-grow ${isNumber ? 'min-w-[90px] max-w-[140px]' : 'min-w-[130px] max-w-[200px]'}`}>
                                                                            <label className="text-[9px] font-black text-slate-800 dark:text-slate-200 uppercase truncate block">
                                                                                {p.label || p.name}
                                                                            </label>
                                                                            {renderInspectionField(p, 'primary')}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {thicknessFields.length > 0 && (
                                                        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-lg p-1.5 space-y-1.5 shadow-sm">
                                                            <label className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest block border-b border-slate-100 dark:border-slate-800 pb-1">
                                                                Thickness Readings (Brace & Chord)
                                                            </label>
                                                            <div className="flex flex-wrap gap-2">
                                                                {thicknessFields.map((p: any, idx: number) => (
                                                                    <div key={p.name || `thick-${idx}`} className={`space-y-0.5 flex-grow ${p.name === 'nominal_thickness' ? 'min-w-full mb-1 border-b border-slate-100 dark:border-slate-800 pb-1' : 'min-w-[100px] max-w-[150px]'}`}>
                                                                        <label className="text-[9px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block text-center">
                                                                            {p.label || p.name}
                                                                        </label>
                                                                        {renderInspectionField(p, 'primary')}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {cpFields.length > 0 && (
                                                        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-lg p-1.5 space-y-1.5 shadow-sm">
                                                            <label className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest block border-b border-slate-100 dark:border-slate-800 pb-1">
                                                                CP Readings
                                                            </label>
                                                            <div className="flex flex-wrap gap-2">
                                                                {cpFields.map((p: any, idx: number) => (
                                                                    <div key={p.name || `cp-${idx}`} className="space-y-0.5 flex-grow min-w-[90px] max-w-[140px]">
                                                                        <label className="text-[9px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block text-center">
                                                                            {p.label || p.name}
                                                                        </label>
                                                                        {renderInspectionField(p, 'primary')}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {locationFields.length > 0 && (
                                                        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-lg p-1.5 space-y-1.5 shadow-sm">
                                                            <label className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest block border-b border-slate-100 dark:border-slate-800 pb-1">
                                                                Toe & Weld Descriptions
                                                            </label>
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                                {locationFields.map((p: any, idx: number) => (
                                                                    <div key={p.name || `loc-${idx}`} className="space-y-0.5">
                                                                        <label className="text-[9px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block text-center">
                                                                            {p.label || p.name}
                                                                        </label>
                                                                        {renderInspectionField(p, 'primary')}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {restFields.length > 0 && (
                                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-3 gap-y-1.5">
                                                            {restFields.map((p: any, idx: number) => {
                                                                const isFullWidth = p.name === 'cp_readings' || p.type === 'repeater' || p.type === 'textarea';
                                                                return (
                                                                    <div key={p.name || `rest-${idx}`} className={`${isFullWidth ? 'col-span-full' : 'col-span-2'} space-y-0.5`}>
                                                                        <label className="text-[9px] font-bold text-slate-800 dark:text-slate-200 uppercase truncate block">
                                                                            {p.label || p.name}
                                                                        </label>
                                                                        {renderInspectionField(p, 'primary')}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })() : activeSpec?.toUpperCase() === 'RSEAB' ? (() => {
                                            const technicalFields = ['face', 'dist_to_nearest_leg', 'distance_from_leg_unit', 'crater_depth_unit', 'crater_diameter_unit', 'finding_type', 'type', 'orientation'];
                                            const visibleFields = otherFields.filter((p: any) => shouldShowField(p) && !technicalFields.includes(p.name));
                                            
                                            const locationFields = visibleFields.filter((p: any) => p.group === 'location');
                                            const itemDetailsFields = visibleFields.filter((p: any) => p.group === 'item_details');
                                            const gridFields = visibleFields.filter((p: any) => p.group === 'grid_coordinates');
                                            const restFields = visibleFields.filter((p: any) => 
                                                !locationFields.includes(p) && 
                                                !itemDetailsFields.includes(p) && 
                                                !gridFields.includes(p)
                                            );

                                            return (
                                                <div className="space-y-4">
                                                    {locationFields.length > 0 && (
                                                        <div className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl p-2.5 space-y-2 shadow-sm">
                                                            <label className="text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest block border-b border-slate-100 dark:border-slate-800 pb-1.5 text-blue-600 dark:text-blue-400">
                                                                Location
                                                            </label>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                {locationFields.map((p: any) => (
                                                                    <div key={p.name} className="space-y-1">
                                                                        <label className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                                                                            {p.label || p.name}
                                                                        </label>
                                                                        {renderInspectionField(p, 'primary')}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {itemDetailsFields.length > 0 && (
                                                        <div className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl p-2.5 space-y-2 shadow-sm">
                                                            <label className="text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest block border-b border-slate-100 dark:border-slate-800 pb-1.5 text-indigo-600 dark:text-indigo-400">
                                                                Item Details
                                                            </label>
                                                            <div className="grid grid-cols-3 gap-3">
                                                                {itemDetailsFields.map((p: any) => (
                                                                    <div key={p.name} className={p.name === 'category' ? 'col-span-3 border-b border-slate-50 dark:border-slate-800 pb-2 mb-1' : 'space-y-1'}>
                                                                        <label className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                                                                            {p.label || p.name}
                                                                        </label>
                                                                        {renderInspectionField(p, 'primary')}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {gridFields.length > 0 && (
                                                        <div className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl p-2.5 space-y-2 shadow-sm">
                                                            <label className="text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest block border-b border-slate-100 dark:border-slate-800 pb-1.5 text-emerald-600 dark:text-emerald-400">
                                                                Grid & Offset
                                                            </label>
                                                            <div className="grid grid-cols-4 gap-3">
                                                                {gridFields.map((p: any) => (
                                                                    <div key={p.name} className="space-y-1">
                                                                        <label className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                                                                            {p.label || p.name}
                                                                        </label>
                                                                        {renderInspectionField(p, 'primary')}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {restFields.length > 0 && (
                                                        <div className="grid grid-cols-3 gap-3">
                                                            {restFields.map((p: any) => (
                                                                <div key={p.name} className="space-y-1">
                                                                    <label className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                                                                        {p.label || p.name}
                                                                    </label>
                                                                    {renderInspectionField(p, 'primary')}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })() : activeSpec?.toUpperCase() === 'PL_AN' ? (() => {
                                            const cpFields = otherFields.filter((p: any) => 
                                                p.name === 'member_cp' || 
                                                p.name === 'anode_cp' || 
                                                p.name === 'topstub_cp' || 
                                                p.name === 'bottomstub_cp'
                                            );
                                            const pittingFields = otherFields.filter((p: any) => 
                                                p.name === 'max_pitting_depth' || 
                                                p.name === 'avg_pitting_depth' || 
                                                p.name === 'max_pitting_diameter' || 
                                                p.name === 'avg_pitting_diameter'
                                            );
                                            const circFields = otherFields.filter((p: any) => 
                                                p.name === 'circumference_c1' || 
                                                p.name === 'circumference_c2' || 
                                                p.name === 'circumference_c3'
                                            );
                                            const restFields = otherFields.filter((p: any) => 
                                                !cpFields.includes(p) && !pittingFields.includes(p) && !circFields.includes(p)
                                            );

                                            return (
                                                <div className="space-y-3">
                                                    {restFields.length > 0 && (
                                                        <div className="grid grid-cols-3 gap-x-3 gap-y-2">
                                                            {restFields.map((p: any) => (
                                                                <div key={p.name} className={p.name === 'cp_readings' || p.type === 'repeater' || p.type === 'textarea' ? 'col-span-3' : 'space-y-1'}>
                                                                    <label className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase truncate block">
                                                                        {p.label || p.name}
                                                                    </label>
                                                                    {renderInspectionField(p, 'primary')}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {cpFields.length > 0 && (
                                                        <div className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl p-2.5 space-y-2 shadow-sm">
                                                            <label className="text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest block border-b border-slate-100 dark:border-slate-800 pb-1.5">
                                                                CP Readings
                                                            </label>
                                                            <div className="grid grid-cols-3 gap-2">
                                                                {cpFields.map((p: any) => (
                                                                    <div key={p.name} className="space-y-1">
                                                                        <label className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                                                                            {p.label || p.name}
                                                                        </label>
                                                                        {renderInspectionField(p, 'primary')}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {pittingFields.length > 0 && (
                                                        <div className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl p-2.5 space-y-2 shadow-sm">
                                                            <label className="text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest block border-b border-slate-100 dark:border-slate-800 pb-1.5">
                                                                Pitting
                                                            </label>
                                                            <div className="grid grid-cols-3 gap-2">
                                                                {pittingFields.map((p: any) => (
                                                                    <div key={p.name} className="space-y-1">
                                                                        <label className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                                                                            {p.label || p.name}
                                                                        </label>
                                                                        {renderInspectionField(p, 'primary')}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {circFields.length > 0 && (
                                                        <div className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl p-2.5 space-y-2 shadow-sm">
                                                            <label className="text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest block border-b border-slate-100 dark:border-slate-800 pb-1.5">
                                                                Circumference
                                                            </label>
                                                            <div className="grid grid-cols-3 gap-2">
                                                                {circFields.map((p: any) => (
                                                                    <div key={p.name} className="space-y-1">
                                                                        <label className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                                                                            {p.label || p.name}
                                                                        </label>
                                                                        {renderInspectionField(p, 'primary')}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })() : (
                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-3 gap-y-2">
                                                {otherFields.map((p: any, idx: number) => {
                                                    if (isAnomaly && (p.name === 'has_anomaly' || p.name === 'anomalydata')) return null;
                                                    if (!shouldShowField(p)) return null;

                                                    const isFullWidth = p.name === 'cp_readings' || p.type === 'repeater' || p.type === 'textarea';
                                                    const isNumber = p.type === 'number' || p.name?.toLowerCase().includes('rdg') || p.name?.toLowerCase().includes('value');

                                                    return (
                                                        <motion.div 
                                                            layout
                                                            key={`${p.name || p.label}-${idx}`} 
                                                            className={`flex-grow ${isFullWidth ? 'min-w-full' : (isNumber ? 'min-w-[90px] max-w-[140px]' : 'min-w-[130px] max-w-[200px]')} space-y-0.5`}
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            transition={{ delay: idx * 0.03 }}
                                                        >
                                                            <div className="space-y-0.5">
                                                                <label className="text-[9px] font-black text-slate-800 dark:text-slate-200 uppercase truncate block">
                                                                    {p.label || p.name}
                                                                    {p.isLegacy && <span className="ml-1 text-amber-500 dark:text-amber-400 lowercase">(L)</span>}
                                                                </label>
                                                                {renderInspectionField(p, 'primary')}
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        )}
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

                    <div className="space-y-1.5 p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 shadow-sm animate-in fade-in slide-in-from-top-1">
                        <label className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest block border-b border-slate-100 dark:border-slate-800 pb-1">Inspection Result</label>
                        <div className="grid grid-cols-4 gap-1.5">
                            <Button
                                variant={findingType === 'Complete' ? 'default' : 'outline'}
                                onClick={() => {
                                    if (findingType === 'Anomaly' || findingType === 'Finding') {
                                        if (anomalyData.defectCode || anomalyData.description) {
                                            if (!confirm('Switching to Complete will clear the defect/finding details. Continue?')) return;
                                        }
                                        setAnomalyData({defectCode: '', priority: '', defectType: '', description: '', recommendedAction: '',
                                            rectify: false, rectifiedDate: '', rectifiedRemarks: '', severity: 'Minor', referenceNo: '' });
                                        setLastAutoMatchedRuleId(null);
                                        setIsManualOverride(false);
                                    }
                                    setFindingType('Complete');
                                }}
                                className={`h-8 text-[10px] font-bold transition-all ${findingType === 'Complete' ? 'bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-800 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Complete
                            </Button>
                            <Button
                                variant={findingType === 'Finding' ? 'default' : 'outline'}
                                onClick={() => {
                                    if (findingType !== 'Finding') setAnomalyData((prev: any) => ({ ...prev, referenceNo: '' }));
                                    setFindingType('Finding');
                                    setIsManualOverride(true);
                                }}
                                className={`h-8 text-[10px] font-bold transition-all ${findingType === 'Finding' ? 'bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
                            >
                                <FileText className="w-3.5 h-3.5 mr-1" /> Finding
                            </Button>
                            <Button
                                variant={findingType === 'Anomaly' ? 'default' : 'outline'}
                                onClick={() => {
                                    if (findingType !== 'Anomaly') setAnomalyData((prev: any) => ({ ...prev, referenceNo: '' }));
                                    setFindingType('Anomaly');
                                    setIsManualOverride(true);
                                }}
                                className={`h-8 text-[10px] font-bold transition-all ${findingType === 'Anomaly' ? 'bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-800 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
                            >
                                <AlertCircle className="w-3.5 h-3.5 mr-1" /> Anomaly
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
                                className={`h-8 text-[10px] font-bold transition-all ${findingType === 'Incomplete' ? 'bg-amber-500 dark:bg-amber-600 hover:bg-amber-600 dark:hover:bg-amber-700 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}
                            >
                                <Clock className="w-3.5 h-3.5 mr-1" /> Incomplete
                            </Button>
                        </div>
                    </div>

                    {(findingType === 'Anomaly' || findingType === 'Finding') && (() => {
                        const isAnomaly = findingType === 'Anomaly';
                        const categoryLabel = isAnomaly ? 'Anomaly' : 'Finding';
                        const ringClass = isAnomaly ? "focus:ring-red-500" : "focus:ring-blue-500";
                        return (
                            <div className={`mt-3 p-3 rounded-lg border-2 space-y-3 animate-in fade-in slide-in-from-top-2 ${isAnomaly ? 'border-red-200 dark:border-red-900/30 bg-red-50/30 dark:bg-red-900/10' : 'border-blue-200 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/10'}`}>
                                <div className={`text-[10px] font-black uppercase tracking-widest border-b pb-2 ${isAnomaly ? 'text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' : 'text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'}`}>
                                    {isAnomaly ? '⚠ Anomaly / Defect Details' : '📋 Finding Details'}
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <div className="space-y-1.5 flex-grow min-w-[140px] max-w-[220px]">
                                        <label className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase">{isAnomaly ? 'Defect Code' : 'Finding Code'} *</label>
                                        <select
                                            value={anomalyData.defectCode}
                                            onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, defectCode: e.target.value }))}
                                            className={`flex h-9 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-semibold dark:text-slate-200 ${ringClass}`}
                                        >
                                            <option value="">Select Code</option>
                                            {defectCodes.map(c => (
                                                <option key={c.lib_id} value={c.lib_desc}>{c.lib_desc}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5 flex-grow min-w-[140px] max-w-[220px]">
                                        <label className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase">{isAnomaly ? 'Defect Type' : 'Finding Type'}</label>
                                        <select
                                            value={anomalyData.defectType}
                                            onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, defectType: e.target.value }))}
                                            className={`flex h-9 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-semibold dark:text-slate-200 ${ringClass}`}
                                        >
                                            <option value="">Select Type</option>
                                            {availableDefectTypes.map(t => (
                                                <option key={t.lib_id} value={t.lib_desc}>{t.lib_desc}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5 flex-grow min-w-[140px] max-w-[220px]">
                                        <label className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase">Priority *</label>
                                        <select
                                            value={anomalyData.priority}
                                            onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, priority: e.target.value }))}
                                            className={`flex h-9 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-semibold dark:text-slate-200 ${ringClass}`}
                                        >
                                            <option value="">Select Priority</option>
                                            {priorities.map(p => (
                                                <option key={p.lib_id} value={p.lib_desc}>{p.lib_desc}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5 flex-grow min-w-[140px] max-w-[220px]">
                                        <label className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase">Reference No</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                readOnly
                                                value={anomalyData.referenceNo}
                                                placeholder="Auto-generated on Save..."
                                                className={`flex h-9 w-full rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 px-2.5 text-xs font-mono font-bold text-slate-500 dark:text-slate-400 cursor-not-allowed`}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 flex-grow min-w-full">
                                        <label className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase">Recommendation</label>
                                        <textarea
                                            value={anomalyData.recommendedAction}
                                            onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, recommendedAction: e.target.value }))}
                                            placeholder="Enter recommendation for this defect/finding..."
                                            className={`w-full min-h-[60px] rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2 text-xs font-semibold dark:text-slate-200 focus:outline-none focus:ring-2 ${ringClass}`}
                                        />
                                    </div>
                                </div>



                                <div className="p-3 border border-green-100 dark:border-green-900/30 bg-green-50/80 dark:bg-green-900/10 rounded-lg space-y-3">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="rectifyCheck"
                                            checked={anomalyData.rectify}
                                            onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, rectify: e.target.checked }))}
                                            className="w-4 h-4 rounded text-green-600 focus:ring-green-500 border-green-300 dark:border-green-800 cursor-pointer"
                                        />
                                        <label htmlFor="rectifyCheck" className="text-xs font-bold text-green-800 dark:text-green-400 cursor-pointer">Rectify {categoryLabel}</label>
                                    </div>
                                    {anomalyData.rectify && (
                                        <div className="space-y-3 animate-in fade-in zoom-in-95">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-green-700 uppercase">Rectified Date</label>
                                                <Input
                                                    type="date"
                                                    value={anomalyData.rectifiedDate}
                                                    onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, rectifiedDate: e.target.value }))}
                                                    className="h-8 text-xs bg-white dark:bg-slate-950 border-green-200 dark:border-green-900/30"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-green-700 uppercase">Rectification Remarks</label>
                                                <textarea
                                                    value={anomalyData.rectifiedRemarks}
                                                    onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, rectifiedRemarks: e.target.value }))}
                                                    placeholder="How was it rectified?"
                                                    className="w-full min-h-[50px] rounded border border-green-200 dark:border-green-900/30 p-2 text-xs bg-white dark:bg-slate-950 dark:text-slate-200 focus:ring-green-500"
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
                                className="w-full min-h-[80px] rounded border border-amber-200 dark:border-amber-900/30 p-2 text-xs bg-amber-50/30 dark:bg-amber-900/10 dark:text-slate-200 focus:ring-amber-500"
                            ></textarea>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase flex items-center gap-1"><FileText className="w-3 h-3" /> Findings</label>
                            <FindingsSuggestionEngine 
                                supabase={supabase}
                                componentType={selectedComp?.raw?.type || ""}
                                inspectionTypeCode={activeSpec || ""}
                                onSelect={(val) => {
                                    // Append if existing, otherwise set
                                    if (recordNotes && recordNotes.trim()) {
                                        setRecordNotes(`${recordNotes.trim()}\n${val}`);
                                    } else {
                                        setRecordNotes(val);
                                    }
                                }}
                                currentFinding={recordNotes}
                            />
                        </div>
                        <textarea 
                            value={recordNotes} 
                            onChange={(e) => setRecordNotes(e.target.value)} 
                            placeholder="Observation specifics, dimensions, characteristics..." 
                            className="w-full min-h-[80px] rounded-lg border border-slate-300 dark:border-slate-700 p-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none bg-slate-50/50 dark:bg-slate-950/50 dark:text-slate-200 shadow-inner"
                        ></textarea>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase flex items-center gap-1">
                                <Paperclip className="w-3.5 h-3.5" /> Attachments ({pendingAttachments.length})
                            </label>
                            <div className="flex gap-1.5">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-7 text-[10px] font-bold border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
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
                                    className="h-7 text-[10px] font-bold border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
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
                            <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto p-1 bg-slate-50/50 dark:bg-slate-950/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                {pendingAttachments.map(att => (
                                    <div key={att.id} className="relative group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-1.5 flex gap-2 overflow-hidden shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition-all">
                                        <div 
                                            className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden flex-shrink-0 relative cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                                            onClick={() => setEditingAttachment(att)}
                                        >
                                            {att.type === 'PHOTO' && att.previewUrl ? (
                                                <img src={att.previewUrl} className="w-full h-full object-cover" />
                                            ) : att.type === 'VIDEO' && att.previewUrl ? (
                                                <div className="w-full h-full relative">
                                                    <video src={att.previewUrl} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                        <Video className="w-5 h-5 text-white opacity-80" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-slate-800">
                                                    {att.type === 'VIDEO' ? <Video className="w-5 h-5 opacity-40" /> : <FileText className="w-5 h-5 opacity-40" />}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 pr-6 flex flex-col gap-0.5">
                                            <Input 
                                                value={att.title} 
                                                onChange={(e) => setPendingAttachments((prev: any[]) => prev.map(a => a.id === att.id ? { ...a, title: e.target.value } : a))}
                                                className="h-5 text-[10px] font-black border-none bg-slate-50/50 dark:bg-slate-950/50 rounded-sm px-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-slate-800 dark:text-slate-200"
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
                                            onClick={() => {
                                                if (att.isExisting) {
                                                    setDeletedAttachmentIds(prev => [...prev, att.id]);
                                                }
                                                setPendingAttachments((prev: any[]) => prev.filter(a => a.id !== att.id));
                                            }}
                                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 rounded bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {pendingAttachments.length === 0 && (
                            <div className="py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950/50 opacity-60">
                                <Paperclip className="w-6 h-6 text-slate-300 dark:text-slate-700 mb-1" />
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">No Attachments Picked</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ScrollArea>

            <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
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
                        <div className="w-full">
                            {!canCommit && !isEditing && (
                                <div className="mb-2 p-2 rounded-lg border border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-400 text-[10px] font-semibold flex items-start gap-2 shadow-sm">
                                    <span className="text-amber-500 text-sm leading-none mt-0.5">⚠</span>
                                    <div>
                                        <span className="font-black uppercase text-[9px] tracking-wider block mb-0.5">Checklist incomplete</span>
                                        {issues.map((issue, i) => (
                                            <span key={i} className="block text-amber-700 dark:text-amber-500">• {issue}</span>
                                        ))}
                                        <span className="block mt-1 text-[9px] text-amber-500 italic">Enable <b>Manual Entry</b> mode in the header to bypass.</span>
                                    </div>
                                </div>
                            )}
                            <Button disabled={isCommitting || !canCommit} onClick={handleCommitRecord} className={`w-full h-9 font-black shadow-lg text-white text-xs tracking-wide rounded-lg transition-all ${canCommit ? 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]' : 'bg-slate-300 cursor-not-allowed'}`}>
                                {isCommitting ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-2" />} 
                                {isCommitting ? "Committing..." : (isEditing ? "Update Record" : "Commit Record & Reset")}
                            </Button>
                        </div>
                    );
                })()}
            </div>
        </Card>
    );
};
