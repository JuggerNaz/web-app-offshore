"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Plus,
    Check,
    Search,
    Loader2,
    FileCheck
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { useAtomValue } from "jotai";
import { videoTapeIdAtom } from "@/lib/video-recorder/video-state";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import ROVInspectionRecordingDialog from "./ROVInspectionRecordingDialog";

interface InspectionType {
    id: number;
    code: string;
    name: string;
    description?: string;
}

interface SOWItem {
    id: number;
    inspection_type_id: number;
    inspection_type?: InspectionType; // populated via join
    status: string;
    inspection_code?: string;
    component_qid?: string;
    component_type?: string;
    report_number?: string;
    inspection_name?: string;
    component_id?: number;
}

interface ROVInspectionTypeCardProps {
    sowId: number | null;
    componentId: number | null;
    componentQid?: string;
    componentType?: string;
    assignedTasks: SOWItem[];
    onTasksUpdated: () => void;
    className?: string;
    reportNumber?: string;
    rovJob?: any; // Added rovJob
}

export default function ROVInspectionTypeCard({
    sowId,
    componentId,
    componentQid,
    componentType,
    assignedTasks,
    onTasksUpdated,
    className,
    reportNumber,
    rovJob
}: ROVInspectionTypeCardProps) {
    const supabase = createClient();
    const activeTapeId = useAtomValue(videoTapeIdAtom);

    // State for available types
    const [availableTypes, setAvailableTypes] = useState<InspectionType[]>([]);
    const [loadingTypes, setLoadingTypes] = useState(false);

    // State for adding new type
    const [openCombobox, setOpenCombobox] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    // State for recording
    const [recordingOpen, setRecordingOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<any>(null);

    // ... (fetchInspectionTypes effect same as before) ...
    // Fetch available inspection types on mount (lazy load or on open)
    useEffect(() => {
        if (openCombobox && availableTypes.length === 0) {
            fetchInspectionTypes();
        }
    }, [openCombobox]);

    async function fetchInspectionTypes() {
        setLoadingTypes(true);
        try {
            // Try fetching from 'inspection_type' table first
            const { data, error } = await supabase
                .from('inspection_type')
                .select('id, code, name, description')
                .eq('is_active', true)
                .order('code');

            if (error) throw error;
            setAvailableTypes(data || []);
        } catch (error) {
            console.error("Error fetching inspection types:", error);
            // Fallback to u_lib_list
            try {
                const { data: libData } = await supabase
                    .from('u_lib_list')
                    .select('id, code, name:description')
                    .eq('lib_code', 'INSPECTION_TYPE')
                    .eq('is_active', true);

                if (libData) {
                    setAvailableTypes(libData.map(d => ({
                        id: d.id,
                        code: d.code,
                        name: d.name || d.code
                    })));
                }
            } catch (fallbackError) {
                console.error("Fallback fetch failed", fallbackError);
            }
        } finally {
            setLoadingTypes(false);
        }
    }

    async function handleAddType(typeId: number) {
        if (!sowId || !componentId) {
            toast.error("Missing SOW or Component ID");
            return;
        }

        setIsAdding(true);
        try {
            // Check if already assigned
            if (assignedTasks.some(t => t.inspection_type_id === typeId)) {
                toast.error("This inspection type is already assigned");
                setOpenCombobox(false);
                setIsAdding(false);
                return;
            }

            // Get type details for denormalized fields
            const typeDetails = availableTypes.find(t => t.id === typeId);

            const { error } = await supabase
                .from('u_sow_items')
                .insert({
                    sow_id: sowId,
                    component_id: componentId,
                    inspection_type_id: typeId,

                    // Denormalized fields (optional but good for performance)
                    inspection_code: typeDetails?.code,
                    inspection_name: typeDetails?.name,
                    component_qid: componentQid,
                    component_type: componentType,
                    status: 'pending', // Default status
                    report_number: reportNumber
                });

            if (error) throw error;

            toast.success("Inspection type assigned");
            setOpenCombobox(false);
            onTasksUpdated(); // Refresh parent list
        } catch (error: any) {
            console.error("Error adding inspection type:", error);
            toast.error(error.message || "Failed to add inspection type");
        } finally {
            setIsAdding(false);
            setOpenCombobox(false);
        }
    }

    const filteredTypes = availableTypes.filter(type =>
        type.code.toLowerCase().includes(searchValue.toLowerCase()) ||
        type.name.toLowerCase().includes(searchValue.toLowerCase())
    );

    return (
        <Card className={cn("w-full p-4 shadow-md border-blue-200 dark:border-blue-900", className)}>
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileCheck className="h-4 w-4 text-blue-600" />
                        <h3 className="font-bold text-sm">Inspection Types</h3>
                    </div>
                </div>

                {/* List of Assigned Types */}
                <div className="space-y-2">
                    {assignedTasks.length > 0 ? (
                        <div className="flex flex-col gap-2 max-h-[20vh] overflow-y-auto pr-1 custom-scrollbar">
                            {assignedTasks.map((task) => {
                                const typeCode = task.inspection_type?.code || task.inspection_code || "Unknown";
                                const typeFullName = task.inspection_type?.name || task.inspection_name || "";
                                const isCompleted = task.status === 'completed';
                                const isIncomplete = task.status === 'incomplete';

                                return (
                                    <div
                                        key={task.id}
                                        className={cn(
                                            "flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer hover:shadow-sm active:scale-95 select-none",
                                            isCompleted
                                                ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-100 dark:border-green-800"
                                                : isIncomplete ?
                                                    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:border-amber-800"
                                                    : "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-100 dark:border-blue-800"
                                        )}
                                        onClick={() => {
                                            if (!activeTapeId) {
                                                toast.error("No active video tape found. Please start a task or enter a tape ID first.");
                                                return;
                                            }
                                            setSelectedTask(task);
                                            setRecordingOpen(true);
                                        }}
                                        title="Click to record inspection"
                                    >
                                        <div className="flex flex-col items-start leading-tight py-0.5 max-w-[150px]">
                                            {typeFullName ? (
                                                <>
                                                    <span className="font-bold text-sm tracking-tight truncate w-full" title={typeFullName}>{typeFullName}</span>
                                                    <span className="text-[10px] opacity-85 uppercase font-medium">{typeCode}</span>
                                                </>
                                            ) : (
                                                <span className="font-bold text-sm">{typeCode}</span>
                                            )}
                                        </div>
                                        {isIncomplete && <span className="text-[10px] uppercase opacity-75">(Incomplete)</span>}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                            <p className="text-xs text-center text-muted-foreground">
                                No inspection types assigned
                            </p>
                        </div>
                    )}
                </div>

                {/* Add New Type Button with Popover */}
                {sowId && componentId && (
                    <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                aria-expanded={openCombobox}
                                className="w-full justify-between mt-2 text-xs border-dashed text-muted-foreground hover:text-foreground hover:border-solid hover:bg-slate-50 dark:hover:bg-slate-900"
                                disabled={isAdding}
                            >
                                {isAdding ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                                ) : (
                                    <Plus className="h-3 w-3 mr-2 shrink-0" />
                                )}
                                <span className="truncate">Add Type</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-2" align="start">
                            <div className="space-y-2">
                                <div className="flex items-center border-b pb-2">
                                    <Search className="h-4 w-4 text-muted-foreground mr-2" />
                                    <input
                                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                        placeholder="Search type..."
                                        value={searchValue}
                                        onChange={(e) => setSearchValue(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                <div className="max-h-[200px] overflow-y-auto space-y-1">
                                    {loadingTypes ? (
                                        <div className="p-2 text-xs text-center text-muted-foreground">Loading...</div>
                                    ) : filteredTypes.length === 0 ? (
                                        <div className="p-2 text-xs text-center text-muted-foreground">No types found.</div>
                                    ) : (
                                        filteredTypes.map((type) => {
                                            const isAssigned = assignedTasks.some(t => t.inspection_type_id === type.id);
                                            return (
                                                <div
                                                    key={type.id}
                                                    onClick={() => {
                                                        if (!isAssigned) handleAddType(type.id);
                                                    }}
                                                    className={cn(
                                                        "flex items-center justify-between px-2 py-1.5 rounded-sm text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800",
                                                        (isAssigned || isAdding) && "opacity-50 cursor-not-allowed pointer-events-none"
                                                    )}
                                                >
                                                    <div className="flex flex-col text-left">
                                                        <span className="font-bold text-[13px] leading-tight text-slate-900 dark:text-slate-100">{type.name}</span>
                                                        <span className="text-[10px] font-medium text-muted-foreground uppercase">{type.code}</span>
                                                    </div>
                                                    {isAssigned && <Check className="h-3 w-3 text-green-500" />}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                )}

                <ROVInspectionRecordingDialog
                    open={recordingOpen}
                    onOpenChange={setRecordingOpen}
                    sowItem={selectedTask}
                    rovJob={rovJob}
                    onSaved={onTasksUpdated}
                />
            </div>
        </Card>
    );
}
