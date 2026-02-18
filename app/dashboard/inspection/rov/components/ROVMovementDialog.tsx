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
import { MapPin, Plus } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface ROVMovementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rovJob: any;
    onMovementSaved: () => void;
}

export default function ROVMovementDialog({
    open,
    onOpenChange,
    rovJob,
    onMovementSaved,
}: ROVMovementDialogProps) {
    const supabase = createClient();

    const [formData, setFormData] = useState({
        location: "",
        activity: "",
        notes: "",
    });

    const [saving, setSaving] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!rovJob) {
            toast.error("No active ROV job");
            return;
        }

        if (!formData.location || !formData.activity) {
            toast.error("Location and activity are required");
            return;
        }

        setSaving(true);

        try {
            const { error } = await supabase.from("insp_rov_movements").insert({
                rov_job_id: rovJob.rov_job_id,
                timestamp: new Date().toISOString(),
                location: formData.location,
                activity: formData.activity,
                notes: formData.notes,
            });

            if (error) throw error;

            toast.success("Movement logged");
            onMovementSaved();
            onOpenChange(false);

            // Reset form
            setFormData({
                location: "",
                activity: "",
                notes: "",
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
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/20">
                            <MapPin className="h-6 w-6 text-indigo-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl">Log Movement</DialogTitle>
                            <DialogDescription>
                                Record ROV location and activity
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="location">Location *</Label>
                        <Input
                            id="location"
                            value={formData.location}
                            onChange={(e) =>
                                setFormData({ ...formData, location: e.target.value })
                            }
                            placeholder="e.g., Leg A1, Column B2, Node 3"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="activity">Activity *</Label>
                        <Input
                            id="activity"
                            value={formData.activity}
                            onChange={(e) =>
                                setFormData({ ...formData, activity: e.target.value })
                            }
                            placeholder="e.g., Visual inspection, CP reading"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) =>
                                setFormData({ ...formData, notes: e.target.value })
                            }
                            placeholder="Additional details..."
                            rows={3}
                        />
                    </div>

                    <Button type="submit" disabled={saving} className="w-full gap-2">
                        <Plus className="h-4 w-4" />
                        {saving ? "Logging..." : "Add Movement"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
