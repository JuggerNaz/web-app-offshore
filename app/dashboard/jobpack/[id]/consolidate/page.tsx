"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ShieldCheck, CheckCircle, X, Search, LayoutList, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter, useParams } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import moment from "moment";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function ConsolidatePage() {
    const params = useParams();
    const id = params?.id as string;
    const router = useRouter();

    const { data, mutate, isLoading } = useSWR(id ? `/api/jobpack/${id}` : null, fetcher);
    const { data: platforms } = useSWR("/api/platform", fetcher);
    const { data: pipelines } = useSWR("/api/pipeline", fetcher);

    // State
    const [structureStatus, setStructureStatus] = useState<Record<string, any>>({});
    const [selectedForAction, setSelectedForAction] = useState<string[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Fetch User
    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user));
    }, []);

    // Initialize structureStatus from DB
    useEffect(() => {
        if (data?.data?.metadata?.structure_status) {
            setStructureStatus(data.data.metadata.structure_status);
        }
    }, [data]);

    const isJobClosed = data?.data?.status === "CLOSED";

    // Enrich Structures with Titles
    const structures = useMemo(() => {
        const raw = data?.data?.metadata?.structures || [];
        return raw.map((s: any) => {
            let title = s.title;
            if (!title) {
                if (s.type === "PLATFORM") {
                    const pf = platforms?.data?.find((p: any) => p.id == s.id); // Loose equality
                    if (pf) title = pf.name;
                } else if (s.type === "PIPELINE") {
                    const pp = pipelines?.data?.find((p: any) => p.id == s.id);
                    if (pp) title = pp.name;
                }
            }
            return { ...s, title: title || `${s.type} ${s.id}` };
        });
    }, [data, platforms, pipelines]);

    // Helpers
    const getKey = (s: any) => `${s.type}-${s.id}`;

    const handleToggleSelect = (key: string) => {
        if (selectedForAction.includes(key)) {
            setSelectedForAction(prev => prev.filter(k => k !== key));
        } else {
            setSelectedForAction(prev => [...prev, key]);
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const openKeys = structures
                .map(getKey)
                .filter((key: string) => structureStatus[key]?.status !== "CLOSED");
            setSelectedForAction(openKeys);
        } else {
            setSelectedForAction([]);
        }
    };

    const handleCloseSelected = () => {
        if (selectedForAction.length === 0) return;
        if (!confirm(`Mark ${selectedForAction.length} structures as CLOSED?`)) return;

        const now = moment().toISOString();
        const next = { ...structureStatus };

        selectedForAction.forEach(key => {
            next[key] = {
                status: "CLOSED",
                closed_by: currentUser?.user_metadata?.full_name || currentUser?.email || "System",
                closed_at: now
            };
        });

        setStructureStatus(next);
        setSelectedForAction([]); // Clear selection
        toast.success("Structures marked as closed. Click Confirm & Save to persist.");
    };

    const handleSave = async () => {
        // Calculate logic for Final Closure
        let allClosed = true;
        let maxDate: any = null;

        if (structures.length === 0) allClosed = false;

        structures.forEach((s: any) => {
            const key = getKey(s);
            const st = structureStatus[key];
            if (st?.status !== "CLOSED") allClosed = false;
            if (st?.closed_at) {
                const d = moment(st.closed_at);
                if (!maxDate || d.isAfter(maxDate)) maxDate = d;
            }
        });

        const currentMeta = data?.data?.metadata || {};
        const metaUpdates = { ...currentMeta, structure_status: structureStatus };
        const updates: any = {};

        if (allClosed && structures.length > 0) {
            updates.status = "CLOSED";
            if (maxDate) metaUpdates.iend = maxDate.format("YYYY-MM-DD");
        }

        updates.metadata = metaUpdates;

        // Save
        try {
            const endpoint = `/api/jobpack/${id}`;
            const packet = updates;

            const res = await fetch(endpoint, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(packet)
            });

            if (!res.ok) throw new Error("Failed to save");

            toast.success("Consolidation saved successfully.");
            await mutate(); // Refresh SWR
            router.push(`/dashboard/jobpack/${id}`);
        } catch (e) {
            toast.error("Error saving consolidation.");
            console.error(e);
        }
    };

    if (isLoading) return <div className="p-10 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest animate-pulse h-screen">Loading Consolidation...</div>;

    const allOpenKeys = structures
        .map(getKey)
        .filter((key: string) => structureStatus[key]?.status !== "CLOSED");

    const isAllSelected = allOpenKeys.length > 0 &&
        allOpenKeys.every((key: string) => selectedForAction.includes(key));

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b p-4 md:p-6 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <Link href={`/dashboard/jobpack/${id}`}>
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <ChevronLeft className="w-6 h-6 text-slate-600" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                            Consolidation
                            {isJobClosed && <Badge variant="secondary" className="ml-2">Released (Closed)</Badge>}
                        </h1>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-bold mt-1">
                            <div className="flex items-center gap-1.5"><LayoutList className="w-3.5 h-3.5" /> Job Pack: <span className="text-slate-900">{data?.data?.name}</span></div>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <div className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> {structures.length} Structures</div>
                            {data?.data?.iend && (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                    <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> End Date: {moment(data?.data?.iend).format("DD/MM/YYYY")}</div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={handleSave}
                        disabled={isJobClosed}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/20"
                    >
                        Confirm & Save
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">

                {/* Bulk Actions */}
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="flex items-center gap-3">
                            <Checkbox
                                id="select-all"
                                checked={isAllSelected && allOpenKeys.length > 0}
                                onCheckedChange={(c) => handleSelectAll(!!c)}
                                disabled={isJobClosed || allOpenKeys.length === 0}
                            />
                            <label htmlFor="select-all" className="text-sm font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none">Select All Open</label>
                        </div>
                        <Button
                            size="sm"
                            variant="destructive"
                            disabled={selectedForAction.length === 0 || isJobClosed}
                            onClick={handleCloseSelected}
                            className="font-bold"
                        >
                            Close Selected ({selectedForAction.length})
                        </Button>
                    </div>
                </Card>

                {/* List */}
                <div className="space-y-3">
                    {structures.length === 0 && (
                        <div className="text-center py-10 text-slate-400 font-medium">No structures found in this Job Pack.</div>
                    )}

                    {structures.map((s: any) => {
                        const key = getKey(s);
                        const st = structureStatus[key] || { status: "OPEN" };
                        const isClosed = st.status === "CLOSED";
                        const isSelected = selectedForAction.includes(key);

                        return (
                            <Card key={key} className={cn("rounded-2xl transition-all border-slate-200 dark:border-slate-800", isClosed ? "opacity-70 bg-slate-50 dark:bg-slate-900/50" : "bg-white dark:bg-slate-950 hover:shadow-md hover:border-blue-200")}>
                                <div className="p-4 flex items-center gap-4">
                                    <div className="min-w-[2rem] flex justify-center">
                                        {!isClosed ? (
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => handleToggleSelect(key)}
                                                disabled={isJobClosed}
                                                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                            />
                                        ) : (
                                            <CheckCircle className="w-6 h-6 text-green-500" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                            {s.title}
                                            {isClosed && <Badge variant="secondary" className="h-4 text-[9px] px-1 bg-green-100 text-green-700">Closed</Badge>}
                                        </div>
                                        <div className="text-xs text-slate-500 font-mono mt-0.5">{s.type} • ID: {s.id}</div>
                                    </div>
                                    <div className="text-right">
                                        {isClosed ? (
                                            <div className="text-[10px] text-slate-400 font-medium text-right leading-tight">
                                                <div className="font-bold text-slate-500 mb-0.5">CLOSED</div>
                                                <div>by {st.closed_by || "System"}</div>
                                                <div>{moment(st.closed_at).format("DD/MM/YYYY")}</div>
                                            </div>
                                        ) : (
                                            <Badge variant="outline" className="text-slate-400 border-slate-200">OPEN</Badge>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        )
                    })}
                </div>

            </div>
        </div>
    )
}
