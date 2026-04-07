"use client";

import React from "react";
import { 
    Search, 
    Box, 
    Layers, 
    History, 
    Info 
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

interface WorkspaceResourcesProps {
    compView: "LIST" | "MODEL_3D";
    setCompView: (view: "LIST" | "MODEL_3D") => void;
    compSearchTerm: string;
    setCompSearchTerm: (term: string) => void;
    componentsSow: any[];
    componentsNonSow: any[];
    selectedComp: any;
    handleComponentSelection: (comp: any) => void;
    setCompSpecDialogOpen: (val: boolean) => void;
    currentRecords: any[];
    currentCompRecords: any[];
    historicalRecords: any[];
    inspMethod: "DIVING" | "ROV";
}

export function WorkspaceResources(props: WorkspaceResourcesProps) {
    const {
        compView, setCompView, compSearchTerm, setCompSearchTerm,
        componentsSow, componentsNonSow, selectedComp,
        handleComponentSelection, setCompSpecDialogOpen,
        currentRecords, currentCompRecords, historicalRecords,
        inspMethod
    } = props;

    return (
        <div className="w-[360px] flex flex-col gap-3 shrink-0 overflow-hidden">
            <Card className="flex flex-col h-[400px] border-slate-200 shadow-sm rounded-md shrink-0 bg-white overflow-hidden">
                <div className="bg-slate-800 text-white flex items-center justify-between pl-1 pr-3 shrink-0">
                    <div className="flex">
                        <button 
                            onClick={() => setCompView("LIST")} 
                            className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${compView === 'LIST' ? 'bg-blue-600 text-white border-b border-blue-600' : 'text-slate-400 hover:text-white border-b border-transparent'}`}
                        >
                            COMPONENT LIST
                        </button>
                        <button 
                            onClick={() => setCompView("MODEL_3D")} 
                            className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${compView === 'MODEL_3D' ? 'bg-blue-600 text-white border-b border-blue-600' : 'text-slate-400 hover:text-white border-b border-transparent'}`}
                        >
                            <Box className="w-3.5 h-3.5 mb-0.5" /> 3D
                        </button>
                    </div>
                    {compView === "LIST" && <Search className="w-3.5 h-3.5 text-slate-400" />}
                </div>

                {compView === "LIST" && (
                    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
                        <div className="p-2 border-b border-slate-100 shrink-0">
                            <Input 
                                placeholder="Search component..." 
                                className="h-8 text-xs bg-slate-50" 
                                value={compSearchTerm} 
                                onChange={(e: any) => setCompSearchTerm(e.target.value)} 
                            />
                        </div>
                        <ScrollArea className="flex-1 p-2">
                            <div className="space-y-4">
                                <div>
                                    <div className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-1 rounded tracking-widest mb-1.5 border border-blue-100">SOW Scope</div>
                                    <div className="space-y-1">
                                        {componentsSow.filter((c: any) => c.name?.toLowerCase().includes(compSearchTerm.toLowerCase())).map((c: any) => {
                                            const isSelected = selectedComp?.id === c.id;
                                            return (
                                                <button key={c.id} onClick={() => { handleComponentSelection(c); }} className={`w-full text-left p-2 rounded text-xs transition-all border ${isSelected ? 'bg-blue-600 text-white border-blue-700 shadow-md' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                                                    <div className="flex justify-between font-bold">
                                                        <div className="flex items-center gap-2">
                                                            <span>{c.name}</span>
                                                            <div
                                                                onClick={(e) => { e.stopPropagation(); handleComponentSelection(c); setCompSpecDialogOpen(true); }}
                                                                className={`p-1 rounded hover:bg-black/10 transition-colors ${isSelected ? 'text-blue-100' : 'text-slate-300 hover:text-blue-500'}`}
                                                                title="View Component Specs"
                                                            >
                                                                <Info className="w-3.5 h-3.5" />
                                                            </div>
                                                        </div>
                                                        <span className="font-mono opacity-75 text-[10px]">{c.depth}</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                        {c.taskStatuses?.map((ts: any, idx: number) => {
                                                            const s = ts.status || 'pending';
                                                            const hasAnom = currentRecords.some((r: any) => r.has_anomaly && r.inspection_type_code === ts.code && r.component_id === c.id);
                                                            return (
                                                                <span key={idx} className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-blue-100' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${hasAnom ? 'bg-red-500' : s === 'completed' ? 'bg-green-500' : 'bg-slate-400'}`} />
                                                                    {ts.code}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[9px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-1 rounded tracking-widest mb-1.5 mt-2 border border-slate-200">Non-SOW</div>
                                    <div className="space-y-1">
                                        {componentsNonSow.filter((c: any) => c.name?.toLowerCase().includes(compSearchTerm.toLowerCase())).map((c: any) => (
                                            <button key={c.id} onClick={() => { handleComponentSelection(c); }} className={`w-full text-left p-2 rounded text-xs transition-all border ${selectedComp?.id === c.id ? 'bg-slate-700 text-white border-slate-800 shadow-md' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                                                <div className="flex justify-between font-bold">
                                                    <span>{c.name}</span>
                                                    <span className="font-mono opacity-75 text-[10px]">{c.depth}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {compView === "MODEL_3D" && (
                    <div className="flex-1 bg-slate-900 flex flex-col items-center justify-center p-4 text-center border-dashed border-2 border-slate-800 m-2 rounded-lg relative overflow-hidden">
                        <Layers className="w-12 h-12 mb-3 text-slate-700/50" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">3D Viewer</span>
                    </div>
                )}
            </Card>

            <Card className="flex flex-col flex-1 border-slate-200 shadow-sm rounded-md bg-white overflow-hidden min-h-0">
                <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex justify-between items-center shrink-0">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">HISTORY DATA</span>
                    <History className="w-3 h-3 text-slate-400" />
                </div>
                <ScrollArea className="flex-1 p-3">
                    {!selectedComp ? (
                        <div className="text-center text-slate-400 text-xs py-10">Select component to view history</div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="h-px flex-1 bg-slate-100"></div>
                                    <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Current Workpack</span>
                                    <div className="h-px flex-1 bg-slate-100"></div>
                                </div>
                                <div className="space-y-2">
                                    {currentCompRecords.length === 0 ? (
                                        <div className="text-[10px] text-slate-400 p-3 text-center bg-slate-50/50 rounded border border-dashed border-slate-200 italic font-medium">No records in current scope</div>
                                    ) : currentCompRecords.map((r, i) => (
                                        <div key={i} className="flex flex-col gap-1 p-2 bg-white rounded border border-slate-100 text-[11px] shadow-sm hover:border-blue-200 transition-colors">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-slate-700">{r.type}</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${r.status === 'Pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.status}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                                                <span>{inspMethod === 'DIVING' ? 'Dive' : 'Dep'}: {r.diveNo || 'N/A'}</span>
                                                <span>Tape: {r.tapeNo}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="h-px flex-1 bg-slate-100"></div>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Historical Data</span>
                                    <div className="h-px flex-1 bg-slate-100"></div>
                                </div>
                                <div className="space-y-2">
                                    {historicalRecords.length === 0 ? (
                                        <div className="text-[10px] text-slate-400 p-3 text-center bg-slate-50/50 rounded border border-dashed border-slate-200 italic font-medium">No historical records found</div>
                                    ) : historicalRecords.map((r, i) => (
                                        <div key={i} className="flex flex-col gap-1 p-2 bg-slate-50/50 rounded border border-slate-100 text-[11px] opacity-80 hover:opacity-100 transition-opacity">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-slate-600">{r.type} ({r.year})</span>
                                            </div>
                                            <div className="text-[8px] text-slate-400 mt-0.5 italic">"{r.finding}"</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </ScrollArea>
            </Card>
        </div>
    );
}
