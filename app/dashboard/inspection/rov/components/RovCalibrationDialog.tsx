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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, ShieldCheck, Zap } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface RovCalibrationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rovJob: any;
    jobpackId: string | null;
    structureId: number | null;
    sowReportNo?: string | null;
}

export default function RovCalibrationDialog({
    open,
    onOpenChange,
    rovJob,
    jobpackId,
    structureId,
    sowReportNo,
}: RovCalibrationDialogProps) {

    const supabase = createClient();
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState("RCPCLB");

    const ensureNegative = (val: string | number) => {
        if (val === "" || val === null || val === undefined) return "";

        const num = Number(val);
        if (isNaN(num)) return val;
        return num > 0 ? -num : num;
    };


    const [cpData, setCpData] = useState({
        calib_equipment_type: "",
        serial_number: "",
        calib_block: "",
        pre_dive_cp_rdg: "",
        in_water1: "",
        in_water2: "",
        in_water3: "",
        post_dive_cp_rdg: "",
    });

    // UT Calibration State
    const [utData, setUtData] = useState({
        calib_equipment_type: "",
        serial_number: "",
        probe: "",
        probe_size: "",
        probe_frequency: "",
        calib_block: "",
        label01: "1.0", label02: "2.0", label03: "3.0", label04: "4.0", label05: "5.0", label06: "6.0",
        reading01: "", reading02: "", reading03: "", reading04: "", reading05: "", reading06: "",
    });

    const [cpRecordId, setCpRecordId] = useState<number | null>(null);
    const [utRecordId, setUtRecordId] = useState<number | null>(null);
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

    // Fetch existing calibration data for this dive

    useEffect(() => {
        if (open && rovJob?.rov_job_id) {
            fetchExistingCalibration();
        }
    }, [open, rovJob]);

    async function fetchExistingCalibration() {
        try {
            const { data, error } = await supabase
                .from("insp_records")
                .select("*")
                .eq("rov_job_id", rovJob.rov_job_id)
                .in("inspection_type_code", ["RCPCLB", "RUTCLB"]);

            if (error) throw error;

            if (data) {
                const cpRecord = data.find(r => r.inspection_type_code === "RCPCLB");
                const utRecord = data.find(r => r.inspection_type_code === "RUTCLB");

                if (cpRecord) {
                    if (cpRecord.inspection_data) {
                        setCpData(prev => ({ ...prev, ...cpRecord.inspection_data }));
                    }
                    setCpRecordId(cpRecord.insp_id);
                } else {
                    setCpRecordId(null);
                    setCpData({
                        calib_equipment_type: "",
                        serial_number: "",
                        calib_block: "",
                        pre_dive_cp_rdg: "",
                        in_water1: "",
                        in_water2: "",
                        in_water3: "",
                        post_dive_cp_rdg: "",
                    });
                }

                if (utRecord) {
                    if (utRecord.inspection_data) {
                        setUtData(prev => ({ ...prev, ...utRecord.inspection_data }));
                    }
                    setUtRecordId(utRecord.insp_id);
                } else {
                    setUtRecordId(null);
                    setUtData({
                        calib_equipment_type: "",
                        serial_number: "",
                        probe: "",
                        probe_size: "",
                        probe_frequency: "",
                        calib_block: "",
                        label01: "1.0", label02: "2.0", label03: "3.0", label04: "4.0", label05: "5.0", label06: "6.0",
                        reading01: "", reading02: "", reading03: "", reading04: "", reading05: "", reading06: "",
                    });
                }
            } else {
                setCpRecordId(null);
                setUtRecordId(null);
            }
        } catch (err) {
            console.error("Error fetching calibration:", err);
        }
    }

    async function handleDelete(type: "RCPCLB" | "RUTCLB") {
        const recordId = type === "RCPCLB" ? cpRecordId : utRecordId;
        if (!recordId) {
            toast.error("No existing record to delete");
            return;
        }

        if (!confirm(`Are you sure you want to delete this ${type === "RCPCLB" ? "CP" : "UT"} Calibration record?`)) {
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from("insp_records")
                .delete()
                .eq("insp_id", recordId);

            if (error) throw error;

            toast.success(`${type === "RCPCLB" ? "CP" : "UT"} Calibration deleted successfully`);
            
            if (type === "RCPCLB") {
                setCpRecordId(null);
                setCpData({
                    calib_equipment_type: "",
                    serial_number: "",
                    calib_block: "",
                    pre_dive_cp_rdg: "",
                    in_water1: "",
                    in_water2: "",
                    in_water3: "",
                    post_dive_cp_rdg: "",
                });
            } else {
                setUtRecordId(null);
                setUtData({
                    calib_equipment_type: "",
                    serial_number: "",
                    probe: "",
                    probe_size: "",
                    probe_frequency: "",
                    calib_block: "",
                    label01: "1.0", label02: "2.0", label03: "3.0", label04: "4.0", label05: "5.0", label06: "6.0",
                    reading01: "", reading02: "", reading03: "", reading04: "", reading05: "", reading06: "",
                });
            }
            
            fetchExistingCalibration();
        } catch (err: any) {
            console.error("Error deleting calibration:", err);
            toast.error(err.message || "Failed to delete calibration");
        } finally {
            setSaving(false);
        }
    }


    async function handleSave(type: "RCPCLB" | "RUTCLB") {

        if (!rovJob) {
            toast.error("No active dive job context");
            return;
        }

        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            let dataToSave = type === "RCPCLB" ? cpData : utData;

            // Auto-negate CP values upon Save just in case
            if (type === "RCPCLB") {
                dataToSave = {
                    ...dataToSave,
                    pre_dive_cp_rdg: ensureNegative(cpData.pre_dive_cp_rdg).toString(),
                    in_water1: ensureNegative(cpData.in_water1).toString(),
                    in_water2: ensureNegative(cpData.in_water2).toString(),
                    in_water3: ensureNegative(cpData.in_water3).toString(),
                    post_dive_cp_rdg: ensureNegative(cpData.post_dive_cp_rdg).toString(),
                };
                setCpData(dataToSave as any);
            }


            // Fetch inspection_type_id
            const { data: typeData } = await supabase
                .from("inspection_type")
                .select("id")
                .eq("code", type)
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

            // Check if record already exists to update or insert
            const { data: existing } = await supabase
                .from("insp_records")
                .select("insp_id")
                .eq("rov_job_id", rovJob.rov_job_id)
                .eq("inspection_type_code", type)
                .maybeSingle();

            const payload = {
                rov_job_id: rovJob.rov_job_id,
                jobpack_id: jobpackId ? Number(jobpackId) : null,
                structure_id: structureId,
                component_id: validComponentId,
                sow_report_no: sowReportNo,
                inspection_type_id: typeData?.id || null,
                inspection_type_code: type,



                inspection_data: dataToSave,
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
                        inspection_data: dataToSave,
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

            toast.success(`${type === "RCPCLB" ? "CP" : "UT"} Calibration saved successfully`);
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
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        🛠️ ROV Calibration Registration
                    </DialogTitle>
                    <DialogDescription>
                        Enter Pre-Dive and Post-Dive calibration metrics for Deployment No: <span className="font-bold text-slate-900 dark:text-slate-100">{rovJob?.deployment_no}</span>
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
                    <TabsList className="grid grid-cols-2 w-full">
                        <TabsTrigger value="RCPCLB" className="flex items-center gap-2">
                            <Zap className="h-4 w-4" /> CP Calibration
                        </TabsTrigger>
                        <TabsTrigger value="RUTCLB" className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4" /> UT Calibration
                        </TabsTrigger>
                    </TabsList>

                    {/* CP Calibration Content */}
                    <TabsContent value="RCPCLB" className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Equipment Type</Label>
                                <select
                                    value={cpData.calib_equipment_type} 
                                    onChange={(e) => setCpData({ ...cpData, calib_equipment_type: e.target.value })}
                                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="">Select Equipment Type</option>
                                    {equipmentOptions.map(opt => (
                                        <option key={opt} value={opt}>
                                            {opt}
                                        </option>
                                    ))}
                                </select>

                            </div>
                            <div className="space-y-2">
                                <Label>Serial Number</Label>
                                <Input 
                                    value={cpData.serial_number} 
                                    onChange={(e) => setCpData({ ...cpData, serial_number: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Calibration Block</Label>
                                <Input 
                                    value={cpData.calib_block} 
                                    onChange={(e) => setCpData({ ...cpData, calib_block: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="border-t pt-4 mt-2">
                            <h4 className="font-semibold text-sm mb-3 text-blue-600 dark:text-blue-400">Pre-Dive Data</h4>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Pre-Dive CP Reading (mV)</Label>
                                    <Input 
                                        type="number"
                                        value={cpData.pre_dive_cp_rdg} 
                                        onChange={(e) => setCpData({ ...cpData, pre_dive_cp_rdg: e.target.value })}
                                        onBlur={(e) => setCpData({ ...cpData, pre_dive_cp_rdg: ensureNegative(e.target.value).toString() })}

                                    />
                                </div>
                            </div>
                        </div>

                        <div className="border-t pt-4 mt-2">
                            <h4 className="font-semibold text-sm mb-3 text-blue-600 dark:text-blue-400">In-Water Readings</h4>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>In Water 1 (mV)</Label>
                                    <Input 
                                        type="number"
                                        value={cpData.in_water1} 
                                        onChange={(e) => setCpData({ ...cpData, in_water1: e.target.value })}
                                        onBlur={(e) => setCpData({ ...cpData, in_water1: ensureNegative(e.target.value).toString() })}

                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>In Water 2 (mV)</Label>
                                    <Input 
                                        type="number"
                                        value={cpData.in_water2} 
                                        onChange={(e) => setCpData({ ...cpData, in_water2: e.target.value })}
                                        onBlur={(e) => setCpData({ ...cpData, in_water2: ensureNegative(e.target.value).toString() })}

                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>In Water 3 (mV)</Label>
                                    <Input 
                                        type="number"
                                        value={cpData.in_water3} 
                                        onChange={(e) => setCpData({ ...cpData, in_water3: e.target.value })}
                                        onBlur={(e) => setCpData({ ...cpData, in_water3: ensureNegative(e.target.value).toString() })}

                                    />
                                </div>
                            </div>
                        </div>

                        <div className="border-t pt-4 mt-2">
                            <h4 className="font-semibold text-sm mb-3 text-blue-600 dark:text-blue-400">Post-Dive Data</h4>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Post-Dive CP Reading (mV)</Label>
                                    <Input 
                                        type="number"
                                        value={cpData.post_dive_cp_rdg} 
                                        onChange={(e) => setCpData({ ...cpData, post_dive_cp_rdg: e.target.value })}
                                        onBlur={(e) => setCpData({ ...cpData, post_dive_cp_rdg: ensureNegative(e.target.value).toString() })}

                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-4">
                            {cpRecordId && (
                                <Button 
                                    onClick={() => handleDelete("RCPCLB")} 
                                    disabled={saving} 
                                    variant="destructive"
                                    className="flex-1 gap-2"
                                >
                                    Delete CP Calibration
                                </Button>
                            )}
                            <Button 
                                onClick={() => handleSave("RCPCLB")} 
                                disabled={saving} 
                                className={`${cpRecordId ? 'flex-1' : 'w-full'} gap-2 bg-blue-600 hover:bg-blue-700`}
                            >
                                <Save className="h-4 w-4" /> {saving ? "Saving..." : cpRecordId ? "Update CP Calibration" : "Save CP Calibration"}
                            </Button>
                        </div>

                    </TabsContent>

                    {/* UT Calibration Content */}
                    <TabsContent value="RUTCLB" className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Equipment Type</Label>
                                <select
                                    value={utData.calib_equipment_type} 
                                    onChange={(e) => setUtData({ ...utData, calib_equipment_type: e.target.value })}
                                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="">Select Equipment Type</option>
                                    {equipmentOptions.map(opt => (
                                        <option key={opt} value={opt}>
                                            {opt}
                                        </option>
                                    ))}
                                </select>

                            </div>
                            <div className="space-y-2">
                                <Label>Serial Number</Label>
                                <Input 
                                    value={utData.serial_number} 
                                    onChange={(e) => setUtData({ ...utData, serial_number: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Probe</Label>
                                <Input 
                                    value={utData.probe} 
                                    onChange={(e) => setUtData({ ...utData, probe: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Probe Size</Label>
                                <Input 
                                    value={utData.probe_size} 
                                    onChange={(e) => setUtData({ ...utData, probe_size: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Probe Frequency</Label>
                                <Input 
                                    value={utData.probe_frequency} 
                                    onChange={(e) => setUtData({ ...utData, probe_frequency: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Calibration Block</Label>
                                <Input 
                                    value={utData.calib_block} 
                                    onChange={(e) => setUtData({ ...utData, calib_block: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="border-t pt-4 mt-2">
                            <h4 className="font-semibold text-sm mb-3 text-blue-600 dark:text-blue-400">Step Wedge Calibration (Pre-Dive)</h4>
                            <div className="grid grid-cols-6 gap-2 text-center font-medium text-xs mb-1">
                                <div>Step 1</div>
                                <div>Step 2</div>
                                <div>Step 3</div>
                                <div>Step 4</div>
                                <div>Step 5</div>
                                <div>Step 6</div>
                            </div>
                            <div className="grid grid-cols-6 gap-2">
                                <Input value={utData.label01} onChange={(e) => setUtData({ ...utData, label01: e.target.value })} placeholder="Label" className="text-center text-xs h-8" />
                                <Input value={utData.label02} onChange={(e) => setUtData({ ...utData, label02: e.target.value })} placeholder="Label" className="text-center text-xs h-8" />
                                <Input value={utData.label03} onChange={(e) => setUtData({ ...utData, label03: e.target.value })} placeholder="Label" className="text-center text-xs h-8" />
                                <Input value={utData.label04} onChange={(e) => setUtData({ ...utData, label04: e.target.value })} placeholder="Label" className="text-center text-xs h-8" />
                                <Input value={utData.label05} onChange={(e) => setUtData({ ...utData, label05: e.target.value })} placeholder="Label" className="text-center text-xs h-8" />
                                <Input value={utData.label06} onChange={(e) => setUtData({ ...utData, label06: e.target.value })} placeholder="Label" className="text-center text-xs h-8" />
                            </div>
                            <div className="grid grid-cols-6 gap-2 mt-2">
                                <Input type="number" value={utData.reading01} onChange={(e) => setUtData({ ...utData, reading01: e.target.value })} placeholder="Rdg" className="text-center text-xs h-8" />
                                <Input type="number" value={utData.reading02} onChange={(e) => setUtData({ ...utData, reading02: e.target.value })} placeholder="Rdg" className="text-center text-xs h-8" />
                                <Input type="number" value={utData.reading03} onChange={(e) => setUtData({ ...utData, reading03: e.target.value })} placeholder="Rdg" className="text-center text-xs h-8" />
                                <Input type="number" value={utData.reading04} onChange={(e) => setUtData({ ...utData, reading04: e.target.value })} placeholder="Rdg" className="text-center text-xs h-8" />
                                <Input type="number" value={utData.reading05} onChange={(e) => setUtData({ ...utData, reading05: e.target.value })} placeholder="Rdg" className="text-center text-xs h-8" />
                                <Input type="number" value={utData.reading06} onChange={(e) => setUtData({ ...utData, reading06: e.target.value })} placeholder="Rdg" className="text-center text-xs h-8" />
                            </div>
                        </div>

                        <div className="flex gap-2 mt-4">
                            {utRecordId && (
                                <Button 
                                    onClick={() => handleDelete("RUTCLB")} 
                                    disabled={saving} 
                                    variant="destructive"
                                    className="flex-1 gap-2"
                                >
                                    Delete UT Calibration
                                </Button>
                            )}
                            <Button 
                                onClick={() => handleSave("RUTCLB")} 
                                disabled={saving} 
                                className={`${utRecordId ? 'flex-1' : 'w-full'} gap-2 bg-blue-600 hover:bg-blue-700`}
                            >
                                <Save className="h-4 w-4" /> {saving ? "Saving..." : utRecordId ? "Update UT Calibration" : "Save UT Calibration"}
                            </Button>
                        </div>

                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
