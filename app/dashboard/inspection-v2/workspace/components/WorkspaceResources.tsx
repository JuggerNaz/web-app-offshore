import React from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { toast } from "sonner";
import { 
    Search, 
    Box, 
    Layers, 
    History, 
    Info,
    PlusCircle,
    Loader2,
    X,
    Play,
    Plus,
    Ruler,
    CheckCircle2,
    AlertCircle
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RegisterComponentDialog } from "./RegisterComponentDialog";

function getComponentNodeLegDetails(comp: any) {
    if (!comp) return { sNode: null, fNode: null, legNo: null, depth: null };
    const md = comp?.metadata || {};
    const qId = String(comp?.q_id || comp?.id_no || comp?.name || "").toUpperCase();

    let sNode = md.s_node || md.start_node || comp?.s_node;
    let fNode = md.f_node || md.end_node || comp?.f_node;

    if (!sNode || !fNode) {
        const nodeMatch = qId.match(/N?(\d{3,5})[\-_/]+N?(\d{3,5})/i);
        if (nodeMatch) {
            sNode = sNode || `N${nodeMatch[1]}`;
            fNode = fNode || `N${nodeMatch[2]}`;
        }
    }

    let legNo = md.leg_no || md.leg || md.leg_name || comp?.leg_no || comp?.leg;
    if (!legNo) {
        const legMatch = qId.match(/(?:LEG|L)[-_ ]*([A-Z0-9]+)/i) || qId.match(/\b([A-D][1-4])\b/);
        if (legMatch) {
            legNo = legMatch[1];
        }
    }

    const depth = md.depth || md.elevation || md.startElev || comp?.depth || comp?.elevation;

    return {
        sNode: sNode ? String(sNode) : null,
        fNode: fNode ? String(fNode) : null,
        legNo: legNo ? String(legNo) : null,
        depth: depth ? String(depth) : null,
    };
}

const Structural3DViewer = dynamic(
    () => import("@/app/dashboard/utilities/platform-3d/_components/Structural3DViewer").then((mod) => mod.Structural3DViewer),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 p-6 text-center border border-slate-800 rounded-lg min-h-[300px]">
                <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin mb-3" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Loading 3D Platform Engine...</span>
                <span className="text-[9px] text-slate-500 uppercase mt-1 tracking-wider">Building WebGL structural meshes</span>
            </div>
        )
    }
);

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
    handleEditRecord?: (rec: any) => void;
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
    isFormDirty?: boolean;
    handleCommitRecord?: () => void;
    resetForm?: () => void;
    onDirectSelectTask?: (comp: any, taskCode: string) => void;
}

type SortKey = 'name' | 'depth' | 'startElev';
type SortDir = 'asc' | 'desc';

export function WorkspaceResources(props: WorkspaceResourcesProps) {
    const {
        compView, setCompView, compSearchTerm, setCompSearchTerm,
        componentsSow, componentsNonSow, selectedComp,
        handleComponentSelection, handleTaskChange, handleEditRecord, setShowTaskSelector, setCompSpecDialogOpen,
        currentRecords, currentCompRecords, historicalRecords,
        historyLoading,
        inspMethod, supabase, structureId, onRefreshComponents,
        allInspectionTypes, structureType, unitSystem,
        isFormDirty, handleCommitRecord, resetForm, onDirectSelectTask
    } = props;

    const [isRegisterOpen, setIsRegisterOpen] = React.useState(false);
    const [sortKey, setSortKey] = React.useState<SortKey>('name');
    const [sortDir, setSortDir] = React.useState<SortDir>('asc');
    const [pending3DTask, setPending3DTask] = React.useState<{ taskCode: string; comp: any } | null>(null);
    const [showUnsavedPrompt, setShowUnsavedPrompt] = React.useState(false);

    const clickTimerRef = React.useRef<any>(null);
    const [selectedTaskRecords, setSelectedTaskRecords] = React.useState<{ tCode: string; displayName: string; records: any[] } | null>(null);
    const [showRecordSelectModal, setShowRecordSelectModal] = React.useState(false);

    const allComponents = React.useMemo(() => {
        return [...(componentsSow || []), ...(componentsNonSow || [])];
    }, [componentsSow, componentsNonSow]);

    // Fetch WebApp 3D Coordinates and Platform Details on-demand only when 3D mode is active
    const shouldFetch3D = compView === "MODEL_3D" && !!structureId && structureId !== 0;

    const { data: webapp3dResponse, isLoading: isWebapp3dLoading, mutate: mutateWebapp3d } = useSWR(
        shouldFetch3D ? `/api/platform/webapp-3d/${structureId}` : null,
        fetcher,
        { revalidateOnFocus: false, revalidateOnReconnect: false, revalidateIfStale: true }
    );
    const webapp3dData = webapp3dResponse?.data;

    const [isResyncing3D, setIsResyncing3D] = React.useState(false);

    const handleResync3D = async () => {
        if (!structureId || structureId === 0) return;
        setIsResyncing3D(true);
        try {
            const res = await fetch(`/api/platform/webapp-3d/${structureId}?resync=true`, { method: "POST" });
            if (res.ok) {
                toast.success("3D model cache resynchronized & recreated successfully!");
                if (mutateWebapp3d) await mutateWebapp3d();
            } else {
                toast.error("Failed to resynchronize 3D model cache.");
            }
        } catch (e) {
            toast.error("Error resynchronizing 3D model cache.");
        } finally {
            setIsResyncing3D(false);
        }
    };

    const { data: platformDetailData } = useSWR(
        shouldFetch3D ? `/api/platform/${structureId}` : null,
        fetcher,
        { revalidateOnFocus: false, revalidateOnReconnect: false }
    );
    const platformDetails = platformDetailData?.data;

    const { data: elevationsData } = useSWR(
        shouldFetch3D ? `/api/platform/elevation/${structureId}` : null,
        fetcher,
        { revalidateOnFocus: false, revalidateOnReconnect: false }
    );
    const elevations = elevationsData?.data || [];

    const { data: facesData } = useSWR(
        shouldFetch3D ? `/api/platform/faces/${structureId}` : null,
        fetcher,
        { revalidateOnFocus: false, revalidateOnReconnect: false }
    );
    const faces = facesData?.data || [];

    const [previewComp, setPreviewComp] = React.useState<any>(null);

    const handle3DComponentClick = (comp3d: any) => {
        const fullComp = allComponents.find(
            (c: any) => String(c.id) === String(comp3d.id) || String(c.q_id) === String(comp3d.q_id)
        ) || comp3d;
        
        setPreviewComp(fullComp);
    };

    const executeLoad3DTask = (taskCode: string, targetComp: any) => {
        React.startTransition(() => {
            if (onDirectSelectTask) {
                onDirectSelectTask(targetComp, taskCode);
            } else {
                handleComponentSelection(targetComp);
                if (handleTaskChange) {
                    handleTaskChange(taskCode);
                }
            }
            setPreviewComp(null);
        });
        toast.success(`Loaded ${taskCode} for ${targetComp.q_id || targetComp.name} into inspection form`);
    };

    const handleSelect3DTaskWithCheck = (taskCode: string) => {
        if (!previewComp) return;
        if (isFormDirty) {
            setPending3DTask({ taskCode, comp: previewComp });
            setShowUnsavedPrompt(true);
        } else {
            executeLoad3DTask(taskCode, previewComp);
        }
    };

    const handleTaskSingleClick = (taskCode: string) => {
        if (clickTimerRef.current) {
            clearTimeout(clickTimerRef.current);
            clickTimerRef.current = null;
        }
        clickTimerRef.current = setTimeout(() => {
            handleSelect3DTaskWithCheck(taskCode);
            clickTimerRef.current = null;
        }, 250);
    };

    const handleTaskDoubleClick = (taskCode: string, existingRecords: any[], displayName: string) => {
        if (clickTimerRef.current) {
            clearTimeout(clickTimerRef.current);
            clickTimerRef.current = null;
        }

        if (!existingRecords || existingRecords.length === 0) {
            handleSelect3DTaskWithCheck(taskCode);
            return;
        }

        if (existingRecords.length === 1) {
            if (handleEditRecord) {
                handleEditRecord(existingRecords[0]);
                toast.info(`Viewing recorded ${displayName} data`);
                setPreviewComp(null);
            }
        } else {
            setSelectedTaskRecords({ tCode: taskCode, displayName, records: existingRecords });
            setShowRecordSelectModal(true);
        }
    };

    const getWallThickness = (comp: any) => {
        if (!comp) return "N/A";
        const wtProp = comp.wall_thickness || comp.wt || comp.thickness || comp.metadata?.wall_thickness || comp.metadata?.wt || comp.metadata?.thickness || comp.metadata?.wall_thickness_mm;
        if (wtProp) return `${wtProp} mm`;

        const compIdStr = String(comp.id || comp.comp_id || "");
        const compQIdStr = String(comp.q_id || comp.name || "").toUpperCase();

        const utRec = (currentRecords || []).find((r: any) => {
            const matchesComp = String(r.component_id || r.comp_id) === compIdStr || 
                                ((r.component_qid || r.q_id) && String(r.component_qid || r.q_id).toUpperCase() === compQIdStr);
            if (!matchesComp) return false;
            const code = String(r.inspection_type_code || r.inspection_type?.code || r.task_code || "").toUpperCase();
            return code === 'RUTWT' || code === 'UTWTK' || code === 'DUTWT' || code === 'UT';
        });

        if (utRec && (utRec.thickness || utRec.wt_reading || utRec.reading || utRec.measurement)) {
            return `${utRec.thickness || utRec.wt_reading || utRec.reading || utRec.measurement} mm`;
        }

        return "N/A";
    };

    const getStructureGroup = (comp: any) => {
        if (!comp) return "MEMBER";
        const grp = comp.group || comp.group_name || comp.structure_group || comp.category || comp.type || comp.metadata?.group || comp.metadata?.structure_group || comp.metadata?.category;
        if (grp) return String(grp).toUpperCase();
        return "MEMBER";
    };

    const getFaceValue = (comp: any) => {
        if (!comp) return "N/A";
        const face = comp.face || comp.face_name || comp.face_code || comp.metadata?.face || comp.metadata?.face_code || comp.metadata?.face_name;
        if (face) return String(face).toUpperCase();
        return "N/A";
    };

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

    const nonSowList = React.useMemo(() => {
        const sowCompsWithoutValidTask = componentsSow.filter((c: any) => {
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
            return !hasValidTask;
        });
        return [...componentsNonSow, ...sowCompsWithoutValidTask];
    }, [componentsSow, componentsNonSow, allInspectionTypes, inspMethod]);

    const availableInspectionTypesForMode = React.useMemo(() => {
        return (allInspectionTypes || []).filter((it: any) => {
            const isRov = it.metadata?.rov === 1 || it.metadata?.rov === "1" || it.metadata?.rov === true || (it.metadata?.job_type && String(it.metadata.job_type).toUpperCase().includes("ROV"));
            const isDiving = it.metadata?.diving === 1 || it.metadata?.diving === "1" || it.metadata?.diving === true || (it.metadata?.job_type && String(it.metadata.job_type).toUpperCase().includes("DIVING"));
            
            // 1. Operational Mode Filter (DIVING vs ROV)
            let matchesMode = true;
            if (inspMethod === "DIVING") {
                if (it.metadata?.diving !== undefined || it.metadata?.rov !== undefined || it.metadata?.job_type) {
                    matchesMode = isDiving;
                }
            } else if (inspMethod === "ROV") {
                if (it.metadata?.diving !== undefined || it.metadata?.rov !== undefined || it.metadata?.job_type) {
                    matchesMode = isRov;
                }
            }

            if (!matchesMode) return false;

            // 2. Structure Type Filter (PLATFORM vs PIPELINE)
            const structTypeMeta = (it.structure_type || it.structure_group || it.metadata?.structure_type || it.metadata?.structure_group || it.metadata?.category || "").toString().toUpperCase();
            const codeUpper = String(it.code || "").toUpperCase();

            const pipelineCodes = ["NAVIG", "RNAVIG", "CROSS", "PIPE", "PL_AN", "EVENT", "CP_FG", "FREE_SPAN"];

            if (structureType === "pipeline") {
                if (structTypeMeta) {
                    if (structTypeMeta.includes("PLATFORM")) return false;
                    if (structTypeMeta.includes("PIPELINE")) return true;
                }
                if (pipelineCodes.includes(codeUpper)) return true;
                if (["RSANI", "DSANI", "FMD", "RMGI", "SZCI", "RSWNI", "ANMAIN", "RICMI"].includes(codeUpper)) return false;
                return true;
            } else {
                // Platform structure
                if (structTypeMeta) {
                    if (structTypeMeta.includes("PIPELINE")) return false;
                    if (structTypeMeta.includes("PLATFORM")) return true;
                }
                if (pipelineCodes.includes(codeUpper)) return false;
                return true;
            }
        });
    }, [allInspectionTypes, inspMethod, structureType]);

    return (
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        <Card className="flex flex-col border-2 border-slate-200 dark:border-slate-500 shadow-xl rounded-md bg-white dark:bg-slate-900/60 backdrop-blur-md overflow-hidden flex-1 h-full min-h-0">
                <div className="bg-slate-800 dark:bg-slate-900 text-white flex items-center justify-between pl-1 pr-3 shrink-0">
                    <div className="flex">
                        <button 
                            onClick={() => setCompView("LIST")} 
                            className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${compView === 'LIST' ? 'bg-blue-600 text-white border-b border-blue-600' : 'text-slate-400 hover:text-white border-b border-transparent'}`}
                        >
                            EVENT MENU
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
                                                        {(c.taskStatuses || [])
                                                            .filter((ts: any) => {
                                                                const it = (allInspectionTypes || []).find((type: any) => type.code === ts.code || type.name === ts.code);
                                                                if (!it) return true;
                                                                const isRov = it.metadata?.rov === 1 || it.metadata?.rov === "1" || it.metadata?.rov === true || (it.metadata?.job_type && it.metadata.job_type.includes("ROV"));
                                                                const isDiving = it.metadata?.diving === 1 || it.metadata?.diving === "1" || it.metadata?.diving === true || (it.metadata?.job_type && it.metadata.job_type.includes("DIVING"));
                                                                if (inspMethod === "DIVING" && isDiving) return true;
                                                                if (inspMethod === "ROV" && isRov) return true;
                                                                return false;
                                                            })
                                                            .map((ts: any, idx: number) => {
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
                                        {nonSowList.filter((c: any) => {
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
                    <div className="flex-1 bg-slate-950 flex flex-col relative overflow-hidden min-h-0 w-full h-full">
                        {isWebapp3dLoading ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 p-6 text-center border border-slate-800 rounded-lg">
                                <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin mb-3" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Rendering 3D Platform Model...</span>
                            </div>
                        ) : (
                            <>
                                <Structural3DViewer
                                     webapp3dData={webapp3dData}
                                     components={allComponents}
                                     platformDetails={platformDetails}
                                     elevations={elevations}
                                     faces={faces}
                                     selectedCompId={previewComp?.id || selectedComp?.id}
                                     onSelectComponent={handle3DComponentClick}
                                     onSync={handleResync3D}
                                     isSyncing={isResyncing3D}
                                     compactMode={true}
                                     currentRecords={currentRecords}
                                     historicalRecords={historicalRecords}
                                />

                                {/* BRIEF INFO OVERLAY CARD AT BOTTOM OF 3D VIEWER */}
                                {previewComp && (
                                    <div className="absolute bottom-2 left-2 right-2 z-30 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-3 shadow-2xl animate-in slide-in-from-bottom-2 duration-200 flex flex-col gap-2 text-white">
                                        {/* Header Row: QID, Type badge & Close button */}
                                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                                            <div className="flex items-center gap-2 overflow-hidden pr-2">
                                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                                                <span className="text-xs font-black uppercase tracking-wider text-white truncate">
                                                    {previewComp.q_id || previewComp.id_no || previewComp.name || `Component #${previewComp.id}`}
                                                </span>
                                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                                                    {previewComp.type || previewComp.code || "MEMBER"}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => setPreviewComp(null)}
                                                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
                                                title="Dismiss brief info"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        {/* Details Grid: Leg, Nodes, WT, Group & Face */}
                                         {(() => {
                                             const details = getComponentNodeLegDetails(previewComp);
                                             const assignedTasks = previewComp.taskStatuses || previewComp.tasks || [];
                                             const wtReading = getWallThickness(previewComp);
                                             const groupName = getStructureGroup(previewComp);
                                             const faceVal = getFaceValue(previewComp);

                                             return (
                                                 <div className="flex flex-col gap-2">
                                                     <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                                                         <div className="bg-slate-950/70 p-1.5 rounded border border-slate-800/80 flex flex-col">
                                                             <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Leg / Location</span>
                                                             <span className="font-bold text-slate-200 truncate">
                                                                 {details.legNo ? `Leg ${details.legNo}` : "Unassigned"}
                                                             </span>
                                                         </div>

                                                         <div className="bg-slate-950/70 p-1.5 rounded border border-slate-800/80 flex flex-col">
                                                             <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Nodes (S ➔ F)</span>
                                                             <span className="font-bold text-slate-200 truncate">
                                                                 {details.sNode && details.fNode ? `${details.sNode} ➔ ${details.fNode}` : details.sNode || details.fNode || "N/A"}
                                                             </span>
                                                         </div>

                                                         <div className="bg-slate-950/70 p-1.5 rounded border border-slate-800/80 flex flex-col">
                                                             <span className="text-[8px] font-black uppercase text-cyan-400 tracking-wider flex items-center gap-1">
                                                                 <Ruler className="w-2.5 h-2.5" /> Wall Thickness
                                                             </span>
                                                             <span className="font-bold text-cyan-200 truncate">
                                                                 {wtReading}
                                                             </span>
                                                         </div>

                                                         <div className="bg-slate-950/70 p-1.5 rounded border border-slate-800/80 flex flex-col">
                                                             <span className="text-[8px] font-black uppercase text-purple-400 tracking-wider">Group / Face</span>
                                                             <span className="font-bold text-purple-200 truncate">
                                                                 {groupName} {faceVal !== "N/A" ? `• ${faceVal}` : ""}
                                                             </span>
                                                         </div>
                                                     </div>

                                                     {/* Inspection Tasks Action Section */}
                                                     <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800/80">
                                                         <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-400">
                                                             <span>Assigned Tasks ({assignedTasks.length})</span>
                                                             <span className="text-blue-400 font-medium">Click task to inspect • Double-click to view record</span>
                                                         </div>

                                                         <div className="flex flex-wrap items-center gap-1.5">
                                                             {assignedTasks.length > 0 ? (
                                                                 assignedTasks.map((tItem: any, idx: number) => {
                                                                     const tCode = tItem.code || tItem;
                                                                     const matchedType = (allInspectionTypes || []).find((type: any) => type.code === tCode || type.name === tCode);
                                                                     const displayName = matchedType?.name || tCode;

                                                                     const compIdStr = String(previewComp.id || previewComp.comp_id || "");
                                                                     const compQIdStr = String(previewComp.q_id || previewComp.name || "").toUpperCase();

                                                                     const taskRecords = (currentRecords || []).filter((r: any) => {
                                                                         const matchesComp = String(r.component_id || r.comp_id) === compIdStr || 
                                                                                             ((r.component_qid || r.q_id) && String(r.component_qid || r.q_id).toUpperCase() === compQIdStr);
                                                                         if (!matchesComp) return false;
                                                                         const rCode = String(r.inspection_type_code || r.inspection_type?.code || r.task_code || "").toUpperCase();
                                                                         return rCode === String(tCode).toUpperCase();
                                                                     });

                                                                     const isInspected = taskRecords.length > 0;

                                                                     return (
                                                                         <button
                                                                             key={idx}
                                                                             onClick={() => handleTaskSingleClick(tCode)}
                                                                             onDoubleClick={() => handleTaskDoubleClick(tCode, taskRecords, displayName)}
                                                                             className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer border ${
                                                                                 isInspected
                                                                                     ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-600 hover:text-white"
                                                                                     : "bg-blue-600/20 text-blue-300 border-blue-500/40 hover:bg-blue-600 hover:text-white"
                                                                             }`}
                                                                             title={isInspected ? `Single-click: add new entry. Double-click: view recorded inspection (${taskRecords.length} rec)` : `Start inspection for ${displayName}`}
                                                                         >
                                                                             {isInspected ? (
                                                                                 <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 fill-emerald-500/20" />
                                                                             ) : (
                                                                                 <Play className="w-2.5 h-2.5 fill-current" />
                                                                             )}
                                                                             <span>{displayName}</span>
                                                                             {isInspected && (
                                                                                 <span className="text-[7.5px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-500/40 ml-0.5">
                                                                                     {taskRecords.length > 1 ? `Inspected (${taskRecords.length})` : "Inspected"}
                                                                                 </span>
                                                                             )}
                                                                         </button>
                                                                     );
                                                                 })
                                                             ) : (
                                                                 <span className="text-[9px] italic text-slate-500">No inspection tasks assigned yet</span>
                                                             )}

                                                             {/* Dropdown to add a new inspection task */}
                                                             <div className="relative inline-block">
                                                                 <select
                                                                     onChange={(e) => {
                                                                         if (e.target.value) {
                                                                             handleSelect3DTaskWithCheck(e.target.value);
                                                                         }
                                                                     }}
                                                                     defaultValue=""
                                                                     className="h-6 text-[9px] font-black uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded px-2 pr-4 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                 >
                                                                     <option value="" disabled>+ Add Task ({inspMethod})...</option>
                                                                     {(allInspectionTypes || [])
                                                                         .filter((it: any) => {
                                                                             const isRov = it.metadata?.rov === 1 || it.metadata?.rov === "1" || it.metadata?.rov === true || (it.metadata?.job_type && it.metadata.job_type.includes("ROV"));
                                                                             const isDiving = it.metadata?.diving === 1 || it.metadata?.diving === "1" || it.metadata?.diving === true || (it.metadata?.job_type && it.metadata.job_type.includes("DIVING"));
                                                                             if (inspMethod === "DIVING" && isDiving) return true;
                                                                             if (inspMethod === "ROV" && isRov) return true;
                                                                             return false;
                                                                         })
                                                                         .map((t: any) => (
                                                                             <option key={t.id || t.code} value={t.code || t.name} className="bg-slate-900 text-white">
                                                                                 {t.name} ({t.code})
                                                                             </option>
                                                                         ))}
                                                                 </select>
                                                             </div>
                                                         </div>
                                                     </div>
                                                 </div>
                                             );
                                         })()}
                                     </div>
                                )}

                                 {/* UNSAVED CHANGES MODAL PROMPT */}
                                 {showUnsavedPrompt && pending3DTask && (
                                     <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
                                         <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full shadow-2xl flex flex-col gap-4 text-white">
                                             <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                                                 <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                                                     <AlertCircle className="w-5 h-5" />
                                                 </div>
                                                 <div className="flex flex-col">
                                                     <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">Unsaved Changes Detected</h3>
                                                     <p className="text-[10px] text-slate-400 font-medium">The inspection form has modifications that haven't been saved.</p>
                                                 </div>
                                             </div>

                                             <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                                 You have unsaved changes in the active form. Would you like to <strong className="text-emerald-400 font-bold">Save</strong> before switching, or <strong className="text-rose-400 font-bold">Discard</strong> your modifications to proceed with <span className="text-cyan-300 font-bold">{pending3DTask.taskCode}</span> for <span className="text-white font-bold">{pending3DTask.comp.q_id || pending3DTask.comp.name}</span>?
                                             </p>

                                             <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                                                 <Button
                                                     variant="ghost"
                                                     size="sm"
                                                     onClick={() => {
                                                         setShowUnsavedPrompt(false);
                                                         setPending3DTask(null);
                                                     }}
                                                     className="text-xs text-slate-400 hover:text-white"
                                                 >
                                                     Cancel
                                                 </Button>
                                                 <Button
                                                     variant="outline"
                                                     size="sm"
                                                     onClick={() => {
                                                         if (resetForm) resetForm();
                                                         executeLoad3DTask(pending3DTask.taskCode, pending3DTask.comp);
                                                         setShowUnsavedPrompt(false);
                                                         setPending3DTask(null);
                                                     }}
                                                     className="text-xs bg-rose-950/60 hover:bg-rose-900 text-rose-300 border-rose-800"
                                                 >
                                                     Discard & Proceed
                                                 </Button>
                                                 <Button
                                                     size="sm"
                                                     onClick={async () => {
                                                         if (handleCommitRecord) {
                                                             await handleCommitRecord();
                                                         }
                                                         executeLoad3DTask(pending3DTask.taskCode, pending3DTask.comp);
                                                         setShowUnsavedPrompt(false);
                                                         setPending3DTask(null);
                                                     }}
                                                     className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                                                 >
                                                     Save & Proceed
                                                 </Button>
                                             </div>
                                         </div>
                                     </div>
                                 )}
                                 {/* MULTIPLE INSPECTION RECORDS SELECTION MODAL */}
                                 {showRecordSelectModal && selectedTaskRecords && (
                                     <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
                                         <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-lg w-full shadow-2xl flex flex-col gap-4 text-white">
                                             <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                                 <div className="flex items-center gap-2.5">
                                                     <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-xs">
                                                         {selectedTaskRecords.records.length}
                                                     </div>
                                                     <div className="flex flex-col">
                                                         <h3 className="text-xs font-black uppercase tracking-wider text-slate-100">Select Inspection Record</h3>
                                                         <p className="text-[10px] text-slate-400 font-medium">
                                                             {previewComp?.q_id || previewComp?.name} • {selectedTaskRecords.displayName}
                                                         </p>
                                                     </div>
                                                 </div>
                                                 <button
                                                     onClick={() => {
                                                         setShowRecordSelectModal(false);
                                                         setSelectedTaskRecords(null);
                                                     }}
                                                     className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                                 >
                                                     <X className="w-4 h-4" />
                                                 </button>
                                             </div>

                                             <p className="text-[11px] text-slate-300 font-medium">
                                                 Multiple inspection records were found for this task. Select a record to view or edit:
                                             </p>

                                             <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                                                 {selectedTaskRecords.records.map((rec: any, i: number) => {
                                                     const dateStr = rec.inspection_date ? `${rec.inspection_date} ${rec.inspection_time || ""}` : "Date N/A";
                                                     const isAnomaly = rec.has_anomaly || rec.result_status === "Anomaly";
                                                     const isFinding = rec.result_status === "Finding";

                                                     return (
                                                         <button
                                                             key={rec.insp_id || i}
                                                             onClick={() => {
                                                                 if (handleEditRecord) {
                                                                     handleEditRecord(rec);
                                                                     toast.info(`Loaded record #${rec.insp_id || i + 1} for ${selectedTaskRecords.displayName}`);
                                                                     setShowRecordSelectModal(false);
                                                                     setSelectedTaskRecords(null);
                                                                     setPreviewComp(null);
                                                                 }
                                                             }}
                                                             className="w-full text-left p-3 rounded-xl bg-slate-950/80 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between group cursor-pointer"
                                                         >
                                                             <div className="flex flex-col gap-1">
                                                                 <div className="flex items-center gap-2">
                                                                     <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-300">
                                                                         Record #{rec.insp_id || i + 1}
                                                                     </span>
                                                                     <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                                                                         isAnomaly ? "bg-rose-500/20 text-rose-300 border-rose-500/40" :
                                                                         isFinding ? "bg-amber-500/20 text-amber-300 border-amber-500/40" :
                                                                         "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                                                     }`}>
                                                                         {isAnomaly ? "Anomaly" : isFinding ? "Finding" : "Complete"}
                                                                     </span>
                                                                 </div>
                                                                 <span className="text-[10px] text-slate-400 font-mono">
                                                                     📅 {dateStr} {rec.sow_report_no ? `• Report: ${rec.sow_report_no}` : ""}
                                                                 </span>
                                                             </div>
                                                             <span className="text-xs font-bold text-blue-400 group-hover:translate-x-0.5 transition-transform">
                                                                 Load Record ➔
                                                             </span>
                                                         </button>
                                                     );
                                                 })}
                                             </div>

                                             <div className="flex justify-end pt-2 border-t border-slate-800">
                                                 <Button
                                                     variant="ghost"
                                                     size="sm"
                                                     onClick={() => {
                                                         setShowRecordSelectModal(false);
                                                         setSelectedTaskRecords(null);
                                                     }}
                                                     className="text-xs text-slate-400 hover:text-white"
                                                 >
                                                     Close
                                                 </Button>
                                             </div>
                                         </div>
                                     </div>
                                 )}
                            </>
                        )}
                    </div>
                )}
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

