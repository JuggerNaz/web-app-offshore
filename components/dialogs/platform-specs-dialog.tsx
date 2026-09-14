"use client";

import React, { useMemo, useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/utils/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PlatformSchema } from "@/utils/schemas/zod";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
    Info,
    Settings,
    Layers,
    MapPin,
    Ruler,
    Package,
    Save,
    Calendar,
    Compass,
    CheckCircle2,
    XCircle,
    Loader2,
    FileText,
    Database,
    Boxes
} from "lucide-react";
import { cn } from "@/lib/utils";
import Spec2Platform from "@/components/forms/spec2-platform";

interface PlatformSpecsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    platformDetails: any;
    isLoading?: boolean;
    onSuccess?: (updatedPlatform: any) => void;
}

export function PlatformSpecsDialog({
    open,
    onOpenChange,
    platformDetails,
    isLoading = false,
    onSuccess,
}: PlatformSpecsDialogProps) {
    const [activeTab, setActiveTab] = useState<"specs" | "extended">("specs");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch library descriptions for platform configuration dropdowns
    const { data: libResponse } = useSWR(
        open ? `/api/library/PLAT_TYP,PLAT_FUNCT,PLAT_MAT,PLAT_CP,CORR_CTG,PLAT_CONT,OILFIELD` : null,
        fetcher
    );
    const libData: any[] = useMemo(() => libResponse?.data || [], [libResponse]);

    const getLibOptions = (libCode: string) => {
        return libData.filter((x: any) => x.lib_code === libCode);
    };

    const normalizeDate = (value: string | null | undefined) => {
        if (!value) return "";
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
        const d = new Date(value);
        return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    };

    const form = useForm<z.infer<typeof PlatformSchema>>({
        resolver: zodResolver(PlatformSchema),
        defaultValues: platformDetails ? {
            ...platformDetails,
            inst_date: normalizeDate(platformDetails.inst_date),
            pfield: platformDetails.pfield ? String(platformDetails.pfield) : "",
            ptype: platformDetails.ptype ? String(platformDetails.ptype) : "",
            process: platformDetails.process ? String(platformDetails.process) : "",
            material: platformDetails.material ? String(platformDetails.material) : "",
            cp_system: platformDetails.cp_system ? String(platformDetails.cp_system) : "",
            corr_ctg: platformDetails.corr_ctg ? String(platformDetails.corr_ctg) : "",
            inst_ctr: platformDetails.inst_ctr ? String(platformDetails.inst_ctr) : "",
            helipad: platformDetails.helipad || "NO",
            manned: platformDetails.manned || "NO",
        } : {},
    });

    // Reset form values whenever platformDetails changes or modal opens
    useEffect(() => {
        if (platformDetails && open) {
            form.reset({
                ...platformDetails,
                inst_date: normalizeDate(platformDetails.inst_date),
                pfield: platformDetails.pfield ? String(platformDetails.pfield) : "",
                ptype: platformDetails.ptype ? String(platformDetails.ptype) : "",
                process: platformDetails.process ? String(platformDetails.process) : "",
                material: platformDetails.material ? String(platformDetails.material) : "",
                cp_system: platformDetails.cp_system ? String(platformDetails.cp_system) : "",
                corr_ctg: platformDetails.corr_ctg ? String(platformDetails.corr_ctg) : "",
                inst_ctr: platformDetails.inst_ctr ? String(platformDetails.inst_ctr) : "",
                helipad: platformDetails.helipad || "NO",
                manned: platformDetails.manned || "NO",
            });
        }
    }, [platformDetails, open, form]);

    const legsCountRaw = form.watch("plegs");
    const legsCount = Number(legsCountRaw) || 0;

    const legValues = form.watch([
        "leg_t1", "leg_t2", "leg_t3", "leg_t4", "leg_t5",
        "leg_t6", "leg_t7", "leg_t8", "leg_t9", "leg_t10",
        "leg_t11", "leg_t12", "leg_t13", "leg_t14", "leg_t15",
        "leg_t16", "leg_t17", "leg_t18", "leg_t19", "leg_t20"
    ]);

    const legOptions = legValues
        .map((val, i) => ({ label: val || `Leg ${i + 1}`, value: val || `Leg ${i + 1}` }))
        .filter((opt, i) => i < legsCount && opt.value !== "");

    const onSubmit = async (values: z.infer<typeof PlatformSchema>) => {
        const platId = platformDetails?.plat_id || values.plat_id;
        if (!platId) {
            toast.error("Platform ID is missing");
            return;
        }

        setIsSubmitting(true);
        try {
            const { plat_id: _pId, ...payload } = values;

            const res = await fetch(`/api/platform/${platId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...payload,
                    plat_id: platId,
                }),
            });

            if (res.ok) {
                const responseData = await res.json();
                toast.success("Platform specifications updated successfully");
                await mutate(`/api/platform/${platId}`);
                await mutate("/api/platform");
                if (onSuccess) {
                    onSuccess(responseData?.data || { ...platformDetails, ...values });
                }
            } else {
                const errData = await res.json().catch(() => null);
                toast.error(errData?.error || "Failed to update platform specifications");
            }
        } catch (e: any) {
            toast.error(e?.message || "Error saving platform specifications");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaveClick = () => {
        if (activeTab === "specs") {
            form.handleSubmit(onSubmit)();
        } else {
            // Extended data tab revalidates metadata
            if (platformDetails?.plat_id) {
                mutate(`/api/platform/elevation/${platformDetails.plat_id}`);
                mutate(`/api/platform/level/${platformDetails.plat_id}`);
                mutate(`/api/platform/faces/${platformDetails.plat_id}`);
            }
            toast.success("Extended structural data synchronized successfully");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                {/* Modal Top Header */}
                <DialogHeader className="p-6 pr-14 sm:pr-16 pb-4 bg-slate-50/90 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                                <Boxes className="h-6 w-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-0.5">
                                    <span className="text-blue-600">Platform Specifications</span>
                                    <div className="h-1 w-1 rounded-full bg-slate-300" />
                                    <span>ID: #{platformDetails?.plat_id || "—"}</span>
                                </div>
                                <DialogTitle className="text-2xl font-black tracking-tight uppercase text-slate-900 dark:text-white leading-none">
                                    {platformDetails?.title || "Platform Specs"}
                                </DialogTitle>
                            </div>
                        </div>

                        {/* Tab Switcher - with comfortable spacing away from the close button */}
                        <div className="mr-2 sm:mr-4">
                            <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
                                <TabsList className="bg-slate-200/60 dark:bg-slate-800/60 p-1 rounded-2xl h-11 border border-slate-200 dark:border-slate-700/50 shadow-xs">
                                    <TabsTrigger
                                        value="specs"
                                        className="rounded-xl px-4 py-1.5 text-xs font-black uppercase tracking-wider gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-blue-600 data-[state=active]:shadow-md transition-all"
                                    >
                                        <FileText className="h-3.5 w-3.5" />
                                        <span>Platform Specs</span>
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="extended"
                                        className="rounded-xl px-4 py-1.5 text-xs font-black uppercase tracking-wider gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-indigo-600 data-[state=active]:shadow-md transition-all"
                                    >
                                        <Database className="h-3.5 w-3.5" />
                                        <span>Extended Data</span>
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </div>
                </DialogHeader>

                {/* Modal Body Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/40 dark:bg-slate-950">
                    {isLoading ? (
                        <div className="py-24 flex flex-col items-center justify-center space-y-3">
                            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Specifications...</p>
                        </div>
                    ) : !platformDetails ? (
                        <div className="py-20 text-center text-slate-400 font-bold uppercase text-xs">
                            No specifications data available.
                        </div>
                    ) : activeTab === "specs" ? (
                        <form id="platform-specs-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            {/* 1. General Information & Configuration */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* General Information Card */}
                                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm">
                                    <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                                        <Info className="h-4 w-4 text-blue-500" />
                                        <h3 className="font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                            General Information
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="col-span-2">
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                                Title <span className="text-red-500">*</span>
                                            </label>
                                            <Input
                                                {...form.register("title")}
                                                placeholder="Platform Title"
                                                className="h-9 bg-slate-50 dark:bg-slate-950 font-black uppercase border-slate-200 dark:border-slate-800 rounded-xl"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Description</label>
                                            <Input
                                                {...form.register("pdesc")}
                                                placeholder="Description..."
                                                className="h-9 bg-slate-50 dark:bg-slate-950 font-medium border-slate-200 dark:border-slate-800 rounded-xl"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                                Oil Field <span className="text-red-500">*</span>
                                            </label>
                                            <Select
                                                value={form.watch("pfield") || ""}
                                                onValueChange={(val) => form.setValue("pfield", val, { shouldDirty: true })}
                                            >
                                                <SelectTrigger className="h-9 bg-slate-50 dark:bg-slate-950 font-bold border-slate-200 dark:border-slate-800 rounded-xl text-xs">
                                                    <SelectValue placeholder="Select Field" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                                                    {getLibOptions("OILFIELD").map((opt: any) => (
                                                        <SelectItem key={opt.lib_id} value={String(opt.lib_id)} className="text-xs font-medium">
                                                            {opt.lib_desc}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                                Installation Date <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <Input
                                                    type="date"
                                                    {...form.register("inst_date")}
                                                    className="h-9 bg-slate-50 dark:bg-slate-950 font-bold border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Water Depth (m)</label>
                                            <Input
                                                type="number"
                                                step="any"
                                                {...form.register("depth")}
                                                placeholder="0.0"
                                                className="h-9 bg-slate-50 dark:bg-slate-950 font-bold border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Design Life (years)</label>
                                            <Input
                                                type="number"
                                                {...form.register("desg_life")}
                                                placeholder="30"
                                                className="h-9 bg-slate-50 dark:bg-slate-950 font-bold border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Configuration Card */}
                                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm">
                                    <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                                        <Settings className="h-4 w-4 text-orange-500" />
                                        <h3 className="font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                            Configuration
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Structure Type</label>
                                            <Select
                                                value={form.watch("ptype") || ""}
                                                onValueChange={(val) => form.setValue("ptype", val, { shouldDirty: true })}
                                            >
                                                <SelectTrigger className="h-9 bg-slate-50 dark:bg-slate-950 font-bold border-slate-200 dark:border-slate-800 rounded-xl text-xs">
                                                    <SelectValue placeholder="Structure Type" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                                                    {getLibOptions("PLAT_TYP").map((opt: any) => (
                                                        <SelectItem key={opt.lib_id} value={String(opt.lib_id)} className="text-xs font-medium">
                                                            {opt.lib_desc}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Function</label>
                                            <Select
                                                value={form.watch("process") || ""}
                                                onValueChange={(val) => form.setValue("process", val, { shouldDirty: true })}
                                            >
                                                <SelectTrigger className="h-9 bg-slate-50 dark:bg-slate-950 font-bold border-slate-200 dark:border-slate-800 rounded-xl text-xs">
                                                    <SelectValue placeholder="Function" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                                                    {getLibOptions("PLAT_FUNCT").map((opt: any) => (
                                                        <SelectItem key={opt.lib_id} value={String(opt.lib_id)} className="text-xs font-medium">
                                                            {opt.lib_desc}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Material</label>
                                            <Select
                                                value={form.watch("material") || ""}
                                                onValueChange={(val) => form.setValue("material", val, { shouldDirty: true })}
                                            >
                                                <SelectTrigger className="h-9 bg-slate-50 dark:bg-slate-950 font-bold border-slate-200 dark:border-slate-800 rounded-xl text-xs">
                                                    <SelectValue placeholder="Material" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                                                    {getLibOptions("PLAT_MAT").map((opt: any) => (
                                                        <SelectItem key={opt.lib_id} value={String(opt.lib_id)} className="text-xs font-medium">
                                                            {opt.lib_desc}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">CP System</label>
                                            <Select
                                                value={form.watch("cp_system") || ""}
                                                onValueChange={(val) => form.setValue("cp_system", val, { shouldDirty: true })}
                                            >
                                                <SelectTrigger className="h-9 bg-slate-50 dark:bg-slate-950 font-bold border-slate-200 dark:border-slate-800 rounded-xl text-xs">
                                                    <SelectValue placeholder="CP System" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                                                    {getLibOptions("PLAT_CP").map((opt: any) => (
                                                        <SelectItem key={opt.lib_id} value={String(opt.lib_id)} className="text-xs font-medium">
                                                            {opt.lib_desc}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Corrosion Coating</label>
                                            <Select
                                                value={form.watch("corr_ctg") || ""}
                                                onValueChange={(val) => form.setValue("corr_ctg", val, { shouldDirty: true })}
                                            >
                                                <SelectTrigger className="h-9 bg-slate-50 dark:bg-slate-950 font-bold border-slate-200 dark:border-slate-800 rounded-xl text-xs">
                                                    <SelectValue placeholder="Corrosion Coating" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                                                    {getLibOptions("CORR_CTG").map((opt: any) => (
                                                        <SelectItem key={opt.lib_id} value={String(opt.lib_id)} className="text-xs font-medium">
                                                            {opt.lib_desc}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Inst. Contractor</label>
                                            <Select
                                                value={form.watch("inst_ctr") || ""}
                                                onValueChange={(val) => form.setValue("inst_ctr", val, { shouldDirty: true })}
                                            >
                                                <SelectTrigger className="h-9 bg-slate-50 dark:bg-slate-950 font-bold border-slate-200 dark:border-slate-800 rounded-xl text-xs">
                                                    <SelectValue placeholder="Contractor" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                                                    {getLibOptions("PLAT_CONT").map((opt: any) => (
                                                        <SelectItem key={opt.lib_id} value={String(opt.lib_id)} className="text-xs font-medium">
                                                            {opt.lib_desc}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Inventory Statistics Card */}
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm">
                                <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                                    <Layers className="h-4 w-4 text-purple-500" />
                                    <h3 className="font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                        Inventory Statistics
                                    </h3>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                    {[
                                        { name: "conduct", label: "Conductors" },
                                        { name: "pileint", label: "Internal Piles" },
                                        { name: "cslot", label: "Slots" },
                                        { name: "fender", label: "Fenders" },
                                        { name: "riser", label: "Risers" },
                                        { name: "sump", label: "Sumps" },
                                        { name: "pileskt", label: "Skirt Piles" },
                                        { name: "caisson", label: "Caissons" },
                                        { name: "an_qty", label: "Anodes" },
                                        { name: "crane", label: "Cranes" },
                                    ].map((stat) => (
                                        <div key={stat.name} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col gap-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">{stat.label}</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                {...form.register(stat.name as any)}
                                                className="h-8 text-sm font-black text-center bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 3. Location & Coordinates AND Dimensions & Status */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Location & Coordinates Card */}
                                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm">
                                    <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                                        <MapPin className="h-4 w-4 text-red-500" />
                                        <h3 className="font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                            Location & Coordinates
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Northing (m)</label>
                                            <Input
                                                {...form.register("st_north")}
                                                placeholder="0.00"
                                                className="h-9 bg-slate-50 dark:bg-slate-950 font-mono font-bold border-slate-200 dark:border-slate-800 rounded-xl"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Easting (m)</label>
                                            <Input
                                                {...form.register("st_east")}
                                                placeholder="0.00"
                                                className="h-9 bg-slate-50 dark:bg-slate-950 font-mono font-bold border-slate-200 dark:border-slate-800 rounded-xl"
                                            />
                                        </div>
                                        <div className="col-span-2 flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 gap-3">
                                            <div className="flex items-center gap-2">
                                                <Compass className="h-4 w-4 text-blue-500" />
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">True North Angle</span>
                                            </div>
                                            <div className="w-28 flex items-center gap-1.5">
                                                <Input
                                                    type="number"
                                                    step="any"
                                                    {...form.register("north_angle")}
                                                    placeholder="0.0"
                                                    className="h-8 bg-white dark:bg-slate-900 font-mono font-bold text-right border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                                                />
                                                <span className="text-xs font-bold text-slate-400">°</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">North Side First Leg</label>
                                            <Select
                                                value={form.watch("nleg_t1") || ""}
                                                onValueChange={(val) => form.setValue("nleg_t1", val, { shouldDirty: true })}
                                            >
                                                <SelectTrigger className="h-9 bg-slate-50 dark:bg-slate-950 font-bold border-slate-200 dark:border-slate-800 rounded-xl text-xs">
                                                    <SelectValue placeholder="First Leg" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                                                    {legOptions.map((opt, idx) => (
                                                        <SelectItem key={`n1-${opt.value}-${idx}`} value={opt.value} className="text-xs font-medium">
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">North Side Last Leg</label>
                                            <Select
                                                value={form.watch("nleg_t2") || ""}
                                                onValueChange={(val) => form.setValue("nleg_t2", val, { shouldDirty: true })}
                                            >
                                                <SelectTrigger className="h-9 bg-slate-50 dark:bg-slate-950 font-bold border-slate-200 dark:border-slate-800 rounded-xl text-xs">
                                                    <SelectValue placeholder="Last Leg" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                                                    {legOptions.map((opt, idx) => (
                                                        <SelectItem key={`n2-${opt.value}-${idx}`} value={opt.value} className="text-xs font-medium">
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                {/* Dimensions & Status Card */}
                                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm">
                                    <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                                        <Ruler className="h-4 w-4 text-emerald-500" />
                                        <h3 className="font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                            Dimensions & Status
                                        </h3>
                                    </div>
                                    <div className="space-y-3 text-xs">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-slate-500 font-medium">Max Leg Diameter</span>
                                            <div className="w-36 flex items-center gap-1.5">
                                                <Input
                                                    type="number"
                                                    step="any"
                                                    {...form.register("dleg")}
                                                    placeholder="0"
                                                    className="h-8 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-right border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                                                />
                                                <span className="text-xs font-bold text-slate-400">mm</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-slate-500 font-medium">Max Wall Thickness</span>
                                            <div className="w-36 flex items-center gap-1.5">
                                                <Input
                                                    type="number"
                                                    step="any"
                                                    {...form.register("wall_thk")}
                                                    placeholder="0"
                                                    className="h-8 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-right border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                                                />
                                                <span className="text-xs font-bold text-slate-400">mm</span>
                                            </div>
                                        </div>
                                        <Separator className="my-2" />
                                        <div className="grid grid-cols-2 gap-3 pt-1">
                                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                                <span className="font-bold text-slate-700 dark:text-slate-300">Helipad</span>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => form.setValue("helipad", "YES", { shouldDirty: true })}
                                                        className={cn(
                                                            "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all",
                                                            form.watch("helipad") === "YES" || form.watch("helipad") === "Yes"
                                                                ? "bg-emerald-500 text-white shadow-sm"
                                                                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                                        )}
                                                    >
                                                        YES
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => form.setValue("helipad", "NO", { shouldDirty: true })}
                                                        className={cn(
                                                            "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all",
                                                            form.watch("helipad") === "NO" || form.watch("helipad") === "No" || !form.watch("helipad")
                                                                ? "bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-white"
                                                                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                                        )}
                                                    >
                                                        NO
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                                <span className="font-bold text-slate-700 dark:text-slate-300">Manned</span>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => form.setValue("manned", "YES", { shouldDirty: true })}
                                                        className={cn(
                                                            "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all",
                                                            form.watch("manned") === "YES" || form.watch("manned") === "Yes"
                                                                ? "bg-emerald-500 text-white shadow-sm"
                                                                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                                        )}
                                                    >
                                                        YES
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => form.setValue("manned", "NO", { shouldDirty: true })}
                                                        className={cn(
                                                            "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all",
                                                            form.watch("manned") === "NO" || form.watch("manned") === "No" || !form.watch("manned")
                                                                ? "bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-white"
                                                                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                                        )}
                                                    >
                                                        NO
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 4. Platform Legs Configuration Card */}
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm">
                                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2.5">
                                        <Package className="h-4 w-4 text-indigo-500" />
                                        <h3 className="font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                            Platform Legs Configuration
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-slate-500">Total Active Legs:</span>
                                        <Input
                                            type="number"
                                            min="1"
                                            max="20"
                                            {...form.register("plegs")}
                                            className="h-8 w-16 text-center font-black text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-2">
                                    {Array.from({ length: 20 }).map((_, i) => {
                                        const legNum = i + 1;
                                        const isActive = legNum <= legsCount;
                                        const fieldName = `leg_t${legNum}` as any;
                                        return (
                                            <div
                                                key={legNum}
                                                className={cn(
                                                    "p-2 rounded-xl border text-center flex flex-col items-center justify-center transition-all",
                                                    isActive
                                                        ? "bg-indigo-50/50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60"
                                                        : "bg-slate-50/30 dark:bg-slate-950/20 border-slate-100 dark:border-slate-800/40 opacity-40"
                                                )}
                                            >
                                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                                    Leg {legNum}
                                                </span>
                                                <Input
                                                    {...form.register(fieldName)}
                                                    placeholder={`L${legNum}`}
                                                    disabled={!isActive}
                                                    className="h-7 text-center font-black uppercase text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg px-1"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </form>
                    ) : (
                        /* Extended Data Tab */
                        <div className="space-y-6">
                            <Spec2Platform platformId={platformDetails.plat_id} />
                        </div>
                    )}
                </div>

                {/* Modal Bottom Footer */}
                <div className="p-4 px-6 bg-slate-50/90 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">
                        Editing platform specifications & extended data
                    </span>
                    <div className="flex items-center gap-3">
                        <Button
                            onClick={handleSaveClick}
                            disabled={isSubmitting || isLoading}
                            className="rounded-xl h-9 px-6 font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 gap-2 text-xs"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="h-3.5 w-3.5" />
                                    <span>Save</span>
                                </>
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            className="rounded-xl text-xs font-bold px-6 h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                        >
                            Close
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
