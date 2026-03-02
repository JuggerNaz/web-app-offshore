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
import { MapPin, Plus } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface ROVMovementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rovJob: any;
    onMovementSaved: () => void;
}

const ROV_MOVEMENT_TYPES = [
    "ROV_DEPLOYED",
    "ROV_TRANSITING",
    "ROV_AT_WORKSITE",
    "ROV_WORKING",
    "ROV_LEAVING_WORKSITE",
    "ROV_RECOVERED",
];

export default function ROVMovementDialog({
    open,
    onOpenChange,
    rovJob,
    onMovementSaved,
}: ROVMovementDialogProps) {
    const supabase = createClient();

    const [formData, setFormData] = useState({
        movement_type: "",
        remarks: "",
        depth: "",
    });

    const [saving, setSaving] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!rovJob) {
            toast.error("No active ROV job");
            return;
        }

        if (!formData.movement_type) {
            toast.error("Movement Type is required");
            return;
        }

        setSaving(true);

        try {
            const { error } = await supabase.from("insp_rov_movements").insert({
                rov_job_id: rovJob.rov_job_id,
                movement_time: new Date().toISOString(),
                movement_type: formData.movement_type,
                remarks: formData.remarks,
                depth_meters: formData.depth ? parseFloat(formData.depth) : null,
            });

            if (error) throw error;

            toast.success("Movement logged");
            onMovementSaved();
            onOpenChange(false);

            // Reset form
            setFormData({
                movement_type: "",
                remarks: "",
                depth: "",
            });
        } catch (error: any) {
            console.error("Error logging movement:", error);
            toast.error(error.message || "Failed to log movement");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/20">
                            <MapPin className="h-6 w-6 text-cyan-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl">Log ROV Movement</DialogTitle>
                            <DialogDescription>
                                Add manual movement log for the current deployment
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="movement_type">Movement Type *</Label>
                        <Select
                            value={formData.movement_type}
                            onValueChange={(value) =>
                                setFormData({ ...formData, movement_type: value })
                            }
                        >
                            <SelectTrigger id="movement_type">
                                <SelectValue placeholder="Select movement type" />
                            </SelectTrigger>
                            <SelectContent>
                                {ROV_MOVEMENT_TYPES.map((type) => (
                                    <SelectItem key={type} value={type}>
                                        {type.replace(/_/g, " ")}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="depth">Depth (meters)</Label>
                        <Input
                            id="depth"
                            type="number"
                            step="0.1"
                            value={formData.depth}
                            onChange={(e) =>
                                setFormData({ ...formData, depth: e.target.value })
                            }
                            placeholder="e.g., 45.5"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="remarks">Remarks / Location</Label>
                        <Textarea
                            id="remarks"
                            value={formData.remarks}
                            onChange={(e) =>
                                setFormData({ ...formData, remarks: e.target.value })
                            }
                            placeholder="e.g., Visual inspection at Leg A1..."
                            rows={3}
                        />
                    </div>

                    <Button type="submit" disabled={saving} className="w-full gap-2 bg-gradient-to-r from-cyan-600 to-cyan-700">
                        <Plus className="h-4 w-4" />
                        {saving ? "Logging..." : "Add Movement"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
