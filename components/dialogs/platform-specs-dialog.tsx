"use client";

import React, { useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Info,
    Settings,
    Layers,
    MapPin,
    Ruler,
    Package,
    Edit3,
    Calendar,
    Compass,
    CheckCircle2,
    XCircle,
    ExternalLink
} from "lucide-react";

interface PlatformSpecsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    platformDetails: any;
    isLoading?: boolean;
}

export function PlatformSpecsDialog({
    open,
    onOpenChange,
    platformDetails,
    isLoading = false,
}: PlatformSpecsDialogProps) {
    const router = useRouter();

    // Fetch library descriptions for platform configuration dropdown IDs
    const { data: libResponse } = useSWR(
        open ? `/api/library/PLAT_TYP,PLAT_FUNCT,PLAT_MAT,PLAT_CP,CORR_CTG,PLAT_CONT,OILFIELD` : null,
        fetcher
    );
    const libData: any[] = useMemo(() => libResponse?.data || [], [libResponse]);

    const getLibDesc = (libCode: string, idVal: any) => {
        if (idVal === null || idVal === undefined || idVal === "") return "N/A";
        const found = libData.find(
            (x: any) => x.lib_code === libCode && String(x.lib_id) === String(idVal)
        );
        return found ? found.lib_desc : String(idVal);
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    };

    const activeLegsCount = Number(platformDetails?.plegs) || 0;

    const handleOpenEditPage = () => {
        if (platformDetails?.plat_id) {
            onOpenChange(false);
            window.open(`/dashboard/field/platform/${platformDetails.plat_id}`, "_blank");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                {/* Modal Header */}
                <DialogHeader className="p-6 pb-4 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                                <Info className="h-6 w-6" />
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
                    </div>
                </DialogHeader>

                {/* Modal Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {isLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center space-y-3">
                            <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Specifications...</p>
                        </div>
                    ) : !platformDetails ? (
                        <div className="py-16 text-center text-slate-400 font-bold uppercase text-xs">
                            No specifications data available.
                        </div>
                    ) : (
                        <>
                            {/* 1. General Information & Configuration */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* General Info Card */}
                                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs">
                                    <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                                        <Info className="h-4 w-4 text-blue-500" />
                                        <h3 className="font-black text-sm uppercase tracking-wide text-slate-800 dark:text-slate-200">
                                            General Information
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="col-span-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Title</span>
                                            <span className="font-black text-slate-900 dark:text-slate-100">{platformDetails.title || "N/A"}</span>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Description</span>
                                            <span className="font-medium text-slate-700 dark:text-slate-300">{platformDetails.pdesc || "N/A"}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Oil Field</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{getLibDesc("OILFIELD", platformDetails.pfield)}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Installation Date</span>
                                            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                                                <Calendar className="h-3.5 w-3.5 text-blue-500" />
                                                <span>{formatDate(platformDetails.inst_date)}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Water Depth</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">
                                                {platformDetails.depth !== null && platformDetails.depth !== undefined ? `${platformDetails.depth} m` : "N/A"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Design Life</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">
                                                {platformDetails.desg_life !== null && platformDetails.desg_life !== undefined ? `${platformDetails.desg_life} years` : "N/A"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Configuration Card */}
                                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs">
                                    <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                                        <Settings className="h-4 w-4 text-orange-500" />
                                        <h3 className="font-black text-sm uppercase tracking-wide text-slate-800 dark:text-slate-200">
                                            Configuration
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Structure Type</span>
                                            <Badge variant="outline" className="font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60">
                                                {getLibDesc("PLAT_TYP", platformDetails.ptype)}
                                            </Badge>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Function</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{getLibDesc("PLAT_FUNCT", platformDetails.process)}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Material</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{getLibDesc("PLAT_MAT", platformDetails.material)}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">CP System</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{getLibDesc("PLAT_CP", platformDetails.cp_system)}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Corrosion Coating</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{getLibDesc("CORR_CTG", platformDetails.corr_ctg)}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Inst. Contractor</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{getLibDesc("PLAT_CONT", platformDetails.inst_ctr)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Inventory Statistics */}
                            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs">
                                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                                    <Layers className="h-4 w-4 text-purple-500" />
                                    <h3 className="font-black text-sm uppercase tracking-wide text-slate-800 dark:text-slate-200">
                                        Inventory Statistics
                                    </h3>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                    {[
                                        { label: "Conductors", value: platformDetails.conduct },
                                        { label: "Internal Piles", value: platformDetails.pileint },
                                        { label: "Slots", value: platformDetails.cslot },
                                        { label: "Fenders", value: platformDetails.fender },
                                        { label: "Risers", value: platformDetails.riser },
                                        { label: "Sumps", value: platformDetails.sump },
                                        { label: "Skirt Piles", value: platformDetails.pileskt },
                                        { label: "Caissons", value: platformDetails.caisson },
                                        { label: "Anodes", value: platformDetails.an_qty },
                                        { label: "Cranes", value: platformDetails.crane },
                                    ].map((stat, i) => (
                                        <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 flex flex-col items-center justify-center text-center">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{stat.label}</span>
                                            <span className="text-lg font-black text-slate-900 dark:text-white">
                                                {stat.value !== null && stat.value !== undefined ? stat.value : "0"}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 3. Location & Coordinates AND Dimensions & Status */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Location & Coordinates Card */}
                                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs">
                                    <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                                        <MapPin className="h-4 w-4 text-red-500" />
                                        <h3 className="font-black text-sm uppercase tracking-wide text-slate-800 dark:text-slate-200">
                                            Location & Coordinates
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Northing</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                {platformDetails.st_north !== null && platformDetails.st_north !== undefined ? `${platformDetails.st_north} m` : "N/A"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Easting</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                {platformDetails.st_east !== null && platformDetails.st_east !== undefined ? `${platformDetails.st_east} m` : "N/A"}
                                            </span>
                                        </div>
                                        <div className="col-span-2 flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-2">
                                                <Compass className="h-4 w-4 text-blue-500" />
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">True North Angle</span>
                                            </div>
                                            <span className="font-mono font-black text-slate-900 dark:text-white">
                                                {platformDetails.north_angle !== null && platformDetails.north_angle !== undefined ? `${platformDetails.north_angle}°` : "N/A"}
                                            </span>
                                        </div>
                                        <div className="col-span-2 grid grid-cols-2 gap-2 pt-1">
                                            <div>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">North Side First Leg</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200">{platformDetails.nleg_t1 || "N/A"}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">North Side Last Leg</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200">{platformDetails.nleg_t2 || "N/A"}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Dimensions & Status Card */}
                                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs">
                                    <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                                        <Ruler className="h-4 w-4 text-emerald-500" />
                                        <h3 className="font-black text-sm uppercase tracking-wide text-slate-800 dark:text-slate-200">
                                            Dimensions & Status
                                        </h3>
                                    </div>
                                    <div className="space-y-3 text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-500 font-medium">Max Leg Diameter</span>
                                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                                                {platformDetails.dleg !== null && platformDetails.dleg !== undefined ? `${platformDetails.dleg} mm` : "N/A"}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-500 font-medium">Max Wall Thickness</span>
                                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                                                {platformDetails.wall_thk !== null && platformDetails.wall_thk !== undefined ? `${platformDetails.wall_thk} mm` : "N/A"}
                                            </span>
                                        </div>
                                        <Separator className="my-2" />
                                        <div className="grid grid-cols-2 gap-3 pt-1">
                                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                                <span className="font-bold text-slate-700 dark:text-slate-300">Helipad</span>
                                                {platformDetails.helipad === "YES" || platformDetails.helipad === "Yes" ? (
                                                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold gap-1">
                                                        <CheckCircle2 className="h-3 w-3" /> YES
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-slate-400 border-slate-200 dark:border-slate-800 font-bold gap-1">
                                                        <XCircle className="h-3 w-3" /> NO
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                                <span className="font-bold text-slate-700 dark:text-slate-300">Manned</span>
                                                {platformDetails.manned === "YES" || platformDetails.manned === "Yes" ? (
                                                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold gap-1">
                                                        <CheckCircle2 className="h-3 w-3" /> YES
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-slate-400 border-slate-200 dark:border-slate-800 font-bold gap-1">
                                                        <XCircle className="h-3 w-3" /> NO
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 4. Platform Legs Configuration */}
                            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2.5">
                                        <Package className="h-4 w-4 text-indigo-500" />
                                        <h3 className="font-black text-sm uppercase tracking-wide text-slate-800 dark:text-slate-200">
                                            Platform Legs Configuration
                                        </h3>
                                    </div>
                                    <span className="text-xs font-bold text-slate-500">
                                        Total Active Legs: <span className="font-black text-slate-900 dark:text-white">{activeLegsCount}</span>
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-2">
                                    {Array.from({ length: 20 }).map((_, i) => {
                                        const legNum = i + 1;
                                        const legVal = platformDetails[`leg_t${legNum}`];
                                        const isActive = legNum <= activeLegsCount && legVal;
                                        return (
                                            <div
                                                key={legNum}
                                                className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-center transition-all ${isActive
                                                        ? "bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60 text-indigo-900 dark:text-indigo-200"
                                                        : "bg-slate-50/40 dark:bg-slate-950/30 border-slate-100 dark:border-slate-800/40 opacity-40"
                                                    }`}
                                            >
                                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Leg {legNum}</span>
                                                <span className="text-xs font-black truncate w-full">
                                                    {legVal || "—"}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="p-4 px-6 bg-slate-50/80 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">
                        View-only summary mode
                    </span>
                    <div className="flex items-center gap-3">
                        {platformDetails?.plat_id && (
                            <Button
                                onClick={handleOpenEditPage}
                                className="rounded-xl h-9 px-4 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 gap-2 text-xs"
                            >
                                <Edit3 className="h-3.5 w-3.5" />
                                <span>Edit Specs</span>
                                <ExternalLink className="h-3 w-3 opacity-70" />
                            </Button>
                        )}
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            className="rounded-xl text-xs font-bold px-6 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
                        >
                            Close
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
