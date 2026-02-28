"use client";

import React, { useState, useEffect } from "react";
import {
    AlertCircle,
    Camera,
    CheckCircle2,
    ChevronDown,
    Clock,
    FileText,
    Play,
    Pause,
    Plus,
    Search,
    Settings,
    Square,
    Video,
    X,
    MapPin,
    Building2,
    Activity,
    VideoOff,
    CheckSquare,
    Save,
    ArrowRight,
    ArrowLeft,
    ListTodo,
    History,
    FileSpreadsheet,
    LineChart,
    Printer,
    Trash2,
    Edit,
    Maximize2,
    Box,
    Wifi,
    List,
    Layers,
    Power
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// MOCK DATA
const MOVEMENTS = ["Left Surface", "Arrived Bottom", "Left Bottom", "Arrived Surface"];
const INITIAL_VIDEO_EVENTS = [
    { id: 1, time: "00:00:00", action: "Start Tape", diveLogId: "DIVE-02" },
    { id: 2, time: "00:15:20", action: "Pause", diveLogId: "DIVE-02" },
    { id: 3, time: "00:16:05", action: "Resume", diveLogId: "DIVE-02" },
];
const COMPONENTS_SOW = [
    { id: "LEG_B2", name: "LEG B2", depth: "-12m", tasks: ["GVINS", "HSTAT"] },
    { id: "BAN_001", name: "BAN001", depth: "-8m", tasks: ["CVINS"] },
];
const COMPONENTS_NON_SOW = [
    { id: "NODE_X", name: "NODE X", depth: "-15m", tasks: ["GVINS"] },
    { id: "RISER_A", name: "RISER A", depth: "-22m", tasks: ["CVINS"] },
];
const HISTORICAL_DATA = [
    { year: 2024, type: "GVINS", status: "Anomaly", finding: "Minor marine growth", inspector: "Alex" },
    { year: 2022, type: "CVINS", status: "Pass", finding: "Clear", inspector: "Jitesh" },
];
const CURRENT_RECORDS = [
    { id: 1, time: "10:57", type: "GVINS", comp: "LEG B2", status: "Pass", timer: "00:15:10", hasPhoto: true },
    { id: 2, time: "11:20", type: "HSTAT", comp: "LEG B2", status: "Anomaly", timer: "00:30:45", hasPhoto: false },
];

export default function V10PreviewLayout() {
    // Mode
    const [inspMethod, setInspMethod] = useState<"DIVING" | "ROV">("DIVING");

    const DEPLOYMENTS = inspMethod === "DIVING"
        ? [{ id: "DIVE-02", name: "Jitesh" }, { id: "DIVE-03", name: "Sarah" }]
        : [{ id: "ROV-ALPHA", name: "Vehicle A" }, { id: "ROV-BETA", name: "Vehicle B" }];

    const [activeDep, setActiveDep] = useState(DEPLOYMENTS[0]);

    // Operations State
    const [movIdx, setMovIdx] = useState(0);
    const [vidState, setVidState] = useState<"IDLE" | "RECORDING" | "PAUSED">("IDLE");
    const [videoVisible, setVideoVisible] = useState(true);
    const [streamActive, setStreamActive] = useState(false);

    // Component Target Tab Mode
    const [compView, setCompView] = useState<"LIST" | "MODEL_3D">("LIST");

    const [vidTimer, setVidTimer] = useState(0);
    const [activeChapter, setActiveChapter] = useState(1);
    const [videoEvents, setVideoEvents] = useState(INITIAL_VIDEO_EVENTS);

    // Context
    const [selectedComp, setSelectedComp] = useState<any>(null);
    const [activeSpec, setActiveSpec] = useState<string | null>(null);
    const [findingType, setFindingType] = useState<"Pass" | "Anomaly">("Pass");
    const [photoLinked, setPhotoLinked] = useState(false);

    // Format timer
    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Auto Timer
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (vidState === "RECORDING") {
            interval = setInterval(() => setVidTimer(t => t + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [vidState]);

    const handleLogEvent = (action: string) => {
        setVideoEvents([{ id: Date.now(), time: formatTime(vidTimer), action, diveLogId: activeDep.id }, ...videoEvents]);
    };

    const handleDeleteEvent = (id: number) => {
        setVideoEvents(videoEvents.filter(ev => ev.id !== id));
    };

    // Handle method switch overriding deps
    useEffect(() => {
        setActiveDep(inspMethod === "DIVING" ? { id: "DIVE-02", name: "Jitesh" } : { id: "ROV-ALPHA", name: "Vehicle A" });
    }, [inspMethod]);

    const handleMovementNext = () => { if (movIdx < MOVEMENTS.length - 1) setMovIdx(movIdx + 1); };
    const handleMovementPrev = () => { if (movIdx > 0) setMovIdx(movIdx - 1); };

    return (
        <div className="flex flex-col h-[calc(100vh)] bg-slate-100 dark:bg-slate-950 font-sans text-slate-900 overflow-hidden">

            {/* WORKSPACE HEADER */}
            <header className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between shadow-md z-20 shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-black uppercase tracking-widest flex items-center gap-2 text-blue-400">
                        <Activity className="w-5 h-5" /> Cockpit
                    </h1>
                    <div className="h-5 w-px bg-slate-700"></div>

                    {/* Mode Toggle */}
                    <div className="flex bg-slate-800 rounded p-1 mr-4">
                        <button onClick={() => setInspMethod("DIVING")} className={`px-4 py-1 text-xs font-bold rounded uppercase tracking-wider ${inspMethod === "DIVING" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>DIVING</button>
                        <button onClick={() => setInspMethod("ROV")} className={`px-4 py-1 text-xs font-bold rounded uppercase tracking-wider ${inspMethod === "ROV" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>ROV</button>
                    </div>

                    {/* Active Deployments Tabs */}
                    <div className="flex gap-2">
                        {DEPLOYMENTS.map(dep => (
                            <button
                                key={dep.id}
                                onClick={() => setActiveDep(dep)}
                                className={`px-3 py-1 text-xs font-bold rounded transition-all border flex items-center gap-2 ${activeDep.id === dep.id
                                        ? "bg-slate-700 text-white border-slate-600 shadow-sm"
                                        : "bg-slate-800 text-slate-400 border-transparent hover:text-white"
                                    }`}
                            >
                                <span className={`w-2 h-2 rounded-full ${activeDep.id === dep.id ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`}></span>
                                {dep.id}
                            </button>
                        ))}
                        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white h-7 ml-1"><Plus className="w-3 h-3 mr-1" /> New Deploy</Button>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"><Printer className="w-4 h-4 mr-2" /> Reports</Button>
                    <Button variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"><Settings className="w-4 h-4 mr-2" /> Workspace</Button>
                </div>
            </header>

            {/* MAIN 3-COLUMN LAYOUT */}
            <div className="flex-1 flex min-h-0 p-3 gap-3 overflow-hidden">

                {/* ======== COL 1: OPERATIONS (Diver/ROV + Video) ======== */}
                <div className="w-[320px] flex flex-col gap-3 shrink-0 overflow-hidden">

                    {/* 1. Diver / ROV Log */}
                    <Card className="flex flex-col border-slate-200 shadow-sm rounded-md shrink-0">
                        <div className="bg-slate-800 text-white px-3 py-2 text-xs font-bold uppercase tracking-widest flex justify-between items-center rounded-t-md">
                            <span>{inspMethod === "DIVING" ? "1. Diver Log" : "1. ROV Log"}</span>
                            <div className="flex items-center gap-1">
                                <button className="p-1 hover:bg-slate-600 rounded" title="Edit Events"><Edit className="w-3.5 h-3.5" /></button>
                                <button className="p-1 hover:bg-slate-600 rounded" title="Settings"><Settings className="w-3.5 h-3.5" /></button>
                            </div>
                        </div>
                        <div className="p-3 bg-white space-y-3 rounded-b-md">
                            <div className="flex justify-between text-xs">
                                <div><span className="text-slate-400 font-bold block">ACTIVE SELECTION</span><span className="font-mono font-bold text-slate-800">{activeDep.id}</span></div>
                                <div className="text-right"><span className="text-slate-400 font-bold block">TIME IN WATER</span><span className="font-mono font-bold text-blue-600">00:29:31</span></div>
                            </div>

                            {/* Movement Control */}
                            <div className="bg-slate-50 border border-slate-100 rounded p-2 text-center relative">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Current Movement</span>
                                <span className="font-black text-slate-800 text-sm">{MOVEMENTS[movIdx]}</span>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={handleMovementPrev} disabled={movIdx === 0} variant="outline" className="flex-1 h-8 text-xs font-bold"><ArrowLeft className="w-3 h-3 mr-1" /> Rollback</Button>
                                <Button onClick={handleMovementNext} disabled={movIdx === MOVEMENTS.length - 1} className="flex-1 h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white">Next <ArrowRight className="w-3 h-3 ml-1" /></Button>
                            </div>
                        </div>
                    </Card>

                    {/* 9. ROV Data String (If ROV) */}
                    {inspMethod === "ROV" && (
                        <Card className="flex flex-col border-slate-200 shadow-sm rounded-md shrink-0">
                            <div className="bg-slate-800 text-white px-3 py-2 text-xs font-bold uppercase tracking-widest flex justify-between items-center rounded-t-md">
                                <span>ROV Data String</span>
                                <div className="flex items-center gap-2">
                                    <Wifi className="w-3 h-3 text-green-400" />
                                    <button className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded ml-1" title="String Settings"><Settings className="w-3 h-3" /></button>
                                </div>
                            </div>
                            <div className="p-3 bg-white space-y-2 rounded-b-md h-20 flex flex-col justify-center items-center">
                                <span className="font-mono text-xs font-bold text-slate-600 border border-slate-200 bg-slate-50 p-2 w-full text-center rounded">CP: 0.98V | DPT: 12.4m</span>
                            </div>
                        </Card>
                    )}

                    {/* 6. Small Video Stream Area */}
                    <Card className="flex flex-col border-slate-200 shadow-sm rounded-md shrink-0 bg-black overflow-hidden relative" style={{ height: videoVisible ? '240px' : '44px' }}>
                        <div className="absolute top-0 w-full bg-gradient-to-b from-black/80 to-transparent p-2 flex justify-between items-center z-10 transition-all">
                            <span className="text-[10px] text-white font-bold uppercase tracking-widest flex items-center gap-1">
                                <Video className="w-3 h-3 text-red-500" /> Stream Control
                            </span>
                            <div className="flex gap-1 items-center">
                                <button className="text-white/70 hover:text-white p-1" title="Stream Settings"><Settings className="w-3.5 h-3.5" /></button>
                                <button onClick={() => setVideoVisible(!videoVisible)} className="text-white/70 hover:text-white p-1 ml-1">{videoVisible ? <ChevronDown className="w-4 h-4" /> : <Activity className="w-4 h-4" />}</button>
                            </div>
                        </div>

                        {videoVisible && (
                            <>
                                {/* Conditional Stream Box */}
                                <div className="flex-1 relative bg-slate-900 border-b border-white/5 mt-8 flex items-center justify-center">
                                    {streamActive ? (
                                        <>
                                            <img src="https://images.unsplash.com/photo-1682687982204-f1a77dcc3067?q=80&w=2670&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover opacity-80" alt="stream" />
                                            <div className="absolute bottom-2 left-2 font-mono text-cyan-400 text-[10px] font-bold blur-[0.2px] drop-shadow-md z-10">DPT: {selectedComp?.depth || '-0.0m'} | T: 24C</div>
                                        </>
                                    ) : (
                                        <div className="text-center text-slate-500">
                                            <VideoOff className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                            <span className="text-[10px] uppercase font-bold tracking-widest">Stream Stopped</span>
                                        </div>
                                    )}
                                </div>

                                {/* 6. Video Controls (Small) */}
                                <div className="w-full bg-black/80 flex flex-col pt-1 pb-2 border-t border-white/10 shrink-0">
                                    {/* Stream On/Off Tools */}
                                    <div className="flex justify-between items-center px-2 py-1 mb-1">
                                        <span className="text-[9px] font-bold uppercase text-slate-400 w-16">Stream:</span>
                                        <div className="flex gap-1">
                                            <Button onClick={() => setStreamActive(true)} size="sm" variant={streamActive ? "default" : "secondary"} className={`h-6 text-[10px] px-3 font-bold ${streamActive ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>Show</Button>
                                            <Button onClick={() => setStreamActive(false)} size="sm" variant={!streamActive ? "default" : "secondary"} className={`h-6 text-[10px] px-3 font-bold ${!streamActive ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>Stop</Button>
                                        </div>
                                    </div>

                                    {/* Recording Tools */}
                                    <div className="flex justify-between items-center px-2">
                                        <div className="flex gap-1">
                                            {vidState !== 'IDLE' && <button onClick={() => setVidState('IDLE')} className="w-7 h-7 bg-slate-700 rounded text-white flex items-center justify-center hover:bg-slate-600 transition"><Square className="w-3.5 h-3.5 fill-current" /></button>}
                                            <button onClick={() => setVidState(vidState === 'RECORDING' ? 'PAUSED' : 'RECORDING')} className={`w-14 h-7 rounded text-xs font-bold flex items-center justify-center shadow transition-all ${vidState === 'RECORDING' ? 'bg-amber-500 hover:bg-amber-400 text-amber-950' : 'bg-red-600 hover:bg-red-500 text-white'}`}>
                                                {vidState === 'RECORDING' ? <Pause className="w-3 h-3 fill-current mr-1" /> : <Play className="w-3 h-3 mr-0.5 fill-current" />} Rec
                                            </button>
                                        </div>
                                        <span className="font-mono text-white text-[11px] font-bold">{formatTime(vidTimer)}</span>
                                        <button className="w-7 h-7 bg-white/10 rounded text-white flex items-center justify-center hover:bg-white/30 transition" title="Grab Photo"><Camera className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>
                            </>
                        )}
                    </Card>

                    {/* 2. Video Log Session */}
                    <Card className="flex flex-col flex-1 border-slate-200 shadow-sm rounded-md overflow-hidden bg-white">
                        <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-700 flex justify-between items-center shrink-0">
                            <span>2. Video Session Record</span>
                            <button className="p-1 hover:bg-slate-300 rounded text-slate-500 transition-colors" title="Video Session Settings"><Settings className="w-3.5 h-3.5" /></button>
                        </div>
                        <div className="p-2 space-y-2 shrink-0 border-b border-slate-100">
                            <div className="flex gap-2">
                                <div className="bg-slate-50 border border-slate-100 rounded p-1.5 flex-1">
                                    <span className="text-[9px] uppercase font-bold text-slate-400 block pb-0.5">Tape No.</span>
                                    <Input defaultValue="VDO-03-2026-02" className="h-6 text-xs font-mono px-2" />
                                </div>
                                <div className="bg-slate-50 border border-slate-100 rounded p-1.5 w-16 shrink-0">
                                    <span className="text-[9px] uppercase font-bold text-slate-400 block pb-0.5">Chap.</span>
                                    <Input type="number" value={activeChapter} onChange={(e: any) => setActiveChapter(e.target.value)} className="h-6 text-xs font-mono px-2" />
                                </div>
                            </div>

                            {/* Event Logging Dashboard */}
                            <div className="bg-slate-800 text-white rounded p-1.5 shadow-inner flex flex-col gap-1.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] font-bold uppercase text-slate-400 ml-1">Auto Counter</span>
                                    <span className="font-mono text-sm font-black text-cyan-400 tracking-wider bg-black/30 px-2 py-0.5 rounded">{formatTime(vidTimer)}</span>
                                </div>
                                <div className="grid grid-cols-4 gap-1">
                                    <button onClick={() => handleLogEvent("Start Tape")} className="bg-green-600 hover:bg-green-500 text-white rounded py-1.5 text-[9px] font-bold uppercase shadow-sm">Start</button>
                                    <button onClick={() => handleLogEvent("Pause")} className="bg-amber-500 hover:bg-amber-400 text-amber-950 rounded py-1.5 text-[9px] font-bold uppercase shadow-sm">Pause</button>
                                    <button onClick={() => handleLogEvent("Resume")} className="bg-blue-600 hover:bg-blue-500 text-white rounded py-1.5 text-[9px] font-bold uppercase shadow-sm">Resume</button>
                                    <button onClick={() => handleLogEvent("Stop Tape")} className="bg-red-600 hover:bg-red-500 text-white rounded py-1.5 text-[9px] font-bold uppercase shadow-sm">Stop</button>
                                </div>
                            </div>
                        </div>

                        <div className="px-2 py-1.5 text-[10px] font-bold uppercase text-slate-500 tracking-widest border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                            <span>Transport Events</span>
                            <Badge className="h-4 text-[9px] px-1 bg-slate-200 text-slate-600 rounded">{videoEvents.length}</Badge>
                        </div>
                        <ScrollArea className="flex-1 p-1">
                            <div className="space-y-1">
                                {videoEvents.map((ev: any) => (
                                    <div key={ev.id} className="flex justify-between items-center text-[10px] px-2 py-1.5 bg-white border border-slate-100 rounded hover:border-blue-200 group transition-all">
                                        <div className="flex gap-2 items-center">
                                            <span className="font-mono text-slate-500 bg-slate-50 px-1 py-0.5 rounded border border-slate-200">{ev.time}</span>
                                            <span className={`font-bold ${ev.action === 'Start Tape' || ev.action === 'Resume' ? 'text-green-600' : ev.action === 'Pause' ? 'text-amber-600' : ev.action === 'Stop Tape' ? 'text-red-600' : 'text-blue-600'}`}>{ev.action}</span>
                                        </div>
                                        <div className="flex gap-0.5 opacity-20 group-hover:opacity-100 transition-opacity">
                                            <button className="p-1 hover:bg-slate-100 rounded text-slate-600" title="Modify Event"><Edit className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => handleDeleteEvent(ev.id)} className="p-1 hover:bg-red-50 rounded text-red-500" title="Delete Event"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </Card>

                </div>

                {/* ======== COL 2: TARGET & RECORDS (Components & Tables) ======== */}
                <div className="flex-1 flex flex-col gap-3 min-w-[320px] max-w-[500px] shrink-0 overflow-hidden">

                    {/* 3. Component Target Selection (Tabbed with 3D Viewer) */}
                    <Card className="flex flex-col flex-1 max-h-[460px] border-slate-200 shadow-sm rounded-md shrink-0 bg-white overflow-hidden">

                        {/* Component/3D Header Tabs */}
                        <div className="bg-slate-800 text-white flex items-center justify-between pl-1 pr-3 shrink-0">
                            <div className="flex">
                                <button onClick={() => setCompView("LIST")} className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${compView === 'LIST' ? 'bg-blue-600 text-white border-b border-blue-600' : 'text-slate-400 hover:text-white border-b border-transparent'}`}>3. Component Target</button>
                                <button onClick={() => setCompView("MODEL_3D")} className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${compView === 'MODEL_3D' ? 'bg-blue-600 text-white border-b border-blue-600' : 'text-slate-400 hover:text-white border-b border-transparent'}`}><Box className="w-3.5 h-3.5 mb-0.5" /> 3D Structure</button>
                            </div>
                            {compView === "LIST" && <Search className="w-3.5 h-3.5 text-slate-400" />}
                        </div>

                        {compView === "LIST" && (
                            <div className="flex flex-col flex-1 overflow-hidden min-h-0">
                                <div className="p-2 border-b border-slate-100 shrink-0">
                                    <Input placeholder="Search component..." className="h-8 text-xs bg-slate-50" />
                                </div>
                                <ScrollArea className="flex-1 p-2">
                                    <div className="space-y-4">
                                        <div>
                                            <div className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-1 rounded tracking-widest mb-1.5 border border-blue-100">SOW Assigned</div>
                                            <div className="space-y-1">
                                                {COMPONENTS_SOW.map(c => (
                                                    <button key={c.id} onClick={() => { setSelectedComp(c); setActiveSpec(null); }} className={`w-full text-left p-2.5 rounded text-xs transition-all border ${selectedComp?.id === c.id ? 'bg-blue-600 text-white border-blue-700 shadow-md' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                                                        <div className="flex justify-between font-bold"><span>{c.name}</span><span className="font-mono opacity-75">{c.depth}</span></div>
                                                        <div className="text-[10px] mt-1 opacity-85 font-medium flex gap-1"><ListTodo className="w-3 h-3" /> Tasks: {c.tasks.join(', ')}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-1 rounded tracking-widest mb-1.5 mt-2 border border-slate-200">Not Assigned SOW</div>
                                            <div className="space-y-1">
                                                {COMPONENTS_NON_SOW.map(c => (
                                                    <button key={c.id} onClick={() => { setSelectedComp(c); setActiveSpec(null); }} className={`w-full text-left p-2.5 rounded text-xs transition-all border ${selectedComp?.id === c.id ? 'bg-slate-700 text-white border-slate-800 shadow-md' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                                                        <div className="flex justify-between font-bold"><span>{c.name}</span><span className="font-mono opacity-75">{c.depth}</span></div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </ScrollArea>
                            </div>
                        )}

                        {compView === "MODEL_3D" && (
                            <div className="flex-1 bg-slate-900 flex flex-col items-center justify-center p-6 text-center border-dashed border-2 border-slate-800 m-2 rounded-lg relative overflow-hidden">
                                <Layers className="w-16 h-16 mb-4 text-slate-700/50" />
                                <span className="text-sm font-bold uppercase tracking-widest text-slate-400">3D Structure Viewer<br />(Provision Space)</span>
                                <p className="text-xs text-slate-600 mt-2 max-w-[200px]">Interactive CAD/3D model integration will stream here for direct node selection.</p>
                                {selectedComp && <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[10px] font-bold bg-blue-600 text-white px-2 py-1 rounded shadow-lg border border-blue-500"><CheckCircle2 className="w-3 h-3" /> Locked: {selectedComp.name}</div>}
                            </div>
                        )}
                    </Card>

                    {/* 7. Short Inspection Record Table */}
                    <Card className="flex flex-col flex-1 border-slate-200 shadow-sm rounded-md bg-white overflow-hidden min-h-0">
                        <div className="bg-slate-800 text-white px-3 py-2 text-[11px] font-bold uppercase tracking-widest flex justify-between items-center">
                            <span>7. Session Records</span>
                            <Badge className="bg-blue-600 text-white border-none text-[9px] h-4 leading-none font-bold uppercase tracking-wider">{CURRENT_RECORDS.length} Captured</Badge>
                        </div>
                        <ScrollArea className="flex-1 w-full relative">
                            <table className="w-full text-left text-[11px] whitespace-nowrap">
                                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-3 py-2">Task</th>
                                        <th className="px-3 py-2">Status</th>
                                        <th className="px-3 py-2">Video Sync</th>
                                        <th className="px-3 py-2 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {CURRENT_RECORDS.map(r => (
                                        <tr key={r.id} className="hover:bg-slate-50">
                                            <td className="px-3 py-2 font-bold text-slate-800">{r.type}</td>
                                            <td className="px-3 py-2">
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${r.status === 'Pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.status}</span>
                                            </td>
                                            <td className="px-3 py-2 font-mono text-slate-500 flex items-center gap-1"><Video className="w-3 h-3 text-blue-500" /> {r.timer}</td>
                                            <td className="px-3 py-2 text-right">
                                                <button className="p-1 hover:bg-slate-200 rounded text-slate-600" title="Edit Record"><Edit className="w-3.5 h-3.5" /></button>
                                                <button className="p-1 hover:bg-red-100 rounded text-red-500 ml-1" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </ScrollArea>
                    </Card>

                </div>

                {/* ======== COL 3: INSPECTION FORM & HISTORY (Right Flex) ======== */}
                <div className="flex-1 flex flex-col gap-3 h-full overflow-hidden bg-white border border-slate-200 rounded-md shadow-sm relative">

                    {!selectedComp ? (
                        <div className="flex-1 flex items-center justify-center flex-col text-slate-400 p-10 text-center">
                            <Activity className="w-12 h-12 mb-4 opacity-30 text-blue-500" />
                            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2">Awaiting Target Selection</h2>
                            <p className="text-xs max-w-[280px]">Please select a component from the middle column (List or 3D view) to review history and begin logging inspection scopes.</p>
                        </div>
                    ) : (
                        <>
                            {/* 4. Historical Data & Overview */}
                            <div className="p-4 border-b border-slate-200 bg-slate-50/50 shrink-0">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{selectedComp.name}</h2>
                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-mono font-bold">{selectedComp.depth}</Badge>
                                    </div>
                                    <Badge variant="outline" className="bg-white"><History className="w-3 h-3 mr-1" /> History</Badge>
                                </div>

                                <div className="bg-white border text-blue-900 border-blue-100 p-3 rounded-lg shadow-sm">
                                    <div className="text-[10px] font-black uppercase text-blue-500 tracking-widest border-b border-blue-50 pb-2 mb-2">Historical Records Overview</div>
                                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                                        {HISTORICAL_DATA.map((h, i) => (
                                            <div key={i} className="flex items-center gap-3 text-[11px] hover:bg-slate-50 p-1.5 rounded transition">
                                                <span className="font-mono font-bold text-slate-400 w-10 shrink-0">{h.year}</span>
                                                <span className="font-bold w-12 shrink-0">{h.type}</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${h.status === 'Pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{h.status}</span>
                                                <span className="text-slate-600 truncate flex-1">{h.finding}</span>
                                                <ChevronDown className="w-3 h-3 text-slate-300 shrink-0 -rotate-90" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* 5. Inspection Task Form Handling */}
                            <div className="flex-1 flex flex-col min-h-0 relative">
                                {!activeSpec ? (
                                    <div className="p-5 flex flex-col items-center justify-center text-center h-full">
                                        <div className="w-full max-w-[300px]">
                                            <div className="text-[11px] font-bold uppercase text-slate-400 tracking-widest mb-4">Select Scope to Inspect</div>
                                            <div className="space-y-3">
                                                {selectedComp.tasks && selectedComp.tasks.map((t: string) => (
                                                    <Button key={t} onClick={() => setActiveSpec(t)} className="w-full h-12 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 font-bold shadow-sm flex justify-between">
                                                        <span>Start {t}</span> <ArrowRight className="w-4 h-4 text-blue-300" />
                                                    </Button>
                                                ))}
                                                <div className="py-2"><Separator /></div>
                                                <Button onClick={() => setActiveSpec("General")} variant="outline" className="w-full h-12 font-bold border-slate-200 text-slate-600">
                                                    Log General Finding
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    // 10. Dynamic Form (In-page inline, collapsible)
                                    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-[5%] bg-white shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-10">
                                        <div className="p-3 bg-blue-600 text-white flex justify-between items-center shrink-0 shadow-sm border-b border-blue-700">
                                            <span className="font-black tracking-wide text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-blue-200" /> Recording Spec: {activeSpec}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="font-mono text-xs font-bold bg-black/20 px-2 py-1 rounded border border-white/10 flex items-center gap-1.5"><Video className="w-3 h-3 text-blue-200" /> {formatTime(vidTimer)}</span>
                                                <button onClick={() => setActiveSpec(null)} className="p-1.5 hover:bg-white/10 bg-black/10 rounded transition text-blue-100 hover:text-white" title="Cancel/Close"><X className="w-4 h-4" /></button>
                                            </div>
                                        </div>

                                        <ScrollArea className="flex-1 p-5">
                                            <div className="space-y-5 max-w-2xl mx-auto">

                                                <div className="grid grid-cols-2 gap-5">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><MapPin className="w-3 h-3" /> Verification Depth</label>
                                                        <Input defaultValue={selectedComp.depth} className="h-10 text-sm font-bold bg-slate-50 focus-visible:ring-blue-500" />
                                                    </div>
                                                </div>

                                                {/* 10. Different Spec Forms (e.g. CP/UT Calibration) */}
                                                {(activeSpec === 'CP' || activeSpec === 'UT') && (
                                                    <div className="p-4 border-2 border-slate-200 bg-slate-50/50 rounded-lg space-y-3">
                                                        <div className="text-[10px] font-black uppercase text-slate-800 tracking-widest border-b border-slate-200 pb-2">Calibration Registration</div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-1"><label className="text-[10px] uppercase font-bold text-slate-500">Reading Value</label><Input placeholder="0.00 V" className="h-9 text-sm font-mono bg-white" /></div>
                                                            <div className="space-y-1"><label className="text-[10px] uppercase font-bold text-slate-500">Ref. Cell Used</label><Input placeholder="Ag/AgCl" className="h-9 text-sm bg-white" /></div>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="space-y-3 p-4 border-2 border-slate-200 rounded-lg bg-white shadow-sm">
                                                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest block border-b border-slate-100 pb-2">Inspection Result</label>
                                                    <div className="flex gap-3">
                                                        <Button variant={findingType === 'Pass' ? 'default' : 'outline'} onClick={() => setFindingType('Pass')} className={`flex-1 h-12 font-bold text-sm transition-all ${findingType === 'Pass' ? 'bg-green-600 hover:bg-green-700 text-white shadow-md' : 'text-slate-600 border-slate-300'}`}><CheckCircle2 className="w-5 h-5 mr-1.5" /> Acceptable / Pass</Button>
                                                        <Button variant={findingType === 'Anomaly' ? 'default' : 'outline'} onClick={() => setFindingType('Anomaly')} className={`flex-1 h-12 font-bold text-sm transition-all ${findingType === 'Anomaly' ? 'bg-red-600 hover:bg-red-700 text-white shadow-md' : 'text-slate-600 border-slate-300'}`}><AlertCircle className="w-5 h-5 mr-1.5" /> Register Anomaly</Button>
                                                    </div>

                                                    {findingType === 'Anomaly' && (
                                                        <div className="pt-3 grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                                            <div className="space-y-1.5">
                                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Anomaly Profile</label>
                                                                <select className="flex h-10 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-1 text-sm font-semibold focus:ring-blue-500"><option>Pitting/Corrosion</option><option>Marine Growth Cover</option><option>Structural Defect</option></select>
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Severity Factor</label>
                                                                <select className="flex h-10 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-1 text-sm font-semibold focus:ring-blue-500"><option>Minor (Monitoring)</option><option>Major (Action Needed)</option></select>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><FileText className="w-3 h-3" /> Detailed Field Notes</label>
                                                    <textarea placeholder="Observation specifics, dimensions, characteristics..." className="w-full min-h-[100px] rounded-lg border border-slate-300 p-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none bg-slate-50/50"></textarea>
                                                </div>

                                                {/* Linking Photo Option */}
                                                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50 transition-colors hover:bg-slate-100">
                                                    <input type="checkbox" id="linkPhoto" checked={photoLinked} onChange={(e) => setPhotoLinked(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer focus:ring-blue-500" />
                                                    <label htmlFor="linkPhoto" className="text-sm font-bold text-slate-700 cursor-pointer flex-1 flex items-center gap-1.5"><Camera className="w-4 h-4 text-slate-400" /> Attach Last Captured Frame</label>
                                                </div>

                                                <div className="pt-2 pb-6">
                                                    <Button className="w-full h-14 font-black shadow-lg bg-blue-600 hover:bg-blue-700 text-white text-base tracking-wide rounded-xl">
                                                        <Save className="w-5 h-5 mr-2" /> Commit Record & Reset
                                                    </Button>
                                                </div>
                                            </div>
                                        </ScrollArea>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

            </div>
        </div>
    );
}
