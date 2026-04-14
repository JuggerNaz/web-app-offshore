"use client";

import React, { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
    Camera, 
    Maximize2, 
    Pause, 
    Play, 
    Square, 
    Video, 
    VideoOff, 
    Settings, 
    Waves, 
    Trash2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface VideoInterfaceProps {
    vidState: "IDLE" | "RECORDING" | "PAUSED";
    vidTimer: number;
    tapeNo: string;
    videoVisible: boolean;
    setVideoVisible: (val: boolean) => void;
    streamActive: boolean;
    setStreamActive: (val: boolean) => void;
    isStreamRecording: boolean;
    isStreamPaused: boolean;
    previewStream: MediaStream | null;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    onStartRecording: () => void;
    onPauseRecording: () => void;
    onResumeRecording: () => void;
    onStopRecording: () => void;
    onCapturePhoto: () => void;
    onToggleRecording: () => void;
    onPopOut: () => void;
    onStopStream: () => void;
    pipActive: boolean;
    formatTime: (seconds: number) => string;
    showDrawingTools: boolean;
    setShowDrawingTools: (val: boolean) => void;
}

export const VideoInterface = ({
    vidState,
    vidTimer,
    tapeNo,
    videoVisible,
    setVideoVisible,
    streamActive,
    setStreamActive,
    isStreamRecording,
    isStreamPaused,
    previewStream,
    videoRef,
    canvasRef,
    onStartRecording,
    onPauseRecording,
    onResumeRecording,
    onStopRecording,
    onCapturePhoto,
    onToggleRecording,
    onPopOut,
    onStopStream,
    pipActive,
    formatTime,
    showDrawingTools,
    setShowDrawingTools
}: VideoInterfaceProps) => {
    const router = useRouter();

    const handleOpenSettings = () => {
        router.push('/dashboard/settings/video-capture');
    };

    return (
        <Card className="overflow-hidden border-slate-200 shadow-xl bg-slate-900 flex flex-col h-full relative group">
            <div className="flex-1 relative min-h-0 bg-black flex items-center justify-center overflow-hidden">
                {!streamActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 z-30 bg-slate-900/80 backdrop-blur-sm">
                        <div className="h-20 w-20 rounded-full bg-slate-800 flex items-center justify-center animate-pulse">
                            <VideoOff className="h-10 w-10 text-slate-600" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-slate-400 font-bold uppercase tracking-widest text-xs">Live Stream Offline</h3>
                            <p className="text-slate-600 text-[10px] mt-1">Check media device permissions</p>
                        </div>
                        <div className="flex gap-2">
                            <Button 
                                variant="outline" 
                                className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                                onClick={() => setStreamActive(true)}
                            >
                                Retry Connection
                            </Button>
                            <Button 
                                variant="outline" 
                                size="icon"
                                className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                                onClick={handleOpenSettings}
                                title="Live Stream Settings"
                            >
                                <Settings className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}

                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-contain ${!streamActive ? 'opacity-0' : 'opacity-100'} transition-opacity duration-700`}
                />
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-auto"
                />

                {/* Overlays */}
                <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
                    <Badge className="bg-black/60 backdrop-blur-md border-white/10 text-white font-mono px-3 py-1.5 text-sm shadow-2xl flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${isStreamRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-400'}`} />
                        {tapeNo}
                    </Badge>
                </div>

                <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
                    <Badge className="bg-black/60 backdrop-blur-md border-white/10 text-white font-mono px-3 py-1.5 text-sm shadow-2xl">
                        {formatTime(vidTimer)}
                    </Badge>
                </div>

                {/* Bottom Controls Overlay */}
                {streamActive && (
                <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
                                onClick={onToggleRecording}
                            >
                                {isStreamRecording ? <Square className="h-5 w-5 text-red-500" /> : <Play className="h-5 w-5 fill-current" />}
                            </Button>
                            {isStreamRecording && (
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
                                    onClick={isStreamPaused ? onResumeRecording : onPauseRecording}
                                >
                                    {isStreamPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <Button 
                                size="sm" 
                                className="bg-white/10 hover:bg-white/20 text-white border-white/10 gap-2"
                                onClick={() => setShowDrawingTools(!showDrawingTools)}
                            >
                                <Waves className="h-4 w-4" />
                                {showDrawingTools ? 'Hide Tools' : 'Draw'}
                            </Button>
                            <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
                                onClick={onCapturePhoto}
                            >
                                <Camera className="h-5 w-5" />
                            </Button>
                            <Button 
                                size="icon" 
                                variant="ghost" 
                                className={`h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 ${pipActive ? 'text-blue-400' : 'text-white'}`}
                                onClick={onPopOut}
                                title={pipActive ? "Close Floating Window" : "Pop Out Stream"}
                            >
                                <Maximize2 className="h-5 w-5" />
                            </Button>
                            <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
                                onClick={handleOpenSettings}
                                title="Live Stream Settings"
                            >
                                <Settings className="h-5 w-5" />
                            </Button>
                            <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-10 w-10 rounded-full bg-white/10 hover:bg-red-500/20 text-red-500"
                                onClick={onStopStream}
                                title="Stop Streaming"
                            >
                                <VideoOff className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </div>
                )}
            </div>
        </Card>
    );
};
