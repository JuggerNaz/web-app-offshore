"use client";

import * as React from "react";
import { useState, useEffect, Suspense, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSearchParams,
    useRouter } from "next/navigation";
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
    ArrowUpDown
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { generateInspectionReport } from "@/utils/report-generators/inspection-report";
import { generateDefectAnomalyReport } from "@/utils/report-generators/defect-anomaly-report";
import { generateMultiInspectionReport } from "@/utils/report-generators/multi-inspection-report";

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
    const initialMode = searchParams.get('mode') as "DIVING" | "ROV" | null;

    // Jotai State Sync for Dialog
    const [, setGlobalUrlId] = useAtom(urlId);
    const [, setGlobalUrlType] = useAtom(urlType);

    useEffect(() => {
        if (structureId) {
            setGlobalUrlId(Number(structureId));
            setGlobalUrlType("platform");
        }
    }, [structureId, setGlobalUrlId, setGlobalUrlType]);

    // Mode
    const [inspMethod, setInspMethod] = useState<"DIVING" | "ROV">(initialMode || "DIVING");

    const [deployments, setDeployments] = useState<any[]>([]);
    const [activeDep, setActiveDep] = useState<{ id: string, jobNo?: string, name: string, raw?: any } | null>(null);

    // Live session records
    const [currentRecords, setCurrentRecords] = useState<any[]>([]);
    const [historicalRecords, setHistoricalRecords] = useState<any[]>([]);
    const [currentCompRecords, setCurrentCompRecords] = useState<any[]>([]);

    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
        key: 'cr_date',
        direction: 'desc'
    });

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
    const [isFetchingDeps, setIsFetchingDeps] = useState(true);
    const [isDeploymentValid, setIsDeploymentValid] = useState(true);
    const [syncLoading, setSyncLoading] = useState(false);
    const [componentsSow, setComponentsSow] = useState<any[]>([]);
    const [componentsNonSow, setComponentsNonSow] = useState<any[]>(COMPONENTS_NON_SOW);
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
    const [findingType, setFindingType] = useState<"Pass" | "Anomaly" | "Finding" | "Incomplete">("Pass");
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
        setDynamicProps(prev => ({ ...prev, [name]: value }));
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
            />
        );
    };

    const [criteriaRules, setCriteriaRules] = useState<any[]>([]);
    const [pendingRule, setPendingRule] = useState<any>(null);
    const [showCriteriaConfirm, setShowCriteriaConfirm] = useState(false);
    const [showRemovalConfirm, setShowRemovalConfirm] = useState(false);
    const [lastAutoMatchedRuleId, setLastAutoMatchedRuleId] = useState<string | null>(null);
    const [isManualOverride, setIsManualOverride] = useState(false);

    // Auto-update pending attachment titles for Anomaly/Finding
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
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewRecord, setPreviewRecord] = useState<any>(null);

    const jpParam = searchParams.get('jpName');
    const strParam = searchParams.get('structName');
    const sowParam = searchParams.get('sowReport');

    // Header Data
    const [headerData, setHeaderData] = useState<{ jobpackName: string, platformName: string, sowReportNo: string, structureType: 'platform' | 'pipeline' }>({
        jobpackName: jpParam || (jobPackId ? `JP-${jobPackId}` : "N/A"),
        platformName: strParam || (structureId ? `Struct ${structureId}` : "N/A"),
        sowReportNo: sowParam || (sowId ? `SOW-${sowId}` : "N/A"),
        structureType: 'platform'
    });

    /**
     * Robust SOW Status Synchronization
     * Derived from aggregated insp_records for a specific COMPONENT + TASK
     */
    const syncSowStatus = useCallback(async (compId: number, taskInput: string) => {
        if (!sowId) return;

        // 1. Resolve the canonical task info FIRST
        // This handles cases where taskInput is either a Code (RGVI) or Name (General Visual Inspection)
        const it = allInspectionTypes.find(t => 
            t.code === taskInput || 
            t.name?.toLowerCase() === taskInput.toLowerCase()
        );
        
        if (!it) {
            console.warn(`[SOW Sync] Skip: Could not resolve task "${taskInput}" in inspection library.`);
            return;
        }

        const taskCode = it.code; // Canonical code

        // 2. Get all records for this component + canonical task
        const { data: records, error: fetchError } = await supabase.from('insp_records')
            .select('insp_id, status, has_anomaly, inspection_data')
            .eq('component_id', compId)
            .eq('inspection_type_code', taskCode)
            .order('inspection_date', { ascending: false })
            .order('inspection_time', { ascending: false });

        if (fetchError) {
            console.error(`[SOW Sync] Status fetch failed for ${taskCode}:`, fetchError);
            return;
        }

        let newStatus: 'pending' | 'completed' | 'incomplete' = 'pending';
        
        if (records && records.length > 0) {
            // Check for incomplete (latest record takes precedence for 'incomplete')
            const latest = records[0];
            if (latest.status?.toLowerCase() === 'incomplete') {
                newStatus = 'incomplete';
            } else {
                newStatus = 'completed';
            }
        }

        // 3. Upsert into u_sow_items (Aligned with documented schema)
        const { data: existing } = await supabase.from('u_sow_items')
            .select('id')
            .eq('sow_id', Number(sowId))
            .eq('component_id', compId)
            .eq('inspection_code', taskCode) // Canonical lookup
            .maybeSingle();

        const userRes = await supabase.auth.getUser();
        const user = userRes.data.user;
        const userName = user?.user_metadata?.full_name || user?.email || user?.id || 'system';

        if (existing) {
            // Update: Set status and metadata
            const { error: updateErr } = await supabase.from('u_sow_items')
                .update({ 
                    status: newStatus,
                    updated_at: new Date().toISOString(),
                    updated_by: userName
                })
                .eq('id', existing.id);
            
            if (updateErr) console.error("[SOW Sync] Update error:", updateErr);
        } else if (newStatus !== 'pending') {
            // Auto-add to SOW if we have records but no SOW entry
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
                    .select('total_items, pending_items')
                    .eq('id', Number(sowId))
                    .maybeSingle();

                if (sowData) {
                    await supabase.from('u_sow').update({
                        total_items: (sowData.total_items || 0) + 1,
                        updated_by: userName,
                        updated_at: new Date().toISOString()
                    }).eq('id', Number(sowId));
                }
            } else {
                console.error("[SOW Sync] Auto-add SOW failed:", insertError);
                toast.error(`Database error adding ${compObj?.name || 'component'}: ${insertError.message}`);
            }
        }

        // 4. Invalidate query to refresh UI (including sidebar)
        queryClient.invalidateQueries({ queryKey: ['sow-data'] });
    }, [sowId, supabase, queryClient, allInspectionTypes, allComps, headerData]);

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

            // Fetch Structure Name
            if (!strParam) {
                const { data: structData } = await supabase.from('structure').select('str_name').eq('str_id', Number(structureId)).single();
                if (structData?.str_name) platformName = structData.str_name;
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
            }

            setHeaderData({ jobpackName, platformName, sowReportNo, structureType: detectedStructureType });
        }
        fetchHeaderInfo();
    }, [jobPackId, structureId, sowId, sowIdFull, supabase, jpParam, strParam, sowParam]);

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
        setFindingType("Pass");
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
            setDataAcqError('No settings configured. Go to Settings → Data Acquisition to configure.');
            setDataAcqConnecting(false);
            toast.error('Data acquisition settings not found. Please configure in Settings → Data Acquisition.');
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
            // CRITICAL: Ensure depId is a number if possible to avoid Supabase 400 Bad Request
            const depId = !isNaN(Number(activeDep.id)) ? Number(activeDep.id) : activeDep.id;
            console.log(`[Sync] Starting sync for ${inspMethod} | Dep ID: ${depId} (Type: ${typeof depId})`);

            // 1. Movements
            const movTable = inspMethod === "DIVING" ? 'insp_dive_movements' : 'insp_rov_movements';
            const movCol = inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id';
            const { data: movs, error: movErr } = await supabase.from(movTable).select('*').eq(movCol, depId).order('movement_time', { ascending: true });

            if (movErr) console.error("[Sync] Movement fetch error:", movErr);

            if (movs && movs.length > 0) {
                const last = movs[movs.length - 1];
                let mvtLabel = last.movement_type || "Awaiting Deployment";
                if (inspMethod === 'DIVING') {
                    const mappedItem = [...AIR_DIVE_ACTIONS, ...BELL_DIVE_ACTIONS].find(a => a.value === mvtLabel || a.label === mvtLabel);
                    if (mappedItem) mvtLabel = mappedItem.label;
                }
                setCurrentMovement(mvtLabel);
                // Store raw event_time for calculations
                setDiveStartTime(movs[0].movement_time || movs[0].event_time);

                // Find recovery event if it exists
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

            // 2. Video Tapes & Events
            let { data: tapes, error: tapeErr } = await supabase.from('insp_video_tapes').select('*').eq(inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id', depId).order('tape_id', { ascending: false });

            if (tapeErr) console.error("[Sync] Tape fetch error:", tapeErr);

            // FALLBACK: If no tapes found in insp_video_tapes, check if there are any used in insp_records
            if (!tapes || tapes.length === 0) {
                console.log("[Sync] No tapes found in insp_video_tapes table. Checking insp_records for associated tapes...");
                const { data: recTapes } = await supabase.from('insp_records')
                    .select('tape_id')
                    .eq(inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id', depId)
                    .not('tape_id', 'is', null);

                if (recTapes && recTapes.length > 0) {
                    const uniqueTapeIds = Array.from(new Set(recTapes.map(r => r.tape_id)));
                    console.log("[Sync] Found unique tape IDs in records:", uniqueTapeIds);
                    // Create virtual tape objects for UI compatibility
                    tapes = uniqueTapeIds.map(tid => ({ tape_id: tid, tape_no: `TAPE-${tid}`, status: 'ACTIVE' })) as any;
                }
            }

            const tapeIds = tapes?.map(t => t.tape_id) || [];
            console.log(`[Sync] Active Tapes:`, tapeIds);

            setJobTapes(tapes || []);
            if (tapes && tapes.length > 0) {
                const latestTape = tapes[0];
                setTapeNo(latestTape.tape_no);
                setTapeId(latestTape.tape_id);
                setActiveChapter(latestTape.chapter_no || 1);

                const { data: lastLog } = await supabase.from('insp_video_logs')
                    .select('*')
                    .eq('tape_id', latestTape.tape_id)
                    .order('event_time', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const { data: stateLog } = await supabase.from('insp_video_logs')
                    .select('event_type')
                    .eq('tape_id', latestTape.tape_id)
                    .in('event_type', ['NEW_LOG_START', 'RESUME', 'PAUSE', 'END'])
                    .order('event_time', { ascending: false })
                    .limit(1)
                    .maybeSingle();

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
            if (tapeIds.length > 0) {
                const { data: logs, error: logErr } = await supabase.from('insp_video_logs')
                    .select('*')
                    .in('tape_id', tapeIds)
                    .order('event_time', { ascending: false });

                if (logErr) console.error("[Sync] Video log fetch error:", logErr);

                if (logs) {
                    allEv.push(...logs.map((l: any) => ({
                        id: `log_${l.video_log_id}`,
                        realId: l.video_log_id,
                        time: l.timecode_start || '00:00:00',
                        action: l.event_type === "NEW_LOG_START" ? "Start Tape" : l.event_type === "END" ? "Stop Tape" : l.event_type === "PAUSE" ? "Pause" : l.event_type === "RESUME" ? "Resume" : l.event_type,
                        logType: 'video_log',
                        eventTime: parseDbDate(l.event_time).toISOString(),
                        inspectionId: l.inspection_id
                    })));
                }
            }

            // 4. Fetch Inspection Records
            const inspCol = inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id';
            const { data: insps, error: inspErr } = await supabase.from('insp_records').select(`
                *,
                inspection_type:inspection_type_id!left(id, code, name),
                structure_components:component_id!left (q_id, code)
            `).eq(inspCol, depId);

            if (inspErr) {
                console.error("[Sync] Inspection fetch error:", inspErr);
                // Fallback basic fetch
                const { data: fallbackInsps } = await supabase.from('insp_records').select('*').eq(inspCol, depId);
                if (fallbackInsps) setCurrentRecords(fallbackInsps);
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
                
                inspsWithCounts.forEach(r => {
                    // Only add to allEv if not already represented by a video log with same inspectionId
                    const alreadyInLogs = allEv.some(ev => ev.inspectionId === r.insp_id);
                    if (!alreadyInLogs) {
                        const status = r.has_anomaly || (r.status === 'Anomaly' || r.status === 'Defect') ? 'ANOMALY' : 'INSPECTION';
                        allEv.push({
                            id: `insp_${r.insp_id}`,
                            realId: r.insp_id,
                            time: r.inspection_data?._meta_timecode || '00:00:00',
                            action: status,
                            logType: 'insp',
                            eventTime: r.inspection_date && r.inspection_time ? format(parseDbDate(`${r.inspection_date} ${r.inspection_time}`), "yyyy-MM-dd'T'HH:mm:ss") : format(new Date(), "yyyy-MM-dd'T'HH:mm:ss")
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
        }
    }, [activeDep, inspMethod, supabase, parseDbDate]);


    // Active deployment effect: sync tape, movements, records
    useEffect(() => {
        syncDeploymentState();
    }, [syncDeploymentState]);

    const fetchHistory = useCallback(async () => {
        if (!selectedComp || !structureId) return;
        
        // Fetch all records for this component (no FK joins - they are unreliable)
        const { data, error } = await supabase.from('insp_records')
            .select('*')
            .eq('component_id', selectedComp.id)
            .order('cr_date', { ascending: false });

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
                status: r.has_anomaly ? 'Anomaly' : (r.status === 'INCOMPLETE' ? 'Incomplete' : 'Pass'),
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
        setVideoEvents([{ id: optimisticId, realId: 0, time: tcode, action, logType: 'video_log', eventTime }, ...videoEvents]);

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
            const { data, error } = await supabase.from('insp_records')
                .select('*')
                .eq(jobCol, activeDep.id)
                .eq('inspection_type_code', reqCode)
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
    }, [activeSpec, activeDep?.id, allInspectionTypes, inspMethod]);

    // Handle method switch overriding deps
    useEffect(() => {
        async function fetchDeps() {
            setIsFetchingDeps(true);
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

            const { data, error } = await query;
            let results = data || [];
            if (error) {
                console.warn("[fetchDeps] Primary fetch error (will try fallback):", error.message);
                results = [];
            }

            if (results.length === 0) {
                console.log(`[fetchDeps] No records with strict filters. Trying fallback (jobpack only)...`);
                const { data: fallbackData, error: fbErr } = await supabase.from(table).select('*').eq('jobpack_id', queryJobPackId).order(idCol, { ascending: false }).limit(10);
                if (!fbErr && fallbackData) results = fallbackData;
            }

            // DEEP FALLBACK: If still empty, check if any inspection records exist for this jobpack/structure
            // This happens if the job records were deleted but the inspection records remain.
            if (results.length === 0) {
                console.log(`[fetchDeps] No job records found in ${table}. Checking insp_records...`);
                const targetColumn = inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id';

                const { data: recJobs } = await supabase.from('insp_records')
                    .select(targetColumn)
                    .eq('jobpack_id', queryJobPackId)
                    .eq('structure_id', Number(structureId))
                    .not(targetColumn, 'is', null)
                    .limit(10);

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
            }
            setIsFetchingDeps(false);
        }
        fetchDeps();
    }, [inspMethod, jobPackId, structureId, supabase]);


    // Replacement: useQuery for SOW and Component Data
    const { data: sowAndComps, isLoading: isSowLoading } = useQuery({
        queryKey: ['sow-data', structureId, sowId, inspMethod],
        queryFn: async () => {
            if (!sowId || !structureId) return { assigned: [], unassigned: [], all: [] };

            // 1. Fetch ALL components
            const { data: allCompsData } = await supabase.from('structure_components')
                .select('*')
                .eq('structure_id', parseInt(structureId));

            if (!allCompsData) return { assigned: [], unassigned: [], all: [] };

            // 2. Fetch SOW items
            const { data: sowItems } = await supabase.from('u_sow_items')
                .select('*, inspection_type:inspection_type_id!left(id, code, name, metadata)')
                .eq('sow_id', sowId);

            const assignedCompsMap = new Map<number, { code: string; status: string }[]>();

            if (sowItems) {
                sowItems.forEach(item => {
                    const md = item.inspection_type?.metadata || {};
                    const isRov = md.rov === 1 || md.rov === "1" || md.rov === true || md.job_type?.includes('ROV');
                    const isDiving = md.diving === 1 || md.diving === "1" || md.diving === true || md.job_type?.includes('DIVING');

                    let isCompatible = true;
                    if (inspMethod === 'DIVING') isCompatible = isDiving;
                    if (inspMethod === 'ROV') isCompatible = isRov;

                    if (!isCompatible) return;

                    const matchingComp = (allCompsData || []).find((c: any) =>
                        (item.component_qid && c.q_id === item.component_qid) ||
                        (item.component_id && c.id === item.component_id) ||
                        (item.component_type && c.name === item.component_type)
                    );

                    if (matchingComp) {
                        if (!assignedCompsMap.has(matchingComp.id)) {
                            assignedCompsMap.set(matchingComp.id, []);
                        }
                        const taskToLog = item.inspection_code || item.inspection_name;
                        if (taskToLog) {
                            assignedCompsMap.get(matchingComp.id)?.push({ code: taskToLog, status: item.status || 'pending' });
                        }
                    }
                });
            }

            const assigned: any[] = [];
            const unassigned: any[] = [];

            (allCompsData || []).forEach((comp: any) => {
                const isAssigned = assignedCompsMap.has(comp.id);
                const md = comp.metadata || {};
                const startNode = md.start_node || md.f_node || md.Node_1 || comp.startNode || comp.start_node || '-';
                const endNode = md.end_node || md.s_node || md.Node_2 || comp.endNode || comp.end_node || '-';
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
                    startNode, endNode, startElev, endElev, nominalThk,
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
        staleTime: 30000, // 30 seconds
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
                const typeMap = new Map();
                typesData.forEach(item => {
                    const key = (item.code || '').trim() || (item.name || '').trim();
                    if (!key) return; // skip entirely broken records

                    const existing = typeMap.get(key);
                    if (!existing) {
                        typeMap.set(key, item);
                    } else {
                        // Check if existing or new has any valid default_properties
                        let existingHasProps = false;
                        let newHasProps = false;

                        try {
                            if (typeof existing.default_properties === 'string') existingHasProps = JSON.parse(existing.default_properties).length > 0;
                            else if (Array.isArray(existing.default_properties)) existingHasProps = existing.default_properties.length > 0;
                            else if (existing.default_properties && typeof existing.default_properties === 'object') existingHasProps = Object.keys(existing.default_properties).length > 0;
                        } catch (e) { }

                        try {
                            if (typeof item.default_properties === 'string') newHasProps = JSON.parse(item.default_properties).length > 0;
                            else if (Array.isArray(item.default_properties)) newHasProps = item.default_properties.length > 0;
                            else if (item.default_properties && typeof item.default_properties === 'object') newHasProps = Object.keys(item.default_properties).length > 0;
                        } catch (e) { }

                        // If current lacks props and the new one has props, override
                        if (!existingHasProps && newHasProps) {
                            typeMap.set(key, item);
                        }
                    }
                });
                setAllInspectionTypes(Array.from(typeMap.values()));
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
            const matchingOverrides = parsed.component_overrides?.filter((ov: any) =>
                ov.component_types && Array.isArray(ov.component_types) && ov.component_types.includes(compTypeStr)
            ) || [];
            
            // Use the last matching override (most recent) if available
            const lastMatch = matchingOverrides.length > 0 ? matchingOverrides[matchingOverrides.length - 1] : null;
            props = lastMatch?.fields || parsed.fields || (Array.isArray(parsed) ? parsed : []);
        }

        // 1. Historical data preservation (Legacy Fields)
        if (editingRecordId) {
            const recordRow = currentRecords.find(r => r.insp_id === editingRecordId);
            if (recordRow && recordRow.inspection_data) {
                try {
                    const recordData = typeof recordRow.inspection_data === 'string' 
                        ? JSON.parse(recordRow.inspection_data) 
                        : recordRow.inspection_data;
                    
                    Object.keys(recordData).forEach(key => {
                        const exists = props.find((p: any) => p.name === key || String(p.label).toLowerCase() === key.toLowerCase());
                        const ignoreKeys = ['has_anomaly', 'anomalydata', 'defectcode', 'defectreferenceno', 'northing', 'easting', 'elevation', 'kp', 'depth', 'fields', 'inspno', 'strid', 'str_id', 'compid', 'comp_id', 'inspid', 'insp_id', 'record_category', 'incomplete_reason', 'component_overrides'];
                        const lowerKey = key.toLowerCase();
                        
                        if (!exists && 
                            !ignoreKeys.includes(lowerKey) && 
                            !lowerKey.startsWith('_meta') && 
                            !lowerKey.startsWith('_is') && 
                            !lowerKey.includes('legacy') && 
                            typeof recordData[key] !== 'object') {
                            const niceLabel = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                            props.push({ name: key, label: `${niceLabel} (Legacy)`, type: 'text' });
                        }
                    });
                } catch (e) {}
            }
        }

        // 2. Add ROV specific fields (Northing, Easting) if needed
        const isRovType = inspMethod === 'ROV' || (String(activeIt?.code || '').toUpperCase().startsWith('R') ||
            String(activeIt?.name || '').toUpperCase().includes('ROV') ||
            activeIt?.metadata?.rov == 1);

        if (isRovType) {
            const extraFields = [];
            const existingNames = props.map((p: any) => String(p.name || p.label || '').toLowerCase());
            if (!existingNames.includes('northing')) extraFields.push({ name: 'northing', label: 'Northing', type: 'text' });
            if (!existingNames.includes('easting')) extraFields.push({ name: 'easting', label: 'Easting', type: 'text' });
            if (extraFields.length > 0) props = [...extraFields, ...props];
        }

        // 3. CP/UT Special Handling (Repeaters)
        const hasCpRdgField = props.some((sibling: any) => {
            const sLbl = String(sibling.label || sibling.name || '').toLowerCase();
            return sLbl.includes('cp rdg') || sLbl === 'cp_rdg';
        }) || dataAcqFields.some(f => f.targetField === 'cp_reading');

        const hasCpRepeater = props.some(p => {
            const l = String(p.label || p.name || '').toLowerCase();
            return l.includes('cp') && l.includes('reading');
        });

        if (hasCpRdgField && !hasCpRepeater) {
            props.push({
                name: 'cp_readings',
                label: 'CP Readings',
                type: 'repeater',
                subFields: [
                    { name: 'location', label: 'Location', type: 'text' },
                    { name: 'reading', label: 'Reading (mV)', type: 'number' }
                ]
            });
        }

        return props;
    }, [activeSpec, selectedComp, allInspectionTypes, editingRecordId, currentRecords, inspMethod, dataAcqFields]);

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
        const { data } = await supabase.from('attachment').select('*').eq('meta_type', 'COMPANY_PROFILE').limit(1).maybeSingle();
        return {
            companyName: data?.meta_name || "Deepwater Offshore",
            companyLogo: data?.file_url || "/logo.png"
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
            setFindingType("Pass");
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
            // Rule 1: Delete/Remove (will happen on save if findingType is Pass)
            setFindingType("Pass");
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
            if (isManualOverride || !criteriaRules.length || !isUserInteraction) return;

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
    }, [debouncedProps, selectedComp, activeSpec, criteriaRules, findingType, anomalyData.defectCode, lastAutoMatchedRuleId, isManualOverride]);

    const handleCommitRecord = async () => {
        if (!selectedComp || !activeSpec || !activeDep?.id) return;

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
                Object.keys(activeProps).forEach(key => {
                    if (key.startsWith('_')) return; // Ignore metadata
                    if (!currentFieldNames.has(key)) {
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
                inspection_time: (activeProps.inspection_time && activeProps.inspection_time !== '--') ? String(activeProps.inspection_time) : format(new Date(), 'HH:mm:ss'),
                description: recordNotes,
                status: findingType === 'Incomplete' ? 'INCOMPLETE' : 'COMPLETED',
                has_anomaly: findingType === 'Anomaly' || findingType === 'Finding',
                tape_id: tId,
                tape_count_no: (activeProps.tape_count_no && activeProps.tape_count_no !== '--') ? activeProps.tape_count_no : vidTimer,
                elevation: (() => {
                    const p = activeProps.elevation && activeProps.elevation !== '--' ? parseFloat(activeProps.elevation as string) : NaN;
                    if (!isNaN(p)) return p;
                    return selectedComp.lowestElev && selectedComp.lowestElev !== '-' ? parseFloat(selectedComp.lowestElev) : 0;
                })(),
                fp_kp: (activeProps.fp_kp !== undefined && activeProps.fp_kp !== '--') ? String(activeProps.fp_kp) : null,
                inspection_data: {
                    ...activeProps,
                    _meta_timecode: formatTime(vidTimer),
                    _meta_status: findingType,
                    incomplete_reason: findingType === 'Incomplete' ? incompleteReason : null
                },
                archived_data: newArchivedData
            };

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
                // 1. Sync the CURRENT component/task
                await syncSowStatus(selectedComp.id, it?.code || activeSpec);

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
                // If it was an anomaly/finding but now changed to Pass/Incomplete, remove the record
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
        setDynamicProps(fullRecord.inspection_data || {});
        // Save Context for Re-classification feature
        setOriginalRecordContext({
            component_id: fullRecord.component_id,
            inspection_type_id: fullRecord.inspection_type_id,
            inspection_type_code: fullRecord.inspection_type?.code || fullRecord.inspection_type_code,
            sow_report_no: fullRecord.sow_report_no
        });
        setArchivedData(fullRecord.archived_data || {});
        // Do not set debounced props immediately to avoid triggering validation without user interaction
        setDebouncedProps(fullRecord.inspection_data || {});
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
        setFindingType(fullRecord.has_anomaly ? (isFinding ? "Finding" : "Anomaly") : (fullRecord.status === 'INCOMPLETE' ? "Incomplete" : "Pass"));
        
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

    const generateAnomalyReportBlob = async (printFriendly?: boolean) => {
        if (!previewRecord) return;
        const record = previewRecord;
        try {
            const settings = await getReportHeaderData();
            const config = {
                reportNoPrefix: "ANOMALY",
                reportYear: new Date().getFullYear().toString(),
                preparedBy: { name: "Inspector", date: new Date().toLocaleDateString() },
                reviewedBy: { name: "", date: "" },
                approvedBy: { name: "", date: "" },
                watermark: { enabled: false, text: "", transparency: 0.1 },
                showContractorLogo: true,
                showPageNumbers: true,
                inspectionId: record.insp_id,
                returnBlob: true,
                printFriendly: printFriendly || false
            };
            return await generateDefectAnomalyReport(
                { id: jobPackId || "0", name: headerData.jobpackName },
                { id: structureId || "0", str_name: headerData.platformName },
                headerData.sowReportNo || "",
                { company_name: settings.companyName, logo_url: settings.companyLogo },
                config
            );
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate report");
            return;
        }
    };

    const generateInspectionReportByType = async (typeId: number) => {
        const recordsToPrint = currentRecords.filter(r => r.inspection_type_id === typeId || r.inspection_type?.id === typeId);
        if (recordsToPrint.length === 0) {
            toast.error("No records found for this inspection type");
            return;
        }

        const type = allInspectionTypes.find(t => t.id === typeId);
        const settings = await getReportHeaderData();

        await generateMultiInspectionReport(
            recordsToPrint.map(r => r.insp_id),
            { company_name: settings.companyName, logo_url: settings.companyLogo },
            {
                reportNoPrefix: type?.code || "REPORT",
                reportYear: new Date().getFullYear().toString(),
                preparedBy: { name: "Inspector", date: new Date().toLocaleDateString() },
                reviewedBy: { name: "", date: "" },
                approvedBy: { name: "", date: "" },
                watermark: { enabled: false, text: "", transparency: 0.1 },
                showContractorLogo: true,
                showPageNumbers: true,
                printFriendly: false
            }
        );
    };

    const generateFullInspectionReport = async () => {
        if (currentRecords.length === 0) {
            toast.error("No records captured to generate report");
            return;
        }

        const settings = await getReportHeaderData();

        await generateMultiInspectionReport(
            currentRecords.map(r => r.insp_id),
            { company_name: settings.companyName, logo_url: settings.companyLogo },
            {
                reportNoPrefix: "FULL_INSPECTION",
                reportYear: new Date().getFullYear().toString(),
                preparedBy: { name: "Inspector", date: new Date().toLocaleDateString() },
                reviewedBy: { name: "", date: "" },
                approvedBy: { name: "", date: "" },
                watermark: { enabled: false, text: "", transparency: 0.1 },
                showContractorLogo: true,
                showPageNumbers: true,
                printFriendly: false
            }
        );
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

        const { error } = await supabase.from('u_sow_items').insert({
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

        if (!error) {
            // "also refer the u_sow table" -> keep totals synchronized
            const { data: sowData } = await supabase.from('u_sow')
                .select('total_items, pending_items')
                .eq('id', targetSowId)
                .maybeSingle();

            if (sowData) {
                await supabase.from('u_sow').update({
                    total_items: (sowData.total_items || 0) + 1,
                    pending_items: (sowData.pending_items || 0) + 1,
                    updated_by: userId,
                    updated_at: new Date().toISOString()
                }).eq('id', targetSowId);
            }

            const newTasks = [...(selectedComp.tasks || []), specName];
            setSelectedComp({ ...selectedComp, tasks: newTasks });

            // Optimistically update existing task lists immediately if possible
            const newTaskStatus = { code: specName, status: 'pending' };
            const newStatuses = [...(selectedComp.taskStatuses || []), newTaskStatus];
            setSelectedComp((prev: any) => ({ ...prev, taskStatuses: newStatuses, tasks: newTasks }));

            toast.success(`Successfully added ${it.name} to scope!`);
        } else {
            console.error("Failed to insert u_sow_item:", error);
            toast.error("Failed to add inspection type: " + (error.message || "Unknown anomaly"));
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
            <InspectionHeader 
                headerData={headerData}
                inspMethod={inspMethod}
                setInspMethod={setInspMethod}
                router={router}
                searchParams={searchParams}
                allInspectionTypes={allInspectionTypes}
                currentRecords={currentRecords}
                generateInspectionReportByType={generateInspectionReportByType}
                generateFullInspectionReport={generateFullInspectionReport}
                jobPackId={jobPackId}
                structureId={structureId}
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
                                                {item.ok ? `✓ ${item.label}` : `✗ ${item.label} — ${item.hint}`}
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
                                {manualOverride ? '⚡ Manual' : '🔴 Live'}
                            </button>
                        </div>
                    );
                })()}
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
                            <span className="text-[10px] text-amber-300 dark:text-amber-300 italic font-semibold">No fields configured — Go to Settings → Data Acquisition</span>
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
                                <span className="text-red-400 text-sm cursor-help">⚠</span>
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
                    >
                        {/* Tape Log Events (MODULAR) */}
                        <TapeLogEvents 
                            videoEvents={videoEvents}
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
                                                {selectedComp.tasks && selectedComp.tasks.map((t: string) => {
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
                                                    
                                                    // Determine color based on priority: Anomaly (Red) > Finding (Orange) > Pass (Green)
                                                    const statusColor = hasAnomaly && !isRectified ? 'red' :
                                                                       hasFinding ? 'orange' :
                                                                       isRectified ? 'teal' :
                                                                       isCompleted ? 'green' :
                                                                       isIncomplete ? 'amber' : 'blue';

                                                    const statusLabel = hasAnomaly && !isRectified ? '⚠ Anomaly Registered' :
                                                                       hasFinding ? '⚠ Finding Registered' :
                                                                       isRectified ? '✓ Rectified' :
                                                                       isCompleted ? '✓ Completed' :
                                                                       isIncomplete ? '◐ Incomplete' : '○ Pending';
                                                    
                                                    return (
                                                        <Button key={t} onClick={() => {
                                                            setActiveSpec(t);
                                                            const newProps: Record<string, any> = {};

                                                            // Auto-fill Nominal Thickness if it exists in the spec
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

                                                            if (dataAcqConnected) {
                                                                dataAcqFields.forEach(f => {
                                                                    if (f.value && f.value !== '--' && f.targetField) {
                                                                        newProps[f.targetField] = f.value;
                                                                    }
                                                                });
                                                            }
                                                            setDynamicProps(newProps);
                                                            setFindingType("Pass");
                                                            setRecordNotes("");
                                                            setAnomalyData({defectCode: '', priority: '', defectType: '', description: '', recommendedAction: '',
                                                                rectify: false, rectifiedDate: '', rectifiedRemarks: '', severity: 'Minor', referenceNo: '' });
                                                            setIsManualOverride(false);
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
                                                                            // Filter by mode
                                                                            const isRov = it.metadata?.rov === 1 || it.metadata?.rov === "1" || it.metadata?.rov === true || it.metadata?.job_type?.includes('ROV');
                                                                            const isDiving = it.metadata?.diving === 1 || it.metadata?.diving === "1" || it.metadata?.diving === true || it.metadata?.job_type?.includes('DIVING');
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
                                        selectedComp={selectedComp}
                                        activeSpec={activeSpec}
                                        allInspectionTypes={allInspectionTypes}
                                        activeFormProps={activeFormProps}
                                        findingType={findingType}
                                        setFindingType={setFindingType}
                                        renderInspectionField={renderInspectionField}
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

                    {/* Session Records Table (Records session completed before in the current dive) */}
                    <Card className={`flex flex-col ${capturedEventsPipWindow ? 'h-[40px]' : 'h-[280px]'} border-slate-200 shadow-sm rounded-md bg-white overflow-hidden shrink-0 transition-all duration-500 ease-in-out`}>
                        <div className="bg-slate-800 text-white px-3 py-2 text-[11px] font-bold uppercase tracking-widest flex justify-between items-center h-[40px] shrink-0">
                            <div className="flex items-center gap-2">
                                <span>CAPTURED EVENTS</span>
                                <Badge className="bg-blue-600 text-white border-none text-[9px] h-4 leading-none font-bold uppercase tracking-wider">{currentRecords.length} Captured</Badge>
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
                                        {sortedRecords.map((r: any) => {
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
                                                            <div title="Passed Inspection" className="flex items-center justify-center h-6 w-6 rounded-full bg-green-100">
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
                                                                        const obj = {
                                                                            id: comp.id,
                                                                            name: comp.q_id || comp.name || `Node ${comp.id}`,
                                                                            raw: comp
                                                                        };
                                                                        setSelectedComp(obj);
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
                                        )
                                    })}
                                </tbody>
                            </table>
                        </ScrollArea>
                        )}
                    </Card>

                    {/* Captured Events PiP Portal */}
                    {capturedEventsPipWindow && createPortal(
                        <div className="h-screen w-screen flex flex-col bg-white overflow-hidden">
                            <div className="bg-slate-800 text-white px-3 py-2 text-[11px] font-bold uppercase tracking-widest flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-2">
                                    <span>CAPTURED EVENTS (FLOATING)</span>
                                    <Badge className="bg-blue-600 text-white border-none text-[9px] h-4 leading-none font-bold uppercase tracking-wider">{currentRecords.length} Captured</Badge>
                                </div>
                                <button onClick={() => capturedEventsPipWindow.close()} className="text-white/50 hover:text-white p-1 hover:bg-white/10 rounded-full transition-all"><X className="w-4 h-4" /></button>
                            </div>
                            <ScrollArea className="flex-1 w-full relative">
                                <table className="w-full text-left text-xs whitespace-nowrap">
                                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-3 py-3 w-20">Date <History className="w-3.5 h-3.5 ml-1 inline opacity-60" /></th>
                                            <th className="px-3 py-3">Type</th>
                                            <th className="px-3 py-3">Component</th>
                                            <th className="px-3 py-3 text-center">Elev/KP</th>
                                            <th className="px-3 py-3 text-center">Status</th>
                                            <th className="px-3 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {currentRecords.map((r: any) => {
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
                                                                <div title="Passed Inspection" className="flex items-center justify-center h-6 w-6 rounded-full bg-green-100">
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
                                                                            const obj = {
                                                                                id: comp.id,
                                                                                name: comp.q_id || comp.name || `Node ${comp.id}`,
                                                                                raw: comp
                                                                            };
                                                                            setSelectedComp(obj);
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
                                            )
                                        })}
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
                                                {componentsSow.filter((c: any) => c.name?.toLowerCase().includes(compSearchTerm.toLowerCase())).map((c: any) => {
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
                                                                <div className={`text-[9px] font-mono mt-0.5 ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>{c.startNode} → {c.endNode}</div>
                                                            )}
                                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                                {c.taskStatuses?.length > 0 ? c.taskStatuses.map((ts: any, idx: number) => {
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
                                                                    <span className={`text-[10px] font-mono ${isSelected ? 'opacity-85' : 'opacity-85'}`}>Tasks: {c.tasks?.join(', ')}</span>
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
                                                {componentsNonSow.filter((c: any) => c.name?.toLowerCase().includes(compSearchTerm.toLowerCase())).map((c: any) => (
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
                                                            <div className={`text-[9px] font-mono mt-0.5 ${selectedComp?.id === c.id ? 'text-slate-300' : 'text-slate-400'}`}>{c.startNode} → {c.endNode}</div>
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
                            {!selectedComp ? (
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
                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${r.status === 'Pass' ? 'bg-green-100 text-green-700' : (r.status === 'Incomplete' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}`}>{r.status}</span>
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
                                                        <span className={`px-1 py-0.5 rounded text-[7.5px] font-black uppercase ${r.status === 'Pass' ? 'bg-slate-200 text-slate-600' : 'bg-red-50 text-red-600'}`}>{r.status}</span>
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

            {isDiveSetupOpen && (
                inspMethod === "DIVING" ? (
                    <DiveJobSetupDialog
                        jobpackId={jobPackId || ""}
                        structureId={structureId || ""}
                        sowId={sowIdFull || sowId || ""}
                        existingJob={isDiveSetupForNew ? null : (activeDep as any)?.raw}
                        open={isDiveSetupOpen}
                        onOpenChange={setIsDiveSetupOpen}
                        onJobCreated={(job: any) => {
                            setIsDiveSetupOpen(false);
                            window.location.reload(); // Refresh to catch newly deployed Job
                        }}
                    />
                ) : (
                    <ROVJobSetupDialog
                        jobpackId={jobPackId || ""}
                        structureId={structureId || ""}
                        sowId={sowIdFull || sowId || ""}
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

            {/* Edit Event Dialog Component */}
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

                                        // Correctly convert local picker string back to UTC ISO
                                        const d = new Date(localVal);
                                        const newIso = d.toISOString();

                                        let updatedTime = editingEvent.time;

                                        if (lastStartEventForEdit) {
                                            const startAt = parseDbDate(lastStartEventForEdit.event_time).getTime();
                                            const nowAt = d.getTime(); // Both are now absolute UTC timestamps
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
                                    setActiveDep({ ...activeDep });
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
            {/* Edit Tape Dialog */}
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
                                {isCommitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* New Tape Creation Dialog */}
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
                                    setJobTapes(prev => [createdTape, ...prev]);
                                    setTapeId(createdTape.tape_id);
                                    setTapeNo(createdTape.tape_no);
                                    setActiveChapter(createdTape.chapter_no || 1);
                                    setIsNewTapeOpen(false);
                                    setNewTapeNo("");
                                    setNewTapeChapter("");
                                    setNewTapeRemarks("");
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
            {/* Component Specification Dialog */}
            <ComponentSpecDialog
                open={specDialogOpen}
                onOpenChange={setSpecDialogOpen}
                component={selectedComp?.raw}
                mode="view"
            />
            <ReportPreviewDialog
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                title="Anomaly Report Preview"
                fileName={`Anomaly_Report_${previewRecord?.anomaly_ref_no || 'Draft'}`}
                generateReport={generateAnomalyReportBlob}
            />
            {/* Recording Gallery Dialog */}
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

            {/* Attachment Management Suite */}
            {/* Viewing Saved Attachments Dialog */}
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

            {/* Selection/Upload Manager Dialog */}
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
                        {/* Pending Attachments Strip */}
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
                            {/* Upload Section */}
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

                            {/* Session Grabs Section */}
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
                            {pendingAttachments.length > 0 && <span className="text-[10px] font-bold text-amber-500 animate-pulse">Set titles & descriptions above ↑</span>}
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
        
            {/* Defect Criteria Automated Confirmation Dialog */}
            <Dialog open={showCriteriaConfirm} onOpenChange={setShowCriteriaConfirm}>
                <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl">
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
                                    setIsManualOverride(true);
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

            {/* Anomaly Removal Confirmation Dialog */}
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
                            // Check if this is the last/latest anomaly
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
                                            <strong className="uppercase tracking-wider">⚠ Cannot Delete:</strong> Subsequent anomalies exist after this record. The anomaly will be <strong>rectified</strong> with priority set to <strong>NONE</strong> to preserve event sequence numbering.
                                        </div>
                                    )}
                                    {(isNewRecord || !hasNewerAnomalies) && (
                                        <div className="bg-green-50 border border-green-200 rounded-md p-3 text-[10px] text-green-800 font-medium">
                                            <strong className="uppercase tracking-wider">✓ Safe to Remove:</strong> {isNewRecord ? 'This is a new record — the anomaly data will be cleared.' : 'This is the latest anomaly — it can be safely deleted.'}
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
                                    setIsManualOverride(true);
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

            {/* RE-CLASSIFICATION WARNING MODAL */}
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
                                {pendingReclass.orphanedFields.map(f => (
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

            {/* TASK SELECTOR MODAL (FOR RE-CLASSIFICATION) */}
            <Dialog open={showTaskSelector} onOpenChange={setShowTaskSelector}>
                <DialogContent className="max-w-sm bg-white p-0 overflow-hidden border-2 border-blue-100 shadow-2xl">
                    <DialogHeader className="p-4 bg-blue-600 text-white space-y-1">
                        <DialogTitle className="text-xs font-bold uppercase tracking-widest opacity-80 mb-0">Re-classify Task</DialogTitle>
                        <DialogDescription className="text-sm font-black text-white/90">Change Specification for {selectedComp?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto bg-slate-50">
                        {/* SOW TASKS */}
                        <div>
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">SOW Tasks</h3>
                            <div className="space-y-1.5">
                                {selectedComp?.taskStatuses
                                    ?.filter((ts: any) => {
                                        const it = allInspectionTypes.find(type => type.code === ts.code);
                                        if (!it) return true; // fallback
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

                        {/* OTHER LIBRARY TASKS */}
                        <div className="pt-2 border-t border-slate-200">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Add Selection from Library</h3>
                            <div className="relative mb-2">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <Input 
                                    placeholder="Search library..." 
                                    className="pl-8 h-8 text-[11px] font-bold bg-white border-slate-200"
                                    value={addTaskSearch}
                                    onChange={(e) => setAddTaskSearch(e.target.value)}
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
                                    .slice(0, 10) // Limit to 10 for performance
                                    .map((it: any) => (
                                        <button 
                                            key={it.id} 
                                            onClick={() => {
                                                handleTaskChange(it.code);
                                                setAddTaskSearch("");
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
                        <Button variant="ghost" className="text-xs font-bold text-slate-400" onClick={() => setShowTaskSelector(false)}>CLOSE</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* COMPONENT SELECTOR MODAL (FOR RE-CLASSIFICATION) */}
            <Dialog 
                open={showCompSelector} 
                onOpenChange={(open) => {
                    setShowCompSelector(open);
                    if (!open) setSelectorShowAll(false);
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
                                onChange={(e) => setCompSelectorSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="p-2 space-y-1 max-h-[50vh] overflow-y-auto bg-white">
                        {/* SOW COMPONENTS GROUP */}
                        <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 mb-1 rounded">SOW Items</div>
                        {componentsSow
                            .filter(c => (c.name || '').toLowerCase().includes(compSelectorSearch.toLowerCase()))
                            .map((c: any) => (
                                <button 
                                    key={c.id} 
                                    onClick={() => {
                                        handleComponentSelection(c);
                                        setShowCompSelector(false);
                                        setCompSelectorSearch("");
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

                        {/* OTHER LIBRARY COMPONENTS (CONDITIONAL) */}
                        {selectorShowAll ? (
                            <>
                                <div className="mt-4 px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 mb-1 rounded">Platform Library (Non-SOW)</div>
                                {allComps
                                    .filter(c => {
                                        const isInSow = componentsSow.some(sc => sc.id === c.id);
                                        const cName = c.name || '';
                                        return !isInSow && cName.toLowerCase().includes(compSelectorSearch.toLowerCase());
                                    })
                                    .map((c: any) => (
                                        <button 
                                            key={c.id} 
                                            onClick={() => {
                                                handleComponentSelection(c);
                                                setShowCompSelector(false);
                                                setCompSelectorSearch("");
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
                                    onClick={() => setSelectorShowAll(true)}
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
                        <Button variant="ghost" className="text-xs font-bold text-slate-400" onClick={() => { setShowCompSelector(false); setCompSelectorSearch(""); setSelectorShowAll(false); }}>CANCEL</Button>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
