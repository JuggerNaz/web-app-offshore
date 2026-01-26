'use client';

import { useState, useEffect, useRef } from 'react';
import { loadSettings, type WorkstationSettings } from '@/lib/video-recorder/settings-manager';
import { createMediaRecorder, startRecording, saveFile, generateFilename, captureSnapshot, getPhotoExtension, FORMAT_CONFIGS } from '@/lib/video-recorder/media-recorder';
import { CanvasOverlayManager, type DrawingTool } from '@/lib/video-recorder/canvas-overlay';

interface VideoRecorderWidgetProps {
    inspectionId?: string;
    platformId?: string;
    componentId?: string;
    mode?: 'floating' | 'sidebar' | 'modal';
    defaultPosition?: { x: number; y: number };
    onClose?: () => void;
}

export default function VideoRecorderWidget({
    inspectionId,
    platformId,
    componentId,
    mode = 'floating',
    defaultPosition = { x: 20, y: 20 },
    onClose,
}: VideoRecorderWidgetProps) {
    const [settings, setSettings] = useState<WorkstationSettings | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [duration, setDuration] = useState(0);
    const [fileSize, setFileSize] = useState(0);
    const [currentTool, setCurrentTool] = useState<DrawingTool>('pen');
    const [currentColor, setCurrentColor] = useState('#ef4444');
    const [lineWidth, setLineWidth] = useState(3);
    const [stream, setStream] = useState<MediaStream | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const overlayManagerRef = useRef<CanvasOverlayManager | null>(null);
    const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Load settings
        const savedSettings = loadSettings();
        setSettings(savedSettings);

        // Initialize camera stream
        initializeStream(savedSettings);

        return () => {
            cleanup();
        };
    }, []);

    useEffect(() => {
        // Initialize canvas overlay when canvas is ready
        if (canvasRef.current && !overlayManagerRef.current) {
            overlayManagerRef.current = new CanvasOverlayManager(canvasRef.current);
            overlayManagerRef.current.setLineWidth(lineWidth);
        }
    }, [canvasRef.current]);

    async function initializeStream(settings: WorkstationSettings) {
        try {
            const constraints = {
                video: {
                    deviceId: settings.video.deviceId ? { exact: settings.video.deviceId } : undefined,
                    width: { ideal: parseInt(settings.video.resolution.split('x')[0]) },
                    height: { ideal: parseInt(settings.video.resolution.split('x')[1]) },
                    frameRate: { ideal: settings.video.frameRate },
                },
                audio: {
                    deviceId: settings.audio.deviceId ? { exact: settings.audio.deviceId } : undefined,
                    sampleRate: settings.audio.sampleRate,
                    channelCount: settings.audio.channels,
                    echoCancellation: settings.audio.echoCancellation,
                    noiseSuppression: settings.audio.noiseSuppression,
                    autoGainControl: settings.audio.autoGainControl,
                },
            };

            const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            setStream(mediaStream);

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (error) {
            console.error('Error initializing stream:', error);
        }
    }

    function cleanup() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
        }
        if (overlayManagerRef.current) {
            overlayManagerRef.current.destroy();
        }
    }

    async function handleStartRecording() {
        if (!stream || !settings) return;

        // Create combined stream with canvas overlay
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;

        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Create canvas stream
        const canvasStream = canvas.captureStream(settings.video.frameRate);

        // Combine video from canvas and audio from original stream
        const audioTrack = stream.getAudioTracks()[0];
        const combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            audioTrack,
        ]);

        // Create media recorder
        const recorder = createMediaRecorder(combinedStream, {
            videoFormat: settings.recording.video.format,
        });

        if (!recorder) {
            console.error('Failed to create media recorder');
            return;
        }

        mediaRecorderRef.current = recorder;

        // Start recording
        startRecording(
            recorder,
            (blob) => {
                setFileSize(prev => prev + blob.size);
            },
            async (blob) => {
                const formatConfig = FORMAT_CONFIGS[settings.recording.video.format];
                const filename = generateFilename(
                    settings.recording.video.filenamePrefix,
                    formatConfig.extension,
                    { platformId, componentId }
                );
                await saveFile(blob, filename);
                setIsRecording(false);
                setDuration(0);
                setFileSize(0);
            }
        );

        setIsRecording(true);

        // Start duration counter
        durationIntervalRef.current = setInterval(() => {
            setDuration(prev => prev + 1);
        }, 1000);

        // Start drawing video to canvas
        drawVideoToCanvas();
    }

    function drawVideoToCanvas() {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        function draw() {
            if (!isRecording && !isPaused) return;

            // Draw video frame
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Overlay manager will draw on top
            if (overlayManagerRef.current) {
                overlayManagerRef.current.redraw();
            }

            requestAnimationFrame(draw);
        }

        draw();
    }

    function handlePauseRecording() {
        if (mediaRecorderRef.current && isRecording) {
            if (isPaused) {
                mediaRecorderRef.current.resume();
                setIsPaused(false);
            } else {
                mediaRecorderRef.current.pause();
                setIsPaused(true);
            }
        }
    }

    function handleStopRecording() {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
            }
        }
    }

    async function handleSnapshot() {
        if (!videoRef.current || !canvasRef.current || !settings) return;

        const blob = await captureSnapshot(
            videoRef.current,
            canvasRef.current,
            settings.recording.photo.format
        );

        if (blob) {
            const extension = getPhotoExtension(settings.recording.photo.format);
            const filename = generateFilename(
                'snapshot',
                extension,
                { platformId, componentId }
            );
            await saveFile(blob, filename);
        }
    }

    function handleToolChange(tool: DrawingTool) {
        setCurrentTool(tool);
        if (overlayManagerRef.current) {
            overlayManagerRef.current.setTool(tool);
        }
    }

    function handleColorChange(color: string) {
        setCurrentColor(color);
        if (overlayManagerRef.current) {
            overlayManagerRef.current.setColor(color);
        }
    }

    function handleLineWidthChange(width: number) {
        setLineWidth(width);
        if (overlayManagerRef.current) {
            overlayManagerRef.current.setLineWidth(width);
        }
    }

    function handleUndo() {
        if (overlayManagerRef.current) {
            overlayManagerRef.current.undo();
        }
    }

    function handleClear() {
        if (overlayManagerRef.current) {
            overlayManagerRef.current.clear();
        }
    }

    function formatDuration(seconds: number): string {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function formatFileSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    const widgetClasses = `
    ${mode === 'floating' ? 'fixed' : ''}
    ${isMinimized ? 'w-72' : 'w-96'}
    bg-slate-900/98 backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden
    border border-slate-700
  `;

    return (
        <div className={widgetClasses} style={mode === 'floating' ? defaultPosition : undefined}>
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-3 flex items-center justify-between border-b border-slate-700 cursor-move">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    {isRecording && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
                    <span>{isRecording ? 'Recording' : 'Ready'}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="w-6 h-6 flex items-center justify-center hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                    >
                        ━
                    </button>
                    <button
                        onClick={onClose}
                        className="w-6 h-6 flex items-center justify-center hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <>
                    {/* Video Preview */}
                    <div className="relative bg-slate-950 aspect-video">
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            className="w-full h-full object-cover"
                        />
                        <canvas
                            ref={canvasRef}
                            className="absolute inset-0 w-full h-full"
                        />
                        <div className="absolute top-2 left-2 bg-slate-900/90 px-2 py-1 rounded text-xs font-semibold text-white flex items-center gap-2">
                            {isRecording && <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
                            {isRecording ? 'REC' : 'LIVE'}
                        </div>
                        <div className="absolute top-2 right-2 bg-slate-900/90 px-2 py-1 rounded text-xs font-mono font-semibold text-white">
                            {formatDuration(duration)}
                        </div>
                    </div>

                    {/* Drawing Tools */}
                    <div className="bg-slate-800 p-3 border-b border-slate-700">
                        <div className="flex gap-1.5 mb-2">
                            <button
                                onClick={() => handleToolChange('select')}
                                className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${currentTool === 'select'
                                    ? 'bg-teal-500 text-white'
                                    : 'bg-slate-900 text-slate-400 hover:bg-slate-700 hover:text-white'
                                    }`}
                            >
                                ↖️
                            </button>
                            {(['pen', 'circle', 'arrow', 'line', 'rectangle'] as DrawingTool[]).map((tool) => (
                                <button
                                    key={tool}
                                    onClick={() => handleToolChange(tool)}
                                    className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${currentTool === tool
                                        ? 'bg-teal-500 text-white'
                                        : 'bg-slate-900 text-slate-400 hover:bg-slate-700 hover:text-white'
                                        }`}
                                >
                                    {tool === 'pen' && '🖊️'}
                                    {tool === 'circle' && '⭕'}
                                    {tool === 'arrow' && '➡️'}
                                    {tool === 'line' && '━'}
                                    {tool === 'rectangle' && '🔲'}
                                </button>
                            ))}
                            <button
                                onClick={handleUndo}
                                className="w-8 h-8 flex items-center justify-center rounded bg-slate-900 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                            >
                                ↩️
                            </button>
                            <button
                                onClick={handleClear}
                                className="w-8 h-8 flex items-center justify-center rounded bg-slate-900 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                            >
                                🗑️
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-slate-400">Size:</span>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={lineWidth}
                                onChange={(e) => handleLineWidthChange(Number(e.target.value))}
                                className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                            />
                            <span className="text-xs text-slate-400 font-mono w-8">{lineWidth}px</span>
                        </div>
                        <div className="flex gap-1.5">
                            {['#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#ffffff'].map((color) => (
                                <button
                                    key={color}
                                    onClick={() => handleColorChange(color)}
                                    className={`w-5 h-5 rounded border-2 transition-all ${currentColor === color ? 'border-white scale-110' : 'border-transparent'
                                        }`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>
                    {/* Controls */}
                    <div className="bg-slate-900 p-3 flex gap-2">
                        <button
                            onClick={isRecording ? handleStopRecording : handleStartRecording}
                            className={`flex-1 h-9 rounded-lg font-semibold text-sm transition-colors ${isRecording
                                ? 'bg-slate-700 hover:bg-slate-600 text-white'
                                : 'bg-red-500 hover:bg-red-600 text-white'
                                }`}
                        >
                            {isRecording ? '⏹️' : '⏺️'}
                        </button>
                        {isRecording && (
                            <button
                                onClick={handlePauseRecording}
                                className="flex-1 h-9 rounded-lg font-semibold text-sm bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                            >
                                {isPaused ? '▶️' : '⏸️'}
                            </button>
                        )}
                        <button
                            onClick={handleSnapshot}
                            className="w-9 h-9 rounded-lg font-semibold text-sm bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                        >
                            📸
                        </button>
                    </div>

                    {/* Status */}
                    <div className="bg-slate-950 px-3 py-2 text-xs text-slate-400 space-y-1">
                        <div className="flex justify-between">
                            <span>File:</span>
                            <span className="text-white font-mono">
                                {platformId && componentId
                                    ? `${platformId}_${componentId}_...webm`
                                    : 'inspection_...webm'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Size:</span>
                            <span className="text-white font-mono">{formatFileSize(fileSize)}</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
