"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Ship, Plus, Trash2, Calendar, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export type VesselRecord = {
    id: string;
    name: string;
    date: string; // YYYY-MM-DD
};

interface VesselManagerProps {
    vessels: VesselRecord[];
    onChange: (vessels: VesselRecord[]) => void;
    isReadOnly?: boolean;
}

export function VesselManager({ vessels = [], onChange, isReadOnly = false }: VesselManagerProps) {
    const [open, setOpen] = useState(false);
    const [localVessels, setLocalVessels] = useState<VesselRecord[]>([]);

    // New entry state
    const [newName, setNewName] = useState("");
    const [newDate, setNewDate] = useState("");

    useEffect(() => {
        if (open) {
            // Sort by date desc when opening
            const sorted = [...vessels].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setLocalVessels(sorted);
        }
    }, [open, vessels]);

    const handleAdd = () => {
        if (!newName || !newDate) return;

        const newEntry: VesselRecord = {
            id: crypto.randomUUID(),
            name: newName,
            date: newDate
        };

        const updated = [newEntry, ...localVessels].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setLocalVessels(updated);
        onChange(updated);

        // Reset form
        setNewName("");
        setNewDate("");
    };

    const handleDelete = (id: string) => {
        const updated = localVessels.filter(v => v.id !== id);
        setLocalVessels(updated);
        onChange(updated);
    };

    const latestVessel = vessels.length > 0
        ? [...vessels].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
        : null;

    return (
        <div className="flex flex-col gap-2">
            <div className="w-full text-sm font-medium">Vessel</div>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Input
                        value={latestVessel?.name || ""}
                        placeholder="No vessel assigned"
                        readOnly
                        className={cn(
                            "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus-visible:ring-0",
                            isReadOnly && "opacity-50"
                        )}
                    />
                    {vessels.length > 1 && (
                        <div className="absolute right-3 top-2.5 flex items-center gap-1.5 pointer-events-none">
                            <Badge variant="secondary" className="h-5 px-1.5 text-[9px] bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">
                                +{vessels.length - 1} More
                            </Badge>
                        </div>
                    )}
                </div>

                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon"
                            className="shrink-0 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                            disabled={isReadOnly}
                            type="button"
                        >
                            <Ship className="w-4 h-4 text-slate-500" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden gap-0">
                        <DialogHeader className="p-6 pb-2">
                            <DialogTitle className="flex items-center gap-2">
                                <Ship className="w-5 h-5 text-blue-600" />
                                Vessel Management
                            </DialogTitle>
                            <DialogDescription>
                                Manage the mobilization history and vessel assignments for this job.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="p-6 pt-4 space-y-6">
                            {/* Add New Section */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
                                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Add New Mobilization</h4>
                                <div className="grid grid-cols-[1.5fr,1fr,auto] gap-3 items-end">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Vessel Name</Label>
                                        <Input
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            className="h-9 bg-white dark:bg-slate-950"
                                            placeholder="e.g. MV Voyager"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Mob Date</Label>
                                        <Input
                                            type="date"
                                            value={newDate}
                                            onChange={(e) => setNewDate(e.target.value)}
                                            className="h-9 bg-white dark:bg-slate-950"
                                        />
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={handleAdd}
                                        disabled={!newName || !newDate}
                                        className="h-9 bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* History List */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                                        <History className="w-3.5 h-3.5" />
                                        Assignment History
                                    </h4>
                                    <Badge variant="outline" className="text-[10px]">{localVessels.length} Records</Badge>
                                </div>

                                <div className="max-h-[200px] overflow-y-auto custom-scrollbar border rounded-xl dark:border-slate-800">
                                    {localVessels.length > 0 ? (
                                        <div className="divide-y dark:divide-slate-800">
                                            {localVessels.map((v, idx) => (
                                                <div key={v.id} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                                                            idx === 0 ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                                        )}>
                                                            #{localVessels.length - idx}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                                                {v.name}
                                                                {idx === 0 && <span className="ml-2 text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">Latest</span>}
                                                            </div>
                                                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                                <Calendar className="w-3 h-3" />
                                                                Mob Date: {format(new Date(v.date), 'dd MMM yyyy')}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(v.id)}
                                                        className="h-7 w-7 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center text-slate-400 text-xs">
                                            No vessels assigned yet.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t dark:border-slate-800">
                            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
