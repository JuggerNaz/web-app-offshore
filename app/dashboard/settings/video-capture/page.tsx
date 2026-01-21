'use client';

import { useState, useEffect, useRef } from 'react';
import { enumerateDevices, checkCodecSupport, checkBrowserSupport, detectMissingDependencies, type DeviceInfo, type MissingDependency } from '@/lib/video-recorder/device-capabilities';
import { loadSettings, saveSettings, resetSettings, getSmartDefaults, type WorkstationSettings } from '@/lib/video-recorder/settings-manager';
import { createMediaRecorder, startRecording, saveFile, generateFilename, captureSnapshot, getPhotoExtension, FORMAT_CONFIGS } from '@/lib/video-recorder/media-recorder';
import { CanvasOverlayManager, type DrawingTool } from '@/lib/video-recorder/canvas-overlay';
import { getSupportedFormats, validateFormat } from '@/lib/video-recorder/codec-detection';
import { useToast, ToastProvider } from '@/components/ui/toast';
import { VideoPlayer } from '@/components/video-player';

export default function VideoRecorderSettingsPage() {
    return (
        <ToastProvider>
            <VideoRecorderSettings />
        </ToastProvider>
    );
}

function VideoRecorderSettings() {
    const { showToast } = useToast();

    const [settings, setSettings] = useState<WorkstationSettings | null>(null);
    const [videoDevices, setVideoDevices] = useState<DeviceInfo[]>([]);
    const [audioDevices, setAudioDevices] = useState<DeviceInfo[]>([]);
    const [dependencies, setDependencies] = useState<MissingDependency[]>([]);
    const [supportedFormats, setSupportedFormats] = useState<Array<{ format: string; supported: boolean }>>([]);
    const [loading, setLoading] = useState(true);

    // Preview state
    const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
    const [isPreviewActive, setIsPreviewActive] = useState(false);
    const [isTestRecording, setIsTestRecording] = useState(false);
    const [testRecordingDuration, setTestRecordingDuration] = useState(0);
    const videoPreviewRef = useRef<HTMLVideoElement>(null);
    const testRecorderRef = useRef<MediaRecorder | null>(null);
    const testIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const canvasPreviewRef = useRef<HTMLCanvasElement>(null);
    const overlayManagerRef = useRef<CanvasOverlayManager | null>(null);

    // Drawing state
    const [currentTool, setCurrentTool] = useState<DrawingTool>('pen');
    const [currentColor, setCurrentColor] = useState('#ef4444');
    const [lineWidth, setLineWidth] = useState(3);

    // Directory handles for custom save locations
    const [videoDirectoryHandle, setVideoDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [photoDirectoryHandle, setPhotoDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);

    // Video player test state
    const [testVideoSrc, setTestVideoSrc] = useState<string>('');
    const [testVideoFilename, setTestVideoFilename] = useState<string>('test-video.webm');

    useEffect(() => {
        initializeSettings();

        return () => {
            // Cleanup preview stream on unmount
            if (previewStream) {
                previewStream.getTracks().forEach(track => track.stop());
            }
            if (testIntervalRef.current) {
                clearInterval(testIntervalRef.current);
            }
        };
    }, []);

    async function initializeSettings() {
        setLoading(true);

        // Load saved settings
        const savedSettings = loadSettings();

        // Check supported formats
        const formats = getSupportedFormats();
        setSupportedFormats(formats);

        // Validate and fix format if unsupported
        const validatedFormat = validateFormat(savedSettings.recording.video.format);
        if (validatedFormat !== savedSettings.recording.video.format) {
            savedSettings.recording.video.format = validatedFormat;
            showToast(`Video format changed to ${validatedFormat} (browser compatible)`, 'info');
        }

        setSettings(savedSettings);

        // Enumerate devices
        const { videoDevices: vDevices, audioDevices: aDevices } = await enumerateDevices();
        setVideoDevices(vDevices);
        setAudioDevices(aDevices);

        // If no devices selected, set smart defaults
        if (!savedSettings.video.deviceId && vDevices.length > 0) {
            const defaults = await getSmartDefaults(vDevices, aDevices);
            const updated = { ...savedSettings, ...defaults };
            setSettings(updated);
            saveSettings(updated);
        }

        // Check for missing dependencies
        const deps = detectMissingDependencies();
        setDependencies(deps);

        setLoading(false);
    }

    function handleVideoDeviceChange(deviceId: string) {
        if (!settings) return;
        const updated = {
            ...settings,
            video: { ...settings.video, deviceId },
        };
        setSettings(updated);
        saveSettings(updated);
    }

    function handleAudioDeviceChange(deviceId: string) {
        if (!settings) return;
        const updated = {
            ...settings,
            audio: { ...settings.audio, deviceId },
        };
        setSettings(updated);
        saveSettings(updated);
    }

    function handleResolutionChange(resolution: string) {
        if (!settings) return;
        const updated = {
            ...settings,
            video: { ...settings.video, resolution },
        };
        setSettings(updated);
        saveSettings(updated);
    }

    function handleFrameRateChange(frameRate: number) {
        if (!settings) return;
        const updated = {
            ...settings,
            video: { ...settings.video, frameRate },
        };
        setSettings(updated);
        saveSettings(updated);
    }

    function handleAudioSettingChange(key: keyof WorkstationSettings['audio'], value: any) {
        if (!settings) return;
        const updated = {
            ...settings,
            audio: { ...settings.audio, [key]: value },
        };
        setSettings(updated);
        saveSettings(updated);
    }

    function handleVideoFormatChange(value: string) {
        if (!settings) return;

        const validatedValue = validateFormat(value);
        if (validatedValue !== value) {
            showToast(`Format ${value} not supported. Using ${validatedValue} instead.`, 'error');
            value = validatedValue;
        }

        const updated = {
            ...settings,
            recording: {
                ...settings.recording,
                video: { ...settings.recording.video, format: value }
            },
        };
        setSettings(updated);
        saveSettings(updated);
    }

    function handlePhotoFormatChange(value: string) {
        if (!settings) return;
        const updated = {
            ...settings,
            recording: {
                ...settings.recording,
                photo: { ...settings.recording.photo, format: value }
            },
        };
        setSettings(updated);
        saveSettings(updated);
    }

    function handleVideoSettingChange(key: keyof WorkstationSettings['recording']['video'], value: any) {
        if (!settings) return;
        const updated = {
            ...settings,
            recording: {
                ...settings.recording,
                video: { ...settings.recording.video, [key]: value }
            },
        };
        setSettings(updated);
        saveSettings(updated);
    }

    function handlePhotoSettingChange(key: keyof WorkstationSettings['recording']['photo'], value: any) {
        if (!settings) return;
        const updated = {
            ...settings,
            recording: {
                ...settings.recording,
                photo: { ...settings.recording.photo, [key]: value }
            },
        };
        setSettings(updated);
        saveSettings(updated);
    }

    function handleReset() {
        resetSettings();
        initializeSettings();
        showToast('Settings reset to defaults', 'success');
    }

    function generateTimestamp(): string {
        const now = new Date();
        const date = now.toISOString().split('T')[0].replace(/-/g, '');
        const time = now.toTimeString().split(' ')[0].replace(/:/g, '');
        return `${date}_${time}`;
    }

    async function selectVideoFolder() {
        try {
            if ('showDirectoryPicker' in window) {
                const dirHandle = await (window as any).showDirectoryPicker({
                    mode: 'readwrite',
                });
                setVideoDirectoryHandle(dirHandle);
                handleVideoSettingChange('storagePath', dirHandle.name);
                showToast(`Video folder selected: ${dirHandle.name}`, 'success');
            } else {
                showToast('Folder selection not supported in this browser', 'error');
            }
        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                console.error('Error selecting folder:', error);
                showToast('Failed to select folder', 'error');
            }
        }
    }

    async function selectPhotoFolder() {
        try {
            if ('showDirectoryPicker' in window) {
                const dirHandle = await (window as any).showDirectoryPicker({
                    mode: 'readwrite',
                });
                setPhotoDirectoryHandle(dirHandle);
                handlePhotoSettingChange('storagePath', dirHandle.name);
                showToast(`Photo folder selected: ${dirHandle.name}`, 'success');
            } else {
                showToast('Folder selection not supported in this browser', 'error');
            }
        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                console.error('Error selecting folder:', error);
                showToast('Failed to select folder', 'error');
            }
        }
    }

    async function startPreview() {
        if (!settings) return;

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

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setPreviewStream(stream);
            setIsPreviewActive(true);

            // Wait for next tick to ensure video element is rendered
            setTimeout(() => {
                if (videoPreviewRef.current) {
                    videoPreviewRef.current.srcObject = stream;
                    videoPreviewRef.current.play().catch(err => {
                        console.error('Error playing video:', err);
                    });
                }

                // Initialize canvas overlay
                if (canvasPreviewRef.current && !overlayManagerRef.current) {
                    overlayManagerRef.current = new CanvasOverlayManager(canvasPreviewRef.current);
                    overlayManagerRef.current.setTool(currentTool);
                    overlayManagerRef.current.setColor(currentColor);
                    overlayManagerRef.current.setLineWidth(lineWidth);
                }
            }, 100);
        } catch (error) {
            console.error('Error starting preview:', error);
            showToast('Failed to start preview. Check camera/microphone permissions.', 'error');
        }
    }

    function stopPreview() {
        if (previewStream) {
            previewStream.getTracks().forEach(track => track.stop());
            setPreviewStream(null);
            setIsPreviewActive(false);
        }
        if (testRecorderRef.current && isTestRecording) {
            testRecorderRef.current.stop();
            setIsTestRecording(false);
            setTestRecordingDuration(0);
        }
        if (overlayManagerRef.current) {
            overlayManagerRef.current.destroy();
            overlayManagerRef.current = null;
        }
    }

    async function startTestRecording() {
        if (!previewStream || !settings) return;

        const canvas = canvasPreviewRef.current;
        const video = videoPreviewRef.current;
        if (!canvas || !video) return;

        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Create a composite canvas that combines video + overlay
        const compositeCanvas = document.createElement('canvas');
        compositeCanvas.width = video.videoWidth;
        compositeCanvas.height = video.videoHeight;
        const compositeCtx = compositeCanvas.getContext('2d');
        if (!compositeCtx) return;

        // Start drawing loop to composite video + overlay
        let shouldContinue = true;
        let animationId: number = 0;
        const drawComposite = () => {
            if (!shouldContinue) return;

            // Draw video frame
            compositeCtx.drawImage(video, 0, 0, compositeCanvas.width, compositeCanvas.height);
            // Draw overlay on top
            compositeCtx.drawImage(canvas, 0, 0, compositeCanvas.width, compositeCanvas.height);

            animationId = requestAnimationFrame(drawComposite);
        };
        drawComposite();

        // Create stream from composite canvas
        const compositeStream = compositeCanvas.captureStream(settings.video.frameRate);

        // Add audio from original stream
        const audioTrack = previewStream.getAudioTracks()[0];
        if (audioTrack) {
            compositeStream.addTrack(audioTrack);
        }

        const recorder = createMediaRecorder(compositeStream, {
            videoFormat: settings.recording.video.format,
        });

        if (!recorder) {
            showToast('Failed to create recorder. Format may not be supported.', 'error');
            shouldContinue = false;
            return;
        }

        testRecorderRef.current = recorder;

        startRecording(
            recorder,
            () => { },
            async (blob, duration) => {
                shouldContinue = false;
                if (animationId) cancelAnimationFrame(animationId);

                // Duration tracking only - WebM fix corrupted playback
                const finalBlob = blob;

                const formatConfig = FORMAT_CONFIGS[settings.recording.video.format];
                const durationSec = Math.round(duration / 1000);
                const filename = `${settings.recording.video.filenamePrefix}_${generateTimestamp()}_${durationSec}s${formatConfig.extension}`;
                await saveFile(finalBlob, filename, videoDirectoryHandle);
                setIsTestRecording(false);
                setTestRecordingDuration(0);
                showToast(`Recording saved: ${filename} (${durationSec}s)`, 'success');
            }
        );

        setIsTestRecording(true);
        testIntervalRef.current = setInterval(() => {
            setTestRecordingDuration(prev => prev + 1);
        }, 1000);
    }

    function stopTestRecording() {
        if (testRecorderRef.current) {
            testRecorderRef.current.stop();
            if (testIntervalRef.current) {
                clearInterval(testIntervalRef.current);
            }
        }
    }

    async function takeTestSnapshot() {
        if (!videoPreviewRef.current || !canvasPreviewRef.current || !settings) return;

        const video = videoPreviewRef.current;
        const overlayCanvas = canvasPreviewRef.current;

        // Create composite canvas
        const compositeCanvas = document.createElement('canvas');
        compositeCanvas.width = video.videoWidth;
        compositeCanvas.height = video.videoHeight;
        const ctx = compositeCanvas.getContext('2d');

        if (!ctx) return;

        // Draw video frame
        ctx.drawImage(video, 0, 0, compositeCanvas.width, compositeCanvas.height);
        // Draw overlay on top
        ctx.drawImage(overlayCanvas, 0, 0, compositeCanvas.width, compositeCanvas.height);

        // Convert to blob
        const blob = await new Promise<Blob | null>((resolve) => {
            compositeCanvas.toBlob(resolve, `image/${settings.recording.photo.format.split('-')[0]}`, 0.95);
        });

        if (blob) {
            const extension = getPhotoExtension(settings.recording.photo.format);
            const filename = `${settings.recording.photo.filenamePrefix}_${generateTimestamp()}${extension}`;
            await saveFile(blob, filename, photoDirectoryHandle);
            showToast(`Snapshot saved: ${filename}`, 'success');
        }
    }

    function formatTestDuration(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

    function handleClearDrawings() {
        if (overlayManagerRef.current) {
            overlayManagerRef.current.clear();
        }
    }

    if (loading || !settings) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 w-full p-6 overflow-y-auto">
            <div className="max-w-6xl mx-auto pb-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <a href="/dashboard/settings" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </a>
                        <div className="p-2 bg-purple-600/10 rounded-lg">
                            <span className="text-2xl">🎥</span>
                        </div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
                            Video Capture
                        </h1>
                    </div>
                    <p className="text-muted-foreground ml-14">
                        Configure camera, audio, and recording preferences for your workstation
                    </p>
                </div>

                {/* Missing Dependencies Warnings */}
                {dependencies.length > 0 && (
                    <div className="mb-6 space-y-3">
                        {dependencies.map((dep, index) => (
                            <div key={index} className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl">❌</span>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-red-600 dark:text-red-400 mb-1">{dep.name}</h3>
                                        <p className="text-sm text-red-700 dark:text-red-300 mb-2">{dep.reason}</p>
                                        <p className="text-sm text-red-600 dark:text-red-400">
                                            <strong>Recommendation:</strong> {dep.recommendation}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Live Preview Section - Collapsible */}
                <div className="mb-6 bg-card border border-border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-6 cursor-pointer" onClick={() => !isPreviewActive && setIsPreviewActive(!isPreviewActive)}>
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <span>👁️</span>
                            Live Preview & Testing
                        </h2>
                        {!isPreviewActive ? (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    startPreview();
                                }}
                                disabled={!settings.video.deviceId || !settings.audio.deviceId}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <span>▶️</span>
                                <span>Start Preview</span>
                            </button>
                        ) : (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    stopPreview();
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <span>⏹️</span>
                                <span>Stop Preview</span>
                            </button>
                        )}
                    </div>

                    {isPreviewActive && (
                        <div className="px-6 pb-6 space-y-3 border-t border-border pt-4">
                            <div className="relative bg-muted rounded-lg overflow-hidden mx-auto" style={{ aspectRatio: '16/9', maxHeight: '400px', maxWidth: '711px' }}>
                                <video
                                    ref={videoPreviewRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-contain"
                                />
                                <canvas
                                    ref={canvasPreviewRef}
                                    className="absolute inset-0 w-full h-full"
                                    style={{ pointerEvents: 'auto' }}
                                />
                                {isTestRecording && (
                                    <div className="absolute top-2 left-2 bg-red-600 px-2 py-1 rounded flex items-center gap-1.5 text-white font-semibold text-xs">
                                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                        REC {formatTestDuration(testRecordingDuration)}
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 bg-popover/90 px-2 py-1 rounded text-popover-foreground text-xs font-mono">
                                    {settings.video.resolution} @ {settings.video.frameRate}fps
                                </div>
                            </div>

                            {/* Drawing Tools - Compact */}
                            <div className="bg-muted/50 rounded-lg p-2 border border-border">
                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                    <span className="text-xs font-semibold text-muted-foreground mr-1">Tools:</span>
                                    <button
                                        onClick={() => handleToolChange('select')}
                                        className={`w-8 h-8 flex items-center justify-center rounded border-2 transition-all text-base ${currentTool === 'select'
                                            ? 'bg-primary text-primary-foreground border-primary shadow-md'
                                            : 'bg-background text-foreground border-border hover:border-primary/50 hover:bg-accent'
                                            }`}
                                        title="Select & Delete"
                                    >
                                        ↖️
                                    </button>
                                    {(['pen', 'circle', 'arrow', 'line', 'rectangle'] as DrawingTool[]).map((tool) => (
                                        <button
                                            key={tool}
                                            onClick={() => handleToolChange(tool)}
                                            className={`w-8 h-8 flex items-center justify-center rounded border-2 transition-all text-base ${currentTool === tool
                                                ? 'bg-primary text-primary-foreground border-primary shadow-md'
                                                : 'bg-background text-foreground border-border hover:border-primary/50 hover:bg-accent'
                                                }`}
                                            title={tool.charAt(0).toUpperCase() + tool.slice(1)}
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
                                        className="w-8 h-8 flex items-center justify-center rounded border-2 border-border bg-background text-foreground hover:border-primary/50 hover:bg-accent transition-all text-base"
                                        title="Undo"
                                    >
                                        ↩️
                                    </button>
                                    <button
                                        onClick={handleClearDrawings}
                                        className="w-8 h-8 flex items-center justify-center rounded border-2 border-border bg-background text-foreground hover:border-destructive hover:bg-destructive/10 transition-all text-base"
                                        title="Clear All"
                                    >
                                        🗑️
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-semibold text-muted-foreground">Size:</span>
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        value={lineWidth}
                                        onChange={(e) => handleLineWidthChange(Number(e.target.value))}
                                        className="w-20 h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                                    />
                                    <span className="text-xs text-muted-foreground font-mono w-6">{lineWidth}px</span>
                                    <div className="w-px h-6 bg-border mx-1"></div>
                                    <span className="text-xs font-semibold text-muted-foreground">Colors:</span>
                                    {['#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#ffffff', '#000000'].map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => handleColorChange(color)}
                                            className={`w-6 h-6 rounded border-2 transition-all shadow-sm ${currentColor === color
                                                ? 'border-primary ring-2 ring-primary/50 scale-110'
                                                : 'border-border hover:border-primary/50'
                                                }`}
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {!isTestRecording ? (
                                    <button
                                        onClick={startTestRecording}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                                    >
                                        <span>⏺️</span>
                                        <span>Test Recording</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={stopTestRecording}
                                        className="flex-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                                    >
                                        <span>⏹️</span>
                                        <span>Stop Recording</span>
                                    </button>
                                )}
                                <button
                                    onClick={takeTestSnapshot}
                                    className="bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                                >
                                    <span>📸</span>
                                    <span>Snapshot</span>
                                </button>
                            </div>

                            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                                <p className="font-semibold mb-1">Test your settings:</p>
                                <ul className="list-disc list-inside space-y-0.5 ml-2 text-xs">
                                    <li>Verify camera/audio working • Test drawing tools</li>
                                    <li>Recording saves to Downloads • Drawings included in files</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Camera Settings */}
                    <div className="bg-card border border-border rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <span>📹</span>
                            Camera Settings
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Video Device
                                </label>
                                <select
                                    value={settings.video.deviceId}
                                    onChange={(e) => handleVideoDeviceChange(e.target.value)}
                                    className="w-full bg-background border border-input rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="">Select camera...</option>
                                    {videoDevices.map((device) => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label}
                                        </option>
                                    ))}
                                </select>
                                {settings.video.deviceId && (
                                    <div className="mt-2 inline-flex items-center gap-2 text-xs font-semibold px-2 py-1 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 rounded">
                                        ✅ Compatible
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Resolution
                                </label>
                                <select
                                    value={settings.video.resolution}
                                    onChange={(e) => handleResolutionChange(e.target.value)}
                                    className="w-full bg-background border border-input rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="1280x720">720p (1280x720)</option>
                                    <option value="1920x1080">1080p (1920x1080)</option>
                                    <option value="2560x1440">1440p (2560x1440)</option>
                                    <option value="3840x2160">4K (3840x2160)</option>
                                </select>
                                <p className="mt-1.5 text-xs text-muted-foreground italic">
                                    ℹ️ 1080p recommended for inspections
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Frame Rate
                                </label>
                                <select
                                    value={settings.video.frameRate}
                                    onChange={(e) => handleFrameRateChange(Number(e.target.value))}
                                    className="w-full bg-background border border-input rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="24">24 fps (Cinematic)</option>
                                    <option value="30">30 fps (Standard)</option>
                                    <option value="60">60 fps (Smooth)</option>
                                </select>
                                <p className="mt-1.5 text-xs text-muted-foreground italic">
                                    ℹ️ 30fps is standard. Use 60fps for fast-moving subjects
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Audio Settings */}
                    <div className="bg-card border border-border rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <span>🎤</span>
                            Audio Settings
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Audio Device
                                </label>
                                <select
                                    value={settings.audio.deviceId}
                                    onChange={(e) => handleAudioDeviceChange(e.target.value)}
                                    className="w-full bg-background border border-input rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="">Select microphone...</option>
                                    {audioDevices.map((device) => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Sample Rate
                                </label>
                                <select
                                    value={settings.audio.sampleRate}
                                    onChange={(e) => handleAudioSettingChange('sampleRate', Number(e.target.value))}
                                    className="w-full bg-background border border-input rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="44100">44.1kHz (CD Quality)</option>
                                    <option value="48000">48kHz (Professional)</option>
                                    <option value="96000">96kHz (High-end)</option>
                                </select>
                                <p className="mt-1.5 text-xs text-muted-foreground italic">
                                    ℹ️ 48kHz is professional quality
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Channels
                                </label>
                                <select
                                    value={settings.audio.channels}
                                    onChange={(e) => handleAudioSettingChange('channels', Number(e.target.value))}
                                    className="w-full bg-background border border-input rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="1">Mono</option>
                                    <option value="2">Stereo</option>
                                </select>
                            </div>

                            <div className="space-y-2 pt-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.audio.noiseSuppression}
                                        onChange={(e) => handleAudioSettingChange('noiseSuppression', e.target.checked)}
                                        className="w-5 h-5 accent-primary"
                                    />
                                    <span className="text-sm">Noise Suppression</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.audio.echoCancellation}
                                        onChange={(e) => handleAudioSettingChange('echoCancellation', e.target.checked)}
                                        className="w-5 h-5 accent-teal-500"
                                    />
                                    <span className="text-sm">Echo Cancellation</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.audio.autoGainControl}
                                        onChange={(e) => handleAudioSettingChange('autoGainControl', e.target.checked)}
                                        className="w-5 h-5 accent-teal-500"
                                    />
                                    <span className="text-sm">Auto Gain Control</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Video Recording Settings */}
                    <div className="bg-card border border-border rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <span>🎥</span>
                            Video Recording Settings
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Video Format
                                </label>
                                <select
                                    value={settings.recording.video.format}
                                    onChange={(e) => handleVideoFormatChange(e.target.value)}
                                    className="w-full bg-background border border-input rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="webm-vp9">WebM VP9 (Recommended - Best quality/size)</option>
                                    <option value="webm-vp8">WebM VP8 (Good compatibility)</option>
                                    <option value="mp4-h264">MP4 H.264 (Universal playback)</option>
                                    <option value="mp4-h265">MP4 H.265 (Smaller files)</option>
                                </select>
                                <p className="mt-1.5 text-xs text-muted-foreground italic">
                                    ℹ️ WebM VP9 offers best quality/size ratio
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Filename Prefix
                                </label>
                                <input
                                    type="text"
                                    value={settings.recording.video.filenamePrefix}
                                    onChange={(e) => handleVideoSettingChange('filenamePrefix', e.target.value)}
                                    placeholder="e.g., video, inspection"
                                    className="w-full bg-background border border-input rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                                <p className="mt-1.5 text-xs text-slate-400 italic">
                                    ℹ️ Videos: {settings.recording.video.filenamePrefix}_YYYYMMDD_HHMMSS
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Save Location
                                </label>
                                <button
                                    onClick={selectVideoFolder}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    📂 Choose Folder
                                </button>
                                {videoDirectoryHandle && (
                                    <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                                        ✅ Saving to: {settings.recording.video.storagePath || videoDirectoryHandle.name}
                                    </p>
                                )}
                                {!videoDirectoryHandle && (
                                    <p className="mt-1.5 text-xs text-slate-400 italic">
                                        ℹ️ Click to select custom folder. Files will save to Downloads by default.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.recording.video.autoSplit}
                                        onChange={(e) => handleVideoSettingChange('autoSplit', e.target.checked)}
                                        className="w-5 h-5 accent-primary"
                                    />
                                    <span className="text-sm font-medium">Auto-split recordings</span>
                                </label>
                                <p className="mt-1.5 text-xs text-slate-400 italic ml-8">
                                    ℹ️ Automatically split large recordings into smaller files
                                </p>
                            </div>

                            {settings.recording.video.autoSplit && (
                                <div className="ml-8 space-y-4">
                                    <div>
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={settings.recording.video.splitBySize}
                                                onChange={(e) => handleVideoSettingChange('splitBySize', e.target.checked)}
                                                className="w-5 h-5 accent-primary"
                                            />
                                            <span className="text-sm font-medium">Split by file size</span>
                                        </label>
                                        {settings.recording.video.splitBySize && (
                                            <div className="mt-2 ml-8">
                                                <label className="block text-sm font-medium mb-2">
                                                    Split Size (MB)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="100"
                                                    max="2000"
                                                    step="100"
                                                    value={settings.recording.video.splitSizeMB}
                                                    onChange={(e) => handleVideoSettingChange('splitSizeMB', Number(e.target.value))}
                                                    className="w-full bg-background border border-input rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring"
                                                />
                                                <p className="mt-1.5 text-xs text-slate-400 italic">
                                                    ℹ️ Recommended: 500MB
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={settings.recording.video.splitByTime}
                                                onChange={(e) => handleVideoSettingChange('splitByTime', e.target.checked)}
                                                className="w-5 h-5 accent-primary"
                                            />
                                            <span className="text-sm font-medium">Split by time duration</span>
                                        </label>
                                        {settings.recording.video.splitByTime && (
                                            <div className="mt-2 ml-8">
                                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                                    Split Time (minutes)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="60"
                                                    step="1"
                                                    value={settings.recording.video.splitTimeMinutes}
                                                    onChange={(e) => handleVideoSettingChange('splitTimeMinutes', Number(e.target.value))}
                                                    className="w-full bg-background border border-input rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring"
                                                />
                                                <p className="mt-1.5 text-xs text-slate-400 italic">
                                                    ℹ️ Recommended: 10 minutes
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Photo Capture Settings */}
                    <div className="bg-card border border-border rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <span>📸</span>
                            Photo Capture Settings
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Photo Format
                                </label>
                                <select
                                    value={settings.recording.photo.format}
                                    onChange={(e) => handlePhotoFormatChange(e.target.value)}
                                    className="w-full bg-background border border-input rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="jpeg-95">JPEG High Quality (95%)</option>
                                    <option value="jpeg-85">JPEG Standard (85%)</option>
                                    <option value="png">PNG (Lossless)</option>
                                    <option value="webp-lossy">WebP Lossy (90%)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Filename Prefix
                                </label>
                                <input
                                    type="text"
                                    value={settings.recording.photo.filenamePrefix}
                                    onChange={(e) => handlePhotoSettingChange('filenamePrefix', e.target.value)}
                                    placeholder="e.g., photo, snapshot"
                                    className="w-full bg-background border border-input rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                                <p className="mt-1.5 text-xs text-slate-400 italic">
                                    ℹ️ Photos: {settings.recording.photo.filenamePrefix}_YYYYMMDD_HHMMSS
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Save Location
                                </label>
                                <button
                                    onClick={selectPhotoFolder}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    📂 Choose Folder
                                </button>
                                {photoDirectoryHandle && (
                                    <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                                        ✅ Saving to: {settings.recording.photo.storagePath || photoDirectoryHandle.name}
                                    </p>
                                )}
                                {!photoDirectoryHandle && (
                                    <p className="mt-1.5 text-xs text-muted-foreground italic">
                                        ℹ️ Click to select custom folder. Files will save to Downloads by default.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="bg-card border border-border rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <span>⚙️</span>
                            Actions
                        </h2>

                        <div className="space-y-3">
                            <button
                                onClick={handleReset}
                                className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold py-3 px-4 rounded-lg transition-colors"
                            >
                                Reset to Defaults
                            </button>
                            <div className="text-xs text-muted-foreground text-center pt-2">
                                Last saved: {new Date(settings.lastModified).toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Video Player Test Section */}
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <div className="bg-muted px-6 py-4 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🎬</span>
                            <div>
                                <h2 className="text-xl font-bold">Video Player</h2>
                                <p className="text-sm text-muted-foreground">Test playback with recorded videos</p>
                            </div>
                        </div>
                        {testVideoSrc && (
                            <button
                                onClick={() => {
                                    setTestVideoSrc('');
                                    setTestVideoFilename('');
                                }}
                                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <span>✕</span>
                                <span>Close Player</span>
                            </button>
                        )}
                    </div>

                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Select a recorded video to play
                            </label>
                            <input
                                type="file"
                                accept="video/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const url = URL.createObjectURL(file);
                                        setTestVideoSrc(url);
                                        setTestVideoFilename(file.name);
                                    }
                                }}
                                className="block w-full file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                            />
                            <p className="mt-2 text-xs text-muted-foreground">
                                Supports WebM, MP4, and other video formats. Test seeking, playback speed, and format conversion.
                            </p>
                        </div>

                        {testVideoSrc && (
                            <div className="space-y-4">
                                <VideoPlayer
                                    src={testVideoSrc}
                                    filename={testVideoFilename}
                                    className="w-full"
                                />

                                {/* Keyboard Shortcuts Quick Reference */}
                                <div className="bg-muted border border-border rounded-lg p-4">
                                    <h3 className="text-sm font-semibold mb-3">⌨️ Keyboard Shortcuts</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                        <div><kbd className="px-1.5 py-0.5 bg-muted-foreground/20 rounded text-xs">Space</kbd> Play/Pause</div>
                                        <div><kbd className="px-1.5 py-0.5 bg-muted-foreground/20 rounded text-xs">←/→</kbd> Skip 10s</div>
                                        <div><kbd className="px-1.5 py-0.5 bg-muted-foreground/20 rounded text-xs">&lt;/&gt;</kbd> Speed</div>
                                        <div><kbd className="px-1.5 py-0.5 bg-muted-foreground/20 rounded text-xs">F</kbd> Fullscreen</div>
                                        <div><kbd className="px-1.5 py-0.5 bg-muted-foreground/20 rounded text-xs">M</kbd> Mute</div>
                                        <div><kbd className="px-1.5 py-0.5 bg-muted-foreground/20 rounded text-xs">,/.</kbd> Frame</div>
                                        <div><kbd className="px-1.5 py-0.5 bg-muted-foreground/20 rounded text-xs">0-9</kbd> Seek %</div>
                                        <div><kbd className="px-1.5 py-0.5 bg-muted-foreground/20 rounded text-xs">↑/↓</kbd> Volume</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
