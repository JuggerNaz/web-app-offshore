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
import inspectionSpecs from "@/utils/types/inspection-types.json";

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
    validateAnomalyRef: (ref: string) => Promise<boolean>;
    setPrevRefNo: (val: string) => void;
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
    onPrintReport,
    validateAnomalyRef,
    setPrevRefNo
}) => {
    const refInputRef = React.useRef<HTMLInputElement>(null);
    const isAnomaly = findingType === 'Anomaly';
    const ringClass = isAnomaly ? "focus:ring-red-500" : "focus:ring-blue-500";
    const categoryLabel = isAnomaly ? 'Anomaly' : 'Finding';

    const savedTapeCount = dynamicProps?.tape_count_no;
    const getCounterAsSeconds = (val: any) => {
        if (val !== undefined && val !== "" && val !== null) {
            if (typeof val === 'number') return val;
            const pts = String(val).split(':').map(Number);
            if (pts.length === 3) return (pts[0] || 0) * 3600 + (pts[1] || 0) * 60 + (pts[2] || 0);
            if (pts.length === 2) return (pts[0] || 0) * 60 + (pts[1] || 0);
            const n = Number(val);
            if (!isNaN(n)) return n;
        }
        return vidTimer;
    };

    const shouldShowField = (p: any) => {
        if (!p.condition) return true;
        const { field, value } = p.condition;
        const actualValue = dynamicProps[field];
        return actualValue === value;
    };

    const currentDisplayCount = getCounterAsSeconds(savedTapeCount);

    const resolvedRseabFields = React.useMemo(() => {
        if (activeSpec?.toUpperCase() !== 'RSEAB') return [];
        const localRseab = inspectionSpecs.inspectionTypes.find(t => t.code === 'RSEAB');
        const sharedFields = (inspectionSpecs as any).sharedFields || {};
        return (localRseab?.fields || []).map((f: any) => {
            if (f.$ref) {
                const shared = sharedFields[f.$ref];
                return { ...shared, ...f, $ref: undefined };
            }
            return f;
        });
    }, [activeSpec]);

    const resolvedFields = React.useMemo(() => {
        const activeSpecStr = String(activeSpec || '').toUpperCase();
        if (!activeSpecStr) return activeFormProps || [];
        const spec = (inspectionSpecs as any)?.inspectionTypes?.find((t: any) => 
            (t.code || '').toUpperCase() === activeSpecStr || (t.name || '').toUpperCase() === activeSpecStr
        );
        const jsonFields = spec ? spec.fields.map((f: any) => {
            if (f.$ref) {
                const fieldRef = (inspectionSpecs as any).sharedFields?.[f.$ref];
                return fieldRef ? { ...fieldRef, ...f, $ref: undefined } : f;
            }
            return f;
        }) : [];
        const excludedFields = [
            'northing', 'easting', 'verified_depth', 'verification_depth', 
            'location_northing', 'location_easting', 'inspection_date', 
            'inspection_time', 'tape_count_no', 'finding_type',
            'x', 'y', 'reference_leg', 'distance_from_leg', 'nearest_leg',
            'dist_to_nearest_leg', 'face', 'reference_leg_id', 'nearest_leg_id'
        ];
        const fieldsToUse = jsonFields.length > 0 ? jsonFields : activeFormProps;
        return (fieldsToUse || []).filter((p: any) => p && shouldShowField(p) && !excludedFields.includes(p.name));
    }, [activeSpec, activeFormProps, dynamicProps]);

    const fieldGroups = React.useMemo(() => {
        if (!resolvedFields) return null;
        const location = resolvedFields.filter((p: any) => p && p.group === 'location');
        const itemDetails = resolvedFields.filter((p: any) => p && p.group === 'item_details');
        const grid = resolvedFields.filter((p: any) => p && (p.group === 'grid' || p.group === 'grid_coordinates'));
        const mgi = resolvedFields.filter((p: any) => p && p.group === 'mgi_thickness');
        const ut = resolvedFields.filter((p: any) => p && p.group === 'ut_thickness');
        const rest = resolvedFields.filter((p: any) => p && !['location', 'item_details', 'grid', 'grid_coordinates', 'mgi_thickness', 'ut_thickness'].includes(p.group));
        return { location, itemDetails, grid, mgi, ut, rest };
    }, [resolvedFields]);

    const isDepActive = !!activeDep && activeDep.raw?.status !== 'COMPLETED';
    const isAtWorksite = React.useMemo(() => {
        const movement = String(currentMovement || '').toUpperCase();
        return ["ARRIVED BOTTOM", "DIVER AT WORKSITE", "BELL AT WORKING DEPTH", "DIVER LOCKED OUT", "AT_WORKSITE", "AT WORKSITE", "ROV AT THE WORKSITE"].some(ws => movement.includes(ws));
    }, [currentMovement]);
    const hasTape = !!tapeId;
    const isRecording = vidState === 'RECORDING';
    const canCommit = (isDepActive && isAtWorksite && hasTape && isRecording) || isManualOverride || isEditing;

    const issues = React.useMemo(() => {
        const list: string[] = [];
        if (!isDepActive) list.push('Deployment record not active');
        if (!isAtWorksite) list.push('Not at worksite yet');
        if (!hasTape) list.push('No tape selected');
        if (!isRecording) list.push('Video not recording');
        return list;
    }, [isDepActive, isAtWorksite, hasTape, isRecording]);

    const [lastFlaggedThreshold, setLastFlaggedThreshold] = React.useState<number | null>(null);

    const getInterpolatedThreshold = (vDepth: any, vUnit: string, wDepth: number, thresholds: any[]) => {
        if (!thresholds || thresholds.length === 0) return null;
        const vDepthStr = String(vDepth).replace(/[^\d.-]/g, '');
        let currentDepth = Math.abs(parseFloat(vDepthStr) || 0);
        let waterDepth = Math.abs(wDepth || 0);
        if (waterDepth === 0 && selectedComp) {
            const type = (selectedComp.raw?.type || String(selectedComp.name || '')).toUpperCase();
            if (type.includes('LEG')) {
                const lElev = parseFloat(String(selectedComp.lowestElev || '0').replace(/[^\d.-]/g, ''));
                if (!isNaN(lElev)) waterDepth = Math.abs(lElev);
            }
        }
        if (vUnit === 'ft') currentDepth *= 0.3048;
        else if (vUnit === 'in') currentDepth *= 0.0254;
        else if (vUnit === 'mm') currentDepth /= 1000;
        else if (vUnit === 'cm') currentDepth /= 100;

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

    React.useEffect(() => {
        if (!activeMGIProfile || !activeMGIProfile.thresholds || activeMGIProfile.thresholds.length === 0) return;
        if (!activeSpec || (activeSpec.toUpperCase() !== 'MGI' && activeSpec.toUpperCase() !== 'RMGI')) return;
        const vDepthRaw = dynamicProps?.verification_depth || (selectedComp.lowestElev && selectedComp.lowestElev !== '-' ? selectedComp.lowestElev : selectedComp.depth) || '0';
        const vDepthUnit = dynamicProps?.verification_depth_unit || 'm';
        const waterDepth = Math.abs(headerData.waterDepth || 0);
        const applicableMax = getInterpolatedThreshold(vDepthRaw, vDepthUnit, waterDepth, activeMGIProfile.thresholds);
        if (applicableMax === null) return;
        const formattedThreshold = `${applicableMax.toFixed(1)}mm`;
        if (dynamicProps?.mgi_profile !== formattedThreshold && handleDynamicPropChange) {
            handleDynamicPropChange('mgi_profile', formattedThreshold);
        }
        const thicknessFields = ['mgi_hard_thickness_at_12', 'mgi_hard_thickness_at_3', 'mgi_hard_thickness_at_6', 'mgi_hard_thickness_at_9'];
        const currentMaxT = Math.max(...thicknessFields.map(f => parseFloat(dynamicProps?.[f]) || 0));
        if (currentMaxT > applicableMax) {
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
            setLastFlaggedThreshold(null);
        }
    }, [dynamicProps?.mgi_hard_thickness_at_12, dynamicProps?.mgi_hard_thickness_at_3, dynamicProps?.mgi_hard_thickness_at_6, dynamicProps?.mgi_hard_thickness_at_9, dynamicProps?.verification_depth, dynamicProps?.verification_depth_unit, activeMGIProfile, headerData.waterDepth, activeSpec, selectedComp.depth, selectedComp.lowestElev]);

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
            const fmtAvg = parseFloat(avg.toFixed(2));
            const fmtMin = parseFloat(min.toFixed(2));
            const fmtMax = parseFloat(max.toFixed(2));
            const fmtLoss = loss !== null ? parseFloat(loss.toFixed(2)) : null;
            const fmtPctLoss = pctLoss !== null ? parseFloat(pctLoss.toFixed(2)) : null;
            if (parseFloat(dynamicProps?.avg_reading) !== fmtAvg) handleDynamicPropChange('avg_reading', fmtAvg);
            if (parseFloat(dynamicProps?.min_reading) !== fmtMin) handleDynamicPropChange('min_reading', fmtMin);
            if (parseFloat(dynamicProps?.max_reading) !== fmtMax) handleDynamicPropChange('max_reading', fmtMax);
            if (fmtLoss !== null && parseFloat(dynamicProps?.wall_thickness_loss) !== fmtLoss) handleDynamicPropChange('wall_thickness_loss', fmtLoss);
            if (fmtPctLoss !== null && parseFloat(dynamicProps?.['%_wall_thickness_loss']) !== fmtPctLoss) handleDynamicPropChange('%_wall_thickness_loss', fmtPctLoss);
        }
    }, [dynamicProps?.ut_3_o_clock, dynamicProps?.ut_6_o_clock, dynamicProps?.ut_9_o_clock, dynamicProps?.ut_12_o_clock, dynamicProps?.nominal_thickness, dynamicProps?.ut_readings_additional, activeSpec]);

    React.useEffect(() => {
        const specStr = String(activeSpec || '').toUpperCase();
        const specName = (allInspectionTypes?.find(t => t.code === activeSpec)?.name || '').toUpperCase();
        const keys = Object.keys(dynamicProps || {});
        const isMG = specStr.includes('MGROW') || specStr.includes('RMGI') || specStr.includes('MARINE GROWTH') || specName.includes('MARINE GROWTH') || keys.some(k => k.toLowerCase().includes('circumferential')) || keys.some(k => k.toLowerCase().replace(/[\s_]/g, '') === 'effectivethickness');
        if (!isMG) return;
        const getVal = (baseName: string) => {
            if (!dynamicProps) return 0;
            const target = baseName.toLowerCase().replace(/[\s_]/g, '');
            const matchingKeys = Object.keys(dynamicProps).filter(k => k.toLowerCase().replace(/[\s_]/g, '') === target);
            if (matchingKeys.length === 0) return 0;
            const preferredKey = matchingKeys.find(k => k !== baseName) || matchingKeys[0];
            return parseFloat(dynamicProps[preferredKey]) || 0;
        };
        const c1 = getVal('circumferential_measurement_5m_above');
        const c2 = getVal('circumferential_measurement_0m');
        const c3 = getVal('circumferential_measurement_5m_below');
        const nominalDia = getVal('nominal_diameter');
        const avgC = (c1 + c2 + c3) / 3;
        const etValue = avgC > 0 ? ((avgC / 3.142) - nominalDia) / 2 : 0;
        const roundedET = parseFloat(etValue.toFixed(2));
        const etKey = Object.keys(dynamicProps || {}).find(k => k.toLowerCase().replace(/[\s_]/g, '') === 'effectivethickness') || 'effective_thickness';
        const currentETVal = parseFloat(dynamicProps?.[etKey]);
        if (handleDynamicPropChange && (isNaN(currentETVal) || Math.abs(currentETVal - roundedET) > 0.01)) {
            handleDynamicPropChange(etKey, roundedET);
        }
    }, [dynamicProps, activeSpec, allInspectionTypes]);

    React.useEffect(() => {
        if (!isEditing && selectedComp && handleDynamicPropChange && Array.isArray(activeFormProps)) {
            const hasNominalDiameter = activeFormProps.some((p: any) => String(p.name || p.label || '').toLowerCase().replace(/[\s_]+/g, '').includes('nominaldiameter'));
            const hasNominalThickness = activeFormProps.some((p: any) => {
                const nameStr = String(p.name || p.label || '').toLowerCase().replace(/[\s_]+/g, '');
                return nameStr.includes('nominalwallthickness') || nameStr.includes('nominalthickness');
            });
            if (hasNominalDiameter && (dynamicProps?.nominal_diameter === undefined || dynamicProps?.nominal_diameter === null || dynamicProps?.nominal_diameter === "")) {
                const compDia = selectedComp?.nominal_diameter || selectedComp?.raw?.nominal_diameter || selectedComp?.diameter || selectedComp?.raw?.diameter;
                if (compDia !== undefined && compDia !== null && compDia !== "" && compDia !== "-") handleDynamicPropChange('nominal_diameter', compDia);
            }
            if (hasNominalThickness) {
                const compThk = selectedComp?.nominal_thickness || selectedComp?.nominal_wall_thickness || selectedComp?.raw?.nominal_thickness || selectedComp?.raw?.nominal_wall_thickness || selectedComp?.wall_thickness || selectedComp?.raw?.wall_thickness || selectedComp?.thickness;
                if (compThk !== undefined && compThk !== null && compThk !== "" && compThk !== "-") {
                    if (dynamicProps?.nominal_thickness === undefined || dynamicProps?.nominal_thickness === null || dynamicProps?.nominal_thickness === "") handleDynamicPropChange('nominal_thickness', compThk);
                    if (dynamicProps?.nominal_wall_thickness === undefined || dynamicProps?.nominal_wall_thickness === null || dynamicProps?.nominal_wall_thickness === "") handleDynamicPropChange('nominal_wall_thickness', compThk);
                }
            }
        }
    }, [selectedComp, activeSpec, activeFormProps, isEditing]);

    React.useEffect(() => {
        if (!isEditing && activeSpec?.toUpperCase() === 'RSEAB' && handleDynamicPropChange) {
            const currentDepth = dynamicProps?.verification_depth;
            const targetDepth = (selectedComp.lowestElev && selectedComp.lowestElev !== '-') ? selectedComp.lowestElev : ((selectedComp.endElev && selectedComp.endElev !== '-') ? selectedComp.endElev : (selectedComp.depth ? selectedComp.depth.replace(/[^\d.-]/g, '') : null));
            if ((currentDepth === undefined || currentDepth === null || currentDepth === "" || currentDepth === 0 || currentDepth === "0") && targetDepth) handleDynamicPropChange('verification_depth', targetDepth);
        }
    }, [activeSpec, selectedComp, isEditing, dynamicProps]);

    React.useEffect(() => {
        if (!isEditing && handleDynamicPropChange) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const formattedDate = `${yyyy}-${mm}-${dd}`;
            const formattedTime = today.toTimeString().split(' ')[0];
            
            if (!dynamicProps?.inspection_date) {
                handleDynamicPropChange('inspection_date', formattedDate);
            }
            if (!dynamicProps?.inspection_time) {
                handleDynamicPropChange('inspection_time', formattedTime);
            }
            if ((dynamicProps?.tape_count_no === undefined || dynamicProps?.tape_count_no === '') && tapeId) {
                handleDynamicPropChange('tape_count_no', formatTime(vidTimer));
            }
        }
    }, [isEditing, activeSpec, selectedComp, tapeId]);

    return (
        <Card className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-[5%] bg-white dark:bg-slate-950 z-10 border-none rounded-none shadow-none text-slate-800 dark:text-slate-200">
            <div className="px-3 py-1.5 bg-blue-600 dark:bg-blue-700 text-white flex justify-between items-center shrink-0 shadow-sm border-b border-blue-700 dark:border-blue-800">
                <span className="font-black tracking-tight text-xs flex items-center gap-1.5 overflow-hidden">
                    <FileText className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                    <span className="text-blue-50 opacity-90 font-bold truncate">{selectedComp.name}</span>
                    {onChangeComponentClick && (
                        <button onClick={onChangeComponentClick} className="px-1.5 py-0.5 text-[8px] uppercase tracking-tighter font-bold bg-white/20 hover:bg-white/30 rounded transition-colors text-white border border-white/5 whitespace-nowrap">Change</button>
                    )}
                    <span className="text-blue-100/40 shrink-0">/</span>
                    <span className="truncate max-w-[150px] opacity-90">{(() => {
                        const specObj = allInspectionTypes.find(t => (t.code || '').trim() === (activeSpec || '').trim()) || allInspectionTypes.find(t => (t.name || '').trim() === (activeSpec || '').trim());
                        return specObj ? specObj.name : activeSpec;
                    })()}</span>
                    {onChangeTaskClick && (
                        <button onClick={onChangeTaskClick} className="px-1.5 py-0.5 text-[8px] uppercase tracking-tighter font-bold bg-white/20 hover:bg-white/30 rounded transition-colors text-white border border-white/5 whitespace-nowrap">Change</button>
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
                            <button onClick={onPrintReport} className="p-1 hover:bg-white/10 bg-black/10 rounded transition text-blue-100 hover:text-white" title="Print Report"><Printer className="w-3.5 h-3.5" /></button>
                        )}
                        {isEditing && onDeleteRecord && (
                            <button onClick={onDeleteRecord} className="p-1 hover:bg-red-500/20 bg-black/10 rounded transition text-red-200 hover:text-red-100" title="Delete Record"><Trash2 className="w-3.5 h-3.5" /></button>
                        )}
                        <button onClick={() => setCompSpecDialogOpen(true)} className="p-1 hover:bg-white/10 bg-black/10 rounded transition text-blue-100 hover:text-white" title="Component Specifications"><Info className="w-3.5 h-3.5" /></button>
                        <button onClick={() => resetForm()} className="p-1 hover:bg-white/10 bg-black/10 rounded transition text-blue-100 hover:text-white" title="Cancel/Close"><X className="w-3.5 h-3.5" /></button>
                    </div>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-2">
                    <div className="space-y-2">
                        <AnimatePresence mode="wait">
                            <motion.div key={activeSpec} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.2 }} className="p-1.5 border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/30 rounded-lg space-y-1.5">
                                <div className="border-b border-slate-200 dark:border-slate-800 pb-1.5 space-y-1">
                                    <div className="text-[9px] font-black uppercase text-slate-800 dark:text-slate-400 tracking-widest opacity-70">Inspection Metadata & Coordinates</div>
                                    <div className="flex flex-wrap gap-x-2 gap-y-1.5 items-end">
                                        <div className="space-y-0.5 flex-grow min-w-[120px] max-w-[180px]">
                                            <label className="text-[8px] font-black text-slate-800 dark:text-slate-400 uppercase flex items-center gap-1"><MapPinIcon className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" /> Verification Depth / Elevation</label>
                                            <div className="flex items-center gap-1">
                                                <Input type="text" value={dynamicProps?.verification_depth || (selectedComp.lowestElev && selectedComp.lowestElev !== '-' ? selectedComp.lowestElev : (selectedComp.endElev && selectedComp.endElev !== '-' ? selectedComp.endElev : (selectedComp.depth ? selectedComp.depth.replace(/[^\d.-]/g, '') : '')))} onChange={(e) => handleDynamicPropChange?.('verification_depth', e.target.value)} placeholder="Enter depth" className="h-8 text-[11px] font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 flex-1 dark:text-slate-200" />
                                                <select className="h-8 px-1 text-[10px] font-bold border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-[45px]" value={dynamicProps?.verification_depth_unit || 'm'} onChange={(e) => handleDynamicPropChange?.('verification_depth_unit', e.target.value)}>
                                                    <option value="mm">mm</option><option value="cm">cm</option><option value="m">m</option><option value="ft">ft</option><option value="in">in</option>
                                                </select>
                                            </div>
                                        </div>
                                        {(selectedComp.startElev !== '-' || selectedComp.endElev !== '-') && (
                                            <div className="space-y-0.5 flex-grow min-w-[80px] max-w-[120px]">
                                                <label className="text-[8px] font-black text-slate-800 dark:text-slate-400 uppercase">Range</label>
                                                <div className="h-8 px-1.5 flex items-center text-[10px] font-bold bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 rounded-md text-slate-500 dark:text-slate-400 truncate">{selectedComp.startElev}→{selectedComp.endElev}</div>
                                            </div>
                                        )}
                                        <div className="space-y-0.5 flex-grow min-w-[100px] max-w-[130px]">
                                            <span className="text-[8px] font-black text-slate-800 dark:text-slate-400 uppercase">Insp. Date</span>
                                            {renderInspectionField({ name: 'inspection_date', label: 'Date', type: 'date' }, 'primary')}
                                        </div>
                                        <div className="space-y-0.5 flex-grow min-w-[80px] max-w-[110px]">
                                            <span className="text-[8px] font-black text-slate-800 dark:text-slate-400 uppercase">Insp. Time</span>
                                            {renderInspectionField({ name: 'inspection_time', label: 'Time', type: 'text' }, 'primary')}
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
                                            {renderInspectionField({ name: 'tape_count_no', label: `Live: ${formatTime(vidTimer)}`, type: 'text' }, 'primary')}
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
                                                        layoutType="rectangular" legCount={headerData?.structureName?.includes('8') ? 8 : 4} gridDistances={grid} distanceOffset={offset} highlightQid={qid}
                                                        debrisItems={dynamicProps?.x && dynamicProps?.y ? [{ id: 'current', x: parseFloat(dynamicProps.x), y: parseFloat(dynamicProps.y), label: '1', isMetallic: dynamicProps?.debris_material?.toLowerCase().includes('metal') || false }] : []}
                                                        manualEntry={{ leg: dynamicProps?.reference_leg || dynamicProps?.associated_leg || dynamicProps?.leg, distance: dynamicProps?.distance_from_leg ? parseFloat(dynamicProps.distance_from_leg) : undefined, face: dynamicProps?.face || dynamicProps?.orientation }}
                                                        registeredQids={[qid]}
                                                        onDebrisMove={(id, x, y, geometry) => {
                                                            if (handleDynamicPropChange) {
                                                                const distMatch = qid.match(/-(\d+)M$/i);
                                                                const faceMatch = qid.match(/\(([^)]+)\)/);
                                                                const targetDist = distMatch ? parseInt(distMatch[1]) : null;
                                                                const targetFace = faceMatch ? faceMatch[1] : null;
                                                                const currentFace = `${geometry.startLeg}-${geometry.endLeg}`;
                                                                const currentInterval = geometry.nearestDistance;
                                                                if (targetDist !== null && currentInterval !== targetDist) {
                                                                    if (window.confirm(`You are flagging in the ${currentInterval}m range, but this task is for ${targetDist}m. Change current task?`)) onChangeTaskClick?.();
                                                                    return;
                                                                }
                                                                if (targetFace && currentFace !== targetFace) {
                                                                    if (window.confirm(`You are flagging on ${currentFace} face, but this task is for ${targetFace}. Change current task?`)) onChangeTaskClick?.();
                                                                    return;
                                                                }
                                                                handleDynamicPropChange('x', x.toFixed(2));
                                                                handleDynamicPropChange('y', y.toFixed(2));
                                                                handleDynamicPropChange('distance_from_leg', geometry.distance.toFixed(1));
                                                                if (geometry.nearestLeg) handleDynamicPropChange('nearest_leg', geometry.nearestLeg);
                                                                if (geometry.distToNearestLeg !== undefined) handleDynamicPropChange('dist_to_nearest_leg', geometry.distToNearestLeg.toFixed(1));
                                                                if (geometry.face) handleDynamicPropChange('face', geometry.face);
                                                            }
                                                        }}
                                                        onAddDebris={(x, y, geometry) => {
                                                            if (handleDynamicPropChange) {
                                                                const distMatch = qid.match(/-(\d+)M$/i);
                                                                const faceMatch = qid.match(/\(([^)]+)\)/);
                                                                const targetDist = distMatch ? parseInt(distMatch[1]) : null;
                                                                const targetFace = faceMatch ? faceMatch[1] : null;
                                                                const currentFace = `${geometry.startLeg}-${geometry.endLeg}`;
                                                                const currentInterval = geometry.nearestDistance;
                                                                if (targetDist !== null && currentInterval !== targetDist) {
                                                                    if (window.confirm(`You are flagging in the ${currentInterval}m range, but this task is for ${targetDist}m. Change current task?`)) onChangeTaskClick?.();
                                                                    return;
                                                                }
                                                                if (targetFace && currentFace !== targetFace) {
                                                                    if (window.confirm(`You are flagging on ${currentFace} face, but this task is for ${targetFace}. Change current task?`)) onChangeTaskClick?.();
                                                                    return;
                                                                }
                                                                handleDynamicPropChange('x', x.toFixed(2));
                                                                handleDynamicPropChange('y', y.toFixed(2));
                                                                handleDynamicPropChange('distance_from_leg', geometry.distance.toFixed(1));
                                                                if (geometry.nearestLeg) handleDynamicPropChange('nearest_leg', geometry.nearestLeg);
                                                                if (geometry.distToNearestLeg !== undefined) handleDynamicPropChange('dist_to_nearest_leg', geometry.distToNearestLeg.toFixed(1));
                                                                if (geometry.face) handleDynamicPropChange('face', geometry.face);
                                                            }
                                                            toast.info(`Point added at ${geometry.distance.toFixed(1)}m on ${geometry.face} face`);
                                                        }}
                                                    />
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {(() => {
                                    if (!fieldGroups) return null;
                                    const { mgi: mgiFields, ut: utFields, rest: otherFields } = fieldGroups;
                                    const hardFields = mgiFields.filter((p: any) => p && p.groupRow === 'hard');
                                    const softFields = mgiFields.filter((p: any) => p && p.groupRow === 'soft');
                                    const profileField = mgiFields.find((p: any) => p && p.type === 'mgi_profile_display');
                                    const resolveApplicableMax = () => {
                                        const vDepthRaw = dynamicProps?.verification_depth || (selectedComp.lowestElev && selectedComp.lowestElev !== '-' ? selectedComp.lowestElev : selectedComp.depth) || '0';
                                        const vDepthUnit = dynamicProps?.verification_depth_unit || 'm';
                                        const waterDepth = Math.abs(headerData.waterDepth || 0);
                                        return getInterpolatedThreshold(vDepthRaw, vDepthUnit, waterDepth, activeMGIProfile?.thresholds);
                                    };

                                    return (
                                        <>
                                            {mgiFields.length > 0 && (
                                                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="col-span-2 border border-teal-200/50 dark:border-teal-800/60 bg-teal-50/20 dark:bg-teal-900/10 rounded-lg p-1.5 space-y-1.5 shadow-sm mb-3">
                                                    <div className="flex items-center justify-between border-b border-teal-200 dark:border-teal-800 pb-1.5">
                                                         <div className="flex items-center gap-2">
                                                              <div className="w-6 h-6 bg-teal-600 rounded-lg flex items-center justify-center"><svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>
                                                              <div className="flex flex-col">
                                                                 <span className="text-[11px] font-black text-teal-800 dark:text-teal-400 uppercase tracking-widest leading-none">MGI Thickness</span>
                                                                 <span className="text-[8px] font-black text-slate-800 dark:text-slate-200 uppercase mt-0.5">Ref: {(() => {
                                                                     const wDepth = Math.abs(headerData.waterDepth || 0);
                                                                     if (wDepth > 0) return `${wDepth}m`;
                                                                     if ((selectedComp.raw?.type || String(selectedComp.name || '')).toUpperCase().includes('LEG')) {
                                                                         const lElev = Math.abs(parseFloat(String(selectedComp.lowestElev || '0').replace(/[^\d.-]/g, '')));
                                                                         return lElev > 0 ? `${lElev}m (Leg)` : "0m";
                                                                     }
                                                                     return "0m";
                                                                 })()}</span>
                                                              </div>
                                                         </div>
                                                         {activeMGIProfile && (
                                                             <div className="flex flex-col items-end"><span className="text-[10px] font-black text-teal-600 dark:text-teal-400 bg-teal-100/50 dark:bg-teal-900/30 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">MAX: {resolveApplicableMax()?.toFixed(1) ?? '—'}mm</span></div>
                                                         )}
                                                    </div>
                                                    {profileField && !activeMGIProfile && (
                                                        <div className="flex items-center gap-2 p-2.5 bg-amber-50/50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/40 rounded-lg">
                                                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                                            <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300">No active MGI Profile found. Configure one in Settings → MGI Profiler.</span>
                                                        </div>
                                                    )}
                                                    <div className="grid grid-cols-[70px_1fr_1fr_1fr_1fr] gap-1.5 items-end">
                                                        <div></div>{['12 o\'clk', '3 o\'clk', '6 o\'clk', '9 o\'clk'].map(pos => (<div key={pos} className="text-center"><span className="text-[8px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">{pos}</span></div>))}
                                                    </div>
                                                    {hardFields.length > 0 && (
                                                        <div className="grid grid-cols-[70px_1fr_1fr_1fr_1fr] gap-1.5 items-center">
                                                            <span className="text-[9px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-wider bg-rose-50/50 dark:bg-rose-900/30 border border-rose-200/50 dark:border-rose-800/40 rounded-md px-1.5 py-1 text-center">Hard</span>
                                                            {hardFields.map((p: any) => (<div key={p.name}>{renderInspectionField(p, 'primary')}</div>))}
                                                        </div>
                                                    )}
                                                    {softFields.length > 0 && (
                                                        <div className="grid grid-cols-[80px_1fr_1fr_1fr_1fr] gap-2 items-center">
                                                            <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider bg-emerald-50/50 dark:bg-emerald-900/30 border border-emerald-200/50 dark:border-emerald-800/40 rounded-md px-2 py-1.5 text-center">Soft</span>
                                                            {softFields.map((p: any) => (<div key={p.name}>{renderInspectionField(p, 'primary')}</div>))}
                                                        </div>
                                                    )}
                                                    <div className="text-right"><span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 italic">All values in mm</span></div>
                                                </motion.div>
                                            )}

                                            {utFields.length > 0 && (
                                                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="col-span-2 border border-blue-200/50 dark:border-blue-800/60 bg-blue-50/20 dark:bg-blue-900/10 rounded-lg p-1.5 space-y-1.5 shadow-sm mb-3">
                                                    <div className="flex items-center gap-2 border-b border-blue-200 dark:border-blue-800 pb-1">
                                                         <div className="w-6 h-6 bg-blue-600 dark:bg-blue-700 rounded-lg flex items-center justify-center"><Search className="w-3.5 h-3.5 text-white" /></div>
                                                         <span className="text-[10px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest leading-none">UT Thickness Readings</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {utFields.filter((f: any) => f.name !== 'nominal_thickness').map((p: any) => (
                                                            <div key={p.name} className="space-y-0.5 flex-grow min-w-[100px] max-w-[150px]">
                                                                <label className="text-[9px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-center block w-full">{p.label || p.name}</label>
                                                                {renderInspectionField(p, 'primary')}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {utFields.find((f: any) => f.name === 'nominal_thickness') && (
                                                        <div className="pt-1.5 border-t border-blue-100/50 dark:border-blue-900/30">
                                                            <div className="space-y-0.5">
                                                                <label className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">Nominal Thickness</label>
                                                                {renderInspectionField(utFields.find((f: any) => f.name === 'nominal_thickness'), 'primary')}
                                                            </div>
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )}

                                            {(() => {
                                                const type = activeSpec?.toUpperCase();
                                                if (type === 'MGROW') {
                                                    const circ = otherFields.filter((f: any) => ['circumferential_measurement_5m_above', 'circumferential_measurement_0m', 'circumferential_measurement_5m_below'].includes(f.name));
                                                    const bools = otherFields.filter((f: any) => f.type === 'boolean');
                                                    const rest = otherFields.filter((f: any) => !circ.includes(f) && !bools.includes(f));
                                                    return (
                                                        <div className="space-y-4">
                                                            {circ.length > 0 && (
                                                                <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-lg p-1.5 space-y-1 shadow-sm">
                                                                    <label className="text-[10px] font-black uppercase tracking-widest block border-b border-slate-100 dark:border-slate-800 pb-1">Circumference</label>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {['circumferential_measurement_5m_above', 'circumferential_measurement_0m', 'circumferential_measurement_5m_below'].map(n => {
                                                                            const p = circ.find((f: any) => f.name === n);
                                                                            if (!p) return null;
                                                                            const label = n.includes('above') ? '-5m' : n.includes('below') ? '+5m' : '0m';
                                                                            return (<div key={n} className="space-y-1 flex-grow min-w-[80px] max-w-[120px]"><label className="text-[9px] font-bold uppercase block text-center">{label}</label>{renderInspectionField({...p, label}, 'primary')}</div>);
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-3 gap-y-2">
                                                                {rest.map((p: any) => (<div key={p.name} className={`space-y-0.5 flex-grow ${p.type === 'repeater' || p.type === 'textarea' ? 'col-span-full' : 'col-span-2'}`}><label className="text-[9px] font-black uppercase truncate block">{p.label || p.name}</label>{renderInspectionField(p, 'primary')}</div>))}
                                                            </div>
                                                            {bools.length > 0 && (
                                                                <div className="grid grid-cols-3 gap-3">{bools.map((p: any) => (<div key={p.name} className="space-y-1.5"><label className="text-[10px] font-black uppercase mb-1 block">{p.label || p.name}</label>{renderInspectionField(p, 'primary')}</div>))}</div>
                                                            )}
                                                        </div>
                                                    );
                                                } else if (type === 'RSEAB') {
                                                    const { location: loc, itemDetails: det, grid: grd, rest: rst } = fieldGroups;
                                                    return (
                                                        <div className="space-y-4">
                                                            {loc.length > 0 && (
                                                                <div className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl p-2.5 space-y-2 shadow-sm">
                                                                    <label className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest block border-b border-slate-100 dark:border-slate-800 pb-1.5">Location</label>
                                                                    <div className="grid grid-cols-2 gap-3">{loc.map((p: any) => (<div key={p.name} className="space-y-1"><label className="text-[10px] font-black uppercase block">{p.label || p.name}</label>{renderInspectionField(p, 'primary')}</div>))}</div>
                                                                </div>
                                                            )}
                                                            {det.length > 0 && (
                                                                <div className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl p-2.5 space-y-2 shadow-sm">
                                                                    <label className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block border-b border-slate-100 dark:border-slate-800 pb-1.5">Item Details</label>
                                                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                                                                        {det.map((p: any) => {
                                                                            const hasMat = det.some((f: any) => f.name === 'material');
                                                                            const hasIntensity = det.some((f: any) => f.name === 'seepage_intensity');
                                                                            const hasCrater = det.some((f: any) => ['crater_diameter', 'crater_depth'].includes(f.name));
                                                                            const hasDebrisDims = det.some((f: any) => f.name.startsWith('size_'));
                                                                            
                                                                            let span = 'space-y-1';
                                                                            if (p.name === 'category') span = (hasMat || hasIntensity || hasCrater || hasDebrisDims) ? 'col-span-full md:col-span-1' : 'col-span-full border-b border-slate-50 dark:border-slate-800 pb-2 mb-1';
                                                                            else if (p.name === 'material') span = 'col-span-full md:col-span-2 lg:col-span-4';
                                                                            else if (p.name === 'seepage_intensity') span = 'col-span-1 md:col-span-2 lg:col-span-2';
                                                                            else if (['crater_diameter', 'crater_depth'].includes(p.name)) span = 'col-span-1 md:col-span-2 lg:col-span-2';
                                                                            else if (p.name.startsWith('size_')) span = 'col-span-1';
                                                                            else if (p.name === 'debris_desc') span = 'col-span-full';
                                                                            
                                                                            return (<div key={p.name} className={span}><label className="text-[10px] font-black uppercase block">{p.label || p.name}</label>{renderInspectionField(p, 'primary')}</div>);
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {grd.length > 0 && (
                                                                <div className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl p-2.5 space-y-2 shadow-sm">
                                                                    <label className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block border-b border-slate-100 dark:border-slate-800 pb-1.5">Grid & Offset</label>
                                                                    <div className="grid grid-cols-4 gap-3">{grd.map((p: any) => (<div key={p.name} className="space-y-1"><label className="text-[10px] font-black uppercase block">{p.label || p.name}</label>{renderInspectionField(p, 'primary')}</div>))}</div>
                                                                </div>
                                                            )}
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-2">{rst.map((p: any) => (<div key={p.name} className="space-y-1"><label className="text-[10px] font-black uppercase block">{p.label || p.name}</label>{renderInspectionField(p, 'primary')}</div>))}</div>
                                                        </div>
                                                    );
                                                } else if (type === 'MPINS' || type === 'DMPI' || type === 'RMPI') {
                                                    const validFields = otherFields.filter((f: any) => f && f.name);
                                                    
                                                    // Helper to find and render a specific field, hiding its default label to save space
                                                    const renderCell = (name: string, label?: string) => {
                                                        const p = validFields.find((f: any) => f.name === name);
                                                        if (!p) return null;
                                                        return (
                                                            <div className="w-full min-w-0">
                                                                {label && <label className="text-[9px] font-black uppercase text-slate-500 mb-0.5 block truncate" title={label}>{label}</label>}
                                                                {renderInspectionField({ ...p, label: p.label }, 'primary')}
                                                            </div>
                                                        );
                                                    };

                                                    return (
                                                        <div className="space-y-4">
                                                            {/* Group 1: General Meta Params */}
                                                            <div className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl p-2.5 shadow-sm">
                                                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                                                    {renderCell('magnetic_ink', 'Magnetic Ink')}
                                                                    {renderCell('surface_condition', 'Surface Cond.')}
                                                                    {renderCell('cleaning_method', 'Cleaning Mthd.')}
                                                                    {renderCell('background_condition', 'BackGrd. Cond.')}
                                                                    
                                                                    {renderCell('magnetic_method', 'Magn. Method')}
                                                                    {renderCell('lighting_method', 'Lighting Method')}
                                                                    {renderCell('calib_block', 'Calibration Blk.')}
                                                                    {renderCell('magnetic_lifting_power', 'Magn. Lifting Power (tonne)')}


                                                                    {renderCell('orientation', 'Orientation')}
                                                                    {renderCell('indication', 'Indication')}
                                                                    {renderCell('probe', 'Probe')}
                                                                    
                                                                    {renderCell('burmah_c_strip', 'Burmah C. Strip')}
                                                                </div>
                                                            </div>

                                                            {/* Group 2: Clock Readings */}
                                                            <div className="border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-2.5 shadow-sm space-y-1">
                                                                <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr] md:grid-cols-[80px_1fr_1fr_1fr_1fr_1fr] gap-2 items-end mb-1">
                                                                    <div></div>
                                                                    <div className="text-center"><span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">3 O'Clk</span></div>
                                                                    <div className="text-center"><span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">6 O'Clk</span></div>
                                                                    <div className="text-center"><span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">9 O'Clk</span></div>
                                                                    <div className="text-center"><span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">12 O'Clk</span></div>
                                                                    <div className="text-center"><span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">Nominal</span></div>
                                                                </div>
                                                                <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr] md:grid-cols-[80px_1fr_1fr_1fr_1fr_1fr] gap-2 items-center">
                                                                    <div className="text-right pr-2"><span className="text-[10px] font-black uppercase text-slate-500">Brace (mm)</span></div>
                                                                    {renderCell('brace_thick_3clk')}{renderCell('brace_thick_6clk')}{renderCell('brace_thick_9clk')}{renderCell('brace_thick_12clk')}{renderCell('brace_nominal_thickness')}
                                                                </div>
                                                                <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr] md:grid-cols-[80px_1fr_1fr_1fr_1fr_1fr] gap-2 items-center mt-1">
                                                                    <div className="text-right pr-2"><span className="text-[10px] font-black uppercase text-slate-500">Chord (mm)</span></div>
                                                                    {renderCell('chord_thick_3clk')}{renderCell('chord_thick_6clk')}{renderCell('chord_thick_9clk')}{renderCell('chord_thick_12clk')}{renderCell('chord_nominal_thickness')}
                                                                </div>
                                                                <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr] md:grid-cols-[80px_1fr_1fr_1fr_1fr_1fr] gap-2 items-center mt-1">
                                                                    <div className="text-right pr-2"><span className="text-[10px] font-black uppercase text-slate-500">CP (mV)</span></div>
                                                                    {renderCell('cp_at_3clk')}{renderCell('cp_at_6clk')}{renderCell('cp_at_9clk')}{renderCell('cp_at_12clk')}<div></div>
                                                                </div>
                                                            </div>

                                                            {/* Group 3: Parameters */}
                                                            <div className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl p-2.5 shadow-sm">
                                                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                                                                    {renderCell('current_in_coil_magnet', 'Curr. in Coil/Magr (Amps)')}
                                                                    {renderCell('voltage_in_coil_magnet', 'Volt. in Coil/Magr (Volts)')}
                                                                    {renderCell('current_pole_spacing', 'Curr. Pole Spacing (mm)')}
                                                                    {renderCell('dist_from_datum', 'Dist. from Datum (m)')}
                                                                    {renderCell('probe_size', 'Size')}
                                                                </div>
                                                            </div>

                                                            {/* Group 4: Segment Readings */}
                                                            <div className="border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-2.5 shadow-sm space-y-1">
                                                                <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr] md:grid-cols-[80px_1fr_1fr_1fr_1fr] gap-2 items-end mb-1">
                                                                    <div></div>
                                                                    <div className="text-center"><span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">6 - 9</span></div>
                                                                    <div className="text-center"><span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">9 - 12</span></div>
                                                                    <div className="text-center"><span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">12 - 3</span></div>
                                                                    <div className="text-center"><span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">3 - 6</span></div>
                                                                </div>
                                                                <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr] md:grid-cols-[80px_1fr_1fr_1fr_1fr] gap-2 items-center">
                                                                    <div className="text-right pr-2"><span className="text-[9px] font-black uppercase text-slate-500 leading-tight block">Toe<br/>Chord</span></div>
                                                                    {renderCell('toe_chord_6_9')}{renderCell('toe_chord_9_12')}{renderCell('toe_chord_12_3')}{renderCell('toe_chord_3_6')}
                                                                </div>
                                                                <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr] md:grid-cols-[80px_1fr_1fr_1fr_1fr] gap-2 items-center mt-1">
                                                                    <div className="text-right pr-2"><span className="text-[9px] font-black uppercase text-slate-500 leading-tight block">Weld</span></div>
                                                                    {renderCell('weld_6_9')}{renderCell('weld_9_12')}{renderCell('weld_12_3')}{renderCell('weld_3_6')}
                                                                </div>
                                                                <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr] md:grid-cols-[80px_1fr_1fr_1fr_1fr] gap-2 items-center mt-1">
                                                                    <div className="text-right pr-2"><span className="text-[9px] font-black uppercase text-slate-500 leading-tight block">Toe<br/>Brace</span></div>
                                                                    {renderCell('toe_brace_6_9')}{renderCell('toe_brace_9_12')}{renderCell('toe_brace_12_3')}{renderCell('toe_brace_3_6')}
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Catch-all for Demagnetised or Any other fields not explicitly placed */}
                                                            {(() => {
                                                                const processedFields = [
                                                                    'magnetic_ink', 'surface_condition', 'cleaning_method', 'background_condition', 'magnetic_method', 'lighting_method', 'calib_block', 'magnetic_lifting_power', 'orientation', 'indication', 'probe', 'burmah_c_strip',
                                                                    'brace_thick_3clk', 'brace_thick_6clk', 'brace_thick_9clk', 'brace_thick_12clk', 'brace_nominal_thickness',
                                                                    'chord_thick_3clk', 'chord_thick_6clk', 'chord_thick_9clk', 'chord_thick_12clk', 'chord_nominal_thickness',
                                                                    'cp_at_3clk', 'cp_at_6clk', 'cp_at_9clk', 'cp_at_12clk',
                                                                    'current_in_coil_magnet', 'voltage_in_coil_magnet', 'current_pole_spacing', 'dist_from_datum', 'probe_size',
                                                                    'toe_chord_6_9', 'toe_chord_9_12', 'toe_chord_12_3', 'toe_chord_3_6',
                                                                    'weld_6_9', 'weld_9_12', 'weld_12_3', 'weld_3_6',
                                                                    'toe_brace_6_9', 'toe_brace_9_12', 'toe_brace_12_3', 'toe_brace_3_6'
                                                                ];
                                                                const remainingFields = validFields.filter((f: any) => !processedFields.includes(f.name));
                                                                
                                                                if (remainingFields.length > 0) {
                                                                    return (
                                                                        <div className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl p-2.5 shadow-sm">
                                                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                                                                {remainingFields.map((p: any) => (<div key={p.name} className="space-y-1"><label className="text-[10px] font-black uppercase block">{p.label || p.name}</label>{renderInspectionField(p, 'primary')}</div>))}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}
                                                        </div>
                                                    );
                                                } else {
                                                    const validOtherFields = otherFields.filter((f: any) => f && f.name);
                                                    const groupedRest = validOtherFields.reduce((acc: any, p: any) => {
                                                        const g = p.group || 'ungrouped';
                                                        if (!acc[g]) acc[g] = [];
                                                        acc[g].push(p);
                                                        return acc;
                                                    }, {});

                                                    return (
                                                        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
                                                            {Object.keys(groupedRest).map(groupName => {
                                                                const isUngrouped = groupName === 'ungrouped';
                                                                const fields = groupedRest[groupName];
                                                                
                                                                return (
                                                                    <div key={groupName} className={!isUngrouped ? "border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl p-2.5 space-y-2 shadow-sm" : "col-span-full"}>
                                                                        {!isUngrouped && (
                                                                            <label className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block border-b border-slate-100 dark:border-slate-800 pb-1.5">{groupName}</label>
                                                                        )}
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-2 gap-x-3 gap-y-2">
                                                                            {fields.map((p: any) => {
                                                                                if (isAnomaly && (p.name === 'has_anomaly' || p.name === 'anomalydata')) return null;
                                                                                if (!shouldShowField(p)) return null;
                                                                                return (
                                                                                    <motion.div layout key={p.name} className={`flex-grow ${p.type === 'repeater' || p.type === 'textarea' ? 'col-span-full' : 'col-span-1'} space-y-0.5`}>
                                                                                        <label className="text-[9px] font-black uppercase truncate block" title={p.label || p.name}>{p.label || p.name}</label>
                                                                                        {renderInspectionField(p, 'primary')}
                                                                                    </motion.div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                }
                                            })()}
                                            {(!resolvedFields || resolvedFields.length === 0) && (<div className="py-6 text-center"><p className="text-xs text-slate-400 italic">No additional specialized fields for this type.</p></div>)}
                                        </>
                                    );
                                })()}
                            </motion.div>
                        </AnimatePresence>

                        <div className="space-y-1.5 p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 shadow-sm animate-in fade-in slide-in-from-top-1">
                            <label className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest block border-b border-slate-100 dark:border-slate-800 pb-1">Inspection Result</label>
                            <div className="grid grid-cols-4 gap-1.5">
                                <Button variant={findingType === 'Complete' ? 'default' : 'outline'} onClick={() => { if (findingType === 'Anomaly' || findingType === 'Finding') { if (anomalyData.defectCode || anomalyData.description) { if (!confirm('Switching to Complete will clear the defect/finding details. Continue?')) return; } setAnomalyData({defectCode: '', priority: '', defectType: '', description: '', recommendedAction: '', rectify: false, rectifiedDate: '', rectifiedRemarks: '', severity: 'Minor', referenceNo: '' }); setLastAutoMatchedRuleId(null); setIsManualOverride(false); } setFindingType('Complete'); }} className={`h-8 text-[10px] font-bold transition-all ${findingType === 'Complete' ? 'bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-800 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-green-50 dark:hover:bg-green-900/20'}`}><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Complete</Button>
                                <Button variant={findingType === 'Finding' ? 'default' : 'outline'} onClick={() => { if (findingType !== 'Finding') setAnomalyData((prev: any) => ({ ...prev, referenceNo: '' })); setFindingType('Finding'); setIsManualOverride(true); }} className={`h-8 text-[10px] font-bold transition-all ${findingType === 'Finding' ? 'bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}><FileText className="w-3.5 h-3.5 mr-1" /> Finding</Button>
                                <Button variant={findingType === 'Anomaly' ? 'default' : 'outline'} onClick={() => { if (findingType !== 'Anomaly') setAnomalyData((prev: any) => ({ ...prev, referenceNo: '' })); setFindingType('Anomaly'); setIsManualOverride(true); }} className={`h-8 text-[10px] font-bold transition-all ${findingType === 'Anomaly' ? 'bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-800 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-900/20'}`}><AlertCircle className="w-3.5 h-3.5 mr-1" /> Anomaly</Button>
                                <Button variant={findingType === 'Incomplete' ? 'default' : 'outline'} onClick={() => { if (findingType === 'Anomaly' || findingType === 'Finding') { if (anomalyData.defectCode || anomalyData.description) { if (!confirm('Switching to Incomplete will clear the defect/finding details. Continue?')) return; } setAnomalyData({defectCode: '', priority: '', defectType: '', description: '', recommendedAction: '', rectify: false, rectifiedDate: '', rectifiedRemarks: '', severity: 'Minor', referenceNo: '' }); } setFindingType('Incomplete'); setIsManualOverride(true); }} className={`h-8 text-[10px] font-bold transition-all ${findingType === 'Incomplete' ? 'bg-amber-500 dark:bg-amber-600 hover:bg-amber-600 dark:hover:bg-amber-700 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}><Clock className="w-3.5 h-3.5 mr-1" /> Incomplete</Button>
                            </div>
                        </div>

                        {(findingType === 'Anomaly' || findingType === 'Finding') && (
                            <div className={`mt-3 p-3 rounded-lg border-2 space-y-3 animate-in fade-in slide-in-from-top-2 ${isAnomaly ? 'border-red-200 dark:border-red-900/30 bg-red-50/30 dark:bg-red-900/10' : 'border-blue-200 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/10'}`}>
                                <div className={`text-[10px] font-black uppercase tracking-widest border-b pb-2 ${isAnomaly ? 'text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' : 'text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'}`}>{isAnomaly ? '⚠ Anomaly / Defect Details' : '📋 Finding Details'}</div>
                                <div className="flex flex-wrap gap-3">
                                    <div className="space-y-1.5 flex-grow min-w-[140px] max-w-[220px]">
                                        <label className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase">{isAnomaly ? 'Defect Code' : 'Finding Code'} *</label>
                                        <select value={anomalyData.defectCode} onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, defectCode: e.target.value }))} className={`flex h-9 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-semibold dark:text-slate-200 ${ringClass}`}><option value="">Select Code</option>{defectCodes.map(c => (<option key={c.lib_id} value={c.lib_desc}>{c.lib_desc}</option>))}</select>
                                    </div>
                                    <div className="space-y-1.5 flex-grow min-w-[140px] max-w-[220px]">
                                        <label className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase">{isAnomaly ? 'Defect Type' : 'Finding Type'}</label>
                                        <select value={anomalyData.defectType} onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, defectType: e.target.value }))} className={`flex h-9 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-semibold dark:text-slate-200 ${ringClass}`}><option value="">Select Type</option>{availableDefectTypes.map(t => (<option key={t.lib_id} value={t.lib_desc}>{t.lib_desc}</option>))}</select>
                                    </div>
                                    <div className="space-y-1.5 flex-grow min-w-[140px] max-w-[220px]">
                                        <label className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase">Priority *</label>
                                        <select value={anomalyData.priority} onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, priority: e.target.value }))} className={`flex h-9 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-semibold dark:text-slate-200 ${ringClass}`}><option value="">Select Priority</option>{priorities.map(p => (<option key={p.lib_id} value={p.lib_desc}>{p.lib_desc}</option>))}</select>
                                    </div>
                                    <div className="space-y-1.5 flex-grow min-w-[140px] max-w-[220px]">
                                        <label className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase">Reference No</label>
                                        <div className="relative"><input ref={refInputRef} type="text" value={anomalyData.referenceNo} onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, referenceNo: e.target.value }))} onFocus={() => setPrevRefNo(anomalyData.referenceNo)} onBlur={async (e) => { const isValid = await validateAnomalyRef(e.target.value); if (!isValid) setTimeout(() => refInputRef.current?.focus(), 10); }} placeholder="Enter reference no..." className={`flex h-9 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-mono font-bold dark:text-slate-200 focus:outline-none focus:ring-2 ${ringClass}`} /></div>
                                    </div>
                                    <div className="space-y-1.5 flex-grow min-w-full">
                                        <label className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase">Recommendation</label>
                                        <textarea value={anomalyData.recommendedAction} onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, recommendedAction: e.target.value }))} placeholder="Enter recommendation..." className={`w-full min-h-[60px] rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2 text-xs font-semibold dark:text-slate-200 focus:outline-none focus:ring-2 ${ringClass}`} />
                                    </div>
                                </div>
                                <div className="p-3 border border-green-100 dark:border-green-900/30 bg-green-50/80 dark:bg-green-900/10 rounded-lg space-y-3">
                                    <div className="flex items-center gap-2"><input type="checkbox" id="rectifyCheck" checked={anomalyData.rectify} onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, rectify: e.target.checked }))} className="w-4 h-4 rounded text-green-600 focus:ring-green-500 border-green-300 dark:border-green-800 cursor-pointer" /><label htmlFor="rectifyCheck" className="text-xs font-bold text-green-800 dark:text-green-400 cursor-pointer">Rectify {categoryLabel}</label></div>
                                    {anomalyData.rectify && (
                                        <div className="space-y-3 animate-in fade-in zoom-in-95">
                                            <div className="space-y-1"><label className="text-[9px] font-bold text-green-700 uppercase">Rectified Date</label><Input type="date" value={anomalyData.rectifiedDate} onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, rectifiedDate: e.target.value }))} className="h-8 text-xs bg-white dark:bg-slate-950 border-green-200 dark:border-green-900/30" /></div>
                                            <div className="space-y-1"><label className="text-[9px] font-bold text-green-700 uppercase">Rectification Remarks</label><textarea value={anomalyData.rectifiedRemarks} onChange={(e) => setAnomalyData((prev: any) => ({ ...prev, rectifiedRemarks: e.target.value }))} placeholder="How was it rectified?" className="w-full min-h-[50px] rounded border border-green-200 dark:border-green-900/30 p-2 text-xs bg-white dark:bg-slate-950 dark:text-slate-200 focus:ring-green-500"></textarea></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {findingType === 'Incomplete' && (
                            <div className="pt-3 animate-in fade-in slide-in-from-top-2">
                                <label className="text-[10px] font-bold text-amber-600 uppercase mb-1.5 block">Reason for Incomplete Task *</label>
                                <textarea value={incompleteReason} onChange={(e) => setIncompleteReason(e.target.value)} placeholder="e.g. Visibility issues..." className="w-full min-h-[80px] rounded border border-amber-200 dark:border-amber-900/30 p-2 text-xs bg-amber-50/30 dark:bg-amber-900/10 dark:text-slate-200 focus:ring-amber-500"></textarea>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase flex items-center gap-1"><FileText className="w-3 h-3" /> Findings</label>
                                <FindingsSuggestionEngine supabase={supabase} componentType={selectedComp?.raw?.type || ""} inspectionTypeCode={activeSpec || ""} onSelect={(val) => { if (recordNotes && recordNotes.trim()) setRecordNotes(`${recordNotes.trim()}\n${val}`); else setRecordNotes(val); }} currentFinding={recordNotes} />
                            </div>
                            <textarea value={recordNotes} onChange={(e) => setRecordNotes(e.target.value)} placeholder="Observation specifics..." className="w-full min-h-[80px] rounded-lg border border-slate-300 dark:border-slate-700 p-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none bg-slate-50/50 dark:bg-slate-950/50 dark:text-slate-200 shadow-inner"></textarea>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" /> Attachments ({pendingAttachments.length})</label>
                                <div className="flex gap-1.5">
                                    <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => { const snaps = recordedFiles.filter(f => f.type === 'photo'); if (snaps.length > 0) setIsAttachmentManagerOpen(true); else toast.info("No screen captures available."); }}><Camera className="w-3.5 h-3.5 mr-1 text-blue-500" /> From Grabs</Button>
                                    <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.onchange = (e) => { const files = (e.target as HTMLInputElement).files; if (files) { const newAtts = Array.from(files).map(f => { const isAnomaly = findingType === 'Anomaly'; const isFinding = findingType === 'Finding'; const prefix = isAnomaly ? 'Anomaly - ' : (isFinding ? 'Findings - ' : ''); const refNo = anomalyData.referenceNo || 'Pending'; return { id: Math.random().toString(36).substr(2, 9), file: f, name: f.name, type: f.type.startsWith('video') ? 'VIDEO' as const : (f.type.startsWith('image') ? 'PHOTO' as const : 'DOCUMENT' as const), title: prefix ? `${prefix}${refNo}` : f.name, description: '', source: 'UPLOAD', previewUrl: URL.createObjectURL(f) }; }); setPendingAttachments((prev: any[]) => [...prev, ...newAtts]); } }; input.click(); }}><CloudUpload className="w-3.5 h-3.5 mr-1 text-green-500" /> Upload</Button>
                                </div>
                            </div>
                            {pendingAttachments.length > 0 && (
                                <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto p-1 bg-slate-50/50 dark:bg-slate-950/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                    {pendingAttachments.map(att => (
                                        <div key={att.id} className="relative group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-1.5 flex gap-2 overflow-hidden shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition-all">
                                            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden flex-shrink-0 relative cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all" onClick={() => setEditingAttachment(att)}>{att.type === 'PHOTO' && att.previewUrl ? <img src={att.previewUrl} className="w-full h-full object-cover" /> : att.type === 'VIDEO' && att.previewUrl ? <div className="w-full h-full relative"><video src={att.previewUrl} className="w-full h-full object-cover" /><div className="absolute inset-0 flex items-center justify-center bg-black/20"><Video className="w-5 h-5 text-white opacity-80" /></div></div> : <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-slate-800">{att.type === 'VIDEO' ? <Video className="w-5 h-5 opacity-40" /> : <FileText className="w-5 h-5 opacity-40" />}</div>}</div>
                                            <div className="flex-1 min-w-0 pr-6 flex flex-col gap-0.5">
                                                <Input value={att.title} onChange={(e) => setPendingAttachments((prev: any[]) => prev.map(a => a.id === att.id ? { ...a, title: e.target.value } : a))} className="h-5 text-[10px] font-black border-none bg-slate-50/50 dark:bg-slate-950/50 rounded-sm px-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-slate-800 dark:text-slate-200" placeholder="Title..." />
                                                <Input value={att.description} onChange={(e) => setPendingAttachments((prev: any[]) => prev.map(a => a.id === att.id ? { ...a, description: e.target.value } : a))} className="h-4 text-[9px] font-medium italic border-none bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-slate-500" placeholder="Remark..." />
                                            </div>
                                            <button onClick={() => { if (att.isExisting) setDeletedAttachmentIds(prev => [...prev, att.id]); setPendingAttachments((prev: any[]) => prev.filter(a => a.id !== att.id)); }} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 rounded bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-500 hover:text-white transition-all shadow-sm"><X className="w-3 h-3" /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {pendingAttachments.length === 0 && (
                                <div className="py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950/50 opacity-60"><Paperclip className="w-6 h-6 text-slate-300 dark:text-slate-700 mb-1" /><span className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">No Attachments Picked</span></div>
                            )}
                        </div>
                    </div>
                </div>
            </ScrollArea>

            <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
                <div className="w-full">
                    {issues.length > 0 && !isEditing && (
                        <div className="mb-2 p-2 rounded-lg border border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-400 text-[10px] font-semibold flex items-start gap-2 shadow-sm">
                            <span className="text-amber-500 text-sm leading-none mt-0.5">⚠</span>
                            <div>
                                <span className="font-black uppercase text-[9px] tracking-wider block mb-0.5">Checklist incomplete</span>
                                {issues.map((issue, i) => (<span key={i} className="block text-amber-700 dark:text-amber-500">• {issue}</span>))}
                                <div className="mt-1 text-[9px] text-amber-500 italic">Enable Manual Entry mode in the header to bypass.</div>
                            </div>
                        </div>
                    )}
                    <Button disabled={isCommitting || !canCommit} onClick={handleCommitRecord} className={`w-full h-9 font-black shadow-lg text-white text-xs tracking-wide rounded-lg transition-all ${canCommit ? 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]' : 'bg-slate-300 cursor-not-allowed'}`}>
                        {isCommitting ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-2" />} 
                        {isCommitting ? "Committing..." : (isEditing ? "Update Record" : "Commit Record & Reset")}
                    </Button>
                </div>
            </div>
        </Card>
    );
};
