"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ClipboardList, Save, CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { useAtomValue } from "jotai";
import { videoTapeNoAtom, videoTimeCodeAtom, videoTapeIdAtom } from "@/lib/video-recorder/video-state";

interface DiveInspectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    diveJob: any;
    selectedComponent: any;
    jobpackId: string | null;
    structureId: string | null;
    onInspectionSaved: () => void;
}

export default function DiveInspectionDialog({
    open,
    onOpenChange,
    diveJob,
    selectedComponent,
    jobpackId,
    structureId,
    onInspectionSaved,
}: DiveInspectionDialogProps) {
    const supabase = createClient();

    const [formData, setFormData] = useState({
        inspection_type: "", // Empty by default
        condition: "Good",
        defects_found: "None",
        observations: "",
        recommendations: "",
        photos_taken: "0",
    });

    const [sowItems, setSowItems] = useState<any[]>([]);
    const [availableTypes, setAvailableTypes] = useState<any[]>([]);
    const [selectedSowItem, setSelectedSowItem] = useState<any>(null);
    const [sowId, setSowId] = useState<number | null>(null);
    const [loadingSow, setLoadingSow] = useState(false);

    const [saving, setSaving] = useState(false);

    const tapeNo = useAtomValue(videoTapeNoAtom);
    const timeCode = useAtomValue(videoTimeCodeAtom);
    const tapeId = useAtomValue(videoTapeIdAtom);

    useEffect(() => {
        if (open && selectedComponent) {
            fetchSOWData();
        } else {
            // Reset state on close
            setSowItems([]);
            setSelectedSowItem(null);
            setSowId(null);
        }
    }, [open, selectedComponent]);

    async function fetchSOWData() {
        setLoadingSow(true);
        try {
            // 1. Fetch available inspection types
            const { data: types } = await supabase
                .from("u_lib_list")
                .select("*")
                .eq("lib_code", "INSPECTION_TYPE")
                .eq("is_active", true)
                .order("view_order");

            setAvailableTypes(types || []);

            // 2. Fetch SOW Items if we have jobpack context
            if (jobpackId && structureId) {
                // First get the main SOW record
                const { data: sow } = await supabase
                    .from("u_sow")
                    .select("id")
                    .eq("jobpack_id", jobpackId)
                    .eq("structure_id", structureId)
                    .maybeSingle();

                if (sow) {
                    setSowId(sow.id);
                    // Get items for this component
                    // Depending on schema, component_id might be string or number.
                    // Assuming number based on earlier context, but check selectedComponent.id
                    const compId = selectedComponent.id;
                    if (compId) {
                        const { data: items } = await supabase
                            .from("u_sow_items")
                            .select(`
                                *,
                                u_lib_list!u_sow_items_inspection_type_id_fkey (*)
                            `)
                            .eq("sow_id", sow.id)
                            .eq("component_id", compId);

                        setSowItems(items || []);
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching SOW data:", error);
        } finally {
            setLoadingSow(false);
        }
    }

    function handleSowItemSelect(item: any) {
        setSelectedSowItem(item);
        // Map lib list name/code to form data. 
        // Assuming u_lib_list has 'code' or 'name' that matches what we store in insp_records
        const typeName = item.u_lib_list?.code || item.u_lib_list?.name || "";
        setFormData(prev => ({ ...prev, inspection_type: typeName }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!diveJob) {
            toast.error("No active dive job");
            return;
        }

        setSaving(true);

        try {
            let finalObservations = formData.observations;
            if (tapeNo && timeCode !== "00:00:00") {
                finalObservations += `\n\n[Media Ref: Tape ${tapeNo} @ ${timeCode}]`;
            }

            const { data: newRecord, error } = await supabase.from("insp_dive_data").insert({
                dive_job_id: diveJob.dive_job_id,
                component_qid: selectedComponent?.qid || null,
                inspection_type: formData.inspection_type,
                condition: formData.condition,
                defects_found: formData.defects_found,
                observations: finalObservations,
                recommendations: formData.recommendations,
                photos_taken: parseInt(formData.photos_taken) || 0,
                inspection_time: new Date().toISOString(),
            })
                .select()
                .single();

            if (error) throw error;

            // Link to video log if recording active
            if (tapeId && newRecord) {
                const recordId = newRecord.id || newRecord.dive_data_id || newRecord.inspection_id || newRecord.insp_id; // Check actual PK
                if (recordId) {
                    const { data: { user } } = await supabase.auth.getUser();
                    await supabase.from("insp_video_logs").insert({
                        tape_id: tapeId,
                        event_type: "INSPECTION",
                        timecode_start: timeCode,
                        inspection_id: recordId,
                        remarks: `Inspection - ${formData.inspection_type} - ${formData.condition}`,
                        cr_user: user?.id || 'system',
                        workunit: '000'
                    });
                }
            }

            // Update SOW Logic
            if (selectedSowItem) {
                // Update existing SOW item
                await supabase
                    .from("u_sow_items")
                    .update({
                        status: "completed",
                        last_inspection_date: new Date().toISOString(),
                        inspection_count: (selectedSowItem.inspection_count || 0) + 1
                    })
                    .eq("id", selectedSowItem.id);
            } else if (sowId && selectedComponent?.id) {
                // Create new SOW item if not exists (User opted for additional inspection)
                // Need to find the inspection type ID from availableTypes matching the selected type code/name
                const typeObj = availableTypes.find(t => t.code === formData.inspection_type || t.name === formData.inspection_type);

                if (typeObj) {
                    // Check if one already exists first (avoid duplicate if fetch failed or constraints)
                    const { data: existing } = await supabase
                        .from("u_sow_items")
                        .select("id")
                        .eq("sow_id", sowId)
                        .eq("component_id", selectedComponent.id)
                        .eq("inspection_type_id", typeObj.id)
                        .maybeSingle();

                    if (existing) {
                        await supabase
                            .from("u_sow_items")
                            .update({
                                status: "completed",
                                last_inspection_date: new Date().toISOString()
                            })
                            .eq("id", existing.id);
                    } else {
                        // Insert new
                        await supabase.from("u_sow_items").insert({
                            sow_id: sowId,
                            component_id: selectedComponent.id,
                            inspection_type_id: typeObj.id,
                            component_qid: selectedComponent.q_id || selectedComponent.component_qid,
                            component_type: selectedComponent.component_type || "Unknown",
                            inspection_code: typeObj.code,
                            inspection_name: typeObj.name,
                            status: "completed",
                            inspection_count: 1,
                            last_inspection_date: new Date().toISOString()
                        });
                    }
                }
            }

            toast.success("Inspection record saved");
            onInspectionSaved();
            onOpenChange(false);

            // Reset form
            setFormData({
                inspection_type: "",
                condition: "Good",
                defects_found: "None",
                observations: "",
                recommendations: "",
                photos_taken: "0",
            });
            setSowItems([]);
            setSelectedSowItem(null);
        } catch (error: any) {
            console.error("Error saving inspection:", error);
            toast.error(error.message || "Failed to save inspection");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/20">
                            <ClipboardList className="h-6 w-6 text-orange-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl">Record Inspection</DialogTitle>
                            <DialogDescription>
                                Document dive inspection findings
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Component */}
                    <div className="space-y-2">
                        <Label>Component</Label>
                        <Input
                            value={selectedComponent?.comp_name || "Not selected"}
                            disabled
                            className="bg-slate-50 dark:bg-slate-900/40"
                        />
                    </div>

                    {/* SOW Tasks Selection */}
                    <div className="space-y-2">
                        <Label>Assigned Tasks (SOW)</Label>
                        {loadingSow ? (
                            <div className="text-xs text-muted-foreground animate-pulse">Loading assigned tasks...</div>
                        ) : sowItems.length > 0 ? (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {sowItems.map((item) => {
                                    const typeName = item.u_lib_list?.name || item.inspection_name || "Unknown";
                                    const isSelected = selectedSowItem?.id === item.id;
                                    const isCompleted = item.status === 'completed';

                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => handleSowItemSelect(item)}
                                            className={`
                                                cursor-pointer px-3 py-2 rounded-lg border text-sm flex items-center gap-2 transition-all
                                                ${isSelected
                                                    ? "bg-blue-100 border-blue-500 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100"
                                                    : "bg-white border-slate-200 hover:border-blue-300 dark:bg-slate-800 dark:border-slate-700"
                                                }
                                            `}
                                        >
                                            {isCompleted ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4 text-slate-400" />}
                                            <span className="font-medium">{typeName}</span>
                                            {item.status === 'pending' && <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1 rounded">Pending</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-2 border border-dashed rounded bg-slate-50 text-xs text-muted-foreground mb-2">
                                No specific tasks assigned in SOW for this component.
                            </div>
                        )}
                    </div>

                    {/* Inspection Type Selection (Manual/Override) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <Label>Inspection Type</Label>
                                {!selectedSowItem && formData.inspection_type && (
                                    <span className="text-[10px] text-orange-600 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Unscheduled
                                    </span>
                                )}
                            </div>
                            <Select
                                value={formData.inspection_type}
                                onValueChange={(value) => {
                                    setFormData({ ...formData, inspection_type: value });
                                    // Deselect SOW item if manually changing type to something else? 
                                    // Ideally check if this type matches an SOW item and auto-select it.
                                    const match = sowItems.find(i => (i.u_lib_list?.code === value || i.u_lib_list?.name === value));
                                    if (match) setSelectedSowItem(match);
                                    else setSelectedSowItem(null);
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableTypes.length > 0 ? (
                                        availableTypes.map((t) => (
                                            <SelectItem key={t.id} value={t.code || t.name}>
                                                {t.name}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <>
                                            <SelectItem value="Visual">Visual</SelectItem>
                                            <SelectItem value="CCTV">CCTV</SelectItem>
                                            <SelectItem value="CP">CP</SelectItem>
                                            <SelectItem value="FMD">FMD</SelectItem>
                                            <SelectItem value="UT">UT</SelectItem>
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Condition</Label>
                            <Select
                                value={formData.condition}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, condition: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Good">Good</SelectItem>
                                    <SelectItem value="Fair">Fair</SelectItem>
                                    <SelectItem value="Poor">Poor</SelectItem>
                                    <SelectItem value="Critical">Critical</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Defects & Photos */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Defects Found</Label>
                            <Input
                                value={formData.defects_found}
                                onChange={(e) =>
                                    setFormData({ ...formData, defects_found: e.target.value })
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Photos Taken</Label>
                            <Input
                                type="number"
                                min="0"
                                value={formData.photos_taken}
                                onChange={(e) =>
                                    setFormData({ ...formData, photos_taken: e.target.value })
                                }
                            />
                        </div>
                    </div>

                    {/* Observations */}
                    <div className="space-y-2">
                        <Label>Observations</Label>
                        <Textarea
                            value={formData.observations}
                            onChange={(e) =>
                                setFormData({ ...formData, observations: e.target.value })
                            }
                            rows={4}
                            placeholder="Detailed findings..."
                        />
                    </div>

                    {/* Recommendations */}
                    <div className="space-y-2">
                        <Label>Recommendations</Label>
                        <Textarea
                            value={formData.recommendations}
                            onChange={(e) =>
                                setFormData({ ...formData, recommendations: e.target.value })
                            }
                            rows={3}
                            placeholder="Actions required..."
                        />
                    </div>

                    {/* Submit */}
                    <Button type="submit" disabled={saving || !formData.inspection_type} className="w-full gap-2">
                        <Save className="h-4 w-4" />
                        {saving ? "Saving..." : "Save Inspection Record"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
