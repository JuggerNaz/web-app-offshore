"use client";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import {
    CalendarIcon,
    Calendar as CalendarIconLucide,
    Package,
    Target,
    Layers2,
    Activity,
    Plus,
    Trash2,
    Search,
    Navigation,
    ShieldCheck,
    Zap,
    Waves,
    FileText,
    ChevronLeft,
    ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

import useSWR from "swr";
import { fetcher } from "@/utils/utils";

// Define types for the structure data
interface Structure {
    title: string;
    fieldName: string;
    structureType: string;
}

// Define type for the server response
interface PlanningRecord {
    id: number;
    name: string;
    metadata: any;
}

// Define the planning data type
interface PlanningData {
    name: string;
    action: string;
    type: string;
    scope: {
        topside: boolean;
        subsea: boolean;
    };
    inspectionProgram: string;
    frequency: number;
    inspectionDate: Date;
    selectedStructures: Structure[];
    inspectionMode: "ROV" | "DIVING";
}

export default function PlanningFormPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const planIdParam = searchParams.get("id");
    const [planId, setPlanId] = useState<number | null>(planIdParam ? parseInt(planIdParam) : null);

    const [searchQuery, setSearchQuery] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const [planningData, setPlanningData] = useState<PlanningData>({
        name: "",
        action: "createNew",
        type: "structure",
        scope: {
            topside: false,
            subsea: false,
        },
        inspectionProgram: "INSPN2003",
        frequency: 365,
        inspectionDate: new Date(),
        selectedStructures: [],
        inspectionMode: "ROV",
    });

    // Fetch data if editing
    const { data: existingPlan, isLoading: isPlanLoading } = useSWR(
        planId ? `/api/inspection-planning?id=${planId}` : null,
        fetcher
    );

    useEffect(() => {
        if (existingPlan?.data) {
            const plan = Array.isArray(existingPlan.data) ? existingPlan.data[0] : existingPlan.data;
            if (plan && plan.metadata) {
                setPlanningData({
                    ...plan.metadata,
                    name: plan.name,
                    inspectionDate: new Date(plan.metadata.inspectionDate)
                });
            }
        }
    }, [existingPlan]);

    const { data: platformData, isLoading: platLoading } = useSWR("/api/platform", fetcher);
    const { data: pipelineData, isLoading: pipeLoading } = useSWR("/api/pipeline", fetcher);
    const { data: programData, isLoading: progLoading } = useSWR("/api/inspection-program", fetcher);

    const availableStructures = useMemo(() => {
        const platforms = platformData?.data?.map((p: any) => ({
            title: p.title,
            fieldName: p.pfield,
            structureType: "PLATFORM"
        })) || [];
        const pipelines = pipelineData?.data?.map((p: any) => ({
            title: p.title,
            fieldName: p.pfield,
            structureType: "PIPELINE"
        })) || [];
        return [...platforms, ...pipelines];
    }, [platformData, pipelineData]);

    const inspectionPrograms = useMemo(() => {
        return programData?.data || [];
    }, [programData]);

    const filteredStructures = useMemo(() => {
        return availableStructures.filter(s =>
            s.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.fieldName?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [availableStructures, searchQuery]);

    const addStructure = (structure: Structure) => {
        if (planningData.selectedStructures.some(s => s.title === structure.title)) {
            toast.error("Structure already added to current plan");
            return;
        }
        setPlanningData({
            ...planningData,
            selectedStructures: [...planningData.selectedStructures, structure],
        });
    };

    const removeStructure = (title: string) => {
        setPlanningData({
            ...planningData,
            selectedStructures: planningData.selectedStructures.filter(s => s.title !== title),
        });
    };

    const handleSave = async (status: 'DRAFT' | 'FINALIZED') => {
        if (!planningData.name) {
            toast.error("Please provide a plan name");
            return;
        }

        if (status === 'FINALIZED' && planningData.selectedStructures.length === 0) {
            toast.error("Please select at least one structure for final release");
            return;
        }

        setIsSaving(true);
        try {
            const response = await fetcher("/api/inspection-planning", {
                method: "POST",
                body: JSON.stringify({
                    id: planId,
                    name: planningData.name,
                    metadata: {
                        ...planningData,
                        status,
                        lastSaved: new Date().toISOString()
                    }
                })
            });

            if (response && response.data) {
                setPlanId(response.data.id);
                toast.success(status === 'DRAFT' ? "Draft saved successfully" : "Inspection plan finalized and released");
                if (status === 'FINALIZED') {
                    router.push('/dashboard/planning');
                }
            }
        } catch (err) {
            toast.error("Failed to save planning protocol");
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSubmit = () => handleSave('FINALIZED');

    return (
        <div className="flex-1 w-full flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50/30 dark:bg-transparent animate-in fade-in duration-700">
            <div className="max-w-[1600px] mx-auto w-full p-8 space-y-8">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
                    <div className="flex items-center gap-5">
                        <Link href="/dashboard/planning">
                            <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
                                <ChevronLeft className="h-6 w-6" />
                            </Button>
                        </Link>
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 text-white dark:text-slate-900 flex items-center justify-center shadow-2xl">
                            <Zap className="h-7 w-7" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                                <span className="opacity-50">Strategic</span>
                                <div className="h-1 w-1 rounded-full bg-blue-500" />
                                <span className="text-slate-900 dark:text-white/80">Planning Protocol</span>
                            </div>
                            <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">
                                {planId ? "Modify Protocol" : "Register New Plan"}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            onClick={() => handleSave('DRAFT')}
                            disabled={isSaving}
                            className="rounded-xl h-12 px-6 font-bold border-slate-200 dark:border-slate-800"
                        >
                            {isSaving ? (
                                <div className="h-4 w-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mr-2" />
                            ) : null}
                            Save Draft
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={isSaving}
                            className="rounded-xl h-12 px-8 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20 transition-all gap-2"
                        >
                            {isSaving ? (
                                <div className="h-4 w-4 border-2 border-blue-200 border-t-white rounded-full animate-spin" />
                            ) : (
                                <ShieldCheck className="h-4 w-4" />
                            )}
                            Finalize & Release Plan
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

                    {/* Left Column: Configuration */}
                    <div className="xl:col-span-4 space-y-8">

                        {/* Strategy Definition */}
                        <Card className="rounded-[2rem] border-slate-200/60 dark:border-slate-800/60 shadow-xl overflow-hidden">
                            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b p-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center">
                                        <Target className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-sm font-black uppercase tracking-wider">Strategy</CardTitle>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Action & Classification</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 space-y-8">
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Plan Identity</Label>
                                    <div className="relative">
                                        <FileText className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            placeholder="e.g. 2026 Q1 Structural Audit"
                                            value={planningData.name}
                                            onChange={(e) => setPlanningData({ ...planningData, name: e.target.value })}
                                            className="rounded-2xl h-12 pl-12 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-blue-500 shadow-sm font-bold placeholder:font-normal"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Primary Intent</Label>
                                    <RadioGroup
                                        value={planningData.action}
                                        onValueChange={(value) => setPlanningData({ ...planningData, action: value })}
                                        className="grid grid-cols-1 gap-2"
                                    >
                                        {[
                                            { id: "createNew", label: "Establish New Protocol", icon: Plus },
                                            { id: "modifyPlan", label: "Amend Active Plan", icon: Activity },
                                            { id: "deletePlan", label: "Decommission Cycle", icon: Trash2 },
                                        ].map((item) => (
                                            <Label
                                                key={item.id}
                                                htmlFor={item.id}
                                                className={cn(
                                                    "flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all",
                                                    planningData.action === item.id
                                                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-md"
                                                        : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <item.icon className="h-4 w-4" />
                                                    <span className="text-xs font-black uppercase tracking-tight">{item.label}</span>
                                                </div>
                                                <RadioGroupItem value={item.id} id={item.id} className="sr-only" />
                                            </Label>
                                        ))}
                                    </RadioGroup>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Resolution</Label>
                                    <RadioGroup
                                        value={planningData.type}
                                        onValueChange={(value) => setPlanningData({ ...planningData, type: value })}
                                        className="flex flex-wrap gap-2"
                                    >
                                        {["structure", "componentType", "component"].map((t) => (
                                            <div key={t} className="flex-1 min-w-[120px]">
                                                <RadioGroupItem value={t} id={`type-${t}`} className="sr-only" />
                                                <Label
                                                    htmlFor={`type-${t}`}
                                                    className={cn(
                                                        "flex items-center justify-center p-3 rounded-xl border font-black text-[10px] uppercase tracking-widest cursor-pointer transition-all",
                                                        planningData.type === t
                                                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-lg"
                                                            : "border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600"
                                                    )}
                                                >
                                                    {t.replace(/([A-Z])/g, ' $1')}
                                                </Label>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Constraints & Parameters */}
                        <Card className="rounded-[2rem] border-slate-200/60 dark:border-slate-800/60 shadow-xl overflow-hidden">
                            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b p-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                                        <CalendarIconLucide className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-sm font-black uppercase tracking-wider">Parameters</CardTitle>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Schedule & Scope</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 space-y-8">
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dimensional Scope</Label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div
                                            onClick={() => setPlanningData({ ...planningData, scope: { ...planningData.scope, topside: !planningData.scope.topside } })}
                                            className={cn(
                                                "p-4 rounded-2xl border-2 flex flex-col gap-3 cursor-pointer transition-all",
                                                planningData.scope.topside
                                                    ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-md"
                                                    : "border-slate-100 dark:border-slate-800 hover:border-slate-200"
                                            )}
                                        >
                                            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", planningData.scope.topside ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400")}>
                                                <Zap className="h-4 w-4" />
                                            </div>
                                            <span className={cn("text-[10px] font-black uppercase tracking-widest", planningData.scope.topside ? "text-blue-600" : "text-slate-400")}>Topside</span>
                                        </div>
                                        <div
                                            onClick={() => setPlanningData({ ...planningData, scope: { ...planningData.scope, subsea: !planningData.scope.subsea } })}
                                            className={cn(
                                                "p-4 rounded-2xl border-2 flex flex-col gap-3 cursor-pointer transition-all",
                                                planningData.scope.subsea
                                                    ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-md"
                                                    : "border-slate-100 dark:border-slate-800 hover:border-slate-200"
                                            )}
                                        >
                                            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", planningData.scope.subsea ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400")}>
                                                <Waves className="h-4 w-4" />
                                            </div>
                                            <span className={cn("text-[10px] font-black uppercase tracking-widest", planningData.scope.subsea ? "text-blue-600" : "text-slate-400")}>Subsea</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inspection Protocol</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="w-full h-14 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 justify-between items-center px-4 hover:bg-slate-50 transition-all text-left group"
                                            >
                                                <div className="flex flex-col gap-0.5 overflow-hidden">
                                                    {planningData.inspectionProgram ? (
                                                        <>
                                                            <span className="text-[11px] font-black uppercase tracking-tight truncate">
                                                                {inspectionPrograms.find((p: any) => p.code === planningData.inspectionProgram)?.program || "Selected Protocol"}
                                                            </span>
                                                            <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest truncate">{planningData.inspectionProgram}</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs font-bold text-slate-400">Select Protocol...</span>
                                                    )}
                                                </div>
                                                <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0 ml-2" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2 rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 z-[100]" align="start" sideOffset={8}>
                                            <div className="max-h-[320px] overflow-y-auto custom-scrollbar space-y-1">
                                                {progLoading ? (
                                                    <div className="p-8 flex flex-col items-center gap-3 opacity-30">
                                                        <div className="h-6 w-6 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
                                                        <p className="text-[10px] font-black uppercase tracking-widest">Syncing Protocols...</p>
                                                    </div>
                                                ) : inspectionPrograms.length > 0 ? (
                                                    inspectionPrograms.map((program: any) => (
                                                        <div
                                                            key={program.id}
                                                            onClick={() => setPlanningData({ ...planningData, inspectionProgram: program.code })}
                                                            className={cn(
                                                                "flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border border-transparent",
                                                                planningData.inspectionProgram === program.code
                                                                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800"
                                                                    : "hover:bg-slate-50 dark:hover:bg-slate-800"
                                                            )}
                                                        >
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className={cn(
                                                                    "text-[11px] font-black uppercase tracking-tight transition-colors",
                                                                    planningData.inspectionProgram === program.code ? "text-blue-600 dark:text-blue-400" : "text-slate-900 dark:text-white"
                                                                )}>
                                                                    {program.program}
                                                                </span>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{program.code}</span>
                                                            </div>
                                                            {planningData.inspectionProgram === program.code && (
                                                                <ShieldCheck className="h-4 w-4 text-blue-500 animate-in zoom-in-50" />
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">No protocols available</div>
                                                )}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Frequency (Day)</Label>
                                        <Input
                                            type="number"
                                            value={planningData.frequency}
                                            onChange={(e) => setPlanningData({ ...planningData, frequency: parseInt(e.target.value) })}
                                            className="rounded-xl h-12 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold"
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className={cn(
                                                        "w-full h-12 rounded-xl justify-start text-left font-bold text-[13px] px-4 border-slate-200 dark:border-slate-800 transition-all hover:bg-slate-50",
                                                        !planningData.inspectionDate && "text-slate-400"
                                                    )}
                                                >
                                                    <CalendarIconLucide className="mr-3 h-4 w-4 text-blue-500 flex-shrink-0" />
                                                    <span className="truncate">
                                                        {planningData.inspectionDate ? format(planningData.inspectionDate, "dd MMM yyyy") : "Pick Date"}
                                                    </span>
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 rounded-3xl border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden bg-white dark:bg-slate-900" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={planningData.inspectionDate}
                                                    onSelect={(date) => date && setPlanningData({ ...planningData, inspectionDate: date })}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Fleet Selection & Ops */}
                    <div className="xl:col-span-8 space-y-8">

                        {/* Global Fleet Inventory */}
                        <Card className="rounded-[2rem] border-slate-200/60 dark:border-slate-800/60 shadow-xl overflow-hidden">
                            <CardHeader className="bg-white dark:bg-slate-900 border-b p-8">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-xl">
                                            <Layers2 className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-black uppercase tracking-tight">Fleet Asset Inventory</CardTitle>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Available Structures & Sub-Systems</p>
                                        </div>
                                    </div>
                                    <div className="relative w-full md:w-80">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            placeholder="Search assets..."
                                            className="rounded-2xl h-12 pl-12 bg-slate-50 dark:bg-slate-950 border-transparent focus:bg-white dark:focus:bg-black transition-all shadow-inner font-bold"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 text-slate-400 font-black text-[10px] uppercase tracking-widest border-b z-10">
                                            <tr>
                                                <th className="px-8 py-4">Structure Identity</th>
                                                <th className="px-8 py-4">Field Location</th>
                                                <th className="px-8 py-4">Classification</th>
                                                <th className="px-8 py-4 text-right">Operational Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {platLoading || pipeLoading ? (
                                                <tr>
                                                    <td colSpan={4} className="px-8 py-20 text-center">
                                                        <div className="flex flex-col items-center gap-3 opacity-30">
                                                            <div className="h-6 w-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                                                            <p className="text-[10px] font-black uppercase tracking-widest">Synchronizing Global Fleet...</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : filteredStructures.length > 0 ? (
                                                filteredStructures.map((s, i) => (
                                                    <tr key={i} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                                                        <td className="px-8 py-5">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                                                    {s.structureType === "PLATFORM" ? <Package className="h-4 w-4" /> : <Layers2 className="h-4 w-4" />}
                                                                </div>
                                                                <div>
                                                                    <div className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">{s.title}</div>
                                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ID: ASSET-S0{i + 1}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-5">
                                                            <div className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-tight">{s.fieldName}</div>
                                                        </td>
                                                        <td className="px-8 py-5">
                                                            <span className={cn(
                                                                "px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest",
                                                                s.structureType === "PLATFORM" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" : "bg-blue-50 text-blue-600 dark:bg-blue-950/30"
                                                            )}>
                                                                {s.structureType}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-5 text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => addStructure(s)}
                                                                className="rounded-xl h-9 px-4 font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all gap-2"
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                                Queue Asset
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-20 text-center">
                                                        <div className="flex flex-col items-center gap-2 opacity-30">
                                                            <Search className="h-8 w-8 text-slate-400" />
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">No assets found matching criteria</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Operational Configuration */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                            {/* Asset Queue / Selected Items */}
                            <Card className="rounded-[2rem] border-slate-200/60 dark:border-slate-800/60 shadow-xl overflow-hidden bg-slate-900 text-white">
                                <CardHeader className="border-b border-white/10 p-6 bg-white/5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-xl bg-blue-500 flex items-center justify-center">
                                                <Navigation className="h-5 w-5" />
                                            </div>
                                            <CardTitle className="text-sm font-black uppercase tracking-wider">Asset Queue</CardTitle>
                                        </div>
                                        <span className="text-[10px] font-black px-2 py-1 rounded bg-white/10">{planningData.selectedStructures.length} Targeted</span>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <div className="space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar pr-2">
                                        {planningData.selectedStructures.length > 0 ? (
                                            planningData.selectedStructures.map((s, i) => (
                                                <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/20 transition-all group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-[10px] font-black">{i + 1}</div>
                                                        <div>
                                                            <div className="text-[10px] font-black uppercase tracking-tight">{s.title}</div>
                                                            <div className="text-[8px] font-bold text-white/40 uppercase tracking-widest">{s.structureType}</div>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeStructure(s.title)}
                                                        className="h-8 w-8 text-white/30 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="py-12 flex flex-col items-center justify-center gap-3 opacity-20 border-2 border-dashed border-white/20 rounded-[2rem]">
                                                <Package className="h-6 w-6" />
                                                <p className="text-[10px] font-black uppercase tracking-widest">No assets queued</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Deployment Parameters */}
                            <Card className="rounded-[2rem] border-slate-200/60 dark:border-slate-800/60 shadow-xl overflow-hidden">
                                <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b p-6">
                                    <CardTitle className="text-sm font-black uppercase tracking-wider">Operational Mode</CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 space-y-6">
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Deployment Type</Label>
                                        <RadioGroup
                                            value={planningData.inspectionMode}
                                            onValueChange={(val: any) => setPlanningData({ ...planningData, inspectionMode: val })}
                                            className="grid grid-cols-1 gap-3"
                                        >
                                            <Label className={cn(
                                                "flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer",
                                                planningData.inspectionMode === "ROV" ? "border-blue-500 bg-blue-50/50 text-blue-600 shadow-md" : "border-slate-100 hover:border-slate-200"
                                            )}>
                                                <div className="flex items-center gap-3">
                                                    <Zap className="h-4 w-4" />
                                                    <span className="text-xs font-black uppercase tracking-tight">ROV Support</span>
                                                </div>
                                                <RadioGroupItem value="ROV" className="sr-only" />
                                            </Label>
                                            <Label className={cn(
                                                "flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer",
                                                planningData.inspectionMode === "DIVING" ? "border-blue-500 bg-blue-50/50 text-blue-600 shadow-md" : "border-slate-100 hover:border-slate-200"
                                            )}>
                                                <div className="flex items-center gap-3">
                                                    <Activity className="h-4 w-4" />
                                                    <span className="text-xs font-black uppercase tracking-tight">Diving Intervention</span>
                                                </div>
                                                <RadioGroupItem value="DIVING" className="sr-only" />
                                            </Label>
                                        </RadioGroup>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
