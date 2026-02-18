"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ClipboardCheck, LifeBuoy, Bot, ChevronRight, Building2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface JobPack {
    id: number;
    jobpack_no: string;
    jobpack_title: string;
    structure_name: string;
    status: string;
    structures: Array<{ id: number; name: string }>;
}

interface Structure {
    id: number;
    name: string;
}

interface SOWReport {
    sow_id: number;
    item_no: string;
    report_number: string;
    scope_description: string;
    inspection_method: string;
    structure_id: number;
}

export default function InspectionLanding() {
    const router = useRouter();
    const supabase = createClient();

    const [jobPacks, setJobPacks] = useState<JobPack[]>([]);
    const [structures, setStructures] = useState<Structure[]>([]);
    const [sowReports, setSOWReports] = useState<SOWReport[]>([]);

    const [selectedJobPack, setSelectedJobPack] = useState<string>("");
    const [selectedStructure, setSelectedStructure] = useState<string>("");
    const [selectedSOW, setSelectedSOW] = useState<string>("");
    const [selectedMode, setSelectedMode] = useState<string>("");
    const [loading, setLoading] = useState(true);

    // Restore saved selections on mount
    useEffect(() => {
        loadJobPacks();
    }, []);

    // Restore selections AFTER jobPacks are loaded
    useEffect(() => {
        if (jobPacks.length > 0) {
            const savedJobPack = sessionStorage.getItem("inspection_jobpack");
            const savedStructure = sessionStorage.getItem("inspection_structure");
            const savedSOW = sessionStorage.getItem("inspection_sow");
            const savedMode = sessionStorage.getItem("inspection_mode");

            if (savedJobPack && !selectedJobPack) {
                setSelectedJobPack(savedJobPack);
                // loadStructures will be triggered by the useEffect below
            }
            if (savedStructure && !selectedStructure) {
                setSelectedStructure(savedStructure);
                // loadSOWReports will be triggered by the useEffect below
            }
            if (savedSOW && !selectedSOW) {
                setSelectedSOW(savedSOW);
            }
            if (savedMode && !selectedMode) {
                setSelectedMode(savedMode);
            }
        }
    }, [jobPacks]);

    // Save selections to sessionStorage whenever they change
    useEffect(() => {
        if (selectedJobPack) {
            sessionStorage.setItem("inspection_jobpack", selectedJobPack);
        }
    }, [selectedJobPack]);

    useEffect(() => {
        if (selectedStructure) {
            sessionStorage.setItem("inspection_structure", selectedStructure);
        }
    }, [selectedStructure]);

    useEffect(() => {
        if (selectedSOW) {
            sessionStorage.setItem("inspection_sow", selectedSOW);
        }
    }, [selectedSOW]);

    useEffect(() => {
        if (selectedMode) {
            sessionStorage.setItem("inspection_mode", selectedMode);
        }
    }, [selectedMode]);

    // Load structures when job pack is selected
    useEffect(() => {
        if (selectedJobPack) {
            loadStructures(selectedJobPack);
        } else {
            setStructures([]);
            setSelectedStructure("");
            setSOWReports([]);
            setSelectedSOW("");
            setSelectedMode("");
        }
    }, [selectedJobPack]);

    // Load SOW reports when structure is selected
    useEffect(() => {
        if (selectedStructure && selectedJobPack) {
            loadSOWReports(selectedJobPack, selectedStructure);
        } else {
            setSOWReports([]);
            setSelectedSOW("");
            setSelectedMode("");
        }
    }, [selectedStructure]);

    async function loadJobPacks() {
        try {
            const { data, error } = await supabase
                .from("jobpack")
                .select(`
          id,
          name,
          metadata,
          status
        `)
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error from Supabase:", error);
                throw error;
            }

            console.log("Raw jobpack data:", data);

            if (data && data.length > 0) {
                // Extract structure IDs from metadata.structures array
                const structureIds: number[] = [];
                data.forEach((jp: any) => {
                    const structures = (jp.metadata as any)?.structures || [];
                    structures.forEach((s: any) => {
                        if (s.id && typeof s.id === 'number') {
                            structureIds.push(s.id);
                        }
                    });
                });

                const uniqueStructureIds = Array.from(new Set(structureIds));
                console.log("Extracted structure IDs from metadata:", uniqueStructureIds);

                let structureMap = new Map<number, string>();

                if (uniqueStructureIds.length > 0) {
                    const { data: structureData } = await supabase
                        .from("structure")
                        .select("str_id, str_name")
                        .in("str_id", uniqueStructureIds);

                    console.log("Structure data:", structureData);

                    structureMap = new Map(
                        structureData?.map((s: any) => [s.str_id, s.str_name]) || []
                    );
                }

                const formatted = data.map((jp: any) => {
                    const structures = (jp.metadata as any)?.structures || [];
                    const structureList = structures
                        .map((s: any) => ({
                            id: s.id,
                            name: structureMap.get(s.id) || s.title || s.code || s.name || ""
                        }))
                        .filter((s: Structure) => s.name !== "");

                    const structureNames = structureList
                        .map((s: Structure) => s.name)
                        .join(", ");

                    return {
                        id: jp.id,
                        jobpack_no: jp.name || `JP-${jp.id}`,
                        jobpack_title: (jp.metadata as any)?.plantype || jp.name || "Untitled",
                        structure_name: structureNames || "No structure",
                        status: jp.status || "OPEN",
                        structures: structureList,
                    };
                });

                console.log("Formatted jobpack data:", formatted);
                setJobPacks(formatted);
            } else {
                setJobPacks([]);
            }
        } catch (error) {
            console.error("Error loading job packs:", error);
            toast.error("Failed to load job packs");
        } finally {
            setLoading(false);
        }
    }

    async function loadStructures(jobPackId: string) {
        const jobPack = jobPacks.find(jp => jp.id.toString() === jobPackId);
        if (jobPack) {
            setStructures(jobPack.structures);

            // Auto-select if only one structure
            if (jobPack.structures.length === 1) {
                setSelectedStructure(jobPack.structures[0].id.toString());
            }
        }
    }

    async function loadSOWReports(jobPackId: string, structureId: string) {
        try {
            console.log("Loading SOW reports for job pack:", jobPackId, "structure:", structureId);

            // Load from u_sow table linked to jobpack and structure
            const { data: sowData, error: sowError } = await supabase
                .from("u_sow")
                .select(`
          id,
          jobpack_id,
          structure_id,
          structure_title,
          report_numbers,
          metadata
        `)
                .eq("jobpack_id", jobPackId)
                .eq("structure_id", structureId);

            if (sowError) {
                console.error("Error loading u_sow:", sowError);
                throw sowError;
            }

            console.log("Raw u_sow data:", sowData);

            if (!sowData || sowData.length === 0) {
                setSOWReports([]);
                return;
            }

            // Load SOW items from u_sow_items for each SOW
            const sowIds = sowData.map((sow: any) => sow.id);

            const { data: itemsData, error: itemsError } = await supabase
                .from("u_sow_items")
                .select(`
          id,
          sow_id,
          report_number,
          inspection_code,
          inspection_name,
          component_type,
          component_qid
        `)
                .in("sow_id", sowIds);

            if (itemsError) {
                console.error("Error loading u_sow_items:", itemsError);
            }

            console.log("Raw u_sow_items data:", itemsData);

            // Group by distinct report numbers (not individual inspection codes)
            const formatted: SOWReport[] = [];
            const reportNumbersSet = new Set<string>();

            sowData.forEach((sow: any) => {
                const sowItems = itemsData?.filter((item: any) =>
                    item.sow_id === sow.id
                ) || [];

                // Get distinct report numbers from this SOW
                sowItems.forEach((item: any) => {
                    const reportNum = item.report_number || `${sow.structure_title}-${item.id}`;

                    // Only add if not already added (distinct)
                    const uniqueKey = `${sow.id}-${reportNum}`;
                    if (!reportNumbersSet.has(uniqueKey)) {
                        reportNumbersSet.add(uniqueKey);

                        formatted.push({
                            sow_id: sow.id,
                            item_no: item.id?.toString() || reportNum,
                            report_number: reportNum,
                            scope_description: sow.structure_title || "Inspection Report",
                            inspection_method: "", // Not shown, just for compatibility
                            structure_id: sow.structure_id,
                        });
                    }
                });
            });

            console.log("Formatted distinct SOW reports:", formatted);
            setSOWReports(formatted);

            // Auto-select if only one distinct report
            if (formatted.length === 1) {
                setSelectedSOW(`${formatted[0].sow_id}-${formatted[0].item_no}`);
                console.log("Auto-selected SOW:", formatted[0]);
            } else {
                // Check if there's a saved SOW that matches
                const savedSOW = sessionStorage.getItem("inspection_sow");
                if (savedSOW && formatted.some(f => `${f.sow_id}-${f.item_no}` === savedSOW)) {
                    // Keep the saved selection
                } else {
                    setSelectedSOW("");
                    setSelectedMode("");
                }
            }
        } catch (error) {
            console.error("Error loading SOW reports:", error);
            toast.error("Failed to load SOW reports");
        }
    }

    function handleSOWChange(sowId: string) {
        setSelectedSOW(sowId);
        const sow = sowReports.find((s) => `${s.sow_id}-${s.item_no}` === sowId);
        if (sow) {
            setSelectedMode(sow.inspection_method);
        }
    }

    function handleStart() {
        if (!selectedJobPack || !selectedStructure || !selectedSOW || !selectedMode) {
            toast.error("Please complete all selections");
            return;
        }

        // Navigate to appropriate inspection screen
        if (selectedMode === "DIVING") {
            router.push(`/dashboard/inspection/dive?jobpack=${selectedJobPack}&structure=${selectedStructure}&sow=${selectedSOW}`);
        } else if (selectedMode === "ROV") {
            router.push(`/dashboard/inspection/rov?jobpack=${selectedJobPack}&structure=${selectedStructure}&sow=${selectedSOW}`);
        }
    }

    const selectedJobPackData = jobPacks.find((jp) => jp.id.toString() === selectedJobPack);
    const selectedStructureData = structures.find((s) => s.id.toString() === selectedStructure);
    const selectedSOWData = sowReports.find((s) => `${s.sow_id}-${s.item_no}` === selectedSOW);

    return (
        <div className="min-h-screen max-h-screen overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-blue-950/10 dark:to-slate-950">
            <div className="container max-w-5xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/20">
                            <ClipboardCheck className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                                Inspection Module
                            </h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Select job pack, structure, SOW report, and inspection method to begin
                            </p>
                        </div>
                    </div>
                </div>

                {/* Selection Card */}
                <Card className="p-8 shadow-xl border-slate-200/60 dark:border-slate-800">
                    <div className="space-y-8">
                        {/* Job Pack Selection */}
                        <div className="space-y-3">
                            <Label className="text-base font-semibold text-slate-900 dark:text-white">
                                1. Select Job Pack
                            </Label>
                            <Select value={selectedJobPack} onValueChange={setSelectedJobPack}>
                                <SelectTrigger className="h-12 text-base">
                                    <SelectValue placeholder="Choose a job pack..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {jobPacks.map((jp) => (
                                        <SelectItem key={jp.id} value={jp.id.toString()}>
                                            <div className="flex flex-col gap-1 py-1">
                                                <div className="font-semibold">{jp.jobpack_no}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {jp.jobpack_title} • {jp.structure_name}
                                                </div>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {selectedJobPackData && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                            {selectedJobPackData.jobpack_title}
                                        </p>
                                        <p className="text-xs text-blue-700 dark:text-blue-300">
                                            {selectedJobPackData.structures.length} structure(s): {selectedJobPackData.structure_name}
                                        </p>
                                    </div>
                                    <span className="px-2 py-1 text-xs font-bold rounded-full bg-blue-600 text-white">
                                        {selectedJobPackData.status}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Structure Selection */}
                        <div className="space-y-3">
                            <Label className="text-base font-semibold text-slate-900 dark:text-white">
                                2. Select Structure
                            </Label>
                            <Select
                                value={selectedStructure}
                                onValueChange={setSelectedStructure}
                                disabled={!selectedJobPack || structures.length === 0}
                            >
                                <SelectTrigger className="h-12 text-base">
                                    <SelectValue placeholder={
                                        !selectedJobPack
                                            ? "Select a job pack first..."
                                            : structures.length === 0
                                                ? "No structures available"
                                                : "Choose structure..."
                                    } />
                                </SelectTrigger>
                                <SelectContent>
                                    {structures.map((struct) => (
                                        <SelectItem key={struct.id} value={struct.id.toString()}>
                                            <div className="flex items-center gap-2 py-1">
                                                <Building2 className="h-4 w-4 text-slate-500" />
                                                <span className="font-semibold">{struct.name}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {selectedStructureData && (
                                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                                    <p className="text-sm font-medium text-green-900 dark:text-green-100 flex items-center gap-2">
                                        <Building2 className="h-4 w-4" />
                                        {selectedStructureData.name}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* SOW Report Selection */}
                        <div className="space-y-3">
                            <Label className="text-base font-semibold text-slate-900 dark:text-white">
                                3. Select Job/SOW Report Number
                            </Label>
                            <Select
                                value={selectedSOW}
                                onValueChange={handleSOWChange}
                                disabled={!selectedStructure || sowReports.length === 0}
                            >
                                <SelectTrigger className="h-12 text-base">
                                    <SelectValue placeholder={
                                        !selectedStructure
                                            ? "Select a structure first..."
                                            : sowReports.length === 0
                                                ? "No SOW reports available"
                                                : "Choose SOW report..."
                                    } />
                                </SelectTrigger>
                                <SelectContent>
                                    {sowReports.map((sow) => (
                                        <SelectItem key={`${sow.sow_id}-${sow.item_no}`} value={`${sow.sow_id}-${sow.item_no}`}>
                                            <span className="font-semibold">{sow.report_number}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {selectedSOWData && (
                                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
                                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                                        {selectedSOWData.report_number}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Inspection Mode */}
                        <div className="space-y-3">
                            <Label className="text-base font-semibold text-slate-900 dark:text-white">
                                4. Inspection Method
                            </Label>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Diving Mode */}
                                <button
                                    onClick={() => setSelectedMode("DIVING")}
                                    disabled={!selectedSOW}
                                    className={`
                    relative p-6 rounded-xl border-2 transition-all duration-200
                    ${!selectedSOW
                                            ? "opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800"
                                            : selectedMode === "DIVING"
                                                ? "border-blue-600 bg-blue-50 dark:bg-blue-950/30 shadow-lg shadow-blue-500/20"
                                                : "border-slate-200 dark:border-slate-800 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/10"
                                        }
                  `}
                                >
                                    <div className="flex flex-col items-center gap-3">
                                        <div className={`
                      p-3 rounded-xl transition-colors
                      ${selectedMode === "DIVING"
                                                ? "bg-blue-600 text-white"
                                                : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                            }
                    `}>
                                            <LifeBuoy className="h-8 w-8" />
                                        </div>
                                        <div className="text-center">
                                            <p className="font-bold text-lg">Diving</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Air or Bell Dive Inspection
                                            </p>
                                        </div>
                                        {selectedMode === "DIVING" && (
                                            <div className="absolute top-2 right-2">
                                                <div className="w-3 h-3 rounded-full bg-blue-600 animate-pulse" />
                                            </div>
                                        )}
                                    </div>
                                </button>

                                {/* ROV Mode */}
                                <button
                                    onClick={() => setSelectedMode("ROV")}
                                    disabled={!selectedSOW}
                                    className={`
                    relative p-6 rounded-xl border-2 transition-all duration-200
                    ${!selectedSOW
                                            ? "opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800"
                                            : selectedMode === "ROV"
                                                ? "border-cyan-600 bg-cyan-50 dark:bg-cyan-950/30 shadow-lg shadow-cyan-500/20"
                                                : "border-slate-200 dark:border-slate-800 hover:border-cyan-400 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/10"
                                        }
                  `}
                                >
                                    <div className="flex flex-col items-center gap-3">
                                        <div className={`
                      p-3 rounded-xl transition-colors
                      ${selectedMode === "ROV"
                                                ? "bg-cyan-600 text-white"
                                                : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                            }
                    `}>
                                            <Bot className="h-8 w-8" />
                                        </div>
                                        <div className="text-center">
                                            <p className="font-bold text-lg">ROV</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Remotely Operated Vehicle
                                            </p>
                                        </div>
                                        {selectedMode === "ROV" && (
                                            <div className="absolute top-2 right-2">
                                                <div className="w-3 h-3 rounded-full bg-cyan-600 animate-pulse" />
                                            </div>
                                        )}
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Start Button */}
                        <div className="pt-4">
                            <Button
                                onClick={handleStart}
                                disabled={!selectedJobPack || !selectedStructure || !selectedSOW || !selectedMode}
                                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg shadow-blue-500/20"
                            >
                                <span>Start Inspection</span>
                                <ChevronRight className="h-5 w-5 ml-2" />
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* Info Cards */}
                <div className="grid grid-cols-4 gap-4 mt-6">
                    <Card className="p-4 bg-blue-50/50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-900">
                        <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-1">
                            Job Packs
                        </p>
                        <p className="text-2xl font-black text-blue-600">
                            {jobPacks.length}
                        </p>
                    </Card>
                    <Card className="p-4 bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-900">
                        <p className="text-xs font-semibold text-green-900 dark:text-green-100 mb-1">
                            Structures
                        </p>
                        <p className="text-2xl font-black text-green-600">
                            {selectedJobPack ? structures.length : "—"}
                        </p>
                    </Card>
                    <Card className="p-4 bg-cyan-50/50 dark:bg-cyan-950/10 border-cyan-200 dark:border-cyan-900">
                        <p className="text-xs font-semibold text-cyan-900 dark:text-cyan-100 mb-1">
                            SOW Reports
                        </p>
                        <p className="text-2xl font-black text-cyan-600">
                            {selectedStructure ? sowReports.length : "—"}
                        </p>
                    </Card>
                    <Card className="p-4 bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800">
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                            Method
                        </p>
                        <p className="text-2xl font-black text-slate-600 dark:text-slate-400">
                            {selectedMode || "—"}
                        </p>
                    </Card>
                </div>
            </div>
        </div>
    );
}
