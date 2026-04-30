"use client";

import * as React from "react";
import { useState, useEffect, Suspense, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

import {
    Activity,
    ActivitySquare,
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    Box,
    Building2,
    Camera,
    Check,
    CheckCircle2,
    CheckSquare,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    ClipboardCheck,
    ClipboardList,
    Clock,
    CloudUpload,
    Database,
    Download,
    Edit,
    Edit2,
    ExternalLink,
    Eye,
    FileClock,
    FileSpreadsheet,
    FileText,
    FolderOpen,
    History,
    Info,
    Layers,
    Layout,
    LayoutDashboard,
    LineChart,
    List,
    ListTodo,
    Loader2,
    Lock,
    MapPin,
    Maximize2,
    Minimize2,
    Menu,
    MessageSquare,
    MoreVertical,
    Monitor,
    Package,
    Paperclip,
    Pause,
    Play,
    Plus,
    Power,
    Printer,
    RefreshCw,
    Save,
    Search,
    Settings,
    ShieldAlert,
    Square,
    Trash2,
    Video,
    VideoOff,
    Waves,
    Wifi,
    X,
    ArrowUpDown,
    Wrench
} from "lucide-react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { generateInspectionReport } from "@/utils/report-generators/inspection-report";
import { generateDefectAnomalyReport } from "@/utils/report-generators/defect-anomaly-report";
import { generateMultiInspectionReport } from "@/utils/report-generators/multi-inspection-report";
import { generateROVMGIReport } from "@/utils/report-generators/rov-mgi-report";
import { generateROVFMDReport } from "@/utils/report-generators/rov-fmd-report";
import { generateROVSZCIReport } from "@/utils/report-generators/rov-szci-report";
import { generateROVUTWTReport } from "@/utils/report-generators/rov-utwt-report";
import { generateROVRSCORReport } from "@/utils/report-generators/rov-rscor-report";
import { generateROVRRISIReport } from "@/utils/report-generators/rov-rrisi-report";
import { generateROVAnodeReport } from "@/utils/report-generators/rov-anode-report";
import { generateROVCPReport } from "@/utils/report-generators/rov-cp-report";
import { generateROVRGVIReport } from "@/utils/report-generators/rov-rgvi-report";
import { generateROVCasnReport } from "@/utils/report-generators/rov-rcasn-report";
import { generateROVCasnSketchReport } from "@/utils/report-generators/rov-rcasn-sketch-report";
import { generateROVCondReport } from "@/utils/report-generators/rov-rcond-report";
import { generateROVCondSketchReport } from "@/utils/report-generators/rov-rcond-sketch-report";
import { generateROVBoatlandingReport } from "@/utils/report-generators/rov-boatlanding-report";
import { generateROVPhotographyReport } from "@/utils/report-generators/rov-photography-report";
import { generateROVPhotographyLogReport } from "@/utils/report-generators/rov-photography-log-report";
import { generateSeabedSurveyReport } from "@/utils/report-generators/seabed-survey-report";

import { loadSettings, type WorkstationSettings } from '@/lib/video-recorder/settings-manager';
import { createMediaRecorder, startRecording, saveFile, generateFilename, getPhotoExtension, FORMAT_CONFIGS } from '@/lib/video-recorder/media-recorder';
import { CanvasOverlayManager, type DrawingTool } from '@/lib/video-recorder/canvas-overlay';

import { Card } from "@/components/ui/card";
import DiveJobSetupDialog from "../../inspection/dive/components/DiveJobSetupDialog";
import DiveMovementLog from "../../inspection/dive/components/DiveMovementLog";
import ROVJobSetupDialog from "../../inspection/rov/components/ROVJobSetupDialog";
import ROVMovementLog from "../../inspection/rov/components/ROVMovementLog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ComponentSpecDialog } from "@/components/dialogs/component-spec-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ReportPreviewDialog } from "@/components/ReportPreviewDialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";

import { 
    AIR_DIVE_ACTIONS, 
    BELL_DIVE_ACTIONS, 
    ROV_MOVEMENT_BRANCHES,
    INITIAL_VIDEO_EVENTS,
    COMPONENTS_SOW,
    COMPONENTS_NON_SOW,
    HISTORICAL_DATA,
    CURRENT_RECORDS
} from "./constants";

import InspectionField from "./components/InspectionField";
import { TapeManagementCard } from "./components/TapeManagementCard";
import { TapeLogEvents } from "./components/TapeLogEvents";
import { VideoInterface } from "./components/VideoInterface";
import { InspectionHeader } from "./components/InspectionHeader";
import { InspectionForm } from "./components/InspectionForm";
import { InspectionSummaryPanel } from "./components/InspectionSummaryPanel";
import { SeabedSurveyGuiInline } from "@/app/dashboard/inspection/rov/components/SeabedSurveyGuiDialog";
import inspectionRegistry from "@/utils/types/inspection-types.json";
import { resolveInspectionType } from "@/utils/inspection-schema";
import { getReportHeaderData } from "@/utils/company-settings";

import { useWorkspaceReports } from "./hooks/useWorkspaceReports";
import { WorkspaceDialogs } from "./components/WorkspaceDialogs";

export default function WorkspaceV2Page() {
    return (
        <Suspense fallback={<div className="p-10 flex min-h-screen items-center justify-center font-bold text-slate-500">Loading Cockpit...</div>}>
            <V10PreviewLayout />
        </Suspense>
    );
}

function V10PreviewLayout() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const supabase = createClient();
    const queryClient = useQueryClient();

    const jobPackId = searchParams.get('jobpack');
    const structureId = searchParams.get('structure');
    const sowIdFull = searchParams.get('sow');
    const sowId = sowIdFull?.split('-')[0];
    const targetReportNumber = searchParams.get('sowReport');
    const initialMode = searchParams.get('mode') as "DIVING" | "ROV" | null;

    // Jotai State Sync for Dialog
    const [, setGlobalUrlId] = useAtom(urlId);
    const [, setGlobalUrlType] = useAtom(urlType);

    useEffect(() => {
        if (structureId) {
            setGlobalUrlId(Number(structureId));
            setGlobalUrlType("platform"); // Default; corrected in fetchHeaderInfo once structureType resolves
        }
    }, [structureId, setGlobalUrlId, setGlobalUrlType]);

    // Force-refresh SOW and Component lists upon entering/returning to this screen
    useEffect(() => {
        if (queryClient && (structureId || sowIdFull)) {
            queryClient.invalidateQueries({ queryKey: ['sow-data'] });
        }
    }, [queryClient, structureId, sowIdFull]);

    // Mode
    const [inspMethod, setInspMethod] = useState<"DIVING" | "ROV">(initialMode || "DIVING");
    const [isSeabedGuiOpen, setIsSeabedGuiOpen] = useState(false);
    const [isSummaryOpen, setIsSummaryOpen] = useState(false);

    const [deployments, setDeployments] = useState<any[]>([]);
    const [activeDep, setActiveDep] = useState<{ id: string, jobNo?: string, name: string, raw?: any } | null>(null);
    const [isReadyForComps, setIsReadyForComps] = useState(false);

    // Live session records
    const [currentRecords, setCurrentRecords] = useState<any[]>([]);
    const [historicalRecords, setHistoricalRecords] = useState<any[]>([]);
    const [currentCompRecords, setCurrentCompRecords] = useState<any[]>([]);

    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
        key: 'cr_date',
        direction: 'desc'
    });

    const [unitSystem, setUnitSystem] = useState<"METRIC" | "IMPERIAL">("METRIC");
    const [recordSearchQuery, setRecordSearchQuery] = useState("");

    // Fetch Global Unit Preference
    useEffect(() => {
        async function fetchSettings() {
            try {
                const { data } = await supabase.from('company_settings').select('def_unit').single();
                if (data?.def_unit) {
                    setUnitSystem(data.def_unit as "METRIC" | "IMPERIAL");
                }
            } catch (e) {
                console.error("Error fetching unit preference:", e);
            }
        }
        fetchSettings();
    }, [supabase]);

    // Handle sorting for Captured Events
    const handleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    const sortedRecords = useMemo(() => {
        if (!currentRecords || currentRecords.length === 0) return [];
        
        const sortableRecords = [...currentRecords];
        sortableRecords.sort((a, b) => {
            let aVal: any;
            let bVal: any;

            switch (sortConfig.key) {
                case 'cr_date':
                    aVal = new Date(a.cr_date || 0).getTime();
                    bVal = new Date(b.cr_date || 0).getTime();
                    break;
                case 'type':
                    aVal = (a.inspection_type?.name || '').toLowerCase();
                    bVal = (b.inspection_type?.name || '').toLowerCase();
                    break;
                case 'component':
                    aVal = (a.structure_components?.q_id || '').toLowerCase();
                    bVal = (b.structure_components?.q_id || '').toLowerCase();
                    break;
                case 'elev':
                    const aE = parseFloat(a.elevation);
                    const bE = parseFloat(b.elevation);
                    aVal = isNaN(aE) ? (a.fp_kp || '') : aE;
                    bVal = isNaN(bE) ? (b.fp_kp || '') : bE;
                    break;
                case 'status':
                    // Priority: Anomaly > Incomplete > Completed
                    const getStatusWeight = (r: any) => {
                        if (r.has_anomaly) return 3;
                        if (r.status === 'INCOMPLETE') return 2;
                        if (r.status === 'COMPLETED') return 1;
                        return 0;
                    };
                    aVal = getStatusWeight(a);
                    bVal = getStatusWeight(b);
                    break;
                default:
                    aVal = a[sortConfig.key];
                    bVal = b[sortConfig.key];
            }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        
        return sortableRecords;
    }, [currentRecords, sortConfig]);
    
    const displayRecords = useMemo(() => {
        if (!recordSearchQuery) return sortedRecords;
        const q = recordSearchQuery.toLowerCase();
        return sortedRecords.filter(r => {
            const typeName = (r.inspection_type?.name || "").toLowerCase();
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toLowerCase();
            const componentId = (r.structure_components?.q_id || "").toLowerCase();
            const elev = (r.elevation || "").toString().toLowerCase();
            const status = r.has_anomaly ? "anomaly" : (r.status === 'COMPLETED' ? "complete" : "incomplete");
            const remarks = (r.inspection_data?.observation || r.inspection_data?.findings || "").toLowerCase();
            const refNo = (r.anomaly_ref_no || "").toLowerCase();

            return typeName.includes(q) || 
                   typeCode.includes(q) || 
                   componentId.includes(q) || 
                   elev.includes(q) || 
                   status.includes(q) || 
                   remarks.includes(q) ||
                   refNo.includes(q);
        });
    }, [sortedRecords, recordSearchQuery]);
    const [isFetchingDeps, setIsFetchingDeps] = useState(true);
    const [isDeploymentValid, setIsDeploymentValid] = useState(true);
    const [syncLoading, setSyncLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [componentsSow, setComponentsSow] = useState<any[]>([]);
    const [componentsNonSow, setComponentsNonSow] = useState<any[]>([]);
    const [allComps, setAllComps] = useState<any[]>([]);

    // Operations State
    const [currentMovement, setCurrentMovement] = useState<string>("Awaiting Deployment");
    const [vidState, setVidState] = useState<"IDLE" | "RECORDING" | "PAUSED">("IDLE");
    const [videoVisible, setVideoVisible] = useState(true);
    const [streamActive, setStreamActive] = useState(false);

    // Component Target Tab Mode
    const [compView, setCompView] = useState<"LIST" | "MODEL_3D">("LIST");
    const [tapeLogExpanded, setTapeLogExpanded] = useState(false);
    const [compSearchTerm, setCompSearchTerm] = useState("");
    const [specDialogOpen, setSpecDialogOpen] = useState(false);
    const [compSpecDialogOpen, setCompSpecDialogOpen] = useState(false);

    // Dynamic Form ID for scrolling
    const FORM_AREA_ID = "inspection-form-area";

    const [vidTimer, setVidTimer] = useState(0);
    const [tapeNo, setTapeNo] = useState("VDO-03-2026");
    const [tapeId, setTapeId] = useState<number | null>(null);
    const [activeChapter, setActiveChapter] = useState(1);
    const [videoEvents, setVideoEvents] = useState<any[]>([]);
    const [jobTapes, setJobTapes] = useState<any[]>([]);
    const [isEditTapeOpen, setIsEditTapeOpen] = useState(false);
    const [editTapeNo, setEditTapeNo] = useState("");
    const [editTapeChapter, setEditTapeChapter] = useState("");
    const [editTapeRemarks, setEditTapeRemarks] = useState("");
    const [editTapeStatus, setEditTapeStatus] = useState("ACTIVE");
    const [isNewTapeOpen, setIsNewTapeOpen] = useState(false);
    const [newTapeNo, setNewTapeNo] = useState("");
    const [newTapeChapter, setNewTapeChapter] = useState("");
    const [newTapeRemarks, setNewTapeRemarks] = useState("");
    const [calibrationDialogOpen, setCalibrationDialogOpen] = useState(false);
    const [rovCalibrationDialogOpen, setRovCalibrationDialogOpen] = useState(false);





    // Synchronize recording duration and vidState upon changing active tape
    useEffect(() => {
        if (!tapeId) {
            setVidTimer(0);
            setVidState("IDLE");
            return;
        }

        const tapeLogs = videoEvents.filter(evt => String(evt.tape_id) === String(tapeId) && evt.logType === 'video_log');
        if (tapeLogs.length > 0) {
            // videoEvents are sorted DESC by eventTime, so [0] is the latest
            const lastLog = tapeLogs[0];
            const stateLog = tapeLogs.find(l => ['Start Tape', 'Resume', 'Pause', 'Stop Tape'].includes(l.action));
            
            const currentState = stateLog ? stateLog.action : lastLog.action;
            const isRecording = currentState === "Start Tape" || currentState === "Resume";
            const isStopped = currentState === "Stop Tape";
            
            setVidState(isRecording ? "RECORDING" : (isStopped ? "IDLE" : "PAUSED"));
            
            let currentCounter = lastLog.tape_counter_start || 0;
            if (isRecording) {
                const startTime = new Date(lastLog.eventTime).getTime();
                const now = new Date().getTime();
                const elapsedSeconds = Math.floor((now - startTime) / 1000);
                currentCounter += Math.max(0, elapsedSeconds);
            }
            setVidTimer(currentCounter);
        } else {
            setVidTimer(0);
            setVidState("IDLE");
        }
    }, [tapeId, videoEvents]);

    // Auto-populate tape number when opening the new tape dialog
    useEffect(() => {
        if (isNewTapeOpen) {
            const base = headerData.sowReportNo || 'SOW_REPORT';
            const platform = headerData.platformName || 'STRUCTURE';
            const postfix = inspMethod === 'DIVING' ? 'D' : 'R';
            let maxSeq = 0;
            jobTapes.forEach(t => {
                const match = t.tape_no?.match(/V(\d{3})[DR]$/);
                if (match) {
                    const seq = parseInt(match[1], 10);
                    if (seq > maxSeq) maxSeq = seq;
                }
            });
            const nextSeq = String(maxSeq + 1).padStart(3, '0');
            setNewTapeNo(`${base} / ${platform} / V${nextSeq}${postfix}`);
            setNewTapeChapter("1");
            setNewTapeRemarks("");
        }
    }, [isNewTapeOpen]);

    // Live session records (MOVED UP)
    const [streamTimer, setStreamTimer] = useState(0);
    const [isStreamRecording, setIsStreamRecording] = useState(false);
    const [isStreamPaused, setIsStreamPaused] = useState(false);

    // Advanced Video States
    const [workstationSettings, setWorkstationSettings] = useState<WorkstationSettings | null>(null);
    const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
    const [streamRecorder, setStreamRecorder] = useState<MediaRecorder | null>(null);
    const [overlayManager, setOverlayManager] = useState<CanvasOverlayManager | null>(null);
    const [recordedFiles, setRecordedFiles] = useState<Array<{ id: string, name: string, type: 'video' | 'photo', url: string, blob: Blob, timestamp: string }>>([]);
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [isAttachDialogOpen, setIsAttachDialogOpen] = useState(false);
    const [attachmentToLink, setAttachmentToLink] = useState<any>(null);
    const [selectedRecordToLink, setSelectedRecordToLink] = useState<string | null>(null);
    const [attachmentMetadata, setAttachmentMetadata] = useState({ title: '', description: '' });
    const [isCommitting, setIsCommitting] = useState(false);
    const [pipWindow, setPipWindow] = useState<any>(null);
    const [capturedEventsPipWindow, setCapturedEventsPipWindow] = useState<any>(null);

    // Multiple Attachment State
    const [pendingAttachments, setPendingAttachments] = useState<Array<{
        id: string,
        file?: File | Blob,
        name: string,
        type: 'PHOTO' | 'VIDEO' | 'DOCUMENT',
        title: string,
        description: string,
        source: string,
        previewUrl?: string,
        isFromRecording?: boolean,
        isExisting?: boolean,
        path?: string,
        meta?: any
    }>>([]);
    const [isAttachmentManagerOpen, setIsAttachmentManagerOpen] = useState(false);
    const [viewingRecordAttachments, setViewingRecordAttachments] = useState<any[] | null>(null);
    const [selectorShowAll, setSelectorShowAll] = useState(false);

    // Drawing Tools state
    const [currentTool, setCurrentTool] = useState<DrawingTool>('pen');
    const [currentColor, setCurrentColor] = useState('#ef4444');
    const [lineWidth, setLineWidth] = useState(3);
    const [showDrawingTools, setShowDrawingTools] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const recorderIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    const handleExternalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newAttachments = Array.from(files).map((file: File) => {
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            const type = isImage ? 'PHOTO' : (isVideo ? 'VIDEO' : 'DOCUMENT');
            
            const isAnomaly = findingType === 'Anomaly';
            const isFinding = findingType === 'Finding';
            const prefix = isAnomaly ? 'Anomaly - ' : (isFinding ? 'Findings - ' : '');
            const refNo = anomalyData.referenceNo || 'Draft';

            return {
                id: Math.random().toString(36).substr(2, 9),
                file: file,
                name: file.name,
                type: type as 'PHOTO' | 'VIDEO' | 'DOCUMENT',
                title: prefix ? `${prefix}${refNo}` : file.name,
                description: '',
                source: 'EXTERNAL_UPLOAD',
                previewUrl: URL.createObjectURL(file),
                isFromRecording: false
            };
        });

        setPendingAttachments(prev => [...prev, ...newAttachments]);
        e.target.value = ''; // Reset input
    };

    // Context
    const [selectedComp, setSelectedComp] = useState<any>(null);
    const [activeSpec, setActiveSpec] = useState<string | null>(null);
    const [allInspectionTypes, setAllInspectionTypes] = useState<any[]>([]);
    const [inspectionTypeSearch, setInspectionTypeSearch] = useState("");
    const [isAddInspOpen, setIsAddInspOpen] = useState(false);
    const [photoLinked, setPhotoLinked] = useState(false);
    const [recordNotes, setRecordNotes] = useState("");
    
    // Reclassification States
    const [pendingReclass, setPendingReclass] = useState<{ type: 'COMPONENT' | 'TASK', newComponent: any, newTask: string | null, componentTaskStatuses: any[], orphanedFields: string[] } | null>(null);
    const [originalRecordContext, setOriginalRecordContext] = useState<any>(null);
    const [archivedData, setArchivedData] = useState<Record<string, any>>({});
    const [showTaskSelector, setShowTaskSelector] = useState(false);
    const [showCompSelector, setShowCompSelector] = useState(false);
    const [compSelectorSearch, setCompSelectorSearch] = useState("");

    const [addTaskSearch, setAddTaskSearch] = useState("");

    // Edit Settings States
    const [isVideoSettingsOpen, setIsVideoSettingsOpen] = useState(false);
    const [isDiveSetupOpen, setIsDiveSetupOpen] = useState(false);
    const [isDiveSetupForNew, setIsDiveSetupForNew] = useState(false);
    const [isMovementLogOpen, setIsMovementLogOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<any>(null);
    const [lastStartEventForEdit, setLastStartEventForEdit] = useState<any>(null);
    const [manualOverride, setManualOverride] = useState(false);

    const [diveStartTime, setDiveStartTime] = useState<string | null>(null);
    const [diveEndTime, setDiveEndTime] = useState<string | null>(null);
    const [timeInWater, setTimeInWater] = useState<string>("00:00:00");

    // Dynamic Form States
    const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({});
    const [debouncedProps, setDebouncedProps] = useState<Record<string, any>>({});
    const [requiredSpec, setRequiredSpec] = useState<any>(null);
    const [requiredProps, setRequiredProps] = useState<Record<string, any>>({});
    const [requiredRecordId, setRequiredRecordId] = useState<number | null>(null);
    const [findingType, setFindingType] = useState<"Complete" | "Anomaly" | "Finding" | "Incomplete">("Complete");
    const [isUserInteraction, setIsUserInteraction] = useState(false);
    const [anomalyData, setAnomalyData] = useState<{
        defectCode: string,
        priority: string,
        defectType: string,
        description: string,
        recommendedAction: string,
        rectify: boolean,
        rectifiedDate: string,
        rectifiedRemarks: string,
        severity: string,
        referenceNo: string
    }>({
        defectCode: '',
        priority: '',
        defectType: '',
        description: '',
        recommendedAction: '',
        rectify: false,
        rectifiedDate: '',
        rectifiedRemarks: '',
        severity: 'Minor',
        referenceNo: ''
    });
    const [incompleteReason, setIncompleteReason] = useState("");
    const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({});
    const [libOptionsMap, setLibOptionsMap] = useState<Record<string, any[]>>({});

    // Helper to handle prop changes and track user interaction
    const handleDynamicPropChange = (name: string, value: any) => {
        setDynamicProps(prev => {
            const updated = { ...prev, [name]: value };
            
            if (activeSpec === 'MGROW') {
                const c5Above = parseFloat(updated.circumferential_measurement_5m_above) || 0;
                const c0m = parseFloat(updated.circumferential_measurement_0m) || 0;
                const c5Below = parseFloat(updated.circumferential_measurement_5m_below) || 0;

                const hasAnyCirc = updated.circumferential_measurement_5m_above || 
                                   updated.circumferential_measurement_0m || 
                                   updated.circumferential_measurement_5m_below;

                if (hasAnyCirc) {
                    const avgCirc = (c5Above + c0m + c5Below) / 3;
                    const md = (typeof selectedComp?.raw?.metadata === 'string' ? JSON.parse(selectedComp.raw.metadata) : selectedComp?.raw?.metadata) || {};
                    const nominalDiameter = parseFloat(md.outer_diameter || md.diameter || md.nominal_diameter || md.od || md.nominal_od || md.nominal_diameter_mm || selectedComp?.raw?.outer_diameter || selectedComp?.raw?.diameter || selectedComp?.raw?.nominal_diameter || "0") || 0;
                    
                    const calc = Math.sqrt(avgCirc / 3.142) - nominalDiameter;
                    updated.effective_thickness = parseFloat(calc.toFixed(2));
                }
            }
            return updated;
        });
        setIsUserInteraction(true);
    };

    const handleRequiredPropChange = (name: string, value: any) => {
        setRequiredProps(prev => ({ ...prev, [name]: value }));
        setIsUserInteraction(true);
    };

    const renderInspectionField = (p: any, type: 'primary' | 'secondary') => {
        const handler = type === 'primary' ? handleDynamicPropChange : handleRequiredPropChange;
        const currentProps = type === 'primary' ? dynamicProps : requiredProps;
        const currentValue = currentProps[p.name || p.label] || "";

        return (
            <InspectionField 
                p={p} 
                type={type} 
                handler={handler} 
                currentValue={currentValue}
                libOptionsMap={libOptionsMap}
                openPopovers={openPopovers}
                setOpenPopovers={setOpenPopovers}
                selectedComp={selectedComp}
                setDebouncedProps={setDebouncedProps}
                unitSystem={unitSystem}
                dynamicProps={dynamicProps}
            />
        );
    };

    const [criteriaRules, setCriteriaRules] = useState<any[]>([]);
    const [pendingRule, setPendingRule] = useState<any>(null);
    const [showCriteriaConfirm, setShowCriteriaConfirm] = useState(false);
    const [showRemovalConfirm, setShowRemovalConfirm] = useState(false);
    const [lastAutoMatchedRuleId, setLastAutoMatchedRuleId] = useState<string | null>(null);
    const [isManualOverride, setIsManualOverride] = useState(false);
    const [activeMGIProfile, setActiveMGIProfile] = useState<any>(null);

    // Fetch Active MGI Profile
    useEffect(() => {
        async function fetchMGIProfile() {
            if (!jobPackId) return;

            // 1. Try to fetch profile linked to jobpack
            const { data: jobData } = await supabase
                .from('jobpack')
                .select('mgi_profile_id')
                .eq('id', Number(jobPackId))
                .single();

            let profileId = jobData?.mgi_profile_id;

            // 2. If no job-specific profile, fetch the global active profile
            if (!profileId) {
                const { data: globalProfile } = await supabase
                    .from('mgi_profiles')
                    .select('*')
                    .eq('is_active', true)
                    .eq('is_job_specific', false)
                    .eq('is_archived', false)
                    .maybeSingle();
                
                if (globalProfile) {
                    setActiveMGIProfile(globalProfile);
                    return;
                }
            } else {
                const { data: specificProfile } = await supabase
                    .from('mgi_profiles')
                    .select('*')
                    .eq('id', profileId)
                    .single();
                
                if (specificProfile) {
                    setActiveMGIProfile(specificProfile);
                    return;
                }
            }
        }
        fetchMGIProfile();
    }, [jobPackId, supabase]);

    // Anomaly Library Statesuto-update pending attachment titles for Anomaly/Finding
    useEffect(() => {
        if (findingType === 'Anomaly' || findingType === 'Finding') {
            const label = findingType === 'Anomaly' ? 'Anomaly' : 'Finding';
            // Extract the sequence part (e.g., A-001 from 2026/PLAT/A-001)
            const parts = (anomalyData.referenceNo || '').split(' / ');
            const seq = parts.length > 0 ? parts[parts.length - 1] : 'Draft';
            
            setPendingAttachments(prev => prev.map(att => {
                // If it's a default name or from live snapshot, update it
                if (att.source === 'LIVE_SNAPSHOT' || att.title === att.name || !att.title) {
                    return { ...att, title: `${label} - ${seq}` };
                }
                return att;
            }));
        }
    }, [findingType, anomalyData.referenceNo]);

    // Fetch criteria rules
    useEffect(() => {
        if (!selectedComp) return;
        async function fetchRules() {
            let group = selectedComp.structureGroup || selectedComp.raw?.metadata?.structure_group || 'Primary';
            if (group === 'Primary Member') group = 'Primary';
            
            const { data } = await supabase.from('defect_criteria_rules')
                .select('*')
                .or(`structure_group.eq.${group},structure_group.eq.All Structure Groups`)
                .order('rule_order');
            if (data) {
                // Map snake_case to camelCase
                setCriteriaRules(data.map(r => ({
                    id: String(r.id),
                    fieldName: r.field_name,
                    priorityId: r.priority_id,
                    defectCodeId: r.defect_code_id,
                    defectTypeId: r.defect_type_id,
                    thresholdValue: r.threshold_value,
                    thresholdOperator: r.threshold_operator,
                    thresholdText: r.threshold_text,
                    alertMessage: r.alert_message,
                    order: r.rule_order,
                    evaluationPriority: r.evaluation_priority,
                    referenceNo: r.reference_no,
                    autoFlag: r.auto_flag
                })));
            }
        }
        fetchRules();
    }, [selectedComp, supabase]);

    // Anomaly Library States
    const [defectCodes, setDefectCodes] = useState<any[]>([]);
    const [priorities, setPriorities] = useState<any[]>([]);
    const [allDefectTypes, setAllDefectTypes] = useState<any[]>([]);
    const [availableDefectTypes, setAvailableDefectTypes] = useState<any[]>([]);

    // Filter Defect Types by selected Defect Code via u_lib_combo
    useEffect(() => {
        async function filterDefectTypes() {
            if (!anomalyData.defectCode) {
                setAvailableDefectTypes(allDefectTypes);
                return;
            }
            // Resolve the lib_id for the selected defect code description
            const selectedCodeItem = defectCodes.find(c => c.lib_desc === anomalyData.defectCode);
            if (!selectedCodeItem) {
                setAvailableDefectTypes(allDefectTypes);
                return;
            }
            // Fetch valid type IDs from u_lib_combo (code_1 = defect code, lib_code links the combo)
            const { data: combos } = await supabase
                .from('u_lib_combo')
                .select('code_2')
                .eq('code_1', selectedCodeItem.lib_id);
            if (combos && combos.length > 0) {
                const validTypeIds = combos.map((c: any) => c.code_2);
                const filtered = allDefectTypes.filter(t => validTypeIds.includes(t.lib_id));
                setAvailableDefectTypes(filtered.length > 0 ? filtered : allDefectTypes);
                // Clear defect type if current selection is no longer valid
                if (anomalyData.defectType && filtered.length > 0) {
                    const stillValid = filtered.some(t => t.lib_desc === anomalyData.defectType);
                    if (!stillValid) {
                        setAnomalyData(prev => ({ ...prev, defectType: '' }));
                    }
                }
            } else {
                setAvailableDefectTypes(allDefectTypes);
            }
        }
        filterDefectTypes();
    }, [anomalyData.defectCode, defectCodes, allDefectTypes, supabase]);

    const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
    const jpParam = searchParams.get('jpName');
    const strParam = searchParams.get('structName');
    const sowParam = searchParams.get('sowReport');
    const jtParam = searchParams.get('jobType');

    // Header Data
    const [headerData, setHeaderData] = useState<{ 
        jobpackName: string, 
        platformName: string, 
        sowReportNo: string, 
        jobType: string, 
        structureType: 'platform' | 'pipeline', 
        waterDepth: number,
        vessel: string
    }>({
        jobpackName: jpParam || (jobPackId ? `JP-${jobPackId}` : "N/A"),
        platformName: strParam || (structureId ? `Struct ${structureId}` : "N/A"),
        sowReportNo: sowParam || (sowId ? `SOW-${sowId}` : "N/A"),
        jobType: jtParam || "",
        structureType: 'platform',
        waterDepth: 0,
        vessel: "N/A"
    });

    const {
        previewOpen, setPreviewOpen,
        mPreviewOpen, setMPreviewOpen,
        fmdPreviewOpen, setFmdPreviewOpen,
        utwtPreviewOpen, setUtwtPreviewOpen,
        szciPreviewOpen, setSzciPreviewOpen,
        rscorPreviewOpen, setRscorPreviewOpen,
        rrisiPreviewOpen, setRrisiPreviewOpen,
        jtisiPreviewOpen, setJtisiPreviewOpen,
        itisiPreviewOpen, setItisiPreviewOpen,
        anodePreviewOpen, setAnodePreviewOpen,
        cpPreviewOpen, setCpPreviewOpen,
        rgviPreviewOpen, setRgviPreviewOpen,
        rcasnPreviewOpen, setRcasnPreviewOpen,
        rcasnSketchPreviewOpen, setRcasnSketchPreviewOpen,
        rcondPreviewOpen, setRcondPreviewOpen,
        rcondSketchPreviewOpen, setRcondSketchPreviewOpen,
        blPreviewOpen, setBlPreviewOpen,
        seabedPreviewOpen, setSeabedPreviewOpen,
        photographyPreviewOpen, setPhotographyPreviewOpen,
        photographyLogPreviewOpen, setPhotographyLogPreviewOpen,
        seabedTemplateType, setSeabedTemplateType,
        previewRecord, setPreviewRecord,
        generateAnomalyReportBlob,
        generateSeabedReport,
        generateSeabedReportBlob,
        generateMGIReport,
        generateMGIReportBlob,
        generateFMDReport,
        generateFMDReportBlob,
        generateSZCIReport,
        generateSZCIReportBlob,
        generateUTWTReport,
        generateUTWTReportBlob,
        generateInspectionReportByType,
        generateFullInspectionReport
    } = useWorkspaceReports(
        supabase,
        jobPackId,
        structureId,
        headerData,
        currentRecords,
        allInspectionTypes
    );

    /**
     * Robust SOW Status Synchronization
     * Derived from aggregated insp_records for a specific COMPONENT + TASK
     */
    const syncSowStatus = useCallback(async (compId: number, taskInput: string, currentElevation?: number, currentStatus?: string) => {
        if (!sowId) return;

        // 1. Resolve the canonical task info FIRST
        const it = allInspectionTypes.find(t => 
            t.code === taskInput || 
            t.name?.toLowerCase() === taskInput.toLowerCase()
        );
        
        if (!it) {
            console.warn(`[SOW Sync] Skip: Could not resolve task "${taskInput}" in inspection library.`);
            return;
        }

        const taskCode = it.code; // Canonical code

        // 2. Get the SOW item for this component + canonical task
        const { data: existing, error: fetchSowErr } = await supabase.from('u_sow_items')
            .select('*')
            .eq('sow_id', Number(sowId))
            .eq('component_id', compId)
            .eq('inspection_code', taskCode)
            .maybeSingle();

        if (fetchSowErr) {
            console.error(`[SOW Sync] Fetch failed for ${taskCode}:`, fetchSowErr);
            return;
        }

        const userRes = await supabase.auth.getUser();
        const user = userRes.data.user;
        const userName = user?.user_metadata?.full_name || user?.email || user?.id || 'system';

        if (existing) {
            let updatedFields: any = {
                updated_at: new Date().toISOString(),
                updated_by: userName
            };

            // 3a. Handle Elevation-bound SOW Item
            if (existing.elevation_required && existing.elevation_data && Array.isArray(existing.elevation_data) && currentElevation !== undefined) {
                const elevStatus = currentStatus?.toLowerCase() || 'completed';
                
                const updatedElevationData = existing.elevation_data.map((elev: any) => {
                    const start = parseFloat(elev.start);
                    const end = parseFloat(elev.end);
                    // Check if currentElevation falls within this range
                    if (!isNaN(start) && !isNaN(end) && currentElevation >= Math.min(start, end) && currentElevation <= Math.max(start, end)) {
                        return { ...elev, status: elevStatus };
                    }
                    return elev;
                });

                updatedFields.elevation_data = updatedElevationData;
                
                // Recalculate overall status: If any is 'pending', overall is 'incomplete'? 
                // Or if all are 'completed', overall is 'completed'.
                const allDone = updatedElevationData.every((e: any) => e.status === 'completed');
                const anyIncomplete = updatedElevationData.some((e: any) => e.status === 'incomplete');
                
                if (allDone) {
                    updatedFields.status = 'completed';
                } else if (anyIncomplete) {
                    updatedFields.status = 'incomplete';
                } else {
                    // If some are done but not all, it's still 'incomplete' or 'pending'?
                    // Usually "In Progress" isn't a status here, so we keep 'incomplete' as "partially done"
                    updatedFields.status = 'incomplete';
                }
            } else {
                // 3b. Handle Standard SOW Item
                let newStatus: 'pending' | 'completed' | 'incomplete' = 'completed';
                if (currentStatus?.toUpperCase() === 'INCOMPLETE') {
                    newStatus = 'incomplete';
                }
                updatedFields.status = newStatus;
            }

            const { error: updateErr } = await supabase.from('u_sow_items')
                .update(updatedFields)
                .eq('id', existing.id);
            
            if (updateErr) console.error("[SOW Sync] Update error:", updateErr);
        } else {
            // 4. Auto-add to SOW if we have records but no SOW entry (Standard fallback)
            let newStatus: 'pending' | 'completed' | 'incomplete' = 'completed';
            if (currentStatus?.toUpperCase() === 'INCOMPLETE') {
                newStatus = 'incomplete';
            }

            const compObj = allComps.find(c => c.id === compId);
            console.log(`[Status Sync] -> AUTO-ADDING to SOW: ${compObj?.name || compId} with task ${taskCode}`);
            
            const { error: insertError } = await supabase.from('u_sow_items').insert({
                sow_id: Number(sowId),
                component_id: compId,
                component_qid: compObj?.name || compObj?.q_id || `COMP-${compId}`,
                component_type: compObj?.raw?.type || null,
                inspection_type_id: it.id,
                inspection_code: taskCode,
                inspection_name: it.name,
                status: newStatus,
                report_number: headerData.sowReportNo,
                elevation_required: false,
                created_by: userName,
                updated_by: userName
            });

            if (!insertError) {
                toast.success(`Component ${compObj?.name || compId} added to SOW.`);
                
                // Keep totals synchronized
                const { data: sowData } = await supabase.from('u_sow')
                    .select('total_items, pending_items, report_numbers')
                    .eq('id', Number(sowId))
                    .maybeSingle();

                if (sowData) {
                    const currentReports = sowData.report_numbers || [];
                    const hasReport = currentReports.some((r: any) => r.number === headerData.sowReportNo);
                    
                    const updatePayload: any = {
                        total_items: (sowData.total_items || 0) + 1,
                        updated_by: userName,
                        updated_at: new Date().toISOString()
                    };

                    if (!hasReport && headerData.sowReportNo && headerData.sowReportNo !== 'N/A') {
                        updatePayload.report_numbers = [
                            ...currentReports,
                            { 
                                number: headerData.sowReportNo, 
                                job_type: headerData.jobType || 'Unassigned',
                                date: new Date().toISOString()
                            }
                        ];
                    }

                    await supabase.from('u_sow').update(updatePayload).eq('id', Number(sowId));
                }

                // Sync to Jobpack Metadata to ensure badges show up in modify screen
                const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
                if (jobPack) {
                    const metadata = jobPack.metadata || {};
                    const inspections = metadata.inspections || {};
                    const structType = headerData.structureType === 'pipeline' ? 'PIPELINE' : 'PLATFORM';
                    const key = `${structType}-${structureId}`;
                    
                    const currentList = inspections[key] || [];
                    if (!currentList.some((item: any) => item.code === it.code)) {
                        inspections[key] = [...currentList, { id: it.id, code: it.code, name: it.name, metadata: it.metadata }];
                        
                        // Ensure structure is also in the list
                        const structures = metadata.structures || [];
                        if (!structures.some((s: any) => s.id == structureId && s.type === structType)) {
                            structures.push({ id: Number(structureId), type: structType, title: headerData.platformName });
                        }

                        await supabase.from('jobpack').update({
                            metadata: { ...metadata, inspections, structures }
                        }).eq('id', Number(jobPackId));
                    }
                }
            } else {
                console.error("[SOW Sync] Auto-add SOW failed:", insertError);
            }
        }

        // 5. Invalidate query to refresh UI (including sidebar)
        queryClient.invalidateQueries({ queryKey: ['sow-data'] });
    }, [sowId, supabase, queryClient, allInspectionTypes, allComps, headerData, jobPackId, structureId]);

    useEffect(() => {
        async function fetchHeaderInfo() {
            if (!jobPackId || !structureId || !sowId) return;

            let jobpackName = jpParam || `JP-${jobPackId}`;
            let platformName = strParam || "Unknown Structure";
            let sowReportNo = sowParam || "Unknown Report";

            // Fetch Jobpack Name
            if (!jpParam) {
                const { data: jpData } = await supabase.from('jobpack').select('name').eq('id', Number(jobPackId)).single();
                if (jpData?.name) jobpackName = jpData.name;
            }

            // Fetch Structure Name & Depth
            // NOTE: The 'structure' table only has str_id + str_type. Name and depth live in platform table.
            let waterDepth = 0;

            // Always fetch from platform table — it has 'title' (name) and 'depth' (water depth)
            const { data: platData } = await supabase
                .from('platform' as any)
                .select('title, depth')
                .eq('plat_id', Number(structureId))
                .maybeSingle() as any;

            if (platData) {
                if (!strParam && platData.title) platformName = platData.title;
                if (platData.depth) waterDepth = Number(platData.depth);
            }

            // Fetch Structure Type for data acquisition
            let detectedStructureType: 'platform' | 'pipeline' = 'platform';
            const { data: strTypeData } = await supabase.from('structure').select('str_type').eq('str_id', Number(structureId)).single();
            if (strTypeData?.str_type) {
                detectedStructureType = strTypeData.str_type.toLowerCase().includes('pipeline') ? 'pipeline' : 'platform';
            }

            // Fetch SOW Info
            if (!sowParam) {
                const { data: sowItemData } = await supabase.from('u_sow_items')
                    .select('report_number')
                    .eq('sow_id', sowId)
                    .not('report_number', 'is', null)
                    .limit(1);

                if (sowItemData && sowItemData.length > 0) {
                    sowReportNo = sowItemData[0].report_number;
                } else if (sowIdFull && sowIdFull.includes('-')) {
                    sowReportNo = sowIdFull.split('-').slice(1).join('-');
                } else {
                    sowReportNo = sowIdFull || `SOW-${sowId}`;
                }

                // Sanitize if it's a filter string from a malformed link
                if (sowReportNo && sowReportNo.includes('=')) {
                    sowReportNo = sowReportNo.split('=').pop() || sowReportNo;
                }
            }

            // Fetch Vessel from Jobpack
            let vessel = "N/A";
            const { data: jpMetadata } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
            if (jpMetadata?.metadata) {
                const meta = jpMetadata.metadata as any;
                if (meta.vessel_history && Array.isArray(meta.vessel_history) && meta.vessel_history.length > 0) {
                    vessel = meta.vessel_history.map((v: any) => v.name || v).join(", ");
                } else if (meta.vessel) {
                    vessel = meta.vessel;
                }
            }

            setHeaderData({ 
                jobpackName, 
                platformName, 
                sowReportNo, 
                jobType: jtParam || "", 
                structureType: detectedStructureType, 
                waterDepth,
                vessel
            });
            setGlobalUrlType(detectedStructureType);
        }
        fetchHeaderInfo();
    }, [jobPackId, structureId, sowId, sowIdFull, supabase, jpParam, strParam, sowParam, jtParam]);

    useEffect(() => {
        if ((findingType === 'Anomaly' || findingType === 'Finding') && !anomalyData.referenceNo) {
            const fetchPreviewRef = async () => {
                const category = findingType === 'Anomaly' ? 'ANOMALY' : 'FINDING';
                const prefix = findingType === 'Anomaly' ? 'A' : 'F';
                
                const { data: sequenceData } = await supabase.rpc('get_next_record_sequence', {
                    p_structure_id: parseInt(structureId || "0"),
                    p_jobpack_id: parseInt(jobPackId || "0"),
                    p_report_no: headerData.sowReportNo,
                    p_category: category
                });
                
                const seq = sequenceData || 1;
                let baseRef = `${new Date().getFullYear()} / ${headerData.platformName} / ${prefix}-${seq.toString().padStart(3, '0')}`;
                if (anomalyData.rectify) baseRef += 'R';
                setAnomalyData(prev => ({ ...prev, referenceNo: baseRef }));
            };
            fetchPreviewRef();
        }
    }, [findingType, anomalyData.rectify, editingRecordId, structureId, jobPackId, headerData.platformName, headerData.sowReportNo, supabase]);

    const parseDbDate = useCallback((dateString?: string | null): Date => {
        if (!dateString) return new Date();
        try {
            const t = dateString.replace(' ', 'T');
            // Stop artificially converting raw timestamps dynamically to UTC with `Z` suffix.
            // When postgres stores 'timestamp without tz', treating it implicitly as local is correct.
            const d = new Date(t);
            return isNaN(d.getTime()) ? new Date() : d;
        } catch (e) {
            return new Date();
        }
    }, []);

    const handlePopoutCapturedEvents = async () => {
        if (!('documentPictureInPicture' in window)) {
            toast.error("Floating window is not supported in this browser. Please use Chrome or Edge.");
            return;
        }

        try {
            if (capturedEventsPipWindow) {
                capturedEventsPipWindow.close();
                return;
            }

            const pip = await (window as any).documentPictureInPicture.requestWindow({
                width: 1000,
                height: 600,
            });

            Array.from(document.styleSheets).forEach((styleSheet) => {
                try {
                    const cssRules = styleSheet.cssRules;
                    if (cssRules) {
                        const newStyleEl = document.createElement('style');
                        Array.from(cssRules).forEach((rule) => {
                            newStyleEl.appendChild(document.createTextNode(rule.cssText));
                        });
                        pip.document.head.appendChild(newStyleEl);
                    }
                } catch (e) {
                    if (styleSheet.href) {
                        const newLinkEl = document.createElement('link');
                        newLinkEl.rel = 'stylesheet';
                        newLinkEl.href = styleSheet.href;
                        pip.document.head.appendChild(newLinkEl);
                    }
                }
            });

            // Add basic HTML structure overlay
            pip.document.head.insertAdjacentHTML('beforeend', '<style>body { margin: 0; padding: 0; overflow: hidden; background: #fff; font-family: system-ui, -apple-system, sans-serif; }</style>');

            setCapturedEventsPipWindow(pip);

            pip.addEventListener("pagehide", () => {
                setCapturedEventsPipWindow(null);
            });
        } catch (error) {
            console.error("Failed to open captured events floating window:", error);
            toast.error("Failed to open floating window");
        }
    };

    const handleDeleteTape = async (tapeIdToDelete: number) => {
        // Double check no events exist
        const hasEvents = videoEvents.some(evt => String(evt.tape_id) === String(tapeIdToDelete));
        if (hasEvents) {
            toast.error("Tape has video logs and cannot be deleted");
            return;
        }

        const { error } = await supabase.from('insp_video_tapes').delete().eq('tape_id', tapeIdToDelete);
        if (error) {
            toast.error("Failed to delete tape: " + error.message);
        } else {
            toast.success("Tape deleted successfully");
            setJobTapes(prev => prev.filter(t => t.tape_id !== tapeIdToDelete));
            if (tapeId === tapeIdToDelete) {
                setTapeId(null);
                setTapeNo("");
                setVidTimer(0);
            }
        }
    };

    const handleDeleteRecord = async (id: number) => {
        // Fetch record to check for latest anomaly/finding rule
        const { data: record } = await supabase.from('insp_records')
            .select('*, insp_anomalies(*)')
            .eq('insp_id', id)
            .single();

        if (record?.has_anomaly && record.insp_anomalies?.[0]) {
            const anomaly = record.insp_anomalies[0];
            const category = anomaly.record_category;

            // Check if there's any later anomaly/finding in the same sequence
            const { data: laterAnomalies } = await supabase
                .from('insp_anomalies')
                .select('anomaly_id, insp_records!inner(structure_id, jobpack_id, sow_report_no)')
                .eq('record_category', category)
                .eq('insp_records.structure_id', record.structure_id)
                .eq('insp_records.jobpack_id', record.jobpack_id)
                .eq('insp_records.sow_report_no', record.sow_report_no)
                .gt('sequence_no', anomaly.sequence_no)
                .limit(1);

            if (laterAnomalies && laterAnomalies.length > 0) {
                toast.error(`Cannot delete this ${category.toLowerCase()}. Only the latest ${category.toLowerCase()} in the sequence can be deleted. Please rectify it instead.`);
                return;
            }
        }

        if (!confirm("Are you sure you want to permanently delete this inspection record and all its associated attachments?")) return;
        
        try {
            // 1. Fetch attachments to delete from Storage and DB
            const { data: attachments } = await supabase.from('attachment').select('path, id').eq('source_id', id).eq('source_type', 'INSPECTION');
            
            if (attachments && attachments.length > 0) {
                const paths = attachments.map(a => a.path).filter(Boolean);
                if (paths.length > 0) {
                    const { error: storageErr } = await supabase.storage.from('attachments').remove(paths);
                    if (storageErr) console.warn("Storage deletion error:", storageErr);
                }
                
                // Explicitly delete attachments from DB
                await supabase.from('attachment').delete().eq('source_id', id).eq('source_type', 'INSPECTION');
            }

            // 2. Delete anomalies
            await supabase.from('insp_anomalies').delete().eq('inspection_id', id);

            // 3. Delete from Database
            await supabase.from('insp_video_logs').delete().eq('inspection_id', id);
            const { error: delErr } = await supabase.from('insp_records').delete().eq('insp_id', id);
            if (delErr) {
                toast.error("Failed to delete record: " + delErr.message);
                return;
            }

            if (record && record.component_id && record.inspection_type_code) {
                await syncSowStatus(record.component_id, record.inspection_type_code);
            }

            toast.success("Record deleted");
            queryClient.invalidateQueries({ queryKey: ['sow-data'] });
            queryClient.invalidateQueries({ queryKey: ['inspection-records'] });
            
            if (editingRecordId !== null && Number(id) === Number(editingRecordId)) {
                resetForm();
            }
            
            syncDeploymentState();
        } catch (error) {
            console.error("Error deleting record:", error);
            toast.error("Failed to delete record");
        }
    };

    const resetForm = () => {
        setActiveSpec(null);
        setRecordNotes("");
        setDynamicProps({});
        setDebouncedProps({});
        setFindingType("Complete");
        setIncompleteReason("");
        setEditingRecordId(null);
        setRequiredRecordId(null);
        setRequiredProps({});
        setRequiredSpec(null);
        setAnomalyData({
            defectCode: '', 
            priority: '', 
            defectType: '', 
            description: '', 
            recommendedAction: '',
            rectify: false, 
            rectifiedDate: '', 
            rectifiedRemarks: '', 
            severity: 'MINOR', 
            referenceNo: '' 
        });
        setLastAutoMatchedRuleId(null);
        setPendingRule(null);
        setPhotoLinked(false);
        setPendingAttachments([]);
    };

    // Re-classification Logic
    const diffSpecifications = (newComp: any, newTaskCode: string) => {
        const newIt = allInspectionTypes.find(t => t.code === newTaskCode || t.name === newTaskCode);
        const specProps = newIt?.default_properties || [];
        let newPropsList: any[] = [];
        if (typeof specProps === 'string') {
             try {
                 const parsed = JSON.parse(specProps);
                 newPropsList = Array.isArray(parsed) ? parsed : (parsed.properties || []);
             } catch (e) { }
        } else if (Array.isArray(specProps)) {
             newPropsList = [...specProps];
        }

        if (newComp?.type?.toUpperCase() === 'ANODE') {
            newPropsList = newPropsList.filter(p => !['length', 'width', 'height', 'diameter', 'coating', 'weld_number'].includes(p.name));
            newPropsList.unshift(
                { name: 'anode_type', label: 'Anode Type', type: 'select', options: ['Stand-off', 'Flush', 'Bracelet', 'Sled'] },
                { name: 'depletion', label: 'Depletion (%)', type: 'number', validation: { min: 0, max: 100 } }
            );
        } else if (newComp?.type?.toUpperCase() === 'PIPELINE') {
            newPropsList.unshift({ name: 'kp', label: 'Kilometer Post (KP)', type: 'text' });
        }
        
        const newFieldNames = new Set(newPropsList.map(p => p.name));
        const orphaned: string[] = [];
        
        Object.keys(dynamicProps).forEach(key => {
            if (key.startsWith('_')) return; // ignore metadata
            if (!newFieldNames.has(key)) {
                orphaned.push(key);
            }
        });
        
        return orphaned;
    };

    const handleComponentSelection = (c: any) => {
        if (editingRecordId && selectedComp && c.id !== selectedComp.id) {
            const orphaned = diffSpecifications(c, activeSpec || '');
            setPendingReclass({
                type: 'COMPONENT',
                newComponent: c,
                newTask: activeSpec,
                componentTaskStatuses: c.taskStatuses || [],
                orphanedFields: orphaned
            });
        } else {
            setSelectedComp(c);
            resetForm();
        }
    };

    const confirmReclassification = async () => {
        if (!pendingReclass || !editingRecordId) return;
        const { newComponent, newTask, orphanedFields } = pendingReclass;
        
        try {
            setIsCommitting(true);
            const userRes = await supabase.auth.getUser();
            const user = userRes.data.user;
            
            // 1. Prepare updated record data
            const updatedData = { ...dynamicProps };
            const updatedArchive = { ...archivedData };
            
            // Archive orphaned fields
            if (orphanedFields && orphanedFields.length > 0) {
                orphanedFields.forEach(f => {
                    if (updatedData[f] !== undefined) {
                        updatedArchive[f] = updatedData[f];
                        delete updatedData[f];
                    }
                });
            }

            // 2. Perform Database Update
            const payload: any = {
                component_id: newComponent?.id,
                inspection_type_id: allInspectionTypes.find(t => t.code === newTask)?.id,
                inspection_type_code: newTask,
                inspection_data: updatedData,
                archived_data: updatedArchive,
                md_user: user?.id || 'system'
            };

            const { error: updateErr } = await supabase.from('insp_records')
                .update(payload)
                .eq('insp_id', editingRecordId);

            if (updateErr) throw updateErr;

            // 3. SOW Status Synchronization (Rollback Old & Commit New)
            if (sowId && originalRecordContext) {
                // Rollback original component/task
                await syncSowStatus(originalRecordContext.component_id, originalRecordContext.inspection_type_code);
                
                // Commit new component/task
                if (newComponent && newTask) {
                    await syncSowStatus(newComponent.id, newTask);
                }
            }

            // 4. Update local state and cleanup
            if (newComponent) setSelectedComp(newComponent);
            if (newTask) setActiveSpec(newTask);
            setDynamicProps(updatedData);
            setArchivedData(updatedArchive);
            setPendingReclass(null);
            
            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: ['inspection-records'] });
            queryClient.invalidateQueries({ queryKey: ['sow-data'] });
            
            toast.success("Record re-classified successfully");
            syncDeploymentState(); // Refresh history/events
        } catch (err: any) {
            console.error("Re-classification failed:", err);
            toast.error(`Failed to move record: ${err.message}`);
        } finally {
            setIsCommitting(false);
        }
    };

    const handleTaskChange = (newTask: string) => {
        if (!selectedComp || !editingRecordId) {
            setActiveSpec(newTask);
            setShowTaskSelector(false);
            return;
        }
        
        const orphaned = diffSpecifications(selectedComp, newTask);
        setPendingReclass({
            type: 'TASK',
            newComponent: selectedComp,
            newTask: newTask,
            componentTaskStatuses: selectedComp.taskStatuses || [],
            orphanedFields: orphaned
        });
        setShowTaskSelector(false);
    };

    const [dataAcqFields, setDataAcqFields] = useState<Array<{ label: string, targetField: string, value: string }>>([]);
    const [dataAcqConnected, setDataAcqConnected] = useState(false);
    const [dataAcqConnecting, setDataAcqConnecting] = useState(false);
    const [dataAcqError, setDataAcqError] = useState<string | null>(null);
    const dataAcqSerialRef = useRef<any>(null);
    const dataAcqReaderRef = useRef<any>(null);
    const dataAcqBufferRef = useRef<string>('');
    const dataAcqStreamClosedRef = useRef<any>(null);

    // Data Acquisition Connect
    const handleDataAcqConnect = async () => {
        setDataAcqError(null);
        setDataAcqConnecting(true);

        const DA_STORAGE_KEYS: Record<string, string> = {
            platform: 'data_acquisition_platform_v1',
            pipeline: 'data_acquisition_pipeline_v1',
        };
        const key = DA_STORAGE_KEYS[headerData.structureType];
        const saved = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
        let settings: any = null;
        if (saved) {
            try { settings = JSON.parse(saved); } catch (e) { /* ignore */ }
        }

        if (!settings) {
            setDataAcqError('No settings configured. Go to Settings â†’ Data Acquisition to configure.');
            setDataAcqConnecting(false);
            toast.error('Data acquisition settings not found. Please configure in Settings â†’ Data Acquisition.');
            return;
        }

        const connType = settings.connection?.type || 'serial';

        if (connType === 'serial') {
            if (!('serial' in navigator)) {
                setDataAcqError('Web Serial API not supported. Use Chrome, Edge, or Opera.');
                setDataAcqConnecting(false);
                toast.error('Web Serial API is not supported in this browser. Use Chrome, Edge, or Opera.');
                return;
            }

            try {
                const port = await (navigator as any).serial.requestPort();
                const serialSettings = settings.connection?.serial || {};
                await port.open({
                    baudRate: serialSettings.baudRate || 9600,
                    dataBits: serialSettings.dataBits || 8,
                    parity: serialSettings.parity || 'none',
                    stopBits: serialSettings.stopBits || 1,
                });

                dataAcqSerialRef.current = port;
                dataAcqBufferRef.current = '';

                const textDecoder = new TextDecoderStream();
                const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
                dataAcqStreamClosedRef.current = readableStreamClosed;
                const reader = textDecoder.readable.getReader();
                dataAcqReaderRef.current = reader;

                setDataAcqConnected(true);
                setDataAcqConnecting(false);
                toast.success('Data acquisition connected!');

                // Parse settings
                const parseMethod = settings.parsing?.method || 'position';
                const startChar = settings.parsing?.startCharacter || '$';
                const strLen = settings.parsing?.stringLength || 100;
                const fields = settings.fields || [];

                // Read loop
                const readLoop = async () => {
                    try {
                        while (true) {
                            const { value, done } = await reader.read();
                            if (done) break;
                            if (value) {
                                dataAcqBufferRef.current += value;
                                if (dataAcqBufferRef.current.length > 10000) {
                                    dataAcqBufferRef.current = dataAcqBufferRef.current.slice(-5000);
                                }
                            }
                        }
                    } catch (e) { /* reader cancelled */ }
                };
                readLoop();

                // Parse interval
                const parseInterval = setInterval(() => {
                    if (!dataAcqBufferRef.current) return;
                    const data = dataAcqBufferRef.current;
                    let processedData = data;

                    if (startChar && strLen > 0) {
                        let startIndex = data.lastIndexOf(startChar);
                        if (startIndex !== -1 && (startIndex + strLen > data.length)) {
                            startIndex = data.lastIndexOf(startChar, startIndex - 1);
                        }
                        if (startIndex !== -1 && (startIndex + strLen <= data.length)) {
                            processedData = data.substring(startIndex, startIndex + strLen);
                        } else {
                            return;
                        }
                    }

                    setDataAcqFields(prev => prev.map(f => {
                        const fieldDef = fields.find((fd: any) => (fd.targetField || fd.label) === f.targetField);
                        if (!fieldDef) return f;

                        let val = '';
                        if (fieldDef.defaultDataOption === 'system_date') {
                            val = new Date().toISOString().split('T')[0];
                        } else if (fieldDef.defaultDataOption === 'system_time') {
                            val = new Date().toTimeString().split(' ')[0];
                        } else if (parseMethod === 'position') {
                            const start = parseInt(fieldDef.positionValue || '0');
                            if (!isNaN(start) && start < processedData.length) {
                                val = processedData.substring(start, Math.min(start + (fieldDef.length || 1), processedData.length));
                                if (val.length > 0 && /[a-zA-Z]/.test(val[0])) val = val.substring(1);
                            }
                        } else {
                            const idPrefix = fieldDef.idValue || fieldDef.label;
                            const escapedPrefix = idPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const regex = new RegExp(`${escapedPrefix}([^,]+)`);
                            const match = processedData.match(regex);
                            val = match ? match[1].substring(0, fieldDef.length || 10) : '';
                            if (val.length > 0 && /[a-zA-Z]/.test(val[0])) val = val.substring(1);
                        }

                        // Apply modification
                        if (fieldDef.modify && fieldDef.modify !== 'none' && val && !/[a-zA-Z]/.test(val)) {
                            const numVal = parseFloat(val);
                            if (!isNaN(numVal)) {
                                switch (fieldDef.modify) {
                                    case 'add': val = (numVal + (fieldDef.modifyValue || 0)).toString(); break;
                                    case 'subtract': val = (numVal - (fieldDef.modifyValue || 0)).toString(); break;
                                    case 'multiply': val = (numVal * (fieldDef.modifyValue || 1)).toString(); break;
                                    case 'divide': val = (fieldDef.modifyValue ? (numVal / fieldDef.modifyValue) : numVal).toString(); break;
                                }
                            }
                        }

                        return { ...f, value: val || '--' };
                    }));
                }, 200);

                // Store interval for cleanup
                (port as any).__parseInterval = parseInterval;

            } catch (error: any) {
                const msg = error?.message || 'Failed to connect to serial port.';
                setDataAcqError(msg);
                setDataAcqConnecting(false);
                toast.error(`Connection failed: ${msg}`);
            }
        } else {
            // Network connection not yet implemented in browser
            setDataAcqError('Network (TCP/UDP) connection not supported in browser. Use Serial connection.');
            setDataAcqConnecting(false);
            toast.error('Network connections are not supported in browser. Please use Serial connection.');
        }
    };

    // Data Acquisition Disconnect
    const handleDataAcqDisconnect = async () => {
        try {
            if (dataAcqReaderRef.current) {
                await dataAcqReaderRef.current.cancel();
                dataAcqReaderRef.current = null;
            }
            if (dataAcqStreamClosedRef.current) {
                await dataAcqStreamClosedRef.current.catch(() => { });
            }
            if (dataAcqSerialRef.current) {
                if ((dataAcqSerialRef.current as any).__parseInterval) {
                    clearInterval((dataAcqSerialRef.current as any).__parseInterval);
                }
                await dataAcqSerialRef.current.close();
                dataAcqSerialRef.current = null;
            }
            setDataAcqConnected(false);
            setDataAcqFields(prev => prev.map(f => ({ ...f, value: '--' })));
            toast.success('Data acquisition disconnected.');
        } catch (e: any) {
            console.error('Error disconnecting data acq:', e);
            toast.error('Error disconnecting: ' + (e?.message || 'Unknown error'));
        }
    };

    useEffect(() => {
        const DA_STORAGE_KEYS: Record<string, string> = {
            platform: 'data_acquisition_platform_v1',
            pipeline: 'data_acquisition_pipeline_v1',
        };

        const key = DA_STORAGE_KEYS[headerData.structureType];
        const saved = typeof window !== 'undefined' ? localStorage.getItem(key) : null;

        if (saved) {
            try {
                const settings = JSON.parse(saved);
                if (settings.fields && settings.fields.length > 0) {
                    setDataAcqFields(settings.fields.map((f: any) => ({
                        label: f.label || '?',
                        targetField: f.targetField || f.label || 'field',
                        value: '--'
                    })));
                } else {
                    setDataAcqFields([]);
                }
            } catch (e) {
                setDataAcqFields([]);
            }
        } else {
            // Use defaults based on structure type
            if (headerData.structureType === 'pipeline') {
                setDataAcqFields([
                    { label: 'KP', targetField: 'kilometer_post', value: '--' },
                    { label: 'D', targetField: 'depth', value: '--' },
                    { label: 'CP', targetField: 'cp_reading', value: '--' },
                ]);
            } else {
                setDataAcqFields([
                    { label: 'NI', targetField: 'northing', value: '--' },
                    { label: 'E', targetField: 'easting', value: '--' },
                    { label: 'D', targetField: 'depth', value: '--' },
                    { label: 'CP', targetField: 'cp_reading', value: '--' },
                ]);
            }
        }
    }, [headerData.structureType]);

    // Load Settings on Mount
    useEffect(() => {
        const settings = loadSettings();
        setWorkstationSettings(settings);
    }, []);

    // Sync Stream when settings or active state changes
    useEffect(() => {
        if (streamActive) {
            startStream();
        } else {
            stopStream();
        }
        return () => stopStream();
    }, [streamActive, workstationSettings?.video.deviceId]);

    const startStream = async () => {
        if (!workstationSettings) return;
        try {
            const constraints = {
                video: {
                    deviceId: workstationSettings.video.deviceId ? { exact: workstationSettings.video.deviceId } : undefined,
                    width: { ideal: parseInt(workstationSettings.video.resolution.split('x')[0]) },
                    height: { ideal: parseInt(workstationSettings.video.resolution.split('x')[1]) },
                    frameRate: { ideal: workstationSettings.video.frameRate },
                },
                audio: workstationSettings.audio.deviceId ? {
                    deviceId: { exact: workstationSettings.audio.deviceId },
                    echoCancellation: workstationSettings.audio.echoCancellation,
                    noiseSuppression: workstationSettings.audio.noiseSuppression,
                } : false,
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setPreviewStream(stream);

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            // Sync overlay
            if (canvasRef.current && !overlayManager) {
                const om = new CanvasOverlayManager(canvasRef.current);
                om.setTool(currentTool);
                om.setColor(currentColor);
                om.setLineWidth(lineWidth);
                setOverlayManager(om);
            }
        } catch (err) {
            console.error("Failed to start stream:", err);
            toast.error("Failed to access camera. Check device settings.");
            setStreamActive(false);
        }
    };

    // Maintain stream and overlay when mounting/unmounting or PiP
    useEffect(() => {
        if (streamActive && previewStream && videoRef.current) {
            videoRef.current.srcObject = previewStream;
        }

        let om: CanvasOverlayManager | null = null;
        if (streamActive && canvasRef.current) {
            // Check if the current manager is already bound to this canvas
            if (overlayManager && overlayManager.getCanvas() === canvasRef.current) {
                overlayManager.setTool(currentTool);
                overlayManager.setColor(currentColor);
                overlayManager.setLineWidth(lineWidth);
                return;
            }

            // Capture existing objects if we're replacing an old manager
            const existingObjects = overlayManager ? overlayManager.getObjects() : [];

            om = new CanvasOverlayManager(canvasRef.current);
            om.setTool(currentTool);
            om.setColor(currentColor);
            om.setLineWidth(lineWidth);
            if (existingObjects.length > 0) {
                om.setObjects(existingObjects);
            }
            setOverlayManager(om);
        }

    }, [pipWindow, streamActive, previewStream, currentTool, currentColor, lineWidth]);

    const stopStream = () => {
        if (previewStream) {
            previewStream.getTracks().forEach(t => t.stop());
            setPreviewStream(null);
        }
        if (overlayManager) {
            overlayManager.destroy();
            setOverlayManager(null);
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
    };

    const handleStartStreamRecording = async () => {
        if (!previewStream || !workstationSettings || !videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const overlay = canvasRef.current;

        // Composite Canvas for recording with drawings
        const compositeCanvas = document.createElement('canvas');
        compositeCanvas.width = video.videoWidth;
        compositeCanvas.height = video.videoHeight;
        const ctx = compositeCanvas.getContext('2d');
        if (!ctx) return;

        const drawLoop = () => {
            ctx.drawImage(video, 0, 0, compositeCanvas.width, compositeCanvas.height);
            ctx.drawImage(overlay, 0, 0, compositeCanvas.width, compositeCanvas.height);
            animationFrameRef.current = requestAnimationFrame(drawLoop);
        };
        drawLoop();

        const compositeStream = compositeCanvas.captureStream(workstationSettings.video.frameRate);
        const audioTracks = previewStream.getAudioTracks();
        if (audioTracks.length > 0) {
            compositeStream.addTrack(audioTracks[0]);
        }

        const recorder = createMediaRecorder(compositeStream, {
            videoFormat: workstationSettings.recording.video.format,
        });

        if (!recorder) {
            toast.error("Failed to initialize recorder");
            return;
        }

        setStreamRecorder(recorder);
        startRecording(recorder, () => { }, async (blob, duration) => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

            const format = FORMAT_CONFIGS[workstationSettings.recording.video.format];
            const filename = generateFilename(workstationSettings.recording.video.filenamePrefix, format.extension, {
                platformId: structureId || undefined,
                componentId: selectedComp?.name || undefined
            });

            await saveFile(blob, filename);
            const fileUrl = URL.createObjectURL(blob);
            setRecordedFiles(prev => [{
                id: Math.random().toString(36).substr(2, 9),
                name: filename,
                type: 'video',
                url: fileUrl,
                blob: blob,
                timestamp: new Date().toISOString()
            }, ...prev]);

            toast.success(`Video saved: ${filename}`);
            setIsStreamRecording(false);
            setIsStreamPaused(false);
            setStreamTimer(0);
        });

        setIsStreamRecording(true);
        setIsStreamPaused(false);
        setStreamTimer(0);
    };

    const handleStopStreamRecording = () => {
        if (streamRecorder && streamRecorder.state !== 'inactive') {
            streamRecorder.stop();
        }
    };

    const handlePauseStreamRecording = () => {
        if (streamRecorder && streamRecorder.state === 'recording') {
            streamRecorder.pause();
            setIsStreamPaused(true);
        }
    };

    const handleResumeStreamRecording = () => {
        if (streamRecorder && streamRecorder.state === 'paused') {
            streamRecorder.resume();
            setIsStreamPaused(false);
        }
    };

    const handleGrabPhoto = async () => {
        if (!videoRef.current || !canvasRef.current || !workstationSettings) return;

        const video = videoRef.current;
        const overlay = canvasRef.current;
        const composite = document.createElement('canvas');
        composite.width = video.videoWidth;
        composite.height = video.videoHeight;
        const ctx = composite.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0);
        ctx.drawImage(overlay, 0, 0);

        const photoFormat = workstationSettings.recording.photo.format;
        const mimeType = photoFormat.includes('png') ? 'image/png' : 'image/jpeg';
        const quality = photoFormat.includes('95') ? 0.95 : 0.8;

        const blob = await new Promise<Blob | null>((resolve) => {
            composite.toBlob((b) => resolve(b), mimeType, quality);
        });

        if (blob) {
            const ext = getPhotoExtension(photoFormat);
            const filename = generateFilename(workstationSettings.recording.photo.filenamePrefix, ext, {
                platformId: structureId || undefined,
                componentId: selectedComp?.name || undefined
            });

            await saveFile(blob, filename);
            const fileUrl = URL.createObjectURL(blob);
            setRecordedFiles(prev => [{
                id: Math.random().toString(36).substr(2, 9),
                name: filename,
                type: 'photo',
                url: fileUrl,
                blob: blob,
                timestamp: new Date().toISOString()
            }, ...prev]);

            toast.success(`Photo grabbed: ${filename}`);
        }
    };

    const handlePopOutStream = async () => {
        if (pipWindow) {
            pipWindow.close();
            setPipWindow(null);
            return;
        }

        const pip = (window as any).documentPictureInPicture;
        if (!pip) {
            // Fallback to standard video PiP if Document PiP not supported
            if (videoRef.current) {
                try {
                    if ('requestPictureInPicture' in (videoRef.current as any)) {
                        (videoRef.current as any).requestPictureInPicture();
                    } else {
                        toast.info("Standard PiP not supported. Try using Chrome for advanced floating controls.");
                    }
                } catch (err) {
                    console.error("PiP failed", err);
                }
            }
            return;
        }

        try {
            const pw = await pip.requestWindow({
                width: 320,
                height: 480,
            });

            // Copy styles to new window
            Array.from(document.styleSheets).forEach((styleSheet) => {
                try {
                    if (styleSheet.cssRules) {
                        const newStyle = pw.document.createElement('style');
                        Array.from(styleSheet.cssRules).forEach((rule) => {
                            newStyle.appendChild(pw.document.createTextNode(rule.cssText));
                        });
                        pw.document.head.appendChild(newStyle);
                    } else if (styleSheet.href) {
                        const newLink = pw.document.createElement('link');
                        newLink.rel = 'stylesheet';
                        newLink.href = styleSheet.href;
                        pw.document.head.appendChild(newLink);
                    }
                } catch (e) {
                    if (styleSheet.href) {
                        const newLink = pw.document.createElement('link');
                        newLink.rel = 'stylesheet';
                        newLink.href = styleSheet.href;
                        pw.document.head.appendChild(newLink);
                    }
                }
            });

            // Handle background
            // Handle background and height for full-screen stretching
            pw.document.documentElement.style.height = "100%";
            pw.document.body.style.height = "100%";
            pw.document.body.style.background = "#000";
            pw.document.body.style.margin = "0";
            pw.document.body.style.overflow = "hidden";
            pw.document.body.style.display = "flex";
            pw.document.body.style.flexDirection = "column";

            pw.addEventListener('pagehide', () => {
                setPipWindow(null);
            });

            setPipWindow(pw);
        } catch (err) {
            console.error("Failed to open Document PiP", err);
            toast.error("Could not open floating window.");
        }
    };

    const handleLinkToRecord = (file: typeof recordedFiles[0]) => {
        const prefix = findingType === 'Anomaly' ? 'Anomaly - ' : (findingType === 'Finding' ? 'Finding - ' : '');
        const refNo = anomalyData.referenceNo || 'Draft';
        
        setPendingAttachments(prev => [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            file: file.blob,
            name: file.name,
            type: file.type === 'video' ? 'VIDEO' : 'PHOTO',
            title: prefix ? `${prefix}${refNo}` : file.name,
            description: '',
            source: 'LIVE_SNAPSHOT',
            previewUrl: file.url,
            isFromRecording: true
        }]);
        toast.success(`Screen grab added to current record: ${file.name}`);
    };

    // End of Linking Logic

    // Dynamic Time in Water Clock
    useEffect(() => {
        let timerId: NodeJS.Timeout;
        if (diveStartTime) {
            timerId = setInterval(() => {
                const start = parseDbDate(diveStartTime).getTime();
                const end = diveEndTime ? parseDbDate(diveEndTime).getTime() : new Date().getTime();
                const diff = end - start;
                if (diff > 0) {
                    const hrs = Math.floor(diff / (1000 * 60 * 60));
                    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const secs = Math.floor((diff % (1000 * 60)) / 1000);
                    setTimeInWater(`${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
                } else {
                    setTimeInWater("00:00:00");
                }
            }, 1000);
        } else {
            setTimeInWater("00:00:00");
        }
        return () => {
            if (timerId) clearInterval(timerId);
        };
    }, [diveStartTime, diveEndTime]);

    // Format timer
    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const parseTimecode = (t: string) => {
        if (!t) return 0;
        if (typeof t === 'number') return t;
        const parts = t.split(':').map(Number);
        if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
        if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
        return isNaN(parts[0]) ? 0 : parts[0];
    };

    const isValidTimeFormat = (t: string) => {
        if (!t || t === '--') return false;
        // Regex for HH:mm:ss - Allows hours beyond 24 for tape counters
        const regex = /^(\d{1,5}):([0-5]?\d):([0-5]?\d)$/;
        return regex.test(String(t));
    };

    // Auto Timer (Tape Log)
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (vidState === "RECORDING") {
            interval = setInterval(() => setVidTimer(t => t + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [vidState]);

    // Stream Recording Timer (Local Capture)
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isStreamRecording && !isStreamPaused) {
            interval = setInterval(() => setStreamTimer(t => t + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [isStreamRecording, isStreamPaused]);

    const syncDeploymentState = useCallback(async () => {
        if (!activeDep?.id || activeDep.id === "AWAITING") {
            console.log("[Sync] Skipping sync: no active deployment");
            return;
        }

        try {
            setSyncLoading(true);
            const depId = !isNaN(Number(activeDep.id)) ? Number(activeDep.id) : activeDep.id;
            
            const movTable = inspMethod === "DIVING" ? 'insp_dive_movements' : 'insp_rov_movements';
            const movCol = inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id';

            // 1 & 2. Fetch Movements and Tapes in parallel
            const [movsRes, tapesRes] = await Promise.all([
                supabase.from(movTable).select('*').eq(movCol, depId).order('movement_time', { ascending: true }),
                supabase.from('insp_video_tapes').select('*').eq(movCol, depId).order('tape_id', { ascending: false })
            ]);

            const movs = movsRes.data;
            let tapes = tapesRes.data;

            if (movsRes.error) console.error("[Sync] Movement fetch error:", movsRes.error);
            if (tapesRes.error) console.error("[Sync] Tape fetch error:", tapesRes.error);

            if (movs && movs.length > 0) {
                const last = movs[movs.length - 1];
                let mvtLabel = last.movement_type || "Awaiting Deployment";
                if (inspMethod === 'DIVING') {
                    const mappedItem = [...AIR_DIVE_ACTIONS, ...BELL_DIVE_ACTIONS].find(a => a.value === mvtLabel || a.label === mvtLabel);
                    if (mappedItem) mvtLabel = mappedItem.label;
                }
                setCurrentMovement(mvtLabel);
                setDiveStartTime(movs[0].movement_time || movs[0].event_time);

                const recoveryEvent = movs.find(m =>
                    m.movement_type?.toLowerCase().includes('arrived surface') ||
                    m.movement_type?.toLowerCase().includes('recovered') ||
                    m.movement_type === 'BACK_TO_SURFACE'
                );
                setDiveEndTime(recoveryEvent?.movement_time || recoveryEvent?.event_time || null);
            } else {
                setCurrentMovement("Awaiting Deployment");
                setDiveStartTime(null);
                setDiveEndTime(null);
            }

            // FALLBACK: If no tapes found in insp_video_tapes
            if (!tapes || tapes.length === 0) {
                let recTapesQuery = supabase.from('insp_records')
                    .select('tape_id')
                    .eq(movCol, depId)
                    .not('tape_id', 'is', null);

                if (structureId && !isNaN(Number(structureId))) {
                    recTapesQuery = recTapesQuery.eq('structure_id', Number(structureId));
                }
                if (headerData.sowReportNo && headerData.sowReportNo !== "N/A" && headerData.sowReportNo !== "Unknown Report") {
                    recTapesQuery = recTapesQuery.eq('sow_report_no', headerData.sowReportNo);
                }

                const { data: recTapes } = await recTapesQuery;
                if (recTapes && recTapes.length > 0) {
                    const uniqueTapeIds = Array.from(new Set(recTapes.map(r => r.tape_id)));
                    tapes = uniqueTapeIds.map(tid => ({ tape_id: tid, tape_no: `TAPE-${tid}`, status: 'ACTIVE' })) as any;
                }
            }

            const tapeIds = tapes?.map(t => t.tape_id) || [];
            setJobTapes(tapes || []);

            if (tapes && tapes.length > 0) {
                const latestTape = tapes[0];
                setTapeNo(latestTape.tape_no);
                setTapeId(latestTape.tape_id);
                setActiveChapter(latestTape.chapter_no || 1);

                // Fetch logs for latest tape in parallel
                const [lastLogRes, stateLogRes] = await Promise.all([
                    supabase.from('insp_video_logs').select('*').eq('tape_id', latestTape.tape_id).order('event_time', { ascending: false }).limit(1).maybeSingle(),
                    supabase.from('insp_video_logs').select('event_type').eq('tape_id', latestTape.tape_id).in('event_type', ['NEW_LOG_START', 'RESUME', 'PAUSE', 'END']).order('event_time', { ascending: false }).limit(1).maybeSingle()
                ]);

                const lastLog = lastLogRes.data;
                const stateLog = stateLogRes.data;

                if (lastLog) {
                    const currentState = stateLog ? stateLog.event_type : lastLog.event_type;
                    const isRecording = currentState === "NEW_LOG_START" || currentState === "RESUME";
                    const isStopped = currentState === "END";
                    setVidState(isRecording ? "RECORDING" : (isStopped ? "IDLE" : "PAUSED"));

                    let currentCounter = lastLog.tape_counter_start || 0;
                    if (isRecording) {
                        const startTime = parseDbDate(lastLog.event_time).getTime();
                        const now = new Date().getTime();
                        const elapsedSeconds = Math.floor((now - startTime) / 1000);
                        currentCounter += Math.max(0, elapsedSeconds);
                    }
                    setVidTimer(currentCounter);
                } else {
                    setVidState("IDLE");
                    setVidTimer(0);
                }
            } else {
                setTapeId(null);
                setVidState("IDLE");
                setVidTimer(0);
            }

            let allEv: any[] = [];
            const inspCol = inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id';
            let inspsQuery = supabase.from('insp_records').select(`
                *,
                inspection_type:inspection_type_id!left(id, code, name),
                structure_components:component_id!left (
                    id,
                    q_id, 
                    code,
                    metadata
                ),
                insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                insp_video_tapes:tape_id!left(tape_no),
                insp_anomalies(*)
            `).eq(inspCol, depId);

            if (structureId && !isNaN(Number(structureId))) {
               inspsQuery = inspsQuery.eq('structure_id', Number(structureId));
            }
            if (headerData.sowReportNo && headerData.sowReportNo !== "N/A" && headerData.sowReportNo !== "Unknown Report") {
               inspsQuery = inspsQuery.eq('sow_report_no', headerData.sowReportNo);
            }

            // 3 & 4. Fetch Logs and Inspection Records in parallel to reduce network roundtrips
            const [logsRes, inspsRes] = await Promise.all([
                tapeIds.length > 0 
                  ? supabase.from('insp_video_logs').select('*').in('tape_id', tapeIds).order('event_time', { ascending: false })
                  : Promise.resolve({ data: [] }),
                inspsQuery
            ]);

            const logs = logsRes.data;
            const insps = inspsRes.data;

            if (logs) {
                allEv.push(...logs.map((l: any) => ({
                    id: `log_${l.video_log_id}`,
                    realId: l.video_log_id,
                    time: l.timecode_start || '00:00:00',
                    action: l.event_type === "NEW_LOG_START" ? "Start Tape" : l.event_type === "END" ? "Stop Tape" : l.event_type === "PAUSE" ? "Pause" : l.event_type === "RESUME" ? "Resume" : l.event_type,
                    logType: 'video_log',
                    eventTime: parseDbDate(l.event_time).toISOString(),
                    inspectionId: l.inspection_id,
                    tape_id: l.tape_id,
                    tape_counter_start: l.tape_counter_start || 0
                })));
            }

            if (inspsRes.error) {
                console.error("[Sync] Inspection fetch error:", inspsRes.error);
            } else if (insps) {
                // Fetch attachment counts manually for 'attachment' table
                const { data: allAtts } = await supabase.from('attachment')
                    .select('source_id')
                    .eq('source_type', 'INSPECTION')
                    .in('source_id', insps.map(r => r.insp_id));
                
                const countMap = (allAtts || []).reduce((acc: Record<number, number>, curr) => {
                    acc[curr.source_id] = (acc[curr.source_id] || 0) + 1;
                    return acc;
                }, {});

                const inspsWithCounts = insps.map(r => ({
                    ...r,
                    attachment_count: countMap[r.insp_id] || 0
                }));

                setCurrentRecords(inspsWithCounts);
                
                // PERFORMANCE FIX: Use a Set for O(1) lookup during synchronization to avoid O(N*M) lag
                const logInspectionIds = new Set(allEv.map(ev => ev.inspectionId).filter(Boolean));
                
                inspsWithCounts.forEach(r => {
                    if (!logInspectionIds.has(r.insp_id)) {
                        const status = r.has_anomaly || (r.status === 'Anomaly' || r.status === 'Defect') ? 'ANOMALY' : 'INSPECTION';
                        allEv.push({
                            id: `insp_${r.insp_id}`,
                            realId: r.insp_id,
                            time: r.inspection_data?._meta_timecode || '00:00:00',
                            action: status,
                            logType: 'insp',
                            eventTime: r.inspection_date && r.inspection_time ? format(parseDbDate(`${r.inspection_date} ${r.inspection_time}`), "yyyy-MM-dd'T'HH:mm:ss") : format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
                            tape_id: r.tape_id
                        });
                    }
                });
            }

            allEv.sort((a, b) => new Date(b.eventTime || 0).getTime() - new Date(a.eventTime || 0).getTime());
            setVideoEvents(allEv);
            setIsDeploymentValid(true);
        } catch (err) {
            console.error("[Sync] Critical sync error:", err);
            setIsDeploymentValid(false);
        } finally {
            setSyncLoading(false);
            setIsReadyForComps(true);
        }
    }, [activeDep, inspMethod, supabase, parseDbDate, structureId, headerData.sowReportNo]);


    // Active deployment effect: sync tape, movements, records
    useEffect(() => {
        syncDeploymentState();
    }, [syncDeploymentState]);

    const fetchHistory = useCallback(async () => {
        if (!selectedComp || !structureId) return;
        
        try {
            setHistoryLoading(true);
            let query = supabase.from('insp_records')
                .select('*')
                .eq('component_id', selectedComp.id)
                .eq('structure_id', Number(structureId));

            if (headerData.sowReportNo && headerData.sowReportNo !== "N/A" && headerData.sowReportNo !== "Unknown Report") {
                query = query.eq('sow_report_no', headerData.sowReportNo);
            }

            const { data, error } = await query.order('cr_date', { ascending: false });

        if (error || !data) {
            console.error("Error fetching component history:", error);
            return;
        }

        console.log(`[fetchHistory] Raw records for component ${selectedComp.id}: ${data.length}. JobPackId: ${jobPackId}, SOW: ${headerData.sowReportNo}`);

        // 1. Filter by current mode (Diving vs ROV)
        const modeFiltered = data.filter((r: any) => {
            if (inspMethod === 'DIVING') return !!r.dive_job_id;
            if (inspMethod === 'ROV') return !!r.rov_job_id;
            return true;
        });

        console.log(`[fetchHistory] After mode filter (${inspMethod}): ${modeFiltered.length} records`);

        if (modeFiltered.length === 0) {
            setCurrentCompRecords([]);
            setHistoricalRecords([]);
            return;
        }

        // 2. Batch lookup dive_no / deployment_no from the dive/rov tables
        const diveJobIds = Array.from(new Set(modeFiltered.filter(r => r.dive_job_id).map(r => r.dive_job_id)));
        const rovJobIds = Array.from(new Set(modeFiltered.filter(r => r.rov_job_id).map(r => r.rov_job_id)));
        const tapeIds = Array.from(new Set(modeFiltered.filter(r => r.tape_id).map(r => r.tape_id)));
        const inspTypeIds = Array.from(new Set(modeFiltered.filter(r => r.inspection_type_id).map(r => r.inspection_type_id)));

        // Lookup maps
        const diveNoMap: Record<string, string> = {};
        const rovNoMap: Record<string, string> = {};
        const tapeNoMap: Record<string, string> = {};
        const inspTypeMap: Record<string, { name: string, code: string }> = {};

        // Fetch dive_no for all dive_job_ids
        if (diveJobIds.length > 0) {
            const { data: diveData } = await supabase.from('insp_dive_jobs')
                .select('dive_job_id, dive_no')
                .in('dive_job_id', diveJobIds);
            if (diveData) {
                diveData.forEach((d: any) => { diveNoMap[String(d.dive_job_id)] = d.dive_no; });
            }
        }

        // Fetch deployment_no for all rov_job_ids
        if (rovJobIds.length > 0) {
            const { data: rovData } = await supabase.from('insp_rov_jobs')
                .select('rov_job_id, deployment_no')
                .in('rov_job_id', rovJobIds);
            if (rovData) {
                rovData.forEach((d: any) => { rovNoMap[String(d.rov_job_id)] = d.deployment_no; });
            }
        }

        // Fetch tape_no for all tape_ids
        if (tapeIds.length > 0) {
            const { data: tapeData } = await supabase.from('insp_video_tapes')
                .select('tape_id, tape_no')
                .in('tape_id', tapeIds);
            if (tapeData) {
                tapeData.forEach((t: any) => { tapeNoMap[String(t.tape_id)] = t.tape_no; });
            }
        }

        // Fetch inspection type names
        if (inspTypeIds.length > 0) {
            const { data: itData } = await supabase.from('inspection_type')
                .select('id, name, code')
                .in('id', inspTypeIds);
            if (itData) {
                itData.forEach((it: any) => { inspTypeMap[String(it.id)] = { name: it.name, code: it.code }; });
            }
        }

        // 3. Build the current deployment IDs set (for matching records without jobpack_id)
        const currentDepIds = new Set<string>();
        if (activeDep?.id) currentDepIds.add(String(activeDep.id));
        // Also check all deployments for this jobpack
        deployments.forEach(d => currentDepIds.add(String(d.id)));

        // 4. Partition into Current Workpack and Historical Data
        const current: any[] = [];
        const historical: any[] = [];

        modeFiltered.forEach((r: any) => {
            // Resolve dive/deployment number
            let diveNo = 'N/A';
            if (inspMethod === 'DIVING' && r.dive_job_id) {
                diveNo = diveNoMap[String(r.dive_job_id)] || 'N/A';
            } else if (inspMethod === 'ROV' && r.rov_job_id) {
                diveNo = rovNoMap[String(r.rov_job_id)] || 'N/A';
            }

            // Resolve tape number
            const tapeNo = r.tape_id ? (tapeNoMap[String(r.tape_id)] || 'N/A') : 'N/A';

            // Resolve inspection type name
            const itInfo = r.inspection_type_id ? inspTypeMap[String(r.inspection_type_id)] : null;
            const typeName = itInfo?.name || itInfo?.code || r.inspection_type_code || 'Unknown';

            // Determine if record belongs to current workpack
            // Method 1: jobpack_id matches
            const hasMatchingJobpack = jobPackId && String(r.jobpack_id) === String(jobPackId);
            // Method 2: If no jobpack_id on record, check if the dive/rov job belongs to current set
            const depId = inspMethod === 'DIVING' ? r.dive_job_id : r.rov_job_id;
            const depBelongsToCurrent = depId && currentDepIds.has(String(depId));
            
            const isCurrentWorkpack = hasMatchingJobpack || (!r.jobpack_id && depBelongsToCurrent);
            
            // SOW check: only enforce if both sides have values
            const recordSow = r.sow_report_no ? String(r.sow_report_no).trim() : '';
            const headerSow = headerData.sowReportNo ? String(headerData.sowReportNo).trim() : '';
            const sowMatches = !recordSow || !headerSow || recordSow === headerSow;
            
            const recordObj = {
                id: r.insp_id,
                date: r.inspection_date,
                time: r.inspection_time,
                type: typeName,
                diveNo,
                tapeNo,
                status: r.has_anomaly ? 'Anomaly' : (r.status === 'INCOMPLETE' ? 'Incomplete' : 'Complete'),
                finding: r.description || r.inspection_data?._meta_status || 'No notes',
                year: r.inspection_date ? new Date(r.inspection_date).getFullYear() : new Date(r.cr_date).getFullYear()
            };

            if (isCurrentWorkpack && sowMatches) {
                current.push(recordObj);
            } else {
                historical.push(recordObj);
            }
        });

        console.log(`[fetchHistory] Partitioned - Current Workpack: ${current.length}, Historical: ${historical.length}`);
        if (current.length === 0 && modeFiltered.length > 0) {
            const r0 = modeFiltered[0];
            console.log(`[fetchHistory] DEBUG: record[0] jobpack_id=${r0.jobpack_id} vs jobPackId=${jobPackId}, sow=${r0.sow_report_no} vs header=${headerData.sowReportNo}, dive_job_id=${r0.dive_job_id}, rov_job_id=${r0.rov_job_id}, currentDepIds=${Array.from(currentDepIds).join(',')}`);
        }

        setCurrentCompRecords(current);
        setHistoricalRecords(historical);
        } catch (err) {
            console.error("fetchHistory Error:", err);
        } finally {
            setHistoryLoading(false);
        }
    }, [selectedComp, supabase, structureId, jobPackId, headerData.sowReportNo, inspMethod, activeDep, deployments]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const handleLogEvent = async (action: string) => {
        let currentTimer = vidTimer;
        if (action === "Start Tape") {
            currentTimer = 0;
            setVidTimer(0);
        } else if (action === "Stop Tape") {
            // Keep currentTimer as the actual duration for the log record, but visually reset it
            setVidTimer(0);
        }

        const optimisticId = `log_${Date.now()}`;
        const tcode = formatTime(currentTimer);
        const now = new Date();
        const eventTime = format(now, "yyyy-MM-dd'T'HH:mm:ss");
        setVideoEvents([{ id: optimisticId, realId: 0, time: tcode, action, logType: 'video_log', eventTime, tape_id: tapeId, tape_counter_start: currentTimer }, ...videoEvents]);

        // Map UI labels to valid DB constraint values
        let dbAction = action;
        if (action === "Start Tape") dbAction = "NEW_LOG_START";
        if (action === "Stop Tape") dbAction = "END";
        if (action === "Pause") dbAction = "PAUSE";
        if (action === "Resume") dbAction = "RESUME";

        let tId = tapeId;

        // Auto-increment chapter logic ON Stop Tape is now at the end of the function.
        // Fallback for first tape if none exists when starting
        if (!tId && activeDep?.id) {
            const user = (await supabase.auth.getUser()).data.user;
            let uniqueTapeNo = tapeNo;
            if (!uniqueTapeNo) {
                const base = headerData.sowReportNo || 'SOW_REPORT';
                const platform = headerData.platformName || 'STRUCTURE';
                const postfix = inspMethod === 'DIVING' ? 'D' : 'R';
                let maxSeq = 0;
                jobTapes.forEach(t => {
                    const match = t.tape_no.match(/V(\d{3})[DR]$/);
                    if (match) {
                        const seq = parseInt(match[1], 10);
                        if (seq > maxSeq) maxSeq = seq;
                    }
                });
                const nextSeq = String(maxSeq + 1).padStart(3, '0');
                uniqueTapeNo = `${base} / ${platform} / V${nextSeq}${postfix}`;
            }
            const { data: newTape } = await supabase.from('insp_video_tapes').insert({
                tape_no: uniqueTapeNo,
                tape_type: "DIGITAL - PRIMARY",
                chapter_no: 1,
                status: 'ACTIVE',
                [inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id']: Number(activeDep.id),
                cr_user: user?.id || 'system'
            }).select().single();

            if (newTape) {
                setJobTapes(prev => [newTape, ...prev]);
                setTapeId(newTape.tape_id);
                setTapeNo(newTape.tape_no);
                setActiveChapter(newTape.chapter_no || 1);
                tId = newTape.tape_id;
            }
        }

        // AUTO INCREMENT CHAPTER LOGIC HERE (Before inserting the new log)
        if (action === "Start Tape" && activeDep?.id && tId) {
            const { data: lastLog } = await supabase.from('insp_video_logs')
                .select('event_type')
                .eq('tape_id', tId)
                .order('event_time', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (lastLog && lastLog.event_type === 'END') {
                const currentTape = jobTapes.find(t => t.tape_id === tId);
                const nextChapter = (Number(currentTape?.chapter_no) || 1) + 1;
                const user = (await supabase.auth.getUser()).data.user;

                const { data: newTape, error: insertErr } = await supabase.from('insp_video_tapes').insert({
                    tape_no: currentTape?.tape_no || tapeNo || 'TAPE',
                    chapter_no: nextChapter,
                    tape_type: currentTape?.tape_type || "DIGITAL - PRIMARY",
                    status: 'ACTIVE',
                    [inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id']: Number(activeDep.id),
                    cr_user: user?.id || 'system'
                }).select().single();

                if (insertErr) {
                    toast.error(`Auto-Chapter Error: ${insertErr.message}`);
                    console.error("[Chapter Increment]", insertErr);
                } else if (newTape) {
                    setJobTapes(prev => [newTape, ...prev]);
                    setTapeId(newTape.tape_id);
                    setActiveChapter(nextChapter);
                    tId = newTape.tape_id; // critical! we need the NEW log to be attached to this new tapeId
                }
            }
        }

        if (tId) {
            const { data: newLog } = await supabase.from('insp_video_logs').insert({
                tape_id: tId,
                event_type: dbAction,
                event_time: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"), // Store EXACT region local time safely
                timecode_start: tcode,
                tape_counter_start: currentTimer,
                remarks: ""
            }).select('video_log_id').single();

            if (newLog) {
                setVideoEvents(prev => prev.map(ev => ev.id === optimisticId ? { ...ev, id: `log_${newLog.video_log_id}`, realId: newLog.video_log_id } : ev));
            }

        }

        if (action === "Start Tape" || action === "Resume") setVidState("RECORDING");
        if (action === "Pause") setVidState("PAUSED");
        if (action === "Stop Tape") setVidState("IDLE");
    };

    const handleDeleteEvent = async (id: string, logType: string, realId: number) => {
        if (!confirm("Delete this event?")) return;
        setVideoEvents(videoEvents.filter(ev => ev.id !== id));
        if (logType === 'video_log') {
            const { data: logToDel } = await supabase.from('insp_video_logs').select('event_type, tape_id, event_time').eq('video_log_id', realId).single();
            const { error } = await supabase.from('insp_video_logs').delete().eq('video_log_id', realId);
            if (!error) {
                // Feature: Revert chapter logic if NEW_LOG_START event deleted
                if (logToDel?.event_type === 'NEW_LOG_START') {
                    const currentTape = jobTapes.find(t => t.tape_id === logToDel.tape_id);
                    if (currentTape && Number(currentTape.chapter_no) > 1) {
                        // We check if this tape has any other logs.
                        const { data: otherLogs } = await supabase.from('insp_video_logs').select('video_log_id').eq('tape_id', logToDel.tape_id).limit(1);
                        if (!otherLogs || otherLogs.length === 0) {
                            await supabase.from('insp_video_tapes').delete().eq('tape_id', logToDel.tape_id);

                            // Find the previous chapter tape to switch back to
                            const { data: prevTapes } = await supabase.from('insp_video_tapes')
                                .select('*')
                                .eq('tape_no', currentTape.tape_no)
                                .eq(inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id', activeDep?.id || 0)
                                .order('chapter_no', { ascending: false });

                            if (prevTapes && prevTapes.length > 0) {
                                // Since we just deleted the top one, the next highest is the previous tape
                                const prevTape = prevTapes.length > 1 && prevTapes[0].tape_id === logToDel.tape_id ? prevTapes[1] : prevTapes[0];
                                if (tapeId === logToDel.tape_id) {
                                    setTapeId(prevTape.tape_id);
                                    setActiveChapter(prevTape.chapter_no);
                                }
                                setJobTapes(prev => prev.filter(t => t.tape_id !== logToDel.tape_id));
                                toast.success("Rolled back tape to previous chapter");
                            }
                        }
                    }
                }

                // Re-sync timer state after deleting a log event
                syncDeploymentState();
            }
        } else if (logType === 'insp') {
            await handleDeleteRecord(realId);
        }
    };

    const handleEditEventSave = async (newTime: string, newAction: string, newEventTime?: string) => {
        if (!editingEvent?.id) return;

        try {
            let finalTimecode = newTime;
            let finalEventTime = newEventTime || editingEvent.eventTime;

            // Auto-correct counter based on Date/Time if eventTime was changed
            if (newEventTime && newEventTime !== editingEvent.eventTime && editingEvent.logType === 'video_log') {
                const { data: prevLogs } = await supabase.from('insp_video_logs')
                    .select('event_time, tape_counter_start, event_type')
                    .eq('tape_id', tapeId)
                    .lt('event_time', newEventTime)
                    .in('event_type', ['NEW_LOG_START', 'RESUME', 'START_TASK', 'RESUME_TASK'])
                    .order('event_time', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (prevLogs) {
                    const startAt = parseDbDate(prevLogs.event_time).getTime();
                    const nowAt = parseDbDate(newEventTime).getTime();
                    const diffSecs = Math.max(0, Math.floor((nowAt - startAt) / 1000));
                    const newCounterVal = (prevLogs.tape_counter_start || 0) + diffSecs;
                    finalTimecode = formatTime(newCounterVal);
                    console.log("Auto-correcting counter:", { old: editingEvent.time, new: finalTimecode, diffSecs });
                } else {
                    console.log("No previous start log found for auto-correction");
                }
            }

            // Map UI labels to valid DB constraint values if needed
            let dbAction = newAction;
            if (newAction === "Start Tape") dbAction = "NEW_LOG_START";
            if (newAction === "Stop Tape") dbAction = "END";
            if (newAction === "Pause") dbAction = "PAUSE";
            if (newAction === "Resume") dbAction = "RESUME";

            if (editingEvent.logType === 'video_log') {
                await supabase.from('insp_video_logs').update({
                    timecode_start: finalTimecode,
                    tape_counter_start: (finalTimecode.split(':').reduce((acc, time) => (60 * acc) + +time, 0)),
                    event_type: dbAction,
                    event_time: finalEventTime
                }).eq('video_log_id', editingEvent.realId);
            }

            setEditingEvent(null);
            syncDeploymentState();
            fetchHistory();
        } catch (error) {
            console.error("Error saving event:", error);
            toast.error("Failed to save changes");
        }
    };

    const handleOpenEditTape = () => {
        const tape = jobTapes.find(t => t.tape_id === tapeId);
        if (tape) {
            setEditTapeNo(tape.tape_no || "");
            setEditTapeChapter(String(tape.chapter_no || ""));
            setEditTapeRemarks(tape.remarks || "");
            setEditTapeStatus(tape.status || "ACTIVE");
            setIsEditTapeOpen(true);
        }
    };

    const handleSaveTapeEdit = async () => {
        if (!tapeId) return;
        setIsCommitting(true);
        try {
            const { error } = await supabase.from('insp_video_tapes')
                .update({
                    tape_no: editTapeNo,
                    chapter_no: parseInt(editTapeChapter) || 1,
                    remarks: editTapeRemarks,
                    status: editTapeStatus
                })
                .eq('tape_id', tapeId);

            if (error) throw error;

            // Update local state
            setJobTapes(prev => prev.map(t => t.tape_id === tapeId ? {
                ...t,
                tape_no: editTapeNo,
                chapter_no: parseInt(editTapeChapter) || 1,
                remarks: editTapeRemarks,
                status: editTapeStatus
            } : t));
            
            setTapeNo(editTapeNo);
            setActiveChapter(parseInt(editTapeChapter) || 1);
            
            setIsEditTapeOpen(false);
            toast.success("Tape details updated successfully");
            
            // Refresh history to ensure tape numbers in table are updated
            fetchHistory();
        } catch (err: any) {
            console.error("Failed to update tape:", err);
            toast.error(`Update failed: ${err.message}`);
        } finally {
            setIsCommitting(false);
        }
    };

    // Calibration Required Spec Fetching
    useEffect(() => {
        if (!activeSpec || !activeDep?.id) {
            setRequiredSpec(null);
            setRequiredProps({});
            setRequiredRecordId(null);
            return;
        }

        const runCheck = async () => {
            const activeIt = allInspectionTypes.find(t => t.code === activeSpec || t.name === activeSpec);
            let reqCode: string | null = null;
            if (activeIt?.metadata && activeIt.metadata.Requires) {
                reqCode = activeIt.metadata.Requires;
            } else if (activeIt?.metadata && typeof activeIt.metadata === 'string') {
                try {
                    const parsed = JSON.parse(activeIt.metadata);
                    if (parsed.Requires) reqCode = parsed.Requires;
                } catch (e) { }
            }

            if (!reqCode) {
                setRequiredSpec(null);
                setRequiredProps({});
                setRequiredRecordId(null);
                return;
            }

            const reqIt = allInspectionTypes.find(t => t.code === reqCode);
            if (!reqIt) {
                setRequiredSpec(null);
                return;
            }
            setRequiredSpec(reqIt);

            // Fetch existing calibration record for current dive/rov job
            const jobCol = inspMethod === 'DIVING' ? 'dive_job_id' : 'rov_job_id';
            let calibQuery = supabase.from('insp_records')
                .select('*')
                .eq(jobCol, activeDep.id)
                .eq('inspection_type_code', reqCode);

            if (structureId && !isNaN(Number(structureId))) {
               calibQuery = calibQuery.eq('structure_id', Number(structureId));
            }
            if (headerData.sowReportNo && headerData.sowReportNo !== "N/A" && headerData.sowReportNo !== "Unknown Report") {
               calibQuery = calibQuery.eq('sow_report_no', headerData.sowReportNo);
            }

            const { data, error } = await calibQuery
                .order('insp_id', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (data && !error) {
                setRequiredProps(data.inspection_data || {});
                setRequiredRecordId(data.insp_id);
            } else {
                setRequiredProps({});
                setRequiredRecordId(null);
            }
        };
        runCheck();
    }, [activeSpec, activeDep?.id, allInspectionTypes, inspMethod, structureId, headerData.sowReportNo]);

    // Handle method switch overriding deps
    useEffect(() => {
        async function fetchDeps() {
            setIsFetchingDeps(true);
            setIsReadyForComps(false);
            // Clear current states when switching modes
            setDeployments([]);
            setActiveDep(null);
            setCurrentRecords([]);
            setVideoEvents([]);
            setJobTapes([]);
            setSelectedComp(null);
            setActiveSpec(null);
            setVidState("IDLE");
            setVidTimer(0);
            setTapeNo("");
            setTapeId(null);
            setCurrentMovement("Awaiting Deployment");
            setDiveStartTime(null);
            setDiveEndTime(null);
            setRequiredSpec(null);
            setRequiredProps({});
            setRequiredRecordId(null);

            if (!jobPackId) return;
            const table = inspMethod === "DIVING" ? 'insp_dive_jobs' : 'insp_rov_jobs';
            const queryJobPackId = isNaN(Number(jobPackId)) ? jobPackId : Number(jobPackId);

            console.log(`[fetchDeps] Starting fetch from ${table} | jobpack: ${queryJobPackId} | structure: ${structureId}`);

            // Use the primary key column for ordering (created_at / cr_date may not exist)
            const idCol = inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id';

            let query = supabase.from(table).select('*')
                .eq('jobpack_id', queryJobPackId)
                .order(idCol, { ascending: false });

            if (structureId && !isNaN(Number(structureId))) {
                query = query.eq('structure_id', Number(structureId));
            }

            // ADD SOW FILTERING (Flexible match for both Report No and SOW ID)
            if (headerData.sowReportNo && headerData.sowReportNo !== "N/A" && headerData.sowReportNo !== "Unknown Report") {
                if (sowIdFull) {
                    query = query.or(`sow_report_no.eq."${headerData.sowReportNo}",sow_report_no.eq."${sowIdFull}"`);
                } else {
                    query = query.eq('sow_report_no', headerData.sowReportNo);
                }
            }

            const { data, error } = await query;
            let results = data || [];
            if (error) {
                console.warn("[fetchDeps] Primary fetch error:", error.message);
                results = [];
            }

            // REMOVED BAD FALLBACK (that was cross-pollinating jobs)

            // DEEP FALLBACK: If still empty, check if any inspection records exist for this jobpack/structure/sow
            // This happens if the job records were deleted but the inspection records remain.
            if (results.length === 0) {
                console.log(`[fetchDeps] No job records found in ${table}. Checking insp_records...`);
                const targetColumn = inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id';

                let recQuery = supabase.from('insp_records')
                    .select(targetColumn)
                    .eq('jobpack_id', queryJobPackId)
                    .eq('structure_id', Number(structureId))
                    .not(targetColumn, 'is', null)
                    .limit(10);
                
                if (headerData.sowReportNo && headerData.sowReportNo !== "N/A" && headerData.sowReportNo !== "Unknown Report") {
                    recQuery = recQuery.eq('sow_report_no', headerData.sowReportNo);
                }

                const { data: recJobs } = await recQuery;

                if (recJobs && recJobs.length > 0) {
                    const uniqueJobIds = Array.from(new Set(recJobs.map((r: any) => r[targetColumn]).filter(id => id !== null)));
                    console.log("[fetchDeps] Discovered job IDs from records:", uniqueJobIds);

                    if (uniqueJobIds.length > 0) {
                        // Create virtual job objects
                        results = uniqueJobIds.map(jid => ({
                            [targetColumn]: jid,
                            dive_no: `JOB-${jid}`,
                            diver_name: "Legacy Records",
                            status: 'COMPLETED'
                        })) as any;
                    }
                }
            }

            if (results.length > 0) {
                console.log(`[fetchDeps] Mapping ${results.length} results from ${table}`);
                const mapped = results.map(d => {
                    // CRITICAL: Ensure we get the numeric ID for lookups
                    const rawId = d.dive_job_id || d.rov_job_id || d.id;
                    const idStr = String(rawId);

                    // jobNo: Prefer dive_no/deployment_no for display
                    const jNo = d.dive_no || d.deployment_no || d.rov_job_no || `JOB-${rawId}`;

                    // name: Prefer diver_name/rov_system for display
                    const dName = d.diver_name || d.rov_system || d.rov_operator || "Unnamed";

                    console.log(`[fetchDeps] Mapped: No=${jNo}, Name=${dName}, ID=${idStr}`);
                    return { id: idStr, jobNo: jNo, name: dName, raw: d };
                });
                setDeployments(mapped);

                // If we have a saved selection or just pick the first
                setActiveDep(mapped[0]);
                console.log(`[fetchDeps] Set active deployment to: ${mapped[0].jobNo} (ID: ${mapped[0].id})`);
            } else {
                console.warn("[fetchDeps] No deployment records found.");
                setDeployments([]);
                setActiveDep(null);
                setIsReadyForComps(true);
            }
            setIsFetchingDeps(false);
        }
        fetchDeps();
    }, [inspMethod, jobPackId, structureId, headerData.sowReportNo, supabase]);


    // Replacement: useQuery for SOW and Component Data
    const { data: sowAndComps, isLoading: isSowLoading } = useQuery({
        queryKey: ['sow-data', structureId, sowId, inspMethod],
        enabled: !!(sowId && structureId && !isNaN(Number(structureId)) && isReadyForComps),
        queryFn: async () => {
            if (!sowId || !structureId) return { assigned: [], unassigned: [], all: [] };

            // 1. Fetch ALL active components for this structure (Paginated to bypass 1000 hard limit)
            let allCompsDataRaw: any[] = [];
            let hasMore = true;
            let offset = 0;
            const pageSize = 1000;
            let compErr = null;

            while (hasMore) {
                const { data: pageData, error: pageErr } = await supabase.from('structure_components')
                    .select('*')
                    .eq('structure_id', parseInt(structureId))
                    .not('is_deleted', 'eq', true)
                    .range(offset, offset + pageSize - 1);

                if (pageErr) {
                    compErr = pageErr;
                    break;
                }

                if (pageData && pageData.length > 0) {
                    allCompsDataRaw = [...allCompsDataRaw, ...pageData];
                    offset += pageSize;
                    if (pageData.length < pageSize) {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
            }

            if (!allCompsDataRaw || compErr) return { assigned: [], unassigned: [], all: [] };

            // Further filter legacy 'del' flag from metadata
            const allCompsData = allCompsDataRaw.filter((c: any) => {
                if (c.is_deleted === true || c.is_deleted === 1) return false;
                if (c.metadata && (c.metadata.del === 1 || c.metadata.del === '1' || c.metadata.del === true)) return false;
                return true;
            });

            // 2. Fetch SOW items scoped strictly to this sowId AND report Number
            let allSowItems: any[] = [];
            let hasMoreSow = true;
            let offsetSow = 0;

            while (hasMoreSow) {
                let sowItemsQuery = supabase.from('u_sow_items')
                    .select('*, inspection_type:inspection_type_id!left(id, code, name, metadata)')
                    .eq('sow_id', sowId)
                    .range(offsetSow, offsetSow + pageSize - 1);
                    
                if (targetReportNumber) {
                    sowItemsQuery = sowItemsQuery.eq('report_number', targetReportNumber);
                }

                const { data: pageSowItems, error: sowItemsErr } = await sowItemsQuery;

                if (sowItemsErr) {
                    console.error("Error fetching SOW items:", sowItemsErr);
                    break;
                }

                if (pageSowItems && pageSowItems.length > 0) {
                    allSowItems = [...allSowItems, ...pageSowItems];
                    offsetSow += pageSize;
                    if (pageSowItems.length < pageSize) {
                        hasMoreSow = false;
                    }
                } else {
                    hasMoreSow = false;
                }
            }

            const sowItems = allSowItems;

            // 2.5 Fetch actual records for true dynamic status correction
            let recsQuery = supabase.from('insp_records')
                .select('component_id, inspection_type_code, status, cr_date')
                .eq('structure_id', Number(structureId));

            const { data: actualRecords } = await recsQuery.order('cr_date', { ascending: false });

            // Create truth-mask for component + task
            const trueStatusMap = new Map<string, string>();
            if (actualRecords) {
                actualRecords.forEach((r: any) => {
                    if (!r.component_id || !r.inspection_type_code) return;
                    const key = `${r.component_id}_${r.inspection_type_code}`;
                    // Array is newest first, so first encounter sets the final state
                    if (!trueStatusMap.has(key)) {
                        trueStatusMap.set(key, r.status?.toLowerCase() === 'incomplete' ? 'incomplete' : 'completed');
                    }
                });
            }

            const assignedCompsMap = new Map<number, { code: string; status: string }[]>();

            if (sowItems) {
                sowItems.forEach(item => {
                    // Match component by qid, id, or type — no method filter here
                    // (ROV/DIVING filter applies to task display, not component scope)
                    let matchingComp = null;
                    if (item.component_id) {
                        matchingComp = (allCompsData || []).find((c: any) => c.id === item.component_id);
                    }
                    if (!matchingComp && item.component_qid) {
                        matchingComp = (allCompsData || []).find((c: any) => c.q_id === item.component_qid);
                    }
                    if (!matchingComp && item.component_type && !item.component_qid && !item.component_id) {
                        matchingComp = (allCompsData || []).find((c: any) => c.code === item.component_type || c.name === item.component_type);
                    }

                    if (matchingComp) {
                        if (!assignedCompsMap.has(matchingComp.id)) {
                            assignedCompsMap.set(matchingComp.id, []);
                        }
                        const taskToLog = item.inspection_code || item.inspection_name;
                        if (taskToLog) {
                            const dynKey1 = `${matchingComp.id}_${item.inspection_code}`;
                            const dynKey2 = `${matchingComp.id}_${item.inspection_name}`;
                            const realStatus = trueStatusMap.get(dynKey1) || trueStatusMap.get(dynKey2) || 'pending';
                            assignedCompsMap.get(matchingComp.id)?.push({ code: taskToLog, status: realStatus });
                        }
                    } else {
                        console.log(`[CompQuery] No match for SOW item: qid=${item.component_qid} cid=${item.component_id} ctype=${item.component_type}`);
                    }
                });
            }

            const assigned: any[] = [];
            const unassigned: any[] = [];

            (allCompsData || []).forEach((comp: any) => {
                const isAssigned = assignedCompsMap.has(comp.id);
                const md = (typeof comp.metadata === 'string' ? JSON.parse(comp.metadata) : comp.metadata) || {};
                const startNode = md.start_node || md.f_node || md.Node_1 || comp.startNode || comp.start_node || '-';
                const endNode = md.end_node || md.s_node || md.Node_2 || comp.endNode || comp.end_node || '-';
                const startLeg = md.s_leg || md.start_leg || md.leg_1 || md.StartLeg || md.Leg_1 || comp.startLeg || comp.start_leg || '-';
                const endLeg = md.f_leg || md.end_leg || md.leg_2 || md.EndLeg || md.Leg_2 || comp.endLeg || comp.end_leg || '-';
                const startElev = md.start_elevation || md.elv_1 || comp.elevation1 || comp.start_elevation || '-';
                const endElev = md.end_elevation || md.elv_2 || comp.elevation2 || comp.end_elevation || '-';
                const nominalThk = md.nominal_thickness || md.NominalThickness || md.nominal_thk || comp.nominal_thickness || '-';
                const taskItems = assignedCompsMap.get(comp.id) || [];

                const elv1Num = parseFloat(String(startElev).replace(/[^\d.-]/g, ''));
                const elv2Num = parseFloat(String(endElev).replace(/[^\d.-]/g, ''));
                const hasElv1 = !isNaN(elv1Num);
                const hasElv2 = !isNaN(elv2Num);
                let displayDepth = comp.water_depth || '-0.0m';
                let lowestElev = '-';
                if (hasElv1 && hasElv2) {
                    lowestElev = String(Math.min(elv1Num, elv2Num));
                    displayDepth = `${lowestElev}m`;
                } else if (hasElv1) {
                    lowestElev = String(elv1Num);
                    displayDepth = `${elv1Num}m`;
                } else if (hasElv2) {
                    lowestElev = String(elv2Num);
                    displayDepth = `${elv2Num}m`;
                }

                const obj = {
                    id: comp.id,
                    name: comp.q_id || comp.name || `Node ${comp.id}`,
                    depth: displayDepth,
                    lowestElev,
                    startNode, endNode, startLeg, endLeg, startElev, endElev, nominalThk,
                    raw: comp,
                    tasks: Array.from(new Set(taskItems.map(t => t.code))),
                    taskStatuses: Array.from(new Map(taskItems.map(item => [item.code, item])).values())
                };

                if (isAssigned) assigned.push(obj);
                else unassigned.push(obj);
            });

            const combined = [...assigned, ...unassigned];
            return { assigned, unassigned, all: combined };
        },
        staleTime: 0,             // Always refetch when structure/sow changes
        refetchOnWindowFocus: false,
    });

    // Populate local states whenever query data resolves
    useEffect(() => {
        if (sowAndComps) {
            setComponentsSow(sowAndComps.assigned);
            setComponentsNonSow(sowAndComps.unassigned);
            setAllComps(sowAndComps.all);
        }
    }, [sowAndComps]);

    useEffect(() => {
        async function fetchInitialLists() {
            // Fetch Inspection Types
            const { data: typesData } = await supabase.from('inspection_type').select('*').order('name');
            if (typesData) {
                // Merge with JSON Registry
                const registryMap = new Map();
                const sharedFields = (inspectionRegistry as any).sharedFields || {};
                if (inspectionRegistry && inspectionRegistry.inspectionTypes) {
                    inspectionRegistry.inspectionTypes.forEach(it => {
                        const resolved = resolveInspectionType(it, sharedFields);
                        registryMap.set(resolved.code, resolved);
                    });
                }

                const mergedTypes = typesData.map(dbType => {
                    const registryEntry = registryMap.get(dbType.code);
                    if (registryEntry) {
                        return {
                            ...dbType,
                            default_properties: registryEntry // Store the whole registry entry (including fields, overrides)
                        };
                    }
                    return dbType;
                });

                const discardedCodes = ['PLATGI', 'LOGS', 'EXSUM', 'NAVIG'];
                setAllInspectionTypes(mergedTypes.filter(it => !discardedCodes.includes(it.code)));
            }

            // Fetch Anomaly Lists from Library
            const { data: codes } = await supabase.from('u_lib_list').select('lib_id, lib_desc').eq('lib_code', 'AMLY_COD').order('lib_desc');
            if (codes) setDefectCodes(codes);

            const { data: prios } = await supabase.from('u_lib_list').select('lib_id, lib_desc').eq('lib_code', 'AMLY_TYP').order('lib_desc');
            if (prios) setPriorities(prios);

            const { data: fnds } = await supabase.from('u_lib_list').select('lib_id, lib_desc').eq('lib_code', 'AMLY_FND').order('lib_desc');
            if (fnds) setAllDefectTypes(fnds);
        }
        fetchInitialLists();
    }, [supabase]);
    
    // Calculate current form fields (props) in a stable way for both logic and rendering
    const activeFormProps = useMemo(() => {
        if (!activeSpec || !allInspectionTypes.length) return [];

        const activeSpecClean = (activeSpec || '').trim();
        const activeIt = allInspectionTypes.find(t => (t.code || '').trim() === activeSpecClean) || 
                         allInspectionTypes.find(t => (t.name || '').trim() === activeSpecClean);
        
        if (!activeIt?.default_properties) return [];

        let props: any[] = [];
        let parsed: any = null;
        try {
            parsed = typeof activeIt.default_properties === 'string' ? JSON.parse(activeIt.default_properties) : activeIt.default_properties;
        } catch (e) { return []; }

        if (parsed) {
            const raw = selectedComp?.raw || {};
            const compTypeStr = String(raw.type || raw.code || raw.component_type || selectedComp?.type || '').toUpperCase().trim();
            
            // Resolve component specific overrides
            const matchingOverrides = parsed.component_overrides?.filter((ov: any) =>
                ov.component_types && Array.isArray(ov.component_types) && ov.component_types.includes(compTypeStr)
            ) || [];
            
            // Priority 1: Component Override Fields (if any)
            if (matchingOverrides.length > 0) {
                const lastMatch = matchingOverrides[matchingOverrides.length - 1];
                if (lastMatch.fields && Array.isArray(lastMatch.fields)) {
                    // Logic: If override provides fields, we use them. 
                    // To support "replace/hide", the override fields list is the source.
                    props = [...lastMatch.fields];
                } else {
                    props = parsed.fields || (Array.isArray(parsed) ? parsed : []);
                }
            } else {
                props = parsed.fields || (Array.isArray(parsed) ? parsed : []);
            }
        }

        // 1. Historical data preservation (Legacy Fields) - THE UNION STRATEGY
        if (editingRecordId) {
            const recordRow = currentRecords.find(r => r.insp_id === editingRecordId);
            if (recordRow && recordRow.inspection_data) {
                try {
                    const recordData = typeof recordRow.inspection_data === 'string' 
                        ? JSON.parse(recordRow.inspection_data) 
                        : recordRow.inspection_data;
                    
                    Object.keys(recordData).forEach(key => {
                        // Check if key or label (case insensitive) exists in current props
                        const exists = props.find((p: any) => 
                            (p.name && p.name.toLowerCase() === key.toLowerCase()) || 
                            (p.label && p.label.toLowerCase() === key.toLowerCase())
                        );

                        const ignoreKeys = [
                            'has_anomaly', 'anomalydata', 'defectcode', 'defectreferenceno', 
                            'northing', 'easting', 'elevation', 'kp', 'depth', 'fields', 
                            'inspno', 'strid', 'str_id', 'compid', 'comp_id', 'inspid', 
                            'insp_id', 'record_category', 'incomplete_reason', 'component_overrides',
                            'inspection_date', 'inspection_time', 'tape_count_no'
                        ];
                        const lowerKey = key.toLowerCase();
                        
                        // If field has data but isn't in current spec, inject it as Legacy
                        if (!exists && 
                            !ignoreKeys.includes(lowerKey) && 
                            !lowerKey.startsWith('_') && 
                            recordData[key] !== null && 
                            recordData[key] !== undefined &&
                            recordData[key] !== "" &&
                            recordData[key] !== "--" &&
                            typeof recordData[key] !== 'object') {
                            
                            const niceLabel = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                            props.push({ 
                                name: key, 
                                label: `${niceLabel}`, 
                                type: 'text',
                                isLegacy: true 
                            });
                        }
                    });
                } catch (e) {}
            }
        }

        // 2. Add technical fields (Northing, Easting) for ROV automatically if not present
        const rovKeywords = ['ROV', 'RUTWT', 'RGVI', 'RMG', 'RSCOR'];
        const isRovType = inspMethod === 'ROV' || 
            rovKeywords.some(kw => (activeIt?.code || '').includes(kw) || (activeIt?.name || '').toUpperCase().includes(kw)) ||
            activeIt?.metadata?.rov == 1;

        if (isRovType) {
            const existingNames = props.map((p: any) => String(p.name || p.label || '').toLowerCase());
            const extra = [];
            if (!existingNames.includes('northing')) extra.push({ name: 'northing', label: 'Northing', type: 'text' });
            if (!existingNames.includes('easting')) extra.push({ name: 'easting', label: 'Easting', type: 'text' });
            if (extra.length > 0) props = [...extra, ...props];
        }

        // 3. Filter legacy fields logic:
        // For new records, hide any field marked as isLegacy or having "(legacy)" in the label.
        // For existing records (editing), show legacy fields only if data exists in ANY historical record for this component.
        props = props.filter(p => {
            const isLegacy = p.isLegacy || (p.label || '').toLowerCase().includes('(legacy)');
            if (!isLegacy) return true;

            // If it is legacy, only show if we are in modification mode (editingRecordId set)
            // AND any historical record for this component has data for it.
            if (editingRecordId) {
                const hasDataInHistory = currentRecords.some(r => {
                    if (r.component_id !== selectedComp?.id) return false;
                    const recordData = typeof r.inspection_data === 'string' 
                        ? JSON.parse(r.inspection_data) 
                        : r.inspection_data;
                    const val = recordData?.[p.name] || recordData?.[p.label];
                    return val !== undefined && val !== null && String(val).trim() !== "" && val !== "--";
                });
                return hasDataInHistory;
            }
            return false;
        });

        return props;
    }, [activeSpec, selectedComp, allInspectionTypes, editingRecordId, currentRecords, inspMethod]);

    // Auto-fetch dynamic library options when inspection type or component changes
    useEffect(() => {
        async function fetchDynamicOptions() {
            if (!activeFormProps.length) return;

            // Recursive function to find all lib_codes in the field tree
            const extractCodes = (fields: any[]): string[] => {
                let codes: string[] = [];
                fields.forEach(f => {
                    if (f.lib_code) codes.push(f.lib_code);
                    if (f.subFields && Array.isArray(f.subFields)) {
                        codes = [...codes, ...extractCodes(f.subFields)];
                    }
                    if (f.fields && Array.isArray(f.fields)) { // Handle any other nested fields
                        codes = [...codes, ...extractCodes(f.fields)];
                    }
                });
                return codes;
            };

            const allCodes = extractCodes(activeFormProps);
            const libCodesToFetch = Array.from(new Set(
                allCodes.filter(c => !libOptionsMap[c])
            )) as string[];

            if (libCodesToFetch.length === 0) return;

            for (const code of libCodesToFetch) {
                const { data, error } = await supabase.from('u_lib_list')
                    .select('lib_id, lib_desc')
                    .ilike('lib_code', code.trim())
                    .order('lib_desc');

                if (data && data.length > 0) {
                    console.log(`[fetchDynamicOptions] Found ${data.length} records for ${code}`);
                    setLibOptionsMap(prev => ({ ...prev, [code]: data }));
                } else {
                    // Even if 0 records, set to empty array to avoid re-fetching
                    setLibOptionsMap(prev => ({ ...prev, [code]: [] }));
                    if (error) console.error(`[fetchDynamicOptions] Error for ${code}:`, error);
                }
            }
        }
        fetchDynamicOptions();
    }, [activeFormProps, supabase, libOptionsMap]);

    const diveActionsList = ((activeDep as any)?.raw?.dive_type?.toUpperCase() || "AIR").includes("BELL") || ((activeDep as any)?.raw?.dive_type?.toUpperCase() || "AIR").includes("SAT") ? BELL_DIVE_ACTIONS : AIR_DIVE_ACTIONS;




    const handleMovementLog = async (actionLabel: string) => {
        if (!activeDep?.id) return;

        // Find the database record value for the label
        // We save the exact label to avoid ambiguity when reading since multiple actions map to the same value in constants
        const dbValue = actionLabel;

        const mvtTable = inspMethod === "DIVING" ? 'insp_dive_movements' : 'insp_rov_movements';
        const mvtCol = inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id';
        const jobTable = inspMethod === "DIVING" ? 'insp_dive_jobs' : 'insp_rov_jobs';

        const payload: any = {
            [mvtCol]: activeDep.id,
            movement_time: new Date().toISOString(),
            movement_type: dbValue,
            remarks: ""
        };

        const { error } = await supabase.from(mvtTable).insert(payload);
        if (!error) {
            setCurrentMovement(actionLabel);
            if (actionLabel.toLowerCase().includes('left surface') || actionLabel.toLowerCase().includes('deployed') || actionLabel.toLowerCase().includes('launched')) setDiveStartTime(payload.movement_time);
            if (actionLabel.toLowerCase().includes('arrived surface') || actionLabel.toLowerCase().includes('recovered') || actionLabel.toLowerCase().includes('off hire')) setDiveEndTime(payload.movement_time);

            // Auto-complete deployment if final action
            if (["Arrived Surface", "TUP Complete", "Bell on Surface", "Recovered", "System on Deck", "Rov Off Hire"].includes(actionLabel)) {
                await supabase.from(jobTable).update({ status: "COMPLETED" }).eq(mvtCol, activeDep.id);
            }
        } else {
            console.error("Failed to insert movement log", error);
            alert("Failed to log movement: " + error.message);
        }
    };

    const handleMovementNext = () => {
        const nextIdx = currentMovement === 'Awaiting Deployment' ? 0 : diveActionsList.findIndex(a => a.label === currentMovement) + 1;
        if (nextIdx >= 0 && nextIdx < diveActionsList.length) {
            handleMovementLog(diveActionsList[nextIdx].label);
        }
    };
    const handleMovementPrev = async () => {
        if (!activeDep?.id || currentMovement === 'Awaiting Deployment') return;

        const mvtTable = inspMethod === "DIVING" ? 'insp_dive_movements' : 'insp_rov_movements';
        const mvtCol = inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id';

        const { data, error } = await supabase.from(mvtTable)
            .select('movement_id')
            .eq(mvtCol, activeDep.id)
            .order('movement_time', { ascending: false })
            .limit(1)
            .single();

        if (data && !error) {
            await supabase.from(mvtTable).delete().eq("movement_id", data.movement_id);
            syncDeploymentState(); // triggers refresh
        }
    };

    const getReportHeaderData = async () => {
        // Try to fetch from standard API first
        try {
            const response = await fetch("/api/company-settings");
            if (response.ok) {
                const { data } = await response.json();
                return {
                    companyName: data.company_name || "NasQuest Resources Sdn Bhd",
                    companyLogo: data.logo_url || "/logo.png",
                    departmentName: data.department_name || "Technical Inspection Division"
                };
            }
        } catch (error) {
            console.error("Error fetching company settings for report:", error);
        }

        // Fallback to absolute defaults if API fails
        const { data } = await supabase.from('attachment').select('*').eq('meta_type', 'COMPANY_PROFILE').limit(1).maybeSingle();
        return {
            companyName: data?.meta_name || "NasQuest Resources Sdn Bhd",
            companyLogo: data?.file_url || "/logo.png",
            departmentName: data?.meta?.departmentName || "Technical Inspection Division"
        };
    };

    const handleRegisterAnomaly = () => {
        if (!pendingRule) return;

        // Map IDs to Descriptions from the fetched library lists
        const codeDesc = defectCodes.find(c => c.lib_id === pendingRule.defectCodeId)?.lib_desc || pendingRule.defectCodeId;
        const typeDesc = allDefectTypes.find(t => t.lib_id === pendingRule.defectTypeId)?.lib_desc || pendingRule.defectTypeId;
        const prioDesc = priorities.find(p => p.lib_id === pendingRule.priorityId)?.lib_desc || pendingRule.priorityId;

        setFindingType('Anomaly');
        setAnomalyData(prev => ({
            ...prev,
            defectCode: codeDesc,
            defectType: typeDesc,
            priority: prioDesc,
            referenceNo: pendingRule.referenceNo || '',
            description: pendingRule.alertMessage || 'Automatically detected anomaly based on defect criteria.'
        }));
        setLastAutoMatchedRuleId(pendingRule.id);
        setShowCriteriaConfirm(false);
        setIsManualOverride(false);
        toast.info("Anomaly details auto-populated.");
    };

    const handleConfirmRemoval = () => {
        if (!editingRecordId) {
            // Draft mode - just reset
            setFindingType("Complete");
            setAnomalyData({
                defectCode: '', priority: '', defectType: '', description: '', recommendedAction: '',
                rectify: false, rectifiedDate: '', rectifiedRemarks: '', severity: 'Minor', referenceNo: ''
            });
            setLastAutoMatchedRuleId(null);
            setShowRemovalConfirm(false);
            return;
        }

        // Check if there are newer anomalies
        const recordRow = currentRecords.find(r => r.insp_id === editingRecordId);
        
        let hasNewerAnomalies = false;
        if (recordRow) {
            const currentRecTime = new Date(`${recordRow.inspection_date}T${recordRow.inspection_time}`).getTime();
            hasNewerAnomalies = currentRecords.some(r => {
                if (!r.has_anomaly || r.insp_id === editingRecordId) return false;
                const comparingRecTime = new Date(`${r.inspection_date}T${r.inspection_time}`).getTime();
                return comparingRecTime > currentRecTime;
            });
        }

        if (!hasNewerAnomalies) {
            // Rule 1: Delete/Remove (will happen on save if findingType is Complete)
            setFindingType("Complete");
            setAnomalyData({
                defectCode: '', priority: '', defectType: '', description: '', recommendedAction: '',
                rectify: false, rectifiedDate: '', rectifiedRemarks: '', severity: 'Minor', referenceNo: ''
            });
            toast.success("Anomaly will be removed upon saving (no subsequent anomalies found).");
        } else {
            // Rule 2: Rectify
            setFindingType("Anomaly");
            setAnomalyData(prev => ({
                ...prev,
                priority: 'NONE',
                rectify: true,
                rectifiedRemarks: "Automatically rectified: entered value no longer meets defect criteria. Priority set to NONE to preserve event numbering.",
                rectifiedDate: format(new Date(), 'yyyy-MM-dd')
            }));
            toast.info("Anomaly marked as Rectified (Priority NONE) to preserve sequence.");
        }
        setShowRemovalConfirm(false);
    };

    useEffect(() => {
        const runCheck = async () => {
            if (isManualOverride || !criteriaRules.length || !isUserInteraction || editingRecordId) return;

            const hasAnomaly = findingType === 'Anomaly';
            let bestMatchedRule: any = null;

            // 1. Evaluate all potential matches
            for (const rule of criteriaRules) {
                const fName = rule.fieldName || '*';
                const fNameClean = fName.toLowerCase().replace(/[^a-z0-9]/g, '');

                const ignoreFields = ['northing', 'easting', 'elevation', 'depth', 'kp', 'latitude', 'longitude', 'anode_type', 'anode_depletion', 'anode_type_list', 'anode_depletion_list', 'serial_no', 'remarks', 'reference_no'];

                const relevantFields = fName === '*'
                    ? Object.keys(debouncedProps).filter(k => {
                        if (ignoreFields.some(ign => k.toLowerCase().includes(ign))) return false;
                        return !isNaN(parseFloat(debouncedProps[k]));
                    })
                    : Object.keys(debouncedProps).filter(k => {
                        if (ignoreFields.some(ign => k.toLowerCase().includes(ign))) return false;
                        const kClean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                        return kClean === fNameClean || fNameClean.includes(kClean) || kClean.includes(fNameClean);
                    });

                for (const field of relevantFields) {
                    const rawVal = debouncedProps[field];
                    if (rawVal === undefined || rawVal === null || rawVal === '') continue;

                    let isMatch = false;
                    const val = parseFloat(rawVal);

                    if (rule.thresholdOperator && !isNaN(val)) {
                        const target = rule.thresholdValue || 0;
                        if (rule.thresholdOperator === '>') isMatch = val > target;
                        else if (rule.thresholdOperator === '<') isMatch = val < target;
                        else if (rule.thresholdOperator === '>=') isMatch = val >= target;
                        else if (rule.thresholdOperator === '<=') isMatch = val <= target;
                        else if (rule.thresholdOperator === '==') isMatch = val === target;
                        else if (rule.thresholdOperator === '!=') isMatch = val !== target;
                    } else if (rule.thresholdText) {
                        isMatch = String(rawVal).toLowerCase().includes(rule.thresholdText.toLowerCase());
                    }

                    if (isMatch) {
                        if (!bestMatchedRule || rule.evaluationPriority > bestMatchedRule.evaluationPriority) {
                            bestMatchedRule = rule;
                        }
                    }
                }
            }

            // 2. Decide what to do based on findings
            if (bestMatchedRule) {
                if (hasAnomaly) {
                    // Already an anomaly, check if it's the same rule
                    if (bestMatchedRule.id !== lastAutoMatchedRuleId) {
                        // Different rule, suggest update
                        setPendingRule(bestMatchedRule);
                        setShowCriteriaConfirm(true);
                    }
                } else {
                    // Suggest new anomaly
                    setPendingRule(bestMatchedRule);
                    setShowCriteriaConfirm(true);
                }
            } else {
                // No rules match. If we have an auto-detected anomaly, suggest removal
                if (hasAnomaly && lastAutoMatchedRuleId) {
                    setShowRemovalConfirm(true);
                }
            }
        };

        runCheck();
    }, [debouncedProps, selectedComp, activeSpec, criteriaRules, findingType, anomalyData.defectCode, lastAutoMatchedRuleId, isManualOverride, editingRecordId]);

    const handleCommitRecord = async () => {
        if (!selectedComp || !activeSpec || !activeDep?.id) return;

        // Block new inserts if video log is not active (Live Mode only)
        if (!editingRecordId && !manualOverride && vidState !== "RECORDING") {
            toast.error("Video log is currently STOPPED or PAUSED. New inspection events can only be added when a video log is active/recording in live mode.");
            return;
        }

        try {
            setIsCommitting(true);
            let tId = tapeId;
            let autoRefNo = "";
            if (!tId && activeDep?.id) {
                // Try to fetch existing active tape for this deployment
                const { data: existingTape } = await supabase.from('insp_video_tapes')
                    .select('tape_id')
                    .eq(inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id', Number(activeDep.id))
                    .order('tape_id', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (existingTape) {
                    tId = existingTape.tape_id;
                    setTapeId(tId);
                } else {
                    // Create one if none exists
                    const userRes = await supabase.auth.getUser();
                    const user = userRes.data.user;
                    let uniqueTapeNo = tapeNo;
                    if (!uniqueTapeNo) {
                        const base = headerData.sowReportNo || 'SOW_REPORT';
                        const platform = headerData.platformName || 'STRUCTURE';
                        const postfix = inspMethod === 'DIVING' ? 'D' : 'R';
                        let maxSeq = 0;
                        jobTapes.forEach(t => {
                            const match = t.tape_no.match(/V(\d{3})[DR]$/);
                            if (match) {
                                const seq = parseInt(match[1], 10);
                                if (seq > maxSeq) maxSeq = seq;
                            }
                        });
                        const nextSeq = String(maxSeq + 1).padStart(3, '0');
                        uniqueTapeNo = `${base} / ${platform} / V${nextSeq}${postfix}`;
                    }
                    const { data: newTape } = await supabase.from('insp_video_tapes').insert({
                        tape_no: uniqueTapeNo,
                        tape_type: "DIGITAL - PRIMARY",
                        chapter_no: 1,
                        status: 'ACTIVE',
                        [inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id']: Number(activeDep.id),
                        cr_user: user?.id || 'system'
                    }).select('tape_id').single();
                    if (newTape) {
                        tId = newTape.tape_id;
                        setTapeId(tId);
                    }
                }
            }

            const userRes = await supabase.auth.getUser();
            const user = userRes.data.user;

            const it = allInspectionTypes.find(t => t.name === activeSpec || t.code === activeSpec);

            // Capture latest data acquisition values
            const currentDataAcq: Record<string, any> = {};
            if (dataAcqConnected) {
                dataAcqFields.forEach(f => {
                    if (f.value && f.value !== '--' && f.targetField) {
                        currentDataAcq[f.targetField] = f.value;
                    }
                });
            }

            const activeProps = { ...dynamicProps, ...currentDataAcq };

            // Process Archived Data during Re-classification
            const newArchivedData = { ...archivedData };
            const currentFieldNames = new Set(activeFormProps.map((p: any) => p.name));

            if (activeFormProps.length > 0) {
                // 1. Move orphaned activeProps to archived pool
                // NOTE: We whitelist 'verification_depth' and its unit because they are hardcoded in the UI 
                // and should always be preserved in inspection_data even if not in the spec fields list.
                const whitelist = new Set(['verification_depth', 'verification_depth_unit']);
                
                Object.keys(activeProps).forEach(key => {
                    if (key.startsWith('_')) return; // Ignore metadata
                    if (!currentFieldNames.has(key) && !whitelist.has(key)) {
                        newArchivedData[key] = activeProps[key];
                        delete activeProps[key];
                    }
                });

                // 2. Restore any previously archived fields if they are now back in scope
                currentFieldNames.forEach((name: string) => {
                    if (newArchivedData[name] !== undefined) {
                        if (activeProps[name] === undefined || activeProps[name] === '') {
                             activeProps[name] = newArchivedData[name];
                        }
                        delete newArchivedData[name];
                    }
                });
            }

            const payload: any = {
                [inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id']: activeDep.id,
                structure_id: parseInt(structureId || "0"),
                component_id: selectedComp.id,
                component_type: selectedComp.raw?.code || selectedComp.raw?.metadata?.comp_type || selectedComp.raw?.metadata?.type || null,
                jobpack_id: jobPackId ? parseInt(jobPackId) : null,
                sow_report_no: headerData.sowReportNo || null,
                inspection_type_id: it?.id || null,
                inspection_type_code: it?.code || activeSpec,
                inspection_date: (activeProps.inspection_date && activeProps.inspection_date !== '--') ? String(activeProps.inspection_date) : format(new Date(), 'yyyy-MM-dd'),
                inspection_time: (() => {
                    const t = activeProps.inspection_time;
                    if (t && t !== '--') {
                        if (!isValidTimeFormat(String(t))) {
                            toast.error("Invalid Inspection Time format. Please use HH:mm:ss");
                            throw new Error("Invalid Time Format");
                        }
                        return String(t);
                    }
                    return format(new Date(), 'HH:mm:ss');
                })(),
                description: recordNotes,
                status: findingType === 'Incomplete' ? 'INCOMPLETE' : 'COMPLETED',
                has_anomaly: findingType === 'Anomaly' || findingType === 'Finding',
                tape_id: tId,
                tape_count_no: (() => {
                    const typedVal = (activeProps.tape_count_no !== undefined && activeProps.tape_count_no !== '--' && activeProps.tape_count_no !== null && activeProps.tape_count_no !== "") 
                        ? parseTimecode(String(activeProps.tape_count_no)) 
                        : null;
                    
                    if (manualOverride && typedVal === null) {
                        if (vidTimer > 0) {
                            // Fallback to active timer if manual entry is empty
                        } else {
                            toast.error("Manual Entry Mode: You must enter a valid Counter value (HH:mm:ss)");
                            throw new Error("Missing counter value in manual mode");
                        }
                    }

                    if (activeProps.tape_count_no && activeProps.tape_count_no !== '--' && !isValidTimeFormat(String(activeProps.tape_count_no))) {
                        toast.error("Invalid Counter format. Please use HH:mm:ss");
                        throw new Error("Invalid Counter Format");
                    }
                    
                    return typedVal !== null ? typedVal : vidTimer;
                })(),
                elevation: (() => {
                    const p = activeProps.verification_depth || activeProps.elevation;
                    if (p && p !== '--') {
                        const val = parseFloat(String(p).replace(/[^\d.-]/g, ''));
                        if (!isNaN(val)) return val;
                    }
                    return selectedComp.lowestElev && selectedComp.lowestElev !== '-' ? parseFloat(selectedComp.lowestElev) : 0;
                })(),
                fp_kp: (activeProps.fp_kp !== undefined && activeProps.fp_kp !== '--') ? String(activeProps.fp_kp) : null,
                inspection_data: {
                    ...activeProps,
                    _meta_timecode: formatTime(Number((activeProps.tape_count_no !== undefined && activeProps.tape_count_no !== '--' && activeProps.tape_count_no !== "") ? parseTimecode(String(activeProps.tape_count_no)) : vidTimer)),
                    _meta_status: findingType,
                    _mgi_profile_id: activeMGIProfile?.id || null,
                    incomplete_reason: findingType === 'Incomplete' ? incompleteReason : null
                },
                archived_data: newArchivedData
            };

            // Tape Counter Validation logic
            if (tId && payload.tape_count_no !== undefined && !manualOverride) {
                const count = Number(payload.tape_count_no);
                
                // Fetch ALL events for this tape to find valid recording segments
                const { data: tapeSessions } = await supabase.from('insp_video_logs')
                    .select('event_type, tape_counter_start')
                    .eq('tape_id', tId)
                    .order('event_time', { ascending: true });
                
                if (tapeSessions && tapeSessions.length > 0) {
                    let isValidRange = false;
                    let lastStart: number | null = null;
                    
                    for (const s of tapeSessions) {
                        if (s.event_type === 'NEW_LOG_START' || s.event_type === 'RESUME') {
                            lastStart = s.tape_counter_start || 0;
                        } else if (s.event_type === 'PAUSE' || s.event_type === 'END') {
                            if (lastStart !== null && count >= lastStart && count <= (s.tape_counter_start || 0)) {
                                isValidRange = true;
                                break;
                            }
                            lastStart = null;
                        }
                    }
                    
                    // If currently recording (last event was start/resume), check against the current vidTimer
                    if (!isValidRange && lastStart !== null && count >= lastStart && count <= vidTimer) {
                        isValidRange = true;
                    }
                    
                    if (!isValidRange) {
                        toast.error(`Invalid Tape Counter: ${count} is outside the recorded segments for this tape. Choose a value between recorded START and STOP/PAUSE events.`);
                        setIsCommitting(false);
                        return;
                    }
                }
            }

            // Set metadata based on operation type
            if (editingRecordId) {
                payload.insp_id = editingRecordId;
                payload.md_user = user?.id || 'system';
                // payload.md_date is auto-set by DB trigger
            } else {
                payload.cr_user = user?.id || 'system';
                // payload.cr_date is auto-set by DB default
            }

            // Commit Calibration/Required Record if needed
            if (requiredSpec && Object.keys(requiredProps).length > 0) {
                const reqPayload: any = {
                    [inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id']: activeDep.id,
                    structure_id: parseInt(structureId || "0"),
                    component_id: selectedComp.id,
                    component_type: selectedComp.raw?.code || selectedComp.raw?.metadata?.comp_type || selectedComp.raw?.metadata?.type || null,
                    jobpack_id: jobPackId ? parseInt(jobPackId) : null,
                    sow_report_no: headerData.sowReportNo || null,
                    inspection_type_id: requiredSpec.id,
                    inspection_type_code: requiredSpec.code,
                    inspection_date: payload.inspection_date,
                    inspection_time: payload.inspection_time,
                    status: 'COMPLETED',
                    has_anomaly: false,
                    tape_id: tId,
                    tape_count_no: payload.tape_count_no,
                    elevation: payload.elevation,
                    fp_kp: payload.fp_kp,
                    inspection_data: {
                        ...requiredProps,
                        _meta_timecode: formatTime(vidTimer),
                        _is_calibration: true
                    }
                };

                if (requiredRecordId) {
                    reqPayload.md_user = user?.id || 'system';
                    await supabase.from('insp_records').update(reqPayload).eq('insp_id', requiredRecordId);
                } else {
                    reqPayload.cr_user = user?.id || 'system';
                    const { data: newReqData } = await supabase.from('insp_records').insert(reqPayload).select('insp_id').single();
                    if (newReqData) setRequiredRecordId(newReqData.insp_id);
                }
            }

            // anomaly_details is handled separately in the insp_anomalies table

            const { data: opData, error: opError } = await (editingRecordId
                ? supabase.from('insp_records').update(payload).eq('insp_id', editingRecordId).select('*').single()
                : supabase.from('insp_records').insert(payload).select('*').single()
            );

            if (opError) throw opError;

            const newStatus = findingType === 'Incomplete' ? 'incomplete' : 'completed';
            
            // Robust SOW Status Synchronization
            if (sowId) {
                // 1. Sync the CURRENT component/task with elevation support
                await syncSowStatus(selectedComp.id, it?.code || activeSpec, payload.elevation, payload.status);

                // 2. Sync the ORIGINAL component/task if it was changed (Rollback)
                if (editingRecordId && originalRecordContext) {
                    const compChanged = originalRecordContext.component_id !== selectedComp.id;
                    const taskChanged = originalRecordContext.inspection_type_code !== (it?.code || activeSpec);
                    
                    if (compChanged || taskChanged) {
                        await syncSowStatus(originalRecordContext.component_id, originalRecordContext.inspection_type_code);
                    }
                }
            }

            if (findingType === 'Anomaly' || findingType === 'Finding') {
                const isAnomaly = findingType === 'Anomaly';
                const category = isAnomaly ? 'ANOMALY' : 'FINDING';
                const prefix = isAnomaly ? 'A' : 'F';

                const { data: existingAnomaly } = await supabase.from('insp_anomalies')
                    .select('anomaly_id, anomaly_ref_no, sequence_no')
                    .eq('inspection_id', opData.insp_id)
                    .maybeSingle();

                let finalSeq = existingAnomaly?.sequence_no || 0;

                if (!existingAnomaly) {
                    // Calculate sequence directly in JS since the DB column might be missing
                    const { data: allAnoms } = await supabase
                        .from('insp_anomalies')
                        .select('sequence_no, anomaly_ref_no, insp_records!inner(structure_id, jobpack_id, sow_report_no)')
                        .eq('insp_records.structure_id', parseInt(structureId || "0"))
                        .eq('insp_records.jobpack_id', parseInt(jobPackId || "0"))
                        .eq('insp_records.sow_report_no', headerData.sowReportNo);
                        
                    let vMaxSeq = 0;
                    if (allAnoms) {
                        for (const a of allAnoms) {
                            const refCategory = a.anomaly_ref_no?.includes(' / A-') ? 'ANOMALY' : 'FINDING';
                            if (refCategory === category && a.sequence_no > vMaxSeq) {
                                vMaxSeq = a.sequence_no;
                            }
                        }
                    }
                    const seq = vMaxSeq + 1;
                    finalSeq = seq;
                    
                    const baseRef = `${new Date().getFullYear()} / ${headerData.platformName} / ${prefix}-${seq.toString().padStart(3, '0')}`;
                    if (anomalyData.rectify) {
                        autoRefNo = baseRef + "R";
                    } else {
                        autoRefNo = baseRef;
                    }
                } else {
                    // Postfix logic for amendment/rectification
                    let baseRef = (existingAnomaly.anomaly_ref_no || "").replace(/[AR]$/, "");
                    if (anomalyData.rectify) {
                        autoRefNo = baseRef + "R";
                    } else {
                        autoRefNo = baseRef + "A";
                    }
                }

                // If anomalyData was empty on state but got generated now, we might want to update it
                if (!anomalyData.referenceNo) {
                    setAnomalyData(prev => ({ ...prev, referenceNo: autoRefNo }));
                }

                const anomalyPayload: any = {
                    inspection_id: opData.insp_id,
                    defect_type_code: anomalyData.defectCode,
                    priority_code: anomalyData.priority,
                    defect_category_code: anomalyData.defectType,
                    status: anomalyData.rectify ? 'CLOSED' : 'OPEN',
                    defect_description: anomalyData.description,
                    recommended_action: anomalyData.recommendedAction,
                    rectified_date: anomalyData.rectify ? (anomalyData.rectifiedDate || new Date().toISOString()) : null,
                    rectified_remarks: anomalyData.rectify ? anomalyData.rectifiedRemarks : null,
                    severity: (anomalyData.severity || 'MINOR').toUpperCase(),
                    anomaly_ref_no: autoRefNo,
                    sequence_no: finalSeq,
                    record_category: category
                };

                let anomalyErr = null;
                if (existingAnomaly) {
                    const { error } = await supabase.from('insp_anomalies').update(anomalyPayload).eq('anomaly_id', existingAnomaly.anomaly_id);
                    anomalyErr = error;
                } else {
                    const { error } = await supabase.from('insp_anomalies').insert(anomalyPayload);
                    anomalyErr = error;
                }

                if (anomalyErr) {
                    console.error("Anomaly Save Error:", anomalyErr);
                    toast.error(`Warning: Inspection saved, but failed to link ${category}! (${anomalyErr.message || 'Check DB schema'})`, { duration: 6000 });
                } else {
                    toast.success(`Record and ${category} saved successfully!`);

            // Invalidate React Query cache for SOW and Events
            queryClient.invalidateQueries({ queryKey: ['sow-data'] });
            queryClient.invalidateQueries({ queryKey: ['inspection-events'] });
                }
            } else {
                // If it was an anomaly/finding but now changed to Complete/Incomplete, remove the record
                await supabase.from('insp_anomalies').delete().eq('inspection_id', opData.insp_id);
            }

            if (editingRecordId) {
                await supabase.from('insp_video_logs').update({
                    timecode_start: formatTime(vidTimer),
                    tape_counter_start: vidTimer,
                    tape_id: tId
                }).eq('inspection_id', editingRecordId);
            } else {
                await supabase.from('insp_video_logs').insert({
                    inspection_id: opData.insp_id,
                    event_type: `${it?.name || activeSpec} - ${selectedComp.q_id || selectedComp.name}`,
                    event_time: new Date().toISOString(),
                    timecode_start: formatTime(vidTimer),
                    tape_counter_start: vidTimer,
                    tape_id: tId
                });
            }

            // Process Attachments (Upload to Storage & Create attachment entries)
            if (pendingAttachments.length > 0) {
                console.log("Processing attachments for insp_id:", opData.insp_id);
                for (const att of pendingAttachments) {
                    try {
                        // If already exists, we only update metadata if it might have changed
                        if (att.isExisting) {
                            await supabase.from('attachment').update({
                                name: att.title || att.name,
                                meta: {
                                    ...att.meta,
                                    description: att.description
                                }
                            }).eq('id', att.id);
                            continue;
                        }

                        const fileExt = att.name.split('.').pop();
                        const filePath = `${opData.insp_id}/${att.id}.${fileExt}`;

                        // Use generated refNo in title if still Draft/Pending
                        let finalTitle = att.title || att.name;
                        if (autoRefNo && (finalTitle.includes('Draft') || finalTitle.includes('Pending'))) {
                            finalTitle = finalTitle.replace('Draft', autoRefNo).replace('Pending', autoRefNo);
                        }
                        
                        // Upload to Storage
                        if (!att.file) {
                            console.warn("Skipping upload: No file blob for", att.name);
                            continue;
                        }

                        const { error: uploadError } = await supabase.storage
                            .from('attachments')
                            .upload(filePath, att.file, {
                                contentType: (att.file as any).type || undefined,
                                upsert: true
                            });

                        if (uploadError) {
                            console.error("Media Storage Upload Error:", uploadError);
                            toast.error(`Failed to upload ${att.name}: ${uploadError.message}`);
                            continue;
                        }

                        // Insert Metadata to 'attachment' table
                        const { error: mediaErr } = await supabase.from('attachment').insert({
                            name: finalTitle,
                            source_id: opData.insp_id,
                            source_type: 'INSPECTION',
                            path: filePath,
                            user_id: user?.id,
                            meta: {
                                type: att.type,
                                size: (att.file as File).size,
                                mime: (att.file as File).type || null,
                                description: att.description
                            }
                        });

                        if (mediaErr) {
                            console.error("Media DB Insert Error:", mediaErr);
                            toast.error(`Attachment metadata failed for ${att.name}: ${mediaErr.message}`);
                        }
                    } catch (err: any) {
                        console.error("Attachment processing exception:", err);
                        toast.error(`Unexpected error with attachment ${att.name}`);
                    }
                }
            }

            syncDeploymentState();
            fetchHistory();

            // Optimistic UI update: refresh task status on component list & scope cards
            const taskCode = it?.code || activeSpec;
            const uiStatus = findingType === 'Incomplete' ? 'incomplete' : 'completed';
            setComponentsSow(prev => prev.map(comp => {
                if (comp.id === selectedComp.id) {
                    const updatedComp = {
                        ...comp,
                        taskStatuses: comp.taskStatuses.map((ts: any) => {
                            if (ts.code === taskCode) {
                                return { ...ts, status: uiStatus };
                            }
                            return ts;
                        })
                    };
                    // Also update selectedComp reference so scope cards re-render
                    setSelectedComp(updatedComp);
                    return updatedComp;
                }
                return comp;
            }));

            resetForm();
            setPendingAttachments([]); // Clear attachments
            toast.success(editingRecordId ? "Record updated" : "Record committed");
        } catch (err: any) {
            console.error("HandleCommitRecord Error:", err);
            toast.error(`Error saving record: ${err.message || 'Unknown error'}`);
        } finally {
            setIsCommitting(false);
        }
    };



    const handleEditRecord = async (record: any) => {
        let fullRecord = record;
        const recordId = record.insp_id || record.id;
        
        // Fetch full record if missing essential data or if joined anomalies might be missing
        // Especially important if has_anomaly is TRUE but anomalies didn't load in history/list
        if (!record.inspection_data || !record.component_id || !record.inspection_type || 
           (record.has_anomaly && (!record.insp_anomalies || record.insp_anomalies.length === 0))) {
            const { data, error } = await supabase.from('insp_records')
                .select('*, inspection_type(id, code, name), insp_anomalies(*)')
                .eq('insp_id', recordId)
                .maybeSingle();
                
            if (data) {
                fullRecord = data;
            } else if (error) {
                console.error("Error fetching record for edit:", error);
                toast.error("Could not load full record details");
            }
        }

        const comp = componentsSow.find(c => c.id === fullRecord.component_id) || componentsNonSow.find(c => c.id === fullRecord.component_id);
        if (comp) {
            setSelectedComp(comp);
        } else {
            // Fallback: If component is not in current sidebar list, create a minimal object from record metadata
            // to ensure component_overrides (e.g. Anode fields) still work based on component_type
            setSelectedComp({
                id: fullRecord.component_id,
                name: fullRecord.component_name || `Component ${fullRecord.component_id}`,
                type: fullRecord.component_type,
                raw: { 
                    type: fullRecord.component_type,
                    code: fullRecord.component_type
                }
            });
        }

        // Map data from DB to UI state - USE CODE FIRST to avoid name ambiguity (e.g. GVI vs RGVI)
        setActiveSpec(fullRecord.inspection_type?.code || fullRecord.inspection_type_code || fullRecord.inspection_type?.name);
        setEditingRecordId(fullRecord.insp_id || fullRecord.id);
        setRecordNotes(fullRecord.description || fullRecord.observation || ""); // Handles inconsistency in column names
        
        const initialProps = { ...(fullRecord.inspection_data || {}) };
        if (fullRecord.tape_count_no !== undefined && fullRecord.tape_count_no !== null) {
            initialProps.tape_count_no = formatTime(Number(fullRecord.tape_count_no));
        }
        if (fullRecord.inspection_date) initialProps.inspection_date = fullRecord.inspection_date;
        if (fullRecord.inspection_time) initialProps.inspection_time = fullRecord.inspection_time;
        setDynamicProps(initialProps);
        // Save Context for Re-classification feature
        setOriginalRecordContext({
            component_id: fullRecord.component_id,
            inspection_type_id: fullRecord.inspection_type_id,
            inspection_type_code: fullRecord.inspection_type?.code || fullRecord.inspection_type_code,
            sow_report_no: fullRecord.sow_report_no
        });
        setArchivedData(fullRecord.archived_data || {});

        // Explicitly load elevation if missing in inspection_data but present in column
        if (fullRecord.elevation !== undefined && fullRecord.elevation !== null && !initialProps.verification_depth) {
            initialProps.verification_depth = String(fullRecord.elevation);
        }

        // Do not set debounced props immediately to avoid triggering validation without user interaction
        setDebouncedProps(initialProps);
        setIsUserInteraction(false); 
        setLastAutoMatchedRuleId(null); 
        setPendingRule(null);
        setShowCriteriaConfirm(false);
        setShowRemovalConfirm(false);

        // Fetch existing attachments
        const { data: atts } = await supabase.from('attachment')
            .select('*')
            .eq('source_id', recordId)
            .eq('source_type', 'INSPECTION');

        if (atts && atts.length > 0) {
            const mapped = atts.map(a => {
                const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(a.path);
                return {
                    id: a.id,
                    name: a.name,
                    title: a.name,
                    description: a.meta?.description || '',
                    type: a.meta?.type || 'PHOTO',
                    source: a.source_type,
                    previewUrl: publicUrl,
                    path: a.path,
                    meta: a.meta || {},
                    isExisting: true
                };
            });
            setPendingAttachments(mapped);
        } else {
            setPendingAttachments([]);
        }
        
        // Resolve anomaly details from join or fallback
        const anomalyObj = fullRecord.insp_anomalies?.[0] || fullRecord.anomaly_details;
        
        // Determine finding type (Handling both record flags and anomaly categories)
        const isFinding = anomalyObj?.record_category === 'FINDING' || fullRecord.inspection_data?._meta_status === 'Finding';
        setFindingType(fullRecord.has_anomaly ? (isFinding ? "Finding" : "Anomaly") : (fullRecord.status === 'INCOMPLETE' ? "Incomplete" : "Complete"));
        
        setIncompleteReason(fullRecord.inspection_data?.incomplete_reason || "");

        if (fullRecord.has_anomaly && anomalyObj) {
            setAnomalyData({
                defectCode: anomalyObj.defect_type_code || anomalyObj.defect_code || "",
                priority: anomalyObj.priority_code || anomalyObj.priority || "",
                defectType: anomalyObj.defect_category_code || anomalyObj.defect_type || "",
                description: anomalyObj.defect_description || anomalyObj.description || "",
                recommendedAction: anomalyObj.recommended_action || "",
                rectify: anomalyObj.status === 'CLOSED' || anomalyObj.rectified || false,
                rectifiedDate: anomalyObj.rectified_date || "",
                rectifiedRemarks: anomalyObj.rectified_remarks || "",
                severity: (anomalyObj.severity || "MINOR").toUpperCase(), 
                referenceNo: anomalyObj.anomaly_ref_no || "" 
            });
        }

        setTimeout(() => {
            const formArea = document.getElementById(FORM_AREA_ID);
            if (formArea) formArea.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handlePrintAnomaly = async (record: any) => {
        setPreviewRecord(record);
        setPreviewOpen(true);
    };

    const handleAddNewInspectionSpec = async (typeIdStr: string) => {
        if (!typeIdStr) return;

        if (!selectedComp || !activeDep?.id) {
            return;
        }

        const it = allInspectionTypes.find(t => t.id.toString() === typeIdStr);
        if (!it) {
            return;
        }

        const specName = it.code || it.name;
        const userId = (await supabase.auth.getUser()).data.user?.id || 'system';

        let targetSowId = sowId && !isNaN(parseInt(sowId)) ? parseInt(sowId) : null;
        let sowReportNo = headerData.sowReportNo;

        // If no strict sowId is passed or valid, refer to u_sow table based on jobpack and structure
        if (!targetSowId && jobPackId && structureId) {
            const { data: existingSow } = await supabase.from('u_sow')
                .select('id, report_number')
                .eq('jobpack_id', Number(jobPackId))
                .eq('structure_id', Number(structureId))
                .limit(1)
                .maybeSingle();

            if (existingSow) {
                targetSowId = existingSow.id;
                if (!sowReportNo) sowReportNo = existingSow.report_number;
            } else {
                const { data: newSow, error: newSowError } = await supabase.from('u_sow').insert({
                    jobpack_id: Number(jobPackId),
                    structure_id: Number(structureId),
                    structure_type: headerData.structureType === 'pipeline' ? 'PIPELINE' : 'PLATFORM',
                    structure_title: headerData.platformName,
                    report_number: sowReportNo || `SOW-${new Date().getFullYear()}`,
                    total_items: 0,
                    completed_items: 0,
                    incomplete_items: 0,
                    pending_items: 0,
                    status: 'pending',
                    created_by: userId
                }).select('id').single();

                if (newSow) {
                    targetSowId = newSow.id;
                } else {
                    console.error("Failed to auto-create u_sow entry:", newSowError);
                    toast.error("Could not link or create SOW index record.");
                    return;
                }
            }
        }

        if (!targetSowId) {
            toast.error("Error: Could not determine active SOW.");
            return;
        }

        // Check if combination already exists
        const { data: existingItem } = await supabase.from('u_sow_items')
            .select('id')
            .eq('sow_id', targetSowId)
            .eq('component_id', selectedComp.id)
            .eq('inspection_type_id', it.id)
            .eq('report_number', sowReportNo)
            .maybeSingle();

        let error = null;
        if (!existingItem) {
            const { error: insertError } = await supabase.from('u_sow_items').insert({
                sow_id: targetSowId,
                component_id: selectedComp.id,
                component_qid: selectedComp.name || selectedComp.q_id || selectedComp.raw?.name || null,
                component_type: selectedComp.raw?.type || null,
                inspection_type_id: it.id,
                status: 'pending',
                report_number: sowReportNo,
                inspection_code: it.code,
                inspection_name: it.name,
                elevation_required: false,
                created_by: userId
            });
            error = insertError;
        }

        if (!error && !existingItem) {
            // Keep totals synchronized (only for NEW items)
            const { data: sowData } = await supabase.from('u_sow')
                .select('total_items, pending_items, report_numbers')
                .eq('id', targetSowId)
                .maybeSingle();

            if (sowData) {
                const currentReports = sowData.report_numbers || [];
                const hasReport = currentReports.some((r: any) => r.number === sowReportNo);

                const updatePayload: any = {
                    total_items: (sowData.total_items || 0) + 1,
                    pending_items: (sowData.pending_items || 0) + 1,
                    updated_by: userId,
                    updated_at: new Date().toISOString()
                };

                if (!hasReport && sowReportNo && sowReportNo !== 'N/A') {
                    updatePayload.report_numbers = [
                        ...currentReports,
                        { 
                            number: sowReportNo, 
                            job_type: headerData.jobType || 'Unassigned',
                            date: new Date().toISOString()
                        }
                    ];
                }

                await supabase.from('u_sow').update(updatePayload).eq('id', targetSowId);
            }

            // Sync to Jobpack Metadata to ensure badges show up in modify screen
            const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
            if (jobPack) {
                const metadata = jobPack.metadata || {};
                const inspections = metadata.inspections || {};
                const structType = headerData.structureType === 'pipeline' ? 'PIPELINE' : 'PLATFORM';
                const key = `${structType}-${structureId}`;
                
                const currentList = inspections[key] || [];
                if (!currentList.some((item: any) => item.code === it.code)) {
                    inspections[key] = [...currentList, { id: it.id, code: it.code, name: it.name, metadata: it.metadata }];
                    
                    // Ensure structure is also in the list
                    const structures = metadata.structures || [];
                    if (!structures.some((s: any) => s.id == structureId && s.type === structType)) {
                        structures.push({ id: Number(structureId), type: structType, title: headerData.platformName });
                    }

                    await supabase.from('jobpack').update({
                        metadata: { ...metadata, inspections, structures }
                    }).eq('id', Number(jobPackId));
                }
            }
        }

        if (!error) {
            const specName = it.code || it.name;
            const currentTasks = selectedComp.tasks || [];
            
            if (currentTasks.includes(specName)) {
                toast.info(`The inspection type ${it.name} is already in the UI scope.`);
                return;
            }

            const newTaskStatus = { code: specName, status: 'pending' };
            const newTasks = [...currentTasks, specName];
            const newStatuses = [...(selectedComp.taskStatuses || []), newTaskStatus];

            // Optimistically update the main component lists (SOW vs Non-SOW)
            const updatedComp = { ...selectedComp, tasks: newTasks, taskStatuses: newStatuses };
            
            setComponentsSow(prev => {
                const isAlreadyInSow = prev.some(comp => comp.id === selectedComp.id);
                if (isAlreadyInSow) {
                    return prev.map(comp => comp.id === selectedComp.id ? updatedComp : comp);
                } else {
                    return [...prev, updatedComp];
                }
            });

            setComponentsNonSow(prev => prev.filter(comp => comp.id !== selectedComp.id));
            setAllComps(prev => prev.map(comp => comp.id === selectedComp.id ? updatedComp : comp));
            setSelectedComp(updatedComp);

            toast.success(`Successfully added ${it.name} to scope!`);
            
            // CRITICAL: Refresh the component list to show the new scope
            queryClient.invalidateQueries({ queryKey: ['sow-data'] });
        } else {
            console.error("Failed to insert u_sow_item:", error.message, error.details, error.hint, error);
            toast.error("Failed to add inspection type: " + (error.message || error.details || JSON.stringify(error)));
        }
    };

    const handleDeleteInspectionSpec = async (specCode: string) => {
        if (!specCode || !selectedComp) return;

        try {
            // 1. Database-level check: ensure no records exist for this component and inspection type across ALL scopes
            const { data: existingRecords, error: recordError } = await supabase
                .from('insp_records')
                .select('insp_id')
                .eq('component_id', Number(selectedComp.id))
                .or(`inspection_type_code.eq.${specCode},inspection_type_code.eq.${specCode.toUpperCase()}`)
                .limit(1);

            if (recordError) {
                toast.error("Error verifying inspection data integrity.");
                return;
            }

            if (existingRecords && existingRecords.length > 0) {
                toast.error(`Cannot delete ${specCode} because inspection data exists.`);
                return;
            }

            // 2. Resolve active SOW entry
            let targetSowId = sowId && !isNaN(parseInt(sowId)) ? parseInt(sowId) : null;
            if (!targetSowId && jobPackId && structureId) {
                const { data: existingSow } = await supabase.from('u_sow')
                    .select('id')
                    .eq('jobpack_id', Number(jobPackId))
                    .eq('structure_id', Number(structureId))
                    .limit(1)
                    .maybeSingle();

                if (existingSow) targetSowId = existingSow.id;
            }

            if (!targetSowId) {
                toast.error("Error determining active SOW.");
                return;
            }

            // 3. Delete from u_sow_items
            const { error: deleteError } = await supabase
                .from('u_sow_items')
                .delete()
                .eq('sow_id', targetSowId)
                .eq('component_id', selectedComp.id)
                .or(`inspection_code.eq.${specCode},inspection_code.eq.${specCode.toUpperCase()}`);

            if (deleteError) {
                console.error("Failed to delete u_sow_item:", deleteError);
                toast.error("Failed to delete from SOW items.");
                return;
            }

            // 4. Decrement u_sow counters (total_items, pending_items)
            const { data: sowData } = await supabase.from('u_sow')
                .select('total_items, pending_items')
                .eq('id', targetSowId)
                .maybeSingle();

            if (sowData) {
                const updatePayload: any = {
                    total_items: Math.max(0, (sowData.total_items || 0) - 1),
                    pending_items: Math.max(0, (sowData.pending_items || 0) - 1),
                    updated_by: (await supabase.auth.getUser()).data.user?.id || 'system',
                    updated_at: new Date().toISOString()
                };
                await supabase.from('u_sow').update(updatePayload).eq('id', targetSowId);
            }

            // 5. Update local component state
            const newTasks = (selectedComp.tasks || []).filter((t: string) => t !== specCode);
            const newStatuses = (selectedComp.taskStatuses || []).filter((ts: any) => ts.code !== specCode);

            const updatedComp = { ...selectedComp, tasks: newTasks, taskStatuses: newStatuses };
            
            setComponentsSow(prev => prev.map(comp => comp.id === selectedComp.id ? updatedComp : comp));
            setAllComps(prev => prev.map(comp => comp.id === selectedComp.id ? updatedComp : comp));
            setSelectedComp(updatedComp);

            toast.success(`Successfully removed ${specCode} from scope.`);
            queryClient.invalidateQueries({ queryKey: ['sow-data'] });

        } catch (err) {
            console.error("Error executing scope deletion:", err);
            toast.error("An error occurred while deleting the inspection type.");
        }
    };

    const handleToggleStreamRecording = () => {
        if (isStreamRecording) {
            handleStopStreamRecording();
        } else {
            handleStartStreamRecording();
        }
    };

    const renderStreamUI = () => (
        <VideoInterface
            onPopOut={handlePopOutStream}
            onStopStream={() => setStreamActive(false)}
            pipActive={!!pipWindow}
            onCapturePhoto={handleGrabPhoto}
            onStartRecording={handleStartStreamRecording}
            vidState={vidState}
            vidTimer={vidTimer}
            tapeNo={tapeNo}
            videoVisible={videoVisible}
            setVideoVisible={setVideoVisible}
            streamActive={streamActive}
            setStreamActive={setStreamActive}
            isStreamRecording={isStreamRecording}
            isStreamPaused={isStreamPaused}
            previewStream={previewStream}
            videoRef={videoRef}
            canvasRef={canvasRef}
            onPauseRecording={handlePauseStreamRecording}
            onResumeRecording={handleResumeStreamRecording}
            onStopRecording={handleStopStreamRecording}
            onToggleRecording={handleToggleStreamRecording}
            formatTime={formatTime}
            showDrawingTools={showDrawingTools}
            setShowDrawingTools={setShowDrawingTools}
        />
    );

    return (
        <div className="flex flex-col h-[calc(100vh)] bg-slate-100 dark:bg-slate-950 font-sans text-slate-900 overflow-hidden">
            {/* HELPER FOR REPORT GENERATION (MATCHING REPORT WIZARD) */}
            {(() => {
                const resolveVessel = (jobPack: any) => {
                    if (!jobPack?.metadata) return "N/A";
                    const history = jobPack.metadata.vessel_history;
                    if (Array.isArray(history) && history.length > 0) {
                        return history.map((v: any) => v.name || v).join(", ");
                    }
                    return jobPack.metadata.vessel || "N/A";
                };

                return null;
            })()}
            <ReportPreviewDialog 
                open={rrisiPreviewOpen} 
                onOpenChange={setRrisiPreviewOpen} 
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

                    const riserRecords = (allRecords || []).filter(r => 
                        ((r.inspection_type?.code || '').toUpperCase() === 'RRISI' || (r.inspection_type?.code || '').toUpperCase() === 'RSI') && 
                        (r.structure_components?.q_id || '').toUpperCase().startsWith('R')
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

                    const resolveVessel = (jp: any) => {
                        if (!jp?.metadata) return "N/A";
                        const history = jp.metadata.vessel_history;
                        if (Array.isArray(history) && history.length > 0) {
                            return history.map((v: any) => v.name || v).join(", ");
                        }
                        return jp.metadata.vessel || "N/A";
                    };

                    return await generateROVRRISIReport(
                        riserRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
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
                            preparedBy: { name: "Inspector", date: format(new Date(), 'dd MMM yyyy') },
                            returnBlob: true,
                            printFriendly: isPrintFriendly,
                            reportType: 'R',
                            showSignatures
                        }
                    );
                }}
                title="ROV Riser Survey Report"
                fileName={`ROV_Riser_Survey_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}`}
            />

            <ReportPreviewDialog 
                open={jtisiPreviewOpen} 
                onOpenChange={setJtisiPreviewOpen} 
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

                    const jtisiRecords = (allRecords || []).filter(r => 
                        ((r.inspection_type?.code || '').toUpperCase() === 'RRISI' || (r.inspection_type?.code || '').toUpperCase() === 'RSI') && 
                        (r.structure_components?.q_id || '').toUpperCase().startsWith('J')
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

                    const resolveVessel = (jp: any) => {
                        if (!jp?.metadata) return "N/A";
                        const history = jp.metadata.vessel_history;
                        if (Array.isArray(history) && history.length > 0) {
                            return history.map((v: any) => v.name || v).join(", ");
                        }
                        return jp.metadata.vessel || "N/A";
                    };

                    return await generateROVRRISIReport(
                        jtisiRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
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
                            preparedBy: { name: "Inspector", date: format(new Date(), 'dd MMM yyyy') },
                            returnBlob: true,
                            printFriendly: isPrintFriendly,
                            reportType: 'J',
                            showSignatures
                        }
                    );
                }}
                title="ROV J-Tube Inspection Report"
                fileName={`ROV_JTube_Inspection_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}`}
            />

            <ReportPreviewDialog 
                open={itisiPreviewOpen} 
                onOpenChange={setItisiPreviewOpen} 
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

                    const itisiRecords = (allRecords || []).filter(r => 
                        ((r.inspection_type?.code || '').toUpperCase() === 'RRISI' || (r.inspection_type?.code || '').toUpperCase() === 'RSI') && 
                        (r.structure_components?.q_id || '').toUpperCase().startsWith('I')
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

                    const resolveVessel = (jp: any) => {
                        if (!jp?.metadata) return "N/A";
                        const history = jp.metadata.vessel_history;
                        if (Array.isArray(history) && history.length > 0) {
                            return history.map((v: any) => v.name || v).join(", ");
                        }
                        return jp.metadata.vessel || "N/A";
                    };

                    return await generateROVRRISIReport(
                        itisiRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
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
                            preparedBy: { name: "Inspector", date: format(new Date(), 'dd MMM yyyy') },
                            returnBlob: true,
                            printFriendly: isPrintFriendly,
                            reportType: 'I',
                            showSignatures
                        }
                    );
                }}
                title="ROV I-Tube Inspection Report"
                fileName={`ROV_ITube_Inspection_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}`}
            />

            <ReportPreviewDialog 
                open={anodePreviewOpen} 
                onOpenChange={setAnodePreviewOpen} 
                generateReport={async (isPrintFriendly, showSignatures) => {
                    const anodeRecords = currentRecords.filter(r => {
                        const isRGVI = (r.inspection_type_code || r.inspection_type?.code || '').toUpperCase() === 'RGVI';
                        const isAN = (r.structure_components?.code || '').toUpperCase() === 'AN' || 
                                     (r.structure_components?.metadata?.type || '').toUpperCase() === 'ANODE';
                        return isRGVI && isAN;
                    });
                    const settings = await getReportHeaderData();
                    const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
                    let contractorLogoUrl = '';
                    if (jobPack?.metadata?.contrac) {
                        const { data: contrData } = await supabase.from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac).maybeSingle();
                        contractorLogoUrl = contrData?.lib_path || '';
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
                        { printFriendly: isPrintFriendly, returnBlob: true }
                    );
                }}
                title="ROV Anode Inspection Report"
                fileName={`ROV_Anode_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}`}
            />

            <ReportPreviewDialog 
                open={seabedPreviewOpen} 
                onOpenChange={setSeabedPreviewOpen} 
                generateReport={async (isPrintFriendly, showSignatures) => {
                    return await generateSeabedReportBlob(seabedTemplateType, isPrintFriendly);
                }}
                title={`Seabed Survey Report - ${seabedTemplateType === 'seabed-survey-debris' ? 'Debris' : seabedTemplateType === 'seabed-survey-gas' ? 'Gas Seepage' : 'Crater'}`}
                fileName={`Seabed_Survey_${seabedTemplateType.replace('seabed-survey-', '')}_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}`}
            />

            <ReportPreviewDialog 
                open={rcasnPreviewOpen} 
                onOpenChange={setRcasnPreviewOpen} 
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

                    const rcasnRecords = (allRecords || []).filter(r => {
                        const sowMatches = !headerData.sowReportNo || 
                            String(r.sow_report_no || "").toLowerCase().includes(headerData.sowReportNo.toLowerCase());
                        
                        // For Caisson report, we fetch all records for this SOW/Structure 
                        // and let the generator's hierarchy logic group them by CS.
                        return sowMatches;
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

                    const resolveVessel = (jp: any) => {
                        if (!jp?.metadata) return "N/A";
                        const history = jp.metadata.vessel_history;
                        if (Array.isArray(history) && history.length > 0) {
                            return history.map((v: any) => v.name || v).join(", ");
                        }
                        return jp.metadata.vessel || "N/A";
                    };

                    const headerDataObj = {
                        ...headerData,
                        vessel: headerData.vessel,
                        contractorLogoUrl
                    };
                    return await generateROVCasnReport(
                        rcasnRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                        headerDataObj,
                        { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
                        { printFriendly: isPrintFriendly, returnBlob: true, showSignatures: showSignatures, structureId: Number(structureId), jobPackId: Number(jobPackId) }
                    );
                }}
                title="ROV Caisson Survey Report"
                fileName={`ROV_Caisson_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}`}
            />

            <ReportPreviewDialog 
                open={rcondPreviewOpen} 
                onOpenChange={setRcondPreviewOpen} 
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
                            insp_video_tapes:tape_id!left(tape_no),
                            insp_anomalies(*)
                        `)
                        .eq('structure_id', Number(structureId))
                        .eq('sow_report_no', headerData.sowReportNo);

                    const rcondRecords = (allRecords || []).filter(r => {
                        const sowMatches = !headerData.sowReportNo || 
                            String(r.sow_report_no || "").toLowerCase().includes(headerData.sowReportNo.toLowerCase());
                        
                        // For Conductor report, we fetch all records for this SOW/Structure 
                        // and let the generator's hierarchy logic group them by CD.
                        return sowMatches;
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

                    const resolveVessel = (jp: any) => {
                        if (!jp?.metadata) return "N/A";
                        const history = jp.metadata.vessel_history;
                        if (Array.isArray(history) && history.length > 0) {
                            return history.map((v: any) => v.name || v).join(", ");
                        }
                        return jp.metadata.vessel || "N/A";
                    };

                    const headerDataObj = {
                        ...headerData,
                        vessel: headerData.vessel,
                        contractorLogoUrl
                    };
                    return await generateROVCondReport(
                        rcondRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                        headerDataObj,
                        { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
                        { printFriendly: isPrintFriendly, returnBlob: true, showSignatures: showSignatures, structureId: Number(structureId), jobPackId: Number(jobPackId) }
                    );
                }}
                title="ROV Conductor Survey Report"
                fileName={`ROV_Conductor_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}`}
            />

            <ReportPreviewDialog 
                open={rcasnSketchPreviewOpen} 
                onOpenChange={setRcasnSketchPreviewOpen} 
                generateReport={async (isPrintFriendly, showSignatures) => {
                    const settings = await getReportHeaderData();
                    const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
                    
                    // Separate fetch for caisson records
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

                    const caissonRecords = (allRecords || []).filter(r => {
                        const sowMatches = !headerData.sowReportNo || 
                            String(r.sow_report_no || "").toLowerCase().includes(headerData.sowReportNo.toLowerCase());
                        return sowMatches;
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

                    const resolveVessel = (jp: any) => {
                        if (!jp?.metadata) return "N/A";
                        const history = jp.metadata.vessel_history;
                        if (Array.isArray(history) && history.length > 0) {
                            return history.map((v: any) => v.name || v).join(", ");
                        }
                        return jp.metadata.vessel || "N/A";
                    };

                    return await generateROVCasnSketchReport(
                        caissonRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
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
                            preparedBy: { name: 'Inspector', date: new Date().toLocaleDateString() },
                            returnBlob: true,
                            printFriendly: isPrintFriendly,
                            showSignatures
                        }
                    );
                }}
                title="ROV Caisson Survey (Sketch) Report"
                fileName={`ROV_Caisson_Sketch_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}`}
            />

            <ReportPreviewDialog 
                open={blPreviewOpen} 
                onOpenChange={setBlPreviewOpen} 
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
                            insp_video_tapes:tape_id!left(tape_no),
                            insp_anomalies(*)
                        `)
                        .eq('structure_id', Number(structureId))
                        .eq('sow_report_no', headerData.sowReportNo);

                    const blRecords = (allRecords || []).filter(r => {
                        const sowMatches = !headerData.sowReportNo || 
                            String(r.sow_report_no || "").toLowerCase().includes(headerData.sowReportNo.toLowerCase());
                        return sowMatches;
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

                    const resolveVessel = (jp: any) => {
                        if (!jp?.metadata) return "N/A";
                        const history = jp.metadata.vessel_history;
                        if (Array.isArray(history) && history.length > 0) {
                            return history.map((v: any) => v.name || v).join(", ");
                        }
                        return jp.metadata.vessel || "N/A";
                    };

                    const headerDataObj = {
                        ...headerData,
                        vessel: headerData.vessel,
                        contractorLogoUrl
                    };
                    return await generateROVBoatlandingReport(
                        blRecords.map(r => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })),
                        headerDataObj,
                        { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
                        { printFriendly: isPrintFriendly, returnBlob: true, showSignatures: showSignatures, structureId: Number(structureId), jobPackId: Number(jobPackId) }
                    );
                }}
                title="ROV Boatlanding Survey Report"
                fileName={`ROV_Boatlanding_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}`}
            />

            <ReportPreviewDialog 
                open={photographyPreviewOpen} 
                onOpenChange={setPhotographyPreviewOpen} 
                generateReport={async (isPrintFriendly, showSignatures) => {
                    const settings = await getReportHeaderData();
                    const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
                    
                    const { data: records } = await supabase
                        .from('insp_records')
                        .select(`insp_id, sow_report_no, jobpack_id, structure_id, insp_anomalies(anomaly_ref_no)`)
                        .eq('structure_id', Number(structureId))
                        .eq('jobpack_id', Number(jobPackId))
                        .eq('sow_report_no', headerData.sowReportNo);

                    if (!records || records.length === 0) {
                        return await generateROVPhotographyReport([], headerData, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true });
                    }

                    const recordIds = records.map(r => r.insp_id);

                    const { data: attachments } = await supabase
                        .from('attachment')
                        .select('*')
                        .in('source_id', recordIds)
                        .ilike('source_type', 'inspection')
                        .order('created_at', { ascending: true });

                    const photoData = (attachments || []).filter(a => a.path && a.path.match(/\.(jpg|jpeg|png|webp)$/i)).map(a => {
                        const record = records?.find(r => r.insp_id === a.source_id);
                        return {
                            ...a,
                            anomaly_ref: record?.insp_anomalies?.[0]?.anomaly_ref_no || null
                        };
                    });

                    if (photoData.length === 0) {
                        return await generateROVPhotographyReport([], headerData, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true });
                    }
                    
                    let contractorLogoUrl = '';
                    if (jobPack?.metadata?.contrac) {
                        try {
                            const cRes = await fetch(`/api/library/CONTR_NAM`);
                            const cJson = await cRes.json();
                            const found = cJson.data?.find((c: any) => String(c.lib_id) === String(jobPack?.metadata?.contrac));
                            if (found?.logo_url) contractorLogoUrl = found.logo_url;
                        } catch (e) { console.error("Logo fetch error", e); }
                    }

                    const resolveVessel = (jp: any) => {
                        if (!jp?.metadata) return "N/A";
                        const history = jp.metadata.vessel_history;
                        if (Array.isArray(history) && history.length > 0) {
                            return history.map((v: any) => v.name || v).join(", ");
                        }
                        return jp.metadata.vessel || "N/A";
                    };

                    const headerDataObj = {
                        ...headerData,
                        vessel: headerData.vessel,
                        contractorLogoUrl
                    };
                    return await generateROVPhotographyReport(
                        photoData,
                        headerDataObj,
                        { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
                        { printFriendly: isPrintFriendly, returnBlob: true, showSignatures: showSignatures, structureId: Number(structureId), jobPackId: Number(jobPackId) }
                    );
                }}
                title="ROV Photography Report"
                fileName={`ROV_Photography_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}`}
            />

            <ReportPreviewDialog 
                open={photographyLogPreviewOpen} 
                onOpenChange={setPhotographyLogPreviewOpen} 
                generateReport={async (isPrintFriendly, showSignatures) => {
                    const settings = await getReportHeaderData();
                    const { data: jobPack } = await supabase.from('jobpack').select('metadata').eq('id', Number(jobPackId)).single();
                    
                    const { data: records } = await supabase
                        .from('insp_records')
                        .select(`insp_id, sow_report_no, jobpack_id, structure_id, insp_anomalies(anomaly_ref_no)`)
                        .eq('structure_id', Number(structureId))
                        .eq('jobpack_id', Number(jobPackId))
                        .eq('sow_report_no', headerData.sowReportNo);

                    if (!records || records.length === 0) {
                        return await generateROVPhotographyLogReport([], headerData, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true });
                    }

                    const recordIds = records.map(r => r.insp_id);

                    const { data: attachments } = await supabase
                        .from('attachment')
                        .select('*')
                        .in('source_id', recordIds)
                        .ilike('source_type', 'inspection')
                        .order('created_at', { ascending: true });

                    const photoData = (attachments || []).filter(a => a.path && a.path.match(/\.(jpg|jpeg|png|webp)$/i)).map(a => {
                        const record = records?.find(r => r.insp_id === a.source_id);
                        return {
                            ...a,
                            anomaly_ref: record?.insp_anomalies?.[0]?.anomaly_ref_no || null
                        };
                    });

                    if (photoData.length === 0) {
                        return await generateROVPhotographyLogReport([], headerData, { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName }, { returnBlob: true });
                    }
                    
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
                    return await generateROVPhotographyLogReport(
                        photoData,
                        headerDataObj,
                        { company_name: settings.companyName, logo_url: settings.companyLogo, department_name: settings.departmentName },
                        { printFriendly: isPrintFriendly, returnBlob: true, showSignatures: showSignatures, structureId: Number(structureId), jobPackId: Number(jobPackId) }
                    );
                }}
                title="ROV Photography Log Report"
                fileName={`ROV_Photography_Log_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}`}
            />

            <InspectionHeader 
                headerData={headerData}
                inspMethod={inspMethod}
                setInspMethod={setInspMethod}
                router={router}
                searchParams={searchParams}
                allInspectionTypes={allInspectionTypes}
                currentRecords={currentRecords}
                generateInspectionReportByType={generateInspectionReportByType}
                generateSeabedReport={generateSeabedReport}
                generateMGIReport={generateMGIReport}
                generateFMDReport={generateFMDReport}
                generateSZCIReport={generateSZCIReport}
                generateUTWTReport={generateUTWTReport}
                generateRSCORReport={() => setRscorPreviewOpen(true)}
                generateRRISIReport={() => setRrisiPreviewOpen(true)}
                generateJTISIReport={() => setJtisiPreviewOpen(true)}
                generateITISIReport={() => setItisiPreviewOpen(true)}
                generateAnodeReport={() => setAnodePreviewOpen(true)}
                generateCPReport={() => setCpPreviewOpen(true)}
                generateRGVIReport={() => setRgviPreviewOpen(true)}
                generateRCASNReport={() => setRcasnPreviewOpen(true)}
                generateRCASNSketchReport={() => setRcasnSketchPreviewOpen(true)}
                generateRCONDReport={() => setRcondPreviewOpen(true)}
                generateRCONDSketchReport={() => setRcondSketchPreviewOpen(true)}
                generateBLReport={() => setBlPreviewOpen(true)}
                generatePhotographyReport={() => setPhotographyPreviewOpen(true)}
                generatePhotographyLogReport={() => setPhotographyLogPreviewOpen(true)}
                generateFullInspectionReport={generateFullInspectionReport}
                jobPackId={jobPackId}
                structureId={structureId}
                onSummaryOpen={() => setIsSummaryOpen(true)}
            />

            {/* ── INSPECTION SUMMARY PANEL ───────────────────────────────────────── */}
            <InspectionSummaryPanel
                open={isSummaryOpen}
                onClose={() => setIsSummaryOpen(false)}
                sowId={sowId || null}
                structureId={structureId || null}
                jobpackId={jobPackId || null}
                sowReportNo={headerData.sowReportNo}
                headerData={headerData}
            />


            {/* DEPLOYMENTS SUB-HEADER */}
            <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 py-1.5 flex items-center gap-3 shrink-0">
                {deployments.length === 0 && !activeDep && isFetchingDeps && (
                    <div className="flex items-center gap-2 text-slate-400 px-2 py-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Loading {inspMethod === 'DIVING' ? 'dives' : 'deployments'}...</span>
                    </div>
                )}
                {deployments.length === 0 && !activeDep && !isFetchingDeps && (
                    <div className="flex items-center gap-2 text-slate-500 px-2 py-1">
                        <Info className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">No {inspMethod === 'DIVING' ? 'Dive' : 'ROV'} Action Recorded</span>
                    </div>
                )}

                {/* Active Dive Display */}
                {activeDep && (
                    <div className="flex items-center gap-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-1.5 shadow-sm">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse shrink-0" />
                        <div className="flex flex-col">
                            <span className="font-black uppercase text-sm leading-none text-blue-900 dark:text-blue-200">{activeDep.jobNo || activeDep.id}</span>
                            <span className="text-[10px] font-semibold leading-none text-slate-500 dark:text-blue-400/70 mt-0.5">{activeDep.name || 'Unknown'}</span>
                        </div>
                        {activeDep.raw?.status && (
                            <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ml-1 ${activeDep.raw.status === 'COMPLETED' ? 'bg-slate-200 text-slate-600' :
                                'bg-green-100 text-green-700 border border-green-200'
                                }`}>{activeDep.raw.status === 'COMPLETED' ? 'Done' : 'Active'}</span>
                        )}
                    </div>
                )}

                {/* Separator */}
                {deployments.length > 1 && <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 shrink-0" />}

                {/* History Selector - for completed / other dives */}
                {deployments.length > 1 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold text-slate-500 hover:text-blue-600 uppercase tracking-wider transition-colors bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 shadow-sm">
                                <History className="w-3 h-3" />
                                <span className="hidden sm:inline">History</span>
                                <span className="bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 text-[9px] font-black px-1 rounded-full min-w-[16px] text-center">{deployments.length - 1}</span>
                                <ChevronDown className="w-3 h-3 opacity-50" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64 p-1">
                            <div className="px-2 py-1.5 text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 mb-1">
                                All {inspMethod === 'DIVING' ? 'Dives' : 'Deployments'} ({deployments.length})
                            </div>
                            {deployments.map(dep => {
                                const isActive = activeDep?.id === dep.id;
                                const isCompleted = dep.raw?.status === 'COMPLETED';
                                return (
                                    <DropdownMenuItem
                                        key={dep.id}
                                        onClick={() => setActiveDep(dep)}
                                        className={`flex items-center justify-between cursor-pointer rounded-md px-2 py-2 ${isActive ? 'bg-blue-50 dark:bg-blue-950/40' : ''}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]' : isCompleted ? 'bg-slate-300' : 'bg-blue-400'}`} />
                                            <div className="flex flex-col">
                                                <span className={`font-bold text-xs uppercase leading-none ${isActive ? 'text-blue-700' : 'text-slate-800 dark:text-slate-200'}`}>{dep.jobNo || dep.id}</span>
                                                <span className="text-[10px] text-slate-400 leading-none mt-0.5">{dep.name || 'Unknown'}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {isCompleted && (
                                                <span className="text-[8px] font-bold uppercase bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">Done</span>
                                            )}
                                            {isActive && (
                                                <Check className="w-3.5 h-3.5 text-blue-600" />
                                            )}
                                        </div>
                                    </DropdownMenuItem>
                                );
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

                {inspMethod === 'DIVING' && activeDep && (
                    <Button
                        onClick={() => setCalibrationDialogOpen(true)}
                        variant="outline"
                        size="sm"
                        className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 h-7"
                    >
                        <Wrench className="h-3.5 w-3.5" />
                        Calibration
                    </Button>
                )}

                {inspMethod === 'ROV' && activeDep && (
                    <Button
                        onClick={() => setRovCalibrationDialogOpen(true)}
                        variant="outline"
                        size="sm"
                        className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 h-7"
                    >
                        <Wrench className="h-3.5 w-3.5" />
                        Calibration
                    </Button>
                )}


                {/* Inspection Readiness Traffic Light */}

                {(() => {
                    const isDepActive = !!activeDep && activeDep.raw?.status !== 'COMPLETED';
                    const isAtWorksite = ["Arrived Bottom", "Diver at Worksite", "Bell at Working Depth", "Diver Locked Out", "AT_WORKSITE", "At Worksite", "Rov at the Worksite"].some(ws => currentMovement?.toUpperCase().includes(ws.toUpperCase()));
                    const hasTape = !!tapeId;
                    const isRecording = vidState === 'RECORDING';
                    const allGreen = (isDepActive && isAtWorksite && hasTape && isRecording) || manualOverride;

                    const items = [
                        { label: inspMethod === 'DIVING' ? 'Dive Active' : 'ROV Active', ok: isDepActive, hint: `Start a new ${inspMethod === 'DIVING' ? 'Dive' : 'ROV Deployment'} from the left panel` },
                        { label: 'At Worksite', ok: isAtWorksite, hint: 'Progress movement to At Worksite state' },
                        { label: 'Tape Ready', ok: hasTape, hint: 'Create or select a video tape' },
                        { label: 'Recording', ok: isRecording, hint: 'Press START in the Video Log to begin recording' },
                    ];

                    return (
                        <div className="flex items-center gap-2 ml-auto">
                            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 shadow-sm">
                                {/* Overall Signal */}
                                <div className={`w-3 h-3 rounded-full shrink-0 transition-all duration-300 ${allGreen ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                                    (isDepActive && hasTape) ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]' :
                                        'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]'
                                    }`} />
                                <span className={`text-[9px] font-black uppercase tracking-wider ${allGreen ? 'text-green-700 dark:text-green-400' :
                                    (isDepActive && hasTape) ? 'text-amber-600 dark:text-amber-400' :
                                        'text-red-600 dark:text-red-400'
                                    }`}>{allGreen ? 'Ready' : 'Not Ready'}</span>

                                <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-0.5" />

                                {/* Individual Checks */}
                                {items.map((item, i) => (
                                    <div key={i} className="relative group">
                                        <div className={`w-2 h-2 rounded-full transition-all ${item.ok ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'
                                            }`} />
                                        {/* Tooltip */}
                                        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-50">
                                            <div className={`whitespace-nowrap text-[9px] font-bold px-2 py-1 rounded shadow-lg border ${item.ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                                                }`}>
                                                {item.ok ? `âœ“ ${item.label}` : `âœ— ${item.label} â€” ${item.hint}`}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Manual Override Toggle */}
                            <button
                                onClick={() => {
                                    if (!manualOverride) {
                                        if (confirm('Enable Manual Entry mode?\n\nThis allows inserting inspection records without live recording prerequisites.\nUse this only to add missing events after inspection is complete.')) {
                                            setManualOverride(true);
                                            toast.success('Manual Entry mode enabled. Live checks bypassed.', { duration: 3000 });
                                        }
                                    } else {
                                        setManualOverride(false);
                                        toast.info?.('Switched back to Live mode.') || toast.success('Switched back to Live mode.');
                                    }
                                }}
                                className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg border transition-all shadow-sm ${manualOverride
                                    ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:text-blue-600 hover:border-blue-300'
                                    }`}
                                title={manualOverride ? 'Currently in Manual Entry mode (click to switch to Live)' : 'Switch to Manual Entry mode to insert missing records'}
                            >
                                {manualOverride 
                                    ? <span className="flex items-center gap-1.5"><span className="text-[10px]">&#9889;</span> MANUAL</span> 
                                    : <span className="flex items-center gap-1.5"><span className="text-red-500 text-[8px]">&#11044;</span> LIVE</span>
                                }
                            </button>
                        </div>
                    );
                })()}

                {/* INSERT SEABED SURVEY MAP BUTTON */}
                {activeDep && inspMethod === "ROV" && (
                    <Button
                        variant="default" 
                        size="sm" 
                        className="ml-auto bg-blue-600 hover:bg-blue-700 text-white h-7 px-3 shadow-blue-500/20 shadow-lg text-[10px] font-black uppercase tracking-wider"
                        onClick={async () => {
                            if (vidState === "IDLE") {
                                toast.error("Video recording must be actively started to open the Seabed Map.");
                                return;
                            }
                            if (!tapeId) {
                                toast.error("No active tape available. Please configure a tape first.");
                                return;
                            }

                            // Pre-fetch check for Inspection Type (optional, fallbacks exist)
                            const { data, error } = await supabase.from('inspection_type').select('id').eq('code', 'RSEAB').maybeSingle();
                            if (error || !data?.id) {
                                console.warn("Seabed Inspection Type (RSEAB) is missing from the database. Falling back to active deployment inspection type.");
                            }

                            setIsSeabedGuiOpen(true);
                        }}
                    >
                        <MapPin className="w-3.5 h-3.5 mr-1.5" /> Seabed Map
                    </Button>
                )}
            </div>

            {/* ROV Data String Bar (Dynamic based on Data Acquisition settings) */}
            {inspMethod === "ROV" && (
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border-b-2 border-cyan-700/30 px-3 py-1.5 flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300 dark:text-cyan-300 shrink-0">ROV Data</span>
                    <div className="w-px h-5 bg-cyan-700/50 shrink-0" />

                    {/* Field Blocks */}
                    <div className="flex-1 flex items-center gap-1.5 overflow-x-auto">
                        {dataAcqFields.length > 0 ? dataAcqFields.map((field, i) => (
                            <div key={i} className="flex items-center gap-1.5 bg-slate-700/80 dark:bg-slate-700/80 px-3 py-1 rounded-md border border-slate-600 dark:border-slate-500 shrink-0 min-w-[80px]">
                                <span className="text-[9px] font-black uppercase text-amber-300 dark:text-amber-300 tracking-wide">{field.targetField.replace(/_/g, ' ')}</span>
                                <span className="text-[12px] font-mono font-black text-white dark:text-white">{field.value}</span>
                            </div>
                        )) : (
                            <span className="text-[10px] text-amber-300 dark:text-amber-300 italic font-semibold">No fields configured â€” Go to Settings â†’ Data Acquisition</span>
                        )}
                    </div>

                    {/* Right Controls */}
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Structure Type Badge */}
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${headerData.structureType === 'pipeline'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                            }`}>{headerData.structureType}</span>

                        {/* Connect / Disconnect Button */}
                        <button
                            onClick={dataAcqConnected ? handleDataAcqDisconnect : handleDataAcqConnect}
                            disabled={dataAcqConnecting}
                            className={`relative flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-md border transition-all ${dataAcqConnecting
                                ? 'bg-amber-600/30 text-amber-300 border-amber-500/40 cursor-wait'
                                : dataAcqConnected
                                    ? 'bg-green-600/30 text-green-300 border-green-500/50 hover:bg-red-600/30 hover:text-red-300 hover:border-red-500/50'
                                    : 'bg-slate-600/50 text-slate-300 border-slate-500/50 hover:bg-cyan-600/30 hover:text-cyan-300 hover:border-cyan-500/50'
                                }`}
                            title={dataAcqConnected ? 'Click to disconnect' : dataAcqError || 'Click to connect to data source'}
                        >
                            {dataAcqConnecting ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Connecting...</>
                            ) : dataAcqConnected ? (
                                <><span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)] animate-pulse" /> Online</>
                            ) : (
                                <><Wifi className="w-3.5 h-3.5" /> Connect</>
                            )}
                        </button>

                        {/* Error indicator */}
                        {dataAcqError && !dataAcqConnected && (
                            <div className="relative group">
                                <span className="text-red-400 text-sm cursor-help">âš </span>
                                <div className="absolute bottom-full mb-2 right-0 hidden group-hover:block z-50">
                                    <div className="whitespace-nowrap text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-xl bg-red-900 text-red-200 border border-red-700 max-w-[300px] whitespace-normal">
                                        {dataAcqError}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Settings Link */}
                        <Link
                            href={`/dashboard/settings/data-acquisition?returnTo=${encodeURIComponent(
                                '/dashboard/inspection-v2/workspace?' + new URLSearchParams({
                                    ...Object.fromEntries(searchParams.entries()),
                                    mode: inspMethod
                                }).toString()
                            )}`}
                            className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-md border border-slate-600 transition-colors"
                            title="Data Acquisition Settings"
                        >
                            <Settings className="w-3.5 h-3.5 text-slate-300" />
                        </Link>
                    </div>
                </div>
            )}

            {/* MAIN 3-COLUMN LAYOUT */}
            <div className="flex-1 flex min-h-0 p-3 gap-3 overflow-hidden">

                {/* ======== COL 1: OPERATIONS (Diver/ROV + Video) ======== */}
                <div className="w-[320px] flex flex-col gap-3 shrink-0 overflow-hidden">

                    {/* 1. Diver / ROV Log */}
                    <Card className="flex flex-col border-slate-200 shadow-sm rounded-md shrink-0 mb-2">
                        <div className="bg-[#1f2937] text-white px-3 py-2 text-sm font-bold uppercase tracking-widest flex justify-between items-center rounded-t-md">
                            <span>{inspMethod === "DIVING" ? "DIVER LOG" : "ROV DIVE LOG"}</span>
                            <div className="flex items-center gap-2 text-slate-300">
                                <button onClick={() => { setIsDiveSetupForNew(true); setIsDiveSetupOpen(true); }} className="flex items-center gap-1 p-1 hover:text-white transition" title="New Dive">
                                    <Plus className="w-4 h-4" /> <span className="text-[10px] hidden lg:inline">New Dive</span>
                                </button>
                                <button onClick={() => setIsMovementLogOpen(true)} className="p-1 hover:text-white transition" title="Edit Events"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => { setIsDiveSetupForNew(false); setIsDiveSetupOpen(true); }} className="p-1 hover:text-white transition" title="Settings"><Settings className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <div className="p-2.5 bg-white space-y-2 rounded-b-md">
                            <div className="flex justify-between text-xs px-1">
                                <div><span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider mb-0.5">Active Selection</span><span className="font-bold text-slate-800 text-xs">{activeDep?.jobNo || "None"}</span></div>
                                <div className="text-right"><span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider mb-0.5">Time In Water</span><span className="font-mono font-bold text-blue-600 text-xs">{timeInWater}</span></div>
                            </div>

                            {/* Movement Control */}
                            <div className="bg-slate-50 border border-slate-100/60 rounded px-2 py-1.5 text-center relative">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Current Movement</span>
                                <span className="font-black text-slate-900 text-[14px] leading-tight flex items-center justify-center">{currentMovement || "Awaiting Deployment"}</span>
                            </div>

                            <div className="flex gap-1.5">
                                <Button
                                    onClick={handleMovementPrev}
                                    disabled={currentMovement === 'Awaiting Deployment' || (inspMethod === 'DIVING' && currentMovement === diveActionsList[0].label)}
                                    variant="outline"
                                    className="flex-1 h-7 text-[11px] font-bold text-slate-500 border-slate-200 hover:text-slate-700 bg-white shadow-sm"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Rollback
                                </Button>

                                {inspMethod === "DIVING" ? (
                                    <Button
                                        onClick={handleMovementNext}
                                        disabled={currentMovement === diveActionsList[diveActionsList.length - 1].label}
                                        className="flex-[1.5] h-7 text-[11px] font-bold bg-[#2563eb] hover:bg-blue-700 text-white shadow-sm"
                                    >
                                        {currentMovement === 'Awaiting Deployment' ? "Next" :
                                            (diveActionsList.findIndex(a => a.label === currentMovement) < diveActionsList.length - 1
                                                ? "Next"
                                                : "Completed")} <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                    </Button>
                                ) : (
                                    (() => {
                                        const options = ROV_MOVEMENT_BRANCHES[currentMovement || 'Awaiting Deployment'] || [];
                                        const isCompleted = options.length === 0;

                                        if (isCompleted) {
                                            return (
                                                <Button disabled className="flex-[1.5] h-7 text-[11px] font-bold bg-[#2563eb] hover:bg-blue-700 text-white shadow-sm">
                                                    Completed <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                                </Button>
                                            );
                                        }

                                        if (options.length === 1) {
                                            return (
                                                <Button onClick={() => handleMovementLog(options[0])} className="flex-[1.5] h-7 text-[11px] font-bold bg-[#2563eb] hover:bg-blue-700 text-white shadow-sm truncate">
                                                    Next: {options[0]} <ArrowRight className="w-3.5 h-3.5 ml-1 shrink-0" />
                                                </Button>
                                            );
                                        }

                                        return (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button className="flex-[1.5] h-7 text-[11px] font-bold bg-[#2563eb] hover:bg-blue-700 text-white shadow-sm">
                                                        Next Action... <ChevronDown className="w-3.5 h-3.5 ml-1 shrink-0" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    {options.map(opt => (
                                                        <DropdownMenuItem key={opt} onClick={() => handleMovementLog(opt)} className="text-xs font-bold cursor-pointer">
                                                            Select: {opt}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        );
                                    })()
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* 2. Video Tape Management (MODULAR) */}
                    <TapeManagementCard
                        vidState={vidState}
                        vidTimer={vidTimer}
                        tapeId={tapeId}
                        tapeNo={tapeNo}
                        activeChapter={activeChapter}
                        jobTapes={jobTapes}
                        handleLogEvent={handleLogEvent}
                        setTapeId={setTapeId}
                        setTapeNo={setTapeNo}
                        setActiveChapter={setActiveChapter}
                        setIsNewTapeOpen={setIsNewTapeOpen}
                        handleOpenEditTape={handleOpenEditTape}
                        formatTime={formatTime}
                        handleDeleteTape={handleDeleteTape}
                        canDelete={tapeId ? !videoEvents.some(evt => String(evt.tape_id) === String(tapeId)) : false}
                    >
                        {/* Tape Log Events (MODULAR) */}
                        <TapeLogEvents 
                            videoEvents={videoEvents.filter(evt => String(evt.tape_id) === String(tapeId))}
                            handleDeleteEvent={handleDeleteEvent}
                            onEditEvent={setEditingEvent}
                            expanded={tapeLogExpanded}
                            setExpanded={setTapeLogExpanded}
                            isFloating={!!pipWindow}
                        />
                    </TapeManagementCard>

                    {/* 6. Video Interface (Reduced Size) */}
                    {!pipWindow && (
                        <div className="flex-1 min-h-[180px] bg-black rounded-lg overflow-hidden border border-slate-800 shadow-xl relative">
                            {renderStreamUI()}
                        </div>
                    )}

                    {/* PiP Portal */}
                    {pipWindow && createPortal(
                        <div className="h-full w-full bg-black flex flex-col overflow-hidden select-none">
                            <div className="bg-slate-900 p-2.5 flex justify-between items-center border-b border-white/10 z-50 shrink-0">
                                <span className="text-[11px] text-white font-black uppercase tracking-widest flex items-center gap-2">
                                    <Video className="w-3.5 h-3.5 text-red-500 animate-pulse" /> LIVE STREAMING CONTROL
                                </span>
                                <button onClick={() => pipWindow.close()} className="text-white/50 hover:text-white p-1 hover:bg-white/10 rounded-full transition-all"><X className="w-4 h-4" /></button>
                            </div>
                            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                                {renderStreamUI()}
                            </div>
                        </div>,
                        pipWindow.document.body
                    )}

                </div>

                {/* ======== COL 2: INSPECTION WORKSPACE (CENTRE) ======== */}
                <div className="flex-1 flex flex-col gap-3 min-w-[500px] overflow-hidden">

                    {/* 5. Inspection Task Form Handling */}
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
                                                {selectedComp.tasks && selectedComp.tasks.filter((t: string) => {
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
                                                    const taskStatus = selectedComp.taskStatuses?.find((ts: any) => ts.code === t);
                                                    const status = taskStatus?.status || 'pending';
                                                    const isCompleted = status === 'completed';
                                                    const isIncomplete = status === 'incomplete';
                                                    
                                                    // Records for this specific task
                                                    const taskRecords = currentRecords.filter((r: any) => 
                                                        (r.inspection_type?.code === t || r.inspection_type_code === t) && 
                                                        r.component_id === selectedComp.id
                                                    );

                                                    const hasAnomaly = taskRecords.some((r: any) => r.has_anomaly && r.inspection_data?._meta_status !== 'Finding');
                                                    const hasFinding = taskRecords.some((r: any) => r.has_anomaly && r.inspection_data?._meta_status === 'Finding');
                                                    
                                                    const isRectified = taskRecords.some((r: any) => r.has_anomaly && r.insp_anomalies?.[0]?.status === 'CLOSED');
                                                    const it = allInspectionTypes.find(type => type.code === t || type.name === t);
                                                    
                                                    // Determine color based on priority: Anomaly (Red) > Finding (Orange) > Complete (Green)
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
                                                        <div key={t} className="flex gap-2 items-center w-full relative group/item">
                                                            <Button onClick={() => {
                                                                setActiveSpec(t);
                                                                const now = new Date();
                                                                const newProps: Record<string, any> = {
                                                                    inspection_date: format(now, 'yyyy-MM-dd'),
                                                                    inspection_time: format(now, 'HH:mm:ss')
                                                                };
                                                                
                                                                // 2. Resolve field definitions (from registry or DB)
                                                                const specProps = it?.default_properties || [];
                                                                let propsList: any[] = [];
                                                                if (typeof specProps === 'string') {
                                                                    try {
                                                                        const parsed = JSON.parse(specProps);
                                                                        propsList = parsed.fields || parsed.properties || (Array.isArray(parsed) ? parsed : []);
                                                                    } catch (e) { }
                                                                } else {
                                                                    const parsed = specProps as any;
                                                                    propsList = parsed.fields || parsed.properties || (Array.isArray(parsed) ? parsed : []);
                                                                }

                                                                // 3. Apply JSON Defaults
                                                                propsList.forEach((p: any) => {
                                                                    if (p.default !== undefined) {
                                                                        newProps[p.name || p.label] = p.default;
                                                                    }
                                                                });

                                                                // 4. Auto-insert current tape counter for LIVE entry mode
                                                                if (!manualOverride) {
                                                                    newProps.tape_count_no = formatTime(vidTimer);
                                                                }

                                                                // 5. Auto-fill Nominal Thickness from Component Data
                                                                const compNT = selectedComp.nominalThk && selectedComp.nominalThk !== '-' ? selectedComp.nominalThk : 
                                                                               (selectedComp.wallThickness && selectedComp.wallThickness !== '-' ? selectedComp.wallThickness : null);
                                                                if (compNT) {
                                                                    const ntField = propsList.find((p: any) => 
                                                                        String(p.label || p.name || '').toLowerCase().includes('nominal thickness') ||
                                                                        String(p.label || p.name || '').toLowerCase() === 'nt'
                                                                    );
                                                                    if (ntField) {
                                                                        newProps[ntField.name || ntField.label] = compNT;
                                                                    }
                                                                }

                                                                // 6. Populate from ROV Data Acquisition if connected
                                                                if (inspMethod === 'ROV' && dataAcqConnected) {
                                                                    dataAcqFields.forEach(f => {
                                                                        if (f.value && f.value !== '--' && f.targetField) {
                                                                            newProps[f.targetField] = f.value;
                                                                        }
                                                                    });
                                                                }

                                                                // 7. Default elevation for underwater types to negative
                                                                if (inspMethod === 'ROV' || inspMethod === 'DIVING') {
                                                                    const depthVal = selectedComp.depth || (selectedComp.lowestElev !== '-' ? selectedComp.lowestElev : null);
                                                                    if (depthVal) {
                                                                        const numericDepth = parseFloat(String(depthVal).replace(/[^\d.-]/g, ''));
                                                                        if (!isNaN(numericDepth)) {
                                                                            newProps.verification_depth = -Math.abs(numericDepth);
                                                                        }
                                                                    }
                                                                }
                                                                
                                                                setDynamicProps(newProps);
                                                                setFindingType("Complete");
                                                                setRecordNotes("");
                                                                setAnomalyData({defectCode: '', priority: '', defectType: '', description: '', recommendedAction: '',
                                                                    rectify: false, rectifiedDate: '', rectifiedRemarks: '', severity: 'Minor', referenceNo: '' });
                                                                setIsManualOverride(false);
                                                                setIsUserInteraction(false);
                                                            }} className={`flex-1 h-14 bg-white border font-bold shadow-sm flex justify-between items-center group transition-all ${
                                                                statusColor === 'green' ? 'border-green-200 hover:bg-green-50/50' :
                                                                statusColor === 'red' ? 'border-red-200 hover:bg-red-50/30' :
                                                                statusColor === 'orange' ? 'border-orange-200 hover:bg-orange-50/30' :
                                                                statusColor === 'teal' ? 'border-teal-200 hover:bg-teal-50/30' :
                                                                statusColor === 'amber' ? 'border-amber-200 hover:bg-amber-50/30' :
                                                                'border-blue-200 hover:bg-blue-50'
                                                            }`}>
                                                                <div className="flex items-center gap-2.5">
                                                                    {/* Status indicator dot */}
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

                                                            {taskRecords.length === 0 && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-14 w-10 shrink-0 text-slate-400 border-dashed hover:text-red-600 hover:border-red-200 hover:bg-red-50/50"
                                                                    title={`Remove ${t}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        e.preventDefault();
                                                                        handleDeleteInspectionSpec(t);
                                                                    }}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                        </div>
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
                                                            <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex gap-2 items-center">
                                                                <div className="relative flex-1">
                                                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                                                    <Input
                                                                        placeholder="Search type name or code..."
                                                                        className="pl-9 h-9 text-xs bg-white border-slate-200 focus-visible:ring-blue-500"
                                                                        value={inspectionTypeSearch}
                                                                        onChange={(e) => setInspectionTypeSearch(e.target.value)}
                                                                        autoFocus
                                                                    />
                                                                </div>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm" 
                                                                    onClick={() => setIsAddInspOpen(false)} 
                                                                    className="h-9 px-2 text-xs font-bold text-slate-500 hover:text-slate-700 shrink-0"
                                                                >
                                                                    Cancel
                                                                </Button>
                                                            </div>
                                                            <ScrollArea className="h-[300px]">
                                                                <div className="p-1.5 space-y-1">
                                                                    {allInspectionTypes
                                                                        .filter(it => {
                                                                            // Filter by mode
                                                                            const methods = it.default_properties?.methods || it.methods || [];
                                                                            const isRov = methods.includes("ROV") || it.metadata?.rov === 1 || it.metadata?.rov === "1" || it.metadata?.rov === true || it.metadata?.job_type?.includes('ROV');
                                                                            const isDiving = methods.includes("DIVING") || it.metadata?.diving === 1 || it.metadata?.diving === "1" || it.metadata?.diving === true || it.metadata?.job_type?.includes('DIVING');
                                                                            if (inspMethod === 'DIVING' && !isDiving) return false;
                                                                            if (inspMethod === 'ROV' && !isRov) return false;

                                                                            // Filter by search query
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
                                                                    {allInspectionTypes.filter(it => {
                                                                        const isRov = it.metadata?.rov === 1 || it.metadata?.rov === "1" || it.metadata?.rov === true || it.metadata?.job_type?.includes('ROV');
                                                                        const isDiving = it.metadata?.diving === 1 || it.metadata?.diving === "1" || it.metadata?.diving === true || it.metadata?.job_type?.includes('DIVING');
                                                                        if (inspMethod === 'DIVING' && !isDiving) return false;
                                                                        if (inspMethod === 'ROV' && !isRov) return false;
                                                                        if (inspectionTypeSearch) {
                                                                            const q = inspectionTypeSearch.toLowerCase();
                                                                            return (it.name || '').toLowerCase().includes(q) || (it.code || '').toLowerCase().includes(q);
                                                                        }
                                                                        return true;
                                                                    }).length === 0 && (
                                                                        <div className="py-10 text-center">
                                                                            <p className="text-xs text-slate-400 italic">No matching inspection types found</p>
                                                                        </div>
                                                                    )}
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
                                        setIsAttachmentManagerOpen={setIsAttachmentManagerOpen}
                                        recordedFiles={recordedFiles}
                                        activeDep={activeDep}
                                        currentMovement={currentMovement}
                                        tapeId={tapeId}
                                        vidState={vidState}
                                        onChangeTaskClick={() => setShowTaskSelector(true)}
                                        onChangeComponentClick={() => setShowCompSelector(true)}
                                    />
                                )}
                            </div>
                        )}
                    </Card>

                    {/* Session Records Table (Records session completed before in the current dive) */}
                    <Card className={`flex flex-col ${capturedEventsPipWindow ? 'h-[40px]' : 'h-[280px]'} border-slate-200 shadow-sm rounded-md bg-white overflow-hidden shrink-0 transition-all duration-500 ease-in-out`}>
                        <div className="bg-slate-800 text-white px-3 py-2 text-[11px] font-bold uppercase tracking-widest flex justify-between items-center h-[40px] shrink-0">
                            <div className="flex items-center gap-2">
                                <span>CAPTURED EVENTS</span>
                                <Badge className="bg-blue-600 text-white border-none text-[9px] h-4 leading-none font-bold uppercase tracking-wider flex items-center gap-1.5">
                                    {syncLoading && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                                    {currentRecords.length} Captured
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
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 px-2 text-[10px] text-slate-300 hover:text-white hover:bg-slate-700" 
                                onClick={handlePopoutCapturedEvents} 
                                title={capturedEventsPipWindow ? "Close Floating Window" : "Float as Window"}
                            >
                                {capturedEventsPipWindow ? <X className="w-3.5 h-3.5 mr-1" /> : <Maximize2 className="w-3.5 h-3.5 mr-1" />}
                                {capturedEventsPipWindow ? "Dock" : "Float"}
                            </Button>
                        </div>
                        
                        {!capturedEventsPipWindow && (
                            <ScrollArea className="flex-1 w-full relative">
                                <table className="w-full text-left text-xs whitespace-nowrap">
                                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-3 py-3 w-20 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort('cr_date')}>
                                                <div className="flex items-center gap-1.5">
                                                    Date {sortConfig.key === 'cr_date' ? (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />) : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />}
                                                </div>
                                            </th>
                                            <th className="px-3 py-3 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort('type')}>
                                                <div className="flex items-center gap-1.5">
                                                    Type {sortConfig.key === 'type' ? (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />) : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />}
                                                </div>
                                            </th>
                                            <th className="px-3 py-3 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort('component')}>
                                                <div className="flex items-center gap-1.5">
                                                    Component {sortConfig.key === 'component' ? (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />) : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />}
                                                </div>
                                            </th>
                                            <th className="px-3 py-3 text-center cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort('elev')}>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    Elev/KP {sortConfig.key === 'elev' ? (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />) : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />}
                                                </div>
                                            </th>
                                            <th className="px-3 py-3 text-center cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort('status')}>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    Status {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />) : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />}
                                                </div>
                                            </th>
                                            <th className="px-3 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {displayRecords.map((r: any) => {
                                            const formatCounter = (val: any) => {
                                                if (!val) return null;
                                                if (typeof val === 'string' && val.includes(':')) return val;
                                                const sec = Number(val);
                                                if (!isNaN(sec)) {
                                                    const h = Math.floor(sec / 3600).toString().padStart(2, '0');
                                                    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
                                                    const s = Math.floor(sec % 60).toString().padStart(2, '0');
                                                    return `${h}:${m}:${s}`;
                                                }
                                                return val;
                                            };
                                            return (
                                                <tr key={r.insp_id} className="hover:bg-slate-50 group">
                                                    <td className="px-3 py-3 text-slate-600 align-top">
                                                        <div className="text-sm font-medium">{r.cr_date ? format(new Date(r.cr_date), 'dd MMM') : '-'}</div>
                                                        <div className="text-[10px] opacity-70 mt-0.5">{r.cr_date ? format(new Date(r.cr_date), 'HH:mm') : '-'}</div>
                                                    </td>
                                                <td className="px-3 py-3 font-bold text-slate-800 align-top">
                                                    <div className="truncate max-w-[200px] text-sm" title={r.inspection_type?.name}>{r.inspection_type?.name || "UNK"}</div>
                                                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-medium w-fit uppercase text-muted-foreground border-slate-200 shadow-none mt-1">
                                                        {r.inspection_type_code || r.inspection_type?.code || 'UNK'}
                                                    </Badge>
                                                    {(r.tape_id || r.inspection_data?._meta_timecode || r.tape_count_no) && (
                                                        <div className="mt-1.5 flex flex-col gap-1">
                                                            {r.tape_id && (
                                                                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                                                                    {jobTapes.find(t => t.tape_id === r.tape_id)?.tape_no || `TAPE ID: ${r.tape_id}`}
                                                                </span>
                                                            )}
                                                            {(r.inspection_data?._meta_timecode || r.tape_count_no) && (
                                                                <div className="text-[11px] font-mono font-medium text-slate-500 flex items-center gap-1.5">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                                    {formatCounter(r.inspection_data?._meta_timecode || r.tape_count_no)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 align-top text-slate-700">
                                                    <div className="font-bold text-sm">{r.structure_components?.q_id || '-'}</div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">{r.component_type || r.structure_components?.code || '-'}</div>
                                                </td>
                                                <td className="px-3 py-3 text-center text-sm font-medium text-slate-600 align-top">
                                                    {r.elevation ? `${r.elevation}m` : (r.fp_kp || '-')}
                                                </td>
                                                <td className="px-3 py-3 align-top text-center">
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
                                                <td className="px-3 py-3 text-right align-top">
                                                    <div className="flex items-center justify-end gap-1 group-hover:opacity-100 opacity-60 transition-opacity mt-0.5">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <button className="p-1.5 px-2 bg-slate-100 hover:bg-blue-600 hover:text-white rounded flex items-center gap-1.5 transition-colors text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:text-white" title="Report Options">
                                                                    <FileText className="w-3.5 h-3.5" /> Actions
                                                                </button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-48">
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
                                                </tr>
                                            );
                                        })}

                                        {displayRecords.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-3 py-12 text-center bg-white/50">
                                                    {syncLoading ? (
                                                        <div className="flex flex-col items-center gap-3 animate-in fade-in duration-500">
                                                            <div className="relative">
                                                                <div className="absolute inset-0 blur-sm bg-blue-400/20 rounded-full animate-pulse" />
                                                                <Loader2 className="w-8 h-8 animate-spin text-blue-600 relative" />
                                                            </div>
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Synchronizing</span>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Fetching live workspace data...</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-2 text-slate-300">
                                                            <Search className="w-8 h-8 opacity-20" />
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inventory Empty</span>
                                                                <p className="text-[9px] font-bold text-slate-400/60 uppercase tracking-tighter">No events match your current filter or session</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                            </table>
                        </ScrollArea>
                        )}
                    </Card>

                    {/* Captured Events PiP Portal */}
                    {capturedEventsPipWindow && createPortal(
                        <div className="h-screen w-screen flex flex-col bg-white overflow-hidden">
                            <div className="bg-slate-800 text-white px-3 py-2 text-[11px] font-bold uppercase tracking-widest flex justify-between items-center h-[40px] shrink-0">
                                <div className="flex items-center gap-2">
                                    <span>CAPTURED EVENTS (FLOATING)</span>
                                    <Badge className="bg-blue-600 text-white border-none text-[9px] h-4 leading-none font-bold uppercase tracking-wider flex items-center gap-1.5">
                                        {syncLoading && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                                        {currentRecords.length} Captured
                                    </Badge>
                                </div>
                                
                                <div className="flex-1 max-w-sm mx-4 relative hidden md:block">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                                    <Input 
                                        placeholder="Smart Filter..."
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

                                <div className="flex items-center gap-2">
                                    <button onClick={() => {
                                        if (capturedEventsPipWindow) {
                                            const s = capturedEventsPipWindow.screen;
                                            capturedEventsPipWindow.moveTo(s.availLeft || 0, s.availTop || 0);
                                            capturedEventsPipWindow.resizeTo(s.availWidth, s.availHeight);
                                        }
                                    }} className="text-white/50 hover:text-white p-1 hover:bg-white/10 rounded-full transition-all" title="Maximize">
                                        <Maximize2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => {
                                        if (capturedEventsPipWindow) {
                                            const s = capturedEventsPipWindow.screen;
                                            capturedEventsPipWindow.resizeTo(1000, 600);
                                            capturedEventsPipWindow.moveTo((s.availLeft || 0) + (s.availWidth - 1000) / 2, (s.availTop || 0) + (s.availHeight - 600) / 2);
                                        }
                                    }} className="text-white/50 hover:text-white p-1 hover:bg-white/10 rounded-full transition-all" title="Restore Size">
                                        <Minimize2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => capturedEventsPipWindow.close()} className="text-white/50 hover:text-white p-1 hover:bg-white/10 rounded-full transition-all" title="Close"><X className="w-4 h-4" /></button>
                                </div>
                            </div>
                            <ScrollArea className="flex-1 w-full relative">
                                <table className="w-full text-left text-xs whitespace-nowrap">
                                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-3 py-3 w-20 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort('cr_date')}>
                                                <div className="flex items-center gap-1.5">
                                                    Date {sortConfig.key === 'cr_date' ? (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />) : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />}
                                                </div>
                                            </th>
                                            <th className="px-3 py-3 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort('type')}>
                                                <div className="flex items-center gap-1.5">
                                                    Type {sortConfig.key === 'type' ? (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />) : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />}
                                                </div>
                                            </th>
                                            <th className="px-3 py-3 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort('component')}>
                                                <div className="flex items-center gap-1.5">
                                                    Component {sortConfig.key === 'component' ? (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />) : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />}
                                                </div>
                                            </th>
                                            <th className="px-3 py-3 text-center cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort('elev')}>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    Elev/KP {sortConfig.key === 'elev' ? (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />) : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />}
                                                </div>
                                            </th>
                                            <th className="px-3 py-3 text-center cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort('status')}>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    Status {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />) : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />}
                                                </div>
                                            </th>
                                            <th className="px-3 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {displayRecords.map((r: any) => {
                                            const formatCounter = (val: any) => {
                                                if (!val) return null;
                                                if (typeof val === 'string' && val.includes(':')) return val;
                                                const sec = Number(val);
                                                if (!isNaN(sec)) {
                                                    const h = Math.floor(sec / 3600).toString().padStart(2, '0');
                                                    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
                                                    const s = Math.floor(sec % 60).toString().padStart(2, '0');
                                                    return `${h}:${m}:${s}`;
                                                }
                                                return val;
                                            };
                                            return (
                                                <tr key={r.insp_id} className="hover:bg-slate-50 group">
                                                    <td className="px-3 py-3 text-slate-600 align-top">
                                                        <div className="text-sm font-medium">{r.inspection_date ? format(new Date(r.inspection_date), 'dd MMM') : '-'}</div>
                                                        <div className="text-[10px] opacity-70 mt-0.5">{r.inspection_time?.slice(0, 5)}</div>
                                                    </td>
                                                    <td className="px-3 py-3 font-bold text-slate-800 align-top">
                                                        <div className="truncate max-w-[200px] text-sm" title={r.inspection_type?.name}>{r.inspection_type?.name || "UNK"}</div>
                                                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-medium w-fit uppercase text-muted-foreground border-slate-200 shadow-none mt-1">
                                                            {r.inspection_type_code || r.inspection_type?.code || 'UNK'}
                                                        </Badge>
                                                        {(r.tape_id || r.inspection_data?._meta_timecode || r.tape_count_no) && (
                                                            <div className="mt-1.5 flex flex-col gap-1">
                                                                {r.tape_id && (
                                                                    <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                                                                        {jobTapes.find(t => t.tape_id === r.tape_id)?.tape_no || `TAPE ID: ${r.tape_id}`}
                                                                    </span>
                                                                )}
                                                                {(r.inspection_data?._meta_timecode || r.tape_count_no) && (
                                                                    <div className="text-[11px] font-mono font-medium text-slate-500 flex items-center gap-1.5">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                                        {formatCounter(r.inspection_data?._meta_timecode || r.tape_count_no)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 align-top text-slate-700">
                                                        <div className="font-bold text-sm">{r.structure_components?.q_id || '-'}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">{r.component_type || r.structure_components?.code || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-3 text-center text-sm font-medium text-slate-600 align-top">
                                                        {r.elevation ? `${r.elevation}m` : (r.fp_kp || '-')}
                                                    </td>
                                                    <td className="px-3 py-3 align-top text-center">
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
                                                    <td className="px-3 py-3 text-right align-top">
                                                        <div className="flex items-center justify-end gap-1 group-hover:opacity-100 opacity-60 transition-opacity mt-0.5">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <button className="p-1.5 px-2 bg-slate-100 hover:bg-blue-600 hover:text-white rounded flex items-center gap-1.5 transition-colors text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:text-white" title="Report Options">
                                                                        <FileText className="w-3.5 h-3.5" /> Actions
                                                                    </button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-48">
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
                                                </tr>
                                            );
                                        })}

                                        {displayRecords.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-3 py-12 text-center bg-white/50">
                                                    {syncLoading ? (
                                                        <div className="flex flex-col items-center gap-3 animate-in fade-in duration-500">
                                                            <div className="relative">
                                                                <div className="absolute inset-0 blur-sm bg-blue-400/20 rounded-full animate-pulse" />
                                                                <Loader2 className="w-8 h-8 animate-spin text-blue-600 relative" />
                                                            </div>
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Synchronizing</span>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Fetching live workspace data...</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-2 text-slate-300">
                                                            <Search className="w-8 h-8 opacity-20" />
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inventory Empty</span>
                                                                <p className="text-[9px] font-bold text-slate-400/60 uppercase tracking-tighter">No events match your current filter or session</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </ScrollArea>
                        </div>,
                        capturedEventsPipWindow.document.body
                    )}
                </div>

                {/* ======== COL 3: SELECTION & HISTORY (RIGHT) ======== */}
                <div className="w-[360px] flex flex-col gap-3 shrink-0 overflow-hidden">

                    {/* 3. Component Target Selection */}
                    <Card className="flex flex-col h-[400px] border-slate-200 shadow-sm rounded-md shrink-0 bg-white overflow-hidden">
                        <div className="bg-slate-800 text-white flex items-center justify-between pl-1 pr-3 shrink-0">
                            <div className="flex">
                                <button onClick={() => setCompView("LIST")} className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${compView === 'LIST' ? 'bg-blue-600 text-white border-b border-blue-600' : 'text-slate-400 hover:text-white border-b border-transparent'}`}>COMPONENT LIST</button>
                                <button onClick={() => setCompView("MODEL_3D")} className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${compView === 'MODEL_3D' ? 'bg-blue-600 text-white border-b border-blue-600' : 'text-slate-400 hover:text-white border-b border-transparent'}`}><Box className="w-3.5 h-3.5 mb-0.5" /> 3D</button>
                            </div>
                            {compView === "LIST" && <Search className="w-3.5 h-3.5 text-slate-400" />}
                        </div>

                        {compView === "LIST" && (
                            <div className="flex flex-col flex-1 overflow-hidden min-h-0">
                                <div className="p-2 border-b border-slate-100 shrink-0">
                                    <Input placeholder="Search component..." className="h-8 text-xs bg-slate-50" value={compSearchTerm} onChange={(e: any) => setCompSearchTerm(e.target.value)} />
                                </div>
                                <ScrollArea className="flex-1 p-2">
                                    <div className="space-y-4">
                                        <div>
                                            <div className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-1 rounded tracking-widest mb-1.5 border border-blue-100">SOW Scope</div>
                                            <div className="space-y-1">
                                                {componentsSow.filter((c: any) => {
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

                                                    const term = compSearchTerm.toLowerCase().trim();
                                                    if (!term) return true;
                                                    const qid = (c.name || '').toLowerCase();
                                                    const code = (c.raw?.code || '').toLowerCase();
                                                    const legStr = `${c.startLeg || ''} ${c.endLeg || ''}`.toLowerCase();
                                                    const elevStr = `${c.startElev || ''} ${c.endElev || ''}`.toLowerCase();
                                                    return qid.includes(term) || code.includes(term) || legStr.includes(term) || elevStr.includes(term);
                                                }).map((c: any) => {
                                                    const isSelected = selectedComp?.id === c.id;
                                                    return (
                                                        <button key={c.id} onClick={() => { handleComponentSelection(c); }} className={`w-full text-left p-2 rounded text-xs transition-all border ${isSelected ? 'bg-blue-600 text-white border-blue-700 shadow-md' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                                                            <div className="flex justify-between font-bold">
                                                                <div className="flex items-center gap-2">
                                                                    <span>{c.name}</span>
                                                                    <div
                                                                        onClick={(e) => { e.stopPropagation(); setSelectedComp(c); setCompSpecDialogOpen(true); }}
                                                                        className={`p-1 rounded hover:bg-black/10 transition-colors ${isSelected ? 'text-blue-100' : 'text-slate-300 hover:text-blue-500'}`}
                                                                        title="View Component Specs"
                                                                    >
                                                                        <Info className="w-3.5 h-3.5" />
                                                                    </div>
                                                                </div>
                                                                <span className="font-mono opacity-75 text-[10px]">{c.depth}</span>
                                                            </div>
                                                            {(c.startNode !== '-' || c.endNode !== '-') && (
                                                                <div className={`text-[9px] font-mono mt-0.5 ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>{c.startNode} â†’ {c.endNode}</div>
                                                            )}
                                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                                {c.taskStatuses?.length > 0 ? c.taskStatuses.filter((ts: any) => {
                                                                    const it = (allInspectionTypes || []).find((type: any) => type.code === ts.code || type.name === ts.code);
                                                                    if (!it) return true;
                                                                    const isRov = it.metadata?.rov === 1 || it.metadata?.rov === "1" || it.metadata?.rov === true || (it.metadata?.job_type && it.metadata.job_type.includes("ROV"));
                                                                    const isDiving = it.metadata?.diving === 1 || it.metadata?.diving === "1" || it.metadata?.diving === true || (it.metadata?.job_type && it.metadata.job_type.includes("DIVING"));
                                                                    if (inspMethod === "DIVING" && !isDiving) return false;
                                                                    if (inspMethod === "ROV" && !isRov) return false;
                                                                    return true;
                                                                }).map((ts: any, idx: number) => {
                                                                    const s = ts.status || 'pending';
                                                                    const hasAnom = currentRecords.some((r: any) => r.has_anomaly && (r.inspection_type?.code === ts.code || r.inspection_type_code === ts.code) && r.component_id === c.id);
                                                                    return (
                                                                        <span key={idx} className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isSelected ? (
                                                                            hasAnom ? 'bg-red-400/30 text-red-100' :
                                                                                s === 'completed' ? 'bg-green-400/30 text-green-100' :
                                                                                    s === 'incomplete' ? 'bg-amber-400/30 text-amber-100' :
                                                                                        'bg-white/20 text-blue-100'
                                                                        ) : (
                                                                            hasAnom ? 'bg-red-50 text-red-700 border border-red-200' :
                                                                                s === 'completed' ? 'bg-green-50 text-green-700 border border-green-200' :
                                                                                    s === 'incomplete' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                                                                        'bg-slate-50 text-slate-500 border border-slate-200'
                                                                        )
                                                                            }`}>
                                                                            <span className={`w-1.5 h-1.5 rounded-full ${hasAnom ? 'bg-red-500' :
                                                                                s === 'completed' ? 'bg-green-500' :
                                                                                    s === 'incomplete' ? 'bg-amber-500' :
                                                                                        'bg-slate-400'
                                                                                }`} />
                                                                            {ts.code}
                                                                        </span>
                                                                    );
                                                                }) : (
                                                                    <span className={`text-[10px] font-mono ${isSelected ? 'opacity-85' : 'opacity-85'}`}>Tasks: {c.tasks?.filter((t: string) => {
                                                                        const it = (allInspectionTypes || []).find((type: any) => type.code === t || type.name === t);
                                                                        if (!it) return true;
                                                                        const isRov = it.metadata?.rov === 1 || it.metadata?.rov === "1" || it.metadata?.rov === true || (it.metadata?.job_type && it.metadata.job_type.includes("ROV"));
                                                                        const isDiving = it.metadata?.diving === 1 || it.metadata?.diving === "1" || it.metadata?.diving === true || (it.metadata?.job_type && it.metadata.job_type.includes("DIVING"));
                                                                        if (inspMethod === "DIVING" && !isDiving) return false;
                                                                        if (inspMethod === "ROV" && !isRov) return false;
                                                                        return true;
                                                                    }).join(', ')}</span>
                                                                )}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-1 rounded tracking-widest mb-1.5 mt-2 border border-slate-200">Non-SOW</div>
                                            <div className="space-y-1">
                                                {componentsNonSow.filter((c: any) => {
                                                    const term = compSearchTerm.toLowerCase().trim();
                                                    if (!term) return true;
                                                    const qid = (c.name || '').toLowerCase();
                                                    const code = (c.raw?.code || '').toLowerCase();
                                                    const legStr = `${c.startLeg || ''} ${c.endLeg || ''}`.toLowerCase();
                                                    const elevStr = `${c.startElev || ''} ${c.endElev || ''}`.toLowerCase();
                                                    return qid.includes(term) || code.includes(term) || legStr.includes(term) || elevStr.includes(term);
                                                }).map((c: any) => (
                                                    <button key={c.id} onClick={() => { handleComponentSelection(c); }} className={`w-full text-left p-2 rounded text-xs transition-all border ${selectedComp?.id === c.id ? 'bg-slate-700 text-white border-slate-800 shadow-md' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                                                        <div className="flex justify-between font-bold">
                                                            <div className="flex items-center gap-2">
                                                                <span>{c.name}</span>
                                                                <div
                                                                    onClick={(e) => { e.stopPropagation(); setSelectedComp(c); setCompSpecDialogOpen(true); }}
                                                                    className={`p-1 rounded hover:bg-black/10 transition-colors ${selectedComp?.id === c.id ? 'text-slate-300' : 'text-slate-300 hover:text-blue-500'}`}
                                                                    title="View Component Specs"
                                                                >
                                                                    <Info className="w-3.5 h-3.5" />
                                                                </div>
                                                            </div>
                                                            <span className="font-mono opacity-75 text-[10px]">{c.depth}</span>
                                                        </div>
                                                        {(c.startNode !== '-' || c.endNode !== '-') && (
                                                            <div className={`text-[9px] font-mono mt-0.5 ${selectedComp?.id === c.id ? 'text-slate-300' : 'text-slate-400'}`}>{c.startNode} â†’ {c.endNode}</div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </ScrollArea>
                            </div>
                        )}

                        {compView === "MODEL_3D" && (
                            <div className="flex-1 bg-slate-900 flex flex-col items-center justify-center p-4 text-center border-dashed border-2 border-slate-800 m-2 rounded-lg relative overflow-hidden">
                                <Layers className="w-12 h-12 mb-3 text-slate-700/50" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">3D Viewer</span>
                            </div>
                        )}
                    </Card>

                    {/* 4. Historical Records Overview */}
                    <Card className="flex flex-col flex-1 border-slate-200 shadow-sm rounded-md bg-white overflow-hidden min-h-0">
                        <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex justify-between items-center shrink-0">
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">HISTORY DATA</span>
                            <History className="w-3 h-3 text-slate-400" />
                        </div>
                        <ScrollArea className="flex-1 p-3">
                            {historyLoading ? (
                                <div className="flex flex-col items-center justify-center p-12 gap-3 animate-in fade-in duration-500">
                                    <div className="relative">
                                        <div className="absolute inset-0 blur-md bg-blue-400/20 rounded-full animate-pulse" />
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-600 relative" />
                                    </div>
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Retrieving History</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Looking up past inspection data...</span>
                                    </div>
                                </div>
                            ) : !selectedComp ? (
                                <div className="text-center text-slate-400 text-xs py-10">Select component to view history</div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Current Workpack Section */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="h-px flex-1 bg-slate-100"></div>
                                            <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Current Workpack</span>
                                            <div className="h-px flex-1 bg-slate-100"></div>
                                        </div>
                                        <div className="space-y-2">
                                            {currentCompRecords.length === 0 ? (
                                                <div className="text-[10px] text-slate-400 p-3 text-center bg-slate-50/50 rounded border border-dashed border-slate-200 italic font-medium">No records in current scope</div>
                                            ) : currentCompRecords.map((r, i) => (
                                                <div key={r.id} className="flex flex-col gap-1 p-2 bg-white rounded border border-slate-100 text-[11px] shadow-sm hover:border-blue-200 transition-colors">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-slate-700">{r.type}</span>
                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${r.status === 'Complete' ? 'bg-green-100 text-green-700' : (r.status === 'Incomplete' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}`}>{r.status}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                                                        <span>{inspMethod === 'DIVING' ? 'Dive' : 'Dep'}: {r.diveNo || 'N/A'}</span>
                                                        <span>Tape: {r.tapeNo}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                                                        <span>{r.date} {r.time?.slice(0, 5)}</span>
                                                        <span className="italic truncate max-w-[120px]">"{r.finding}"</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Historical Data Section */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="h-px flex-1 bg-slate-100"></div>
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Historical Data</span>
                                            <div className="h-px flex-1 bg-slate-100"></div>
                                        </div>
                                        <div className="space-y-2">
                                            {historicalRecords.length === 0 ? (
                                                <div className="text-[10px] text-slate-400 p-3 text-center bg-slate-50/50 rounded border border-dashed border-slate-200 italic font-medium">No historical records found</div>
                                            ) : historicalRecords.map((r, i) => (
                                                <div key={i} className="flex flex-col gap-1 p-2 bg-slate-50/50 rounded border border-slate-100 text-[11px] opacity-80 hover:opacity-100 transition-opacity">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-slate-600">{r.type} ({r.year})</span>
                                                        <span className={`px-1 py-0.5 rounded text-[7.5px] font-black uppercase ${r.status === 'Complete' ? 'bg-slate-200 text-slate-600' : 'bg-red-50 text-red-600'}`}>{r.status}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-[8px] font-bold text-slate-400 uppercase">
                                                        <span>{inspMethod === 'DIVING' ? 'Dive' : 'Dep'}: {r.diveNo || 'N/A'}</span>
                                                        <span>Tape: {r.tapeNo}</span>
                                                    </div>
                                                    <div className="text-[8px] text-slate-400 mt-0.5 italic">
                                                        "{r.finding}"
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </ScrollArea>
                    </Card>

                </div>

            </div>

            <WorkspaceDialogs
                supabase={supabase}
                jobPackId={jobPackId}
                structureId={structureId}
                sowId={sowId}
                sowIdFull={sowIdFull}
                headerData={headerData}
                inspMethod={inspMethod}
                currentRecords={currentRecords}
                recordedFiles={recordedFiles}
                pendingAttachments={pendingAttachments}
                setPendingAttachments={setPendingAttachments}
                states={{
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
                    calibrationDialogOpen,
                    rovCalibrationDialogOpen,
                    specDialogOpen: false,


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
                }}
                setters={{
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
                    setCalibrationDialogOpen,
                    setRovCalibrationDialogOpen,
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
                }}
                handlers={{
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
                }}
                refs={{
                    fileInputRef
                }}
            />


        </div>
    );
}



