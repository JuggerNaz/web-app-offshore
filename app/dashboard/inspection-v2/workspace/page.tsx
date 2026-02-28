"use client";

import React, { useState, useEffect, Suspense, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

import {
    AlertCircle,
    Camera,
    CheckCircle2,
    ChevronDown,
    Clock,
    FileText,
    Play,
    Pause,
    Plus,
    Search,
    Settings,
    Square,
    Video,
    X,
    MapPin,
    Building2,
    Activity,
    VideoOff,
    CheckSquare,
    Save,
    ArrowRight,
    ArrowLeft,
    ListTodo,
    History,
    FileSpreadsheet,
    LineChart,
    Printer,
    Trash2,
    Edit,
    Maximize2,
    Box,
    Wifi,
    Check,
    CloudUpload,
    AlertTriangle,
    FileClock,
    Paperclip,
    ShieldAlert,
    ActivitySquare,
    List,
    Layers,
    Power,
    Waves,
    ClipboardCheck,
    Loader2
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { generateInspectionReport } from "@/utils/report-generators/inspection-report";
import { generateDefectAnomalyReport } from "@/utils/report-generators/defect-anomaly-report";

import { loadSettings, type WorkstationSettings } from '@/lib/video-recorder/settings-manager';
import { createMediaRecorder, startRecording, saveFile, generateFilename, getPhotoExtension, FORMAT_CONFIGS } from '@/lib/video-recorder/media-recorder';
import { CanvasOverlayManager, type DrawingTool } from '@/lib/video-recorder/canvas-overlay';
// Storage utils (not needed as using supabase directly in this file for now)


import { Card } from "@/components/ui/card";
import DiveJobSetupDialog from "../../inspection/dive/components/DiveJobSetupDialog";
import DiveMovementLog from "../../inspection/dive/components/DiveMovementLog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ComponentSpecDialog } from "@/components/dialogs/component-spec-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReportPreviewDialog } from "@/components/ReportPreviewDialog";
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
const AIR_DIVE_ACTIONS = [
    { label: "Left Surface", value: "LEAVING_SURFACE" },
    { label: "Arrived Bottom", value: "AT_WORKSITE" },
    { label: "Diver at Worksite", value: "AT_WORKSITE" },
    { label: "Diver Left Worksite", value: "LEAVING_WORKSITE" },
    { label: "Left Bottom", value: "LEAVING_WORKSITE" },
    { label: "Arrived Surface", value: "BACK_TO_SURFACE" }
];

const BELL_DIVE_ACTIONS = [
    { label: "Left Surface", value: "BELL_LAUNCHED" },
    { label: "Bell at Working Depth", value: "BELL_AT_DEPTH" },
    { label: "Diver Locked Out", value: "DIVER_EXITING_BELL" },
    { label: "Diver Locked In", value: "DIVER_RETURNING_TO_BELL" },
    { label: "Bell Left Bottom", value: "BELL_ASCENDING" },
    { label: "Bell on Surface", value: "BELL_AT_SURFACE" },
    { label: "TUP Complete", value: "BELL_MATED_TO_CHAMBER" }
];
const INITIAL_VIDEO_EVENTS = [
    { id: 1, time: "00:00:00", action: "Start Tape", diveLogId: "DIVE-02" },
    { id: 2, time: "00:15:20", action: "Pause", diveLogId: "DIVE-02" },
    { id: 3, time: "00:16:05", action: "Resume", diveLogId: "DIVE-02" },
];
const COMPONENTS_SOW = [
    { id: "LEG_B2", name: "LEG B2", depth: "-12m", tasks: ["GVINS", "HSTAT"] },
    { id: "BAN_001", name: "BAN001", depth: "-8m", tasks: ["CVINS"] },
];
const COMPONENTS_NON_SOW = [
    { id: "NODE_X", name: "NODE X", depth: "-15m", tasks: ["GVINS"] },
    { id: "RISER_A", name: "RISER A", depth: "-22m", tasks: ["CVINS"] },
];
const HISTORICAL_DATA = [
    { year: 2024, type: "GVINS", status: "Anomaly", finding: "Minor marine growth", inspector: "Alex" },
    { year: 2022, type: "CVINS", status: "Pass", finding: "Clear", inspector: "Jitesh" },
];
const CURRENT_RECORDS = [
    { id: 1, time: "10:57", type: "GVINS", comp: "LEG B2", status: "Pass", timer: "00:15:10", hasPhoto: true },
    { id: 2, time: "11:20", type: "HSTAT", comp: "LEG B2", status: "Anomaly", timer: "00:30:45", hasPhoto: false },
];

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
    const [isDeploymentValid, setIsDeploymentValid] = useState(true);
    const [syncLoading, setSyncLoading] = useState(false);
    const [componentsSow, setComponentsSow] = useState<any[]>([]);
    const [componentsNonSow, setComponentsNonSow] = useState<any[]>(COMPONENTS_NON_SOW);

    // Operations State
    const [currentMovement, setCurrentMovement] = useState<string>("Awaiting Deployment");
    const [vidState, setVidState] = useState<"IDLE" | "RECORDING" | "PAUSED">("IDLE");
    const [videoVisible, setVideoVisible] = useState(true);
    const [streamActive, setStreamActive] = useState(false);

    // Component Target Tab Mode
    const [compView, setCompView] = useState<"LIST" | "MODEL_3D">("LIST");
    const [compSearchTerm, setCompSearchTerm] = useState("");
    const [specDialogOpen, setSpecDialogOpen] = useState(false);

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

    // Live session records
    const [currentRecords, setCurrentRecords] = useState<any[]>([]);
    const [historicalRecords, setHistoricalRecords] = useState<any[]>([]);
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

    // Drawing Tools state
    const [currentTool, setCurrentTool] = useState<DrawingTool>('pen');
    const [currentColor, setCurrentColor] = useState('#ef4444');
    const [lineWidth, setLineWidth] = useState(3);
    const [showDrawingTools, setShowDrawingTools] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const recorderIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Context
    const [selectedComp, setSelectedComp] = useState<any>(null);
    const [activeSpec, setActiveSpec] = useState<string | null>(null);
    const [allInspectionTypes, setAllInspectionTypes] = useState<any[]>([]);
    const [photoLinked, setPhotoLinked] = useState(false);
    const [recordNotes, setRecordNotes] = useState("");

    // Edit Settings States
    const [isVideoSettingsOpen, setIsVideoSettingsOpen] = useState(false);
    const [isDiveSetupOpen, setIsDiveSetupOpen] = useState(false);
    const [isMovementLogOpen, setIsMovementLogOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<any>(null);
    const [lastStartEventForEdit, setLastStartEventForEdit] = useState<any>(null);

    const [diveStartTime, setDiveStartTime] = useState<string | null>(null);
    const [diveEndTime, setDiveEndTime] = useState<string | null>(null);
    const [timeInWater, setTimeInWater] = useState<string>("00:00:00");

    // Dynamic Form States
    const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({});
    const [findingType, setFindingType] = useState<"Pass" | "Anomaly" | "Incomplete">("Pass");
    const [anomalyData, setAnomalyData] = useState<{
        defectCode: string,
        priority: string,
        defectType: string,
        description: string,
        recommendedAction: string,
        rectify: boolean,
        rectifiedDate: string,
        rectifiedRemarks: string,
        severity: string
    }>({
        defectCode: '',
        priority: '',
        defectType: '',
        description: '',
        recommendedAction: '',
        rectify: false,
        rectifiedDate: '',
        rectifiedRemarks: '',
        severity: 'Minor'
    });
    const [incompleteReason, setIncompleteReason] = useState("");

    // Anomaly Library States
    const [defectCodes, setDefectCodes] = useState<any[]>([]);
    const [priorities, setPriorities] = useState<any[]>([]);
    const [allDefectTypes, setAllDefectTypes] = useState<any[]>([]);

    const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewRecord, setPreviewRecord] = useState<any>(null);

    const jpParam = searchParams.get('jpName');
    const strParam = searchParams.get('structName');
    const sowParam = searchParams.get('sowReport');

    // Header Data
    const [headerData, setHeaderData] = useState<{ jobpackName: string, platformName: string, sowReportNo: string }>({
        jobpackName: jpParam || (jobPackId ? `JP-${jobPackId}` : "N/A"),
        platformName: strParam || (structureId ? `Struct ${structureId}` : "N/A"),
        sowReportNo: sowParam || (sowId ? `SOW-${sowId}` : "N/A")
    });

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

            setHeaderData({ jobpackName, platformName, sowReportNo });
        }
        fetchHeaderInfo();
    }, [jobPackId, structureId, sowId, sowIdFull, supabase, jpParam, strParam, sowParam]);

    const parseDbDate = useCallback((dateString?: string | null): Date => {
        if (!dateString) return new Date();
        try {
            const t = dateString.replace(' ', 'T');
            const d = new Date(t.includes('Z') || t.includes('+') ? t : `${t}Z`);
            return isNaN(d.getTime()) ? new Date() : d;
        } catch (e) {
            return new Date();
        }
    }, []);

    const handleDeleteRecord = async (id: number) => {
        if (!confirm("Are you sure you want to delete this inspection record? This cannot be undone.")) return;
        try {
            await supabase.from('insp_video_logs').delete().eq('inspection_id', id);
            await supabase.from('insp_records').delete().eq('insp_id', id);
            toast.success("Record deleted");
            setCurrentRecords(prev => prev.filter(r => r.insp_id !== id));
        } catch (error) {
            console.error("Error deleting record:", error);
            toast.error("Failed to delete record");
        }
    };

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
        setAttachmentToLink(file);
        setAttachmentMetadata({ title: file.name, description: '' });
        setIsAttachDialogOpen(true);
    };

    const confirmAttachToRecord = async () => {
        if (!attachmentToLink || !selectedRecordToLink) {
            toast.error("Please select a record to link to");
            return;
        }

        setIsCommitting(true);
        try {
            const user = (await supabase.auth.getUser()).data.user;
            const currentUserId = user?.id || 'system';

            // 1. Upload to Storage
            const fileExt = attachmentToLink.type === 'video' ? 'webm' : 'png';
            const safeName = attachmentToLink.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(7)}_${safeName}`;
            const filePath = `inspection/${selectedRecordToLink}/${uniqueName}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('attachments')
                .upload(filePath, attachmentToLink.blob);

            if (uploadError) throw uploadError;

            // 2. Link in attachment table
            const { error: attError } = await supabase
                .from('attachment')
                .insert({
                    name: attachmentToLink.name,
                    source_id: selectedRecordToLink,
                    source_type: 'inspection',
                    path: filePath,
                    user_id: currentUserId,
                    meta: {
                        title: attachmentMetadata.title,
                        description: attachmentMetadata.description,
                        size: attachmentToLink.blob.size,
                        type: attachmentToLink.blob.type
                    }
                });

            if (attError) throw attError;

            toast.success(`Succesfully linked ${attachmentToLink.name} to inspection record`);
            setIsAttachDialogOpen(false);
            setAttachmentToLink(null);
            setSelectedRecordToLink(null);
        } catch (err: any) {
            console.error("Linking failed:", err);
            toast.error(`Failed to attach file: ${err.message || "Unknown error"}`);
        } finally {
            setIsCommitting(false);
        }
    };

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
                setCurrentMovement(last.movement_type || "Deployed");
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
                setCurrentMovement("Deployed");
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

                if (lastLog) {
                    const isRecording = lastLog.event_type === "NEW_LOG_START" || lastLog.event_type === "RESUME" || lastLog.event_type === "START_TASK" || lastLog.event_type === "RESUME_TASK";
                    setVidState(isRecording ? "RECORDING" : "PAUSED");

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
                        action: l.event_type === "NEW_LOG_START" ? "Start Tape" : l.event_type === "END" ? "Stop Tape" : l.event_type,
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
                // Fallback basic fetch to avoid 400 or other complex join issues
                const { data: fallbackInsps } = await supabase.from('insp_records').select('*').eq(inspCol, depId);
                if (fallbackInsps) {
                    setCurrentRecords(fallbackInsps);
                    allEv.push(...fallbackInsps.map(r => ({
                        id: `insp_${r.insp_id}`,
                        realId: r.insp_id,
                        time: r.inspection_data?._meta_timecode || '00:00:00',
                        action: r.has_anomaly ? 'ANOMALY' : 'INSPECTION',
                        logType: 'insp',
                        eventTime: parseDbDate(r.inspection_date && r.inspection_time ? `${r.inspection_date} ${r.inspection_time}` : null).toISOString()
                    })));
                }
            } else if (insps) {
                console.log(`[Sync] Found ${insps.length} inspection records`);
                setCurrentRecords(insps);
                insps.forEach(r => {
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
                            eventTime: parseDbDate(r.inspection_date && r.inspection_time ? `${r.inspection_date} ${r.inspection_time}` : null).toISOString()
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

    useEffect(() => {
        async function fetchHistory() {
            if (!selectedComp || !structureId) return;
            const { data: h } = await supabase.from('insp_records').select('*').eq('component_id', selectedComp.id).order('cr_date', { ascending: false });
            if (h) {
                setHistoricalRecords(h.map((r: any) => ({
                    year: new Date(r.cr_date).getFullYear(),
                    type: r.inspection_type,
                    status: r.status === 'Acceptable' || r.status === 'Pass' ? 'Pass' : 'Anomaly',
                    finding: r.observation || r.remarks || 'No notes',
                    inspector: 'System'
                })));
            }
        }
        fetchHistory();
    }, [selectedComp, supabase, structureId]);

    const handleLogEvent = async (action: string) => {
        let currentTimer = vidTimer;
        if (action === "Start Tape" || action === "Stop Tape") {
            currentTimer = 0;
            setVidTimer(0);
        }

        const optimisticId = `log_${Date.now()}`;
        const tcode = formatTime(currentTimer);
        const now = new Date();
        const eventTime = now.toISOString();
        setVideoEvents([{ id: optimisticId, realId: 0, time: tcode, action, logType: 'video_log', eventTime }, ...videoEvents]);

        // Map UI labels to valid DB constraint values
        let dbAction = action;
        if (action === "Start Tape") dbAction = "NEW_LOG_START";
        if (action === "Stop Tape") dbAction = "END";
        if (action === "Pause") dbAction = "PAUSE";
        if (action === "Resume") dbAction = "RESUME";

        let tId = tapeId;
        if (!tId && activeDep?.id) {
            const user = (await supabase.auth.getUser()).data.user;
            const uniqueTapeNo = `${tapeNo || 'TAPE'}-${activeDep.id}-${Date.now()}`;
            const { data: newTape } = await supabase.from('insp_video_tapes').insert({
                tape_no: uniqueTapeNo,
                tape_type: "DIGITAL - PRIMARY",
                status: 'ACTIVE',
                [inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id']: Number(activeDep.id),
                cr_user: user?.id || 'system'
            }).select('tape_id').single();
            if (newTape) {
                setTapeId(newTape.tape_id);
                tId = newTape.tape_id;
            }
        }
        if (tId) {
            const { data: newLog } = await supabase.from('insp_video_logs').insert({
                tape_id: tId,
                event_type: dbAction,
                event_time: new Date().toISOString(),
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
            const { error } = await supabase.from('insp_video_logs').delete().eq('video_log_id', realId);
            if (!error) {
                // Re-sync timer state after deleting a log event
                syncDeploymentState();
            }
        } else if (logType === 'insp') {
            await handleDeleteRecord(realId);
            syncDeploymentState();
        }
    };

    const handleEditEventSave = async (newTime: string, newAction: string, newEventTime?: string) => {
        if (!editingEvent?.id) return;

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
    };

    // Handle method switch overriding deps
    useEffect(() => {
        async function fetchDeps() {
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
                const { data: recJobs } = await supabase.from('insp_records')
                    .select('dive_job_id, rov_job_id')
                    .eq('jobpack_id', queryJobPackId)
                    .eq('structure_id', Number(structureId))
                    .limit(10);

                if (recJobs && recJobs.length > 0) {
                    const uniqueJobIds = Array.from(new Set(recJobs.map(r => r.dive_job_id || r.rov_job_id).filter(id => id !== null)));
                    console.log("[fetchDeps] Discovered job IDs from records:", uniqueJobIds);
                    // Create virtual job objects
                    results = uniqueJobIds.map(jid => ({
                        [inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id']: jid,
                        dive_no: `JOB-${jid}`,
                        diver_name: "Legacy Records",
                        status: 'COMPLETED'
                    })) as any;
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
        }
        fetchDeps();
    }, [inspMethod, jobPackId, structureId, supabase]);

    useEffect(() => {
        async function fetchComps() {
            if (!sowId || !structureId) return;

            // First, get ALL components of the structure
            const { data: allComps, error: compErr } = await supabase.from('structure_components')
                .select('*')
                .eq('structure_id', parseInt(structureId));

            if (!allComps || allComps.length === 0) {
                setComponentsSow([]);
                setComponentsNonSow([]);
                return;
            }

            // Then fetch SOW items for the selected `sow_id`
            const { data: sowItems } = await supabase.from('u_sow_items')
                .select('*')
                .eq('sow_id', sowId);

            const assignedCompsMap = new Map<number, string[]>();

            if (sowItems) {
                sowItems.forEach(item => {
                    // match by q_id or component_id or type
                    const matchingComp = allComps.find(c =>
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
                            assignedCompsMap.get(matchingComp.id)?.push(taskToLog);
                        }
                    }
                });
            }

            const assigned: any[] = [];
            const unassigned: any[] = [];

            allComps.forEach(comp => {
                const isAssigned = assignedCompsMap.has(comp.id);
                const md = comp.metadata || {};
                const startNode = md.start_node || md.f_node || comp.startNode || comp.start_node || '-';
                const endNode = md.end_node || md.s_node || comp.endNode || comp.end_node || '-';
                const startElev = md.start_elevation || md.elv_1 || comp.elevation1 || comp.start_elevation || '-';
                const endElev = md.end_elevation || md.elv_2 || comp.elevation2 || comp.end_elevation || '-';

                const obj = {
                    id: comp.id,
                    name: comp.q_id || comp.name || `Node ${comp.id}`,
                    depth: comp.water_depth || "-0.0m",
                    startNode, endNode, startElev, endElev,
                    raw: comp,
                    tasks: assignedCompsMap.get(comp.id) || []
                };

                if (isAssigned) {
                    assigned.push(obj);
                } else {
                    unassigned.push(obj);
                }
            });

            setComponentsSow(assigned);
            setComponentsNonSow(unassigned);
        }
        fetchComps();
    }, [sowId, structureId, supabase]);

    useEffect(() => {
        async function fetchInitialLists() {
            // Fetch Inspection Types
            const { data: typesData } = await supabase.from('inspection_type').select('*').order('name');
            if (typesData) setAllInspectionTypes(typesData);

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

    const diveActionsList = ((activeDep as any)?.raw?.dive_type?.toUpperCase() || "AIR").includes("BELL") || ((activeDep as any)?.raw?.dive_type?.toUpperCase() || "AIR").includes("SAT") ? BELL_DIVE_ACTIONS : AIR_DIVE_ACTIONS;




    const handleMovementLog = async (actionLabel: string) => {
        if (!activeDep?.id) return;

        // Find the database record value for the label
        const actionItem = [...AIR_DIVE_ACTIONS, ...BELL_DIVE_ACTIONS].find(a => a.label === actionLabel);
        const dbValue = actionItem?.value || actionLabel;

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
            if (actionLabel.toLowerCase().includes('left surface') || actionLabel.toLowerCase().includes('deployed')) setDiveStartTime(payload.movement_time);
            if (actionLabel.toLowerCase().includes('arrived surface') || actionLabel.toLowerCase().includes('recovered')) setDiveEndTime(payload.movement_time);

            // Auto-complete deployment if final action
            if (["Arrived Surface", "TUP Complete", "Bell on Surface", "Recovered", "System on Deck"].includes(actionLabel)) {
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

    const handleCommitRecord = async () => {
        if (!selectedComp || !activeSpec || !activeDep?.id) return;

        let tId = tapeId;
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
                const user = (await supabase.auth.getUser()).data.user;
                const uniqueTapeNo = `${tapeNo || 'TAPE'}-${activeDep.id}-${Date.now()}`;
                const { data: newTape } = await supabase.from('insp_video_tapes').insert({
                    tape_no: uniqueTapeNo,
                    tape_type: "DIGITAL - PRIMARY",
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

        setIsCommitting(true);
        const user = (await supabase.auth.getUser()).data.user;

        const it = allInspectionTypes.find(t => t.name === activeSpec || t.code === activeSpec);

        const payload: any = {
            [inspMethod === "DIVING" ? 'dive_job_id' : 'rov_job_id']: activeDep.id,
            structure_id: parseInt(structureId || "0"),
            component_id: selectedComp.id,
            inspection_type_id: it?.id || null,
            inspection_type_code: it?.code || activeSpec,
            inspection_date: format(new Date(), 'yyyy-MM-dd'),
            inspection_time: format(new Date(), 'HH:mm:ss'),
            observation: recordNotes,
            status: findingType === 'Incomplete' ? 'INCOMPLETE' : 'COMPLETED',
            has_anomaly: findingType === 'Anomaly',
            tape_id: tId,
            tape_count_no: vidTimer,
            elevation: isNaN(parseFloat(selectedComp.elevation1)) ? 0 : parseFloat(selectedComp.elevation1),
            inspection_data: {
                ...dynamicProps,
                _meta_timecode: formatTime(vidTimer),
                _meta_status: findingType,
                incomplete_reason: findingType === 'Incomplete' ? incompleteReason : null
            },
            cr_user: user?.id || 'system'
        };

        if (editingRecordId) {
            payload.insp_id = editingRecordId;
        }

        // anomaly_details is handled separately in the insp_anomalies table

        const { data: opData, error: opError } = await (editingRecordId
            ? supabase.from('insp_records').update(payload).eq('insp_id', editingRecordId).select('*').single()
            : supabase.from('insp_records').insert(payload).select('*').single()
        );

        if (opError) {
            console.error("Commit Error:", opError);
            toast.error(`Error saving record: ${opError.message}`);
            setIsCommitting(false);
            return;
        }
        const newStatus = findingType === 'Incomplete' ? 'incomplete' : 'completed';
        await supabase.from('u_sow_items')
            .update({ status: newStatus })
            .eq('sow_id', sowId)
            .eq('component_id', selectedComp.id)
            .filter('inspection_type_id', it?.id ? 'eq' : 'is', it?.id || null);

        if (findingType === 'Anomaly') {
            const { data: existingAnomaly } = await supabase.from('insp_anomalies').select('anomaly_id').eq('inspection_id', opData.insp_id).maybeSingle();

            const anomalyPayload: any = {
                inspection_id: opData.insp_id,
                defect_type_code: anomalyData.defectCode,
                priority_code: anomalyData.priority,
                defect_category_code: anomalyData.defectType,
                status: anomalyData.rectify ? 'CLOSED' : 'OPEN', // Assuming RECTIFIED maps to CLOSED or similar
                defect_description: anomalyData.description,
                recommended_action: anomalyData.recommendedAction,
                rectified_date: anomalyData.rectifiedDate || null,
                rectified_remarks: anomalyData.rectifiedRemarks,
                severity: anomalyData.severity,
                cr_user: user?.id || 'system'
            };

            if (existingAnomaly) {
                await supabase.from('insp_anomalies').update(anomalyPayload).eq('anomaly_id', existingAnomaly.anomaly_id);
            } else {
                const { data: sequenceData } = await supabase.rpc('get_next_anomaly_sequence', { p_structure_id: parseInt(structureId || "0") });
                const seq = sequenceData || Math.floor(Math.random() * 1000);
                const refNo = `${new Date().getFullYear()} / ${headerData.platformName?.slice(0, 3).toUpperCase()} / A-${seq.toString().padStart(3, '0')}`;
                anomalyPayload.anomaly_ref_no = refNo;
                anomalyPayload.sequence_no = seq;
                await supabase.from('insp_anomalies').insert(anomalyPayload);
            }
        } else if (editingRecordId) {
            await supabase.from('insp_anomalies').delete().eq('inspection_id', editingRecordId);
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
                event_type: "PRE_INSPECTION",
                event_time: new Date().toISOString(),
                timecode_start: formatTime(vidTimer),
                tape_counter_start: vidTimer,
                tape_id: tId
            });
        }

        syncDeploymentState();
        setActiveSpec(null);
        setRecordNotes("");
        setDynamicProps({});
        setFindingType("Pass");
        setIncompleteReason("");
        setEditingRecordId(null);
        setAnomalyData({
            defectCode: '', priority: '', defectType: '', description: '', recommendedAction: '',
            rectify: false, rectifiedDate: '', rectifiedRemarks: '', severity: 'Minor'
        });
        toast.success(editingRecordId ? "Record updated" : "Record committed");
        setIsCommitting(false);
    };

    const handleEditRecord = async (record: any) => {
        let fullRecord = record;
        if (!record.inspection_data || !record.component_id || !record.inspection_type) {
            const { data } = await supabase.from('insp_records')
                .select('*, inspection_type(id, code, name), insp_anomalies(*)')
                .eq('insp_id', record.insp_id)
                .single();
            if (data) fullRecord = data;
        }

        const comp = componentsSow.find(c => c.id === fullRecord.component_id) || componentsNonSow.find(c => c.id === fullRecord.component_id);
        if (comp) setSelectedComp(comp);

        setActiveSpec(fullRecord.inspection_type?.name || fullRecord.inspection_type_code);
        setEditingRecordId(fullRecord.insp_id);
        setRecordNotes(fullRecord.observation || "");
        setDynamicProps(fullRecord.inspection_data || {});
        setFindingType(fullRecord.has_anomaly ? "Anomaly" : (fullRecord.status === 'INCOMPLETE' ? "Incomplete" : "Pass"));
        setIncompleteReason(fullRecord.inspection_data?.incomplete_reason || "");

        const anomalyObj = fullRecord.insp_anomalies?.[0] || fullRecord.anomaly_details;
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
                severity: anomalyObj.severity || "Minor"
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
                "",
                { company_name: settings.companyName, logo_url: settings.companyLogo },
                config
            );
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate report");
            return;
        }
    };

    const handleAddNewInspectionSpec = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const typeIdStr = e.target.value;
        if (!typeIdStr) return;

        if (!selectedComp || !sowId || !activeDep?.id) {
            e.target.value = "";
            return;
        }

        const it = allInspectionTypes.find(t => t.id.toString() === typeIdStr);
        if (!it) return;

        const specName = it.code || it.name;

        const { error } = await supabase.from('u_sow_items').insert({
            sow_id: parseInt(sowId),
            component_id: selectedComp.id,
            inspection_type_id: it.id,
            status: 'pending',
            report_number: headerData.sowReportNo,
            inspection_code: it.code,
            inspection_name: it.name,
            elevation_required: false,
            cr_user: (await supabase.auth.getUser()).data.user?.id || 'system'
        });

        if (!error) {
            const newTasks = [...(selectedComp.tasks || []), specName];
            setSelectedComp({ ...selectedComp, tasks: newTasks });
        }
        e.target.value = "";
    };

    const renderStreamUI = () => (
        <>
            {/* Conditional Stream Box */}
            <div className="flex-1 relative bg-slate-900 border-b border-white/5 flex items-center justify-center overflow-hidden min-h-[160px]">
                {streamActive ? (
                    <>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="absolute inset-0 w-full h-full object-fill bg-black opacity-90"
                        />
                        <canvas
                            ref={canvasRef}
                            className="absolute inset-0 w-full h-full z-10 cursor-crosshair"
                            onMouseDown={() => {
                                if (overlayManager) overlayManager.setTool(currentTool);
                            }}
                        />
                        <div className="absolute bottom-2 left-2 font-mono text-cyan-400 text-[10px] font-bold blur-[0.2px] drop-shadow-md z-20">DPT: {selectedComp?.depth || '-0.0m'} | T: 24C</div>

                        {/* Drawing Tools Overlay Toggle - Moved down to avoid header overlap */}
                        <button
                            onClick={() => setShowDrawingTools(!showDrawingTools)}
                            className={`absolute top-12 left-2 z-40 p-1.5 rounded-full transition-all ${showDrawingTools ? 'bg-blue-600 text-white shadow-lg' : 'bg-black/50 text-white/70 hover:bg-black/70 border border-white/10'}`}
                        >
                            <Edit className="w-4 h-4" />
                        </button>

                        {showDrawingTools && (
                            <div className="absolute top-12 left-12 z-40 flex gap-1 bg-black/80 p-1.5 rounded-lg backdrop-blur-md border border-white/20 animate-in fade-in slide-in-from-left-2 shadow-2xl">
                                {(['pen', 'circle', 'arrow', 'line', 'rectangle'] as DrawingTool[]).map((tool) => (
                                    <button
                                        key={tool}
                                        onClick={() => {
                                            setCurrentTool(tool);
                                            if (overlayManager) overlayManager.setTool(tool);
                                        }}
                                        className={`p-1 rounded transition-colors ${currentTool === tool ? 'bg-white/20 text-blue-400' : 'text-white/60 hover:text-white'}`}
                                        title={tool}
                                    >
                                        {tool === 'pen' && <Edit className="w-3 h-3" />}
                                        {tool === 'circle' && <div className="w-3 h-3 rounded-full border border-current"></div>}
                                        {tool === 'arrow' && <ArrowRight className="w-3 h-3" />}
                                        {tool === 'line' && <div className="w-3 h-0.5 bg-current"></div>}
                                        {tool === 'rectangle' && <Box className="w-3 h-3 border border-current" />}
                                    </button>
                                ))}
                                <Separator orientation="vertical" className="h-5 bg-white/20 mx-1" />
                                {['#ef4444', '#10b981', '#3b82f6', '#ffffff'].map(c => (
                                    <button
                                        key={c}
                                        onClick={() => {
                                            setCurrentColor(c);
                                            if (overlayManager) overlayManager.setColor(c);
                                        }}
                                        className={`w-4 h-4 rounded-full border border-white/20 transition-transform hover:scale-110 ${currentColor === c ? 'ring-2 ring-white/50 border-white' : ''}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                                <button
                                    onClick={() => overlayManager?.clear()}
                                    className="p-1 hover:text-red-400 text-white/60 ml-0.5"
                                    title="Clear All"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center text-slate-500">
                        <VideoOff className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <span className="text-[10px] uppercase font-bold tracking-widest">Stream Stopped</span>
                    </div>
                )}
            </div>

            {/* Video Controls (Interactive in PiP) */}
            <div className="w-full bg-black/90 flex flex-col pt-1 pb-3 border-t border-white/10 shrink-0 z-20">
                {/* Stream On/Off Tools */}
                <div className="flex justify-between items-center px-3 py-1.5 mb-1.5 bg-white/5">
                    <span className="text-[9px] font-bold uppercase text-slate-400 w-16">Stream:</span>
                    <div className="flex gap-1">
                        <Button onClick={() => setStreamActive(true)} size="sm" variant={streamActive ? "default" : "secondary"} className={`h-6 text-[10px] px-3 font-bold ${streamActive ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-none'}`}>Show</Button>
                        <Button onClick={() => setStreamActive(false)} size="sm" variant={!streamActive ? "default" : "secondary"} className={`h-6 text-[10px] px-3 font-bold ${!streamActive ? 'bg-slate-700 text-white hover:bg-slate-600 border-none' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-none'}`}>Stop</Button>
                    </div>
                </div>

                {/* Recording Tools (Local Stream Capture) */}
                <div className="flex justify-between items-center px-3">
                    <div className="flex gap-2">
                        {!isStreamRecording ? (
                            <button
                                onClick={handleStartStreamRecording}
                                disabled={!streamActive}
                                className="w-16 h-8 rounded-md text-[11px] font-bold flex items-center justify-center shadow-lg transition-all bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 ring-1 ring-white/10"
                            >
                                <Play className="w-3 h-3 mr-1 fill-current" /> Rec
                            </button>
                        ) : (
                            <div className="flex gap-1">
                                {isStreamPaused ? (
                                    <button onClick={handleResumeStreamRecording} className="w-8 h-8 bg-blue-600 hover:bg-blue-500 rounded-md text-center flex items-center justify-center text-white shadow-lg"><Play className="w-3.5 h-3.5 fill-current" /></button>
                                ) : (
                                    <button onClick={handlePauseStreamRecording} className="w-8 h-8 bg-amber-500 hover:bg-amber-400 rounded-md text-center flex items-center justify-center text-white shadow-lg"><Pause className="w-3.5 h-3.5 fill-current" /></button>
                                )}
                                <button onClick={handleStopStreamRecording} className="w-16 h-8 bg-red-600 hover:bg-red-500 animate-pulse rounded-md text-[11px] font-bold flex items-center justify-center text-white shadow-lg transition-all ring-1 ring-red-400/20">
                                    <Square className="w-3 h-3 fill-current mr-1" /> Stop
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter leading-none mb-1">Stream REC</span>
                        <span className={`font-mono text-[13px] font-black ${isStreamRecording ? 'text-red-500' : 'text-slate-400'}`}>{formatTime(streamTimer)}</span>
                    </div>
                    <button
                        onClick={handleGrabPhoto}
                        disabled={!streamActive}
                        className="w-10 h-8 bg-white/10 rounded-md text-white flex items-center justify-center hover:bg-white/20 transition-all disabled:opacity-50 ring-1 ring-white/5"
                        title="Grab Photo"
                    >
                        <Camera className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </>
    );


    return (
        <div className="flex flex-col h-[calc(100vh)] bg-slate-100 dark:bg-slate-950 font-sans text-slate-900 overflow-hidden">

            {/* WORKSPACE HEADER */}
            <header className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between shadow-md z-20 shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-black uppercase tracking-widest flex items-center gap-2 text-blue-400">
                        <Activity className="w-5 h-5" /> Cockpit
                    </h1>
                    <div className="h-5 w-px bg-slate-700"></div>

                    {/* Mode Toggle */}
                    <div className="flex bg-slate-800 rounded p-1 mr-4">
                        <button onClick={() => setInspMethod("DIVING")} className={`px-4 py-1 text-xs font-bold rounded uppercase tracking-wider ${inspMethod === "DIVING" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>DIVING</button>
                        <button onClick={() => setInspMethod("ROV")} className={`px-4 py-1 text-xs font-bold rounded uppercase tracking-wider ${inspMethod === "ROV" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>ROV</button>
                    </div>

                    {/* Header Context Info - Inline */}
                    <div className="hidden md:flex items-center text-xs ml-3 space-x-3">
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Jobpack:</span>
                            <span className="font-mono font-bold text-slate-200">{headerData.jobpackName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Platform:</span>
                            <span className="font-mono font-bold text-slate-200">{headerData.platformName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700">
                            <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">SOW Report:</span>
                            <span className="font-mono font-black text-cyan-400">{headerData.sowReportNo}</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Link href="/dashboard/inspection-v2"><Button variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white h-8"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button></Link>
                    <Button variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white h-8"><Printer className="w-4 h-4 mr-2" /> Reports</Button>
                    <Link href="/dashboard/settings"><Button variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white h-8"><Settings className="w-4 h-4 mr-2" /> Workspace</Button></Link>
                </div>
            </header>

            {/* DEPLOYMENTS SUB-HEADER */}
            <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 py-2 flex gap-2 shrink-0 overflow-x-auto items-center">
                {deployments.length === 0 && !activeDep && (
                    <div className="flex items-center gap-2 text-slate-400 px-2 py-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Loading deployments...</span>
                    </div>
                )}
                {deployments.map(dep => (
                    <button
                        key={dep.id}
                        onClick={() => setActiveDep(dep)}
                        className={`relative shrink-0 flex items-center justify-between p-2 min-w-[100px] rounded-lg border transition-all shadow-sm ${activeDep?.id === dep.id
                            ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800"
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500"
                            }`}
                    >
                        <div className="flex flex-col items-start gap-0.5">
                            <span className={`font-black uppercase text-sm leading-none ${activeDep?.id === dep.id ? 'text-blue-900 dark:text-blue-200' : 'text-slate-700 dark:text-slate-300'}`}>{dep.jobNo || dep.id}</span>
                            <span className={`text-[11px] font-semibold leading-none ${activeDep?.id === dep.id ? 'text-slate-500 dark:text-blue-400/70' : 'text-slate-400 dark:text-slate-500'}`}>{dep.name || 'Unknown'}</span>
                        </div>
                        <span className={`w-2.5 h-2.5 rounded-full ml-3 ${activeDep?.id === dep.id ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                    </button>
                ))}
                <button onClick={() => setIsDiveSetupOpen(true)} className="shrink-0 flex items-center gap-1 px-3 py-2 text-[10px] font-bold text-slate-400 hover:text-blue-600 uppercase tracking-wider transition-colors">
                    <Plus className="w-3 h-3" /> New {inspMethod === 'DIVING' ? 'Dive' : 'ROV'}
                </button>
            </div>


            {/* MAIN 3-COLUMN LAYOUT */}
            <div className="flex-1 flex min-h-0 p-3 gap-3 overflow-hidden">

                {/* ======== COL 1: OPERATIONS (Diver/ROV + Video) ======== */}
                <div className="w-[320px] flex flex-col gap-3 shrink-0 overflow-hidden">

                    {/* 1. Diver / ROV Log */}
                    <Card className="flex flex-col border-slate-200 shadow-sm rounded-md shrink-0 mb-2">
                        <div className="bg-[#1f2937] text-white px-3 py-2 text-sm font-bold uppercase tracking-widest flex justify-between items-center rounded-t-md">
                            <span>{inspMethod === "DIVING" ? "1. DIVER LOG" : "1. ROV DEPLOYMENT"}</span>
                            <div className="flex items-center gap-2 text-slate-300">
                                <button onClick={() => setIsMovementLogOpen(true)} className="p-1 hover:text-white transition" title="Edit Events"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => setIsDiveSetupOpen(true)} className="p-1 hover:text-white transition" title="Settings"><Settings className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <div className="p-4 bg-white space-y-4 rounded-b-md">
                            <div className="flex justify-between text-xs">
                                <div><span className="text-slate-400 font-bold block uppercase mb-1">Active Selection</span><span className="font-bold text-slate-800 text-sm">{activeDep?.jobNo || "None"}</span></div>
                                <div className="text-right"><span className="text-slate-400 font-bold block uppercase mb-1">Time In Water</span><span className="font-mono font-bold text-blue-600 text-sm">{timeInWater}</span></div>
                            </div>

                            {/* Movement Control */}
                            <div className="bg-slate-50 border border-slate-100/60 rounded-lg p-3 text-center relative">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Current Movement</span>
                                <span className="font-black text-slate-900 text-[17px]">{currentMovement || "Awaiting Deployment"}</span>
                            </div>

                            <div className="flex gap-2">
                                <Button onClick={handleMovementPrev} disabled={currentMovement === 'Awaiting Deployment' || currentMovement === diveActionsList[0].label} variant="outline" className="flex-1 h-10 text-sm font-bold text-slate-500 border-slate-200 hover:text-slate-700 bg-white shadow-sm">
                                    <ArrowLeft className="w-4 h-4 mr-2 text-slate-400" /> Rollback
                                </Button>
                                <Button onClick={handleMovementNext} disabled={currentMovement === diveActionsList[diveActionsList.length - 1].label} className="flex-[1.5] h-10 text-sm font-bold bg-[#2563eb] hover:bg-blue-700 text-white shadow-sm">
                                    {currentMovement === 'Awaiting Deployment' ? "Next" :
                                        (diveActionsList.findIndex(a => a.label === currentMovement) < diveActionsList.length - 1
                                            ? "Next"
                                            : "Completed")} <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </div>
                    </Card>

                    {/* 9. ROV Data String (If ROV) */}
                    {inspMethod === "ROV" && (
                        <Card className="flex flex-col border-slate-200 shadow-sm rounded-md shrink-0">
                            <div className="bg-slate-800 text-white px-3 py-2 text-xs font-bold uppercase tracking-widest flex justify-between items-center rounded-t-md">
                                <span>ROV Data String</span>
                                <div className="flex items-center gap-2">
                                    <Wifi className="w-3 h-3 text-green-400" />
                                    <Link href="/dashboard/settings/data-acquisition" className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded ml-1" title="String Settings"><Settings className="w-3 h-3" /></Link>
                                </div>
                            </div>
                            <div className="p-3 bg-white space-y-2 rounded-b-md h-20 flex flex-col justify-center items-center">
                                <span className="font-mono text-xs font-bold text-slate-600 border border-slate-200 bg-slate-50 p-2 w-full text-center rounded">CP: 0.98V | DPT: 12.4m</span>
                            </div>
                        </Card>
                    )}

                    {/* 6. Small Video Stream Area */}
                    <Card
                        className={`flex flex-col border-slate-200 shadow-sm rounded-md shrink-0 bg-black overflow-hidden relative ${pipWindow ? 'opacity-50 pointer-events-none' : ''}`}
                        style={{ height: videoVisible ? '240px' : '44px' }}
                    >
                        {!pipWindow && (
                            <div className="absolute top-0 w-full bg-gradient-to-b from-black/90 to-transparent p-2 flex justify-between items-center z-50 transition-all">
                                <span className="text-[10px] text-white font-bold uppercase tracking-widest flex items-center gap-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                    <Video className="w-3 h-3 text-red-500" /> Stream Control
                                </span>
                                <div className="flex gap-1 items-center">
                                    <button onClick={handlePopOutStream} className="text-white/90 hover:text-white p-1 hover:bg-white/10 rounded transition-colors" title="Pop-out Stream"><Maximize2 className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => setIsGalleryOpen(true)} className="text-white/90 hover:text-white p-1 hover:bg-white/10 rounded transition-colors" title="View Gallery"><List className="w-3.5 h-3.5" /></button>
                                    <Link href="/dashboard/settings/video-capture" className="text-white/90 hover:text-white p-1 hover:bg-white/10 rounded transition-colors" title="Stream Settings"><Settings className="w-3.5 h-3.5" /></Link>
                                    <button onClick={() => setVideoVisible(!videoVisible)} className="text-white/90 hover:text-white p-1 ml-1 hover:bg-white/10 rounded transition-colors">{videoVisible ? <ChevronDown className="w-4 h-4" /> : <Activity className="w-4 h-4" />}</button>
                                </div>
                            </div>
                        )}

                        {pipWindow && (
                            <div className="flex-1 flex items-center justify-center text-slate-500 text-[10px] font-bold uppercase tracking-widest italic p-4 text-center">
                                Stream is floating in a separate window...
                            </div>
                        )}

                        {videoVisible && !pipWindow && renderStreamUI()}
                    </Card>

                    {/* PiP Portal */}
                    {pipWindow && createPortal(
                        <div className="h-full w-full bg-black flex flex-col overflow-hidden select-none">
                            <div className="bg-slate-900 p-2.5 flex justify-between items-center border-b border-white/10 z-50 shrink-0">
                                <span className="text-[11px] text-white font-black uppercase tracking-widest flex items-center gap-2">
                                    <Video className="w-3.5 h-3.5 text-red-500 animate-pulse" /> Stream Control
                                </span>
                                <button onClick={() => pipWindow.close()} className="text-white/50 hover:text-white p-1 hover:bg-white/10 rounded-full transition-all"><X className="w-4 h-4" /></button>
                            </div>
                            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                                {renderStreamUI()}
                            </div>
                        </div>,
                        pipWindow.document.body
                    )}

                    {/* 2. Video Log Session */}
                    <Card className="flex flex-col flex-1 border-slate-200 shadow-sm rounded-md overflow-hidden bg-white">
                        {/* Dark Header matching "1. DIVER LOG" style */}
                        <div className="bg-[#1f2937] text-white px-3 py-2 text-sm font-bold uppercase tracking-widest flex justify-between items-center rounded-t-md shrink-0">
                            <span className="flex items-center gap-2">
                                2. {inspMethod === 'DIVING' ? 'Video Session Record' : 'ROV Video Session'}
                                {!isDeploymentValid && <Badge className="bg-red-500 text-[8px] h-3.5 px-1 animate-pulse">Save Error</Badge>}
                            </span>
                            <div className="flex items-center gap-2 text-slate-300">
                                {tapeId && (
                                    <button
                                        onClick={() => {
                                            const currentTape = jobTapes.find(t => t.tape_id === tapeId);
                                            setEditTapeNo(tapeNo || "");
                                            setEditTapeChapter(currentTape?.chapter_no?.toString() || "");
                                            setEditTapeRemarks(currentTape?.remarks || "");
                                            setEditTapeStatus(currentTape?.status || "ACTIVE");
                                            setIsEditTapeOpen(true);
                                        }}
                                        className="p-1 hover:text-white transition"
                                        title="Edit Tape Details"
                                    ><Edit className="w-4 h-4" /></button>
                                )}
                                <button onClick={() => setIsVideoSettingsOpen(!isVideoSettingsOpen)} className={`p-1 hover:text-white transition ${isVideoSettingsOpen ? 'text-white' : ''}`} title="Video Session Settings"><Settings className="w-4 h-4" /></button>
                            </div>
                        </div>

                        {/* Tape Selector Bar */}
                        <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 flex items-center gap-2 shrink-0">
                            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider whitespace-nowrap">Tape:</span>
                            {jobTapes.length > 0 ? (
                                <select
                                    value={tapeId ? String(tapeId) : ""}
                                    onChange={(e) => {
                                        if (e.target.value === "__new__") {
                                            const base = headerData.sowReportNo || 'TAPE';
                                            const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
                                            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                                            setNewTapeNo(`${base}-${date}-${random}`);
                                            setNewTapeChapter("");
                                            setNewTapeRemarks("");
                                            setIsNewTapeOpen(true);
                                        } else {
                                            const selected = jobTapes.find(t => String(t.tape_id) === e.target.value);
                                            if (selected) {
                                                setTapeId(selected.tape_id);
                                                setTapeNo(selected.tape_no);
                                                setActiveChapter(selected.chapter_no || 1);
                                            }
                                        }
                                    }}
                                    className="h-7 text-xs font-mono font-bold bg-white border border-slate-300 rounded px-2 min-w-[140px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    {jobTapes.map(t => (
                                        <option key={t.tape_id} value={String(t.tape_id)}>
                                            {t.status === 'ACTIVE' ? '● ' : t.status === 'FULL' ? '◉ ' : '○ '}{t.tape_no}{t.chapter_no ? ` Ch.${t.chapter_no}` : ''} [{t.status || 'ACTIVE'}]
                                        </option>
                                    ))}
                                    <option value="__new__">＋ New Tape</option>
                                </select>
                            ) : (
                                <div className="flex items-center gap-1">
                                    <span className="font-mono text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded px-2 py-1 min-w-[100px]">{tapeNo || 'No Tape'}</span>
                                    <button
                                        onClick={() => {
                                            const base = headerData.sowReportNo || 'TAPE';
                                            const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
                                            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                                            setNewTapeNo(`${base}-${date}-${random}`);
                                            setNewTapeChapter("");
                                            setNewTapeRemarks("");
                                            setIsNewTapeOpen(true);
                                        }}
                                        className="text-[9px] font-bold text-blue-600 hover:text-blue-800 uppercase px-1.5 py-1 hover:bg-blue-50 rounded transition-colors"
                                    >+ New</button>
                                </div>
                            )}
                            {tapeId && (() => {
                                const currentTape = jobTapes.find(t => t.tape_id === tapeId);
                                if (!currentTape) return null;
                                const isActive = currentTape.status === 'ACTIVE';
                                const isFull = currentTape.status === 'FULL';
                                return (
                                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 h-5 rounded-full border ${isActive ? 'border-green-300 text-green-700 bg-green-50' :
                                            isFull ? 'border-amber-300 text-amber-700 bg-amber-50' :
                                                'border-slate-300 text-slate-500 bg-slate-50'
                                        }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : isFull ? 'bg-amber-500' : 'bg-slate-400'}`} />
                                        {currentTape.status}
                                    </span>
                                );
                            })()}
                            {activeChapter && <span className="text-[9px] font-bold text-slate-400 ml-auto">Ch. {activeChapter}</span>}
                        </div>

                        {/* Edit Tape Dialog */}
                        <Dialog open={isEditTapeOpen} onOpenChange={setIsEditTapeOpen}>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle>Edit Tape Details</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label className="text-right text-xs">Tape No</Label>
                                        <Input value={editTapeNo} onChange={(e) => setEditTapeNo(e.target.value)} className="col-span-3 h-9" />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label className="text-right text-xs">Chapter</Label>
                                        <Input value={editTapeChapter} onChange={(e) => setEditTapeChapter(e.target.value)} className="col-span-3 h-9" placeholder="e.g. 01" />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label className="text-right text-xs">Remarks</Label>
                                        <Input value={editTapeRemarks} onChange={(e) => setEditTapeRemarks(e.target.value)} className="col-span-3 h-9" placeholder="Optional notes" />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label className="text-right text-xs">Status</Label>
                                        <select value={editTapeStatus} onChange={(e) => setEditTapeStatus(e.target.value)} className="col-span-3 h-9 rounded-md border border-slate-300 px-3 text-sm">
                                            <option value="ACTIVE">Active</option>
                                            <option value="FULL">Full</option>
                                            <option value="CLOSED">Closed</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <Button onClick={async () => {
                                        if (!tapeId) return;
                                        const { error } = await supabase.from('insp_video_tapes').update({
                                            tape_no: editTapeNo,
                                            chapter_no: editTapeChapter || null,
                                            remarks: editTapeRemarks || null,
                                            status: editTapeStatus
                                        }).eq('tape_id', tapeId);
                                        if (error) { toast.error('Failed to update tape'); return; }
                                        toast.success('Tape updated');
                                        setTapeNo(editTapeNo);
                                        setActiveChapter(editTapeChapter ? parseInt(editTapeChapter) : 1);
                                        setJobTapes(prev => prev.map(t => t.tape_id === tapeId ? { ...t, tape_no: editTapeNo, chapter_no: editTapeChapter || null, remarks: editTapeRemarks || null, status: editTapeStatus } : t));
                                        setIsEditTapeOpen(false);
                                    }}>Save changes</Button>
                                </div>
                            </DialogContent>
                        </Dialog>

                        {/* New Tape Dialog */}
                        <Dialog open={isNewTapeOpen} onOpenChange={setIsNewTapeOpen}>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle>Create New Tape</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label className="text-right text-xs">Tape No</Label>
                                        <Input value={newTapeNo} onChange={(e) => setNewTapeNo(e.target.value)} className="col-span-3 h-9" />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label className="text-right text-xs">Chapter</Label>
                                        <Input value={newTapeChapter} onChange={(e) => setNewTapeChapter(e.target.value)} className="col-span-3 h-9" placeholder="e.g. 01" />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label className="text-right text-xs">Remarks</Label>
                                        <Input value={newTapeRemarks} onChange={(e) => setNewTapeRemarks(e.target.value)} className="col-span-3 h-9" placeholder="Optional notes" />
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <Button onClick={async () => {
                                        if (!activeDep?.id || !newTapeNo) return;
                                        const insertData: any = {
                                            tape_no: newTapeNo,
                                            chapter_no: newTapeChapter || null,
                                            remarks: newTapeRemarks || null,
                                            status: 'ACTIVE'
                                        };
                                        if (inspMethod === 'DIVING') insertData.dive_job_id = activeDep.id;
                                        else insertData.rov_job_id = activeDep.id;
                                        const { data, error } = await supabase.from('insp_video_tapes').insert(insertData).select().single();
                                        if (error) { toast.error('Failed to create tape'); return; }
                                        toast.success('Tape created');
                                        setJobTapes(prev => [data, ...prev]);
                                        setTapeId(data.tape_id);
                                        setTapeNo(data.tape_no);
                                        setActiveChapter(data.chapter_no || 1);
                                        setIsNewTapeOpen(false);
                                    }}>Create Tape</Button>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <div className="p-2 space-y-2 shrink-0 border-b border-slate-100">
                            {isVideoSettingsOpen && (
                                <div className="flex gap-2">
                                    <div className="bg-slate-50 border border-slate-100 rounded p-1.5 flex-1">
                                        <span className="text-[9px] uppercase font-bold text-slate-400 block pb-0.5">Tape No.</span>
                                        <Input value={tapeNo} onChange={(e) => setTapeNo(e.target.value)} className="h-6 text-xs font-mono px-2" />
                                    </div>
                                    <div className="bg-slate-50 border border-slate-100 rounded p-1.5 w-16 shrink-0">
                                        <span className="text-[9px] uppercase font-bold text-slate-400 block pb-0.5">Chap.</span>
                                        <Input type="number" value={activeChapter} onChange={(e: any) => setActiveChapter(e.target.value)} className="h-6 text-xs font-mono px-2" />
                                    </div>
                                </div>
                            )}

                            {/* Event Logging Dashboard */}
                            <div className="bg-slate-800 text-white rounded p-1.5 shadow-inner flex flex-col gap-1.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] font-bold uppercase text-slate-400 ml-1">Auto Counter</span>
                                    <span className="font-mono text-sm font-black text-cyan-400 tracking-wider bg-black/30 px-2 py-0.5 rounded">{formatTime(vidTimer)}</span>
                                </div>
                                <div className="grid grid-cols-4 gap-1">
                                    <button onClick={() => handleLogEvent("Start Tape")} className="bg-green-600 hover:bg-green-500 text-white rounded py-1.5 text-[9px] font-bold uppercase shadow-sm">Start</button>
                                    <button onClick={() => handleLogEvent("Pause")} className="bg-amber-500 hover:bg-amber-400 text-amber-950 rounded py-1.5 text-[9px] font-bold uppercase shadow-sm">Pause</button>
                                    <button onClick={() => handleLogEvent("Resume")} className="bg-blue-600 hover:bg-blue-500 text-white rounded py-1.5 text-[9px] font-bold uppercase shadow-sm">Resume</button>
                                    <button onClick={() => handleLogEvent("Stop Tape")} className="bg-red-600 hover:bg-red-500 text-white rounded py-1.5 text-[9px] font-bold uppercase shadow-sm">Stop</button>
                                </div>
                            </div>
                        </div>

                        <div className="px-2 py-1.5 text-[10px] font-bold uppercase text-slate-500 tracking-widest border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                            <span className="flex items-center gap-2">
                                Video Log
                                {tapeId && <span className="font-mono text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 normal-case tracking-normal">Tape: {tapeNo || `#${tapeId}`}</span>}
                            </span>
                            <Badge className="h-4 text-[9px] px-1 bg-slate-200 text-slate-600 rounded">{videoEvents.length}</Badge>
                        </div>
                        <ScrollArea className="flex-1 p-1">
                            <div className="space-y-1">
                                {syncLoading && videoEvents.length === 0 && (
                                    <div className="flex items-center justify-center py-4 text-slate-400">
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        <span className="text-[10px] font-bold uppercase">Loading video logs...</span>
                                    </div>
                                )}
                                {!syncLoading && videoEvents.length === 0 && activeDep?.id && (
                                    <div className="flex items-center justify-center py-4 text-slate-400">
                                        <span className="text-[10px] uppercase">No video log events. Press START to begin.</span>
                                    </div>
                                )}
                                {videoEvents.map((ev: any) => (
                                    <div key={ev.id} className="flex justify-between items-center text-[10px] px-2 py-1.5 bg-white border border-slate-100 rounded hover:border-blue-200 group transition-all">
                                        <div className="flex gap-2 items-center">
                                            <div className="flex flex-col">
                                                <span className="font-mono text-slate-500 bg-slate-50 px-1 py-0.5 rounded border border-slate-200">{ev.time}</span>
                                                <span className="text-[8px] text-slate-400 font-mono mt-0.5">{ev.eventTime ? parseDbDate(ev.eventTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : ''}</span>
                                            </div>
                                            <span className={`font-bold ${ev.action === 'Start Tape' || ev.action === 'Resume' ? 'text-green-600' : ev.action === 'Pause' ? 'text-amber-600' : ev.action === 'Stop Tape' ? 'text-red-600' : ev.action === 'ANOMALY' ? 'text-red-600 tracking-wider text-[9px]' : 'text-blue-600 tracking-wider text-[9px]'}`}>{ev.action}</span>
                                        </div>
                                        <div className="flex gap-0.5 opacity-20 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={async () => {
                                                    setEditingEvent(ev);
                                                    if (ev.logType === 'video_log') {
                                                        const { data } = await supabase.from('insp_video_logs')
                                                            .select('event_time, tape_counter_start')
                                                            .eq('tape_id', tapeId)
                                                            .lt('event_time', ev.eventTime)
                                                            .in('event_type', ['NEW_LOG_START', 'RESUME', 'START_TASK', 'RESUME_TASK'])
                                                            .order('event_time', { ascending: false })
                                                            .limit(1)
                                                            .maybeSingle();
                                                        setLastStartEventForEdit(data || null);
                                                    }
                                                }}
                                                className="p-1 hover:bg-slate-100 rounded text-slate-600"
                                                title="Modify Event"
                                                disabled={ev.logType === 'insp'}
                                            >
                                                <Edit className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => handleDeleteEvent(ev.id, ev.logType, ev.realId)} className="p-1 hover:bg-red-50 rounded text-red-500" title="Delete Event"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </Card>

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
                                        <div className="w-full max-w-[350px]">
                                            <div className="text-[11px] font-bold uppercase text-slate-400 tracking-widest mb-4">Select Scope to Inspect ({selectedComp.name})</div>
                                            <div className="space-y-3">
                                                {selectedComp.tasks && selectedComp.tasks.map((t: string) => (
                                                    <Button key={t} onClick={() => setActiveSpec(t)} className="w-full h-12 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 font-bold shadow-sm flex justify-between">
                                                        <span>Start {t}</span> <ArrowRight className="w-4 h-4 text-blue-300" />
                                                    </Button>
                                                ))}
                                                <div className="py-2"><Separator /></div>

                                                <select
                                                    value=""
                                                    onChange={async (e) => {
                                                        const val = e.target.value;
                                                        if (!val) return;
                                                        await handleAddNewInspectionSpec(e);
                                                        // Refresh tasks for UI
                                                        const it = allInspectionTypes.find(t => t.id.toString() === val);
                                                        if (it && selectedComp) {
                                                            const newTasks = [...(selectedComp.tasks || []), it.code || it.name];
                                                            setSelectedComp({ ...selectedComp, tasks: newTasks });
                                                        }
                                                    }}
                                                    className="w-full h-12 px-3 bg-white border-dashed border-2 text-center border-slate-300 text-slate-500 font-bold hover:border-blue-400 focus:outline-none appearance-none cursor-pointer rounded-md"
                                                >
                                                    <option value="">+ Add Additional Inspection Type</option>
                                                    {allInspectionTypes.map(it => (
                                                        <option key={it.id} value={it.id.toString()}>
                                                            {it.code} - {it.name}
                                                        </option>
                                                    ))}
                                                </select>

                                                <div className="py-2"><Separator /></div>
                                                <Button onClick={() => setActiveSpec("General")} variant="outline" className="w-full h-12 font-bold border-slate-200 text-slate-600">
                                                    Log General Finding
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    // Dynamic Form (In-page inline, collapsible)
                                    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-[5%] bg-white z-10">
                                        <div className="p-3 bg-blue-600 text-white flex justify-between items-center shrink-0 shadow-sm border-b border-blue-700">
                                            <span className="font-black tracking-wide text-sm flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-blue-200" />
                                                <span className="text-blue-100 opacity-60 font-medium">{selectedComp.name} /</span> Spec: {activeSpec}
                                            </span>
                                            <div className="flex items-center gap-3">
                                                <span className="font-mono text-xs font-bold bg-black/20 px-2 py-1 rounded border border-white/10 flex items-center gap-1.5"><Video className="w-3 h-3 text-blue-200" /> {formatTime(vidTimer)}</span>
                                                <button onClick={() => setActiveSpec(null)} className="p-1.5 hover:bg-white/10 bg-black/10 rounded transition text-blue-100 hover:text-white" title="Cancel/Close"><X className="w-4 h-4" /></button>
                                            </div>
                                        </div>

                                        <ScrollArea className="flex-1 p-5">
                                            <div className="space-y-5 max-w-2xl mx-auto">
                                                <div className="grid grid-cols-2 gap-5">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><MapPin className="w-3 h-3" /> Verification Depth</label>
                                                        <Input defaultValue={selectedComp.depth} className="h-10 text-sm font-bold bg-slate-50 focus-visible:ring-blue-500" />
                                                    </div>
                                                </div>

                                                {/* Dynamic Spec Forms based on Inspection Type */}
                                                {(() => {
                                                    const activeIt = allInspectionTypes.find(t => t.code === activeSpec || t.name === activeSpec);
                                                    const props = Array.isArray(activeIt?.default_properties) ? activeIt.default_properties : [];
                                                    if (props.length === 0) return null;

                                                    return (
                                                        <div className="p-4 border-2 border-slate-200 bg-slate-50/50 rounded-lg space-y-3">
                                                            <div className="text-[10px] font-black uppercase text-slate-800 tracking-widest border-b border-slate-200 pb-2">Inspection Specification</div>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                {props.map((p: any, idx: number) => (
                                                                    <div key={idx} className="space-y-1">
                                                                        <label className="text-[10px] uppercase font-bold text-slate-500">
                                                                            {p.label || p.name} {p.required && <span className="text-red-500">*</span>}
                                                                        </label>
                                                                        {p.type === 'select' ? (
                                                                            <select
                                                                                className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-semibold focus:ring-blue-500"
                                                                                value={dynamicProps[p.name || p.label] || ""}
                                                                                onChange={(e) => setDynamicProps({ ...dynamicProps, [p.name || p.label]: e.target.value })}
                                                                            >
                                                                                <option value="">Select...</option>
                                                                                {p.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
                                                                            </select>
                                                                        ) : (
                                                                            <Input
                                                                                type={p.type === 'number' ? 'number' : 'text'}
                                                                                placeholder={`Enter ${p.label || p.name}`}
                                                                                className="h-9 text-sm bg-white"
                                                                                value={dynamicProps[p.name || p.label] || ""}
                                                                                onChange={(e) => setDynamicProps({ ...dynamicProps, [p.name || p.label]: e.target.value })}
                                                                            />
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                <div className="space-y-3 p-4 border-2 border-slate-200 rounded-lg bg-white shadow-sm">
                                                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest block border-b border-slate-100 pb-2">Inspection Result</label>
                                                    <div className="flex gap-2">
                                                        <Button variant={findingType === 'Pass' ? 'default' : 'outline'} onClick={() => setFindingType('Pass')} className={`flex-1 h-12 font-bold text-[11px] transition-all ${findingType === 'Pass' ? 'bg-green-600 hover:bg-green-700 text-white shadow-md' : 'text-slate-600 border-slate-300'}`}><CheckCircle2 className="w-4 h-4 mr-1.5" /> Acceptable / Pass</Button>
                                                        <Button variant={findingType === 'Anomaly' ? 'default' : 'outline'} onClick={() => setFindingType('Anomaly')} className={`flex-1 h-12 font-bold text-[11px] transition-all ${findingType === 'Anomaly' ? 'bg-red-600 hover:bg-red-700 text-white shadow-md' : 'text-slate-600 border-slate-300'}`}><AlertCircle className="w-4 h-4 mr-1.5" /> Register Anomaly</Button>
                                                        <Button variant={findingType === 'Incomplete' ? 'default' : 'outline'} onClick={() => setFindingType('Incomplete')} className={`flex-1 h-12 font-bold text-[11px] transition-all ${findingType === 'Incomplete' ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md' : 'text-slate-600 border-slate-300'}`}><FileClock className="w-4 h-4 mr-1.5" /> Task Incomplete</Button>
                                                    </div>

                                                    {findingType === 'Anomaly' && (
                                                        <div className="pt-4 mt-2 border-t border-red-50 space-y-4 animate-in fade-in slide-in-from-top-2">
                                                            <div className="flex justify-between items-center text-[10px] font-black uppercase text-red-600 tracking-tighter">
                                                                <span className="flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" /> Anomaly Information</span>
                                                                <span className="bg-red-50 px-2 py-0.5 rounded font-mono">Ref: {new Date().getFullYear()} / {headerData.platformName?.slice(0, 3).toUpperCase()} / A-AUTO (Draft)</span>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Defect Code *</label>
                                                                    <select
                                                                        value={anomalyData.defectCode}
                                                                        onChange={(e) => setAnomalyData({ ...anomalyData, defectCode: e.target.value })}
                                                                        className="flex h-9 w-full rounded-md border border-slate-300 bg-slate-50 px-2.5 text-xs font-semibold focus:ring-red-500"
                                                                    >
                                                                        <option value="">Select Code</option>
                                                                        {defectCodes.map(c => (
                                                                            <option key={c.lib_id} value={c.lib_desc}>{c.lib_desc}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Priority *</label>
                                                                    <select
                                                                        value={anomalyData.priority}
                                                                        onChange={(e) => setAnomalyData({ ...anomalyData, priority: e.target.value })}
                                                                        className="flex h-9 w-full rounded-md border border-slate-300 bg-slate-50 px-2.5 text-xs font-semibold focus:ring-red-500"
                                                                    >
                                                                        <option value="">Select Priority</option>
                                                                        {priorities.map(p => (
                                                                            <option key={p.lib_id} value={p.lib_desc}>{p.lib_desc}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-1.5">
                                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Defect Type</label>
                                                                <select
                                                                    value={anomalyData.defectType}
                                                                    onChange={(e) => setAnomalyData({ ...anomalyData, defectType: e.target.value })}
                                                                    className="flex h-9 w-full rounded-md border border-slate-300 bg-slate-50 px-2.5 text-xs font-semibold focus:ring-red-500"
                                                                >
                                                                    <option value="">Select Type</option>
                                                                    {allDefectTypes.map(t => (
                                                                        <option key={t.lib_id} value={t.lib_desc}>{t.lib_desc}</option>
                                                                    ))}
                                                                </select>
                                                            </div>

                                                            <div className="space-y-1.5">
                                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Anomaly Description</label>
                                                                <textarea
                                                                    value={anomalyData.description}
                                                                    onChange={(e) => setAnomalyData({ ...anomalyData, description: e.target.value })}
                                                                    placeholder="Detailed description of the anomaly..."
                                                                    className="w-full min-h-[60px] rounded border border-slate-300 p-2 text-xs bg-slate-50 focus:ring-red-500"
                                                                ></textarea>
                                                            </div>

                                                            <div className="space-y-1.5">
                                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Recommended Action</label>
                                                                <textarea
                                                                    value={anomalyData.recommendedAction}
                                                                    onChange={(e) => setAnomalyData({ ...anomalyData, recommendedAction: e.target.value })}
                                                                    placeholder="Recommended remedial action..."
                                                                    className="w-full min-h-[60px] rounded border border-slate-300 p-2 text-xs bg-slate-50 focus:ring-red-500"
                                                                ></textarea>
                                                            </div>

                                                            <div className="p-3 border border-green-100 bg-green-50/50 rounded-lg space-y-3">
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        id="rectifyCheck"
                                                                        checked={anomalyData.rectify}
                                                                        onChange={(e) => setAnomalyData({ ...anomalyData, rectify: e.target.checked })}
                                                                        className="w-4 h-4 rounded text-green-600 focus:ring-green-500"
                                                                    />
                                                                    <label htmlFor="rectifyCheck" className="text-xs font-bold text-green-800">Rectify Anomaly</label>
                                                                </div>
                                                                {anomalyData.rectify && (
                                                                    <div className="space-y-3 animate-in fade-in zoom-in-95">
                                                                        <div className="space-y-1">
                                                                            <label className="text-[9px] font-bold text-slate-400 uppercase">Rectified Date</label>
                                                                            <Input
                                                                                type="date"
                                                                                value={anomalyData.rectifiedDate}
                                                                                onChange={(e) => setAnomalyData({ ...anomalyData, rectifiedDate: e.target.value })}
                                                                                className="h-8 text-xs bg-white"
                                                                            />
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <label className="text-[9px] font-bold text-slate-400 uppercase">Rectification Remarks</label>
                                                                            <textarea
                                                                                value={anomalyData.rectifiedRemarks}
                                                                                onChange={(e) => setAnomalyData({ ...anomalyData, rectifiedRemarks: e.target.value })}
                                                                                placeholder="How was it rectified?"
                                                                                className="w-full min-h-[50px] rounded border border-slate-300 p-2 text-xs bg-white"
                                                                            ></textarea>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

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
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><FileText className="w-3 h-3" /> Detailed Field Notes</label>
                                                    <textarea value={recordNotes} onChange={(e) => setRecordNotes(e.target.value)} placeholder="Observation specifics, dimensions, characteristics..." className="w-full min-h-[100px] rounded-lg border border-slate-300 p-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none bg-slate-50/50"></textarea>
                                                </div>

                                                {/* Linking Photo Option */}
                                                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50 transition-colors hover:bg-slate-100">
                                                    <input type="checkbox" id="linkPhoto" checked={photoLinked} onChange={(e) => setPhotoLinked(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer focus:ring-blue-500" />
                                                    <label htmlFor="linkPhoto" className="text-sm font-bold text-slate-700 cursor-pointer flex-1 flex items-center gap-1.5"><Camera className="w-4 h-4 text-slate-400" /> Attach Last Captured Frame</label>
                                                </div>

                                                <div className="pt-2 pb-6">
                                                    <Button disabled={isCommitting} onClick={handleCommitRecord} className="w-full h-14 font-black shadow-lg bg-blue-600 hover:bg-blue-700 text-white text-base tracking-wide rounded-xl">
                                                        <Save className="w-5 h-5 mr-2" /> {isCommitting ? "Committing..." : "Commit Record & Reset"}
                                                    </Button>
                                                </div>
                                            </div>
                                        </ScrollArea>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>

                    {/* 7. Session Records Table (Records session completed before in the current dive) */}
                    <Card className="flex flex-col h-[280px] border-slate-200 shadow-sm rounded-md bg-white overflow-hidden shrink-0">
                        <div className="bg-slate-800 text-white px-3 py-2 text-[11px] font-bold uppercase tracking-widest flex justify-between items-center">
                            <span>7. Session Records ({inspMethod === 'DIVING' ? 'Current Dive' : 'Current ROV'})</span>
                            <Badge className="bg-blue-600 text-white border-none text-[9px] h-4 leading-none font-bold uppercase tracking-wider">{currentRecords.length} Captured</Badge>
                        </div>
                        <ScrollArea className="flex-1 w-full relative">
                            <table className="w-full text-left text-[11px] whitespace-nowrap">
                                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-3 py-2 w-20">Date <History className="w-2.5 h-2.5 inline" /></th>
                                        <th className="px-3 py-2">Type</th>
                                        <th className="px-3 py-2">Component</th>
                                        <th className="px-3 py-2 text-center">Elev/KP</th>
                                        <th className="px-3 py-2 text-center">Status</th>
                                        <th className="px-3 py-2 text-right">Actions</th>
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
                                                <td className="px-3 py-2 text-slate-600 align-top">
                                                    <div>{r.inspection_date ? format(new Date(r.inspection_date), 'dd MMM') : '-'}</div>
                                                    <div className="text-[9px] opacity-70">{r.inspection_time?.slice(0, 5)}</div>
                                                </td>
                                                <td className="px-3 py-2 font-bold text-slate-800 align-top">
                                                    <div className="truncate max-w-[120px]" title={r.inspection_type?.name}>{r.inspection_type?.name || "UNK"}</div>
                                                    <Badge variant="outline" className="text-[8px] h-3.5 px-1 font-medium w-fit uppercase text-muted-foreground border-slate-200 shadow-none mt-0.5">
                                                        {r.inspection_type_code || r.inspection_type?.code || 'UNK'}
                                                    </Badge>
                                                    {(r.inspection_data?._meta_timecode || r.tape_count_no) && (
                                                        <div className="text-[9px] font-mono text-muted-foreground flex items-center gap-1 mt-0.5">
                                                            <div className="w-1 h-1 rounded-full bg-blue-500"></div>
                                                            {formatCounter(r.inspection_data?._meta_timecode || r.tape_count_no)}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 align-top text-slate-700">
                                                    {r.structure_components?.q_id || '-'}
                                                </td>
                                                <td className="px-3 py-2 text-center text-slate-500 align-top">
                                                    {r.elevation ? `${r.elevation}m` : (r.fp_kp || '-')}
                                                </td>
                                                <td className="px-3 py-2 align-top text-center">
                                                    <div className="flex justify-center">
                                                        {r.has_anomaly ? (
                                                            <div title="Anomaly Found" className="flex items-center justify-center h-4 w-4 rounded-full bg-red-100">
                                                                <AlertTriangle className="h-2.5 w-2.5 text-red-600" />
                                                            </div>
                                                        ) : r.status === 'COMPLETED' ? (
                                                            <div title="Inspected / Completed" className="flex items-center justify-center h-4 w-4 rounded-full bg-green-100">
                                                                <CheckCircle2 className="h-2.5 w-2.5 text-green-600" />
                                                            </div>
                                                        ) : (
                                                            <div title="Incomplete / Draft" className="flex items-center justify-center h-4 w-4 rounded-full bg-amber-100">
                                                                <FileClock className="h-2.5 w-2.5 text-amber-600" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-right align-top">
                                                    <div className="flex items-center justify-end gap-1 group-hover:opacity-100 opacity-60 transition-opacity">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <button className="p-1 px-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white rounded flex items-center gap-1 transition-colors text-[9px] font-bold uppercase tracking-wider text-slate-600" title="Report Options">
                                                                    <FileText className="w-3 h-3" /> Actions
                                                                </button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-48">
                                                                <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1">Reports</div>
                                                                <DropdownMenuItem onClick={() => generateInspectionReport(r.insp_id)} className="text-xs py-2 cursor-pointer">
                                                                    <FileSpreadsheet className="w-3.5 h-3.5 mr-2 text-blue-500" /> Inspection Report
                                                                </DropdownMenuItem>
                                                                {r.has_anomaly && (
                                                                    <DropdownMenuItem onClick={() => handlePrintAnomaly(r)} className="text-xs py-2 cursor-pointer text-red-600 focus:text-red-700">
                                                                        <AlertTriangle className="w-3.5 h-3.5 mr-2" /> Defect / Anomaly Report
                                                                    </DropdownMenuItem>
                                                                )}
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
                    </Card>

                </div>

                {/* ======== COL 3: SELECTION & HISTORY (RIGHT) ======== */}
                <div className="w-[360px] flex flex-col gap-3 shrink-0 overflow-hidden">

                    {/* 3. Component Target Selection */}
                    <Card className="flex flex-col h-[400px] border-slate-200 shadow-sm rounded-md shrink-0 bg-white overflow-hidden">
                        <div className="bg-slate-800 text-white flex items-center justify-between pl-1 pr-3 shrink-0">
                            <div className="flex">
                                <button onClick={() => setCompView("LIST")} className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${compView === 'LIST' ? 'bg-blue-600 text-white border-b border-blue-600' : 'text-slate-400 hover:text-white border-b border-transparent'}`}>3. Component</button>
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
                                                {componentsSow.filter((c: any) => c.name?.toLowerCase().includes(compSearchTerm.toLowerCase())).map((c: any) => (
                                                    <button key={c.id} onClick={() => { setSelectedComp(c); setActiveSpec(null); }} className={`w-full text-left p-2 rounded text-xs transition-all border ${selectedComp?.id === c.id ? 'bg-blue-600 text-white border-blue-700 shadow-md' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                                                        <div className="flex justify-between font-bold"><span>{c.name}</span><span className="font-mono opacity-75">{c.depth}</span></div>
                                                        <div className="text-[10px] mt-1 opacity-85 font-mono">Tasks: {c.tasks?.join(', ')}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-1 rounded tracking-widest mb-1.5 mt-2 border border-slate-200">Non-SOW</div>
                                            <div className="space-y-1">
                                                {componentsNonSow.filter((c: any) => c.name?.toLowerCase().includes(compSearchTerm.toLowerCase())).map((c: any) => (
                                                    <button key={c.id} onClick={() => { setSelectedComp(c); setActiveSpec(null); }} className={`w-full text-left p-2 rounded text-xs transition-all border ${selectedComp?.id === c.id ? 'bg-slate-700 text-white border-slate-800 shadow-md' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                                                        <div className="flex justify-between font-bold"><span>{c.name}</span><span className="font-mono opacity-75">{c.depth}</span></div>
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
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">4. Target History</span>
                            <History className="w-3 h-3 text-slate-400" />
                        </div>
                        <ScrollArea className="flex-1 p-3">
                            {!selectedComp ? (
                                <div className="text-center text-slate-400 text-xs py-10">Select component to view history</div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="font-bold text-slate-900 text-sm mb-2">{selectedComp.name} Past Results</div>
                                    {historicalRecords.length === 0 ? (
                                        <div className="text-xs text-slate-400 p-2 text-center bg-slate-50 rounded border border-dashed">No history detected</div>
                                    ) : historicalRecords.map((h, i) => (
                                        <div key={i} className="flex flex-col gap-1 p-2 bg-slate-50 rounded border border-slate-100 text-[11px] transition hover:bg-white hover:shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="font-mono font-bold text-slate-500">{h.year} - {h.type}</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${h.status === 'Pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{h.status}</span>
                                            </div>
                                            <span className="text-slate-600 italic">"{h.finding}"</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </Card>

                </div>

            </div>

            {isDiveSetupOpen && (
                <DiveJobSetupDialog
                    jobpackId={jobPackId || ""}
                    structureId={structureId || ""}
                    sowId={sowIdFull || sowId || ""}
                    existingJob={(activeDep as any)?.raw}
                    open={isDiveSetupOpen}
                    onOpenChange={setIsDiveSetupOpen}
                    onJobCreated={(job: any) => {
                        setIsDiveSetupOpen(false);
                        window.location.reload(); // Refresh to catch newly deployed Job
                    }}
                />
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

                                        setEditingEvent({ ...editingEvent, eventTime: newIso, time: updatedTime });
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
                                <Activity className="w-5 h-5 text-blue-600" /> Dive Movements & Checklists
                            </h2>
                            <button onClick={() => {
                                setIsMovementLogOpen(false);
                                if (activeDep) {
                                    setActiveDep({ ...activeDep });
                                }
                            }} className="rounded-full p-1.5 hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
                        </div>
                        <div className="p-6">
                            <DiveMovementLog diveJob={(activeDep as any)?.raw} />
                        </div>
                    </div>
                </div>
            )}
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

            {/* Attachment Dialogue */}
            <Dialog open={isAttachDialogOpen} onOpenChange={setIsAttachDialogOpen}>
                <DialogContent className="max-w-md p-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Paperclip className="w-5 h-5 text-blue-600" />
                            Link Media to Record
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase text-slate-500">Target Inspection Record</Label>
                            <select
                                value={selectedRecordToLink || ""}
                                onChange={(e) => setSelectedRecordToLink(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="">Select Record from Session...</option>
                                {currentRecords.map((r: any) => (
                                    <option key={r.insp_id} value={r.insp_id}>
                                        {r.inspection_type?.name} - {r.structure_components?.q_id} ({r.inspection_time?.slice(0, 5)})
                                    </option>
                                ))}
                            </select>
                            {currentRecords.length === 0 && (
                                <p className="text-[10px] text-amber-600 font-medium italic mt-1">No records found in current session. Commit a record first.</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase text-slate-500">Attachment Title</Label>
                            <Input
                                value={attachmentMetadata.title}
                                onChange={(e) => setAttachmentMetadata({ ...attachmentMetadata, title: e.target.value })}
                                placeholder="Enter title (e.g. Photo of Anomaly)..."
                                className="h-10 text-sm font-medium"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase text-slate-500">Description / Observation</Label>
                            <textarea
                                value={attachmentMetadata.description}
                                onChange={(e) => setAttachmentMetadata({ ...attachmentMetadata, description: e.target.value })}
                                className="w-full h-24 p-3 text-sm border border-slate-200 bg-slate-50 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none font-medium"
                                placeholder="Describe what this media shows..."
                            />
                        </div>

                        <div className="pt-2 flex gap-2">
                            <Button variant="outline" className="flex-1 font-bold h-11" onClick={() => setIsAttachDialogOpen(false)}>Cancel</Button>
                            <Button
                                disabled={isCommitting || !selectedRecordToLink}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 shadow-lg shadow-blue-500/20"
                                onClick={confirmAttachToRecord}
                            >
                                {isCommitting ? (
                                    <span className="flex items-center gap-2"><CloudUpload className="w-4 h-4 animate-bounce" /> Uploading...</span>
                                ) : (
                                    <span className="flex items-center gap-2"><Check className="w-4 h-4" /> Confirm & Link</span>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
