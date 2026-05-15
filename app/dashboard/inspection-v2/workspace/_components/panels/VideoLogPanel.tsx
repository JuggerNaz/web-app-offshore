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
}: VideoLogPanelProps) {
  return (
    <div className="flex-1 min-h-0 bg-black rounded-none overflow-hidden relative group/video flex flex-col h-full">
      <VideoInterface
        videoRef={videoRef}
        canvasRef={canvasRef}
        vidState={vidState}
        streamActive={streamActive}
        setStreamActive={setStreamActive}
        vidTimer={vidTimer}
        tapeNo={tapeNo}
        videoVisible={videoVisible}
        setVideoVisible={setVideoVisible}
        isStreamRecording={isStreamRecording}
        isStreamPaused={isStreamPaused}
        previewStream={previewStream}
        onStartRecording={handleStartStreamRecording}
        onPauseRecording={handlePauseStreamRecording}
        onResumeRecording={handleResumeStreamRecording}
        onStopRecording={handleStopStreamRecording}
        onCapturePhoto={handleGrabPhoto}
        onToggleRecording={handleToggleStreamRecording}
        onPopOut={handlePopOutStream}
        onStopStream={() => setStreamActive(false)}
        pipActive={!!pipWindow}
        formatTime={formatTime}
        showDrawingTools={showDrawingTools}
        setShowDrawingTools={setShowDrawingTools}
      />
      <div className="bg-[#0f172a] h-[180px] shrink-0 border-t border-slate-800 overflow-hidden">
        <TapeLogEvents
          videoEvents={videoEvents}
          handleDeleteEvent={handleDeleteEvent}
          onEditEvent={(ev) => {
            setEditingEvent(ev);
          }}
          expanded={true}
          setExpanded={() => {}}
        />
      </div>
    </div>
  );
}
