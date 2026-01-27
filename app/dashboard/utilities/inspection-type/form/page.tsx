"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    ClipboardList,
    ShieldCheck,
    Plus,
    X,
    ChevronLeft,
    Target,
    Activity,
    Settings2,
    Database,
    Zap,
    Waves,
    Anchor,
    Box
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";

interface Metadata {
    platform: number;
    pipeline: number;
    sbm: number;
    tank: number;
}

interface InspectionTypeData {
    code: string;
    name: string;
    sname: string;
    metadata: Metadata;
}

export default function InspectionTypeFormPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const typeIdParam = searchParams.get("id");
    const [typeId, setTypeId] = useState<number | null>(typeIdParam ? parseInt(typeIdParam) : null);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState<InspectionTypeData>({
        code: "",
        name: "",
        sname: "",
        metadata: {
            platform: 0,
            pipeline: 0,
            sbm: 0,
            tank: 0
        },
    });

    // Fetch data if editing
    const { data: existingType, isLoading: isDataLoading } = useSWR(
        typeId ? `/api/inspection-type?id=${typeId}` : null,
        fetcher
    );

    useEffect(() => {
        if (existingType?.data) {
            const data = existingType.data;
            setFormData({
                code: data.code || "",
                name: data.name || "",
                sname: data.sname || "",
                metadata: {
                    platform: data.metadata?.platform ?? 0,
                    pipeline: data.metadata?.pipeline ?? 0,
                    sbm: data.metadata?.sbm ?? 0,
                    tank: data.metadata?.tank ?? 0
                }
            });
        }
    }, [existingType]);

    const toggleMetadata = (key: keyof Metadata) => {
        setFormData(prev => ({
            ...prev,
            metadata: {
                ...prev.metadata,
                [key]: prev.metadata[key] === 1 ? 0 : 1
            }
        }));
    };

    const handleSave = async () => {
        if (!formData.code || !formData.name) {
            toast.error("Please provide both code and name");
            return;
        }

        setIsSaving(true);
        try {
            const response = await fetcher("/api/inspection-type", {
                method: "POST",
                body: JSON.stringify({
                    id: typeId,
                    ...formData
                })
            });

            if (response && response.data) {
                toast.success(typeId ? "Inspection type updated" : "New inspection type registered");
                router.push('/dashboard/utilities/inspection-type');
            }
        } catch (err) {
            toast.error("Failed to save inspection type");
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    if (isDataLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-20 space-y-4">
                <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Registry Data...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 w-full flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50/30 dark:bg-transparent animate-in fade-in duration-700">
            <div className="max-w-[1200px] mx-auto w-full p-8 space-y-8">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
                    <div className="flex items-center gap-5">
                        <Link href="/dashboard/utilities/inspection-type">
                            <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
                                <ChevronLeft className="h-6 w-6" />
                            </Button>
                        </Link>
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-2xl">
                            <ClipboardList className="h-7 w-7" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                                <span className="opacity-50">Utilities</span>
                                <div className="h-1 w-1 rounded-full bg-indigo-500" />
                                <span className="text-indigo-600/80">Protocol Configuration</span>
                            </div>
                            <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">
                                {typeId ? "Modify Inspection Type" : "Register New Type"}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="rounded-xl h-12 px-8 font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-500/20 transition-all gap-2"
                        >
                            {isSaving ? (
                                <div className="h-4 w-4 border-2 border-indigo-200 border-t-white rounded-full animate-spin" />
                            ) : (
                                <ShieldCheck className="h-4 w-4" />
                            )}
                            Save Configuration
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                    {/* Left Side: Basic Info */}
                    <div className="xl:col-span-7 space-y-8">
                        <Card className="rounded-[2rem] border-slate-200/60 dark:border-slate-800/60 shadow-xl overflow-hidden">
                            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b p-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center">
                                        <Database className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-sm font-black uppercase tracking-wider">Identification</CardTitle>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Core Parameters</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">System Code</Label>
                                        <Input
                                            placeholder="e.g. VIS-01"
                                            value={formData.code}
                                            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                            className="rounded-2xl h-12 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-indigo-500 shadow-sm font-black text-indigo-600 dark:text-indigo-400"
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Short Name</Label>
                                        <Input
                                            placeholder="e.g. Visual"
                                            value={formData.sname}
                                            onChange={(e) => setFormData({ ...formData, sname: e.target.value })}
                                            className="rounded-2xl h-12 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-indigo-500 shadow-sm font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Descriptive Name</Label>
                                    <Input
                                        placeholder="e.g. General Visual Inspection"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="rounded-2xl h-12 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-indigo-500 shadow-sm font-bold"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Side: Metadata / Compatibility */}
                    <div className="xl:col-span-5 space-y-8">
                        <Card className="rounded-[2rem] border-slate-200/60 dark:border-slate-800/60 shadow-xl overflow-hidden">
                            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b p-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                                        <Settings2 className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-sm font-black uppercase tracking-wider">Asset Compatibility</CardTitle>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Metadata Mapping</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 space-y-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 px-1 italic leading-relaxed">
                                    Select which asset categories are compatible with this inspection type.
                                </p>

                                <div className="grid grid-cols-1 gap-3">
                                    <MetadataToggle
                                        label="Platform Compatibility"
                                        active={formData.metadata.platform === 1}
                                        onClick={() => toggleMetadata('platform')}
                                        icon={<Zap className="h-4 w-4" />}
                                    />
                                    <MetadataToggle
                                        label="Pipeline Compatibility"
                                        active={formData.metadata.pipeline === 1}
                                        onClick={() => toggleMetadata('pipeline')}
                                        icon={<Waves className="h-4 w-4" />}
                                    />
                                    <MetadataToggle
                                        label="SBM System Support"
                                        active={formData.metadata.sbm === 1}
                                        onClick={() => toggleMetadata('sbm')}
                                        icon={<Anchor className="h-4 w-4" />}
                                    />
                                    <MetadataToggle
                                        label="Storage Tank Audit"
                                        active={formData.metadata.tank === 1}
                                        onClick={() => toggleMetadata('tank')}
                                        icon={<Box className="h-4 w-4" />}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetadataToggle({ label, active, onClick, icon }: { label: string, active: boolean, onClick: () => void, icon: React.ReactNode }) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "flex items-center justify-between p-5 rounded-[1.5rem] border-2 cursor-pointer transition-all duration-300 group",
                active
                    ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-md translate-x-1"
                    : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/40"
            )}
        >
            <div className="flex items-center gap-4">
                <div className={cn(
                    "flex items-center justify-center h-10 w-10 rounded-xl transition-all",
                    active ? "bg-indigo-600 text-white scale-110 shadow-lg shadow-indigo-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-slate-600"
                )}>
                    {icon}
                </div>
                <span className={cn(
                    "text-xs font-black uppercase tracking-tight",
                    active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500"
                )}>
                    {label}
                </span>
            </div>
            <Checkbox
                checked={active}
                className={cn(
                    "h-5 w-5 rounded-md transition-all border-2",
                    active ? "bg-indigo-600 border-indigo-600" : "border-slate-200 dark:border-slate-800"
                )}
            />
        </div>
    );
}
