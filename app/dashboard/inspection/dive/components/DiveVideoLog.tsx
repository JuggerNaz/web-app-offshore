"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Camera, Video, Play, Square, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface DiveVideoLogProps {
    diveJob: any;
}

export default function DiveVideoLog({ diveJob }: DiveVideoLogProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [isStreaming, setIsStreaming] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
    const [photoNote, setPhotoNote] = useState("");

    async function startVideoFeed() {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false,
            });

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                videoRef.current.play();
            }

            setStream(mediaStream);
            setIsStreaming(true);
            toast.success("Video feed started");
        } catch (error) {
            console.error("Error starting video:", error);
            toast.error("Failed to start video feed. Check camera permissions.");
        }
    }

    function stopVideoFeed() {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
            setIsStreaming(false);
            toast.info("Video feed stopped");
        }
    }

    function capturePhoto() {
        if (!videoRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const video = videoRef.current;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(video, 0, 0);

        const photoData = canvas.toDataURL("image/jpeg", 0.9);
        setCapturedPhotos((prev) => [...prev, photoData]);

        toast.success("Photo captured");
        setPhotoNote("");
    }

    return (
        <Card className="p-6 shadow-lg h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Video className="h-5 w-5 text-blue-600" />
                    <h3 className="font-bold text-base">Video & Photo Log</h3>
                </div>
                {isStreaming && (
                    <Badge variant="default" className="bg-red-600 animate-pulse">
                        <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
                        RECORDING
                    </Badge>
                )}
            </div>

            {/* Video Feed */}
            <div className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden mb-4">
                <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    autoPlay
                    playsInline
                    muted
                />

                {!isStreaming && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                        <div className="text-center">
                            <Camera className="h-16 w-16 mx-auto mb-3 text-slate-600" />
                            <p className="text-slate-400 text-sm">No video feed</p>
                        </div>
                    </div>
                )}

                {/* Overlay with dive info */}
                {isStreaming && diveJob && (
                    <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent">
                        <div className="flex items-start justify-between text-white text-xs">
                            <div>
                                <p className="font-semibold">{diveJob.deployment_no}</p>
                                <p className="opacity-80">Diver: {diveJob.diver_name}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-mono">{new Date().toLocaleDateString()}</p>
                                <p className="font-mono opacity-80">
                                    {new Date().toLocaleTimeString()}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Hidden canvas for photo capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Controls */}
            <div className="space-y-3">
                {/* Video Controls */}
                <div className="grid grid-cols-2 gap-2">
                    <Button
                        onClick={startVideoFeed}
                        disabled={isStreaming}
                        className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                        <Play className="h-4 w-4" />
                        Start Video
                    </Button>
                    <Button
                        onClick={stopVideoFeed}
                        disabled={!isStreaming}
                        variant="destructive"
                        className="gap-2"
                    >
                        <Square className="h-4 w-4" />
                        Stop Video
                    </Button>
                </div>

                {/* Photo Capture */}
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="space-y-3">
                        <Input
                            placeholder="Photo note (optional)..."
                            value={photoNote}
                            onChange={(e) => setPhotoNote(e.target.value)}
                            disabled={!isStreaming}
                        />
                        <Button
                            onClick={capturePhoto}
                            disabled={!isStreaming}
                            className="w-full gap-2"
                        >
                            <Camera className="h-4 w-4" />
                            Capture Photo
                        </Button>
                    </div>
                </div>

                {/* Captured Photos Count */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                    <div className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            Photos Captured
                        </span>
                    </div>
                    <Badge variant="secondary">{capturedPhotos.length}</Badge>
                </div>
            </div>
        </Card>
    );
}
