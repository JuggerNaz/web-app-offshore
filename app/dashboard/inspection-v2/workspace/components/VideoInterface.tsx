"use client";

import React from "react";
import { createPortal } from "react-dom";
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
    Pencil,
    Minus,
    MoveUpRight,
    Circle,
    Type,
    MousePointer,
    Undo2,
    Trash2,
    Edit3,
    Pin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CanvasOverlayManager } from "@/lib/video-recorder/canvas-overlay";

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
    pipWindow?: any;
    formatTime: (seconds: number) => string;
    showDrawingTools: boolean;
    setShowDrawingTools: (val: boolean) => void;
    currentTool?: string;
    setCurrentTool?: (tool: any) => void;
    currentColor?: string;
    setCurrentColor?: (color: string) => void;
    lineWidth?: number;
    setLineWidth?: (width: number) => void;
    overlayManager?: any;
    setOverlayManager?: (om: any) => void;
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
    pipWindow,
    formatTime,
    showDrawingTools,
    setShowDrawingTools,
    currentTool,
    setCurrentTool,
    currentColor,
    setCurrentColor,
    lineWidth,
    setLineWidth,
    overlayManager,
    setOverlayManager
}: VideoInterfaceProps) => {
    const router = useRouter();

    const [selectedTool, setSelectedTool] = React.useState<string>("select");
    const [isStickyTool, setIsStickyTool] = React.useState<boolean>(false);
    const [selectedColor, setSelectedColor] = React.useState<string>(currentColor || "#ef4444");
    const [selectedLineWidth, setSelectedLineWidth] = React.useState<number>(lineWidth || 3);
    const [selectedObject, setSelectedObject] = React.useState<any>(null);

    const [textInputState, setTextInputState] = React.useState<{
        normX: number;
        normY: number;
        objId?: string;
    } | null>(null);
    const [textInputValue, setTextInputValue] = React.useState<string>("");

    const activeOverlayManagerRef = React.useRef<CanvasOverlayManager | null>(null);
    const sharedObjectsRef = React.useRef<any[]>([]);

    // Helper: Guaranteed singleton getter for CanvasOverlayManager
    const getOverlayManager = React.useCallback((): CanvasOverlayManager | null => {
        if (!canvasRef.current) return null;

        if (!activeOverlayManagerRef.current || activeOverlayManagerRef.current.getCanvas() !== canvasRef.current) {
            if (activeOverlayManagerRef.current) {
                try { activeOverlayManagerRef.current.destroy(); } catch (e) {}
            }

            const om = new CanvasOverlayManager(canvasRef.current);
            om.setTool(selectedTool as any, isStickyTool);
            om.setColor(selectedColor);
            om.setLineWidth(selectedLineWidth);

            om.onSelectionChange = (obj: any) => {
                setSelectedObject(obj);
            };
            om.onTextRequest = (pos: any, existingText?: string, objId?: string) => {
                setTextInputState({ normX: pos.x, normY: pos.y, objId });
                setTextInputValue(existingText || "");
            };
            om.onObjectsChange = (objs: any[]) => {
                sharedObjectsRef.current = objs;
            };
            om.onToolChange = (tool: string, sticky: boolean) => {
                setSelectedTool(tool);
                setIsStickyTool(sticky);
                if (setCurrentTool) {
                    setCurrentTool(tool);
                }
            };

            if (sharedObjectsRef.current.length > 0) {
                om.setObjects(sharedObjectsRef.current);
            }

            activeOverlayManagerRef.current = om;
            if (setOverlayManager) {
                setOverlayManager(om);
            }
        }

        return activeOverlayManagerRef.current;
    }, [canvasRef.current, selectedTool, isStickyTool, selectedColor, selectedLineWidth, setCurrentTool, setOverlayManager]);

    // Initialize CanvasOverlayManager on canvas mount or layout change
    React.useEffect(() => {
        const om = getOverlayManager();
        if (om) {
            om.redraw();
        }
    }, [canvasRef.current, streamActive, pipWindow, getOverlayManager]);

    React.useEffect(() => {
        if (currentColor) {
            setSelectedColor(currentColor);
            const om = getOverlayManager();
            if (om) om.setColor(currentColor);
        }
    }, [currentColor, getOverlayManager]);

    React.useEffect(() => {
        if (lineWidth) {
            setSelectedLineWidth(lineWidth);
            const om = getOverlayManager();
            if (om) om.setLineWidth(lineWidth);
        }
    }, [lineWidth, getOverlayManager]);

    const handleToolClick = (tool: string) => {
        const newSticky = selectedTool === tool ? !isStickyTool : false;
        setSelectedTool(tool);
        setIsStickyTool(newSticky);
        if (setCurrentTool) setCurrentTool(tool);
        
        const om = getOverlayManager();
        if (om) {
            om.setTool(tool as any, newSticky);
        }
        setTextInputState(null);
    };

    const handleToolDoubleClick = (tool: string) => {
        if (tool === 'select') return;
        setSelectedTool(tool);
        setIsStickyTool(true);
        if (setCurrentTool) setCurrentTool(tool);

        const om = getOverlayManager();
        if (om) {
            om.setTool(tool as any, true);
        }
        setTextInputState(null);
    };

    const handleSelectColor = (color: string) => {
        setSelectedColor(color);
        if (setCurrentColor) setCurrentColor(color);
        const om = getOverlayManager();
        if (om) om.setColor(color);
    };

    const handleSelectWidth = (w: number) => {
        setSelectedLineWidth(w);
        if (setLineWidth) setLineWidth(w);
        const om = getOverlayManager();
        if (om) om.setLineWidth(w);
    };

    const handleUndo = () => {
        const om = getOverlayManager();
        om?.undo();
    };

    const handleClear = () => {
        const om = getOverlayManager();
        om?.clear();
        sharedObjectsRef.current = [];
    };

    const handleDeleteSelected = () => {
        const om = getOverlayManager();
        om?.deleteSelected();
        setSelectedObject(null);
    };

    const handleEditText = () => {
        const om = getOverlayManager();
        const selObj = om?.getSelectedObject() || selectedObject;
        if (selObj && selObj.type === 'text') {
            setTextInputState({ normX: selObj.startPoint?.x || 0.1, normY: selObj.startPoint?.y || 0.1, objId: selObj.id });
            setTextInputValue(selObj.text || "");
        }
    };

    const handleCommitText = () => {
        if (!textInputState || !textInputValue.trim()) {
            setTextInputState(null);
            return;
        }

        const om = getOverlayManager();

        if (textInputState.objId) {
            om?.updateTextObject(textInputState.objId, textInputValue.trim());
        } else {
            om?.addTextObject({ x: textInputState.normX, y: textInputState.normY }, textInputValue.trim());
        }

        setTextInputState(null);
        setTextInputValue("");
    };

    const handleOpenSettings = () => {
        router.push('/dashboard/settings/video-capture');
    };

    const renderToolButton = (tool: string, IconComponent: any, title: string) => {
        const isActive = selectedTool === tool;
        const isSticky = isActive && isStickyTool && tool !== 'select';

        return (
            <Button
                size="icon"
                variant="ghost"
                className={`h-7 w-7 rounded-full text-xs transition-all relative ${
                    isActive 
                        ? (isSticky ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-400/50' : 'bg-blue-600 text-white shadow-md') 
                        : 'text-slate-300 hover:bg-white/10'
                }`}
                onClick={() => handleToolClick(tool)}
                onDoubleClick={() => handleToolDoubleClick(tool)}
                title={`${title} (Double-click to lock/sticky tool)`}
            >
                <IconComponent className="h-3.5 w-3.5" />
                {isSticky && (
                    <Pin className="h-2 w-2 absolute -top-0.5 -right-0.5 fill-amber-300 text-amber-300 animate-pulse" />
                )}
            </Button>
        );
    };

    const renderVideoInterfaceContent = (isInPip = false) => (
        <div className="flex-1 relative min-h-0 bg-black flex items-center justify-center overflow-hidden w-full h-full">
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
                            className="bg-white/5 border-white/10 text-white hover:bg-white/10 text-xs"
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
                className="absolute inset-0 w-full h-full pointer-events-auto z-10"
            />

            {/* Floating Inline Text Input Box */}
            {textInputState && (
                <div 
                    className="absolute z-40 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-2 shadow-2xl flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        left: `${Math.min(75, Math.max(5, textInputState.normX * 100))}%`,
                        top: `${Math.min(75, Math.max(5, textInputState.normY * 100))}%`,
                    }}
                >
                    <input
                        autoFocus
                        type="text"
                        className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52 font-sans"
                        placeholder="Type annotation text..."
                        value={textInputValue}
                        onChange={(e) => setTextInputValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCommitText();
                            if (e.key === 'Escape') setTextInputState(null);
                        }}
                    />
                    <Button size="sm" className="h-7 bg-blue-600 hover:bg-blue-500 text-white text-xs px-2.5 font-bold" onClick={handleCommitText}>
                        Add Text
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-slate-400 hover:bg-white/10 text-xs px-2" onClick={() => setTextInputState(null)}>
                        Cancel
                    </Button>
                </div>
            )}

            {/* Floating Drawing Tools Overlay Bar */}
            {showDrawingTools && streamActive && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-full px-3 py-1.5 shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Tools Selection */}
                    <div className="flex items-center gap-1 border-r border-slate-700/60 pr-2">
                        {renderToolButton('select', MousePointer, 'Select / Move / Resize / Delete Objects')}
                        {renderToolButton('pen', Pencil, 'Pen / Freehand Draw')}
                        {renderToolButton('text', Type, 'Text Tool (Click Canvas to Type)')}
                        {renderToolButton('line', Minus, 'Straight Line')}
                        {renderToolButton('arrow', MoveUpRight, 'Arrow Pointer')}
                        {renderToolButton('circle', Circle, 'Circle / Ellipse')}
                        {renderToolButton('rectangle', Square, 'Rectangle')}
                    </div>

                    {/* Color Palette */}
                    <div className="flex items-center gap-1.5 border-r border-slate-700/60 pr-2">
                        {['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#ffffff', '#000000'].map((color) => (
                            <button
                                key={color}
                                type="button"
                                className={`w-4 h-4 rounded-full border border-white/30 transition-all ${selectedColor === color ? 'scale-125 ring-2 ring-blue-400 ring-offset-1 ring-offset-slate-900' : 'hover:scale-110 opacity-80 hover:opacity-100'}`}
                                style={{ backgroundColor: color }}
                                onClick={() => handleSelectColor(color)}
                                title={`Color ${color}`}
                            />
                        ))}
                    </div>

                    {/* Line Thickness */}
                    <div className="flex items-center gap-1 border-r border-slate-700/60 pr-2">
                        {[2, 4, 8].map((w) => (
                            <button
                                key={w}
                                type="button"
                                className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-tight transition-all ${selectedLineWidth === w ? 'bg-blue-500/30 text-blue-300 border border-blue-400/50' : 'text-slate-400 hover:text-white'}`}
                                onClick={() => handleSelectWidth(w)}
                                title={`${w}px width`}
                            >
                                {w}px
                            </button>
                        ))}
                    </div>

                    {/* Selected Element Actions (Edit / Delete Selected) */}
                    {selectedObject && (
                        <div className="flex items-center gap-1 border-r border-slate-700/60 pr-2 bg-blue-900/40 px-1.5 py-0.5 rounded-full border border-blue-500/30">
                            {selectedObject.type === 'text' && (
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 rounded-full text-blue-300 hover:bg-blue-600/30"
                                    onClick={handleEditText}
                                    title="Edit Selected Text"
                                >
                                    <Edit3 className="h-3 w-3" />
                                </Button>
                            )}
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 rounded-full text-red-400 hover:bg-red-500/20"
                                onClick={handleDeleteSelected}
                                title="Delete Selected Graphic"
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                    )}

                    {/* Undo & Clear */}
                    <div className="flex items-center gap-1">
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-full text-slate-300 hover:bg-white/10"
                            onClick={handleUndo}
                            title="Undo Last Mark"
                        >
                            <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-full text-red-400 hover:bg-red-500/20"
                            onClick={handleClear}
                            title="Clear All Annotations"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Overlays */}
            <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
                <Badge className="bg-black/60 backdrop-blur-md border-white/10 text-white font-mono px-3 py-1.5 text-sm shadow-2xl flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${isStreamRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-400'}`} />
                    {tapeNo || "NO TAPE"}
                </Badge>
            </div>

            <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
                <Badge className="bg-black/60 backdrop-blur-md border-white/10 text-white font-mono px-3 py-1.5 text-sm shadow-2xl">
                    {formatTime(vidTimer)}
                </Badge>
            </div>

            {/* Bottom Controls Overlay */}
            {streamActive && (
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 z-20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
                            onClick={onToggleRecording}
                            title={isStreamRecording ? "Stop Recording" : "Start Recording"}
                        >
                            {isStreamRecording ? <Square className="h-5 w-5 text-red-500" /> : <Play className="h-5 w-5 fill-current" />}
                        </Button>
                        {isStreamRecording && (
                            <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
                                onClick={isStreamPaused ? onResumeRecording : onPauseRecording}
                                title={isStreamPaused ? "Resume" : "Pause"}
                            >
                                {isStreamPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Button 
                            size="sm" 
                            className={`border-white/10 gap-2 text-xs transition-all ${showDrawingTools ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                            onClick={() => setShowDrawingTools(!showDrawingTools)}
                        >
                            <Waves className="h-4 w-4" />
                            {showDrawingTools ? 'Hide Tools' : 'Draw'}
                        </Button>
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30"
                            onClick={onCapturePhoto}
                            title="Grab Photo Frame"
                        >
                            <Camera className="h-5 w-5" />
                        </Button>
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            className={`h-10 w-10 rounded-full ${isInPip || pipActive ? 'bg-blue-600/30 text-blue-400 hover:bg-blue-600/50' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                            onClick={onPopOut}
                            title={isInPip || pipActive ? "Dock Back to Workspace" : "Pop Out Stream"}
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
    );

    return (
        <Card className="overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl bg-slate-900 flex flex-col h-full relative group">
            {pipWindow ? (
                <>
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-slate-400">
                        <div className="p-4 rounded-full bg-blue-500/10 text-blue-400 mb-3 border border-blue-500/20 animate-pulse">
                            <Video className="w-8 h-8" />
                        </div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-200">
                            Photo / Video Grab Popped Out
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                            Live camera feed and photo capture controls are running in an extended floating window.
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-4 text-[10px] font-bold uppercase tracking-wider bg-blue-600/20 hover:bg-blue-600 text-blue-300 border-blue-500/30 transition-all"
                            onClick={onPopOut}
                        >
                            Dock Back To Workspace
                        </Button>
                    </div>
                    {createPortal(
                        <div className="w-full h-full flex flex-col bg-black overflow-hidden font-sans relative group">
                            {renderVideoInterfaceContent(true)}
                        </div>,
                        pipWindow.document.body
                    )}
                </>
            ) : (
                renderVideoInterfaceContent(false)
            )}
        </Card>
    );
};
