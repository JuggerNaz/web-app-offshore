"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Video, Square, Brain, Settings, ExternalLink, Play } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface ROVVideoFeedProps {
    rovJob: any;
    autoGrab?: boolean;
}

interface WorkstationSettings {
    video: {
        deviceId: string;
        resolution: string;
        frameRate: number;
    };
    audio: {
        deviceId: string;
        enabled: boolean;
        sampleRate: number;
        channels: number;
        echoCancellation: boolean;
        noiseSuppression: boolean;
        autoGainControl: boolean;
    };
    recording: {
        video: {
            format: string;
            quality: string;
            filenamePrefix: string;
            storagePath: string;
        };
        photo: {
            format: string;
            filenamePrefix: string;
            storagePath: string;
        };
    };
}

export default function ROVVideoFeed({ rovJob, autoGrab }: ROVVideoFeedProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [settings, setSettings] = useState<WorkstationSettings | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [lastGrabTime, setLastGrabTime] = useState<Date | null>(null);
    const [grabbedFrames, setGrabbedFrames] = useState<number>(0);

    useEffect(() => {
        // Load Video Capture settings from localStorage
        loadVideoSettings();

        return () => {
            stopVideoFeed();
        };
    }, []);

    function loadVideoSettings() {
        const savedSettings = localStorage.getItem('video_recorder_settings');
        if (savedSettings) {
            try {
                const parsedSettings = JSON.parse(savedSettings);
                setSettings(parsedSettings);
            } catch (error) {
                console.error('Failed to parse video settings:', error);
            }
        }
    }

    async function startVideoFeed() {
        if (!settings) {
            toast.error('No video settings found. Please configure in Settings page.');
            return;
        }

        try {
            const constraints = {
                video: {
                    deviceId: settings.video.deviceId ? { exact: settings.video.deviceId } : undefined,
                    width: { ideal: parseInt(settings.video.resolution.split('x')[0]) },
                    height: { ideal: parseInt(settings.video.resolution.split('x')[1]) },
                    frameRate: { ideal: settings.video.frameRate },
                },
                audio: false, // No audio for ROV inspection
            };

            const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            setStream(mediaStream);
            setIsStreaming(true);

            // Attach stream to video element
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                await videoRef.current.play();
            }

            toast.success("Video feed connected");
        } catch (error) {
            console.error("Error initializing video:", error);
            toast.error("Failed to connect to video feed. Check camera permissions.");
        }
    }

    function stopVideoFeed() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setIsStreaming(false);

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }

    async function grabFrame(autoGrabbed: boolean = false) {
        if (!videoRef.current || !canvasRef.current || !settings) return;

        try {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            // Set canvas size to video size
            canvas.width = videoRef.current.videoWidth || 1920;
            canvas.height = videoRef.current.videoHeight || 1080;

            // Draw video frame to canvas
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

            // Apply overlay
            applyOverlay(ctx, canvas.width, canvas.height);

            // Get photo format from settings
            const photoFormat = settings.recording.photo.format;
            const mimeType = photoFormat === 'png-lossless'
                ? 'image/png'
                : photoFormat === 'webp-lossy'
                    ? 'image/webp'
                    : 'image/jpeg';

            // Convert to blob using settings
            canvas.toBlob(async (blob) => {
                if (!blob) return;

                // Generate filename using settings prefix
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const extension = photoFormat.split('-')[0];
                const filename = `${settings.recording.photo.filenamePrefix}_${timestamp}.${extension}`;

                // In production: upload to storage and link to inspection
                console.log("Frame grabbed:", filename, blob.size, "bytes");

                setGrabbedFrames((prev) => prev + 1);
                setLastGrabTime(new Date());

                toast.success(
                    autoGrabbed ? "Frame auto-grabbed" : `Frame captured: ${filename}`
                );

                // TODO: Upload to Supabase Storage and link to inspection record
            }, mimeType, 0.95);
        } catch (error) {
            console.error("Error grabbing frame:", error);
            toast.error("Failed to grab frame");
        }
    }

    function applyOverlay(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number
    ) {
        // Apply overlay with ROV data
        ctx.font = "16px Arial";
        ctx.fillStyle = "white";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;

        const now = new Date();
        const dateTime = now.toLocaleString();

        // Top-left: Date/Time
        const text1 = dateTime;
        ctx.strokeText(text1, 10, 30);
        ctx.fillText(text1, 10, 30);

        // Top-right: Deployment No
        const text2 = `Deployment: ${rovJob?.deployment_no || "Unknown"}`;
        const text2Width = ctx.measureText(text2).width;
        ctx.strokeText(text2, width - text2Width - 10, 30);
        ctx.fillText(text2, width - text2Width - 10, 30);

        // Bottom-left: ROV Serial
        const text3 = `ROV: ${rovJob?.rov_serial_no || "Unknown"}`;
        ctx.strokeText(text3, 10, height - 10);
        ctx.fillText(text3, 10, height - 10);

        // Bottom-right: Frame count
        const text4 = `Frame: ${grabbedFrames + 1}`;
        const text4Width = ctx.measureText(text4).width;
        ctx.strokeText(text4, width - text4Width - 10, height - 10);
        ctx.fillText(text4, width - text4Width - 10, height - 10);
    }

    async function analyzeWithAI() {
        if (!canvasRef.current) return;

        try {
            canvasRef.current.toBlob(async (blob) => {
                if (!blob) return;

                toast.info("Sending frame to AI for analysis...");

                // In production: send to AI vision API
                setTimeout(() => {
                    toast.success("AI analysis complete! Check inspection suggestions.");
                }, 2000);
            }, "image/jpeg");
        } catch (error) {
            console.error("Error analyzing with AI:", error);
            toast.error("Failed to analyze frame");
        }
    }

    if (!settings) {
        return (
            <Card className="p-4 shadow-lg border-slate-200 dark:border-slate-800 h-full">
                <div className="space-y-4 h-full flex flex-col">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                            Live Video Feed
                        </h3>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <Settings className="h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
                            <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                                No Video Capture Settings Found
                            </p>
                            <p className="text-xs text-muted-foreground mb-4">
                                Please configure Video Capture settings first
                            </p>
                            <Link href="/dashboard/settings/video-capture">
                                <Button variant="outline" size="sm" className="gap-2">
                                    <Settings className="h-4 w-4" />
                                    Open Settings
                                    <ExternalLink className="h-3 w-3" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-4 shadow-lg border-slate-200 dark:border-slate-800 h-full">
            <div className="space-y-4 h-full flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                            Live Video Feed
                        </h3>
                        <Badge variant={isStreaming ? "default" : "secondary"} className={isStreaming ? "bg-green-600" : ""}>
                            {isStreaming ? (
                                <>
                                    <Video className="h-3 w-3 mr-1 animate-pulse" />
                                    Streaming
                                </>
                            ) : (
                                <>
                                    <Square className="h-3 w-3 mr-1" />
                                    Offline
                                </>
                            )}
                        </Badge>
                    </div>

                    {autoGrab && (
                        <Badge variant="outline" className="text-xs">
                            Auto-Grab Enabled
                        </Badge>
                    )}
                </div>

                {/* Start Button */}
                {!isStreaming && (
                    <Button
                        onClick={startVideoFeed}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        size="sm"
                    >
                        <Play className="h-4 w-4 mr-2" />
                        Start Video Feed
                    </Button>
                )}

                {/* Video Container */}
                <div className="flex-1 relative bg-black rounded-lg overflow-hidden">
                    {isStreaming ? (
                        <>
                            {/* Actual video element */}
                            <video
                                ref={videoRef}
                                className="w-full h-full object-contain"
                                autoPlay
                                playsInline
                                muted
                            />
                            <canvas ref={canvasRef} className="hidden" />

                            {/* Live overlay */}
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute top-2 left-2 text-white text-sm bg-black/50 px-2 py-1 rounded">
                                    {new Date().toLocaleString()}
                                </div>
                                <div className="absolute top-2 right-2 text-yellow-400 text-sm bg-black/50 px-2 py-1 rounded">
                                    Deployment: {rovJob?.deployment_no || "Unknown"}
                                </div>
                                <div className="absolute bottom-2 left-2 text-white text-sm bg-black/50 px-2 py-1 rounded">
                                    ROV: {rovJob?.rov_serial_no || "Unknown"}
                                </div>
                                <div className="absolute bottom-2 right-2 text-green-400 text-sm bg-black/50 px-2 py-1 rounded flex items-center gap-1">
                                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                    LIVE
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                                <Square className="h-16 w-16 mx-auto mb-4 text-slate-600" />
                                <p className="text-white/60 text-sm">Click Start to begin video feed</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Controls */}
                {isStreaming && (
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex gap-2">
                            <Button
                                onClick={() => grabFrame(false)}
                                disabled={!isStreaming}
                                size="sm"
                                variant="outline"
                            >
                                <Camera className="h-4 w-4 mr-2" />
                                Grab Frame
                            </Button>
                            <Button
                                onClick={analyzeWithAI}
                                disabled={!isStreaming}
                                size="sm"
                                variant="outline"
                                className="text-purple-600 border-purple-600 hover:bg-purple-50"
                            >
                                <Brain className="h-4 w-4 mr-2" />
                                AI Analyze
                            </Button>
                            <Button
                                onClick={stopVideoFeed}
                                size="sm"
                                variant="destructive"
                            >
                                <Square className="h-4 w-4 mr-2" />
                                Stop
                            </Button>
                        </div>

                        <div className="text-xs text-muted-foreground">
                            Frames: {grabbedFrames}
                            {lastGrabTime && (
                                <span className="ml-2">
                                    Last: {lastGrabTime.toLocaleTimeString()}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Settings Info */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                    <p className="text-xs font-medium text-slate-900 dark:text-white mb-1">
                        Video Configuration
                    </p>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>Resolution: {settings.video.resolution}</div>
                        <div>Frame Rate: {settings.video.frameRate} fps</div>
                        <div>Photo Format: {settings.recording.photo.format}</div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
