"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToastProvider } from "@/components/ui/toast";

import {
    Camera,
    Play,
    Square,
    Settings,
    ArrowLeft,
    PenTool,
    Undo,
    Trash2,
    MousePointer2,
    MoveRight,
    Circle as CircleIcon,
    Square as SquareIcon,
    Maximize2,
    Minimize2,
    X,
    Pause,
    FileText,
    History,
    Mic,
    MoreHorizontal,
    Eye,
    EyeOff,
    Plus,
    CircleStop,
    Pencil,
    Check
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { loadSettings, type WorkstationSettings } from "@/lib/video-recorder/settings-manager";
import VideoRecorderSettings from "@/components/video-recorder-settings";
import { CanvasOverlayManager, type DrawingTool } from "@/lib/video-recorder/canvas-overlay";
import { createMediaRecorder, startRecording, saveFile, getPhotoExtension } from "@/lib/video-recorder/media-recorder";
import { useAtom } from "jotai";
import {
    videoTapeIdAtom,
    videoTapeNoAtom,
    videoTimeCodeAtom,
    videoCounterAtom,
    isRecordingAtom,
    isStreamingAtom,
    isPausedAtom,
    isTaskRunningAtom,
    isTaskPausedAtom,
    videoLogsAtom,
    type VideoLog,
    taskStartTimeAtom,
    taskBaseDurationAtom
} from "@/lib/video-recorder/video-state";
import { createClient } from "@/utils/supabase/client";

interface DiveVideoRecorderProps {
    diveJob: any;
    isFloating?: boolean;
    onClose?: () => void;
    onToggleMode?: () => void;
    className?: string;
    refreshKey?: string | number;
}

export default function DiveVideoRecorder({
    diveJob,
    isFloating,
    onClose,
    onToggleMode,
    className,
    refreshKey
}: DiveVideoRecorderProps) {
    const supabase = createClient();

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayManagerRef = useRef<CanvasOverlayManager | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const animationFrameRef = useRef<number>(0);

    // Global State
    const [tapeId, setTapeId] = useAtom(videoTapeIdAtom);
    const [tapeNo, setTapeNo] = useAtom(videoTapeNoAtom);
    const [timeCode, setTimeCode] = useAtom(videoTimeCodeAtom);
    const [counter, setCounter] = useAtom(videoCounterAtom);
    const [isRecording, setIsRecording] = useAtom(isRecordingAtom);
    const [isStreaming, setIsStreaming] = useAtom(isStreamingAtom);
    const [isPaused, setIsPaused] = useAtom(isPausedAtom); // Media Recording Pause
    const [isTaskRunning, setIsTaskRunning] = useAtom(isTaskRunningAtom); // Task/Timer Running
    const [isTaskPaused, setIsTaskPaused] = useAtom(isTaskPausedAtom); // Task/Timer Paused
    const [videoLogs, setVideoLogs] = useAtom(videoLogsAtom);
    const [taskStartTime, setTaskStartTime] = useAtom(taskStartTimeAtom);
    const [taskBaseDuration, setTaskBaseDuration] = useAtom(taskBaseDurationAtom);

    // Local State
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState<WorkstationSettings | null>(null);
    const [isOfflineMode, setIsOfflineMode] = useState(false);

    // Tape Management State
    const [jobTapes, setJobTapes] = useState<any[]>([]);
    const [isEditTapeOpen, setIsEditTapeOpen] = useState(false);
    const [editTapeNo, setEditTapeNo] = useState("");
    const [editTapeStatus, setEditTapeStatus] = useState("ACTIVE");
    const [editTapeChapter, setEditTapeChapter] = useState("");
    const [editTapeRemarks, setEditTapeRemarks] = useState("");
    // New Tape Creation State
    const [isNewTapeOpen, setIsNewTapeOpen] = useState(false);
    const [newTapeNo, setNewTapeNo] = useState("");
    const [newTapeChapter, setNewTapeChapter] = useState("");
    const [newTapeRemarks, setNewTapeRemarks] = useState("");

    // Metadata State
    const [chapterDetails, setChapterDetails] = useState("");
    const [recordingMode, setRecordingMode] = useState("PRIMARY");
    const [recordingType, setRecordingType] = useState("DIGITAL");

    // Tools State
    const [showTools, setShowTools] = useState(false);
    const [showLogPanel, setShowLogPanel] = useState(false); // New state for log panel
    const [editingLogId, setEditingLogId] = useState<string | null>(null);
    const [editLogRemarks, setEditLogRemarks] = useState("");
    const [editLogTimecode, setEditLogTimecode] = useState("");
    const [currentTool, setCurrentTool] = useState<DrawingTool>('pen');
    const [currentColor, setCurrentColor] = useState('#ef4444');
    const [lineWidth, setLineWidth] = useState(3);
    const [isVideoVisible, setIsVideoVisible] = useState(true);

    // Initial Timer Recovery Logic - Recalculate based on persisted start/base times
    // AND Sync with Database Logs for robustness across devices/sessions
    const syncStateFromDB = async () => {
        console.log("syncStateFromDB running...", { jobId: diveJob?.dive_job_id, tapeId });

        if (!diveJob?.dive_job_id && !diveJob?.rov_job_id && !tapeId) return;

        let currentTapeId = tapeId;

        // Determine context: Dive vs ROV
        const activeJobId = diveJob?.dive_job_id || diveJob?.rov_job_id;
        const jobColumn = diveJob?.dive_job_id ? 'dive_job_id' : 'rov_job_id';

        // 1. Sync Tape ID with current Job (Dive or ROV)
        if (activeJobId) {
            const { data: tapes, error: tapeError } = await supabase
                .from('insp_video_tapes')
                .select('*')
                .eq(jobColumn, activeJobId)
                .order('cr_date', { ascending: false });

            if (tapeError) console.error("Error fetching job tapes:", tapeError);

            // Update local list of tapes
            setJobTapes(tapes || []);
            const jobTapes = tapes || [];

            if (jobTapes && jobTapes.length > 0) {
                // Check if the current tape ID is valid for this job
                const isCurrentTapeValid = currentTapeId && jobTapes.some(t => t.tape_id === currentTapeId);

                if (!isCurrentTapeValid) {
                    // Only auto-select if we don't have a valid tape selected for this job
                    const activeTape = jobTapes.find(t => t.status === 'ACTIVE');
                    // Fallback to the LATEST tape if no active tape is found
                    const targetTape = activeTape || jobTapes[0];

                    console.log("Auto-selecting tape context to:", targetTape);
                    setTapeId(targetTape.tape_id);
                    setTapeNo(targetTape.tape_no);
                    currentTapeId = targetTape.tape_id;
                }
            } else {
                // If no tapes exist for this job, but we have a stale ID, clear it
                if (currentTapeId) {
                    console.log("Clearing stale tape ID (none found for this job)");
                    setTapeId(null);
                    setTapeNo('');
                    currentTapeId = null;

                    // Also reset timer visuals since we have no tape
                    setCounter(0);
                    setTimeFormat(0);
                    setIsTaskRunning(false);
                }
            }
        }

        if (!currentTapeId) return;

        // 2. Recover Timer State from Last Control Log
        // We fetch the LATEST log that affects timer state (START, STOP, PAUSE, RESUME)
        const { data: lastLog, error: logError } = await supabase
            .from('insp_video_logs')
            .select('*')
            .eq('tape_id', currentTapeId)
            .in('event_type', ['START_TASK', 'STOP_TASK', 'PAUSE_TASK', 'RESUME_TASK'])
            .order('event_time', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (logError) console.error("Error fetching last control log:", logError);

        // Reconstruct State from Last Log
        if (lastLog) {
            const logTime = new Date(lastLog.event_time).getTime(); // Time the event happened
            const type = lastLog.event_type;
            const loggedCounter = lastLog.tape_counter_start || 0; // The counter value AT that moment

            // Calculate elapsed actual time since that event
            const now = Date.now();
            const elapsed = Math.max(0, Math.floor((now - logTime) / 1000));

            console.log(`Restoring Timer State: ${type} @ ${loggedCounter}s (Elapsed: ${elapsed}s)`);

            if (type === 'START_TASK' || type === 'RESUME_TASK') {
                setIsTaskRunning(true);
                setIsTaskPaused(false);
                setTaskStartTime(logTime);
                setTaskBaseDuration(loggedCounter);

                // Update immediate display
                const total = loggedCounter + elapsed;
                setCounter(total);
                setTimeFormat(total);
            } else if (type === 'PAUSE_TASK') {
                // Paused: The counter is frozen at loggedCounter.
                setIsTaskRunning(true);
                setIsTaskPaused(true);
                setTaskStartTime(null); // Not counting live
                setTaskBaseDuration(loggedCounter);
                setCounter(loggedCounter);
                setTimeFormat(loggedCounter);
            } else if (type === 'STOP_TASK') {
                // Stopped: Reset
                setIsTaskRunning(false);
                setIsTaskPaused(false);
                setTaskStartTime(null);
                setTaskBaseDuration(0);
                setCounter(0);
                setTimeFormat(0);
            }
            toast.success(`Timer synchronized: ${type}`);
        }

        // 3. Fetch logs for history display - SCOPED TO CURRENT TAPE
        // User requested logs to vary based on selected tape no
        let logsQuery = supabase
            .from('insp_video_logs')
            .select('*')
            .eq('tape_id', currentTapeId)
            .order('event_time', { ascending: false });

        const { data: allLogs, error: historyError } = await logsQuery;

        if (allLogs) {
            const mappedLogs: VideoLog[] = allLogs.map((l: any) => ({
                id: l.video_log_id ? String(l.video_log_id) : Math.random().toString(), // Ensure string ID
                timestamp: l.event_time,
                timecode: l.timecode_start || '00:00:00',
                event_type: l.event_type,
                remarks: l.remarks || ''
            }));

            // Update local logs state matching DB
            setVideoLogs(mappedLogs);
        }
    };

    // Initial Timer Recovery Logic - Recalculate based on persisted start/base times
    // AND Sync with Database Logs for robustness across devices/sessions
    useEffect(() => {
        syncStateFromDB();
    }, [diveJob, tapeId, refreshKey]); // Run when job, tape, or refreshKey changes

    // Helper to format time immediately
    const setTimeFormat = (total: number) => {
        const h = Math.floor(total / 3600).toString().padStart(2, '0');
        const m = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
        const s = (total % 60).toString().padStart(2, '0');
        setTimeCode(`${h}:${m}:${s}`);
    };

    // Function to update tape details
    async function updateTapeDetails() {
        if (!tapeId || !editTapeNo) return;

        const { error } = await supabase
            .from('insp_video_tapes')
            .update({
                tape_no: editTapeNo,
                status: editTapeStatus,
                chapter_no: editTapeChapter,
                remarks: editTapeRemarks
            })
            .eq('tape_id', tapeId);

        if (error) {
            toast.error("Failed to update tape details");
            console.error(error);
        } else {
            toast.success("Tape details updated");
            setTapeNo(editTapeNo);
            setIsEditTapeOpen(false);
            // Trigger re-sync to update list in UI
            setJobTapes(prev => prev.map(t => t.tape_id === tapeId ? {
                ...t,
                tape_no: editTapeNo,
                status: editTapeStatus,
                chapter_no: editTapeChapter,
                remarks: editTapeRemarks
            } : t));
        }
    }

    // Function to create new tape from Dialog
    async function createTape() {
        if (!newTapeNo) return;

        // VALIDATION: Must have an active job
        const hasActiveJob = diveJob && (diveJob.dive_job_id || diveJob.rov_job_id);
        if (!hasActiveJob) {
            toast.error("Cannot create or save tape details without an active Deployment/Dive number.");
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();

        const payload: any = {
            tape_no: newTapeNo,
            tape_type: `${recordingType} - ${recordingMode}`,
            status: 'ACTIVE',
            workunit: '000',
            cr_user: user?.id || 'system',
            chapter_no: newTapeChapter,
            remarks: newTapeRemarks
        };

        if (diveJob?.dive_job_id) payload.dive_job_id = diveJob.dive_job_id;
        if (diveJob?.rov_job_id) payload.rov_job_id = diveJob.rov_job_id;

        const { data: newTape, error } = await supabase
            .from('insp_video_tapes')
            .insert(payload)
            .select('*')
            .single();

        if (error) {
            toast.error("Failed to create tape");
            console.error(error);
        } else {
            toast.success("New tape created");
            setTapeId(newTape.tape_id);
            setTapeNo(newTape.tape_no);
            setIsNewTapeOpen(false);
            // Add to local list and select it
            setJobTapes(prev => [newTape, ...prev]);
        }
    }


    // Timer Effect for Counter (Driven by Task State now)
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (isTaskRunning && !isTaskPaused && taskStartTime) {
            interval = setInterval(() => {
                const now = Date.now();
                // Calculate total duration: Base (from previous segments) + Current Segment (Now - Start)
                const currentSegmentDuration = Math.floor((now - taskStartTime) / 1000);
                const totalDuration = taskBaseDuration + currentSegmentDuration;

                setCounter(totalDuration);

                const h = Math.floor(totalDuration / 3600).toString().padStart(2, '0');
                const m = Math.floor((totalDuration % 3600) / 60).toString().padStart(2, '0');
                const s = (totalDuration % 60).toString().padStart(2, '0');
                setTimeCode(`${h}:${m}:${s}`);
            }, 1000);
        }

        return () => clearInterval(interval);
    }, [isTaskRunning, isTaskPaused, taskStartTime, taskBaseDuration, setCounter, setTimeCode]);

    // Track previous state of showSettings to detect closing event
    const prevShowSettingsRef = useRef(showSettings);

    // Re-initialize video stream when Settings dialog closes
    useEffect(() => {
        const justClosed = prevShowSettingsRef.current && !showSettings;
        // Always update ref to current state for next render
        prevShowSettingsRef.current = showSettings;

        if (justClosed && isStreaming && !isOfflineMode) {
            // Dialog closed. Check if settings changed.
            const freshSettings = loadSettings();

            // Compare critical constraints to decide if we need to restart media flow
            const oldVid: any = settings?.video || {};
            const newVid: any = freshSettings.video || {};

            const isChanged = oldVid.deviceId !== newVid.deviceId ||
                oldVid.resolution !== newVid.resolution ||
                oldVid.frameRate !== newVid.frameRate;

            if (isChanged) {
                console.log("Settings changed, restarting stream...");
                cleanupStream();
                // Restart with new settings
                // Small delay to ensure cleanup processes
                setTimeout(() => handleStartVideo(freshSettings), 100);
            } else {
                // No change, just re-attach existing stream to DOM because video element was unmounted
                if (videoRef.current && stream) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().catch(e => console.error("Resume play error:", e));

                    // Re-init canvas overlay
                    if (canvasRef.current) {
                        canvasRef.current.width = videoRef.current.videoWidth;
                        canvasRef.current.height = videoRef.current.videoHeight;

                        // Re-bind overlay manager to new canvas
                        if (overlayManagerRef.current) overlayManagerRef.current.destroy();

                        overlayManagerRef.current = new CanvasOverlayManager(canvasRef.current);
                        overlayManagerRef.current.setTool(currentTool);
                        overlayManagerRef.current.setColor(currentColor);
                        overlayManagerRef.current.setLineWidth(lineWidth);
                    }
                }
                // Update state to match latest
                setSettings(freshSettings);
            }
        }
    }, [showSettings, isStreaming, isOfflineMode, settings, stream, currentTool, currentColor, lineWidth]);

    // Auto-generate Tape ID if empty - DISABLED per user request
    // useEffect(() => {
    //     if (!tapeNo && diveJob?.sow_report_no) {
    //          const base = diveJob.sow_report_no;
    //          const seq = '001'; // Default start
    //          setTapeNo(`${base}-T-${seq}`);
    //     }
    // }, [diveJob, tapeNo, setTapeNo]);

    async function ensureTapeRecord() {
        if (!tapeNo) return null;

        // Return existing ID if we already have it locally to avoid redundant calls
        if (tapeId) return tapeId;

        const { data: existing } = await supabase
            .from('insp_video_tapes')
            .select('tape_id')
            .eq('tape_no', tapeNo)
            .single();

        if (existing) {
            setTapeId(existing.tape_id);
            return existing.tape_id;
        }

        // VALIDATION: Must have an active job
        const hasActiveJob = diveJob && (diveJob.dive_job_id || diveJob.rov_job_id);
        if (!hasActiveJob) {
            toast.error("Cannot create or save tape details without an active Deployment/Dive number.");
            return null;
        }

        const { data: { user } } = await supabase.auth.getUser();

        const payload: any = {
            tape_no: tapeNo,
            tape_type: `${recordingType} - ${recordingMode}`,
            status: 'ACTIVE',
            workunit: '000',
            cr_user: user?.id || 'system'
        };

        // Handle Dive vs ROV Job ID
        if (diveJob?.dive_job_id) payload.dive_job_id = diveJob.dive_job_id;
        if (diveJob?.rov_job_id) payload.rov_job_id = diveJob.rov_job_id;

        const { data: newTape, error } = await supabase
            .from('insp_video_tapes')
            .insert(payload)
            .select('tape_id')
            .single();

        if (error) {
            console.error('Error creating tape record:', error);
            if (error.code === '42501' || error.message?.includes('row-level security')) {
                toast.error("Permission Error: Cannot create tape record. Check RLS policies.");
            } else {
                toast.error(`Failed to initialize tape: ${error.message}`);
            }
            return null;
        }

        setTapeId(newTape.tape_id);
        return newTape.tape_id;
    }



    async function addLog(eventType: string, remarks: string = "", overrideCounter?: number) {
        let currentTapeId = tapeId;

        // If no tape ID, try to ensure/create one
        if (!currentTapeId) {
            currentTapeId = await ensureTapeRecord();
        }

        // If still no tape ID (failed to create), show error and abort
        if (!currentTapeId) {
            toast.error("Could not initialize tape ID. Please enter a Tape ID or start a task.");
            return;
        }

        const timestamp = new Date().toISOString();
        const currentTCode = timeCode;
        const currentCounter = overrideCounter !== undefined ? overrideCounter : counter;

        // Save to DB first to get the real ID
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.from('insp_video_logs').insert({
            tape_id: currentTapeId,
            event_type: eventType,
            event_time: timestamp,
            timecode_start: currentTCode,
            tape_counter_start: currentCounter,
            remarks: remarks || chapterDetails,
            cr_user: user?.id || 'system',
            workunit: '000'
        }).select().single();

        if (error || !data) {
            console.error("Error saving log:", error);
            toast.error("Failed to save log to database");
            return;
        }

        const newLog: VideoLog = {
            id: String(data.video_log_id),
            timestamp,
            timecode: currentTCode,
            event_type: eventType,
            remarks: remarks || chapterDetails,
        };

        setVideoLogs(prev => [newLog, ...prev]);
    }

    // Helper to parse HH:MM:SS to seconds
    function timeStringToSeconds(timeString: string): number {
        const parts = timeString.split(':').map(Number);
        if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
        return 0; // Fallback
    }

    async function updateLog(logId: string, newRemarks: string, newTimecode: string) {
        if (!logId) return;

        // Optimistic update
        setVideoLogs(prev => prev.map(l => l.id === logId ? { ...l, remarks: newRemarks, timecode: newTimecode } : l));
        setEditingLogId(null);
        setEditLogRemarks("");
        setEditLogTimecode("");

        const newCounter = timeStringToSeconds(newTimecode);

        const { error } = await supabase
            .from('insp_video_logs')
            .update({
                remarks: newRemarks,
                timecode_start: newTimecode,   // Update string representation
                tape_counter_start: newCounter // Update numeric counter to match
            })
            .eq('video_log_id', logId);

        if (error) {
            toast.error("Failed to update log key");
            console.error(error);
        } else {
            toast.success("Log updated successfully");
        }
    }

    async function deleteLog(logId: string) {
        if (!logId) return;

        if (!confirm("Are you sure you want to delete this log entry?")) return;

        // Find the log to be deleted to check its type
        const logToDelete = videoLogs.find(l => l.id === logId);
        const wasStopOrPause = logToDelete?.event_type === 'STOP_TASK' || logToDelete?.event_type === 'PAUSE_TASK';

        // Optimistic update
        const updatedLogs = videoLogs.filter(l => l.id !== logId);
        setVideoLogs(updatedLogs);

        const { error } = await supabase
            .from('insp_video_logs')
            .delete()
            .eq('video_log_id', logId);

        if (error) {
            toast.error("Failed to delete log");
            console.error(error);
            // Revert optimistic update nicely would require re-fetching or keeping prior state
            syncStateFromDB(); // Force re-sync to be safe
        } else {
            toast.success("Log deleted");

            // Logic to restore state if we deleted a state-changing log
            if (wasStopOrPause) {
                // Find the latest state-defining log in the remaining logs
                // The logs are in descending order (newest first)
                const lastStateLog = updatedLogs.find(l =>
                    ['START_TASK', 'RESUME_TASK', 'STOP_TASK', 'PAUSE_TASK'].includes(l.event_type)
                );

                if (lastStateLog) {
                    if (lastStateLog.event_type === 'START_TASK' || lastStateLog.event_type === 'RESUME_TASK') {
                        // We should be RUNNING based on this previous log
                        const startTime = new Date(lastStateLog.timestamp).getTime();
                        // We need to calculate how much time has passed since THAT event
                        // But since we don't store "base duration" in logs easily, this is an approximation.
                        // Ideally, we treat 'timestamp' as the start time.

                        setIsTaskRunning(true);
                        setIsTaskPaused(false);
                        setTaskStartTime(startTime);

                        // We need to estimate the counter.
                        // If it was RESUME, we might be missing the base. 
                        // For robustness, simply setting StartTime allows the useEffect timer to pick up the difference from NOW to THEN.
                        // However, setTaskBaseDuration might be missing.
                        // For now, let's assume simple resumption:

                        toast.info("Task timer resumed based on previous log.");
                    } else if (lastStateLog.event_type === 'STOP_TASK') {
                        setIsTaskRunning(false);
                        setIsTaskPaused(false);
                        setTaskStartTime(null);
                    } else if (lastStateLog.event_type === 'PAUSE_TASK') {
                        setIsTaskRunning(true);
                        setIsTaskPaused(true);
                        setTaskStartTime(null);
                    }
                } else {
                    // No state logs left? Reset to idle
                    setIsTaskRunning(false);
                    setIsTaskPaused(false);
                    setTaskStartTime(null);
                    setCounter(0);
                    setTimeCode("00:00:00");
                }
            }
        }
    }

    // Refs for recording loop to access latest state
    const timeCodeRef = useRef(timeCode);
    const tapeNoRef = useRef(tapeNo);

    useEffect(() => { timeCodeRef.current = timeCode; }, [timeCode]);
    useEffect(() => { tapeNoRef.current = tapeNo; }, [tapeNo]);

    async function handleStartVideo(explicitSettings?: WorkstationSettings) {
        // Mode 1: Online (Camera Stream)
        // Prioritize explicit settings, then state, then fresh load
        const currentSettings = explicitSettings || settings || loadSettings();

        // Ensure state catches up if we used explicit or fresh load
        if (currentSettings !== settings) setSettings(currentSettings);

        try {
            const width = parseInt(currentSettings.video.resolution.split('x')[0]) || 1280;
            const height = parseInt(currentSettings.video.resolution.split('x')[1]) || 720;
            const frameRate = currentSettings.video.frameRate || 30;

            const constraints: MediaStreamConstraints = {
                video: {
                    width: { ideal: width },
                    height: { ideal: height },
                    frameRate: { ideal: frameRate },
                    deviceId: currentSettings.video.deviceId ? { exact: currentSettings.video.deviceId } : undefined
                },
                audio: currentSettings.audio.deviceId ? {
                    deviceId: { exact: currentSettings.audio.deviceId },
                } : false,
            };

            const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                await videoRef.current.play();

                if (canvasRef.current) {
                    canvasRef.current.width = videoRef.current.videoWidth;
                    canvasRef.current.height = videoRef.current.videoHeight;

                    if (!overlayManagerRef.current) {
                        overlayManagerRef.current = new CanvasOverlayManager(canvasRef.current);
                        overlayManagerRef.current.setTool(currentTool);
                        overlayManagerRef.current.setColor(currentColor);
                        overlayManagerRef.current.setLineWidth(lineWidth);
                    }
                }
            }

            setStream(mediaStream);
            setIsStreaming(true);
            setIsOfflineMode(false);
        } catch (error) {
            console.error("Video Error:", error);
            toast.error("Failed to start video. Check permissions.");
        }
    }

    function cleanupStream() {
        console.log("Stopping stream...");
        if (stream) {
            stream.getTracks().forEach(track => {
                track.stop();
                console.log(`Stopped track: ${track.kind}`);
            });
        }

        // Also force stop from video element if different reference
        if (videoRef.current && videoRef.current.srcObject) {
            const videoStream = videoRef.current.srcObject as MediaStream;
            if (videoStream.getTracks) {
                videoStream.getTracks().forEach(track => track.stop());
            }
            videoRef.current.srcObject = null;
        }

        setStream(null);
    }

    function handleStartManualLog() {
        // Ensure settings are loaded for manual mode too
        if (!settings) setSettings(loadSettings());

        // Stop any active stream first
        cleanupStream();

        // Mode 2: Offline (Manual Logging)
        setIsStreaming(true); // "Session Active"
        setIsOfflineMode(true);
        toast.info("Manual Logging Mode Active");
    }

    function handleStopVideo() {
        if (isRecording) {
            stopRecording();
        }

        cleanupStream();

        if (overlayManagerRef.current) {
            overlayManagerRef.current.destroy();
            overlayManagerRef.current = null;
        }

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = 0;
        }

        setIsStreaming(false);
        setIsOfflineMode(false);
    }

    async function startRecordingWrapper() {
        // Ensure settings are available
        const currentSettings = settings || loadSettings();
        if (!settings) setSettings(currentSettings); // Sync state if needed

        // Validate Tape ID
        if (!tapeNo || tapeNo.trim() === '') {
            toast.error("Please enter a valid Tape ID before starting.");
            return;
        }

        // Ensure tape record exists before starting
        const tid = await ensureTapeRecord();
        if (!tid) return;

        addLog('NEW_LOG_START', `Started recording - ${recordingMode} (${isOfflineMode ? 'Manual' : 'Video'})`);

        if (!isOfflineMode && stream && videoRef.current && canvasRef.current) {
            // Video Mode: Setup MediaRecorder
            const compositeCanvas = document.createElement('canvas');
            compositeCanvas.width = videoRef.current.videoWidth;
            compositeCanvas.height = videoRef.current.videoHeight;
            const ctx = compositeCanvas.getContext('2d');

            if (ctx) {
                const draw = () => {
                    if (videoRef.current && canvasRef.current && ctx) {
                        ctx.drawImage(videoRef.current, 0, 0);
                        ctx.drawImage(canvasRef.current, 0, 0);

                        // Burn-in text: TimeCode and Tape ID
                        // Burn-in text: TimeCode and Tape ID
                        const w = ctx.canvas.width;
                        const h = ctx.canvas.height;

                        // Draw background box for readability
                        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
                        ctx.fillRect(20, h - 90, 260, 70);

                        ctx.textAlign = "left";
                        ctx.textBaseline = "middle";

                        // Tape ID (Top line in box)
                        ctx.font = "bold 16px Arial";
                        ctx.fillStyle = "#fbbf24"; // Amber/Yellow
                        ctx.fillText(tapeNoRef.current || 'Unknown Tape', 40, h - 70);

                        // TimeCode (Bottom line in box)
                        ctx.font = "bold 28px monospace";
                        ctx.fillStyle = "#ffffff";
                        ctx.fillText(timeCodeRef.current, 40, h - 40);

                        // Recording Indicator (Blinking Red Dot)
                        if (Date.now() % 1000 < 500) {
                            ctx.beginPath();
                            ctx.arc(260, h - 55, 6, 0, 2 * Math.PI);
                            ctx.fillStyle = "red";
                            ctx.fill();
                        }
                    }
                    animationFrameRef.current = requestAnimationFrame(draw);
                };
                draw();

                const recordStream = compositeCanvas.captureStream(currentSettings.video.frameRate || 30);
                const audioTrack = stream.getAudioTracks()[0];
                if (audioTrack) recordStream.addTrack(audioTrack);

                const recorder = createMediaRecorder(recordStream, {
                    videoFormat: currentSettings.recording.video.format
                });

                if (recorder) {
                    mediaRecorderRef.current = recorder;

                    startRecording(
                        recorder,
                        () => { },
                        (blob, duration) => {
                            handleRecordingStop(blob, duration);
                        }
                    );
                } else {
                    toast.error("Failed to create recorder.");
                }
            }
        }

        // For both Online and Offline modes, set recording state
        setIsRecording(true);
        setIsPaused(false);
    }

    function pauseRecording() {
        if (isRecording) {
            if (isPaused) {
                // Resume
                if (mediaRecorderRef.current && !isOfflineMode) {
                    mediaRecorderRef.current.resume();
                }
                setIsPaused(false);
                addLog('RESUME', 'Recording resumed');
                toast.success("Recording Resumed");
            } else {
                // Pause
                if (mediaRecorderRef.current && !isOfflineMode) {
                    mediaRecorderRef.current.pause();
                }
                setIsPaused(true);
                addLog('PAUSE', 'Recording paused');
                toast.success("Recording Paused");
            }
        }
    }

    function stopRecording() {
        if (isRecording) {
            if (mediaRecorderRef.current && !isOfflineMode) {
                mediaRecorderRef.current.stop();
                // handleRecordingStop is called by the callback
            } else {
                // Manual mode just stops state
                setIsRecording(false);
                setIsPaused(false);
                addLog('END', 'Recording/Logging stopped');
            }

            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        }
    }

    // ... (rest of functions: handleRecordingStop, handleSnapshot, tool handlers)



    async function handleRecordingStop(blob: Blob, duration: number) {
        if (!settings) return;

        const durationSec = Math.round(duration / 1000);
        const prefix = settings.recording.video.filenamePrefix || 'dive_video';
        const ext = settings.recording.video.format.includes('mp4') ? '.mp4' : '.webm';
        const filename = `${tapeNo}_${new Date().toISOString().replace(/[:.]/g, '-')}_${durationSec}s${ext}`;

        await saveFile(blob, filename, null);
        toast.success(`Video saved: ${filename}`);
        mediaRecorderRef.current = null;
    }

    async function handleSnapshot() {
        if (!videoRef.current || !canvasRef.current || !settings) return;

        const compositeCanvas = document.createElement('canvas');
        compositeCanvas.width = videoRef.current.videoWidth;
        compositeCanvas.height = videoRef.current.videoHeight;
        const ctx = compositeCanvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(videoRef.current, 0, 0);
        ctx.drawImage(canvasRef.current, 0, 0);

        const format = settings.recording.photo.format || 'jpeg-95';
        const qualityMatch = format.match(/-(\d+)$/);
        const quality = qualityMatch ? parseInt(qualityMatch[1]) / 100 : 0.95;
        const mime = format.includes('png') ? 'image/png' : 'image/jpeg';

        compositeCanvas.toBlob(async (blob) => {
            if (blob) {
                const prefix = settings.recording.photo.filenamePrefix || 'dive_photo';
                const ext = getPhotoExtension(format);
                const filename = `${tapeNo}_SNAP_${new Date().toISOString().replace(/[:.]/g, '-')}${ext}`;

                await saveFile(blob, filename, null);
                addLog('SNAPSHOT', `Snapshot captured: ${filename}`);
                toast.success("Snapshot captured");
            }
        }, mime, quality);
    }

    // Tools handlers
    const setTool = (t: DrawingTool) => {
        setCurrentTool(t);
        overlayManagerRef.current?.setTool(t);
    };

    const setColor = (c: string) => {
        setCurrentColor(c);
        overlayManagerRef.current?.setColor(c);
    };

    const setWidth = (w: number) => {
        setLineWidth(w);
        overlayManagerRef.current?.setLineWidth(w);
    };

    return (

        <div className={`flex flex-col bg-background overflow-hidden relative pointer-events-auto ${className || 'h-[85vh] w-[90vw] rounded-lg border shadow-xl'}`}>
            {/* Header: Dark Title Bar matching "1. DIVER LOG" style */}
            <div className="px-3 py-2 border-b flex items-center justify-between shrink-0 bg-slate-800 dark:bg-slate-950 z-10 gap-2">
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <span className="text-sm font-bold text-white tracking-wide">2. VIDEO SESSION RECORD</span>
                    {isRecording && (
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-red-400 uppercase">REC</span>
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {tapeId && !isRecording && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-700"
                            title="Edit Tape Details"
                            onClick={() => {
                                const currentTape = jobTapes.find(t => t.tape_id === tapeId);
                                setEditTapeNo(tapeNo || "");
                                setEditTapeStatus(currentTape?.status || "ACTIVE");
                                setEditTapeChapter(currentTape?.chapter_no || "");
                                setEditTapeRemarks(currentTape?.remarks || "");
                                setIsEditTapeOpen(true);
                            }}
                        >
                            <Pencil className="h-3 w-3" />
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-700" onClick={() => setShowSettings(!showSettings)} title="Capture Settings">
                        <Settings className={`h-3.5 w-3.5 ${showSettings ? 'text-white' : ''}`} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-700" onClick={onClose} title="Close">
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Edit Tape Dialog */}
            <Dialog open={isEditTapeOpen} onOpenChange={setIsEditTapeOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Tape Details</DialogTitle>
                        <DialogDescription>Update tape number, chapter, or status.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Tape No</Label>
                            <Input id="name" value={editTapeNo} onChange={(e) => setEditTapeNo(e.target.value)} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="chapter" className="text-right">Chapter</Label>
                            <Input id="chapter" value={editTapeChapter} onChange={(e) => setEditTapeChapter(e.target.value)} className="col-span-3" placeholder="e.g. 01" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="remarks" className="text-right">Remarks</Label>
                            <Input id="remarks" value={editTapeRemarks} onChange={(e) => setEditTapeRemarks(e.target.value)} className="col-span-3" placeholder="Optional notes" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="status" className="text-right">Status</Label>
                            <Select value={editTapeStatus} onValueChange={setEditTapeStatus}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                    <SelectItem value="FULL">Full</SelectItem>
                                    <SelectItem value="CLOSED">Closed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={updateTapeDetails}>Save changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* New Tape Dialog */}
            <Dialog open={isNewTapeOpen} onOpenChange={setIsNewTapeOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Create New Tape</DialogTitle>
                        <DialogDescription>Initialize a new recording sequence.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="new_name" className="text-right">Tape No</Label>
                            <Input id="new_name" value={newTapeNo} onChange={(e) => setNewTapeNo(e.target.value)} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="new_chapter" className="text-right">Chapter</Label>
                            <Input id="new_chapter" value={newTapeChapter} onChange={(e) => setNewTapeChapter(e.target.value)} className="col-span-3" placeholder="e.g. 01" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="new_remarks" className="text-right">Remarks</Label>
                            <Input id="new_remarks" value={newTapeRemarks} onChange={(e) => setNewTapeRemarks(e.target.value)} className="col-span-3" placeholder="Optional notes" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={createTape}>Create Tape</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Tape Bar: Selection + Chapter + Status + Counter */}
            <div className="px-3 py-1.5 border-b bg-slate-50 dark:bg-slate-900/50 flex items-center gap-3 shrink-0">
                {/* Tape No. Selector */}
                <div className="flex items-center gap-1.5">
                    <Label className="text-[9px] uppercase text-muted-foreground font-bold tracking-wider whitespace-nowrap">Tape No.</Label>
                    {jobTapes.length > 0 ? (
                        <Select
                            value={tapeId ? String(tapeId) : "new_tape_placeholder"}
                            onValueChange={(val) => {
                                if (val === "new_tape_option") {
                                    const base = diveJob?.sow_report_no || 'TAPE';
                                    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
                                    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                                    setNewTapeNo(`${base}-${date}-${random}`);
                                    setNewTapeChapter("");
                                    setNewTapeRemarks("");
                                    setIsNewTapeOpen(true);
                                } else {
                                    const selected = jobTapes.find(t => String(t.tape_id) === val);
                                    if (selected) {
                                        setTapeId(selected.tape_id);
                                        setTapeNo(selected.tape_no);
                                    }
                                }
                            }}
                            disabled={isRecording}
                        >
                            <SelectTrigger className="h-7 text-xs font-mono font-bold bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 min-w-[140px]">
                                <SelectValue placeholder="Select Tape" />
                            </SelectTrigger>
                            <SelectContent>
                                {jobTapes.map(t => {
                                    const isActive = t.status === 'ACTIVE';
                                    const isFull = t.status === 'FULL';
                                    return (
                                        <SelectItem key={t.tape_id} value={String(t.tape_id)}>
                                            <span className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-green-500 animate-pulse' :
                                                    isFull ? 'bg-amber-500' : 'bg-slate-400'
                                                    }`} />
                                                <span className="font-mono text-xs">{t.tape_no}</span>
                                                {t.chapter_no && (
                                                    <span className="text-[9px] text-muted-foreground">Ch.{t.chapter_no}</span>
                                                )}
                                            </span>
                                        </SelectItem>
                                    );
                                })}
                                <Separator className="my-1" />
                                <SelectItem value="new_tape_option" className="text-primary font-semibold">
                                    <span className="flex items-center gap-2">
                                        <Plus className="h-3 w-3" /> New Tape
                                    </span>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    ) : (
                        <div className="flex items-center gap-1">
                            <Input
                                id="tapeNo"
                                value={tapeNo}
                                onChange={(e) => setTapeNo(e.target.value)}
                                className="h-7 text-xs font-mono font-bold w-36 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                                placeholder="Tape No."
                                disabled={isRecording}
                            />
                            {!isRecording && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs gap-1 border-purple-300 text-purple-700 hover:bg-purple-50"
                                    onClick={() => {
                                        const base = diveJob?.sow_report_no || 'TAPE';
                                        const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
                                        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                                        setNewTapeNo(`${base}-${date}-${random}`);
                                        setNewTapeChapter("");
                                        setNewTapeRemarks("");
                                        setIsNewTapeOpen(true);
                                    }}
                                >
                                    <Plus className="h-3 w-3" /> New
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* Chapter Display */}
                {tapeId && (() => {
                    const currentTape = jobTapes.find(t => t.tape_id === tapeId);
                    return currentTape?.chapter_no ? (
                        <div className="flex items-center gap-1">
                            <Label className="text-[9px] uppercase text-muted-foreground font-bold tracking-wider">Chap</Label>
                            <div className="h-7 min-w-[32px] px-1.5 flex items-center justify-center rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono text-xs font-bold">
                                {currentTape.chapter_no}
                            </div>
                        </div>
                    ) : null;
                })()}

                {/* Active/Status badge */}
                {tapeId && (() => {
                    const currentTape = jobTapes.find(t => t.tape_id === tapeId);
                    if (!currentTape) return null;
                    const isActive = currentTape.status === 'ACTIVE';
                    const isFull = currentTape.status === 'FULL';
                    return (
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 h-5 rounded-full border ${isActive ? 'border-green-300 text-green-700 bg-green-50 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300' :
                            isFull ? 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-900/20' :
                                'border-slate-300 text-slate-500 bg-slate-50 dark:bg-slate-800'
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : isFull ? 'bg-amber-500' : 'bg-slate-400'
                                }`} />
                            {currentTape.status}
                        </span>
                    );
                })()}

                {/* Spacer + Counter + tools */}
                <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSnapshot} disabled={!isStreaming} title="Snap Photo">
                        <Camera className="h-3.5 w-3.5" />
                    </Button>

                    <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono font-bold transition-colors border ${isTaskRunning ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:border-green-900' : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/20 dark:border-slate-800'}`} title="Task Timer">
                        {isTaskRunning && <div className={`w-1.5 h-1.5 rounded-full bg-current ${!isTaskPaused && 'animate-pulse'}`} />}
                        {timeCode}
                    </div>

                    <div className="h-5 w-px bg-border mx-0.5" />

                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsVideoVisible(!isVideoVisible)} title={isVideoVisible ? "Hide Preview" : "Show Preview"}>
                        {isVideoVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </Button>

                    {!isOfflineMode && (
                        <p className="hidden" /> // Placeholder removed
                    )}
                    <Button variant={showLogPanel ? "secondary" : "ghost"} size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setShowLogPanel(!showLogPanel)} title="Show Quick Actions">
                        <History className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Logs</span>
                    </Button>
                </div>
            </div>

            {/* Main Video Area */}
            <div className="flex-1 relative bg-slate-950 flex flex-col overflow-hidden min-h-0 group">
                {showSettings ? (
                    <div className="absolute inset-0 overflow-y-auto bg-background p-4 z-30">
                        <ToastProvider>
                            <VideoRecorderSettings />
                        </ToastProvider>
                    </div>
                ) : (
                    <>
                        <div className={`flex-1 relative overflow-hidden flex items-center justify-center bg-black transition-opacity duration-300 ${isVideoVisible ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}>
                            {!isOfflineMode ? (
                                <div className="flex h-full w-full">
                                    <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden group/video">
                                        <video ref={videoRef} autoPlay playsInline muted className="max-h-full max-w-full object-contain" />
                                        <canvas ref={canvasRef} className={`absolute inset-0 w-full h-full pointer-events-auto ${!showTools && 'pointer-events-none'}`} />

                                        {/* Top Right Overlay Controls */}
                                        <div className="absolute top-4 right-4 flex gap-2 z-20 opacity-0 group-hover/video:opacity-100 transition-opacity duration-300">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="h-9 gap-2 shadow-lg bg-background/80 backdrop-blur border hover:bg-background"
                                                onClick={handleStopVideo}
                                            >
                                                <CircleStop className="h-4 w-4 text-red-500 fill-red-500/20" />
                                                <span className="font-semibold">Stop Stream</span>
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="h-9 gap-2 shadow-lg bg-background/80 backdrop-blur border hover:bg-background"
                                                onClick={handleStartManualLog}
                                            >
                                                <FileText className="h-4 w-4" />
                                                <span className="font-semibold">Manual Mode</span>
                                            </Button>
                                        </div>

                                        {/* Annotations */}
                                        {showTools && isStreaming && (
                                            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-popover/95 backdrop-blur border shadow-xl rounded-lg p-1.5 flex items-center gap-2 z-20 scale-90 origin-top">
                                                {/* Same tool buttons as before */}
                                                <div className="flex items-center gap-0.5 border-r pr-2 mr-0.5">
                                                    <ToolBtn icon={MousePointer2} active={currentTool === 'select'} onClick={() => setTool('select')} label="Select" />
                                                    <ToolBtn icon={PenTool} active={currentTool === 'pen'} onClick={() => setTool('pen')} label="Pen" />
                                                    <ToolBtn icon={MoveRight} active={currentTool === 'arrow'} onClick={() => setTool('arrow')} label="Arrow" />
                                                    <ToolBtn icon={CircleIcon} active={currentTool === 'circle'} onClick={() => setTool('circle')} label="Circle" />
                                                    <ToolBtn icon={SquareIcon} active={currentTool === 'rectangle'} onClick={() => setTool('rectangle')} label="Box" />
                                                    <div className="w-px h-4 bg-border mx-0.5" />
                                                    <ToolBtn icon={Undo} onClick={() => overlayManagerRef.current?.undo()} label="Undo" />
                                                    <ToolBtn icon={Trash2} onClick={() => overlayManagerRef.current?.clear()} label="Clear" />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex gap-0.5">
                                                        {['#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#ffffff'].map(c => (
                                                            <button key={c} onClick={() => setColor(c)} className={`w-4 h-4 rounded-full border border-slate-200 ${currentColor === c ? 'ring-1 ring-primary ring-offset-1' : ''}`} style={{ background: c }} />
                                                        ))}
                                                    </div>
                                                    <input type="range" min="1" max="10" value={lineWidth} onChange={(e) => setWidth(Number(e.target.value))} className="w-12 h-1 accent-primary" />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Side Log Panel */}
                                    {showLogPanel && (
                                        <div className="w-64 border-l bg-background/95 backdrop-blur flex flex-col h-full animate-in slide-in-from-right-10 duration-200">
                                            {/* Transport Controls */}
                                            <div className="p-4 border-b bg-muted/10 space-y-3">
                                                {!isRecording ? (
                                                    <Button
                                                        size="lg"
                                                        className="w-full bg-green-600 hover:bg-green-700 text-white shadow-sm font-bold tracking-wide"
                                                        onClick={startRecordingWrapper}
                                                    >
                                                        <Play className="h-4 w-4 mr-2 fill-current" />
                                                        REC
                                                    </Button>
                                                ) : (
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <Button
                                                            variant="outline"
                                                            className={`border-2 ${isPaused ? 'border-green-200 bg-green-50 text-green-700' : 'border-yellow-200 bg-yellow-50 text-yellow-700'}`}
                                                            onClick={pauseRecording}
                                                        >
                                                            {isPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            className="shadow-sm"
                                                            onClick={stopRecording}
                                                        >
                                                            <Square className="h-4 w-4 fill-current" />
                                                        </Button>
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest px-1">
                                                    <span>{isRecording ? (isPaused ? 'Rec Paused' : 'Recording') : 'Rec Ready'}</span>
                                                    <span className={isRecording && !isPaused ? "text-red-500 animate-pulse" : ""}>●</span>
                                                </div>
                                            </div>

                                            <div className="p-3 border-b text-xs font-semibold uppercase text-muted-foreground bg-muted/30">
                                                Quick Actions
                                            </div>
                                            <div className="p-3 grid grid-cols-2 gap-2">
                                                {(() => {
                                                    const activeTape = jobTapes.find(t => t.tape_id === tapeId);
                                                    const isTapeActive = activeTape?.status === 'ACTIVE';
                                                    const canLog = isTapeActive && isTaskRunning;

                                                    return (
                                                        <>
                                                            <Button variant="outline" size="sm" onClick={() => addLog('INTRODUCTION', 'Introduction started')} disabled={!canLog}>Intro</Button>
                                                            <Button variant="outline" size="sm" onClick={() => addLog('PRE_INSPECTION', 'Pre-Inspection checks')} disabled={!canLog}>Pre-Insp</Button>

                                                            <Button variant="outline" size="sm" disabled={!isTapeActive} className={isTaskRunning ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"} onClick={() => {
                                                                if (isTaskRunning) {
                                                                    // Stop Task
                                                                    const finalCounter = counter; // Capture before reset
                                                                    setIsTaskRunning(false);
                                                                    setIsTaskPaused(false);
                                                                    setTaskStartTime(null);
                                                                    setTaskBaseDuration(0);
                                                                    setCounter(0);
                                                                    setTimeCode("00:00:00");
                                                                    addLog('STOP_TASK', 'Task stopped', finalCounter);
                                                                } else {
                                                                    // Start Task
                                                                    setIsTaskRunning(true);
                                                                    setIsTaskPaused(false);
                                                                    setTaskStartTime(Date.now());
                                                                    setTaskBaseDuration(0);
                                                                    setCounter(0);
                                                                    setTimeCode("00:00:00");
                                                                    addLog('START_TASK', 'Task started', 0);
                                                                }
                                                            }}>{isTaskRunning ? 'Stop Task' : 'Start Task'}</Button>

                                                            <Button variant="outline" size="sm" disabled={!canLog} onClick={() => {
                                                                if (isTaskPaused) {
                                                                    // Resume Task
                                                                    setIsTaskPaused(false);
                                                                    setTaskStartTime(Date.now());
                                                                    addLog('RESUME_TASK', 'Task resumed', counter);
                                                                } else {
                                                                    // Pause Task
                                                                    let newTotal = counter;
                                                                    if (taskStartTime) {
                                                                        const now = Date.now();
                                                                        const elapsed = Math.floor((now - taskStartTime) / 1000);
                                                                        newTotal = taskBaseDuration + elapsed;
                                                                        setTaskBaseDuration(prev => prev + elapsed);
                                                                        setCounter(newTotal);
                                                                    }
                                                                    setIsTaskPaused(true);
                                                                    setTaskStartTime(null);
                                                                    addLog('PAUSE_TASK', 'Task paused', newTotal);
                                                                }
                                                            }}>{isTaskPaused ? 'Resume' : 'Pause'}</Button>

                                                            <Button variant="outline" size="sm" onClick={() => addLog('ANOMALY', 'Anomaly observed')} disabled={!canLog}>Anomaly</Button>
                                                            <Button variant="outline" size="sm" onClick={() => addLog('POST_INSPECTION', 'Post-inspection checks')} disabled={!canLog}>Post-Insp</Button>
                                                            <Button variant="outline" size="sm" onClick={() => addLog('CUSTOM', 'Custom Marker')} disabled={!canLog}>Mark</Button>
                                                        </>
                                                    );
                                                })()}
                                            </div>

                                            <div className="px-3 pb-3">
                                                <div className="flex gap-1">
                                                    <Input
                                                        className="h-8 text-xs"
                                                        placeholder="Note..."
                                                        value={chapterDetails}
                                                        onChange={(e) => setChapterDetails(e.target.value)}
                                                        disabled={!isTaskRunning || jobTapes.find(t => t.tape_id === tapeId)?.status !== 'ACTIVE'}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') { addLog('NOTE', chapterDetails); setChapterDetails(''); } }}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        className="h-8"
                                                        onClick={() => { addLog('NOTE', chapterDetails); setChapterDetails(''); }}
                                                        disabled={!chapterDetails || !isTaskRunning || jobTapes.find(t => t.tape_id === tapeId)?.status !== 'ACTIVE'}
                                                    >
                                                        Add
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="flex-1 overflow-y-auto border-t">
                                                <div className="p-2 space-y-2">
                                                    {videoLogs.map((log) => (
                                                        <div key={log.id} className="text-xs p-2 rounded bg-muted/50 border flex flex-col gap-1 group relative">
                                                            <div className="flex justify-between font-mono text-[10px] opacity-70">
                                                                <span>{log.timecode}</span>
                                                                <div className="flex items-center gap-2">
                                                                    <BadgeLogType type={log.event_type} />
                                                                    {editingLogId !== log.id && (
                                                                        <div className="hidden group-hover:flex items-center gap-1 opacity-60">
                                                                            <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => {
                                                                                setEditingLogId(log.id);
                                                                                setEditLogRemarks(log.remarks || "");
                                                                                setEditLogTimecode(log.timecode || "00:00:00");
                                                                            }}>
                                                                                <Pencil className="h-3 w-3" />
                                                                            </Button>
                                                                            <Button variant="ghost" size="icon" className="h-4 w-4 hover:text-red-500" onClick={() => deleteLog(log.id)}>
                                                                                <Trash2 className="h-3 w-3" />
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {editingLogId === log.id ? (
                                                                <div className="flex items-center gap-1 mt-1">
                                                                    <Input
                                                                        value={editLogTimecode}
                                                                        onChange={(e) => setEditLogTimecode(e.target.value)}
                                                                        className="h-6 w-20 text-xs p-1 font-mono text-center"
                                                                        placeholder="00:00:00"
                                                                    />
                                                                    <Input
                                                                        value={editLogRemarks}
                                                                        onChange={(e) => setEditLogRemarks(e.target.value)}
                                                                        className="h-6 text-xs p-1 flex-1"
                                                                        autoFocus
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') updateLog(log.id, editLogRemarks, editLogTimecode);
                                                                            if (e.key === 'Escape') setEditingLogId(null);
                                                                        }}
                                                                    />
                                                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-green-500" onClick={() => updateLog(log.id, editLogRemarks, editLogTimecode)}>
                                                                        <Check className="h-3 w-3" />
                                                                    </Button>
                                                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => setEditingLogId(null)}>
                                                                        <X className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <div className="truncate pr-8">{log.remarks || '-'}</div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {videoLogs.length === 0 && <div className="text-center p-4 text-muted-foreground text-xs">No logs yet</div>}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-slate-500 w-full h-full p-6">
                                    <div className="flex flex-col items-center gap-6 w-full max-w-md">
                                        {/* Timecode Display */}
                                        {/* Timecode Display */}
                                        <div className="flex flex-col items-center gap-2">
                                            <div className={`text-6xl font-mono font-bold tracking-widest ${isTaskRunning ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                {timeCode}
                                            </div>
                                            <div className={`px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase ${isTaskRunning ? (isTaskPaused ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-600 animate-pulse') : 'bg-slate-100 text-slate-500'}`}>
                                                {isTaskRunning ? (isTaskPaused ? "TASK PAUSED" : "TASK RUNNING") : "READY"}
                                            </div>
                                        </div>

                                        {/* Transport Controls */}
                                        <div className="flex items-center gap-4 mt-2 mb-2">
                                            {!isRecording ? (
                                                <div className="flex flex-col gap-3">
                                                    <Button
                                                        size="lg"
                                                        className="h-14 px-8 rounded-full bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20 text-lg gap-2 w-full"
                                                        onClick={startRecordingWrapper}
                                                    >
                                                        <Play className="h-6 w-6 fill-current" />
                                                        Record Video
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        className="text-muted-foreground hover:text-foreground"
                                                        onClick={handleStopVideo}
                                                    >
                                                        Switch to Camera Source
                                                    </Button>
                                                </div>
                                            ) : (
                                                <>
                                                    <Button
                                                        size="lg"
                                                        variant="outline"
                                                        className={`h-14 px-6 rounded-full border-2 text-lg gap-2 ${isPaused ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100' : 'border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'}`}
                                                        onClick={pauseRecording}
                                                    >
                                                        {isPaused ? (
                                                            <>
                                                                <Play className="h-6 w-6 fill-current" /> Resume
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Pause className="h-6 w-6 fill-current" /> Pause
                                                            </>
                                                        )}
                                                    </Button>
                                                    <Button
                                                        size="lg"
                                                        variant="destructive"
                                                        className="h-14 px-6 rounded-full shadow-lg shadow-red-900/20 text-lg gap-2"
                                                        onClick={stopRecording}
                                                    >
                                                        <Square className="h-6 w-6 fill-current" /> Stop
                                                    </Button>
                                                </>
                                            )}
                                        </div>

                                        {/* Quick Entry */}
                                        {/* Quick Entry */}
                                        <div className="flex gap-2 w-full mt-4">
                                            <Input
                                                value={chapterDetails}
                                                onChange={(e) => setChapterDetails(e.target.value)}
                                                placeholder="Enter log note..."
                                                className="bg-background/50"
                                                disabled={!isTaskRunning || jobTapes.find(t => t.tape_id === tapeId)?.status !== 'ACTIVE'}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        addLog('NOTE', chapterDetails);
                                                        setChapterDetails('');
                                                    }
                                                }}
                                            />
                                            <Button
                                                onClick={() => {
                                                    addLog('NOTE', chapterDetails);
                                                    setChapterDetails('');
                                                }}
                                                disabled={!chapterDetails || !isTaskRunning || jobTapes.find(t => t.tape_id === tapeId)?.status !== 'ACTIVE'}
                                            >
                                                Log
                                            </Button>
                                        </div>

                                        {/* Quick Actions Grid */}
                                        {(() => {
                                            const activeTape = jobTapes.find(t => t.tape_id === tapeId);
                                            const isTapeActive = activeTape?.status === 'ACTIVE';
                                            const canLog = isTapeActive && isTaskRunning;

                                            return (
                                                <div className="grid grid-cols-3 gap-3 w-full">
                                                    <Button variant="outline" className="h-12 hover:bg-primary/5 hover:text-primary transition-colors" disabled={!canLog} onClick={() => addLog('INTRODUCTION', 'Introduction started')}>Intro</Button>
                                                    <Button variant="outline" className="h-12 hover:bg-primary/5 hover:text-primary transition-colors" disabled={!canLog} onClick={() => addLog('PRE_INSPECTION', 'Pre-Inspection checks')}>Pre-Insp</Button>

                                                    <Button
                                                        variant="outline"
                                                        className={`h-12 transition-colors ${isTaskRunning ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"}`}
                                                        disabled={!isTapeActive}
                                                        onClick={() => {
                                                            if (isTaskRunning) {
                                                                setIsTaskRunning(false);
                                                                setIsTaskPaused(false);
                                                                addLog('STOP_TASK', 'Task stopped');
                                                            } else {
                                                                setIsTaskRunning(true);
                                                                setIsTaskPaused(false);
                                                                addLog('START_TASK', 'Task started');
                                                            }
                                                        }}
                                                    >
                                                        {isTaskRunning ? 'Stop Task' : 'Start Task'}
                                                    </Button>

                                                    <Button variant="outline" className="h-12 hover:bg-primary/5 hover:text-primary transition-colors" disabled={!canLog} onClick={() => {
                                                        if (isTaskPaused) {
                                                            setIsTaskPaused(false);
                                                            addLog('RESUME_TASK', 'Task resumed');
                                                        } else {
                                                            setIsTaskPaused(true);
                                                            addLog('PAUSE_TASK', 'Task paused');
                                                        }
                                                    }}>{isTaskPaused ? 'Resume' : 'Pause'}</Button>

                                                    <Button variant="outline" className="h-12 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 transition-colors" disabled={!canLog} onClick={() => addLog('ANOMALY', 'Anomaly observed')}>Anomaly</Button>
                                                    <Button variant="outline" className="h-12 hover:bg-primary/5 hover:text-primary transition-colors" disabled={!canLog} onClick={() => addLog('POST_INSPECTION', 'Post-inspection checks')}>Post-Insp</Button>
                                                    <Button variant="outline" className="h-12 hover:bg-primary/5 hover:text-primary transition-colors" disabled={!canLog} onClick={() => addLog('CUSTOM', 'Custom Marker')}>Mark</Button>
                                                </div>
                                            );
                                        })()}

                                        <p className="text-xs text-muted-foreground mt-4">
                                            Manual Logging Mode Active
                                        </p>
                                    </div>
                                </div>
                            )}

                            {!isStreaming && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm z-10 space-y-4">
                                    <Button size={isFloating ? "sm" : "lg"} onClick={() => handleStartVideo()} className="gap-2 w-48">
                                        <Play className={isFloating ? "h-4 w-4" : "h-6 w-6"} /> Start Feed
                                    </Button>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest font-semibold">
                                        <span>Or</span>
                                    </div>
                                    <Button variant="outline" size={isFloating ? "sm" : "lg"} onClick={handleStartManualLog} className="gap-2 w-48 border-slate-700 hover:bg-slate-800 text-slate-300">
                                        <FileText className={isFloating ? "h-4 w-4" : "h-6 w-6"} /> Manual Log
                                    </Button>
                                </div>
                            )}

                            {/* Latest Log Overlay */}
                            {videoLogs.length > 0 && isStreaming && !showLogPanel && (
                                <div className="absolute bottom-20 left-4 z-20 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <div className="bg-black/70 backdrop-blur border border-white/10 text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-xs shadow-lg max-w-[300px]">
                                        <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                                        <span className="font-mono opacity-70 border-r border-white/20 pr-2 mr-2">{videoLogs[0].timecode}</span>
                                        <span className="truncate font-medium">{videoLogs[0].remarks || videoLogs[0].event_type}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Hidden State Placeholder */}
                        {!isVideoVisible && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background text-muted-foreground z-0 animate-in fade-in">
                                <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                                    <div className="p-4 bg-muted rounded-full">
                                        <EyeOff className="h-8 w-8 opacity-40" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-foreground">Video Preview Hidden</h3>
                                        <p className="text-sm mt-1 max-w-[240px]">Recording logs and background processing are active.</p>
                                    </div>
                                    <Button variant="outline" onClick={() => setIsVideoVisible(true)}>
                                        Show Preview
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Controls Footer */}
                        <div className="bg-background/95 backdrop-blur border-t p-2 flex items-center justify-between shrink-0 h-14 z-20">
                            <div className="flex items-center gap-2">
                                {isStreaming && (
                                    <Button size="icon" variant="destructive" onClick={handleStopVideo} title="Stop Feed" className="h-8 w-8">
                                        <Square className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>

                            <div className="flex items-center gap-3 justify-center">
                                {!isRecording ? (
                                    <Button
                                        size="icon"
                                        className="h-10 w-10 rounded-full bg-red-600 hover:bg-red-700 shadow-md transition-all hover:scale-105"
                                        onClick={startRecordingWrapper}
                                        disabled={!isStreaming}
                                        title="Start Recording"
                                    >
                                        <div className="h-3 w-3 bg-white rounded-full" />
                                    </Button>
                                ) : (
                                    <>
                                        <Button
                                            size="icon"
                                            className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-900 border"
                                            onClick={pauseRecording}
                                            title={isPaused ? "Resume" : "Pause"}
                                        >
                                            {isPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
                                        </Button>
                                        <Button
                                            size="icon"
                                            className="h-10 w-10 rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-md transition-all hover:scale-105"
                                            onClick={stopRecording}
                                            title="Stop Recording"
                                        >
                                            <Square className="h-4 w-4 fill-current" />
                                        </Button>
                                    </>
                                )}
                                <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-9 w-9 rounded-full"
                                    onClick={handleSnapshot}
                                    disabled={!isStreaming}
                                    title="Snapshot"
                                >
                                    <Camera className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant={showTools ? "secondary" : "ghost"}
                                    size="sm"
                                    onClick={() => setShowTools(!showTools)}
                                    disabled={!isStreaming}
                                    className="h-8 w-8 p-0"
                                    title="Annotation Tools"
                                >
                                    <PenTool className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </div>

        </div>

    );
}

function BadgeLogType({ type }: { type: string }) {
    const colors: any = {
        'NEW_LOG_START': 'bg-green-100 text-green-700',
        'END': 'bg-red-100 text-red-700',
        'PAUSE': 'bg-yellow-100 text-yellow-700',
        'ANOMALY': 'bg-orange-100 text-orange-700',
        'SNAPSHOT': 'bg-blue-100 text-blue-700'
    };
    return (
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${colors[type] || 'bg-slate-100 text-slate-700'}`}>
            {type}
        </span>
    );
}

function ToolBtn({ icon: Icon, active, onClick, label }: any) {
    return (
        <button
            onClick={onClick}
            className={`p-1.5 rounded transition-colors ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
            title={label}
        >
            <Icon className="h-3.5 w-3.5" />
        </button>
    );
}
