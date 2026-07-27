"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ClipboardCheck, LifeBuoy, Bot, ChevronRight, Building2, Search, ChevronDown, Check, AlertTriangle, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import inspectionRegistry from "@/utils/types/inspection-types.json";

interface JobPack {
    id: number;
    jobpack_no: string;
    jobpack_title: string;
    structure_name: string;
    status: string;
    structures: Array<{ id: string; name: string; type?: "platform" | "pipeline" }>;
    start_date?: string;
    year: string;
    vessel?: string;
    contractor?: string;
}

interface Structure {
    id: string;
    name: string;
    type?: "platform" | "pipeline";
}

interface SOWReport {
    sow_id: number;
    item_no: string;
    report_number: string;
    job_type?: string;
    scope_description: string;
    inspection_method: string;
    structure_id: number;
}

export default function InspectionLanding() {
    const router = useRouter();
    const supabase = createClient();

    const [jobPacks, setJobPacks] = useState<JobPack[]>([]);
    const [sowReports, setSOWReports] = useState<SOWReport[]>([]);
    const [rawSowItems, setRawSowItems] = useState<any[]>([]);
    const [anomalyCount, setAnomalyCount] = useState<number>(0);

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
    const [searchJobPackStruct, setSearchJobPackStruct] = useState("");

    // State to track which years are expanded in the jobpack list
    const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});

    const [allStructures, setAllStructures] = useState<Structure[]>([]);

    // Derive job packs that are assigned to the selected structure, sorted by start date desc
    const jobPacksForSelectedStructure = useMemo(() => {
        if (!selectedStructure) return [];
        return jobPacks.filter((jp) =>
            jp.structures.some((s) => s.id.toString() === selectedStructure)
        ).sort((a, b) => {
            if (!a.start_date) return 1;
            if (!b.start_date) return -1;
            return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
        });
    }, [jobPacks, selectedStructure]);

    const selectedJobPackData = jobPacks.find((jp) => jp.id.toString() === selectedJobPack);
    const selectedStructureData = allStructures.find((s) => s.id.toString() === selectedStructure);
    const selectedSOWData = sowReports.find((s) => `${s.sow_id}-${s.item_no}` === selectedSOW);

    const filteredJobPacks = useMemo(() => {
        return jobPacksForSelectedStructure.filter((jp) => {
            const search = searchJP.toLowerCase();
            return (
                jp.jobpack_no?.toLowerCase().includes(search) ||
                jp.jobpack_title?.toLowerCase().includes(search) ||
                jp.structure_name?.toLowerCase().includes(search)
            );
        });
    }, [jobPacksForSelectedStructure, searchJP]);

    const filteredStructures = useMemo(() => {
        return allStructures.filter((s) =>
            s.name.toLowerCase().includes(searchStruct.toLowerCase())
        );
    }, [allStructures, searchStruct]);

    const filteredSOWs = useMemo(() => {
        return sowReports.filter((s) =>
            s.report_number.toLowerCase().includes(searchSOW.toLowerCase())
        );
    }, [sowReports, searchSOW]);

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

    // Refresh job packs and structure names when component mounts
    useEffect(() => {
        loadJobPacks();
    }, []);

    // Restore selections AFTER jobPacks are loaded, with query parameters taking priority
    useEffect(() => {
        if (jobPacks.length > 0 && typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const queryJobPack = params.get("jobpack");
            const queryStructure = params.get("structure");
            const querySow = params.get("sow");
            const querySowReport = params.get("sowReport");
            const queryMode = params.get("mode");

            const activeStructure = queryStructure || sessionStorage.getItem("inspection_structure");
            const activeJobPack = queryJobPack || sessionStorage.getItem("inspection_jobpack");
            
            let activeSow = sessionStorage.getItem("inspection_sow");
            if (querySow && querySowReport) {
                activeSow = `${querySow}-${querySowReport}`;
            } else if (querySow) {
                activeSow = querySow;
            }

            const activeMode = queryMode || sessionStorage.getItem("inspection_mode");

            if (activeStructure) {
                setSelectedStructure(activeStructure);
                sessionStorage.setItem("inspection_structure", activeStructure);
            }
            if (activeJobPack) {
                setSelectedJobPack(activeJobPack);
                sessionStorage.setItem("inspection_jobpack", activeJobPack);
            }
            if (activeSow) {
                setSelectedSOW(activeSow);
                sessionStorage.setItem("inspection_sow", activeSow);
            }
            if (activeMode) {
                setSelectedMode(activeMode);
                sessionStorage.setItem("inspection_mode", activeMode);
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

    // Validate and update job pack selection when selected structure changes
    useEffect(() => {
        if (selectedStructure && jobPacks.length > 0) {
            setSelectedJobPack(prev => {
                if (!prev) return "";
                const matchedJp = jobPacks.find(jp => jp.id.toString() === prev);
                const stillValid = matchedJp?.structures.some(s => s.id.toString() === selectedStructure);
                return stillValid ? prev : "";
            });
        }
    }, [selectedStructure, jobPacks]);

    // Load SOW reports when structure and job pack are selected
    useEffect(() => {
        if (selectedStructure && selectedJobPack) {
            loadSOWReports(selectedJobPack, selectedStructure);
        } else {
            setSOWReports([]);
            setSelectedSOW("");
            setSelectedMode("");
        }
    }, [selectedStructure, selectedJobPack]);

    // Fetch anomaly count when SOW report is selected
    useEffect(() => {
        if (selectedStructure && selectedJobPack && selectedSOWData) {
            const structId = selectedStructure;
            const jpId = selectedJobPack;
            const sowReportNo = selectedSOWData.report_number;
            fetchAnomalyCount(structId, jpId, sowReportNo);
        } else {
            setAnomalyCount(0);
        }

        async function fetchAnomalyCount(structId: string, jpId: string, sowReportNo: string) {
            try {
                // Parse prefix e.g., platform-1 or pipeline-1
                const rawId = structId.includes("-") ? structId.split("-")[1] : structId;
                const { count, error } = await supabase
                    .from("insp_anomalies")
                    .select("anomaly_id, insp_records!inner(structure_id, jobpack_id, sow_report_no)", { count: "exact", head: true })
                    .eq("insp_records.structure_id", parseInt(rawId))
                    .eq("insp_records.jobpack_id", parseInt(jpId))
                    .eq("insp_records.sow_report_no", sowReportNo);

                if (!error && count !== null) {
                    setAnomalyCount(count);
                }
            } catch (err) {
                console.error("Error fetching anomaly count:", err);
            }
        }
    }, [selectedStructure, selectedJobPack, selectedSOWData, supabase]);

    // Compute SOW stats for the currently selected report number
    const sowReportStats = useMemo(() => {
        if (!selectedSOWData || rawSowItems.length === 0) return null;

        const currentReportItems = rawSowItems.filter(
            (item) => item.report_number === selectedSOWData.report_number
        );

        const total = currentReportItems.length;
        if (total === 0) return null;

        const completedItems = currentReportItems.filter((item) => item.status === "completed");
        const incompleteItems = currentReportItems.filter((item) => item.status === "incomplete");
        const pendingItems = currentReportItems.filter(
            (item) => item.status === "pending" || !item.status
        );

        // Map items to methods using registry
        let rovDone = 0;
        let diveDone = 0;

        completedItems.forEach((item) => {
            const code = item.inspection_code;
            const registryEntry = (inspectionRegistry as any)?.inspectionTypes?.find(
                (t: any) => t.code === code
            );
            const methods = registryEntry?.methods || [];
            
            if (methods.includes("ROV")) {
                rovDone++;
            }
            if (methods.includes("DIVING")) {
                diveDone++;
            }
        });

        const completionPercentage = Math.round((completedItems.length / total) * 100);

        return {
            total,
            completed: completedItems.length,
            incomplete: incompleteItems.length,
            pending: pendingItems.length,
            rovDone,
            diveDone,
            completionPercentage,
        };
    }, [selectedSOWData, rawSowItems]);

    async function loadJobPacks() {
        try {
            const res = await fetch("/api/jobpack?limit=1000");
            if (!res.ok) {
                throw new Error(`Failed to fetch jobpacks: ${res.statusText}`);
            }
            const resJson = await res.json();
            const data = resJson.data;

            console.log("Raw jobpack data from API:", data);

            // Unconditionally fetch all platforms and pipelines to populate the structure selection list
            const [platformsRes, pipelinesRes] = await Promise.all([
                fetch("/api/platform?limit=1000").then(r => r.json()),
                fetch("/api/pipeline?limit=1000").then(r => r.json())
            ]);

            const platforms = platformsRes.data || [];
            const pipelines = pipelinesRes.data || [];

            const structureMap = new Map<string, { title: string; type: "platform" | "pipeline" }>();
            const structuresList: Structure[] = [];

            platforms.forEach((p: any) => {
                const id = `platform-${p.plat_id}`;
                const title = p.title || p.name || p.str_name || "";
                structureMap.set(id, { title, type: "platform" });
                structuresList.push({ id, name: title, type: "platform" });
            });

            pipelines.forEach((p: any) => {
                const id = `pipeline-${p.pipe_id}`;
                const title = p.title || p.name || p.str_name || "";
                structureMap.set(id, { title, type: "pipeline" });
                structuresList.push({ id, name: title, type: "pipeline" });
            });

            // Sort structures list alphabetically and update state
            structuresList.sort((a, b) => a.name.localeCompare(b.name));
            setAllStructures(structuresList);

            if (data && data.length > 0) {
                const formatted = data.map((jp: any) => {
                    const structures = (jp.metadata as any)?.structures || [];
                    const structureList = Array.isArray(structures)
                        ? structures
                            .map((s: any) => {
                                // Fallback mapping in case jobpack metadata s.id has no type prefix
                                const sType = s.type?.toLowerCase() === "pipeline" || s.name?.toLowerCase().includes("pipe") ? "pipeline" : "platform";
                                const lookupId = s.id?.toString().includes("-") ? s.id.toString() : `${sType}-${s.id}`;
                                const mapInfo = structureMap.get(lookupId);
                                return {
                                    id: lookupId,
                                    name: mapInfo?.title || s.title || s.name || s.code || `Structure ${s.id}`,
                                    type: mapInfo?.type || sType
                                };
                            })
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
                        vessel: (jp.metadata as any)?.vessel || "",
                        contractor: (jp.metadata as any)?.contrac || "",
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

    async function loadSOWReports(jobPackId: string, structureId: string) {
        try {
            console.log("Loading SOW reports via API for job pack:", jobPackId, "structure:", structureId);
            const rawId = structureId.includes("-") ? structureId.split("-")[1] : structureId;
            const res = await fetch(`/api/sow?jobpack_id=${jobPackId}&structure_id=${rawId}`);
            if (!res.ok) {
                throw new Error(`Failed to fetch SOW reports: ${res.statusText}`);
            }
            const resJson = await res.json();
            const sow = resJson.data;

            console.log("Raw u_sow data from API:", sow);

            if (!sow) {
                setSOWReports([]);
                setRawSowItems([]);
                return;
            }

            const sowData = [sow];
            const itemsData = sow.items || [];
            setRawSowItems(itemsData);

            // Group by distinct report numbers (not individual inspection codes)
            const formatted: SOWReport[] = [];
            const reportNumbersSet = new Set<string>();

            sowData.forEach((sow: any) => {
                const reportArray = sow.report_numbers || [];
                
                if (reportArray.length > 0) {
                    reportArray.forEach((r: any) => {
                        const reportNum = r.number;
                        if (!reportNum) return;
                        
                        const uniqueKey = `${sow.id}-${reportNum}`;
                        if (!reportNumbersSet.has(uniqueKey)) {
                            reportNumbersSet.add(uniqueKey);
                            formatted.push({
                                sow_id: sow.id,
                                item_no: reportNum, 
                                report_number: reportNum,
                                job_type: r.job_type || "",
                                scope_description: sow.structure_title || "Inspection Report",
                                inspection_method: "",
                                structure_id: sow.structure_id,
                            });
                        }
                    });
                } else {
                    // Fallback for older SOWs without defined report_numbers array
                    const sowItems = itemsData?.filter((item: any) => item.sow_id === sow.id) || [];
                    let foundAny = false;
                    sowItems.forEach((item: any) => {
                        const reportNum = item.report_number;
                        if (reportNum) {
                            const uniqueKey = `${sow.id}-${reportNum}`;
                            if (!reportNumbersSet.has(uniqueKey)) {
                                reportNumbersSet.add(uniqueKey);
                                formatted.push({
                                    sow_id: sow.id,
                                    item_no: reportNum,
                                    report_number: reportNum,
                                    job_type: "",
                                    scope_description: sow.structure_title || "Inspection Report",
                                    inspection_method: "",
                                    structure_id: sow.structure_id,
                                });
                                foundAny = true;
                            }
                        }
                    });
                    
                    if (!foundAny) {
                        formatted.push({
                            sow_id: sow.id,
                            item_no: "Unassigned",
                            report_number: "Unassigned Items",
                            job_type: "",
                            scope_description: sow.structure_title || "Inspection Report",
                            inspection_method: "",
                            structure_id: sow.structure_id,
                        });
                    }
                }
            });

            console.log("Formatted distinct SOW reports:", formatted);
            setSOWReports(formatted);

            // Helper to prioritize ROV mode by default unless no ROV items are found in the SOW
            const determineDefaultMode = (sowObj: any, reportNum: string, itemsList: any[]) => {
                const reportArray = sowObj.report_numbers || [];
                const reportConfig = reportArray.find((r: any) => r.number === reportNum);
                if (reportConfig && (reportConfig.job_type || "").toUpperCase() === 'ROV') {
                    return "ROV";
                }
                
                const currentReportItems = itemsList.filter(
                    (item) => item.report_number === reportNum
                );
                
                const rovCodes = ['RGVI', 'CP', 'RSWNI', 'SWNI', 'RICMI', 'ANODE', 'FMD', 'RFMD', 'RUTWT', 'RSEAB', 'SEABED', 'RWDI', 'RMGI', 'RSZCI', 'RSCOR', 'SCOUR', 'RRISI', 'JTISI', 'ITISI', 'RCASN', 'RCOND', 'BL', 'RG', 'SG', 'CU'];
                const hasRovItems = currentReportItems.some((item: any) => {
                    const code = (item.inspection_code || item.inspection_type_code || item.inspection_type?.code || "").toUpperCase();
                    return code.startsWith('R') || rovCodes.includes(code);
                });
                
                if (hasRovItems) {
                    return "ROV";
                }
                
                const hasDiverConfig = reportConfig && (reportConfig.job_type || "").toUpperCase() === 'DIVING';
                const diverCodes = ['DGVI', 'GVINS', 'BSINS', 'CVINS', 'CLEAN', 'MPINS', 'UTWTK', 'SZONE', 'CPCLB', 'UTCLB', 'DMGI', 'ANMAIN', 'ACFMC', 'PLCO'];
                const hasDiverItems = currentReportItems.some((item: any) => {
                    const code = (item.inspection_code || item.inspection_type_code || item.inspection_type?.code || "").toUpperCase();
                    return code.startsWith('D') || diverCodes.includes(code);
                });
                
                if (hasDiverConfig || hasDiverItems) {
                    return "DIVING";
                }
                
                return "ROV";
            };

            // Auto-select SOW report and prioritize ROV mode
            if (formatted.length > 0) {
                const savedSOW = sessionStorage.getItem("inspection_sow");
                const savedMode = sessionStorage.getItem("inspection_mode");
                
                const matchingSow = savedSOW && formatted.find(f => `${f.sow_id}-${f.item_no}` === savedSOW);
                if (matchingSow) {
                    setSelectedSOW(`${matchingSow.sow_id}-${matchingSow.item_no}`);
                    const defaultMode = determineDefaultMode(sow, matchingSow.report_number, itemsData);
                    setSelectedMode(savedMode || defaultMode);
                } else {
                    const defaultSow = formatted[0];
                    setSelectedSOW(`${defaultSow.sow_id}-${defaultSow.item_no}`);
                    const defaultMode = determineDefaultMode(sow, defaultSow.report_number, itemsData);
                    setSelectedMode(defaultMode);
                }
            } else {
                setSelectedSOW("");
                setSelectedMode("");
            }
        } catch (error) {
            console.error("Error loading SOW reports:", error);
            toast.error("Failed to load SOW reports");
        }
    }

    function handleSOWChange(sowId: string) {
        setSelectedSOW(sowId);
    }




    return (
        <div className="min-h-screen overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-blue-950/10 dark:to-slate-950">
            <div className="container max-w-7xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/20">
                            <ClipboardCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                                Inspection Module
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                Select job pack, structure, SOW report, and inspection method to begin
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Column - Selectors */}
                    <div className="lg:col-span-6 space-y-4">
                        <Card className="p-0.5 shadow-lg border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden rounded-2xl">
                            <div className="bg-slate-50/50 dark:bg-slate-900/50 p-5 space-y-5 rounded-xl">
                                {/* Structure Selection */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        1. Select Structure
                                    </Label>

                                    <Popover open={openStruct} onOpenChange={setOpenStruct}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openStruct}
                                                disabled={loading || allStructures.length === 0}
                                                className={`w-full justify-between h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-900 ${selectedStructure ? "border-green-400 dark:border-green-600 ring-1 ring-green-100 dark:ring-green-900/40" : ""}`}
                                            >
                                                <div className="flex items-center gap-2 font-semibold text-sm text-slate-900 dark:text-slate-100">
                                                    <Building2 className={`h-4 w-4 ${selectedStructure ? "text-green-600 dark:text-green-400" : "text-slate-400"}`} />
                                                    {selectedStructureData ? (
                                                        <span>
                                                            {selectedStructureData.name} 
                                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1.5 uppercase font-black bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200/50 dark:border-slate-800/50">
                                                                {selectedStructureData.type}
                                                            </span>
                                                        </span>
                                                    ) : (loading ? "Loading..." : allStructures.length === 0 ? "No structures" : "Choose structure...")}
                                                </div>
                                                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[calc(100vw-3rem)] sm:w-[500px] md:w-[600px] p-0 rounded-xl shadow-xl z-50 border-slate-200 dark:border-slate-800" align="start">
                                            <div className="flex items-center border-b px-3 text-slate-500 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                <input
                                                    className="flex h-10 w-full rounded-md bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 font-medium"
                                                    placeholder="Search structure..."
                                                    value={searchStruct}
                                                    onChange={(e) => setSearchStruct(e.target.value)}
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="max-h-[250px] overflow-y-auto p-2 bg-white dark:bg-slate-950 space-y-3">
                                                {/* Structures inside selected Job Pack */}
                                                {selectedJobPack && (
                                                    <div className="space-y-1">
                                                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-500 bg-blue-50/50 dark:bg-blue-950/20 rounded-md">
                                                            Structures in Selected Job Pack ({selectedJobPackData?.structures?.length || 0})
                                                        </div>
                                                        {selectedJobPackData?.structures
                                                            ?.filter((s: any) => s.name.toLowerCase().includes(searchStruct.toLowerCase()))
                                                            .map((struct: any) => {
                                                                const isSelected = selectedStructure === struct.id.toString();
                                                                return (
                                                                    <div
                                                                        key={`jp-struct-${struct.id}`}
                                                                        onClick={() => {
                                                                            if (!isSelected) {
                                                                                setSelectedStructure(struct.id.toString());
                                                                                setSelectedSOW("");
                                                                                setSelectedMode("");
                                                                                sessionStorage.setItem("inspection_structure", struct.id.toString());
                                                                                sessionStorage.removeItem("inspection_sow");
                                                                                sessionStorage.removeItem("inspection_mode");
                                                                            }
                                                                            setOpenStruct(false);
                                                                            setSearchStruct("");
                                                                        }}
                                                                        className={`relative flex justify-between cursor-pointer select-none items-center rounded-lg px-3 py-2 mb-0.5 text-sm outline-none transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${isSelected ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 font-bold border border-green-200 dark:border-green-900" : "text-slate-800 dark:text-slate-200"}`}
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <Building2 className={`h-4 w-4 ${isSelected ? "text-green-600 dark:text-green-500" : "text-slate-400"}`} />
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span>{struct.name}</span>
                                                                                <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-bold bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200/50 dark:border-slate-800/50">
                                                                                    {struct.type || "platform"}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        {isSelected && (
                                                                            <Check className="h-4 w-4 text-green-600 dark:text-green-500" />
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        {selectedJobPackData?.structures?.filter((s: any) => s.name.toLowerCase().includes(searchStruct.toLowerCase())).length === 0 && (
                                                            <div className="py-2 text-center text-xs text-slate-400 italic font-medium">No matching jobpack structures.</div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* All Structures List */}
                                                <div className="space-y-1">
                                                    {selectedJobPack && (
                                                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-t pt-3 mt-2">
                                                            All Structures
                                                        </div>
                                                    )}
                                                    {filteredStructures.length === 0 ? (
                                                        <div className="py-6 text-center text-sm text-slate-500 font-medium">No structure found.</div>
                                                    ) : (
                                                        filteredStructures.map((struct) => {
                                                            const isSelected = selectedStructure === struct.id.toString();
                                                            return (
                                                                <div
                                                                    key={`${struct.id}-${struct.name}`}
                                                                    onClick={() => {
                                                                        if (!isSelected) {
                                                                            setSelectedStructure(struct.id.toString());
                                                                            setSelectedSOW("");
                                                                            setSelectedMode("");
                                                                            sessionStorage.setItem("inspection_structure", struct.id.toString());
                                                                            sessionStorage.removeItem("inspection_sow");
                                                                            sessionStorage.removeItem("inspection_mode");
                                                                        }
                                                                        setOpenStruct(false);
                                                                        setSearchStruct("");
                                                                    }}
                                                                    className={`relative flex justify-between cursor-pointer select-none items-center rounded-lg px-3 py-2 mb-0.5 text-sm outline-none transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${isSelected ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 font-bold border border-green-200 dark:border-green-900" : "text-slate-800 dark:text-slate-200"}`}
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <Building2 className={`h-4 w-4 ${isSelected ? "text-green-600 dark:text-green-500" : "text-slate-400"}`} />
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span>{struct.name}</span>
                                                                            <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-bold bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200/50 dark:border-slate-800/50">
                                                                                {struct.type || "platform"}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    {isSelected && (
                                                                        <Check className="h-4 w-4 text-green-600 dark:text-green-500" />
                                                                    )}
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Job Pack Selection */}
                                <div className={`space-y-2 transition-opacity duration-305 ${!selectedStructure ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
                                    <Label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        2. Select Job Pack
                                    </Label>

                                    <Popover open={openJP} onOpenChange={setOpenJP}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openJP}
                                                disabled={!selectedStructure || jobPacksForSelectedStructure.length === 0}
                                                className={`w-full justify-between h-auto py-2 px-3 font-normal bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-900 ${selectedJobPack ? "border-blue-300 dark:border-blue-700 ring-1 ring-blue-100 dark:ring-blue-900/40" : ""}`}
                                            >
                                                {selectedJobPackData ? (
                                                    <div className="flex flex-col items-start gap-0.5 w-full overflow-hidden text-left">
                                                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{selectedJobPackData.jobpack_no}</span>
                                                        <span className="text-[10px] text-slate-500 truncate w-full uppercase tracking-wider font-semibold">
                                                            {selectedJobPackData.jobpack_title} • {selectedJobPackData.structure_name}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">
                                                        {!selectedStructure ? "Select structure first..." : jobPacksForSelectedStructure.length === 0 ? "No job packs" : "Choose job pack..."}
                                                    </span>
                                                )}
                                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent
                                            className="w-[calc(100vw-3rem)] sm:w-[500px] md:w-[600px] p-0 rounded-xl shadow-xl z-50 overflow-hidden border-slate-200 dark:border-slate-800"
                                            align="start"
                                        >
                                            <div className="flex items-center border-b px-3 text-slate-500 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                <input
                                                    className="flex h-10 w-full rounded-md bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 font-medium"
                                                    placeholder="Search job pack..."
                                                    value={searchJP}
                                                    onChange={(e) => setSearchJP(e.target.value)}
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="max-h-[250px] overflow-y-auto p-2 bg-white dark:bg-slate-950">
                                                {filteredJobPacks.length === 0 ? (
                                                    <div className="py-6 text-center text-sm text-slate-500 font-medium">No job pack found.</div>
                                                ) : (
                                                    sortedYears.map((year) => {
                                                        const jpsInYear = jobPacksByYear[year];
                                                        const isExpanded = !!expandedYears[year];

                                                        return (
                                                            <div key={year} className="mb-1.5">
                                                                <div
                                                                    onClick={() => setExpandedYears(prev => ({ ...prev, [year]: !prev[year] }))}
                                                                    className="flex items-center justify-between px-2.5 py-1.5 bg-slate-55/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer select-none font-bold text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border border-slate-200/40 dark:border-slate-800/40 mb-0.5"
                                                                >
                                                                    <div className="flex items-center gap-1">
                                                                         {isExpanded ? (
                                                                             <ChevronDown className="h-3 w-3 opacity-70" />
                                                                         ) : (
                                                                             <ChevronRight className="h-3 w-3 opacity-70" />
                                                                         )}
                                                                         <span>Year {year}</span>
                                                                    </div>
                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-200/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                                                                        {jpsInYear.length}
                                                                    </span>
                                                                </div>

                                                                {isExpanded && (
                                                                    <div className="pl-2.5 border-l border-slate-100 dark:border-slate-850 ml-2.5 space-y-0.5 mt-0.5">
                                                                        {jpsInYear.map((jp) => (
                                                                            <div
                                                                                key={jp.id}
                                                                                onClick={() => {
                                                                                    setSelectedJobPack(jp.id.toString());
                                                                                    setOpenJP(false);
                                                                                    setSearchJP("");
                                                                                    setTimeout(() => setOpenSOW(true), 150);
                                                                                }}
                                                                                className={`relative flex cursor-pointer select-none items-center rounded-lg px-2.5 py-2 mb-0.5 text-xs outline-none transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${selectedJobPack === jp.id.toString() ? "bg-blue-50 dark:bg-blue-900/20 shadow-sm ring-1 ring-blue-100/70 dark:ring-blue-800/40" : ""}`}
                                                                            >
                                                                                <div className="flex flex-col gap-0.5 w-full pr-6">
                                                                                    <div className={`font-bold ${selectedJobPack === jp.id.toString() ? "text-blue-700 dark:text-blue-300" : "text-slate-900 dark:text-slate-100"}`}>
                                                                                        {jp.jobpack_no}
                                                                                    </div>
                                                                                    <div className="text-[10px] text-slate-500 truncate w-full uppercase tracking-wider font-semibold">
                                                                                        {jp.jobpack_title}
                                                                                    </div>
                                                                                </div>
                                                                                {selectedJobPack === jp.id.toString() && (
                                                                                    <div className="absolute right-2.5 shrink-0 text-blue-600 dark:text-blue-400">
                                                                                        <Check className="h-3.5 w-3.5" />
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
                                </div>



                                {/* SOW Report Selection */}
                                <div className={`space-y-2 transition-opacity duration-305 ${!selectedStructure ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
                                    <Label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        3. Select Job/SOW Report Number
                                    </Label>

                                    <Popover open={openSOW} onOpenChange={setOpenSOW}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openSOW}
                                                disabled={!selectedStructure || sowReports.length === 0}
                                                className={`w-full justify-between h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-900 ${selectedSOW ? "border-slate-400 dark:border-slate-600 ring-1 ring-slate-100 dark:ring-slate-800" : ""}`}
                                            >
                                                <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                                                    {selectedSOWData ? selectedSOWData.report_number : (!selectedStructure ? "Select structure first..." : sowReports.length === 0 ? "No SOW reports" : "Choose SOW report...")}
                                                </div>
                                                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[calc(100vw-3rem)] sm:w-[500px] md:w-[600px] p-0 rounded-xl shadow-xl z-50 border-slate-200 dark:border-slate-800" align="start">
                                            <div className="flex items-center border-b px-3 text-slate-500 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                <input
                                                    className="flex h-10 w-full rounded-md bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 font-medium"
                                                    placeholder="Search SOW report..."
                                                    value={searchSOW}
                                                    onChange={(e) => setSearchSOW(e.target.value)}
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="max-h-[250px] overflow-y-auto p-2 bg-white dark:bg-slate-950">
                                                {filteredSOWs.length === 0 ? (
                                                    <div className="py-6 text-center text-sm text-slate-500 font-medium">No SOW report found.</div>
                                                ) : (
                                                    filteredSOWs.map((sow) => (
                                                        <div
                                                            key={`${sow.sow_id}-${sow.item_no}`}
                                                            onClick={() => {
                                                                setSelectedSOW(`${sow.sow_id}-${sow.item_no}`);
                                                                setOpenSOW(false);
                                                                setSearchSOW("");
                                                            }}
                                                            className={`relative flex justify-between cursor-pointer select-none items-center rounded-lg px-3 py-2 mb-0.5 text-sm outline-none transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${selectedSOW === `${sow.sow_id}-${sow.item_no}` ? "bg-slate-100 dark:bg-slate-800" : ""}`}
                                                        >
                                                            <span className="font-bold text-slate-900 dark:text-slate-100">{sow.report_number}</span>
                                                            {selectedSOW === `${sow.sow_id}-${sow.item_no}` && (
                                                                <Check className="h-4 w-4 text-slate-650 dark:text-slate-400" />
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Inspection Method Selection */}
                                <div className={`space-y-2 transition-opacity duration-305 ${!selectedSOW ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
                                    <Label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        4. Select Inspection Method
                                    </Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div
                                            onClick={() => setSelectedMode("DIVING")}
                                            className={`cursor-pointer p-2.5 rounded-xl border-2 transition-all flex items-center gap-3 ${selectedMode === "DIVING" 
                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md ring-1 ring-blue-200" 
                                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-blue-300 dark:hover:border-blue-700"}`}
                                        >
                                            <div className={`p-2 rounded-lg ${selectedMode === "DIVING" ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-500"}`}>
                                                <LifeBuoy className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className={`font-bold text-sm ${selectedMode === "DIVING" ? "text-blue-900 dark:text-blue-100" : "text-slate-900 dark:text-slate-100"}`}>Diving</p>
                                                <p className="text-[10px] text-slate-500 font-medium">Standard diving inspection</p>
                                            </div>
                                            {selectedMode === "DIVING" && <Check className="ml-auto h-4 w-4 text-blue-600" />}
                                        </div>

                                        <div
                                            onClick={() => setSelectedMode("ROV")}
                                            className={`cursor-pointer p-2.5 rounded-xl border-2 transition-all flex items-center gap-3 ${selectedMode === "ROV" 
                                                ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 shadow-md ring-1 ring-cyan-200" 
                                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-cyan-300 dark:hover:border-cyan-700"}`}
                                        >
                                            <div className={`p-2 rounded-lg ${selectedMode === "ROV" ? "bg-cyan-500 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-500"}`}>
                                                <Bot className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className={`font-bold text-sm ${selectedMode === "ROV" ? "text-cyan-900 dark:text-cyan-100" : "text-slate-900 dark:text-slate-100"}`}>ROV</p>
                                                <p className="text-[10px] text-slate-500 font-medium">Remote operated vehicle</p>
                                            </div>
                                            {selectedMode === "ROV" && <Check className="ml-auto h-4 w-4 text-cyan-600" />}
                                        </div>
                                    </div>
                                </div>

                                {/* Start Button */}
                                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
                                    {selectedStructure && sowReports.length === 0 && (
                                        <div className="mb-3 p-3 rounded-lg bg-amber-55 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex gap-2 text-amber-800 dark:text-amber-200">
                                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                            <div className="text-[11px] font-medium">
                                                <strong>No SOW Reports Found</strong>
                                                <p className="mt-0.5 opacity-90">This structure has no agreed scope. Return to Job Pack Manager to define SOW reports.</p>
                                            </div>
                                        </div>
                                    )}

                                    {(!selectedStructure || sowReports.length > 0) ? (
                                        <Button
                                            disabled={!selectedJobPack || !selectedStructure || !selectedSOW || !selectedMode}
                                            onClick={() => {
                                                if (!selectedJobPack || !selectedStructure || !selectedSOW || !selectedMode) return;
                                                const selectedSOWData = sowReports.find(s => `${s.sow_id}-${s.item_no}` === selectedSOW);
                                                const isPipeline = selectedStructureData?.type === "pipeline";
                                                const targetPath = isPipeline ? "/dashboard/inspection-v2/pipeline-workspace" : "/dashboard/inspection-v2/workspace";
                                                const rawStructId = selectedStructure.includes("-") ? selectedStructure.split("-")[1] : selectedStructure;
                                                
                                                const params = new URLSearchParams({
                                                    jobpack: selectedJobPack,
                                                    structure: rawStructId,
                                                    sow: String(selectedSOWData?.sow_id ?? ""),
                                                    mode: selectedMode,
                                                    jpName: jobPacks.find(j => j.id.toString() === selectedJobPack)?.jobpack_no || "",
                                                    structName: allStructures.find(s => s.id.toString() === selectedStructure)?.name || "",
                                                    sowReport: selectedSOWData?.report_number || "",
                                                    jobType: selectedSOWData?.job_type || "",
                                                });
                                                router.push(`${targetPath}?${params.toString()}`);
                                            }}
                                            className={`w-full h-12 text-sm font-black transition-all duration-300 ${
                                                (!selectedJobPack || !selectedStructure || !selectedSOW || !selectedMode)
                                                    ? "bg-slate-205 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                                                     : "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-600 text-white shadow-md shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:-translate-y-0.5"}`}
                                        >
                                            <span>Start Inspection</span>
                                            <ChevronRight className="h-4 w-4 ml-1.5" />
                                        </Button>
                                    ) : (
                                        <Button
                                            disabled
                                            className="w-full h-12 text-sm font-black bg-slate-205 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                                        >
                                            <span>Start Inspection</span>
                                            <ChevronRight className="h-4 w-4 ml-1.5" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Right Column - Dynamic Progress Summary Card */}
                    <div className="lg:col-span-6 space-y-4 lg:sticky lg:top-6">
                        {sowReportStats ? (
                            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-805 bg-white dark:bg-slate-950 shadow-md space-y-4 transition-all duration-300 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
                                        Inspection Progress Summary
                                    </h3>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                        {selectedSOWData?.report_number}
                                    </span>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                            Completion Rate
                                        </span>
                                        <span className="text-xl font-black text-slate-900 dark:text-white">
                                            {sowReportStats.completionPercentage}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-blue-500 to-emerald-500 h-2.5 rounded-full transition-all duration-500"
                                            style={{ width: `${sowReportStats.completionPercentage}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-1">
                                    <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 shadow-sm flex flex-col justify-between">
                                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                            Completed
                                        </span>
                                        <div className="mt-1">
                                            <span className="text-xl font-black text-slate-900 dark:text-white">
                                                {sowReportStats.completed}
                                            </span>
                                            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-600 ml-1">
                                                / {sowReportStats.total}
                                            </span>
                                        </div>
                                        <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[9px] font-semibold text-slate-500 flex flex-col gap-0.5">
                                            <div className="flex justify-between">
                                                <span>ROV:</span>
                                                <span className="text-slate-700 dark:text-slate-300 font-bold">{sowReportStats.rovDone}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Diving:</span>
                                                <span className="text-slate-700 dark:text-slate-300 font-bold">{sowReportStats.diveDone}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-3 rounded-xl bg-slate-55/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 shadow-sm flex flex-col justify-between">
                                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                                            Anomalies
                                        </span>
                                        <div className="mt-1">
                                            <span className={`text-xl font-black ${anomalyCount > 0 ? "text-amber-500" : "text-slate-900 dark:text-white"}`}>
                                                {anomalyCount}
                                            </span>
                                        </div>
                                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-1">
                                            Reported findings
                                        </span>
                                    </div>

                                    <div className="p-3 rounded-xl bg-slate-55/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 shadow-sm flex flex-col justify-between">
                                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3 text-rose-500" />
                                            Incomplete
                                        </span>
                                        <div className="mt-1">
                                            <span className={`text-xl font-black ${sowReportStats.incomplete > 0 ? "text-rose-500" : "text-slate-900 dark:text-white"}`}>
                                                {sowReportStats.incomplete}
                                            </span>
                                        </div>
                                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-1">
                                            Needs attention
                                        </span>
                                    </div>

                                    <div className="p-3 rounded-xl bg-slate-55/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 shadow-sm flex flex-col justify-between">
                                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                            <HelpCircle className="h-3 w-3 text-slate-400" />
                                            Pending
                                        </span>
                                        <div className="mt-1">
                                            <span className="text-xl font-black text-slate-900 dark:text-white">
                                                {sowReportStats.pending}
                                            </span>
                                        </div>
                                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-1">
                                            Not yet started
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-205 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950 shadow-sm min-h-[280px] transition-all duration-300">
                                <ClipboardCheck className="h-8 w-8 text-slate-300 dark:text-slate-700 mb-2.5" />
                                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-0.5">No SOW Report Selected</h3>
                                <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">
                                    Select a structure, job pack, and SOW report to view dynamic progress and task statistics.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                    <Card className="p-3 bg-blue-50/30 dark:bg-blue-950/10 border-blue-105/50 dark:border-blue-900/50 flex flex-col justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wider mb-1">
                                {selectedStructure ? "Job Packs for Structure" : "Total Job Packs"}
                            </p>
                            <p className="text-lg font-black text-blue-600">
                                {selectedStructure ? jobPacksForSelectedStructure.length : jobPacks.length}
                            </p>
                        </div>
                    </Card>

                    <Card className="p-3 bg-green-50/30 dark:bg-green-950/10 border-green-105/50 dark:border-green-900/50 flex flex-col justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-green-900 dark:text-green-100 uppercase tracking-wider mb-1">
                                Active Vessel / Contractor
                            </p>
                            <p className="text-sm font-extrabold text-green-700 dark:text-green-400 truncate">
                                {selectedJobPackData?.vessel || "—"}
                            </p>
                            {selectedJobPackData?.contractor && (
                                <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                    {selectedJobPackData.contractor}
                                </p>
                            )}
                        </div>
                    </Card>

                    <Card className="p-3 bg-cyan-50/30 dark:bg-cyan-950/10 border-cyan-100/50 dark:border-cyan-900/50 flex flex-col justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-cyan-900 dark:text-cyan-100 uppercase tracking-wider mb-1">
                                {selectedJobPack ? "SOW Reports in Job Pack" : "SOW Reports"}
                            </p>
                            <p className="text-lg font-black text-cyan-600">
                                {selectedStructure && selectedJobPack ? sowReports.length : "—"}
                            </p>
                        </div>
                    </Card>

                    <Card className="p-3 bg-purple-50/30 dark:bg-purple-950/10 border-purple-100/50 dark:border-purple-900/50 flex flex-col justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-purple-900 dark:text-purple-100 uppercase tracking-wider mb-1">
                                Job Type
                            </p>
                            <p className="text-sm font-extrabold text-purple-700 dark:text-purple-400 truncate">
                                {selectedSOWData?.job_type || "—"}
                            </p>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
