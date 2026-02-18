"use client";

import { useState } from "react";
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
import { ClipboardList, Save } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface ROVInspectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rovJob: any;
    selectedComponent: any;
    onInspectionSaved: () => void;
    platformTitle?: string;
}

export default function ROVInspectionDialog({
    open,
    onOpenChange,
    rovJob,
    selectedComponent,
    onInspectionSaved,
    platformTitle,
}: ROVInspectionDialogProps) {
    const supabase = createClient();

    const [formData, setFormData] = useState({
        inspection_type: "Visual",
        condition: "Good",
        defects_found: "None",
        observations: "",
        recommendations: "",
        photos_taken: "0",
    });

    const [saving, setSaving] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!rovJob) {
            toast.error("No active ROV job");
            return;
        }

        setSaving(true);

        try {
            const { error } = await supabase.from("insp_rov_data").insert({
                rov_job_id: rovJob.rov_job_id,
                component_qid: selectedComponent?.qid || null,
                inspection_type: formData.inspection_type,
                condition: formData.condition,
                defects_found: formData.defects_found,
                observations: formData.observations,
                recommendations: formData.recommendations,
                photos_taken: parseInt(formData.photos_taken) || 0,
            });

            if (error) throw error;

            toast.success("Inspection record saved");
            onInspectionSaved();
            onOpenChange(false);

            // Reset form
            setFormData({
                inspection_type: "Visual",
                condition: "Good",
                defects_found: "None",
                observations: "",
                recommendations: "",
                photos_taken: "0",
            });
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
                            <DialogTitle className="text-xl">
                                Record Inspection {platformTitle ? `- ${platformTitle}` : ""}
                            </DialogTitle>
                            <DialogDescription>
                                Document inspection findings and observations
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Component */}
                    <div className="space-y-2">
                        <Label>Component</Label>
                        <Input
                            value={selectedComponent?.name || "Not selected"}
                            disabled
                            className="bg-slate-50 dark:bg-slate-900/40"
                        />
                    </div>

                    {/* Inspection Type & Condition */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Inspection Type</Label>
                            <Select
                                value={formData.inspection_type}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, inspection_type: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Visual">Visual</SelectItem>
                                    <SelectItem value="CCTV">CCTV</SelectItem>
                                    <SelectItem value="CP">Cathodic Protection</SelectItem>
                                    <SelectItem value="UT">Ultrasonic Thickness</SelectItem>
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
                    <Button type="submit" disabled={saving} className="w-full gap-2">
                        <Save className="h-4 w-4" />
                        {saving ? "Saving..." : "Save Inspection Record"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
