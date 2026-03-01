"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
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
import { ClipboardEdit, Save, AlertTriangle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface DiveInspectionFormProps {
    diveJob: any;
    selectedComponent: any;
    jobpackId: string | null;
    sowId: string | null;
}

export default function DiveInspectionForm({
    diveJob,
    selectedComponent,
    jobpackId,
    sowId,
}: DiveInspectionFormProps) {
    const supabase = createClient();

    const [formData, setFormData] = useState({
        component_qid: selectedComponent?.qid || "",
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

        if (!diveJob) {
            toast.error("No active dive job");
            return;
        }

        setSaving(true);

        try {
            const { error } = await supabase.from("insp_dive_data").insert({
                dive_job_id: diveJob.dive_job_id,
                component_qid: formData.component_qid || selectedComponent?.qid,
                inspection_type: formData.inspection_type,
                condition: formData.condition,
                defects_found: formData.defects_found,
                observations: formData.observations,
                recommendations: formData.recommendations,
                photos_taken: parseInt(formData.photos_taken) || 0,
                inspection_time: new Date().toISOString(),
            });

            if (error) throw error;

            toast.success("Inspection record saved");

            // Reset form
            setFormData({
                component_qid: selectedComponent?.qid || "",
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
        <Card className="p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-6">
                <ClipboardEdit className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-base">Inspection Form</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Component */}
                <div className="space-y-2">
                    <Label htmlFor="component">Component</Label>
                    <Input
                        id="component"
                        value={selectedComponent?.name || formData.component_qid || "Not selected"}
                        disabled
                        className="bg-slate-50 dark:bg-slate-900/40"
                    />
                </div>

                {/* Inspection Type */}
                <div className="space-y-2">
                    <Label htmlFor="inspection_type">Inspection Type</Label>
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
                            <SelectItem value="Flooded Member Detection">
                                Flooded Member Detection
                            </SelectItem>
                            <SelectItem value="Cathodic Protection">
                                Cathodic Protection
                            </SelectItem>
                            <SelectItem value="Ultrasonic Thickness">
                                Ultrasonic Thickness
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Condition */}
                <div className="space-y-2">
                    <Label htmlFor="condition">Condition</Label>
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

                {/* Defects Found */}
                <div className="space-y-2">
                    <Label htmlFor="defects">Defects Found</Label>
                    <Input
                        id="defects"
                        value={formData.defects_found}
                        onChange={(e) =>
                            setFormData({ ...formData, defects_found: e.target.value })
                        }
                        placeholder="e.g., Corrosion, Damage, None"
                    />
                </div>

                {/* Observations */}
                <div className="space-y-2">
                    <Label htmlFor="observations">Observations</Label>
                    <Textarea
                        id="observations"
                        value={formData.observations}
                        onChange={(e) =>
                            setFormData({ ...formData, observations: e.target.value })
                        }
                        placeholder="Detailed findings and notes..."
                        rows={4}
                    />
                </div>

                {/* Recommendations */}
                <div className="space-y-2">
                    <Label htmlFor="recommendations">Recommendations</Label>
                    <Textarea
                        id="recommendations"
                        value={formData.recommendations}
                        onChange={(e) =>
                            setFormData({ ...formData, recommendations: e.target.value })
                        }
                        placeholder="Actions required..."
                        rows={3}
                    />
                </div>

                {/* Photos Taken */}
                <div className="space-y-2">
                    <Label htmlFor="photos">Photos Taken</Label>
                    <Input
                        id="photos"
                        type="number"
                        min="0"
                        value={formData.photos_taken}
                        onChange={(e) =>
                            setFormData({ ...formData, photos_taken: e.target.value })
                        }
                    />
                </div>

                {/* Warning if component not selected */}
                {!selectedComponent && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                        <p className="text-xs text-amber-900 dark:text-amber-100">
                            Select a component from the tree to associate with this inspection
                        </p>
                    </div>
                )}

                {/* Submit Button */}
                <Button
                    type="submit"
                    disabled={saving || !diveJob}
                    className="w-full gap-2"
                >
                    <Save className="h-4 w-4" />
                    {saving ? "Saving..." : "Save Inspection Record"}
                </Button>
            </form>
        </Card>
    );
}
