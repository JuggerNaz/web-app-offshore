"use client";

import React from "react";
import { 
    Search, 
    Box, 
    Layers, 
    History, 
    Info,
    PlusCircle,
    Loader2
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RegisterComponentDialog } from "./RegisterComponentDialog";

interface WorkspaceResourcesProps {
    compView: "LIST" | "MODEL_3D";
    setCompView: (view: "LIST" | "MODEL_3D") => void;
    compSearchTerm: string;
    setCompSearchTerm: (term: string) => void;
    componentsSow: any[];
    componentsNonSow: any[];
    selectedComp: any;
    handleComponentSelection: (comp: any) => void;
    handleTaskChange?: (code: string) => void;
    setCompSpecDialogOpen: (val: boolean) => void;
    currentRecords: any[];
    currentCompRecords: any[];
    historicalRecords: any[];
    historyLoading: boolean;
    inspMethod: "DIVING" | "ROV";
    supabase: any;
    structureId: string | number;
    onRefreshComponents: () => void;
    allInspectionTypes: any[];
    structureType: "platform" | "pipeline";
    unitSystem: "METRIC" | "IMPERIAL";
    setShowTaskSelector?: (val: boolean) => void;
}

type SortKey = 'name' | 'depth' | 'startElev';
type SortDir = 'asc' | 'desc';

export function WorkspaceResources(props: WorkspaceResourcesProps) {
    const {
        compView, setCompView, compSearchTerm, setCompSearchTerm,
        componentsSow, componentsNonSow, selectedComp,
        handleComponentSelection, handleTaskChange, setShowTaskSelector, setCompSpecDialogOpen,
        currentRecords, currentCompRecords, historicalRecords,
        historyLoading,
        inspMethod, supabase, structureId, onRefreshComponents,
        allInspectionTypes, structureType, unitSystem
    } = props;

    const [isRegisterOpen, setIsRegisterOpen] = React.useState(false);
    const [sortKey, setSortKey] = React.useState<SortKey>('name');
    const [sortDir, setSortDir] = React.useState<SortDir>('asc');

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const sortFn = (a: any, b: any) => {
        let valA = a[sortKey];
        let valB = b[sortKey];

        if (sortKey === 'depth' || sortKey === 'startElev') {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
        } else {
            valA = String(valA || '').toLowerCase();
            valB = String(valB || '').toLowerCase();
        }

        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
    };

    return (
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        <Card className="flex flex-col border-2 border-slate-200 dark:border-slate-500 shadow-xl rounded-md bg-white dark:bg-slate-900/60 backdrop-blur-md overflow-hidden h-[300px]">
                <div className="bg-slate-800 dark:bg-slate-900 text-white flex items-center justify-between pl-1 pr-3 shrink-0">
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
                        <div className="p-2 border-b border-slate-100 dark:border-slate-800 shrink-0 flex gap-2">
                            <Input 
                                placeholder="Search component..." 
                                className="h-8 text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex-1 dark:text-slate-200" 
                                value={compSearchTerm} 
                                onChange={(e: any) => setCompSearchTerm(e.target.value)} 
                            />
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 px-2 border-dashed border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 gap-1.5"
                                onClick={() => setIsRegisterOpen(true)}
                                title="Register New Component"
                            >
                                <PlusCircle className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-black uppercase">Reg</span>
                            </Button>
                        </div>
                        <ScrollArea className="flex-1 p-2">
                            <div className="space-y-4">
                                <div>
                                    <div className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-900/20 px-2 py-1 rounded border border-blue-100 dark:border-blue-800/30 mb-1.5">
                                        <div className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-300 tracking-widest">SOW Scope</div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => toggleSort('name')}
                                                className={`text-[8px] font-black uppercase tracking-tighter flex items-center gap-0.5 px-1.5 py-0.5 rounded transition-colors ${sortKey === 'name' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-400 dark:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/40'}`}
                                            >
                                                QID {sortKey === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                                            </button>
                                            <button 
                                                onClick={() => toggleSort('startElev')}
                                                className={`text-[8px] font-black uppercase tracking-tighter flex items-center gap-0.5 px-1.5 py-0.5 rounded transition-colors ${sortKey === 'startElev' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-400 dark:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/40'}`}
                                            >
                                                Elev {sortKey === 'startElev' && (sortDir === 'asc' ? '↑' : '↓')}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        {componentsSow.filter((c: any) => {
                                            let tasksToFilter = c.taskStatuses?.map((ts: any) => ts.code) || c.tasks || [];
                                            const hasValidTask = tasksToFilter.some((tCode: string) => {
                                                const it = (allInspectionTypes || []).find((type: any) => type.code === tCode || type.name === tCode);
                                                if (!it) return true;
                                                const isRov = it.metadata?.rov === 1 || it.metadata?.rov === "1" || it.metadata?.rov === true || (it.metadata?.job_type && it.metadata.job_type.includes("ROV"));
                                                const isDiving = it.metadata?.diving === 1 || it.metadata?.diving === "1" || it.metadata?.diving === true || (it.metadata?.job_type && it.metadata.job_type.includes("DIVING"));
                                                if (inspMethod === "DIVING" && isDiving) return true;
                                                if (inspMethod === "ROV" && isRov) return true;
                                                return false;
                                            });
                                            if (!hasValidTask) return false;

                                            const term = compSearchTerm.toLowerCase().trim();
                                            if (!term) return true;
                                            
                                            const qid = (c.name || '').toLowerCase();
                                            const code = (c.raw?.code || '').toLowerCase();
                                            const legStr = `${c.startLeg || ''} ${c.endLeg || ''}`.toLowerCase();
                                            const elevStr = `${c.startElev || ''} ${c.endElev || ''}`.toLowerCase();
                                            const nodeStr = `${c.startNode || ''} ${c.endNode || ''}`.toLowerCase();
                                            
                                            return qid.includes(term) || code.includes(term) || legStr.includes(term) || elevStr.includes(term) || nodeStr.includes(term);
                                        }).sort(sortFn).map((c: any) => {
                                            const isSelected = selectedComp?.id === c.id;
                                            return (
                                            <button key={c.id} onClick={() => { handleComponentSelection(c); }} className={`w-full text-left p-2 rounded text-xs transition-all border ${isSelected ? 'bg-blue-600 text-white border-blue-700 shadow-md' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-100'}`}>
                                                    <div className="flex justify-between font-bold">
                                                        <div className="flex items-center gap-2">
                                                            <span className="flex-1 truncate">{c.name}</span>
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
                                                    {(c.startNode !== '-' || c.endNode !== '-') && (
                                                        <div className={`text-[9px] font-mono mt-0.5 ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>{c.startNode} → {c.endNode}</div>
                                                    )}
                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                        {(c.taskStatuses || []).map((ts: any, idx: number) => {
                                                            const s = ts.status || 'pending';
                                                            const hasAnom = currentRecords.some((r: any) => r.has_anomaly && (r.inspection_type?.code === ts.code || r.inspection_type_code === ts.code) && r.component_id === c.id);
                                                            return (
                                                                <span 
                                                                    key={idx} 
                                                                    onClick={(e) => { 
                                                                        e.stopPropagation(); 
                                                                        if (handleTaskChange) handleTaskChange(ts.code); 
                                                                    }}
                                                                    className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full cursor-pointer hover:scale-105 active:scale-95 transition-all ${isSelected ? 'bg-white/20 text-blue-100 hover:bg-white/30' : 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700'}`}
                                                                >
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${hasAnom ? 'bg-red-500' : s === 'completed' ? 'bg-green-500' : 'bg-slate-400'}`} />
                                                                    {ts.code}
                                                                </span>
                                                            );
                                                        })}
                                                        <span 
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                handleComponentSelection(c);
                                                                setCompSpecDialogOpen(false); 
                                                                setShowTaskSelector?.(true);
                                                            }}
                                                            className={`inline-flex items-center justify-center w-5 h-4 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors cursor-pointer text-[10px] font-bold border border-blue-500/20`}
                                                            title="Add Additional Inspection Type"
                                                        >
                                                            +
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded tracking-widest mb-1.5 mt-2 border border-slate-200 dark:border-slate-800">Non-SOW</div>
                                    <div className="space-y-1">
                                        {componentsNonSow.filter((c: any) => {
                                            const term = compSearchTerm.toLowerCase().trim();
                                            if (!term) return true;
                                            const qid = (c.name || '').toLowerCase();
                                            const code = (c.raw?.code || '').toLowerCase();
                                            return qid.includes(term) || code.includes(term);
                                        }).sort(sortFn).map((c: any) => (
                                            <button key={c.id} onClick={() => { handleComponentSelection(c); }} className={`w-full text-left p-2 rounded text-xs transition-all border ${selectedComp?.id === c.id ? 'bg-slate-700 dark:bg-slate-800 text-white border-slate-800 dark:border-slate-700 shadow-md' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'}`}>
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

            <Card className="flex flex-col flex-1 border-2 border-slate-200 dark:border-slate-500 shadow-xl rounded-md bg-white dark:bg-slate-900/60 backdrop-blur-md overflow-hidden min-h-0">
                <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 py-2 flex justify-between items-center shrink-0">
                    <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">HISTORY DATA</span>
                    <History className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                </div>
                <ScrollArea className="flex-1 p-3">
                    {historyLoading ? (
                        <div className="flex flex-col items-center justify-center p-12 gap-3 animate-in fade-in duration-500">
                            <div className="relative">
                                <div className="absolute inset-0 blur-md bg-blue-400/20 rounded-full animate-pulse" />
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600 relative" />
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Retrieving History</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Looking up past inspection data...</span>
                            </div>
                        </div>
                    ) : !selectedComp ? (
                        <div className="text-center text-slate-400 text-xs py-10">Select component to view history</div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                                    <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50/50 dark:bg-blue-900/20 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800/30">Current Workpack</span>
                                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                                </div>
                                <div className="space-y-2">
                                    {currentCompRecords.length === 0 ? (
                                        <div className="text-[10px] text-slate-400 dark:text-slate-500 p-3 text-center bg-slate-50/50 dark:bg-slate-900/30 rounded border border-dashed border-slate-200 dark:border-slate-800 italic font-medium">No records in current scope</div>
                                    ) : currentCompRecords.map((r, i) => (
                                        <div key={i} className="flex flex-col gap-1 p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 text-[11px] shadow-sm hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-slate-700 dark:text-slate-100">{r.type}</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${r.status === 'Complete' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>{r.status}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                                                <span>{inspMethod === 'DIVING' ? 'Dive' : 'Dep'}: {r.diveNo || 'N/A'}</span>
                                                <span>Tape: {r.tapeNo}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">Historical Data</span>
                                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                                </div>
                                <div className="space-y-2">
                                    {historicalRecords.length === 0 ? (
                                        <div className="text-[10px] text-slate-400 dark:text-slate-500 p-3 text-center bg-slate-50/50 dark:bg-slate-900/30 rounded border border-dashed border-slate-200 dark:border-slate-800 italic font-medium">No historical records found</div>
                                    ) : historicalRecords.map((r, i) => (
                                        <div key={i} className="flex flex-col gap-1 p-2 bg-slate-50/50 dark:bg-slate-900/20 rounded border border-slate-200 dark:border-slate-800 text-[11px] opacity-80 hover:opacity-100 transition-opacity">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-slate-600 dark:text-slate-300">{r.type} ({r.year})</span>
                                            </div>
                                            <div className="text-[8px] text-slate-400 dark:text-slate-500 mt-0.5 italic">"{r.finding}"</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </ScrollArea>
            </Card>

            <RegisterComponentDialog 
                open={isRegisterOpen}
                onOpenChange={setIsRegisterOpen}
                supabase={supabase}
                structureId={structureId}
                onSuccess={(newComp) => {
                    onRefreshComponents();
                    handleComponentSelection(newComp);
                }}
                structureType={structureType}
                unitSystem={unitSystem}
            />
        </div>
    );
}

