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
import { Save, Trash2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface RovCalibrationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    diveJob: any;
    jobpackId: string | null;
    structureId: number | null;
    sowReportNo?: string | null;
}

export default function RovCalibrationDialog({
    open,
    onOpenChange,
    diveJob,
    jobpackId,
    structureId,
    sowReportNo,
}: RovCalibrationDialogProps) {

    const supabase = createClient();
    const [saving, setSaving] = useState(false);

    const ensureNegative = (val: string | number) => {
        if (val === "" || val === null || val === undefined) return "";
        const num = Number(val);
        if (isNaN(num)) return val;
        return num > 0 ? -num : num;
    };
    
    const [rovData, setRovData] = useState({
        calib_equipment_type: "",
        serial_number: "",
        probe_type: "",
        probe_number: "",
        calib_number: "",
        test_value: "",
        pre_dive_reading: "",
        post_dive_reading: "",
        pre_dive_calib_acceptable: false,
        post_dive_calib_acceptable: false,
    });

    const [recordId, setRecordId] = useState<number | null>(null);
    const [equipmentOptions, setEquipmentOptions] = useState<string[]>([]);

    useEffect(() => {
        const fetchEquipmentOptions = async () => {
            const { data, error } = await supabase
                .from("u_lib_list")
                .select("lib_desc")
                .eq("lib_code", "EQUP_TYP")
                .order("lib_desc");
            if (!error && data) {
                const uniqueOpts = Array.from(new Set(data.map(d => d.lib_desc).filter(Boolean)));
                setEquipmentOptions(uniqueOpts);
            }
        };
        fetchEquipmentOptions();
    }, []);

    useEffect(() => {
        if (open && diveJob) {
            fetchExistingCalibration();
        }
    }, [open, diveJob]);

    async function fetchExistingCalibration() {
        try {
            const rovJobId = diveJob?.rov_job_id || diveJob?.id;
            const { data, error } = await supabase
                .from("insp_records")
                .select("*")
                .eq("rov_job_id", rovJobId)
                .eq("inspection_type_code", "ROVCLB");

            if (error) throw error;

            if (data && data.length > 0) {
                const record = data[0];
                if (record.inspection_data) {
                    setRovData(prev => ({ ...prev, ...record.inspection_data }));
                }
                setRecordId(record.insp_id);
            } else {
                setRecordId(null);
                setRovData({
                    calib_equipment_type: "",
                    serial_number: "",
                    probe_type: "",
                    probe_number: "",
                    calib_number: "",
                    test_value: "",
                    pre_dive_reading: "",
                    post_dive_reading: "",
                    pre_dive_calib_acceptable: false,
                    post_dive_calib_acceptable: false,
                });
            }
        } catch (err: any) {
            console.error("Error fetching calibration:", err);
        }
    }

    async function handleDelete() {
        if (!recordId) {
            toast.error("No existing record to delete");
            return;
        }

        if (!confirm(`Are you sure you want to delete this ROV CP Calibration record?`)) {
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from("insp_records")
                .delete()
                .eq("insp_id", recordId);

            if (error) throw error;

            toast.success(`ROV CP Calibration deleted successfully`);
            setRecordId(null);
            setRovData({
                calib_equipment_type: "",
                serial_number: "",
                probe_type: "",
                probe_number: "",
                calib_number: "",
                test_value: "",
                pre_dive_reading: "",
                post_dive_reading: "",
                pre_dive_calib_acceptable: false,
                post_dive_calib_acceptable: false,
            });
            
            fetchExistingCalibration();
        } catch (err: any) {
            console.error("Error deleting calibration:", err);
            toast.error(err.message || "Failed to delete calibration");
        } finally {
            setSaving(false);
        }
    }

    async function handleSave() {
        if (!diveJob) {
            toast.error("No active ROV dive context");
            return;
        }

        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const rovJobId = diveJob?.rov_job_id || diveJob?.id;

            const { data: typeData } = await supabase
                .from("inspection_type")
                .select("id")
                .eq("code", "ROVCLB")
                .maybeSingle();

            // Fetch a valid component_id for this structure to satisfy FK constraint
            let validComponentId = 0;
            if (structureId) {
                const { data: compData } = await supabase
                    .from("structure_components")
                    .select("id")
                    .eq("structure_id", structureId)
                    .limit(1)
                    .maybeSingle();
                if (compData?.id) {
                    validComponentId = compData.id;
                }
            }

            // Auto-negate readings
            const finalPre = ensureNegative(rovData.pre_dive_reading).toString();
            const finalPost = ensureNegative(rovData.post_dive_reading).toString();

            const updatedData = {
                ...rovData,
                pre_dive_reading: finalPre,
                post_dive_reading: finalPost
            };
            
            setRovData(updatedData);

            // Check if record already exists to update or insert
            const { data: existing } = await supabase
                .from("insp_records")
                .select("insp_id")
                .eq("rov_job_id", rovJobId)
                .eq("inspection_type_code", "ROVCLB")
                .maybeSingle();

            const payload = {
                dive_job_id: diveJob?.dive_job_id || null,
                rov_job_id: rovJobId,
                jobpack_id: jobpackId ? Number(jobpackId) : null,
                structure_id: structureId,
                component_id: validComponentId,
                sow_report_no: sowReportNo,
                inspection_type_id: typeData?.id || null,
                inspection_type_code: "ROVCLB",
                inspection_data: updatedData,
                inspection_date: new Date().toISOString().split('T')[0],
                inspection_time: new Date().toLocaleTimeString('en-US', { hour12: false }),
                status: "COMPLETED",
                cr_user: user?.id || "system",
            };


            let error;
            if (existing?.insp_id) {
                const { error: updateError } = await supabase
                    .from("insp_records")
                    .update({
                        component_id: validComponentId,
                        sow_report_no: sowReportNo,
                        inspection_type_id: typeData?.id || null,
                        inspection_data: updatedData,
                        md_user: user?.id || "system",
                        md_date: new Date().toISOString(),
                    })
                    .eq("insp_id", existing.insp_id);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from("insp_records")
                    .insert(payload);
                error = insertError;
            }

            if (error) throw error;

            toast.success(`ROV CP Calibration saved successfully`);
            fetchExistingCalibration();
        } catch (err: any) {
            console.error("Error saving calibration:", err);
            toast.error(err.message || "Failed to save calibration");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl bg-white dark:bg-slate-900 border dark:border-slate-800">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        ROV CP Calibration
                        <span className="text-xs font-normal text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                            Dive {diveJob?.dive_no || diveJob?.deployment_no || diveJob?.rov_job_no}
                        </span>
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 dark:text-slate-400">
                        Manage pre-dive and post-dive CP sensor configurations.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4 py-4">
                    <div className="space-y-2">
                        <Label>Equipment Type</Label>
                        <select
                            value={rovData.calib_equipment_type}
                            onChange={(e) => setRovData({ ...rovData, calib_equipment_type: e.target.value })}
                            className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="">Select Equipment Type</option>
                            {equipmentOptions.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="space-y-2">
                        <Label>Serial Number</Label>
                        <Input
                            value={rovData.serial_number}
                            onChange={(e) => setRovData({ ...rovData, serial_number: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Probe Type</Label>
                        <Input
                            value={rovData.probe_type}
                            onChange={(e) => setRovData({ ...rovData, probe_type: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Probe Number</Label>
                        <Input
                            value={rovData.probe_number}
                            onChange={(e) => setRovData({ ...rovData, probe_number: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Calib Number</Label>
                        <Input
                            value={rovData.calib_number}
                            onChange={(e) => setRovData({ ...rovData, calib_number: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Test Value</Label>
                        <Input
                            value={rovData.test_value}
                            onChange={(e) => setRovData({ ...rovData, test_value: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Pre-Dive Reading (mV)</Label>
                        <Input
                            type="number"
                            value={rovData.pre_dive_reading}
                            onChange={(e) => setRovData({ ...rovData, pre_dive_reading: e.target.value })}
                            onBlur={(e) => setRovData({ ...rovData, pre_dive_reading: ensureNegative(e.target.value).toString() })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Post-Dive Reading (mV)</Label>
                        <Input
                            type="number"
                            value={rovData.post_dive_reading}
                            onChange={(e) => setRovData({ ...rovData, post_dive_reading: e.target.value })}
                            onBlur={(e) => setRovData({ ...rovData, post_dive_reading: ensureNegative(e.target.value).toString() })}
                        />
                    </div>

                    <div className="flex items-center space-x-2 pt-4">
                        <input
                            type="checkbox"
                            id="pre_dive_calib_acceptable"
                            checked={rovData.pre_dive_calib_acceptable}
                            onChange={(e) => setRovData({ ...rovData, pre_dive_calib_acceptable: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <Label htmlFor="pre_dive_calib_acceptable" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Pre-Dive Calib Acceptable
                        </Label>
                    </div>

                    <div className="flex items-center space-x-2 pt-4">
                        <input
                            type="checkbox"
                            id="post_dive_calib_acceptable"
                            checked={rovData.post_dive_calib_acceptable}
                            onChange={(e) => setRovData({ ...rovData, post_dive_calib_acceptable: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <Label htmlFor="post_dive_calib_acceptable" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Post-Dive Calib Acceptable
                        </Label>
                    </div>
                </div>

                <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                    {recordId ? (
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={saving}
                            className="gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </Button>
                    ) : <div />}
                    
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? "Saving..." : "Save Calibration"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
