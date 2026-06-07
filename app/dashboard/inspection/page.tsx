"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ClipboardCheck, LifeBuoy, Bot, ChevronRight, Building2, Search, ChevronDown, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
interface JobPack {
    id: number;
    jobpack_no: string;
    jobpack_title: string;
    structure_name: string;
    status: string;
    structures: Array<{ id: number; name: string }>;
    start_date?: string;
    year: string;
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

    // Filter states
    const [openJP, setOpenJP] = useState(false);
    const [searchJP, setSearchJP] = useState("");

    const [openStruct, setOpenStruct] = useState(false);
    const [searchStruct, setSearchStruct] = useState("");

    const [openSOW, setOpenSOW] = useState(false);
    const [searchSOW, setSearchSOW] = useState("");

    // State to track which years are expanded in the jobpack list
    const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});

    const selectedJobPackData = jobPacks.find((jp) => jp.id.toString() === selectedJobPack);
    const selectedStructureData = structures.find((s) => s.id.toString() === selectedStructure);
    const selectedSOWData = sowReports.find((s) => `${s.sow_id}-${s.item_no}` === selectedSOW);

    const filteredJobPacks = jobPacks.filter((jp) => {
        const search = searchJP.toLowerCase();
        return (
            jp.jobpack_no?.toLowerCase().includes(search) ||
            jp.jobpack_title?.toLowerCase().includes(search) ||
            jp.structure_name?.toLowerCase().includes(search)
        );
    });

    const filteredStructures = structures.filter((s) =>
        s.name.toLowerCase().includes(searchStruct.toLowerCase())
    );

    const filteredSOWs = sowReports.filter((s) =>
        s.report_number.toLowerCase().includes(searchSOW.toLowerCase())
    );

    // Group filtered jobpacks by year
    const jobPacksByYear: Record<string, JobPack[]> = {};
    filteredJobPacks.forEach(jp => {
        const yr = jp.year || "Unknown Year";
        if (!jobPacksByYear[yr]) {
            jobPacksByYear[yr] = [];
        }
        jobPacksByYear[yr].push(jp);
    });

    // Get sorted years descending (Unknown Year at the end)
    const sortedYears = Object.keys(jobPacksByYear).sort((a, b) => {
        if (a === "Unknown Year") return 1;
        if (b === "Unknown Year") return -1;
        return b.localeCompare(a); // Descending order
    });

    // Restore saved selections on mount and check for redirect
    useEffect(() => {
        // Redirect to V2 as per main branch behavior
        router.push("/dashboard/inspection-v2");
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

    // Expand the selected job pack's year by default
    useEffect(() => {
        if (selectedJobPackData?.year) {
            setExpandedYears(prev => ({ ...prev, [selectedJobPackData.year]: true }));
        }
    }, [selectedJobPack, selectedJobPackData]);

    // Auto-expand all matching years during search
    useEffect(() => {
        if (searchJP.trim() !== "") {
            const yearsWithMatches: Record<string, boolean> = {};
            filteredJobPacks.forEach(jp => {
                yearsWithMatches[jp.year] = true;
            });
            setExpandedYears(yearsWithMatches);
        }
    }, [searchJP, filteredJobPacks]);

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

    // Load SOW reports when structure is selected OR jobpack changes
    useEffect(() => {
        if (selectedStructure && selectedJobPack) {
            loadSOWReports(selectedJobPack, selectedStructure);
        } else {
            setSOWReports([]);
            setSelectedSOW("");
            setSelectedMode("");
        }
    }, [selectedStructure, selectedJobPack]);

    async function loadJobPacks() {
        try {
            const res = await fetch("/api/jobpack?limit=1000");
            if (!res.ok) {
                throw new Error(`Failed to fetch jobpacks: ${res.statusText}`);
            }
            const resJson = await res.json();
            const data = resJson.data;

            console.log("Raw jobpack data from API:", data);

            if (data && data.length > 0) {
                // Extract structure IDs from metadata.structures array
                const structureIds: number[] = [];
                data.forEach((jp: any) => {
                    const structures = (jp.metadata as any)?.structures || [];
                    if (Array.isArray(structures)) {
                        structures.forEach((s: any) => {
                            if (s.id && typeof s.id === 'number') {
                                structureIds.push(s.id);
                            }
                        });
                    }
                });

                const uniqueStructureIds = Array.from(new Set(structureIds));
                console.log("Extracted structure IDs from metadata:", uniqueStructureIds);

                let structureMap = new Map<number, string>();

                if (uniqueStructureIds.length > 0) {
                    const [platformsRes, pipelinesRes] = await Promise.all([
                        fetch("/api/platform?limit=1000").then(r => r.json()),
                        fetch("/api/pipeline?limit=1000").then(r => r.json())
                    ]);

                    const platforms = platformsRes.data || [];
                    const pipelines = pipelinesRes.data || [];

                    platforms.forEach((p: any) => {
                        structureMap.set(p.plat_id, p.title);
                    });

                    pipelines.forEach((p: any) => {
                        structureMap.set(p.pipe_id, p.title);
                    });
                }

                const formatted = data.map((jp: any) => {
                    const structures = (jp.metadata as any)?.structures || [];
                    const structureList = Array.isArray(structures)
                        ? structures
                            .map((s: any) => ({
                                id: Number(s.id),
                                name: structureMap.get(Number(s.id)) || s.title || s.code || s.name || ""
                            }))
                            .filter((s: Structure) => s.name !== "")
                        : [];

                    const structureNames = structureList
                        .map((s: Structure) => s.name)
                        .join(", ");

                    // Extract start date and year
                    const start_date = (jp.metadata as any)?.istart;
                    let year = "Unknown Year";
                    if (start_date) {
                        const match = start_date.match(/^(\d{4})/);
                        if (match) {
                            year = match[1];
                        }
                    }
                    if (year === "Unknown Year" && jp.name) {
                        const match = jp.name.match(/\b(19\d{2}|20\d{2})\b/);
                        if (match) {
                            year = match[1];
                        }
                    }

                    return {
                        id: jp.id,
                        jobpack_no: jp.name || `JP-${jp.id}`,
                        jobpack_title: (jp.metadata as any)?.plantype || jp.name || "Untitled",
                        structure_name: structureNames || "No structure",
                        status: jp.status || "OPEN",
                        structures: structureList,
                        start_date: start_date || undefined,
                        year,
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
            } else {
                // Clear selected structure if it's not in the new job pack's structure list
                setSelectedStructure(prev => {
                    if (!prev) return "";
                    const stillValid = jobPack.structures.some((s: any) => s.id.toString() === prev);
                    return stillValid ? prev : "";
                });
            }
        }
    }

    async function loadSOWReports(jobPackId: string, structureId: string) {
        try {
            console.log("Loading SOW reports via API for job pack:", jobPackId, "structure:", structureId);

            const res = await fetch(`/api/sow?jobpack_id=${jobPackId}&structure_id=${structureId}`);
            if (!res.ok) {
                throw new Error(`Failed to fetch SOW reports: ${res.statusText}`);
            }
            const resJson = await res.json();
            const sow = resJson.data;

            console.log("Raw u_sow data from API:", sow);

            if (!sow) {
                setSOWReports([]);
                return;
            }

            const sowData = [sow];
            const itemsData = sow.items || [];

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
    }

    function handleStart() {
        if (!selectedJobPack || !selectedStructure || !selectedSOW || !selectedMode) {
            toast.error("Please complete all selections");
            return;
        }

        router.push(`/dashboard/inspection/workspace?jobpack=${selectedJobPack}&structure=${selectedStructure}&sow=${selectedSOW}&mode=${selectedMode}`);
    }



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
                <Card className="p-1 shadow-xl border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden rounded-2xl">
                    <div className="bg-slate-50/50 dark:bg-slate-900/50 p-6 sm:p-8 space-y-8 rounded-xl">
                        {/* Job Pack Selection */}
                        <div className="space-y-3">
                            <Label className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                1. Select Job Pack
                            </Label>

                            <Popover open={openJP} onOpenChange={setOpenJP}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openJP}
                                        className={`w-full justify-between h-auto py-3 px-4 font-normal bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-900 ${selectedJobPack ? "border-blue-300 dark:border-blue-700 ring-1 ring-blue-100 dark:ring-blue-900/40" : ""}`}
                                    >
                                        {selectedJobPackData ? (
                                            <div className="flex flex-col items-start gap-0.5 w-full overflow-hidden text-left">
                                                <span className="font-bold text-base text-slate-900 dark:text-slate-100">{selectedJobPackData.jobpack_no}</span>
                                                <span className="text-xs text-slate-500 truncate w-full uppercase tracking-wider font-semibold">
                                                    {selectedJobPackData.jobpack_title} • {selectedJobPackData.structure_name}
                                                </span>
                                                {selectedJobPackData.start_date && (
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                                        Start Date: {new Date(selectedJobPackData.start_date).toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground text-base">Choose a job pack...</span>
                                        )}
                                        <ChevronDown className="ml-2 h-5 w-5 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[calc(100vw-3rem)] sm:w-[500px] md:w-[600px] p-0 rounded-xl shadow-xl z-50 overflow-hidden border-slate-200 dark:border-slate-800"
                                    align="start"
                                >
                                    <div className="flex items-center border-b px-3 text-slate-500 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                        <input
                                            className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 font-medium"
                                            placeholder="Search by job pack, title, or structure..."
                                            value={searchJP}
                                            onChange={(e) => setSearchJP(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="max-h-[350px] overflow-y-auto p-2 bg-white dark:bg-slate-950">
                                        {filteredJobPacks.length === 0 ? (
                                            <div className="py-8 text-center text-sm text-slate-500 font-medium">No job pack found matching your search.</div>
                                        ) : (
                                            sortedYears.map((year) => {
                                                const jpsInYear = jobPacksByYear[year];
                                                const isExpanded = !!expandedYears[year];

                                                return (
                                                    <div key={year} className="mb-2">
                                                        {/* Year Group Header */}
                                                        <div
                                                            onClick={() => setExpandedYears(prev => ({ ...prev, [year]: !prev[year] }))}
                                                            className="flex items-center justify-between px-3 py-2 bg-slate-50/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer select-none font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 border border-slate-200/40 dark:border-slate-800/40 mb-1"
                                                        >
                                                            <div className="flex items-center gap-1.5">
                                                                {isExpanded ? (
                                                                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                                                                ) : (
                                                                    <ChevronRight className="h-3.5 w-3.5 opacity-70" />
                                                                )}
                                                                <span>Year {year}</span>
                                                            </div>
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                                                                {jpsInYear.length} {jpsInYear.length === 1 ? "job pack" : "job packs"}
                                                            </span>
                                                        </div>

                                                        {/* Job Packs under this Year */}
                                                        {isExpanded && (
                                                            <div className="pl-3 border-l border-slate-100 dark:border-slate-850 ml-3.5 space-y-1 mt-1">
                                                                {jpsInYear.map((jp) => (
                                                                    <div
                                                                        key={jp.id}
                                                                        onClick={() => {
                                                                            setSelectedJobPack(jp.id.toString());
                                                                            setOpenJP(false);
                                                                            setSearchJP("");
                                                                            if (jp.structures.length > 1) {
                                                                                setTimeout(() => setOpenStruct(true), 150);
                                                                            }
                                                                        }}
                                                                        className={`relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 mb-0.5 text-sm outline-none transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${selectedJobPack === jp.id.toString() ? "bg-blue-50 dark:bg-blue-900/20 shadow-sm ring-1 ring-blue-100/70 dark:ring-blue-800/40" : ""}`}
                                                                    >
                                                                        <div className="flex flex-col gap-0.5 w-full pr-8">
                                                                            <div className={`font-bold text-[15px] ${selectedJobPack === jp.id.toString() ? "text-blue-700 dark:text-blue-300" : "text-slate-900 dark:text-slate-100"}`}>
                                                                                {jp.jobpack_no}
                                                                            </div>
                                                                            <div className="text-[11px] text-slate-500 truncate w-full uppercase tracking-wider font-semibold">
                                                                                {jp.jobpack_title} • {jp.structure_name}
                                                                            </div>
                                                                            {jp.start_date && (
                                                                                <div className="text-[10px] text-slate-450 dark:text-slate-500 font-medium mt-0.5">
                                                                                    Start Date: {new Date(jp.start_date).toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {selectedJobPack === jp.id.toString() && (
                                                                            <div className="absolute right-3 shrink-0 text-blue-600 dark:text-blue-400">
                                                                                <Check className="h-4 w-4" />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </PopoverContent>
                            </Popover>

                            {selectedJobPackData && (
                                <div className="flex items-center justify-between p-4 mt-2 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 shadow-sm transition-all animate-in fade-in slide-in-from-top-2">
                                    <div className="flex-1 pr-4 space-y-1">
                                        <p className="text-sm font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wider">
                                            {selectedJobPackData.jobpack_title}
                                        </p>
                                        <p className="text-[13px] font-medium text-blue-700 dark:text-blue-300">
                                            {selectedJobPackData.structures.length} structure(s): {selectedJobPackData.structure_name}
                                        </p>
                                        {selectedJobPackData.start_date && (
                                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                                Start Date: <span className="font-bold text-slate-700 dark:text-slate-350">{new Date(selectedJobPackData.start_date).toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                            </p>
                                        )}
                                    </div>
                                    <div className="shrink-0 flex items-center gap-3 border-l pl-4 border-blue-200 dark:border-blue-800/50">
                                        <span className="px-3 py-1 text-xs font-black tracking-wider rounded-full bg-blue-600 text-white shadow-sm uppercase shadow-blue-500/30">
                                            OPEN
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Structure Selection */}
                        <div className={`space-y-3 transition-opacity duration-300 ${!selectedJobPack ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
                            <Label className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                2. Select Structure
                            </Label>

                            <Popover open={openStruct} onOpenChange={setOpenStruct}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openStruct}
                                        disabled={!selectedJobPack || structures.length === 0}
                                        className={`w-full justify-between h-14 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-900 ${selectedStructure ? "border-green-400 dark:border-green-600 ring-2 ring-green-100 dark:ring-green-900/40" : ""}`}
                                    >
                                        <div className="flex items-center gap-3 font-semibold text-base text-slate-900 dark:text-slate-100">
                                            <Building2 className={`h-5 w-5 ${selectedStructure ? "text-green-600 dark:text-green-400" : "text-slate-400"}`} />
                                            {selectedStructureData ? selectedStructureData.name : (!selectedJobPack ? "Select a job pack first..." : structures.length === 0 ? "No structures available" : "Choose structure...")}
                                        </div>
                                        <ChevronDown className="h-5 w-5 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[calc(100vw-3rem)] sm:w-[500px] md:w-[600px] p-0 rounded-xl shadow-xl z-50 border-slate-200 dark:border-slate-800" align="start">
                                    <div className="flex items-center border-b px-3 text-slate-500 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                        <input
                                            className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 font-medium"
                                            placeholder="Search structure..."
                                            value={searchStruct}
                                            onChange={(e) => setSearchStruct(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto p-2 bg-white dark:bg-slate-950">
                                        {filteredStructures.length === 0 ? (
                                            <div className="py-8 text-center text-sm text-slate-500 font-medium">No structure found.</div>
                                        ) : (
                                            filteredStructures.map((struct) => (
                                                <div
                                                    key={struct.id}
                                                    onClick={() => {
                                                        setSelectedStructure(struct.id.toString());
                                                        setOpenStruct(false);
                                                        setSearchStruct("");
                                                        setTimeout(() => setOpenSOW(true), 150);
                                                    }}
                                                    className={`relative flex justify-between cursor-pointer select-none items-center rounded-lg px-3 py-3 mb-1 text-sm outline-none transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${selectedStructure === struct.id.toString() ? "bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-800/50" : ""}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Building2 className={`h-5 w-5 ${selectedStructure === struct.id.toString() ? "text-green-600 dark:text-green-500" : "text-slate-400"}`} />
                                                        <span className={`font-bold text-base ${selectedStructure === struct.id.toString() ? "text-green-900 dark:text-green-100" : "text-slate-800 dark:text-slate-200"}`}>{struct.name}</span>
                                                    </div>
                                                    {selectedStructure === struct.id.toString() && (
                                                        <Check className="h-5 w-5 text-green-600 dark:text-green-500" />
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </PopoverContent>
                            </Popover>

                            {selectedStructureData && (
                                <div className="p-4 rounded-xl bg-green-50/80 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 shadow-sm transition-all animate-in fade-in slide-in-from-top-2 flex items-center gap-3">
                                    <Building2 className="h-5 w-5 text-green-600 dark:text-green-500" />
                                    <p className="text-sm font-bold text-green-900 dark:text-green-100 uppercase tracking-wider">
                                        {selectedStructureData.name}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* SOW Report Selection */}
                        <div className={`space-y-3 transition-opacity duration-300 ${!selectedStructure ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
                            <Label className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                3. Select Job/SOW Report Number
                            </Label>

                            <Popover open={openSOW} onOpenChange={setOpenSOW}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openSOW}
                                        disabled={!selectedStructure || sowReports.length === 0}
                                        className={`w-full justify-between h-14 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-900 ${selectedSOW ? "border-slate-400 dark:border-slate-600 ring-1 ring-slate-100 dark:ring-slate-800" : ""}`}
                                    >
                                        <div className="font-semibold text-base text-slate-900 dark:text-slate-100">
                                            {selectedSOWData ? selectedSOWData.report_number : (!selectedStructure ? "Select a structure first..." : sowReports.length === 0 ? "No SOW reports available" : "Choose SOW report...")}
                                        </div>
                                        <ChevronDown className="h-5 w-5 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[calc(100vw-3rem)] sm:w-[500px] md:w-[600px] p-0 rounded-xl shadow-xl z-50 border-slate-200 dark:border-slate-800" align="start">
                                    <div className="flex items-center border-b px-3 text-slate-500 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                        <input
                                            className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 font-medium"
                                            placeholder="Search SOW report..."
                                            value={searchSOW}
                                            onChange={(e) => setSearchSOW(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto p-2 bg-white dark:bg-slate-950">
                                        {filteredSOWs.length === 0 ? (
                                            <div className="py-8 text-center text-sm text-slate-500 font-medium">No SOW report found.</div>
                                        ) : (
                                            filteredSOWs.map((sow) => (
                                                <div
                                                    key={`${sow.sow_id}-${sow.item_no}`}
                                                    onClick={() => {
                                                        setSelectedSOW(`${sow.sow_id}-${sow.item_no}`);
                                                        setOpenSOW(false);
                                                        setSearchSOW("");
                                                    }}
                                                    className={`relative flex justify-between cursor-pointer select-none items-center rounded-lg px-3 py-3 mb-1 text-sm outline-none transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${selectedSOW === `${sow.sow_id}-${sow.item_no}` ? "bg-slate-100 dark:bg-slate-800" : ""}`}
                                                >
                                                    <span className="font-bold text-base text-slate-900 dark:text-slate-100">{sow.report_number}</span>
                                                    {selectedSOW === `${sow.sow_id}-${sow.item_no}` && (
                                                        <Check className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Inspection Method Selection */}
                        <div className={`space-y-3 transition-opacity duration-300 ${!selectedSOW ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
                            <Label className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                4. Select Inspection Method
                            </Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div
                                    onClick={() => setSelectedMode("DIVING")}
                                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${selectedMode === "DIVING" 
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md ring-1 ring-blue-200" 
                                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-blue-300 dark:hover:border-blue-700"}`}
                                >
                                    <div className={`p-3 rounded-lg ${selectedMode === "DIVING" ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-500"}`}>
                                        <LifeBuoy className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className={`font-bold text-base ${selectedMode === "DIVING" ? "text-blue-900 dark:text-blue-100" : "text-slate-900 dark:text-slate-100"}`}>Diving</p>
                                        <p className="text-xs text-slate-500 font-medium">Standard diving inspection</p>
                                    </div>
                                    {selectedMode === "DIVING" && <Check className="ml-auto h-5 w-5 text-blue-600" />}
                                </div>

                                <div
                                    onClick={() => setSelectedMode("ROV")}
                                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${selectedMode === "ROV" 
                                        ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 shadow-md ring-1 ring-cyan-200" 
                                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-cyan-300 dark:hover:border-cyan-700"}`}
                                >
                                    <div className={`p-3 rounded-lg ${selectedMode === "ROV" ? "bg-cyan-500 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-500"}`}>
                                        <Bot className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className={`font-bold text-base ${selectedMode === "ROV" ? "text-cyan-900 dark:text-cyan-100" : "text-slate-900 dark:text-slate-100"}`}>ROV</p>
                                        <p className="text-xs text-slate-500 font-medium">Remote operated vehicle</p>
                                    </div>
                                    {selectedMode === "ROV" && <Check className="ml-auto h-5 w-5 text-cyan-600" />}
                                </div>
                            </div>
                        </div>

                        {/* Start Button */}
                        <div className="pt-6">
                            <Button
                                onClick={handleStart}
                                disabled={!selectedJobPack || !selectedStructure || !selectedSOW || !selectedMode}
                                className={`w-full h-16 text-lg font-black transition-all duration-300 ${(!selectedJobPack || !selectedStructure || !selectedSOW || !selectedMode)
                                    ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                                    : "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-600 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:-translate-y-0.5"}`}
                            >
                                <span>Start Inspection</span>
                                <ChevronRight className="h-6 w-6 ml-2" />
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* Info Cards */}
                <div className="grid grid-cols-3 gap-4 mt-6">
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
                </div>
            </div>
        </div>
    );
}
