"use client";

import React from "react";
import { VideoInterface } from "../../components/VideoInterface";
import { TapeLogEvents } from "../../components/TapeLogEvents";

interface VideoLogPanelProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  vidState: "IDLE" | "RECORDING" | "PAUSED";
  streamActive: boolean;
  setStreamActive: (val: boolean) => void;
  vidTimer: number;
  tapeNo: string;
  videoVisible: boolean;
  setVideoVisible: (val: boolean) => void;
  isStreamRecording: boolean;
  isStreamPaused: boolean;
  previewStream: MediaStream | null;
  handleStartStreamRecording: () => void;
  handlePauseStreamRecording: () => void;
  handleResumeStreamRecording: () => void;
  handleStopStreamRecording: () => void;
  handleGrabPhoto: () => void;
  handleToggleStreamRecording: () => void;
  handlePopOutStream: () => void;
  pipWindow: any;
  formatTime: (sec: number) => string;
  showDrawingTools: boolean;
  setShowDrawingTools: (val: boolean) => void;
  videoEvents: any[];
  tapeId: number | null;
  supabase: any;
  setVideoEvents: React.Dispatch<React.SetStateAction<any[]>>;
  setEditingEvent: (ev: any) => void;
  handleDeleteEvent: (id: string, logType: string, realId: number) => void;
  currentTool?: string;
  setCurrentTool?: (tool: any) => void;
  currentColor?: string;
  setCurrentColor?: (color: string) => void;
  lineWidth?: number;
  setLineWidth?: (width: number) => void;
  overlayManager?: any;
}

export function VideoLogPanel({
  videoRef,
  canvasRef,
  vidState,
  streamActive,
  setStreamActive,
  vidTimer,
  tapeNo,
  videoVisible,
  setVideoVisible,
  isStreamRecording,
  isStreamPaused,
  previewStream,
  handleStartStreamRecording,
  handlePauseStreamRecording,
  handleResumeStreamRecording,
  handleStopStreamRecording,
  handleGrabPhoto,
  handleToggleStreamRecording,
  handlePopOutStream,
  pipWindow,
  formatTime,
  showDrawingTools,
  setShowDrawingTools,
  videoEvents,
  tapeId,
  supabase,
  setVideoEvents,
  setEditingEvent,
  handleDeleteEvent,
  currentTool,
  setCurrentTool,
  currentColor,
  setCurrentColor,
  lineWidth,
  setLineWidth,
  overlayManager,
}: VideoLogPanelProps) {
  return (
    <div className="flex flex-col h-full bg-[#0f172a] text-slate-100 overflow-hidden">
      <VideoInterface
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
        onStartRecording={handleStartStreamRecording}
        onPauseRecording={handlePauseStreamRecording}
        onResumeRecording={handleResumeStreamRecording}
        onStopRecording={handleStopStreamRecording}
        onCapturePhoto={handleGrabPhoto}
        onToggleRecording={handleToggleStreamRecording}
        onPopOut={handlePopOutStream}
        onStopStream={() => setStreamActive(false)}
        pipActive={!!pipWindow}
        pipWindow={pipWindow}
        formatTime={formatTime}
        showDrawingTools={showDrawingTools}
        setShowDrawingTools={setShowDrawingTools}
        currentTool={currentTool}
        setCurrentTool={setCurrentTool}
        currentColor={currentColor}
        setCurrentColor={setCurrentColor}
        lineWidth={lineWidth}
        setLineWidth={setLineWidth}
        overlayManager={overlayManager}
      />
      <div className="bg-[#0f172a] h-[180px] shrink-0 border-t border-slate-800 overflow-hidden">
        <TapeLogEvents
          videoEvents={videoEvents}
          handleDeleteEvent={handleDeleteEvent}
          onEditEvent={(ev) => {
            setEditingEvent(ev);
          }}
        />
      </div>
    </div>
  );
}
