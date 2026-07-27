"use client";

import React, { useState } from "react";
import { Video, VideoOff } from "lucide-react";

interface CameraProps {
  streamActive: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  telemetry: {
    easting: string;
    northing: string;
    kp: string;
    depth: string;
    dive: string;
    rovType: string;
    rovHeading: string;
    cpValue: string;
    date: string;
    time: string;
  };
  onToggleStream?: () => void;
}

export function PipelineLiveCamera({
  streamActive,
  videoRef,
  telemetry,
  onToggleStream
}: CameraProps) {
  const [activeCam, setActiveCam] = useState<"MAIN" | "PORT" | "CENTRE" | "STARBOARD" | "QUAD">("MAIN");

  const cameraTabs = [
    { label: "MAIN", value: "MAIN" },
    { label: "PORT", value: "PORT" },
    { label: "CENTRE", value: "CENTRE" },
    { label: "STARBOARD", value: "STARBOARD" },
    { label: "QUAD VIEW", value: "QUAD" }
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative">
      {/* Top Banner tabs */}
      <div className="p-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex gap-1.5">
          {cameraTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveCam(tab.value as any)}
              className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${
                activeCam === tab.value
                  ? "bg-cyan-500 text-slate-950 shadow-sm"
                  : "bg-slate-900/60 text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={onToggleStream}
          className={`p-1.5 rounded-lg border transition-all ${
            streamActive
              ? "bg-green-950/30 border-green-500/30 text-green-400"
              : "bg-red-950/30 border-red-500/30 text-red-400"
          }`}
          title={streamActive ? "Stream Online" : "Stream Offline"}
        >
          {streamActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Viewfinder */}
      <div className="flex-1 bg-black relative min-h-0">
        {streamActive ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover opacity-80"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 z-30 bg-slate-950/90 backdrop-blur-sm">
            <div className="h-16 w-16 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800 animate-pulse">
              <VideoOff className="h-8 w-8 text-slate-600" />
            </div>
            <div className="text-center">
              <h3 className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">LIVE CAMERA OFFLINE</h3>
              <p className="text-slate-600 text-[9px] mt-0.5">Please check video device permissions</p>
            </div>
          </div>
        )}

        {/* Telemetry HUD overlays */}
        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none flex flex-wrap justify-between items-end gap-4 text-white font-mono text-[11px]">
          {/* Coordinates Block */}
          <div className="flex flex-col bg-slate-950/80 backdrop-blur-md border border-slate-800/80 p-2.5 rounded-lg min-w-[150px]">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 font-bold">Easting:</span>
              <span className="text-cyan-400 font-black">{telemetry.easting}</span>
            </div>
            <div className="flex justify-between gap-3 mt-1">
              <span className="text-slate-500 font-bold">Northing:</span>
              <span className="text-cyan-400 font-black">{telemetry.northing}</span>
            </div>
            <div className="flex justify-between gap-3 mt-1">
              <span className="text-slate-500 font-bold">KP:</span>
              <span className="text-cyan-400 font-black">{telemetry.kp}</span>
            </div>
            <div className="flex justify-between gap-3 mt-1">
              <span className="text-slate-500 font-bold">Depth:</span>
              <span className="text-cyan-400 font-black">{telemetry.depth}</span>
            </div>
          </div>

          {/* Time & Date HUD Overlay */}
          <div className="absolute top-4 right-4 flex flex-col items-end gap-1 font-mono text-[11px] bg-slate-950/80 backdrop-blur-md border border-slate-800/80 p-2 rounded-lg">
            <div>
              <span className="text-slate-500 font-bold">Date :</span> <span className="text-slate-200">{telemetry.date}</span>
            </div>
            <div className="mt-0.5">
              <span className="text-slate-500 font-bold">Time :</span> <span className="text-cyan-400 font-black">{telemetry.time}</span>
            </div>
          </div>

          {/* ROV Info Block */}
          <div className="flex flex-col bg-slate-950/80 backdrop-blur-md border border-slate-800/80 p-2.5 rounded-lg min-w-[150px]">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 font-bold">Dive:</span>
              <span className="text-slate-200">{telemetry.dive}</span>
            </div>
            <div className="flex justify-between gap-3 mt-1">
              <span className="text-slate-500 font-bold">ROV Type:</span>
              <span className="text-slate-200 truncate max-w-[100px]">{telemetry.rovType}</span>
            </div>
            <div className="flex justify-between gap-3 mt-1">
              <span className="text-slate-500 font-bold">ROV Heading:</span>
              <span className="text-slate-200">{telemetry.rovHeading}</span>
            </div>
            <div className="flex justify-between gap-3 mt-1">
              <span className="text-slate-500 font-bold">CP Value:</span>
              <span className="text-cyan-400 font-black">{telemetry.cpValue}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
